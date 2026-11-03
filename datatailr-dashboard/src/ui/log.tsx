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
import { clip, stripAnsi } from './text'

const MAX_LOG_CHARS = 60_000

export function LogView(
  ui: UiCtx,
  p: {
    text: string
    isLoading: boolean
    error?: string
    stream: 'stdout' | 'stderr'
    follow: boolean
    canFollow: boolean
    /** False for a log that is read whole, such as a build log: no "Load more". */
    canMore?: boolean
    onStream(s: 'stdout' | 'stderr'): void
    onMore(): void
    onFollow(on: boolean): void
  },
): RenderElement {
  const { Box, Button, Code, Text } = ui.els
  const shown = stripAnsi(clip(p.text, MAX_LOG_CHARS))

  return (
    <Box flexDirection="column" gap={1}>
      <Box flexWrap="wrap" gap={1}>
        <Button key="stdout" label="stdout" variant={p.stream === 'stdout' ? 'primary' : undefined} onPress={() => p.onStream('stdout')} />
        <Button key="stderr" label="stderr" variant={p.stream === 'stderr' ? 'primary' : undefined} onPress={() => p.onStream('stderr')} />
        {p.canMore === false ? null : <Button key="more" label="Load more" onPress={p.onMore} />}
        {p.canFollow ? (
          <Button
            key="follow"
            label={p.follow ? 'Following' : 'Follow'}
            variant={p.follow ? 'primary' : undefined}
            onPress={() => p.onFollow(!p.follow)}
          />
        ) : null}
      </Box>
      {p.error === undefined || p.error === '' ? null : <Text color="error">{stripAnsi(p.error)}</Text>}
      {p.isLoading ? (
        <Text dimColor>Loading…</Text>
      ) : shown.trim() === '' ? (
        p.error === undefined || p.error === '' ? (
          <Text dimColor>{`(no output on ${p.stream})`}</Text>
        ) : null
      ) : (
        <Code language="log" source={shown} />
      )}
    </Box>
  )
}
