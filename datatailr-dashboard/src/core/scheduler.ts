/*************************************************************************
 *
 *  Copyright (c) 2026 Datatailr Inc.
 *
 *  Licensed under the MIT License. See the 'LICENSE' file distributed
 *  with this package for the full license text.
 *
 *  SPDX-License-Identifier: MIT
 *************************************************************************/

import type { Engine } from './engine'

import { ApiError, type ErrorKind } from './api'
import { cliConfigModifiedAt } from './installations'
import { isPaneShown } from './panes'
import { markExpired } from './session'
import { type LoadState, readLoads, readSession, updateLoads } from './state'

export type { LoadState } from './state'

export type LoadKey = 'summary' | `section:${string}`

export type LoadSpec = { key: LoadKey; everyMs: number; run: () => Promise<unknown>; tag?: string }

export type SchedulerHooks = {
  sync?: () => Promise<unknown>
  syncEveryMs?: number
  onPaneShown?: (shown: boolean) => void
}

export type Scheduler = {
  cancel(): void
  runNow(key: LoadKey): Promise<void>
}

const TICK_MS = 1_000
const DEFAULT_SYNC_MS = 30_000
const MAX_BACKOFF_MS = 120_000

export function dueKeys(now: number, specs: LoadSpec[], states: Record<string, LoadState>): LoadKey[] {
  return specs.filter(spec => isDue(now, states[spec.key])).map(spec => spec.key)
}

export function backoffMs(everyMs: number, failures: number): number {
  return Math.min(everyMs * 2 ** failures, MAX_BACKOFF_MS)
}

export function startScheduler($: Engine, specs: () => LoadSpec[], hooks: SchedulerHooks = {}): Scheduler {
  const syncEveryMs = hooks.syncEveryMs ?? DEFAULT_SYNC_MS
  let isCancelled = false
  let isTicking = false
  let lastShown: boolean | null = null
  let lastSyncAt: number | null = null
  let lastSession: string | null = null
  const rerun = new Set<LoadKey>()

  // A hot reload drops the old plugin's callbacks, so a load in flight then never ends: clear its flag.
  const ready = releaseStale($).catch(() => undefined)

  async function tick(): Promise<void> {
    if (isCancelled || isTicking) return
    isTicking = true
    try {
      await ready
      await step()
    } catch {
    } finally {
      isTicking = false
    }
  }

  async function step(): Promise<void> {
    const now = await $.clock.now()
    const shown = await isPaneShown($)
    if (shown !== lastShown) {
      lastShown = shown
      announce(shown)
    }
    if (!shown) return

    if (hooks.sync !== undefined && (lastSyncAt === null || now - lastSyncAt >= syncEveryMs)) {
      lastSyncAt = now
      try {
        await hooks.sync()
      } catch {
      }
    }

    const session = await readSession($)
    const seen = session.kind === 'connected' ? `connected ${session.url}` : session.kind
    const isReconnect = session.kind === 'connected' && lastSession !== null && lastSession !== seen
    lastSession = seen
    if (session.kind !== 'connected' || isCancelled) return

    await startDue(now, isReconnect, session.url)
  }

  function announce(shown: boolean): void {
    try {
      const result: unknown = hooks.onPaneShown?.(shown)
      if (result instanceof Promise) result.catch(() => undefined)
    } catch {
    }
  }

  async function startDue(now: number, isReconnect: boolean, url: string): Promise<void> {
    const list = specs()
    // A tick with nothing to do writes nothing: each write redraws the pane.
    if (!isReconnect && dueKeys(now, list, await readLoads($)).length === 0) return
    let claimed: LoadSpec[] = []
    await updateLoads($, loads => {
      const base = isReconnect ? allDueAt(loads, now) : loads
      const keys = new Set(dueKeys(now, list, base))
      claimed = list.filter(spec => keys.has(spec.key))
      return claim(base, claimed, now)
    })
    for (const spec of claimed) void finish(spec, now, url)
  }

  async function finish(spec: LoadSpec, claimedAt: number, url: string): Promise<void> {
    try {
      await settleLoad(spec, claimedAt, url)
    } finally {
      if (rerun.delete(spec.key) && !isCancelled) void runNow(spec.key)
    }
  }

  async function settleLoad(spec: LoadSpec, claimedAt: number, url: string): Promise<void> {
    const outcome = await attempt(spec)
    let at = claimedAt
    try {
      at = await $.clock.now()
    } catch {
    }
    if (!(await isStill(url)) || (await isFromBeforeLogin(outcome, claimedAt))) {
      // The installation changed while the load ran, or a login did: its answer is dropped, and the load
      // runs again at once.
      try {
        await updateLoads($, loads => ({ ...loads, [spec.key]: { ...(loads[spec.key] ?? emptyLoad(at)), inFlight: false, nextAt: at } }))
      } catch {
      }
      return
    }
    try {
      await updateLoads($, loads => ({ ...loads, [spec.key]: settle(loads[spec.key], spec, outcome, at, url) }))
    } catch {
      // The host refused a value it cannot keep. A stuck in-flight flag would freeze the load until a restart.
      await recordServerError(spec, at, url)
      return
    }
    if (!outcome.ok && outcome.kind === 'logged-out') {
      try {
        await markExpired($)
      } catch {
      }
    }
  }

  async function isStill(url: string): Promise<boolean> {
    try {
      const session = await readSession($)
      return session.kind === 'connected' && session.url === url
    } catch {
      return false
    }
  }

  // A `logged-out` answer to a request from before a new login says nothing about the new session. Each
  // login writes the CLI configuration file: one newer than the claim of the load is such a login.
  async function isFromBeforeLogin(outcome: Outcome, claimedAt: number): Promise<boolean> {
    if (outcome.ok || outcome.kind !== 'logged-out') return false
    const writtenAt = await cliConfigModifiedAt($)
    return writtenAt !== null && writtenAt > claimedAt
  }

  async function recordServerError(spec: LoadSpec, at: number, url: string): Promise<void> {
    try {
      await updateLoads($, loads => ({
        ...loads,
        [spec.key]: settle(loads[spec.key], spec, { ok: false, kind: 'server' }, at, url),
      }))
    } catch {
    }
  }

  async function runNow(key: LoadKey): Promise<void> {
    try {
      await ready
      const session = await readSession($)
      if (session.kind !== 'connected') return
      const spec = specs().find(candidate => candidate.key === key)
      if (spec === undefined) return
      if ((await readLoads($))[key]?.inFlight) {
        rerun.add(key)
        return
      }
      const now = await $.clock.now()
      let isClaimed = false
      await updateLoads($, loads => {
        isClaimed = loads[key]?.inFlight !== true
        return isClaimed ? claim(loads, [spec], now) : loads
      })
      if (isClaimed) await finish(spec, now, session.url)
      else rerun.add(key)
    } catch {
    }
  }

  const timer = $.clock.every(TICK_MS, tick)
  void tick()

  return {
    cancel(): void {
      isCancelled = true
      timer.cancel()
    },
    runNow,
  }
}

