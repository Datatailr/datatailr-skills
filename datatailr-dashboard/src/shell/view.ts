/*************************************************************************
 *
 *  Copyright (c) 2026 Datatailr Inc.
 *
 *  Licensed under the MIT License. See the 'LICENSE' file distributed
 *  with this package for the full license text.
 *
 *  SPDX-License-Identifier: MIT
 *************************************************************************/

import type { Summary } from '../core/model'
import type { Route } from '../core/route'
import type { ExplainState, LoadState, LogState } from '../core/state'
import type { Section, SectionView } from '../sections/contract'
import { SUMMARY_KEY, loadFor, loadKeyOf, sectionKey } from './loads'

// After a switch, the loads of the installation before draw nothing: the pane waits for the new ones.
export function loadsFor(loads: Record<string, LoadState>, url: string): Record<string, LoadState> {
  return Object.fromEntries(Object.entries(loads).filter(([, load]) => load.url === url))
}

export function summaryOf(loads: Record<string, LoadState>): Summary | null {
  return (loads[SUMMARY_KEY]?.data ?? null) as Summary | null
}

export function sectionLoadOf(
  loads: Record<string, LoadState>,
  section: Section<any>,
  route: Route,
): LoadState | undefined {
  return loadFor(loads[sectionKey(section.id)], loadKeyOf(section, route))
}

export type ViewParts = {
  route: Route
  load: LoadState | undefined
  summary: Summary | null
  now: number
  installation: string
  url: string
  log: LogState
  explain: Readonly<Record<string, ExplainState>>
  shareContext: boolean
  isConnected: boolean
}

export function viewOf(p: ViewParts): SectionView<unknown> {
  return {
    data: p.load?.data ?? null,
    fetchedAt: p.load?.fetchedAt ?? null,
    error: p.load?.error ?? null,
    route: p.route,
    now: p.now,
    summary: p.summary,
    installation: p.installation,
    log: p.log,
    url: p.url,
    explain: p.explain,
    shareContext: p.shareContext,
    isConnected: p.isConnected,
  }
}
