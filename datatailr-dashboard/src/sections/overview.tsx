/*************************************************************************
 *
 *  Copyright (c) 2026 Datatailr Inc.
 *
 *  Licensed under the MIT License. See the 'LICENSE' file distributed
 *  with this package for the full license text.
 *
 *  SPDX-License-Identifier: MIT
 *************************************************************************/

import type { RenderElement, RenderNode } from 'claude-code'

import { ApiError } from '../core/api'
import {
  type Budget,
  FAILED_STATES,
  type Job,
  NORMAL_NODE_STATES,
  type PlatformNode,
  type Run,
  SUMMARY_RUNS,
  type Summary,
} from '../core/model'
import type { Route } from '../core/route'
import { timeline } from '../ui/charts'
import type { UiCtx } from '../ui/ctx'
import { KpiTile } from '../ui/kpi'
import { EmptyState } from '../ui/states'
import { StatusText } from '../ui/status'
import { age, stripAnsi } from '../ui/text'
import { isBroken, latestFailedRuns } from './attention'
import type { Section, SectionActions, SectionView } from './contract'

export type OverviewData = { budgets: Budget[] | null }

const DAY_MS = 24 * 60 * 60 * 1000
const ERROR_CHARS = 80
const ATTENTION_ROWS = 20
const BUDGET_ALERT = 0.9

function errorLine(error: string): string {
  const line = stripAnsi(error).replace(/\s+/g, ' ').trim()

  // A character is at most 2 UTF-16 units, so this first cut never splits one.
  return Array.from(line.slice(0, ERROR_CHARS * 2))
    .slice(0, ERROR_CHARS)
    .join('')
}

const percentUsed = (budget: Budget) => Math.floor((budget.usage * 100) / budget.budget)

const isNearLimit = (budget: Budget) => budget.budget > 0 && budget.usage / budget.budget >= BUDGET_ALERT

function RunRow(ui: UiCtx, p: { run: Run; now: number; onPress(): void }): RenderElement {
  const { Button, Text } = ui.els
  const { run } = p
  const error = errorLine(run.error)
  const parts: RenderNode[] = [
    StatusText(ui, { state: run.state }),
    ' ',
    <Text>{run.job}</Text>,
    ' ',
    <Text dimColor>{`${run.type} · ${run.env} · ${age(p.now, run.submit)} ago`}</Text>,
  ]
  if (error !== '') parts.push(' ', <Text color="error">{error}</Text>)

  return (
    <Button key={`att-run-${run.id}`} plain onPress={p.onPress}>
      {parts}
    </Button>
  )
}

function BrokenJobRow(ui: UiCtx, p: { job: Job; onPress(): void }): RenderElement {
  const { Button, Text } = ui.els
  const { job } = p

  return (
    <Button key={`att-job-${job.env}-${job.name}`} plain onPress={p.onPress}>
      {[
        <Text color="error">✕</Text>,
        ' ',
        <Text>{job.name}</Text>,
        ' ',
        <Text dimColor>{`${job.type} · ${job.env} · last build failed`}</Text>,
      ]}
    </Button>
  )
}

function BadNodeRow(ui: UiCtx, p: { node: PlatformNode; onPress(): void }): RenderElement {
  const { Button, Text } = ui.els

  return (
    <Button key={`att-node-${p.node.name}`} plain onPress={p.onPress}>
      <Text dimColor>{`${p.node.name} · ${p.node.state}`}</Text>
    </Button>
  )
}

function NearLimitRow(ui: UiCtx, p: { budget: Budget; onPress(): void }): RenderElement {
  const { Button, Text } = ui.els
  const { budget } = p
  const tone = budget.usage >= budget.budget ? 'error' : 'warning'

  return (
    <Button key={`att-budget-${budget.name}`} plain onPress={p.onPress}>
      <Text>
        {budget.name} <Text color={tone}>{`${percentUsed(budget)}% of budget used`}</Text>
      </Text>
    </Button>
  )
}

function kpiCounts(summary: Summary) {
  const { runs, jobs, nodes } = summary
  const countRuns = (state: string) => runs.filter(run => run.state === state).length

  return {
    running: countRuns('running'),
    failed: runs.filter(run => FAILED_STATES.has(run.state)).length,
    completed: countRuns('completed'),
    building: jobs.filter(job => job.state === 'building').length,
    broken: jobs.filter(isBroken).length,
    nodes: nodes.filter(node => node.state === 'running').length,
  }
}

function Tiles(ui: UiCtx, summary: Summary, act: SectionActions): RenderElement {
  const { Box } = ui.els
  const counts = kpiCounts(summary)
  const open = (next: Partial<Route>) => () => act.go({ section: 'compute', ...next })

  return (
    <Box flexWrap="wrap" gap={2}>
      {KpiTile(ui, {
        key: 'kpi-running',
        label: 'running',
        value: counts.running,
        tone: 'success',
        onPress: open({ tab: 'runs', filter: { state: 'running' } }),
      })}
      {KpiTile(ui, {
        key: 'kpi-failed',
        label: 'failed · 24h',
        value: counts.failed,
        tone: 'error',
        onPress: open({ tab: 'runs', filter: { state: 'failed' } }),
      })}
      {KpiTile(ui, {
        key: 'kpi-completed',
        label: 'completed · 24h',
        value: counts.completed,
        tone: 'text',
        onPress: open({ tab: 'runs' }),
      })}
      {KpiTile(ui, {
        key: 'kpi-building',
        label: 'building',
        value: counts.building,
        tone: 'warning',
        onPress: open({}),
      })}
      {KpiTile(ui, {
        key: 'kpi-broken',
        label: 'broken builds',
        value: counts.broken,
        tone: 'error',
        onPress: open({}),
      })}
      {KpiTile(ui, {
        key: 'kpi-nodes',
        label: 'nodes',
        value: counts.nodes,
        tone: 'text',
        onPress: () => act.go({ section: 'nodes' }),
      })}
    </Box>
  )
}

