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

import { ApiError } from '../core/api'
import { type NodeAction, type NodeRun, NORMAL_NODE_STATES, type PlatformNode } from '../core/model'
import type { Route } from '../core/route'
import type { UiCtx } from '../ui/ctx'
import { BackButton, DetailHeader } from '../ui/detail'
import { FilterBar } from '../ui/filters'
import { EmptyState, ErrorState } from '../ui/states'
import { stateColor, stateLabel } from '../ui/status'
import { type Column, PAGE_SIZE, Table } from '../ui/table'
import { age, memory, meter } from '../ui/text'
import { ALL, filterOf, pageOf, pageRows, searchOf } from './listing'
import type { Section, SectionActions, SectionView } from './contract'

export type NodesData = { nodes: PlatformNode[]; prices: Record<string, number> | null }

const CHIPS = [ALL, 'running', 'draining', 'other']
const ENVIRONMENTS = ['dev', 'pre', 'prod', 'system']
const CELLS = 5
const NO_PAGES = { page: 0, hasMore: false, onPage: () => undefined }

const ACTIONS = {
  drain: { label: 'Drain', question: (node: string) => `Drain ${node}? No new runs start on it.`, yesLabel: 'Yes, drain' },
  undrain: { label: 'Stop draining', question: (node: string) => `Stop draining ${node}?`, yesLabel: 'Yes, stop draining' },
} as const

const figure = (value: number) => String(Math.round(value * 100) / 100)
const bytes = (value: number) => (value > 0 ? memory(String(value)) : '0')

const cpuOf = ({ cpu }: PlatformNode) =>
  cpu === null ? '—' : meter(cpu.allocated, cpu.total, CELLS, `${figure(cpu.allocated)}/${figure(cpu.total)}`)
const memoryOf = ({ memory: used }: PlatformNode) =>
  used === null ? '—' : meter(used.allocated, used.max, CELLS, `${bytes(used.allocated)}/${bytes(used.max)}`)

// A price of 0 is no price, as in the web GUI, which also keeps up to 4 decimals for cheap types.
function priceOf(prices: Record<string, number> | null, type: string): string {
  const price = prices?.[type] ?? 0
  if (price <= 0) return '—'
  return price < 0.0001 ? '<$0.0001/hr' : `$${price.toFixed(4).replace(/0{1,2}$/, '')}/hr`
}

const chipOf = (state: string) => (state === 'running' || state === 'draining' ? state : 'other')
function filterNodes(nodes: readonly PlatformNode[], route: Route): PlatformNode[] {
  const chip = filterOf(route, 'state', CHIPS)
  const env = filterOf(route, 'env', ENVIRONMENTS)
  const search = searchOf(route).toLowerCase()
  return nodes.filter(
    node => (chip === ALL || chipOf(node.state) === chip) && (env === ALL || node.env === env) && node.name.toLowerCase().includes(search),
  )
}

function withFilter(route: Route, id: string, value: string): Partial<Route> {
  const { [id]: _removed, ...others } = route.filter ?? {}
  const filter = value === ALL ? others : { ...others, [id]: value }
  return { filter: Object.keys(filter).length === 0 ? undefined : filter, page: undefined }
}

const nodeColumns = (prices: Record<string, number> | null): Column<PlatformNode>[] => [
  { id: 'name', title: 'name', width: 16, cell: node => node.name },
  { id: 'environment', title: 'env', width: 6, cell: node => node.env },
  { id: 'class', title: 'class', width: 7, cell: node => node.class },
  { id: 'type', title: 'type', width: 14, cell: node => node.type },
  { id: 'state', title: 'state', width: 10, cell: node => stateLabel(node.state), tone: node => stateColor(node.state) },
  { id: 'cpu', title: 'CPU', width: 11, cell: cpuOf },
  { id: 'memory', title: 'memory', width: 19, cell: memoryOf },
  { id: 'price', title: 'price', width: 10, cell: node => priceOf(prices, node.type) },
]

const runColumns: Column<NodeRun>[] = [
  { id: 'job', title: 'job', width: 22, cell: run => run.job },
  { id: 'environment', title: 'env', width: 6, cell: run => run.env },
  { id: 'state', title: 'state', width: 13, cell: run => stateLabel(run.state), tone: run => stateColor(run.state) },
  { id: 'run', title: 'run', width: 8, cell: run => `#${run.runId}` },
  { id: 'cpu', title: 'CPU', width: 5, cell: run => (run.cpus === null || run.cpus <= 0 ? '—' : figure(run.cpus)) },
  { id: 'memory', title: 'memory', width: 8, cell: run => (run.memory === null ? '—' : memory(String(run.memory))) },
]

function actionOf(node: PlatformNode): NodeAction | null {
  if (node.host === '' || (node.state !== 'running' && node.state !== 'draining')) return null
  return { verb: node.state === 'running' ? 'drain' : 'undrain', node: node.name, host: node.host }
}

