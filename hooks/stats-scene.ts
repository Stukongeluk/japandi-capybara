// Weaves live machine and Claude usage figures into the room, no gauges:
//   RAM    -> shoji panes glowing warm, filling from the bottom up
//   CPU    -> the samurai's incense: more wisps, rising faster, a brighter ember
//   GPU    -> steam from the hinoki tub: more puffs, rising faster
//   Claude -> sakura blossoms left on the branch; used ones fall onto the shelf
// Each figure is also written small, like brushwork, beside its object.

import type { SessionRateLimit } from 'claude-code'

import { SCENE } from './scene.ts'

export type Gpu = { util: number; memUsed: number; memTotal: number; temp: number }

export type Stats = {
  cpu?: number
  ramUsed?: number
  ramTotal?: number
  gpu?: Gpu
  limits: readonly SessionRateLimit[]
  work?: Work
  /** How full the conversation's context window is, 0 to 100. */
  context?: number
}

export type PlanItem = { content: string; status: 'pending' | 'in_progress' | 'completed' }

// What the scroll shows: what Claude is doing now, the task list, and work
// started in the background (subagents and background commands).
export type Work = {
  now: string
  plan: readonly PlanItem[]
  background: readonly { label: string; since: number }[]
}

const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const cut = (t: string, n: number) => (t.length > n ? `${t.slice(0, n - 1)}…` : t)

// Splits a line into at most two rows of about `n` characters, at a space.
function wrap2(t: string, n: number): [string, string] {
  if (t.length <= n) return [t, '']
  const at = t.lastIndexOf(' ', n)
  const head = at > n / 2 ? t.slice(0, at) : t.slice(0, n)
  return [head, cut(t.slice(head.length).trim(), n)]
}

// A hanging kakejiku scroll beside the round window.
function scroll(w: Work | undefined): string {
  const work = w ?? { now: 'Resting', plan: [], background: [] }
  const [n1, n2] = wrap2(work.now, 30)
  const rows: string[] = []
  let y = 216
  const line = (cls: string, text: string, x = 474) => {
    rows.push(`<text class="lbl ${cls}" x="${x}" y="${y}">${esc(text)}</text>`)
  }

  line('lbl-w', n1)
  if (n2) {
    y += 21
    line('lbl-w', n2)
  }

  if (work.plan.length > 0) {
    y += 14
    rows.push(`<path class="scroll-rule" d="M474 ${y}H726"/>`)
    const doneCount = work.plan.filter(p => p.status === 'completed').length
    y += 20
    line('lbl-w scroll-h', `計画 Plan  ${doneCount}/${work.plan.length}`)
    const active = Math.max(0, work.plan.findIndex(p => p.status !== 'completed'))
    const start = Math.max(0, Math.min(active - 1, work.plan.length - 3))
    const shown = work.plan.slice(start, start + 3)
    for (const item of shown) {
      y += 21
      const mark = item.status === 'completed' ? '✓' : item.status === 'in_progress' ? '▸' : '・'
      const cls = item.status === 'completed' ? 'lbl-w scroll-done' : item.status === 'in_progress' ? 'lbl-w scroll-now' : 'lbl-w'
      line(cls, `${mark} ${cut(item.content, 30)}`)
    }
  }

  if (work.background.length > 0) {
    y += 14
    rows.push(`<path class="scroll-rule" d="M474 ${y}H726"/>`)
    y += 20
    line('lbl-w scroll-h', '裏 Background')
    for (const b of work.background.slice(-2)) {
      y += 21
      const d = new Date(b.since)
      line('lbl-w', `${pad(d.getHours())}:${pad(d.getMinutes())} ${cut(b.label, 24)}`)
    }
  }

  const bottom = Math.max(y + 22, 300)
  return `
    <g class="kakejiku">
      <path class="cord" stroke-width="1.5" d="M600 100L470 136M600 100L730 136"/>
      <circle class="frame" cx="600" cy="100" r="4"/>
      <rect class="scroll-mount" x="452" y="140" width="296" height="${bottom - 140}"/>
      <rect class="scroll-paper" x="460" y="152" width="280" height="${bottom - 164}"/>
      <rect class="scroll-rod" x="444" y="136" width="312" height="8" rx="4"/>
      <rect class="scroll-rod" x="444" y="${bottom - 2}" width="312" height="10" rx="5"/>
      <text class="lbl lbl-k" x="600" y="186" text-anchor="middle">今 · Now</text>
      ${rows.join('\n      ')}
    </g>`
}

