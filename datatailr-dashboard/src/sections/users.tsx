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

import type { Group, User } from '../core/model'
import type { ItemRef, Route } from '../core/route'
import { ContextLine } from '../ui/assist'
import type { UiCtx } from '../ui/ctx'
import { BackButton } from '../ui/detail'
import { FilterBar } from '../ui/filters'
import { EmptyState, ErrorState } from '../ui/states'
import { type Column, PAGE_SIZE, Table } from '../ui/table'
import { Tabs } from '../ui/tabs'
import { ALL, filterOf, pageOf, pageRows, searchOf } from './listing'
import type { Section, SectionActions, SectionView } from './contract'

export type UserRow = User & { groups: string[] }
export type GroupRow = Group & { names: string[] }
export type UsersData = { users: UserRow[]; groups: GroupRow[] }
type Rows<Row> = { columns: Column<Row>[]; rows: Row[]; rowKey(row: Row): string; onRow(row: Row): void; empty: string }

const TABS = [{ id: 'users', label: 'Users' }, { id: 'groups', label: 'Groups' }]
const CHIPS = [{ id: ALL, label: 'All' }, { id: 'enabled', label: 'Enabled' }, { id: 'disabled', label: 'Disabled' }]
const NO_PAGES = { key: 'users-related', page: 0, hasMore: false, onPage: () => undefined }
const tabOf = (route: Route) => (route.tab === 'groups' ? 'groups' : 'users')
const chipOf = (route: Route) => filterOf(route, 'state', ['enabled', 'disabled'])
const stateOf = (user: User) => (user.isDisabled ? 'disabled' : 'enabled')
const matches = (route: Route, texts: string[]) => texts.some(text => text.toLowerCase().includes(searchOf(route).toLowerCase()))
const missing = (id: number): UserRow => ({ id, name: `#${id}`, fullName: '', email: '', isSystem: false, isDisabled: false, groups: [] })
const itemOf = (data: UsersData | null, item: ItemRef | undefined) => ({
  user: item?.kind === 'user' ? data?.users.find(row => row.name === item.id) : undefined,
  group: item?.kind === 'group' ? data?.groups.find(row => row.name === item.id) : undefined,
})

// The `groups` field of `user ls` is not reliable: the groups of a user are those that list it as a member.
const joined = (users: User[], groups: Group[]): UsersData => ({
  users: users.map(user => ({ ...user, groups: groups.filter(group => group.members.includes(user.id)).map(group => group.name) })),
  groups: groups.map(group => ({ ...group, names: group.members.map(id => users.find(user => user.id === id)?.name ?? `#${id}`) })),
})

const userColumns: Column<UserRow>[] = [
  { id: 'name', title: 'name', width: 16, cell: user => user.name },
  { id: 'full-name', title: 'full name', width: 20, cell: user => user.fullName || '—' },
  { id: 'email', title: 'email', width: 24, cell: user => user.email || '—' },
  { id: 'groups', title: 'groups', width: 20, cell: user => user.groups.join(', ') || '—' },
  { id: 'state', title: 'state', width: 8, cell: stateOf, tone: user => (user.isDisabled ? 'inactive' : '') },
  { id: 'system', title: '', width: 6, cell: user => (user.isSystem ? 'system' : ''), tone: () => 'subtle' },
]

const groupColumns: Column<GroupRow>[] = [
  { id: 'name', title: 'name', width: 20, cell: group => group.name },
  { id: 'members', title: 'members', width: 7, cell: group => String(group.members.length) },
  { id: 'member-names', title: 'member names', width: 60, cell: group => group.names.join(', ') || '—' },
]

const shownUsers = (rows: UserRow[], route: Route) =>
  rows.filter(user => [ALL, stateOf(user)].includes(chipOf(route)) && matches(route, [user.name, user.fullName, user.email]))
const shownGroups = (rows: GroupRow[], route: Route) => rows.filter(group => matches(route, [group.name, ...group.names]))

// A member id that no user has opens nothing.
const rowsOf = <Row extends User | Group>(kind: 'user' | 'group', columns: Column<Row>[], rows: Row[], act: SectionActions): Rows<Row> => ({
  columns,
  rows,
  rowKey: row => `${kind}-${row.name}`,
  onRow: row => (row.name === `#${row.id}` ? undefined : act.go({ item: { kind, id: row.name } })),
  empty: `No ${kind}s.`,
})

