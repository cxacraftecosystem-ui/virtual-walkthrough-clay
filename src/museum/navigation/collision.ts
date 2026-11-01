/**
 * Lightweight 2D collision: the visitor is a circle on the floor plane; obstacles are
 * axis-aligned boxes, oriented boxes (straight walls, rotated furniture, podiums), arc bands
 * (the pavilion's curved walls) and discs. Robust, allocation-free in the hot path and far
 * cheaper than a physics engine.
 *
 * Every collider also carries its bounding box (minX…maxZ) for quick rejection and debugging.
 * `low` colliders (tables, benches, podiums, the oculus curb) stop the visitor but not the eye.
 */
import { BENCHES, BENCH_SIZE, PODIUM, PODIUM_SLOTS, WALLS } from '../config/layout'
import { EXHIBITS } from '../config/exhibits'
import { SCENE_OBJECTS } from '../config/objects'
import { VIDEOS } from '../config/videos'
import { obbFromRotation, tablePlacement, type Rect2 } from '../exhibits/placement'

interface Base extends Rect2 {
  id: string
  /** Below eye level: ignored by line-of-sight checks that pass `ignoreLow`. */
  low?: boolean
}

export type Collider =
  | (Base & { kind: 'aabb' })
  /** Oriented box: centre, unit axis u (local x), half extents along u and its normal v = (−uz, ux). */
  | (Base & { kind: 'obb'; cx: number; cz: number; ux: number; uz: number; hx: number; hz: number })
  /** Arc band: centreline radius r, half thickness `half`, angles a0 < a1 (radians, atan2(z, x)). */
  | (Base & { kind: 'arc'; cx: number; cz: number; r: number; half: number; a0: number; a1: number })
  | (Base & { kind: 'circle'; cx: number; cz: number; r: number })

const TAU = Math.PI * 2

function obb(id: string, cx: number, cz: number, ux: number, uz: number, hx: number, hz: number, low?: boolean): Collider {
  // bounding box of the rotated rectangle
  const ex = Math.abs(ux) * hx + Math.abs(uz) * hz
  const ez = Math.abs(uz) * hx + Math.abs(ux) * hz
  return { id, kind: 'obb', cx, cz, ux, uz, hx, hz, low, minX: cx - ex, maxX: cx + ex, minZ: cz - ez, maxZ: cz + ez }
}

function build(): Collider[] {
  const list: Collider[] = []
  for (const w of WALLS) {
    if (w.collide === false) continue
    const s = w.shape
    if (!s) {
      list.push({ id: w.id, kind: 'aabb', minX: w.min[0], maxX: w.max[0], minZ: w.min[2], maxZ: w.max[2] })
    } else if (s.kind === 'seg') {
      const len = Math.hypot(s.bx - s.ax, s.bz - s.az) || 1e-6
      list.push(obb(w.id, (s.ax + s.bx) / 2, (s.az + s.bz) / 2, (s.bx - s.ax) / len, (s.bz - s.az) / len, len / 2, s.thickness / 2))
    } else if ((w.kind === 'plinth' || w.kind === 'tower') && s.a1 - s.a0 >= TAU - 1e-9) {
      // a full plinth ring (or the Kiln Stair's round tower) is solid: nobody stands inside it
      list.push({ id: w.id, kind: 'circle', cx: s.cx, cz: s.cz, r: s.r + s.thickness / 2, low: w.max[1] < 1.2, minX: w.min[0], maxX: w.max[0], minZ: w.min[2], maxZ: w.max[2] })
    } else {
      const low = w.max[1] < 1.2
      list.push({ id: w.id, kind: 'arc', cx: s.cx, cz: s.cz, r: s.r, half: s.thickness / 2, a0: s.a0, a1: s.a1, low, minX: w.min[0], maxX: w.max[0], minZ: w.min[2], maxZ: w.max[2] })
    }
  }
  for (const b of BENCHES) {
    const alongX = b.along === 'x'
    list.push(obb(b.id, b.x, b.z, alongX ? 1 : 0, alongX ? 0 : 1, BENCH_SIZE.length / 2, BENCH_SIZE.depth / 2, true))
  }
  // The pavilion's podiums are architecture: always present, whatever stands on them.
  for (const p of PODIUM_SLOTS) {
    const o = obbFromRotation(p.x, p.z, p.rotationY, PODIUM.size / 2, PODIUM.size / 2)
    list.push(obb(`podium-${p.id}`, o.cx, o.cz, o.ux, o.uz, o.hx, o.hz, true))
  }
  for (const e of EXHIBITS) {
    const t = tablePlacement(e).obb
    list.push(obb(`table-${e.id}`, t.cx, t.cz, t.ux, t.uz, t.hx, t.hz, true))
  }
  for (const o of SCENE_OBJECTS) {
    if (!o.footprint) continue
    const [x, , z] = o.position
    const f = obbFromRotation(x, z, ((o.rotationDeg ?? 0) * Math.PI) / 180, o.footprint[0] / 2, o.footprint[1] / 2)
    list.push(obb(`object-${o.id}`, f.cx, f.cz, f.ux, f.uz, f.hx, f.hz, o.height !== undefined && o.height < 1.2))
  }
  // free-standing screens ("Meet the maker" portrait stands): their weighted base
  for (const v of VIDEOS) {
    if (!v.stand) continue
    list.push(obb(`video-stand-${v.id}`, v.stand.x, v.stand.z, 1, 0, 0.22, 0.22))
  }
  return list
}

