/*************************************************************************
 *
 *  Copyright (c) 2026 Datatailr Inc.
 *
 *  Licensed under the MIT License. See the 'LICENSE' file distributed
 *  with this package for the full license text.
 *
 *  SPDX-License-Identifier: MIT
 *************************************************************************/

import type { PluginOptions } from 'claude-code'

import type { Engine } from '../core/engine'

import { explain } from '../assist/explain'
import { fillDraft } from '../assist/prompts'
import type { Endpoints } from '../core/endpoints'
import { type LogReader, sessionUrl } from '../core/logs'
import type { ActionRequest } from '../core/model'
import { type Route, back, go } from '../core/route'
import type { Scheduler } from '../core/scheduler'
import {
  type SessionState,
  addInstallation,
  cancelLogin,
  hasCli,
  installationsFor,
  switchTo,
  syncSession,
} from '../core/session'
import {
  readConfirm,
  readSession,
  saveRoute,
  updateConfirm,
  updateRoute,
  updateSwitcherOpen,
  writeConfirm,
  writeSession,
  writeSwitcherOpen,
} from '../core/state'
import { after, clockNow } from '../core/timers'
import type { Section, SectionActions } from '../sections/contract'
import { SUMMARY_KEY, currentSection, needsLoad, sectionKey } from './loads'

export type Runtime = {
  options: PluginOptions
  sections: readonly Section<any>[]
  endpoints: Endpoints | null
  scheduler: Scheduler | null
  logs: LogReader | null
  route: Route
  routeUrl: string
  isAddingInstallation: boolean
  isActing: boolean
}

export interface PaneActions extends SectionActions {
  go(next: Partial<Route>): Promise<void>
  back(): Promise<void>
  ask(action: ActionRequest, question: string, yesLabel: string): Promise<void>
  refresh(): Promise<void>
  log: { stream(stream: 'stdout' | 'stderr'): Promise<void>; more(): Promise<void>; follow(on: boolean): Promise<void> }
  confirmYes(): Promise<void>
  confirmNo(): Promise<void>
  toggleSwitcher(): Promise<void>
  showAddInstallation(): void
  pick(name: string): Promise<void>
  add(url: string): Promise<void>
  loginAgain(): Promise<void>
  cancelLogin(): Promise<void>
  retry(): Promise<void>
}

const RESULT_MS = 5_000

const DONE: Record<ActionRequest['verb'], string> = {
  start: 'Started',
  stop: 'Stopped',
  rerun: 'Rerun requested for',
  drain: 'Draining',
  undrain: 'Stopped draining',
}

export async function refreshLoads(runtime: Runtime): Promise<void> {
  const scheduler = runtime.scheduler
  if (scheduler === null) return
  const section = currentSection(runtime.sections, runtime.route)
  const keys = section === null ? [SUMMARY_KEY] : [sectionKey(section.id), SUMMARY_KEY]
  await Promise.all(keys.map(key => scheduler.runNow(key)))
}

// A login in a terminal can move the session to another installation, where the open item means nothing.
export async function syncPane($: Engine, runtime: Runtime): Promise<SessionState> {
  const session = await syncSession($, runtime.options)
  const url = sessionUrl(session)
  const isOtherInstallation = url !== '' && url !== runtime.routeUrl
  if (isOtherInstallation && runtime.route.item !== undefined) await createActions($, runtime).back()
  return session
}