function List<Row>(ui: UiCtx, route: Route, act: SectionActions, p: Rows<Row>): RenderElement {
  const { Box } = ui.els
  const page = pageRows(p.rows, route)
  const onPage = (next: number) => act.go({ page: next === 0 ? undefined : next })

  return (
    <Box flexDirection="column" gap={1}>
      {FilterBar(ui, {
        chips: tabOf(route) === 'users' ? CHIPS : [],
        current: chipOf(route),
        onChip: id => act.go({ filter: id === ALL ? undefined : { state: id }, page: undefined }),
        search: searchOf(route),
        onSearch: text => act.go({ search: text.trim() === '' ? undefined : text.trim(), page: undefined }),
      })}
      {Table(ui, { ...p, key: 'users-table', rows: page.rows, page: pageOf(route), hasMore: page.hasMore, onPage })}
      {page.rows.length === 0 ? EmptyState(ui, { text: p.empty }) : null}
    </Box>
  )
}

function ItemPage(ui: UiCtx, view: SectionView<UsersData>, data: UsersData, act: SectionActions): RenderElement {
  const { Box, Text } = ui.els
  const { user, group } = itemOf(data, view.route.item)
  const members = group?.members.map(id => data.users.find(row => row.id === id) ?? missing(id)) ?? []
  const count = user ? user.groups.length : members.length
  const facts = user ? [stateOf(user), user.isSystem && 'system', user.fullName, user.email] : [`${count} member${count === 1 ? '' : 's'}`]
  const table = user
    ? Table(ui, { ...rowsOf('group', groupColumns, data.groups.filter(row => user.groups.includes(row.name)), act), ...NO_PAGES })
    : Table(ui, { ...rowsOf('user', userColumns.slice(0, 3), members, act), ...NO_PAGES })

  return (
    <Box flexDirection="column" gap={1}>
      <Box flexDirection="column">
        {BackButton(ui, { onBack: act.back })}
        <Text size="heading" weight="semibold">{user?.name ?? group?.name}</Text>
        <Text dimColor>{facts.filter(Boolean).join(' · ')}</Text>
      </Box>
      <Box flexDirection="column">
        <Text weight="semibold">{`${user ? 'Groups' : 'Members'}${count > PAGE_SIZE ? `, the first ${PAGE_SIZE} of ${count}` : ''}`}</Text>
        {count === 0 ? EmptyState(ui, { text: user ? 'In no groups.' : 'No members.' }) : table}
      </Box>
      {view.shareContext ? ContextLine(ui, { text: user ? `user ${user.name}` : `group ${group?.name}` }) : null}
    </Box>
  )
}

// Names and groups only: no email, and no search text, which can be one.
function describeUsers({ data, route }: SectionView<UsersData>): string {
  const { user, group } = itemOf(data, route.item)
  if (user) return `User page: user ${user.name}, groups: ${user.groups.join(', ') || 'none'}.`
  if (group) return `Group page: group ${group.name}, members: ${group.names.join(', ') || 'none'}.`
  if (route.item) return `Opened ${route.item.kind} ${route.item.id}, ${data === null ? 'not loaded yet' : 'which no longer exists'}.`

  const tab = tabOf(route)
  const names = (tab === 'users' ? shownUsers(data?.users ?? [], route) : shownGroups(data?.groups ?? [], route)).map(row => row.name)
  const chip = tab === 'users' && chipOf(route) !== ALL ? `, ${chipOf(route)} only` : ''
  const shown = data === null ? 'not loaded yet' : `${names.length} of ${data[tab].length}: ${names.join(', ') || 'none'}`

  return `${tab === 'users' ? 'Users' : 'Groups'} tab${chip}${searchOf(route) === '' ? '' : ', with a search'}: ${shown}.`
}

export const users: Section<UsersData> = {
  id: 'users',
  title: 'User Manager',
  refreshMs: 30_000,
  loadKey: () => 'users',
  load: async api => joined(...(await Promise.all([api.users.list(), api.groups.list()]))),

  render(ui, view, act) {
    const { Box, Text } = ui.els
    const { data, route } = view
    const { user, group } = itemOf(data, route.item)
    if (data !== null && (user || group)) return ItemPage(ui, view, data, act)

    const setTab = (id: string) => act.go({ tab: id, filter: undefined, search: undefined, page: undefined })
    let body: RenderElement
    // The shell's bar tells of an ended session, once.
    if (data === null && (view.error === null || view.error === 'logged-out')) body = <Text dimColor>Loading…</Text>
    else if (data === null) body = ErrorState(ui, { kind: view.error ?? 'server', installation: view.installation })
    else if (route.item) body = EmptyState(ui, { text: `This ${route.item.kind} no longer exists.` })
    else if (tabOf(route) === 'users') body = List(ui, route, act, rowsOf('user', userColumns, shownUsers(data.users, route), act))
    else body = List(ui, route, act, rowsOf('group', groupColumns, shownGroups(data.groups, route), act))
    const tabs = Tabs(ui, { key: 'users-tabs', tabs: TABS, current: tabOf(route), onSelect: setTab })

    return (
      <Box flexDirection="column" gap={1}>
        {route.item ? BackButton(ui, { onBack: act.back }) : tabs}
        {body}
      </Box>
    )
  },

  describe: describeUsers,
}
