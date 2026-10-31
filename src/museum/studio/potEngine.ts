/**
 * Pot engine for the "Shape it yourself" studio — pure and deterministic (no DOM, no three).
 *
 * A pot is a list of operations reduced from a fixed starting lump:
 *
 *   reducePot(ops) → PotState { points, foot, trims, body, slip, glaze, burnish, bands, fired }
 *
 * `points` are the profile's control points (cm, radius r from the axis, height y from the
 * wheel head), base first, rim last. The wall is a centripetal Catmull-Rom spline through them
 * (`profileCurve`), and `potSection` turns the spline into the closed lathe outline the wheel
 * spins: underside (with or without a foot ring), outer wall, rim, inner wall and floor.
 *
 * Every op is validated and clamped by the reducer, so a stored list (localStorage, or one
 * edited by hand) can never produce an impossible pot; ops that would change nothing — or any
 * op after the firing, since fired clay cannot be reshaped — are ignored. Replaying the same
 * list always gives the same pot, which is what undo / redo / reload rely on.
 */
import { BODY_IDS, GLAZE_IDS, getPotMotif, MOTIF_IDS, SLIP_IDS, TECHNIQUES, type BandTechnique, type ClayBodyId, type GlazeId, type PotMotifId, type SlipId } from './clayPalette'

export interface ProfilePoint {
  r: number
  y: number
}

export interface Band {
  motif: PotMotifId
  tech: BandTechnique
  /** Centre of the band as a fraction of the pot's height (0 = base, 1 = rim). */
  at: number
}

export type PotOp =
  /** Move control point `i` (a drag, a slider, an arrow key). */
  | { t: 'set'; i: number; r: number; y: number }
  /** Draw the walls up: taller, a little thinner towards the rim. */
  | { t: 'pull' }
  /** Push the wall out / in around `at` (fraction of the height). */
  | { t: 'widen'; at: number }
  | { t: 'narrow'; at: number }
  /** Cut the rim level, TRIM_CM lower. */
  | { t: 'trim' }
  /** Turn a foot ring under the base. */
  | { t: 'foot' }
  | { t: 'body'; id: ClayBodyId }
  | { t: 'slip'; id: SlipId | null }
  | { t: 'glaze'; id: GlazeId | null }
  | { t: 'burnish'; on: boolean }
  | { t: 'band'; motif: PotMotifId; tech: BandTechnique; at: number }
  | { t: 'fire' }

export type PotOpKind = PotOp['t']

export interface PotState {
  points: ProfilePoint[]
  foot: boolean
  /** How many times the rim has been trimmed (a trimmed rim is cut flat). */
  trims: number
  body: ClayBodyId
  slip: SlipId | null
  glaze: GlazeId | null
  burnish: boolean
  bands: Band[]
  fired: boolean
}

/* ------------------------------------------------------------------ */
/* Limits                                                              */
/* ------------------------------------------------------------------ */

/** Radius limits (cm): base ring, any other point. */
export const BASE_R: [number, number] = [3, 16]
export const MIN_R = 1.5
export const MAX_R = 20
/** Height limits (cm) and the least rise between neighbouring control points. */
export const MIN_GAP = 1.2
export const MAX_H = 40
export const MIN_H = 6
export const TRIM_CM = 1
export const MAX_BANDS = 6
export const MAX_OPS = 600
/** How far widen / narrow push the wall at the centre of the touch (cm), and its reach (fraction of height). */
export const SHAPE_STEP = 1.4
export const SHAPE_REACH = 0.16
/** Wall and floor thickness (cm). */
export const WALL = 0.85
export const RIM_WALL = 0.55
export const FLOOR = 1
export const FOOT_H = 0.9

/** The lump the wheel starts with: a low, slightly swelling cylinder. */
export const START_POINTS: readonly ProfilePoint[] = Object.freeze([
  { r: 6, y: 0 },
  { r: 7.2, y: 4 },
  { r: 8, y: 9 },
  { r: 7.4, y: 14 },
  { r: 5.8, y: 18 },
  { r: 6.4, y: 21 },
])

export const START: PotState = Object.freeze({
  points: START_POINTS.map((p) => ({ ...p })),
  foot: false,
  trims: 0,
  body: 'terracotta',
  slip: null,
  glaze: null,
  burnish: false,
  bands: [],
  fired: false,
}) as PotState

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
const round2 = (v: number) => Math.round(v * 100) / 100
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

