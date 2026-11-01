/**
 * Grand scene objects: the PDF installations and set dressing (GRAND §3, §5.4 dressing, §6.3).
 * Spread into SCENE_OBJECTS (config/objects.ts). Owned by P3.
 *
 *   Earth Room (annex G, p05)   a canyon of eight eroded clay formations, two curved shelf runs
 *                               of everyday clay round a fluted table under the skylight
 *   formation gates (p05)       two formations in each of the A|B and B|C gate boxes
 *   arch flanks                 a formation either side of each E arch, inside the ring
 *   Sphere Well (p07r)          the red spiral stair and the hanging clay sphere
 *   Wine Hall (p08l)            six stepped wine plinths (W1–W6) under glass, two bust pedestals
 *                               and the end-wall relief ledge
 *   Red Room (p09r)             nine six-tier curved shelf runs round the wall, the two-tier round
 *                               plinth under the oculus and its planting
 *   Parikrama (p09l)            planted pockets: four walled courtyards on the rooms' side, four
 *                               sunken gardens on the drum's side, each with five horse plinths
 *   Haat                        a long curved shelf on the back wall
 *   dressing                    sourced models (GRAND §5.4): lanterns, boulders, bookcases,
 *                               baskets, stools, the Kumartuli bench's tools
 *
 * Positions are expressions of the named constants in museum.ts and satellites.ts
 * (tests/unit/grand-literals.test.ts fails on literal coordinates here). The exports at the end
 * (WINE_PLINTHS, RED_ROOM_SHELVES, GARDEN_PLINTHS, EARTH_ROOM) tell the crafts package where the
 * pieces can stand.
 *
 * Placeholder silence: titles are descriptive, nothing names a tradition, a place or a maker.
 */
import { ARCH, DEG, KEY, MUSEUM, polar, type Vec3 } from '../museum'
import { PARIKRAMA, RED_ROOM, SAT_DOOR_HALF_DEG, SAT_WALL, satellite, SERP_OFFSET, SERPENTINE, serpentineR, SPHERE_WELL } from '../satellites'
import type { SceneObjectConfig } from '../objects'
import type { ZoneId } from '../layout'
import { at, facingAlong, facingIn, facingOut } from '../spectacleObjects/place'

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

/** A floor point about (cx, cz) (plan angle in degrees), at height y. */
const about = (cx: number, cz: number, r: number, aDeg: number, y = 0): Vec3 => {
  const [x, z] = polar(r, aDeg, cx, cz)
  return [x, y, z]
}
/** A curved run on radius `r` spanning `spanDeg`: its chord and sagitta (for the collider box). */
const runBox = (r: number, spanDeg: number, depth: number): [number, number] => {
  const half = (spanDeg / 2) * DEG
  return [2 * r * Math.sin(half), depth + r * (1 - Math.cos(half))]
}
const parikramaZone = (aDeg: number): ZoneId => (aDeg < PARIKRAMA.split ? 'parikrama-west' : 'parikrama-east')

/* ------------------------------------------------------------------ */
/* Earth Room (annex G)                                                */
/* ------------------------------------------------------------------ */

const AN = MUSEUM.annex
/** The round table under the skylight. */
const TABLE = { x: 0, z: KEY.annexSkylightZ, r: AN.skylight.r * 0.6, h: 0.9 }
/** The two shelf runs round the table: centreline radius about it, span and depth. */
const EARTH_SHELF = { r: KEY.annexHalf - 0.77, spanDeg: 60, depth: 0.3, tiers: 3, gap: 0.55 }
/**
 * The formations stand a hand's breadth off the side walls: the lamps of Diya Night run along
 * the walls' foot (config/diyas.ts, x = ±(annexHalf − 0.25)) and glow behind them.
 */
const SIDE = KEY.annexHalf
/** x of a formation of depth d whose collider stops short of the wall's lamp line. */
const offWall = (d: number) => SIDE - 0.32 - d / 2
const MOUTH = KEY.annexMouthZ
const END = AN.endZ

/** The formations' tallest: just under the annex's soffit, so the canyon closes overhead (p05). */
const CANYON_H = MUSEUM.pavilion.ceilingHeight - 0.25

/** The Earth Room's formations: x (signed), z, footprint [w, d], height, seed, palette, source. */
const EARTH_FORMATIONS: { x: number; z: number; w: number; d: number; h: number; seed: number; palette: string; source?: string }[] = [
  // by the portal: the broad pair of wind-cut masses that frames the way in (p05's canyon), floor to soffit
  { x: offWall(2.2), z: END - 1.65, w: 3.0, d: 2.2, h: CANYON_H, seed: 3, palette: 'rose' },
  { x: -offWall(2.2), z: END - 1.65, w: 3.0, d: 2.2, h: CANYON_H - 0.4, seed: 8, palette: 'terracotta' },
  // a low ledge stack at each one's foot, towards the table
  { x: offWall(1.3), z: END - 3.85, w: 1.1, d: 1.3, h: 2.3, seed: 13, palette: 'rose' },
  { x: -offWall(1.3), z: END - 3.85, w: 1.1, d: 1.3, h: 2.0, seed: 21, palette: 'rose' },
  // by the mouth: a tall mass each side, opening the view to H between them, and a low stack
  { x: -offWall(2.0), z: MOUTH + 1.6, w: 2.8, d: 2.0, h: CANYON_H - 0.2, seed: 55, palette: 'rose' },
  { x: offWall(2.0), z: MOUTH + 1.6, w: 2.8, d: 2.0, h: CANYON_H, seed: 89, palette: 'terracotta' },
  { x: -offWall(1.2), z: MOUTH + 3.55, w: 1.0, d: 1.2, h: 1.6, seed: 144, palette: 'terracotta' },
  // a wide, shallow canyon face hugging each side wall behind its shelf run, floor to soffit (p05)
  { x: -(SIDE - 0.32 - 0.15), z: KEY.annexSkylightZ, w: 4.6, d: 0.3, h: CANYON_H, seed: 233, palette: 'terracotta' },
  { x: SIDE - 0.32 - 0.15, z: KEY.annexSkylightZ, w: 4.6, d: 0.3, h: CANYON_H, seed: 377, palette: 'rose' },
]

