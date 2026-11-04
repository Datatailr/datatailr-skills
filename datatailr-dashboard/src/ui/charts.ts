/*************************************************************************
 *
 *  Copyright (c) 2026 Datatailr Inc.
 *
 *  Licensed under the MIT License. See the 'LICENSE' file distributed
 *  with this package for the full license text.
 *
 *  SPDX-License-Identifier: MIT
 *************************************************************************/

import type { Run } from '../core/model'

// The desktop draws an `Svg` string as an image, with no theme, so every color here is a fixed
// neutral that reads on a light and on a dark background.

/** The most characters of markup that an `Svg` element takes. */
const SVG_LIMIT = 131_072

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

const WIDTH = 640
const HEIGHT = 34
const TRACK = 24
const MIN_RUN_WIDTH = 2
const RUN_Y = 5
const RUN_HEIGHT = 14
const FAILED_Y = 2
const FAILED_HEIGHT = 20

const NEUTRAL = '#7a8a99'
const COLOR = {
  running: '#2e9e5b',
  completed: NEUTRAL,
  failed: '#d9534f',
  stopped: '#b0b7bf',
  waiting: '#e0a030',
  other: '#9aa3ad',
}

// The states that count as a failure: `FAILED_STATES` of the model, which this file may not import.
const FAILED = new Set(['failed', 'failed_after', 'out_of_memory'])

function stateFill(state: string): string {
  if (state === 'running') return COLOR.running
  if (state === 'completed') return COLOR.completed
  if (FAILED.has(state)) return COLOR.failed
  if (state === 'stopped') return COLOR.stopped
  if (state === 'pending' || state === 'created') return COLOR.waiting

  return COLOR.other
}

const ENTITIES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }

// What XML cannot hold; one such character makes the whole drawing fail to load.
const UNREPRESENTABLE =
  /[\u0000-\u0008\u000b-\u001f\u007f-\u009f\ufffe\uffff]|[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/g

function esc(text: string): string {
  return text.replace(UNREPRESENTABLE, '').replace(/[&<>"']/g, ch => ENTITIES[ch] ?? ch)
}

function num(value: number): string {
  return String(Math.round(value * 100) / 100)
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value))
}

function finite(value: number | null): number | null {
  return value !== null && Number.isFinite(value) ? value : null
}

function span(ms: number): string {
  if (ms % HOUR === 0) return `${ms / HOUR}h`
  if (ms % MINUTE === 0) return `${ms / MINUTE}m`

  return `${Math.round(ms / 1000)}s`
}

const TICK_LINES = `<path d="M160 0V${TRACK}M320 0V${TRACK}M480 0V${TRACK}" fill="none" stroke="${NEUTRAL}" stroke-opacity="0.3"/>`

function tickLabels(range: number): string {
  const labels = [0, 1, 2, 3, 4].map(i => {
    const ago = Math.round((range * (4 - i)) / 4)
    const x = i === 0 ? 2 : i === 4 ? WIDTH - 2 : (i * WIDTH) / 4
    const anchor = i === 0 ? 'start' : i === 4 ? 'end' : 'middle'

    return `<text x="${num(x)}" y="32" text-anchor="${anchor}">${ago === 0 ? 'now' : `-${span(ago)}`}</text>`
  })

  return `<g fill="${NEUTRAL}" font-family="system-ui,sans-serif" font-size="9">${labels.join('')}</g>`
}

function tooltip(run: Run): string {
  const head = `${esc(run.job)} #${run.id} · ${esc(run.state)}`
  const error = Array.from(run.error.slice(0, 240).replace(/\s+/g, ' ').trim()).slice(0, 120).join('')

  return error ? `${head} · ${esc(error)}` : head
}

type Drawn = { submit: number; failed: boolean; markup: string }

export function timeline(runs: Run[], nowMs: number, windowMs: number): string {
  const range = Number.isFinite(windowMs) && windowMs > 0 ? windowMs : DAY
  const windowStart = nowMs - range
  const x = (ms: number) => ((ms - windowStart) / range) * WIDTH

  const drawn: Drawn[] = []
  for (const run of Number.isFinite(nowMs) ? runs : []) {
    if (!(Number.isFinite(run.submit) && run.submit > 0)) continue

    const from = Math.max(windowStart, finite(run.start) ?? run.submit)
    const to = Math.min(nowMs, finite(run.end) ?? (run.state === 'running' ? nowMs : run.submit))
    if (to < windowStart) continue

    const left = clamp(x(from), 0, WIDTH - MIN_RUN_WIDTH)
    const width = Math.max(MIN_RUN_WIDTH, clamp(x(Math.max(from, to)), 0, WIDTH) - left)
    const failed = FAILED.has(run.state)
    const opacity = run.state === 'completed' ? '0.55' : '0.9'

    drawn.push({
      submit: run.submit,
      failed,
      markup:
        `<rect x="${num(left)}" y="${failed ? FAILED_Y : RUN_Y}" width="${num(width)}" ` +
        `height="${failed ? FAILED_HEIGHT : RUN_HEIGHT}" fill="${stateFill(run.state)}" fill-opacity="${opacity}">` +
        `<title>${tooltip(run)}</title></rect>`,
    })
  }

  const before =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${HEIGHT}" width="${WIDTH}" height="${HEIGHT}">` +
    `<rect x="0" y="0" width="${WIDTH}" height="${TRACK}" rx="3" fill="${NEUTRAL}" fill-opacity="0.12"/>` +
    TICK_LINES
  const after = `${tickLabels(range)}</svg>`

  drawn.sort((a, b) => a.submit - b.submit)
  let size = before.length + after.length + drawn.reduce((sum, d) => sum + d.markup.length, 0)
  let first = 0
  while (size >= SVG_LIMIT && first < drawn.length) size -= drawn[first++]!.markup.length

  const kept = drawn.slice(first)

  return before + [...kept.filter(d => !d.failed), ...kept.filter(d => d.failed)].map(d => d.markup).join('') + after
}

function pixels(value: number): number {
  return Math.max(1, Math.round(Number.isFinite(value) ? value : 0))
}

export function bars(values: { label: string; value: number }[], width: number, height: number): string {
  const w = pixels(width)
  const h = pixels(height)
  const amounts = values.map(v => (Number.isFinite(v.value) && v.value > 0 ? v.value : 0))
  const max = amounts.reduce((most, amount) => Math.max(most, amount), 0)
  const inner = h - 2
  const slot = w / values.length

  const barWidth = Math.max(slot - 2, slot / 2)

  const drawn = values.map((v, i) => {
    const amount = amounts[i] ?? 0
    const barHeight = amount > 0 ? Math.max(1, (amount / max) * inner) : 0
    const shown = Number.isFinite(v.value) ? String(Math.round(v.value * 100) / 100) : '—'

    return (
      `<rect x="${num(i * slot + (slot - barWidth) / 2)}" y="${num(h - barHeight)}" width="${num(barWidth)}" ` +
      `height="${num(barHeight)}" fill="${NEUTRAL}" fill-opacity="0.8"><title>${esc(v.label)}: ${shown}</title></rect>`
    )
  })

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">` +
    `<rect x="0" y="0" width="${w}" height="${h}" rx="3" fill="${NEUTRAL}" fill-opacity="0.12"/>` +
    drawn.join('') +
    '</svg>'
  )
}
