/*************************************************************************
 *
 *  Copyright (c) 2026 Datatailr Inc.
 *
 *  Licensed under the MIT License. See the 'LICENSE' file distributed
 *  with this package for the full license text.
 *
 *  SPDX-License-Identifier: MIT
 *************************************************************************/

import type { Page } from '../core/endpoints'
import type { Route } from '../core/route'
import { PAGE_SIZE } from '../ui/table'

export const ALL = 'all'

export const pageOf = (route: Route) => Math.max(0, Math.floor(route.page ?? 0))

export const searchOf = (route: Route) => route.search?.trim() ?? ''

export function filterOf(route: Route, id: string, values: readonly string[]): string {
  const value = route.filter?.[id]

  return value !== undefined && values.includes(value) ? value : ALL
}

export function pageRows<T>(rows: readonly T[], route: Route): Page<T> {
  const from = pageOf(route) * PAGE_SIZE

  return { rows: rows.slice(from, from + PAGE_SIZE), hasMore: rows.length > from + PAGE_SIZE }
}
