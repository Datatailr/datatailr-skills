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

import { PANE_ID } from './ids'

// A function declaration, so that `claude plugin validate` follows `$` into it.
export async function isPaneShown($: Engine): Promise<boolean> {
  return (await $.ui.panes()).some(pane => pane.id === PANE_ID && pane.isShown)
}
