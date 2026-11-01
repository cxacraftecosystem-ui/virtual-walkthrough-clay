/**
 * CRAFT SOUNDS — the positional sources of the clay pavilion (SPECTACLE F29) and the voices
 * of its hands-on pieces (F19 ghatam, F17 clay bed, F18 kiln lever, F21 bells, F22 ghungroo).
 *
 *   pit crackle   at the pit firing on the plinth: a low roar under wood-fire crackle
 *   water drip    into the water ring under the oculus (only once the ring exists)
 *   wheel hum     the ghost potter's great wheel at the court's centre
 *   oculus wind   air moving across the open roof
 *   rain          falling through the oculus (and outdoors) while it rains
 *   bells         clay bells at the Parikrama gates and jali slots, rung as the visitor passes
 *   ghungroo      little bells moving with the visitor along the horse procession
 *
 * Each source is built when the visitor comes within its reach and released a few seconds after
 * they leave it, so walking the pavilion never accumulates nodes (`nodeCount`, synth.ts). All
 * of it feeds the soundscape's output, so the master mute, the hidden tab and the film duck
 * apply unchanged. Every source names itself to the caption strip (spectacle/captions.ts).
 */
import { SCENE_OBJECTS } from '../../config/objects'
import { DEG, polar } from '../../config/museum'
import { JALI_SLOTS, PARIKRAMA } from '../../config/satellites'
import type { ZoneId } from '../../config/layout'
import type { DictKey } from '../../i18n/en'
import { captionKey } from '../../config/spectacleObjects/craft'
import { caption } from '../../spectacle/captions'
import { fireCue, onCue } from '../../spectacle/cues'
import { kindProps } from '../../spectacle/settings'
import { rainNow } from '../../lighting/weather/weatherState'
import { createPanner } from '../audioEngine'
import { Kit, burst, clamp, clayBell, ghatamStroke, hdist, nodeCount, noise, rand, randInt, releaseOnEnd, safe, tone, type Vec3 } from './synth'

export { captionKey }

const CAP = {
  kiln: 'caption.kiln' as DictKey,
  drip: 'caption.drip' as DictKey,
  wheel: 'caption.wheel' as DictKey,
  rain: 'caption.rain' as DictKey,
  bells: 'caption.bells' as DictKey,
  ghatam: captionKey('caption.ghatam', 'caption.bells'),
  clay: captionKey('caption.clay', null),
  wind: captionKey('caption.wind', null),
}

const COURT_ZONES: ReadonlySet<string> = new Set<ZoneId>(['inner', 'ring-a', 'ring-b', 'ring-c', 'entry-e', 'hallway-d'])
const OUTDOOR_ZONES: ReadonlySet<string> = new Set<ZoneId>(['entrance-court', 'parikrama-west', 'parikrama-east', 'sky-rim'])
const PARIKRAMA_ZONES: ReadonlySet<string> = new Set<ZoneId>(['parikrama-west', 'parikrama-east'])

const DISPOSE_AFTER = 4 // s out of reach before a source's nodes are released

/* ------------------------------------------------------------------ */
/* Where things are                                                    */
/* ------------------------------------------------------------------ */

const first = (kind: string) => SCENE_OBJECTS.find((o) => o.kind === kind)

function bellPoints(): Vec3[] {
  const chimes = SCENE_OBJECTS.filter((o) => o.kind === 'clay-chimes')
  if (chimes.length) return chimes.map((o) => [o.position[0], 2.3, o.position[2]] as Vec3)
  // the two gates, and one bell in each jali slot (SPECTACLE F21)
  const angles = [PARIKRAMA.fromDeg + 3, PARIKRAMA.toDeg - 4, ...JALI_SLOTS.map(([a, b]) => (a + b) / 2)]
  return angles.map((a) => {
    const [x, z] = polar(a === PARIKRAMA.fromDeg + 3 || a === PARIKRAMA.toDeg - 4 ? 9.6 : 9.9, a)
    return [x, 2.3, z] as Vec3
  })
}

/* ------------------------------------------------------------------ */
/* Sources                                                             */
/* ------------------------------------------------------------------ */

