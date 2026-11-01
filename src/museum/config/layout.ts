/**
 * ARCHITECTURAL LAYOUT — the clay pavilion, derived entirely from MUSEUM constants.
 *
 * A circular drum under a coffered dome, entered through a straight annex (G, the Earth Room).
 * The annex opens onto the ambulatory between the lobe and the ring circle; on the ring circle
 * stand the gallery description wall (H) facing the annex, the hallway wall (D) and three great
 * arches (E east, E west, D). Through the E arches the corridor between H and the inner main
 * wall (F) leads round F's ends into the ring of tradition galleries (A, B, C) round the pool
 * court under the oculus; the D arch leads from Gallery C into the hallway (D), which brings the
 * visitor back to E. See config/museum.ts for the plan and GRAND.md §1–§2 for the dimensions.
 *
 * Shapes. Curved walls are true arcs (`shape.kind: 'arc'`), straight walls segments with a
 * thickness (`'seg'`); `min`/`max` is always the shape's bounding box, so code that only needs
 * extents keeps working. Collision (navigation/collision.ts) and the floor plan (plan.ts) use the
 * shape. Hanging surfaces on curved walls are FACETS: straight runs of ~2.4–2.8 m along the arc
 * (runAxis 'along'), placed so a flat frame never sinks into the wall.
 */

import { ARCH, DEG, KEY, MUSEUM, polar, type Vec3 } from './museum'
import { EAST_STAIR, EAST_STAIR_FOOT_DEG, JALI, JALI_SLOTS, NOTCH_DOOR, PARIKRAMA, RED_ROOM, SAT_DOOR_HALF_DEG, SAT_WALL, satellite, SATELLITES, SERP_OFFSET, SERPENTINE, serpentineOffset, serpentineOuterRuns, serpentineR, SPHERE_WELL, THEATRE, type SatelliteId } from './satellites'

/* ------------------------------------------------------------------ */
/* Geometry helpers                                                    */
/* ------------------------------------------------------------------ */

const TAU = Math.PI * 2

/** Is plan angle `a` (radians) inside the arc a0 → a1 (a0 < a1, span ≤ 2π)? */
export function angleIn(a: number, a0: number, a1: number, eps = 1e-9) {
  const t = (((a - a0) % TAU) + TAU) % TAU
  return t <= a1 - a0 + eps || a1 - a0 >= TAU - eps
}

/** Bounding box of an annular sector (radians). */
function sectorBox(cx: number, cz: number, r0: number, r1: number, a0: number, a1: number) {
  const xs: number[] = []
  const zs: number[] = []
  const add = (r: number, a: number) => {
    xs.push(cx + r * Math.cos(a))
    zs.push(cz + r * Math.sin(a))
  }
  for (const a of [a0, a1]) {
    add(r0, a)
    add(r1, a)
  }
  for (let k = Math.ceil(a0 / (Math.PI / 2)); k * (Math.PI / 2) <= a1; k++) add(r1, k * (Math.PI / 2))
  if (r0 === 0) {
    xs.push(cx)
    zs.push(cz)
  }
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minZ: Math.min(...zs), maxZ: Math.max(...zs) }
}

/* ------------------------------------------------------------------ */
/* Walls                                                               */
/* ------------------------------------------------------------------ */

export type WallKind =
  /** Outer drum (lobe + gallery ring). */
  | 'drum'
  /** Radial walls joining the ring and the lobe (NE notch by E, D notch). */
  | 'notch'
  /** Entrance annex G. */
  | 'annex'
  /** Above a door or arch: rendered, never collides. */
  | 'lintel'
  /** H — gallery description wall. */
  | 'description'
  /** F — inner main wall. */
  | 'inner-main'
  /** D — hallway inner wall. */
  | 'hallway'
  /** Formation gates between the podium runs (collider boxes; the formations are drawn by their owner). */
  | 'fin'
  /** Oculus plinth curb (rendered by the oculus plinth, not the plaster wall). */
  | 'plinth'
  /** Invisible edge of the walkable site (landscape disc + forecourt). */
  | 'boundary'
  /** North wing: the crescent rooms' inner, outer and end walls, and their door lintels. */
  | 'satellite'
  /** The Parikrama walk's low horse plinth along the ring. */
  | 'colonnade'
  /** Pierced screens closing the slots between the rooms (drawn by their owner; collide). */
  | 'jali'
  /** The theatre's lobby baffle (drawn by its owner; collides). */
  | 'baffle'
  /** A full circle that collides as a solid disc: the Sphere Well's rim balustrade. */
  | 'tower'
  /** The Parikrama's red serpentine walls: the drum-side parapet, the courtyard wall and its closures. */
  | 'serpentine'
  /** The Red Room's round wall inside the library crescent, its door vestibule and lintels. */
  | 'red-room'
  /** The east stair's footprint where its lower flight is below head height. */
  | 'stair'

/** Wall footprint. Arcs: centreline radius `r`, angles in radians, a0 < a1. */
export type WallShape =
  | { kind: 'arc'; cx: number; cz: number; r: number; thickness: number; a0: number; a1: number }
  | { kind: 'seg'; ax: number; az: number; bx: number; bz: number; thickness: number }

export interface WallBox {
  id: string
  kind: WallKind
  /** Bounding box (y: base → top). */
  min: Vec3
  max: Vec3
  /** Footprint; absent = the box itself. */
  shape?: WallShape
  /** Whether this wall participates in visitor collision. Default true. */
  collide?: boolean
  /** Rendered by a specialised component instead of the plaster Wall. */
  render?: false
  /** Culling: zones from which this element can be seen (omit = always rendered). */
  zones?: ZoneId[]
}

const P = MUSEUM.pavilion
const H = P.ceilingHeight
const T = MUSEUM.drum.thickness

/** Height of the roof slab above the ceiling. */
export const ROOF_THICKNESS = P.roofThickness

function arcWall(id: string, kind: WallKind, r: number, thickness: number, fromDeg: number, toDeg: number, y0: number, y1: number, extra: Partial<WallBox> = {}): WallBox {
  const a0 = fromDeg * DEG
  const a1 = toDeg * DEG
  const b = sectorBox(0, 0, r - thickness / 2, r + thickness / 2, a0, a1)
  return { id, kind, min: [b.minX, y0, b.minZ], max: [b.maxX, y1, b.maxZ], shape: { kind: 'arc', cx: 0, cz: 0, r, thickness, a0, a1 }, ...extra }
}

function segWall(id: string, kind: WallKind, ax: number, az: number, bx: number, bz: number, thickness: number, y0: number, y1: number, extra: Partial<WallBox> = {}): WallBox {
  const len = Math.hypot(bx - ax, bz - az) || 1
  const nx = (-(bz - az) / len) * (thickness / 2)
  const nz = ((bx - ax) / len) * (thickness / 2)
  const xs = [ax + nx, ax - nx, bx + nx, bx - nx]
  const zs = [az + nz, az - nz, bz + nz, bz - nz]
  return { id, kind, min: [Math.min(...xs), y0, Math.min(...zs)], max: [Math.max(...xs), y1, Math.max(...zs)], shape: { kind: 'seg', ax, az, bx, bz, thickness }, ...extra }
}

/** Radial wall along plan angle `aDeg` from radius r0 to r1. */
function radialWall(id: string, kind: WallKind, aDeg: number, r0: number, r1: number, thickness: number, y0: number, y1: number, extra: Partial<WallBox> = {}) {
  const [ax, az] = polar(r0, aDeg)
  const [bx, bz] = polar(r1, aDeg)
  return segWall(id, kind, ax, az, bx, bz, thickness, y0, y1, extra)
}

