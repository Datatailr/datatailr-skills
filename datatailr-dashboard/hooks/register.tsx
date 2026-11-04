/*************************************************************************
 *
 *  Copyright (c) 2026 Datatailr Inc.
 *
 *  Licensed under the MIT License. See the 'LICENSE' file distributed
 *  with this package for the full license text.
 *
 *  SPDX-License-Identifier: MIT
 *************************************************************************/

import type { EngineInterface, PromptSubmitInput, Register, RenderElement, RenderInput } from 'claude-code'

import { contextFor, isTypedPrompt } from '../src/assist/context'
import { dropPendingExplains } from '../src/assist/explain'
import { createApi } from '../src/core/api'
import { createEndpoints } from '../src/core/endpoints'
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
    await startDashboard($, runtime)

    return next(e)
  })

  on('command.run', { command: 'dt' }, async ($, e) => {
    const opened = await openPane($)
    if (opened.isPlaced && e.args.trim() === 'refresh') void refreshLoads(runtime)

    return { text: opened.isPlaced ? 'Datatailr pane opened.' : notPlaced(opened) }
  })

  // A failed gating hook is skipped, so each one answers for itself when it fails.
  on('tool.call', { tool: 'mcp__datatailr-dashboard__open_pane' }, async $ => {
    const opened = await openPane($)

    return { result: opened.isPlaced ? 'Datatailr pane is open.' : notPlaced(opened) }
  }).catch(() => ({ result: `The Datatailr pane could not open. ${NOT_PLACED_HINT}` }))

  on('ui.render', { component: 'Pane', requestId: PANE_ID }, async ($, e) => drawPane($, e, runtime))

  on('prompt.submit', async ($, e, next) => next(await withPaneContext($, e, runtime))).catch(($, e, next) => next(e))
}

// The plugin directory reads `$` in a hook only as a plain `$.noun.method(...)` call, or passed whole
// to a function of this file. These two hand it on to the modules that draw and describe the pane.
function drawPane($: EngineInterface, e: RenderInput<'Pane'>, runtime: Runtime): Promise<RenderElement> {
  return renderPane($, e, runtime)
}

async function withPaneContext($: EngineInterface, e: PromptSubmitInput, runtime: Runtime): Promise<PromptSubmitInput> {
  const block = isTypedPrompt(e) ? await contextFor($, runtime).catch(() => null) : null
  return block === null ? e : { ...e, context: [...(e.context ?? []), block] }
}

async function startDashboard($: EngineInterface, runtime: Runtime): Promise<void> {
  runtime.scheduler?.cancel()

  // A hot reload keeps `$.state` but loses an explanation that was being asked for.
  try {
    await dropPendingExplains($)
  } catch {
  }

  // A hot reload keeps `$.state` but drops a login that was running: nothing would end its state.
  try {
    if ((await readSession($)).kind === 'logging-in') await writeSession($, { kind: 'disconnected' })
    await syncSession($, runtime.options)
  } catch {
  }
  try {
    const url = (await readCliSession($))?.url ?? null
    const stored = await loadRoute($, url)
    if (stored !== null) await writeRoute($, stored)
    runtime.route = await readRoute($)
    runtime.routeUrl = url ?? ''
  } catch {
  }

  const endpoints = createEndpoints(
    createApi(
      $,
      () => readCliSession($),
      async () => sessionUrl(await readSession($)),
    ),
  )
  runtime.endpoints = endpoints
  runtime.logs?.cancel()
  runtime.logs = createLogReader($, endpoints)

  try {
    if (await loadPaneWasOpen($)) await openPane($)
  } catch {
  }

  let wasShown: boolean | null = null
  runtime.scheduler = startScheduler($, () => loadSpecs($, endpoints, runtime.sections, runtime.route, runtime), {
    sync: () => syncPane($, runtime),
    onPaneShown: shown => {
      const before = wasShown
      wasShown = shown
      // The first tick can find a pane that waits undrawn: that must not erase the preference.
      if (shown) return savePaneWasOpen($, true)
      if (before === true) return savePaneWasOpen($, false)
      return undefined
    },
  })
}

async function openPane($: EngineInterface): Promise<Opened> {
  return $.ui.open({ id: PANE_ID, title: TITLE })
}

function notPlaced(opened: Opened): string {
  const reason = opened.isPlaced ? 'placed' : opened.reason
  return `Pane not placed (${reason}). ${NOT_PLACED_HINT}`
}
