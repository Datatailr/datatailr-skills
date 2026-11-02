/*************************************************************************
 *
 *  Copyright (c) 2026 Datatailr Inc.
 *
 *  Licensed under the MIT License. See the 'LICENSE' file distributed
 *  with this package for the full license text.
 *
 *  SPDX-License-Identifier: MIT
 *************************************************************************/

import type { EngineInterface, RenderSurface } from 'claude-code'

/** Kit components are pure functions `(ui, props)`: they call no `$` and keep no state. */
export type UiCtx = {
  els: ReturnType<EngineInterface['ui']['resolve']>
  surface: RenderSurface
  columns: number
}
