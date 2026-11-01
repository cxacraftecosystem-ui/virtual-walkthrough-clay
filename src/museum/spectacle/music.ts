/**
 * THE SCORE — "Earth to Fire" (SPECTACLE F7, F29, F30): an adaptive, synthesised score that
 * follows the visitor's chapter and never gets in the way.
 *
 * Stems (all procedural; a recording at /audio/music/<stem>.mp3 replaces a stem when present):
 *   drone   a tanpura-like drone: Karplus–Strong strings with a buzzing bridge on Sa
 *   fifth   the same drone's Pa string — the drone "opens into a fifth" at the Turn (F7)
 *   pulse   a matka (clay pot) pulse, a slow gum–tak cycle
 *   water   jal tarang: water-tuned clay bowls struck now and then, over a soft wash
 *   air     wind through the pergola, with a slow breath tone
 *   fire    the low roar and crackle of a wood fire, under the drone
 *   coda    a slow fall of clay bells for the way out
 *
 * The chapter comes from the guided tour's stop when a tour runs (config/tour.ts `chapter`),
 * else from the zone the visitor stands in. Stems cross-fade over a few seconds; any stem may be
 * accented for a while by a cue (`music:<stem>`, `reveal:turn`, `zone-first:inner`). The score
 * ducks under narration, plays through the ambience bus (so the HUD mute, the hidden tab and the
 * film duck apply), and its level is the curator's `spectacle.music` (models/propSchemas.ts).
 * Silent stems are released, so the node count stays flat however long the visit.
 */
import { zoneAt, type ZoneId } from '../config/layout'
import { CHAPTER_MIX, SA, ZONE_CHAPTER, type ScoreStem } from '../config/spectacleObjects/craft'
import { TOUR_STOPS, type TourChapter } from '../config/tour'
import { ambienceInput, getAudioContext, isAudioUnlocked } from '../media/audioEngine'
import { captionKey } from '../media/soundscape/craft'
import { knownFile, loadFile } from '../media/soundscape/files'
import { Kit, burst, clayBell, ghatamStroke, ksPluck, modal, noise, rand, safe } from '../media/soundscape/synth'
import { perchZone } from '../navigation/perch'
import { useMuseum } from '../state/store'
import { visitor } from '../state/visitor'
import { useTour } from '../tour/engine'
import { caption } from './captions'
import { onCue } from './cues'
import { kindProps } from './settings'

export type Stem = ScoreStem
export { CHAPTER_MIX, SA, ZONE_CHAPTER }

const STEMS: readonly Stem[] = ['drone', 'fifth', 'pulse', 'water', 'air', 'fire', 'coda']

const BASE_LEVEL = 0.09 // the score sits well under the room tones
const STEM_TC = 1.6 // s, setTargetAtTime constant: ≈5 s cross-fades
const DUCK_TO = 0.3
const RELEASE_AFTER = 6 // s silent before a stem's nodes are released
const LOOP_SEC = 5.2 // the tanpura cycle

/* ------------------------------------------------------------------ */
/* Stem synthesis                                                      */
/* ------------------------------------------------------------------ */

interface StemPart {
  kit: Kit
  schedule?: (now: number, horizon: number) => void
}

const bufferCache = new WeakMap<BaseAudioContext, Partial<Record<'drone' | 'fifth', AudioBuffer>>>()

/** Ring time (s) → Karplus–Strong per-period decay for a string at `f`. */
const ringDecay = (f: number, sec: number) => Math.exp(Math.log(0.001) / (sec * f))

