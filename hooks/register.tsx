import type { Register, ThemeSetArgs, ThemeSound, ThemeStyle } from 'claude-code'

import { makeColors } from './make-colors.js'
import { buildScene, type PlanItem, type Stats, type Work } from './stats-scene.ts'
import { ART_COLUMNS, ART_ROWS, artCells } from './terminal-art.ts'

const ART_FRAME_MS = 500
let bandRequestId: string | undefined
let artFrame = 0

const pct = (n: number) => `${Math.round(n)}%`
const pad2 = (n: number) => String(n).padStart(2, '0')

// The terminal band's three lines: what Claude is doing, the readings, and
// the quiet extras (limit reset, background work).
function bandLines(s: Stats): [string, string, string] {
  const w = s.work
  const current = w?.plan.find(p => p.status === 'in_progress')
  const done = w?.plan.filter(p => p.status === 'completed').length ?? 0
  const step = current ? `▸ ${current.content} (${done}/${w!.plan.length})` : ''
  const nowText = w ? (step ? `${step} · ${w.now}` : w.now) : 'Resting'
  const now = `今 ${nowText.length > 72 ? `${nowText.slice(0, 71)}…` : nowText}`

  const parts: string[] = []
  if (s.ramUsed !== undefined && s.ramTotal) parts.push(`記憶 RAM ${pct((s.ramUsed / s.ramTotal) * 100)}`)
  if (s.cpu !== undefined) parts.push(`香 CPU ${pct(s.cpu)}`)
  if (s.gpu) parts.push(`湯 GPU ${pct(s.gpu.util)}${s.gpu.temp === undefined ? '' : ` ${Math.round(s.gpu.temp)}°`}`)
  const five = s.limits.find(l => l.kind === 'five_hour')
  const week = s.limits.find(l => l.kind === 'seven_day')
  if (five || week) parts.push(`残花 ${[five && `5h ${pct(five.percentUsed)}`, week && `7d ${pct(week.percentUsed)}`].filter(Boolean).join(' ')}`)
  if (s.context !== undefined) parts.push(`灯 ctx ${pct(s.context)}`)
  const readings = parts.join('  ') || 'reading the room…'

  const extras: string[] = []
  if (five?.resetsAt) {
    const d = new Date(five.resetsAt)
    if (!Number.isNaN(d.getTime())) extras.push(`limit resets ${pad2(d.getHours())}:${pad2(d.getMinutes())}`)
  }
  for (const b of w?.background.slice(-2) ?? []) extras.push(`裏 ${b.label}`)
  return [now, readings, extras.join(' · ')]
}

// One long-lived process that prints a JSON line of machine stats every few
// seconds. On Windows it is PowerShell. CIM classes are used so the names don't change with the Windows
// language; nvidia-smi is read when it is installed.
const STATS_SCRIPT = `
$ErrorActionPreference = 'SilentlyContinue'
$smi = (Get-Command nvidia-smi -ErrorAction SilentlyContinue).Source
while ($true) {
  $cpu = (Get-CimInstance Win32_PerfFormattedData_PerfOS_Processor -Filter "Name='_Total'").PercentProcessorTime
  $os = Get-CimInstance Win32_OperatingSystem
  $tot = [double]$os.TotalVisibleMemorySize; $free = [double]$os.FreePhysicalMemory
  $g = ''
  if ($smi) { $g = (& $smi --query-gpu=utilization.gpu,memory.used,memory.total,temperature.gpu --format=csv,noheader,nounits | Select-Object -First 1) }
  $o = [ordered]@{ cpu = [int]$cpu; ramUsed = [math]::Round(($tot - $free) / 1MB, 1); ramTotal = [math]::Round($tot / 1MB, 1); gpu = "$g" }
  [Console]::Out.WriteLine(($o | ConvertTo-Json -Compress))
  Start-Sleep -Seconds 8
}
`