/** Everyday clay on the two runs: cups, water pots, lamps, cooking pots, griddles, lamp towers. */
/** Sparse, as p05 shows them: a few pieces to a blade, room between them. */
const EVERYDAY = ['kulhad|6', 'matka|3', 'diya|5', 'surahi|2', 'handi|2', 'lamp-stack|2', 'wc-revolved-vase-001|2|terracotta', 'ph-planter-pot-clay|2'].join('\n')

const earthRoom: SceneObjectConfig[] = [
  {
    id: 'earth-table',
    title: 'Round table',
    kind: 'round-table',
    position: [TABLE.x, 0, TABLE.z],
    // no footprint: the annex's axis stays an open line of sight from the portal to the mouth
    // (tests/unit/pavilion-geometry); the tour walks round the table (config/tour.ts waypoints)
    height: TABLE.h,
    props: { r: TABLE.r, height: TABLE.h, flutes: 48, finish: 'timber' },
    zone: 'annex',
    alt: 'A round timber table on a fluted clay drum stands in a pool of daylight under a round skylight.',
  },
  ...([1, -1] as const).map<SceneObjectConfig>((side, i) => {
    const aDeg = side > 0 ? 0 : 180
    return {
      id: `earth-shelf-${i + 1}`,
      title: 'Everyday clay',
      kind: 'curved-shelf',
      position: about(TABLE.x, TABLE.z, EARTH_SHELF.r, aDeg),
      rotationDeg: facingIn(aDeg),
      footprint: runBox(EARTH_SHELF.r, EARTH_SHELF.spanDeg, EARTH_SHELF.depth),
      height: 0.14 + EARTH_SHELF.tiers * EARTH_SHELF.gap,
      props: { curveR: EARTH_SHELF.r, spanDeg: EARTH_SHELF.spanDeg, tiers: EARTH_SHELF.tiers, tierGap: EARTH_SHELF.gap, depth: EARTH_SHELF.depth, finish: 'clay', items: EVERYDAY, lit: true },
      interactive: true,
      placeholder: true,
      description: 'Cups, water pots, lamps, cooking pots and griddles: the clay a household uses every day, on shelves that curve round the table.',
      zone: 'annex',
      alt: 'Three thin curved blades of pale clay float one above another, lit from beneath, with a few small red and buff clay cups, water pots, lamps and a lamp tower on each.',
    }
  }),
  ...EARTH_FORMATIONS.map<SceneObjectConfig>((f, i) => ({
    id: `earth-formation-${i + 1}`,
    title: 'Clay formation',
    kind: 'eroded-formation',
    position: [f.x, 0, f.z],
    // the formations turn their broad side to the hall
    rotationDeg: f.x > 0 ? -90 : 90,
    footprint: [f.w, f.d],
    height: f.h,
    props: { height: f.h, width: f.w, depth: f.d, seed: f.seed, strata: Math.round(f.h * 1.3), source: f.source ?? '', palette: f.palette },
    zone: 'annex',
    alt: 'A tall pillar of layered clay, worn by wind and water into ledges and hollows, banded in terracotta, rose and ochre.',
  })),
  // boulders at the feet of the portal's masses, on the hall's side
  ...([1, -1] as const).map<SceneObjectConfig>((side, i) => ({
    id: `earth-boulder-${i + 1}`,
    title: 'Boulder',
    kind: 'sourced-model',
    position: [side * (SIDE - 2.55), 0, END - 3.3],
    rotationDeg: side * 35,
    footprint: [0.9, 0.6],
    height: 0.45,
    props: { slug: 'ph-namaqualand-boulder-05', finish: 'asis', lod: true },
    zone: 'annex',
    alt: 'A low weathered boulder.',
  })),
]

/* ------------------------------------------------------------------ */
/* formation gates and arch flanks                                     */
/* ------------------------------------------------------------------ */

const FIN = MUSEUM.fins
/** The gate box's radial middle and its half lengths. */
const GATE = { mid: (FIN.r0 + FIN.r1) / 2, halfR: (FIN.r1 - FIN.r0) / 2, halfT: FIN.thickness / 2 }

const gates: SceneObjectConfig[] = FIN.atDeg.flatMap((aDeg, g) => {
  const zone: ZoneId = g === 0 ? 'ring-b' : 'ring-c'
  // the main pillar in the outer part of the box, a lower one towards the court; both stay inside it
  // one broad wind-cut mass filling the box, and a low ledge stack at its court end
  const main = { r: GATE.mid + GATE.halfR * 0.18, w: FIN.thickness * 0.98, d: GATE.halfR * 1.6, h: FIN.height * 0.88 }
  const low = { r: GATE.mid - GATE.halfR * 0.72, w: FIN.thickness * 0.8, d: GATE.halfR * 0.5, h: FIN.height * 0.4 }
  return [main, low].map<SceneObjectConfig>((p, k) => ({
    id: `gate-formation-${g + 1}-${k + 1}`,
    title: 'Clay formation',
    kind: 'eroded-formation',
    position: at(p.r, aDeg),
    rotationDeg: facingIn(aDeg),
    // the gate's wall collider holds the visitor off; the pillar keeps within it
    // the main pillar is the scanned rock face (Poly Haven, triplanar raw clay in the PDF's strata);
    // the low stack stays procedural. Terracotta and rose: the ochre read as tan pancakes
    props: { height: p.h, width: p.w, depth: p.d, seed: 200 + g * 10 + k, strata: Math.round(p.h * 1.3), palette: g === 0 ? 'rose' : 'terracotta', source: k === 0 ? 'ph-rock-face-01' : '' },
    zone,
    alt: 'A pillar of eroded, banded clay standing between two galleries like a gate.',
  }))
})

