/*************************************************************************
 *
 *  Copyright (c) 2026 Datatailr Inc.
 *
 *  Licensed under the MIT License. See the 'LICENSE' file distributed
 *  with this package for the full license text.
 *
 *  SPDX-License-Identifier: MIT
 *************************************************************************/

import type { EngineInterface, PluginState, PromptSubmitInput, Register, RenderElement, RenderInput } from 'claude-code'

import { contextFor, isTypedPrompt } from '../src/assist/context'
import { dropPendingExplains } from '../src/assist/explain'
import { createApi } from '../src/core/api'
import { createEndpoints } from '../src/core/endpoints'
import type { Engine } from '../src/core/engine'
import { PANE_ID } from '../src/core/ids'
import { readCliSession } from '../src/core/installations'
import { createLogReader, sessionUrl } from '../src/core/logs'
import { startScheduler } from '../src/core/scheduler'
import { syncSession } from '../src/core/session'
import {
  loadPaneWasOpen,
  loadRoute,
  readRoute,
  readSession,
  savePaneWasOpen,
  writeRoute,
  writeSession,
} from '../src/core/state'
import { SECTIONS } from '../src/sections'
import { type Runtime, refreshLoads, syncPane } from '../src/shell/actions'
import { loadSpecs } from '../src/shell/loads'
import { renderPane } from '../src/shell/pane'

const TITLE = 'Datatailr'
// The engine lists the state keys a mod reads and writes, so each `$.state` call below names its key.
const ROUTE = { plugin: 'datatailr-dashboard', key: 'route' } as const
const SESSION = { plugin: 'datatailr-dashboard', key: 'session' } as const
const LOADS = { plugin: 'datatailr-dashboard', key: 'loads' } as const
const CONFIRM = { plugin: 'datatailr-dashboard', key: 'confirm' } as const
const EXPLAIN = { plugin: 'datatailr-dashboard', key: 'explain' } as const
const LOG = { plugin: 'datatailr-dashboard', key: 'log' } as const
const SWITCHER_OPEN = { plugin: 'datatailr-dashboard', key: 'switcherOpen' } as const
const CLI_MISSING = { plugin: 'datatailr-dashboard', key: 'cliMissing' } as const
const LAST_CONTEXT = { plugin: 'datatailr-dashboard', key: 'lastContext' } as const
type Value<K extends keyof PluginState['datatailr-dashboard']> = PluginState['datatailr-dashboard'][K]
const NOT_PLACED_HINT = 'Panes need a local Claude Code session (terminal or the desktop Code tab).'

type Opened = Awaited<ReturnType<EngineInterface['ui']['open']>>

export const register: Register = (on, options) => {
  const runtime: Runtime = {
    options,
    sections: SECTIONS,
    endpoints: null,
    scheduler: null,
    logs: null,
    route: { section: 'overview' },
    routeUrl: '',
    isAddingInstallation: false,
    isActing: false,
  }

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'dt',
      description: 'Open the Datatailr dashboard pane (/dt refresh reads the data again)',
    })
    await $.tool.register({
      name: 'open_pane',
      description:
        'Open the live Datatailr dashboard (jobs, runs, workflows, nodes, logs) in a pane. ' +
        'Call when the user asks to open or show the Datatailr dashboard or pane.',
      inputSchema: { type: 'object', properties: {} },
      isDeferred: false,
    })
    await startDashboard(engineOf($), runtime)

    return next(e)
  })

  on('command.run', { command: 'dt' }, async ($, e) => {
    const opened = await openPane(engineOf($))
    if (opened.isPlaced && e.args.trim() === 'refresh') void refreshLoads(runtime)

    return { text: opened.isPlaced ? 'Datatailr pane opened.' : notPlaced(opened) }
  })

  // A failed gating hook is skipped, so each one answers for itself when it fails.
  on('tool.call', { tool: 'mcp__datatailr-dashboard__open_pane' }, async $ => {
    const opened = await openPane(engineOf($))

    return { result: opened.isPlaced ? 'Datatailr pane is open.' : notPlaced(opened) }
  }).catch(() => ({ result: `The Datatailr pane could not open. ${NOT_PLACED_HINT}` }))

  on('ui.render', { component: 'Pane', requestId: PANE_ID }, async ($, e) => drawPane(engineOf($), e, runtime))

  on('prompt.submit', async ($, e, next) => next(await withPaneContext(engineOf($), e, runtime))).catch(($, e, next) => next(e))
}

