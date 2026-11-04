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

import type { ErrorKind } from '../core/api'
import type { Endpoints } from '../core/endpoints'
import type { LogRequest } from '../core/logs'
import type { ActionRequest, Summary } from '../core/model'
import type { Route, SectionId } from '../core/route'
import type { ExplainState, LogState } from '../core/state'
import type { UiCtx } from '../ui/ctx'

export type { LogRequest } from '../core/logs'

// A section loads only through the endpoints it is given and draws without side effects: HTTP,
// state and timers belong to the shell, which it reaches through `SectionActions`.

// `data`, `fetchedAt` and `error` are the last load for the route on screen (`loadKey`), null before one.
// An expired session has `isConnected` false: its old data stays on screen, and it acts on nothing.
export type SectionView<Data> = {
  data: Data | null
  fetchedAt: number | null
  error: ErrorKind | null
  route: Route
  now: number
  summary: Summary | null
  installation: string
  log: LogState
  url: string
  explain: Readonly<Record<string, ExplainState>>
  shareContext: boolean
  isConnected: boolean
}

export type SectionActions = {
  go(next: Partial<Route>): void
  back(): void
  /** Shows `question` with `yesLabel` and Cancel; `action` runs on the Yes. */
  ask(action: ActionRequest, question: string, yesLabel: string): void
  refresh(): void
  log: LogActions
  assist: AssistActions
}

export type LogActions = {
  stream(stream: 'stdout' | 'stderr'): void
  more(): void
  follow(on: boolean): void
}

export type AssistActions = {
  /** Asks the model once per `key` (`explainKey`); the answer appears in `SectionView.explain`. */
  explain(key: string, input: ExplainInput): void
  /** Adds `text` to the message box after what the person typed. Nothing is sent. */
  draft(text: string): void
}

// `logTail` is the text of the log, never the error of a failed read. Only its last 60 lines reach the
// model, and common secret patterns are scrubbed from all three fields first.
export type ExplainInput = { facts: string; error: string; logTail: string }

// Keys: one key addresses one element, so a tree never draws a key twice. The shell draws `refresh`,
// `switcher`, `inst-<name>`, `add-installation`, `login-again`, `url`, `cancel-login`, `yes`, `no`,
// `retry` (so a section gives `ErrorState` no `onRetry`), `nav-<id>` and `section-menu`. The kit draws
// `tab-<id>`, `chip-<id>`, `search`, `sort-<id>`, `prev`, `next`, `back`, `stdout`, `stderr`, `more`,
// `follow` and `continue-chat`. A detail page keys its actions by verb (`start`, `stop`, `rerun`) and
// its other controls `web-gui`, `explain` and `ask-claude`. Any other key of a section has a prefix
// that names it, such as `kpi-`, `run-` or `job-`.
export interface Section<Data> {
  id: SectionId
  title: string
  refreshMs: number
  /** Routes with one key share a load (default: the whole route). Leave out filters applied to loaded rows. */
  loadKey?(route: Route): string
  load(api: Endpoints, route: Route, now: number): Promise<Data>
  /** The log of the page. After each load the shell opens it (stdout, the last 200 lines). */
  logFor?(route: Route, data: Data): LogRequest | null
  render(ui: UiCtx, view: SectionView<Data>, act: SectionActions): RenderElement
  attention?(summary: Summary): number
  /** The drawing needs the summary: while its first load failed, the shell shows that error in place of the section. */
  needsSummary?: boolean
  // Text for Claude, added to the person's next message while `shareContext` is on. It holds no log
  // line, and quotes at most the first line of an error, labeled as job output.
  describe?(view: SectionView<Data>): string | null
}
