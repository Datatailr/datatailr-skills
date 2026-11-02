/*************************************************************************
 *
 *  Copyright (c) 2026 Datatailr Inc.
 *
 *  Licensed under the MIT License. See the 'LICENSE' file distributed
 *  with this package for the full license text.
 *
 *  SPDX-License-Identifier: MIT
 *************************************************************************/

export const SECTIONS = ['overview', 'compute', 'nodes', 'users', 'kv', 'cost', 'launcher', 'blob'] as const
export type SectionId = (typeof SECTIONS)[number]

export const ITEM_KINDS = ['run', 'job', 'node', 'user', 'group', 'key', 'blob'] as const
export type ItemRef = { kind: (typeof ITEM_KINDS)[number]; id: string }

export type Route = {
  section: SectionId
  tab?: string
  filter?: Record<string, string>
  search?: string
  page?: number
  item?: ItemRef
}

const VIEW_FIELDS = ['tab', 'filter', 'search', 'page', 'item'] as const

export function go(current: Route, next: Partial<Route>): Route {
  if (next.section !== undefined && next.section !== current.section) {
    return withoutUndefined({ ...pick(next, VIEW_FIELDS), section: next.section })
  }
  return withoutUndefined({ ...current, ...next, section: current.section })
}

export function back(current: Route): Route {
  const { item: _item, ...rest } = current
  return rest
}

export function routeKey(route: Route): string {
  return stable(route)
}

export function parseRoute(value: unknown): Route | null {
  if (!isRecord(value) || !SECTIONS.includes(value.section as SectionId)) return null
  const route: Route = { section: value.section as SectionId }
  if (value.tab !== undefined) {
    if (typeof value.tab !== 'string') return null
    route.tab = value.tab
  }
  if (value.filter !== undefined) {
    if (!isRecord(value.filter) || !Object.values(value.filter).every(entry => typeof entry === 'string')) return null
    route.filter = { ...(value.filter as Record<string, string>) }
  }
  if (value.search !== undefined) {
    if (typeof value.search !== 'string') return null
    route.search = value.search
  }
  if (value.page !== undefined) {
    if (typeof value.page !== 'number' || !Number.isInteger(value.page) || value.page < 1) return null
    route.page = value.page
  }
  if (value.item !== undefined) {
    const item = value.item
    if (!isRecord(item) || typeof item.id !== 'string' || !ITEM_KINDS.includes(item.kind as ItemRef['kind']))
      return null
    route.item = { kind: item.kind as ItemRef['kind'], id: item.id }
  }
  return route
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function pick<T extends object, K extends keyof T>(from: T, keys: readonly K[]): Partial<Pick<T, K>> {
  const picked: Partial<Pick<T, K>> = {}
  for (const key of keys) if (from[key] !== undefined) picked[key] = from[key]
  return picked
}

function withoutUndefined(route: Partial<Route> & { section: SectionId }): Route {
  const kept: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(route)) if (value !== undefined) kept[key] = value
  return kept as Route
}

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(entry => stable(entry ?? null)).join(',')}]`
  if (isRecord(value)) {
    const fields = Object.keys(value)
      .filter(key => value[key] !== undefined)
      .sort()
      .map(key => `${JSON.stringify(key)}:${stable(value[key])}`)
    return `{${fields.join(',')}}`
  }
  return JSON.stringify(value)
}
