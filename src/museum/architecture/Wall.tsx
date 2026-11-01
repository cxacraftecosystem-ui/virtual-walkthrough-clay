/**
 * Walls of the clay pavilion, built face by face from each WALLS footprint (arc or segment)
 * so every face takes its own finish (GRAND §2.5, the PDF's swatches at full saturation):
 *
 *   ring (A/B/C)     below the balcony each gallery its own ground: A deep red lacquered
 *                    limewash (p02), B bright white limewash carved with five niches between its
 *                    podiums (p08r), C charcoal clay; above it rose clay plaster carved with the
 *                    upper register's 24 uplit niches; outside rammed earth with the oxblood band
 *   lobe             terracotta below the band, blush plaster above (the annex rose clay throughout); the lobe's Wine Hall stretch
 *                    (hallway D) deep wine from floor to ceiling (p08l)
 *   H                full height on the ring circle between the E arches: terracotta towards the
 *                    court corridor, buff towards the annex with the recessed raw-clay title panel
 *   D                full height between the E-west arch and the D arch: charcoal towards C, wine
 *                    towards the Wine Hall
 *   F                7 m of oxblood with a rounded head; on its court face eight full-height piers
 *                    and the lit centre niche (p07l); raw clay on its corridor face (the lippan's
 *                    ground)
 *
 * Perimeter walls (and H and D, which carry the dome) run up INTO the roof slab, and their buried
 * end caps / tops are left out so no face is ever coplanar with a neighbour's. The arches are
 * drawn by Arches.tsx; H's and D's ends are square jambs lined in lacquer up to the arches' spring.
 */
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import type { WallBox } from '../config/layout'
import { ARCH, DEG, KEY, MUSEUM } from '../config/museum'
import { useMaterials, type MaterialKey } from '../materials/materials'
import { bNiches, F_HEAD, F_NICHE, F_PIERS, fPierAngles, GALLERY_SPANS, H_PANEL, REGISTER_NICHE, upperRegisterSlots } from './registerGeometry'
import { annulusFace, arcEndCap, cylinderFace, FaceBuilder, mergeAll, roundEnd, segFaces, type ArcWindow } from './shellGeometry'
import { Mesh, revolve, type V2, type V3 } from './sweep'

const H = MUSEUM.pavilion.ceilingHeight
/** Perimeter walls continue this far into the roof slab. */
export const WALL_INTO_ROOF = 0.2
/** Duplex band (the balcony's walking level): material change inside, oxblood reveal outside. */
export const BAND_Y = MUSEUM.pavilion.mezzanineBand
/** Exterior band reveal: height and depth. */
const REVEAL = { y0: BAND_Y - 0.06, y1: BAND_Y + 0.06, depth: 0.025 }
/** Interior band: a slim flush shadow line (frames may hang across it), where the clay changes tone. */
export const INNER_REVEAL = { y0: BAND_Y - 0.02, y1: BAND_Y + 0.02, depth: 0.015 }

/** Material per face family. */
export interface WallFinish {
  /** Interior below / above the band (perimeter), or the inner face (free-standing). */
  lower: MaterialKey
  upper: MaterialKey
  exterior?: MaterialKey
  /** The outer face of a free-standing arc (H, D, F). */
  outer?: MaterialKey
  top?: MaterialKey
  caps?: MaterialKey
}

/** Which walls are perimeter (exterior on one side). */
const PERIMETER = new Set(['drum', 'notch', 'annex', 'lintel'])
/** The ring circle's full-height pieces between the arches (they carry the dome). */
const RING_PIECES = new Set(['wall-h', 'wall-d'])

