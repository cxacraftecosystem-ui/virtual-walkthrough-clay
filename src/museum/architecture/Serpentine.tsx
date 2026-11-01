/**
 * THE PARIKRAMA'S SERPENTINE (GRAND §2.6, p09l "sinuous red walls round tree courtyards"): the
 * red lime walls of the walk, drawn smooth along P0's centreline (config/satellites.ts), and the
 * walk's floors.
 *
 *   parapet ...... the drum-side wall, 1.1 m, a rounded head: behind it the sunken gardens drop
 *                  0.6 m to soil (P3 plants them, the horses stand in them)
 *   courtyard .... the satellite-side wall, 2.3 m, wherever the walk leaves the rooms: two window
 *                  slots per run (the wall drops to the 0.9 m sill for 0.9 m) framing the
 *                  courtyards, and the 13 hero niches (0.7 × 0.9 × 0.2, sill 1.1) in its walk face
 *   closures ..... from each outer run's end to the first / last room
 *   floors ....... the walk in deep red lime like its walls (clickable, Floor.tsx mounts it), the
 *                  courtyards and sunken gardens in bare soil, the gate aprons paved
 *
 * WALLS (layout.ts) keeps the colliders ('serp-*'); Pavilion leaves them to this file.
 */
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { DEG, KEY, polar } from '../config/museum'
import { PARIKRAMA, SAT_WALL, SATELLITES, SERP_OFFSET, SERPENTINE, serpentineOffset, serpentineOuterRuns } from '../config/satellites'
import { StaticMerge } from '../effects/StaticMerge'
import { useMaterials } from '../materials/materials'
import { planFace } from './shellGeometry'
import { Mesh, sweep, type PlanPath, type V2, type V3 } from './sweep'

const S = SERPENTINE
/** How far the drum-side gardens are sunk below the walk. */
export const GARDEN_SINK = 0.6
/** Window slots in the courtyard walls: width and sill (the wall drops to the sill). */
export const SERP_SLOT = { width: 0.9, sill: 0.9 } as const
/** The hero niches in the courtyard walls' walk faces. */
export const SERP_NICHE = { width: 0.7, height: 0.9, depth: 0.2, sill: 1.1, count: 13 } as const

/* ------------------------------------------------------------------ */
/* Paths                                                               */
/* ------------------------------------------------------------------ */

type P2 = [number, number]

/** Cumulative arclength of a polyline. */
function lengths(p: P2[]): number[] {
  const out = [0]
  for (let i = 1; i < p.length; i++) out.push(out[i - 1] + Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]))
  return out
}

/** The part of a polyline between arclengths s0 and s1, with interpolated ends. */
function subPath(p: P2[], L: number[], s0: number, s1: number): P2[] {
  const at = (s: number): P2 => {
    let i = 1
    while (i < L.length - 1 && L[i] < s) i++
    const t = (s - L[i - 1]) / Math.max(1e-9, L[i] - L[i - 1])
    return [p[i - 1][0] + (p[i][0] - p[i - 1][0]) * t, p[i - 1][1] + (p[i][1] - p[i - 1][1]) * t]
  }
  const out: P2[] = [at(s0)]
  for (let i = 0; i < p.length; i++) if (L[i] > s0 + 1e-4 && L[i] < s1 - 1e-4) out.push(p[i])
  out.push(at(s1))
  return out
}

/** A point and its unit tangent at arclength s. */
function frameAt(p: P2[], L: number[], s: number): { p: P2; t: P2 } {
  let i = 1
  while (i < L.length - 1 && L[i] < s) i++
  const dx = p[i][0] - p[i - 1][0]
  const dz = p[i][1] - p[i - 1][1]
  const len = Math.hypot(dx, dz) || 1
  const t = (s - L[i - 1]) / Math.max(1e-9, L[i] - L[i - 1])
  return { p: [p[i - 1][0] + dx * t, p[i - 1][1] + dz * t], t: [dx / len, dz / len] }
}

/** The courtyard wall's runs (centreline polylines), the closures included at their ends. */
function outerRuns(): P2[][] {
  return serpentineOuterRuns().map(([a0, a1]) => serpentineOffset(SERP_OFFSET, a0, a1, 0.5) as P2[])
}

