/*************************************************************************
 *
 *  Copyright (c) 2026 Datatailr Inc.
 *
 *  Licensed under the MIT License. See the 'LICENSE' file distributed
 *  with this package for the full license text.
 *
 *  SPDX-License-Identifier: MIT
 *************************************************************************/

import { atom, read, update } from 'claude-code'
import type { EngineInterface, PluginState, StateDollar } from 'claude-code'

import type { ErrorKind } from './api'
import type { ActionRequest } from './model'
import { type Route, back, parseRoute } from './route'
import type { SessionState } from './session'

// `$.state` holds data only: no secret (a password, a token) goes in any of these values.

export type { ItemRef, Route, SectionId } from './route'
export type { SessionState } from './session'

export type LoadState = {
  data: unknown
  fetchedAt: number | null
  error: ErrorKind | null
  failures: number
  nextAt: number
  inFlight: boolean
  errorTag?: string
  // The installation the data and the error belong to.
  url?: string
}

export type ConfirmState = {
  action: ActionRequest
  question: string
  yesLabel: string
  url: string
  result?: { ok: boolean; text: string; at: number }
} | null

export type ExplainState = { status: 'loading' } | { status: 'done'; text: string } | { status: 'failed' }

export type LogState = {
  key: string
  job: string
  env: string
  runId?: number
  build?: boolean
  stream: 'stdout' | 'stderr'
  lines: number
  follow: boolean
  text: string
  isLoading: boolean
  error?: string
} | null

// The validator accepts no import in `types/index.d.ts`, so it spells these types out again; this
// check stops compiling when the two differ.
type Declared = PluginState['datatailr-dashboard']
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false
type MustBeTrue<T extends true> = T
export type ContractMatchesTypes = [
  MustBeTrue<Same<Declared['route'], Route>>,
  MustBeTrue<Same<Declared['session'], SessionState>>,
  MustBeTrue<Same<Declared['loads'], Record<string, LoadState>>>,
  MustBeTrue<Same<Declared['confirm'], ConfirmState>>,
  MustBeTrue<Same<Declared['explain'], Record<string, ExplainState>>>,
  MustBeTrue<Same<Declared['log'], LogState>>,
  MustBeTrue<Same<Declared['switcherOpen'], boolean>>,
  MustBeTrue<Same<Declared['cliMissing'], boolean>>,
  MustBeTrue<Same<Declared['lastContext'], string | null>>,
  MustBeTrue<
    Same<
      keyof Declared,
      'route' | 'session' | 'loads' | 'confirm' | 'explain' | 'log' | 'switcherOpen' | 'cliMissing' | 'lastContext'
    >
  >,
]

const INITIAL = {
  route: { section: 'overview' },
  session: { kind: 'disconnected' },
  loads: {},
  confirm: null,
  explain: {},
  log: null,
  switcherOpen: false,
  cliMissing: false,
  lastContext: null,
} as const satisfies PluginState['datatailr-dashboard']

// `claude plugin validate` follows an atom only inside the file that makes it, so other modules use
// the accessors below and never import an atom (the exports are for the tests).
export const routeAtom = atom({ plugin: 'datatailr-dashboard', key: 'route' } as const, INITIAL.route)
export const sessionAtom = atom({ plugin: 'datatailr-dashboard', key: 'session' } as const, INITIAL.session)
export const loadsAtom = atom({ plugin: 'datatailr-dashboard', key: 'loads' } as const, INITIAL.loads)
export const confirmAtom = atom({ plugin: 'datatailr-dashboard', key: 'confirm' } as const, INITIAL.confirm)
export const explainAtom = atom({ plugin: 'datatailr-dashboard', key: 'explain' } as const, INITIAL.explain)
export const logAtom = atom({ plugin: 'datatailr-dashboard', key: 'log' } as const, INITIAL.log)
export const switcherOpenAtom = atom(
  { plugin: 'datatailr-dashboard', key: 'switcherOpen' } as const,
  INITIAL.switcherOpen,
)
export const cliMissingAtom = atom({ plugin: 'datatailr-dashboard', key: 'cliMissing' } as const, INITIAL.cliMissing)
export const lastContextAtom = atom({ plugin: 'datatailr-dashboard', key: 'lastContext' } as const, INITIAL.lastContext)

// Function declarations on purpose: past an import, the validator follows `$` only into those, not into
// arrow functions. `update` runs `change` again on a version miss, so `change` must have no side effects.

export function readRoute($: StateDollar): Promise<Route> {
  return read($, routeAtom)
}
export function writeRoute($: StateDollar, value: Route): Promise<Route> {
  return update($, routeAtom, () => value)
}
export function updateRoute($: StateDollar, change: (value: Route) => Route): Promise<Route> {
  return update($, routeAtom, change)
}

