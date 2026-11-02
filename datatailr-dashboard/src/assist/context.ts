/*************************************************************************
 *
 *  Copyright (c) 2026 Datatailr Inc.
 *
 *  Licensed under the MIT License. See the 'LICENSE' file distributed
 *  with this package for the full license text.
 *
 *  SPDX-License-Identifier: MIT
 *************************************************************************/

import type { EngineInterface, PluginOptions, PromptSubmitInput } from 'claude-code'

import { isPaneShown } from '../core/panes'
import { routeKey } from '../core/route'
import { readLastContext, readLoads, readRoute, readSession, writeLastContext } from '../core/state'
import { clockNow } from '../core/timers'
import type { Section } from '../sections/contract'
import { currentSection } from '../shell/loads'
import { loadsFor, sectionLoadOf, summaryOf, viewOf } from '../shell/view'
import { SCRUB_LIMIT, cut, redact } from './text'

// The `prompt.submit` block about what the pane shows: it never holds a log line, and secrets are scrubbed.

export const CONTEXT_LIMIT = 1_500

export function isSharing(options: PluginOptions): boolean {
  return options.shareContext !== false
}

// The desktop app hosts its sessions through the SDK, so a typed message may carry `sdk`. A headless
// `-p` run is `sdk` too, but it never shows the pane, and a block is added only while the pane is shown.
const TYPED_ORIGINS: ReadonlySet<string> = new Set(['composer', 'bridge', 'sdk'])

export function isTypedPrompt(e: Pick<PromptSubmitInput, 'command' | 'isMeta' | 'origin'>): boolean {
  return e.command === undefined && e.isMeta !== true && TYPED_ORIGINS.has(e.origin.kind)
}

export function contextBlock(installation: string, sectionTitle: string, described: string | null): string {
  const head = `Datatailr pane context (installation ${installation}, ${sectionTitle}):`
  const body = described === null || described.trim() === '' ? '' : `\n${redact(cut(described.trim(), SCRUB_LIMIT))}`

  return cut(head + body, CONTEXT_LIMIT)
}

export type ContextHost = { options: PluginOptions; sections: readonly Section<any>[] }

export async function contextFor($: EngineInterface, host: ContextHost): Promise<string | null> {
  if (!isSharing(host.options)) return null

  const session = await readSession($)
  if (session.kind !== 'connected') return null
  if (!(await isPaneShown($))) return null

  const route = await readRoute($)
  const key = `${session.url} ${routeKey(route)}`
  if ((await readLastContext($)) === key) return null

  const section = currentSection(host.sections, route)
  if (section === null) return null

  const [stored, now] = await Promise.all([readLoads($), clockNow($)])
  const loads = loadsFor(stored, session.url)
  let described: string | null = null
  try {
    // The view has no log: a description is never given a line of one.
    described =
      section.describe?.(
        viewOf({
          route,
          load: sectionLoadOf(loads, section, route),
          summary: summaryOf(loads),
          now,
          installation: session.installation,
          url: session.url,
          log: null,
          explain: {},
          shareContext: true,
          isConnected: true,
        }),
      ) ?? null
  } catch {
    // A section whose description fails still names itself.
  }
  await writeLastContext($, key)

  return contextBlock(session.installation, section.title, described)
}