// The backdrop is checked this often and redrawn only when something moved.
// Linux: /proc for CPU and memory, nvidia-smi or an AMD card's sysfs for the GPU.
const LINUX_SCRIPT = String.raw`
snap() { awk '/^cpu /{print $2+$3+$4+$5+$6+$7+$8+$9, $5+$6}' /proc/stat; }
prev=$(snap)
while :; do
  sleep 1
  cur=$(snap)
  set -- $prev $cur
  dt=$(( $3 - $1 )); di=$(( $4 - $2 ))
  if [ "$dt" -gt 0 ]; then cpu=$(( (100 * (dt - di)) / dt )); else cpu=0; fi
  prev=$cur
  mem=$(awk '/^MemTotal:/{t=$2} /^MemAvailable:/{a=$2} /^MemFree:/{f=$2} /^Buffers:/{b=$2} /^Cached:/{c=$2} END{if (a == "") a = f + b + c; printf "\"ramUsed\":%.1f,\"ramTotal\":%.1f", (t-a)/1048576, t/1048576}' /proc/meminfo)
  gpu=""
  if command -v nvidia-smi >/dev/null 2>&1; then
    gpu=$(nvidia-smi --query-gpu=utilization.gpu,memory.used,memory.total,temperature.gpu --format=csv,noheader,nounits 2>/dev/null | head -n 1)
  else
    for d in /sys/class/drm/card*/device; do
      if [ -r "$d/gpu_busy_percent" ]; then
        u=$(cat "$d/gpu_busy_percent")
        mu=$(( $(cat "$d/mem_info_vram_used" 2>/dev/null || echo 0) / 1048576 ))
        mt=$(( $(cat "$d/mem_info_vram_total" 2>/dev/null || echo 0) / 1048576 ))
        t=""
        for h in "$d"/hwmon/hwmon*/temp1_input; do [ -r "$h" ] && t=$(( $(cat "$h") / 1000 )) && break; done
        gpu="$u, $mu, $mt, $t"
        break
      fi
    done
  fi
  printf '{"cpu":%s,%s,"gpu":"%s"}\n' "$cpu" "$mem" "$gpu"
  sleep 7
done
`

// macOS: top, vm_stat and ioreg (Apple Silicon GPU load; macOS gives no GPU temperature).
const MAC_SCRIPT = String.raw`
total=$(sysctl -n hw.memsize)
ps=$(sysctl -n hw.pagesize)
while :; do
  cpu=$(top -l 2 -n 0 -s 1 | awk '/CPU usage/{u=$3; s=$5} END{sub(/%/,"",u); sub(/%/,"",s); printf "%d", u+s}')
  used=$(vm_stat | awk -v ps="$ps" '/Pages active/{a=$3} /Pages wired down/{w=$4} /occupied by compressor/{c=$5} END{gsub(/[.]/,"",a); gsub(/[.]/,"",w); gsub(/[.]/,"",c); printf "%.1f", (a+w+c)*ps/1073741824}')
  ram=$(awk -v t="$total" 'BEGIN{printf "%.1f", t/1073741824}')
  gpu=""
  acc=$(ioreg -r -d 1 -w 0 -c IOAccelerator 2>/dev/null)
  util=$(printf '%s' "$acc" | grep -o '"Device Utilization %"=[0-9]*' | head -n 1 | cut -d= -f2)
  if [ -n "$util" ]; then
    gmem=$(printf '%s' "$acc" | grep -o '"In use system memory"=[0-9]*' | head -n 1 | cut -d= -f2)
    [ -z "$gmem" ] && gmem=0
    gpu="$util, $((gmem / 1048576)), $((total / 1048576)), "
  fi
  printf '{"cpu":%s,"ramUsed":%s,"ramTotal":%s,"gpu":"%s"}\n' "$cpu" "$used" "$ram" "$gpu"
  sleep 7
done
`

const REDRAW_MS = 5_000
// Background work drops off the scroll after this long without news.
const BACKGROUND_TTL_MS = 30 * 60_000

let stats: Stats = { limits: [] }
let dirty = false

let work: Work = { now: 'Resting', plan: [], background: [] }
const pendingAgents: string[] = []
const runningAgents = new Map<string, { label: string; since: number }>()
let shells: { label: string; since: number }[] = []

