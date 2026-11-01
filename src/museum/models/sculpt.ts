/**
 * SCULPT KIT — smooth, hand-modelled forms for the craft models (Kumartuli figure, Majuli masks,
 * Ayyanar guardians, Molela plaques): what kit.tsx's primitives cannot give, one continuous skin
 * instead of stacked capsules and cylinders.
 *
 *   noise3 / fbm      smooth value noise (deterministic) for hand-pressed clay, straw, wear
 *   Loft              a skin swept along a spine with a varying elliptical section, an optional
 *                     per-angle shape, displacement, angular range (open cloth) and ragged clip
 *   heightField       a relief over a 2D outline (a mask's face, a plaque's figures)
 *   sculptEllipsoid   an ellipsoid with a radial displacement (heads, eyes, bun, beads)
 *   weldNormals       averages normals across UV seams so no seam shows in the shading
 *
 * All geometry carries METRE UVs (1 uv = 1 m) so the shared tiling PBR maps (plaster normal and
 * roughness on terracotta, linen on straw and rope) read at true scale, like kit.tsx.
 */
import * as THREE from 'three'

/* ------------------------------------------------------------------ */
/* Detail (GRAND §10 triangle budgets)                                 */
/* ------------------------------------------------------------------ */

let detail = 1

/**
 * The tessellation factor for the quality tier: surfaces scale their rows and columns (rings,
 * segments) by it, so the triangle count goes roughly with its square. A sculpted craft at full
 * detail is ~60–100k triangles; the tiers keep the forms and drop the facets.
 */
export function sculptDetailFor(tier: string): number {
  return ({ low: 0.4, medium: 0.55, high: 0.7 } as Record<string, number>)[tier] ?? 1
}

/** Build with a tessellation factor (cache the result under it: see sculptDetailFor). */
export function withSculptDetail<T>(d: number, build: () => T): T {
  const prev = detail
  detail = d
  try {
    return build()
  } finally {
    detail = prev
  }
}

/** A resolution scaled by the current detail, never under `min`. */
export function res(n: number, min = 3): number {
  return Math.max(min, Math.round(n * detail))
}

/* ------------------------------------------------------------------ */
/* Noise                                                               */
/* ------------------------------------------------------------------ */

function hash3(x: number, y: number, z: number) {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(z, 2147483647)) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  h ^= h >>> 16
  return ((h >>> 0) / 4294967295) * 2 - 1
}

/** Smooth 3D value noise in [-1, 1]. */
export function noise3(x: number, y: number, z: number) {
  const xi = Math.floor(x)
  const yi = Math.floor(y)
  const zi = Math.floor(z)
  const xf = x - xi
  const yf = y - yi
  const zf = z - zi
  const u = xf * xf * (3 - 2 * xf)
  const v = yf * yf * (3 - 2 * yf)
  const w = zf * zf * (3 - 2 * zf)
  const l = (a: number, b: number, t: number) => a + (b - a) * t
  const c = (dx: number, dy: number, dz: number) => hash3(xi + dx, yi + dy, zi + dz)
  return l(l(l(c(0, 0, 0), c(1, 0, 0), u), l(c(0, 1, 0), c(1, 1, 0), u), v), l(l(c(0, 0, 1), c(1, 0, 1), u), l(c(0, 1, 1), c(1, 1, 1), u), v), w)
}

/** Fractal noise: `oct` octaves of noise3, roughly in [-1, 1]. */
export function fbm(x: number, y: number, z: number, oct = 3) {
  let s = 0
  let a = 0.5
  let f = 1
  let n = 0
  for (let i = 0; i < oct; i++) {
    s += a * noise3(x * f, y * f, z * f)
    n += a
    a *= 0.5
    f *= 2.03
  }
  return s / n
}

/* ------------------------------------------------------------------ */
/* Normals                                                             */
/* ------------------------------------------------------------------ */

