/*************************************************************************
 *
 *  Copyright (c) 2026 Datatailr Inc.
 *
 *  Licensed under the MIT License. See the 'LICENSE' file distributed
 *  with this package for the full license text.
 *
 *  SPDX-License-Identifier: MIT
 *************************************************************************/

import { FAILED_STATES, type Job, type Run, type Workflow } from '../../core/model'
import { type Route, routeKey } from '../../core/route'
import { ALL, filterOf, pageOf, pageRows, searchOf } from '../listing'
import { type WorkflowRow, marksOf } from './columns'

export { ALL, filterOf, pageOf, pageRows, searchOf }

export const TABS = [
  { id: 'runs', label: 'Runs' },
  { id: 'workflows', label: 'Workflows' },
  { id: 'apps', label: 'Apps' },
  { id: 'services', label: 'Services' },
  { id: 'excel', label: 'Excel' },
] as const

export type TabId = (typeof TABS)[number]['id']

export const tabOf = (route: Route): TabId => TABS.find(tab => tab.id === route.tab)?.id ?? 'runs'

export const JOB_TYPES = { apps: 'app', services: 'service', excel: 'excel' } as const

export const LISTED_TYPES: ReadonlySet<string> = new Set(Object.values(JOB_TYPES))

/** `job ls` and `job get` give the job's own state (`created`, `building`, `ready`), not that of its runs. */
export function listedState(job: Job, isRunning: boolean): string {
  if (isRunning) return 'running'
  return job.state === 'building' ? 'building' : 'stopped'
}

export const RUN_CHIPS = [ALL, 'failed', 'running']
export const WORKFLOW_CHIPS = [ALL, 'scheduled', 'not-scheduled']
export const JOB_CHIPS = [ALL, 'running', 'stopped']
export const RUN_TYPES = ['batch', 'app', 'service', 'excel']
export const ENVIRONMENTS = ['dev', 'pre', 'prod']

const NEEDS_QUOTES = /^$|[\s()[\],"\\]/

/** A value in the filter language of `dt view get`, quoted as the web GUI quotes it. */
export function dslValue(value: string): string {
  return NEEDS_QUOTES.test(value) ? `"${value.replace(/[\\"]/g, '\\$&')}"` : value
}

export function runsFilter(route: Route): string {
  const parts: string[] = []
  const state = filterOf(route, 'state', RUN_CHIPS)
  if (state === 'failed') parts.push(`state = [${[...FAILED_STATES].join(', ')}]`)
  if (state === 'running') parts.push('state = running')
  const type = filterOf(route, 'type', RUN_TYPES)
  if (type !== ALL) parts.push(`type = ${dslValue(type)}`)
  const search = searchOf(route)
  if (search !== '') parts.push(`jobName contains ${dslValue(search)}`)

  return parts.join(' and ')
}

const DAY_MS = 24 * 60 * 60 * 1000

export const isRunningNow = (route: Route) => filterOf(route, 'state', RUN_CHIPS) === 'running'

export const runsSinceMs = (route: Route, now: number) => (isRunningNow(route) ? 0 : now - DAY_MS)

// The server filters and pages the Runs list; the other lists are read whole and filtered here.
export function loadKey(route: Route): string {
  if (route.item !== undefined) return `item:${route.item.kind}:${route.item.id}`

  const tab = tabOf(route)
  if (tab !== 'runs') return tab

  return routeKey({ section: route.section, tab, filter: route.filter, search: route.search, page: route.page })
}

const hasText = (text: string, search: string) => text.toLowerCase().includes(search.toLowerCase())

// A workflow's state is its job's (`ready`), so its chips are about the schedule.
export function filterWorkflows(rows: readonly Workflow[], route: Route): Workflow[] {
  const chip = filterOf(route, 'state', WORKFLOW_CHIPS)
  const search = searchOf(route)

  return rows.filter(
    row => (chip === ALL || (chip === 'scheduled') === (row.schedule !== '')) && hasText(row.name, search),
  )
}

export function filterJobs(rows: readonly Job[], route: Route): Job[] {
  const chip = filterOf(route, 'state', JOB_CHIPS)
  const env = filterOf(route, 'env', ENVIRONMENTS)
  const search = searchOf(route)

  return rows.filter(
    row => (chip === ALL || row.state === chip) && (env === ALL || row.env === env) && hasText(row.name, search),
  )
}

export function withMarks(rows: readonly Workflow[], runs: readonly Run[]): WorkflowRow[] {
  const byJob = new Map<string, Run[]>()
  for (const run of runs) {
    const key = `${run.env}:${run.job}`
    const same = byJob.get(key)
    if (same === undefined) byJob.set(key, [run])
    else same.push(run)
  }
  const newestFirst = (a: Run, b: Run) => b.submit - a.submit || b.id - a.id

  return rows.map(row => ({ ...row, marks: marksOf((byJob.get(`${row.env}:${row.name}`) ?? []).sort(newestFirst)) }))
}