const DR = MUSEUM.drum
const AN = MUSEUM.annex
const HW = MUSEUM.descriptionWall
const FW = MUSEUM.innerMainWall
const DW = MUSEUM.hallwayWall
const FIN = MUSEUM.fins
const OC = MUSEUM.oculus
const lobeC = DR.r + T / 2
const ringC = DR.ringR + T / 2
const at = AN.thickness
/** x of the annex side-wall centrelines. */
const annexWallX = KEY.annexHalf + at / 2
/** z where the annex side-wall centrelines meet the lobe centreline. */
const annexJoinZ = Math.sqrt(lobeC * lobeC - annexWallX * annexWallX)
const endC = AN.endZ + at / 2
const FC = MUSEUM.forecourt
const LR = MUSEUM.landscape.r
/** Forecourt sides meet the landscape edge here. */
const fcJoinZ = Math.sqrt(LR * LR - FC.halfWidth * FC.halfWidth)
const fcGapDeg = Math.asin(FC.halfWidth / LR) / DEG

/** A notch wall with its door: ring-side pier, lobe-side pier and the lintel over the door. */
function notchWalls(id: string, aDeg: number): WallBox[] {
  return [
    radialWall(`${id}-in`, 'notch', aDeg, DR.ringR, NOTCH_DOOR.r0, T, 0, H),
    radialWall(`${id}-out`, 'notch', aDeg, NOTCH_DOOR.r1, DR.r + T, T, 0, H),
    radialWall(`${id}-lintel`, 'notch', aDeg, NOTCH_DOOR.r0, NOTCH_DOOR.r1, T, NOTCH_DOOR.height, H, { collide: false }),
  ]
}

/** An arch in the ring circle: the open bay collides nowhere; its lintel runs from the spring to the slab. */
function archWall(id: string, a: { fromDeg: number; toDeg: number; spring: number }): WallBox {
  return arcWall(id, 'lintel', ringC, T, a.fromDeg, a.toDeg, a.spring, H, { collide: false })
}

/** An arc about its own centre (cx, cz), angles in degrees about that centre. */
function arcAbout(id: string, kind: WallKind, cx: number, cz: number, r: number, thickness: number, fromDeg: number, toDeg: number, y0: number, y1: number, extra: Partial<WallBox> = {}): WallBox {
  const a0 = fromDeg * DEG
  const a1 = toDeg * DEG
  const b = sectorBox(cx, cz, r - thickness / 2, r + thickness / 2, a0, a1)
  return { id, kind, min: [b.minX, y0, b.minZ], max: [b.maxX, y1, b.maxZ], shape: { kind: 'arc', cx, cz, r, thickness, a0, a1 }, ...extra }
}

/** A polyline of straight wall segments (each overlapping the next at the joint). */
function polyWalls(id: string, kind: WallKind, pts: [number, number][], thickness: number, y0: number, y1: number, extra: Partial<WallBox> = {}): WallBox[] {
  const out: WallBox[] = []
  for (let i = 1; i < pts.length; i++) out.push(segWall(`${id}-${i}`, kind, pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], thickness, y0, y1, extra))
  return out
}

/**
 * The Parikrama's serpentine (GRAND §2.6): the drum-side parapet from gate to gate, the
 * courtyard wall wherever the walk leaves the rooms' inner wall, and a closing wall from that
 * wall's ends to the first and last room, so every courtyard is closed and both gates open.
 */
function serpentineWalls(): WallBox[] {
  const S = SERPENTINE
  const out: WallBox[] = polyWalls('serp-in', 'serpentine', serpentineOffset(-SERP_OFFSET), S.t, 0, S.parapetH)
  serpentineOuterRuns().forEach(([a0, a1], i) => out.push(...polyWalls(`serp-out-${i + 1}`, 'serpentine', serpentineOffset(SERP_OFFSET, a0, a1), S.t, 0, S.wallH)))
  const ends: [string, number][] = [
    ['serp-close-w', SATELLITES[0].fromDeg],
    ['serp-close-e', SATELLITES[SATELLITES.length - 1].toDeg],
  ]
  for (const [id, aDeg] of ends) {
    const [from] = serpentineOffset(SERP_OFFSET, aDeg, aDeg + 0.01)
    const [tx, tz] = polar(SAT_WALL.innerC, aDeg)
    out.push(segWall(id, 'serpentine', from[0], from[1], tx, tz, S.t, 0, S.wallH))
  }
  return out
}

/**
 * The Red Room (p09r): a round wall about its own centre with the door facing the library's
 * door and two side openings into the library's wings; a short vestibule wall either side of
 * the door closes the slot between the room and the library's inner wall; lintels over all three.
 */
function redRoomWalls(): WallBox[] {
  const RR = RED_ROOM
  const rc = RR.r + RR.t / 2
  // bearings about the room's centre: the door faces the drum centre, the sides run along the crescent
  const door = Math.atan2(-RR.cz, -RR.cx) / DEG
  const east = door - 90
  const west = door + 90
  const dh = Math.asin(RR.doorWidth / 2 / rc) / DEG
  const sh = Math.asin(RR.sideWidth / 2 / rc) / DEG
  const lintelY = SAT_WALL.door.height
  const out: WallBox[] = [
    arcAbout('rr-wall-e', 'red-room', RR.cx, RR.cz, rc, RR.t, east + sh, door - dh, 0, RR.height),
    arcAbout('rr-wall-w', 'red-room', RR.cx, RR.cz, rc, RR.t, door + dh, west - sh, 0, RR.height),
    arcAbout('rr-wall-n', 'red-room', RR.cx, RR.cz, rc, RR.t, west + sh, east + 360 - sh, 0, RR.height),
    arcAbout('rr-lintel-door', 'red-room', RR.cx, RR.cz, rc, RR.t, door - dh, door + dh, lintelY, RR.height - 0.002, { collide: false }),
    arcAbout('rr-lintel-e', 'red-room', RR.cx, RR.cz, rc, RR.t, east - sh, east + sh, lintelY, RR.height - 0.002, { collide: false }),
    arcAbout('rr-lintel-w', 'red-room', RR.cx, RR.cz, rc, RR.t, west - sh, west + sh, lintelY, RR.height - 0.002, { collide: false }),
  ]
  // vestibule: from each door jamb straight back to the library's inner wall (radially about the drum)
  const da = RR.aDeg * DEG
  const [ux, uz] = [Math.cos(da), Math.sin(da)]
  const [vx, vz] = [-Math.sin(da), Math.cos(da)]
  for (const side of [-1, 1] as const) {
    const off = side * (RR.doorWidth / 2 + RR.t / 2)
    const back = Math.sqrt(rc * rc - off * off)
    const jx = RR.cx - ux * back + vx * off
    const jz = RR.cz - uz * back + vz * off
    // along the drum radius at that tangential offset, to the inner wall's room-side face
    const along = Math.hypot(RR.cx, RR.cz) - back - (SAT_WALL.innerFace - 0.05)
    out.push(segWall(`rr-vestibule-${side < 0 ? 'w' : 'e'}`, 'red-room', jx, jz, jx - ux * along, jz - uz * along, RR.t, 0, lintelY))
  }
  return out
}

/** The east stair's lower flight where it is below head height (render: false — its owner draws the stair). */
function eastStairWalls(): WallBox[] {
  const E = EAST_STAIR
  const L = E.lower
  // below `headroom` from the flight's foot; the foot itself stops at the annex wall's line
  const climb = (L.fromDeg - L.toDeg) * (E.headroom / (L.y1 - L.y0))
  return [arcWall('stair-e', 'stair', E.r, E.width, L.fromDeg - climb, EAST_STAIR_FOOT_DEG, 0, E.headroom, { render: false })]
}

/**
 * The north wing's walls: per room the inner wall either side of its door with the lintel over
 * it, the outer wall and the two radial end walls; the jali screens in the slots between the
 * rooms, the theatre's lobby baffle, the berm behind the rooms, the serpentine and the Red Room.
 */
