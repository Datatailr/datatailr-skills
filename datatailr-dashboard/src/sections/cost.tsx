/*************************************************************************
 *
 *  Copyright (c) 2026 Datatailr Inc.
 *
 *  Licensed under the MIT License. See the 'LICENSE' file distributed
 *  with this package for the full license text.
 *
 *  SPDX-License-Identifier: MIT
 *************************************************************************/

import type { RenderElement } from 'claude-code'

import { ApiError, type ErrorKind } from '../core/api'
import type { Endpoints } from '../core/endpoints'
import type { Budget, CostRow } from '../core/model'
import type { Route } from '../core/route'
import { bars } from '../ui/charts'
import type { UiCtx } from '../ui/ctx'
import { EmptyState, ErrorState } from '../ui/states'
import { type Column, PAGE_SIZE, Table } from '../ui/table'
import { meter } from '../ui/text'
import type { Section, SectionActions, SectionView } from './contract'

// `spend` is the error kind of a failed `cost view`, which only an admin may read: the budgets stay.
export type CostData = { today: string; spend: CostRow[] | ErrorKind; budgets: Budget[] }

type Group = { name: string; cost: number }

const DAY_MS = 24 * 60 * 60 * 1000
const DAYS = 30
const BUDGET_ALERT = 0.9
const GROUPS = [{ value: 'owner', label: 'owner' }, { value: 'env', label: 'environment' }, { value: 'type', label: 'job type' }] as const
// One page, and a row opens nothing: the section has no item pages.
const INERT = { page: 0, hasMore: false, onRow: () => undefined, onPage: () => undefined }

const dayOf = (ms: number) => new Date(ms).toISOString().slice(0, 10)
// The UTC days that start this month and the last 30 days.
const windowOf = (today: string) => ({ month: `${today.slice(0, 8)}01`, since: dayOf(Date.parse(today) - (DAYS - 1) * DAY_MS) })
const sum = (rows: CostRow[]) => rows.reduce((total, row) => total + row.cost, 0)
const usd = (value: number) => `$${value.toFixed(2).replace(/\B(?=(\d{3})+\.)/g, ',')}`
const groupOf = (route: Route) => GROUPS.find(group => group.value === route.filter?.by) ?? GROUPS[0]
const pageOf = (route: Route) => Math.max(0, Math.floor(route.page ?? 0))

function groupsOf(rows: CostRow[], by: (typeof GROUPS)[number]['value']): Group[] {
  const costs = new Map<string, number>()
  for (const row of rows) costs.set(row[by], (costs.get(row[by]) ?? 0) + row.cost)

  return [...costs].map(([name, cost]) => ({ name, cost })).sort((a, b) => b.cost - a.cost || a.name.localeCompare(b.name))
}

const budgetTone = ({ budget, usage }: Budget) =>
  budget <= 0 ? '' : usage >= budget ? 'error' : usage / budget >= BUDGET_ALERT ? 'warning' : ''

const budgetColumns: Column<Budget>[] = [
  { id: 'name', title: 'name', width: 20, cell: budget => budget.name },
  { id: 'cap', title: 'cap', width: 12, cell: budget => (budget.isReadable ? usd(budget.budget) : '—') },
  { id: 'used', title: 'used', width: 12, cell: budget => (budget.isReadable ? usd(budget.usage) : '—') },
  { id: 'meter', title: 'used %', width: 16, cell: budget => meter(budget.usage, budget.budget, 10), tone: budgetTone },
  { id: 'stops', title: 'stops new runs', width: 14, cell: budget => (budget.preventOverflow ? 'yes' : 'no') },
]

function Chart(ui: UiCtx, rows: CostRow[], since: string): RenderElement | null {
  if (ui.surface === 'terminal' || !('Svg' in ui.els)) return null
  const { Svg } = ui.els
  const days = Array.from({ length: DAYS }, (_, i) => dayOf(Date.parse(since) + i * DAY_MS))
  const values = days.map(day => ({ label: day, value: sum(rows.filter(row => row.date === day)) }))
  return <Svg source={bars(values, 640, 60)} alt={`Daily spend from ${since} to ${days.at(-1)}, ${usd(sum(rows))} in all`} isInteractive />
}

