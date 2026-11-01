/**
 * Soundscape synthesis toolkit: noise loops, node bookkeeping, one-shot voices and the
 * species-like bird phrases shared by the zone channels and the outdoor layers.
 * Everything is procedural (no assets) and defensive.
 */
import { createPanner, createRoomReverb } from '../audioEngine'

export function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn()
  } catch {
    return fallback
  }
}
export const rand = (a: number, b: number) => a + Math.random() * (b - a)
export const randInt = (a: number, b: number) => Math.floor(rand(a, b + 1))
export const pick = <T>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)]
export const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))
/** Horizontal distance from (x, z) to a 3D point. */
export const hdist = (x: number, z: number, p: readonly [number, number, number]) => Math.hypot(x - p[0], z - p[2])

export type Vec3 = [number, number, number]

/* ------------------------------ noise loops ----------------------------- */

type NoiseKind = 'white' | 'pink' | 'brown'
const noiseCache = new WeakMap<BaseAudioContext, Record<NoiseKind, AudioBuffer>>()

/** Stereo noise loops (seam cross-faded), generated once per context. */
export function noise(ctx: AudioContext): Record<NoiseKind, AudioBuffer> {
  const hit = noiseCache.get(ctx)
  if (hit) return hit
  const make = (kind: NoiseKind, seconds: number) => {
    const len = Math.floor(ctx.sampleRate * seconds)
    const buf = ctx.createBuffer(2, len, ctx.sampleRate)
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch)
      let b0 = 0
      let b1 = 0
      let b2 = 0
      let last = 0
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1
        if (kind === 'white') d[i] = w * 0.5
        else if (kind === 'pink') {
          b0 = 0.99765 * b0 + w * 0.099046
          b1 = 0.963 * b1 + w * 0.2965164
          b2 = 0.57 * b2 + w * 1.0526913
          d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.11
        } else {
          last = (last + 0.02 * w) / 1.02
          d[i] = last * 3.5
        }
      }
      const seam = Math.floor(ctx.sampleRate * 0.25)
      for (let i = 0; i < seam; i++) {
        const t = i / seam
        const j = len - seam + i
        d[j] = d[j] * (1 - t) + d[i] * t
      }
    }
    return buf
  }
  const n = { white: make('white', 3), pink: make('pink', 6), brown: make('brown', 6) }
  noiseCache.set(ctx, n)
  return n
}

/* ------------------------------ node bookkeeping ------------------------ */

/**
 * Live WebAudio nodes made through this toolkit: `live` = the persistent parts (Kits), `voices`
 * = one-shot voices still sounding. The leak check reads it: walking through ten zones must leave
 * `live` where it started (voices come and go with whatever is playing at that instant).
 */
export const nodeCount = { live: 0, voices: 0 }

/** Tracks the persistent nodes of one synth part so it can be torn down. */
export class Kit {
  readonly nodes: AudioNode[] = []
  readonly sources: AudioScheduledSourceNode[] = []
  constructor(readonly ctx: AudioContext) {}
  /** Adopt a node made elsewhere, so dispose() releases it too. */
  own<N extends AudioNode>(n: N): N {
    this.nodes.push(n)
    nodeCount.live++
    return n
  }
  gain(v: number) {
    const g = this.ctx.createGain()
    g.gain.value = v
    return this.own(g)
  }
  filter(type: BiquadFilterType, f: number, q = 0.7) {
    const b = this.ctx.createBiquadFilter()
    b.type = type
    b.frequency.value = f
    b.Q.value = q
    return this.own(b)
  }
  loop(buf: AudioBuffer) {
    const s = this.ctx.createBufferSource()
    s.buffer = buf
    s.loop = true
    s.start(this.ctx.currentTime, Math.random() * buf.duration)
    this.sources.push(s)
    return this.own(s)
  }
  osc(type: OscillatorType, f: number) {
    const o = this.ctx.createOscillator()
    o.type = type
    o.frequency.value = f
    o.start()
    this.sources.push(o)
    return this.own(o)
  }
  lfo(freq: number, depth: number, target: AudioParam) {
    const o = this.osc('sine', freq)
    o.connect(this.gain(depth)).connect(target)
    return o
  }
  panner(pos: Vec3, refDistance: number, rolloff: number, maxDistance: number) {
    return this.own(createPanner(this.ctx, pos, { refDistance, rolloff, maxDistance }))
  }
  reverb(seconds: number, decay: number) {
    return this.own(createRoomReverb(this.ctx, seconds, decay))
  }
  dispose() {
    for (const s of this.sources) safe(() => s.stop(), undefined)
    for (const n of this.nodes) safe(() => n.disconnect(), undefined)
    nodeCount.live = Math.max(0, nodeCount.live - this.nodes.length)
    this.sources.length = 0
    this.nodes.length = 0
  }
}