/** A hero niche on a courtyard wall: centre on the wall's walk face, the face's normal, height. */
export interface SerpentineNiche {
  index: number
  /** Centre of the niche's opening on the walk face (m). */
  x: number
  z: number
  /** Unit normal of the walk face (pointing onto the walk). */
  nx: number
  nz: number
  /** Compass yaw of a piece facing out of the niche (deg; 0 = −z, 90 = +x). */
  yawDeg: number
  sill: number
  width: number
  height: number
  depth: number
}

/** Positions of the slots and niches along each run (arclengths), spaced so none overlap. */
function runFeatures() {
  const runs = outerRuns()
  const lens = runs.map(lengths)
  const total = lens.reduce((a, L) => a + L[L.length - 1], 0)
  const slots = runs.map((_, i) => {
    const len = lens[i][lens[i].length - 1]
    return len > 7 ? [len / 3, (2 * len) / 3] : len > 3 ? [len / 2] : []
  })
  const niches: { run: number; s: number }[] = []
  for (let k = 0; k < SERP_NICHE.count; k++) {
    let s = ((k + 0.5) * total) / SERP_NICHE.count
    let run = 0
    const runLen = (i: number) => lens[i][lens[i].length - 1]
    while (run < runs.length - 1 && s > runLen(run)) {
      s -= runLen(run)
      run++
    }
    const len = runLen(run)
    // keep clear of the slots and of the run's ends
    for (const sl of slots[run]) if (Math.abs(s - sl) < 1.1) s = sl + (s < sl ? -1.2 : 1.2)
    s = Math.min(Math.max(s, 0.9), len - 0.9)
    niches.push({ run, s })
  }
  return { runs, lens, slots, niches }
}

/** The 13 hero niches (GRAND §4.2 Parikrama row), in walking order (west gate → east gate). */
export function serpentineNiches(): SerpentineNiche[] {
  const f = runFeatures()
  return f.niches.map(({ run, s }, index) => {
    const fr = frameAt(f.runs[run], f.lens[run], s)
    // the walk face is on the left of increasing angle (towards the drum)
    const nx = -fr.t[1]
    const nz = fr.t[0]
    const x = fr.p[0] + nx * (S.t / 2)
    const z = fr.p[1] + nz * (S.t / 2)
    const yawDeg = (Math.atan2(nx, -nz) / DEG + 360) % 360
    return { index, x, z, nx, nz, yawDeg, sill: SERP_NICHE.sill, width: SERP_NICHE.width, height: SERP_NICHE.height, depth: SERP_NICHE.depth }
  })
}

/* ------------------------------------------------------------------ */
/* Walls                                                               */
/* ------------------------------------------------------------------ */

/** A wall piece along a path: its two faces, a rounded head; `recess` cuts a niche into its left face. */
function wallPiece(mesh: Mesh, pts: P2[], y0: number, h: number, opts: { capStart?: boolean; capEnd?: boolean; recess?: { y0: number; y1: number; depth: number } } = {}) {
  if (pts.length < 2) return
  const t = S.t / 2
  const path: PlanPath = { pts: pts as V2[] }
  const top = h - t
  const left: V2[] = opts.recess
    ? [[t, y0], [t, opts.recess.y0], [t - opts.recess.depth, opts.recess.y0], [t - opts.recess.depth, opts.recess.y1], [t, opts.recess.y1], [t, top]]
    : [[t, y0], [t, top]]
  sweep(mesh, path, left)
  // the rounded head (smooth), and the right face
  const arc: V2[] = []
  const arcN: V2[] = []
  for (let i = 0; i <= 8; i++) {
    const a = (Math.PI * i) / 8
    arc.push([t * Math.cos(a), top + t * Math.sin(a)])
    arcN.push([Math.cos(a), Math.sin(a)])
  }
  sweep(mesh, path, arc, { normals: arcN })
  sweep(mesh, path, [[-t, top], [-t, y0]])
  // end sections (the rounded profile, flat) where the piece stops
  const fr = (i: number) => {
    const a = pts[Math.max(0, i - 1)]
    const b = pts[Math.min(pts.length - 1, i === 0 ? 1 : i)]
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1
    return { t: [(b[0] - a[0]) / len, (b[1] - a[1]) / len] as P2 }
  }
  const section = (i: number, sgn: 1 | -1, recessOnly: boolean) => {
    const q = pts[i]
    const { t: tg } = fr(i)
    const l: P2 = [-tg[1], tg[0]]
    const P = (o: number, y: number): V3 => [q[0] + l[0] * o, y, q[1] + l[1] * o]
    const n: V3 = [tg[0] * sgn, 0, tg[1] * sgn]
    if (recessOnly && opts.recess) {
      const r = opts.recess
      mesh.flat([P(t - r.depth, r.y0), P(t, r.y0), P(t, r.y1), P(t - r.depth, r.y1)], n, [[0, r.y0], [r.depth, r.y0], [r.depth, r.y1], [0, r.y1]])
      return
    }
    const poly: V3[] = [P(-t, y0), P(t, y0), ...arc.map(([o, y]) => P(o, y))]
    mesh.poly(poly, n, poly.map((v, k) => [k, v[1]] as V2))
  }
  if (opts.capStart) section(0, -1, false)
  if (opts.capEnd) section(pts.length - 1, 1, false)
  if (opts.recess) {
    // the niche's jambs face into it: at its start looking forward, at its end looking back
    section(0, 1, true)
    section(pts.length - 1, -1, true)
  }
}

