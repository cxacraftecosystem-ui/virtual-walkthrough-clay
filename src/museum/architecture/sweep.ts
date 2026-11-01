/**
 * SWEEP — the grand plan's free-form builders (GRAND §2.5–§2.7): profiles swept along plan
 * paths (copings, cornices, balustrades, the serpentine's rounded heads), surfaces of revolution
 * (the dome, its terraces, the Sphere Well's ceiling) and oriented boxes (treads, piers, beams).
 *
 * Everything is world space with metre UVs, like shellGeometry.ts, and every quad is wound
 * from the normal it is given (`Mesh.quad` turns it when the corners run the other way), so a
 * caller never has to think about winding. Optional per-vertex colour and glow channels let one
 * geometry carry several tints and a concealed-light mask (the dome's single interior mesh).
 */
import * as THREE from 'three'

export type V3 = [number, number, number]
export type V2 = [number, number]

/** Quads and triangles with per-vertex normal, metre UV and optional colour / glow. */
export class Mesh {
  pos: number[] = []
  nor: number[] = []
  uv: number[] = []
  col: number[] = []
  glow: number[] = []
  idx: number[] = []
  /** Current tint (linear RGB) and glow written with every vertex. */
  color: [number, number, number] = [1, 1, 1]
  glowValue = 0
  constructor(public readonly channels: { color?: boolean; glow?: boolean } = {}) {}

  private vert(p: V3, n: V3, u: V2) {
    this.pos.push(p[0], p[1], p[2])
    this.nor.push(n[0], n[1], n[2])
    this.uv.push(u[0], u[1])
    if (this.channels.color) this.col.push(...this.color)
    if (this.channels.glow) this.glow.push(this.glowValue)
  }

  /** Quad p0 → p1 → p2 → p3 (a ring), turned to face along its normals. */
  quad(p: V3[], n: V3[], u: V2[]) {
    const e1 = [p[1][0] - p[0][0], p[1][1] - p[0][1], p[1][2] - p[0][2]]
    const e2 = [p[3][0] - p[0][0], p[3][1] - p[0][1], p[3][2] - p[0][2]]
    const c = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]]
    const nn = [n[0][0] + n[1][0] + n[2][0] + n[3][0], n[0][1] + n[1][1] + n[2][1] + n[3][1], n[0][2] + n[1][2] + n[2][2] + n[3][2]]
    const order = c[0] * nn[0] + c[1] * nn[1] + c[2] * nn[2] < 0 ? [0, 3, 2, 1] : [0, 1, 2, 3]
    const b = this.pos.length / 3
    for (const i of order) this.vert(p[i], n[i], u[i])
    this.idx.push(b, b + 1, b + 2, b, b + 2, b + 3)
  }

  /** A flat quad with one normal. */
  flat(p: V3[], n: V3, u: V2[]) {
    this.quad(p, [n, n, n, n], u)
  }

  /** A convex polygon with one normal (fan), turned to face along it. */
  poly(p: V3[], n: V3, u: V2[]) {
    if (p.length < 3) return
    const e1 = [p[1][0] - p[0][0], p[1][1] - p[0][1], p[1][2] - p[0][2]]
    const e2 = [p[2][0] - p[0][0], p[2][1] - p[0][1], p[2][2] - p[0][2]]
    const c = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]]
    const flip = c[0] * n[0] + c[1] * n[1] + c[2] * n[2] < 0
    const b = this.pos.length / 3
    for (let i = 0; i < p.length; i++) this.vert(p[i], n, u[i])
    for (let i = 1; i < p.length - 1; i++) {
      if (flip) this.idx.push(b, b + i + 1, b + i)
      else this.idx.push(b, b + i, b + i + 1)
    }
  }

  /** An axis-free box: centre, three half-axes (unit directions × half sizes). */
  box(c: V3, ax: V3, ay: V3, az: V3) {
    const P = (sx: number, sy: number, sz: number): V3 => [c[0] + ax[0] * sx + ay[0] * sy + az[0] * sz, c[1] + ax[1] * sx + ay[1] * sy + az[1] * sz, c[2] + ax[2] * sx + ay[2] * sy + az[2] * sz]
    const len = (v: V3) => Math.hypot(v[0], v[1], v[2]) || 1
    const unit = (v: V3, s: number): V3 => [(v[0] / len(v)) * s, (v[1] / len(v)) * s, (v[2] / len(v)) * s]
    const [lx, ly, lz] = [len(ax), len(ay), len(az)]
    const faces: [V3, V3[], V2[]][] = [
      [unit(ax, 1), [P(1, -1, -1), P(1, 1, -1), P(1, 1, 1), P(1, -1, 1)], [[0, 0], [0, 2 * ly], [2 * lz, 2 * ly], [2 * lz, 0]]],
      [unit(ax, -1), [P(-1, -1, -1), P(-1, -1, 1), P(-1, 1, 1), P(-1, 1, -1)], [[0, 0], [2 * lz, 0], [2 * lz, 2 * ly], [0, 2 * ly]]],
      [unit(ay, 1), [P(-1, 1, -1), P(-1, 1, 1), P(1, 1, 1), P(1, 1, -1)], [[0, 0], [0, 2 * lz], [2 * lx, 2 * lz], [2 * lx, 0]]],
      [unit(ay, -1), [P(-1, -1, -1), P(1, -1, -1), P(1, -1, 1), P(-1, -1, 1)], [[0, 0], [2 * lx, 0], [2 * lx, 2 * lz], [0, 2 * lz]]],
      [unit(az, 1), [P(-1, -1, 1), P(1, -1, 1), P(1, 1, 1), P(-1, 1, 1)], [[0, 0], [2 * lx, 0], [2 * lx, 2 * ly], [0, 2 * ly]]],
      [unit(az, -1), [P(-1, -1, -1), P(-1, 1, -1), P(1, 1, -1), P(1, -1, -1)], [[0, 0], [0, 2 * ly], [2 * lx, 2 * ly], [2 * lx, 0]]],
    ]
    for (const [n, p, u] of faces) this.flat(p, n, u)
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
    if (this.channels.color) g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3))
    if (this.channels.glow) g.setAttribute('glow', new THREE.Float32BufferAttribute(this.glow, 1))
    g.setIndex(this.idx)
    g.computeBoundingSphere()
    return g
  }
}