export interface CraftFrame {
  ctx: AudioContext
  out: AudioNode
  /** Room-reverb send (zone reverb, soundscape.ts). */
  send: AudioNode
  now: number
  horizon: number
  active: boolean
  zone: ZoneId | null
  x: number
  z: number
  speed: number
  /** The visitor's ears are on the roof (the perch). */
  perched: boolean
}

interface Source {
  id: string
  pos: Vec3
  /** Built within this plan distance (m). */
  reach: number
  /** Optional extra gate (zones, rain…). */
  when?: (f: CraftFrame) => boolean
  build: (k: Kit, f: CraftFrame, p: PannerNode) => ((f: CraftFrame) => void) | void
  /** Caption key and the distance within which it is shown. */
  cap?: { key: DictKey | null; within: number; everySec: number }
}

interface Live {
  kit: Kit
  schedule: ((f: CraftFrame) => void) | null
  out: GainNode
  awaySince: number
  lastCap: number
}

function pitSource(): Source | null {
  const o = first('pit-firing')
  if (!o) return null
  const pos: Vec3 = [o.position[0], 0.4, o.position[2]]
  return {
    id: 'pit',
    pos,
    reach: 20,
    cap: { key: CAP.kiln, within: 7, everySec: 6 },
    build: (k, f, p) => {
      const n = noise(f.ctx)
      // the fire's breath: a low, slowly swelling roar
      const roar = k.gain(0.05)
      k.lfo(0.13, 0.02, roar.gain)
      k.loop(n.brown).connect(k.filter('lowpass', 220, 0.5)).connect(roar).connect(p)
      let next = 0
      return (fr) => {
        if (next < fr.now - 1) next = fr.now + rand(0.05, 0.4)
        while (next < fr.horizon) {
          const at = Math.max(fr.now, next)
          // wood crackle: clusters of tiny bright clicks, now and then a pop
          const pop = Math.random() < 0.12
          burst(fr.ctx, p, at, { type: 'highpass', f: pop ? 900 : rand(2200, 4800), q: 0.7, peak: pop ? 0.09 : rand(0.02, 0.05), attack: 0.0008, decay: pop ? 0.05 : rand(0.006, 0.018) })
          next += Math.random() < 0.7 ? rand(0.03, 0.12) : rand(0.25, 0.9)
        }
      }
    },
  }
}

function dripSource(): Source | null {
  const o = first('water-ring')
  if (!o) return null
  return {
    id: 'drip',
    pos: [o.position[0], 0.4, o.position[2]],
    // the pool under a 22 m dome carries: heard across the court (GRAND §6.2 #9)
    reach: 16,
    when: (f) => COURT_ZONES.has(f.zone ?? ''),
    cap: { key: CAP.drip, within: 5.5, everySec: 8 },
    build: (k, f, p) => {
      p.connect(k.gain(0.5)).connect(f.send)
      let next = 0
      return (fr) => {
        if (next < fr.now - 1) next = fr.now + rand(0.8, 3)
        while (next < fr.horizon) {
          const at = Math.max(fr.now, next)
          // a drop: a quick rising "plink" as the bubble rings, over a soft plop
          const fd = rand(780, 1250)
          tone(fr.ctx, p, at, { f0: fd, f1: fd * rand(1.5, 1.9), peak: 0.03, attack: 0.002, decay: 0.07 })
          burst(fr.ctx, p, at, { type: 'lowpass', f: 600, q: 0.6, peak: 0.012, attack: 0.002, decay: 0.04 })
          next += rand(2.2, 5.5)
        }
      }
    },
  }
}

function wheelSource(): Source | null {
  const o = first('ghost-potter')
  if (!o) return null
  return {
    id: 'wheel',
    pos: [o.position[0], 0.6, o.position[2]],
    reach: 9,
    when: (f) => COURT_ZONES.has(f.zone ?? ''),
    cap: { key: CAP.wheel, within: 4, everySec: 10 },
    build: (k, f, p) => {
      const body = k.filter('bandpass', 104, 2.4)
      const swell = k.gain(0.55)
      k.lfo(0.62, 0.32, swell.gain)
      k.loop(noise(f.ctx).brown).connect(body).connect(swell).connect(k.gain(0.06)).connect(p)
    },
  }
}

