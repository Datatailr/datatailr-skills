/*************************************************************************
 *
 *  Copyright (c) 2026 Datatailr Inc.
 *
 *  Licensed under the MIT License. See the 'LICENSE' file distributed
 *  with this package for the full license text.
 *
 *  SPDX-License-Identifier: MIT
 *************************************************************************/

import type { PluginOptions } from 'claude-code'

import type { Engine } from './engine'

import {
  type Installation,
  InstallationExistsError,
  cliConfigModifiedAt,
  installationName,
  listInstallations,
  normalizeUrl,
  readCliSession,
  readInstallationEnv,
  resolveHome,
  writeInstallation,
} from './installations'
import { type LoginFailure, type LoginOutcome, findCli, loginWithDevice, loginWithPassword } from './login'
import { readCliMissing, readSession, updateSession, writeCliMissing, writeSession } from './state'

export type SessionState =
  | { kind: 'no-cli' }
  | { kind: 'disconnected' }
  | { kind: 'logging-in'; installation: string; method: 'password' | 'device'; link?: string; note?: string }
  | { kind: 'connected'; installation: string; url: string }
  | { kind: 'expired'; installation: string; url: string; since: number }
  | { kind: 'error'; installation: string | null; message: string }

type LoggingIn = Extract<SessionState, { kind: 'logging-in' }>
type Dashboard = Extract<SessionState, { kind: 'connected' | 'expired' }>

const DEFAULT_INSTALLATIONS_DIR = '~/.datatailr/installations'
const MFA_NOTE = 'Password login needs MFA on this installation. Approve the login in your browser.'
// MFA can also end in other texts ("Could not connect to Datatailr"), so all others fall back to the device login.
const NO_FALLBACK: ReadonlySet<LoginFailure['reason']> = new Set(['cannot-run', 'invalid-url', 'bad-credentials'])
const EXPIRED_CODE_MESSAGE = 'The browser login expired. Try again.'
const STOPPED_MESSAGE = 'The login stopped before it ended. Try again.'

type RunningLogin = {
  name: string
  controller: AbortController
  before: SessionState | null
  started: Promise<SessionState>
  ended: Promise<void>
}

let running: RunningLogin | null = null

export async function syncSession($: Engine, options: PluginOptions): Promise<SessionState> {
  const current = await readSession($)
  if (isHeld(current)) return current
  const found = await observeSession($, options)
  // Only the time of the file is read, never its token.
  const writtenAt = current.kind === 'expired' ? await cliConfigModifiedAt($) : null
  if (isStillExpired(current, found, writtenAt)) return current
  return updateSession($, latest => (isHeld(latest) || isStillExpired(latest, found, writtenAt) ? latest : found))
}

export async function switchTo($: Engine, options: PluginOptions, name: string): Promise<SessionState> {
  let before: SessionState | null = null
  for (let other = running; other !== null; other = running) {
    if (other.name === name && !other.controller.signal.aborted) return other.started
    before = other.before
    other.controller.abort()
    await other.ended
  }

  // No await between the check above and this claim, or two logins could run at once.
  const started = deferred<SessionState>()
  const ended = deferred<void>()
  const login: RunningLogin = {
    name,
    controller: new AbortController(),
    before,
    started: started.promise,
    ended: ended.promise,
  }
  running = login
  let result: SessionState | null = null
  try {
    const before = (login.before ??= await readSession($))
    result = await runLogin($, options, name, before, login.controller.signal, started.resolve)
    return result
  } finally {
    // A write that the host refused must not leave the pane logging in.
    if (result === null && !login.controller.signal.aborted) {
      result = await setSession($, { kind: 'error', installation: name, message: STOPPED_MESSAGE }).catch(() => null)
    }
    if (running === login) running = null
    started.resolve(result ?? { kind: 'error', installation: name, message: STOPPED_MESSAGE })
    ended.resolve()
  }
}

export async function cancelLogin($: Engine, options: PluginOptions): Promise<SessionState> {
  const login = running
  let next: SessionState
  if (login === null) {
    const current = await readSession($)
    if (current.kind !== 'logging-in') return current
    next = await observeSession($, options)
  } else {
    login.controller.abort()
    await login.ended
    if (running !== null) return readSession($)
    const before = login.before
    const cli = await readCliSession($)
    const isKept = (before?.kind === 'connected' || before?.kind === 'expired') && cli?.url === before.url
    next = isKept && before !== null ? before : await observeSession($, options)
  }
  // A switch can start while the reads above wait on the host.
  if (running !== null) return readSession($)
  return setSession($, next)
}

