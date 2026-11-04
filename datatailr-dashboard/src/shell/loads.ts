/*************************************************************************
 *
 *  Copyright (c) 2026 Datatailr Inc.
 *
 *  Licensed under the MIT License. See the 'LICENSE' file distributed
 *  with this package for the full license text.
 *
 *  SPDX-License-Identifier: MIT
 *************************************************************************/

import type { Engine } from '../core/engine'

import { ApiError } from '../core/api'
import type { Endpoints } from '../core/endpoints'
import type { LogReader } from '../core/logs'
import { type PlatformNode, SUMMARY_RUNS, type Summary } from '../core/model'
import { type Route, type SectionId, routeKey } from '../core/route'
import type { LoadKey, LoadSpec } from '../core/scheduler'
import type { LoadState } from '../core/state'
import { clockNow } from '../core/timers'
import type { Section } from '../sections/contract'

export const SUMMARY_KEY: LoadKey = 'summary'
const SUMMARY_EVERY_MS = 30_000
const SUMMARY_WINDOW_MS = 24 * 60 * 60 * 1000

export function sectionKey(id: SectionId): LoadKey {
  return `section:${id}`
}

export type SectionResult = { loadKey: string; data: unknown }

const isSectionResult = (value: unknown): value is SectionResult =>
  typeof value === 'object' && value !== null && typeof (value as SectionResult).loadKey === 'string'

export function loadKeyOf(section: Section<any>, route: Route): string {
  return section.loadKey?.(route) ?? routeKey(route)
}

export function needsLoad(sections: readonly Section<any>[], before: Route, after: Route): boolean {
  const next = currentSection(sections, after)
  if (next === null) return false

  return currentSection(sections, before)?.id !== next.id || loadKeyOf(next, before) !== loadKeyOf(next, after)
}

// A load counts only for the key it was made for: the rows or the error of another tab are not this
// tab's. A stored load from before the keys has no key and reads as not loaded.
export function loadFor(load: LoadState | undefined, key: string): LoadState | undefined {
  if (load === undefined) return undefined

  const isData = isSectionResult(load.data) && load.data.loadKey === key
  const { errorTag: _tag, ...rest } = load

  return {
    ...rest,
    data: isData ? ((load.data as SectionResult).data ?? null) : null,
    fetchedAt: isData ? load.fetchedAt : null,
    error: load.error !== null && load.errorTag === key ? load.error : null,
  }
}

export function currentSection(sections: readonly Section<any>[], route: Route): Section<any> | null {
  return sections.find(section => section.id === route.section) ?? sections[0] ?? null
}

// The running runs are read apart, at any age: a service that started last week still runs.
export async function loadSummary(endpoints: Endpoints, now: number): Promise<Summary> {
  const [recent, running, jobs, nodes] = await Promise.all([
    endpoints.runs.list({ sinceMs: now - SUMMARY_WINDOW_MS, limit: SUMMARY_RUNS }),
    endpoints.runs.running(),
    endpoints.jobs.list(),
    endpoints.nodes.list().catch((error: unknown): PlatformNode[] => {
      if (error instanceof ApiError && error.kind === 'no-access') return []
      throw error
    }),
  ])
  const seen = new Set(recent.rows.map(run => run.id))
  const older = running.filter(run => !seen.has(run.id))
  const runs = [...recent.rows, ...older].sort((a, b) => b.submit - a.submit || b.id - a.id)

  return { runs, jobs, nodes, hasMoreRuns: recent.hasMore }
}

export type LogHost = { logs: LogReader | null; route: Route }

export function loadSpecs(
  $: Engine,
  endpoints: Endpoints,
  sections: readonly Section<any>[],
  route: Route,
  host: LogHost | null = null,
): LoadSpec[] {
  const specs: LoadSpec[] = [
    { key: SUMMARY_KEY, everyMs: SUMMARY_EVERY_MS, run: async () => loadSummary(endpoints, await clockNow($)) },
  ]
  const section = currentSection(sections, route)
  if (section !== null) {
    const key = loadKeyOf(section, route)
    specs.push({
      key: sectionKey(section.id),
      everyMs: section.refreshMs,
      tag: key,
      run: async (): Promise<SectionResult> => {
        const data = await section.load(endpoints, route, await clockNow($))
        if (host !== null) void openLogOf(host, sections, section, route, data)
        return { loadKey: key, data }
      },
    })
  }
  return specs
}

async function openLogOf(
  host: LogHost,
  sections: readonly Section<any>[],
  section: Section<any>,
  route: Route,
  data: unknown,
): Promise<void> {
  try {
    const request = section.logFor?.(route, data) ?? null
    const reader = host.logs
    if (request === null || reader === null) return
    const now = host.route
    if (currentSection(sections, now)?.id !== section.id || loadKeyOf(section, now) !== loadKeyOf(section, route)) return
    await reader.ensure(request)
  } catch {
    // A section whose `logFor` fails shows no log.
  }
}
