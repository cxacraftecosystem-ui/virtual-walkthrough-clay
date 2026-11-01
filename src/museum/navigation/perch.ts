/**
 * PERCH — rail rides to the pavilion's elevated and sunken views (SPECTACLE F4, GRAND §8 P5).
 *
 * The visitor never walks on a roof, a balcony or a stair. Three perches are ridden on rails:
 *
 *   duplex       the balcony ring at half height round A/B/C (the PDF's "duplex"): up the east
 *                stair's lower flight, over the bridge through the E-east arch, onto the balcony
 *                arc 35° → 224° (walking order);
 *   sky-rim      the deck round the oculus collar, 20 m above the lotus: up both flights of the
 *                east stair, out of the roof hatch, across the roof and up the dome's rib stair;
 *   sphere-well  the round red room under the plinth (p07r): from the rim, down through the
 *                opening and round the clay spiral stair to the floor, looking up at the sphere
 *                and the stepped oculus. This path is itself a helix (its floor height changes).
 *
 * On a perch the visitor is on a path, not a floor: the controller projects walking input onto
 * the path's tangent, skips collision and puts the camera at `pathY(path, t) + eyeHeight`. Esc or
 * "Come down" rides back to the door the visitor came in by.
 *
 * Every ride is one route built from the plan's constants: a dense 3D polyline of foot
 * positions from the door to the arrival point, eased, with the eyes looking a few metres ahead
 * along it and settling on the arrival view. Forms: Full rides it; Lite rides it a little faster
 * without the overlay's shading; Still (reduced motion) dips to black and cuts. VR uses a
 * two-step teleport (the route's middle, then the arrival; xr/VRRig.tsx).
 *
 * The rides are offered unless `?perch=0` turns them off for the session (SPECTACLE §7.7 kept
 * them behind `?perch` while the Kiln Stair was a stretch; the grand plan builds the balcony,
 * the rib stair and the well as real places). `__museum.perch(id, t)` always works.
 *
 * Analytics, accessibility, zone culling and the HUD ask `perchZone()` before `zoneAt()`.
 * Plan angles as in museum.ts (a = atan2(z, x)); compass yaw 0 = north (−z), 90 = east (+x).
 */
import { create } from 'zustand'
import type { ZoneId } from '../config/layout'
import { DEG, MUSEUM, polar } from '../config/museum'
import { EAST_STAIR, EAST_STAIR_FOOT_DEG, SKY_RIM, SPHERE_WELL } from '../config/satellites'
import { SHELL, shellY } from '../architecture/domeShell'

export type PerchId = 'duplex' | 'sky-rim' | 'sphere-well'
export const PERCH_IDS: readonly PerchId[] = ['duplex', 'sky-rim', 'sphere-well']
export const isPerchId = (v: unknown): v is PerchId => typeof v === 'string' && (PERCH_IDS as readonly string[]).includes(v)

export interface PerchPath {
  id: PerchId
  kind: 'arc' | 'polyline' | 'helix'
  /** Zone reported while on this path. */
  zone: ZoneId
  /** Floor height of the path (m); for a helix, the floor at t = 0. */
  y: number
  /** Helix only: the floor at t = 1. */
  y1?: number
  /** 'arc' / 'helix': centre and radius with the angle range (deg); 'polyline': [x, z] points. */
  cx?: number
  cz?: number
  r?: number
  fromDeg?: number
  toDeg?: number
  points?: [number, number][]
}

/** A ride between the ground and a perch, in progress. */
export interface PerchRide {
  dir: 'up' | 'down'
  path: PerchPath
  /** performance.now() at the start. */
  start: number
  /** Time played so far (ms), advanced frame by frame (a stalled frame never skips the ride). */
  elapsed: number
  /** Length (ms). */
  dur: number
  /** Still form: a dip to black and a cut instead of the rail. */
  still: boolean
  /** Lite form: the rail without the overlay's shading. */
  lite?: boolean
  /** Position on the path the ride arrives at (up) or leaves from (down). */
  t: number
}

export interface PerchState {
  /** The path the visitor is on, or null on the ground (also null during a ride). */
  perch: PerchPath | null
  /** Position along the path, 0 … 1. */
  t: number
  /** The ride up or down, while it plays. */
  ride: PerchRide | null
}