const clamp = (n: number, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, n))
const pad = (n: number) => String(n).padStart(2, '0')
const pct = (n: number) => `${Math.round(n)}%`

const STATS_CSS = `
  .lbl { font-family: 'Yu Mincho', 'Hiragino Mincho ProN', 'Noto Serif JP', serif; fill: #4a3726; letter-spacing: 1px; }
  .lbl-k { font-size: 21px; fill: #8a4a32; }
  .lbl-v { font-size: 17px; }
  .lbl-s { font-size: 13px; fill: #6b5844; }
  .burn { fill: #6b4f33; opacity: 0.85; }
  .plaque { fill: #ecd9b6; stroke: #a88560; stroke-width: 2; }
  .lbl-w { font-size: 17px; }
  .scroll-mount { fill: #b9b08c; }
  .scroll-paper { fill: #fbf5e7; }
  .scroll-rod { fill: #6b4a35; }
  .scroll-rule { stroke: #c9b79a; stroke-width: 1; fill: none; }
  .scroll-h { fill: #8a4a32; }
  .scroll-now { fill: #2d2620; font-weight: 600; }
  .scroll-done { fill: #9a8a76; }
  .lit { fill: #f8d792; opacity: 0.55; animation: litpulse 9s ease-in-out infinite; }
  @keyframes litpulse { 0%, 100% { opacity: 0.45; } 50% { opacity: 0.7; } }
  .fallen { fill: #f2c6cf; }
  /* the bath heats with the GPU */
  .bubble { fill: #eef7f5; stroke: #9cc5c1; stroke-width: 1; opacity: 0; transform-box: fill-box; transform-origin: center; animation: bubble 3s ease-in infinite; }
  @keyframes bubble { 0% { transform: translateY(0px) scale(0.6); opacity: 0; } 20% { opacity: 0.9; } 90% { opacity: 0.8; } 100% { transform: translateY(-26px) scale(1.15); opacity: 0; } }
  .flush { fill: #e0604a; opacity: 0.3; }
  .drop { fill: #a9d8e6; animation: drip 2.4s ease-in infinite; }
  @keyframes drip { 0% { transform: translateY(0px); opacity: 0; } 15% { opacity: 1; } 100% { transform: translateY(16px); opacity: 0; } }
  .eyewhite { fill: #ffffff; }
  .shock { stroke: #6b4f33; stroke-width: 3; stroke-linecap: round; fill: none; animation: shock 1.6s ease-in-out infinite; }
  @keyframes shock { 0%, 100% { opacity: 0.35; } 50% { opacity: 0.9; } }
  .shiver { animation: shiver 0.7s ease-in-out infinite; }
  @keyframes shiver { 0%, 100% { transform: translateX(-1.5px); } 50% { transform: translateX(1.5px); } }
  .hot { fill: #b4473a !important; }
  /* sword practice */
  .blade { fill: #e4e8ea; stroke: #9aa3a8; stroke-width: 1; }
  .swing { transform-origin: 0px 0px; animation: cut 4.2s infinite; }
  @keyframes cut {
    0%, 30% { transform: rotate(-8deg); animation-timing-function: ease-out; }
    40% { transform: rotate(-22deg); animation-timing-function: cubic-bezier(.8,0,.2,1); }
    47% { transform: rotate(118deg); animation-timing-function: ease-out; }
    52%, 70% { transform: rotate(112deg); animation-timing-function: ease-in-out; }
    92%, 100% { transform: rotate(-8deg); }
  }
  .smear-arc { fill: #fffaf0; opacity: 0; animation: smeararc 4.2s infinite; }
  @keyframes smeararc { 0%, 41% { opacity: 0; } 46% { opacity: 0.6; } 56%, 100% { opacity: 0; } }
  .kata { animation: dip 4.2s infinite; }
  @keyframes dip { 0%, 42% { transform: translateY(0px); } 48%, 66% { transform: translateY(4px); } 90%, 100% { transform: translateY(0px); } }
`