/** A formation either side of each E arch, against the ring wall inside it. */
/** Flush against the ring wall and shallow (d 0.6), so the lippan corridor keeps its clear middle. */
const FLANK = { r: KEY.ringR - 0.3 - 0.03, w: 1.5, d: 0.6, gapDeg: 1.2 }
const flanks: SceneObjectConfig[] = [ARCH.eEast, ARCH.eWest].flatMap((a, i) =>
  [a.fromDeg - FLANK.gapDeg - ((FLANK.w / 2) / FLANK.r) / DEG, a.toDeg + FLANK.gapDeg + ((FLANK.w / 2) / FLANK.r) / DEG].map<SceneObjectConfig>((aDeg, k) => ({
    id: `arch-formation-${i + 1}-${k + 1}`,
    title: 'Clay formation',
    kind: 'eroded-formation',
    position: at(FLANK.r, aDeg),
    rotationDeg: facingIn(aDeg),
    footprint: [FLANK.w, FLANK.d],
    height: ARCH.eEast.apex - 1.6 - k * 1.0,
    props: { height: ARCH.eEast.apex - 1.6 - k * 1.0, width: FLANK.w, depth: FLANK.d, seed: 300 + i * 10 + k, strata: 7, palette: i === 0 ? 'terracotta' : 'rose' },
    zone: 'entry-e',
    alt: 'A pillar of eroded, banded clay beside the great arch.',
  })),
)

/* ------------------------------------------------------------------ */
/* the Sphere Well                                                     */
/* ------------------------------------------------------------------ */

const SW = SPHERE_WELL
/** The stair's radii: from just outside the sphere's orbit to 0.4 m short of the room's wall. */
const WELL_STAIR = { r0: SW.roomR - 1.9, r1: SW.roomR - 0.4, rise: SW.terraceTopY - SW.floorY }

const sphereWell: SceneObjectConfig[] = [
  {
    id: 'well-stair',
    title: 'Spiral stair',
    kind: 'spiral-stair',
    position: [SW.cx, SW.floorY, SW.cz],
    rotationDeg: 0,
    props: { r0: WELL_STAIR.r0, r1: WELL_STAIR.r1, turns: 1.25, rise: WELL_STAIR.rise, finish: 'red' },
    zone: 'entrance-court',
    alt: 'A red clay stair winds round the walls of a deep round room, up towards a stepped opening of sky.',
  },
  {
    id: 'well-sphere',
    title: 'Clay sphere',
    kind: 'clay-sphere',
    position: [SW.cx, SW.sphereY, SW.cz],
    props: { r: SW.sphereR, spinSec: 240, finish: 'red' },
    zone: 'entrance-court',
    alt: 'A great burnished sphere of red clay hangs from a slender rod at the centre of the round room, turning slowly.',
  },
]

/* ------------------------------------------------------------------ */
/* the Wine Hall (hallway D)                                           */
/* ------------------------------------------------------------------ */

const DW = MUSEUM.hallwayWall
/**
 * The plinths stand before the lobe wall, their collider (plinth plus a margin for the label
 * rail) stopping short of the wall's lamp line (config/diyas.ts, r = lobeR − 0.22): at night the
 * lamps glow in the gap behind them.
 */
/** Two treads, the top at eye-level display height (1.3 m), under glass: small scans read there (p08l). */
const WINE = { depth: 0.9, width: 2.4, height: 1.3, steps: 2, railDepth: 0.1 }
const WINE_LAMPS = KEY.lobeR - 0.22
const WINE_R = WINE_LAMPS - 0.06 - (WINE.depth + WINE.railDepth * 2) / 2
/** W1 … W6 along the hall, three either side of the hallway's stamp post (190°). */
const HALL_END = MUSEUM.drum.dNotchDeg
const WINE_DEGS = [DW.fromDeg + 8, DW.fromDeg + 17.5, DW.fromDeg + 27, HALL_END - 22, HALL_END - 13, HALL_END - 5]
/** Two tall pedestals for busts out from the hall's inner wall (clear of its drying shelves and lamps), and the end-wall relief ledge. */
const BUST_DEGS = [DW.fromDeg + 12, DW.fromDeg + 34]
const BUST = { w: 0.46, d: 0.46, h: 1.36 }
const BUST_R = DW.r + DW.thickness / 2 + 1.15
/** Glass on every set but W5 (the heads and figures, which stand open as a group, p08l). */
const WINE_VITRINES = new Set([0, 1, 2, 3, 5])
const RELIEF_DEG = DW.fromDeg + 3.5

const wineHall: SceneObjectConfig[] = [
  ...WINE_DEGS.map<SceneObjectConfig>((aDeg, i) => ({
    id: `wine-plinth-${i + 1}`,
    title: `Plinth W${i + 1}`,
    kind: 'wine-plinth',
    position: at(WINE_R, aDeg),
    rotationDeg: facingIn(aDeg),
    // the plinth and its label rail in front
    footprint: [WINE.width, WINE.depth + WINE.railDepth * 2],
    height: WINE.height,
    props: { steps: WINE.steps, width: WINE.width, depth: WINE.depth, height: WINE.height, vitrine: WINE_VITRINES.has(i) },
    zone: 'hallway-d',
    alt: WINE_VITRINES.has(i) ? 'A stepped plinth in deep wine-red lacquer under a glass hood, with a brass label rail in front.' : 'An open stepped plinth in deep wine-red lacquer, with a brass label rail in front.',
  })),
  ...BUST_DEGS.map<SceneObjectConfig>((aDeg, i) => ({
    id: `wine-pedestal-${i + 1}`,
    title: 'Pedestal',
    kind: 'wine-plinth',
    position: at(BUST_R, aDeg),
    rotationDeg: facingOut(aDeg),
    footprint: [BUST.w, BUST.d + WINE.railDepth * 2],
    height: BUST.h,
    props: { steps: 1, width: BUST.w, depth: BUST.d, height: BUST.h, vitrine: false },
    zone: 'hallway-d',
    alt: 'A tall, slender wine-red pedestal, open, with a carved stone figure standing on it.',
  })),
  {
    id: 'wine-relief-ledge',
    title: 'Relief ledge',
    kind: 'wine-plinth',
    position: at(WINE_LAMPS - 0.06 - (0.36 + WINE.railDepth * 2) / 2, RELIEF_DEG),
    rotationDeg: facingIn(RELIEF_DEG),
    footprint: [1.6, 0.36 + WINE.railDepth * 2],
    height: 0.9,
    props: { steps: 1, width: 1.6, depth: 0.36, height: 0.9, vitrine: false },
    zone: 'hallway-d',
    alt: 'A low wine-red ledge against the end of the hall, made to carry a carved relief.',
  },
]