/** A plan path: points [x, z] (open or closed). */
export interface PlanPath {
  pts: V2[]
  closed?: boolean
}

/** Points on a circle about (cx, cz), radius r, from a0 → a1 (radians), at most `chord` metres apart. */
export function arcPath(cx: number, cz: number, r: number, a0: number, a1: number, chord = 0.3): PlanPath {
  const full = Math.abs(a1 - a0) >= Math.PI * 2 - 1e-9
  const n = Math.max(2, Math.ceil((Math.abs(a1 - a0) * r) / chord))
  const pts: V2[] = []
  for (let i = 0; i <= (full ? n - 1 : n); i++) {
    const a = a0 + ((a1 - a0) * i) / n
    pts.push([cx + r * Math.cos(a), cz + r * Math.sin(a)])
  }
  return { pts, closed: full }
}

/** Unit left normals (−tz, tx rotated so +o is to the left of the direction of travel) at every path point. */
function pathFrames(path: PlanPath) {
  const p = path.pts
  const n = p.length
  const out: { t: V2; l: V2; s: number }[] = []
  let s = 0
  for (let i = 0; i < n; i++) {
    const prev = path.closed ? p[(i - 1 + n) % n] : p[Math.max(0, i - 1)]
    const next = path.closed ? p[(i + 1) % n] : p[Math.min(n - 1, i + 1)]
    let tx = next[0] - prev[0]
    let tz = next[1] - prev[1]
    const l = Math.hypot(tx, tz) || 1
    tx /= l
    tz /= l
    if (i > 0) s += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1])
    // left of travel, seen from above with +x right and +z down the screen (as segFaces' "left")
    out.push({ t: [tx, tz], l: [-tz, tx], s })
  }
  return out
}

/**
 * Sweep a cross-section along a plan path. The profile is a polyline of [o, y]: `o` metres to
 * the left of the path (shellGeometry's left normal: towards the centre on an arc of increasing
 * angle), `y` height. `normals` gives each profile vertex's own [no, ny] normal for smooth
 * shading (default: flat, from each profile segment, pointing to its right as the profile is
 * walked — list the profile so its outside is on the right). u = metres along the path, v =
 * metres along the profile.
 */
export function sweep(mesh: Mesh, path: PlanPath, profile: V2[], opts: { normals?: V2[]; closedProfile?: boolean } = {}) {
  const fr = pathFrames(path)
  const n = path.pts.length
  const segs = path.closed ? n : n - 1
  const pn = profile.length
  const psegs = opts.closedProfile ? pn : pn - 1
  // cumulative profile length
  const pv: number[] = [0]
  for (let j = 1; j <= pn; j++) {
    const a = profile[(j - 1) % pn]
    const b = profile[j % pn]
    pv.push(pv[j - 1] + Math.hypot(b[0] - a[0], b[1] - a[1]))
  }
  const P = (i: number, j: number): V3 => {
    const f = fr[i % n]
    const [o, y] = profile[j % pn]
    const q = path.pts[i % n]
    return [q[0] + f.l[0] * o, y, q[1] + f.l[1] * o]
  }
  const N = (i: number, no: number, ny: number): V3 => {
    const f = fr[i % n]
    const x = f.l[0] * no
    const z = f.l[1] * no
    const len = Math.hypot(x, ny, z) || 1
    return [x / len, ny / len, z / len]
  }
  for (let j = 0; j < psegs; j++) {
    const a = profile[j]
    const b = profile[(j + 1) % pn]
    // the segment's outward normal: its direction turned to the right in (o, y)
    const dO = b[0] - a[0]
    const dY = b[1] - a[1]
    const segN: V2 = [dY, -dO]
    const na = opts.normals ? opts.normals[j] : segN
    const nb = opts.normals ? opts.normals[(j + 1) % pn] : segN
    for (let i = 0; i < segs; i++) {
      const i1 = i + 1
      const s0 = fr[i].s
      const s1 = i1 < n ? fr[i1].s : fr[n - 1].s + Math.hypot(path.pts[0][0] - path.pts[n - 1][0], path.pts[0][1] - path.pts[n - 1][1])
      mesh.quad(
        [P(i, j), P(i1, j), P(i1, j + 1), P(i, j + 1)],
        [N(i, na[0], na[1]), N(i1, na[0], na[1]), N(i1, nb[0], nb[1]), N(i, nb[0], nb[1])],
        [
          [s0, pv[j]],
          [s1, pv[j]],
          [s1, pv[j + 1]],
          [s0, pv[j + 1]],
        ],
      )
    }
  }
}

