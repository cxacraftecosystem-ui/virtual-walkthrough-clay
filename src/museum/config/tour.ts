/**
 * GUIDED TOUR — data-driven stops round the clay pavilion.
 *
 * Each stop is a standing point + view direction (`view`, compass yaw: 0 = north,
 * 90 = east, 180 = south, 270 = west) and an optional `item` that the caption card can
 * open ("More about this") or favourite. Captions describe what the visitor is looking at
 * in the museum — they deliberately make no historical or cultural claims.
 *
 * Walking between stops is planned over NAV_WAYPOINTS (see src/museum/tour/pathing.ts),
 * so routes always go round the curved walls and through the door; hops longer than
 * `teleportBeyond` metres use the soft fade instead of a long walk.
 *
 * Route: forecourt → entrance hall (description wall H) → inner main wall F → entry ways E →
 * Galleries A, B, C round the ring → oculus court (and the statement on F's court face) →
 * hallway D. Hindi / Bengali captions: src/museum/i18n/tourText.ts (same stop ids).
 */
import { BENCHES, BENCH_SIZE, PODIUM_SLOTS, SURFACES, surfacePoint, type SurfaceId } from './layout'
import { KEY, MUSEUM, polar } from './museum'
import { TOUR_OVERRIDE } from '../content/exhibition'
import type { SelectionKind } from '../state/store'
import type { ContentI18n, Lang } from '../i18n/core'

export interface TourView {
  x: number
  z: number
  /** Compass heading (deg). */
  yawDeg: number
  pitchDeg?: number
}

export interface TourStop {
  id: string
  /** Short room / place label shown above the title. */
  place: string
  title: string
  text: string
  view: TourView
  item?: { kind: SelectionKind; id: string }
  /** Seconds to linger before moving on (default TOUR.dwellSec). */
  dwellSec?: number
  /** Optional Hindi / Bengali captions (else src/museum/i18n/tourText.ts, else English). */
  i18n?: ContentI18n<'place' | 'title' | 'text'>
  /**
   * Optional recorded audio-guide narration per language (e.g. { en: '/audio/tour/en/atrium.mp3' }).
   * Without a file for the chosen language the caption is read with speechSynthesis.
   */
  narrationAudio?: Partial<Record<Lang, string>>
}

export const TOUR = {
  dwellSec: 11,
  /** Walks longer than this (m) fade-teleport instead. */
  teleportBeyond: 30,
  /** Speech synthesis rate (0.1–10). */
  narrationRate: 0.95,
}

/** Standing point `dist` metres in front of a point on a display surface, facing it. */
export function surfaceView(surface: SurfaceId, at: number, dist: number, pitchDeg = 2): TourView {
  const s = SURFACES[surface]
  const p = surfacePoint(surface, at, 0, dist)
  const [nx, nz] = s.normal
  // face opposite the wall normal
  const yawDeg = ((Math.atan2(-nx, nz) * 180) / Math.PI + 360) % 360
  return { x: p.position[0], z: p.position[2], yawDeg, pitchDeg }
}

/** Standing point `dist` metres in front of the middle of a display surface. */
const midView = (surface: SurfaceId, dist: number, pitchDeg = 2) => surfaceView(surface, (SURFACES[surface].range[0] + SURFACES[surface].range[1]) / 2, dist, pitchDeg)

/** Standing point (x, z) facing a target point (compass yaw). */
export function lookAt(x: number, z: number, tx: number, tz: number, pitchDeg = 2): TourView {
  return { x, z, yawDeg: ((Math.atan2(tx - x, -(tz - z)) * 180) / Math.PI + 360) % 360, pitchDeg }
}

/** Standing point on the drum's polar grid (radius, plan angle) facing a target point. */
const polarLook = (r: number, aDeg: number, tx: number, tz: number, pitchDeg = 2) => {
  const [x, z] = polar(r, aDeg)
  return lookAt(x, z, tx, tz, pitchDeg)
}

/** Standing in front of a podium slot, facing it. */
function podiumView(slotId: string, dist = 1.5, pitchDeg = -8): TourView {
  const p = PODIUM_SLOTS.find((s) => s.id === slotId) ?? PODIUM_SLOTS[0]
  const [x, z] = polar(MUSEUM.podium.ringR - dist, p.angleDeg)
  return lookAt(x, z, p.x, p.z, pitchDeg)
}