export function wallFinish(w: WallBox): WallFinish {
  switch (w.kind) {
    case 'drum':
      return w.id === 'drum-ring' ? { lower: 'clayRose', upper: 'clayRose', exterior: 'rammedEarth', caps: 'rammedEarth' } : { lower: 'clayTerracotta', upper: 'blushPlaster', exterior: 'rammedEarth', caps: 'rammedEarth' }
    case 'notch':
      return { lower: 'clayTerracotta', upper: 'blushPlaster', exterior: 'rammedEarth', caps: 'rammedEarth' }
    case 'annex':
      // the Earth Room (p05): rose clay from floor to soffit, the canyon's ground
      return { lower: 'clayRose', upper: 'clayRose', exterior: 'rammedEarth', caps: 'oxbloodLacquer' }
    case 'lintel':
      return { lower: 'blushPlaster', upper: 'blushPlaster', exterior: 'rammedEarth', caps: 'oxbloodLacquer' }
    case 'description':
      // rose above the strata wall like the rest of the ring; deep oxblood towards the annex, so
      // the pale carved title panel recessed into it is the one bright thing at the hall's end
      return { lower: 'clayTerracotta', upper: 'clayRose', outer: 'oxblood', top: 'clayRose', caps: 'oxbloodLacquer' }
    case 'inner-main':
      return { lower: 'oxblood', upper: 'oxblood', outer: 'clayPanel', top: 'oxblood', caps: 'oxblood' }
    case 'hallway':
      return { lower: 'charcoalClay', upper: 'clayRose', outer: 'wineWall', top: 'wineWall', caps: 'oxbloodLacquer' }
    case 'fin':
      return { lower: 'oxblood', upper: 'oxblood', top: 'oxblood', caps: 'oxblood' }
    case 'satellite':
      // the north wing's walk-facing walls in smooth red lime like the serpentine's (p09l's red
      // canyon, never a dune-textured sheet); their owners line the interiors
      return { lower: 'parikramaWall', upper: 'parikramaWall', top: 'parikramaWall', caps: 'oxbloodLacquer' }
    case 'serpentine':
      return { lower: 'parikramaWall', upper: 'parikramaWall', top: 'parikramaWall', caps: 'parikramaWall' }
    case 'red-room':
      return { lower: 'redLime', upper: 'redLime', top: 'redLime', caps: 'redLime' }
    case 'colonnade':
      return { lower: 'clayTerracotta', upper: 'clayTerracotta', top: 'clayTerracotta', caps: 'clayTerracotta' }
    default:
      return { lower: 'clayRose', upper: 'clayBlush', top: 'clayRose', caps: 'clayRose' }
  }
}

/** A finish, or one of the glowing backs: the upper register's uplit niches, F's lit niche. */
export type PartKey = MaterialKey | 'registerBack' | 'fNicheBack'
type Parts = Partial<Record<PartKey, (THREE.BufferGeometry | null)[]>>

function push(parts: Parts, key: PartKey | undefined, ...g: (THREE.BufferGeometry | null)[]) {
  if (!key) return
  ;(parts[key] ??= []).push(...g)
}

/* ------------------------------------------------------------------ */
/* Niches in the ring wall                                             */
/* ------------------------------------------------------------------ */

/** A niche window on the ring's interior face: centre angle (deg), width (m), sill and head. */
function nicheWindow(aDeg: number, width: number, y0: number, y1: number): ArcWindow {
  const half = width / 2 / KEY.ringR
  const a = aDeg * DEG
  return { a0: a - half, a1: a + half, y0, y1 }
}

/** The upper register's niches over A/B/C (registerGeometry.ts). */
export function registerWindows(): ArcWindow[] {
  return upperRegisterSlots()
    .filter((s) => s.kind === 'niche')
    .map((s) => nicheWindow(s.aDeg, REGISTER_NICHE.width, REGISTER_NICHE.y0, REGISTER_NICHE.y1))
}

/** Gallery B's carved niches. */
export function bNicheWindows(): ArcWindow[] {
  return bNiches().map((n) => nicheWindow(n.aDeg, n.width, n.y0, n.y1))
}

/** The niche's own lining (jambs, sill, head) and its back, `depth` behind the face of radius r. */
function nicheLining(r: number, w: ArcWindow, depth: number) {
  const back = cylinderFace(0, 0, r + depth, w.a0, w.a1, w.y0, w.y1, 'in')
  // jambs: radial faces looking into the niche
  const j0 = arcEndCap(0, 0, r, r + depth, w.a0, w.y0, w.y1, 'end')
  const j1 = arcEndCap(0, 0, r, r + depth, w.a1, w.y0, w.y1, 'start')
  const sill = annulusFace(0, 0, r, r + depth, w.a0, w.a1, w.y0, true)
  const head = annulusFace(0, 0, r, r + depth, w.a0, w.a1, w.y1, false)
  return { lining: mergeAll([j0, j1, sill, head]), back }
}

/* ------------------------------------------------------------------ */
/* Geometry per wall                                                   */
/* ------------------------------------------------------------------ */

