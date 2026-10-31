/**
 * VISITOR AMENITIES & WAYFINDING — content only (rendering: amenities/Amenities.tsx).
 *
 * The pavilion is one round room with no shop, library or reception, so its amenities are few:
 *
 *   Signage           a totem in the entrance hall pointing round the ring, and one in Gallery C
 *                     at the opening into the hallway
 *   Discovery trail   eight small stamped medallions round the pavilion ("Find the motifs"),
 *                     each on a wall face whose normal is close to a compass point
 *
 * Objects here are appended to SCENE_OBJECTS (objects.ts) — they get collision, culling,
 * click → info panel and deep links like every other scene object. The pavilion has none yet.
 * This module must only import TYPES from objects.ts (objects.ts imports it).
 */
import type { MotifId } from './exhibits'
import { surfacePoint, ZONES, type SurfaceId, type ZoneId } from './layout'
import { KEY, MUSEUM, polar, type Vec3 } from './museum'
import type { SceneObjectConfig } from './objects'

const RH = MUSEUM.pavilion.ceilingHeight

export const PRODUCT_TEXT = ''

export const AMENITY_OBJECTS: SceneObjectConfig[] = []

/* ------------------------------------------------------------------ */
/* Wayfinding signage                                                  */
/* ------------------------------------------------------------------ */

export type Compass = 'N' | 'E' | 'S' | 'W' | 'NE' | 'NW' | 'SE' | 'SW'

export interface SignLine {
  /** Destination zone (name from the i18n dictionary: zone.<id>). */
  zone: ZoneId
  /** World direction of the destination; the arrow is drawn relative to the viewer. Omit = no arrow (plaques). */
  dir?: Compass
}

export interface SignConfig {
  id: string
  kind: 'plaque' | 'totem'
  /** Plaques: wall-face point at the plaque centre height. Totems: floor point. */
  position: Vec3
  /** Direction the readable face looks towards (outward normal). */
  facing: Compass
  lines: SignLine[]
  /** Culling: zones from which the sign can be seen. */
  zones: ZoneId[]
}

const COMPASS: Compass[] = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']

/** Nearest compass point of the direction from (x, z) towards (tx, tz). */
function compassTo(x: number, z: number, tx: number, tz: number): Compass {
  const deg = (Math.atan2(tx - x, -(tz - z)) * 180) / Math.PI
  return COMPASS[(Math.round(deg / 45) + 8) % 8]
}

const anchor = (id: ZoneId) => ZONES.find((z) => z.id === id)?.anchor ?? [0, 0]

/** A totem at floor point [x, z] facing towards [fx, fz], with a line per destination (arrow towards its anchor or `via`). */
function totem(id: string, x: number, z: number, faceTo: [number, number], dests: { zone: ZoneId; via?: [number, number] }[], zones: ZoneId[]): SignConfig {
  return {
    id,
    kind: 'totem',
    position: [x, 0, z],
    facing: compassTo(x, z, faceTo[0], faceTo[1]),
    lines: dests.map((d) => {
      const [tx, tz] = d.via ?? anchor(d.zone)
      return { zone: d.zone, dir: compassTo(x, z, tx, tz) }
    }),
    zones,
  }
}

/** Entrance hall totem: by the east wall just before the mouth, read by visitors walking in. */
const HALL: [number, number] = [KEY.annexHalf - 0.45, KEY.annexMouthZ + 1.6]
/** Gallery C totem: by the end of the hallway wall, where the hallway opens off the ring. */
const C_TOTEM = polar(7.25, 206)

export const SIGNS: SignConfig[] = [
  totem(
    'sign-hall',
    HALL[0],
    HALL[1],
    [HALL[0], HALL[1] + 5],
    [
      // the galleries begin round the east end of the inner wall
      { zone: 'ring-a', via: polar(7.0, 40) },
      { zone: 'ring-b', via: polar(7.0, 40) },
      { zone: 'ring-c', via: polar(7.0, 40) },
      { zone: 'inner', via: polar(7.0, 40) },
    ],
    ['annex', 'entry-e'],
  ),
  totem(
    'sign-c',
    C_TOTEM[0],
    C_TOTEM[1],
    polar(5.0, 245),
    [{ zone: 'hallway-d', via: polar(9.2, 214) }, { zone: 'inner' }, { zone: 'annex', via: polar(9.2, 214) }],
    ['ring-c', 'ring-b', 'hallway-d', 'inner'],
  ),
]

/* ------------------------------------------------------------------ */
/* Discovery trail — "Find the motifs"                                 */
/* ------------------------------------------------------------------ */

export interface TrailMedallion {
  id: string
  motif: MotifId
  ink: string
  /** Centre of the medallion (on a wall / column face). */
  position: Vec3
  facing: Compass
  zone: ZoneId
  /** Where it is, for the progress card once found. */
  place: string
}

export const TRAIL_SIZE = 0.15

/** Clay inks: oxblood, terracotta, ochre, smoke black. */
const INK = { oxblood: '#7a2e24', terracotta: '#b4553f', ochre: '#b97a3c', black: '#2b2622' }

/** A medallion `at` metres along a surface, `y` above the floor; facing = nearest compass point of the wall normal. */
function medallion(id: string, surface: SurfaceId, at: number, y: number, motif: MotifId, ink: string, zone: ZoneId, place: string): TrailMedallion {
  const p = surfacePoint(surface, at, y, 0.006)
  const [nx, , nz] = p.normal
  return { id, motif, ink, position: p.position, facing: compassTo(0, 0, nx, nz), zone, place }
}

// Each surface below faces within ~10° of a compass point (the medallion is drawn on that point).
export const TRAIL: TrailMedallion[] = [
  medallion('m1', 'g-west', 1.2, 0.9, 'rosette', INK.terracotta, 'annex', 'Entrance Hall'),
  medallion('m2', 'f-outer-3', 0.35, 1.25, 'teardrop', INK.oxblood, 'entry-e', 'Entry Ways'),
  medallion('m3', 'a-outer-2', 0.3, 0.75, 'diamond', INK.ochre, 'ring-a', 'Gallery A'),
  medallion('m4', 'b-outer-4', 2.2, 0.75, 'leaf-trail', INK.terracotta, 'ring-b', 'Gallery B'),
  medallion('m5', 'c-south-2', 2.25, 0.65, 'star-lattice', INK.black, 'ring-c', 'Gallery C'),
  medallion('m6', 'd-hallway-4', 0.25, 0.7, 'rosette', INK.oxblood, 'hallway-d', 'Hallway'),
  medallion('m7', 'h-inner-3', 1.25, 1.0, 'diamond', INK.black, 'entry-e', 'Entry Ways'),
  medallion('m8', 'f-inner-main', 0.25, 0.8, 'teardrop', INK.ochre, 'inner', 'Oculus Court'),
]

/** Unit outward normal [x, z] of a compass facing. */
export function compassVec(c: Compass): [number, number] {
  const s = Math.SQRT1_2
  switch (c) {
    case 'N':
      return [0, -1]
    case 'S':
      return [0, 1]
    case 'E':
      return [1, 0]
    case 'W':
      return [-1, 0]
    case 'NE':
      return [s, -s]
    case 'NW':
      return [-s, -s]
    case 'SE':
      return [s, s]
    case 'SW':
      return [-s, s]
  }
}

/** rotation.y that turns a +z-facing plane to face `c`. */
export const compassRotation = (c: Compass) => {
  const [x, z] = compassVec(c)
  return Math.atan2(x, z)
}

export { RH as AMENITY_CEILING }