/* ------------------------------ one-shot voices ------------------------- */

/** Disconnect a one-shot voice's nodes once its source has ended. */
export function releaseOnEnd(src: AudioScheduledSourceNode, nodes: AudioNode[]) {
  nodeCount.voices += nodes.length
  src.onended = () => {
    for (const n of nodes) safe(() => n.disconnect(), undefined)
    nodeCount.voices = Math.max(0, nodeCount.voices - nodes.length)
  }
}

/** Filtered white-noise burst with an exponential attack/decay envelope. */
export function burst(ctx: AudioContext, dest: AudioNode, t: number, o: { type: BiquadFilterType; f: number; q?: number; f1?: number; peak: number; attack?: number; decay: number }) {
  const src = ctx.createBufferSource()
  const buf = noise(ctx).white
  src.buffer = buf
  const bq = ctx.createBiquadFilter()
  bq.type = o.type
  bq.frequency.setValueAtTime(o.f, t)
  bq.Q.value = o.q ?? 0.7
  const a = o.attack ?? 0.002
  if (o.f1) bq.frequency.exponentialRampToValueAtTime(o.f1, t + a + o.decay)
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, o.peak), t + a)
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + o.decay)
  src.connect(bq).connect(g).connect(dest)
  const dur = a + o.decay + 0.03
  src.start(t, Math.random() * Math.max(0, buf.duration - dur - 0.01), dur)
  releaseOnEnd(src, [src, bq, g])
}

/** Oscillator note with an exponential frequency glide, envelope and optional FM. */
export function tone(ctx: AudioContext, dest: AudioNode, t: number, o: { type?: OscillatorType; f0: number; f1?: number; peak: number; attack?: number; decay: number; fm?: { rate: number; depth: number } }) {
  const osc = ctx.createOscillator()
  osc.type = o.type ?? 'sine'
  const a = o.attack ?? 0.004
  osc.frequency.setValueAtTime(o.f0, t)
  if (o.f1) osc.frequency.exponentialRampToValueAtTime(o.f1, t + a + o.decay)
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, o.peak), t + a)
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + o.decay)
  osc.connect(g).connect(dest)
  const nodes: AudioNode[] = [osc, g]
  const end = t + a + o.decay + 0.03
  if (o.fm) {
    const m = ctx.createOscillator()
    m.frequency.value = o.fm.rate
    const mg = ctx.createGain()
    mg.gain.value = o.fm.depth
    m.connect(mg).connect(osc.frequency)
    m.start(t)
    m.stop(end)
    nodes.push(m, mg)
  }
  osc.start(t)
  osc.stop(end)
  releaseOnEnd(osc, nodes)
}

/** Schedule a short gated pulse on a persistent voice's gain param. */
export function pulse(p: AudioParam, t: number, peak: number, attack: number, decay: number) {
  p.setValueAtTime(0.0001, t)
  p.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack)
  p.exponentialRampToValueAtTime(0.0001, t + attack + decay)
}

/* ------------------------------ bird phrases ---------------------------- */

/**
 * Species-like (not species-accurate) phrases: 0 whistled notes, 1 fast trill,
 * 2 down-swept chips, 3 FM warble. `pitch` scales frequency, `level` scales loudness.
 */
