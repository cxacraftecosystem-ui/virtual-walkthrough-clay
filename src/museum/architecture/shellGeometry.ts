/**
 * SHELL GEOMETRY — face-by-face builders for the pavilion's curved and angled walls.
 *
 * Every builder returns plain BufferGeometries in WORLD space with metre UVs (u = metres
 * along the face, v = height), one geometry per face family, so each family can take its
 * own material and still be merged by <StaticMerge> (which skips multi-material meshes).
 *
 * Plan angles follow config/museum.ts: a = atan2(z, x), arcs run a0 → a1 with a0 < a1.
 */
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

/** Max chord length (m) of an arc segment: ~0.25 m keeps a 10 m drum smooth at any distance. */
export const ARC_CHORD = 0.25

/** Low-level builder: quads with explicit normals and UVs. */
export class FaceBuilder {
  pos: number[] = []
  nor: number[] = []
  uv: number[] = []
  idx: number[] = []

  /** Quad p0 → p1 → p2 → p3 (counter-clockwise seen from the front), per-vertex normals and UVs. */
  quad(p: number[][], n: number[][], u: number[][]) {
    const base = this.pos.length / 3
    for (let i = 0; i < 4; i++) {
      this.pos.push(p[i][0], p[i][1], p[i][2])
      this.nor.push(n[i][0], n[i][1], n[i][2])
      this.uv.push(u[i][0], u[i][1])
    }
    this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3)
  }

  /** Triangle fan / polygon (convex, counter-clockwise from the front) with a single normal. */
  poly(p: number[][], n: number[], u: number[][]) {
    const base = this.pos.length / 3
    for (let i = 0; i < p.length; i++) {
      this.pos.push(p[i][0], p[i][1], p[i][2])
      this.nor.push(n[0], n[1], n[2])
      this.uv.push(u[i][0], u[i][1])
    }
    for (let i = 1; i < p.length - 1; i++) this.idx.push(base, base + i, base + i + 1)
  }

  get empty() {
    return this.idx.length === 0
  }

  build(): THREE.BufferGeometry | null {
    if (this.empty) return null
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3))
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3))
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2))
    g.setIndex(this.idx)
    g.computeBoundingSphere()
    return g
  }
}

/** Merge (and dispose) a list of geometries; null entries are skipped. */
export function mergeAll(list: (THREE.BufferGeometry | null | undefined)[]): THREE.BufferGeometry | null {
  const gs = list.filter((g): g is THREE.BufferGeometry => !!g)
  if (gs.length === 0) return null
  if (gs.length === 1) return gs[0]
  const m = mergeGeometries(gs, false)
  gs.forEach((g) => g.dispose())
  if (m) m.computeBoundingSphere()
  return m
}

const at = (cx: number, cz: number, r: number, a: number, y: number) => [cx + r * Math.cos(a), y, cz + r * Math.sin(a)]

/** Angular breakpoints a0 → a1 with chords ≤ ARC_CHORD at radius r, always including `extra` angles inside the span. */
export function arcSteps(r: number, a0: number, a1: number, extra: number[] = [], chord = ARC_CHORD): number[] {
  const n = Math.max(2, Math.ceil(((a1 - a0) * r) / chord))
  const set = new Set<number>()
  for (let i = 0; i <= n; i++) set.add(a0 + ((a1 - a0) * i) / n)
  for (const e of extra) if (e > a0 && e < a1) set.add(e)
  return [...set].sort((a, b) => a - b)
}

/** A rectangular window cut out of a curved face (angles in radians, heights in metres). */
export interface ArcWindow {
  a0: number
  a1: number
  y0: number
  y1: number
}

/**
 * Concave (`side: 'in'`, normal towards the centre) or convex (`'out'`) cylindrical face of
 * radius r from a0 → a1, y0 → y1, optionally with rectangular windows left open (niches).
 * u = metres along the arc (increasing to the right of a viewer facing the face), v = y.
 */
