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

import type { Installation } from '../core/installations'
import type { UiCtx } from '../ui/ctx'
import { InstallCli, UrlInput } from './screens'

export function SwitcherButton(ui: UiCtx, p: { installation: string | null; onPress(): void }): RenderElement {
  const { Button } = ui.els

  return <Button key="switcher" label={`${p.installation ?? 'Not connected'} ▾`} plain dimColor onPress={p.onPress} />
}

export function SwitcherList(
  ui: UiCtx,
  p: {
    installations: Installation[]
    current: string | null
    canAdd: boolean
    isAdding: boolean
    canLoginAgain: boolean
    isCliMissing: boolean
    onPick(name: string): void
    onShowAdd(): void
    onAdd(url: string): void
    onLoginAgain(): void
  },
): RenderElement {
  const { Box, Button } = ui.els
  const items: RenderElement[] = p.installations.map(installation => (
    <Button
      key={`inst-${installation.name}`}
      label={installation.name === p.current ? `✓ ${installation.name}` : installation.name}
      plain
      onPress={() => p.onPick(installation.name)}
    />
  ))
  if (p.canAdd) {
    items.push(<Button key="add-installation" label="Add installation" plain onPress={p.onShowAdd} />)
    if (p.isAdding) items.push(UrlInput(ui, { onSubmit: p.onAdd }))
  }
  if (p.canLoginAgain && p.current !== null) {
    items.push(<Button key="login-again" label="Log in again" plain onPress={p.onLoginAgain} />)
  }
  if (p.isCliMissing) items.push(InstallCli(ui))

  return (
    <Box flexDirection="column" alignItems="flex-end">
      {items}
    </Box>
  )
}
