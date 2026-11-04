/*************************************************************************
 *
 *  Copyright (c) 2026 Datatailr Inc.
 *
 *  Licensed under the MIT License. See the 'LICENSE' file distributed
 *  with this package for the full license text.
 *
 *  SPDX-License-Identifier: MIT
 *************************************************************************/

import type { Engine } from '../core/engine'

import type { ItemRef } from '../core/route'
import { oneLine } from './text'

export type DraftKind = 'run' | 'job' | 'node' | 'build'

export type DraftFacts = { name: string; installation: string; env: string; state: string; error: string; id?: string }

const ERROR_CHARS = 300

const SAFETY = 'Do not run commands that change anything without asking me first.'

/** The job's error is one scrubbed line, labeled as job output and quoted, so that it reads as data. */
export function draftFor(kind: DraftKind, facts: DraftFacts): string {
  const { name, installation, env, state } = facts
  const where = `${name} on ${installation} (environment ${env}, state ${state})`

  switch (kind) {
    case 'run': {
      const error = oneLine(facts.error, ERROR_CHARS)
      const said = error === '' ? '' : ` Job output: ${JSON.stringify(error)}.`

      return (
        `Diagnose the failed run #${facts.id ?? ''} of job ${where}.${said} ` +
        `Use the dt CLI to read its logs and definition, explain the root cause and propose a fix. ${SAFETY}`
      )
    }
    case 'job':
      return (
        `Investigate job ${where}. ` +
        `Use the dt CLI to read its definition, recent runs and logs, and explain anything that looks wrong. ${SAFETY}`
      )
    case 'build':
      return (
        `The last build of job ${name} on ${installation} (environment ${env}) failed. ` +
        `Use the dt CLI to read its build logs, explain the cause and propose a fix. ${SAFETY}`
      )
    case 'node':
      return `Investigate node ${where}. Use the dt CLI to inspect it. ${SAFETY}`
  }
}

export function continueDraft(draft: string, explanation: string): string {
  return `${draft}\n\nClaude's first read: ${explanation}`
}

export function explainKey(url: string, item: ItemRef, state: string): string {
  return `${url} ${item.kind}:${item.id}:${state}`
}

let lastDraft: string | null = null

export async function fillDraft($: Engine, text: string): Promise<void> {
  const held = (await $.prompt.read()).text
  const isOurs = lastDraft !== null && held.trim() === lastDraft.trim()
  const filled =
    isOurs
      ? await $.prompt.fill({ text, mode: 'replace' })
      : await $.prompt.fill({ text: held.trim() === '' ? text : `\n\n${text}`, mode: 'append' })
  if (filled.isFilled) lastDraft = text
}