export function birdPhrase(ctx: AudioContext, dest: AudioNode, t: number, species: number, pitch = 1, level = 1) {
  switch (species) {
    case 0: {
      const base = rand(2100, 3000) * pitch
      const shape = pick([[1, 1.12, 0.94], [1, 1.25, 1.12, 1.25], [1.2, 1], [1, 0.9, 1.08, 1.2]])
      let at = t
      for (const r of shape) {
        const d = rand(0.1, 0.17)
        tone(ctx, dest, at, { f0: base * r, f1: base * r * rand(1.03, 1.1), peak: 0.018 * level, attack: 0.018, decay: d })
        at += d + rand(0.05, 0.1)
      }
      break
    }
    case 1: {
      const n = randInt(8, 16)
      const rate = rand(20, 30)
      let f = rand(3800, 4600) * pitch
      for (let i = 0; i < n; i++) {
        tone(ctx, dest, t + i / rate, { f0: f, f1: f * 0.92, peak: 0.009 * level, attack: 0.004, decay: 0.022 })
        f *= rand(0.985, 1.0)
      }
      break
    }
    case 2: {
      const n = randInt(3, 6)
      let at = t
      for (let i = 0; i < n; i++) {
        tone(ctx, dest, at, { f0: rand(4800, 5600) * pitch, f1: rand(2400, 2900) * pitch, peak: 0.012 * level, attack: 0.003, decay: rand(0.04, 0.06) })
        at += rand(0.12, 0.22)
      }
      break
    }
    default: {
      const reps = randInt(1, 2)
      let at = t
      for (let i = 0; i < reps; i++) {
        const d = rand(0.3, 0.55)
        const c = rand(2500, 3200) * pitch * (i ? 1.1 : 1)
        tone(ctx, dest, at, { f0: c, f1: c * rand(0.9, 1.1), peak: 0.01 * level, attack: 0.05, decay: d, fm: { rate: rand(18, 34), depth: rand(220, 420) } })
        at += d + rand(0.15, 0.3)
      }
    }
  }
}

/* ------------------------------ modal voices ---------------------------- */

/** One resonance of a struck body: frequency (Hz), 60 dB-ish decay (s) and level. */
export interface Mode {
  f: number
  decay: number
  gain: number
}

/**
 * Modal synthesis: a struck clay body as a few damped sine partials plus a filtered-noise
 * transient. `bend` glides every partial by that ratio over the first `bendSec` (the ghatam's
 * "gumki", when the player's belly opens the mouth). Returns the time the voice ends.
 */
export function modal(
  ctx: AudioContext,
  dest: AudioNode,
  t: number,
  modes: readonly Mode[],
  o: { level?: number; transient?: { f: number; q?: number; peak: number; decay: number }; bend?: number; bendSec?: number } = {},
): number {
  const level = o.level ?? 1
  let end = t
  for (const m of modes) {
    if (m.gain <= 0 || m.f <= 0 || m.f > ctx.sampleRate * 0.45) continue
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(m.f, t)
    if (o.bend && o.bend !== 1) osc.frequency.exponentialRampToValueAtTime(m.f * o.bend, t + (o.bendSec ?? 0.25))
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, m.gain * level), t + 0.003)
    // exp decay to −60 dB in `decay` seconds
    g.gain.setTargetAtTime(0.0001, t + 0.003, Math.max(0.01, m.decay / 6.9))
    osc.connect(g).connect(dest)
    const stop = t + m.decay + 0.08
    osc.start(t)
    osc.stop(stop)
    releaseOnEnd(osc, [osc, g])
    end = Math.max(end, stop)
  }
  if (o.transient) burst(ctx, dest, t, { type: 'bandpass', f: o.transient.f, q: o.transient.q ?? 1.2, peak: o.transient.peak * level, attack: 0.001, decay: o.transient.decay })
  return end
}