function GroupSelect(ui: UiCtx, route: Route, act: SectionActions): RenderElement | null {
  if (!('Select' in ui.els)) return null
  const { Select } = ui.els
  const pick = (value: string) => act.go({ filter: value === 'owner' ? undefined : { by: value }, page: undefined })
  return <Select key="cost-group" label="Group by" options={GROUPS} value={groupOf(route).value} onSelect={pick} />
}

function Spend(ui: UiCtx, view: SectionView<CostData>, data: CostData, act: SectionActions): RenderElement {
  const { Box, Text } = ui.els
  const { spend } = data
  const tile = (value: number, label: string) => <Text><Text size="title">{usd(value)}</Text> <Text dimColor>{label}</Text></Text>
  if (spend === 'no-access') return EmptyState(ui, { text: 'Spend needs an admin account.' })
  if (typeof spend === 'string') return ErrorState(ui, { kind: spend, installation: view.installation })

  const { month, since } = windowOf(data.today)
  const rows = spend.filter(row => row.date >= since)
  const total = sum(rows)
  const group = groupOf(view.route)
  const groups = groupsOf(rows, group.value)
  const page = pageOf(view.route)
  const columns: Column<Group>[] = [
    { id: 'name', title: group.label, width: 24, cell: row => row.name || '—' },
    { id: 'cost', title: '30 days', width: 12, cell: row => usd(row.cost) },
    { id: 'share', title: 'share', width: 16, cell: row => meter(row.cost, total, 10) },
  ]

  return (
    <Box flexDirection="column" gap={1}>
      <Box flexWrap="wrap" gap={2}>
        {tile(sum(spend.filter(row => row.date >= month)), 'this month')}
        {tile(total, 'last 30 days')}
      </Box>
      {Chart(ui, rows, since)}
      {GroupSelect(ui, view.route, act)}
      {Table(ui, {
        key: 'cost-spend',
        columns,
        rows: groups.slice(page * PAGE_SIZE),
        rowKey: row => `spend-${row.name}`,
        ...INERT,
        page,
        hasMore: groups.length > (page + 1) * PAGE_SIZE,
        onPage: next => act.go({ page: next === 0 ? undefined : next }),
      })}
      {groups.length === 0 ? EmptyState(ui, { text: 'No spend in the last 30 days.' }) : null}
    </Box>
  )
}

async function spendOf(api: Endpoints, begin: string, end: string): Promise<CostRow[] | ErrorKind> {
  try {
    return await api.cost.view(begin, end)
  } catch (error) {
    if (error instanceof ApiError && error.kind !== 'logged-out') return error.kind
    throw error
  }
}

export const cost: Section<CostData> = {
  id: 'cost',
  title: 'Cost and budgets',
  refreshMs: 60_000,
  loadKey: () => 'cost',

  async load(api, _route, now) {
    const today = dayOf(now)
    const { month, since } = windowOf(today)
    const [spend, budgets] = await Promise.all([spendOf(api, month < since ? month : since, today), api.budgets.list()])

    return { today, spend, budgets }
  },

  render(ui, view, act) {
    const { Box, Text } = ui.els
    const { data } = view
    if (data === null) {
      if (view.error === null || view.error === 'logged-out') return <Text dimColor>Loading…</Text>
      return ErrorState(ui, { kind: view.error, installation: view.installation })
    }

    return (
      <Box flexDirection="column" gap={1}>
        {Spend(ui, view, data, act)}
        <Text weight="semibold">Budgets</Text>
        {Table(ui, { key: 'cost-budgets', columns: budgetColumns, rows: data.budgets, rowKey: row => `budget-${row.name}`, ...INERT })}
        {data.budgets.length === 0 ? EmptyState(ui, { text: 'No budgets.' }) : null}
        {data.budgets.length > PAGE_SIZE ? <Text dimColor>{`The first ${PAGE_SIZE} of ${data.budgets.length} budgets.`}</Text> : null}
      </Box>
    )
  },
}
