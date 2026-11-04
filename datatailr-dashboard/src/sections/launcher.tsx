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

import type { Job, JobAction, JobImage, Run, Summary, Workstation } from '../core/model'
import type { Route } from '../core/route'
import type { UiCtx } from '../ui/ctx'
import { BackButton, DetailHeader } from '../ui/detail'
import { EmptyState, ErrorState } from '../ui/states'
import { stateColor, stateLabel } from '../ui/status'
import { type Column, Table } from '../ui/table'
import { Tabs } from '../ui/tabs'
import { age, cut, memory, stripAnsi } from '../ui/text'
import { confirmOf, openUrl } from './compute/detail-actions'
import { listedState } from './compute/filters'
import { pageOf, pageRows } from './listing'
import { setTab } from './compute/lists'
import type { Section, SectionActions, SectionView } from './contract'

const TABS = [
  { id: 'apps', label: 'Apps and services', types: ['app', 'service'], empty: 'No apps or services.' },
  { id: 'excel', label: 'Excel', types: ['excel'], empty: 'No Excel add-ins.' },
  { id: 'workstations', label: 'Workstations', types: [], empty: 'No workstations.' },
] as const

type Tab = (typeof TABS)[number]

const tabOf = (route: Route): Tab => TABS.find(tab => tab.id === route.tab) ?? TABS[0]

const COMPUTE_TABS: Record<string, string> = { app: 'apps', service: 'services', excel: 'excel' }

type Copy = { user: string; run: Run }

type Row = { job: Job; state: string; href: string | null; copies: Copy[]; image: JobImage | null }

const idOf = (job: Job) => `${job.env}:${job.name}`

const connectUrl = (base: string, job: Job, target: string) =>
  `${base.replace(/\/+$/, '')}/connect/${encodeURIComponent(job.name)}/${encodeURIComponent(job.env)}/${target}`

// An Excel add-in's link starts it, so it is there while the add-in is stopped too.
function jobRows(summary: Summary, types: readonly string[], base: string): Row[] {
  const live = new Set(summary.runs.filter(run => run.state === 'running').map(run => `${run.env}:${run.job}`))

  return summary.jobs
    .filter(job => types.includes(job.type))
    .map(job => {
      const isRunning = live.has(idOf(job))
      const open = isRunning ? (openUrl(base, { kind: 'job', job, recent: [] })?.href ?? null) : null
      const href = job.type === 'excel' ? connectUrl(base, job, 'excel') : open
      return { job, state: listedState(job, isRunning), href, copies: [], image: null }
    })
}

// The copy of a template is `<template>-<user>`; of two templates such as `ws` and `ws-gpu`, the longer name owns it.
function workstationRows(summary: Summary, templates: readonly Workstation[]): Row[] {
  const longestFirst = [...templates].sort((a, b) => b.name.length - a.name.length)
  const copies = new Map<Workstation, Copy[]>()
  for (const run of summary.runs) {
    if (run.state !== 'running' || run.type !== 'workstation') continue
    const owner = longestFirst.find(
      job => job.env === run.env && run.job.length > job.name.length + 1 && run.job.startsWith(`${job.name}-`),
    )
    if (owner !== undefined) copies.set(owner, [...(copies.get(owner) ?? []), { user: run.job.slice(owner.name.length + 1), run }])
  }

  return templates.map(job => {
    const own = copies.get(job) ?? []
    // The view sends no build result: `job ls` has it.
    const built = summary.jobs.find(found => idOf(found) === idOf(job))?.built ?? true
    return { job: { ...job, built }, state: listedState(job, own.length > 0), href: null, copies: own, image: job.image }
  })
}

const COLUMNS: Column<Row>[] = [
  { id: 'name', title: 'name', width: 22, cell: row => row.job.name },
  { id: 'type', title: 'type', width: 8, cell: row => row.job.type },
  { id: 'environment', title: 'environment', width: 11, cell: row => row.job.env },
  { id: 'state', title: 'state', width: 12, cell: row => stateLabel(row.state), tone: row => stateColor(row.state) },
  { id: 'open', title: 'open', width: 8, cell: row => (row.href === null ? '—' : 'Open ↗'), href: row => row.href },
  { id: 'copies', title: 'running copies', width: 14, cell: row => String(row.copies.length) },
]

const columnsOf = (isWorkstations: boolean) =>
  COLUMNS.filter(column => !(isWorkstations ? ['type', 'open'] : ['copies']).includes(column.id))

const waiting = (ui: UiCtx, view: SectionView<Workstation[]>) =>
  view.error === null ? EmptyState(ui, { text: 'Loading…' }) : ErrorState(ui, { kind: view.error, installation: view.installation })

