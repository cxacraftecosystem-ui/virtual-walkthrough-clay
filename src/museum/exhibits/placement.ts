/** Shared placement math for tables/exhibits — used by both rendering and collision. */
import { DISPLAY_TABLE, type ExhibitConfig } from '../config/exhibits'
import { PODIUM, PODIUM_SLOTS, surfacePoint, type PodiumSlot } from '../config/layout'

export interface Rect2 {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
}

/** Oriented rectangle on the floor: centre, unit axis u (local x), half extents along u and v = (−uz, ux). */
export interface Obb2 {
  cx: number
  cz: number
  ux: number
  uz: number
  hx: number
  hz: number
}

/**
 * Footprint of an object rotated by `rotationY` (three.js, about +y): local +x maps to
 * (cos θ, −sin θ) in XZ and local +z to (sin θ, cos θ). `hx`/`hz` are the local half extents.
 */
export function obbFromRotation(cx: number, cz: number, rotationY: number, hx: number, hz: number): Obb2 {
  return { cx, cz, ux: Math.cos(rotationY), uz: -Math.sin(rotationY), hx, hz }
}

/** Axis-aligned bounds of an oriented rectangle. */
export function obbBounds(o: Obb2): Rect2 {
  const ex = Math.abs(o.ux) * o.hx + Math.abs(o.uz) * o.hz
  const ez = Math.abs(o.uz) * o.hx + Math.abs(o.ux) * o.hz
  return { minX: o.cx - ex, maxX: o.cx + ex, minZ: o.cz - ez, maxZ: o.cz + ez }
}

/**
 * The podium an exhibit stands on, if any: an exhibit may name a podium slot (`podium:
 * 'pod-b-2'`, PODIUM_SLOTS) instead of a table by a wall. Read structurally so content written
 * before the field existed keeps type-checking.
 */
export function exhibitPodium(exhibit: ExhibitConfig): PodiumSlot | undefined {
  const id = (exhibit as ExhibitConfig & { podium?: unknown }).podium
  return typeof id === 'string' ? PODIUM_SLOTS.find((p) => p.id === id) : undefined
}

/** Where an exhibit stands: on its podium (the podium's footprint), or on a table by its wall. */
export function tablePlacement(exhibit: ExhibitConfig) {
  const slot = exhibitPodium(exhibit)
  if (slot) {
    const obb = obbFromRotation(slot.x, slot.z, slot.rotationY, PODIUM.size / 2, PODIUM.size / 2)
    return { position: [slot.x, 0, slot.z] as [number, number, number], rotationY: slot.rotationY, obb, rect: obbBounds(obb), podium: slot }
  }
  const offset = DISPLAY_TABLE.wallGap + DISPLAY_TABLE.depth / 2
  const p = surfacePoint(exhibit.placement.surface, exhibit.placement.at, 0, offset)
  const [x, , z] = p.position
  // the table's long side runs along the wall (local x), its depth along the wall normal
  const obb = obbFromRotation(x, z, p.rotationY, DISPLAY_TABLE.length / 2, DISPLAY_TABLE.depth / 2)
  return { position: p.position, rotationY: p.rotationY, obb, rect: obbBounds(obb), podium: undefined }
}