function setWork(patch: Partial<Work>): void {
  const now = Date.now()
  shells = shells.filter(s => now - s.since < BACKGROUND_TTL_MS)
  const background = [...shells, ...[...runningAgents.values()].map(a => ({ label: `agent: ${a.label}`, since: a.since }))].sort(
    (a, b) => a.since - b.since,
  )
  work = { ...work, ...patch, background }
  stats = { ...stats, work }
  dirty = true
}

const base = (p: unknown) => (typeof p === 'string' ? (p.split(/[\\/]/).pop() ?? p) : '')
const str = (v: unknown) => (typeof v === 'string' ? v : undefined)

// A short line for what a tool call is doing.
function describe(tool: string, a: Record<string, unknown>): string | undefined {
  switch (tool) {
    case 'Bash':
    case 'PowerShell':
      return str(a.description) ?? 'Running a command'
    case 'Edit':
    case 'Write':
    case 'NotebookEdit':
      return `Editing ${base(a.file_path ?? a.notebook_path)}`
    case 'Read':
      return `Reading ${base(a.file_path)}`
    case 'Grep':
    case 'Glob':
      return 'Searching files'
    case 'WebSearch':
    case 'WebFetch':
      return 'Looking things up'
    case 'Agent':
      return `Briefing an agent: ${str(a.description) ?? ''}`
    case 'Skill':
      return `Using skill ${str(a.skill) ?? ''}`
  }
  if (tool.startsWith('mcp__ccd_turn__') || tool === 'ToolSearch') return undefined
  if (tool.includes('Browser') || tool.includes('chrome')) return 'Working in the browser'
  const short = tool.split('__').pop() ?? tool
  return `Using ${short.replace(/_/g, ' ')}`
}

// Follows the app's task list as Claude updates it.
function updatePlan(a: Record<string, unknown>): void {
  let plan: PlanItem[] = work.plan.map(p => ({ ...p }))
  if (Array.isArray(a.items)) {
    plan = a.items
      .filter((i): i is { content: string; status?: string } => typeof i === 'object' && i !== null && typeof (i as { content?: unknown }).content === 'string')
      .map(i => ({
        content: i.content,
        status: i.status === 'completed' || i.status === 'in_progress' ? i.status : 'pending',
      }))
  }
  if (a.advance === true) {
    const cur = plan.findIndex(p => p.status === 'in_progress')
    if (cur >= 0) plan[cur]!.status = 'completed'
    const nextIdx = plan.findIndex(p => p.status === 'pending')
    if (nextIdx >= 0) plan[nextIdx]!.status = 'in_progress'
  }
  if (Array.isArray(a.done)) {
    for (const n of a.done) if (typeof n === 'number' && plan[n - 1]) plan[n - 1]!.status = 'completed'
  }
  if (typeof a.start === 'number' && plan[a.start - 1]) {
    for (const p of plan) if (p.status === 'in_progress') p.status = 'pending'
    plan[a.start - 1]!.status = 'in_progress'
  }
  setWork({ plan })
}

function parseStats(line: string): Partial<Stats> | undefined {
  try {
    const raw = JSON.parse(line) as { cpu?: number; ramUsed?: number; ramTotal?: number; gpu?: string }
    // "util, memUsed MiB, memTotal MiB, temp": temp may be empty (macOS has none).
    const parts = (raw.gpu ?? '').split(',').map(p => p.trim())
    const [util, memUsed, memTotal] = parts.slice(0, 3).map(Number)
    const temp = parts[3] ? Number(parts[3]) : NaN
    const gpu =
      [util, memUsed, memTotal].every(n => n !== undefined && Number.isFinite(n))
        ? { util: util!, memUsed: memUsed!, memTotal: memTotal!, temp: Number.isFinite(temp) ? temp : undefined }
        : undefined
    return { cpu: raw.cpu, ramUsed: raw.ramUsed, ramTotal: raw.ramTotal, gpu }
  } catch {
    return undefined
  }
}