// The plugin directory reads `$` in this file only as a plain `$.noun.method(...)` call, or passed whole
// to a function of this file, and it refuses `$` passed to a function of another file. So every engine
// call that the modules make is written here once, and the modules get this object instead of `$`.
function engineOf($: EngineInterface): Engine {
  return {
    clock: {
      after: (ms, fn) => $.clock.after(ms, fn),
      every: (ms, fn) => $.clock.every(ms, fn),
      now: () => $.clock.now(),
    },
    // The engine lists the variables a mod reads, so each read names its variable.
    env: {
      get: name => {
        switch (name) {
          case 'HOME':
            return $.env.get('HOME')
          case 'OS':
            return $.env.get('OS')
          case 'PATH':
            return $.env.get('PATH')
          case 'USERPROFILE':
            return $.env.get('USERPROFILE')
        }
      },
    },
    fs: {
      exists: path => $.fs.exists(path),
      list: path => $.fs.list(path),
      read: path => $.fs.read(path),
      stat: (path, options) => $.fs.stat(path, options),
      write: (path, text) => $.fs.write(path, text),
    },
    http: { fetch: (url, init) => $.http.fetch(url, init) },
    model: { complete: (request, options) => $.model.complete(request, options) },
    process: {
      run: (argv, init) => $.process.run(argv, init),
      spawn: request => $.process.spawn(request),
    },
    prompt: {
      fill: input => $.prompt.fill(input),
      read: () => $.prompt.read(),
    },
    state: {
      get: ref => {
        switch (ref.key) {
          case 'route':
            return $.state.get(ROUTE)
          case 'session':
            return $.state.get(SESSION)
          case 'loads':
            return $.state.get(LOADS)
          case 'confirm':
            return $.state.get(CONFIRM)
          case 'explain':
            return $.state.get(EXPLAIN)
          case 'log':
            return $.state.get(LOG)
          case 'switcherOpen':
            return $.state.get(SWITCHER_OPEN)
          case 'cliMissing':
            return $.state.get(CLI_MISSING)
          case 'lastContext':
            return $.state.get(LAST_CONTEXT)
        }
      },
      set: (ref, value, options) => {
        switch (ref.key) {
          case 'route':
            return $.state.set(ROUTE, value as Value<'route'>, options)
          case 'session':
            return $.state.set(SESSION, value as Value<'session'>, options)
          case 'loads':
            return $.state.set(LOADS, value as Value<'loads'>, options)
          case 'confirm':
            return $.state.set(CONFIRM, value as Value<'confirm'>, options)
          case 'explain':
            return $.state.set(EXPLAIN, value as Value<'explain'>, options)
          case 'log':
            return $.state.set(LOG, value as Value<'log'>, options)
          case 'switcherOpen':
            return $.state.set(SWITCHER_OPEN, value as Value<'switcherOpen'>, options)
          case 'cliMissing':
            return $.state.set(CLI_MISSING, value as Value<'cliMissing'>, options)
          case 'lastContext':
            return $.state.set(LAST_CONTEXT, value as Value<'lastContext'>, options)
        }
      },
    },
    store: {
      get: key => $.store.get(key),
      set: (key, value) => $.store.set(key, value),
    },
    ui: {
      invalidate: event => $.ui.invalidate(event),
      open: pane => $.ui.open(pane),
      panes: () => $.ui.panes(),
      resolve: e => $.ui.resolve(e),
    },
  }
}

function drawPane(engine: Engine, e: RenderInput<'Pane'>, runtime: Runtime): Promise<RenderElement> {
  return renderPane(engine, e, runtime)
}

async function withPaneContext(engine: Engine, e: PromptSubmitInput, runtime: Runtime): Promise<PromptSubmitInput> {
  const block = isTypedPrompt(e) ? await contextFor(engine, runtime).catch(() => null) : null
  return block === null ? e : { ...e, context: [...(e.context ?? []), block] }
}

async function startDashboard(engine: Engine, runtime: Runtime): Promise<void> {
  runtime.scheduler?.cancel()

  // A hot reload keeps `$.state` but loses an explanation that was being asked for.
  try {
    await dropPendingExplains(engine)
  } catch {
  }

  // A hot reload keeps `$.state` but drops a login that was running: nothing would end its state.
  try {
    if ((await readSession(engine)).kind === 'logging-in') await writeSession(engine, { kind: 'disconnected' })
    await syncSession(engine, runtime.options)
  } catch {
  }
  try {
    const url = (await readCliSession(engine))?.url ?? null
    const stored = await loadRoute(engine, url)
    if (stored !== null) await writeRoute(engine, stored)
    runtime.route = await readRoute(engine)
    runtime.routeUrl = url ?? ''
  } catch {
  }

  const endpoints = createEndpoints(
    createApi(
      engine,
      () => readCliSession(engine),
      async () => sessionUrl(await readSession(engine)),
    ),
  )
  runtime.endpoints = endpoints
  runtime.logs?.cancel()
  runtime.logs = createLogReader(engine, endpoints)

  try {
    if (await loadPaneWasOpen(engine)) await openPane(engine)
  } catch {
  }

  let wasShown: boolean | null = null
  runtime.scheduler = startScheduler(engine, () => loadSpecs(engine, endpoints, runtime.sections, runtime.route, runtime), {
    sync: () => syncPane(engine, runtime),
    onPaneShown: shown => {
      const before = wasShown
      wasShown = shown
      // The first tick can find a pane that waits undrawn: that must not erase the preference.
      if (shown) return savePaneWasOpen(engine, true)
      if (before === true) return savePaneWasOpen(engine, false)
      return undefined
    },
  })
}

async function openPane(engine: Engine): Promise<Opened> {
  return engine.ui.open({ id: PANE_ID, title: TITLE })
}

function notPlaced(opened: Opened): string {
  const reason = opened.isPlaced ? 'placed' : opened.reason
  return `Pane not placed (${reason}). ${NOT_PLACED_HINT}`
}
