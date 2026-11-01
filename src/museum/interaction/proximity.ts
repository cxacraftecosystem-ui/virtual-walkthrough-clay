/**
 * PROXIMITY — how near the visitor stands to a point, as a smooth 0 … 1 weight (non-React, for
 * render loops and key handlers). 1 within `r0` metres, 0 beyond `r1`, smoothstep between.
 *
 *   if (proximity(x, z, 1.2, 2.5) > 0.5) …   // the ghatam answers keys 1–5 only up close
 *
 * Distances are in plan (x, z); the roof perch counts as far from everything on the ground.
 */
import { perchZone } from '../navigation/perch'
import { visitor } from '../state/visitor'

export function proximity(x: number, z: number, r0: number, r1: number): number {
  if (perchZone()) return 0
  const d = Math.hypot(visitor.x - x, visitor.z - z)
  if (d <= r0) return 1
  if (d >= r1) return 0
  const t = (r1 - d) / (r1 - r0)
  return t * t * (3 - 2 * t)
}

/** Plan distance from the visitor to (x, z), in metres. */
export function visitorDistance(x: number, z: number): number {
  return Math.hypot(visitor.x - x, visitor.z - z)
}