// The blossom spots along the branches, the first ones the last to fall.
const BLOSSOMS: readonly [number, number, number][] = [
  [470, 456, 9], [518, 510, 8], [520, 420, 9], [392, 480, 8], [450, 480, 7],
  [500, 436, 8], [492, 500, 7], [404, 508, 7], [535, 430, 6], [487, 446, 6],
  [462, 497, 6], [428, 515, 6], [510, 428, 5], [400, 494, 5],
]
const FALLEN_SPOTS: readonly [number, number][] = [
  [448, 686], [462, 688], [372, 687], [476, 686], [358, 688], [441, 689], [470, 689],
  [350, 686], [455, 685], [366, 689], [482, 688], [344, 688], [436, 686], [378, 685],
]

function blossoms(usedPct: number | undefined): string {
  const left = usedPct === undefined ? BLOSSOMS.length : Math.round(((100 - clamp(usedPct)) / 100) * BLOSSOMS.length)
  const on = BLOSSOMS.slice(0, left)
  const bloom = on.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}"/>`).join('')
  const centres = on.filter(([, , r]) => r >= 7).map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3"/>`).join('')
  return `<g class="bloom">${bloom}</g><g class="bloom-c">${centres}</g>`
}

function fallen(usedPct: number | undefined): string {
  if (usedPct === undefined) return ''
  const n = BLOSSOMS.length - Math.round(((100 - clamp(usedPct)) / 100) * BLOSSOMS.length)
  return FALLEN_SPOTS.slice(0, n)
    .map(([x, y], i) => `<ellipse class="fallen" cx="${x}" cy="${y}" rx="5" ry="2" transform="rotate(${(i * 37) % 60 - 30} ${x} ${y})"/>`)
    .join('')
}

// 36 shoji panes, bottom row first, left panel then right.
function shojiCells(ramPct: number | undefined): string {
  if (ramPct === undefined) return ''
  const xs = [[1152, 1217, 1281, 1346], [1354, 1419, 1483, 1548]] as const
  const ys = [82, 160, 238, 316, 394, 472, 548]
  const cells: string[] = []
  for (let row = 5; row >= 0; row--) {
    for (const edges of xs) {
      for (let c = 0; c < 3; c++) {
        const x0 = edges[c]! + 2
        const x1 = edges[c + 1]! - 2
        const y0 = ys[row]! + 2
        const y1 = ys[row + 1]! - 2
        cells.push(`<rect class="lit" x="${x0}" y="${y0}" width="${x1 - x0}" height="${y1 - y0}" style="animation-delay:-${(cells.length * 1.3) % 9}s"/>`)
      }
    }
  }
  return cells.slice(0, Math.round((clamp(ramPct) / 100) * cells.length)).join('')
}

function incense(cpu: number | undefined): string {
  const load = clamp(cpu ?? 0)
  const n = 1 + Math.round((load / 100) * 4)
  const dur = (6 - load * 0.025).toFixed(2)
  const wisps: string[] = []
  for (let i = 0; i < n; i++) {
    const sway = i % 2 === 0 ? 1 : -1
    wisps.push(
      `<path class="smoke wisp" stroke-width="${(2.6 - i * 0.2).toFixed(1)}" style="animation-duration:${dur}s;animation-delay:-${((i * Number(dur)) / n).toFixed(2)}s" d="M132 822C${132 - 6 * sway} 812 ${132 + 8 * sway} 804 132 794C${132 - 6 * sway} 786 ${132 + 4 * sway} 780 133 772"/>`,
    )
  }
  const glow = (0.55 + (load / 100) * 0.45).toFixed(2)
  return `<circle class="ember" cx="132" cy="826" r="${(2.2 + load / 50).toFixed(1)}" opacity="${glow}"/>${wisps.join('')}`
}

// 0 relaxed soak, 1 warm (under 75°), 2 boiling (under 83°), 3 climbing out.
export function heatTier(temp: number | undefined): 0 | 1 | 2 | 3 {
  if (temp === undefined || temp < 65) return 0
  if (temp < 75) return 1
  if (temp < 83) return 2
  return 3
}

const HEAD = 'M8 50C4 26 28 6 60 8C86 10 98 28 96 50C94 70 72 80 44 78C24 76 10 66 8 50Z'
const DROP = (x: number, y: number, delay: number) =>
  `<path class="drop" style="animation-delay:-${delay}s" d="M${x} ${y}c4 6 6 10 6 13a6 6 0 0 1-12 0c0-3 2-7 6-13z"/>`