export function cylinderFace(cx: number, cz: number, r: number, a0: number, a1: number, y0: number, y1: number, side: 'in' | 'out', windows: ArcWindow[] = []): THREE.BufferGeometry | null {
  const f = new FaceBuilder()
  const steps = arcSteps(r, a0, a1, windows.flatMap((w) => [w.a0, w.a1]))
  for (let i = 0; i < steps.length - 1; i++) {
    const t0 = steps[i]
    const t1 = steps[i + 1]
    const mid = (t0 + t1) / 2
    // vertical spans of this column not covered by a window
    const cuts = windows.filter((w) => mid > w.a0 && mid < w.a1).sort((a, b) => a.y0 - b.y0)
    const spans: [number, number][] = []
    let y = y0
    for (const w of cuts) {
      if (w.y0 > y) spans.push([y, Math.min(w.y0, y1)])
      y = Math.max(y, w.y1)
    }
    if (y < y1) spans.push([y, y1])
    const s = side === 'out' ? 1 : -1
    const n0 = [s * Math.cos(t0), 0, s * Math.sin(t0)]
    const n1 = [s * Math.cos(t1), 0, s * Math.sin(t1)]
    for (const [ya, yb] of spans) {
      if (yb - ya < 1e-5) continue
      if (side === 'out') {
        // seen from outside, angle increases to the LEFT → u = −a·r
        f.quad([at(cx, cz, r, t0, ya), at(cx, cz, r, t0, yb), at(cx, cz, r, t1, yb), at(cx, cz, r, t1, ya)], [n0, n0, n1, n1], [
          [-t0 * r, ya],
          [-t0 * r, yb],
          [-t1 * r, yb],
          [-t1 * r, ya],
        ])
      } else {
        f.quad([at(cx, cz, r, t0, ya), at(cx, cz, r, t1, ya), at(cx, cz, r, t1, yb), at(cx, cz, r, t0, yb)], [n0, n1, n1, n0], [
          [t0 * r, ya],
          [t1 * r, ya],
          [t1 * r, yb],
          [t0 * r, yb],
        ])
      }
    }
  }
  return f.build()
}

/** Horizontal annular sector r0 < r1 at height y, facing up (or down). UVs = world x, −z. */
export function annulusFace(cx: number, cz: number, r0: number, r1: number, a0: number, a1: number, y: number, up: boolean): THREE.BufferGeometry | null {
  const f = new FaceBuilder()
  const steps = arcSteps(r1, a0, a1)
  const n = [0, up ? 1 : -1, 0]
  const uvOf = (p: number[]) => [p[0], -p[2]]
  for (let i = 0; i < steps.length - 1; i++) {
    const t0 = steps[i]
    const t1 = steps[i + 1]
    const p = up ? [at(cx, cz, r0, t0, y), at(cx, cz, r0, t1, y), at(cx, cz, r1, t1, y), at(cx, cz, r1, t0, y)] : [at(cx, cz, r0, t0, y), at(cx, cz, r1, t0, y), at(cx, cz, r1, t1, y), at(cx, cz, r0, t1, y)]
    if (r0 <= 1e-6) {
      // a pie slice: drop the degenerate inner edge
      const tri = up ? [p[0], p[2], p[3]] : [p[0], p[1], p[2]]
      f.poly(tri, n, tri.map(uvOf))
    } else f.quad(p, [n, n, n, n], p.map(uvOf))
  }
  return f.build()
}

/** Flat radial end cap of an arc band (at angle a, r0 → r1), facing away from the band. */
export function arcEndCap(cx: number, cz: number, r0: number, r1: number, a: number, y0: number, y1: number, end: 'start' | 'end'): THREE.BufferGeometry | null {
  const f = new FaceBuilder()
  // tangent in the direction of increasing angle
  const tx = -Math.sin(a)
  const tz = Math.cos(a)
  const s = end === 'start' ? -1 : 1
  const n = [s * tx, 0, s * tz]
  // seen from outside the cap: at the start r0 is on the right, at the end r1 is
  const p = end === 'start' ? [at(cx, cz, r0, a, y0), at(cx, cz, r0, a, y1), at(cx, cz, r1, a, y1), at(cx, cz, r1, a, y0)] : [at(cx, cz, r1, a, y0), at(cx, cz, r1, a, y1), at(cx, cz, r0, a, y1), at(cx, cz, r0, a, y0)]
  const ua = end === 'start' ? -r0 : r1
  const ub = end === 'start' ? -r1 : r0
  f.quad(p, [n, n, n, n], [
    [ua, y0],
    [ua, y1],
    [ub, y1],
    [ub, y0],
  ])
  return f.build()
}