async function runLogin(
  $: Engine,
  options: PluginOptions,
  name: string,
  before: SessionState,
  signal: AbortSignal,
  report: (state: SessionState) => void,
): Promise<SessionState> {
  const ended = async (state: SessionState) => {
    const written = await setSession($, state)
    report(written)
    return written
  }
  const installation = (await listAll($, options)).find(candidate => candidate.name === name)
  if (signal.aborted) return readSession($)
  if (installation === undefined) {
    return ended({ kind: 'error', installation: name, message: `Unknown installation ${name}.` })
  }
  const cli = await cliForLogin($, options)
  if (signal.aborted) return readSession($)
  if (cli === null) {
    // A dashboard stays, and the pane says how to install the CLI where the login was offered. A login
    // that this one replaced leaves its state behind: the state before it comes back.
    if (!isDashboard(before)) return ended({ kind: 'no-cli' })
    const kept = await updateSession($, current => (current.kind === 'logging-in' ? before : current))
    report(kept)
    return kept
  }

  const method = installation.userName !== null && installation.hasPassword ? 'password' : 'device'
  const first: LoggingIn = { kind: 'logging-in', installation: installation.name, method }
  report(await setSession($, first))

  const cliBefore = await readCliSession($)

  let outcome: LoginOutcome
  if (method === 'password') {
    outcome = await passwordLogin($, cli, installation)
    if (!outcome.ok && !NO_FALLBACK.has(outcome.reason) && !signal.aborted) {
      const fallback: LoggingIn = {
        kind: 'logging-in',
        installation: installation.name,
        method: 'device',
        note: MFA_NOTE,
      }
      await setSession($, fallback)
      outcome = await deviceLogin($, cli, installation, fallback, signal)
    }
  } else {
    outcome = await deviceLogin($, cli, installation, first, signal)
  }
  if (signal.aborted) return readSession($)

  // The CLI can fail after it saved the session (while it sets up its `dt` shim), so a failed login
  // still counts when the CLI holds a new session for this installation.
  const cliAfter = await readCliSession($)
  const isForInstallation = cliAfter !== null && cliAfter.url === installation.url
  if (isForInstallation && (outcome.ok || cliAfter.jwt !== cliBefore?.jwt)) {
    return setSession($, { kind: 'connected', installation: installation.name, url: installation.url })
  }
  return setSession($, {
    kind: 'error',
    installation: installation.name,
    message: failureMessage(outcome, installation),
  })
}

export async function addInstallation($: Engine, options: PluginOptions, url: string): Promise<SessionState> {
  const refuse = (message: string) => (running !== null ? readSession($) : fail($, message))
  let normalized: string
  try {
    normalized = normalizeUrl(url)
  } catch (error) {
    return refuse(error instanceof Error ? error.message : 'Not a valid http(s) address')
  }
  let dir: string
  try {
    dir = await installationsDir($, options)
  } catch {
    return refuse('Could not find the installations folder: HOME is not set.')
  }
  let name: string
  try {
    name = (await writeInstallation($, dir, url)).name
  } catch (error) {
    if (!(error instanceof InstallationExistsError)) return refuse(`Could not save the installation file in ${dir}.`)
    // The file of that name is reused only for the address it names: a login to another one would surprise.
    if (error.url === null) {
      return refuse(`Installation ${error.installation} already exists, and ${error.file} has no valid address. Edit the file.`)
    }
    if (error.url !== normalized) {
      return refuse(`Installation ${error.installation} already exists for ${error.url}. Edit ${error.file}, or add that address instead.`)
    }
    name = error.installation
  }
  return switchTo($, options, name)
}

export async function installationsFor($: Engine, options: PluginOptions): Promise<Installation[]> {
  return listAll($, options)
}

export async function markExpired($: Engine): Promise<void> {
  if ((await readSession($)).kind !== 'connected') return
  const since = await $.clock.now()
  await updateSession($, (current): SessionState => {
    return current.kind === 'connected'
      ? { kind: 'expired', installation: current.installation, url: current.url, since }
      : current
  })
}