/** Close a swept profile's open ends with flat caps (convex profiles only). */
export function sweepCaps(mesh: Mesh, path: PlanPath, profile: V2[]) {
  if (path.closed) return
  const fr = pathFrames(path)
  for (const end of [0, path.pts.length - 1]) {
    const f = fr[end]
    const q = path.pts[end]
    const sgn = end === 0 ? -1 : 1
    const pts = profile.map(([o, y]) => [q[0] + f.l[0] * o, y, q[1] + f.l[1] * o] as V3)
    mesh.poly(pts, [f.t[0] * sgn, 0, f.t[1] * sgn], profile.map(([o, y]) => [o, y] as V2))
  }
}

/**
 * A surface of revolution about the vertical axis through (cx, cz): the profile [r, y] is
 * swept a0 → a1 (radians). Smooth shading from the given per-vertex normals [nr, ny] (or flat
 * per segment, outward to the profile's right). `segments` per full turn.
 */
export function revolve(mesh: Mesh, cx: number, cz: number, profile: V2[], a0: number, a1: number, segments: number, normals?: V2[]) {
  const full = Math.abs(a1 - a0) >= Math.PI * 2 - 1e-9
  const n = Math.max(2, Math.ceil((segments * Math.abs(a1 - a0)) / (Math.PI * 2)))
  const ang = (i: number) => a0 + ((a1 - a0) * i) / n
  const pv: number[] = [0]
  for (let j = 1; j < profile.length; j++) pv.push(pv[j - 1] + Math.hypot(profile[j][0] - profile[j - 1][0], profile[j][1] - profile[j - 1][1]))
  for (let j = 0; j < profile.length - 1; j++) {
    const A = profile[j]
    const B = profile[j + 1]
    const segN: V2 = [B[1] - A[1], -(B[0] - A[0])]
    const na = normals ? normals[j] : segN
    const nb = normals ? normals[j + 1] : segN
    if (A[0] < 1e-6 && B[0] < 1e-6) continue
    for (let i = 0; i < n; i++) {
      const t0 = ang(i)
      const t1 = full && i === n - 1 ? a0 : ang(i + 1)
      const c0 = Math.cos(t0)
      const s0 = Math.sin(t0)
      const c1 = Math.cos(t1)
      const s1 = Math.sin(t1)
      const P = (r: number, y: number, c: number, s: number): V3 => [cx + r * c, y, cz + r * s]
      const Nn = (nr: number, ny: number, c: number, s: number): V3 => {
        const l = Math.hypot(nr, ny) || 1
        return [(nr / l) * c, ny / l, (nr / l) * s]
      }
      const rm = Math.max(A[0], B[0], 0.01)
      const u0 = ((a1 - a0) * i * rm) / n
      const u1 = ((a1 - a0) * (i + 1) * rm) / n
      mesh.quad(
        [P(A[0], A[1], c0, s0), P(A[0], A[1], c1, s1), P(B[0], B[1], c1, s1), P(B[0], B[1], c0, s0)],
        [Nn(na[0], na[1], c0, s0), Nn(na[0], na[1], c1, s1), Nn(nb[0], nb[1], c1, s1), Nn(nb[0], nb[1], c0, s0)],
        [
          [u0, pv[j]],
          [u1, pv[j]],
          [u1, pv[j + 1]],
          [u0, pv[j + 1]],
        ],
      )
    }
  }
}

/** An oriented box along the plan direction `aDeg`-free: centre, plan tangent (unit), sizes (along, up, across). */
export function planBox(mesh: Mesh, c: V3, t: V2, along: number, up: number, across: number) {
  mesh.box(c, [t[0] * (along / 2), 0, t[1] * (along / 2)], [0, up / 2, 0], [-t[1] * (across / 2), 0, t[0] * (across / 2)])
}

/** sRGB hex → linear [r, g, b] (vertex colours are linear). */
export function linear(hex: string): [number, number, number] {
  const c = new THREE.Color(hex)
  return [c.r, c.g, c.b]
}
