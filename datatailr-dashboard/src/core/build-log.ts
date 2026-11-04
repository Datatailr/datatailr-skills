/*************************************************************************
 *
 *  Copyright (c) 2026 Datatailr Inc.
 *
 *  Licensed under the MIT License. See the 'LICENSE' file distributed
 *  with this package for the full license text.
 *
 *  SPDX-License-Identifier: MIT
 *************************************************************************/

// The platform keeps a build log as Docker writes it: one JSON object a line, such as `{"stream": "..."}`,
// `{"status": "...", "id": "...", "progress": "..."}` or `{"error": "..."}`, or plain text. This reads
// it as the `dt` CLI prints it: the text of each object, one line each, without the empty ones.

type DockerLine = {
  stream?: unknown
  error?: unknown
  errorDetail?: { message?: unknown }
  message?: unknown
  status?: unknown
  id?: unknown
  progress?: unknown
}

export function buildLogText(raw: string): string {
  const lines: string[] = []
  for (const line of raw.split('\n')) {
    const text = lineText(line).replace(/\r/g, '').replace(/\n+$/, '')
    if (text.trim() !== '') lines.push(text)
  }
  return lines.length === 0 ? '' : `${lines.join('\n')}\n`
}

function lineText(line: string): string {
  const trimmed = line.trim()
  if (!trimmed.startsWith('{')) return line
  let parsed: unknown
  try {
    parsed = JSON.parse(trimmed)
  } catch {
    return line
  }
  if (typeof parsed !== 'object' || parsed === null) return line
  const entry = parsed as DockerLine
  if (typeof entry.stream === 'string') return entry.stream
  const message = entry.errorDetail?.message ?? entry.message ?? entry.error
  if (typeof message === 'string') return message
  const status = [entry.status, entry.id, entry.progress].filter((part): part is string => typeof part === 'string')
  return status.length === 0 ? line : status.join(' ')
}