export const usePerch = create<PerchState>(() => ({ perch: null, t: 0, ride: null }))

/** Zone of the perch the visitor is on (null on the ground). */
export function perchZone(): ZoneId | null {
  return usePerch.getState().perch?.zone ?? null
}

const EYE = MUSEUM.visitor.eyeHeight

/* ------------------------------------------------------------------ */
/* Doors                                                               */
/* ------------------------------------------------------------------ */

export interface PerchDoor {
  id: 'east-stair' | 'sphere-well'
  /** Centre the door is set out from (the stair's foot on its centreline; the well's centre). */
  cx: number
  cz: number
  /** Door bearing about that centre (plan deg). */
  aDeg: number
  /** The way in (where the 'perch-door' object stands). */
  face: [number, number]
  /** Where the visitor stands to go up (or down), and comes back to. */
  stand: [number, number]
  /** Within this distance of `stand` the ride is offered (m). */
  reach: number
  /** rotationDeg that turns an object's front (+z) out of the door. */
  rotationDeg: number
  /** The perches this door leads to, the first being the one E takes. */
  perches: readonly PerchId[]
}

function door(id: PerchDoor['id'], cx: number, cz: number, aDeg: number, faceR: number, perches: readonly PerchId[]): PerchDoor {
  const at = (r: number): [number, number] => [cx + r * Math.cos(aDeg * DEG), cz + r * Math.sin(aDeg * DEG)]
  return {
    id,
    cx,
    cz,
    aDeg,
    face: at(faceR),
    stand: at(faceR + 0.62),
    reach: 1.9,
    rotationDeg: Math.atan2(Math.cos(aDeg * DEG), Math.sin(aDeg * DEG)) / DEG,
    perches,
  }
}

/** The stair's foot on its centreline. */
const [TCX, TCZ] = polar(EAST_STAIR.r, EAST_STAIR_FOOT_DEG)
/** The way in faces the drum centre: the flight's inner edge at its foot. */
const STAIR_DOOR = door('east-stair', TCX, TCZ, EAST_STAIR_FOOT_DEG + 180, EAST_STAIR.width / 2, ['duplex', 'sky-rim'])

const SW = SPHERE_WELL
/** The well's gate faces the drum: visitors reach it from the walk round the building. */
const WELL_GATE_DEG = Math.atan2(-SW.cz, -SW.cx) / DEG
const WELL_DOOR = door('sphere-well', SW.cx, SW.cz, WELL_GATE_DEG, SW.rimR, ['sphere-well'])

export const PERCH_DOORS: Record<PerchDoor['id'], PerchDoor> = { 'east-stair': STAIR_DOOR, 'sphere-well': WELL_DOOR }

/** The east stair's door (the first door; kept under its old name for the harness and VR). */
export const PERCH_DOOR = STAIR_DOOR

/** The door a perch is reached by. */
export const doorOf = (id: PerchId): PerchDoor => (id === 'sphere-well' ? WELL_DOOR : STAIR_DOOR)

/* ------------------------------------------------------------------ */
/* Paths                                                               */
/* ------------------------------------------------------------------ */

/** The balcony walk: the middle of the balcony slab, along the ring from the bridge (A) to C's end. */
const BAL = MUSEUM.balcony
export const DUPLEX_PATH: PerchPath = {
  id: 'duplex',
  kind: 'arc',
  zone: 'duplex',
  y: MUSEUM.pavilion.mezzanineBand,
  cx: 0,
  cz: 0,
  r: (BAL.r0 + BAL.r1) / 2,
  fromDeg: BAL.toDeg - 360,
  toDeg: BAL.fromDeg - 360,
}

/** The Sky Rim walk: a full ring round the oculus at the deck (SKY_RIM.r, rail radius). */
export const SKY_RIM_PATH: PerchPath = { id: 'sky-rim', kind: 'arc', zone: 'sky-rim', y: SKY_RIM.y, cx: 0, cz: 0, r: SKY_RIM.r, fromDeg: -180, toDeg: 180 }

/**
 * The Sphere Well's spiral stair (P3 'spiral-stair' at its defaults): treads r0 → r1 round the
 * well's centre, `turns` turns rising `rise` from the floor, its foot at `floorDeg` and climbing
 * anticlockwise in plan. The perch rides its lower part: from a floor where the eye still clears
 * the lowest ceiling terrace, down to the room's floor.
 */
