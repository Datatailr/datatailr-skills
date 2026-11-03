/*************************************************************************
 *
 *  Copyright (c) 2026 Datatailr Inc.
 *
 *  Licensed under the MIT License. See the 'LICENSE' file distributed
 *  with this package for the full license text.
 *
 *  SPDX-License-Identifier: MIT
 *************************************************************************/

import type { LogRequest } from '../../core/logs'
import { FAILED_STATES, type JobAction } from '../../core/model'
import type { ComputeDetail } from './detail-load'
import { LISTED_TYPES } from './filters'

/** The platform calls a workflow run `batch`. */
const WORKFLOW_TYPES: ReadonlySet<string> = new Set(['batch', 'workflow'])

const STARTABLE_TYPES: ReadonlySet<string> = new Set(['app', 'service', 'excel', ...WORKFLOW_TYPES])

const OPENABLE_TYPES: ReadonlySet<string> = new Set(['app', 'service'])

function subjectOf(detail: ComputeDetail): { job: string; env: string; type: string; state: string } {
  return detail.kind === 'run'
    ? { job: detail.run.job, env: detail.run.env, type: detail.run.type, state: detail.run.state }
    : { job: detail.job.name, env: detail.job.env, type: detail.job.type, state: detail.job.state }
}

// `start` only on a job page: a run page shows one run, and an old stopped run of a job that runs again
// must not start it. A workflow job shows `ready`, never `stopped`, so its page does not offer `start`.
export function actionsFor(detail: ComputeDetail): JobAction[] {
  const { job, env, type, state } = subjectOf(detail)
  const actions: JobAction[] = []
  const isStartable =
    STARTABLE_TYPES.has(type) && (state === 'stopped' || (FAILED_STATES.has(state) && LISTED_TYPES.has(type)))
  if (detail.kind === 'job' && isStartable) actions.push({ verb: 'start', job, env })
  if (state === 'running') actions.push({ verb: 'stop', job, env })
  if (detail.kind === 'run' && FAILED_STATES.has(state) && WORKFLOW_TYPES.has(type)) {
    actions.push({ verb: 'rerun', job, env, runId: detail.run.id })
  }

  return actions
}

export const ACTION_LABELS: Record<JobAction['verb'], string> = { start: 'Start', stop: 'Stop', rerun: 'Rerun' }

export function confirmOf(action: JobAction): { question: string; yesLabel: string } {
  switch (action.verb) {
    case 'start':
      return { question: `Start ${action.job} in ${action.env}?`, yesLabel: 'Yes, start' }
    case 'stop':
      return { question: `Stop ${action.job} in ${action.env}?`, yesLabel: 'Yes, stop' }
    case 'rerun':
      return { question: `Rerun run #${action.runId ?? ''} of ${action.job}?`, yesLabel: 'Yes, rerun' }
  }
}

/** A job whose last build failed shows its build log: the failure is there, not in a run. */
export const needsBuildLog = (detail: ComputeDetail): boolean => detail.kind === 'job' && !detail.job.built

// A job page shows the log of its newest recent run, so that a new run opens its own log. With no
// recent run, the platform picks the latest one.
export function logRequestOf(detail: ComputeDetail): LogRequest {
  if (detail.kind === 'run') return { job: detail.run.job, env: detail.run.env, runId: detail.run.id }
  if (needsBuildLog(detail)) return { job: detail.job.name, env: detail.job.env, build: true }
  const newest = detail.recent[0]

  return { job: detail.job.name, env: detail.job.env, ...(newest === undefined ? {} : { runId: newest.id }) }
}

// A build log is whole and done: there is nothing to follow.
export function canFollow(detail: ComputeDetail): boolean {
  return subjectOf(detail).state === 'running' && !needsBuildLog(detail)
}

const segment = encodeURIComponent

const baseOf = (base: string) => base.replace(/\/+$/, '')

/** The item's page in the web GUI, at the paths of the GUI's router. */
export function webGuiUrl(base: string, detail: ComputeDetail): string {
  const root = baseOf(base)
  if (detail.kind === 'job') {
    const { name, type, env } = detail.job
    return `${root}/job-details/${segment(name)}/${segment(type)}/${segment(env)}`
  }
  const { run } = detail
  if (WORKFLOW_TYPES.has(run.type)) return `${root}/workflow-run/${run.id}`

  return `${root}/job-log/${segment(run.job)}/${segment(run.env)}/${run.id}`
}

export function openUrl(base: string, detail: ComputeDetail): { href: string; label: string } | null {
  if (detail.kind !== 'job' || !OPENABLE_TYPES.has(detail.job.type)) return null
  const { name, env, type } = detail.job

  return { href: `${baseOf(base)}/job/${segment(env)}/${segment(name)}/`, label: `Open ${type}` }
}
