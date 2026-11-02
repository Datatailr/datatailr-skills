/*************************************************************************
 *
 *  Copyright (c) 2026 Datatailr Inc.
 *
 *  Licensed under the MIT License. See the 'LICENSE' file distributed
 *  with this package for the full license text.
 *
 *  SPDX-License-Identifier: MIT
 *************************************************************************/

import type { EngineInterface } from 'claude-code'

import { ApiError } from './api'
import type { Endpoints } from './endpoints'
import { isPaneShown } from './panes'
import type { SessionState } from './session'
import { type LogState, readLog, readSession, updateLog, writeLog } from './state'

export type LogRequest = { job: string; env: string; runId?: number }

export type LogQuery = LogRequest & { stream: 'stdout' | 'stderr'; lines: number; follow: boolean }

export const LOG_LINES = 200
export const FOLLOW_MS = 5_000

const UNREADABLE = 'The log could not be read.'

// Two installations can have the same job and run id, so the key starts with the installation.
export function logKey(url: string, request: LogRequest): string {
  return `${url} ${request.job}:${request.env}:${request.runId ?? 'latest'}`
}

export function sessionUrl(session: SessionState): string {
  return session.kind === 'connected' || session.kind === 'expired' ? session.url : ''
}

export type LogReader = {
  open(q: LogQuery): Promise<void>
  ensure(request: LogRequest): Promise<void>
  stream(stream: 'stdout' | 'stderr'): Promise<void>
  more(): Promise<void>
  follow(on: boolean): Promise<void>
  close(): Promise<void>
  cancel(): void
}

export function createLogReader($: EngineInterface, endpoints: Endpoints): LogReader {
  let timer: { cancel(): void } | null = null
  let isTicking = false
  let latest = 0
  // A log in `$.state` that this reader does not own survived a hot reload, which dropped its timer and read.
  let ownKey: string | null = null

  function stopFollow(): void {
    timer?.cancel()
    timer = null
  }

  function startFollow(): void {
    if (timer === null) timer = $.clock.every(FOLLOW_MS, tick)
  }

  async function tick(): Promise<void> {
    if (isTicking) return
    isTicking = true
    try {
      const log = await readLog($)
      const session = await readSession($)
      if (log === null || !log.follow || (session.kind === 'connected' && log.key !== logKey(session.url, log))) {
        stopFollow()
        return
      }
      if (!(await isPaneShown($)) || session.kind !== 'connected') return
      await read(log)
    } catch {
    } finally {
      isTicking = false
    }
  }

  async function read(log: NonNullable<LogState>): Promise<void> {
    const mine = ++latest
    let text: string | null = null
    let error = UNREADABLE
    try {
      text = await endpoints.logs.read({
        job: log.job,
        env: log.env,
        ...(log.runId === undefined ? {} : { runId: log.runId }),
        stream: log.stream,
        lines: log.lines,
      })
    } catch (failure) {
      // Only an `ApiError` message is safe to show: it never holds the cookie.
      if (failure instanceof ApiError && failure.message !== '') error = `${UNREADABLE} ${failure.message}`
    }
    if (mine !== latest) return
    await updateLog($, current => {
      if (current === null || current.key !== log.key || current.stream !== log.stream || current.lines !== log.lines) {
        return current
      }
      const { error: _before, ...rest } = current
      return text === null ? { ...rest, isLoading: false, error } : { ...rest, text, isLoading: false }
    })
  }

  async function keyOf(request: LogRequest): Promise<string> {
    return logKey(sessionUrl(await readSession($)), request)
  }

  async function change(next: (log: NonNullable<LogState>) => NonNullable<LogState>): Promise<NonNullable<LogState> | null> {
    if ((await readLog($)) === null) return null
    const log = await updateLog($, current => (current === null ? null : next(current)))
    return log
  }

  const reader: LogReader = {
    async open(q) {
      try {
        stopFollow()
        const key = await keyOf(q)
        const log: NonNullable<LogState> = {
          key,
          job: q.job,
          env: q.env,
          ...(q.runId === undefined ? {} : { runId: q.runId }),
          stream: q.stream,
          lines: q.lines,
          follow: q.follow,
          text: '',
          isLoading: true,
        }
        ownKey = key
        latest++
        await writeLog($, log)
        if (q.follow) startFollow()
        await read(log)
      } catch {
      }
    },

    async ensure(request) {
      try {
        const key = await keyOf(request)
        const current = await readLog($)
        if (current === null || current.key !== key) {
          await reader.open({ ...request, stream: 'stdout', lines: LOG_LINES, follow: false })
          return
        }
        if (ownKey !== key) {
          ownKey = key
          if (current.follow) startFollow()
          if (current.isLoading) {
            await read(current)
            return
          }
        }
        if (current.error !== undefined) await read(current)
      } catch {
      }
    },

    async stream(stream) {
      try {
        const log = await change(current => {
          if (current.stream === stream) return current
          const { error: _other, ...rest } = current
          return { ...rest, stream, text: '', isLoading: true }
        })
        if (log !== null) await read(log)
      } catch {
      }
    },

    async more() {
      try {
        const log = await change(current => ({ ...current, lines: current.lines + LOG_LINES }))
        if (log !== null) await read(log)
      } catch {
      }
    },

    async follow(on) {
      try {
        const log = await change(current => ({ ...current, follow: on }))
        if (log === null) return
        if (!on) {
          stopFollow()
          return
        }
        startFollow()
        await read(log)
      } catch {
      }
    },

    async close() {
      stopFollow()
      ownKey = null
      latest++
      try {
        if ((await readLog($)) !== null) await writeLog($, null)
      } catch {
      }
    },

    cancel() {
      stopFollow()
    },
  }

  return reader
}