function northWingWalls(): WallBox[] {
  const S = SAT_WALL
  const out: WallBox[] = []
  for (const s of SATELLITES) {
    const d0 = s.doorDeg - SAT_DOOR_HALF_DEG
    const d1 = s.doorDeg + SAT_DOOR_HALF_DEG
    out.push(
      arcWall(`sat-${s.id}-inner-a`, 'satellite', S.innerC, S.t, s.fromDeg, d0, 0, s.height),
      arcWall(`sat-${s.id}-inner-b`, 'satellite', S.innerC, S.t, d1, s.toDeg, 0, s.height),
      // 2 mm under the wall tops, so the lintel's top never sits in the piers' plane
      arcWall(`sat-${s.id}-lintel`, 'satellite', S.innerC, S.t, d0, d1, S.door.height, s.height - 0.002, { collide: false }),
      arcWall(`sat-${s.id}-outer`, 'satellite', S.outerC, S.t, s.fromDeg, s.toDeg, 0, s.height),
      radialWall(`sat-${s.id}-end-w`, 'satellite', s.fromDeg, S.innerC - S.t / 2, S.outerOuter, S.t, 0, s.height),
      radialWall(`sat-${s.id}-end-e`, 'satellite', s.toDeg, S.innerC - S.t / 2, S.outerOuter, S.t, 0, s.height),
      // the earth berm against the room's back closes the strip to the plinth's edge
      arcWall(`berm-${s.id}`, 'boundary', (S.outerOuter + LR) / 2, LR - S.outerOuter, s.fromDeg - 1, s.toDeg + 1, 0, 1.2, { render: false }),
    )
  }
  JALI_SLOTS.forEach(([a0, a1], i) => out.push(arcWall(`jali-${i + 1}`, 'jali', S.innerC, JALI.t, a0, a1, 0, JALI.height, { render: false })))
  const b = THEATRE.baffle
  out.push(radialWall('sat-theatre-baffle', 'baffle', b.aDeg, b.r0, b.r1, b.t, 0, b.h, { render: false }))
  out.push(...serpentineWalls(), ...redRoomWalls())
  return out
}

/** The Sphere Well's rim balustrade: a solid disc to visitors (the room below is reached by the perch). */
const SW = SPHERE_WELL
const WELL_RIM: WallBox = {
  id: 'well-rim',
  kind: 'tower',
  min: [SW.cx - SW.rimR, 0, SW.cz - SW.rimR],
  max: [SW.cx + SW.rimR, SW.rimH, SW.cz + SW.rimR],
  shape: { kind: 'arc', cx: SW.cx, cz: SW.cz, r: SW.rimR - 0.15, thickness: 0.3, a0: 0, a1: Math.PI * 2 },
}

export const WALLS: WallBox[] = [
  // ── Drum: lobe round the annex (gap for the annex mouth), gallery ring, notch walls ──
  arcWall('drum-lobe-east', 'drum', lobeC, T, DR.neNotchDeg, 90 - KEY.annexGapDeg, 0, H),
  arcWall('drum-lobe-west', 'drum', lobeC, T, 90 + KEY.annexGapDeg, DR.dNotchDeg, 0, H),
  arcWall('drum-ring', 'drum', ringC, T, DR.dNotchDeg, DR.neNotchDeg + 360, 0, H),
  // the notch walls carry the doors to the Parikrama walk (ring side, door, lobe side, lintel)
  ...notchWalls('notch-ne', DR.neNotchDeg),
  ...notchWalls('notch-d', DR.dNotchDeg),
  // the three great arches in the ring circle (their owner draws the true intrados)
  archWall('arch-e-east', ARCH.eEast),
  archWall('arch-e-west', ARCH.eWest),
  archWall('arch-d', ARCH.d),

  // ── Annex G: side walls, end wall with the entrance portal ──
  segWall('annex-east', 'annex', annexWallX, annexJoinZ, annexWallX, AN.endZ + at, at, 0, H),
  segWall('annex-west', 'annex', -annexWallX, annexJoinZ, -annexWallX, AN.endZ + at, at, 0, H),
  segWall('annex-end-east', 'annex', KEY.doorHalf, endC, KEY.annexOuterHalf, endC, at, 0, H),
  segWall('annex-end-west', 'annex', -KEY.annexOuterHalf, endC, -KEY.doorHalf, endC, at, 0, H),
  segWall('annex-door-lintel', 'lintel', -KEY.doorHalf, endC, KEY.doorHalf, endC, at, AN.door.height, H, { collide: false }),

  // ── On the ring circle: H (description) and D (hallway); inside it F (inner main) ──
  arcWall('wall-h', 'description', HW.r, HW.thickness, HW.fromDeg, HW.toDeg, 0, HW.height),
  arcWall('wall-f', 'inner-main', FW.r, FW.thickness, FW.fromDeg, FW.toDeg, 0, FW.height),
  arcWall('wall-d', 'hallway', DW.r, DW.thickness, DW.fromDeg, DW.toDeg, 0, DW.height),

  // ── Formation gates between the podium runs (their owner draws the eroded clay) ──
  radialWall('gate-ab', 'fin', FIN.atDeg[0], FIN.r0, FIN.r1, FIN.thickness, 0, FIN.height, { render: false }),
  radialWall('gate-bc', 'fin', FIN.atDeg[1], FIN.r0, FIN.r1, FIN.thickness, 0, FIN.height, { render: false }),

  // ── The pool court's curb ring (the court's owner draws the curb, the pool and the lotus) ──
  arcWall('oculus-plinth', 'plinth', OC.rings[0] - OC.curbThickness / 2, OC.curbThickness, 0, 360, 0, OC.curbHeight, { render: false }),

  // ── The east stair, against the lobe in the east ambulatory ──
  ...eastStairWalls(),

  // ── The portal's lacquered jambs, standing 0.6 m proud of the facade (Pavilion.tsx draws them) ──
  ...[1, -1].map((s) => segWall(`portal-jamb-${s > 0 ? 'east' : 'west'}`, 'boundary', s * (KEY.doorHalf + 0.25), KEY.annexOuterZ, s * (KEY.doorHalf + 0.25), KEY.annexOuterZ + 0.6, 0.5, 0, MUSEUM.annex.door.height, { render: false })),

  // ── Site edge: landscape disc + forecourt (invisible) ──
  arcWall('boundary-landscape', 'boundary', LR + 0.1, 0.2, 90 + fcGapDeg, 450 - fcGapDeg, 0, 1.2, { render: false }),
  segWall('boundary-forecourt-east', 'boundary', FC.halfWidth + 0.1, fcJoinZ - 0.2, FC.halfWidth + 0.1, FC.endZ + 0.2, 0.2, 0, 1.2, { render: false }),
  segWall('boundary-forecourt-west', 'boundary', -FC.halfWidth - 0.1, fcJoinZ - 0.2, -FC.halfWidth - 0.1, FC.endZ + 0.2, 0.2, 0, 1.2, { render: false }),
  segWall('boundary-forecourt-south', 'boundary', -FC.halfWidth - 0.2, FC.endZ + 0.1, FC.halfWidth + 0.2, FC.endZ + 0.1, 0.2, 0, 1.2, { render: false }),

  // ── The Sphere Well's rim, sunk in the plinth south-west of the drum ──
  WELL_RIM,

  // ── North wing (satellites.ts): the crescent rooms, jali slots, berm, serpentine, Red Room ──
  ...northWingWalls(),
]

/* ------------------------------------------------------------------ */
/* Display surfaces — where artworks / panels can be hung             */
/* ------------------------------------------------------------------ */

/**
 * Every surface is a straight run (`runAxis: 'along'`): `at` is metres from `a` along `dir`,
 * `range` is [0, length]. `dir` points to the right of a visitor facing the wall.
 * Numbering follows the walking order (A → B → C → D → E).
 */
