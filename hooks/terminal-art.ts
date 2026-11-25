// The terminal's own small room: a pixel capybara soaking in its hinoki tub,
// drawn in half-block characters (two pixels a cell) for the band above the
// prompt. Steam follows GPU load, the bath heats with GPU temperature, and the
// capybara dozes while Claude rests.

import type { Stats } from './stats-scene.ts'
import { heatTier, isWorking } from './stats-scene.ts'

export const ART_COLUMNS = 18
export const ART_ROWS = 5 // 10 pixels tall

const PALETTE: Record<string, number> = {
  W: 0xc9a272, // hinoki
  D: 0x8a6a4a, // tub band
  A: 0x9cc5c1, // water
  B: 0xe8f4f2, // bubble
  C: 0xa5774c, // capybara
  c: 0x7a5233, // capybara shade, closed eye
  r: 0xc9704f, // flushed fur
  R: 0xe0604a, // blush
  K: 0x1a1410, // eye
  w: 0xffffff, // eye white
  Y: 0xe8b13a, // yuzu
  S: 0xe9e2d6, // steam
  T: 0xf3efe6, // towel
  d: 0x9fd2e3, // sweat drop
}
const DEFAULT = 0x01000000

// One row of the tub and water, shared by every frame.
const TUB = [
  'AAAAAAAAAAAAAAAAAA',
  'WWWWWWWWWWWWWWWWWW',
  'DDDDDDDDDDDDDDDDDD',
  'WWWWWWWWWWWWWWWWWW',
]

// The capybara's head, facing left, with its eye at column 2 of the sprite.
function head(tier: 0 | 1 | 2 | 3, awake: boolean): string[] {
  const fur = tier >= 2 ? 'r' : 'C'
  const eye = tier === 3 ? 'K' : tier === 2 ? 'K' : awake ? 'K' : 'c'
  const cheek = tier >= 1 ? 'R' : fur
  const top = tier === 3 ? '..YT..' : tier === 2 ? '...Y.T' : '..YT..'
  return [
    top,
    `.${fur}${fur}${fur}${fur}c`,
    `c${fur}${eye}${fur}${fur}${fur}`,
    `c${fur}${cheek}${fur}${fur}${fur}`,
    `.${fur}${fur}${fur}${fur}.`,
  ]
}

function grid(s: Stats, frame: number): string[] {
  const rows = Array.from({ length: ART_ROWS * 2 }, () => Array<string>(ART_COLUMNS).fill('.'))
  const put = (x: number, y: number, ch: string) => {
    if (y >= 0 && y < rows.length && x >= 0 && x < ART_COLUMNS && ch !== '.') rows[y]![x] = ch
  }
  const tier = heatTier(s.gpu?.temp)
  const awake = isWorking(s.work) || tier >= 2

  // Head: sits low in the water, or climbs out when the bath is too hot.
  // At its hottest it climbs out: raised a pixel, body showing to the
  // waterline, and a nervous sideways shiver.
  const lift = tier === 3 ? 1 : 0
  const shiver = tier === 3 ? frame % 2 : 0
  const sprite = head(tier, awake)
  sprite.forEach((line, y) => [...line].forEach((ch, x) => put(6 + shiver + x, 1 + y - lift, ch)))
  if (tier === 3) {
    for (let y = sprite.length - lift; y < 6; y++) for (let x = 7; x <= 10; x++) put(x + shiver, y, x === 7 ? 'c' : 'r')
  }
  if (tier >= 2) put(12 + shiver, 2 - lift + (frame % 2), 'd')
  if (tier === 3) put(4 + shiver, 3 - lift, 'd')

  // Water and tub; the waterline holds the head's lower edge.
  TUB.forEach((line, i) => [...line].forEach((ch, x) => { if (i > 0 || rows[6]![x] === '.') put(x, 6 + i, ch) }))

  // Bubbles in the water as it heats.
  const bubbles = [0, 2, 4, 6][tier]!
  for (let i = 0; i < bubbles; i++) put((i * 5 + frame * 3) % ART_COLUMNS, 6, (i + frame) % 2 ? 'B' : 'A')

  // Steam rising from the water: more puffs with more GPU load.
  const puffs = 1 + Math.round((Math.min(100, s.gpu?.util ?? 0) / 100) * 2)
  const columns = [2, 14, 16]
  for (let i = 0; i < puffs; i++) {
    const y = 4 - ((frame + i * 2) % 5)
    put(columns[i]!, y, 'S')
    put(columns[i]! + ((frame + i) % 2 ? 1 : -1), y - 1, 'S')
  }
  return rows.map(r => r.join(''))
}

const encode = (words: Uint32Array): string => {
  const bytes = new Uint8Array(words.buffer)
  const withBase64 = bytes as Uint8Array & { toBase64?: () => string }
  if (typeof withBase64.toBase64 === 'function') return withBase64.toBase64()
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin)
}

// Packs pairs of pixel rows into half-block cells: [codePoint, fg, bg] each.
export function artCells(s: Stats, frame: number): string {
  const px = grid(s, frame)
  const words = new Uint32Array(ART_COLUMNS * ART_ROWS * 3)
  for (let row = 0; row < ART_ROWS; row++) {
    for (let x = 0; x < ART_COLUMNS; x++) {
      const top = PALETTE[px[row * 2]![x]!]
      const bottom = PALETTE[px[row * 2 + 1]![x]!]
      const i = (row * ART_COLUMNS + x) * 3
      if (top !== undefined && bottom !== undefined) words.set([0x2580, top, bottom], i)
      else if (top !== undefined) words.set([0x2580, top, DEFAULT], i)
      else if (bottom !== undefined) words.set([0x2584, bottom, DEFAULT], i)
      else words.set([0x20, DEFAULT, DEFAULT], i)
    }
  }
  return encode(words)
}

// For checking the art in a plain terminal: the pixels as text.
export function artPreview(s: Stats, frame: number): string {
  return grid(s, frame).join('\n')
}