export const TOUR_STOPS: TourStop[] = [
  {
    id: 'arrival',
    place: 'Entrance Forecourt',
    title: 'Welcome to the clay pavilion',
    text: 'A round, double-height pavilion stands on a low landscaped plinth. The doorway ahead opens into a straight entrance hall that leads into the drum.',
    view: { x: MUSEUM.visitor.start.x, z: MUSEUM.visitor.start.z, yawDeg: 0, pitchDeg: 6 },
    dwellSec: 9,
  },
  {
    id: 'description-wall',
    place: 'Entrance Hall',
    title: 'The description wall',
    text: 'At the end of the entrance hall a curved wall carries the title and introduction of the exhibition. On the way in, the panel on the right-hand wall names the three traditions and the way round.',
    view: { x: 0, z: KEY.annexMouthZ + 2.2, yawDeg: 0, pitchDeg: 3 },
    item: { kind: 'infographic', id: 'traditions' },
    dwellSec: 11,
  },
  {
    id: 'inner-main-wall',
    place: 'Entry Ways',
    title: 'The inner main wall',
    text: 'Behind the description wall, a second, taller curved wall keeps the centre of the pavilion out of sight. The galleries begin round its right-hand end.',
    // From the left of the entry way between H and F (1.8 m wide), looking along F's curve to its
    // right-hand end and the first gallery beyond (a square-on view of F shows only blank wall).
    view: polarLook(MUSEUM.descriptionWall.r - 0.55, 100, ...polar(MUSEUM.innerMainWall.r + 0.95, 42), 4),
    dwellSec: 9,
  },
  {
    id: 'entry-ways',
    place: 'Entry Ways',
    title: 'Into the galleries',
    text: 'The entry ways curve round both ends of the description wall. On the drum wall ahead, a panel introduces the first tradition: the terracotta of Bankura, in West Bengal.',
    view: midView('e-north-3', 1.7, 3),
    item: { kind: 'infographic', id: 'tradition-a' },
  },
  {
    id: 'gallery-a',
    place: 'Gallery A',
    title: 'Bankura terracotta',
    text: 'A row of slender podiums follows the drum wall, each piece lit from above. Here a terracotta horse stands with its neck held high; reliefs hang on the wall above the row.',
    view: podiumView('pod-a-1', 1.6),
    item: { kind: 'object', id: 'clay-a-horse' },
    dwellSec: 12,
  },
  {
    id: 'gallery-b',
    place: 'Gallery B',
    title: 'The votive plaques of Molela',
    text: 'On the far side of the ring, the podiums carry flat clay plaques modelled in relief, with cups and a lamp between them. Larger plaques hang above.',
    view: podiumView('pod-b-3', 1.7),
    item: { kind: 'object', id: 'clay-b-plaque-deity' },
    dwellSec: 12,
  },
  {
    id: 'gallery-c',
    place: 'Gallery C',
    title: 'Longpi black pottery',
    text: 'The last of the three galleries. The black pots on the podiums are polished to a soft shine; on the curved wall nearby hang three more works.',
    view: podiumView('pod-c-1', 1.6),
    item: { kind: 'object', id: 'clay-c-kettle' },
    dwellSec: 12,
  },
  {
    id: 'oculus',
    place: 'Oculus Court',
    title: 'The oculus court',
    text: 'At the centre of the pavilion the roof opens to the sky. Daylight falls through the oculus onto the round plinth below, and its circle of light moves across the rings through the day.',
    view: polarLook(4.3, 62, 0, 0, 10),
    item: { kind: 'object', id: 'oculus-plinth' },
    dwellSec: 12,
  },
  {
    id: 'statement',
    place: 'Oculus Court',
    title: 'Earth, water, hand and fire',
    text: 'The court side of the inner main wall carries the statement of the exhibition: every piece here began as earth, and water, hands and fire made it what it is.',
    view: midView('f-inner-main', 1.95, 7),
    item: { kind: 'infographic', id: 'statement' },
    dwellSec: 10,
  },
  {
    id: 'hallway',
    place: 'Hallway',
    title: 'From clay to finished piece',
    text: 'A curved hallway leads back towards the entrance. Five panels along the drum wall follow a piece from raw clay to finished object, and shelves opposite hold pots before and after firing.',
    view: surfaceView('d-hallway-1', (SURFACES['d-hallway-1'].range[0] + SURFACES['d-hallway-1'].range[1]) / 2, 1.7, 2),
    item: { kind: 'infographic', id: 'process-prepare' },
    dwellSec: 12,
  },
]
/** Bundled stops (the admin uses them as the template for a per-exhibition tour override). */
export const BUNDLED_TOUR_STOPS: readonly TourStop[] = TOUR_STOPS.slice()
// Per-exhibition tour override from the content API (src/museum/content/exhibition.ts).
if (TOUR_OVERRIDE.stops?.length) TOUR_STOPS.splice(0, TOUR_STOPS.length, ...TOUR_OVERRIDE.stops)

/** Waypoints at radius r for each plan angle (deg). */
const ringOf = (r: number, angles: number[]) => angles.map((a) => polar(r, a))

/**
 * Navigation waypoints [x, z] — round the ring, through the entry ways and the hallway, down
 * the annex and both sides of the door, and round the pavilion outside.
 * Only positions matter; edges are computed from the collision geometry.
 */
export const NAV_WAYPOINTS: [number, number][] = [
  // forecourt and the door
  [0, MUSEUM.visitor.start.z],
  [-4.6, 24.0],
  [4.6, 24.0],
  [-5.4, 17.0],
  [5.4, 17.0],
  [0, KEY.annexOuterZ + 1.1],
  [0, MUSEUM.annex.endZ - 1.0],
  // annex and its mouth in front of H
  [0, 15.0],
  [0, KEY.annexMouthZ + 0.6],
  ...ringOf(9.35, [45, 60, 75, 105, 120, 135]),
  // between H and F (the entry corridor)
  ...ringOf(7.0, [40, 60, 90, 120, 140]),
  // round F's ends into the ring
  ...ringOf(6.95, [27, 153]),
  // the ring of galleries, inside the podiums
  ...ringOf(5.0, [20, 5, -15, -35, -60, -85, -105, -125, -145, -165, 175, 160]),
  // the oculus court (inside F), either side of the bench and between it and the plinth
  ...ringOf(4.5, [45, 135]),
  [0, (MUSEUM.oculus.rings[0] + (BENCHES[0]?.z ?? 4.5) - BENCH_SIZE.depth / 2) / 2],
  // C → hallway opening, and the hallway
  ...ringOf(7.6, [214]),
  ...ringOf(9.4, [218, 200, 180, 160, 148]),
  // round the pavilion outside, on the landscape plinth
  ...ringOf(13.2, [60, 30, 0, -30, -60, -90, -120, -150, 180, 150, 120]),
]
