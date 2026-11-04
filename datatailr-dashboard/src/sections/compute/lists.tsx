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

import { LIST_LIMIT, type Page } from '../../core/endpoints'
import type { Job, Run, Summary, Workflow } from '../../core/model'
import type { Route } from '../../core/route'
import type { UiCtx } from '../../ui/ctx'
import { FilterBar, type FilterSelect } from '../../ui/filters'
import { EmptyState } from '../../ui/states'
import { type Column, Table } from '../../ui/table'
import type { SectionActions } from '../contract'
import { jobColumns, runColumns, workflowColumns } from './columns'
import {
  ALL,
  ENVIRONMENTS,
  JOB_CHIPS,
  RUN_CHIPS,
  RUN_TYPES,
  WORKFLOW_CHIPS,
  filterJobs,
  filterOf,
  filterWorkflows,
  isRunningNow,
  pageOf,
  pageRows,
  searchOf,
  withMarks,
} from './filters'

function withFilter(route: Route, id: string, value: string): Record<string, string> | undefined {
  const { [id]: _removed, ...others } = route.filter ?? {}
  const next = value === ALL ? others : { ...others, [id]: value }

  return Object.keys(next).length === 0 ? undefined : next
}

const setFilter = (act: SectionActions, route: Route, id: string, value: string) =>
  act.go({ filter: withFilter(route, id, value), page: undefined })

const setSearch = (act: SectionActions, text: string) =>
  act.go({ search: text.trim() === '' ? undefined : text.trim(), page: undefined })

const setPage = (act: SectionActions, page: number) => act.go({ page: page === 0 ? undefined : page })

export const setTab = (act: SectionActions, id: string) =>
  act.go({ tab: id, filter: undefined, search: undefined, page: undefined })

const chipsOf = (ids: readonly string[]) =>
  ids.map(id => ({ id, label: id.charAt(0).toUpperCase() + id.slice(1).replace(/-/g, ' ') }))

const selectOf = (
  route: Route,
  p: { id: string; filter: string; label: string; values: readonly string[] },
  act: SectionActions,
): FilterSelect => ({
  id: p.id,
  label: p.label,
  options: [ALL, ...p.values].map(value => ({ value, label: value })),
  value: filterOf(route, p.filter, p.values),
  onSelect: value => setFilter(act, route, p.filter, value),
})

function List<Row>(
  ui: UiCtx,
  p: {
    route: Route
    act: SectionActions
    chips: readonly string[]
    selects?: FilterSelect[]
    note?: string
    columns: Column<Row>[]
    page: Page<Row>
    rowKey(row: Row): string
    onRow(row: Row): void
    empty: string
  },
): RenderElement {
  const { Box, Text } = ui.els
  const { route, act } = p

  return (
    <Box flexDirection="column" gap={1}>
      {FilterBar(ui, {
        chips: chipsOf(p.chips),
        current: filterOf(route, 'state', p.chips),
        onChip: id => setFilter(act, route, 'state', id),
        ...(p.selects === undefined ? {} : { selects: p.selects }),
        search: searchOf(route),
        onSearch: text => setSearch(act, text),
      })}
      {p.note === undefined ? null : <Text dimColor>{p.note}</Text>}
      {Table(ui, {
        key: 'compute-table',
        columns: p.columns,
        rows: p.page.rows,
        rowKey: p.rowKey,
        onRow: p.onRow,
        page: pageOf(route),
        hasMore: p.page.hasMore,
        onPage: page => setPage(act, page),
      })}
      {p.page.rows.length === 0 ? EmptyState(ui, { text: p.empty }) : null}
    </Box>
  )
}

export function RunsList(ui: UiCtx, p: { route: Route; act: SectionActions; page: Page<Run>; now: number }) {
  return List(ui, {
    route: p.route,
    act: p.act,
    chips: RUN_CHIPS,
    selects: [selectOf(p.route, { id: 'type-filter', filter: 'type', label: 'Type', values: RUN_TYPES }, p.act)],
    note: isRunningNow(p.route) ? 'running now' : 'last 24 hours',
    columns: runColumns(p.now),
    page: p.page,
    rowKey: run => `run-${run.id}`,
    onRow: run => p.act.go({ item: { kind: 'run', id: String(run.id) } }),
    empty: 'No runs.',
  })
}

export const CAPPED_NOTE = `Showing the first ${LIST_LIMIT}.`

export function WorkflowsList(
  ui: UiCtx,
  p: { route: Route; act: SectionActions; rows: Workflow[]; summary: Summary | null },
) {
  const page = pageRows(filterWorkflows(p.rows, p.route), p.route)

  return List(ui, {
    route: p.route,
    act: p.act,
    chips: WORKFLOW_CHIPS,
    ...(p.rows.length >= LIST_LIMIT ? { note: CAPPED_NOTE } : {}),
    columns: workflowColumns,
    page: { rows: withMarks(page.rows, p.summary?.runs ?? []), hasMore: page.hasMore },
    rowKey: row => `wf-${row.env}-${row.name}`,
    onRow: row => p.act.go({ item: { kind: 'job', id: `${row.env}:${row.name}` } }),
    empty: 'No workflows.',
  })
}

export function JobsList(ui: UiCtx, p: { route: Route; act: SectionActions; rows: Job[]; empty: string }) {
  return List(ui, {
    route: p.route,
    act: p.act,
    chips: JOB_CHIPS,
    selects: [selectOf(p.route, { id: 'env-filter', filter: 'env', label: 'Environment', values: ENVIRONMENTS }, p.act)],
    columns: jobColumns,
    page: pageRows(filterJobs(p.rows, p.route), p.route),
    rowKey: job => `job-${job.env}-${job.name}`,
    onRow: job => p.act.go({ item: { kind: 'job', id: `${job.env}:${job.name}` } }),
    empty: p.empty,
  })
}