/* ------------------------------------------------------------------ */
/* the Red Room (p09r)                                                 */
/* ------------------------------------------------------------------ */

const RR = RED_ROOM
const RR_SHELF = { depth: 0.34, tiers: 6, gap: 0.47, margin: 2.5 }
const RR_SHELF_R = RR.r - 0.03 - RR_SHELF.depth / 2
/** Bearings about the room's centre: the door faces the drum's centre, the side openings along the crescent. */
const RR_DOOR = Math.atan2(-RR.cz, -RR.cx) / DEG
const RR_DOOR_HALF = Math.asin(RR.doorWidth / 2 / (RR.r + RR.t / 2)) / DEG + RR_SHELF.margin
const RR_SIDE_HALF = Math.asin(RR.sideWidth / 2 / (RR.r + RR.t / 2)) / DEG + RR_SHELF.margin
/** The wall's three runs between the openings, split into runs of about 30°. */
const RR_RUNS: [number, number][] = [
  [RR_DOOR + 90 + RR_SIDE_HALF, RR_DOOR + 270 - RR_SIDE_HALF],
  [RR_DOOR - 90 + RR_SIDE_HALF, RR_DOOR - RR_DOOR_HALF],
  [RR_DOOR + RR_DOOR_HALF, RR_DOOR + 90 - RR_SIDE_HALF],
]
const RR_SEGMENTS = RR_RUNS.flatMap(([a0, a1]) => {
  const n = Math.max(1, Math.round((a1 - a0) / 30))
  const span = (a1 - a0) / n
  return Array.from({ length: n }, (_, i) => ({ mid: a0 + span * (i + 0.5), span: span - 0.6 }))
})
/** The shelves' generic stock by run (bodies only: the traditions' own pieces are placed on them by the crafts list). */
const RR_STOCK = [
  'vase|5|blue\njar|4|white\nlidded|4|black\nbowl|6|buff\nsurahi|3|red',
  'matka|4|red\nvase|5|blush\nbowl|6|ochre\nkulhad|10|terracotta',
  'ghatam|3|black\njar|4|grey\nvase|4|buff\nbowl|8|terracotta',
  'lidded|5|black\nsurahi|4|red\nkulhad|12|terracotta\ndiya|10|ochre',
  'handi|3|red\nmatka|4|terracotta\nvase|5|white\nbowl|6|blush',
]
const RR_PLINTH = { tiers: 2, r: 1.4, h: 0.6 }

const redRoom: SceneObjectConfig[] = [
  ...RR_SEGMENTS.map<SceneObjectConfig>((s, i) => ({
    id: `red-shelf-${i + 1}`,
    title: 'Red shelves',
    kind: 'curved-shelf',
    position: about(RR.cx, RR.cz, RR_SHELF_R, s.mid),
    rotationDeg: facingIn(s.mid),
    footprint: runBox(RR_SHELF_R, s.span, RR_SHELF.depth),
    height: 0.14 + RR_SHELF.tiers * RR_SHELF.gap,
    props: { curveR: RR_SHELF_R, spanDeg: s.span, tiers: RR_SHELF.tiers, tierGap: RR_SHELF.gap, depth: RR_SHELF.depth, finish: 'lacquer-red', items: RR_STOCK[i % RR_STOCK.length], lit: true },
    interactive: true,
    placeholder: true,
    description: 'Red shelves round the room hold clay from many traditions: water pots, lamps, glazed and burnished vessels, toys and figures.',
    zone: 'library',
    alt: 'Floor-to-ceiling curved red shelves following the round wall, each board lit from below and crowded with vessels in red, black, buff, white and blue clay.',
  })),
  {
    id: 'red-plinth',
    title: 'Round plinth',
    kind: 'round-plinth',
    position: [RR.cx, 0, RR.cz],
    footprint: [RR_PLINTH.r * 2, RR_PLINTH.r * 2],
    height: RR_PLINTH.tiers * RR_PLINTH.h,
    props: { tiers: RR_PLINTH.tiers, r: RR_PLINTH.r, h: RR_PLINTH.h, color: '#7d1a17' },
    zone: 'library',
    alt: 'A two-tier round plinth in red lacquer under the room’s round skylight, its lower tier planted.',
  },
  // the planting round the plinth's lower tier (p09r's flowers)
  ...[45, 135, 225, 315].map<SceneObjectConfig>((b, i) => ({
    id: `red-plant-${i + 1}`,
    title: 'Plant',
    kind: 'sourced-model',
    position: about(RR.cx, RR.cz, (RR_PLINTH.r + RR_PLINTH.r * 0.66) / 2, RR_DOOR + b, RR_PLINTH.h),
    rotationDeg: RR_DOOR + b,
    props: { slug: i % 2 ? 'ph-anthurium-botany-01' : 'ph-calathea-orbifolia-01', finish: 'asis', lod: true },
    zone: 'library',
    alt: 'Broad green leaves and red flowers planted in the plinth’s lower tier.',
  })),
]

/* ------------------------------------------------------------------ */
/* the Parikrama's gardens (p09l)                                      */
/* ------------------------------------------------------------------ */

const S = SERPENTINE
/** The drum-side pocket's middle at plan angle a: between the ring's outer face and the parapet. */
const gardenMid = (aDeg: number) => (PARIKRAMA.r0 + serpentineR(aDeg) - SERP_OFFSET - S.t / 2) / 2
/** The rooms'-side pocket's middle: between the courtyard wall and the rooms' inner wall. */
const courtMid = (aDeg: number) => (serpentineR(aDeg) + SERP_OFFSET + S.t / 2 + SAT_WALL.innerC - SAT_WALL.t / 2) / 2
/** The parapet's walk-side line: the horses' plinths stand a metre in from it, facing the walk. */
const parapetIn = (aDeg: number) => serpentineR(aDeg) - SERP_OFFSET - S.t / 2