function windSource(): Source {
  return {
    id: 'oculus-wind',
    pos: [0, 5.6, 0],
    reach: 9,
    when: (f) => COURT_ZONES.has(f.zone ?? '') || f.perched,
    cap: CAP.wind ? { key: CAP.wind, within: 4, everySec: 20 } : undefined,
    build: (k, f, p) => {
      const bp = k.filter('bandpass', 700, 0.8)
      k.lfo(0.07, 320, bp.frequency)
      const g = k.gain(0.022)
      k.lfo(0.045, 0.009, g.gain)
      k.loop(noise(f.ctx).pink).connect(bp).connect(g).connect(p)
    },
  }
}

function rainSource(): Source {
  return {
    id: 'rain',
    pos: [0, 4, 0],
    reach: 40,
    when: () => rainNow() > 0.02,
    cap: { key: CAP.rain, within: 40, everySec: 9 },
    build: (k, f, p) => {
      const n = noise(f.ctx)
      // through the oculus: positional hiss and patter on the water and floor
      const level = k.gain(0)
      k.loop(n.white).connect(k.filter('highpass', 900, 0.5)).connect(k.filter('lowpass', 7000, 0.4)).connect(level).connect(p)
      // outdoors: the same rain all round (not positional)
      const open = k.gain(0)
      k.loop(n.pink).connect(k.filter('highpass', 500, 0.5)).connect(open).connect(f.out)
      return (fr) => {
        const r = rainNow()
        const outside = OUTDOOR_ZONES.has(fr.zone ?? '')
        safe(() => level.gain.setTargetAtTime(0.06 * r, fr.now, 0.8), undefined)
        safe(() => open.gain.setTargetAtTime(outside ? 0.05 * r : 0.008 * r, fr.now, 0.8), undefined)
      }
    },
  }
}

/* ------------------------------------------------------------------ */
/* Engine                                                              */
/* ------------------------------------------------------------------ */

let sources: Source[] | null = null
const live = new Map<string, Live>()

function allSources(): Source[] {
  if (!sources) sources = [pitSource(), dripSource(), wheelSource(), windSource(), rainSource()].filter((s): s is Source => !!s)
  return sources
}

function build(s: Source, f: CraftFrame): Live | null {
  return safe(() => {
    const k = new Kit(f.ctx)
    const out = k.gain(0)
    out.connect(f.out)
    const p = k.panner(s.pos, 1.6, 1.3, Math.max(8, s.reach))
    p.connect(out)
    const schedule = s.build(k, f, p) ?? null
    out.gain.setTargetAtTime(1, f.now, 0.6)
    return { kit: k, schedule, out, awaySince: -1, lastCap: -1e9 }
  }, null)
}

function release(id: string) {
  const l = live.get(id)
  if (!l) return
  live.delete(id)
  safe(() => l.kit.dispose(), undefined)
}

/** Call from the soundscape tick (every ≈40 ms while audible). Returns true while busy. */
export function updateCraft(f: CraftFrame): boolean {
  for (const s of allSources()) {
    const d = f.perched ? (s.id === 'oculus-wind' || s.id === 'rain' ? 0 : 1e9) : hdist(f.x, f.z, s.pos)
    const want = f.active && d < s.reach && (s.when ? s.when(f) : true)
    let l = live.get(s.id)
    if (want && !l) {
      const b = build(s, f)
      if (b) live.set(s.id, (l = b))
    }
    if (!l) continue
    if (want) {
      if (l.awaySince >= 0) {
        l.awaySince = -1
        safe(() => l!.out.gain.setTargetAtTime(1, f.now, 0.6), undefined)
      }
      if (l.schedule) safe(() => l!.schedule!(f), undefined)
      if (s.cap?.key && d < s.cap.within && f.now - l.lastCap > s.cap.everySec) {
        l.lastCap = f.now
        caption(s.cap.key, s.cap.everySec * 1000 + 1500)
      }
    } else {
      if (l.awaySince < 0) {
        l.awaySince = f.now
        safe(() => l!.out.gain.setTargetAtTime(0, f.now, 0.5), undefined)
      } else if (f.now - l.awaySince > DISPOSE_AFTER) release(s.id)
    }
  }
  bells(f)
  ghungroo(f)
  return live.size > 0
}

/** Release every craft source (sound off, context gone). */
export function disposeCraft() {
  for (const id of [...live.keys()]) release(id)
}

