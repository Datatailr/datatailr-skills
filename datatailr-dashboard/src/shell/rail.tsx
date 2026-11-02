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

import type { Summary } from '../core/model'
import type { SectionId } from '../core/route'
import type { LoadState } from '../core/state'
import type { Section } from '../sections/contract'
import type { UiCtx } from '../ui/ctx'
import { sectionKey } from './loads'

export const RAIL_MIN_COLUMNS = 70

export type RailEntry = { id: SectionId; title: string; count: number; isDim: boolean }

export function railEntries(
  sections: readonly Section<any>[],
  summary: Summary | null,
  loads: Record<string, LoadState>,
): RailEntry[] {
  return sections.map(section => ({
    id: section.id,
    title: section.title,
    count: summary !== null && section.attention !== undefined ? section.attention(summary) : 0,
    isDim: loads[sectionKey(section.id)]?.error === 'no-access',
  }))
}

export function railWidth(entries: readonly RailEntry[]): number {
  const widths = entries.map(entry => entry.title.length + 2 + (entry.count > 0 ? String(entry.count).length + 1 : 0))
  return Math.max(0, ...widths)
}

export function Rail(
  ui: UiCtx,
  p: { entries: readonly RailEntry[]; current: SectionId; onGo(id: SectionId): void },
): RenderElement {
  const { Box, Button, Text } = ui.els

  if (ui.columns < RAIL_MIN_COLUMNS && 'Select' in ui.els) {
    const { Select } = ui.els
    const options = p.entries.map(entry => ({
      value: entry.id,
      label: entry.count > 0 ? `${entry.title} (${entry.count})` : entry.title,
    }))
    const onSelect = (value: string) => {
      const entry = p.entries.find(candidate => candidate.id === value)
      if (entry !== undefined) p.onGo(entry.id)
    }
    return <Select key="section-menu" label="Section" options={options} value={p.current} onSelect={onSelect} />
  }

  return (
    <Box flexDirection="column">
      {p.entries.map(entry => {
        const isCurrent = entry.id === p.current
        const parts: RenderElement[] = [
          <Text weight={isCurrent ? 'semibold' : undefined}>{`${isCurrent ? '▸' : ' '} ${entry.title}`}</Text>,
        ]
        if (entry.count > 0) parts.push(<Text color="error">{` ${entry.count}`}</Text>)
        return (
          <Button
            key={`nav-${entry.id}`}
            plain
            dimColor={entry.isDim ? true : undefined}
            onPress={() => p.onGo(entry.id)}
          >
            {parts}
          </Button>
        )
      })}
    </Box>
  )
}
