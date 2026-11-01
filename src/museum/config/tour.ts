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
 * Route (GRAND §8 P5): the forecourt and its guardians → the Earth Room → the description wall
 * H → the lippan corridor → the turn into the court → the lotus → Galleries A, B (past the
 * formation gate) and C → the balcony (a perch; left out when the rides are off) → the Wine Hall
 * in hallway D → out through the D notch door onto the Parikrama → the Clay Atlas, the Agni
 * Theatre, the Red Room and the Haat → the Sphere Well (a perch) → back to the forecourt.
 * Hindi / Bengali captions: src/museum/i18n/tourText.ts (same stop ids).
 *
 * "Earth to Fire" (SPECTACLE F30): every stop belongs to a chapter, and may carry cues the
 * tour engine fires on arrival (spectacle/cues.ts) — music, light, effects, a time of day.
 * A stop with `perch` is seen from a perch (navigation/perch.ts): the tour walks to its door,
 * rides there, and rides back down before it sets off for the next stop.
 */
import { BENCHES, BENCH_SIZE, SURFACES, surfacePoint, type SurfaceId } from './layout'
import { ARCH, DEG, KEY, MUSEUM, polar } from './museum'
import { NOTCH_DOOR, PARIKRAMA, RED_ROOM, SAT_WALL, satellite, SATELLITES, serpentineR, SPHERE_WELL, THEATRE, type SatelliteId } from './satellites'
import { SCENE_OBJECTS } from './objects'
import { TOUR_OVERRIDE } from '../content/exhibition'
import type { CueId } from '../spectacle/cues'
import type { SelectionKind } from '../state/store'
import type { ContentI18n, Lang } from '../i18n/core'
import { PERCH_PATHS, pathPoint, perchView, type PerchId } from '../navigation/perch'

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
  /** Chapter of the "Earth to Fire" tour. */
  chapter?: TourChapter
  /** Cues the tour engine fires on arrival at this stop. */
  cue?: TourCue
  /** Seen from a perch: the tour rides to `t` on it from its door (`view` is then that perch's view). */
  perch?: { id: PerchId; t: number }
}

export type TourChapter = 'earth' | 'water' | 'hand' | 'air' | 'fire' | 'return'

