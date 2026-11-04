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

import { continueDraft } from '../../assist/prompts'
import { LIST_LIMIT } from '../../core/endpoints'
import type { Job, Run, TaskState } from '../../core/model'
import type { Route } from '../../core/route'
import { AssistBox, ContextLine } from '../../ui/assist'
import type { UiCtx } from '../../ui/ctx'
import { BackButton, DetailHeader } from '../../ui/detail'
import { LogView } from '../../ui/log'
import { EmptyState, ErrorState } from '../../ui/states'
import { stateColor, stateLabel } from '../../ui/status'
import { type Column, PAGE_SIZE, Table } from '../../ui/table'
import { age, cut, duration, stripAnsi } from '../../ui/text'
import type { SectionActions, SectionView } from '../contract'
import { ACTION_LABELS, actionsFor, canFollow, confirmOf, openUrl, webGuiUrl } from './detail-actions'
import { assistOf } from './detail-assist'
import { type ComputeDetail, RECENT_DAYS } from './detail-load'
import { CAPPED_NOTE } from './lists'

export type DetailData = { tab: 'detail'; detail: ComputeDetail | null }

const ERROR_CHARS = 2_000

export function DetailPage(ui: UiCtx, view: SectionView<DetailData>, act: SectionActions): RenderElement {
  const { Box, Text } = ui.els
  const { data } = view

  if (data !== null && data.detail !== null) return Detail(ui, view, data.detail, act)

  let body: RenderElement
  if (data !== null) body = EmptyState(ui, { text: goneText(view.route) })
  // The shell's bar tells of an ended session, once.
  else if (view.error === null || view.error === 'logged-out') body = <Text dimColor>Loading…</Text>
  else body = ErrorState(ui, { kind: view.error, installation: view.installation })

  return (
    <Box flexDirection="column" gap={1}>
      {BackButton(ui, { onBack: act.back })}
      {body}
    </Box>
  )
}

function goneText(route: Route): string {
  switch (route.item?.kind) {
    case 'run':
      return 'This run no longer exists.'
    case 'job':
      return 'This job no longer exists.'
    default:
      return 'This item cannot be shown here.'
  }
}

function Detail(ui: UiCtx, view: SectionView<DetailData>, detail: ComputeDetail, act: SectionActions): RenderElement {
  const { Box, Button, Link, Text } = ui.els
  const { log, now } = view
  const error = detail.kind === 'run' ? cut(stripAnsi(detail.run.error).trim(), ERROR_CHARS + 1) : ''
  const open = openUrl(view.url, detail)
  const assist = assistOf(detail, view.installation, view.url, log)
  const explained = view.explain[assist.key]
  const continued = () =>
    explained?.status === 'done' ? continueDraft(assist.draft(), explained.text) : assist.draft()

  const buttons = (view.isConnected ? actionsFor(detail) : []).map(action => {
    const { question, yesLabel } = confirmOf(action)
    return <Button key={action.verb} label={ACTION_LABELS[action.verb]} onPress={() => act.ask(action, question, yesLabel)} />
  })

  return (
    <Box flexDirection="column" gap={1}>
      {DetailHeader(ui, { ...headerOf(detail, now), onBack: act.back })}
      {error === '' ? null : <Text color="error">{error}</Text>}
      {buttons.length === 0 ? null : (
        <Box flexWrap="wrap" gap={1}>
          {buttons}
        </Box>
      )}
      {/* A Link takes no key: the Box around it holds it. */}
      <Box flexWrap="wrap" gap={2}>
        <Box key="web-gui">
          <Link href={webGuiUrl(view.url, detail)} label="Open in web GUI" />
        </Box>
        {open === null ? null : (
          <Box key="open-job">
            <Link href={open.href} label={open.label} />
          </Box>
        )}
        {/* Explain sends the end of the log, so it waits until the log has loaded or failed. */}
        {assist.canExplain && log !== null && !log.isLoading ? (
          <Button key="explain" plain label="Explain" onPress={() => act.assist.explain(assist.key, assist.input())} />
        ) : null}
        <Button key="ask-claude" plain label="Ask Claude" onPress={() => act.assist.draft(assist.draft())} />
      </Box>
      {explained === undefined
        ? null
        : AssistBox(ui, { state: explained, onContinue: () => act.assist.draft(continued()) })}
      {detail.kind === 'run' ? Tasks(ui, detail.tasks, now) : RecentRuns(ui, detail.recent, now, act)}
      {LogView(ui, {
        text: log?.text ?? '',
        isLoading: log === null || log.isLoading,
        ...(log?.error === undefined ? {} : { error: log.error }),
        stream: log?.stream ?? 'stdout',
        follow: log?.follow ?? false,
        // A followed log keeps its toggle after its item stops, so that it can be turned off.
        canFollow: canFollow(detail) || (log?.follow ?? false),
        canMore: log?.build !== true,
        onStream: act.log.stream,
        onMore: act.log.more,
        onFollow: act.log.follow,
      })}
      {view.shareContext ? ContextLine(ui, { text: assist.what }) : null}
    </Box>
  )
}

