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

export const PAGE_SIZE = 50

export type Column<Row> = {
  id: string
  title: string
  width: number
  cell(row: Row): string
  tone?(row: Row): string
  sortable?: boolean
  href?(row: Row): string | null
}

const CONTROLS = /[\u0000-\u001f\u007f-\u009f]+/g

// The desktop draws Text as an HTML span, which collapses runs of spaces: cell spaces are non-breaking.
const NBSP = '\u00a0'

// A hover group holds one to 64 characters.
const SCOPE_LIMIT = 64

function truncate(text: string, width: number): string {
  const chars = Array.from(text.replace(CONTROLS, ' '))
  if (chars.length <= width) return chars.join('')

  return width > 0 ? `${chars.slice(0, width - 1).join('')}…` : ''
}

function fit(text: string, width: number): string {
  return truncate(text, width).replaceAll(' ', NBSP)
}

// Columns line up because every cell is a Box of the column's fixed width: the text never sets it, so
// the font of a surface does not matter. A Button may hold only text, so each cell is its own plain
// Button, and the cells of a row share a hover group to light as one. A `rowKey` must not be `prev`,
// `next` or `sort-<id>`.
export function Table<Row>(
  ui: UiCtx,
  p: {
    key: string
    columns: Column<Row>[]
    rows: Row[]
    rowKey(row: Row): string
    sort?: { id: string; desc: boolean }
    onSort?(id: string): void
    onRow(row: Row): void
    page: number
    hasMore: boolean
    onPage(page: number): void
  },
): RenderElement {
  const { Box, Button, Link, Text } = ui.els

  // A Link takes no key, so the Box around it holds the key of its cell.
  const cellBox = (column: Column<Row>, content: RenderElement, key?: string) => (
    <Box key={key} width={column.width} flexShrink={0}>
      {content}
    </Box>
  )

  const header = p.columns.map(column => {
    const sorted = p.sort?.id === column.id
    const arrow = p.sort?.desc ? '▼' : '▲'
    const title = sorted ? fit(`${truncate(column.title, column.width - 2)} ${arrow}`, column.width) : fit(column.title, column.width)

    if (!column.sortable) {
      return cellBox(
        column,
        <Text mono dimColor wrap="truncate-end">
          {title}
        </Text>,
      )
    }

    return cellBox(
      column,
      <Button key={`sort-${column.id}`} plain onPress={() => p.onSort?.(column.id)}>
        <Text mono dimColor={!sorted} wrap="truncate-end">
          {title}
        </Text>
      </Button>,
    )
  })

  const rows = p.rows.slice(0, PAGE_SIZE).map(row => {
    const key = p.rowKey(row)
    const scope = `row:${key}`.slice(0, SCOPE_LIMIT)

    return (
      <Box key={`${key}:row`} flexDirection="row" columnGap={1}>
        {p.columns.map((column, i) => {
          const cellKey = i === 0 ? key : `${key}:${column.id}`
          const href = column.href?.(row) ?? null
          if (href !== null) return cellBox(column, <Link href={href} label={fit(column.cell(row), column.width)} />, cellKey)
          return cellBox(
            column,
            <Button key={cellKey} plain hover={{ scope }} onPress={() => p.onRow(row)}>
              <Text mono color={column.tone?.(row) || undefined} wrap="truncate-end">
                {fit(column.cell(row), column.width)}
              </Text>
            </Button>,
          )
        })}
      </Box>
    )
  })

  const showPrev = p.page > 0

  return (
    <Box key={p.key} flexDirection="column">
      <Box key={`${p.key}:header`} flexDirection="row" columnGap={1}>
        {header}
      </Box>
      {rows}
      {showPrev || p.hasMore ? (
        <Box gap={1}>
          {showPrev ? <Button key="prev" label="‹ Prev" onPress={() => p.onPage(p.page - 1)} /> : null}
          <Text dimColor>{`Page ${p.page + 1}`}</Text>
          {p.hasMore ? <Button key="next" label="Next ›" onPress={() => p.onPage(p.page + 1)} /> : null}
        </Box>
      ) : null}
    </Box>
  )
}