const SPIRAL = { r0: 4.6, r1: 6.1, turns: 1.25, rise: SW.terraceTopY - SW.floorY }
/** Top of the perch on the spiral: the eye 0.3 m under the lowest terrace (y −2.6) at the treads' outer half. */
const SPIRAL_TOP_Y = SW.terraceTopY - EYE - 0.3
const SPIRAL_SWEEP = SPIRAL.turns * 360 * ((SPIRAL_TOP_Y - SW.floorY) / SPIRAL.rise)
/** The perch's top lies 60° clockwise of the gate, so the descent from the rim spirals one way only. */
const SPIRAL_TOP_DEG = WELL_GATE_DEG - 60
export const SPHERE_WELL_SPIRAL = { ...SPIRAL, r: (SPIRAL.r0 + SPIRAL.r1) / 2, floorDeg: SPIRAL_TOP_DEG - SPIRAL_SWEEP } as const

export const SPHERE_WELL_PATH: PerchPath = {
  id: 'sphere-well',
  kind: 'helix',
  zone: 'sphere-well',
  y: SPIRAL_TOP_Y,
  y1: SW.floorY,
  cx: SW.cx,
  cz: SW.cz,
  r: SPHERE_WELL_SPIRAL.r,
  fromDeg: SPIRAL_TOP_DEG,
  toDeg: SPIRAL_TOP_DEG - SPIRAL_SWEEP,
}

export const PERCH_PATHS: Record<PerchId, PerchPath> = { duplex: DUPLEX_PATH, 'sky-rim': SKY_RIM_PATH, 'sphere-well': SPHERE_WELL_PATH }
export const pathOf = (id: string): PerchPath => (isPerchId(id) ? PERCH_PATHS[id] : SKY_RIM_PATH)

/* ------------------------------------------------------------------ */
/* Path maths (pure)                                                   */
/* ------------------------------------------------------------------ */

const wrap01 = (t: number) => ((t % 1) + 1) % 1
const isLoop = (p: PerchPath) => p.kind === 'arc' && Math.abs((p.toDeg ?? 0) - (p.fromDeg ?? 0)) >= 360 - 1e-6
const curved = (p: PerchPath) => p.kind === 'arc' || p.kind === 'helix'

/** Length of a path (m; a helix counts its climb). */
export function pathLength(p: PerchPath): number {
  if (curved(p)) {
    const L = Math.abs((p.toDeg ?? 0) - (p.fromDeg ?? 0)) * DEG * (p.r ?? 0)
    return p.kind === 'helix' ? Math.hypot(L, (p.y1 ?? p.y) - p.y) : L
  }
  const pts = p.points ?? []
  let L = 0
  for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])
  return L
}

/** Clamp (or, for a closed ring, wrap) a path position. */
export function normT(p: PerchPath, t: number): number {
  return isLoop(p) ? wrap01(t) : Math.max(0, Math.min(1, t))
}

/** Floor height of the path at `t`. */
export function pathY(p: PerchPath, t: number): number {
  return p.kind === 'helix' ? p.y + (Math.max(0, Math.min(1, t)) * ((p.y1 ?? p.y) - p.y)) : p.y
}

/** Point and unit plan tangent (direction of increasing t) at `t`. */
export function pathPoint(p: PerchPath, t: number): { x: number; z: number; tx: number; tz: number } {
  t = normT(p, t)
  if (curved(p)) {
    const a = ((p.fromDeg ?? 0) + t * ((p.toDeg ?? 0) - (p.fromDeg ?? 0))) * DEG
    const s = Math.sign((p.toDeg ?? 0) - (p.fromDeg ?? 0)) || 1
    const r = p.r ?? 0
    return { x: (p.cx ?? 0) + r * Math.cos(a), z: (p.cz ?? 0) + r * Math.sin(a), tx: -Math.sin(a) * s, tz: Math.cos(a) * s }
  }
  const pts = p.points ?? [[0, 0]]
  const L = pathLength(p) || 1
  let d = t * L
  for (let i = 1; i < pts.length; i++) {
    const [ax, az] = pts[i - 1]
    const [bx, bz] = pts[i]
    const seg = Math.hypot(bx - ax, bz - az)
    if (d <= seg || i === pts.length - 1) {
      const u = seg > 0 ? Math.min(1, d / seg) : 0
      return { x: ax + (bx - ax) * u, z: az + (bz - az) * u, tx: seg > 0 ? (bx - ax) / seg : 1, tz: seg > 0 ? (bz - az) / seg : 0 }
    }
    d -= seg
  }
  return { x: pts[0][0], z: pts[0][1], tx: 1, tz: 0 }
}

