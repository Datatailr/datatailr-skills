/*************************************************************************
 *
 *  Copyright (c) 2026 Datatailr Inc.
 *
 *  Licensed under the MIT License. See the 'LICENSE' file distributed
 *  with this package for the full license text.
 *
 *  SPDX-License-Identifier: MIT
 *************************************************************************/

// Every time is epoch milliseconds.

export type Run = {
  id: number
  job: string
  display: string
  type: string
  env: string
  state: string
  version: number
  runAs: string
  submit: number
  start: number | null
  end: number | null
  error: string
  originalRunId: number | null
}

export type Job = {
  name: string
  display: string
  type: string
  env: string
  state: string
  version: number
  runAs: string
  built: boolean
  cpus: number | null
  // Bytes, as the platform sends it.
  memory: string | null
}

export type JobImage = { python: string; requirements: string; preBuild: string; postBuild: string }

export type Workstation = Job & { image: JobImage }

export type Workflow = { name: string; display: string; env: string; state: string; schedule: string; runAs: string }

export type TaskState = { job: string; state: string; start: number | null; end: number | null }

export type NodeRun = { job: string; env: string; state: string; runId: number; cpus: number | null; memory: number | null }

// `cpu` and `memory` are null when the node daemon does not report. Memory is in bytes.
export type PlatformNode = {
  name: string
  env: string
  type: string
  state: string
  host: string
  privateIp: string
  class: string
  createdAt: number | null
  tags: Record<string, string>
  cpu: { allocated: number; total: number } | null
  memory: { allocated: number; max: number } | null
  runs: NodeRun[]
}

export type Budget = { name: string; budget: number; usage: number; preventOverflow: boolean; isReadable: boolean }

export type User = { id: number; name: string; fullName: string; email: string; isSystem: boolean; isDisabled: boolean }

export type Group = { id: number; name: string; members: number[] }

// An id above 0 is a user, below 0 a group, and -1000 is everyone. A key with no environment has `system`.
export type KvAcl = Record<'read' | 'write' | 'operate' | 'access' | 'promote', number[]>

export type KvItem = { key: string; env: string; value: string | null; acl: KvAcl | null }

export type KvList = { items: KvItem[]; total: number }

export type CostRow = { date: string; owner: string; type: string; env: string; cost: number }

export type BlobEntry = { name: string; size: number; modified: number | null; isFile: boolean }

export type Summary = { runs: Run[]; jobs: Job[]; nodes: PlatformNode[]; hasMoreRuns?: boolean }

export const SUMMARY_RUNS = 500

export type JobAction = { verb: 'start' | 'stop' | 'rerun'; job: string; env: string; runId?: number }

export type NodeAction = { verb: 'drain' | 'undrain'; node: string; host: string }

export type ActionRequest = JobAction | NodeAction

export const FAILED_STATES: ReadonlySet<string> = new Set(['failed', 'failed_after', 'out_of_memory'])

export const NORMAL_NODE_STATES: ReadonlySet<string> = new Set([
  'running',
  'starting',
  'stopping',
  'stopped',
  'draining',
  'terminating',
  'terminated',
])
