/*************************************************************************
 *
 *  Copyright (c) 2026 Datatailr Inc.
 *
 *  Licensed under the MIT License. See the 'LICENSE' file distributed
 *  with this package for the full license text.
 *
 *  SPDX-License-Identifier: MIT
 *************************************************************************/

import type { Api, Params } from './api'
import { buildLogText } from './build-log'
import type {
  ActionRequest,
  BlobEntry,
  Budget,
  CostRow,
  Group,
  Job,
  KvList,
  PlatformNode,
  Run,
  TaskState,
  User,
  Workflow,
  Workstation,
} from './model'

export type Page<T> = { rows: T[]; hasMore: boolean }

export interface Endpoints {
  runs: {
    // `filter` is joined to the time window with `and`, so an `or` in it needs parentheses.
    list(q: { sinceMs: number; filter?: string; sort?: string; offset?: number; limit?: number }): Promise<Page<Run>>
    tasks(runId: number): Promise<TaskState[]>
    // Every run that runs now, at any age, read page by page up to `RUNNING_PAGES` pages.
    running(): Promise<Run[]>
  }
  jobs: {
    list(): Promise<Job[]>
    get(name: string, env: string): Promise<Job | null>
  }
  workflows: { list(): Promise<Workflow[]> }
  workstations: { list(): Promise<Workstation[]> }
  nodes: { list(): Promise<PlatformNode[]>; prices(): Promise<Record<string, number>> }
  users: { list(): Promise<User[]> }
  groups: { list(): Promise<Group[]> }
  kv: { list(kind: 'variables' | 'secrets'): Promise<KvList> }
  // `begin` and `end` are UTC dates, `YYYY-MM-DD`, and `end` is included. `blobs.get` gives the file as base64.
  cost: { view(begin: string, end: string): Promise<CostRow[]> }
  budgets: { list(): Promise<Budget[]> }
  tags: { get(name: string): Promise<string> }
  blobs: { list(bucketPath: string): Promise<BlobEntry[]>; get(bucket: string, file: string): Promise<string> }
  logs: {
    read(q: { job: string; env: string; runId?: number; stream: 'stdout' | 'stderr'; lines: number }): Promise<string>
    // The build log of the job, whole, as text (`job get` with `build-logs`).
    build(q: { job: string; env: string; stream: 'stdout' | 'stderr' }): Promise<string>
  }
  act(a: ActionRequest, url: string): Promise<void>
}

export const RUNNING_RUNS = { sinceMs: 0, filter: 'state = running', limit: 500 } as const
export const RUNNING_PAGES = 10

const DEFAULT_SORT = '-submitTime'
const DEFAULT_LIMIT = 50
// `dt view get` returns 100 rows unless it is told how many.
export const LIST_LIMIT = 1_000
export const MAX_RUN_ERROR = 4_000

type Row = Record<string, unknown>

const isRow = (value: unknown): value is Row => typeof value === 'object' && value !== null && !Array.isArray(value)

