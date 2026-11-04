/*************************************************************************
 *
 *  Copyright (c) 2026 Datatailr Inc.
 *
 *  Licensed under the MIT License. See the 'LICENSE' file distributed
 *  with this package for the full license text.
 *
 *  SPDX-License-Identifier: MIT
 *************************************************************************/

import type { RenderElement } from 'claude-code'

import type { UiCtx } from './ctx'

export type StateColor = 'success' | 'error' | 'warning' | 'subtle' | 'inactive' | 'text'

const FAILED = new Set(['failed', 'failed_after', 'out_of_memory'])
const WAITING = new Set(['building', 'pending', 'starting', 'created', 'scheduled'])
const DONE = new Set(['completed', 'ready'])
const OFF = new Set(['stopped', 'expired', 'did_not_run'])

export function stateColor(state: string): StateColor {
  if (state === 'running') return 'success'
  if (FAILED.has(state)) return 'error'
  if (WAITING.has(state)) return 'warning'
  if (DONE.has(state)) return 'subtle'
  if (OFF.has(state)) return 'inactive'

  return 'text'
}

function glyph(state: string): string {
  if (state === 'running') return '●'
  if (FAILED.has(state)) return '✕'
  if (state === 'completed') return '✓'

  return '○'
}

export function stateLabel(state: string): string {
  return `${glyph(state)} ${state}`
}

export function StatusText(ui: UiCtx, p: { state: string }): RenderElement {
  const { Text } = ui.els

  return <Text color={stateColor(p.state)}>{stateLabel(p.state)}</Text>
}
