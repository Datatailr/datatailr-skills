/*************************************************************************
 *
 *  Copyright (c) 2026 Datatailr Inc.
 *
 *  Licensed under the MIT License. See the 'LICENSE' file distributed
 *  with this package for the full license text.
 *
 *  SPDX-License-Identifier: MIT
 *************************************************************************/

import { cut, stripAnsi } from '../ui/text'

export { cut } from '../ui/text'

export const SCRUB_LIMIT = 8_000
export const LOG_LINE_LIMIT = 2_000

// Every smaller cut comes after the scrub: a secret cut in the middle no longer matches. The first cut,
// to `SCRUB_LIMIT`, keeps a scrub fast.
export function scrub(text: string): string {
  return redact(stripAnsi(cut(text, SCRUB_LIMIT)))
}

export function oneLine(text: string, max: number): string {
  return cut(scrub(text).replace(/\s+/g, ' ').trim(), max)
}

export function firstLine(text: string, max: number): string {
  const line = scrub(text)
    .split('\n')
    .map(part => part.trim())
    .find(part => part !== '')

  return cut(line ?? '', max)
}

export const EXPLAIN_LOG_LINES = 60

export function tailLines(text: string, count: number): string {
  const wanted = Math.max(0, count)
  let start = text.length
  for (let found = 0; found <= wanted && start > 0; found++) start = text.lastIndexOf('\n', start - 1)
  const lines = stripAnsi(text.slice(Math.max(0, start))).split('\n')
  if (lines.at(-1) === '') lines.pop()

  return lines.slice(Math.max(0, lines.length - wanted)).join('\n')
}

const REDACTED = '[redacted]'
// A value already redacted is left alone, so that `redact` can run twice.
const NOT_YET = '(?!\\[redacted\\])'

// What is scrubbed: JWTs, the plugin's cookie, the whole Authorization value, Bearer tokens, URL user
// info, and the values of secret-looking flags (`--token x`) and names (`password=x`, `Set-Cookie: x`).
// Each part around a word is bounded (64, 32 or 256 characters), so matching time stays linear.
// A quoted value may hold escaped quotes. Cut before its closing quote, it runs to the end of the line.
const QUOTED = String.raw`"(?:[^"\\\r\n]|\\.)*"?|'(?:[^'\\\r\n]|\\.)*'?`
const JWT = /\beyJ[\w-]*\.[\w-]*\.[\w-]*/g
const COOKIE = /X-Datatailr-Oidc-Data=[^\s;]+/gi
const AUTH_HEADER = /((?:proxy-)?authorization["']?\s*[:=]\s*)[^\r\n]*/gi
const BEARER = /\bBearer\s+[\w.~+/=-]+/gi
const URL_USERINFO = /\b([a-z][a-z0-9+.-]{0,31}:\/\/)[^\s/@]{1,256}@/gi
const SECRET_FLAG = new RegExp(
  `(--[\\w-]{0,64}(?:password|passwd|pwd|secret|token|api[_-]?key|access[_-]?key)[\\w-]{0,64})(\\s+|=)${NOT_YET}(${QUOTED}|\\S+)`,
  'gi',
)
const NAMED_SECRET = new RegExp(
  `([\\w-]{0,64}(?:password|passwd|secret|token|api[_-]?key|cookie)[\\w-]{0,64})(["']?\\s*[=:]\\s*)${NOT_YET}(${QUOTED}|[^\\s,;&}\\]]+)`,
  'gi',
)

// One layer only: a secret with no mark is not found, so a prompt also holds no more than a log's last lines.
export function redact(text: string): string {
  return text
    .replace(JWT, REDACTED)
    .replace(COOKIE, `X-Datatailr-Oidc-Data=${REDACTED}`)
    .replace(AUTH_HEADER, (_all, name: string) => `${name}${REDACTED}`)
    .replace(URL_USERINFO, (_all, scheme: string) => `${scheme}${REDACTED}@`)
    .replace(SECRET_FLAG, (_all, flag: string, separator: string) => `${flag}${separator}${REDACTED}`)
    .replace(NAMED_SECRET, (_all, name: string, separator: string) => `${name}${separator}${REDACTED}`)
    .replace(BEARER, `Bearer ${REDACTED}`)
}
