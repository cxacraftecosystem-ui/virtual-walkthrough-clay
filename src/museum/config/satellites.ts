/**
 * THE NORTH WING — four earth-sheltered crescent rooms on the landscape plinth north of the
 * gallery ring, the open-air Parikrama between them and the ring, and the grand plan's new
 * rooms (GRAND §1.2, §2.6, §2.7): the Red Room in the library crescent, the Sphere Well sunk in
 * the plinth south-west of the drum, and the east stair up the lobe wall.
 *
 * Every room is an annular sector about the drum centre between the satellite inner wall
 * (r 23.35) and its outer wall (r 33.25), entered through one door in the inner wall from the
 * Parikrama. The Parikrama (r 16.6 → 23.2) is a serpentine walk between red walls (p09l): its
 * centreline swings out to the satellites' inner wall across every door and in towards the ring
 * between them, leaving sunken gardens on the drum side and walled courtyards on the satellite
 * side. It runs from the west gate (−136°) to the east gate (35°); doors in the two notch walls
 * join it to the pavilion (hallway D at the D notch, the entry ways at the NE notch), and at each
 * end its outer side opens onto the plinth between the notch wall and the first room. The slots
 * between the rooms are closed by jali screens, and a berm closes the strip behind the rooms.
 *
 * Plan angles as in museum.ts (a = atan2(z, x), −90° = north). Wall centrelines and faces are
 * derived here; layout.ts builds the walls, zones and surfaces from these constants.
 */
import { DEG, KEY, MUSEUM, polar } from './museum'

export type SatelliteId = 'atlas' | 'theatre' | 'library' | 'shop'

/** Satellite walls: inner arc (on the walk) and outer arc centrelines, thickness, faces, door. */
export const SAT_WALL = {
  innerC: 23.35,
  outerC: 33.25,
  t: 0.3,
  /** Room-side face of the inner wall / of the outer wall, and the outer wall's outside face. */
  innerFace: 23.5,
  outerFace: 33.1,
  outerOuter: 33.4,
  door: { width: 2.4, height: 3.6 },
} as const

/** The Parikrama: the open-air walk between the ring's outer face and the satellites' inner wall. */
export const PARIKRAMA = {
  r0: KEY.ringOuterR,
  /** The satellites' inner wall, walk-side face. */
  r1: SAT_WALL.innerC - SAT_WALL.t / 2,
  fromDeg: -136,
  toDeg: 35,
  /** Kept for the old pergola's consumers: the walk is open to the sky (GRAND §2.6). */
  roofY0: MUSEUM.pavilion.mezzanineBand,
  roofY1: MUSEUM.pavilion.mezzanineBand + 0.2,
  /** West / east zone split (deg). */
  split: -60,
  /** The old horse plinth's line along the ring (no longer a wall: the horses stand in the gardens). */
  plinth: { r0: KEY.ringOuterR, r1: KEY.ringOuterR + 0.35, h: 0.3, fromDeg: -130, toDeg: 28 },
} as const

/** Half-angle (deg) of a satellite door, measured on the inner wall's centreline (≈ 2.95°). */
export const SAT_DOOR_HALF_DEG = Math.asin(SAT_WALL.door.width / 2 / SAT_WALL.innerC) / DEG

export interface SatelliteSpec {
  id: SatelliteId
  fromDeg: number
  toDeg: number
  /** Plan angle of the door in the inner wall. */
  doorDeg: number
  /** Wall height (m). */
  height: number
  /** Barrel-vault apex (theatre only). */
  vaultApex?: number
}

export const SATELLITES: readonly SatelliteSpec[] = [
  { id: 'atlas', fromDeg: -127, toDeg: -95, doorDeg: -111, height: 6.0 },
  { id: 'theatre', fromDeg: -90, toDeg: -38, doorDeg: -44, height: 6.5, vaultApex: 8.0 },
  // widened: it holds the Red Room and its two wings
  { id: 'library', fromDeg: -36, toDeg: 0, doorDeg: -18, height: 6.0 },
  { id: 'shop', fromDeg: 2, toDeg: 27, doorDeg: 14.5, height: 6.0 },
] as const