function serpentineGeometry() {
  const wall = new Mesh()
  // the parapet on the drum side, gate to gate (its ends die into the notch walls)
  const inner = serpentineOffset(-SERP_OFFSET, PARIKRAMA.fromDeg, PARIKRAMA.toDeg, 0.5) as P2[]
  wallPiece(wall, inner, -GARDEN_SINK, S.parapetH, { capStart: true, capEnd: true })
  // the courtyard walls: pieces between the slots and niches
  const f = runFeatures()
  f.runs.forEach((run, ri) => {
    const L = f.lens[ri]
    const len = L[L.length - 1]
    type Cut = { s0: number; s1: number; kind: 'slot' | 'niche' }
    const cuts: Cut[] = [
      ...f.slots[ri].map((s) => ({ s0: s - SERP_SLOT.width / 2, s1: s + SERP_SLOT.width / 2, kind: 'slot' as const })),
      ...f.niches.filter((n) => n.run === ri).map((n) => ({ s0: n.s - SERP_NICHE.width / 2, s1: n.s + SERP_NICHE.width / 2, kind: 'niche' as const })),
    ].sort((a, b) => a.s0 - b.s0)
    // full-height pieces between the cuts: capped at the run's ends and either side of a slot
    let s = 0
    let afterSlot = true
    for (const c of cuts) {
      if (c.s0 > s + 1e-3) wallPiece(wall, subPath(run, L, s, c.s0), 0, S.wallH, { capStart: afterSlot, capEnd: c.kind === 'slot' })
      if (c.kind === 'slot') wallPiece(wall, subPath(run, L, c.s0, c.s1), 0, SERP_SLOT.sill, {})
      else wallPiece(wall, subPath(run, L, c.s0, c.s1), 0, S.wallH, { recess: { y0: SERP_NICHE.sill, y1: SERP_NICHE.sill + SERP_NICHE.height, depth: SERP_NICHE.depth } })
      afterSlot = c.kind === 'slot'
      s = c.s1
    }
    if (s < len - 1e-3) wallPiece(wall, subPath(run, L, s, len), 0, S.wallH, { capStart: afterSlot, capEnd: true })
  })
  // the closures from each run's end to the rooms' inner wall
  const ends: number[] = [SATELLITES[0].fromDeg, SATELLITES[SATELLITES.length - 1].toDeg]
  for (const aDeg of ends) {
    const [from] = serpentineOffset(SERP_OFFSET, aDeg, aDeg + 0.01)
    const to = polar(SAT_WALL.innerC, aDeg)
    wallPiece(wall, [from as P2, to as P2], 0, S.wallH, { capStart: true, capEnd: true })
  }
  // the sunken gardens' retaining faces: along the drum's foot, and across each gate's end
  const retain = new Mesh()
  const ringFace = KEY.ringOuterR + 0.002
  const n = Math.ceil((PARIKRAMA.toDeg - PARIKRAMA.fromDeg) * 2)
  sweep(retain, { pts: Array.from({ length: n + 1 }, (_, i) => polar(ringFace, PARIKRAMA.fromDeg + ((PARIKRAMA.toDeg - PARIKRAMA.fromDeg) * i) / n) as V2) }, [[0, 0.01], [0, -GARDEN_SINK - 0.01]])
  for (const [aDeg, sgn] of [
    [PARIKRAMA.fromDeg, 1],
    [PARIKRAMA.toDeg, -1],
  ] as const) {
    const a = aDeg * DEG
    const c = Math.cos(a)
    const sn = Math.sin(a)
    const r1 = Math.hypot(...(serpentineOffset(-SERP_OFFSET, aDeg, aDeg + 0.01)[0] as P2))
    const P = (r: number, y: number): V3 => [r * c, y, r * sn]
    retain.flat([P(ringFace, -GARDEN_SINK), P(r1, -GARDEN_SINK), P(r1, 0.01), P(ringFace, 0.01)], [-sn * sgn, 0, c * sgn], [[ringFace, 0], [r1, 0], [r1, 1], [ringFace, 1]])
  }
  return { wall: wall.build(), retain: retain.build() }
}

