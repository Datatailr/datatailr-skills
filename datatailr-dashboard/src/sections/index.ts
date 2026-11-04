/*************************************************************************
 *
 *  Copyright (c) 2026 Datatailr Inc.
 *
 *  Licensed under the MIT License. See the 'LICENSE' file distributed
 *  with this package for the full license text.
 *
 *  SPDX-License-Identifier: MIT
 *************************************************************************/

import { blob } from './blob'
import { compute } from './compute'
import type { Section } from './contract'
import { cost } from './cost'
import { kv } from './kv'
import { launcher } from './launcher'
import { nodes } from './nodes'
import { overview } from './overview'
import { users } from './users'

// In rail order; a route that names no registered section opens the first. A new section is one file
// and one line here. `any`: each section has a data type of its own.
export const SECTIONS: Section<any>[] = [overview, compute, nodes, users, kv, cost, launcher, blob]