/** The tanpura cycle, rendered once: 'drone' = Sa′ Sa′ Sa(low); 'fifth' = the Pa string. */
function tanpuraBuffer(ctx: AudioContext, which: 'drone' | 'fifth'): AudioBuffer {
  const hit = bufferCache.get(ctx)?.[which]
  if (hit) return hit
  const rate = ctx.sampleRate
  const len = Math.floor(LOOP_SEC * rate)
  const buf = ctx.createBuffer(2, len, rate)
  const slot = LOOP_SEC / 4
  // the cycle: [Pa] Sa′ Sa′ Sa — the Pa string sits in the first slot
  const plucks: { f: number; slot: number; level: number }[] =
    which === 'fifth'
      ? [{ f: SA * 0.75, slot: 0, level: 0.5 }]
      : [
          { f: SA, slot: 1, level: 0.42 },
          { f: SA, slot: 2, level: 0.38 },
          { f: SA / 2, slot: 3, level: 0.55 },
        ]
  for (let ch = 0; ch < 2; ch++) {
    const out = buf.getChannelData(ch)
    for (const [i, p] of plucks.entries()) {
      // each string is a pair of slightly detuned courses, panned a little apart
      for (const det of [0.9993, 1.0007]) {
        const f = p.f * det * (ch ? 1.0002 : 0.9998)
        ksPluck(out, rate, Math.floor((p.slot * slot + (ch ? 0.006 : 0)) * rate), f, {
          seconds: LOOP_SEC,
          level: p.level * (ch === (i % 2) ? 0.55 : 0.45),
          decay: ringDecay(f, 4.6),
          jawari: 0.35,
          seed: 17 + i * 31 + ch * 7 + (det > 1 ? 3 : 0),
        })
      }
    }
    // tame the peak: a gentle normalise
    let peak = 0
    for (let i = 0; i < len; i++) peak = Math.max(peak, Math.abs(out[i]))
    if (peak > 0 && Number.isFinite(peak)) for (let i = 0; i < len; i++) out[i] = (out[i] / peak) * 0.7
    else out.fill(0)
  }
  const m = bufferCache.get(ctx) ?? {}
  m[which] = buf
  bufferCache.set(ctx, m)
  return buf
}

/** Pentatonic of Sa, an octave up (jal tarang bowls, coda bells). */
const SCALE = [1, 9 / 8, 5 / 4, 3 / 2, 5 / 3, 2]

function buildStem(stem: Stem, ctx: AudioContext, dest: AudioNode, t0: number): StemPart {
  const k = new Kit(ctx)
  const file = knownFile(`/audio/music/${stem}.mp3`)
  if (file) {
    const s = k.loop(file)
    s.connect(dest)
    return { kit: k }
  }
  switch (stem) {
    case 'drone':
    case 'fifth': {
      // loops start in phase with the score's clock, so the Pa lands in its slot of the cycle
      const s = ctx.createBufferSource()
      s.buffer = tanpuraBuffer(ctx, stem)
      s.loop = true
      const now = ctx.currentTime
      s.start(now, ((now - t0) % LOOP_SEC + LOOP_SEC) % LOOP_SEC)
      k.sources.push(s)
      k.own(s)
      s.connect(k.filter('lowpass', 4200, 0.5)).connect(k.gain(stem === 'drone' ? 0.9 : 0.75)).connect(dest)
      return { kit: k }
    }
    case 'pulse': {
      // gum · tak tak gum · tak · tak — eighths at 66 bpm, always in step with the cycle
      const PAT: ('gum' | 'tak' | null)[] = ['gum', null, 'tak', 'tak', 'gum', 'tak', null, 'tak']
      const eighth = 60 / 66 / 2
      const out = k.gain(0.75)
      out.connect(k.filter('lowpass', 3200, 0.5)).connect(dest)
      let next = Math.ceil((ctx.currentTime - t0) / eighth) * eighth + t0
      return {
        kit: k,
        schedule: (now, horizon) => {
          if (next < now - 0.5) next = Math.ceil((now - t0) / eighth) * eighth + t0
          while (next < horizon) {
            const step = Math.round((next - t0) / eighth) % PAT.length
            const s = PAT[step]
            if (s) ghatamStroke(ctx, out, Math.max(now, next), SA, s, s === 'gum' ? 0.55 : rand(0.25, 0.4))
            next += eighth
          }
        },
      }
    }
    case 'water': {
      const wash = k.gain(0.05)
      const lp = k.filter('lowpass', 700, 0.5)
      k.lfo(0.05, 250, lp.frequency)
      k.loop(noise(ctx).pink).connect(lp).connect(wash).connect(dest)
      const bowls = k.gain(0.9)
      bowls.connect(dest)
      let next = 0
      return {
        kit: k,
        schedule: (now, horizon) => {
          if (next < now - 1) next = now + rand(0.4, 1.5)
          while (next < horizon) {
            const f = SA * 2 * SCALE[Math.floor(Math.random() * SCALE.length)]
            // a clay bowl with water: a soft, round strike whose pitch sags a hair as it rings
            modal(ctx, bowls, Math.max(now, next), [
              { f, decay: 2.2, gain: 0.03 },
              { f: f * 2.71, decay: 0.9, gain: 0.008 },
              { f: f * 5.15, decay: 0.3, gain: 0.003 },
            ], { bend: 0.995, bendSec: 1.2 })
            next += Math.random() < 0.3 ? rand(0.25, 0.5) : rand(1.6, 3.8)
          }
        },
      }
    }
    case 'air': {
      const bp = k.filter('bandpass', 520, 0.7)
      k.lfo(0.06, 260, bp.frequency)
      const wind = k.gain(0.06)
      k.lfo(0.04, 0.025, wind.gain)
      k.loop(noise(ctx).pink).connect(bp).connect(wind).connect(dest)
      // a slow breath tone on Pa, swelling in and out
      const breath = k.gain(0)
      k.osc('sine', SA * 1.5).connect(breath)
      k.lfo(0.035, 0.012, breath.gain)
      breath.connect(k.filter('lowpass', 1200, 0.4)).connect(dest)
      return { kit: k }
    }
    case 'fire': {
      const roar = k.gain(0.07)
      k.lfo(0.11, 0.03, roar.gain)
      k.loop(noise(ctx).brown).connect(k.filter('lowpass', 170, 0.5)).connect(roar).connect(dest)
      const crack = k.gain(0.6)
      crack.connect(dest)
      let next = 0
      return {
        kit: k,
        schedule: (now, horizon) => {
          if (next < now - 1) next = now + rand(0.1, 0.5)
          while (next < horizon) {
            burst(ctx, crack, Math.max(now, next), { type: 'highpass', f: rand(2000, 4500), peak: rand(0.01, 0.03), attack: 0.0008, decay: rand(0.005, 0.015) })
            next += Math.random() < 0.75 ? rand(0.04, 0.15) : rand(0.4, 1.4)
          }
        },
      }
    }
    case 'coda': {
      const bells = k.gain(0.8)
      bells.connect(dest)
      const fall = [5, 3, 2, 0, 3, 1]
      let next = 0
      let i = 0
      return {
        kit: k,
        schedule: (now, horizon) => {
          if (next < now - 1) next = now + 0.5
          while (next < horizon) {
            clayBell(ctx, bells, Math.max(now, next), SA * 2 * SCALE[fall[i % fall.length]], 0.55)
            i++
            next += i % fall.length === 0 ? 4.5 : 1.5
          }
        },
      }
    }
  }
}