export type SurfaceId =
  // Gallery ring wall (concave), behind the podiums
  | 'a-outer-1'
  | 'a-outer-2'
  | 'a-outer-3'
  | 'b-outer-1'
  | 'b-outer-2'
  | 'b-outer-3'
  | 'b-outer-4'
  | 'c-outer-1'
  | 'c-outer-2'
  // C's south flank: inside face of the hallway wall
  | 'c-south-1'
  | 'c-south-2'
  | 'c-south-3'
  // Hallway D: drum lobe (outer) and hallway wall (inner)
  | 'd-hallway-1'
  | 'd-hallway-2'
  | 'd-hallway-3'
  | 'd-hallway-4'
  | 'd-hallway-5'
  | 'd-hallway-6'
  | 'd-inner-1'
  | 'd-inner-2'
  | 'd-inner-3'
  // Entry ways E: drum lobe either side of the annex mouth
  | 'e-north-1'
  | 'e-north-2'
  | 'e-north-3'
  | 'e-south-1'
  | 'e-south-2'
  | 'e-south-3'
  // H — gallery description wall: entrance face (title in the middle) and back face
  | 'h-east'
  | 'h-description'
  | 'h-west'
  | 'h-inner-1'
  | 'h-inner-2'
  | 'h-inner-3'
  | 'h-inner-4'
  // F — inner main wall: face towards H, and the oculus-court face (main panel in the middle)
  | 'f-outer-1'
  | 'f-outer-2'
  | 'f-outer-3'
  | 'f-outer-4'
  | 'f-outer-5'
  | 'f-inner-1'
  | 'f-inner-2'
  | 'f-inner-main'
  | 'f-inner-3'
  | 'f-inner-4'
  // Annex G side walls and the entrance front either side of the door
  | 'g-east'
  | 'g-west'
  | 'g-facade-east'
  | 'g-facade-west'
  // Agni Theatre: the curved screen on the outer wall
  | 'th-screen'

export interface DisplaySurface {
  id: SurfaceId
  label: string
  zone: ZoneId
  /** 'along' = a straight run from `a` in direction `dir`; 'x' / 'z' = axis-aligned (legacy). */
  runAxis: 'x' | 'z' | 'along'
  /** Signed offset of the wall plane along its normal (dot(a, normal)); axis surfaces: the face coordinate. */
  face: number
  /** Outward face normal in XZ (points into the room the surface faces). */
  normal: [number, number]
  /** Usable extent: [0, length] for 'along' surfaces. */
  range: [number, number]
  height: number
  /** Start point [x, z] of the run (at = 0). */
  a: [number, number]
  /** Unit run direction [dx, dz] — to the right of a visitor facing the wall. */
  dir: [number, number]
  /** WALLS id the surface is hung on. */
  wall: string
  /** Kept for a spectacle installation (named here); the admin warns before content is placed on it. */
  reserved?: string
}

/** Margin kept free at each end of a facet / run (m). */
const END_MARGIN = 0.05

interface FacetSpec {
  id: SurfaceId
  label: string
  /** Face radius (m). */
  r: number
  fromDeg: number
  toDeg: number
  /** Concave = the face looks towards the centre (inside of a ring). */
  concave: boolean
  height: number
  wall: string
  /** Margin kept free at each end (default END_MARGIN). */
  margin?: number
}

/**
 * A straight hanging run for one angular slice of a curved face. Concave faces use the chord
 * (frames stand at most the sagitta off the wall at mid-facet); convex faces use the tangent at
 * mid-facet, clipped to the slice (frames touch at their centre, ends stand off).
 */
function facet(s: FacetSpec): Omit<DisplaySurface, 'zone'> {
  const a0 = s.fromDeg * DEG
  const a1 = s.toDeg * DEG
  const m = (a0 + a1) / 2
  const half = (a1 - a0) / 2
  // outward = away from the drum centre
  const out: [number, number] = [Math.cos(m), Math.sin(m)]
  const normal: [number, number] = s.concave ? [-out[0], -out[1]] : out
  const dir: [number, number] = [normal[1], -normal[0]]
  let mid: [number, number]
  let halfLen: number
  if (s.concave) {
    mid = [s.r * Math.cos(half) * out[0], s.r * Math.cos(half) * out[1]]
    halfLen = s.r * Math.sin(half)
  } else {
    mid = [s.r * out[0], s.r * out[1]]
    halfLen = s.r * Math.tan(half)
  }
  halfLen -= s.margin ?? END_MARGIN
  const a: [number, number] = [mid[0] - dir[0] * halfLen, mid[1] - dir[1] * halfLen]
  return {
    id: s.id,
    label: s.label,
    runAxis: 'along',
    face: a[0] * normal[0] + a[1] * normal[1],
    normal,
    range: [0, 2 * halfLen],
    height: s.height,
    a,
    dir,
    wall: s.wall,
  }
}

/** Split [fromDeg, toDeg] into ids.length equal facets, numbered from `fromDeg` (or from `toDeg` when reversed). */
function facets(ids: SurfaceId[], label: (i: number) => string, r: number, fromDeg: number, toDeg: number, concave: boolean, height: number, wall: string, reversed = false) {
  const n = ids.length
  const step = (toDeg - fromDeg) / n
  return ids.map((id, i) => {
    const k = reversed ? n - 1 - i : i
    return facet({ id, label: label(i + 1), r, fromDeg: fromDeg + k * step, toDeg: fromDeg + (k + 1) * step, concave, height, wall })
  })
}

/** A straight run between two points on a straight wall face. */
function run(id: SurfaceId, label: string, a: [number, number], b: [number, number], normal: [number, number], height: number, wall: string): Omit<DisplaySurface, 'zone'> {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1])
  const dir: [number, number] = [(b[0] - a[0]) / len, (b[1] - a[1]) / len]
  return { id, label, runAxis: 'along', face: a[0] * normal[0] + a[1] * normal[1], normal, range: [0, len], height, a, dir, wall }
}