export function createActions($: Engine, runtime: Runtime): PaneActions {
  async function move(change: (route: Route) => Route): Promise<void> {
    let before: Route | null = null
    const route = await updateRoute($, current => {
      before = current
      return change(current)
    })
    runtime.route = route
    if (before === null || itemOf(before) !== itemOf(route)) await runtime.logs?.close()
    try {
      const url = sessionUrl(await readSession($))
      runtime.routeUrl = url
      await saveRoute($, route, url)
    } catch {
      // The route still moves; only the next session would not start there.
    }
    const section = currentSection(runtime.sections, route)
    if (section !== null && (before === null || needsLoad(runtime.sections, before, route))) {
      void runtime.scheduler?.runNow(sectionKey(section.id))
    }
  }

  async function leaveItem(): Promise<void> {
    if (runtime.route.item !== undefined) await move(back)
    else await runtime.logs?.close()
  }

  async function closeSwitcher(): Promise<void> {
    runtime.isAddingInstallation = false
    await writeSwitcherOpen($, false)
    if ((await readConfirm($)) !== null) await writeConfirm($, null)
  }

  async function loginTo(session: SessionState): Promise<void> {
    const name = installationOf(session)
    if (name === null) return
    const known = (await installationsFor($, runtime.options)).some(installation => installation.name === name)
    if (!known && (session.kind === 'connected' || session.kind === 'expired')) {
      await addInstallation($, runtime.options, session.url)
      return
    }
    await switchTo($, runtime.options, name)
  }

  return {
    go: next => move(current => go(current, next)),
    back: () => move(back),
    async ask(action, question, yesLabel) {
      const session = await readSession($)
      if (session.kind !== 'connected') return
      await writeConfirm($, { action, question, yesLabel, url: session.url })
    },
    refresh: () => refreshLoads(runtime),
    log: {
      async stream(stream) {
        await runtime.logs?.stream(stream)
      },
      async more() {
        await runtime.logs?.more()
      },
      async follow(on) {
        await runtime.logs?.follow(on)
      },
    },
    assist: {
      explain: (key, input) => void explain($, key, input).catch(() => undefined),
      draft: text => void fillDraft($, text).catch(() => undefined),
    },

    async confirmYes() {
      const [asked, session] = await Promise.all([readConfirm($), readSession($)])
      const endpoints = runtime.endpoints
      if (asked === null || asked.result !== undefined || endpoints === null || runtime.isActing) return
      // A question acts only on the installation it was asked on, while the session is connected to it.
      if (session.kind !== 'connected' || session.url !== asked.url) return
      // Until the result is written the question and its Yes stay on screen: a second press stops here.
      runtime.isActing = true
      try {
        const outcome = await outcomeOf(endpoints, asked.action, asked.url)
        const at = await clockNow($)
        await updateConfirm($, current =>
          current !== null &&
          current.result === undefined &&
          current.url === asked.url &&
          sameAction(current.action, asked.action)
            ? { ...current, result: { ...outcome, at } }
            : current,
        )
        void refreshLoads(runtime)
        after($, RESULT_MS, () => {
          updateConfirm($, current => (current?.result?.at === at ? null : current)).catch(() => undefined)
        })
      } finally {
        runtime.isActing = false
      }
    },
    async confirmNo() {
      await writeConfirm($, null)
    },

    async toggleSwitcher() {
      runtime.isAddingInstallation = false
      await updateSwitcherOpen($, isOpen => !isOpen)
    },
    showAddInstallation() {
      runtime.isAddingInstallation = true
      // The flag is not in `$.state`, so nothing redraws by itself.
      $.ui.invalidate('ui.render')
    },
    // A login without a CLI changes nothing, and the switcher stays open: the pane says there how to install it.
    async pick(name) {
      if (await hasCli($, runtime.options)) {
        await closeSwitcher()
        if (name !== installationOf(await readSession($))) await leaveItem()
      }
      await switchTo($, runtime.options, name)
    },
    async add(url) {
      runtime.isAddingInstallation = false
      if (await hasCli($, runtime.options)) {
        await closeSwitcher()
        await leaveItem()
      }
      await addInstallation($, runtime.options, url)
    },
    async loginAgain() {
      if (await hasCli($, runtime.options)) await closeSwitcher()
      await loginTo(await readSession($))
    },
    async cancelLogin() {
      await closeSwitcher()
      await cancelLogin($, runtime.options)
    },
    async retry() {
      const session = await readSession($)
      if (session.kind !== 'error') return
      if (session.installation === null) {
        await writeSession($, { kind: 'disconnected' })
        return
      }
      await switchTo($, runtime.options, session.installation)
    },
  }
}

export function sectionActions(act: PaneActions): SectionActions {
  const ignore = () => undefined
  return {
    go: next => void act.go(next).catch(ignore),
    back: () => void act.back().catch(ignore),
    ask: (action, question, yesLabel) => void act.ask(action, question, yesLabel).catch(ignore),
    refresh: () => void act.refresh(),
    log: {
      stream: stream => void act.log.stream(stream).catch(ignore),
      more: () => void act.log.more().catch(ignore),
      follow: on => void act.log.follow(on).catch(ignore),
    },
    assist: act.assist,
  }
}

function itemOf(route: Route): string {
  return route.item === undefined ? '' : `${route.section}:${route.item.kind}:${route.item.id}`
}

export function installationOf(session: SessionState): string | null {
  switch (session.kind) {
    case 'connected':
    case 'expired':
    case 'logging-in':
    case 'error':
      return session.installation
    default:
      return null
  }
}

async function outcomeOf(
  endpoints: Endpoints,
  action: ActionRequest,
  url: string,
): Promise<{ ok: boolean; text: string }> {
  try {
    await endpoints.act(action, url)
    return { ok: true, text: `${DONE[action.verb]} ${'node' in action ? action.node : action.job}` }
  } catch (error) {
    // An `ApiError` message is safe to show: it never holds the cookie or a body that is not the platform's.
    const message = error instanceof Error ? error.message : ''
    return { ok: false, text: message !== '' ? message : 'The action failed.' }
  }
}

function sameAction(a: ActionRequest, b: ActionRequest): boolean {
  if ('node' in a || 'node' in b) return 'node' in a && 'node' in b && a.verb === b.verb && a.node === b.node && a.host === b.host
  return a.verb === b.verb && a.job === b.job && a.env === b.env && a.runId === b.runId
}
