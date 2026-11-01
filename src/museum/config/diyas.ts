/**
 * DIYA NIGHT — where the clay lamps stand (SPECTACLE F28, F2; GRAND §6.2 #8: 800 lamps spiral out
 * from the pool to the forecourt). Pure data, derived from the plan constants, never hand-typed;
 * unit-tested (tests/unit/clay-atmosphere.test.ts, grand-light.test.ts).
 *
 * Sets, in the order the spiral wave lights them (from the pool outward):
 *   pool       floating on the pool round the lotus, two rings
 *   curb       on the court's curb
 *   podiums    round the podium bases, A → B → C
 *   hallway    both sides of the Wine Hall (Hallway D)
 *   parikrama  both edges of the serpentine walk, west to east
 *   well       round the Sphere Well's rim, outside its balustrade
 *   annex      both sides of the Earth Room, from the mouth to the door
 *   path       the threshold: two lines either side of the rill, every 0.9 m (F2)
 *   forecourt  the forecourt's two long edges, from the entrance front to its far edge
 *   edge       the landscape plinth's edge, round the south half
 * Each lamp carries `seq` (0 … 1, when it lights in the spiral) and `weight` for thinning to a
 * tier's cap (`thinDiyas`), which keeps every set and the path's spacing.
 */
import { MUSEUM, KEY, polar } from './museum'
import { PODIUM_SLOTS } from './layout'
import { PARIKRAMA, SAT_DOOR_HALF_DEG, SATELLITES, JALI_SLOTS, SERPENTINE, SPHERE_WELL, serpentineOffset } from './satellites'

export type DiyaSet = 'pool' | 'curb' | 'podiums' | 'hallway' | 'parikrama' | 'well' | 'annex' | 'path' | 'forecourt' | 'edge'
export const DIYA_SETS: readonly DiyaSet[] = ['pool', 'curb', 'podiums', 'hallway', 'parikrama', 'well', 'annex', 'path', 'forecourt', 'edge']

/** The modest evening when the festival is off: the court and the threshold only. */
export const EVENING_SETS: readonly DiyaSet[] = ['pool', 'curb', 'path']

export interface Diya {
  x: number
  /** Floor (or curb / water) height the bowl sits on. */
  y: number
  z: number
  set: DiyaSet
  /** 0 … 1: when it lights in the spiral wave. */
  seq: number
  /** Bowl scale (the pool's floating lamps are a little smaller). */
  scale: number
}

/** Seq window of each set in the wave. */
const WAVE: Record<DiyaSet, [number, number]> = {
  pool: [0, 0.05],
  curb: [0.04, 0.16],
  podiums: [0.16, 0.28],
  hallway: [0.28, 0.38],
  parikrama: [0.38, 0.54],
  well: [0.54, 0.6],
  annex: [0.6, 0.68],
  path: [0.68, 0.76],
  forecourt: [0.76, 0.84],
  edge: [0.84, 1],
}

/** Lamps per tier on Diya Night (GRAND §6.2 #8, §10): 200 / 400 / 800, 800 on Ultra. */
export const DIYA_CAPS = { low: 200, medium: 400, high: 800, ultra: 800 } as const

const OC = MUSEUM.oculus
/** The pool: one full disc of still water (the lotus floats on it; no island shows). */
export const WATER_RING = { r0: 0, r1: OC.rings[1] - 0.05, y: OC.poolLevel }

/** The threshold path: from just outside the door sill to a metre short of the forecourt's far edge. */
export const PATH = { z0: KEY.annexOuterZ + 0.45, z1: MUSEUM.forecourt.endZ - 1.0 }

/** Points every `pitch` metres along an arc (deg), ends inset by half a pitch. */
function along(r: number, fromDeg: number, toDeg: number, pitch: number): number[] {
  const len = (Math.abs(toDeg - fromDeg) * Math.PI * r) / 180
  const n = Math.max(1, Math.floor(len / pitch))
  return Array.from({ length: n }, (_, i) => fromDeg + ((toDeg - fromDeg) * (i + 0.5)) / n)
}

