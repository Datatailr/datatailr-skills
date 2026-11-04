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
import { StatusText } from './status'

export function BackButton(ui: UiCtx, p: { onBack(): void }): RenderElement {
  const { Button } = ui.els

  return <Button key="back" label="‹ Back" hotkey="b" plain onPress={p.onBack} />
}

export function DetailHeader(
  ui: UiCtx,
  p: { title: string; subtitle: string; state: string; onBack(): void },
): RenderElement {
  const { Box, Text } = ui.els

  return (
    <Box flexDirection="column">
      {BackButton(ui, { onBack: p.onBack })}
      <Text size="heading" weight="semibold">
        {p.title}
      </Text>
      <Box flexWrap="wrap" gap={1}>
        {StatusText(ui, { state: p.state })}
        <Text dimColor>{p.subtitle}</Text>
      </Box>
    </Box>
  )
}