/** Outside face of a perimeter arc with the band reveal (radius r, facing out). */
function revealedOuterArc(r: number, a0: number, a1: number, y0: number, y1: number, parts: Parts, f: WallFinish) {
  push(parts, f.exterior, cylinderFace(0, 0, r, a0, a1, y0, REVEAL.y0, 'out'), cylinderFace(0, 0, r, a0, a1, REVEAL.y1, y1, 'out'))
  const ri = r - REVEAL.depth
  push(parts, 'oxblood', cylinderFace(0, 0, ri, a0, a1, REVEAL.y0, REVEAL.y1, 'out'), annulusFace(0, 0, ri, r, a0, a1, REVEAL.y0, true), annulusFace(0, 0, ri, r, a0, a1, REVEAL.y1, false))
}

/** A vertical quad along a → b, `off` metres along the left normal, facing ±normal. */
function sideQuad(ax: number, az: number, bx: number, bz: number, off: number, y0: number, y1: number, facing: 1 | -1) {
  const len = Math.hypot(bx - ax, bz - az)
  const nx = -(bz - az) / len
  const nz = (bx - ax) / len
  const A = [ax + nx * off, az + nz * off]
  const B = [bx + nx * off, bz + nz * off]
  const N = [nx * facing, 0, nz * facing]
  const f = new FaceBuilder()
  if (facing === 1)
    f.quad([[A[0], y0, A[1]], [B[0], y0, B[1]], [B[0], y1, B[1]], [A[0], y1, A[1]]], [N, N, N, N], [
      [0, y0],
      [len, y0],
      [len, y1],
      [0, y1],
    ])
  else
    f.quad([[B[0], y0, B[1]], [A[0], y0, A[1]], [A[0], y1, A[1]], [B[0], y1, B[1]]], [N, N, N, N], [
      [0, y0],
      [len, y0],
      [len, y1],
      [0, y1],
    ])
  return f.build()
}

/** Horizontal strip along a → b between offsets o0 < o1 (left normal), facing up or down. */
function stripQuad(ax: number, az: number, bx: number, bz: number, o0: number, o1: number, y: number, up: boolean) {
  const len = Math.hypot(bx - ax, bz - az)
  const nx = -(bz - az) / len
  const nz = (bx - ax) / len
  const p = (x: number, z: number, o: number) => [x + nx * o, y, z + nz * o]
  const n = [0, up ? 1 : -1, 0]
  let q = [p(ax, az, o0), p(bx, bz, o0), p(bx, bz, o1), p(ax, az, o1)]
  // FaceBuilder quads are counter-clockwise seen from the front: from above that is a
  // positive y-component of (q1 − q0) × (q3 − q0)
  const cy = (q[1][2] - q[0][2]) * (q[3][0] - q[0][0]) - (q[1][0] - q[0][0]) * (q[3][2] - q[0][2])
  if (up ? cy < 0 : cy > 0) q = [q[0], q[3], q[2], q[1]]
  const f = new FaceBuilder()
  f.quad(q, [n, n, n, n], q.map((v) => [v[0], -v[2]]))
  return f.build()
}

/** End face of a straight wall at (px, pz), run direction (ux, uz), facing −run (−1) or +run (+1). */
function endQuad(px: number, pz: number, ux: number, uz: number, h: number, y0: number, y1: number, facing: 1 | -1) {
  const lx = -uz
  const lz = ux
  const P = (o: number, y: number) => [px + lx * o, y, pz + lz * o]
  const n = [ux * facing, 0, uz * facing]
  const q = facing < 0 ? [P(-h, y0), P(h, y0), P(h, y1), P(-h, y1)] : [P(h, y0), P(-h, y0), P(-h, y1), P(h, y1)]
  const f = new FaceBuilder()
  f.quad(q, [n, n, n, n], [
    [0, y0],
    [2 * h, y0],
    [2 * h, y1],
    [0, y1],
  ])
  return f.build()
}

/** A radial jamb at angle a (radians) from r0 to r1, y0 → y1, facing +tangent (1) or −tangent (−1). */
function radialJamb(a: number, r0: number, r1: number, y0: number, y1: number, facing: 1 | -1) {
  const mesh = new Mesh()
  const c = Math.cos(a)
  const s = Math.sin(a)
  const n: V3 = [-s * facing, 0, c * facing]
  const P = (r: number, y: number): V3 => [r * c, y, r * s]
  mesh.flat([P(r0, y0), P(r1, y0), P(r1, y1), P(r0, y1)], n, [
    [r0, y0],
    [r1, y0],
    [r1, y1],
    [r0, y1],
  ])
  return mesh.build()
}