export const COLLIDERS: Collider[] = build()

/** Line-of-sight filter: skip colliders below eye level (tables, benches, podiums, the oculus curb). */
export const ignoreLow = (c: Collider | { id: string; low?: boolean }) => !!c.low || c.id.startsWith('table-') || c.id.startsWith('bench')

/* ------------------------------------------------------------------ */
/* Closest point                                                       */
/* ------------------------------------------------------------------ */

const hit = { x: 0, z: 0, inside: false }

function inArc(a: number, a0: number, a1: number) {
  const t = (((a - a0) % TAU) + TAU) % TAU
  return t <= a1 - a0 || a1 - a0 >= TAU - 1e-9
}

/** Closest point of segment a→b to p, written to `o`. */
function closestOnSeg(ax: number, az: number, bx: number, bz: number, px: number, pz: number, o: { x: number; z: number }) {
  const dx = bx - ax
  const dz = bz - az
  const l2 = dx * dx + dz * dz
  const t = l2 > 0 ? Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / l2)) : 0
  o.x = ax + dx * t
  o.z = az + dz * t
  return o
}

const tmpA = { x: 0, z: 0 }
const tmpB = { x: 0, z: 0 }

/**
 * Closest point of collider `c` to (px, pz). When the point is inside, `hit.inside` is true and
 * the returned point is the nearest point on the boundary (the way out).
 */