/** `along` under another name, for use where buildDiyas shadows it. */
const arcAngles = along

function push(out: Diya[], set: DiyaSet, pts: { x: number; y: number; z: number; scale?: number }[]) {
  const [s0, s1] = WAVE[set]
  pts.forEach((p, i) => out.push({ x: p.x, y: p.y, z: p.z, set, seq: s0 + ((s1 - s0) * i) / Math.max(1, pts.length - 1), scale: p.scale ?? 1 }))
}

const ring = (r: number, fromDeg: number, toDeg: number, pitch: number, y = 0) =>
  along(r, fromDeg, toDeg, pitch).map((a) => {
    const [x, z] = polar(r, a)
    return { x, y, z, a }
  })

/** Angles (deg) of the Parikrama's doorways and jali slots, which stay clear of lamps. */
function walkGaps(): [number, number][] {
  const gaps: [number, number][] = SATELLITES.map((s) => [s.doorDeg - SAT_DOOR_HALF_DEG - 1.5, s.doorDeg + SAT_DOOR_HALF_DEG + 1.5])
  for (const [a, b] of JALI_SLOTS) gaps.push([a - 0.5, b + 0.5])
  return gaps
}

export function buildDiyas(): Diya[] {
  const out: Diya[] = []
  // pool: floating, two rings round the lotus (clear of its petals)
  const pool0 = OC.rings[2] + 0.4
  const poolSpan = WATER_RING.r1 - pool0
  push(
    out,
    'pool',
    [...ring(pool0 + poolSpan * 0.3, -90, 270, 0.9, WATER_RING.y), ...ring(pool0 + poolSpan * 0.75, -90, 270, 0.9, WATER_RING.y)]
      .sort((a, b) => a.a - b.a)
      .map((p) => ({ ...p, scale: 0.85 })),
  )
  // curb top, spiralling round from the north
  const curbR = OC.rings[0] - OC.curbThickness / 2
  push(out, 'curb', ring(curbR, -90, 270, 0.6, OC.curbHeight))
  // round each podium base (A → B → C), eight to a podium
  const podR = MUSEUM.podium.size / 2 + 0.2
  push(
    out,
    'podiums',
    PODIUM_SLOTS.flatMap((p) => Array.from({ length: 8 }, (_, k) => ({ x: p.x + podR * Math.cos((k * Math.PI) / 4 + p.rotationY), y: 0, z: p.z + podR * Math.sin((k * Math.PI) / 4 + p.rotationY) }))),
  )
  // Hallway D: along the lobe and along the hallway wall
  const hw = MUSEUM.hallwayWall
  const hallOuter = ring(MUSEUM.drum.r - 0.22, hw.fromDeg + 2, MUSEUM.drum.dNotchDeg - 3, 0.6)
  const hallInner = ring(hw.r + hw.thickness / 2 + 0.2, hw.fromDeg + 2, hw.toDeg - 1, 0.6)
  push(out, 'hallway', [...hallOuter, ...hallInner].sort((a, b) => a.a - b.a))
  // Parikrama: along both faces of the serpentine walk, west → east, clear of the doors and slots
  const gaps = walkGaps()
  const clear = (a: number) => !gaps.some(([g0, g1]) => a >= g0 && a <= g1)
  const edge = SERPENTINE.walkW / 2 - 0.2
  const step = 0.8 / (((PARIKRAMA.r0 + PARIKRAMA.r1) / 2) * (Math.PI / 180))
  const along = (k: number) =>
    serpentineOffset(k, PARIKRAMA.fromDeg + 3, PARIKRAMA.toDeg - 3, step).map(([x, z]) => ({ x, y: 0, z, a: (Math.atan2(z, x) * 180) / Math.PI }))
  // the parapet side has no openings; the rooms' side keeps its doorways and jali slots clear
  const pIn = along(-edge)
  const pOut = along(edge).filter((p) => clear(p.a))
  push(out, 'parikrama', [...pIn, ...pOut].sort((a, b) => a.a - b.a))
  // the Sphere Well: a ring at grade outside its balustrade, round from the side nearest the drum
  const wellR = SPHERE_WELL.rimR + 0.45
  push(
    out,
    'well',
    arcAngles(wellR, 20, 380, 0.45).map((a) => {
      const [x, z] = polar(wellR, a, SPHERE_WELL.cx, SPHERE_WELL.cz)
      return { x, y: 0, z }
    }),
  )
  // annex: both sides, mouth → door
  const az0 = KEY.annexMouthZ + 0.6
  const az1 = MUSEUM.annex.endZ - 0.5
  const an = Math.floor((az1 - az0) / 0.5)
  const annex: { x: number; y: number; z: number }[] = []
  for (let i = 0; i <= an; i++) {
    const z = az0 + ((az1 - az0) * i) / an
    for (const s of [-1, 1]) annex.push({ x: s * (KEY.annexHalf - 0.25), y: 0, z })
  }
  push(out, 'annex', annex)
  // path: x ±1.1, every 0.9 m from the door sill outward to the forecourt's far edge
  const path: { x: number; y: number; z: number }[] = []
  for (let z = PATH.z0; z <= PATH.z1 + 1e-6; z += 0.9) for (const s of [-1, 1]) path.push({ x: s * 1.1, y: 0, z })
  push(out, 'path', path)
  // forecourt: its two long edges, half a metre in, from the entrance front outward
  const fcX = MUSEUM.forecourt.halfWidth - 0.5
  const forecourt: { x: number; y: number; z: number }[] = []
  for (let z = KEY.annexOuterZ + 1.2; z <= MUSEUM.forecourt.endZ - 0.6 + 1e-6; z += 0.9) for (const s of [-1, 1]) forecourt.push({ x: s * fcX, y: 0, z })
  push(out, 'forecourt', forecourt)
  // edge: two rows inside the disc's rim, the south half, clear of the forecourt paving
  const R = MUSEUM.landscape.r
  const fc = MUSEUM.forecourt.halfWidth
  const rim = [...ring(R - 0.25, MUSEUM.drum.neNotchDeg, MUSEUM.drum.dNotchDeg, 0.7), ...ring(R - 0.6, MUSEUM.drum.neNotchDeg, MUSEUM.drum.dNotchDeg, 0.7)]
    .filter((p) => Math.abs(p.x) > fc + 0.3)
    // the wave runs outward from the forecourt both ways
    .sort((a, b) => Math.abs(a.a - 90) - Math.abs(b.a - 90))
  push(out, 'edge', rim)
  return out
}

