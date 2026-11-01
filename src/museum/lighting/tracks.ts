/**
 * Track-light layout: 3000 K LED track following the pavilion's geometry (GRAND §6.2 #4).
 * Spot heads snap onto the nearest rail so every accent light has a visible, physically
 * plausible fixture; where no rail is close enough a monopoint fixture is used.
 *
 * Rails:
 *   rail-ring    under the duplex balcony's soffit (BALCONY_RAIL_Y), round A, B and C — the ring
 *                wall's lower zone at ~30° off vertical
 *   rail-entry   arc under the ambulatory's slab (RAIL_Y), over the entry ways, the annex mouth and
 *                the Wine Hall — H's entrance face, the lobe walls, F's corridor face, D's walls
 *   rail-annex   straight run down the middle of the Earth Room — both annex walls at 30°
 * The court under the dome has no rail: its few lights stand on the dome's springing ledge
 * (a long, high throw), so the dome keeps its calm planes. The podiums are lit by the brass wall
 * sconces of the p02 photo (config/accents.ts SCONCE), drawn by lighting/Fixtures.tsx.
 */
import { DEG, KEY, MUSEUM, polar, type Vec3 } from '../config/museum'
import { PODIUM_SLOTS, SURFACES, ZONES, surfacePoint, type SurfaceId } from '../config/layout'
import { LIGHTING, SCONCE } from '../config/lighting'

const H = MUSEUM.pavilion.ceilingHeight
export const RAIL_Y = H - LIGHTING.track.railDrop
/** The balcony's soffit rail over A, B and C. */
const SOFFIT_Y = MUSEUM.pavilion.mezzanineBand - MUSEUM.balcony.slab
export const BALCONY_RAIL_Y = SOFFIT_Y - 0.04
/** The dome's springing ledge (the court's lights stand on it), and its radius. */
const LEDGE = { y: MUSEUM.dome.springY - 0.25, r: KEY.ringR - 0.35 }

export type Rail =
  | { id: string; kind: 'line'; from: Vec3; to: Vec3 }
  /** Arc about (cx, cz) at height y, plan angles in radians (a0 < a1); a full circle has a1 − a0 = 2π. */
  | { id: string; kind: 'arc'; cx: number; cz: number; y: number; r: number; a0: number; a1: number }

const AIM = (LIGHTING.track.aimAngleDeg * Math.PI) / 180
const HEAD_DROP = 0.1

const BAL = MUSEUM.balcony

export const RAILS: Rail[] = [
  { id: 'rail-ring', kind: 'arc', cx: 0, cz: 0, y: BALCONY_RAIL_Y, r: BAL.r0 + 0.3, a0: BAL.fromDeg * DEG, a1: BAL.toDeg * DEG },
  {
    id: 'rail-entry',
    kind: 'arc',
    cx: 0,
    cz: 0,
    y: RAIL_Y,
    r: (MUSEUM.hallwayWall.r + MUSEUM.drum.r) / 2 - 0.3,
    a0: (MUSEUM.drum.neNotchDeg + 3) * DEG,
    a1: (MUSEUM.drum.dNotchDeg - 3) * DEG,
  },
  { id: 'rail-annex', kind: 'line', from: [0, RAIL_Y, KEY.annexMouthZ + 0.4], to: [0, RAIL_Y, MUSEUM.annex.endZ - 0.6] },
]

const railY = (r: Rail) => (r.kind === 'line' ? r.from[1] : r.y)

/** Height a head's stem rises to: the rail it hangs from, else a short monopoint stem. */
export function railAbove(x: number, z: number, y: number): number {
  let top = Infinity
  for (const r of RAILS) if (railY(r) > y && nearestOnRail(r, x, z).d < 0.12) top = Math.min(top, railY(r))
  return top === Infinity ? y + 0.14 : top
}

/** Points along a rail (for rendering it as a tube / polyline). `step` = max chord length (m). */
export function railPoints(rail: Rail, step = 0.5): Vec3[] {
  if (rail.kind === 'line') return [rail.from, rail.to]
  const n = Math.max(2, Math.ceil(((rail.a1 - rail.a0) * rail.r) / step))
  return Array.from({ length: n + 1 }, (_, i) => {
    const a = rail.a0 + ((rail.a1 - rail.a0) * i) / n
    return [rail.cx + rail.r * Math.cos(a), rail.y, rail.cz + rail.r * Math.sin(a)] as Vec3
  })
}

