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

import type { ErrorKind } from '../core/api'
import type { UiCtx } from './ctx'
import { age } from './text'

function errorCopy(kind: ErrorKind, installation: string): string {
  switch (kind) {
    case 'no-access':
      return `You do not have access to this on ${installation}.`
    case 'not-available':
      return 'This installation does not support this view.'
    case 'network':
      return 'Cannot reach the installation.'
    case 'server':
      return 'The installation returned an error.'
    case 'logged-out':
      return 'Your session ended.'
  }
}

export function ErrorState(ui: UiCtx, p: { kind: ErrorKind; installation: string; onRetry?(): void }): RenderElement {
  const { Box, Button, Text } = ui.els

  return (
    <Box flexDirection="column" gap={1}>
      <Text>{errorCopy(p.kind, p.installation)}</Text>
      {p.onRetry ? <Button key="retry" label="Try again" onPress={p.onRetry} /> : null}
    </Box>
  )
}

export function EmptyState(ui: UiCtx, p: { text: string }): RenderElement {
  const { Text } = ui.els

  return <Text dimColor>{p.text}</Text>
}

export function StaleMark(ui: UiCtx, p: { fetchedAt: number; now: number }): RenderElement {
  const { Text } = ui.els

  return <Text dimColor>{`stale · updated ${age(p.now, p.fetchedAt)} ago`}</Text>
}