/** Which side (+1 left normal, −1 right) of a perimeter segment faces the outside. */
function exteriorSide(w: WallBox): 1 | -1 {
  const s = w.shape
  if (!s || s.kind !== 'seg') return 1
  const len = Math.hypot(s.bx - s.ax, s.bz - s.az)
  const nx = -(s.bz - s.az) / len
  const nz = (s.bx - s.ax) / len
  const mx = (s.ax + s.bx) / 2
  const mz = (s.az + s.bz) / 2
  if (w.kind === 'annex' || w.kind === 'lintel') {
    // the annex: outside is away from the annex axis / beyond the end wall
    if (Math.abs(nz) > Math.abs(nx)) return nz > 0 ? 1 : -1
    return Math.sign(nx) === Math.sign(mx) ? 1 : -1
  }
  // notch walls: outside is the side away from the lobe's open sector (smaller radius ring side)
  const a = Math.atan2(mz, mx)
  const tx = -Math.sin(a)
  const tz = Math.cos(a)
  const toLobe = w.id.startsWith('notch-ne') ? 1 : -1 // NE notch: the lobe lies at larger angles; D notch: smaller
  return nx * tx + nz * tz > 0 === toLobe > 0 ? -1 : 1
}

/**
 * Angular spans of a drum arc's interior and exterior faces. At a notch the interior face
 * runs on to the notch's interior face (covering the notch's end), the exterior face to the
 * notch's exterior face; at the annex the lobe's interior face runs on to the annex wall's
 * interior plane — so every junction closes without an exposed end cap or a coplanar face.
 */
export function drumFaceSpans(w: WallBox): { in: [number, number]; out: [number, number] } {
  const s = w.shape
  if (!s || s.kind !== 'arc') return { in: [0, 0], out: [0, 0] }
  const half = MUSEUM.drum.thickness / 2
  const rIn = s.r - s.thickness / 2
  const rOut = s.r + s.thickness / 2
  const toAnnex = Math.atan2(KEY.annexMouthZ, KEY.annexHalf)
  // at the notches, run 2 cm past the notch face: the notch's own face starts a hair further
  // out (its corner lies on a chord, not the circle), and the overlap closes that sliver
  const notchIn = (half + 0.02) / rIn
  const notchOut = Math.asin((half + 0.02) / rOut)
  switch (w.id) {
    case 'drum-ring':
      return { in: [s.a0 - notchIn, s.a1 + notchIn], out: [s.a0, s.a1] }
    case 'drum-lobe-east':
      return { in: [s.a0, toAnnex], out: [s.a0 - notchOut, s.a1] }
    case 'drum-lobe-west':
      return { in: [Math.PI - toAnnex, s.a1], out: [s.a0, s.a1 + notchOut] }
    default:
      return { in: [s.a0, s.a1], out: [s.a0, s.a1] }
  }
}

/** Split [a0, a1] (radians) at the given angles (degrees, in the same domain) into consecutive spans. */
function splitSpan(a0: number, a1: number, atDeg: number[]): [number, number][] {
  const cuts = atDeg.map((d) => d * DEG).filter((a) => a > a0 && a < a1)
  const pts = [a0, ...cuts, a1]
  return pts.slice(1).map((b, i) => [pts[i], b] as [number, number])
}

/** Windows of a list whose middle falls inside [a0, a1]. */
const within = (ws: ArcWindow[], a0: number, a1: number) => ws.filter((w) => (w.a0 + w.a1) / 2 > a0 && (w.a0 + w.a1) / 2 < a1)

/**
 * The gallery ring's interior: per gallery below the balcony (A red, B white with its niches, C
 * charcoal), rose clay with the register's niches above; rammed earth with the band outside.
 */
function ringParts(w: WallBox, parts: Parts, f: WallFinish, y1: number) {
  const s = w.shape as Extract<WallBox['shape'], { kind: 'arc' }>
  const r0 = s.r - s.thickness / 2
  const r1 = s.r + s.thickness / 2
  const span = drumFaceSpans(w)
  const [i0, i1] = span.in
  const lowerKey: Record<'a' | 'b' | 'c', MaterialKey> = { a: 'redLacquer', b: 'whiteLime', c: 'charcoalClay' }
  const bWin = bNicheWindows()
  const spans = splitSpan(i0, i1, [GALLERY_SPANS.c[1], GALLERY_SPANS.b[1]])
  ;(['c', 'b', 'a'] as const).forEach((g, i) => {
    const [a0, a1] = spans[i]
    const wins = g === 'b' ? within(bWin, a0, a1) : []
    push(parts, lowerKey[g], cylinderFace(0, 0, r0, a0, a1, 0, BAND_Y, 'in', wins))
    for (const win of wins) {
      const n = nicheLining(r0, win, MUSEUM.drum.thickness * 0.58)
      push(parts, 'whiteLime', n.lining, n.back)
    }
  })
  const reg = registerWindows()
  push(parts, f.upper, cylinderFace(0, 0, r0, i0, i1, BAND_Y, y1, 'in', reg))
  for (const win of reg) {
    const n = nicheLining(r0, win, REGISTER_NICHE.depth)
    push(parts, f.upper, n.lining)
    push(parts, 'registerBack', n.back)
  }
  revealedOuterArc(r1, span.out[0], span.out[1], 0, y1, parts, f)
}