// Light only: warm linen plaster, honey oak and afternoon sun.
const { theme, problems } = makeColors({
  label: 'Japandi Capybara',
  only: 'light',
  roles: { accent: '#3f5f7a', danger: '#b4473a', success: '#5d7d45', warning: '#b07a28', pro: '#8a5a78' },
  light: {
    gray: {
      anchors: {
        'surface-0': '#f1e9db',
        'surface-1': '#f6efe3',
        'surface-2': '#fbf7ef',
        'surface-3': '#fbf7ef',
        'text-primary': '#2d2620',
        'text-secondary': '#554b40',
        'text-muted': '#6b6054',
      },
    },
  },
})

const colors = {
  ...theme,
  inputs: {
    ...theme.inputs,
    light: {
      ...theme.inputs.light,
      'bg-user-message': '#f5ecdd',
      'text-user-message': '#2d2620',
      'bg-assistant-message': '#fdfaf4',
      'text-assistant-message': '#2d2620',
    },
  },
} as ThemeSetArgs['colors']

const STYLE: ThemeStyle = {
  Text: { fontFamily: ['sans'], fontSize: 15, lineHeight: 24 },
  Heading: { fontFamily: ['serif'], fontWeight: 'semibold', letterSpacing: 0.5 },
  // Washi card with a small vermilion hanko stamp in its corner.
  UserMessage: {
    color: 'text-user-message',
    backgroundColor: 'bg-user-message',
    paddingX: 18,
    paddingY: 12,
    shadow: { x: 0, y: 2, blur: 8, color: '#2b201414' },
    fill: {
      vector: {
        viewBox: 64,
        slice: 18,
        paths: [
          { d: 'M8 0H56Q64 0 64 8V56Q64 64 56 64H8Q0 64 0 56V8Q0 0 8 0Z', color: 'bg-user-message' },
          { d: 'M50 6H58V14H50Z', color: '#b4473a' },
          { d: 'M52 8H56V12H52Z', color: 'bg-user-message' },
        ],
      },
    },
  },
  // Rice paper with a slim oak edge along the left.
  AssistantMessage: {
    color: 'text-assistant-message',
    backgroundColor: 'bg-assistant-message',
    paddingLeft: 22,
    paddingRight: 18,
    paddingY: 14,
    shadow: { x: 0, y: 1, blur: 6, color: '#2b201410' },
    fill: {
      vector: {
        viewBox: 64,
        slice: 12,
        paths: [
          { d: 'M6 0H58Q64 0 64 6V58Q64 64 58 64H6Q0 64 0 58V6Q0 0 6 0Z', color: 'bg-assistant-message' },
          { d: 'M0 6Q0 0 6 0V64Q0 64 0 58Z', color: '#a07d58' },
        ],
      },
    },
  },
  ToolUse: { backgroundColor: 'surface-1', radius: 8, paddingX: 10 },
}

// A furin wind chime, a soft breeze and the trickle of the onsen.
const SOUND: ThemeSound = {
  ambience: {
    reverb: 0.4,
    layers: [
      { wave: 'brown', drone: true, gain: 0.12, filter: { type: 'lowpass', hz: 400, to: 700 } },
      { wave: 'sine', notes: ['D3', 'A3'], drone: true, gain: 0.05, tremolo: { hz: 0.1, depth: 0.4 } },
      { wave: 'bell', notes: ['D6', 'E6', 'G6', 'A6', 'B6'], scatter: 0.07, gain: 0.1, release: 3, pan: 0.4 },
      { wave: 'crackle', scatter: 0.5, gain: 0.04, filter: { type: 'bandpass', hz: 2500 }, release: 0.1, pan: 0.6 },
    ],
  },
  cues: {
    send: { layers: [{ wave: 'pink', gain: 0.35, filter: { type: 'bandpass', hz: 900 }, attack: 0.002, release: 0.08 }] },
    tool: { layers: [{ wave: 'triangle', notes: ['A5'], gain: 0.12, release: 0.1 }] },
    done: { reverb: 0.4, layers: [{ wave: 'bell', notes: ['D5', 'G5', 'A5'], step: 0.14, gain: 0.3, release: 1.6 }] },
    ask: { layers: [{ wave: 'bell', notes: ['E5', 'B5'], step: 0.2, gain: 0.28, release: 1.2 }] },
    error: { layers: [{ wave: 'triangle', notes: ['D4', 'A3'], step: 0.18, gain: 0.25, release: 0.6, glide: -2 }] },
    compact: { layers: [{ wave: 'pink', gain: 0.2, filter: { type: 'lowpass', hz: 1200, to: 300 }, attack: 0.3, release: 1.2 }] },
    click: { layers: [{ wave: 'bell', notes: ['D5', 'E5', 'G5', 'A5', 'B5', 'D6'], gain: 0.22, release: 1.4 }] },
  },
}

