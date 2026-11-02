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

import type { LoadState } from '../core/state'
import type { UiCtx } from '../ui/ctx'
import { StaleMark } from '../ui/states'
import { age } from '../ui/text'

export type HeaderStatus = {
  now: number
  summary: LoadState | undefined
  section: LoadState | undefined
  onRefresh(): void
}

export function isStale(load: LoadState | undefined): load is LoadState & { fetchedAt: number } {
  return load !== undefined && load.fetchedAt !== null && load.error !== null
}

export function Header(ui: UiCtx, p: { status: HeaderStatus | null; switcher: RenderElement }): RenderElement {
  const { Box, Button, Text } = ui.els
  const left: RenderElement[] = [<Text weight="semibold">Datatailr</Text>]
  const status = p.status
  if (status !== null) {
    const summaryAge = ageOf(ui, status)
    if (summaryAge !== null) left.push(summaryAge)
    if (isStale(status.section)) left.push(StaleMark(ui, { fetchedAt: status.section.fetchedAt, now: status.now }))
    left.push(<Button key="refresh" label="↻" hotkey="r" plain onPress={status.onRefresh} />)
  }

  return (
    <Box justifyContent="space-between" gap={1}>
      <Box flexWrap="wrap" gap={1}>
        {left}
      </Box>
      {p.switcher}
    </Box>
  )
}

function ageOf(ui: UiCtx, status: HeaderStatus): RenderElement | null {
  const { Text } = ui.els
  const summary = status.summary
  if (isStale(summary)) return StaleMark(ui, { fetchedAt: summary.fetchedAt, now: status.now })
  if (summary?.fetchedAt != null) return <Text dimColor>{`updated ${age(status.now, summary.fetchedAt)} ago`}</Text>
  if (summary?.error != null) return null

  return <Text dimColor>loading…</Text>
}
