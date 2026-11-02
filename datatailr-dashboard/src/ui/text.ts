/*************************************************************************
 *
 *  Copyright (c) 2026 Datatailr Inc.
 *
 *  Licensed under the MIT License. See the 'LICENSE' file distributed
 *  with this package for the full license text.
 *
 *  SPDX-License-Identifier: MIT
 *************************************************************************/

const SECOND = 1000
const MINUTE = 60 * SECOND
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

export function age(nowMs: number, thenMs: number | null): string {
  if (thenMs === null) return '—'

  const elapsed = Math.max(0, nowMs - thenMs)
  if (elapsed < MINUTE) return `${Math.floor(elapsed / SECOND)}s`
  if (elapsed < HOUR) return `${Math.floor(elapsed / MINUTE)}m`
  if (elapsed < DAY) return `${Math.floor(elapsed / HOUR)}h`

  return `${Math.floor(elapsed / DAY)}d`
}

const ESCAPES = new RegExp(
  [
    // CSI: ESC [ (or the one-character form) parameters, intermediates, a final byte.
    '(?:\\u001b\\[|\\u009b)[0-?]*[ -/]*[@-~]',
    // OSC, DCS, SOS, PM and APC, ended by BEL or ESC \; an unended one stops at the end of its line.
    '\\u001b[\\]PX^_][^\\u0007\\u001b\\n]*(?:\\u0007|\\u001b\\\\)?',
    // A charset or other multi-byte escape, such as ESC ( B.
    '\\u001b[ -/]+[0-~]',
    // Any other two-byte escape, such as ESC = or ESC M.
    '\\u001b[0-~]',
  ].join('|'),
  'g',
)

const CONTROLS = /[\u0000-\u0008\u000b-\u001f\u007f-\u009f]/g

export function stripAnsi(text: string): string {
  return text.replace(ESCAPES, '').replace(CONTROLS, '')
}

const isLowSurrogate = (unit: number) => unit >= 0xdc00 && unit <= 0xdfff
const isHighSurrogate = (unit: number) => unit >= 0xd800 && unit <= 0xdbff

export function cut(text: string, max: number): string {
  if (text.length <= max) return text

  let end = Math.max(0, max - 1)
  if (end > 0 && isHighSurrogate(text.charCodeAt(end - 1))) end--

  return `${text.slice(0, end)}…`
}

export function clip(text: string, maxChars: number): string {
  const keep = Math.max(0, Math.floor(maxChars))
  if (text.length <= keep) return text

  let start = text.length - keep
  if (isLowSurrogate(text.charCodeAt(start))) start++

  return `… ${start} earlier characters\n${text.slice(start)}`
}

export function duration(startMs: number | null, endMs: number | null, nowMs: number): string {
  if (startMs === null) return ''

  const elapsed = (endMs ?? nowMs) - startMs
  if (!Number.isFinite(elapsed)) return ''

  const seconds = Math.floor(Math.max(0, elapsed) / SECOND)
  if (seconds < 60) return `${seconds}s`

  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m${String(seconds % 60).padStart(2, '0')}s`

  return `${Math.floor(minutes / 60)}h${String(minutes % 60).padStart(2, '0')}m`
}

const KIB = 1024
const MIB = KIB * 1024
const GIB = MIB * 1024

export function memory(bytes: string | null): string {
  if (bytes === null || bytes.trim() === '') return '—'

  const count = Number(bytes)
  if (!Number.isFinite(count)) return bytes
  if (count <= 0) return '—'
  if (count >= GIB) {
    const gib = count / GIB
    return `${Number.isInteger(gib) ? gib : gib.toFixed(1)} GB`
  }
  if (count >= MIB) return `${Math.round(count / MIB)} MB`

  return `${count} B`
}

/** A bar of `width` cells and the share of `used` in `total`, such as `▮▮▮▯▯ 61%`. `label` replaces the percent. */
export function meter(used: number, total: number, width: number, label?: string): string {
  if (!Number.isFinite(used) || !Number.isFinite(total) || total <= 0) return '—'

  const cells = Math.max(0, Math.floor(width))
  const filled = Math.min(cells, Math.max(0, Math.floor((used * cells) / total)))
  return `${'▮'.repeat(filled)}${'▯'.repeat(cells - filled)} ${label ?? `${Math.max(0, Math.floor((used * 100) / total))}%`}`
}