/** The partials of a fired-clay bell (terracotta, a clay clapper): dull, inharmonic, short. */
export function clayBellModes(f: number): Mode[] {
  return [
    { f, decay: 0.9, gain: 0.05 },
    { f: f * 2.32, decay: 0.5, gain: 0.032 },
    { f: f * 4.25, decay: 0.28, gain: 0.018 },
    { f: f * 6.63, decay: 0.16, gain: 0.008 },
  ]
}

/** Ring a clay bell (with its clack). */
export function clayBell(ctx: AudioContext, dest: AudioNode, t: number, f: number, level = 1) {
  return modal(ctx, dest, t, clayBellModes(f), { level, transient: { f: f * 5.5, q: 2, peak: 0.02, decay: 0.03 } })
}

/**
 * A ghatam stroke. 'gum' is the open bass of the mouth (Helmholtz) with the body under it; 'tak'
 * is a fingertip on the shoulder: the upper modes and a bright click. `f0` is the pot's bass.
 */
export function ghatamStroke(ctx: AudioContext, dest: AudioNode, t: number, f0: number, stroke: 'gum' | 'tak' | 'gumki', level = 1) {
  if (stroke === 'tak') {
    return modal(
      ctx,
      dest,
      t,
      [
        { f: f0 * 3.05, decay: 0.16, gain: 0.05 },
        { f: f0 * 4.9, decay: 0.11, gain: 0.04 },
        { f: f0 * 7.3, decay: 0.07, gain: 0.025 },
        { f: f0, decay: 0.12, gain: 0.02 },
      ],
      { level, transient: { f: 2800, q: 1.4, peak: 0.07, decay: 0.022 } },
    )
  }
  const gumki = stroke === 'gumki'
  return modal(
    ctx,
    dest,
    t,
    [
      { f: f0, decay: gumki ? 1.1 : 0.45, gain: 0.11 },
      { f: f0 * 2.32, decay: 0.22, gain: 0.035 },
      { f: f0 * 3.9, decay: 0.12, gain: 0.018 },
    ],
    { level, transient: { f: 900, q: 0.9, peak: 0.04, decay: 0.03 }, bend: gumki ? 0.82 : 0.97, bendSec: gumki ? 0.5 : 0.12 },
  )
}

/* ------------------------------ plucked strings ------------------------- */

/**
 * Karplus–Strong pluck rendered offline into `out` (mixed in at `at` samples, wrapping round the
 * end so a loop rings across its seam). `jawari` adds the tanpura's buzzing bridge: a soft
 * nonlinearity that keeps the upper partials alive as the note decays.
 */
export function ksPluck(out: Float32Array, sampleRate: number, at: number, f: number, o: { seconds: number; level: number; decay?: number; jawari?: number; seed?: number }) {
  const period = Math.max(2, Math.round(sampleRate / f))
  const buf = new Float32Array(period)
  let s = (o.seed ?? 1) >>> 0 || 1
  const rnd = () => {
    s ^= s << 13
    s ^= s >>> 17
    s ^= s << 5
    return ((s >>> 0) / 4294967296) * 2 - 1
  }
  // a soft pluck: low-passed noise burst
  let lp = 0
  for (let i = 0; i < period; i++) {
    lp = lp * 0.5 + rnd() * 0.5
    buf[i] = lp
  }
  const n = Math.floor(o.seconds * sampleRate)
  const decay = o.decay ?? 0.9985
  const jaw = o.jawari ?? 0
  let idx = 0
  let prev = 0
  for (let i = 0; i < n; i++) {
    const cur = buf[idx]
    let next = decay * 0.5 * (cur + prev)
    // the bridge: a cubic soft-clip that only ever takes energy away (so the loop stays stable)
    // while turning it into upper partials, then a hard ceiling for safety
    if (jaw > 0) next = Math.max(-1, Math.min(1, next - jaw * 0.3 * next * next * next))
    prev = cur
    buf[idx] = next
    idx = (idx + 1) % period
    // gentle fade-in of the first ms avoids a click
    const env = i < 48 ? i / 48 : 1
    out[(at + i) % out.length] += cur * o.level * env
  }
}
