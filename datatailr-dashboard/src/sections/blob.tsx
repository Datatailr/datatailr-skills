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

import { decodeText } from '../core/decode'
import { type Endpoints, LIST_LIMIT } from '../core/endpoints'
import type { BlobEntry } from '../core/model'
import type { Route } from '../core/route'
import type { UiCtx } from '../ui/ctx'
import { BackButton } from '../ui/detail'
import { FilterBar } from '../ui/filters'
import { EmptyState, ErrorState } from '../ui/states'
import { type Column, PAGE_SIZE, Table } from '../ui/table'
import { age, stripAnsi } from '../ui/text'
import type { Section, SectionActions, SectionView } from './contract'

// No call lists the buckets of a cloud installation: the section browses the bucket of the Python SDK.
const PREFIX_TAG = 'blob_storage_prefix'
const NO_PREFIX = 'This installation has no blob storage prefix.'
const PREVIEW_BYTES = 64 * 1024
const PREVIEW_LINES = 200

type Preview = { text: string } | { reason: string }
type ListData = { kind: 'list'; bucket: string; folder: string; entries: BlobEntry[] }
type FileData = { kind: 'file'; bucket: string; key: string; entry: BlobEntry | null; preview: Preview | null }
export type BlobData = { kind: 'no-prefix' } | ListData | FileData

const folderOf = (route: Route) => route.filter?.path ?? ''

const searchOf = (route: Route) => route.search?.trim() ?? ''

const pageOf = (route: Route) => Math.max(0, Math.floor(route.page ?? 0))

const lastPart = (name: string) => name.replace(/\/$/, '').split('/').pop() ?? name

const entryName = (entry: BlobEntry) => (entry.isFile ? lastPart(entry.name) : `${lastPart(entry.name)}/`)

const byKindThenName = (a: BlobEntry, b: BlobEntry) => Number(a.isFile) - Number(b.isFile) || a.name.localeCompare(b.name)

const UNITS = ['B', 'KB', 'MB', 'GB', 'TB']

function sizeText(bytes: number): string {
  const unit = Math.min(UNITS.length - 1, Math.floor(Math.log2(Math.max(bytes, 1)) / 10))
  return unit === 0 ? `${bytes} B` : `${(bytes / 1024 ** unit).toFixed(1)} ${UNITS[unit]}`
}

// The platform sends no valid size or date for a folder.
const columns = (now: number): Column<BlobEntry>[] => [
  { id: 'name', title: 'name', width: 48, cell: entryName },
  { id: 'size', title: 'size', width: 9, cell: entry => (entry.isFile ? sizeText(entry.size) : '') },
  { id: 'age', title: 'age', width: 4, cell: entry => (entry.isFile ? age(now, entry.modified) : '') },
]

function shownEntries(data: ListData, route: Route): BlobEntry[] {
  const search = searchOf(route).toLowerCase()
  // A store can list the marker object of the folder itself.
  return data.entries.filter(entry => entry.name !== data.folder && entryName(entry).toLowerCase().includes(search))
}

function levelsOf(data: ListData): { label: string; path: string }[] {
  const parts = data.folder.split('/').filter(part => part !== '')
  const levels = parts.map((part, i) => ({ label: `${part}/`, path: `${parts.slice(0, i + 1).join('/')}/` }))
  return [{ label: `${data.bucket}/`, path: '' }, ...levels]
}

const openFolder = (act: SectionActions, path: string) =>
  act.go({ filter: path === '' ? undefined : { path }, search: undefined, page: undefined })

const setSearch = (act: SectionActions, text: string) => act.go({ search: text.trim() === '' ? undefined : text.trim(), page: undefined })

// The size of the listing decides, so a file larger than the limit is never read.
async function previewOf(api: Endpoints, bucket: string, entry: BlobEntry): Promise<Preview> {
  if (entry.size > PREVIEW_BYTES) return { reason: 'No preview: the file is larger than 64 KB.' }
  const text = decodeText(await api.blobs.get(bucket, entry.name))
  if (text === null) return { reason: 'No preview: the file is not text.' }
  return { text: text.split('\n').slice(0, PREVIEW_LINES).join('\n') }
}

function Waiting(ui: UiCtx, view: SectionView<BlobData>): RenderElement {
  const { Text } = ui.els
  // The shell's bar tells of an ended session, once.
  if (view.error === null || view.error === 'logged-out') return <Text dimColor>Loading…</Text>
  return ErrorState(ui, { kind: view.error, installation: view.installation })
}