/* ------------------------------------------------------------------ */
/* Engine                                                              */
/* ------------------------------------------------------------------ */

interface StemState {
  stem: Stem
  gain: GainNode
  part: StemPart | null
  level: number
  silentSince: number
}

interface ScoreGraph {
  ctx: AudioContext
  out: GainNode
  t0: number
}

let graph: ScoreGraph | null = null
const stems = new Map<Stem, StemState>()
/** Cue accents: stem → { level, until (context time) }. */
const accents = new Map<Stem, { level: number; until: number }>()
let chapter: TourChapter | null = null
let lastZone: ZoneId | null = null
let timer = 0
let installed = false
let probed = false
const MUSIC_CAPTION = captionKey('caption.music', null)

function wanted() {
  const st = useMuseum.getState()
  const hidden = typeof document !== 'undefined' && document.hidden
  return st.soundOn && st.phase === 'entered' && isAudioUnlocked() && !hidden
}

function ensureGraph(ctx: AudioContext): ScoreGraph | null {
  if (graph && graph.ctx === ctx) return graph
  const input = ambienceInput()
  if (!input) return null
  return safe(() => {
    const out = ctx.createGain()
    out.gain.value = 0
    out.connect(input)
    graph = { ctx, out, t0: ctx.currentTime }
    return graph
  }, null)
}

/** True while narration (speech or a recorded guide) is speaking. */
function narrating(): boolean {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window && window.speechSynthesis.speaking) return true
  const t = useTour.getState()
  return t.active && t.narration && t.phase === 'viewing' && t.progress < 0.55
}

/** The chapter now: the tour stop's, else the zone's. */
export function currentChapter(): TourChapter {
  const t = useTour.getState()
  if (t.active) {
    const c = TOUR_STOPS[t.index]?.chapter
    if (c) return c
  }
  const z = perchZone() ?? zoneAt(visitor.x, visitor.z)?.id ?? lastZone
  if (z) lastZone = z
  return (z && ZONE_CHAPTER[z]) || 'earth'
}

