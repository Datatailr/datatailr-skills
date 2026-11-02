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

import type { Endpoints } from '../core/endpoints'
import type { KvAcl, KvItem, KvList } from '../core/model'
import type { Route } from '../core/route'
import type { UiCtx } from '../ui/ctx'
import { BackButton } from '../ui/detail'
import { FilterBar } from '../ui/filters'
import { EmptyState, ErrorState } from '../ui/states'
import { type Column, Table } from '../ui/table'
import { Tabs } from '../ui/tabs'
import { cut, stripAnsi } from '../ui/text'
import { ALL, filterOf, pageOf, pageRows, searchOf } from './listing'
import type { Section, SectionActions, SectionView } from './contract'

// Read-only. The plugin never calls `kv get`, and `kv ls` with `secure` sends no value: no call reads a secret.

const TABS = [{ id: 'variables', label: 'Variables' }, { id: 'secrets', label: 'Secrets' }] as const
const ENVIRONMENTS = ['dev', 'pre', 'prod']
const PERMISSIONS = ['read', 'write', 'operate', 'access', 'promote'] as const
const EVERYONE = -1000
const VALUE_CHARS = 20_000

type Kind = (typeof TABS)[number]['id']
type KeyPage = { key: KvItem | null; acl: Record<keyof KvAcl, string[]> }
export type KvData = { list: KvList } | KeyPage

const kindOf = (route: Route): Kind => (route.tab === 'secrets' ? 'secrets' : 'variables')
const idOf = (item: KvItem) => `${item.env}:${item.key}`
const keyPageOf = (data: KvData | null) => (data !== null && 'acl' in data ? data : null)

async function loadKeyPage(api: Endpoints, kind: Kind, id: string): Promise<KeyPage> {
  const [list, users, groups] = await Promise.all([api.kv.list(kind), api.users.list(), api.groups.list()])
  const key = list.items.find(item => idOf(item) === id) ?? null
  const names = new Map<number, string>(users.map(user => [user.id, user.name]))
  for (const group of groups) names.set(-group.id, `${group.name} (group)`)
  names.set(EVERYONE, 'everyone')
  const nameOf = (aclId: number) => names.get(aclId) ?? (aclId < 0 ? `group ${-aclId}` : `user ${aclId}`)
  const acl = Object.fromEntries(PERMISSIONS.map(name => [name, (key?.acl?.[name] ?? []).map(nameOf)]))

  return { key, acl: acl as KeyPage['acl'] }
}

const columns = (kind: Kind): Column<KvItem>[] => [
  { id: 'key', title: 'key', width: 32, cell: item => item.key },
  { id: 'environment', title: 'environment', width: 11, cell: item => item.env },
  ...(kind === 'secrets' ? [] : [{ id: 'value', title: 'value', width: 48, cell: (item: KvItem) => item.value ?? '—' }]),
]

function Pending(ui: UiCtx, view: SectionView<KvData>): RenderElement {
  const { Text } = ui.els
  // The shell's bar tells of an ended session, once.
  if (view.error === null || view.error === 'logged-out') return <Text dimColor>Loading…</Text>

  return ErrorState(ui, { kind: view.error, installation: view.installation })
}