function Waiting(ui: UiCtx, view: SectionView<NodesData>): RenderElement {
  const { Text } = ui.els
  // The shell's bar tells of an ended session, once.
  if (view.error === null || view.error === 'logged-out') return <Text dimColor>Loading…</Text>
  return ErrorState(ui, { kind: view.error, installation: view.installation })
}

function NodeList(ui: UiCtx, route: Route, data: NodesData, act: SectionActions): RenderElement {
  const { Box } = ui.els
  const page = pageRows(filterNodes(data.nodes, route), route)
  const options = [ALL, ...ENVIRONMENTS].map(value => ({ value, label: value }))
  const onSelect = (value: string) => act.go(withFilter(route, 'env', value))

  return (
    <Box flexDirection="column" gap={1}>
      {FilterBar(ui, {
        chips: CHIPS.map(id => ({ id, label: id.charAt(0).toUpperCase() + id.slice(1) })),
        current: filterOf(route, 'state', CHIPS),
        onChip: id => act.go(withFilter(route, 'state', id)),
        selects: [{ id: 'env-filter', label: 'Environment', options, value: filterOf(route, 'env', ENVIRONMENTS), onSelect }],
        search: searchOf(route),
        onSearch: text => act.go({ search: text.trim() === '' ? undefined : text.trim(), page: undefined }),
      })}
      {Table(ui, {
        key: 'nodes-table',
        columns: nodeColumns(data.prices),
        rows: page.rows,
        rowKey: node => `node-${node.name}`,
        onRow: node => act.go({ item: { kind: 'node', id: node.name } }),
        page: pageOf(route),
        hasMore: page.hasMore,
        onPage: next => act.go({ page: next === 0 ? undefined : next }),
      })}
      {page.rows.length === 0 ? EmptyState(ui, { text: 'No nodes.' }) : null}
    </Box>
  )
}

function NodePage(ui: UiCtx, view: SectionView<NodesData>, act: SectionActions): RenderElement {
  const { Box, Button, Text } = ui.els
  const { data, now } = view
  const node = data?.nodes.find(candidate => candidate.name === view.route.item?.id)
  if (data === null || node === undefined) {
    return (
      <Box flexDirection="column" gap={1}>
        {BackButton(ui, { onBack: act.back })}
        {data === null ? Waiting(ui, view) : EmptyState(ui, { text: 'This node no longer exists.' })}
      </Box>
    )
  }

  const created = node.createdAt === null ? '' : `created ${age(now, node.createdAt)} ago`
  const subtitle = [node.env, node.class, node.type, node.privateIp, created].filter(part => part !== '').join(' · ')
  const action = view.isConnected ? actionOf(node) : null
  const ask = (a: NodeAction) => act.ask(a, ACTIONS[a.verb].question(node.name), ACTIONS[a.verb].yesLabel)
  const tags = Object.entries(node.tags).sort(([a], [b]) => a.localeCompare(b))

  return (
    <Box flexDirection="column" gap={1}>
      {DetailHeader(ui, { title: node.name, state: node.state, subtitle, onBack: act.back })}
      <Text>{`CPU ${cpuOf(node)} · memory ${memoryOf(node)} · price ${priceOf(data.prices, node.type)}`}</Text>
      {action === null ? null : <Button key={action.verb} label={ACTIONS[action.verb].label} onPress={() => ask(action)} />}
      <Box flexDirection="column">
        <Text weight="semibold">Runs</Text>
        {node.runs.length === 0
          ? EmptyState(ui, { text: 'No runs on this node.' })
          : Table(ui, {
              key: 'nodes-runs',
              columns: runColumns,
              rows: node.runs,
              rowKey: run => `run-${node.runs.indexOf(run)}`,
              onRow: run => act.go({ section: 'compute', item: { kind: 'run', id: String(run.runId) } }),
              ...NO_PAGES,
            })}
        {node.runs.length > PAGE_SIZE ? <Text dimColor>{`The first ${PAGE_SIZE} of ${node.runs.length} runs.`}</Text> : null}
      </Box>
      <Box flexDirection="column">
        <Text weight="semibold">Tags</Text>
        {tags.length === 0 ? EmptyState(ui, { text: 'No tags.' }) : tags.map(([name, value]) => <Text>{`${name}: ${value}`}</Text>)}
      </Box>
    </Box>
  )
}

// The prices are optional: an API error leaves them out, except an ended session, which the shell handles.
function noPrices(error: unknown): null {
  if (error instanceof ApiError && error.kind !== 'logged-out') return null
  throw error
}

export const nodes: Section<NodesData> = {
  id: 'nodes',
  title: 'Nodes',
  refreshMs: 30_000,
  // A node page draws a node of the list: every route shares one load.
  loadKey: () => 'nodes',
  load: api => Promise.all([api.nodes.list(), api.nodes.prices().catch(noPrices)]).then(([list, prices]) => ({ nodes: list, prices })),

  render(ui, view, act) {
    if (view.route.item !== undefined) return NodePage(ui, view, act)
    return view.data === null ? Waiting(ui, view) : NodeList(ui, view.route, view.data, act)
  },

  attention: summary => summary.nodes.filter(node => !NORMAL_NODE_STATES.has(node.state)).length,
}