export interface TourCue {
  /** Score stem to bring in (spectacle/music.ts): 'drone', 'water', 'pulse', 'air', 'fire', 'coda'. */
  music?: string
  /** Light preset or choreography accent (WP2), e.g. 'turn'. */
  light?: string
  /** Moments to fire (spectacle/cues.ts). */
  fx?: CueId[]
  /** Time of day to show ('live', 'morning', 'noon', 'golden', 'night'). */
  time?: string
  /** Stay until this cue fires (dwellSec is then the upper bound), e.g. the end of a film chapter. */
  until?: CueId
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


/** Standing point (x, z) facing a target point (compass yaw). */
export function lookAt(x: number, z: number, tx: number, tz: number, pitchDeg = 2): TourView {
  return { x, z, yawDeg: ((Math.atan2(tx - x, -(tz - z)) * 180) / Math.PI + 360) % 360, pitchDeg }
}

/** Standing point on the drum's polar grid (radius, plan angle) facing a target point. */
const polarLook = (r: number, aDeg: number, tx: number, tz: number, pitchDeg = 2) => {
  const [x, z] = polar(r, aDeg)
  return lookAt(x, z, tx, tz, pitchDeg)
}

/** Standing on the drum's polar grid at (r, aDeg) with a compass heading. */
const polarPose = (r: number, aDeg: number, yawDeg: number, pitchDeg = 2): TourView => {
  const [x, z] = polar(r, aDeg)
  return { x, z, yawDeg, pitchDeg }
}

/** Compass heading facing away from the drum centre at plan angle `aDeg` (into a north-wing room). */
const outward = (aDeg: number) => ((Math.atan2(Math.cos((aDeg * Math.PI) / 180), -Math.sin((aDeg * Math.PI) / 180)) * 180) / Math.PI + 360) % 360

/** Just inside a north-wing room's door (r), looking into the room along `aDeg` (default its door). */
const roomView = (id: SatelliteId, r: number, aDeg = satellite(id).doorDeg, pitchDeg = 2) => polarPose(r, aDeg, outward(aDeg), pitchDeg)

/* Radii of the plan the stops and the waypoints stand on (all derived from museum.ts / satellites.ts). */
const RING = MUSEUM.drum.ringR
const F_IN = MUSEUM.innerMainWall.r - MUSEUM.innerMainWall.thickness / 2
const F_OUT = MUSEUM.innerMainWall.r + MUSEUM.innerMainWall.thickness / 2
const CURB = MUSEUM.oculus.rings[0]
/** The court between the curb and F's court face. */
const COURT_R = (CURB + F_IN) / 2
/** The corridor between F and H. */
const CORRIDOR_R = (F_OUT + RING) / 2
/** The galleries' walking line, inside the formation gates. */
const GALLERY_R = MUSEUM.fins.r0 - 0.8
/** Round the curb, between the pool and the galleries. */
const CURB_WALK_R = CURB + 0.9
/** A crescent room: just inside its door, and its middle. */
const ROOM_DOOR_R = SAT_WALL.innerFace + 1.4
const ROOM_MID_R = (SAT_WALL.innerFace + SAT_WALL.outerFace) / 2

/** "More about this" for an object, once that object exists (rooms are furnished package by package). */
const objectItem = (id: string): TourStop['item'] => (SCENE_OBJECTS.some((o) => o.id === id) ? { kind: 'object', id } : undefined)


/** The theatre stop stands in the aisle between the inner wall and the back row of seats. */
const THEATRE_STAND_R = (SAT_WALL.innerFace + THEATRE.rows[0].r) / 2 - 0.15
/** The Red Room stop stands just inside its door, the room and its central plinth ahead. */
const RED_ROOM_STAND_R = Math.hypot(RED_ROOM.cx, RED_ROOM.cz) - RED_ROOM.r + 0.7
/** The forecourt's guardian horses (GRAND §2.7) stand either side of the axis, halfway down it. */
const GUARD = { x: MUSEUM.forecourt.halfWidth - 5, z: (KEY.annexOuterZ + MUSEUM.forecourt.endZ) / 2 }
/** Inside the curb, between the pool and the galleries' islands. */
const ISLAND_WALK_R = CURB + 2.6

/** A stop on a perch: the view from position `t`, the way the ride leaves it. */
function perchStopView(id: PerchId, t: number): TourView {
  const path = PERCH_PATHS[id]
  const q = pathPoint(path, t)
  const v = perchView(path, t)
  return { x: q.x, z: q.z, yawDeg: v.yawDeg, pitchDeg: v.pitchDeg }
}

export const TOUR_STOPS: TourStop[] = [
  // ── Earth: the approach, the Earth Room and the description wall ──
  {
    id: 'arrival',
    chapter: 'earth',
    cue: { music: 'drone' },
    place: 'Entrance Forecourt',
    title: 'Welcome to the clay pavilion',
    text: 'A round pavilion of earth stands on a landscaped plinth, and above its drum rises a terracotta dome, twenty-two metres high. The tall doorway ahead leads into the Earth Room.',
    view: { x: MUSEUM.visitor.start.x, z: MUSEUM.visitor.start.z, yawDeg: MUSEUM.visitor.start.yawDeg, pitchDeg: MUSEUM.visitor.start.pitchDeg },
    dwellSec: 10,
  },
  {
    id: 'guardians',
    chapter: 'earth',
    place: 'Entrance Forecourt',
    title: 'The guardians',
    text: 'Two clay horses, more than four metres tall, stand either side of the forecourt. A narrow channel of water runs between them on the axis of the door.',
    view: { x: GUARD.x - 3, z: KEY.annexOuterZ + 9, yawDeg: 340, pitchDeg: 6 },
    dwellSec: 10,
  },
  {
    id: 'earth-room',
    chapter: 'earth',
    cue: { fx: ['strata:sweep'] },
    place: 'Entrance Hall',
    title: 'The Earth Room',
    text: 'The entrance hall is lined with tall formations of layered clay, cut by wind and water. Curved shelves of everyday pots run between them, and a round table stands under a circle of sky.',
    view: { x: 0, z: KEY.annexEndZ - 1.5, yawDeg: 0, pitchDeg: 6 },
    dwellSec: 12,
  },
  {
    id: 'description',
    chapter: 'earth',
    place: 'Entrance Hall',
    title: 'The description wall',
    text: 'At the end of the hall the title of the exhibition is cut into a panel of raw clay. To the right, a stair climbs the curved wall towards the balcony.',
    view: { x: 0, z: KEY.annexMouthZ + 2.7, yawDeg: 0, pitchDeg: 4 },
    item: { kind: 'infographic', id: 'traditions' },
    dwellSec: 11,
  },
  {
    id: 'lippan',
    chapter: 'earth',
    place: 'Entry Ways',
    title: 'Mud and mirror',
    text: 'Between the description wall and the inner wall, a long relief of raised mud lines set with small mirrors catches the light. Across the corridor, the wall shows the layers of the earth.',
    view: polarPose(CORRIDOR_R, 70, 70, 3),
    dwellSec: 10,
  },

  // ── Water: the turn and the court ──
  {
    id: 'turn',
    chapter: 'water',
    cue: { music: 'water', light: 'turn', fx: ['reveal:turn'] },
    place: 'Oculus Court',
    title: 'The turn',
    text: 'Past the end of the inner wall the whole rotunda opens at once: a coffered dome thirty-two metres across, its eye open to the sky, and a still pool beneath it.',
    view: polarPose(GALLERY_R + 0.9, MUSEUM.innerMainWall.fromDeg - 6, 294, 12),
    dwellSec: 10,
  },
  {
    id: 'court',
    chapter: 'water',
    cue: { fx: ['court:drip'] },
    place: 'Oculus Court',
    title: 'The lotus under the oculus',
    text: 'A red clay lotus rises from the pool under the oculus, and opens and closes with the sun. The circle of daylight moves across the floor and the walls through the day.',
    view: { x: 0, z: F_IN - 1.35, yawDeg: 0, pitchDeg: 18 },
    item: objectItem('court-lotus'),
    dwellSec: 12,
  },

  // ── Hand: the three galleries ──
  {
    id: 'gallery-a',
    chapter: 'hand',
    cue: { music: 'pulse', fx: ['podium:spot'] },
    place: 'Gallery A',
    title: 'Bankura terracotta',
    text: 'Against a deep red wall, a row of podiums each holds one piece under its own lamp. In front of them a herd of terracotta horses rises in steps, necks held high.',
    view: polarPose(CURB + 1.1, 5, 95, 4),
    item: objectItem('clay-a-horse'),
    dwellSec: 12,
  },
  {
    id: 'gate',
    chapter: 'hand',
    place: 'Gallery A',
    title: 'Between the galleries',
    text: 'Pillars of eroded clay, taller than a house, stand between one gallery and the next. Their bands of colour are the layers the clay was laid down in.',
    view: polarPose(KEY.podiumR - 4.6, -8, 45, 10),
    dwellSec: 9,
  },
  {
    id: 'gallery-b',
    chapter: 'hand',
    cue: { fx: ['podium:spot'] },
    place: 'Gallery B',
    title: 'The votive plaques of Molela',
    text: 'Here the wall turns white, and tall niches between the podiums hold clay plaques modelled in relief, each caught by a raking light.',
    view: polarPose(ISLAND_WALK_R, -59, 31, 4),
    item: objectItem('clay-b-plaque-deity'),
    dwellSec: 12,
  },
  {
    id: 'gallery-c',
    chapter: 'hand',
    cue: { fx: ['podium:spot'] },
    place: 'Gallery C',
    title: 'Longpi black pottery',
    text: 'Under one cool beam, black pots polished to a soft shine stand on a low dark table. Beyond them, a small window shows the glow of a kiln.',
    view: polarPose(ISLAND_WALK_R, -117, 333, -4),
    item: objectItem('clay-c-kettle'),
    dwellSec: 12,
  },

  // ── Air: the balcony, the Wine Hall and out to the Parikrama ──
  {
    id: 'balcony',
    chapter: 'air',
    cue: { music: 'air' },
    place: 'The Balcony',
    title: 'Halfway up the drum',
    text: 'The balcony runs round the galleries at half the height of the drum. Above it, niches and relief panels fill the wall up to the dome; below, the podium row and the pool.',
    view: perchStopView('duplex', 0.5),
    perch: { id: 'duplex', t: 0.5 },
    dwellSec: 12,
  },
  {
    id: 'hallway',
    chapter: 'air',
    place: 'Wine Hall',
    title: 'Clay elsewhere',
    text: 'The hallway is a wine-red hall with a timber floor. On stepped plinths stand pieces of clay from other parts of the world, each credited to the collection that recorded it.',
    view: polarPose(KEY.ambMidR, MUSEUM.drum.dNotchDeg - 4, 220, 2),
    dwellSec: 12,
  },
  {
    id: 'threshold',
    chapter: 'air',
    place: 'Wine Hall',
    title: 'The door to the Parikrama',
    text: 'From the head of the hallway, a doorway in the notch wall leads out to the Parikrama, an open walk between red walls round the north side of the pavilion.',
    view: polarLook(NOTCH_DOOR.rC, ARCH.d.midDeg, ...polar(NOTCH_DOOR.rC, MUSEUM.drum.dNotchDeg), 2),
    dwellSec: 8,
  },
  {
    id: 'parikrama',
    chapter: 'air',
    cue: { fx: ['parikrama:alpana'] },
    place: 'Parikrama Walk',
    title: 'The Parikrama',
    text: 'The walk winds between red walls. Trees rise from courtyards behind them, and terracotta horses stand in the sunken gardens on the drum side. The floor pattern draws itself as you walk.',
    view: polarPose(serpentineR(PARIKRAMA.fromDeg + 6), PARIKRAMA.fromDeg + 6, 50, 2),
    dwellSec: 11,
  },

  // ── Fire: the rooms of the north wing ──
  {
    id: 'atlas',
    chapter: 'fire',
    place: 'Clay Atlas',
    title: 'The Clay Atlas',
    text: 'The map of India shows where the traditions in this pavilion come from. Beside it are the partners who present the exhibition.',
    view: roomView('atlas', ROOM_DOOR_R, undefined, 3),
    item: objectItem('atlas-map'),
    dwellSec: 12,
  },
  {
    id: 'theatre',
    chapter: 'fire',
    cue: { music: 'fire', fx: ['theatre:firing'], until: 'theatre:chapterEnd' },
    place: 'Agni Theatre',
    title: 'The Agni Theatre',
    text: 'Between films the brick vault glows like a kiln being fired. Take a seat; the screen curves around you.',
    view: roomView('theatre', THEATRE_STAND_R, THEATRE.axisDeg, 4),
    item: objectItem('theatre-house'),
    // until the film chapter ends (cue.until); never longer than this
    dwellSec: 30,
  },

  // ── Return: the Red Room, the Haat, the Sphere Well and back ──
  {
    id: 'red-room',
    chapter: 'return',
    cue: { music: 'coda' },
    place: 'Kothi — the Red Room',
    title: 'The Red Room',
    text: 'A round room, red from floor to ceiling. Curved shelves hold clay from many regions of India, and on the plinth under its circle of sky stands a single pot.',
    view: polarPose(RED_ROOM_STAND_R, RED_ROOM.aDeg, outward(RED_ROOM.aDeg), 10),
    item: objectItem('library-archive'),
    dwellSec: 12,
  },
  {
    id: 'haat',
    chapter: 'return',
    place: 'The Haat',
    title: 'The Haat',
    text: 'Pieces made by potters of these traditions, under clay lanterns, with each maker’s village named once the workshop confirms it.',
    view: polarPose(SAT_WALL.innerFace + 1.5, satellite('shop').fromDeg + 8, 146, 4),
    dwellSec: 11,
  },
  {
    id: 'sphere-well',
    chapter: 'return',
    place: 'The Sphere Well',
    title: 'The Sphere Well',
    text: 'Eight metres below the plinth, a red stair winds round a hanging clay sphere. Above it the ceiling steps up in rings to a disc of sky.',
    view: perchStopView('sphere-well', 1),
    perch: { id: 'sphere-well', t: 1 },
    dwellSec: 12,
  },
  {
    id: 'return',
    chapter: 'return',
    cue: { fx: ['night:preview'] },
    place: 'Entrance Forecourt',
    title: 'Back to the forecourt',
    text: 'Back on the plinth beside the pavilion. The forecourt and the way out are round the curve of the drum, to the left.',
    view: polarLook(KEY.lobeOuterR + 1.6, MUSEUM.drum.dNotchDeg - 30, ...polar(KEY.lobeOuterR + 1.6, 120), 2),
    dwellSec: 9,
  },
]
/** Bundled stops (the admin uses them as the template for a per-exhibition tour override). */
export const BUNDLED_TOUR_STOPS: readonly TourStop[] = TOUR_STOPS.slice()
// Per-exhibition tour override from the content API (src/museum/content/exhibition.ts).
if (TOUR_OVERRIDE.stops?.length) TOUR_STOPS.splice(0, TOUR_STOPS.length, ...TOUR_OVERRIDE.stops)

/** Waypoints at radius r for each plan angle (deg). */
const ringOf = (r: number, angles: number[]) => angles.map((a) => polar(r, a))
/** Angles from `from` to `to` (deg), about every `stepDeg`, ends included. */
const span = (from: number, to: number, stepDeg: number) => {
  const n = Math.max(1, Math.round(Math.abs(to - from) / stepDeg))
  return Array.from({ length: n + 1 }, (_, i) => from + ((to - from) * i) / n)
}
/** A point at (r, aDeg) about another centre. */
const about = (cx: number, cz: number, r: number, aDeg: number): [number, number] => [cx + r * Math.cos(aDeg * DEG), cz + r * Math.sin(aDeg * DEG)]

const D = MUSEUM.drum
const AN = MUSEUM.annex
const SW = SPHERE_WELL
const RR = RED_ROOM
/** Round the building outside, between the lobe and the Sphere Well's rim. */
const OUTSIDE_R = KEY.lobeOuterR + 1.6
/** The Parikrama's centreline, every ~2.5 m (about 7° at its radius). */
const WALK_STEP_DEG = 2.5 / (serpentineR(0) * DEG)
/** The two gates: the open stretch between the notch wall and the first / last room. */
const WEST_GATE = (PARIKRAMA.fromDeg + SATELLITES[0].fromDeg) / 2
const EAST_GATE = (PARIKRAMA.toDeg + SATELLITES[SATELLITES.length - 1].toDeg) / 2
/** Bearing (about the Red Room's centre) of its door, and of its side openings into the wings. */
const RR_DOOR = Math.atan2(-RR.cz, -RR.cx) / DEG

/**
 * Navigation waypoints [x, z], all derived from the plan: the forecourt and the portal, the
 * Earth Room, the ambulatory and the three arches' thresholds, the corridor between F and H,
 * the galleries' walking line inside the formation gates and the walk round the curb, the court,
 * the notch doors, round the building outside past the Sphere Well, the Parikrama's centreline
 * and its gates, and each north-wing room's door and inside (the theatre's aisles, the Red
 * Room's door and side openings, its wings).
 * Only positions matter; edges are computed from the collision geometry.
 */
export const NAV_WAYPOINTS: [number, number][] = [
  // forecourt and the portal
  [0, MUSEUM.visitor.start.z],
  [0, KEY.annexOuterZ + 1.5],
  [-(KEY.annexOuterHalf + 2), KEY.annexOuterZ + 2],
  [KEY.annexOuterHalf + 2, KEY.annexOuterZ + 2],
  [0, AN.endZ - 1.2],
  // the Earth Room: either side of its round table under the skylight, and its mouth
  [-(AN.skylight.r + 0.9), KEY.annexSkylightZ],
  [AN.skylight.r + 0.9, KEY.annexSkylightZ],
  [0, KEY.annexMouthZ + 1.0],
  // the ambulatory, from the NE notch round to the D notch
  ...ringOf(KEY.ambMidR, span(D.neNotchDeg + 5, D.dNotchDeg - 5, 12)),
  // the three arches: outside, on the threshold, inside
  ...[ARCH.eEast, ARCH.eWest, ARCH.d].flatMap((a) => ringOf(KEY.ringOuterR + 1.0, [a.midDeg]).concat(ringOf(KEY.ringC, [a.midDeg]), ringOf(RING - 1.0, [a.midDeg]))),
  // the corridor between F and H
  ...ringOf(CORRIDOR_R, span(MUSEUM.innerMainWall.fromDeg + 8, MUSEUM.innerMainWall.toDeg - 8, 18)),
  // round F's ends into the galleries
  ...ringOf(CORRIDOR_R, [MUSEUM.innerMainWall.fromDeg - 5, MUSEUM.innerMainWall.toDeg + 5]),
  // the galleries' walking line, inside the formation gates, A → B → C
  ...ringOf(GALLERY_R, span(MUSEUM.innerMainWall.fromDeg - 6, MUSEUM.innerMainWall.toDeg + 6 - 360, 12)),
  // round the curb
  ...ringOf(CURB_WALK_R, span(-180, 150, 30)),
  // the court (inside F), either side of the bench and between it and F
  ...ringOf(COURT_R, [60, 120]),
  [0, (F_IN + (BENCHES[0]?.z ?? COURT_R) + BENCH_SIZE.depth / 2) / 2],
  // the notch doors: either side of the D door (hallway / walk) and of the NE door (walk / entry ways)
  ...ringOf(NOTCH_DOOR.rC, [D.dNotchDeg - 4, D.dNotchDeg - 360 + 5, D.neNotchDeg + 4, D.neNotchDeg - 4]),
  // round the building outside, on the landscape plinth (inside the Sphere Well's rim)
  ...ringOf(OUTSIDE_R, span(D.neNotchDeg + 8, D.dNotchDeg - 8, 14).filter((a) => Math.abs(a - 90) > 25)),
  // round the Sphere Well on its far side
  ...[-60, 0, 60].map((b) => about(SW.cx, SW.cz, SW.rimR + 1.4, Math.atan2(SW.cz, SW.cx) / DEG + b)),

  // ── North wing ──
  // the Parikrama's centreline
  ...span(PARIKRAMA.fromDeg + 3, PARIKRAMA.toDeg - 3, WALK_STEP_DEG).map((a) => polar(serpentineR(a), a)),
  // the gates between the walk and the plinth
  polar(serpentineR(WEST_GATE), WEST_GATE),
  polar(SAT_WALL.innerC + 1.5, WEST_GATE),
  polar(serpentineR(EAST_GATE), EAST_GATE),
  polar(SAT_WALL.innerC + 1.5, EAST_GATE),
  // each room's door, from the walk and from inside
  ...SATELLITES.flatMap((s) => [polar(serpentineR(s.doorDeg), s.doorDeg), polar(SAT_WALL.innerFace + 0.6, s.doorDeg)]),
  // the Atlas: its middle
  polar(ROOM_MID_R, satellite('atlas').doorDeg),
  // the theatre: lobby, round the baffle's end, the aisle in front of the rows and behind them
  polar(ROOM_MID_R, satellite('theatre').doorDeg),
  polar(THEATRE.baffle.r1 + 1.2, THEATRE.baffle.aDeg),
  polar(SAT_WALL.outerFace - 1.6, THEATRE.screenTo - 2),
  polar(SAT_WALL.outerFace - 1.6, THEATRE.screenFrom + 2),
  polar(THEATRE_STAND_R, THEATRE.axisDeg),
  polar(THEATRE_STAND_R, THEATRE.axisDeg + 10),
  // the Red Room: inside its door, beside its central plinth, and through each side opening to its wing
  polar(RED_ROOM_STAND_R, RR.aDeg),
  ...[-1, 1].flatMap((side) => [about(RR.cx, RR.cz, RR.r - 1.0, RR_DOOR + side * 90), about(RR.cx, RR.cz, RR.r + RR.t + 1.0, RR_DOOR + side * 90)]),
  polar(ROOM_MID_R, satellite('library').fromDeg + 4),
  polar(ROOM_MID_R, satellite('library').toDeg - 4),
  polar(SAT_WALL.innerFace + 1.4, satellite('library').fromDeg + 3),
  // the Haat
  ...ringOf(SAT_WALL.innerFace + 1.4, [satellite('shop').fromDeg + 5, satellite('shop').toDeg - 5]),
]