function FolderList(ui: UiCtx, view: SectionView<BlobData>, data: ListData, act: SectionActions): RenderElement {
  const { Box, Button, Text } = ui.els
  const { route } = view
  const page = pageOf(route)
  const rows = shownEntries(data, route)

  return (
    <Box flexDirection="column" gap={1}>
      <Box flexWrap="wrap">
        {levelsOf(data).map((level, i) => (
          <Button key={`path-${i}`} plain label={level.label} onPress={() => openFolder(act, level.path)} />
        ))}
      </Box>
      {FilterBar(ui, { chips: [], current: '', onChip: () => undefined, search: searchOf(route), onSearch: text => setSearch(act, text) })}
      {data.entries.length >= LIST_LIMIT ? <Text dimColor>{`Showing the first ${LIST_LIMIT} entries.`}</Text> : null}
      {Table(ui, {
        key: 'blob-table',
        columns: columns(view.now),
        rows: rows.slice(page * PAGE_SIZE),
        rowKey: entry => `entry-${entry.name}`,
        onRow: entry => (entry.isFile ? act.go({ item: { kind: 'blob', id: entry.name } }) : openFolder(act, entry.name)),
        page,
        hasMore: rows.length > (page + 1) * PAGE_SIZE,
        onPage: next => act.go({ page: next === 0 ? undefined : next }),
      })}
      {rows.length === 0 ? EmptyState(ui, { text: 'No entries.' }) : null}
    </Box>
  )
}

function FileBody(ui: UiCtx, data: FileData, now: number): RenderElement {
  const { Box, Code, Text } = ui.els
  const { entry, preview } = data
  if (entry === null) return EmptyState(ui, { text: 'This file no longer exists.' })

  const folder = `${data.bucket}/${data.key.slice(0, data.key.lastIndexOf('/') + 1)}`
  const facts = [folder, sizeText(entry.size), entry.modified === null ? '' : `${age(now, entry.modified)} ago`]

  return (
    <Box flexDirection="column" gap={1}>
      <Text dimColor>{facts.filter(fact => fact !== '').join(' · ')}</Text>
      {preview === null ? null : 'text' in preview ? (
        <Code path={data.key} source={stripAnsi(preview.text)} />
      ) : (
        <Text dimColor>{preview.reason}</Text>
      )}
    </Box>
  )
}

export const blob: Section<BlobData> = {
  id: 'blob',
  title: 'Blob storage',
  refreshMs: 60_000,
  loadKey: route => (route.item === undefined ? `folder:${folderOf(route)}` : `file:${route.item.id}`),

  async load(api, route) {
    const prefix = (await api.tags.get(PREFIX_TAG)).trim()
    if (prefix === '') return { kind: 'no-prefix' }

    const bucket = `${prefix}user-data`
    if (route.item === undefined) {
      const folder = folderOf(route)
      const entries = await api.blobs.list(`${bucket}/${folder}`)
      return { kind: 'list', bucket, folder, entries: entries.sort(byKindThenName) }
    }
    const key = route.item.id
    const entry = (await api.blobs.list(`${bucket}/${key}`)).find(found => found.isFile && found.name === key) ?? null
    return { kind: 'file', bucket, key, entry, preview: entry === null ? null : await previewOf(api, bucket, entry) }
  },

  render(ui, view, act) {
    const { Box, Text } = ui.els
    const { data, route } = view
    if (data?.kind === 'list') return FolderList(ui, view, data, act)

    let body: RenderElement
    if (data === null) body = Waiting(ui, view)
    else if (data.kind === 'no-prefix') body = EmptyState(ui, { text: NO_PREFIX })
    else body = FileBody(ui, data, view.now)
    if (route.item === undefined) return body

    return (
      <Box flexDirection="column" gap={1}>
        {BackButton(ui, { onBack: act.back })}
        <Text size="heading" weight="semibold">{lastPart(route.item.id)}</Text>
        {body}
      </Box>
    )
  },

  // The folder and the names on screen, never the content of a file.
  describe({ data, route }) {
    if (data === null) return null
    if (data.kind === 'no-prefix') return NO_PREFIX
    if (data.kind === 'file') return `File page: ${data.key} in bucket ${data.bucket}.`

    const page = pageOf(route)
    const names = shownEntries(data, route).slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map(entryName)
    const search = searchOf(route)
    return [
      `Bucket ${data.bucket}, folder /${data.folder}.`,
      ...(search === '' ? [] : [`Search: "${search}".`]),
      names.length === 0 ? 'No entries on screen.' : `On screen: ${names.join(', ')}.`,
    ].join(' ')
  },
}