const facts = (parts: string[]) => parts.filter(part => part !== '').join(' · ')

const versionOf = (version: number) => (version > 0 ? `v${version}` : '')

function headerOf(detail: ComputeDetail, now: number): { title: string; subtitle: string; state: string } {
  if (detail.kind === 'run') {
    const { run } = detail
    return {
      title: run.job,
      state: run.state,
      subtitle: facts([
        run.type,
        run.env,
        versionOf(run.version),
        `run #${run.id}`,
        `${age(now, run.submit)} ago`,
        duration(run.start, run.end, now),
        run.runAs,
      ]),
    }
  }
  const { job } = detail
  return { title: job.name, state: job.state, subtitle: jobFacts(job) }
}

function jobFacts(job: Job): string {
  return facts([job.type, job.env, versionOf(job.version), job.runAs, job.built ? 'last build ok' : 'last build failed'])
}

type TaskRow = TaskState & { index: number }

const taskColumns = (now: number): Column<TaskRow>[] => [
  { id: 'name', title: 'task', width: 22, cell: task => task.job },
  { id: 'state', title: 'state', width: 15, cell: task => stateLabel(task.state), tone: task => stateColor(task.state) },
  { id: 'duration', title: 'duration', width: 8, cell: task => duration(task.start, task.end, now) },
]

const noPages = { page: 0, hasMore: false, onPage: () => undefined }

function Tasks(ui: UiCtx, tasks: TaskState[] | null, now: number): RenderElement | null {
  const { Box, Text } = ui.els
  if (tasks === null) return null

  return (
    <Box flexDirection="column">
      <Text weight="semibold">Tasks</Text>
      {Table(ui, {
        key: 'compute-tasks',
        columns: taskColumns(now),
        rows: tasks.map((task, index) => ({ ...task, index })),
        rowKey: task => `task-${task.index}`,
        onRow: () => undefined,
        ...noPages,
      })}
      {tasks.length > PAGE_SIZE ? <Text dimColor>{`The first ${PAGE_SIZE} of ${tasks.length} tasks.`}</Text> : null}
      {tasks.length >= LIST_LIMIT ? <Text dimColor>{CAPPED_NOTE}</Text> : null}
    </Box>
  )
}

const runColumns = (now: number): Column<Run>[] => [
  { id: 'state', title: 'state', width: 15, cell: run => stateLabel(run.state), tone: run => stateColor(run.state) },
  { id: 'run', title: 'run', width: 8, cell: run => `#${run.id}` },
  { id: 'age', title: 'age', width: 4, cell: run => age(now, run.submit) },
  { id: 'duration', title: 'duration', width: 8, cell: run => duration(run.start, run.end, now) },
  { id: 'run-as', title: 'run-as', width: 10, cell: run => run.runAs },
]

function RecentRuns(ui: UiCtx, runs: Run[], now: number, act: SectionActions): RenderElement {
  const { Box, Text } = ui.els

  return (
    <Box flexDirection="column">
      <Text weight="semibold">{`Runs of the last ${RECENT_DAYS} days`}</Text>
      {runs.length === 0
        ? EmptyState(ui, { text: `No runs in the last ${RECENT_DAYS} days.` })
        : Table(ui, {
            key: 'compute-runs',
            columns: runColumns(now),
            rows: runs,
            rowKey: run => `run-${run.id}`,
            onRow: run => act.go({ item: { kind: 'run', id: String(run.id) } }),
            ...noPages,
          })}
    </Box>
  )
}
