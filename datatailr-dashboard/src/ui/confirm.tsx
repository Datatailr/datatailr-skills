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

export function ConfirmBar(
  ui: UiCtx,
  p: { question: string; yesLabel: string; result?: { ok: boolean; text: string }; onYes(): void; onNo(): void },
): RenderElement {
  const { Box, Button, Text } = ui.els

  if (p.result) return <Text color={p.result.ok ? 'success' : 'error'}>{p.result.text}</Text>

  return (
    <Box flexWrap="wrap" gap={1}>
      <Text color="warning">{p.question}</Text>
      <Button key="yes" label={p.yesLabel} variant="primary" onPress={p.onYes} />
      <Button key="no" label="Cancel" onPress={p.onNo} />
    </Box>
  )
}