/** Unwrap angle `a` (deg) into the half-open turn that starts at `from` and runs towards `to`. */
function unwrapInto(a: number, from: number, to: number): number {
  const s = Math.sign(to - from) || 1
  let d = (a - from) * s
  d = ((d % 360) + 360) % 360
  return from + d * s
}

/** The path position nearest a plan point, and how far the point lies from the path (m). */
export function projectOnPath(p: PerchPath, x: number, z: number): { t: number; dist: number } {
  if (curved(p)) {
    const from = p.fromDeg ?? 0
    const to = p.toDeg ?? 0
    const span = to - from
    const a = Math.atan2(z - (p.cz ?? 0), x - (p.cx ?? 0)) / DEG
    let rel: number
    if (isLoop(p)) rel = wrap01((a - from) / span)
    else {
      // the angle on the path's own turn; past either end, the nearer end
      const raw = (unwrapInto(a, from, to) - from) / span
      rel = raw <= 1 ? raw : (raw - 1) * Math.abs(span) < 360 - Math.abs(span) * raw + Math.abs(span) - (raw - 1) * Math.abs(span) ? 1 : 0
      if (raw > 1) {
        const pastEnd = (raw - 1) * Math.abs(span)
        const beforeStart = 360 - raw * Math.abs(span)
        rel = pastEnd < beforeStart ? 1 : 0
      }
    }
    const q = pathPoint(p, rel)
    return { t: rel, dist: Math.hypot(q.x - x, q.z - z) }
  }
  let best = { t: 0, dist: Infinity }
  const N = 200
  for (let i = 0; i <= N; i++) {
    const q = pathPoint(p, i / N)
    const d = Math.hypot(q.x - x, q.z - z)
    if (d < best.dist) best = { t: i / N, dist: d }
  }
  return best
}

/** Move along a path by `metres` (signed). */
export function advance(p: PerchPath, t: number, metres: number): number {
  return normT(p, t + metres / (pathLength(p) || 1))
}

/** Compass yaw (deg) looking from (x, z) towards (tx, tz). */
export const compassTo = (x: number, z: number, tx: number, tz: number) => ((Math.atan2(tx - x, -(tz - z)) / DEG) % 360 + 360) % 360

/* ------------------------------------------------------------------ */
/* Arrival                                                             */
/* ------------------------------------------------------------------ */

/** The rib of the dome the stair's roof hatch lies nearest (the rib stair climbs it). */
const RIB_DEG = Math.round(EAST_STAIR.upper.toDeg / (360 / MUSEUM.dome.ribs)) * (360 / MUSEUM.dome.ribs)

/** Where a ride up arrives on each path (the route joins it there). */
export const ARRIVAL_T: Record<PerchId, number> = {
  duplex: 0,
  'sky-rim': projectOnPath(SKY_RIM_PATH, ...polar(SKY_RIM.r, RIB_DEG)).t,
  'sphere-well': 1,
}
/** Kept under its old name: where the Sky Rim ride arrives. */
export const RIM_ARRIVAL_T = ARRIVAL_T['sky-rim']

/**
 * The view (compass yaw, pitch; deg) on a perch at `t`: from the balcony over the court, from
 * the rim down into it, from the well's floor up at the sphere and the stepped oculus.
 */
/** How far down a visitor on a perch may look (navigation/VisitorController.tsx PERCH_PITCH_DOWN). */
const PERCH_PITCH_DOWN_DEG = 78
/** The Sky Rim's view down (deg below the horizon). */
const SKY_RIM_PITCH = 65

