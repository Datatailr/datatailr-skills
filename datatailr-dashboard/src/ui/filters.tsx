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

export type FilterSelect = {
  id: string
  label: string
  options: { value: string; label: string }[]
  value: string
  onSelect(value: string): void
}

/** A surface that draws no `Input` or `Select` (the mobile app) leaves them out. */
export function FilterBar(
  ui: UiCtx,
  p: {
    chips: { id: string; label: string }[]
    current: string
    onChip(id: string): void
    selects?: FilterSelect[]
    search: string
    onSearch(text: string): void
  },
): RenderElement {
  const { Box, Button } = ui.els

  const selects: RenderElement[] = []
  if ('Select' in ui.els) {
    const { Select } = ui.els
    for (const select of p.selects ?? []) {
      selects.push(
        <Select
          key={select.id}
          label={select.label}
          options={select.options}
          value={select.value}
          onSelect={select.onSelect}
        />,
      )
    }
  }

  let search: RenderElement | null = null
  if ('Input' in ui.els) {
    const { Input } = ui.els
    search = <Input key="search" placeholder="Search…" value={p.search} onSubmit={text => p.onSearch(text)} />
  }

  return (
    <Box flexWrap="wrap" gap={1}>
      {p.chips.map(chip => (
        <Button
          key={`chip-${chip.id}`}
          label={chip.label}
          variant={chip.id === p.current ? 'primary' : undefined}
          onPress={() => p.onChip(chip.id)}
        />
      ))}
      {selects}
      {search}
    </Box>
  )
}