// The engine gives the terminal an `Svg` that draws nothing, so only the surface tells it apart.
function Timeline(ui: UiCtx, summary: Summary, now: number): RenderElement | null {
  if (ui.surface === 'terminal' || !('Svg' in ui.els)) return null

  const { Svg } = ui.els
  // The summary also holds running runs of any age; the alt text counts the last 24 hours only.
  const inWindow = summary.runs.filter(run => run.submit >= now - DAY_MS)
  const failed = inWindow.filter(run => FAILED_STATES.has(run.state)).length

  return (
    <Svg
      source={timeline(summary.runs, now, DAY_MS)}
      alt={`${inWindow.length} runs in the last 24 hours, ${failed} failed`}
      isInteractive
    />
  )
}

function attentionOf(summary: Summary, budgets: Budget[] | null) {
  return {
    runs: latestFailedRuns(summary.runs),
    jobs: summary.jobs.filter(isBroken),
    nodes: summary.nodes.filter(node => !NORMAL_NODE_STATES.has(node.state)),
    budgets: (budgets ?? []).filter(isNearLimit),
  }
}

function Attention(
  ui: UiCtx,
  p: { summary: Summary; budgets: Budget[] | null; now: number; act: SectionActions },
): RenderElement {
  const { Box, Button, Text } = ui.els
  const { summary, act } = p
  const needs = attentionOf(summary, p.budgets)

  const runs = needs.runs.slice(0, ATTENTION_ROWS)
  const jobs = needs.jobs.slice(0, ATTENTION_ROWS - runs.length)
  const nodes = needs.nodes.slice(0, ATTENTION_ROWS - runs.length - jobs.length)
  const budgets = needs.budgets.slice(0, ATTENTION_ROWS - runs.length - jobs.length - nodes.length)
  const total = needs.runs.length + needs.jobs.length + needs.nodes.length + needs.budgets.length
  const rest = total - runs.length - jobs.length - nodes.length - budgets.length

  const rows: RenderElement[] = [
    ...runs.map(run =>
      RunRow(ui, {
        run,
        now: p.now,
        onPress: () => act.go({ section: 'compute', tab: 'runs', item: { kind: 'run', id: String(run.id) } }),
      }),
    ),
    ...jobs.map(job =>
      BrokenJobRow(ui, {
        job,
        onPress: () => act.go({ section: 'compute', item: { kind: 'job', id: `${job.env}:${job.name}` } }),
      }),
    ),
    ...nodes.map(node => BadNodeRow(ui, { node, onPress: () => act.go({ section: 'nodes', item: { kind: 'node', id: node.name } }) })),
    ...budgets.map(budget => NearLimitRow(ui, { budget, onPress: () => act.go({ section: 'cost' }) })),
  ]
  if (rest > 0) {
    rows.push(
      <Button
        key="att-more"
        plain
        label={`${rest} more`}
        onPress={() => act.go({ section: 'compute', tab: 'runs', filter: { state: 'failed' } })}
      />,
    )
  }

  return (
    <Box flexDirection="column">
      <Text weight="semibold">Needs attention</Text>
      {rows.length > 0 ? rows : EmptyState(ui, { text: 'Nothing needs attention.' })}
    </Box>
  )
}

function describeOverview(view: SectionView<OverviewData>): string | null {
  const { summary } = view
  if (summary === null) return null

  const counts = kpiCounts(summary)
  const needs = attentionOf(summary, view.data?.budgets ?? null)
  const items = needs.runs.length + needs.jobs.length + needs.nodes.length + needs.budgets.length

  return (
    `Overview: ${counts.running} running, ${counts.failed} failed in 24 hours, ` +
    `${counts.completed} completed in 24 hours, ${counts.building} building, ` +
    `${counts.broken} broken builds, ${counts.nodes} nodes running. ` +
    `${items} ${items === 1 ? 'item needs' : 'items need'} attention.`
  )
}

export const overview: Section<OverviewData> = {
  id: 'overview',
  title: 'Overview',
  refreshMs: 10_000,

  async load(api) {
    try {
      return { budgets: await api.budgets.list() }
    } catch (error) {
      // Budgets are optional: any API error hides them, except an ended session, which the shell handles.
      if (error instanceof ApiError && error.kind !== 'logged-out') return { budgets: null }
      throw error
    }
  },

  render(ui, view, act) {
    const { Box, Text } = ui.els
    const { summary } = view

    if (summary === null) return <Text dimColor>Loading…</Text>

    return (
      <Box flexDirection="column" gap={1}>
        {Tiles(ui, summary, act)}
        {summary.hasMoreRuns === true ? (
          <Text dimColor>{`Counts cover the newest ${SUMMARY_RUNS} runs of the last 24 hours.`}</Text>
        ) : null}
        {Timeline(ui, summary, view.now)}
        {Attention(ui, { summary, budgets: view.data?.budgets ?? null, now: view.now, act })}
      </Box>
    )
  },

  describe: describeOverview,
}