export function perchView(path: PerchPath, t: number) {
  const q = pathPoint(path, t)
  const yawDeg = compassTo(q.x, q.z, path.cx ?? 0, path.cz ?? 0)
  // the Sky Rim leans out over the collar and looks down the light-well, 20 m to the lotus: at
  // −65° the lotus sits a little below the frame's middle with the far side of the court beyond,
  // and the frame's foot still falls inside the opening (never on the deck behind)
  const pitchDeg = path.id === 'sky-rim' ? -Math.min(PERCH_PITCH_DOWN_DEG, SKY_RIM_PITCH) : path.id === 'duplex' ? -12 : 38
  return { yawDeg, pitchDeg }
}
/** Kept under its old name. */
export const rimArrivalView = (t: number, path: PerchPath = SKY_RIM_PATH) => perchView(path, t)

/* ------------------------------------------------------------------ */
/* Routes (pure)                                                       */
/* ------------------------------------------------------------------ */

type V3 = [number, number, number]

/** Floor of the east stair's lower flight at plan angle `a` (deg), 0 at the ground. */
function lowerFlightY(a: number) {
  const f = EAST_STAIR.lower
  return Math.max(0, f.y0 + ((f.fromDeg - a) / (f.fromDeg - f.toDeg)) * (f.y1 - f.y0))
}
/** Floor of the upper flight at `a`. */
function upperFlightY(a: number) {
  const f = EAST_STAIR.upper
  return f.y0 + ((a - f.fromDeg) / (f.toDeg - f.fromDeg)) * (f.y1 - f.y0)
}
/** Outer face of the dome's shell at plan radius r (the rib stair's treads sit on it). */
const domeOuterY = shellY

/** Feet positions from `a` to `b` (deg) at plan radius r about (cx, cz), y(angle), every ~0.5 m. */
function arcFeet(r: number, a: number, b: number, y: (deg: number) => number, cx = 0, cz = 0): V3[] {
  const n = Math.max(2, Math.ceil((Math.abs(b - a) * DEG * r) / 0.5))
  const out: V3[] = []
  for (let i = 0; i <= n; i++) {
    const d = a + ((b - a) * i) / n
    const [x, z] = polar(r, d, cx, cz)
    out.push([x, y(d), z])
  }
  return out
}

/** Feet positions along a perch path from t0 to t1 (the shorter way round a closed ring). */
function pathFeet(p: PerchPath, t0: number, t1: number): V3[] {
  let d = t1 - t0
  if (isLoop(p)) d = ((d + 1.5) % 1) - 0.5
  const n = Math.max(1, Math.ceil((Math.abs(d) * pathLength(p)) / 0.5))
  const out: V3[] = []
  for (let i = 0; i <= n; i++) {
    const t = normT(p, t0 + (d * i) / n)
    const q = pathPoint(p, t)
    out.push([q.x, pathY(p, t), q.z])
  }
  return out
}