/** Walled courtyards on the rooms' side (round the drum touches) and sunken gardens on the drum's side (round the doors). */
const doorDeg = (id: 'atlas' | 'theatre' | 'library' | 'shop') => satellite(id).doorDeg
const COURTS = [
  { aDeg: doorDeg('atlas') + 23, trees: 'ph-searsia-lucida|3.7\nph-quiver-tree-01|3.3', shrubs: 9, basin: false },
  { aDeg: (doorDeg('atlas') + doorDeg('theatre')) / 2, trees: 'ph-searsia-lucida|4.2', shrubs: 7, basin: true },
  { aDeg: doorDeg('theatre') - 23, trees: 'ph-searsia-lucida|3.7\nph-searsia-lucida|3.1', shrubs: 9, basin: false },
  { aDeg: (doorDeg('library') + doorDeg('shop')) / 2, trees: 'ph-quiver-tree-01|3.0', shrubs: 5, basin: false },
]
const GARDENS = [
  { aDeg: doorDeg('atlas') - 1, trees: 'ph-searsia-lucida|3.4\nph-searsia-lucida|2.8', shrubs: 12 },
  { aDeg: doorDeg('theatre') - 6, trees: 'ph-searsia-lucida|3.6', shrubs: 10 },
  { aDeg: doorDeg('library') + 4, trees: 'ph-searsia-lucida|3.2', shrubs: 10 },
  { aDeg: doorDeg('shop') + 1.5, trees: 'ph-searsia-lucida|3.5\nph-quiver-tree-01|2.8', shrubs: 12 },
]
/** Five horse plinths per garden, a little apart, in from the parapet. */
const HORSE = { r: 0.34, h: 0.28, pitch: 0.82, inset: 1.05 }
/** Where each of a garden's five plinths stands along the parapet (in pitches from the middle). */
const HORSE_SPREAD = [-2.3, -1.05, 0.05, 0.95, 2.2]
/** Each plinth's variation: tiers (top = tiers × h), girth, set-back from the line and clay. */
const HORSE_VARY = [
  { tiers: 1, girth: 1.0, back: 0, color: '#8a3324' },
  { tiers: 2, girth: 1.15, back: 0.5, color: '#9a4a32' },
  { tiers: 1, girth: 0.9, back: 0.25, color: '#7a2e22' },
  { tiers: 3, girth: 1.2, back: 0.65, color: '#a85a3e' },
  { tiers: 2, girth: 1.0, back: 0.1, color: '#8a3324' },
  { tiers: 1, girth: 1.1, back: 0.45, color: '#6e3a2c' },
  { tiers: 2, girth: 0.95, back: 0.2, color: '#9a4a32' },
]

const gardens: SceneObjectConfig[] = [
  ...COURTS.map<SceneObjectConfig>((c, i) => ({
    id: `courtyard-${i + 1}`,
    title: 'Courtyard garden',
    kind: 'courtyard-garden',
    position: at(courtMid(c.aDeg), c.aDeg),
    rotationDeg: facingIn(c.aDeg),
    props: { trees: c.trees, shrubs: c.shrubs, gravel: true, basin: c.basin, seed: 10 + i },
    zone: parikramaZone(c.aDeg),
    alt: 'A small walled courtyard of trees, low shrubs, boulders and gravel behind a red wall.',
  })),
  ...GARDENS.map<SceneObjectConfig>((g, i) => ({
    id: `garden-${i + 1}`,
    title: 'Sunken garden',
    kind: 'courtyard-garden',
    position: at(gardenMid(g.aDeg), g.aDeg),
    rotationDeg: facingOut(g.aDeg),
    props: { trees: g.trees, shrubs: g.shrubs, gravel: true, basin: false, seed: 20 + i },
    zone: parikramaZone(g.aDeg),
    alt: 'A sunken garden behind a low red parapet: trees, shrubs and gravel at the foot of the drum.',
  })),
  ...GARDENS.flatMap((g, i) =>
    Array.from({ length: 5 }, (_, k) => {
      // a loose group, never a row: uneven spacing, alternately nearer the parapet and deeper in
      // the garden, on plinths of one, two or three tiers of differing girth and clay
      const v = HORSE_VARY[(k + i * 2) % HORSE_VARY.length]
      const r = parapetIn(g.aDeg) - HORSE.inset - v.back
      const aDeg = g.aDeg + (HORSE_SPREAD[k] * HORSE.pitch) / r / DEG
      return {
        id: `garden-${i + 1}-plinth-${k + 1}`,
        title: 'Horse plinth',
        kind: 'round-plinth',
        position: at(r, aDeg),
        rotationDeg: facingOut(aDeg),
        props: { tiers: v.tiers, r: HORSE.r * v.girth, h: HORSE.h, color: v.color },
        zone: parikramaZone(g.aDeg),
        alt: 'A low round plinth of red clay in the garden.',
      } satisfies SceneObjectConfig
    }),
  ),
]

/* ------------------------------------------------------------------ */
/* the Haat, the library wings, the theatre lobby                      */
/* ------------------------------------------------------------------ */