/**
 * Rounded end of a free-standing arc wall: a half cylinder (radius = half the thickness)
 * about the wall's centreline end point, plus its half-disc top.
 */
export function roundEnd(cx: number, cz: number, r: number, thickness: number, a: number, y0: number, y1: number, end: 'start' | 'end'): { side: THREE.BufferGeometry | null; top: THREE.BufferGeometry | null } {
  const half = thickness / 2
  const ox = cx + r * Math.cos(a)
  const oz = cz + r * Math.sin(a)
  // the half cylinder spans the side away from the wall: centred on the outward tangent
  const tx = -Math.sin(a)
  const tz = Math.cos(a)
  const dir = end === 'start' ? -1 : 1
  const centre = Math.atan2(tz * dir, tx * dir)
  const side = cylinderFace(ox, oz, half, centre - Math.PI / 2, centre + Math.PI / 2, y0, y1, 'out')
  const top = annulusFace(ox, oz, 0, half, centre - Math.PI / 2, centre + Math.PI / 2, y1, true)
  return { side, top }
}

/* ------------------------------------------------------------------ */
/* Straight walls                                                      */
/* ------------------------------------------------------------------ */

export interface SegFaces {
  /** Long face on the +n side, n = left normal of a → b (−dz, dx). */
  left: THREE.BufferGeometry | null
  /** Long face on the −n side. */
  right: THREE.BufferGeometry | null
  top: THREE.BufferGeometry | null
  bottom: THREE.BufferGeometry | null
  /** End faces (at a and at b). */
  caps: THREE.BufferGeometry | null
}

/**
 * A straight wall a → b of the given thickness from y0 to y1, face by face. `extendA` /
 * `extendB` lengthen it past its end points (to bury an end in a neighbouring wall).
 */
export function segFaces(ax: number, az: number, bx: number, bz: number, thickness: number, y0: number, y1: number, opts: { extendA?: number; extendB?: number; bottom?: boolean } = {}): SegFaces {
  const len0 = Math.hypot(bx - ax, bz - az) || 1
  const dx = (bx - ax) / len0
  const dz = (bz - az) / len0
  const ea = opts.extendA ?? 0
  const eb = opts.extendB ?? 0
  const Ax = ax - dx * ea
  const Az = az - dz * ea
  const Bx = bx + dx * eb
  const Bz = bz + dz * eb
  const len = len0 + ea + eb
  const nx = -dz
  const nz = dx
  const h = thickness / 2
  const P = (x: number, z: number, s: number, y: number) => [x + nx * h * s, y, z + nz * h * s]
  const mk = (fn: (f: FaceBuilder) => void) => {
    const f = new FaceBuilder()
    fn(f)
    return f.build()
  }
  const L = [nx, 0, nz]
  const R = [-nx, 0, -nz]
  // Every quad is counter-clockwise seen from the side its normal points to.
  const left = mk((f) =>
    // seen from +n: a is on the left, b on the right
    f.quad([P(Ax, Az, 1, y0), P(Bx, Bz, 1, y0), P(Bx, Bz, 1, y1), P(Ax, Az, 1, y1)], [L, L, L, L], [
      [0, y0],
      [len, y0],
      [len, y1],
      [0, y1],
    ]),
  )
  const right = mk((f) =>
    // seen from −n: b is on the left, a on the right
    f.quad([P(Bx, Bz, -1, y0), P(Ax, Az, -1, y0), P(Ax, Az, -1, y1), P(Bx, Bz, -1, y1)], [R, R, R, R], [
      [0, y0],
      [len, y0],
      [len, y1],
      [0, y1],
    ]),
  )
  const up = [0, 1, 0]
  const top = mk((f) =>
    f.quad([P(Ax, Az, 1, y1), P(Bx, Bz, 1, y1), P(Bx, Bz, -1, y1), P(Ax, Az, -1, y1)], [up, up, up, up], [
      [0, h],
      [len, h],
      [len, -h],
      [0, -h],
    ]),
  )
  const down = [0, -1, 0]
  const bottom = opts.bottom
    ? mk((f) =>
        f.quad([P(Ax, Az, -1, y0), P(Bx, Bz, -1, y0), P(Bx, Bz, 1, y0), P(Ax, Az, 1, y0)], [down, down, down, down], [
          [0, -h],
          [len, -h],
          [len, h],
          [0, h],
        ]),
      )
    : null
  const ca = [-dx, 0, -dz]
  const cb = [dx, 0, dz]
  const caps = mk((f) => {
    f.quad([P(Ax, Az, -1, y0), P(Ax, Az, 1, y0), P(Ax, Az, 1, y1), P(Ax, Az, -1, y1)], [ca, ca, ca, ca], [
      [-h, y0],
      [h, y0],
      [h, y1],
      [-h, y1],
    ])
    f.quad([P(Bx, Bz, 1, y0), P(Bx, Bz, -1, y0), P(Bx, Bz, -1, y1), P(Bx, Bz, 1, y1)], [cb, cb, cb, cb], [
      [-h, y0],
      [h, y0],
      [h, y1],
      [-h, y1],
    ])
  })
  return { left, right, top, bottom, caps }
}