function rowsOf(result: unknown): Row[] {
  return Array.isArray(result) ? result.filter(isRow) : []
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function numberOrNull(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function numberOr0(value: unknown): number {
  return numberOrNull(value) ?? 0
}

const secondsToMs = (value: unknown): number | null => (numberOrNull(value) === null ? null : numberOr0(value) * 1000)

const idsOf = (value: unknown): number[] =>
  Array.isArray(value) ? value.map(numberOrNull).filter((id): id is number => id !== null) : []

function time(value: unknown): number | null {
  if (typeof value !== 'string' || value.trim() === '') return null
  const ms = Date.parse(value)
  return Number.isNaN(ms) ? null : ms
}

const isHighSurrogate = (unit: number) => unit >= 0xd800 && unit <= 0xdbff

function capped(text: string, max: number): string {
  if (text.length <= max) return text
  let end = max - 1
  if (isHighSurrogate(text.charCodeAt(end - 1))) end--
  return `${text.slice(0, end)}…`
}

function firstText(...values: unknown[]): string {
  for (const value of values) {
    const found = text(value)
    if (found !== '') return found
  }
  return ''
}

function toRun(row: Row): Run {
  const originalRunId = numberOrNull(row.originalRunId)
  return {
    id: numberOr0(row.runId),
    job: text(row.jobName),
    display: firstText(row.displayName, row.jobName),
    type: text(row.type),
    env: text(row.environment),
    state: text(row.state),
    version: numberOr0(row.jobVersion),
    runAs: text(row.runAsName),
    submit: time(row.submitTime) ?? 0,
    start: time(row.startTime),
    end: time(row.endTime),
    error: capped(text(row.errorMessage), MAX_RUN_ERROR),
    originalRunId: originalRunId !== null && originalRunId > 0 ? originalRunId : null,
  }
}

function memoryOf(value: unknown): string | null {
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : null
  return typeof value === 'string' && value !== '' ? value : null
}

function toJob(row: Row): Job {
  return {
    name: text(row.name),
    display: firstText(row.display_name, row.name),
    type: text(row.type),
    env: text(row.environment),
    state: text(row.state),
    version: numberOr0(row.version),
    runAs: text(row.run_as),
    built: row.last_build_succeeded !== false,
    cpus: numberOrNull(row.num_cpus),
    memory: memoryOf(row.memory),
  }
}

// A row of the workstation_launcher view: memory in GB, and no build result, so `built` is not known here.
function toWorkstation(row: Row): Workstation {
  const gb = numberOrNull(row.memory)
  return {
    name: text(row.name),
    display: firstText(row.displayName, row.name),
    type: text(row.type),
    env: text(row.environment),
    state: text(row.state),
    version: numberOr0(row.version),
    runAs: text(row.runAsName),
    built: true,
    cpus: numberOrNull(row.numCpus),
    memory: gb === null ? null : String(Math.round(gb * 1024 ** 3)),
    image: {
      python: text(row.pythonVersion),
      requirements: text(row.pythonRequirements),
      preBuild: text(row.buildScriptPre),
      postBuild: text(row.buildScriptPost),
    },
  }
}

function toWorkflow(row: Row): Workflow {
  return {
    name: text(row.name),
    display: firstText(row.displayName, row.name),
    env: text(row.environment),
    state: text(row.state),
    schedule: text(row.schedule),
    runAs: text(row.runAsName),
  }
}

function toTask(row: Row): TaskState {
  return { job: text(row.name), state: text(row.state), start: time(row.startTime), end: time(row.endTime) }
}

function toNodeRun(row: Row): PlatformNode['runs'][number] {
  return {
    job: text(row.name),
    env: text(row.environment),
    state: text(row.state),
    runId: numberOr0(row.run_id),
    cpus: numberOrNull(row.num_cpus),
    memory: numberOrNull(row.memory_limit),
  }
}

function toNode(row: Row): PlatformNode {
  const { cpu, memory, tags } = row
  return {
    name: text(row.name),
    env: text(row.environment),
    type: text(row.type),
    // The platform's `state` column of a node is always 'Unknown'.
    state: firstText(row.status, row.state),
    host: text(row.host),
    privateIp: text(row.private_ip),
    class: text(row.node_class),
    createdAt: secondsToMs(row.created_at),
    tags: isRow(tags) ? Object.fromEntries(Object.entries(tags).map(([name, value]) => [name, text(value)])) : {},
    cpu: isRow(cpu) ? { allocated: numberOr0(cpu.allocated_cpus), total: numberOr0(cpu.total_cpus) } : null,
    memory: isRow(memory) ? { allocated: numberOr0(memory.allocated_memory), max: numberOr0(memory.max_memory) } : null,
    runs: rowsOf(row.jobs).map(toNodeRun),
  }
}

function toBudget(row: Row): Budget {
  const preventOverflow = row.prevent_overflow === true
  const isReadable = row.budget_usd !== undefined
  return { name: text(row.name), budget: numberOr0(row.budget_usd), usage: numberOr0(row.usage_usd), preventOverflow, isReadable }
}

function toUser(row: Row): User {
  return {
    id: numberOr0(row.user_id),
    name: text(row.name),
    fullName: `${text(row.first_name)} ${text(row.last_name)}`.trim(),
    email: text(row.email),
    isSystem: row.is_system === true,
    isDisabled: row.disabled === true,
  }
}

// A secret never keeps a value, even one the server sent by mistake.
function toKvItem(row: Row, isSecret: boolean): KvList['items'][number] {
  const acl = isRow(row.acl) ? row.acl : null
  const ids = (name: string) => idsOf(acl?.[name])
  return {
    key: text(row.key),
    env: firstText(row.env, 'system'),
    value: !isSecret && typeof row.value === 'string' ? row.value : null,
    acl: acl && { read: ids('read'), write: ids('write'), operate: ids('operate'), access: ids('access'), promote: ids('promote') },
  }
}

function toCost(row: Row): CostRow {
  return { date: text(row.date), owner: text(row.owner), type: text(row.job_type), env: text(row.environment), cost: numberOr0(row.cost) }
}

function toBlob(row: Row): BlobEntry {
  const name = text(row.name).replace(/\/{2,}$/, '/')
  return { name, size: numberOr0(row.size), modified: secondsToMs(row.last_modified), isFile: row.is_file === true }
}

export function createEndpoints(api: Api): Endpoints {
  const endpoints: Endpoints = {
    runs: {
      async list(q) {
        const limit = q.limit ?? DEFAULT_LIMIT
        const window = `submitTime >= "${new Date(q.sinceMs).toISOString()}"`
        const extra = q.filter?.trim() ?? ''
        const params: Params = {
          name: 'runs',
          filter: extra === '' ? window : `${window} and ${extra}`,
          sort: q.sort ?? DEFAULT_SORT,
          offset: q.offset ?? 0,
          'batch-size': limit + 1,
        }
        const rows = rowsOf(await api.call<unknown>('view', 'get', params, 'GET'))
        return { rows: rows.slice(0, limit).map(toRun), hasMore: rows.length > limit }
      },
      async running() {
        // A run that starts while the pages are read can move to the next page: each run counts once.
        const byId = new Map<number, Run>()
        for (let page = 0; page < RUNNING_PAGES; page++) {
          const next = await endpoints.runs.list({ ...RUNNING_RUNS, offset: page * RUNNING_RUNS.limit })
          for (const run of next.rows) byId.set(run.id, run)
          if (!next.hasMore) break
        }
        return [...byId.values()]
      },
      async tasks(runId) {
        const params: Params = {
          name: 'workflow_run',
          filter: `runId = ${runId}`,
          sort: '+taskNumber',
          'batch-size': LIST_LIMIT,
        }
        return rowsOf(await api.call<unknown>('view', 'get', params, 'GET')).map(toTask)
      },
    },
    jobs: {
      async list() {
        return rowsOf(await api.call<unknown>('job', 'ls', {}, 'GET'))
          .filter(row => row.deleted !== true)
          .map(toJob)
      },
      async get(name, env) {
        const [row] = rowsOf(await api.call<unknown>('job', 'get', { job_name: name, environment: env }, 'GET'))
        return row === undefined ? null : toJob(row)
      },
    },
    workflows: {
      async list() {
        const params: Params = { name: 'workflows', 'batch-size': LIST_LIMIT }
        return rowsOf(await api.call<unknown>('view', 'get', params, 'GET')).map(toWorkflow)
      },
    },
    workstations: {
      async list() {
        const params: Params = { name: 'workstation_launcher', filter: 'deleted = false', 'batch-size': LIST_LIMIT }
        return rowsOf(await api.call<unknown>('view', 'get', params, 'GET')).map(toWorkstation)
      },
    },
    nodes: {
      async list() {
        return rowsOf(await api.call<unknown>('node', 'ls', {}, 'GET')).map(toNode)
      },
      async prices() {
        const types = rowsOf(await api.call<unknown>('node', 'instance-types', {}, 'GET'))
        return Object.fromEntries(types.map(row => [text(row.name), numberOr0(row.price)]))
      },
    },
    users: {
      async list() {
        return rowsOf(await api.call<unknown>('user', 'ls', {}, 'GET')).map(toUser)
      },
    },
    groups: {
      async list() {
        const rows = rowsOf(await api.call<unknown>('group', 'ls', {}, 'GET'))
        return rows.map(row => ({ id: numberOr0(row.group_id), name: text(row.name), members: idsOf(row.members) }))
      },
    },
    kv: {
      async list(kind) {
        const isSecret = kind === 'secrets'
        const mode = isSecret ? { secure: true } : { 'include-values': true }
        const params: Params = { acls: true, ...mode, environment: 'dev,pre,prod', 'batch-size': LIST_LIMIT }
        const result = await api.call<unknown>('kv', 'ls', params, 'GET')
        const body: Row = isRow(result) ? result : {}
        const items = rowsOf(body.items).map(row => toKvItem(row, isSecret))
        return { items, total: numberOrNull(body.total) ?? items.length }
      },
    },
    cost: {
      async view(begin, end) {
        return rowsOf(await api.call<unknown>('cost', 'view', { begin, end }, 'GET')).map(toCost)
      },
    },
    budgets: {
      async list() {
        return rowsOf(await api.call<unknown>('cost', 'list-budgets', {}, 'GET')).map(toBudget)
      },
    },
    tags: {
      async get(name) {
        return text(await api.call<unknown>('tag', 'get', { tag: name }, 'GET'))
      },
    },
    blobs: {
      async list(bucketPath) {
        const params: Params = { bucket_name: bucketPath, 'batch-size': LIST_LIMIT }
        return rowsOf(await api.call<unknown>('blob', 'ls', params, 'GET')).map(toBlob)
      },
      async get(bucket, file) {
        return text(await api.call<unknown>('blob', 'get', { bucket_name: bucket, file_name: file }, 'GET'))
      },
    },
    logs: {
      async read(q) {
        const params: Params = {
          process_name: q.job,
          environment: q.env,
          ...(q.runId === undefined ? {} : { 'run-id': q.runId }),
          lines: q.lines,
          ...(q.stream === 'stderr' ? { stderr: true } : {}),
        }
        const result = await api.call<unknown>('log', 'read', params, 'GET')
        return typeof result === 'string' ? result : ''
      },
      async build(q) {
        const params: Params = { job_name: q.job, environment: q.env, 'build-logs': q.stream }
        return buildLogText(text(await api.call<unknown>('job', 'get', params, 'GET')))
      },
    },
    async act(a, url) {
      switch (a.verb) {
        case 'start':
          await api.call<unknown>('job', 'start', { job_name: a.job, environment: a.env }, 'POST', url)
          return
        case 'stop':
          await api.call<unknown>('job', 'stop', { job_name: a.job, environment: a.env }, 'DELETE', url)
          return
        case 'rerun':
          if (a.runId === undefined) throw new Error('A rerun needs a run id.')
          await api.call<unknown>('job', 'rerun', { 'run-id': a.runId }, 'POST', url)
          return
        case 'drain':
        case 'undrain':
          await api.call<unknown>('node', 'drain', { node: a.host, ...(a.verb === 'undrain' ? { stop: true } : {}) }, 'GET', url)
          return
        default:
          throw new Error(`Unknown action: ${String((a as { verb: unknown }).verb)}.`)
      }
    },
  }
  return endpoints
}
