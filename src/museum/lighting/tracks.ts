/**
 * Track-light layout: ceiling-mounted 3000 K LED track, following the pavilion's geometry.
 * Spot heads snap onto the nearest rail so every accent light has a visible, physically
 * plausible fixture; where no rail is close enough a monopoint fixture is used.
 *
 * Rails (all at RAIL_Y, hung from the roof slab):
 *   rail-oculus  full circle round the oculus — lights the plinth and F's court face
 *   rail-ring    full circle over the gallery ring — the ring wall (A, B, C) and the podiums
 *                from ~30° off vertical
 *   rail-entry   arc over the entry ways, the annex mouth and the hallway — H's entrance
 *                face, the lobe walls, F's entry face and both hallway walls
 *   rail-annex   straight run down the middle of the entrance hall — both annex walls at 30°
 */
import { DEG, KEY, MUSEUM, type Vec3 } from '../config/museum'
import { PODIUM, PODIUM_SLOTS, SURFACES, ZONES, surfacePoint, type SurfaceId } from '../config/layout'
import { LIGHTING } from '../config/lighting'

const H = MUSEUM.pavilion.ceilingHeight
export const RAIL_Y = H - LIGHTING.track.railDrop

export type Rail =
  | { id: string; kind: 'line'; from: Vec3; to: Vec3 }
  /** Arc about (cx, cz) at height y, plan angles in radians (a0 < a1); a full circle has a1 − a0 = 2π. */
  | { id: string; kind: 'arc'; cx: number; cz: number; y: number; r: number; a0: number; a1: number }

const AIM = (LIGHTING.track.aimAngleDeg * Math.PI) / 180
const HEAD_DROP = 0.1
/** Ideal horizontal offset of a rail from the wall it lights (30° to the artwork centre). */
const IDEAL = (RAIL_Y - HEAD_DROP - MUSEUM.display.artworkCenterHeight) * Math.tan(AIM)

const circle = (id: string, r: number): Rail => ({ id, kind: 'arc', cx: 0, cz: 0, y: RAIL_Y, r, a0: 0, a1: Math.PI * 2 })

export const RAILS: Rail[] = [
  circle('rail-oculus', Math.max(MUSEUM.oculus.r + 1.0, MUSEUM.innerMainWall.r - IDEAL)),
  circle('rail-ring', KEY.ringR - IDEAL),
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
  const y = RAIL_Y - HEAD_DROP
  const ideal = (y - targetY) * Math.tan(AIM)
  const ix = x + nx * ideal
  const iz = z + nz * ideal
  let best: { p: Vec3; d: number } | null = null
  for (const r of RAILS) {
    const c = nearestOnRail(r, ix, iz)
    if (!best || c.d < best.d) best = c
  }
  if (best && best.d <= SNAP) return [best.p[0], y, best.p[2]]
  const zone = ZONES.find((zz) => zz.id === zoneId)
  // Outside: a small head tucked under the roof overhang, close to the facade.
  if (zone?.outdoor) return [x + nx * (MUSEUM.pavilion.roofOverhang - 0.1), H - 0.1, z + nz * (MUSEUM.pavilion.roofOverhang - 0.1)]
  // Generic monopoint under the zone's ceiling.
  const ceiling = Math.min(zone?.height ?? H, H) - 0.15
  const d = Math.min(2.4, Math.max(0.6, (ceiling - targetY) * Math.tan(AIM)))
  return [x + nx * d, ceiling, z + nz * d]
}

/** Where to mount the accent light for a point on a display surface. */
export function mountFor(surface: SurfaceId, at: number): Vec3 {
  const s = SURFACES[surface]
  const p = surfacePoint(surface, at, MUSEUM.display.artworkCenterHeight)
  return mountForPoint(p.position[0], p.position[2], s.normal[0], s.normal[1], s.zone)
}

/** Top accent light for a podium: on the ring rail in front of it, aimed at the podium top. */
export function mountForPodium(slotId: string): Vec3 {
  const slot = PODIUM_SLOTS.find((p) => p.id === slotId)
  if (!slot) return [0, RAIL_Y - HEAD_DROP, 0]
  // front of the podium faces the centre
  const nx = Math.sin(slot.rotationY)
  const nz = Math.cos(slot.rotationY)
  return mountForPoint(slot.x, slot.z, nx, nz, slot.zone, PODIUM.height + 0.15)
}