// The soaking capybara, drawn for its tier; it replaces the scene's own.
export function isWorking(w: Work | undefined): boolean {
  return w !== undefined && !w.now.startsWith('Resting')
}

// The samurai standing on his cushion, practising a slow overhead cut: raise,
// a small anticipation lift, a fast strike with a smear arc, a held follow
// through, then a calm return. Arms and sword turn about the shoulders.
const TRAINING = `<g class="kata">
      <path class="hakama" d="M224 790L300 790L324 880H200Z"/>
      <path class="hakama-l" stroke-width="2" d="M262 806V880M236 808L226 876M288 808L298 876"/>
      <path class="haori" d="M228 730C236 718 288 718 296 730L306 798H218Z"/>
      <path class="inner" d="M248 722L262 756L276 722Z"/>
      <path class="haori-d" d="M244 724L262 766L254 766L238 730Z"/>
      <path class="haori-d" d="M280 724L262 766L270 766L286 730Z"/>
      <rect class="skin-d" x="254" y="700" width="16" height="22" rx="4"/>
      <ellipse class="skin" cx="262" cy="694" rx="19" ry="22"/>
      <path class="hair" d="M243 692C239 666 285 666 281 692C277 680 247 680 243 692Z"/>
      <rect class="hair" x="256" y="660" width="12" height="15" rx="5"/>
      <rect class="hband" x="243" y="681" width="38" height="5" rx="2"/>
      <path class="tails hband" d="M280 682C292 681 302 689 314 685L312 691C300 695 290 689 280 688Z"/>
      <path class="tails t2 hband" d="M280 685C290 689 296 699 308 701L304 706C294 703 286 695 279 690Z"/>
      <path class="ink-s" stroke-width="2.2" d="M251 694h8M266 694h8"/>
      <path class="ink-s" stroke-width="1.6" d="M257 708h10" opacity="0.6"/>
      <g transform="translate(262 740)">
        <path class="smear-arc" d="M39 -201A205 205 0 0 1 142 147L104 108A150 150 0 0 0 29 -147Z"/>
        <g class="swing">
          <path class="haori-d" d="M-20 2L2 -60L14 -56L20 6Z"/>
          <circle class="skin" cx="8" cy="-62" r="7"/>
          <path class="tsuka" stroke-width="7" d="M8 -56L14 -90"/>
          <ellipse class="tsuba" cx="14" cy="-90" rx="9" ry="3.5" transform="rotate(-11 14 -90)"/>
          <path class="blade" d="M12 -92L16 -93L42 -200L38 -204Z"/>
        </g>
      </g>
    </g>`