/** The arch a ring piece's end meets: its spring height (the jamb is lacquered up to it). */
function springAt(aDeg: number): number {
  for (const a of [ARCH.eEast, ARCH.eWest, ARCH.d]) if (Math.abs(a.fromDeg - aDeg) < 0.01 || Math.abs(a.toDeg - aDeg) < 0.01) return a.spring
  return H
}

/** H and D: full height on the ring circle, square lacquered jambs at the arches, H's title panel. */
function ringPieceParts(w: WallBox, parts: Parts, f: WallFinish, y1: number) {
  const s = w.shape as Extract<WallBox['shape'], { kind: 'arc' }>
  const r0 = s.r - s.thickness / 2
  const r1 = s.r + s.thickness / 2
  const g = INNER_REVEAL
  push(parts, f.lower, cylinderFace(0, 0, r0, s.a0, s.a1, 0, g.y0, 'in'))
  push(parts, f.upper, cylinderFace(0, 0, r0, s.a0, s.a1, g.y1, y1, 'in'))
  push(parts, 'oxblood', cylinderFace(0, 0, r0 + g.depth, s.a0, s.a1, g.y0, g.y1, 'in'), annulusFace(0, 0, r0, r0 + g.depth, s.a0, s.a1, g.y0, true), annulusFace(0, 0, r0, r0 + g.depth, s.a0, s.a1, g.y1, false))
  if (w.id === 'wall-h') {
    // the title panel: a shallow raw-clay recess in the buff face towards the annex
    const P = H_PANEL
    const half = P.width / 2 / r1
    const win: ArcWindow = { a0: P.aDeg * DEG - half, a1: P.aDeg * DEG + half, y0: P.y0, y1: P.y1 }
    push(parts, f.outer, cylinderFace(0, 0, r1, s.a0, s.a1, 0, y1, 'out', [win]))
    const rb = r1 - P.recess
    push(parts, 'clayPanel', cylinderFace(0, 0, rb, win.a0, win.a1, win.y0, win.y1, 'out'))
    push(parts, 'oxbloodLacquer', annulusFace(0, 0, rb, r1, win.a0, win.a1, win.y0, true), annulusFace(0, 0, rb, r1, win.a0, win.a1, win.y1, false), radialJamb(win.a0, rb, r1, win.y0, win.y1, 1), radialJamb(win.a1, rb, r1, win.y0, win.y1, -1))
  } else push(parts, f.outer, cylinderFace(0, 0, r1, s.a0, s.a1, 0, y1, 'out'))
  // square jambs at the arches, lacquered to the spring (above it the arch's spandrel continues the wall)
  push(parts, f.caps, radialJamb(s.a0, r0, r1, 0, springAt(s.a0 / DEG), -1), radialJamb(s.a1, r0, r1, 0, springAt(s.a1 / DEG), 1))
}

