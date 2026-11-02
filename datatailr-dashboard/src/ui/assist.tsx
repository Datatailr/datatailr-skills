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

import type { ExplainState } from '../core/state'
import type { UiCtx } from './ctx'

export function AssistBox(ui: UiCtx, p: { state: ExplainState; onContinue(): void }): RenderElement {
  const { Box, Button, Text } = ui.els

  switch (p.state.status) {
    case 'loading':
      return <Text dimColor>Explaining…</Text>
    case 'failed':
      return <Text dimColor>Claude could not explain this right now.</Text>
    case 'done':
      return (
        <Box flexDirection="column">
          <Text>{p.state.text}</Text>
          <Button key="continue-chat" plain label="Continue in chat" onPress={p.onContinue} />
        </Box>
      )
  }
}

export function ContextLine(ui: UiCtx, p: { text: string }): RenderElement {
  const { Text } = ui.els

  return <Text dimColor>{`Shared with Claude: ${p.text}`}</Text>
}