function buildSurfaces(): Record<SurfaceId, DisplaySurface> {
  const ringR = DR.ringR
  const lobeR = DR.r
  const ne = DR.neNotchDeg
  const dn = DR.dNotchDeg
  const [finAB, finBC] = FIN.atDeg
  const gap = KEY.annexGapDeg
  const ringH = H
  const list: Omit<DisplaySurface, 'zone'>[] = [
    // Gallery ring (concave), walking order = decreasing angle
    ...facets(['a-outer-1', 'a-outer-2', 'a-outer-3'], (i) => `Gallery A — ring wall ${i}`, ringR, finAB, ne, true, ringH, 'drum-ring', true),
    ...facets(['b-outer-1', 'b-outer-2', 'b-outer-3', 'b-outer-4'], (i) => `Gallery B — ring wall ${i}`, ringR, finBC, finAB, true, ringH, 'drum-ring', true),
    ...facets(['c-outer-1', 'c-outer-2'], (i) => `Gallery C — ring wall ${i}`, ringR, dn - 360, finBC, true, ringH, 'drum-ring', true),
    // Hallway wall (the ring circle from the E-west arch to the D arch): inside face (C's south flank) and outside face (hallway)
    ...facets(['c-south-1', 'c-south-2', 'c-south-3'], (i) => `Gallery C — curved wall ${i}`, DW.r - DW.thickness / 2, DW.fromDeg, DW.toDeg, true, DW.height, 'wall-d', true),
    ...facets(['d-hallway-1', 'd-hallway-2', 'd-hallway-3', 'd-hallway-4', 'd-hallway-5', 'd-hallway-6'], (i) => `Hallway D — outer wall ${i}`, lobeR, DW.fromDeg, dn, true, ringH, 'drum-lobe-west', true),
    ...facets(['d-inner-1', 'd-inner-2', 'd-inner-3'], (i) => `Hallway D — inner wall ${i}`, DW.r + DW.thickness / 2, DW.fromDeg, DW.toDeg, false, DW.height, 'wall-d', true),
    // Entry ways (the ambulatory): the lobe either side of the annex mouth
    ...facets(['e-north-1', 'e-north-2', 'e-north-3'], (i) => `Entry way (east) — drum wall ${i}`, lobeR, ne, 90 - gap, true, ringH, 'drum-lobe-east', true),
    ...facets(['e-south-1', 'e-south-2', 'e-south-3'], (i) => `Entry way (west) — drum wall ${i}`, lobeR, 90 + gap, DW.fromDeg, true, ringH, 'drum-lobe-west'),
    // H: annex face (convex, the title in the middle), corridor face (concave, the strata wall)
    facet({ id: 'h-east', label: 'Description wall — east wing', r: HW.r + HW.thickness / 2, fromDeg: HW.fromDeg, toDeg: 90 - H_TITLE_HALF_DEG, concave: false, height: HW.height, wall: 'wall-h' }),
    facet({ id: 'h-description', label: 'Description wall — title and introduction', r: HW.r + HW.thickness / 2, fromDeg: 90 - H_TITLE_HALF_DEG, toDeg: 90 + H_TITLE_HALF_DEG, concave: false, height: HW.height, wall: 'wall-h' }),
    facet({ id: 'h-west', label: 'Description wall — west wing', r: HW.r + HW.thickness / 2, fromDeg: 90 + H_TITLE_HALF_DEG, toDeg: HW.toDeg, concave: false, height: HW.height, wall: 'wall-h' }),
    ...facets(['h-inner-1', 'h-inner-2', 'h-inner-3', 'h-inner-4'], (i) => `Description wall — back ${i}`, HW.r - HW.thickness / 2, HW.fromDeg, HW.toDeg, true, HW.height, 'wall-h'),
    // F: face towards H (convex), oculus-court face (concave)
    ...facets(['f-outer-1', 'f-outer-2', 'f-outer-3', 'f-outer-4', 'f-outer-5'], (i) => `Inner main wall — entry side ${i}`, FW.r + FW.thickness / 2, FW.fromDeg, FW.toDeg, false, FW.height, 'wall-f'),
    ...facets(['f-inner-1', 'f-inner-2', 'f-inner-main', 'f-inner-3', 'f-inner-4'], (i) => (i === 3 ? 'Inner main wall — oculus court, centre' : `Inner main wall — oculus court ${i < 3 ? i : i - 1}`), FW.r - FW.thickness / 2, FW.fromDeg, FW.toDeg, true, FW.height, 'wall-f'),
    // Annex G side walls (inside) and the entrance front either side of the door (outside)
    run('g-east', 'Earth Room — east wall', [KEY.annexHalf, KEY.annexMouthZ + 0.3], [KEY.annexHalf, AN.endZ - 0.15], [-1, 0], H, 'annex-east'),
    run('g-west', 'Earth Room — west wall', [-KEY.annexHalf, AN.endZ - 0.15], [-KEY.annexHalf, KEY.annexMouthZ + 0.3], [1, 0], H, 'annex-west'),
    run('g-facade-east', 'Entrance front — east of the portal', [KEY.doorHalf + 0.12, KEY.annexOuterZ], [KEY.annexOuterHalf - 0.05, KEY.annexOuterZ], [0, 1], H, 'annex-end-east'),
    run('g-facade-west', 'Entrance front — west of the portal', [-KEY.annexOuterHalf + 0.05, KEY.annexOuterZ], [-KEY.doorHalf - 0.12, KEY.annexOuterZ], [0, 1], H, 'annex-end-west'),
    // The Agni Theatre's screen: the whole chord of the outer wall's face from screenFrom to screenTo
    facet({ id: 'th-screen', label: 'Agni Theatre — screen', r: SAT_WALL.outerFace, fromDeg: THEATRE.screenFrom, toDeg: THEATRE.screenTo, concave: true, height: satellite('theatre').height, wall: 'sat-theatre-outer', margin: 0 }),
  ]
  const out = {} as Record<SurfaceId, DisplaySurface>
  for (const s of list) {
    // The zone is whatever room a viewer half a metre in front of the middle stands in.
    const mid = (s.range[0] + s.range[1]) / 2
    const x = s.a[0] + s.dir[0] * mid + s.normal[0] * 0.5
    const z = s.a[1] + s.dir[1] * mid + s.normal[1] * 0.5
    const reserved = RESERVED[s.id]
    out[s.id] = { ...s, zone: zoneAt(x, z)?.id ?? 'entrance-court', ...(reserved ? { reserved } : {}) }
  }
  return out
}

/** Half-angle (deg) of the title facet in the middle of H's annex face (it carries the 6 m carved panel). */
const H_TITLE_HALF_DEG = 13

/** Surfaces kept for spectacle and grand installations (SPECTACLE §1.5, GRAND §2.4). */
const RESERVED: Partial<Record<SurfaceId, string>> = {
  'h-inner-1': 'Earth section (strata wall)',
  'h-inner-2': 'Earth section (strata wall)',
  'h-inner-3': 'Earth section (strata wall)',
  'h-inner-4': 'Earth section (strata wall)',
  'f-inner-1': 'Mandala of clay tools',
  'f-inner-main': 'Niche: form rising from matter',
  'f-inner-4': 'Terracotta medallion',
  'b-outer-1': 'White niche wall (Molela)',
  'b-outer-2': 'White niche wall (Molela)',
  'b-outer-3': 'White niche wall (Molela)',
  'b-outer-4': 'White niche wall (Molela)',
  'f-outer-1': 'Lippan relief',
  'f-outer-2': 'Lippan relief',
  'f-outer-3': 'Lippan relief',
  'f-outer-4': 'Lippan relief',
  'f-outer-5': 'Lippan relief',
  'g-east': 'Earth Room formations and shelves',
  'g-west': 'Earth Room formations and shelves',
  'd-hallway-1': 'Wine Hall plinth wall',
  'd-hallway-2': 'Wine Hall plinth wall',
  'd-hallway-3': 'Wine Hall plinth wall',
  'd-hallway-4': 'Wine Hall plinth wall',
  'd-hallway-5': 'Wine Hall plinth wall',
  'd-hallway-6': 'Wine Hall plinth wall',
  'th-screen': 'Agni Theatre screen',
}

/** World transform for a point on a display surface. */
export function surfacePoint(surfaceId: SurfaceId, at: number, y: number, standOff = 0) {
  const s = SURFACES[surfaceId]
  const [nx, nz] = s.normal
  let x: number
  let z: number
  if (s.runAxis === 'along') {
    x = s.a[0] + s.dir[0] * at + nx * standOff
    z = s.a[1] + s.dir[1] * at + nz * standOff
  } else {
    x = s.runAxis === 'z' ? s.face + nx * standOff : at
    z = s.runAxis === 'z' ? at : s.face + nz * standOff
  }
  const rotationY = Math.atan2(nx, nz)
  return { position: [x, y, z] as Vec3, rotationY, normal: [nx, 0, nz] as Vec3 }
}

/* ------------------------------------------------------------------ */
/* Zones (minimap, orientation, teleport, culling)                     */
/* ------------------------------------------------------------------ */

export type ZoneId =
  | 'entrance-court'
  | 'annex'
  | 'entry-e'
  | 'ring-a'
  | 'ring-b'
  | 'ring-c'
  | 'hallway-d'
  | 'inner'
  // north wing (satellites.ts)
  | 'atlas'
  | 'theatre'
  | 'library'
  | 'shop'
  | 'parikrama-west'
  | 'parikrama-east'
  // reached by the perch only (level 2): the roof round the oculus, the duplex balcony, the Sphere Well's room
  | 'sky-rim'
  | 'duplex'
  | 'sphere-well'

/** Zone footprint. Sector angles in radians (a0 < a1); polygons are [x, z] rings, optionally with holes. */
export type ZoneShape =
  | { kind: 'sector'; cx: number; cz: number; r0: number; r1: number; a0: number; a1: number }
  | { kind: 'poly'; points: [number, number][]; holes?: [number, number][][] }
  | { kind: 'union'; parts: ZoneShape[] }

export interface Zone {
  id: ZoneId
  name: string
  short: string
  /** Bounding box of `shape` (or the zone itself when it has no shape). */
  rect: { minX: number; maxX: number; minZ: number; maxZ: number }
  /** Exact footprint; zoneAt tests it when present. */
  shape?: ZoneShape
  /** Label / centre point for plans and lists. */
  anchor: [number, number]
  /** Where "go to" places the visitor, facing yawDeg (compass: 0 = north / −z, 90 = east / +x). */
  spawn: { x: number; z: number; yawDeg: number }
  /** Ceiling / wall height of the space (for lighting mounts). */
  height: number
  /** Open to the sky (no ceiling). */
  outdoor?: boolean
  /**
   * 2 = reached by a perch (the Sky Rim, the duplex balcony, the Sphere Well's room): never found
   * by zoneAt (each lies over or under a ground zone), not drawn on the plan; the perch reports
   * it. Omitted = ground level.
   */
  level?: number
}