/** F: oxblood with a rounded head, its court face's piers and lit niche, raw clay towards the corridor. */
function innerMainParts(w: WallBox, parts: Parts, f: WallFinish) {
  const s = w.shape as Extract<WallBox['shape'], { kind: 'arc' }>
  const r0 = s.r - s.thickness / 2
  const r1 = s.r + s.thickness / 2
  const yH = w.max[1] - F_HEAD
  const N = F_NICHE
  const nHalf = N.width / 2 / r0
  const niche: ArcWindow = { a0: N.aDeg * DEG - nHalf, a1: N.aDeg * DEG + nHalf, y0: 0, y1: N.height }
  push(parts, f.lower, cylinderFace(0, 0, r0, s.a0, s.a1, 0, yH, 'in', [niche]))
  push(parts, 'fNicheBack', cylinderFace(0, 0, r0, niche.a0, niche.a1, 0, N.height, 'in'))
  push(parts, f.outer, cylinderFace(0, 0, r1, s.a0, s.a1, 0, yH, 'out'))
  // the rounded head along the arc, and a quarter-round dome over each rounded end
  const head = new Mesh()
  const prof: V2[] = []
  const nor: V2[] = []
  const steps = 8
  for (let i = 0; i <= steps; i++) {
    const t = (Math.PI * i) / steps
    prof.push([s.r - F_HEAD * Math.cos(t), yH + F_HEAD * Math.sin(t)])
    nor.push([-Math.cos(t), Math.sin(t)])
  }
  // revolve() sweeps the plan angle about the drum's centre: the head follows the wall's arc
  revolve(head, 0, 0, prof, s.a0, s.a1, Math.ceil((Math.PI * 2 * s.r) / 0.3), nor)
  for (const end of ['start', 'end'] as const) {
    const a = end === 'start' ? s.a0 : s.a1
    const cx = s.r * Math.cos(a)
    const cz = s.r * Math.sin(a)
    const ps: V2[] = [[F_HEAD, 0]]
    const ns: V2[] = [[1, 0]]
    for (let i = 0; i <= steps / 2; i++) {
      const t = (Math.PI / 2) * (i / (steps / 2))
      ps.push([F_HEAD * Math.cos(t), yH + F_HEAD * Math.sin(t)])
      ns.push([Math.cos(t), Math.sin(t)])
    }
    const from = end === 'end' ? a : a - Math.PI
    revolve(head, cx, cz, ps, from, from + Math.PI, 16, ns)
  }
  push(parts, f.top, head.build())
  // the piers and the niche's surround: full height, as proud as each other (p07l)
  const blocks = new Mesh()
  const P = F_PIERS
  const box = (aDeg: number, tangential: number, width: number, y0: number, y1: number) => {
    const rm = r0 - P.proud / 2 + 0.002
    const a = aDeg * DEG + tangential / rm
    const c = Math.cos(a)
    const sn = Math.sin(a)
    blocks.box([rm * c, (y0 + y1) / 2, rm * sn], [c * (P.proud / 2 + 0.002), 0, sn * (P.proud / 2 + 0.002)], [0, (y1 - y0) / 2, 0], [-sn * (width / 2), 0, c * (width / 2)])
  }
  for (const a of fPierAngles()) box(a, 0, P.width, 0, P.height)
  const side = N.width / 2 + N.frame / 2
  box(N.aDeg, -side, N.frame, 0, P.height)
  box(N.aDeg, side, N.frame, 0, P.height)
  box(N.aDeg, 0, N.width + 0.004, N.height, P.height)
  // the piers in red lacquer against the deeper oxblood between them: square, solid masses (p07l)
  push(parts, 'redLacquer', blocks.build())
}