function stemTarget(stem: Stem, now: number, ch: TourChapter): number {
  let v = CHAPTER_MIX[ch][stem] ?? 0
  const a = accents.get(stem)
  if (a) {
    if (a.until < now) accents.delete(stem)
    else v = Math.max(v, a.level)
  }
  return v
}

function tick() {
  const ctx = getAudioContext(false)
  if (!ctx) return
  const active = ctx.state === 'running' && wanted()
  const g = active ? ensureGraph(ctx) : graph
  if (!g || g.ctx !== ctx) return
  const now = ctx.currentTime
  if (active && !probed) {
    probed = true
    for (const s of STEMS) void loadFile(ctx, `/audio/music/${s}.mp3`)
  }

  const props = kindProps('spectacle')
  const level = BASE_LEVEL * (typeof props.music === 'number' ? Math.max(0, Math.min(1, props.music)) : 0.6)
  const master = active ? level * (narrating() ? DUCK_TO : 1) : 0
  safe(() => g.out.gain.setTargetAtTime(master, now, active ? 0.8 : 0.3), undefined)

  const ch = currentChapter()
  if (ch !== chapter) {
    if (chapter !== null && MUSIC_CAPTION && active) caption(MUSIC_CAPTION, 4000)
    chapter = ch
  }

  for (const stem of STEMS) {
    const target = active ? stemTarget(stem, now, ch) : 0
    let s = stems.get(stem)
    if (target > 0 && !s) {
      const gain = ctx.createGain()
      gain.gain.value = 0
      gain.connect(g.out)
      const part = safe(() => buildStem(stem, ctx, gain, g.t0), null)
      stems.set(stem, (s = { stem, gain, part, level: -1, silentSince: -1 }))
    }
    if (!s) continue
    if (target !== s.level) {
      s.level = target
      safe(() => s!.gain.gain.setTargetAtTime(target, now, STEM_TC), undefined)
    }
    if (target === 0 && s.gain.gain.value < 0.003) {
      if (s.silentSince < 0) s.silentSince = now
      else if (now - s.silentSince > RELEASE_AFTER) {
        safe(() => s!.part?.kit.dispose(), undefined)
        safe(() => s!.gain.disconnect(), undefined)
        stems.delete(stem)
      }
      continue
    }
    s.silentSince = -1
    const part = s.part
    if (active && part?.schedule) safe(() => part.schedule!(now, now + 0.3), undefined)
  }
}

function loop() {
  safe(tick, undefined)
  timer = window.setTimeout(loop, stems.size ? 100 : 400)
}

/** Bring a stem forward for `sec` seconds (a cue, the Turn, a tour stop). */
export function accentStem(stem: Stem, level = 1, sec = 30) {
  const ctx = getAudioContext(false)
  const now = ctx?.currentTime ?? 0
  accents.set(stem, { level, until: now + sec })
  safe(tick, undefined)
}

const CUE_STEM: Record<string, Stem> = { drone: 'drone', fifth: 'fifth', pulse: 'pulse', water: 'water', air: 'air', wind: 'air', fire: 'fire', coda: 'coda' }

/** Install the score (idempotent; client only). Mounted by the craft mount. */
export function ensureMusic() {
  if (installed || typeof window === 'undefined') return
  installed = true
  // The Turn (F7): the drone swells and opens into a fifth
  const turn = () => {
    accentStem('drone', 1, 24)
    accentStem('fifth', 0.9, 24)
    if (MUSIC_CAPTION) caption(MUSIC_CAPTION, 4000)
  }
  onCue('zone-first:inner', turn)
  onCue('reveal:turn', turn)
  onCue('*', (e) => {
    const m = /^music:(\w+)$/.exec(String(e.id))
    if (!m) return
    const stem = CUE_STEM[m[1]]
    if (stem) accentStem(stem, 1, 40)
  })
  window.clearTimeout(timer)
  loop()
}

/** Snapshot for tests and debugging. */
export function musicDebug() {
  return {
    chapter,
    stems: [...stems.values()].map((s) => ({ stem: s.stem, level: s.level, gain: Math.round(s.gain.gain.value * 1000) / 1000 })),
    master: graph ? Math.round(graph.out.gain.value * 10000) / 10000 : 0,
  }
}

/** The pitches the score is tuned to (the ghatam set takes its bass from Sa). */
export const tuning = { SA, pentatonic: SCALE.map((r) => SA * 2 * r) }
