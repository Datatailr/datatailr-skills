/*************************************************************************
 *
 *  Copyright (c) 2026 Datatailr Inc.
 *
 *  Licensed under the MIT License. See the 'LICENSE' file distributed
 *  with this package for the full license text.
 *
 *  SPDX-License-Identifier: MIT
 *************************************************************************/

import type { Engine } from './engine'

export type Installation = { name: string; url: string; userName: string | null; hasPassword: boolean; file: string }

// `jwt` is a secret: never print, show or store it.
export type CliSession = { url: string; jwt: string }

const CLI_CONFIG = '~/.dt/remote_client/remote_client.cfg'
const ENV_SUFFIX = '.env'
const KEY = /^[A-Za-z_][A-Za-z0-9_.-]*$/
const URL_PARTS = /^(?:([a-z][a-z0-9+.-]*):\/\/)?(?:[^@/?#]*@)?(\[[^\]]*\]|[^:/?#\s]+)(?::(\d+))?(?:[/?#].*)?$/i

export function parseEnvFile(text: string): Record<string, string> {
  const out: Record<string, string> = {}
  const body = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
  for (const raw of body.split(/\r\n|\n|\r/)) {
    let line = raw.trim()
    if (line === '' || line.startsWith('#')) continue
    line = line.replace(/^export\s+/, '')
    const eq = line.indexOf('=')
    if (eq < 0) continue
    const key = line.slice(0, eq).trim()
    if (!KEY.test(key)) continue
    out[key] = parseEnvValue(line.slice(eq + 1))
  }
  return out
}

function parseEnvValue(rest: string): string {
  const value = rest.trimStart()
  const quote = value[0]
  if (quote === '"' || quote === "'") {
    const close = value.indexOf(quote, 1)
    if (close > 0) return value.slice(1, close)
  }
  const comment = rest.search(/\s#/)
  return (comment < 0 ? rest : rest.slice(0, comment)).trim()
}

export function normalizeUrl(input: string): string {
  const parts = URL_PARTS.exec(input.trim())
  const scheme = (parts?.[1] ?? 'https').toLowerCase()
  const host = parts?.[2]?.toLowerCase()
  if (!parts || !host || host === '[]' || (scheme !== 'http' && scheme !== 'https')) {
    throw new Error('Not a valid http(s) address')
  }
  const port = parts[3]
  const isDefaultPort = port === undefined || port === (scheme === 'https' ? '443' : '80')
  return `${scheme}://${host}${isDefaultPort ? '' : `:${port}`}`
}

export function installationName(url: string): string {
  const host = normalizeUrl(url).replace(/^https?:\/\//, '')
  return host.replace(/[^A-Za-z0-9._-]/g, '_')
}

// Windows has no `HOME` as a rule: its home folder is `USERPROFILE`.
export async function resolveHome($: Engine, path: string): Promise<string> {
  if (path !== '~' && !path.startsWith('~/')) return path
  const home = (await $.env.get('HOME')) || (await $.env.get('USERPROFILE'))
  if (!home) throw new Error('HOME is not set')
  return home.replace(/[\\/]+$/, '') + path.slice(1)
}

export async function listInstallations($: Engine, dir: string): Promise<Installation[]> {
  const entries = await $.fs.list(dir).catch(() => [])
  const base = dir.replace(/\/+$/, '')
  const found: Installation[] = []
  for (const entry of entries) {
    const isFile = entry.kind === 'file' || (entry.kind === 'other' && entry.isLink)
    if (!isFile || !entry.name.endsWith(ENV_SUFFIX) || entry.name === ENV_SUFFIX) continue
    const file = `${base}/${entry.name}`
    try {
      const env = parseEnvFile(await $.fs.read(file))
      found.push({
        name: entry.name.slice(0, -ENV_SUFFIX.length),
        url: normalizeUrl(env.DATATAILR_BASE_URL ?? ''),
        userName: env.DATATAILR_USER_NAME || null,
        hasPassword: (env.DATATAILR_USER_PASSWORD ?? '') !== '',
        file,
      })
    } catch {
      continue
    }
  }
  return found.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
}

// Holds the password. For the login step only: never show, store or log it.
export async function readInstallationEnv($: Engine, inst: Installation): Promise<Record<string, string>> {
  return parseEnvFile(await $.fs.read(inst.file))
}

export class InstallationExistsError extends Error {
  readonly installation: string
  readonly file: string
  /** The address in the file, or null when the file cannot be read or holds no valid one. */
  readonly url: string | null

  constructor(installation: string, file: string, url: string | null) {
    super(`Installation ${installation} already exists`)
    this.name = 'InstallationExistsError'
    this.installation = installation
    this.file = file
    this.url = url
  }
}

// Never overwrites: an existing env file can hold hand-written settings. The name comes from the host
// alone, so the file may name another address (`http://` where `https://` was typed): the error says which.
export async function writeInstallation($: Engine, dir: string, url: string): Promise<Installation> {
  const normalized = normalizeUrl(url)
  const name = installationName(normalized)
  const file = `${dir.replace(/\/+$/, '')}/${name}${ENV_SUFFIX}`
  if (await $.fs.exists(file)) throw new InstallationExistsError(name, file, await urlInFile($, file))
  await $.fs.write(file, `DATATAILR_BASE_URL=${normalized}\n`)
  return { name, url: normalized, userName: null, hasPassword: false, file }
}

async function urlInFile($: Engine, file: string): Promise<string | null> {
  try {
    return normalizeUrl(parseEnvFile(await $.fs.read(file)).DATATAILR_BASE_URL ?? '')
  } catch {
    return null
  }
}

// Each login writes the CLI configuration file, so a newer time means a new session.
export async function cliConfigModifiedAt($: Engine): Promise<number | null> {
  try {
    return (await $.fs.stat(await resolveHome($, CLI_CONFIG))).mtimeMs
  } catch {
    return null
  }
}

export async function readCliSession($: Engine): Promise<CliSession | null> {
  try {
    const config: unknown = JSON.parse(await $.fs.read(await resolveHome($, CLI_CONFIG)))
    if (typeof config !== 'object' || config === null) return null
    const { base_url: baseUrl, jwt_cookie: jwt } = config as Record<string, unknown>
    if (typeof baseUrl !== 'string' || typeof jwt !== 'string' || baseUrl === '' || jwt === '') return null
    return { url: normalizeUrl(baseUrl), jwt }
  } catch {
    return null
  }
}