export const satellite = (id: SatelliteId) => SATELLITES.find((s) => s.id === id)!

/** Slots between the rooms, closed by jali screens on the inner wall's circle (deg), 2.6 m tall. */
export const JALI_SLOTS: readonly (readonly [number, number])[] = [
  [-95, -90],
  [-38, -36],
  [0, 2],
] as const
export const JALI = { t: 0.12, height: 2.6 } as const

/** Doors in the two notch walls (radii along the notch, centre and height). */
export const NOTCH_DOOR = { rC: 19.5, r0: 18.3, r1: 20.7, height: 3.4 } as const

/** The Agni Theatre: screen span on the outer wall, the lobby baffle and the three seat rows. */
export const THEATRE = {
  screenFrom: -74,
  screenTo: -58,
  axisDeg: -66,
  baffle: { aDeg: -51, r0: SAT_WALL.innerFace, r1: 27.5, t: 0.15, h: 3.0 },
  rows: [
    { r: 25.0, seats: 8 },
    { r: 26.0, seats: 9 },
    { r: 27.0, seats: 10 },
  ],
} as const

/** Retired (GRAND §0.4): the Kiln Stair tower. Kept exported so its unmounted modules compile. */
export const KILN_STAIR = { r: 26.0, aDeg: 200, radius: 1.25, height: 9.5 } as const

/**
 * The Sky Rim: the deck round the oculus collar on top of the dome (reached by the perch only).
 * `y` is the deck, `r` the rail path, `glassR` the glass balustrade, `upstand` the collar.
 */
export const SKY_RIM = {
  y: 21.0,
  /**
   * The walk leans out over the glass collar (r 5.04, its top at 22.2, below the eye): the eye is
   * over the opening, so the view down the light-well is all court and lotus, never the deck
   * under the visitor's feet.
   */
  r: 4.4,
  upstand: { r0: MUSEUM.oculus.r, r1: MUSEUM.oculus.r + 0.6, y1: MUSEUM.dome.collarTop },
  glassR: 5.9,
} as const

/* ------------------------------------------------------------------ */
/* The serpentine Parikrama (GRAND §2.6)                               */
/* ------------------------------------------------------------------ */

/**
 * The walk's walls. `walkW` is the clear width between the wall faces, `t` the walls'
 * thickness; the inner (drum-side) wall is a parapet in front of the sunken gardens, the outer
 * (satellite-side) wall a full-height wall round the courtyards.
 */
export const SERPENTINE = {
  walkW: 2.7,
  t: 0.25,
  wallH: 2.3,
  parapetH: 1.1,
  /** Centreline radius at both gates (in line with the notch doors). */
  gateR: 19.8,
  /** Extra half-angle (deg) either side of a door over which the outer wall lies on the room's inner wall. */
  doorFlatDeg: 1.5,
  /** Plan angles (deg) where the centreline swings in towards the ring (the drawing's courtyard rhythm). */
  touchDeg: [-123.5, -77.5, -27, -1.75, 24.75] as const,
  /** Smallest turning radius of the centreline (m): the walls' faces never fold over. */
  minTurnR: 1.8,
} as const

/** Centreline offset of either wall from the walk's centreline. */
export const SERP_OFFSET = SERPENTINE.walkW / 2 + SERPENTINE.t / 2
/** Centreline radius at which the outer wall lies on the satellites' inner wall. */
const SERP_DOOR_R = SAT_WALL.innerC - SERP_OFFSET
/** Centreline radius at which the inner wall's inner face lies on the ring's outer face. */
const SERP_TOUCH_R = KEY.ringOuterR + SERPENTINE.t + SERPENTINE.walkW / 2

export interface SerpentinePoint {
  /** Plan angle (deg) and centreline radius (m). */
  aDeg: number
  r: number
  /** Half-angle (deg) over which the radius holds (the door flats). */
  holdDeg: number
  kind: 'gate' | 'door' | 'touch'
}