/** Recomputes normals, then averages them over vertices that share a position (UV seams, poles). */
export function weldNormals(g: THREE.BufferGeometry, eps = 1e-5) {
  g.computeVertexNormals()
  const pos = g.getAttribute('position')
  const nor = g.getAttribute('normal')
  const map = new Map<string, number[]>()
  const q = 1 / eps
  for (let i = 0; i < pos.count; i++) {
    const key = `${Math.round(pos.getX(i) * q)}|${Math.round(pos.getY(i) * q)}|${Math.round(pos.getZ(i) * q)}`
    const l = map.get(key)
    if (l) l.push(i)
    else map.set(key, [i])
  }
  const n = new THREE.Vector3()
  for (const l of map.values()) {
    if (l.length < 2) continue
    n.set(0, 0, 0)
    for (const i of l) n.x += nor.getX(i)
    for (const i of l) n.y += nor.getY(i)
    for (const i of l) n.z += nor.getZ(i)
    n.normalize()
    for (const i of l) nor.setXYZ(i, n.x, n.y, n.z)
  }
  nor.needsUpdate = true
  return g
}

/** Flips a geometry's winding (an inside face), keeping its normals pointing the new way. */
export function flipWinding(g: THREE.BufferGeometry) {
  const idx = g.getIndex()
  if (idx) {
    for (let i = 0; i < idx.count; i += 3) {
      const a = idx.getX(i)
      idx.setX(i, idx.getX(i + 2))
      idx.setX(i + 2, a)
    }
    idx.needsUpdate = true
  }
  const nor = g.getAttribute('normal')
  if (nor) for (let i = 0; i < nor.count; i++) nor.setXYZ(i, -nor.getX(i), -nor.getY(i), -nor.getZ(i))
  return g
}

/* ------------------------------------------------------------------ */
/* Loft                                                                */
/* ------------------------------------------------------------------ */

export interface LoftSkin {
  /** Rows along the spine. */
  rows?: number
  /** Columns round the section. */
  cols?: number
  /** Part of the spine (0..1). */
  t0?: number
  t1?: number
  /** Angular range (radians, a = 0 on the frame's "up", +π/2 on its side) — an open skin when not a full turn. */
  arange?: (t: number) => [number, number]
  /** Extra outward offset (m) along the section's radius (a coat over the body, cloth over it). */
  offset?: number
  /** Displacement (m) along the surface normal at (t, a, world point). */
  displace?: (t: number, a: number, p: THREE.Vector3) => number
  /** Drop the quad at (t, a): a ragged edge to a coat. */
  keep?: (t: number, a: number, p: THREE.Vector3) => boolean
  /** Close the ends with a rounded fan (full turns only). */
  capStart?: boolean
  capEnd?: boolean
  /** Per-vertex colour. */
  color?: (t: number, a: number, p: THREE.Vector3) => THREE.Color
}

/**
 * A skin swept along a spine. The section at arc-length parameter t is an ellipse of half
 * extents `section(t) = [up, side]` in the frame (T, N up, B side) set by a reference side
 * vector, times `shape(t, a)`. Sections may be keyed on the spine's control points (`keyed`).
 */
export class Loft {
  readonly spine: THREE.Curve<THREE.Vector3>
  private side: THREE.Vector3
  private sectionFn: (t: number) => [number, number]
  private shapeFn: (t: number, a: number) => number
  private L: number

  constructor(spine: THREE.Curve<THREE.Vector3>, section: (t: number) => [number, number], opts: { side?: THREE.Vector3; shape?: (t: number, a: number) => number } = {}) {
    this.spine = spine
    this.side = (opts.side ?? new THREE.Vector3(1, 0, 0)).clone().normalize()
    this.sectionFn = section
    this.shapeFn = opts.shape ?? (() => 1)
    this.L = spine.getLength()
  }

  get length() {
    return this.L
  }

