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

export function KpiTile(
  ui: UiCtx,
  p: { key: string; label: string; value: number; tone: 'success' | 'error' | 'warning' | 'text'; onPress(): void },
): RenderElement {
  const { Button, Text } = ui.els

  return (
    <Button key={p.key} plain onPress={p.onPress}>
      <Text size="title" color={p.value > 0 ? p.tone : 'subtle'}>{String(p.value)}</Text> <Text dimColor>{p.label}</Text>
    </Button>
  )
}