const sector = (r0: number, r1: number, fromDeg: number, toDeg: number, cx = 0, cz = 0): ZoneShape => ({ kind: 'sector', cx, cz, r0, r1, a0: fromDeg * DEG, a1: toDeg * DEG })

/** Points along a circle from → to (deg), inclusive, every ~stepDeg. */
function arcPoints(r: number, fromDeg: number, toDeg: number, stepDeg = 4): [number, number][] {
  const n = Math.max(1, Math.ceil(Math.abs(toDeg - fromDeg) / stepDeg))
  return Array.from({ length: n + 1 }, (_, i) => polar(r, fromDeg + ((toDeg - fromDeg) * i) / n))
}

function shapeBox(s: ZoneShape): Zone['rect'] {
  if (s.kind === 'sector') return sectorBox(s.cx, s.cz, s.r0, s.r1, s.a0, s.a1)
  if (s.kind === 'poly') {
    const xs = s.points.map((p) => p[0])
    const zs = s.points.map((p) => p[1])
    return { minX: Math.min(...xs), maxX: Math.max(...xs), minZ: Math.min(...zs), maxZ: Math.max(...zs) }
  }
  const boxes = s.parts.map(shapeBox)
  return {
    minX: Math.min(...boxes.map((b) => b.minX)),
    maxX: Math.max(...boxes.map((b) => b.maxX)),
    minZ: Math.min(...boxes.map((b) => b.minZ)),
    maxZ: Math.max(...boxes.map((b) => b.maxZ)),
  }
}

function inPoly(pts: [number, number][], x: number, z: number) {
  let inside = false
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, zi] = pts[i]
    const [xj, zj] = pts[j]
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside
  }
  return inside
}

export function shapeContains(s: ZoneShape, x: number, z: number): boolean {
  if (s.kind === 'sector') {
    const dx = x - s.cx
    const dz = z - s.cz
    const r = Math.hypot(dx, dz)
    if (r < s.r0 || r > s.r1) return false
    return r === 0 || angleIn(Math.atan2(dz, dx), s.a0, s.a1)
  }
  if (s.kind === 'poly') return inPoly(s.points, x, z) && !(s.holes ?? []).some((h) => inPoly(h, x, z))
  return s.parts.some((p) => shapeContains(p, x, z))
}

function segPointDist(ax: number, az: number, bx: number, bz: number, x: number, z: number) {
  const dx = bx - ax
  const dz = bz - az
  const l2 = dx * dx + dz * dz
  const t = l2 > 0 ? Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2)) : 0
  return Math.hypot(ax + dx * t - x, az + dz * t - z)
}

/** Distance from (x, z) to a zone shape (0 inside). */
export function shapeDistance(s: ZoneShape, x: number, z: number): number {
  if (shapeContains(s, x, z)) return 0
  if (s.kind === 'sector') {
    const dx = x - s.cx
    const dz = z - s.cz
    const r = Math.hypot(dx, dz)
    const a = Math.atan2(dz, dx)
    if (angleIn(a, s.a0, s.a1)) return r < s.r0 ? s.r0 - r : r - s.r1
    let best = Infinity
    for (const e of [s.a0, s.a1]) {
      const c = Math.cos(e)
      const sn = Math.sin(e)
      best = Math.min(best, segPointDist(s.cx + s.r0 * c, s.cz + s.r0 * sn, s.cx + s.r1 * c, s.cz + s.r1 * sn, x, z))
    }
    return best
  }
  if (s.kind === 'poly') {
    let best = Infinity
    for (const p of [s.points, ...(s.holes ?? [])]) {
      for (let i = 0, j = p.length - 1; i < p.length; j = i++) best = Math.min(best, segPointDist(p[j][0], p[j][1], p[i][0], p[i][1], x, z))
    }
    return best
  }
  return Math.min(...s.parts.map((p) => shapeDistance(p, x, z)))
}

/** Compass yaw (deg) for a facing direction in XZ. */
const yawOf = (fx: number, fz: number) => ((Math.atan2(fx, -fz) / DEG) % 360 + 360) % 360

/** Spawn on the drum's polar grid, facing 'out' (towards the wall), 'in' (towards the centre) or along the walking direction ('cw' = decreasing angle). */
function spawnAt(r: number, aDeg: number, facing: 'out' | 'in' | 'cw' | 'ccw') {
  const [x, z] = polar(r, aDeg)
  const c = Math.cos(aDeg * DEG)
  const s = Math.sin(aDeg * DEG)
  const f: Record<typeof facing, [number, number]> = { out: [c, s], in: [-c, -s], cw: [s, -c], ccw: [-s, c] }
  const [fx, fz] = f[facing]
  return { x, z, yawDeg: yawOf(fx, fz) }
}

const R = DR.r
const RING = DR.ringR
const [finAB, finBC] = FIN.atDeg
/** The ring wall's outer face (the ambulatory's and the Parikrama's inner edge). */
const RING_OUT = KEY.ringOuterR
/** F's faces: towards the court and towards the corridor. */
const F_IN = FW.r - FW.thickness / 2
const F_OUT = FW.r + FW.thickness / 2
const CURB = OC.rings[0]
const GAP = KEY.annexGapDeg
/** The corridor between F and H, and the gallery spawns: a little inside the podium row. */
const CORRIDOR_MID = (F_OUT + RING) / 2
const GALLERY_SPAWN_R = (CURB + KEY.podiumR) / 2

/** Annex interior up to its mouth, plus the ambulatory in front of H between the mouth's edges. */
const annexShape: ZoneShape = {
  kind: 'union',
  parts: [
    {
      kind: 'poly',
      points: [
        [-KEY.annexHalf, AN.endZ],
        [KEY.annexHalf, AN.endZ],
        [KEY.annexHalf, KEY.annexMouthZ],
        ...arcPoints(R, Math.atan2(KEY.annexMouthZ, KEY.annexHalf) / DEG, Math.atan2(KEY.annexMouthZ, -KEY.annexHalf) / DEG),
        [-KEY.annexHalf, KEY.annexMouthZ],
      ],
    },
    sector(RING_OUT, R, 90 - GAP, 90 + GAP),
  ],
}

/**
 * Footprint of the building along its OUTER wall faces (drum ring, notches, lobe, annex), as a
 * closed [x, z] ring sampled every ~4°. For roof slabs, floors and plans.
 */
export const BUILDING_OUTLINE: [number, number][] = [
  ...arcPoints(KEY.lobeOuterR, DR.neNotchDeg, Math.acos(KEY.annexOuterHalf / KEY.lobeOuterR) / DEG),
  [KEY.annexOuterHalf, KEY.annexOuterZ],
  [-KEY.annexOuterHalf, KEY.annexOuterZ],
  ...arcPoints(KEY.lobeOuterR, 180 - Math.acos(KEY.annexOuterHalf / KEY.lobeOuterR) / DEG, DR.dNotchDeg),
  ...arcPoints(KEY.ringOuterR, DR.dNotchDeg, DR.neNotchDeg + 360),
]

/**
 * Footprint of the north wing (the Parikrama and the four crescent rooms) along its outer
 * edges: the ring's outer face from the west gate to the NE notch, the walk's edge across the
 * east gate, the rooms' outer face, and the walk's edge across the west gate.
 */
export const NORTH_WING_OUTLINE: [number, number][] = [
  ...arcPoints(PARIKRAMA.r0, PARIKRAMA.fromDeg, PARIKRAMA.toDeg),
  ...arcPoints(PARIKRAMA.r1, PARIKRAMA.toDeg, SATELLITES[SATELLITES.length - 1].toDeg),
  ...arcPoints(SAT_WALL.outerOuter, SATELLITES[SATELLITES.length - 1].toDeg, SATELLITES[0].fromDeg),
  ...arcPoints(PARIKRAMA.r1, SATELLITES[0].fromDeg, PARIKRAMA.fromDeg),
]