export function buildWallParts(w: WallBox): Parts {
  const parts: Parts = {}
  const f = wallFinish(w)
  const s = w.shape
  if (!s) return parts
  // the arches are drawn by Arches.tsx (their true intrados)
  if (w.id.startsWith('arch-')) return parts
  const perimeter = PERIMETER.has(w.kind)
  const tall = perimeter || RING_PIECES.has(w.id)
  const y0 = w.min[1]
  const y1 = tall ? Math.max(w.max[1], H + WALL_INTO_ROOF) : w.max[1]

  if (s.kind === 'arc') {
    const r0 = s.r - s.thickness / 2
    const r1 = s.r + s.thickness / 2
    if (w.id === 'drum-ring') ringParts(w, parts, f, y1)
    else if (RING_PIECES.has(w.id)) ringPieceParts(w, parts, f, y1)
    else if (w.kind === 'inner-main') innerMainParts(w, parts, f)
    else if (perimeter) {
      const span = drumFaceSpans(w)
      const g = INNER_REVEAL
      // the lobe's Wine Hall stretch is wine from floor to ceiling (p08l)
      for (const [a0, a1] of splitSpan(span.in[0], span.in[1], [MUSEUM.hallwayWall.fromDeg])) {
        const wine = (a0 + a1) / 2 > MUSEUM.hallwayWall.fromDeg * DEG && w.id === 'drum-lobe-west'
        push(parts, wine ? 'wineWall' : f.lower, cylinderFace(s.cx, s.cz, r0, a0, a1, y0, g.y0, 'in'))
        push(parts, wine ? 'wineWall' : f.upper, cylinderFace(s.cx, s.cz, r0, a0, a1, g.y1, y1, 'in'))
        push(parts, 'oxblood', cylinderFace(s.cx, s.cz, r0 + g.depth, a0, a1, g.y0, g.y1, 'in'), annulusFace(s.cx, s.cz, r0, r0 + g.depth, a0, a1, g.y0, true), annulusFace(s.cx, s.cz, r0, r0 + g.depth, a0, a1, g.y1, false))
      }
      revealedOuterArc(r1, span.out[0], span.out[1], y0, y1, parts, f)
      // end caps are buried in the notch / annex walls
    } else {
      push(parts, f.lower, cylinderFace(s.cx, s.cz, r0, s.a0, s.a1, y0, y1, 'in'))
      push(parts, f.outer ?? f.lower, cylinderFace(s.cx, s.cz, r1, s.a0, s.a1, y0, y1, 'out'))
      push(parts, f.top, annulusFace(s.cx, s.cz, r0, r1, s.a0, s.a1, y1, true))
      // a lintel over a door: a soffit underneath; its ends are buried in the piers either side
      if (y0 > 0) push(parts, f.caps, annulusFace(s.cx, s.cz, r0, r1, s.a0, s.a1, y0, false))
      else if (s.a1 - s.a0 < Math.PI * 2 - 1e-6) {
        for (const end of ['start', 'end'] as const) {
          const e = roundEnd(s.cx, s.cz, s.r, s.thickness, end === 'start' ? s.a0 : s.a1, y0, y1, end)
          push(parts, f.caps, e.side)
          push(parts, f.top, e.top)
        }
      }
    }
    return parts
  }

  // ── straight walls ──
  if (!perimeter) {
    const g = segFaces(s.ax, s.az, s.bx, s.bz, s.thickness, y0, y1)
    push(parts, f.lower, g.left, g.right)
    push(parts, f.top, g.top)
    push(parts, f.caps, g.caps)
    return parts
  }

  const ext = exteriorSide(w)
  const h = s.thickness / 2
  const { ax, az, bx, bz } = s
  // interior face, split at the band (the lintel only exists above the door)
  const inner = -ext as 1 | -1
  if (w.kind === 'lintel') {
    push(parts, f.upper, sideQuad(ax, az, bx, bz, inner * h, y0, y1, inner))
    push(parts, 'oxbloodLacquer', stripQuad(ax, az, bx, bz, -h, h, y0, false))
  } else {
    // annex side walls: the interior face starts where it meets the lobe's interior face
    const [iax, iaz] = w.id === 'annex-east' || w.id === 'annex-west' ? [ax, KEY.annexMouthZ] : [ax, az]
    const g = INNER_REVEAL
    const o = inner * h
    const oi = inner * (h - g.depth)
    push(parts, f.lower, sideQuad(iax, iaz, bx, bz, o, y0, g.y0, inner))
    push(parts, f.upper, sideQuad(iax, iaz, bx, bz, o, g.y1, y1, inner))
    push(parts, 'oxblood', sideQuad(iax, iaz, bx, bz, oi, g.y0, g.y1, inner), stripQuad(iax, iaz, bx, bz, Math.min(o, oi), Math.max(o, oi), g.y0, true), stripQuad(iax, iaz, bx, bz, Math.min(o, oi), Math.max(o, oi), g.y1, false))
  }
  // exterior face with the band reveal (the lintel sits above it)
  if (w.kind === 'lintel' || y0 >= REVEAL.y1) push(parts, f.exterior, sideQuad(ax, az, bx, bz, ext * h, y0, y1, ext))
  else {
    const o = ext * h
    const oi = ext * (h - REVEAL.depth)
    push(parts, f.exterior, sideQuad(ax, az, bx, bz, o, y0, REVEAL.y0, ext), sideQuad(ax, az, bx, bz, o, REVEAL.y1, y1, ext))
    push(parts, 'oxblood', sideQuad(ax, az, bx, bz, oi, REVEAL.y0, REVEAL.y1, ext), stripQuad(ax, az, bx, bz, Math.min(o, oi), Math.max(o, oi), REVEAL.y0, true), stripQuad(ax, az, bx, bz, Math.min(o, oi), Math.max(o, oi), REVEAL.y1, false))
  }
  // notch ends, set 2 mm back inside the ring / lobe faces that cover them: they only close
  // the hairline where a flat end meets a curved face. Where a notch wall stops at its door
  // (the '-in' pier's outer end, the '-out' pier's inner end) the end is a jamb, lined in
  // oxblood lacquer like the entrance door; the lintel over the door has a lacquered soffit.
  if (w.kind === 'notch') {
    const len = Math.hypot(bx - ax, bz - az)
    const ux = (bx - ax) / len
    const uz = (bz - az) / len
    const back = 0.002
    if (w.id.endsWith('-lintel')) push(parts, 'oxbloodLacquer', stripQuad(ax, az, bx, bz, -h, h, y0, false))
    else {
      const jambA = w.id.endsWith('-out')
      const jambB = w.id.endsWith('-in')
      push(parts, jambA ? 'oxbloodLacquer' : f.lower, endQuad(ax + ux * (jambA ? 0 : back), az + uz * (jambA ? 0 : back), ux, uz, h, y0, y1, -1))
      push(parts, jambB ? 'oxbloodLacquer' : f.exterior, endQuad(bx - ux * (jambB ? 0 : back), bz - uz * (jambB ? 0 : back), ux, uz, h, y0, y1, 1))
    }
  }
  // annex end walls: only the door jamb shows (lined in oxblood lacquer, up to the lintel)
  if (w.id === 'annex-end-east' || w.id === 'annex-end-west') {
    const doorEndIsA = Math.abs(ax) < Math.abs(bx)
    const len = Math.hypot(bx - ax, bz - az)
    const ux = (bx - ax) / len
    const uz = (bz - az) / len
    const jamb = doorEndIsA ? endQuad(ax, az, ux, uz, h, 0, MUSEUM.annex.door.height, -1) : endQuad(bx, bz, ux, uz, h, 0, MUSEUM.annex.door.height, 1)
    push(parts, f.caps, jamb)
  }
  return parts
}

