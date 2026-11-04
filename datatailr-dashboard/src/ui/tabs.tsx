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

export function Tabs(
  ui: UiCtx,
  p: { key: string; tabs: { id: string; label: string; count?: number }[]; current: string; onSelect(id: string): void },
): RenderElement {
  const { Box, Button } = ui.els

  return (
    <Box key={p.key} flexWrap="wrap" gap={1}>
      {p.tabs.map(tab => (
        <Button
          key={`tab-${tab.id}`}
          label={tab.count === undefined ? tab.label : `${tab.label} ${tab.count}`}
          variant={tab.id === p.current ? 'primary' : undefined}
          onPress={() => p.onSelect(tab.id)}
        />
      ))}
    </Box>
  )
}