/* ------------------------------------------------------------------ */
/* Plan shapes                                                         */
/* ------------------------------------------------------------------ */

/**
 * Flat horizontal face from a closed [x, z] outline (optionally with holes) at height y.
 * UVs are world metres (x, −z) so tiling materials read at true scale.
 */
export function planFace(outline: [number, number][], y: number, up: boolean, holes: [number, number][][] = []): THREE.BufferGeometry {
  const shape = new THREE.Shape(outline.map(([x, z]) => new THREE.Vector2(x, -z)))
  for (const h of holes) shape.holes.push(new THREE.Path(h.map(([x, z]) => new THREE.Vector2(x, -z))))
  const g = new THREE.ShapeGeometry(shape, 1)
  g.rotateX(-Math.PI / 2)
  if (!up) {
    // flip winding and normals for a ceiling
    const idx = g.getIndex()!
    for (let i = 0; i < idx.count; i += 3) {
      const a = idx.getX(i + 1)
      idx.setX(i + 1, idx.getX(i + 2))
      idx.setX(i + 2, a)
    }
    const n = g.getAttribute('normal') as THREE.BufferAttribute
    for (let i = 0; i < n.count; i++) n.setY(i, -n.getY(i))
  }
  g.translate(0, y, 0)
  g.computeBoundingSphere()
  return g
}

/** Circle as a closed [x, z] ring (counter-clockwise in plan view as drawn on screen). */
export function circlePoints(cx: number, cz: number, r: number, chord = ARC_CHORD): [number, number][] {
  const n = Math.max(24, Math.ceil((Math.PI * 2 * r) / chord))
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2
    return [cx + r * Math.cos(a), cz + r * Math.sin(a)] as [number, number]
  })
}

/**
 * Vertical faces along a closed (or open) [x, z] polyline from y0 to y1. `outward` picks
 * the side they face: +1 = the left normal (−dz, dx) of each edge, −1 = the right normal.
 */
export function outlineSides(points: [number, number][], y0: number, y1: number, outward: 1 | -1, closed = true): THREE.BufferGeometry | null {
  const f = new FaceBuilder()
  const n = points.length
  let u = 0
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const [ax, az] = points[i]
    const [bx, bz] = points[(i + 1) % n]
    const len = Math.hypot(bx - ax, bz - az)
    if (len < 1e-6) continue
    const nx = (-(bz - az) / len) * outward
    const nz = ((bx - ax) / len) * outward
    const N = [nx, 0, nz]
    if (outward === 1)
      f.quad([[ax, y0, az], [bx, y0, bz], [bx, y1, bz], [ax, y1, az]], [N, N, N, N], [
        [u, y0],
        [u + len, y0],
        [u + len, y1],
        [u, y1],
      ])
    else
      f.quad([[bx, y0, bz], [ax, y0, az], [ax, y1, az], [bx, y1, bz]], [N, N, N, N], [
        [u + len, y0],
        [u, y0],
        [u, y1],
        [u + len, y1],
      ])
    u += len
  }
  return f.build()
}