/** Nearest point on a rail to (x, z) in plan, and its distance. */
export function nearestOnRail(rail: Rail, x: number, z: number): { p: Vec3; d: number } {
  if (rail.kind === 'line') {
    const [ax, , az] = rail.from
    const [bx, , bz] = rail.to
    const dx = bx - ax
    const dz = bz - az
    const l2 = dx * dx + dz * dz
    const t = l2 > 0 ? Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2)) : 0
    const p: Vec3 = [ax + dx * t, rail.from[1], az + dz * t]
    return { p, d: Math.hypot(p[0] - x, p[2] - z) }
  }
  const TAU = Math.PI * 2
  let a = Math.atan2(z - rail.cz, x - rail.cx)
  const span = rail.a1 - rail.a0
  let t = (((a - rail.a0) % TAU) + TAU) % TAU
  if (t > span) {
    // outside the arc: clamp to the nearer end
    t = t - span < TAU - t ? span : 0
  }
  a = rail.a0 + t
  const p: Vec3 = [rail.cx + rail.r * Math.cos(a), rail.y, rail.cz + rail.r * Math.sin(a)]
  return { p, d: Math.hypot(p[0] - x, p[2] - z) }
}

/** How far (m) a head may sit from its ideal position before a monopoint is used instead. */
const SNAP = 1.6

/**
 * Where to mount an accent light that aims at (x, z) on a face with normal (nx, nz): ideally
 * ~30° off vertical in front of the face, on the nearest rail; else a monopoint under the
 * ceiling of `zoneId` (under the roof overhang outside).
 */
export function mountForPoint(x: number, z: number, nx: number, nz: number, zoneId?: string, targetY: number = MUSEUM.display.artworkCenterHeight): Vec3 {
  if (zoneId === 'inner') return ledgeMount(x, z, nx, nz)
  let best: { p: Vec3; d: number } | null = null
  for (const r of RAILS) {
    const y = railY(r) - HEAD_DROP
    const ideal = (y - targetY) * Math.tan(AIM)
    const c = nearestOnRail(r, x + nx * ideal, z + nz * ideal)
    if (!best || c.d < best.d) best = { p: [c.p[0], y, c.p[2]], d: c.d }
  }
  if (best && best.d <= SNAP) return best.p
  const zone = ZONES.find((zz) => zz.id === zoneId)
  // Outside: a small head tucked under the roof overhang, close to the facade.
  if (zone?.outdoor) return [x + nx * (MUSEUM.pavilion.roofOverhang - 0.1), H - 0.1, z + nz * (MUSEUM.pavilion.roofOverhang - 0.1)]
  // Generic monopoint under the zone's ceiling.
  const ceiling = Math.min(zone?.height ?? H, H) - 0.15
  const d = Math.min(2.4, Math.max(0.6, (ceiling - targetY) * Math.tan(AIM)))
  return [x + nx * d, ceiling, z + nz * d]
}

/** The court: where the face's normal (plan) meets the dome's springing ledge, across the court. */
function ledgeMount(x: number, z: number, nx: number, nz: number): Vec3 {
  const n = Math.hypot(nx, nz) || 1
  const dx = nx / n
  const dz = nz / n
  // |p + d t| = LEDGE.r, the positive root
  const b = x * dx + z * dz
  const c = x * x + z * z - LEDGE.r * LEDGE.r
  const t = -b + Math.sqrt(Math.max(0, b * b - c))
  return [x + dx * t, LEDGE.y, z + dz * t]
}

/** Where to mount the accent light for a point on a display surface. */
export function mountFor(surface: SurfaceId, at: number): Vec3 {
  const s = SURFACES[surface]
  const p = surfacePoint(surface, at, MUSEUM.display.artworkCenterHeight)
  return mountForPoint(p.position[0], p.position[2], s.normal[0], s.normal[1], s.zone)
}

/** The brass wall sconce over a podium (p02): on the ring wall behind it, aimed down at the piece. */
export function mountForPodium(slotId: string): Vec3 {
  const slot = PODIUM_SLOTS.find((p) => p.id === slotId)
  if (!slot) return [0, SCONCE.y, 0]
  const [x, z] = polar(KEY.ringR - SCONCE.setOff, slot.angleDeg)
  return [x, SCONCE.y, z]
}

/** Is this head one of the podium sconces (drawn by lighting/Fixtures.tsx, not as a track head)? */
const SCONCE_KEYS = new Set(PODIUM_SLOTS.map((p) => mountForPodium(p.id).map((v) => v.toFixed(2)).join(',')))
export const isSconceMount = (p: Vec3) => SCONCE_KEYS.has(p.map((v) => v.toFixed(2)).join(','))
