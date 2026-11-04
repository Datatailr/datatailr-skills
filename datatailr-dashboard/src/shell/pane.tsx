/*************************************************************************
 *
 *  Copyright (c) 2026 Datatailr Inc.
 *
 *  Licensed under the MIT License. See the 'LICENSE' file distributed
 *  with this package for the full license text.
 *
 *  SPDX-License-Identifier: MIT
 *************************************************************************/

import type { EngineInterface, RenderElement, RenderInput } from 'claude-code'

import { isSharing } from '../assist/context'
import { logKey, sessionUrl } from '../core/logs'
import type { Route } from '../core/route'
import type { SessionState } from '../core/session'
import { installationsFolder, installationsFor } from '../core/session'
import {
  type LogState,
  readCliMissing,
  readConfirm,
  readExplain,
  readLoads,
  readLog,
  readRoute,
  readSession,
  readSwitcherOpen,
} from '../core/state'
import { clockNow } from '../core/timers'
import type { Section } from '../sections/contract'
import { ConfirmBar } from '../ui/confirm'
import type { UiCtx } from '../ui/ctx'
import { EmptyState, ErrorState } from '../ui/states'
import { type PaneActions, type Runtime, createActions, installationOf, sectionActions } from './actions'
import { Header } from './header'
import { SUMMARY_KEY, currentSection } from './loads'
import { RAIL_MIN_COLUMNS, Rail, railEntries, railWidth } from './rail'
import { DisconnectedScreen, ErrorScreen, ExpiredBar, InstallCli, LoggingInScreen } from './screens'
import { SwitcherButton, SwitcherList } from './switcher'
import { loadsFor, sectionLoadOf, summaryOf, viewOf } from './view'

// Reads through `src/core/state.ts` subscribe this drawing: a write to what it read draws it again.

const RAIL_GAP = 2

export async function renderPane($: EngineInterface, e: RenderInput<'Pane'>, runtime: Runtime): Promise<RenderElement> {
  const ui: UiCtx = { els: $.ui.resolve(e), surface: e.surface, columns: e.props.bodyColumns }
  const { Box } = ui.els
  const act = createActions($, runtime)
  const [session, isCliMissing] = await Promise.all([readSession($), readCliMissing($)])
  const isDashboard = session.kind === 'connected' || session.kind === 'expired'
  const switcher = await drawSwitcher($, ui, runtime, act, session, isCliMissing)

  if (!isDashboard) {
    return (
      <Box flexDirection="column" gap={1}>
        {Header(ui, { status: null, switcher: switcher.button })}
        {switcher.list}
        {screenFor(ui, act, session, installationsFolder(runtime.options))}
      </Box>
    )
  }

  const [route, stored, confirm, log, explained, now] = await Promise.all([
    readRoute($),
    readLoads($),
    readConfirm($),
    readLog($),
    readExplain($),
    clockNow($),
  ])
  const loads = loadsFor(stored, sessionUrl(session))
  const section = currentSection(runtime.sections, route)
  const summaryLoad = loads[SUMMARY_KEY]
  const sectionLoad = section === null ? undefined : sectionLoadOf(loads, section, route)
  const summary = summaryOf(loads)
  const entries = railEntries(runtime.sections, summary, loads)
  const isWide = entries.length > 0 && ui.columns >= RAIL_MIN_COLUMNS
  const contentUi: UiCtx = isWide ? { ...ui, columns: ui.columns - railWidth(entries) - RAIL_GAP } : ui

  const parts: RenderElement[] = []
  if (session.kind === 'expired') parts.push(ExpiredBar(ui, { isCliMissing, onLoginAgain: fire(act.loginAgain) }))
  if (confirm !== null && session.kind === 'connected' && confirm.url === session.url) {
    parts.push(
      ConfirmBar(contentUi, {
        question: confirm.question,
        yesLabel: confirm.yesLabel,
        result: confirm.result,
        onYes: fire(act.confirmYes),
        onNo: fire(act.confirmNo),
      }),
    )
  }

  // A section that draws its own load draws it, whatever the summary did.
  const isSummaryNeeded = section === null || section.needsSummary === true
  let content: RenderElement
  if (isSummaryNeeded && summary === null && summaryLoad?.error != null && summaryLoad.error !== 'logged-out') {
    content = ErrorState(contentUi, {
      kind: summaryLoad.error,
      installation: session.installation,
      onRetry: fire(act.refresh),
    })
  } else if (section === null) {
    content = EmptyState(contentUi, { text: 'No sections yet.' })
  } else {
    const data = sectionLoad?.data ?? null
    const view = viewOf({
      route,
      load: sectionLoad,
      summary,
      now,
      installation: session.installation,
      url: sessionUrl(session),
      log: logOf(section, route, data, log, sessionUrl(session)),
      explain: explained,
      shareContext: isSharing(runtime.options),
      isConnected: session.kind === 'connected',
    })
    try {
      content = section.render(contentUi, view, sectionActions(act))
    } catch {
      // A tree the engine cannot draw closes the pane: one section that fails must not take the frame with it.
      content = EmptyState(contentUi, { text: `${section.title} could not be drawn.` })
    }
  }

  let body: RenderElement
  if (section === null || entries.length === 0) {
    body = content
  } else {
    const rail = Rail(ui, { entries, current: section.id, onGo: id => settle(act.go({ section: id })) })
    body = isWide ? (
      <Box gap={RAIL_GAP}>
        <Box flexDirection="column" flexShrink={0}>
          {rail}
        </Box>
        <Box flexDirection="column" flexGrow={1}>
          {content}
        </Box>
      </Box>
    ) : (
      <Box flexDirection="column" gap={1}>
        {rail}
        {content}
      </Box>
    )
  }
  parts.push(body)

  const status = { now, summary: summaryLoad, section: sectionLoad, onRefresh: fire(act.refresh) }

  return (
    <Box flexDirection="column" gap={1}>
      {Header(ui, { status, switcher: switcher.button })}
      {switcher.list}
      {parts}
    </Box>
  )
}