// A session write drops a question asked on another installation: a yes must never act there.
export function readSession($: StateDollar): Promise<SessionState> {
  return read($, sessionAtom)
}
export async function writeSession($: StateDollar, value: SessionState): Promise<SessionState> {
  const written = await update($, sessionAtom, () => value)
  await dropConfirmNotFor($, written)
  return written
}
export async function updateSession(
  $: StateDollar,
  change: (value: SessionState) => SessionState,
): Promise<SessionState> {
  const written = await update($, sessionAtom, change)
  await dropConfirmNotFor($, written)
  return written
}

function isAskedOn(confirm: NonNullable<ConfirmState>, session: SessionState): boolean {
  return session.kind === 'connected' && session.url === confirm.url
}

async function dropConfirmNotFor($: StateDollar, session: SessionState): Promise<void> {
  const confirm = await read($, confirmAtom)
  if (confirm === null || isAskedOn(confirm, session)) return
  await update($, confirmAtom, current => (current === null || isAskedOn(current, session) ? current : null))
}

export function readLoads($: StateDollar): Promise<Record<string, LoadState>> {
  return read($, loadsAtom)
}
export function writeLoads($: StateDollar, value: Record<string, LoadState>): Promise<Record<string, LoadState>> {
  return update($, loadsAtom, () => value)
}
export function updateLoads(
  $: StateDollar,
  change: (value: Record<string, LoadState>) => Record<string, LoadState>,
): Promise<Record<string, LoadState>> {
  return update($, loadsAtom, change)
}

export function readConfirm($: StateDollar): Promise<ConfirmState> {
  return read($, confirmAtom)
}
export function writeConfirm($: StateDollar, value: ConfirmState): Promise<ConfirmState> {
  return update($, confirmAtom, () => value)
}
export function updateConfirm($: StateDollar, change: (value: ConfirmState) => ConfirmState): Promise<ConfirmState> {
  return update($, confirmAtom, change)
}

export function readExplain($: StateDollar): Promise<Record<string, ExplainState>> {
  return read($, explainAtom)
}
export function writeExplain(
  $: StateDollar,
  value: Record<string, ExplainState>,
): Promise<Record<string, ExplainState>> {
  return update($, explainAtom, () => value)
}
export function updateExplain(
  $: StateDollar,
  change: (value: Record<string, ExplainState>) => Record<string, ExplainState>,
): Promise<Record<string, ExplainState>> {
  return update($, explainAtom, change)
}

export function readLog($: StateDollar): Promise<LogState> {
  return read($, logAtom)
}
export function writeLog($: StateDollar, value: LogState): Promise<LogState> {
  return update($, logAtom, () => value)
}
export function updateLog($: StateDollar, change: (value: LogState) => LogState): Promise<LogState> {
  return update($, logAtom, change)
}

export function readSwitcherOpen($: StateDollar): Promise<boolean> {
  return read($, switcherOpenAtom)
}
export function writeSwitcherOpen($: StateDollar, value: boolean): Promise<boolean> {
  return update($, switcherOpenAtom, () => value)
}
export function updateSwitcherOpen($: StateDollar, change: (value: boolean) => boolean): Promise<boolean> {
  return update($, switcherOpenAtom, change)
}

// True after a login found no CLI, until a login finds one: the pane then says how to install it.
export function readCliMissing($: StateDollar): Promise<boolean> {
  return read($, cliMissingAtom)
}
export function writeCliMissing($: StateDollar, value: boolean): Promise<boolean> {
  return update($, cliMissingAtom, () => value)
}
export function updateCliMissing($: StateDollar, change: (value: boolean) => boolean): Promise<boolean> {
  return update($, cliMissingAtom, change)
}

export function readLastContext($: StateDollar): Promise<string | null> {
  return read($, lastContextAtom)
}
export function writeLastContext($: StateDollar, value: string | null): Promise<string | null> {
  return update($, lastContextAtom, () => value)
}
export function updateLastContext(
  $: StateDollar,
  change: (value: string | null) => string | null,
): Promise<string | null> {
  return update($, lastContextAtom, change)
}

const ROUTE_KEY = 'route'
const PANE_WAS_OPEN_KEY = 'paneWasOpen'

// A run id or a job of one installation means nothing on another, so an item route keeps its `url`.
export async function saveRoute($: EngineInterface, route: Route, url: string): Promise<void> {
  await $.store.set(ROUTE_KEY, route.item === undefined ? route : { ...route, url })
}

export async function loadRoute($: EngineInterface, url: string | null): Promise<Route | null> {
  const stored: unknown = await $.store.get(ROUTE_KEY)
  const route = parseRoute(stored)
  if (route === null || route.item === undefined) return route
  const keptOn = (stored as { url?: unknown }).url
  return url !== null && keptOn === url ? route : back(route)
}

export async function savePaneWasOpen($: EngineInterface, open: boolean): Promise<void> {
  await $.store.set(PANE_WAS_OPEN_KEY, open)
}

export async function loadPaneWasOpen($: EngineInterface): Promise<boolean> {
  return (await $.store.get(PANE_WAS_OPEN_KEY)) === true
}