const BASE: ThemeSetArgs = {
  colors,
  overrideColorScheme: 'light',
  backdrop: { scene: 'japandi-room', glass: { blur: 14, tint: '#fbf5ea', opacity: 0.5 } },
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const unpainted = problems.find(line => line.startsWith("Desktop won't paint"))

    if (unpainted !== undefined) {
      $.ui.toast(unpainted)
    }

    let set
    let look: ThemeSetArgs = { ...BASE, style: STYLE, sound: SOUND }
    try {
      set = await $.theme.set(look)
    } catch (error) {
      $.ui.log(`japandi-capybara: full look refused, retrying without style and sound: ${String(error)}`)
      look = BASE
      set = await $.theme.set(look)
    }

    if (!set.isDrawn) {
      $.ui.status(set.reason)
    }

    const started = await next(e)

    try {
      const usage = await $.session.usage()
      stats = { ...stats, limits: usage.rateLimits, context: usage.context.percent }
    } catch {
      // no usage figures on this host
    }

    // Redraw the backdrop at most every five seconds, and only when something moved.
    // This app doesn't redraw a backdrop on $.ui.invalidate, so a changed room
    // is sent by setting the theme again under the other of two scene names,
    // which makes the app draw the backdrop afresh. Colors, style and sound are
    // unchanged, so only the room moves on.
    let flip = false
    let busy = false
    $.clock.every(REDRAW_MS, () => {
      if (dirty && !busy) {
        dirty = false
        busy = true
        flip = !flip
        // The terminal's band redraws the ordinary way.
        if (bandRequestId !== undefined) $.ui.invalidate('ui.render')
        const backdrop = { ...(look.backdrop as { scene: string; glass?: object }), scene: flip ? 'japandi-room-b' : 'japandi-room' }
        void $.theme
          .set({ ...look, backdrop } as ThemeSetArgs)
          .catch(error => $.ui.log(`japandi-capybara: redraw failed: ${String(error)}`, { to: 'debug' }))
          .finally(() => {
            busy = false
          })
      }
    })

    // The terminal's pixel bath: repaint its cells a few times a second, with
    // no redraw of the band around it.
    $.clock.every(ART_FRAME_MS, () => {
      if (bandRequestId === undefined) return
      artFrame++
      void $.ui
        .blit({ requestId: bandRequestId, key: 'bath', cells: artCells(stats, artFrame) })
        .then(r => {
          if ('deny' in r && r.deny) bandRequestId = undefined
        })
        .catch(() => {
          bandRequestId = undefined
        })
    })

    // The stats child lives for the session; it ends with the module.
    void (async () => {
      try {
        // Pick the stats script for this operating system.
        const sys = (await $.session.machine()).sysname
        const argv = /^win|_nt|mingw|msys|cygwin/i.test(sys)
          ? ['powershell', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', STATS_SCRIPT]
          : /darwin/i.test(sys)
            ? ['sh', '-c', MAC_SCRIPT]
            : ['sh', '-c', LINUX_SCRIPT]
        const child = $.process.spawn({
          argv,
        })
        let buffer = ''
        for await (const { stream, text } of child) {
          if (stream !== 'stdout') continue
          buffer += text
          let nl = buffer.indexOf('\n')
          while (nl >= 0) {
            const parsed = parseStats(buffer.slice(0, nl).trim())
            buffer = buffer.slice(nl + 1)
            if (parsed) {
              stats = { ...stats, ...parsed }
              dirty = true
            }
            nl = buffer.indexOf('\n')
          }
        }
      } catch (error) {
        $.ui.log(`japandi-capybara: system stats unavailable: ${String(error)}`, { to: 'debug' })
      }
    })()

    return started
  })

  // The scroll: what Claude is doing, its task list, and background work.
  on('turn.start', ($, e, next) => {
    if (e.agentId === undefined) {
      setWork({ now: 'Thinking…' })
    } else if (!runningAgents.has(e.agentId)) {
      runningAgents.set(e.agentId, { label: pendingAgents.shift() ?? 'subagent', since: Date.now() })
      setWork({})
    }
    return next(e)
  })

  on('turn.complete', ($, e, next) => {
    if (e.agentId === undefined) {
      setWork({ now: 'Resting · waiting for you' })
    } else if (runningAgents.delete(e.agentId)) {
      setWork({})
    }
    return next(e)
  })

  on('agent.spawn', ($, e, next) => {
    pendingAgents.push(e.description)
    if (pendingAgents.length > 8) pendingAgents.shift()
    return next(e)
  })

  on('tool.call', ($, e, next) => {
    try {
      const a = e as unknown as Record<string, unknown>
      if (e.agentId === undefined) {
        if (e.tool === 'mcp__ccd_turn__update_plan') updatePlan(a)
        else if (e.tool === 'mcp__ccd_turn__wrap_up') setWork({ plan: work.plan.map(p => ({ ...p, status: 'completed' as const })) })
        const line = describe(e.tool, a)
        if (line !== undefined) setWork({ now: line })
      }
      if ((e.tool === 'Bash' || e.tool === 'PowerShell') && a.run_in_background === true) {
        shells.push({ label: str(a.description) ?? 'command', since: Date.now() })
        setWork({})
      }
    } catch {
      // the scroll is decoration; never get in a tool's way
    }
    return next(e)
  })

  on('session.measure', ($, e, next) => {
    if (e.changed.includes('rateLimits')) {
      stats = { ...stats, limits: e.rateLimits }
      dirty = true
    }
    if (e.changed.includes('context')) {
      stats = { ...stats, context: e.context.percent }
      dirty = true
    }
    return next(e)
  })

  // The terminal draws no theme, so it gets a band above the prompt instead:
  // the pixel bath beside three lines of the room's readings.
  on('ui.render', { component: 'AbovePrompt' }, ($, e, next) => {
    if (e.surface !== 'terminal' || e.props.hasSurvey) {
      return next(e)
    }
    bandRequestId = e.requestId
    const { Box, Text, Raster } = $.ui.resolve(e)
    const [now, readings, quiet] = bandLines(stats)

    return (
      <Box flexDirection="row">
        <Raster key="bath" columns={ART_COLUMNS} rows={ART_ROWS} cells={artCells(stats, artFrame)} />
        <Box flexDirection="column" marginLeft={2}>
          <Text color="#c9785a">{now}</Text>
          <Text color="#b9a58a">{readings}</Text>
          <Text dimColor>{quiet}</Text>
        </Box>
      </Box>
    )
  })

  on('ui.render', { component: 'Backdrop' }, ($, e, next) => {
    if (e.surface !== 'desktop' && e.surface !== 'mobile') {
      return next(e)
    }
    if (!String(e.props.scene).startsWith('japandi-room')) {
      return next(e)
    }

    const { Svg } = $.ui.resolve(e)

    return (
      <Svg
        source={buildScene(stats, Date.now() / 1000)}
        alt="A sunlit Japandi room: a samurai meditating beside incense, a round window, shoji screens, a swaying bonsai, sakura petals drifting, and two capybaras, one wearing a yuzu and one soaking in a hinoki tub"
        isInteractive
      />
    )
  })
}