export const DIYAS: Diya[] = buildDiyas()

/**
 * The lamps that are free to stand: none inside furniture or a display (the scene's colliders,
 * passed in so this file stays pure data). Pool and curb lamps sit on the plinth by design.
 */
export function standingDiyas(all: readonly Diya[], blocked: (x: number, z: number) => boolean): Diya[] {
  return all.filter((d) => d.set === 'pool' || d.set === 'curb' || !blocked(d.x, d.z))
}

/** Lamps of the chosen sets, thinned evenly within each set so the total fits `cap` (the path keeps its 0.9 m spacing). */
export function thinDiyas(all: readonly Diya[], sets: readonly DiyaSet[], cap: number): Diya[] {
  const chosen = all.filter((d) => sets.includes(d.set))
  if (chosen.length <= cap) return chosen
  const fixed = chosen.filter((d) => d.set === 'path')
  const rest = chosen.filter((d) => d.set !== 'path')
  const keep = Math.max(0, cap - fixed.length)
  const stride = rest.length / Math.max(1, keep)
  const picked: Diya[] = []
  for (let i = 0; i < keep && Math.floor(i * stride) < rest.length; i++) picked.push(rest[Math.floor(i * stride)])
  return [...fixed, ...picked].sort((a, b) => a.seq - b.seq)
}