/** The Sphere Well's rim on the plan (closed ring). */
export const WELL_OUTLINE: [number, number][] = arcPoints(SW.rimR, 0, 356, 4).map(([x, z]) => [x + SW.cx, z + SW.cz] as [number, number])

/** The interior floor along the INNER wall faces (closed [x, z] ring, ~4° sampling). */
export const FLOOR_OUTLINE: [number, number][] = [
  ...arcPoints(R, DR.neNotchDeg, Math.atan2(KEY.annexMouthZ, KEY.annexHalf) / DEG),
  [KEY.annexHalf, AN.endZ],
  [-KEY.annexHalf, AN.endZ],
  ...arcPoints(R, Math.atan2(KEY.annexMouthZ, -KEY.annexHalf) / DEG, DR.dNotchDeg),
  ...arcPoints(RING, DR.dNotchDeg, DR.neNotchDeg + 360),
]

/**
 * Everything outside the building that a visitor can reach: the landscape disc plus the
 * forecourt, with the building's footprint (outer wall faces), the north wing and the well's
 * rim as holes.
 */
const outdoorShape: ZoneShape = {
  kind: 'poly',
  points: [
    ...arcPoints(LR, 90 - fcGapDeg, -270 + fcGapDeg),
    [-FC.halfWidth, FC.endZ],
    [FC.halfWidth, FC.endZ],
  ],
  holes: [BUILDING_OUTLINE, NORTH_WING_OUTLINE, WELL_OUTLINE],
}

/** A crescent room's mid radius (anchors, plans) and the spawn just inside its door. */
const SAT_MID = (SAT_WALL.innerFace + SAT_WALL.outerFace) / 2
const SAT_SPAWN = SAT_WALL.innerFace + 0.6
const ZH = H
/** The Sky Rim's plan extent (its rail path and a little beyond). */
const SKY_RIM_R = KEY.curbR

/** Zones in walking order (admin lists, guide). zoneAt uses MATCH_ORDER. */
export const ZONES: Zone[] = (
  [
    {
      id: 'entrance-court',
      name: 'Entrance Forecourt',
      short: 'Forecourt',
      shape: outdoorShape,
      anchor: [0, (KEY.annexOuterZ + FC.endZ) / 2],
      spawn: { x: MUSEUM.visitor.start.x, z: MUSEUM.visitor.start.z, yawDeg: MUSEUM.visitor.start.yawDeg },
      height: P.height,
      outdoor: true,
    },
    {
      id: 'annex',
      name: 'Entrance Hall',
      short: 'Entrance',
      shape: annexShape,
      anchor: [0, KEY.annexSkylightZ],
      spawn: { x: 0, z: AN.endZ - 1.6, yawDeg: 0 },
      height: ZH,
    },
    {
      id: 'entry-e',
      name: 'Entry Ways',
      short: 'Entry',
      // the ambulatory either side of the annex mouth, the E arches' thresholds and the corridor between F and H
      shape: {
        kind: 'union',
        parts: [
          sector(RING_OUT, R, DR.neNotchDeg, 90 - GAP),
          sector(RING_OUT, R, 90 + GAP, DW.fromDeg),
          sector(RING, RING_OUT, ARCH.eEast.fromDeg, ARCH.eEast.toDeg),
          sector(RING, RING_OUT, ARCH.eWest.fromDeg, ARCH.eWest.toDeg),
          sector(F_OUT, RING, FW.fromDeg, FW.toDeg),
        ],
      },
      anchor: polar(CORRIDOR_MID, 90),
      spawn: spawnAt(CORRIDOR_MID, 66, 'in'),
      height: ZH,
    },
    {
      id: 'ring-a',
      name: 'Gallery A',
      short: 'Gallery A',
      shape: sector(CURB, RING, finAB, FW.fromDeg),
      anchor: polar(GALLERY_SPAWN_R, (finAB + FW.fromDeg) / 2),
      // between A1 and A2: the gallery's middle (5°) is the Herd's island (GRAND §4.2)
      spawn: spawnAt(GALLERY_SPAWN_R, (MUSEUM.podium.anglesDeg.a[0] + MUSEUM.podium.anglesDeg.a[1]) / 2, 'out'),
      height: ZH,
    },
    {
      id: 'ring-b',
      name: 'Gallery B',
      short: 'Gallery B',
      shape: sector(CURB, RING, finBC, finAB),
      anchor: polar(GALLERY_SPAWN_R, (finAB + finBC) / 2),
      spawn: spawnAt(GALLERY_SPAWN_R, (finAB + finBC) / 2, 'out'),
      height: ZH,
    },
    {
      id: 'ring-c',
      name: 'Gallery C',
      short: 'Gallery C',
      shape: sector(CURB, RING, FW.toDeg, finBC + 360),
      anchor: polar(GALLERY_SPAWN_R, (FW.toDeg + finBC + 360) / 2),
      spawn: spawnAt(GALLERY_SPAWN_R, (DR.dNotchDeg + finBC + 360) / 2, 'out'),
      height: ZH,
    },
    {
      id: 'hallway-d',
      name: 'Hallway',
      short: 'Hallway',
      // the ambulatory from the E-west arch to the D notch, and the D arch's threshold
      shape: { kind: 'union', parts: [sector(RING_OUT, R, DW.fromDeg, DR.dNotchDeg), sector(RING, RING_OUT, ARCH.d.fromDeg, ARCH.d.toDeg)] },
      anchor: polar(KEY.ambMidR, (DW.fromDeg + DR.dNotchDeg) / 2),
      spawn: spawnAt(KEY.ambMidR, ARCH.d.midDeg, 'cw'),
      height: ZH,
    },
    {
      id: 'inner',
      name: 'Oculus Court',
      short: 'Oculus',
      // the pool inside the curb, and the court between the curb and F
      shape: { kind: 'union', parts: [sector(0, CURB, 0, 360), sector(CURB, F_IN, FW.fromDeg, FW.toDeg)] },
      anchor: [0, 0],
      spawn: spawnAt((CURB + F_IN) / 2, 60, 'in'),
      height: ZH,
    },
    // ── North wing: the Parikrama walk (west, then east) and the four rooms off it ──
    {
      id: 'parikrama-west',
      name: 'Parikrama Walk, west',
      short: 'Parikrama',
      shape: sector(PARIKRAMA.r0, PARIKRAMA.r1, PARIKRAMA.fromDeg, PARIKRAMA.split),
      anchor: polar(serpentineR(-98), -98),
      spawn: spawnAt(serpentineR(-128), -128, 'ccw'),
      height: SERPENTINE.wallH,
      outdoor: true,
    },
    satelliteZone('atlas', 'Clay Atlas', 'Atlas'),
    satelliteZone('theatre', 'Agni Theatre', 'Theatre', THEATRE.axisDeg + 2),
    satelliteZone('library', 'Kothi — the Red Room', 'Red Room'),
    satelliteZone('shop', 'The Haat', 'Haat'),
    {
      id: 'parikrama-east',
      name: 'Parikrama Walk, east',
      short: 'Parikrama',
      shape: sector(PARIKRAMA.r0, PARIKRAMA.r1, PARIKRAMA.split, PARIKRAMA.toDeg),
      anchor: polar(serpentineR(-12), -12),
      spawn: spawnAt(serpentineR(-52), -52, 'ccw'),
      height: SERPENTINE.wallH,
      outdoor: true,
    },
    {
      id: 'sky-rim',
      name: 'Sky Rim',
      short: 'Roof',
      shape: sector(0, SKY_RIM_R, 0, 360),
      anchor: [0, 0],
      // reached by the perch only; "go to" is never offered for it
      spawn: { x: 0, z: SKY_RIM_R, yawDeg: 0 },
      height: 0,
      outdoor: true,
      level: 2,
    },
    {
      id: 'duplex',
      name: 'The Balcony',
      short: 'Balcony',
      shape: sector(MUSEUM.balcony.r0, MUSEUM.balcony.r1, MUSEUM.balcony.fromDeg, MUSEUM.balcony.toDeg),
      anchor: polar((MUSEUM.balcony.r0 + MUSEUM.balcony.r1) / 2, -45),
      spawn: { ...spawnAt((MUSEUM.balcony.r0 + MUSEUM.balcony.r1) / 2, -45, 'in') },
      height: H - MUSEUM.pavilion.mezzanineBand,
      level: 2,
    },
    {
      id: 'sphere-well',
      name: 'The Sphere Well',
      short: 'Sphere Well',
      shape: sector(0, SW.roomR, 0, 360, SW.cx, SW.cz),
      anchor: [SW.cx, SW.cz],
      spawn: { x: SW.cx, z: SW.cz + SW.rimR + 0.6, yawDeg: 0 },
      height: -SW.terraceTopY,
      level: 2,
    },
  ] satisfies Omit<Zone, 'rect'>[]
).map((z) => ({ ...z, rect: shapeBox(z.shape) }))