function closest(c: Collider, px: number, pz: number) {
  hit.inside = false
  switch (c.kind) {
    case 'aabb': {
      const x = Math.max(c.minX, Math.min(px, c.maxX))
      const z = Math.max(c.minZ, Math.min(pz, c.maxZ))
      if (x === px && z === pz) {
        hit.inside = true
        const l = px - c.minX
        const r = c.maxX - px
        const b = pz - c.minZ
        const t = c.maxZ - pz
        const m = Math.min(l, r, b, t)
        hit.x = px
        hit.z = pz
        if (m === l) hit.x = c.minX
        else if (m === r) hit.x = c.maxX
        else if (m === b) hit.z = c.minZ
        else hit.z = c.maxZ
        return hit
      }
      hit.x = x
      hit.z = z
      return hit
    }
    case 'obb': {
      const dx = px - c.cx
      const dz = pz - c.cz
      const lu = dx * c.ux + dz * c.uz
      const lv = -dx * c.uz + dz * c.ux
      let u = Math.max(-c.hx, Math.min(lu, c.hx))
      let v = Math.max(-c.hz, Math.min(lv, c.hz))
      if (u === lu && v === lv) {
        hit.inside = true
        if (c.hx - Math.abs(lu) < c.hz - Math.abs(lv)) u = lu < 0 ? -c.hx : c.hx
        else v = lv < 0 ? -c.hz : c.hz
      }
      hit.x = c.cx + u * c.ux - v * c.uz
      hit.z = c.cz + u * c.uz + v * c.ux
      return hit
    }
    case 'circle': {
      const dx = px - c.cx
      const dz = pz - c.cz
      const d = Math.hypot(dx, dz)
      hit.inside = d < c.r
      if (d < 1e-9) {
        hit.x = c.cx + c.r
        hit.z = c.cz
      } else {
        hit.x = c.cx + (dx / d) * c.r
        hit.z = c.cz + (dz / d) * c.r
      }
      return hit
    }
    case 'arc': {
      const dx = px - c.cx
      const dz = pz - c.cz
      const d = Math.hypot(dx, dz)
      const a = Math.atan2(dz, dx)
      const r0 = c.r - c.half
      const r1 = c.r + c.half
      if (inArc(a, c.a0, c.a1) && d > 1e-9) {
        if (d >= r0 && d <= r1) {
          hit.inside = true
          // nearest way out: inner face, outer face or along the arc to an end cap
          let best = d - r0
          let rr = r0
          if (r1 - d < best) {
            best = r1 - d
            rr = r1
          }
          const full = c.a1 - c.a0 >= TAU - 1e-9
          const t = (((a - c.a0) % TAU) + TAU) % TAU
          const toStart = t * d
          const toEnd = (c.a1 - c.a0 - t) * d
          if (!full && Math.min(toStart, toEnd) < best) {
            const e = toStart < toEnd ? c.a0 : c.a1
            closestOnSeg(c.cx + r0 * Math.cos(e), c.cz + r0 * Math.sin(e), c.cx + r1 * Math.cos(e), c.cz + r1 * Math.sin(e), px, pz, tmpA)
            hit.x = tmpA.x
            hit.z = tmpA.z
            return hit
          }
          hit.x = c.cx + (dx / d) * rr
          hit.z = c.cz + (dz / d) * rr
          return hit
        }
        const rr = d < r0 ? r0 : r1
        hit.x = c.cx + (dx / d) * rr
        hit.z = c.cz + (dz / d) * rr
        return hit
      }
      // outside the angular range: nearest end cap
      const c0 = Math.cos(c.a0)
      const s0 = Math.sin(c.a0)
      const c1 = Math.cos(c.a1)
      const s1 = Math.sin(c.a1)
      closestOnSeg(c.cx + r0 * c0, c.cz + r0 * s0, c.cx + r1 * c0, c.cz + r1 * s0, px, pz, tmpA)
      closestOnSeg(c.cx + r0 * c1, c.cz + r0 * s1, c.cx + r1 * c1, c.cz + r1 * s1, px, pz, tmpB)
      const useA = (tmpA.x - px) ** 2 + (tmpA.z - pz) ** 2 <= (tmpB.x - px) ** 2 + (tmpB.z - pz) ** 2
      hit.x = useA ? tmpA.x : tmpB.x
      hit.z = useA ? tmpA.z : tmpB.z
      return hit
    }
  }
}

/** Distance from a point to a collider (0 inside). */
export function pointDistance(c: Collider, px: number, pz: number) {
  const h = closest(c, px, pz)
  return h.inside ? 0 : Math.hypot(h.x - px, h.z - pz)
}

/* ------------------------------------------------------------------ */
/* Visitor push-out                                                    */
/* ------------------------------------------------------------------ */

