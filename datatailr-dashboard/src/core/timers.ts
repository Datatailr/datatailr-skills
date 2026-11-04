/*************************************************************************
 *
 *  Copyright (c) 2026 Datatailr Inc.
 *
 *  Licensed under the MIT License. See the 'LICENSE' file distributed
 *  with this package for the full license text.
 *
 *  SPDX-License-Identifier: MIT
 *************************************************************************/

import type { Engine } from './engine'

// Only `src/core` calls `$.clock`. Function declarations, so that `claude plugin validate` follows `$` into them.

export function after($: Engine, ms: number, fn: () => void): { cancel(): void } {
  return $.clock.after(ms, fn)
}

export function clockNow($: Engine): Promise<number> {
  return $.clock.now()
}

export function abortAfter($: Engine, ms: number): AbortSignal {
  const controller = new AbortController()
  $.clock.after(ms, () => controller.abort())

  return controller.signal
}
