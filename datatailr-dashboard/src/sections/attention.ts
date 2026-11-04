/*************************************************************************
 *
 *  Copyright (c) 2026 Datatailr Inc.
 *
 *  Licensed under the MIT License. See the 'LICENSE' file distributed
 *  with this package for the full license text.
 *
 *  SPDX-License-Identifier: MIT
 *************************************************************************/

import { FAILED_STATES, type Job, type Run } from '../core/model'

// A failed build of these types is the person's own business, not a broken build.
const NO_BUILD_TYPES: ReadonlySet<string> = new Set(['workstation', 'workspace'])

export const isBroken = (job: Job) => !job.built && !NO_BUILD_TYPES.has(job.type)

export function latestFailedRuns(runs: readonly Run[]): Run[] {
  const latest = new Map<string, Run>()
  for (const run of runs) {
    if (!FAILED_STATES.has(run.state)) continue

    const key = `${run.env}:${run.job}`
    const seen = latest.get(key)
    if (seen === undefined || run.submit > seen.submit || (run.submit === seen.submit && run.id > seen.id)) {
      latest.set(key, run)
    }
  }

  return [...latest.values()].sort((a, b) => b.submit - a.submit || b.id - a.id)
}