type Outcome = { ok: true; data: unknown } | { ok: false; kind: ErrorKind }

function isDue(now: number, load: LoadState | undefined): boolean {
  return load === undefined || (!load.inFlight && load.nextAt <= now)
}

function emptyLoad(now: number): LoadState {
  return { data: null, fetchedAt: null, error: null, failures: 0, nextAt: now, inFlight: false }
}

function claim(loads: Record<string, LoadState>, specs: LoadSpec[], now: number): Record<string, LoadState> {
  const next = { ...loads }
  for (const spec of specs) next[spec.key] = { ...(loads[spec.key] ?? emptyLoad(now)), inFlight: true }
  return next
}

function allDueAt(loads: Record<string, LoadState>, now: number): Record<string, LoadState> {
  return Object.fromEntries(Object.entries(loads).map(([key, load]) => [key, { ...load, nextAt: now }]))
}

async function attempt(spec: LoadSpec): Promise<Outcome> {
  try {
    return { ok: true, data: await spec.run() }
  } catch (error) {
    return { ok: false, kind: error instanceof ApiError ? error.kind : 'server' }
  }
}

function settle(load: LoadState | undefined, spec: LoadSpec, outcome: Outcome, at: number, url: string): LoadState {
  if (outcome.ok) {
    // `$.state` keeps JSON, which has no undefined.
    const data = outcome.data === undefined ? null : outcome.data
    return { data, fetchedAt: at, error: null, failures: 0, nextAt: at + spec.everyMs, inFlight: false, url }
  }
  // A failure keeps the data of the same installation only.
  const prior = load?.url === url ? load : undefined
  const failures = (prior?.failures ?? 0) + 1
  const { errorTag: _earlier, ...kept } = prior ?? emptyLoad(at)
  return {
    ...kept,
    url,
    error: outcome.kind,
    failures,
    nextAt: at + backoffMs(spec.everyMs, failures),
    inFlight: false,
    ...(spec.tag === undefined ? {} : { errorTag: spec.tag }),
  }
}

async function releaseStale($: Engine): Promise<void> {
  if (!Object.values(await readLoads($)).some(load => load.inFlight)) return
  await updateLoads($, loads =>
    Object.fromEntries(Object.entries(loads).map(([key, load]) => [key, { ...load, inFlight: false }])),
  )
}