/** Clamp a profile into a turnable shape: base on the wheel, heights rising, radii in range. */
export function normalise(points: readonly ProfilePoint[]): ProfilePoint[] {
  const n = points.length
  const out: ProfilePoint[] = []
  for (let i = 0; i < n; i++) {
    const p = points[i]
    if (i === 0) {
      out.push({ r: round2(clamp(p.r, BASE_R[0], BASE_R[1])), y: 0 })
      continue
    }
    const lo = out[i - 1].y + MIN_GAP
    const hi = MAX_H - (n - 1 - i) * MIN_GAP
    out.push({ r: round2(clamp(p.r, MIN_R, MAX_R)), y: round2(clamp(p.y, lo, hi)) })
  }
  return out
}

export const potHeight = (s: Pick<PotState, 'points'>) => s.points[s.points.length - 1].y

const samePoints = (a: readonly ProfilePoint[], b: readonly ProfilePoint[]) => a.length === b.length && a.every((p, i) => p.r === b[i].r && p.y === b[i].y)

/* ------------------------------------------------------------------ */
/* Spline                                                              */
/* ------------------------------------------------------------------ */

/**
 * Centripetal Catmull-Rom through the control points (no cusps or loops between points),
 * `perSeg` samples per span; the result starts and ends exactly on the first / last point.
 */
export function profileCurve(points: readonly ProfilePoint[], perSeg = 10): ProfilePoint[] {
  const n = points.length
  if (n < 2) return points.map((p) => ({ ...p }))
  const first = points[0]
  const last = points[n - 1]
  const P = [{ r: 2 * first.r - points[1].r, y: 2 * first.y - points[1].y }, ...points, { r: 2 * last.r - points[n - 2].r, y: 2 * last.y - points[n - 2].y }]
  const knot = (a: ProfilePoint, b: ProfilePoint) => Math.max(1e-4, Math.sqrt(Math.hypot(b.r - a.r, b.y - a.y)))
  const out: ProfilePoint[] = []
  for (let i = 0; i < n - 1; i++) {
    const p0 = P[i]
    const p1 = P[i + 1]
    const p2 = P[i + 2]
    const p3 = P[i + 3]
    const t0 = 0
    const t1 = t0 + knot(p0, p1)
    const t2 = t1 + knot(p1, p2)
    const t3 = t2 + knot(p2, p3)
    for (let s = 0; s < perSeg; s++) {
      const t = t1 + ((t2 - t1) * s) / perSeg
      const lerp = (a: ProfilePoint, b: ProfilePoint, ta: number, tb: number) => {
        const k = (t - ta) / (tb - ta)
        return { r: a.r + (b.r - a.r) * k, y: a.y + (b.y - a.y) * k }
      }
      const a1 = lerp(p0, p1, t0, t1)
      const a2 = lerp(p1, p2, t1, t2)
      const a3 = lerp(p2, p3, t2, t3)
      const b1 = lerp(a1, a2, t0, t2)
      const b2 = lerp(a2, a3, t1, t3)
      out.push(lerp(b1, b2, t1, t2))
    }
  }
  out.push({ ...last })
  return out
}

/** Outer radius of the wall at height y (cm), read off the spline. */
export function radiusAt(points: readonly ProfilePoint[], y: number): number {
  const c = profileCurve(points, 12)
  if (y <= c[0].y) return c[0].r
  for (let i = 1; i < c.length; i++) {
    const a = c[i - 1]
    const b = c[i]
    if (y <= b.y) {
      const k = b.y === a.y ? 0 : (y - a.y) / (b.y - a.y)
      return a.r + (b.r - a.r) * k
    }
  }
  return c[c.length - 1].r
}

/* ------------------------------------------------------------------ */
/* Reducer                                                             */
/* ------------------------------------------------------------------ */

function shapeAround(points: readonly ProfilePoint[], at: number, delta: number): ProfilePoint[] {
  const h = points[points.length - 1].y
  return points.map((p, i) => {
    const d = p.y / h - at
    const w = Math.exp(-(d * d) / (2 * SHAPE_REACH * SHAPE_REACH))
    // the base ring moves less: it is held by the wheel head
    return { r: p.r + delta * w * (i === 0 ? 0.5 : 1), y: p.y }
  })
}

