/**
 * Walls of the clay pavilion, built face by face from each WALLS footprint (arc or segment)
 * so every face takes its own clay finish:
 *
 *   drum / annex / notch  interior: rose (galleries) or terracotta (entry ways, hallway, entrance
 *                         hall) clay plaster below the duplex band, paler blush above it;
 *                         exterior: rammed earth with an oxblood reveal at the band (elevation)
 *   H  description wall   pale buff clay (carries the title), rounded ends
 *   F  inner main wall    deep oxblood red clay — the drama of the inner walls (PDF p08–p09)
 *   D  hallway wall       ochre clay
 *   fins                  oxblood
 *
 * Perimeter walls run up INTO the roof slab (no seam for the sun to leak through at the
 * wall head), and their buried end caps / tops are left out so no face is ever coplanar
 * with a neighbour's (no z-fighting at the annex corners or the door).
 */
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import type { WallBox } from '../config/layout'
import { KEY, MUSEUM } from '../config/museum'
import { useMaterials, type MaterialKey } from '../materials/materials'
import { annulusFace, arcEndCap, cylinderFace, FaceBuilder, mergeAll, roundEnd, segFaces, type ArcWindow } from './shellGeometry'

const H = MUSEUM.pavilion.ceilingHeight
/** Perimeter walls continue this far into the roof slab. */
export const WALL_INTO_ROOF = 0.2
/** Duplex band (10 ft): material change inside, oxblood reveal outside. */
export const BAND_Y = MUSEUM.pavilion.mezzanineBand
/** Exterior band reveal: height and depth. */
const REVEAL = { y0: BAND_Y - 0.06, y1: BAND_Y + 0.06, depth: 0.025 }
/** Interior band: a slim flush shadow line (frames may hang across it), where the clay changes tone. */
export const INNER_REVEAL = { y0: BAND_Y - 0.02, y1: BAND_Y + 0.02, depth: 0.015 }

/** Material per face family. */
export interface WallFinish {
  /** Interior below / above the band (perimeter), or both faces (free-standing). */
  lower: MaterialKey
  upper: MaterialKey
  exterior?: MaterialKey
  top?: MaterialKey
  caps?: MaterialKey
}

/** Which walls are perimeter (exterior on one side). */
const PERIMETER = new Set(['drum', 'notch', 'annex', 'lintel'])

export function wallFinish(w: WallBox): WallFinish {
  switch (w.kind) {
    case 'drum':
      return w.id === 'drum-ring' ? { lower: 'clayRose', upper: 'clayBlush', exterior: 'rammedEarth', caps: 'rammedEarth' } : { lower: 'clayTerracotta', upper: 'clayBlush', exterior: 'rammedEarth', caps: 'rammedEarth' }
    case 'notch':
      return { lower: 'clayRose', upper: 'clayBlush', exterior: 'rammedEarth', caps: 'rammedEarth' }
    case 'annex':
      return { lower: 'clayTerracotta', upper: 'clayBlush', exterior: 'rammedEarth', caps: 'oxbloodLacquer' }
    case 'lintel':
      return { lower: 'clayBlush', upper: 'clayBlush', exterior: 'rammedEarth', caps: 'oxbloodLacquer' }
    case 'description':
      return { lower: 'clayBuff', upper: 'clayBuff', top: 'clayBuff', caps: 'clayBuff' }
    case 'inner-main':
      return { lower: 'oxblood', upper: 'oxblood', top: 'oxblood', caps: 'oxblood' }
    case 'hallway':
      return { lower: 'clayOchre', upper: 'clayOchre', top: 'clayOchre', caps: 'clayOchre' }
    case 'fin':
      return { lower: 'oxblood', upper: 'oxblood', top: 'oxblood', caps: 'oxblood' }
    default:
      return { lower: 'clayRose', upper: 'clayBlush', top: 'clayRose', caps: 'clayRose' }
  }
}

/** A clay finish, or the warm glow lining each niche head. */
export type PartKey = MaterialKey | 'nicheGlow'
type Parts = Partial<Record<PartKey, (THREE.BufferGeometry | null)[]>>

function push(parts: Parts, key: PartKey | undefined, ...g: (THREE.BufferGeometry | null)[]) {
  if (!key) return
  ;(parts[key] ??= []).push(...g)
}

/* ------------------------------------------------------------------ */
/* Niches in the ring wall (upper register, above each podium run)     */
/* ------------------------------------------------------------------ */

export const NICHE = { width: 0.86, y0: 3.85, y1: 4.75, depth: 0.2 }

/** Niche windows on the gallery ring wall: one above every podium (same plan angle), kept clear of the notches. */
export function ringNiches(): ArcWindow[] {
  const r = KEY.ringR
  const half = NICHE.width / 2 / r
  const deg = MUSEUM.podium.anglesDeg
  const DEGR = Math.PI / 180
  // usable span of the ring's interior face: notch to notch, less half a metre at each end
  const lo = MUSEUM.drum.dNotchDeg * DEGR + (MUSEUM.drum.thickness / 2 + 0.5) / r
  const hi = (MUSEUM.drum.neNotchDeg + 360) * DEGR - (MUSEUM.drum.thickness / 2 + 0.5) / r
  return [...deg.a, ...deg.b, ...deg.c].map((d) => {
    const a = (d < MUSEUM.drum.dNotchDeg ? d + 360 : d) * DEGR
    const c = Math.min(hi - half, Math.max(lo + half, a))
    return { a0: c - half, a1: c + half, y0: NICHE.y0, y1: NICHE.y1 }
  })
}

