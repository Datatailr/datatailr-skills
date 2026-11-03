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

import type { SessionState } from '../core/session'
import type { UiCtx } from '../ui/ctx'

type LoggingIn = Extract<SessionState, { kind: 'logging-in' }>

const savedHint = (folder: string) =>
  `The plugin saves the URL in ${folder.replace(/\/+$/, '')}/. Add DATATAILR_USER_NAME and DATATAILR_USER_PASSWORD ` +
  'to that file to log in without the browser next time.'

/** How to get the CLI: the whole screen with no session, and in place of a login that found no CLI. */
export function InstallCli(ui: UiCtx): RenderElement {
  const { Box, Code, Text } = ui.els

  return (
    <Box flexDirection="column" gap={1}>
      <Text>Install the datatailr package to connect:</Text>
      <Code source="pip install datatailr" language="sh" />
      <Text dimColor>If it is installed in a virtual environment, set its path in the plugin option "cliPath".</Text>
    </Box>
  )
}

/** A surface that draws no `Input` (the mobile app) gets a line that says where to type the URL. */
export function UrlInput(ui: UiCtx, p: { onSubmit(url: string): void }): RenderElement {
  if (!('Input' in ui.els)) {
    const { Text } = ui.els
    return <Text dimColor>Add an installation from Claude Code on a computer.</Text>
  }
  const { Input } = ui.els

  return (
    <Input
      key="url"
      label="Datatailr URL"
      placeholder="https://<name>.datatailr.com"
      submitLabel="connect"
      onSubmit={url => p.onSubmit(url)}
    />
  )
}

export function DisconnectedScreen(ui: UiCtx, p: { folder: string; onSubmit(url: string): void }): RenderElement {
  const { Box, Text } = ui.els

  return (
    <Box flexDirection="column" gap={1}>
      <Text weight="semibold">Connect to Datatailr</Text>
      {UrlInput(ui, p)}
      <Text dimColor>{savedHint(p.folder)}</Text>
    </Box>
  )
}

/** Only a device login can be cancelled; a password login ends by itself within a minute. */
export function LoggingInScreen(ui: UiCtx, p: { session: LoggingIn; onCancel(): void }): RenderElement {
  const { Box, Button, Link, Text } = ui.els
  const { installation, method, link, note } = p.session
  const parts: RenderElement[] = [<Text>{`Logging in to ${installation}…`}</Text>]
  if (note !== undefined) parts.push(<Text color="warning">{note}</Text>)
  if (method === 'device' && link !== undefined) {
    parts.push(<Link href={link} label="Open in browser" />)
    parts.push(<Text dimColor>{link}</Text>)
  }
  if (method === 'device') parts.push(<Button key="cancel-login" label="Cancel" onPress={p.onCancel} />)

  return (
    <Box flexDirection="column" gap={1}>
      {parts}
    </Box>
  )
}

export function ErrorScreen(ui: UiCtx, p: { message: string; onRetry(): void }): RenderElement {
  const { Box, Button, Text } = ui.els

  return (
    <Box flexDirection="column" gap={1}>
      <Text color="error">{p.message}</Text>
      <Button key="retry" label="Try again" onPress={p.onRetry} />
    </Box>
  )
}

export function ExpiredBar(ui: UiCtx, p: { isCliMissing: boolean; onLoginAgain(): void }): RenderElement {
  const { Box, Button, Text } = ui.els
  const bar = (
    <Box flexWrap="wrap" gap={1}>
      <Text color="warning">Your session ended.</Text>
      <Button key="login-again" label="Log in again" onPress={p.onLoginAgain} />
    </Box>
  )
  if (!p.isCliMissing) return bar

  return (
    <Box flexDirection="column" gap={1}>
      {bar}
      {InstallCli(ui)}
    </Box>
  )
}