/* ------------------------------------------------------------------ */
/* Floors (mounted by Floor.tsx, which makes the walk clickable)       */
/* ------------------------------------------------------------------ */

/** A band between two polylines of equal sampling (inner then outer reversed). */
function band(a: P2[], b: P2[], y: number) {
  return planFace([...a, ...b.slice().reverse()], y, true)
}

/**
 * The north wing's open-air floors: the walk (red lime), the gate aprons (paving), the
 * satellite-side courtyards (soil, behind the walls) and the drum-side gardens (soil, sunk).
 */
export function serpentineFloors(): { walk: THREE.BufferGeometry; aprons: THREE.BufferGeometry[]; courtyards: THREE.BufferGeometry[]; gardens: THREE.BufferGeometry } {
  const step = 0.5
  const half = S.walkW / 2 + S.t / 2
  const A0 = PARIKRAMA.fromDeg
  const A1 = PARIKRAMA.toDeg
  // the walk: from the parapet's face to the courtyard wall's face (and under the walls' feet)
  const walk = band(serpentineOffset(-half, A0, A1, step) as P2[], serpentineOffset(half, A0, A1, step) as P2[], 0)
  // gate aprons: from the walk's outer edge to the rooms' inner wall line, at both gates
  const rooms = [...SATELLITES].sort((a, b) => a.fromDeg - b.fromDeg)
  const aprons: THREE.BufferGeometry[] = []
  for (const [a0, a1] of [
    [A0, rooms[0].fromDeg],
    [rooms[rooms.length - 1].toDeg, A1],
  ] as const) {
    const edge = serpentineOffset(half, a0, a1, step) as P2[]
    const arc = Array.from({ length: edge.length }, (_, i) => polar(SAT_WALL.innerC, a0 + ((a1 - a0) * i) / (edge.length - 1)) as P2)
    aprons.push(band(edge, arc, 0))
  }
  // courtyards: between the courtyard wall's back face and the rooms' inner wall
  const courtyards = serpentineOuterRuns().map(([a0, a1]) => {
    const back = serpentineOffset(half, a0, a1, step) as P2[]
    const arc = Array.from({ length: back.length }, (_, i) => polar(SAT_WALL.innerC - SAT_WALL.t / 2, a0 + ((a1 - a0) * i) / (back.length - 1)) as P2)
    return band(back, arc, 0.002)
  })
  // the sunken gardens: from the ring's outer face to the parapet, the whole way
  const ring = Array.from({ length: Math.round((A1 - A0) / step) + 1 }, (_, i) => polar(KEY.ringOuterR, A0 + i * step) as P2)
  const par = serpentineOffset(-half, A0, A1, step) as P2[]
  const gardens = band(ring, par.length === ring.length ? par : ring, -GARDEN_SINK)
  return { walk, aprons, courtyards, gardens }
}

export function Serpentine() {
  const m = useMaterials()
  const geo = useMemo(serpentineGeometry, [])
  useEffect(() => () => Object.values(geo).forEach((g) => g?.dispose()), [geo])
  return (
    <group name="serpentine">
      <StaticMerge name="serpentine-shell">
        {geo.wall && <mesh geometry={geo.wall} material={m.redLime} castShadow receiveShadow />}
        {geo.retain && <mesh geometry={geo.retain} material={m.groundSoil} receiveShadow />}
      </StaticMerge>
    </group>
  )
}
