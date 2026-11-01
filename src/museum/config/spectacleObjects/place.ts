/**
 * Placement helpers for the spectacle object lists (this folder): floor points on the drum's
 * polar grid and rotations that face an object in or out. Values only — no import of
 * objects.ts, so the lists can be spread into SCENE_OBJECTS without an import cycle.
 */
import { DEG, polar, type Vec3 } from '../museum'

/** rotationDeg that turns an object's front (+z) to face outwards (away from the drum centre) at plan angle `aDeg`. */
export const facingOut = (aDeg: number) => Math.atan2(Math.cos(aDeg * DEG), Math.sin(aDeg * DEG)) / DEG
/** …and to face the drum centre. */
export const facingIn = (aDeg: number) => facingOut(aDeg) + 180
/** …and to face along the walk, towards increasing (+1) or decreasing (−1) plan angle. */
export const facingAlong = (aDeg: number, sense: 1 | -1) => facingOut(aDeg) - 90 * sense

/** A floor point (or `y` above it) on the drum's polar grid. */
export const at = (r: number, aDeg: number, y = 0): Vec3 => {
  const [x, z] = polar(r, aDeg)
  return [x, y, z]
}
