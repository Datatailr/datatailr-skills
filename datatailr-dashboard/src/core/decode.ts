/*************************************************************************
 *
 *  Copyright (c) 2026 Datatailr Inc.
 *
 *  Licensed under the MIT License. See the 'LICENSE' file distributed
 *  with this package for the full license text.
 *
 *  SPDX-License-Identifier: MIT
 *************************************************************************/

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
const BASE64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/

/** The text of a base64 answer, or null when it is not base64, not UTF-8, or holds a NUL. */
export function decodeText(base64: string): string | null {
  if (!BASE64.test(base64)) return null

  // Each byte becomes `%xx`: decodeURIComponent rejects what is not UTF-8, overlong forms and surrogates too.
  let escaped = ''
  let buffer = 0
  let bits = 0
  for (const char of base64.replace(/=+$/, '')) {
    buffer = ((buffer << 6) | ALPHABET.indexOf(char)) & 0xfff
    bits += 6
    if (bits < 8) continue
    bits -= 8
    escaped += `%${((buffer >> bits) & 0xff).toString(16).padStart(2, '0')}`
  }
  try {
    const text = decodeURIComponent(escaped)
    return text.includes('\u0000') ? null : text
  } catch {
    return null
  }
}
