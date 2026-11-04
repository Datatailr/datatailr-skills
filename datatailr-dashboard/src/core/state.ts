/*************************************************************************
 *
 *  Copyright (c) 2026 Datatailr Inc.
 *
 *  Licensed under the MIT License. See the 'LICENSE' file distributed
 *  with this package for the full license text.
 *
 *  SPDX-License-Identifier: MIT
 *************************************************************************/

import type { PluginState } from 'claude-code'

import type { Engine, StateKey, StateKeyRef, StateValueOf } from './engine'

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

type Cell<K extends StateKey> = { readonly ref: StateKeyRef & { readonly key: K }; readonly initial: StateValueOf<K> }

const cell = <K extends StateKey>(key: K): Cell<K> => ({ ref: { plugin: 'datatailr-dashboard', key }, initial: INITIAL[key] })

// The hooks module names each key in its own `$.state` calls, so the engine can list them. These cells
// only carry the key and the initial value to the facade (the exports are for the tests).
export const routeAtom = cell('route')
export const sessionAtom = cell('session')
export const loadsAtom = cell('loads')
export const confirmAtom = cell('confirm')
export const explainAtom = cell('explain')
export const logAtom = cell('log')
export const switcherOpenAtom = cell('switcherOpen')
export const cliMissingAtom = cell('cliMissing')
export const lastContextAtom = cell('lastContext')

async function read<K extends StateKey>(engine: Engine, target: Cell<K>): Promise<StateValueOf<K>> {
  const got = await engine.state.get(target.ref)
  return got.value === undefined ? target.initial : (got.value as StateValueOf<K>)
}

// The engine refuses a write whose version is stale: then `change` runs again on the new value, so
// `change` must have no side effects.
async function update<K extends StateKey>(
  engine: Engine,
  target: Cell<K>,
  change: (value: StateValueOf<K>) => StateValueOf<K>,
): Promise<StateValueOf<K>> {
  for (;;) {
    const got = await engine.state.get(target.ref)
    const next = change(got.value === undefined ? target.initial : (got.value as StateValueOf<K>))
    const written = await engine.state.set(target.ref, next, { ifVersion: got.version })
    if (written.isSet) return next
  }
}

export function readRoute($: Engine): Promise<Route> {
  return read($, routeAtom)
}
export function writeRoute($: Engine, value: Route): Promise<Route> {
  return update($, routeAtom, () => value)
}
export function updateRoute($: Engine, change: (value: Route) => Route): Promise<Route> {
  return update($, routeAtom, change)
}

// A session write drops a question asked on another installation: a yes must never act there.
export function readSession($: Engine): Promise<SessionState> {
  return read($, sessionAtom)
}
export async function writeSession($: Engine, value: SessionState): Promise<SessionState> {
  const written = await update($, sessionAtom, () => value)
  await dropConfirmNotFor($, written)
  return written
}
export async function updateSession(
  $: Engine,
  change: (value: SessionState) => SessionState,
): Promise<SessionState> {
  const written = await update($, sessionAtom, change)
  await dropConfirmNotFor($, written)
  return written
}

function isAskedOn(confirm: NonNullable<ConfirmState>, session: SessionState): boolean {
  return session.kind === 'connected' && session.url === confirm.url
}

async function dropConfirmNotFor($: Engine, session: SessionState): Promise<void> {
  const confirm = await read($, confirmAtom)
  if (confirm === null || isAskedOn(confirm, session)) return
  await update($, confirmAtom, current => (current === null || isAskedOn(current, session) ? current : null))
}

export function readLoads($: Engine): Promise<Record<string, LoadState>> {
  return read($, loadsAtom)
}
export function writeLoads($: Engine, value: Record<string, LoadState>): Promise<Record<string, LoadState>> {
  return update($, loadsAtom, () => value)
}
export function updateLoads(
  $: Engine,
  change: (value: Record<string, LoadState>) => Record<string, LoadState>,
): Promise<Record<string, LoadState>> {
  return update($, loadsAtom, change)
}

export function readConfirm($: Engine): Promise<ConfirmState> {
  return read($, confirmAtom)
}
export function writeConfirm($: Engine, value: ConfirmState): Promise<ConfirmState> {
  return update($, confirmAtom, () => value)
}
export function updateConfirm($: Engine, change: (value: ConfirmState) => ConfirmState): Promise<ConfirmState> {
  return update($, confirmAtom, change)
}

export function readExplain($: Engine): Promise<Record<string, ExplainState>> {
  return read($, explainAtom)
}
export function writeExplain(
  $: Engine,
  value: Record<string, ExplainState>,
): Promise<Record<string, ExplainState>> {
  return update($, explainAtom, () => value)
}
export function updateExplain(
  $: Engine,
  change: (value: Record<string, ExplainState>) => Record<string, ExplainState>,
): Promise<Record<string, ExplainState>> {
  return update($, explainAtom, change)
}

export function readLog($: Engine): Promise<LogState> {
  return read($, logAtom)
}
export function writeLog($: Engine, value: LogState): Promise<LogState> {
  return update($, logAtom, () => value)
}
export function updateLog($: Engine, change: (value: LogState) => LogState): Promise<LogState> {
  return update($, logAtom, change)
}

export function readSwitcherOpen($: Engine): Promise<boolean> {
  return read($, switcherOpenAtom)
}
export function writeSwitcherOpen($: Engine, value: boolean): Promise<boolean> {
  return update($, switcherOpenAtom, () => value)
}
export function updateSwitcherOpen($: Engine, change: (value: boolean) => boolean): Promise<boolean> {
  return update($, switcherOpenAtom, change)
}

// True after a login found no CLI, until a login finds one: the pane then says how to install it.
export function readCliMissing($: Engine): Promise<boolean> {
  return read($, cliMissingAtom)
}
export function writeCliMissing($: Engine, value: boolean): Promise<boolean> {
  return update($, cliMissingAtom, () => value)
}
export function updateCliMissing($: Engine, change: (value: boolean) => boolean): Promise<boolean> {
  return update($, cliMissingAtom, change)
}

export function readLastContext($: Engine): Promise<string | null> {
  return read($, lastContextAtom)
}
export function writeLastContext($: Engine, value: string | null): Promise<string | null> {
  return update($, lastContextAtom, () => value)
}
export function updateLastContext(
  $: Engine,
  change: (value: string | null) => string | null,
): Promise<string | null> {
  return update($, lastContextAtom, change)
}

const ROUTE_KEY = 'route'
const PANE_WAS_OPEN_KEY = 'paneWasOpen'

// A run id or a job of one installation means nothing on another, so an item route keeps its `url`.
export async function saveRoute($: Engine, route: Route, url: string): Promise<void> {
  await $.store.set(ROUTE_KEY, route.item === undefined ? route : { ...route, url })
}

export async function loadRoute($: Engine, url: string | null): Promise<Route | null> {
  const stored: unknown = await $.store.get(ROUTE_KEY)
  const route = parseRoute(stored)
  if (route === null || route.item === undefined) return route
  const keptOn = (stored as { url?: unknown }).url
  return url !== null && keptOn === url ? route : back(route)
}

export async function savePaneWasOpen($: Engine, open: boolean): Promise<void> {
  await $.store.set(PANE_WAS_OPEN_KEY, open)
}

export async function loadPaneWasOpen($: Engine): Promise<boolean> {
  return (await $.store.get(PANE_WAS_OPEN_KEY)) === true
}