function List(ui: UiCtx, view: SectionView<Workstation[]>, act: SectionActions, summary: Summary): RenderElement {
  const { Box } = ui.els
  const { route } = view
  const tab = tabOf(route)
  const isWorkstations = tab.id === 'workstations'
  if (isWorkstations && view.data === null) return waiting(ui, view)
  const rows = isWorkstations ? workstationRows(summary, view.data ?? []) : jobRows(summary, tab.types, view.url)
  const page = pageRows(rows, route)
  const onRow = (row: Row) =>
    isWorkstations
      ? act.go({ item: { kind: 'job', id: idOf(row.job) } })
      : act.go({ section: 'compute', tab: COMPUTE_TABS[row.job.type], item: { kind: 'job', id: idOf(row.job) } })

  return (
    <Box flexDirection="column" gap={1}>
      {Table(ui, {
        key: 'launcher-table',
        columns: columnsOf(isWorkstations),
        rows: page.rows,
        rowKey: row => `${isWorkstations ? 'ws' : 'job'}-${row.job.env}-${row.job.name}`,
        onRow,
        page: pageOf(route),
        hasMore: page.hasMore,
        onPage: next => act.go({ page: next === 0 ? undefined : next }),
      })}
      {rows.length === 0 ? EmptyState(ui, { text: tab.empty }) : null}
    </Box>
  )
}

const ask = (act: SectionActions, action: JobAction) => act.ask(action, confirmOf(action).question, confirmOf(action).yesLabel)

const SCRIPT_CHARS = 20_000

// The definition a person edits in the web GUI's workstation form.
function Definition(ui: UiCtx, job: Job, image: JobImage): RenderElement {
  const { Box, Code, Text } = ui.els
  const sizes = [image.python === '' ? '' : `Python ${image.python}`, job.cpus === null ? '' : `${job.cpus} CPU`, memory(job.memory)]
  const blocks = [
    { title: 'Python requirements', source: image.requirements, language: 'text' },
    { title: 'Pre-build script', source: image.preBuild, language: 'bash' },
    { title: 'Post-build script', source: image.postBuild, language: 'bash' },
  ].filter(block => block.source.trim() !== '')

  return (
    <Box flexDirection="column" gap={1}>
      <Text>{sizes.filter(part => part !== '' && part !== '—').join(' · ')}</Text>
      {blocks.map(block => (
        <Box key={block.title} flexDirection="column">
          <Text weight="semibold">{block.title}</Text>
          <Code language={block.language} source={cut(stripAnsi(block.source), SCRIPT_CHARS)} />
        </Box>
      ))}
    </Box>
  )
}

const facts = (job: Job) =>
  [job.type, job.env, job.version > 0 ? `v${job.version}` : '', job.runAs, job.built ? 'last build ok' : 'last build failed']
    .filter(part => part !== '')
    .join(' · ')

function WorkstationPage(ui: UiCtx, view: SectionView<Workstation[]>, act: SectionActions): RenderElement {
  const { Box, Button, Link, Text } = ui.els
  const { summary, data, route } = view
  const rows = summary === null || data === null ? null : workstationRows(summary, data)
  const row = rows?.find(found => idOf(found.job) === route.item?.id)

  if (row === undefined) {
    return (
      <Box flexDirection="column" gap={1}>
        {BackButton(ui, { onBack: act.back })}
        {rows === null ? waiting(ui, view) : EmptyState(ui, { text: 'This workstation no longer exists.' })}
      </Box>
    )
  }
  const { job, copies } = row

  return (
    <Box flexDirection="column" gap={1}>
      {DetailHeader(ui, { title: job.name, subtitle: facts(job), state: row.state, onBack: act.back })}
      {/* A Link takes no key: the Box around it holds it. */}
      <Box flexWrap="wrap" gap={2}>
        {view.isConnected ? (
          <Button key="start" label="Start" onPress={() => ask(act, { verb: 'start', job: job.name, env: job.env })} />
        ) : null}
        {['IDE', 'Jupyter'].map(label => (
          <Box key={label.toLowerCase()}>
            <Link href={connectUrl(view.url, job, label.toLowerCase())} label={label} />
          </Box>
        ))}
      </Box>
      <Box flexDirection="column">
        <Text weight="semibold">Running copies</Text>
        {copies.length === 0 ? EmptyState(ui, { text: 'No running copies.' }) : null}
        {copies.map(({ user, run }) => (
          <Box key={`copy-${run.id}`} gap={1}>
            <Text>{user}</Text>
            <Text dimColor>{`started ${age(view.now, run.start ?? run.submit)} ago`}</Text>
            {view.isConnected ? (
              <Button key={`stop-${run.id}`} label="Stop" onPress={() => ask(act, { verb: 'stop', job: run.job, env: run.env })} />
            ) : null}
          </Box>
        ))}
      </Box>
      {row.image === null ? null : Definition(ui, job, row.image)}
    </Box>
  )
}

export const launcher: Section<Workstation[]> = {
  id: 'launcher',
  title: 'Launcher and workstations',
  refreshMs: 30_000,
  // One load for every route: the workstation templates. Apps, services, add-ins and runs come from the summary.
  loadKey: () => 'launcher',
  load: api => api.workstations.list(),
  needsSummary: true,

  render(ui, view, act) {
    const { Box } = ui.els
    if (view.route.item !== undefined) return WorkstationPage(ui, view, act)

    return (
      <Box flexDirection="column" gap={1}>
        {Tabs(ui, { key: 'launcher-tabs', tabs: [...TABS], current: tabOf(view.route).id, onSelect: id => setTab(act, id) })}
        {view.summary === null ? EmptyState(ui, { text: 'Loading…' }) : List(ui, view, act, view.summary)}
      </Box>
    )
  },
}