  /** The frame at t: point, tangent, up (N) and side (B). */
  frame(t: number) {
    const p = this.spine.getPointAt(THREE.MathUtils.clamp(t, 0, 1))
    const T = this.spine.getTangentAt(THREE.MathUtils.clamp(t, 0, 1)).normalize()
    const B = this.side.clone().addScaledVector(T, -this.side.dot(T))
    if (B.lengthSq() < 1e-8) B.set(0, 0, 1).addScaledVector(T, -T.z)
    B.normalize()
    const N = new THREE.Vector3().crossVectors(T, B).normalize()
    return { p, T, N, B }
  }

  section(t: number) {
    return this.sectionFn(THREE.MathUtils.clamp(t, 0, 1))
  }

  /** The surface point at (t, a), pushed out by `off` metres. */
  point(t: number, a: number, off = 0) {
    const { p, N, B } = this.frame(t)
    const [ru, rs] = this.section(t)
    const m = this.shapeFn(t, a)
    const c = Math.cos(a)
    const s = Math.sin(a)
    return p.addScaledVector(N, c * (ru * m + off)).addScaledVector(B, s * (rs * m + off))
  }

  /** The outward direction at (t, a) (approximate normal of the ellipse). */
  outward(t: number, a: number) {
    const { N, B } = this.frame(t)
    const [ru, rs] = this.section(t)
    return N.multiplyScalar(Math.cos(a) / Math.max(1e-4, ru)).addScaledVector(B, Math.sin(a) / Math.max(1e-4, rs)).normalize()
  }

  /** A closed ring round the section at t (a band, a garland's path, a twine lashing). */
  ring(t: number, off = 0, n = 48, sag?: (a: number) => number): THREE.CatmullRomCurve3 {
    const pts: THREE.Vector3[] = []
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2
      const q = this.point(t, a, off)
      if (sag) q.y -= sag(a)
      pts.push(q)
    }
    return new THREE.CatmullRomCurve3(pts, true, 'centripetal')
  }

  /** The skin's geometry. */
  geometry(o: LoftSkin = {}): THREE.BufferGeometry {
    const rows = res(o.rows ?? 64, 4)
    const cols = res(o.cols ?? 32, 6)
    const t0 = o.t0 ?? 0
    const t1 = o.t1 ?? 1
    const full = !o.arange
    const off = o.offset ?? 0
    const pos: number[] = []
    const uv: number[] = []
    const col: number[] = []
    const ts: number[] = []
    const as: number[] = []
    const P: THREE.Vector3[] = []
    // v = arc length along the spine; u = arc length round the section
    for (let j = 0; j <= rows; j++) {
      const t = t0 + ((t1 - t0) * j) / rows
      const [a0, a1] = o.arange ? o.arange(t) : [0, Math.PI * 2]
      const { p, N, B } = this.frame(t)
      const [ru, rs] = this.section(t)
      const circ = (Math.abs(a1 - a0) * (ru + rs + 2 * off)) / 2
      for (let i = 0; i <= cols; i++) {
        const a = a0 + ((a1 - a0) * i) / cols
        const m = this.shapeFn(t, a)
        const c = Math.cos(a)
        const s = Math.sin(a)
        const q = p.clone().addScaledVector(N, c * (ru * m + off)).addScaledVector(B, s * (rs * m + off))
        P.push(q)
        ts.push(t)
        as.push(a)
        pos.push(q.x, q.y, q.z)
        uv.push((circ * i) / cols, t * this.L)
        if (o.color) {
          const cc = o.color(t, a, q)
          col.push(cc.r, cc.g, cc.b)
        }
      }
    }
    const W = cols + 1
    const idx: number[] = []
    for (let j = 0; j < rows; j++)
      for (let i = 0; i < cols; i++) {
        const a = j * W + i
        const b = a + W
        if (o.keep) {
          const k = a + 1 + W
          const mid = P[a].clone().add(P[k]).multiplyScalar(0.5)
          if (!o.keep((ts[a] + ts[k]) / 2, (as[a] + as[k]) / 2, mid)) continue
        }
        idx.push(a, b, a + 1, a + 1, b, b + 1)
      }
    // rounded caps: a fan to a point a little past each end
    const cap = (j: number, dir: -1 | 1) => {
      const t = t0 + ((t1 - t0) * j) / rows
      const { p, T } = this.frame(t)
      const [ru, rs] = this.section(t)
      const tip = p.addScaledVector(T, dir * Math.min(ru, rs) * 0.45)
      const ci = pos.length / 3
      pos.push(tip.x, tip.y, tip.z)
      uv.push(0, t * this.L + dir * 0.01)
      if (o.color) {
        const cc = o.color(t, 0, tip)
        col.push(cc.r, cc.g, cc.b)
      }
      for (let i = 0; i < cols; i++) {
        const a = j * W + i
        if (dir < 0) idx.push(ci, a, a + 1)
        else idx.push(ci, a + 1, a)
      }
    }
    if (full && o.capStart) cap(0, -1)
    if (full && o.capEnd) cap(rows, 1)
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
    if (o.color) g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
    g.setIndex(idx)
    weldNormals(g)
    if (o.displace) {
      const nor = g.getAttribute('normal')
      const pa = g.getAttribute('position')
      const q = new THREE.Vector3()
      for (let i = 0; i < ts.length; i++) {
        q.set(pa.getX(i), pa.getY(i), pa.getZ(i))
        const d = o.displace(ts[i], as[i], q)
        pa.setXYZ(i, q.x + nor.getX(i) * d, q.y + nor.getY(i) * d, q.z + nor.getZ(i) * d)
      }
      weldNormals(g)
    }
    if (!full) {
      // an open skin is seen from both sides: the caller gives it a double-sided material
    }
    return g
  }
}