function logOf(section: Section<unknown>, route: Route, data: unknown, log: LogState, url: string): LogState {
  if (log === null || data === null || section.logFor === undefined) return null
  try {
    const request = section.logFor(route, data)
    return request !== null && logKey(url, request) === log.key ? log : null
  } catch {
    return null
  }
}

function screenFor(ui: UiCtx, act: PaneActions, session: SessionState, folder: string): RenderElement {
  switch (session.kind) {
    case 'no-cli':
      return InstallCli(ui)
    case 'logging-in':
      return LoggingInScreen(ui, { session, onCancel: fire(act.cancelLogin) })
    case 'error':
      return ErrorScreen(ui, { message: session.message, onRetry: fire(act.retry) })
    default:
      return DisconnectedScreen(ui, { folder, onSubmit: url => settle(act.add(url)) })
  }
}

async function drawSwitcher(
  $: EngineInterface,
  ui: UiCtx,
  runtime: Runtime,
  act: PaneActions,
  session: SessionState,
  isCliMissing: boolean,
): Promise<{ button: RenderElement; list: RenderElement | null }> {
  const current = installationOf(session)
  const button = SwitcherButton(ui, { installation: current, onPress: fire(act.toggleSwitcher) })
  if (!(await readSwitcherOpen($))) return { button, list: null }

  const list = SwitcherList(ui, {
    installations: await installationsFor($, runtime.options),
    current,
    // The first start draws the URL input, and the expired bar Log in again: a key is drawn only once.
    canAdd: session.kind !== 'disconnected',
    isAdding: runtime.isAddingInstallation,
    canLoginAgain: session.kind !== 'expired',
    isCliMissing,
    onPick: name => settle(act.pick(name)),
    onShowAdd: () => act.showAddInstallation(),
    onAdd: url => settle(act.add(url)),
    onLoginAgain: fire(act.loginAgain),
  })
  return { button, list }
}

function settle(work: Promise<unknown>): void {
  work.catch(() => undefined)
}

function fire(work: () => Promise<unknown>): () => void {
  return () => settle(work())
}