const SHOP = satellite('shop')
const LIB = satellite('library')
const HAAT_SHELF = { depth: 0.38, tiers: 5, gap: 0.42, spanDeg: 7.4 }
const HAAT_SHELF_R = SAT_WALL.outerFace - 0.04 - HAAT_SHELF.depth / 2
/** The side runs: centred `inset` degrees in from the room's ends, each `spanDeg` long. */
const HAAT_SIDE = { inset: 5.2, spanDeg: 6.6 }
/** The inner wall's plaques: how many, where the row starts (deg from the room's start), pitch, height, size. */
const HAAT_PLAQUES = { n: 7, from: 6.2, step: 2.4, y: 1.55, size: 0.62, motifs: ['rider', 'deity', 'canopy', 'serpent', 'procession'] }
/** A point `d` metres in from a room's end wall (along the arc at radius r). */
const fromEnd = (r: number, endDeg: number, d: number, sense: 1 | -1) => endDeg + (sense * d) / r / DEG
/** The Poly Haven display stand (depth across, width along the wall, height), and the Haat's end-wall stands. */
const DISPLAY_STAND = { d: 0.37, w: 1.08, h: 1.556 }
const HAAT_MID = (SAT_WALL.innerFace + SAT_WALL.outerFace) / 2
const HAAT_STANDS = [
  { end: SHOP.fromDeg, sense: 1 as const, r: HAAT_MID + 0.8 },
  { end: SHOP.fromDeg, sense: 1 as const, r: SAT_WALL.outerFace - 2.4 },
  { end: SHOP.toDeg, sense: -1 as const, r: SAT_WALL.innerFace + 2.4 },
  { end: SHOP.toDeg, sense: -1 as const, r: HAAT_MID + 0.4 },
  { end: SHOP.toDeg, sense: -1 as const, r: SAT_WALL.outerFace - 2.4 },
]
/** The round tables either side of the kiln-load table (deg from the door's axis). */
const HAAT_TABLE_DEG = 6.2
/** The bookcase model's depth and width (m). */
const BOOKCASE = { w: 1.37, d: 0.58, h: 2.06 }
/** The Kumartuli bench's place: in the theatre lobby, near its east end wall. */
const KUMARTULI = { r: SAT_WALL.outerFace - 3.4, aDeg: satellite('theatre').toDeg - 2.2 }