function soaker(tier: 0 | 1 | 2 | 3): string {
  const body = tier === 3 ? 'M0 70C-6 40 16 20 50 18C80 16 100 30 104 56L106 124H0Z' : 'M0 70C-6 40 16 20 50 18C80 16 100 30 104 56L106 80H0Z'
  const base = `
        <path class="capy-d" d="${body}"/>
        <path class="capy" d="${HEAD}"/>
        <path class="snout" d="M8 44C6 32 16 24 28 26C34 34 34 52 30 62C18 62 10 56 8 44Z"/>
        <ellipse class="ink" cx="15" cy="38" rx="3" ry="2"/>
        <ellipse class="capy-d" cx="82" cy="12" rx="7" ry="6"/>`
  const towel = '<path class="towel" d="M40 8C46 -4 74 -6 84 6L80 12C70 4 52 4 44 12Z"/>'

  if (tier <= 1) {
    const blush = tier === 1 ? '<ellipse class="blush" cx="48" cy="48" rx="10" ry="5" style="opacity:0.75"/>' : '<ellipse class="blush" cx="48" cy="48" rx="7" ry="4"/>'
    return `<g class="float" clip-path="url(#tubclip)"><g transform="translate(70 0)">${base}
        <path class="ink-s" stroke-width="2.5" d="M44 34q6 4 12 0"/>
        <path class="ink-s" stroke-width="2.5" d="M66 36q5 3 10 0" opacity="0.5"/>
        ${blush}${towel}</g></g>`
  }

  if (tier === 2) {
    return `<g class="float" clip-path="url(#tubclip)"><g transform="translate(70 0)">${base}
        <path class="flush" d="${HEAD}"/>
        <path class="ink-s" stroke-width="2.5" d="M43 30l9 5l-9 5"/>
        <path class="ink-s" stroke-width="2.5" d="M78 31l-8 4l8 4" opacity="0.6"/>
        <ellipse class="blush" cx="48" cy="50" rx="11" ry="5" style="opacity:0.85"/>
        <path class="towel" transform="rotate(32 84 8)" d="M40 8C46 -4 74 -6 84 6L80 12C70 4 52 4 44 12Z"/>
        ${DROP(98, 14, 0)}</g></g>`
  }

  // Halfway out of the tub, wide-eyed, paws on the rim; the towel left behind.
  return `<g clip-path="url(#tubclip)"><g class="shiver"><g transform="translate(70 -38)">${base}
        <path class="flush" d="${HEAD}" style="opacity:0.4"/>
        <circle class="eyewhite" cx="50" cy="33" r="6.5"/><circle class="ink" cx="52" cy="34" r="2.8"/>
        <circle class="eyewhite" cx="75" cy="34" r="5"/><circle class="ink" cx="77" cy="35" r="2.2"/>
        <ellipse class="ink" cx="24" cy="54" rx="3" ry="4"/>
        <ellipse class="blush" cx="44" cy="52" rx="11" ry="5" style="opacity:0.9"/>
        <path class="shock" d="M2 8L-12 0M-2 26L-16 24M104 10L118 2M106 28L120 28"/>
        <ellipse class="capy-d" cx="22" cy="116" rx="13" ry="8"/>
        <ellipse class="capy-d" cx="92" cy="116" rx="13" ry="8"/>
        ${DROP(100, 6, 0)}${DROP(2, 14, 1.2)}</g></g></g>
    <path class="towel" d="M214 72C220 64 246 64 252 72L250 78H216Z"/>`
}

function bubbles(tier: 0 | 1 | 2 | 3): string {
  if (tier === 0) return ''
  const n = [0, 3, 7, 12][tier]!
  const dur = [0, 3, 2, 1.4][tier]!
  const out: string[] = []
  for (let i = 0; i < n; i++) {
    const x = 12 + ((i * 61) % 236)
    const r = 2.5 + ((i * 3) % 3)
    out.push(`<circle class="bubble" cx="${x}" cy="86" r="${r}" style="animation-duration:${dur}s;animation-delay:-${((i * dur) / n).toFixed(2)}s"/>`)
  }
  return out.join('')
}

function steam(gpu: Gpu | undefined): string {
  const load = clamp(gpu?.util ?? 0)
  const n = 1 + Math.round((load / 100) * 5)
  const dur = (7 - load * 0.03).toFixed(2)
  const puffs: string[] = []
  for (let i = 0; i < n; i++) {
    const x = 30 + ((i * 47) % 180)
    const r = 12 + ((i * 5) % 8)
    puffs.push(
      `<g class="puff" style="animation-duration:${dur}s;animation-delay:-${((i * Number(dur)) / n).toFixed(2)}s"><circle class="steam" cx="${x}" cy="20" r="${r}"/><circle class="steam" cx="${x + 17}" cy="10" r="${r - 5}"/></g>`,
    )
  }
  return puffs.join('')
}