/** A clay back washed by a concealed strip: bright at its head (`fromTop`) or at its sill, over y0 → y1. */
function washedBack(name: string, color: string, emissive: string, intensity: number, y0: number, y1: number, fromTop: boolean, floor = 0.18, power = 1.8) {
  const m = new THREE.MeshStandardMaterial({ name, color, emissive: new THREE.Color(emissive), emissiveIntensity: intensity, roughness: 0.92 })
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vWashY;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWashY = (modelMatrix * vec4(transformed, 1.0)).y;')
    const ramp = fromTop ? `smoothstep(${y0.toFixed(3)}, ${y1.toFixed(3)}, vWashY)` : `1.0 - smoothstep(${y0.toFixed(3)}, ${y1.toFixed(3)}, vWashY)`
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vWashY;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\ntotalEmissiveRadiance *= ${floor.toFixed(3)} + ${(1 - floor).toFixed(3)} * pow(${ramp}, ${power.toFixed(2)});`)
  }
  m.customProgramCacheKey = () => name
  return m
}

/**
 * The upper register's niches: a quiet sill uplight, warm at the foot of the back and dark by its
 * head, so the piece in the niche is the bright thing, never a glowing orange box.
 */
export const registerBackMaterial = washedBack('registerBack', '#7e4a3c', '#ff9e62', 0.42, REGISTER_NICHE.y0, REGISTER_NICHE.y1, false, 0.02, 4.5)
/** F's centre niche: glowing deep red from a strip in its head (p07l). */
export const fNicheBackMaterial = washedBack('fNicheBack', '#7c2a22', '#ff5a3a', 0.9, 0, F_NICHE.height, true)

/**
 * One wall, rendered as one mesh per finish (merged again across walls by the pavilion's
 * <StaticMerge>, whose hidden originals keep pointer occlusion exact).
 */
export function Wall({ wall }: { wall: WallBox }) {
  const m = useMaterials()
  const meshes = useMemo(() => {
    const parts = buildWallParts(wall)
    return Object.entries(parts)
      .map(([key, list]) => ({ key: key as PartKey, geo: mergeAll(list ?? []) }))
      .filter((p): p is { key: PartKey; geo: THREE.BufferGeometry } => !!p.geo)
  }, [wall])
  useEffect(() => () => meshes.forEach((p) => p.geo.dispose()), [meshes])
  return (
    <group>
      {meshes.map((p) =>
        p.key === 'registerBack' ? (
          <mesh key={p.key} geometry={p.geo} material={registerBackMaterial} receiveShadow />
        ) : p.key === 'fNicheBack' ? (
          <mesh key={p.key} geometry={p.geo} material={fNicheBackMaterial} receiveShadow />
        ) : (
          <mesh key={p.key} geometry={p.geo} material={m[p.key]} castShadow receiveShadow />
        ),
      )}
    </group>
  )
}