/**
 * A spine through `pts` whose section is keyed on those points: `sections[i]` is [up, side] at
 * pts[i], eased between them along the curve's arc length.
 */
export function keyedLoft(pts: THREE.Vector3[], sections: [number, number][], opts: { side?: THREE.Vector3; shape?: (t: number, a: number) => number; tension?: number } = {}) {
  const spine = new THREE.CatmullRomCurve3(pts, false, 'centripetal')
  // the arc-length t of each control point: the nearest of many samples
  const N = 600
  const samples = spine.getSpacedPoints(N)
  const keys = pts.map((p) => {
    let best = 0
    let bd = Infinity
    for (let i = 0; i <= N; i++) {
      const d = samples[i].distanceToSquared(p)
      if (d < bd) {
        bd = d
        best = i
      }
    }
    return best / N
  })
  const section = (t: number): [number, number] => {
    if (t <= keys[0]) return sections[0]
    for (let i = 0; i < keys.length - 1; i++)
      if (t <= keys[i + 1]) {
        const f = (t - keys[i]) / Math.max(1e-6, keys[i + 1] - keys[i])
        const e = f * f * (3 - 2 * f)
        return [sections[i][0] + (sections[i + 1][0] - sections[i][0]) * e, sections[i][1] + (sections[i + 1][1] - sections[i][1]) * e]
      }
    return sections[sections.length - 1]
  }
  const loft = new Loft(spine, section, opts)
  return { loft, keys }
}

/* ------------------------------------------------------------------ */
/* Height field over an outline                                        */
/* ------------------------------------------------------------------ */

/**
 * A relief z = h(x, y) over a polar grid filling the ellipse (rx, ry) — a mask's face, the face of
 * a round-headed plaque — with `uv` either planar 0..1 over the ellipse ('unit', for a painted
 * canvas) or metre ('metre'). `outline(a)` (0..1) narrows the ellipse per angle (a chin, an arch).
 */
