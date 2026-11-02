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
import { stateColor, stateLabel } from '../../ui/status'
import type { Column } from '../../ui/table'
import { age, duration, memory } from '../../ui/text'

export const MARK_COUNT = 10

export type WorkflowRow = Workflow & { marks: string }

export function markOf(state: string): string {
  if (state === 'completed') return '✓'
  if (FAILED_STATES.has(state)) return '✕'

  return state === 'running' ? '●' : '○'
}

export const marksOf = (runs: readonly Run[]) =>
  runs
    .slice(0, MARK_COUNT)
    .map(run => markOf(run.state))
    .join('')

const cpuOf = (job: Job) => (job.cpus === null || job.cpus <= 0 ? '—' : String(job.cpus))

export const runColumns = (now: number): Column<Run>[] => [
  { id: 'state', title: 'state', width: 15, cell: run => stateLabel(run.state), tone: run => stateColor(run.state) },
  { id: 'name', title: 'name', width: 22, cell: run => run.job },
  { id: 'type', title: 'type', width: 8, cell: run => run.type },
  { id: 'age', title: 'age', width: 4, cell: run => age(now, run.submit) },
  { id: 'duration', title: 'duration', width: 8, cell: run => duration(run.start, run.end, now) },
  { id: 'run-as', title: 'run-as', width: 10, cell: run => run.runAs },
]

export const workflowColumns: Column<WorkflowRow>[] = [
  { id: 'name', title: 'name', width: 22, cell: workflow => workflow.name },
  { id: 'schedule', title: 'schedule', width: 16, cell: workflow => workflow.schedule },
  {
    id: 'state',
    title: 'state',
    width: 12,
    cell: workflow => stateLabel(workflow.state),
    tone: workflow => stateColor(workflow.state),
  },
  { id: 'marks', title: 'last 10 runs', width: MARK_COUNT + 2, cell: workflow => workflow.marks },
]

export const jobColumns: Column<Job>[] = [
  { id: 'name', title: 'name', width: 22, cell: job => job.name },
  { id: 'state', title: 'state', width: 12, cell: job => stateLabel(job.state), tone: job => stateColor(job.state) },
  { id: 'environment', title: 'environment', width: 11, cell: job => job.env },
  { id: 'run-as', title: 'run-as', width: 10, cell: job => job.runAs },
  { id: 'cpu', title: 'CPU', width: 6, cell: cpuOf },
  { id: 'memory', title: 'memory', width: 8, cell: job => memory(job.memory) },
]