/**
 * The centreline's control points: the gates, a flat across each door, and a swing in at each
 * touch angle where the span between its neighbours allows one. A touch swings as deep as the
 * turning radius allows (raised-cosine transitions of length L may drop 2L² / (π² R)), so it
 * reaches the ring only where the doors are far enough apart; it is left out where it would
 * not dip half a metre below both neighbours.
 */
function serpentinePoints(): SerpentinePoint[] {
  const S = SERPENTINE
  const fixed: SerpentinePoint[] = [
    { aDeg: PARIKRAMA.fromDeg, r: S.gateR, holdDeg: 0, kind: 'gate' },
    ...SATELLITES.map((s) => ({ aDeg: s.doorDeg, r: SERP_DOOR_R, holdDeg: SAT_DOOR_HALF_DEG + S.doorFlatDeg, kind: 'door' as const })),
    { aDeg: PARIKRAMA.toDeg, r: S.gateR, holdDeg: 0, kind: 'gate' },
  ]
  const out: SerpentinePoint[] = []
  const metresPerDeg = ((PARIKRAMA.r0 + PARIKRAMA.r1) / 2) * DEG
  const maxDrop = (L: number) => (2 * L * L) / (Math.PI * Math.PI * S.minTurnR)
  for (let i = 0; i < fixed.length; i++) {
    const A = fixed[i]
    out.push(A)
    const B = fixed[i + 1]
    if (!B) break
    const lo = A.aDeg + A.holdDeg
    const hi = B.aDeg - B.holdDeg
    const want = S.touchDeg.find((a) => a > lo && a < hi)
    if (want === undefined) continue
    // keep the touch in the middle of its span, so both transitions have room
    const a = Math.min(Math.max(want, lo + 0.35 * (hi - lo)), hi - 0.35 * (hi - lo))
    const r = Math.max(SERP_TOUCH_R, A.r - maxDrop((a - lo) * metresPerDeg), B.r - maxDrop((hi - a) * metresPerDeg))
    if (r < Math.min(A.r, B.r) - 0.5) out.push({ aDeg: a, r, holdDeg: 0, kind: 'touch' })
  }
  return out
}

export const SERPENTINE_POINTS: readonly SerpentinePoint[] = serpentinePoints()

/** Centreline radius of the Parikrama walk at plan angle `aDeg` (clamped to the gates). */
export function serpentineR(aDeg: number): number {
  const P = SERPENTINE_POINTS
  if (aDeg <= P[0].aDeg) return P[0].r
  for (let i = 0; i < P.length - 1; i++) {
    const A = P[i]
    const B = P[i + 1]
    if (aDeg <= A.aDeg + A.holdDeg) return A.r
    const lo = A.aDeg + A.holdDeg
    const hi = B.aDeg - B.holdDeg
    if (aDeg < hi) {
      const u = (aDeg - lo) / (hi - lo)
      return A.r + ((B.r - A.r) * (1 - Math.cos(Math.PI * u))) / 2
    }
  }
  return P[P.length - 1].r
}

/** Points [x, z] along the walk's centreline from `fromDeg` to `toDeg`, every `stepDeg`. */
export function serpentineLine(fromDeg: number = PARIKRAMA.fromDeg, toDeg: number = PARIKRAMA.toDeg, stepDeg = 1): [number, number][] {
  const n = Math.max(1, Math.ceil(Math.abs(toDeg - fromDeg) / stepDeg))
  return Array.from({ length: n + 1 }, (_, i) => {
    const a = fromDeg + ((toDeg - fromDeg) * i) / n
    return polar(serpentineR(a), a)
  })
}

/**
 * A line offset `k` metres from the centreline along its plan normal (+ = away from the drum),
 * sampled every `stepDeg`. The walls are these lines at ±SERP_OFFSET.
 */