const rooms: SceneObjectConfig[] = [
  {
    id: 'haat-curved-shelf',
    title: 'Pots on the shelves',
    kind: 'curved-shelf',
    position: at(HAAT_SHELF_R, SHOP.doorDeg),
    rotationDeg: facingIn(SHOP.doorDeg),
    footprint: runBox(HAAT_SHELF_R, HAAT_SHELF.spanDeg, HAAT_SHELF.depth),
    height: 0.14 + HAAT_SHELF.tiers * HAAT_SHELF.gap,
    props: {
      curveR: HAAT_SHELF_R,
      spanDeg: HAAT_SHELF.spanDeg,
      tiers: HAAT_SHELF.tiers,
      tierGap: HAAT_SHELF.gap,
      depth: HAAT_SHELF.depth,
      finish: 'timber',
      items: 'matka|9\nsurahi|7\nkulhad|30\ndiya|20\nhandi|5\nlamp-stack|4\nvase|8\nbowl|10',
      lit: true,
    },
    interactive: true,
    placeholder: true,
    description: 'Water pots, cups, lamps and bowls made by potters of these traditions. Each piece’s maker, village and price are given once the workshop confirms them.',
    zone: 'shop',
    alt: 'A long curved timber shelf on the back wall, lit under every board, crowded with clay pots, cups and lamps.',
  },
  ...[-1.6, -0.55, 0.55, 1.6].map<SceneObjectConfig>((k, i) => ({
    id: `haat-basket-${i + 1}`,
    title: 'Basket',
    kind: 'sourced-model',
    position: at(HAAT_SHELF_R - 0.75, SHOP.doorDeg + k * 1.3),
    rotationDeg: facingIn(SHOP.doorDeg) + i * 23,
    props: { slug: 'ph-wicker-basket-01', finish: 'asis', lod: true },
    zone: 'shop',
    alt: 'A shallow wicker basket on the floor.',
  })),
  // curved runs either side of the back wall's (PDF p05, p09r "curved shelving"): the outer wall
  // is one long sweep of lit shelves, never straight bookcases
  ...[SHOP.fromDeg + HAAT_SIDE.inset, SHOP.toDeg - HAAT_SIDE.inset].map<SceneObjectConfig>((aDeg, i) => ({
    id: `haat-side-shelf-${i + 1}`,
    title: 'Pots on the shelves',
    kind: 'curved-shelf',
    position: at(HAAT_SHELF_R, aDeg),
    rotationDeg: facingIn(aDeg),
    footprint: runBox(HAAT_SHELF_R, HAAT_SIDE.spanDeg, HAAT_SHELF.depth),
    height: 0.14 + HAAT_SHELF.tiers * HAAT_SHELF.gap,
    props: {
      curveR: HAAT_SHELF_R,
      spanDeg: HAAT_SIDE.spanDeg,
      tiers: HAAT_SHELF.tiers,
      tierGap: HAAT_SHELF.gap,
      depth: HAAT_SHELF.depth,
      finish: 'timber',
      items: i === 0 ? 'kulhad|24\nmatka|6\ndiya|14\nbowl|8\nlamp-stack|3' : 'surahi|8\nvase|8\nhandi|5\nkulhad|18\ndiya|10',
      lit: true,
    },
    interactive: true,
    placeholder: true,
    description: 'Water pots, cups, lamps and bowls made by potters of these traditions. Each piece’s maker, village and price are given once the workshop confirms them.',
    zone: 'shop',
    alt: 'A curved timber shelf along the wall, lit under every board, crowded with clay pots, cups and lamps.',
  })),
  // the inner wall: a frieze of hanging plaques over the counter side, as a stall hangs its wares
  ...Array.from({ length: HAAT_PLAQUES.n }, (_, k) => SHOP.fromDeg + HAAT_PLAQUES.from + k * HAAT_PLAQUES.step)
    // the door from the Parikrama is in this wall: the row parts round it
    .filter((aDeg) => Math.abs(aDeg - SHOP.doorDeg) > SAT_DOOR_HALF_DEG + 1.6)
    .map((aDeg, k): SceneObjectConfig => {
    return {
      id: `haat-plaque-${k + 1}`,
      title: 'Votive plaque',
      kind: 'votive-plaque',
      position: at(SAT_WALL.innerFace + 0.05, aDeg, HAAT_PLAQUES.y),
      rotationDeg: facingOut(aDeg),
      height: HAAT_PLAQUES.size,
      props: { motif: HAAT_PLAQUES.motifs[k % HAAT_PLAQUES.motifs.length], size: HAAT_PLAQUES.size },
      interactive: true,
      placeholder: true,
      description: 'Painted clay plaques made by potters of these traditions. Each piece’s maker, village and price are given once the workshop confirms them.',
      zone: 'shop',
      alt: 'A painted clay plaque hung on the wall.',
    }
  }),
  // the end walls: open timber display stands (Poly Haven) back to the wall, a big glazed pot on
  // each and more on the floor before them, so the Haat reads as a full market hall
  ...HAAT_STANDS.flatMap(({ end, sense, r }, i): SceneObjectConfig[] => {
    const aDeg = fromEnd(r, end, SAT_WALL.t / 2 + 0.04 + DISPLAY_STAND.d / 2, sense)
    const potDeg = fromEnd(r, end, SAT_WALL.t / 2 + DISPLAY_STAND.d + 0.55, sense)
    return [
      {
        id: `haat-stand-${i + 1}`,
        title: 'Display stand',
        kind: 'sourced-model',
        position: at(r, aDeg),
        rotationDeg: facingIn(aDeg),
        footprint: [DISPLAY_STAND.d, DISPLAY_STAND.w],
        height: DISPLAY_STAND.h,
        props: { slug: 'ph-wooden-display-shelves-01', finish: 'asis', lod: true },
        zone: 'shop',
        alt: 'An open timber display stand against the end wall.',
      },
      {
        id: `haat-stand-pot-${i + 1}`,
        title: 'Glazed pot',
        kind: 'sourced-model',
        position: at(r, aDeg, DISPLAY_STAND.h),
        rotationDeg: facingIn(aDeg) + i * 41,
        height: 0.37,
        props: { slug: 'ph-ceramic-pot', finish: 'asis', lod: true },
        zone: 'shop',
        alt: 'A round glazed pot on top of the stand.',
      },
      ...[-0.42, 0.38].map<SceneObjectConfig>((dr, k) => ({
        id: `haat-floor-pot-${i * 2 + k + 1}`,
        title: 'Glazed pot',
        kind: 'sourced-model',
        position: at(r + dr, potDeg),
        rotationDeg: i * 57 + k * 90,
        footprint: [0.62, 0.5],
        height: 0.37 * (k ? 1.25 : 1),
        props: { slug: 'ph-ceramic-pot', finish: 'asis', lod: true },
        zone: 'shop',
        alt: 'A round glazed pot on the floor.',
      })),
    ]
  }),
  // two round timber tables either side of the kiln-load table, each with a few pots
  ...[-1, 1].flatMap((side, i): SceneObjectConfig[] => {
    const aDeg = SHOP.doorDeg + side * HAAT_TABLE_DEG
    const [x, z] = polar(HAAT_MID, aDeg)
    const top = 1.005
    return [
      {
        id: `haat-round-table-${i + 1}`,
        title: 'Round table',
        kind: 'sourced-model',
        position: [x, 0, z],
        rotationDeg: i * 30,
        footprint: [1.4, 1.4],
        height: top,
        props: { slug: 'ph-round-wooden-table-01', finish: 'asis', lod: true },
        zone: 'shop',
        alt: 'A round timber table with a few clay pots on it.',
      },
      ...(['matka', 'surahi', 'handi'] as const).map<SceneObjectConfig>((form, k) => {
        const a = (k / 3) * Math.PI * 2 + i
        return {
          id: `haat-table-pot-${i * 3 + k + 1}`,
          title: 'Clay pot',
          kind: 'clay-vessel',
          position: [x + Math.cos(a) * 0.38, top, z + Math.sin(a) * 0.38],
          rotationDeg: k * 50,
          height: form === 'surahi' ? 0.36 : 0.26,
          props: { form, clay: k === 1 ? 'red' : k === 2 ? 'black' : 'terracotta', burnish: 0.4 },
          interactive: true,
          placeholder: true,
          description: 'Water pots, cups, lamps and bowls made by potters of these traditions. Each piece’s maker, village and price are given once the workshop confirms them.',
          zone: 'shop',
          alt: 'A clay pot on the table.',
        }
      }),
    ]
  }),
  // more baskets on the floor round the tables
  ...[-1, 1].map<SceneObjectConfig>((side, i) => ({
    id: `haat-basket-${5 + i}`,
    title: 'Basket',
    kind: 'sourced-model',
    position: at(HAAT_MID - 1.3, SHOP.doorDeg + side * (HAAT_TABLE_DEG + 1.6)),
    rotationDeg: i * 70,
    props: { slug: 'ph-wicker-basket-01', finish: 'asis', lod: true },
    zone: 'shop',
    alt: 'A shallow wicker basket on the floor.',
  })),
  {
    id: 'haat-stool',
    title: 'Stool',
    kind: 'sourced-model',
    position: at(SAT_WALL.innerFace + 0.5, SHOP.fromDeg + 5.6),
    rotationDeg: facingIn(SHOP.fromDeg + 5.6),
    footprint: [0.45, 0.45],
    height: 0.44,
    props: { slug: 'ph-wooden-stool-01', finish: 'asis', lod: true },
    zone: 'shop',
    alt: 'A small timber stool.',
  },
  // bookcases on the library wings' end walls, beside the cabinet and the soil archive
  // (the west wing's pair both stand beyond its cabinet: its stamp post is by the inner wall)
  ...[
    { end: LIB.fromDeg, sense: 1 as const, radii: [SAT_WALL.outerFace - 3.1, SAT_WALL.outerFace - 1.62] },
    { end: LIB.toDeg, sense: -1 as const, radii: [SAT_WALL.innerFace + 1.7, SAT_WALL.outerFace - 1.7] },
  ].flatMap(({ end, sense, radii }, w) =>
    radii.map<SceneObjectConfig>((r, k) => {
      const aDeg = fromEnd(r, end, SAT_WALL.t / 2 + 0.04 + BOOKCASE.d / 2, sense)
      return {
        id: `library-bookcase-${w * 2 + k + 1}`,
        title: 'Bookcase',
        kind: 'sourced-model',
        position: at(r, aDeg),
        rotationDeg: facingAlong(aDeg, sense),
        footprint: [BOOKCASE.w, BOOKCASE.d],
        height: BOOKCASE.h,
        props: { slug: 'ph-wooden-bookshelf-worn', finish: 'asis', lod: true },
        zone: 'library',
        alt: 'A worn timber bookcase against the end wall.',
      }
    }),
  ),
  // the Kumartuli bench's tools and seats (the figure itself is the crafts list's)
  ...[
    { slug: 'ph-folding-wooden-stool', dr: 0.0, da: 0, fp: [0.53, 0.55] as [number, number], h: 0.44 },
    { slug: 'ph-wooden-bucket-01', dr: -0.7, da: 0.9, fp: [0.37, 0.34] as [number, number], h: 0.55 },
    { slug: 'ph-wicker-basket-01', dr: 0.75, da: 1.1, fp: undefined, h: 0.12 },
    { slug: 'ph-trowel-01', dr: 0.75, da: 1.6, fp: undefined, h: 0.1 },
    { slug: 'ph-wooden-spoon', dr: 0.62, da: 1.85, fp: undefined, h: 0.03 },
    { slug: 'ph-wooden-stool-01', dr: -0.55, da: -1.3, fp: [0.43, 0.44] as [number, number], h: 0.44 },
  ].map<SceneObjectConfig>((d, i) => ({
    id: `kumartuli-bench-${i + 1}`,
    title: d.slug.includes('stool') ? 'Stool' : d.slug.includes('bucket') ? 'Bucket' : d.slug.includes('basket') ? 'Basket of straw' : d.slug.includes('spoon') ? 'Wooden spoon' : 'Trowel',
    kind: 'sourced-model',
    position: at(KUMARTULI.r + d.dr, KUMARTULI.aDeg + d.da),
    rotationDeg: facingIn(KUMARTULI.aDeg) + i * 37,
    ...(d.fp ? { footprint: d.fp, height: d.h } : {}),
    props: { slug: d.slug, finish: 'asis', lod: true },
    zone: 'theatre',
    alt: 'A sculptor’s things beside the work: a stool, a bucket of slip, straw in a basket and a trowel.',
  })),
]