/** Push a circle out of all colliders. Mutates and returns `out`. */
export function resolveCircle(x: number, z: number, radius: number, out = { x: 0, z: 0 }) {
  let px = x
  let pz = z
  for (let iter = 0; iter < 4; iter++) {
    let moved = false
    for (const c of COLLIDERS) {
      if (px < c.minX - radius || px > c.maxX + radius || pz < c.minZ - radius || pz > c.maxZ + radius) continue
      const h = closest(c, px, pz)
      const dx = px - h.x
      const dz = pz - h.z
      const d = Math.hypot(dx, dz)
      if (h.inside) {
        // Centre inside the solid: exit through the nearest boundary point, then clear it.
        if (d > 1e-9) {
          px = h.x - (dx / d) * radius
          pz = h.z - (dz / d) * radius
        } else {
          px = h.x
          pz = h.z
        }
        moved = true
        continue
      }
      if (d >= radius) continue
      if (d > 1e-10) {
        const push = radius - d
        px += (dx / d) * push
        pz += (dz / d) * push
        moved = true
      }
    }
    if (!moved) break
  }
  out.x = px
  out.z = pz
  return out
}

/* ------------------------------------------------------------------ */
/* Segments                                                            */
/* ------------------------------------------------------------------ */

/** Liang–Barsky: does segment p0 + t·d (t ∈ [0, 1]) enter the box [−hx, hx] × [−hz, hz]? */
function clipBox(x0: number, z0: number, dx: number, dz: number, minX: number, maxX: number, minZ: number, maxZ: number) {
  let t0 = 0
  let t1 = 1
  const p0 = -dx
  const p1 = dx
  const p2 = -dz
  const p3 = dz
  const q0 = x0 - minX
  const q1 = maxX - x0
  const q2 = z0 - minZ
  const q3 = maxZ - z0
  const ps = [p0, p1, p2, p3]
  const qs = [q0, q1, q2, q3]
  for (let i = 0; i < 4; i++) {
    const p = ps[i]
    const q = qs[i]
    if (p === 0) {
      if (q < 0) return false
    } else {
      const t = q / p
      if (p < 0) t0 = Math.max(t0, t)
      else t1 = Math.min(t1, t)
      if (t0 > t1) return false
    }
  }
  return true
}

/** Do segments p1–p2 and p3–p4 intersect (including touching)? */
function segsCross(x1: number, z1: number, x2: number, z2: number, x3: number, z3: number, x4: number, z4: number) {
  const d1x = x2 - x1
  const d1z = z2 - z1
  const d2x = x4 - x3
  const d2z = z4 - z3
  const den = d1x * d2z - d1z * d2x
  if (Math.abs(den) < 1e-12) return false
  const t = ((x3 - x1) * d2z - (z3 - z1) * d2x) / den
  const u = ((x3 - x1) * d1z - (z3 - z1) * d1x) / den
  return t >= 0 && t <= 1 && u >= 0 && u <= 1
}

function segSegDist(x1: number, z1: number, x2: number, z2: number, x3: number, z3: number, x4: number, z4: number) {
  if (segsCross(x1, z1, x2, z2, x3, z3, x4, z4)) return 0
  const o = tmpA
  let best = Infinity
  closestOnSeg(x3, z3, x4, z4, x1, z1, o)
  best = Math.min(best, Math.hypot(o.x - x1, o.z - z1))
  closestOnSeg(x3, z3, x4, z4, x2, z2, o)
  best = Math.min(best, Math.hypot(o.x - x2, o.z - z2))
  closestOnSeg(x1, z1, x2, z2, x3, z3, o)
  best = Math.min(best, Math.hypot(o.x - x3, o.z - z3))
  closestOnSeg(x1, z1, x2, z2, x4, z4, o)
  best = Math.min(best, Math.hypot(o.x - x4, o.z - z4))
  return best
}

/** Does the segment cross the circle of radius rr about (cx, cz) at an angle inside the arc? */
function crossesArc(c: { cx: number; cz: number; a0: number; a1: number }, rr: number, ax: number, az: number, dx: number, dz: number) {
  const fx = ax - c.cx
  const fz = az - c.cz
  const A = dx * dx + dz * dz
  if (A < 1e-12) return false
  const B = 2 * (fx * dx + fz * dz)
  const C = fx * fx + fz * fz - rr * rr
  const disc = B * B - 4 * A * C
  if (disc < 0) return false
  const sq = Math.sqrt(disc)
  for (const t of [(-B - sq) / (2 * A), (-B + sq) / (2 * A)]) {
    if (t < 0 || t > 1) continue
    if (inArc(Math.atan2(fz + dz * t, fx + dx * t), c.a0, c.a1)) return true
  }
  return false
}