/* ------------------------------------------------------------------ */
/* One-shots                                                           */
/* ------------------------------------------------------------------ */

let oneShotOut: (() => { ctx: AudioContext; out: AudioNode; send: AudioNode } | null) | null = null

/** soundscape.ts hands over its output (null while sound is off or audio is locked). */
export function setOneShotOutput(fn: () => { ctx: AudioContext; out: AudioNode; send: AudioNode } | null) {
  oneShotOut = fn
}

/** A panner at `pos` that lets go of itself after `endAt` (context time). */
function spot(ctx: AudioContext, out: AudioNode, send: AudioNode, pos: Vec3, wet: number, endAt: number): AudioNode {
  const p = createPanner(ctx, pos, { refDistance: 1.2, rolloff: 1.4, maxDistance: 30 })
  const dry = ctx.createGain()
  const w = ctx.createGain()
  w.gain.value = wet
  p.connect(dry).connect(out)
  p.connect(w).connect(send)
  // a silent source that ends with the voice releases the panner's little graph
  const keep = ctx.createConstantSource()
  keep.offset.value = 0
  keep.connect(dry)
  keep.start()
  keep.stop(endAt + 0.6)
  releaseOnEnd(keep, [keep, p, dry, w])
  return p
}

/** Strike a ghatam at `pos`. `f0` is the pot's bass (Hz). Silent while sound is off. */
export function playGhatam(pos: Vec3, f0: number, stroke: 'gum' | 'tak' | 'gumki', level = 1) {
  const o = oneShotOut?.()
  if (!o) return
  safe(() => {
    const t = o.ctx.currentTime + 0.005
    const dest = spot(o.ctx, o.out, o.send, pos, 0.35, t + 1.4)
    ghatamStroke(o.ctx, dest, t, f0, stroke, level)
  }, undefined)
  if (CAP.ghatam) caption(CAP.ghatam, 3000)
}

/** A palm pressing into wet clay: a soft, wet squelch. */
export function playClayPress(pos: Vec3, strength = 1) {
  const o = oneShotOut?.()
  if (!o) return
  safe(() => {
    const t = o.ctx.currentTime + 0.005
    const dest = spot(o.ctx, o.out, o.send, pos, 0.15, t + 0.5)
    burst(o.ctx, dest, t, { type: 'lowpass', f: rand(380, 520), f1: rand(160, 220), q: 2.2, peak: 0.05 * strength, attack: 0.012, decay: 0.16 })
    burst(o.ctx, dest, t + 0.03, { type: 'bandpass', f: rand(1100, 1500), q: 4, peak: 0.012 * strength, attack: 0.004, decay: 0.05 })
  }, undefined)
  if (CAP.clay) caption(CAP.clay, 2500)
}

/** The kiln window's brass lever moving one notch. */
export function playLeverNotch(pos: Vec3) {
  const o = oneShotOut?.()
  if (!o) return
  safe(() => {
    const t = o.ctx.currentTime + 0.005
    const dest = spot(o.ctx, o.out, o.send, pos, 0.2, t + 0.4)
    tone(o.ctx, dest, t, { type: 'triangle', f0: 2300, f1: 1900, peak: 0.018, attack: 0.001, decay: 0.05 })
    burst(o.ctx, dest, t, { type: 'bandpass', f: 3800, q: 3, peak: 0.02, attack: 0.001, decay: 0.012 })
  }, undefined)
}

/** The kiln's fire roaring up as the pot enters it. */
export function playKilnWhoosh(pos: Vec3) {
  const o = oneShotOut?.()
  if (!o) return
  safe(() => {
    const t = o.ctx.currentTime + 0.005
    const dest = spot(o.ctx, o.out, o.send, pos, 0.3, t + 1.8)
    burst(o.ctx, dest, t, { type: 'lowpass', f: 180, f1: 900, q: 0.8, peak: 0.06, attack: 0.35, decay: 1.2 })
    for (let i = 0; i < 9; i++) burst(o.ctx, dest, t + rand(0.1, 1.3), { type: 'highpass', f: rand(2400, 4800), peak: rand(0.015, 0.03), attack: 0.001, decay: 0.012 })
  }, undefined)
  caption(CAP.kiln, 3500)
}

