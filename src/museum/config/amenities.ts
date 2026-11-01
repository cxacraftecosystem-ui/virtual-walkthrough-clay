/**
 * VISITOR AMENITIES & WAYFINDING — content only (rendering: amenities/Amenities.tsx).
 *
 * The pavilion's amenities are few:
 *
 *   Signage           a totem in the entrance hall pointing round the ring, one in Gallery C at
 *                     the opening into the hallway, and one beside each notch door pointing out
 *                     along the Parikrama walk to the north wing's rooms
 *   Discovery trail   eight small stamped medallions round the pavilion ("Find the motifs"),
 *                     each on a wall face whose normal is close to a compass point
 *
 * Objects here are appended to SCENE_OBJECTS (objects.ts) — they get collision, culling,
 * click → info panel and deep links like every other scene object. The pavilion has none yet.
 * This module must only import TYPES from objects.ts (objects.ts imports it).
 */
import type { MotifId } from './exhibits'
import { surfacePoint, ZONES, type SurfaceId, type ZoneId } from './layout'
import { ARCH, KEY, MUSEUM, polar, type Vec3 } from './museum'
import { NOTCH_DOOR } from './satellites'
import type { SceneObjectConfig } from './objects'

const RH = MUSEUM.pavilion.ceilingHeight

export const PRODUCT_TEXT = ''

export const AMENITY_OBJECTS: SceneObjectConfig[] = [
  // ══ Partners by the entrance (CONTRACT §8): the same band as the Clay Atlas's, both logos as they
  // stand on their neutral ground, on the entrance hall's east wall just inside the door — on the
  // right coming in, and facing the visitor on the way out ══
  {
    id: 'entrance-partners',
    title: 'Partners',
    kind: 'credits-panel',
    position: [KEY.annexHalf - 0.16, 0, MUSEUM.annex.endZ - 1.6],
    rotationDeg: -90,
    footprint: [1.8, 0.3],
    height: 3.0,
    props: { layout: 'partners' },
    zone: 'annex',
    alt: 'A pale panel by the entrance with the two partner logos: DC Handicrafts, presenting the exhibition, and IIT Kharagpur, in collaboration.',
    i18n: {
      hi: { title: 'सहयोगी', alt: 'प्रवेश द्वार के पास एक हल्के रंग का पटल, जिस पर दोनों सहयोगियों के लोगो हैं: प्रदर्शनी प्रस्तुत करने वाला डीसी हस्तशिल्प, और सहयोग में आईआईटी खड़गपुर।' },
      bn: { title: 'সহযোগী', alt: 'প্রবেশপথের পাশে একটি হালকা প্যানেল, তাতে দুই সহযোগীর লোগো: প্রদর্শনীর উপস্থাপক ডিসি হস্তশিল্প, আর সহযোগিতায় আইআইটি খড়্গপুর।' },
    },
  },
]

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
/** Gallery C totem: inside the D arch, by the end of the hallway wall, where the hallway opens off the ring. */
const C_TOTEM = polar(MUSEUM.drum.ringR - 1.0, ARCH.d.fromDeg - 2)
/** The arches the signs point through. */
const E_ARCH = polar(KEY.ringC, ARCH.eEast.midDeg)
const D_ARCH = polar(KEY.ringC, ARCH.d.midDeg)
/** North-wing totems: beside each notch door, against the lobe wall and clear of the way through. */
const D_DOOR = polar(NOTCH_DOOR.rC, MUSEUM.drum.dNotchDeg - 360 + 5)
const NE_DOOR = polar(NOTCH_DOOR.rC, MUSEUM.drum.neNotchDeg - 4)
const D_TOTEM = polar(MUSEUM.drum.r - 0.45, MUSEUM.drum.dNotchDeg - 8)
const NE_TOTEM = polar(MUSEUM.drum.r - 0.45, MUSEUM.drum.neNotchDeg + 3)
/** The walk and its rooms, in the order the D door reaches them (the NE door lists them reversed). */
const NORTH_WING: ZoneId[] = ['parikrama-west', 'atlas', 'theatre', 'library', 'shop']

export const SIGNS: SignConfig[] = [
  totem(
    'sign-hall',
    HALL[0],
    HALL[1],
    [HALL[0], HALL[1] + 5],
    [
      // the galleries begin round the east end of the inner wall
      { zone: 'ring-a', via: E_ARCH },
      { zone: 'ring-b', via: E_ARCH },
      { zone: 'ring-c', via: E_ARCH },
      { zone: 'inner', via: E_ARCH },
    ],
    ['annex', 'entry-e'],
  ),
  totem(
    'sign-c',
    C_TOTEM[0],
    C_TOTEM[1],
    polar(MUSEUM.podium.ringR - 3, ARCH.d.fromDeg + 30),
    [{ zone: 'hallway-d', via: D_ARCH }, { zone: 'inner' }, { zone: 'annex', via: D_ARCH }],
    ['ring-c', 'ring-b', 'hallway-d', 'inner'],
  ),
  // the head of the hallway, by the D notch door: Parikrama · Atlas · Theatre · Library · Haat
  totem(
    'sign-parikrama',
    D_TOTEM[0],
    D_TOTEM[1],
    D_ARCH,
    NORTH_WING.map((zone) => ({ zone, via: D_DOOR })),
    ['hallway-d', 'ring-c', 'parikrama-west'],
  ),
  // the entry ways, by the NE notch door: the walk, then the same rooms nearest first from this side
  totem(
    'sign-entry',
    NE_TOTEM[0],
    NE_TOTEM[1],
    polar(KEY.ambMidR, 70),
    (['parikrama-east', ...NORTH_WING.slice(1).reverse()] as ZoneId[]).map((zone) => ({ zone, via: NE_DOOR })),
    ['entry-e', 'annex', 'parikrama-east'],
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
  medallion('m1', 'g-west', 1.2, 0.9, 'rosette', INK.terracotta, 'annex', 'The Earth Room'),
  medallion('m2', 'f-outer-3', 0.35, 1.25, 'teardrop', INK.oxblood, 'entry-e', 'Entry Ways'),
  medallion('m3', 'a-outer-2', 0.3, 0.75, 'diamond', INK.ochre, 'ring-a', 'Gallery A'),
  medallion('m4', 'b-outer-4', 2.2, 0.75, 'leaf-trail', INK.terracotta, 'ring-b', 'Gallery B'),
  medallion('m5', 'c-south-2', 2.25, 0.65, 'star-lattice', INK.black, 'ring-c', 'Gallery C'),
  medallion('m6', 'd-hallway-4', 0.25, 0.7, 'rosette', INK.oxblood, 'hallway-d', 'Wine Hall'),
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
