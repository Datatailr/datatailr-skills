/*************************************************************************
 *
 *  Copyright (c) 2026 Datatailr Inc.
 *
 *  Licensed under the MIT License. See the 'LICENSE' file distributed
 *  with this package for the full license text.
 *
 *  SPDX-License-Identifier: MIT
 *************************************************************************/

import type { EngineInterface, PluginState, StateRead, StateSetOptions, StateSetResult } from 'claude-code'

// The part of the engine that the modules use. The hooks module builds it from `$` with one plain
// `$.noun.method(...)` call per method, because the plugin directory reads `$` only in that file and
// refuses `$` passed to a function of another file. The tests pass their fake engine as it is.
// The variables the modules read. A new one needs a case in `engineOf` of the hooks module.
export type EnvName = 'HOME' | 'OS' | 'PATH' | 'USERPROFILE'

// The keys of the plugin's state. A new one needs a case in `engineOf` of the hooks module too.
export type StateKey =
  | 'route'
  | 'session'
  | 'loads'
  | 'confirm'
  | 'explain'
  | 'log'
  | 'switcherOpen'
  | 'cliMissing'
  | 'lastContext'
export type StateKeyRef = { readonly plugin: 'datatailr-dashboard'; readonly key: StateKey }
export type StateValueOf<K extends StateKey> = PluginState['datatailr-dashboard'][K]

export type Engine = {
  clock: Pick<EngineInterface['clock'], 'after' | 'every' | 'now'>
  env: { get: (name: EnvName) => Promise<string | undefined> }
  fs: Pick<EngineInterface['fs'], 'exists' | 'list' | 'stat' | 'write'> & { read: (path: string) => Promise<string> }
  http: Pick<EngineInterface['http'], 'fetch'>
  model: Pick<EngineInterface['model'], 'complete'>
  process: Pick<EngineInterface['process'], 'run' | 'spawn'>
  prompt: Pick<EngineInterface['prompt'], 'fill' | 'read'>
  state: {
    get: (ref: StateKeyRef) => Promise<StateRead<unknown>>
    set: (ref: StateKeyRef, value: StateValueOf<StateKey>, options?: StateSetOptions) => Promise<StateSetResult>
  }
  store: Pick<EngineInterface['store'], 'get' | 'set'>
  ui: Pick<EngineInterface['ui'], 'invalidate' | 'open' | 'panes' | 'resolve'>
}