/** A crescent room of the north wing: its sector inside the walls, the anchor mid-room (on `anchorDeg`, default the door), the spawn inside the door facing in. */
function satelliteZone(id: SatelliteId, name: string, short: string, anchorDeg?: number): Omit<Zone, 'rect'> & { shape: ZoneShape } {
  const s = satellite(id)
  return {
    id,
    name,
    short,
    // from the walk's edge (the doorway belongs to the room) to the outer wall's face
    shape: sector(PARIKRAMA.r1, SAT_WALL.outerFace, s.fromDeg, s.toDeg),
    anchor: polar(SAT_MID, anchorDeg ?? s.doorDeg),
    spawn: spawnAt(SAT_SPAWN, s.doorDeg, 'out'),
    height: s.height,
  }
}

/** First-match order for zoneAt (the shapes are disjoint; shared edges resolve in this order). Roof zones are never matched. */
const MATCH_ORDER: ZoneId[] = ['annex', 'inner', 'entry-e', 'hallway-d', 'ring-a', 'ring-b', 'ring-c', 'atlas', 'theatre', 'library', 'shop', 'parikrama-west', 'parikrama-east', 'entrance-court']
const MATCH = MATCH_ORDER.map((id) => ZONES.find((z) => z.id === id)!)

function inZone(zn: Zone, x: number, z: number) {
  const r = zn.rect
  if (x < r.minX || x > r.maxX || z < r.minZ || z > r.maxZ) return false
  return zn.shape ? shapeContains(zn.shape, x, z) : true
}

export function zoneAt(x: number, z: number): Zone | undefined {
  return MATCH.find((zn) => inZone(zn, x, z))
}

/** Distance from (x, z) to a zone's footprint (0 inside). */
export function zoneDistance(zn: Zone, x: number, z: number) {
  if (zn.shape) return shapeDistance(zn.shape, x, z)
  const r = zn.rect
  return Math.hypot(Math.max(r.minX - x, 0, x - r.maxX), Math.max(r.minZ - z, 0, z - r.maxZ))
}

/**
 * Visibility graph for render culling: which zones can be SEEN from each zone. The pavilion is
 * one open ring with low and free-standing walls, so the lists are generous. Always includes
 * the zone itself.
 */
export const ZONE_VISIBILITY: Record<ZoneId, ZoneId[]> = {
  'entrance-court': ['entrance-court', 'annex', 'parikrama-west', 'parikrama-east', 'sphere-well'],
  // the dome's upper part shows over F through the arches
  annex: ['annex', 'entrance-court', 'entry-e', 'inner', 'hallway-d', 'ring-a', 'ring-c'],
  'entry-e': ['entry-e', 'annex', 'inner', 'ring-a', 'ring-b', 'ring-c', 'hallway-d', 'entrance-court', 'parikrama-east', 'duplex'],
  // one rotunda: the galleries, the court and the corridor see each other, and the balcony over them
  'ring-a': ['ring-a', 'ring-b', 'ring-c', 'inner', 'entry-e', 'annex', 'duplex'],
  'ring-b': ['ring-b', 'ring-a', 'ring-c', 'inner', 'entry-e', 'hallway-d', 'duplex'],
  'ring-c': ['ring-c', 'ring-b', 'ring-a', 'inner', 'hallway-d', 'entry-e', 'duplex'],
  'hallway-d': ['hallway-d', 'ring-c', 'entry-e', 'annex', 'inner', 'parikrama-west', 'sphere-well', 'duplex'],
  inner: ['inner', 'ring-a', 'ring-b', 'ring-c', 'entry-e', 'hallway-d', 'duplex'],
  'parikrama-west': ['parikrama-west', 'parikrama-east', 'atlas', 'theatre', 'hallway-d', 'entrance-court'],
  'parikrama-east': ['parikrama-east', 'parikrama-west', 'theatre', 'library', 'shop', 'entry-e', 'entrance-court'],
  atlas: ['atlas', 'parikrama-west'],
  theatre: ['theatre', 'parikrama-east', 'parikrama-west'],
  library: ['library', 'parikrama-east'],
  shop: ['shop', 'parikrama-east'],
  'sky-rim': ['sky-rim', 'inner', 'ring-a', 'ring-b', 'ring-c', 'entry-e', 'hallway-d', 'annex', 'duplex', 'entrance-court', 'parikrama-west', 'parikrama-east', 'sphere-well'],
  duplex: ['duplex', 'inner', 'ring-a', 'ring-b', 'ring-c', 'entry-e', 'hallway-d', 'annex'],
  'sphere-well': ['sphere-well', 'entrance-court'],
}

// Built after the zones: each surface's zone comes from zoneAt.
export const SURFACES: Record<SurfaceId, DisplaySurface> = buildSurfaces()

/* ------------------------------------------------------------------ */
/* Podiums — 12 in × 12 in, 4 ft tall, following the ring A → B → C   */
/* ------------------------------------------------------------------ */

export interface PodiumSlot {
  /** 'pod-a-1' … in walking order. */
  id: string
  x: number
  z: number
  /** Rotation about y: the podium's front (+z local) faces the oculus court. */
  rotationY: number
  zone: ZoneId
  /** Plan angle of the slot (deg). */
  angleDeg: number
}

/** Podium dimensions (top surface at `height`). */
export const PODIUM = { size: MUSEUM.podium.size, height: MUSEUM.podium.height }

export const PODIUM_SLOTS: PodiumSlot[] = (['a', 'b', 'c'] as const).flatMap((k) =>
  MUSEUM.podium.anglesDeg[k].map((aDeg, i) => {
    const [x, z] = polar(MUSEUM.podium.ringR, aDeg)
    // front faces the centre: local +z → −radial
    const rotationY = Math.atan2(-Math.cos(aDeg * DEG), -Math.sin(aDeg * DEG))
    return { id: `pod-${k}-${i + 1}`, x, z, rotationY, zone: `ring-${k}` as ZoneId, angleDeg: aDeg }
  }),
)

/* ------------------------------------------------------------------ */
/* Furniture & anchors                                                 */
/* ------------------------------------------------------------------ */

export interface BenchPlacement {
  id: string
  x: number
  z: number
  /** Long axis: 'z' or 'x'. */
  along: 'x' | 'z'
}

export const BENCH_SIZE = { length: 1.8, depth: 0.42, height: 0.44 }

/** One low bench in the oculus court, between F and the curb, facing the pool. */
export const BENCHES: BenchPlacement[] = [{ id: 'bench-oculus', x: 0, z: (OC.rings[0] + FW.r - FW.thickness / 2) / 2, along: 'x' }]

/** Centre of the oculus court (the plinth under the open skylight). */
export const COURT_CENTER = { x: 0, z: 0 }
export const OCULUS_CENTER = COURT_CENTER