function List(ui: UiCtx, route: Route, list: KvList, act: SectionActions): RenderElement {
  const { Box, Text } = ui.els
  const kind = kindOf(route)
  const env = filterOf(route, 'env', ENVIRONMENTS)
  const search = searchOf(route).toLowerCase()
  const rows = list.items.filter(item => (env === ALL || item.env === env) && item.key.toLowerCase().includes(search))
  const page = pageRows(rows, route)
  const options = [ALL, ...ENVIRONMENTS].map(value => ({ value, label: value }))
  const onSelect = (value: string) => act.go({ filter: value === ALL ? undefined : { env: value }, page: undefined })

  return (
    <Box flexDirection="column" gap={1}>
      {FilterBar(ui, {
        chips: [],
        current: ALL,
        onChip: () => undefined,
        selects: [{ id: 'env-filter', label: 'Environment', options, value: env, onSelect }],
        search: searchOf(route),
        onSearch: text => act.go({ search: text.trim() === '' ? undefined : text.trim(), page: undefined }),
      })}
      {list.total > list.items.length ? <Text dimColor>{`Showing the first ${list.items.length} of ${list.total} keys.`}</Text> : null}
      {Table(ui, {
        key: 'kv-table',
        columns: columns(kind),
        rows: page.rows,
        rowKey: item => `key-${item.env}-${item.key}`,
        onRow: item => act.go({ item: { kind: 'key', id: idOf(item) } }),
        page: pageOf(route),
        hasMore: page.hasMore,
        onPage: next => act.go({ page: next === 0 ? undefined : next }),
      })}
      {rows.length === 0 ? EmptyState(ui, { text: kind === 'secrets' ? 'No secrets.' : 'No variables.' }) : null}
    </Box>
  )
}

function Key(ui: UiCtx, page: KeyPage, isSecret: boolean): RenderElement {
  const { Box, Code, Text } = ui.els
  const { key, acl } = page
  if (key === null) return EmptyState(ui, { text: 'This key no longer exists.' })
  const shown = cut(stripAnsi(key.value ?? ''), VALUE_CHARS)

  return (
    <Box flexDirection="column" gap={1}>
      <Box flexDirection="column">
        <Text size="heading" weight="semibold">{stripAnsi(key.key)}</Text>
        <Text dimColor>{`${isSecret ? 'secret' : 'variable'} · ${key.env}`}</Text>
      </Box>
      {isSecret ? <Text dimColor>The pane never shows a secret value.</Text> : <Code source={shown} />}
      <Box flexDirection="column">
        <Text weight="semibold">ACL</Text>
        {PERMISSIONS.map(name => <Text>{`${name}: ${acl[name].join(', ') || '—'}`}</Text>)}
      </Box>
    </Box>
  )
}

// Keys and environments only: a variable can hold a secret by mistake, so no value goes to Claude.
function describeKv(view: SectionView<KvData>): string {
  const { route } = view
  const kind = kindOf(route) === 'secrets' ? 'Secret' : 'Variable'
  const key = keyPageOf(view.data)?.key ?? null
  if (route.item !== undefined)
    return key === null ? `Opened ${kind.toLowerCase()} ${route.item.id}.` : `${kind} page: key ${key.key}, environment ${key.env}.`
  const env = filterOf(route, 'env', ENVIRONMENTS)
  const search = searchOf(route)
  const where = env === ALL ? 'All environments.' : `Environment ${env}.`

  return [`${kind}s tab.`, where, ...(search === '' ? [] : [`Search: "${search}".`])].join(' ')
}

export const kv: Section<KvData> = {
  id: 'kv',
  title: 'KV and Secrets',
  refreshMs: 30_000,
  loadKey: route => (route.item === undefined ? kindOf(route) : `${kindOf(route)}:${route.item.id}`),

  async load(api, route) {
    return route.item === undefined ? { list: await api.kv.list(kindOf(route)) } : loadKeyPage(api, kindOf(route), route.item.id)
  },

  render(ui, view, act) {
    const { Box } = ui.els
    const { route, data } = view
    const page = keyPageOf(data)
    const onTab = (id: string) => act.go({ tab: id, filter: undefined, search: undefined, page: undefined })
    const tabs = Tabs(ui, { key: 'kv-tabs', tabs: [...TABS], current: kindOf(route), onSelect: onTab })
    let body = Pending(ui, view)
    if (route.item === undefined && data !== null && 'list' in data) body = List(ui, route, data.list, act)
    else if (page !== null) body = Key(ui, page, kindOf(route) === 'secrets')

    return (
      <Box flexDirection="column" gap={1}>
        {route.item === undefined ? tabs : BackButton(ui, { onBack: act.back })}
        {body}
      </Box>
    )
  },

  describe: describeKv,
}