/** Ring one clay bell at `pos` (also used by the docent's "Ring the bell"). */
export function playBell(pos: Vec3, level = 1) {
  const o = oneShotOut?.()
  if (!o) return
  safe(() => {
    const t = o.ctx.currentTime + 0.005
    const dest = spot(o.ctx, o.out, o.send, pos, 0.3, t + 1.2)
    const f = rand(560, 720)
    clayBell(o.ctx, dest, t, f, level)
    // its neighbours answer softly
    if (Math.random() < 0.7) clayBell(o.ctx, dest, t + rand(0.12, 0.3), f * rand(1.12, 1.3), level * 0.45)
  }, undefined)
  caption(CAP.bells, 3000)
}

/* ------------------------------------------------------------------ */
/* Bells as the visitor passes (F21)                                   */
/* ------------------------------------------------------------------ */

const BELL_NEAR = 1.5
const BELL_RESET = 2.2
let bellPts: Vec3[] | null = null
const bellArmed: boolean[] = []

function bells(f: CraftFrame) {
  if (!f.active || f.perched) return
  bellPts ??= bellPoints()
  bellPts.forEach((b, i) => {
    const d = hdist(f.x, f.z, b)
    if (bellArmed[i] === undefined) bellArmed[i] = d > BELL_NEAR
    if (bellArmed[i] && d < BELL_NEAR && f.speed > 0.15) {
      bellArmed[i] = false
      playBell(b, 1)
      fireCue('bells:ring', { source: 'visitor', data: { origin: 'craft', x: b[0], z: b[2] } })
    } else if (!bellArmed[i] && d > BELL_RESET) bellArmed[i] = true
  })
}

/** The docent's (or Help → Moments) "Ring the bell": every bell within earshot answers. */
let bellCueInstalled = false
export function installBellCue() {
  if (bellCueInstalled) return
  bellCueInstalled = true
  onCue('bells:ring', (e) => {
    const d = e.data as { origin?: string } | undefined
    if (d?.origin === 'craft') return
    bellPts ??= bellPoints()
    bellPts.forEach((b, i) => window.setTimeout(() => playBell(b, 0.8), i * 160 + rand(0, 80)))
  })
}

/* ------------------------------------------------------------------ */
/* Ghungroo along the horse procession (F22)                           */
/* ------------------------------------------------------------------ */

let nextJingle = 0

function ghungroo(f: CraftFrame) {
  if (!f.active || f.perched || !PARIKRAMA_ZONES.has(f.zone ?? '') || f.speed < 0.3) {
    nextJingle = 0
    return
  }
  const p = kindProps('horse-procession')
  if (p.bells === false) return
  const from = Number(p.fromDeg ?? -128)
  const to = Number(p.toDeg ?? 26)
  const a = clamp(Math.atan2(f.z, f.x) / DEG, Math.min(from, to), Math.max(from, to))
  const [hx, hz] = polar((PARIKRAMA.plinth.r0 + PARIKRAMA.plinth.r1) / 2, a)
  if (Math.hypot(hx - f.x, hz - f.z) > 2.6) return
  const o = oneShotOut?.()
  if (!o) return
  if (nextJingle < f.now - 0.5) nextJingle = f.now + 0.05
  while (nextJingle < f.horizon) {
    const at = Math.max(f.now, nextJingle)
    safe(() => {
      const dest = spot(o.ctx, o.out, o.send, [hx, 0.5, hz], 0.1, at + 0.3)
      // a shake of small brass bells: a few bright, quick, slightly detuned pings
      const n = randInt(3, 6)
      for (let i = 0; i < n; i++) {
        const fq = rand(4200, 6800)
        tone(o.ctx, dest, at + i * rand(0.008, 0.02), { f0: fq, f1: fq * 0.995, peak: 0.004, attack: 0.001, decay: rand(0.05, 0.11) })
      }
    }, undefined)
    nextJingle += clamp(0.85 / Math.max(0.3, f.speed), 0.32, 0.9) * rand(0.9, 1.1)
  }
}

/** Live node counts (for the leak check): persistent parts and one-shot voices in flight. */
export function craftNodeCount() {
  return { persistent: nodeCount.live, voices: nodeCount.voices }
}
