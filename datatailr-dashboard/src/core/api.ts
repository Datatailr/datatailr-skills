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

import type { CliSession } from './installations'
import { after } from './timers'

export type ErrorKind = 'logged-out' | 'no-access' | 'not-available' | 'network' | 'server'

// `message` is safe to show: it never holds the cookie, the token or a body that is not a platform error.
export class ApiError extends Error {
  readonly kind: ErrorKind
  readonly status: number | null

  constructor(kind: ErrorKind, status: number | null, message: string) {
    super(message)
    this.name = 'ApiError'
    this.kind = kind
    this.status = status
  }
}

export type Method = 'GET' | 'POST' | 'PUT' | 'DELETE'
export type Params = Record<string, string | number | boolean | undefined>

export interface Api {
  call<T>(command: string, sub: string, params?: Params, method?: Method, url?: string): Promise<T>
}

const COOKIE_NAME = 'X-Datatailr-Oidc-Data'
const MAX_MESSAGE = 300
const PERMISSION_ERROR = /permission denied|not authorized|access denied/i

const FIXED_MESSAGE: Record<ErrorKind, string> = {
  'logged-out': 'You are logged out of this Datatailr installation.',
  'no-access': 'You do not have access to this.',
  'not-available': 'This Datatailr server does not have this feature.',
  network: 'Could not reach the Datatailr server.',
  server: 'The Datatailr server reported an error.',
}

const OTHER_INSTALLATION = 'The datatailr CLI now points at another installation.'

const REQUEST_TIMEOUT_MS = 30_000
const TIMED_OUT = 'The Datatailr server did not answer within 30 seconds.'

type Interpreted = { kind: ErrorKind | null; message: string; result: unknown }

// The host follows redirects, so the 3xx checks are a guard only: a missing or expired cookie ends
// at the HTML login page with a 2xx status (logged-out). The platform answers an error as JSON
// `{ error }`, mostly with HTTP 400. Another body with a non-2xx status (a proxy's 429) is server.
function interpret(status: number, headers: Record<string, string>, text: string): Interpreted {
  const done = (kind: ErrorKind, message = FIXED_MESSAGE[kind]): Interpreted => ({ kind, message, result: undefined })
  if (status === 401) return done('logged-out')
  if (status >= 300 && status < 400) {
    const location = headers.location ?? ''
    if (location.includes('/handle_403')) return done('no-access')
    if (location.includes('/login')) return done('logged-out')
  }
  if (status === 403) return done('no-access')
  if (status === 404) return done('not-available')

  const body = parseAnswer(text)
  const error = body ? errorText(body) : ''
  if (status >= 500) return done('server', error === '' ? undefined : cleanMessage(error))
  const isOk = status >= 200 && status < 300
  if (!body) return done(isOk ? 'logged-out' : 'server')
  // On a 2xx, an error beside a result is a warning, such as `kv ls` on an environment the user may not read.
  if (isOk && (error === '' || !isEmpty(body.result))) return { kind: null, message: '', result: body.result }
  if (error !== '') return done(PERMISSION_ERROR.test(error) ? 'no-access' : 'server', cleanMessage(error))
  return done('server')
}

const isEmpty = (result: unknown) => result == null || result === '' || (typeof result === 'object' && Object.keys(result).length === 0)

function parseAnswer(text: string): Record<string, unknown> | null {
  let body: unknown
  try {
    body = JSON.parse(text)
  } catch {
    return null
  }
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return null
  return 'error' in body || 'result' in body ? (body as Record<string, unknown>) : null
}

function errorText(body: Record<string, unknown>): string {
  const error = body.error
  if (error === undefined || error === null) return ''
  return (typeof error === 'string' ? error : JSON.stringify(error)).trim()
}

function cleanMessage(error: string): string {
  const text = error
    .replace(/^ERROR:\s*/, '')
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
    .trim()
    .slice(0, MAX_MESSAGE)
    .trim()
  return text === '' ? FIXED_MESSAGE.server : text
}

export function classifyResponse(status: number, headers: Record<string, string>, text: string): ErrorKind | null {
  return interpret(status, headers, text).kind
}

function deadline($: EngineInterface): { expired: Promise<never>; cancel(): void } {
  let expire!: (error: ApiError) => void
  const expired = new Promise<never>((_resolve, reject) => {
    expire = reject
  })
  const timer = after($, REQUEST_TIMEOUT_MS, () => expire(new ApiError('network', null, TIMED_OUT)))

  return { expired, cancel: () => timer.cancel() }
}

function query(params: Params | undefined): string {
  const parts: string[] = []
  for (const [name, value] of Object.entries(params ?? {})) {
    if (value === undefined) continue
    parts.push(`${encodeURIComponent(name)}=${encodeURIComponent(String(value))}`)
  }
  return parts.length === 0 ? '' : `?${parts.join('&')}`
}

// A login in a terminal can move the CLI to another installation up to 30 s before the pane follows.
// Meanwhile a call is refused unsent, as a network error, so the session does not end.
export function createApi(
  $: EngineInterface,
  session: () => Promise<CliSession | null>,
  shown: () => Promise<string>,
): Api {
  return {
    async call<T>(command: string, sub: string, params?: Params, method: Method = 'GET', target?: string): Promise<T> {
      const current = await session()
      if (!current) throw new ApiError('logged-out', null, FIXED_MESSAGE['logged-out'])
      const expected = target ?? (await shown())
      if (current.url !== expected) throw new ApiError('network', null, OTHER_INSTALLATION)

      let url = `${current.url}/api/${command}/${sub}`
      const headers: Record<string, string> = { Cookie: `${COOKIE_NAME}=${current.jwt}`, Accept: 'application/json' }
      let body: string | undefined
      if (method === 'GET') {
        url += query(params)
      } else {
        headers['Content-Type'] = 'application/json'
        body = JSON.stringify(params ?? {})
      }

      let response: Awaited<ReturnType<EngineInterface['http']['fetch']>>
      // `$.http.fetch` takes no signal: a timer of the core ends the wait, and a late answer is dropped.
      const timeout = deadline($)
      try {
        const request = $.http.fetch(url, body === undefined ? { method, headers } : { method, headers, body })
        response = await Promise.race([request, timeout.expired])
      } catch (error) {
        if (error instanceof ApiError) throw error
        // The error text is dropped on purpose: it can name the request, which holds the cookie.
        throw new ApiError('network', null, FIXED_MESSAGE.network)
      } finally {
        timeout.cancel()
      }

      const answer = interpret(response.status, response.headers, response.text)
      if (answer.kind) throw new ApiError(answer.kind, response.status, answer.message)
      return answer.result as T
    },
  }
}