export function heightField(
  rx: number,
  ry: number,
  h: (x: number, y: number, r: number) => number,
  o: { rings?: number; segs?: number; uv?: 'unit' | 'metre'; outline?: (a: number) => number; color?: (x: number, y: number) => THREE.Color } = {},
) {
  const rings = res(o.rings ?? 48, 6)
  const segs = res(o.segs ?? 96, 12)
  const pos: number[] = []
  const uv: number[] = []
  const col: number[] = []
  const push = (x: number, y: number, r: number) => {
    pos.push(x, y, h(x, y, r))
    if (o.uv === 'metre') uv.push(x, y)
    else uv.push(0.5 + x / (2 * rx), 0.5 + y / (2 * ry))
    if (o.color) {
      const c = o.color(x, y)
      col.push(c.r, c.g, c.b)
    }
  }
  push(0, 0, 0)
  for (let j = 1; j <= rings; j++) {
    // denser towards the rim, where the form turns
    const f = j / rings
    const r = 1 - (1 - f) * (1 - f) * 0.35 - (1 - f) * 0.65
    for (let i = 0; i < segs; i++) {
      const a = (i / segs) * Math.PI * 2
      const k = o.outline ? o.outline(a) : 1
      push(Math.cos(a) * rx * r * k, Math.sin(a) * ry * r * k, r)
    }
  }
  const idx: number[] = []
  for (let i = 0; i < segs; i++) idx.push(0, 1 + i, 1 + ((i + 1) % segs))
  for (let j = 1; j < rings; j++)
    for (let i = 0; i < segs; i++) {
      const a = 1 + (j - 1) * segs + i
      const b = 1 + (j - 1) * segs + ((i + 1) % segs)
      const c = a + segs
      const d = b + segs
      idx.push(a, c, b, b, c, d)
    }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  if (o.color) g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

/* ------------------------------------------------------------------ */
/* Sculpted ellipsoid                                                  */
/* ------------------------------------------------------------------ */

/** An ellipsoid (rx, ry, rz) pushed out by `disp(dir)` metres along its radius, metre UVs. */
export function sculptEllipsoid(rx: number, ry: number, rz: number, disp?: (d: THREE.Vector3) => number, w = 32, h = 20) {
  const g = new THREE.SphereGeometry(1, res(w, 6), res(h, 4))
  const pos = g.getAttribute('position')
  const uv = g.getAttribute('uv')
  const d = new THREE.Vector3()
  const circ = Math.PI * (rx + rz)
  for (let i = 0; i < pos.count; i++) {
    d.set(pos.getX(i), pos.getY(i), pos.getZ(i))
    const k = disp ? disp(d) : 0
    const len = Math.max(1e-6, Math.hypot(d.x * rx, d.y * ry, d.z * rz))
    // push along the scaled radius
    const sx = d.x * rx
    const sy = d.y * ry
    const sz = d.z * rz
    pos.setXYZ(i, sx + (sx / len) * k, sy + (sy / len) * k, sz + (sz / len) * k)
    uv.setXY(i, uv.getX(i) * circ, uv.getY(i) * Math.PI * ry)
  }
  return weldNormals(g)
}

/* ------------------------------------------------------------------ */
/* Small helpers                                                       */
/* ------------------------------------------------------------------ */

/** Smooth bump: 1 at the centre, 0 beyond radius 1 (in already-scaled units). */
export function bump(d2: number) {
  return d2 >= 1 ? 0 : (1 - d2) * (1 - d2)
}

/** Gaussian of an elliptical distance. */
export function gauss(x: number, y: number, cx: number, cy: number, sx: number, sy: number) {
  const dx = (x - cx) / sx
  const dy = (y - cy) / sy
  return Math.exp(-(dx * dx + dy * dy))
}

/** Smooth maximum (rounded union of reliefs). */
export function smax(a: number, b: number, k: number) {
  const h = Math.max(k - Math.abs(a - b), 0) / k
  return Math.max(a, b) + h * h * k * 0.25
}

/** Aligns +y to the direction a → b: [position (mid), euler, length]. */
export function between(a: THREE.Vector3, b: THREE.Vector3): { p: [number, number, number]; r: [number, number, number]; len: number } {
  const d = b.clone().sub(a)
  const len = d.length()
  const e = new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()))
  const m = a.clone().add(b).multiplyScalar(0.5)
  return { p: [m.x, m.y, m.z], r: [e.x, e.y, e.z], len }
}