/** Feet positions from the door to where the route joins its perch (`ARRIVAL_T`). */
function approach(id: PerchId): V3[] {
  const D = doorOf(id)
  const start: V3 = [D.stand[0], 0, D.stand[1]]
  if (id === 'sphere-well') {
    // from the gate in the rim, out over the opening, then a descending turn clockwise down
    // through it and out to the top of the spiral stair
    const g = WELL_GATE_DEG
    const pts: V3[] = [start]
    const N = 40
    const top = pathPoint(SPHERE_WELL_PATH, 0)
    const topR = Math.hypot(top.x - SW.cx, top.z - SW.cz)
    for (let i = 0; i <= N; i++) {
      const k = i / N
      // radius: in from the rim to just outside the sphere, then out to the treads
      const r = k < 0.35 ? SW.rimR + (SW.openingR - 0.7 - SW.rimR) * (k / 0.35) : SW.openingR - 0.7 + (topR - (SW.openingR - 0.7)) * ((k - 0.35) / 0.65) ** 1.4
      const a = g + (SPIRAL_TOP_DEG - g) * k
      // level over the opening, then down (through the opening before the room widens)
      const y = k < 0.25 ? 0 : SPIRAL_TOP_Y * Math.min(1, (k - 0.25) / 0.7) ** 0.85
      const [x, z] = polar(r, a, SW.cx, SW.cz)
      pts.push([x, y, z])
    }
    return pts
  }
  // up the lower flight from its foot to the landing at its top
  const f = EAST_STAIR.lower
  const lower = arcFeet(EAST_STAIR.r, EAST_STAIR_FOOT_DEG, f.toDeg, lowerFlightY)
  if (id === 'duplex') {
    // across the bridge through the ring wall onto the balcony
    const bridge = EAST_STAIR.bridge
    const land = pathPoint(DUPLEX_PATH, ARRIVAL_T.duplex)
    const landA = Math.atan2(land.z, land.x) / DEG
    const pts: V3[] = []
    const N = 16
    for (let i = 1; i <= N; i++) {
      const k = i / N
      const r = EAST_STAIR.r + ((DUPLEX_PATH.r ?? 0) - EAST_STAIR.r) * k
      const a = f.toDeg + ((bridge.fromDeg + landA) / 2 - f.toDeg) * Math.min(1, k * 1.4) + (landA - (bridge.fromDeg + landA) / 2) * Math.max(0, k * 1.4 - 0.4) / 1.0
      const [x, z] = polar(r, Math.max(landA, a))
      pts.push([x, f.y1, z])
    }
    return [start, ...lower, ...pts]
  }
  // sky-rim: the upper flight back over the lower one, out of the hatch, across the roof to
  // the rib, up the rib stair to the deck and onto the rim
  const up = EAST_STAIR.upper
  const upper = arcFeet(EAST_STAIR.r, up.fromDeg, up.toDeg, upperFlightY)
  const roofY = up.y1
  // the foot of the stair pier on the tambour (the treads climb its face, then the shell)
  const footR = SHELL.tambour.r + SHELL.tambour.pierOut
  const roof = [polar(EAST_STAIR.r - 1.2, (up.toDeg + RIB_DEG) / 2), polar(footR + 0.6, RIB_DEG)].map(([x, z]): V3 => [x, roofY, z])
  const deckEdge = SKY_RIM.r + 0.8
  const rib: V3[] = []
  const N = 36
  for (let i = 0; i <= N; i++) {
    const r = footR + (deckEdge - footR) * (i / N)
    const [x, z] = polar(r, RIB_DEG)
    rib.push([x, Math.min(SKY_RIM.y, Math.max(roofY, domeOuterY(r - 0.3) + 0.12)), z])
  }
  const rimPt = pathPoint(SKY_RIM_PATH, ARRIVAL_T['sky-rim'])
  return [start, ...lower, ...upper, ...roof, ...rib, [rimPt.x, SKY_RIM.y, rimPt.z]]
}

interface Route {
  /** Feet positions and cumulative length (m, 3D). */
  pts: V3[]
  s: number[]
  length: number
  /** Arrival look target (eye space). */
  look: V3
}

const routes = new Map<string, Route>()

/** The route from a perch's door to position `t` on it (cached per perch and t). */
export function route(path: PerchPath, t: number): Route {
  const key = `${path.id}:${t.toFixed(4)}`
  const hit = routes.get(key)
  if (hit) return hit
  const join = ARRIVAL_T[path.id]
  const raw = [...approach(path.id), ...pathFeet(path, join, t).slice(1)]
  // drop repeated points
  const pts: V3[] = [raw[0]]
  for (const p of raw.slice(1)) {
    const q = pts[pts.length - 1]
    if (Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]) > 1e-4) pts.push(p)
  }
  const s = [0]
  for (let i = 1; i < pts.length; i++) s.push(s[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1], pts[i][2] - pts[i - 1][2]))
  const v = perchView(path, t)
  const end = pts[pts.length - 1]
  const look: V3 = [
    end[0] + Math.sin(v.yawDeg * DEG) * Math.cos(v.pitchDeg * DEG) * 6,
    end[1] + EYE + Math.sin(v.pitchDeg * DEG) * 6,
    end[2] - Math.cos(v.yawDeg * DEG) * Math.cos(v.pitchDeg * DEG) * 6,
  ]
  const r: Route = { pts, s, length: s[s.length - 1], look }
  if (routes.size > 64) routes.clear()
  routes.set(key, r)
  return r
}

/** Feet position `d` metres along a route. */
function at(r: Route, d: number): V3 {
  d = Math.max(0, Math.min(r.length, d))
  let lo = 0
  let hi = r.s.length - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (r.s[mid] <= d) lo = mid
    else hi = mid
  }
  const seg = r.s[hi] - r.s[lo] || 1
  const k = (d - r.s[lo]) / seg
  const a = r.pts[lo]
  const b = r.pts[hi]
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]
}