/** Applies one op; returns `s` itself when the op is invalid or would change nothing. */
export function applyOp(s: PotState, op: PotOp): PotState {
  if (s.fired) return s
  const withPoints = (pts: ProfilePoint[]) => {
    const next = normalise(pts)
    return samePoints(next, s.points) ? s : { ...s, points: next }
  }
  switch (op.t) {
    case 'set': {
      if (!Number.isInteger(op.i) || op.i < 0 || op.i >= s.points.length || !finite(op.r) || !finite(op.y)) return s
      const pts = s.points.map((p, i) => (i === op.i ? { r: op.r, y: op.y } : p))
      return withPoints(pts)
    }
    case 'pull': {
      const h = potHeight(s)
      const k = Math.min(1.14, MAX_H / h)
      if (k <= 1.0001) return s
      const n = s.points.length - 1
      return withPoints(s.points.map((p, i) => ({ r: p.r * (1 - 0.06 * (i / n)), y: p.y * k })))
    }
    case 'widen':
    case 'narrow': {
      if (!finite(op.at)) return s
      return withPoints(shapeAround(s.points, clamp(op.at, 0, 1), op.t === 'widen' ? SHAPE_STEP : -SHAPE_STEP))
    }
    case 'trim': {
      const h = potHeight(s)
      const top = h - TRIM_CM
      if (top < MIN_H) return s
      // the same wall, cut lower: resample the current spline at proportionally lower heights
      const pts = s.points.map((p) => {
        const y = (p.y * top) / h
        return { r: radiusAt(s.points, y), y }
      })
      const next = normalise(pts)
      return { ...s, points: next, trims: s.trims + 1 }
    }
    case 'foot':
      return s.foot ? s : { ...s, foot: true }
    case 'body':
      return (BODY_IDS as readonly string[]).includes(op.id) && op.id !== s.body ? { ...s, body: op.id } : s
    case 'slip':
      if (op.id !== null && !(SLIP_IDS as readonly string[]).includes(op.id)) return s
      return op.id === s.slip ? s : { ...s, slip: op.id }
    case 'glaze':
      if (op.id !== null && !(GLAZE_IDS as readonly string[]).includes(op.id)) return s
      return op.id === s.glaze ? s : { ...s, glaze: op.id }
    case 'burnish':
      return typeof op.on === 'boolean' && op.on !== s.burnish ? { ...s, burnish: op.on } : s
    case 'band': {
      if (s.bands.length >= MAX_BANDS || !finite(op.at)) return s
      if (!(MOTIF_IDS as readonly string[]).includes(op.motif) || !(TECHNIQUES as readonly string[]).includes(op.tech)) return s
      return { ...s, bands: [...s.bands, { motif: op.motif, tech: op.tech, at: round2(clamp(op.at, 0.05, 0.95)) }] }
    }
    case 'fire':
      return { ...s, fired: true }
    default:
      return s
  }
}

/** The pot an op list describes. */
export function reducePot(ops: readonly PotOp[], start: PotState = START): PotState {
  let s = start
  for (const op of ops) s = applyOp(s, op)
  return s
}

/** Whether `op` would change the pot (the studio does not record ops that do nothing). */
export const changes = (s: PotState, op: PotOp) => applyOp(s, op) !== s

/**
 * Validates a stored op list (localStorage or anything else untrusted): unknown or malformed
 * ops are dropped and the list is capped at MAX_OPS (keeping the latest).
 */
export function parseOps(raw: unknown): PotOp[] {
  if (!Array.isArray(raw)) return []
  const out: PotOp[] = []
  const inList = <T extends string>(list: readonly T[], v: unknown): v is T => typeof v === 'string' && (list as readonly string[]).includes(v)
  for (const o of raw as unknown[]) {
    if (!o || typeof o !== 'object') continue
    const x = o as Record<string, unknown>
    switch (x.t) {
      case 'set':
        if (Number.isInteger(x.i) && finite(x.r) && finite(x.y)) out.push({ t: 'set', i: x.i as number, r: x.r, y: x.y })
        break
      case 'pull':
      case 'trim':
      case 'foot':
      case 'fire':
        out.push({ t: x.t })
        break
      case 'widen':
      case 'narrow':
        if (finite(x.at)) out.push({ t: x.t, at: x.at })
        break
      case 'body':
        if (inList(BODY_IDS, x.id)) out.push({ t: 'body', id: x.id })
        break
      case 'slip':
        if (x.id === null || inList(SLIP_IDS, x.id)) out.push({ t: 'slip', id: x.id as SlipId | null })
        break
      case 'glaze':
        if (x.id === null || inList(GLAZE_IDS, x.id)) out.push({ t: 'glaze', id: x.id as GlazeId | null })
        break
      case 'burnish':
        if (typeof x.on === 'boolean') out.push({ t: 'burnish', on: x.on })
        break
      case 'band':
        if (inList(MOTIF_IDS, x.motif) && inList(TECHNIQUES, x.tech) && finite(x.at)) out.push({ t: 'band', motif: x.motif, tech: x.tech, at: x.at })
        break
    }
  }
  return out.slice(-MAX_OPS)
}

/**
 * Appends `op`; a 'set' on the same point as the previous op replaces it when `merge` is true
 * (one drag or one slider gesture is one step to undo).
 */