/**
 * Distance from segment a→b to collider `c` (0 when they touch or overlap). Exact for every
 * collider kind; used by line of sight (=== 0) and path planning (≥ clearance).
 */
export function segmentDistance(c: Collider, ax: number, az: number, bx: number, bz: number): number {
  const dx = bx - ax
  const dz = bz - az
  switch (c.kind) {
    case 'aabb':
    case 'obb': {
      // work in the box's frame
      let x0 = ax
      let z0 = az
      let ex = dx
      let ez = dz
      let hx: number
      let hz: number
      if (c.kind === 'aabb') {
        hx = (c.maxX - c.minX) / 2
        hz = (c.maxZ - c.minZ) / 2
        x0 -= (c.minX + c.maxX) / 2
        z0 -= (c.minZ + c.maxZ) / 2
      } else {
        hx = c.hx
        hz = c.hz
        const rx = ax - c.cx
        const rz = az - c.cz
        x0 = rx * c.ux + rz * c.uz
        z0 = -rx * c.uz + rz * c.ux
        ex = dx * c.ux + dz * c.uz
        ez = -dx * c.uz + dz * c.ux
      }
      if (clipBox(x0, z0, ex, ez, -hx, hx, -hz, hz)) return 0
      const x1 = x0 + ex
      const z1 = z0 + ez
      const boxDist = (px: number, pz: number) => Math.hypot(Math.max(Math.abs(px) - hx, 0), Math.max(Math.abs(pz) - hz, 0))
      let best = Math.min(boxDist(x0, z0), boxDist(x1, z1))
      for (const [cx, cz] of [
        [-hx, -hz],
        [hx, -hz],
        [hx, hz],
        [-hx, hz],
      ]) {
        closestOnSeg(x0, z0, x1, z1, cx, cz, tmpB)
        best = Math.min(best, Math.hypot(tmpB.x - cx, tmpB.z - cz))
      }
      return best
    }
    case 'circle': {
      closestOnSeg(ax, az, bx, bz, c.cx, c.cz, tmpB)
      return Math.max(0, Math.hypot(tmpB.x - c.cx, tmpB.z - c.cz) - c.r)
    }
    case 'arc': {
      const r0 = c.r - c.half
      const r1 = c.r + c.half
      const da = pointDistance(c, ax, az)
      const db = pointDistance(c, bx, bz)
      if (da === 0 || db === 0) return 0
      if (crossesArc(c, r0, ax, az, dx, dz) || crossesArc(c, r1, ax, az, dx, dz)) return 0
      let best = Math.min(da, db)
      const full = c.a1 - c.a0 >= TAU - 1e-9
      if (!full) {
        for (const e of [c.a0, c.a1]) {
          const ce = Math.cos(e)
          const se = Math.sin(e)
          best = Math.min(best, segSegDist(ax, az, bx, bz, c.cx + r0 * ce, c.cz + r0 * se, c.cx + r1 * ce, c.cz + r1 * se))
          if (best === 0) return 0
        }
      }
      // nearest approach to the outer face happens at the foot of the centre on the segment
      closestOnSeg(ax, az, bx, bz, c.cx, c.cz, tmpB)
      best = Math.min(best, pointDistance(c, tmpB.x, tmpB.z))
      return best
    }
  }
}

/** True if the straight segment a→b crosses any collider (used for line-of-sight checks). */
export function segmentBlocked(ax: number, az: number, bx: number, bz: number, ignore?: (c: Collider) => boolean) {
  const minX = Math.min(ax, bx)
  const maxX = Math.max(ax, bx)
  const minZ = Math.min(az, bz)
  const maxZ = Math.max(az, bz)
  for (const c of COLLIDERS) {
    if (maxX < c.minX || minX > c.maxX || maxZ < c.minZ || minZ > c.maxZ) continue
    if (ignore?.(c)) continue
    if (segmentDistance(c, ax, az, bx, bz) <= 1e-9) return true
  }
  return false
}
