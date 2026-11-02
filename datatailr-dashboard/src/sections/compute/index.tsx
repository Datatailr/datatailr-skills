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

import type { Page } from '../../core/endpoints'
import type { Job, Run, Workflow } from '../../core/model'
import type { UiCtx } from '../../ui/ctx'
import { ErrorState } from '../../ui/states'
import { PAGE_SIZE } from '../../ui/table'
import { Tabs } from '../../ui/tabs'
import { isBroken, latestFailedRuns } from '../attention'
import type { Section, SectionActions, SectionView } from '../contract'
import { describeCompute } from './describe'
import { type DetailData, DetailPage } from './detail'
import { logRequestOf } from './detail-actions'
import { loadDetail } from './detail-load'
import { JOB_TYPES, TABS, listedState, loadKey, pageOf, runsFilter, runsSinceMs, tabOf } from './filters'
import { JobsList, RunsList, WorkflowsList, setTab } from './lists'

export type ComputeData =
  | { tab: 'runs'; page: Page<Run> }
  | { tab: 'workflows'; rows: Workflow[] }
  | { tab: 'apps' | 'services' | 'excel'; rows: Job[] }
  | DetailData

const NO_JOBS = { apps: 'No apps.', services: 'No services.', excel: 'No Excel add-ins.' } as const

function Loading(ui: UiCtx): RenderElement {
  const { Text } = ui.els

  return <Text dimColor>Loading…</Text>
}

function Body(ui: UiCtx, view: SectionView<ComputeData>, act: SectionActions): RenderElement {
  const { data, route } = view
  const tab = tabOf(route)

  if (data === null || data.tab !== tab) {
    // The shell's bar tells of an ended session, once.
    if (view.error === null || view.error === 'logged-out') return Loading(ui)

    return ErrorState(ui, { kind: view.error, installation: view.installation })
  }

  switch (data.tab) {
    case 'runs':
      return RunsList(ui, { route, act, page: data.page, now: view.now })
    case 'workflows':
      return WorkflowsList(ui, { route, act, rows: data.rows, summary: view.summary })
    case 'apps':
    case 'services':
    case 'excel':
      return JobsList(ui, { route, act, rows: data.rows, empty: NO_JOBS[data.tab] })
    default:
      return Loading(ui)
  }
}

export const compute: Section<ComputeData> = {
  id: 'compute',
  title: 'Compute Processes',
  refreshMs: 10_000,
  loadKey,

  async load(api, route, now) {
    if (route.item !== undefined) return { tab: 'detail', detail: await loadDetail(api, route.item, now) }

    const tab = tabOf(route)
    switch (tab) {
      case 'runs':
        return {
          tab,
          page: await api.runs.list({
            sinceMs: runsSinceMs(route, now),
            filter: runsFilter(route),
            offset: pageOf(route) * PAGE_SIZE,
            limit: PAGE_SIZE,
          }),
        }
      case 'workflows':
        return { tab, rows: await api.workflows.list() }
      default: {
        // `job ls` gives the job's own state (`ready`), not that of its runs, so the running runs are read too.
        const [jobs, running] = await Promise.all([api.jobs.list(), api.runs.running()])
        const live = new Set(running.filter(run => run.state === 'running').map(run => `${run.env}:${run.job}`))
        const rows = jobs
          .filter(job => job.type === JOB_TYPES[tab])
          .map(job => ({ ...job, state: listedState(job, live.has(`${job.env}:${job.name}`)) }))

        return { tab, rows }
      }
    }
  },

  logFor(route, data) {
    return route.item !== undefined && data.tab === 'detail' && data.detail !== null ? logRequestOf(data.detail) : null
  },

  render(ui, view, act) {
    const { Box } = ui.els
    if (view.route.item !== undefined) {
      return DetailPage(ui, { ...view, data: view.data?.tab === 'detail' ? view.data : null }, act)
    }

    return (
      <Box flexDirection="column" gap={1}>
        {Tabs(ui, { key: 'compute-tabs', tabs: [...TABS], current: tabOf(view.route), onSelect: id => setTab(act, id) })}
        {Body(ui, view, act)}
      </Box>
    )
  },

  attention: summary => latestFailedRuns(summary.runs).length + summary.jobs.filter(isBroken).length,

  describe: describeCompute,
}