export function pushOp(ops: readonly PotOp[], op: PotOp, merge = false): PotOp[] {
  const last = ops[ops.length - 1]
  if (merge && op.t === 'set' && last?.t === 'set' && last.i === op.i) return [...ops.slice(0, -1), op]
  return [...ops, op].slice(-MAX_OPS)
}

/* ------------------------------------------------------------------ */
/* Section (the outline the lathe spins)                               */
/* ------------------------------------------------------------------ */

export type SectionPart = 'under' | 'outer' | 'rim' | 'inner'

export interface PotSection {
  /** [r, y] in cm, from the centre of the underside round to the centre of the inside floor. */
  pts: [number, number][]
  part: SectionPart[]
  /** Height of the body (y of the rim's outer edge) — the foot raises it by FOOT_H. */
  bodyBase: number
  top: number
  /** Overall height including the rim's lip. */
  height: number
}

/** The closed lathe outline: underside → outer wall → rim → inner wall → floor. */
export function potSection(s: Pick<PotState, 'points' | 'foot' | 'trims'>, perSeg = 10): PotSection {
  const curve = profileCurve(s.points, perSeg)
  const base = s.foot ? FOOT_H : 0
  const pts: [number, number][] = []
  const part: SectionPart[] = []
  const add = (r: number, y: number, p: SectionPart) => {
    pts.push([Math.max(0, r), y])
    part.push(p)
  }
  const r0 = curve[0].r
  if (s.foot) {
    // a turned foot ring, recessed underneath
    const rf = Math.max(2.2, r0 * 0.8)
    add(0, 0.45, 'under')
    add(rf - 0.85, 0.45, 'under')
    add(rf - 0.6, 0.02, 'under')
    add(rf - 0.05, 0, 'under')
    add(rf + 0.12, 0.3, 'outer')
  } else {
    add(0, 0, 'under')
    add(r0 - 0.4, 0, 'under')
  }
  for (const p of curve) add(p.r, p.y + base, 'outer')
  const top = curve[curve.length - 1].y + base
  const rTop = curve[curve.length - 1].r
  // rim: rounded as thrown, cut flat once trimmed
  if (s.trims > 0) {
    add(rTop - 0.03, top + 0.14, 'rim')
    add(rTop - RIM_WALL + 0.03, top + 0.14, 'rim')
  } else {
    add(rTop - RIM_WALL * 0.18, top + 0.22, 'rim')
    add(rTop - RIM_WALL * 0.5, top + 0.3, 'rim')
    add(rTop - RIM_WALL * 0.84, top + 0.2, 'rim')
  }
  // inner wall: the outer curve offset inwards along its normal
  const floorY = base + FLOOR
  const h = Math.max(1, top - base)
  let lastR = rTop - RIM_WALL
  for (let i = curve.length - 1; i >= 1; i--) {
    const a = curve[Math.max(0, i - 1)]
    const b = curve[Math.min(curve.length - 1, i + 1)]
    let dr = b.r - a.r
    let dy = b.y - a.y
    const len = Math.hypot(dr, dy) || 1
    dr /= len
    dy /= len
    const p = curve[i]
    const t = WALL + (RIM_WALL - WALL) * (p.y / h)
    const r = p.r - dy * t
    const y = p.y + base + dr * t
    if (y <= floorY + 0.35) break
    lastR = Math.max(0.2, r)
    add(lastR, Math.min(y, top - 0.08), 'inner')
  }
  add(Math.max(0.2, Math.min(lastR, r0 - WALL) * 0.82), floorY, 'inner')
  add(0, floorY, 'inner')
  return { pts, part, bodyBase: base, top, height: top + (s.trims > 0 ? 0.14 : 0.3) }
}

/* ------------------------------------------------------------------ */
/* Bands                                                               */
/* ------------------------------------------------------------------ */

/** Height (cm, on the body) of a band's centre. */
export const bandY = (s: Pick<PotState, 'points'>, b: Band) => b.at * potHeight(s)

/** How many times a band's motif repeats round the pot (whole repeats, so the ring closes). */
export function bandRepeats(s: Pick<PotState, 'points'>, b: Band): number {
  const r = radiusAt(s.points, bandY(s, b))
  return Math.max(6, Math.round((2 * Math.PI * r) / getPotMotif(b.motif).pitch))
}

/** Impressions a stamped decoration took (sgraffito is drawn, not stamped). */
export const stampCount = (s: PotState) => s.bands.reduce((n, b) => n + (b.tech === 'stamp' ? bandRepeats(s, b) : 0), 0)

/* ------------------------------------------------------------------ */
/* Seeded noise (hand-made unevenness, flecks)                         */
/* ------------------------------------------------------------------ */

export function mulberry(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