export function serpentineOffset(k: number, fromDeg: number = PARIKRAMA.fromDeg, toDeg: number = PARIKRAMA.toDeg, stepDeg = 1): [number, number][] {
  const n = Math.max(1, Math.ceil(Math.abs(toDeg - fromDeg) / stepDeg))
  const pt = (a: number) => polar(serpentineR(a), a)
  return Array.from({ length: n + 1 }, (_, i) => {
    const a = fromDeg + ((toDeg - fromDeg) * i) / n
    const [x, z] = pt(a)
    const [x0, z0] = pt(a - 0.05)
    const [x1, z1] = pt(a + 0.05)
    const len = Math.hypot(x1 - x0, z1 - z0) || 1
    // increasing angle runs clockwise on the plan; its right-hand normal points away from the drum
    const nx = (z1 - z0) / len
    const nz = -(x1 - x0) / len
    return [x + nx * k, z + nz * k] as [number, number]
  })
}

/**
 * Angular runs (deg) of the outer wall: wherever the centreline lies below the door radius, from
 * the first room's west end to the last room's east end (the gates stay open to the plinth).
 */
export function serpentineOuterRuns(stepDeg = 1): [number, number][] {
  const from = SATELLITES[0].fromDeg
  const to = SATELLITES[SATELLITES.length - 1].toDeg
  const runs: [number, number][] = []
  let start: number | null = null
  const n = Math.ceil((to - from) / stepDeg)
  for (let i = 0; i <= n; i++) {
    const a = from + ((to - from) * i) / n
    const open = serpentineR(a) < SERP_DOOR_R - 0.02
    if (open && start === null) start = a
    if ((!open || i === n) && start !== null) {
      // overlap one step onto the room's wall, so the courtyard closes
      runs.push([Math.max(from, start - stepDeg), open ? a : Math.min(to, a)])
      start = null
    }
  }
  return runs
}

/* ------------------------------------------------------------------ */
/* The Red Room, the Sphere Well and the east stair (GRAND §2.7)       */
/* ------------------------------------------------------------------ */

const [rrX, rrZ] = polar(28.3, -18)
/**
 * The Red Room (p09r): a round drum inside the library crescent, its door facing the library's
 * door, with side openings into the two wings either side.
 */
export const RED_ROOM = {
  cx: rrX,
  cz: rrZ,
  /** Plan angle of the centre (deg) about the drum centre; the door faces back along it. */
  aDeg: -18,
  r: 4.2,
  t: 0.35,
  height: 7.5,
  oculusR: 1.5,
  doorWidth: SAT_WALL.door.width,
  sideWidth: 1.6,
} as const

const [swX, swZ] = polar(28.0, 200)
/** The Sphere Well (p07r): an opening at grade round which a balustrade stands; the room below is a perch. */
export const SPHERE_WELL = {
  cx: swX,
  cz: swZ,
  /** Opening at grade, and the radius of the rim balustrade (collider). */
  openingR: 3.0,
  rimR: 3.3,
  rimH: 1.05,
  /** The round room below. */
  roomR: 6.5,
  floorY: -8.0,
  /** Ceiling terraces: 5 steps from roomR at y −2.6 up to the opening at y 0. */
  terraces: 5,
  terraceTopY: -2.6,
  sphereR: 1.6,
  sphereY: -4.0,
} as const

/**
 * The east stair: a switchback against the lobe wall in the east ambulatory. The lower flight
 * climbs from 78° to 40° (y 0 → the balcony), a bridge crosses the ring wall at 36°–40° onto the
 * balcony, and the upper flight climbs back from 40° to 78° to a roof hatch.
 */
export const EAST_STAIR = {
  r: 20.9,
  width: 1.4,
  lower: { fromDeg: 78, toDeg: 40, y0: 0, y1: MUSEUM.pavilion.mezzanineBand },
  bridge: { fromDeg: 36, toDeg: 40 },
  upper: { fromDeg: 40, toDeg: 78, y0: MUSEUM.pavilion.mezzanineBand, y1: MUSEUM.pavilion.height - 0.4 },
  /** Headroom below which the lower flight's footprint is closed to visitors. */
  headroom: 2.1,
} as const

/** Where the lower flight starts on the ground: its foot stops at the annex wall's line (deg). */
export const EAST_STAIR_FOOT_DEG = Math.min(EAST_STAIR.lower.fromDeg, Math.acos(KEY.annexOuterHalf / (EAST_STAIR.r + EAST_STAIR.width / 2)) / DEG - 0.5)