/** Ride speed (m/s along the route) and its bounds (s). */
const RIDE_SPEED = 4.2
export const RIDE_MIN_SECONDS = 4.5
export const RIDE_MAX_SECONDS = 12
export const RIDE_STILL_SECONDS = 1.4
/** Kept for callers that want a nominal ride length. */
export const RIDE_SECONDS = RIDE_MIN_SECONDS

/** How long a ride to (or from) `t` on a path plays (s), Full form; Lite plays it at 0.8×. */
export function rideSeconds(path: PerchPath, t: number): number {
  return Math.max(RIDE_MIN_SECONDS, Math.min(RIDE_MAX_SECONDS, route(path, t).length / RIDE_SPEED))
}

export interface RidePose {
  x: number
  y: number
  z: number
  /** Look target. */
  lx: number
  ly: number
  lz: number
  /** How shaded the overlay is (0 … 1): below grade in the well, and at the ride's middle. */
  shade: number
}

const smooth = (t: number) => t * t * (3 - 2 * t)
/** Eyes look this far ahead along the route, and a little up while climbing. */
const LOOK_AHEAD = 4
/** Over the last metres the eyes settle on the arrival view. */
const SETTLE = 6

/**
 * Camera pose `u` of the way from the door to position `t` on the path (a ride down plays the
 * same curve backwards). Eased at both ends; the eyes lead the feet and settle on the view.
 */
export function ridePose(u: number, t: number, path: PerchPath = SKY_RIM_PATH): RidePose {
  u = Math.max(0, Math.min(1, u))
  const r = route(path, t)
  const d = smooth(u) * r.length
  const p = at(r, d)
  const ahead = at(r, d + LOOK_AHEAD)
  // near the end of the route the look-ahead point runs out: lean on the arrival view instead
  const k = smooth(Math.max(0, Math.min(1, (d - (r.length - SETTLE)) / SETTLE)))
  const climb = Math.max(-0.6, Math.min(0.6, (ahead[1] - p[1]) / LOOK_AHEAD))
  const lx = ahead[0] * (1 - k) + r.look[0] * k
  const ly = (ahead[1] + EYE + 0.35 * climb) * (1 - k) + r.look[1] * k
  const lz = ahead[2] * (1 - k) + r.look[2] * k
  const below = path.id === 'sphere-well' ? Math.max(0, Math.min(1, -p[1] / 3)) : 0
  return { x: p[0], y: p[1] + EYE, z: p[2], lx, ly, lz, shade: Math.max(0.55 * below, 0.25 * Math.sin(Math.PI * u)) }
}

/** Feet position at the route's middle (VR's first teleport step). */
export function rideMidpoint(path: PerchPath, t: number): { x: number; y: number; z: number } {
  const r = route(path, t)
  const p = at(r, r.length / 2)
  return { x: p[0], y: p[1], z: p[2] }
}

/* ------------------------------------------------------------------ */
/* The switch                                                          */
/* ------------------------------------------------------------------ */

const FLAG_KEY = 'clay.perch'

/** The rides are offered (on unless `?perch=0` / `?perch=false`, remembered for the session). */
export function perchEnabled(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const q = new URLSearchParams(window.location.search)
    if (q.has('perch')) {
      const on = q.get('perch') !== '0' && q.get('perch') !== 'false'
      sessionStorage.setItem(FLAG_KEY, on ? '1' : '0')
      return on
    }
    return sessionStorage.getItem(FLAG_KEY) !== '0'
  } catch {
    return true
  }
}

/* ------------------------------------------------------------------ */
/* Doors: where the visitor stands                                     */
/* ------------------------------------------------------------------ */

/** Compass yaw of a visitor standing at a door with their back to it (coming down, facing out). */
export const doorOutYaw = (d: PerchDoor) => compassTo(d.face[0], d.face[1], d.stand[0], d.stand[1])

/** The perch door within reach of the plan point (x, z), the nearer if both are; null when none is. */
export function doorNear(x: number, z: number): PerchDoor | null {
  let best: PerchDoor | null = null
  let bestD = Infinity
  for (const d of Object.values(PERCH_DOORS)) {
    const dist = Math.hypot(x - d.stand[0], z - d.stand[1])
    if (dist <= d.reach && dist < bestD) {
      best = d
      bestD = dist
    }
  }
  return best
}