// The password lives only in these locals. A read error is not shown: its text can hold the file content.
async function passwordLogin($: Engine, cli: string, installation: Installation): Promise<LoginOutcome> {
  let user = ''
  let password = ''
  try {
    const env = await readInstallationEnv($, installation)
    user = env.DATATAILR_USER_NAME ?? ''
    password = env.DATATAILR_USER_PASSWORD ?? ''
  } catch {
  }
  if (user === '' || password === '') {
    return {
      ok: false,
      reason: 'cannot-run',
      message: `Could not read the user name and password from ${installation.file}.`,
    }
  }
  return loginWithPassword($, cli, installation.url, user, password)
}

async function deviceLogin(
  $: Engine,
  cli: string,
  installation: Installation,
  shown: LoggingIn,
  signal: AbortSignal,
): Promise<LoginOutcome> {
  let linkWritten: Promise<unknown> = Promise.resolve()
  const outcome = await loginWithDevice(
    $,
    cli,
    installation.url,
    link => {
      linkWritten = setSession($, { ...shown, link }).catch(() => undefined)
    },
    signal,
  )
  await linkWritten
  return outcome
}

function failureMessage(outcome: LoginOutcome, installation: Installation): string {
  if (outcome.ok) return `The login finished, but the datatailr CLI did not keep a session for ${installation.url}.`
  switch (outcome.reason) {
    case 'bad-credentials':
      return `The user name or password in ${installation.file} is not correct.`
    case 'expired-code':
      return EXPIRED_CODE_MESSAGE
    default:
      return outcome.message
  }
}

export function installationsFolder(options: PluginOptions): string {
  return installationsDirOption(options)
}

function installationsDirOption(options: PluginOptions): string {
  const value = options.installationsDir
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : DEFAULT_INSTALLATIONS_DIR
}

function cliPathOption(options: PluginOptions): string {
  const value = options.cliPath
  return typeof value === 'string' ? value : ''
}

/** Whether a login can run: only a login needs the CLI. A pane without one reads the platform all the same. */
export async function hasCli($: Engine, options: PluginOptions): Promise<boolean> {
  return (await findCli($, cliPathOption(options))) !== null
}

// `cliMissing` tells the pane to say how to install the CLI where the login was offered, until a login finds one.
async function cliForLogin($: Engine, options: PluginOptions): Promise<string | null> {
  const cli = await findCli($, cliPathOption(options))
  const isMissing = cli === null
  if ((await readCliMissing($)) !== isMissing) await writeCliMissing($, isMissing)
  return cli
}

async function installationsDir($: Engine, options: PluginOptions): Promise<string> {
  return resolveHome($, installationsDirOption(options))
}

async function listAll($: Engine, options: PluginOptions): Promise<Installation[]> {
  try {
    return await listInstallations($, await installationsDir($, options))
  } catch {
    return []
  }
}

// The session of the CLI file is all a pane needs: the data comes over HTTP. The CLI itself is for the logins.
async function observeSession($: Engine, options: PluginOptions): Promise<SessionState> {
  const session = await readCliSession($)
  if (session === null) return (await hasCli($, options)) ? { kind: 'disconnected' } : { kind: 'no-cli' }
  const match = (await listAll($, options)).find(installation => installation.url === session.url)
  return { kind: 'connected', installation: match?.name ?? installationName(session.url), url: session.url }
}

function isDashboard(state: SessionState): state is Dashboard {
  return state.kind === 'connected' || state.kind === 'expired'
}

// A sync keeps these: a browser login must keep its link on screen, and the user leaves an error by acting.
function isHeld(state: SessionState): boolean {
  return state.kind === 'logging-in' || state.kind === 'error'
}

function isStillExpired(state: SessionState, found: SessionState, writtenAt: number | null): boolean {
  if (state.kind !== 'expired') return false
  const isSameSession = found.kind === 'connected' && found.url === state.url
  const isWrittenAgain = writtenAt !== null && writtenAt > state.since
  return isSameSession && !isWrittenAgain
}

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(settle => {
    resolve = settle
  })
  return { promise, resolve }
}

async function setSession($: Engine, state: SessionState): Promise<SessionState> {
  return writeSession($, state)
}

function fail($: Engine, message: string): Promise<SessionState> {
  return setSession($, { kind: 'error', installation: null, message })
}
