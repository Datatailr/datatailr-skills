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

import { normalizeUrl, resolveHome } from './installations'

export type LoginFailure = {
  ok: false
  reason: 'mfa' | 'bad-credentials' | 'expired-code' | 'cannot-run' | 'invalid-url' | 'cancelled' | 'cli-error'
  message: string
}
export type LoginOutcome = { ok: true } | LoginFailure

// How a password login ends when the installation wants MFA. Taken from the CLI source
// (`_remote_client/utils.py`), not yet seen live.
export const MFA_MARKER = 'Not authenticated or session expired'

const CLI_NAME = 'datatailr'
const MARKER_LINE = 'Open this URL in your browser to log in:'
const PASSWORD_LOGIN_TIMEOUT_MS = 60_000
const MAX_MESSAGE = 300

const BAD_CREDENTIALS = 'invalid username or password'
// The CLI's two texts, and the server's code `expired_token`, which the CLI does not print today.
const EXPIRED_CODE = /device authorization[^\n]*(?:expired|timed out)|expired_token/

const cannotRun = (): LoginFailure => ({
  ok: false,
  reason: 'cannot-run',
  message: 'Could not run the datatailr CLI: it did not start or it took too long.',
})
const cancelled = (): LoginFailure => ({ ok: false, reason: 'cancelled', message: 'The login was cancelled.' })
const NO_OUTPUT = 'The datatailr CLI failed without a message.'
const TRACEBACK = 'Traceback (most recent call last):'
const ESCAPE = /\u001b\[[0-?]*[ -/]*[@-~]/g
const CONTROLS = /[\u0000-\u001f\u007f]+/g
const STEP_LINES = [MARKER_LINE, 'Waiting for authorization...']

export async function findCli($: EngineInterface, cliPath: string): Promise<string | null> {
  const named = cliPath.trim()
  if (named !== '') {
    try {
      const path = await resolveHome($, named)
      return (await $.fs.exists(path)) ? path : null
    } catch {
      return null
    }
  }
  for (const folder of ((await $.env.get('PATH')) ?? '').split(':')) {
    if (folder === '') continue
    const path = `${folder.replace(/\/+$/, '')}/${CLI_NAME}`
    if (await $.fs.exists(path)) return path
  }
  return null
}

// The credentials go to the child through its environment only, never through `argv`.
export async function loginWithPassword(
  $: EngineInterface,
  cli: string,
  url: string,
  user: string,
  password: string,
): Promise<LoginOutcome> {
  const target = checkedUrl(url)
  if (typeof target !== 'string') return target
  try {
    const run = await $.process.run([cli, 'login'], {
      env: { DATATAILR_BASE_URL: target, DATATAILR_USER_NAME: user, DATATAILR_USER_PASSWORD: password },
      timeoutMs: PASSWORD_LOGIN_TIMEOUT_MS,
    })
    return run.exitCode === 0 ? { ok: true } : classifyLoginFailure(joinOutput(run.stdout, run.stderr))
  } catch {
    // The error text may name the environment of the child, so none of it is kept.
    return cannotRun()
  }
}

type SpawnStream = ReturnType<EngineInterface['process']['spawn']>

const ABORTED = Symbol('aborted')

function whenAborted(signal: AbortSignal | undefined): Promise<typeof ABORTED> {
  return new Promise(resolve => signal?.addEventListener('abort', () => resolve(ABORTED), { once: true }))
}

// `return()` on the stream kills the CLI. Not awaited: a read that waits on the CLI is still pending.
function leave(stream: SpawnStream): void {
  stream.result.catch(() => undefined)
  try {
    stream.return(undefined as never).catch(() => undefined)
  } catch {
  }
}

// The CLI prints nothing while the user has not approved, so a read races the abort signal.
export async function loginWithDevice(
  $: EngineInterface,
  cli: string,
  url: string,
  onLink: (link: string) => void,
  signal?: AbortSignal,
): Promise<LoginOutcome> {
  const target = checkedUrl(url)
  if (typeof target !== 'string') return target
  if (signal?.aborted) return cancelled()
  const aborted = whenAborted(signal)
  let stdout = ''
  let stderr = ''
  let linked = false
  let stream: SpawnStream | null = null
  try {
    // The variable wins over `--url` in the CLI, so both carry the same address.
    stream = $.process.spawn({
      argv: [cli, 'login', '--device', '--url', target],
      env: { DATATAILR_BASE_URL: target },
    })
    for (;;) {
      if (signal?.aborted) {
        leave(stream)
        return cancelled()
      }
      const step = await Promise.race([stream.next(), aborted])
      if (step === ABORTED) {
        leave(stream)
        return cancelled()
      }
      if (step.done === true) break
      const chunk = step.value
      if (chunk.stream === 'stdout') stdout += chunk.text
      else stderr += chunk.text
      if (linked) continue
      // A chunk may end inside the link: only whole lines count.
      const link = parseDeviceLink(stdout.slice(0, stdout.lastIndexOf('\n') + 1))
      if (link === null) continue
      linked = true
      try {
        onLink(link)
      } catch (error) {
        throw new CallbackError(error)
      }
    }
    const { code } = await stream.result
    return code === 0 ? { ok: true } : classifyLoginFailure(joinOutput(stdout, stderr))
  } catch (error) {
    if (stream !== null) leave(stream)
    if (error instanceof CallbackError) throw error.error
    return cannotRun()
  }
}

export function parseDeviceLink(output: string): string | null {
  const lines = output.split(/\r\n|\n|\r/).map(line => line.trim())
  const marker = lines.indexOf(MARKER_LINE)
  if (marker < 0) return null
  const link = lines.slice(marker + 1).find(line => line !== '')
  return link !== undefined && /^https?:\/\//.test(link) ? link : null
}

// The password cannot reach the message: the CLI never prints it.
export function classifyLoginFailure(output: string): LoginFailure {
  const text = output.toLowerCase()
  const message = meaningfulLine(output)
  let reason: LoginFailure['reason'] = 'cli-error'
  if (text.includes(BAD_CREDENTIALS)) reason = 'bad-credentials'
  else if (EXPIRED_CODE.test(text)) reason = 'expired-code'
  else if (text.includes(MFA_MARKER.toLowerCase())) reason = 'mfa'
  return { ok: false, reason, message }
}

class CallbackError {
  readonly error: unknown

  constructor(error: unknown) {
    this.error = error
  }
}

function checkedUrl(url: string): string | LoginFailure {
  try {
    return normalizeUrl(url)
  } catch {
    return { ok: false, reason: 'invalid-url', message: 'Not a valid http(s) address' }
  }
}

function joinOutput(stdout: string, stderr: string): string {
  return `${stdout}\n${stderr}`
}

function clean(line: string): string {
  return line.replace(CONTROLS, ' ').trim()
}

function meaningfulLine(output: string): string {
  const lines = output.split(/\r\n|\n|\r/).map(line => line.replace(ESCAPE, ''))
  const isMeaningful = (line: string) => {
    const text = clean(line)
    return text !== '' && !/^[ \t]/.test(line) && !STEP_LINES.includes(text) && !/^https?:\/\//.test(text)
  }
  const kept = lines.filter(isMeaningful).filter(line => clean(line) !== TRACEBACK)
  const line = lines.some(line => clean(line) === TRACEBACK) ? kept.at(-1) : kept[0]
  return (line === undefined ? NO_OUTPUT : clean(line)).slice(0, MAX_MESSAGE)
}
