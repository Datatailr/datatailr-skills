/*************************************************************************
 *
 *  Copyright (c) 2026 Datatailr Inc.
 *
 *  Licensed under the MIT License. See the 'LICENSE' file distributed
 *  with this package for the full license text.
 *
 *  SPDX-License-Identifier: MIT
 *************************************************************************/

import { firstLine } from '../../assist/text'
import type { SectionView } from '../contract'
import { TABS, pageOf, searchOf, tabOf } from './filters'
import type { ComputeData } from './index'

// Never a log line: of an error only its first line, scrubbed, labeled as job output and quoted.

const ERROR_CHARS = 200

function describeList(view: SectionView<ComputeData>): string {
  const { route } = view
  const tab = tabOf(route)
  const label = TABS.find(entry => entry.id === tab)?.label ?? tab
  const filters = Object.entries(route.filter ?? {})
    .filter(([, value]) => value !== '' && value !== 'all')
    .map(([name, value]) => `${name} ${value}`)
  const search = searchOf(route)
  const page = pageOf(route)

  return [
    `${label} tab.`,
    filters.length === 0 ? 'No filters.' : `Filters: ${filters.join(', ')}.`,
    ...(search === '' ? [] : [`Search: "${search}".`]),
    ...(page === 0 ? [] : [`Page ${page + 1}.`]),
  ].join(' ')
}

function describeItem(view: SectionView<ComputeData>): string {
  const { data, route } = view
  const item = route.item
  if (item === undefined) return ''
  if (data === null || data.tab !== 'detail') return `Opened ${item.kind} ${item.id}; it is not loaded yet.`

  const { detail } = data
  if (detail === null) return `Opened ${item.kind} ${item.id}, which no longer exists.`

  if (detail.kind === 'job') {
    const { job } = detail

    return `Job page: job ${job.name}, environment ${job.env}, state ${job.state}${job.built ? '' : ', the last build failed'}.`
  }
  const { run } = detail
  const error = firstLine(run.error, ERROR_CHARS)

  return (
    `Run page: job ${run.job}, environment ${run.env}, state ${run.state}, run id ${run.id}.` +
    (error === '' ? '' : ` Job output: ${JSON.stringify(error)}`)
  )
}

export function describeCompute(view: SectionView<ComputeData>): string {
  return view.route.item === undefined ? describeList(view) : describeItem(view)
}