/** The niche's own lining (back, jambs, head, sill), `depth` behind the face of radius r, and its one shelf. */
function nicheLining(r: number, w: ArcWindow, depth: number) {
  const back = cylinderFace(0, 0, r + depth, w.a0, w.a1, w.y0, w.y1, 'in')
  // jambs: radial faces looking into the niche
  const j0 = arcEndCap(0, 0, r, r + depth, w.a0, w.y0, w.y1, 'end')
  const j1 = arcEndCap(0, 0, r, r + depth, w.a1, w.y0, w.y1, 'start')
  const sill = annulusFace(0, 0, r, r + depth, w.a0, w.a1, w.y0, true)
  const head = annulusFace(0, 0, r, r + depth, w.a0, w.a1, w.y1, false)
  // a slim lacquered shelf a little below half height, set back 12 mm from the wall face
  const ys = w.y0 + (w.y1 - w.y0) * 0.42
  const t = 0.015
  const r0 = r + 0.012
  const shelf = mergeAll([annulusFace(0, 0, r0, r + depth, w.a0, w.a1, ys + t, true), annulusFace(0, 0, r0, r + depth, w.a0, w.a1, ys - t, false), cylinderFace(0, 0, r0, w.a0, w.a1, ys - t, ys + t, 'in')])
  return { lining: mergeAll([back, j0, j1, sill]), head, shelf }
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
  const toLobe = w.id === 'notch-ne' ? 1 : -1 // NE notch: the lobe lies at larger angles; D notch: smaller
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

export function buildWallParts(w: WallBox): Parts {
  const parts: Parts = {}
  const f = wallFinish(w)
  const s = w.shape
  if (!s) return parts
  const perimeter = PERIMETER.has(w.kind)
  const y0 = w.min[1]
  const y1 = perimeter ? Math.max(w.max[1], H + WALL_INTO_ROOF) : w.max[1]

  if (s.kind === 'arc') {
    const r0 = s.r - s.thickness / 2
    const r1 = s.r + s.thickness / 2
    if (perimeter) {
      const windows = w.id === 'drum-ring' ? ringNiches() : []
      const span = drumFaceSpans(w)
      const [i0, i1] = span.in
      const g = INNER_REVEAL
      push(parts, f.lower, cylinderFace(s.cx, s.cz, r0, i0, i1, y0, g.y0, 'in', windows))
      push(parts, f.upper, cylinderFace(s.cx, s.cz, r0, i0, i1, g.y1, y1, 'in', windows))
      push(parts, 'oxblood', cylinderFace(s.cx, s.cz, r0 + g.depth, i0, i1, g.y0, g.y1, 'in'), annulusFace(s.cx, s.cz, r0, r0 + g.depth, i0, i1, g.y0, true), annulusFace(s.cx, s.cz, r0, r0 + g.depth, i0, i1, g.y1, false))
      revealedOuterArc(r1, span.out[0], span.out[1], y0, y1, parts, f)
      for (const win of windows) {
        const n = nicheLining(r0, win, NICHE.depth)
        push(parts, f.upper, n.lining)
        push(parts, 'nicheGlow', n.head)
        push(parts, 'oxbloodLacquer', n.shelf)
      }
      // end caps are buried in the notch / annex walls
    } else {
      push(parts, f.lower, cylinderFace(s.cx, s.cz, r0, s.a0, s.a1, y0, y1, 'in'), cylinderFace(s.cx, s.cz, r1, s.a0, s.a1, y0, y1, 'out'))
      push(parts, f.top, annulusFace(s.cx, s.cz, r0, r1, s.a0, s.a1, y1, true))
      if (s.a1 - s.a0 < Math.PI * 2 - 1e-6) {
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
  // the hairline where a flat end meets a curved face
  if (w.kind === 'notch') {
    const len = Math.hypot(bx - ax, bz - az)
    const ux = (bx - ax) / len
    const uz = (bz - az) / len
    const back = 0.002
    push(parts, f.lower, endQuad(ax + ux * back, az + uz * back, ux, uz, h, y0, y1, -1))
    push(parts, f.exterior, endQuad(bx - ux * back, bz - uz * back, ux, uz, h, y0, y1, 1))
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

/** Warm LED glow lining each niche head (a concealed strip). */
export const nicheGlowMaterial = new THREE.MeshStandardMaterial({ name: 'nicheGlow', color: '#f3d7c4', emissive: new THREE.Color('#ffc59a'), emissiveIntensity: 1.6, roughness: 0.8 })

/**
 * One wall, rendered as one mesh per clay finish (merged again across walls by the
 * pavilion's <StaticMerge>, whose hidden originals keep pointer occlusion exact).
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
        p.key === 'nicheGlow' ? (
          <mesh key={p.key} geometry={p.geo} material={nicheGlowMaterial} />
        ) : (
          <mesh key={p.key} geometry={p.geo} material={m[p.key]} castShadow receiveShadow />
        ),
      )}
    </group>
  )
}
