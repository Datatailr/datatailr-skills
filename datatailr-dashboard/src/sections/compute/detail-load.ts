/*************************************************************************
 *
 *  Copyright (c) 2026 Datatailr Inc.
 *
 *  Licensed under the MIT License. See the 'LICENSE' file distributed
 *  with this package for the full license text.
 *
 *  SPDX-License-Identifier: MIT
 *************************************************************************/

import { ApiError } from '../../core/api'
import type { Endpoints } from '../../core/endpoints'
import { FAILED_STATES, type Job, type Run, type TaskState } from '../../core/model'
import type { ItemRef } from '../../core/route'
import { LISTED_TYPES, dslValue, listedState } from './filters'

export type ComputeDetail =
  | { kind: 'run'; run: Run; job: Job | null; tasks: TaskState[] | null }
  | { kind: 'job'; job: Job; recent: Run[] }

export const RECENT_DAYS = 7
export const RECENT_RUNS = 10

const DAY_MS = 24 * 60 * 60 * 1000

/** Null only when the platform has no row for the item: any failure rejects, so the page shows the error. */
export async function loadDetail(api: Endpoints, item: ItemRef, now: number): Promise<ComputeDetail | null> {
  if (item.kind === 'run') {
    const runId = /^\d+$/.test(item.id) ? Number(item.id) : null
    return runId === null ? null : loadRun(api, runId)
  }
  if (item.kind === 'job') {
    const at = item.id.indexOf(':')
    if (at <= 0 || at === item.id.length - 1) return null
    return loadJob(api, item.id.slice(at + 1), item.id.slice(0, at), now)
  }

  return null
}

async function loadRun(api: Endpoints, runId: number): Promise<ComputeDetail | null> {
  const { rows } = await api.runs.list({ sinceMs: 0, filter: `runId = ${runId}`, limit: 1 })
  const run = rows.find(row => row.id === runId)
  if (run === undefined) return null

  const [job, tasks] = await Promise.all([orNull(api.jobs.get(run.job, run.env)), orNull(api.runs.tasks(runId))])

  return { kind: 'run', run, job, tasks: tasks === null || tasks.length === 0 ? null : tasks }
}

async function loadJob(api: Endpoints, name: string, env: string, now: number): Promise<ComputeDetail | null> {
  const filter = `jobName = ${dslValue(name)} and environment = ${dslValue(env)}`
  const [job, recent, running] = await Promise.all([
    api.jobs.get(name, env),
    api.runs.list({ sinceMs: now - RECENT_DAYS * DAY_MS, filter, limit: RECENT_RUNS }),
    api.runs.list({ sinceMs: 0, filter: `${filter} and state = running`, limit: 1 }),
  ])
  if (job === null) return null

  const isRunning = running.rows.some(run => run.state === 'running')
  let state = isRunning ? 'running' : job.state
  if (LISTED_TYPES.has(job.type)) {
    state = listedState(job, isRunning)
    // A job that its list shows as stopped, and whose newest run failed, crashed.
    const newest = recent.rows[0]
    if (state === 'stopped' && newest !== undefined && FAILED_STATES.has(newest.state)) state = newest.state
  }

  return { kind: 'job', job: { ...job, state }, recent: recent.rows }
}

async function orNull<T>(work: Promise<T>): Promise<T | null> {
  try {
    return await work
  } catch (error) {
    if (error instanceof ApiError && error.kind === 'logged-out') throw error
    return null
  }
}