function resetTime(iso: string | undefined): string {
  if (iso === undefined) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `resets ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function labels(s: Stats) {
  const five = s.limits.find(l => l.kind === 'five_hour')
  const week = s.limits.find(l => l.kind === 'seven_day')
  const limitLine = [five && `5h ${pct(five.percentUsed)}`, week && `7d ${pct(week.percentUsed)}`].filter(Boolean).join('  ·  ') || 'waiting for a reply'

  // Hangs over the top of the round window, inside the band every width shows.
  const plaque = `
    <path class="cord" stroke-width="1.5" d="M270 70L170 112M270 70L370 112"/>
    <circle class="frame" cx="270" cy="70" r="4"/>
    <rect class="plaque" x="130" y="110" width="280" height="84" rx="6"/>
    <text class="lbl lbl-k" x="270" y="138" text-anchor="middle">残花 · Claude</text>
    <text class="lbl lbl-v" x="270" y="163" text-anchor="middle">${limitLine}</text>
    <text class="lbl lbl-s" x="270" y="183" text-anchor="middle">${[resetTime(five?.resetsAt), s.context === undefined ? '' : `ctx ${pct(s.context)}`].filter(Boolean).join('  ·  ')}</text>`

  const cpu = s.cpu === undefined ? '' : `
    <text class="lbl lbl-k" x="22" y="826">香</text>
    <text class="lbl lbl-v" x="20" y="850">CPU ${pct(s.cpu)}</text>`

  const ram = s.ramUsed === undefined || s.ramTotal === undefined ? '' : `
    <text class="lbl lbl-k" x="1270" y="592">記憶</text>
    <text class="lbl lbl-v" x="1318" y="590">RAM ${s.ramUsed.toFixed(1)} / ${s.ramTotal.toFixed(0)} GB</text>`

  const g = s.gpu
  const gpu = g === undefined ? '' : `
    <text class="lbl lbl-k burn" x="1352" y="774" style="fill:#6b4f33">湯</text>
    <text class="lbl lbl-v burn" x="1380" y="772" style="fill:#5a4128">GPU ${pct(g.util)} · <tspan${heatTier(g.temp) >= 2 ? ' class="hot"' : ''}>${Math.round(g.temp)}°</tspan></text>
    <text class="lbl lbl-s burn" x="1380" y="787" style="fill:#5a4128">${(g.memUsed / 1024).toFixed(1)} / ${(g.memTotal / 1024).toFixed(0)} GB</text>`

  return { plaque, cpu, ram, gpu }
}

function must(s: string, anchor: string | RegExp): void {
  if (typeof anchor === 'string' ? !s.includes(anchor) : !anchor.test(s)) {
    throw new Error(`scene anchor missing: ${String(anchor)}`)
  }
}

// Each redraw is a fresh document, so every animation would start over. Offset
// every delay by the wall clock so motion carries on where it was.
function keepPhase(svg: string, nowSec: number): string {
  const t = nowSec % 86400
  return svg
    .replace(/animation-delay:\s*(-?[\d.]+)s/g, (_m, d: string) => `animation-delay:${(Number(d) - t).toFixed(2)}s`)
    .replace(/animation: ([\w-]+) ([\d.]+)s /g, (_m, name: string, dur: string) => `animation: ${name} ${dur}s ${(-t).toFixed(2)}s `)
}

export function buildScene(s: Stats, nowSec: number): string {
  const five = s.limits.find(l => l.kind === 'five_hour')
  const ramPct = s.ramUsed !== undefined && s.ramTotal ? (s.ramUsed / s.ramTotal) * 100 : undefined
  const L = labels(s)
  let svg = SCENE

  must(svg, '</style>')
  svg = svg.replace('</style>', `${STATS_CSS}</style>`)

  const bloomRe = /<g class="bloom">[\s\S]*?<\/g>\s*<g class="bloom-c">[\s\S]*?<\/g>/
  must(svg, bloomRe)
  svg = svg.replace(bloomRe, blossoms(five?.percentUsed))

  const vase = '<path class="vase"'
  must(svg, vase)
  svg = svg.replace(vase, `${fallen(five?.percentUsed)}${vase}`)

  const mat = '<!-- tatami mat under the shelf -->'
  must(svg, mat)
  svg = svg.replace(mat, `${L.plaque}${scroll(s.work)}\n  ${mat}`)

  const smokeRe = /\s*<circle class="ember emberglow"[^>]*\/>(\s*<path class="smoke wisp[^>]*\/>)+/
  must(svg, smokeRe)
  svg = svg.replace(smokeRe, `\n      ${incense(s.cpu)}`)

  // The lantern is the context window: bright on a fresh conversation, its
  // glow shrinking and its paper dimming as the context fills.
  const ctx = clamp(s.context ?? 0)
  const glow = '<circle class="glowpulse" cx="1000" cy="175" r="190" fill="url(#lampglow)"/>'
  must(svg, glow)
  svg = svg.replace(glow, `<circle class="glowpulse" cx="1000" cy="175" r="${Math.round(190 - ctx * 0.8)}" fill="url(#lampglow)" opacity="${(1 - ctx * 0.0075).toFixed(2)}"/>`)
  const lamp = '<ellipse class="lamp" cx="1000" cy="175" rx="46" ry="56"/>'
  must(svg, lamp)
  svg = svg.replace(lamp, `${lamp}<ellipse cx="1000" cy="175" rx="46" ry="56" fill="#8a7458" opacity="${(ctx * 0.004).toFixed(2)}"/>`)

  if (isWorking(s.work)) {
    // A busy room: the dragonfly darts three times as often.
    svg = svg.replace('</style>', '  .dfly, .lines1, .lines2 { animation-duration: 6s !important; }\n</style>')
  } else {
    // Resting: the yuzu capybara dozes, nodding, with eyes shut and drifting z's.
    const eyes = /<g class="blink"><ellipse[^>]*\/>(<circle[^>]*\/>)?<\/g>\s*<g class="blink"><ellipse[^>]*\/><\/g>/
    must(svg, eyes)
    svg = svg.replace(eyes, '<path class="ink-s" stroke-width="2.5" d="M50 61q6 4 12 0"/><path class="ink-s" stroke-width="2" d="M81 59q3 3 6 0"/>')
    svg = svg.replace('<g class="head">', '<g class="head" style="animation: nod 7s ease-in-out infinite">')
    const yuzuBob = '<g class="yuzubob">'
    must(svg, yuzuBob)
    svg = svg.replace(
      yuzuBob,
      [0, 1, 2]
        .map(i => `<text class="lbl zz" x="${108 + i * 6}" y="${22 - i * 4}" style="font-size:${14 + i * 4}px;animation-delay:-${(i * 1.6).toFixed(1)}s">z</text>`)
        .join('') + yuzuBob,
    )
    svg = svg.replace(
      '</style>',
      `  @keyframes nod { 0%, 100% { transform: rotate(0deg); } 50% { transform: rotate(-5deg); } }
  .zz { fill: #7a6650; opacity: 0; animation: zz 4.8s ease-out infinite; }
  @keyframes zz { 0% { transform: translate(0px, 0px); opacity: 0; } 20% { opacity: 0.8; } 100% { transform: translate(14px, -34px); opacity: 0; } }
</style>`,
    )
  }

  // While Claude works, the samurai stands and practises sword cuts.
  if (isWorking(s.work)) {
    const zenRe = /<g class="zen">[\s\S]*?<\/g>/
    must(svg, zenRe)
    svg = svg.replace(zenRe, TRAINING)
    svg = svg
      .replace('<path class="tsuka" stroke-width="8" d="M470 866L520 860"/>', '')
      .replace(/<ellipse class="tsuba" cx="470"[^>]*\/>/, '')
      .replace('<ellipse class="aura calm"', '<ellipse class="aura" style="display:none"')
  }

  const flies = '<!-- fireflies, seen at night -->'
  must(svg, flies)
  svg = svg.replace(flies, `${L.cpu}\n  ${flies}`)

  const paper = '<rect class="paper" x="1354" y="82" width="194" height="466"/>'
  must(svg, paper)
  svg = svg.replace(paper, `${paper}${shojiCells(ramPct)}`)

  const puffRe = /(\s*<g class="puff[^"]*">[^\n]*<\/g>)+/
  must(svg, puffRe)
  svg = svg.replace(puffRe, `\n    ${steam(s.gpu)}`)

  const tier = heatTier(s.gpu?.temp)
  const soakRe = /<g class="float" clip-path="url\(#tubclip\)">[\s\S]*?(?=<path class="water")/
  must(svg, soakRe)
  svg = svg.replace(soakRe, `${soaker(tier)}\n    `)

  const ripple = '<ellipse class="water-l ripple" cx="120" cy="84" rx="40" ry="5"/>'
  must(svg, ripple)
  const rippleDur = ['', '', 'style="animation-duration:2.5s" ', 'style="animation-duration:1.5s" '][tier]
  svg = svg.replace(ripple, `<ellipse class="water-l ripple" ${rippleDur}cx="120" cy="84" rx="40" ry="5"/>${bubbles(tier)}`)

  const yuzu = '<g class="yfloat">'
  must(svg, yuzu)
  const yuzuDur = ['', '', ' style="animation-duration:4s"', ' style="animation-duration:1.6s"'][tier]
  svg = svg.replace(yuzu, `<g class="yfloat"${yuzuDur}>`)

  const capy = '<!-- capybara with a yuzu on its head'
  must(svg, capy)
  svg = svg.replace(capy, `${L.ram}${L.gpu}\n  ${capy}`)

  return keepPhase(svg, nowSec)
}
