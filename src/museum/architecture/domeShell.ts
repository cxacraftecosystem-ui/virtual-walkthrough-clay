/**
 * THE DOME'S OUTER SHELL (pure numbers, no three.js: the perch's rib route reads it too).
 *
 * The coffered interior is a sphere springing at y 9.0; seen from the forecourt that cap hid
 * behind the 10 m annex. The exterior is therefore a separate, taller shell, as great masonry
 * domes are built:
 *
 *   tambour ...... a drum on the roof slab, 2.8 m high, round the ring wall's outer face, with a
 *                  pier under every rib
 *   shell ........ a stilted (elliptical) profile from the tambour's top, vertical there and level
 *                  where it meets the Sky Rim's plinth at the deck, so it shoulders up like a
 *                  bud rather than a saucer
 *   crown ........ (retired: the open crown of ribs read as scaffolding; the dome now ends in the
 *                  lantern ring round the Sky Rim's deck, domeGeometry.ts) — `crownAt` and
 *                  SHELL.crown stay for reference
 *
 * Plan radius r about the drum's axis; heights are world y.
 */
import { KEY, MUSEUM } from '../config/museum'
import { SKY_RIM } from '../config/satellites'

const SLAB_TOP = MUSEUM.pavilion.ceilingHeight + MUSEUM.pavilion.roofThickness

export const SHELL = {
  /** The tambour: outer face radius, foot (the slab) and top. */
  tambour: { r: KEY.ringOuterR + 0.3, y0: SLAB_TOP, y1: SLAB_TOP + 2.8, pierOut: 0.45, pierHalf: 0.38 },
  /** Where the shell meets the Sky Rim's plinth (level there) just under the deck. */
  plinth: { r: SKY_RIM.upstand.r0 + 2.35, y: SKY_RIM.y - 0.1 },
  /** The open crown ring the ribs rise to over the collar. */
  crown: { r: SKY_RIM.upstand.r1 + 0.15, y: 25.6 },
} as const

const A = SHELL.tambour.r - SHELL.plinth.r
const B = SHELL.plinth.y - SHELL.tambour.y1

/** Height of the shell's outer face at plan radius r (the roof slab beyond the tambour, the deck within the plinth). */
export function shellY(r: number): number {
  if (r >= SHELL.tambour.r) return r > SHELL.tambour.r + 0.01 ? SHELL.tambour.y0 : SHELL.tambour.y1
  if (r <= SHELL.plinth.r) return SHELL.plinth.y
  const u = (r - SHELL.plinth.r) / A
  return SHELL.tambour.y1 + B * Math.sqrt(Math.max(0, 1 - u * u))
}

/** Plan radius of the shell's outer face at height y (the tambour's face below its top). */
export function shellR(y: number): number {
  if (y <= SHELL.tambour.y1) return SHELL.tambour.r
  if (y >= SHELL.plinth.y) return SHELL.plinth.r
  const v = (y - SHELL.tambour.y1) / B
  return SHELL.plinth.r + A * Math.sqrt(Math.max(0, 1 - v * v))
}

/** A point of the shell's meridian at parameter t ∈ [0, π/2] (0 the tambour's top, π/2 the plinth): [r, y] and its outward normal. */
export function shellAt(t: number): { r: number; y: number; nr: number; ny: number } {
  const c = Math.cos(t)
  const s = Math.sin(t)
  const nr = B * c
  const ny = A * s
  const l = Math.hypot(nr, ny) || 1
  return { r: SHELL.plinth.r + A * c, y: SHELL.tambour.y1 + B * s, nr: nr / l, ny: ny / l }
}

/** A point of a crown rib at parameter t ∈ [0, π/2] (0 at the deck's edge, π/2 the crown ring). */
export function crownAt(t: number): { r: number; y: number; nr: number; ny: number } {
  const a = SHELL.plinth.r - SHELL.crown.r
  const b = SHELL.crown.y - SHELL.plinth.y
  const c = Math.cos(t)
  const s = Math.sin(t)
  const l = Math.hypot(b * c, a * s) || 1
  return { r: SHELL.crown.r + a * c, y: SHELL.plinth.y + b * s, nr: (b * c) / l, ny: (a * s) / l }
}
