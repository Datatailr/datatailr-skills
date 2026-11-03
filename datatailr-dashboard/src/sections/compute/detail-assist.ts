/*************************************************************************
 *
 *  Copyright (c) 2026 Datatailr Inc.
 *
 *  Licensed under the MIT License. See the 'LICENSE' file distributed
 *  with this package for the full license text.
 *
 *  SPDX-License-Identifier: MIT
 *************************************************************************/

import { type DraftKind, draftFor, explainKey } from '../../assist/prompts'
import { EXPLAIN_LOG_LINES, tailLines } from '../../assist/text'
import { FAILED_STATES } from '../../core/model'
import type { LogState } from '../../core/state'
import { stripAnsi } from '../../ui/text'
import type { ExplainInput } from '../contract'
import type { ComputeDetail } from './detail-load'

// `input` and `draft` run on a press, never while the page draws: they scrub the error and the log.

export type DetailAssist = {
  key: string
  canExplain: boolean
  input(): ExplainInput
  draft(): string
  what: string
}

const errorOf = (detail: ComputeDetail) => (detail.kind === 'run' ? stripAnsi(detail.run.error).trim() : '')

export function assistOf(detail: ComputeDetail, installation: string, url: string, log: LogState): DetailAssist {
  const error = errorOf(detail)
  const logTail = () => tailLines(log?.text ?? '', EXPLAIN_LOG_LINES)

  if (detail.kind === 'run') {
    const { run, job } = detail
    const isFailing = FAILED_STATES.has(run.state) || error !== ''
    const facts = [
      `Run #${run.id} of job ${run.job}`,
      `type ${run.type}`,
      `environment ${run.env}`,
      `state ${run.state}`,
      ...(run.version > 0 ? [`version ${run.version}`] : []),
      ...(job !== null && !job.built ? ['the last build of the job failed'] : []),
    ].join(', ')
    const kind: DraftKind = isFailing ? 'run' : 'job'

    return {
      key: explainKey(url, { kind: 'run', id: String(run.id) }, run.state),
      canExplain: isFailing,
      input: () => ({ facts, error, logTail: logTail() }),
      draft: () =>
        draftFor(kind, {
          name: run.job,
          installation,
          env: run.env,
          state: run.state,
          error,
          id: String(run.id),
        }),
      what: `${run.job} #${run.id}`,
    }
  }

  const { job } = detail
  const facts = [
    `Job ${job.name}`,
    `type ${job.type}`,
    `environment ${job.env}`,
    `state ${job.state}`,
    ...(job.version > 0 ? [`version ${job.version}`] : []),
    job.built ? 'the last build succeeded' : 'the last build failed',
  ].join(', ')

  // A job in one state fails again with a new run, a new version or a new build: the key names them,
  // so that Explain reads the new facts and the new log.
  const newest = detail.recent[0]
  const identity = [
    job.state,
    `v${job.version}`,
    job.built ? 'built' : 'build-failed',
    newest === undefined ? 'no-run' : `run-${newest.id}`,
  ].join(':')

  return {
    key: explainKey(url, { kind: 'job', id: `${job.env}:${job.name}` }, identity),
    canExplain: FAILED_STATES.has(job.state) || !job.built,
    input: () => ({ facts, error: '', logTail: logTail() }),
    draft: () =>
      draftFor(job.built ? 'job' : 'build', {
        name: job.name,
        installation,
        env: job.env,
        state: job.state,
        error: '',
      }),
    what: `${job.name} (${job.env})`,
  }
}
