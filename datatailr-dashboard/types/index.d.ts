/*************************************************************************
 *
 *  Copyright (c) 2026 Datatailr Inc.
 *
 *  Licensed under the MIT License. See the 'LICENSE' file distributed
 *  with this package for the full license text.
 *
 *  SPDX-License-Identifier: MIT
 *************************************************************************/

// JSON data only, never a secret. `claude plugin validate` allows no import here, so these types are
// repeated in `src/core/*.ts`; `src/core/state.ts` stops compiling when the two differ.
declare module 'claude-code' {
  interface PluginState {
    'datatailr-dashboard': {
      route: {
        section: 'overview' | 'compute' | 'nodes' | 'users' | 'kv' | 'cost' | 'launcher' | 'blob'
        tab?: string
        filter?: Record<string, string>
        search?: string
        page?: number
        item?: { kind: 'run' | 'job' | 'node' | 'user' | 'group' | 'key' | 'blob'; id: string }
      }
      session:
        | { kind: 'no-cli' }
        | { kind: 'disconnected' }
        | { kind: 'logging-in'; installation: string; method: 'password' | 'device'; link?: string; note?: string }
        | { kind: 'connected'; installation: string; url: string }
        | { kind: 'expired'; installation: string; url: string; since: number }
        | { kind: 'error'; installation: string | null; message: string }
      loads: Record<
        string,
        {
          data: unknown
          fetchedAt: number | null
          error: 'logged-out' | 'no-access' | 'not-available' | 'network' | 'server' | null
          failures: number
          nextAt: number
          inFlight: boolean
          errorTag?: string
        }
      >
      confirm: {
        action:
          | { verb: 'start' | 'stop' | 'rerun'; job: string; env: string; runId?: number }
          | { verb: 'drain' | 'undrain'; node: string; host: string }
        question: string
        yesLabel: string
        url: string
        result?: { ok: boolean; text: string; at: number }
      } | null
      explain: Record<string, { status: 'loading' } | { status: 'done'; text: string } | { status: 'failed' }>
      log: {
        key: string
        job: string
        env: string
        runId?: number
        stream: 'stdout' | 'stderr'
        lines: number
        follow: boolean
        text: string
        isLoading: boolean
        error?: string
      } | null
      switcherOpen: boolean
      lastContext: string | null
    }
  }
}