/* ------------------------------------------------------------------ */
/* lanterns                                                            */
/* ------------------------------------------------------------------ */

/** Lanterns on the Parikrama's parapet: by both gates and over the courtyards' windows. */
const LANTERN_DEGS = [PARIKRAMA.fromDeg + 4, PARIKRAMA.fromDeg + 8, ...COURTS.map((c) => c.aDeg - 4), PARIKRAMA.toDeg - 8, PARIKRAMA.toDeg - 4]

const lanterns: SceneObjectConfig[] = [
  ...LANTERN_DEGS.map<SceneObjectConfig>((aDeg, i) => ({
    id: `parikrama-lantern-${i + 1}`,
    title: 'Lantern',
    kind: 'sourced-model',
    position: at(parapetIn(aDeg) + S.t / 2, aDeg, S.parapetH),
    rotationDeg: facingOut(aDeg),
    props: { slug: 'ph-lantern-01', finish: 'asis', lod: true },
    zone: parikramaZone(aDeg),
    alt: 'A small lantern standing on the red parapet.',
  })),
  ...([1, -1] as const).map<SceneObjectConfig>((side, i) => ({
    id: `portal-lantern-${i + 1}`,
    title: 'Lantern',
    kind: 'sourced-model',
    position: [side * (KEY.doorHalf + 0.55), 0, KEY.annexOuterZ + 0.35],
    rotationDeg: 0,
    footprint: [0.3, 0.3],
    height: 0.4,
    props: { slug: 'ph-brass-diya-lantern', finish: 'asis', lod: true },
    zone: 'entrance-court',
    alt: 'A brass lamp lantern beside the entrance portal.',
  })),
]

export const GRAND_INSTALLATIONS_OBJECTS: SceneObjectConfig[] = [...earthRoom, ...gates, ...flanks, ...sphereWell, ...wineHall, ...redRoom, ...gardens, ...rooms, ...lanterns]

/* ------------------------------------------------------------------ */
/* where the crafts can stand (for config/grandObjects/crafts.ts)      */
/* ------------------------------------------------------------------ */

/** The Wine Hall's plinths: floor centre, facing (rotationDeg) and each tread's height and depth (local z, +z = the front). */
export const WINE_PLINTHS = WINE_DEGS.map((aDeg, i) => ({
  id: `wine-plinth-${i + 1}`,
  name: `W${i + 1}`,
  position: at(WINE_R, aDeg),
  rotationDeg: facingIn(aDeg),
  width: WINE.width,
  treads: Array.from({ length: WINE.steps }, (_, k) => ({ y: (WINE.height * (k + 1)) / WINE.steps, z: WINE.depth / 2 - (WINE.depth / WINE.steps) * (k + 0.5) })),
}))
/** The bust pedestals' tops and the relief ledge (the relief hangs above it on the wall). */
export const WINE_PEDESTALS = BUST_DEGS.map((aDeg) => ({ position: at(BUST_R, aDeg, BUST.h), rotationDeg: facingOut(aDeg) }))
export const WINE_RELIEF = { position: at(WINE_LAMPS - 0.06 - (0.36 + WINE.railDepth * 2) / 2, RELIEF_DEG, 0.9), rotationDeg: facingIn(RELIEF_DEG) }
/** The Red Room's shelf runs (bearing about the room's centre, span) and the plinth's top. */
export const RED_ROOM_SHELVES = RR_SEGMENTS.map((s, i) => ({ id: `red-shelf-${i + 1}`, bearingDeg: s.mid, spanDeg: s.span, tiers: RR_SHELF.tiers, tierGap: RR_SHELF.gap, kick: 0.14 }))
export const RED_ROOM_PLINTH_TOP: Vec3 = [RR.cx, RR_PLINTH.tiers * RR_PLINTH.h, RR.cz]
/** The horses' plinths in the four sunken gardens, west to east: their tops and facings. */
export const GARDEN_PLINTHS = gardens.filter((o) => o.kind === 'round-plinth').map((o) => ({ id: o.id, top: [o.position[0], Number(o.props?.tiers ?? 1) * HORSE.h, o.position[2]] as Vec3, rotationDeg: o.rotationDeg ?? 0 }))
/** The Earth Room's table top and the Kumartuli bench's place. */
export const EARTH_ROOM = { tableTop: [TABLE.x, TABLE.h, TABLE.z] as Vec3, tableR: TABLE.r }
export const KUMARTULI_BENCH = at(KUMARTULI.r, KUMARTULI.aDeg)
