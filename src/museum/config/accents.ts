/**
 * ACCENT FIELD — the tight spots that make "dark grounds, bright objects" (GRAND §6.2 #3, #4).
 *
 * Pure data, derived from the plan constants and the object lists, never hand-typed: every
 * podium, the B niches, the F niche, the lotus, the Earth Room table, the Red Room plinth, the
 * Wine Hall plinth wall, the Sphere Well's sphere and every staged piece (a placed scene object
 * of an exhibit kind). Each accent is an analytic cone (lighting/atmosphere/inject.ts
 * `uAccent*`): no shadow, no extra light, evaluated in every lit material. The field picks the
 * accents nearest the visitor in the rooms they can see (lighting/atmosphere/AccentField.tsx),
 * up to the tier's cap; the SpotPool keeps the real, shadowed lights for the closest few.
 *
 * Every accent has a visible fixture (lighting/Fixtures.tsx): a brass wall sconce (the p02
 * podium photo), a track head on the balcony soffit or a ceiling, a picture light over a niche,
 * or none where the source is concealed (the springing ledge's long throws, the light-well).
 */
import { PODIUM, PODIUM_SLOTS, SURFACES, surfacePoint, type SurfaceId, type ZoneId } from './layout'
import { DEG, KEY, MUSEUM, polar, type Vec3 } from './museum'
import { SCONCE } from './lighting'
import { RED_ROOM, SATELLITES, SPHERE_WELL } from './satellites'
import { SCENE_OBJECTS, type SceneObjectConfig } from './objects'
import type { QualityTier } from './quality'

export type FixtureKind = 'sconce' | 'track' | 'picture' | 'spike' | 'concealed'

export interface Accent {
  id: string
  zone: ZoneId
  /** Where the light comes from, and the point it is aimed at. */
  pos: Vec3
  target: Vec3
  /** Outer half-angle of the beam (deg, 12–24 by the brief; concealed long throws may be tighter). */
  beamDeg: number
  colorK: number
  /** Illuminance (lux-like scene units) at 1 m on the beam axis; the field falls off as 1/d². */
  intensity: number
  /** How visible the piece is in the room (larger = kept first when the cap bites). */
  weight: number
  fixture: FixtureKind
  /** Wall normal of a sconce or picture light (plan), so its plate sits on the wall. */
  wallNormal?: [number, number]
  /** Height of the soffit or ceiling a track head's stem rises to (default: a short stem). */
  stemTo?: number
  /**
   * The piece's foot: below it the cone stops, as the piece and its podium would shade it (the
   * field has no shadows). Omitted = the beam reaches the floor (a pool round a floor piece).
   */
  cutY?: number
}

/** AccentField cones per tier (GRAND §10). */
export const ACCENT_CAPS: Record<QualityTier, number> = { low: 8, medium: 12, high: 16, ultra: 24 }
export const ACCENT_MAX = 24

/** Beam limits of the brief (deg). */
export const BEAM_MIN = 12
export const BEAM_MAX = 24

const clampBeam = (deg: number) => Math.min(BEAM_MAX, Math.max(BEAM_MIN, deg))
const len = (v: Vec3) => Math.hypot(v[0], v[1], v[2])
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]

/** Gallery colour temperatures (§6.2): warm A, neutral B, cool C. */
const GALLERY_K: Record<string, number> = { 'ring-a': 3000, 'ring-b': 4000, 'ring-c': 4300 }

/** The workshop scene in the theatre's lobby (the Kumartuli image, the Majuli masks): one cool key, as a studio's north light. */
const COOL_KEY = new Set<string>(['kumartuli-figure', 'majuli-mask'])

/** C shows black burnished ware: twice the light on a piece, so its sheen reads against the charcoal. */
const DARK_WARE_GAIN: Record<string, number> = { 'ring-c': 3 }
const wareGain = (zone: string) => DARK_WARE_GAIN[zone] ?? 1

export { SCONCE }

function podiumAccents(): Accent[] {
  return PODIUM_SLOTS.map((p) => {
    const [x, z] = polar(KEY.ringR - SCONCE.setOff, p.angleDeg)
    const pos: Vec3 = [x, SCONCE.y, z]
    const target: Vec3 = [p.x, PODIUM.height + 0.22, p.z]
    const d = len(sub(target, pos))
    return {
      id: `podium-${p.id}`,
      zone: p.zone,
      pos,
      target,
      // a tight 15° sconce beam on the piece (p02): the podium top is a bright island on the dark wall
      beamDeg: 15,
      colorK: GALLERY_K[p.zone] ?? 3000,
      intensity: 34 * Math.max(1, (d / 1.6) ** 2) * wareGain(p.zone),
      cutY: PODIUM.height - 0.02,
      weight: 4,
      fixture: 'sconce',
      wallNormal: [-Math.cos(p.angleDeg * DEG), -Math.sin(p.angleDeg * DEG)],
    }
  })
}

/** Gallery B's five carved niches stand between its six podiums (§2.5, p08r). */
export function bNicheAngles(): number[] {
  const b = MUSEUM.podium.anglesDeg.b
  return b.slice(1).map((a, i) => (a + b[i]) / 2)
}

/** The carved niches of B: 1.1 w × 2.6 h, sill 0.9 (§2.5). */
export const B_NICHE = { width: 1.1, height: 2.6, sill: 0.9, depth: 0.35 }

/** Raking picture lights from the balcony soffit's edge onto the niche plaques. */
function nicheAccents(): Accent[] {
  const bal = MUSEUM.balcony
  const soffit = MUSEUM.pavilion.mezzanineBand - bal.slab - 0.12
  return bNicheAngles().map((a, i) => {
    const [x, z] = polar(bal.r0 + 0.3, a + 1.2)
    const [tx, tz] = polar(KEY.ringR - 0.12, a)
    return {
      id: `b-niche-${i + 1}`,
      zone: 'ring-b' as ZoneId,
      pos: [x, soffit, z] as Vec3,
      target: [tx, B_NICHE.sill + B_NICHE.height * 0.45, tz] as Vec3,
      beamDeg: 15,
      colorK: 4000,
      intensity: 26,
      weight: 2.5,
      cutY: B_NICHE.sill - 0.02,
      fixture: 'picture' as FixtureKind,
      stemTo: soffit + 0.12,
    }
  })
}

/** The F court niche (p07l "lit niche with a figure") and the lotus floating on the pool. */
function courtAccents(): Accent[] {
  const F = MUSEUM.innerMainWall
  const face = F.r - F.thickness / 2
  const [nx, nz] = polar(face - 0.15, 90)
  const [sx, sz] = polar(face - 3.4, 90)
  const dome = MUSEUM.dome
  const lotusY = MUSEUM.oculus.poolLevel + 0.4
  return [
    {
      id: 'f-niche',
      zone: 'inner',
      pos: [sx, F.height - 0.6, sz],
      target: [nx, 1.4 + 0.45, nz],
      beamDeg: 14,
      colorK: 3500,
      intensity: 70,
      weight: 6,
      fixture: 'concealed',
    },
    {
      // from the light-well's lip: a long, tight throw onto the lotus (the night's pool of light)
      id: 'lotus',
      zone: 'inner',
      pos: [0, dome.terraces[2].y - 0.4, -(MUSEUM.oculus.r - 0.6)],
      target: [0, lotusY, 0],
      beamDeg: 12,
      colorK: 4200,
      intensity: 900,
      weight: 8,
      fixture: 'concealed',
    },
  ]
}

/** The round table under the Earth Room's skylight: a sky beam by day, a lamp in the light shaft at night. */
function earthRoomAccents(): Accent[] {
  const z = KEY.annexSkylightZ
  return [
    {
      id: 'earth-table',
      zone: 'annex',
      pos: [0, MUSEUM.pavilion.ceilingHeight + 0.2, z],
      target: [0, 0.9, z],
      beamDeg: 13,
      colorK: 3200,
      intensity: 260,
      weight: 5,
      fixture: 'concealed',
    },
  ]
}

/**
 * The Red Room's shelves (p09r at every hour): five broad warm washes from a ring of concealed
 * downlights round the oculus, each aimed at the middle of a run of shelving, so the pieces on
 * all six tiers read by night as well as by day (the strips under the boards are the glow; these
 * are the light).
 */
function redRoomShelfAccents(): Accent[] {
  const door = Math.atan2(-RED_ROOM.cz, -RED_ROOM.cx) / DEG
  const y = RED_ROOM.height - 0.35
  return [55, 115, 180, 245, 305].map((off, i) => {
    const b = door + off
    const [px, pz] = polar(RED_ROOM.oculusR + 0.45, b, RED_ROOM.cx, RED_ROOM.cz)
    const [tx, tz] = polar(RED_ROOM.r - 0.3, b, RED_ROOM.cx, RED_ROOM.cz)
    const pos: Vec3 = [px, y, pz]
    const target: Vec3 = [tx, 1.45, tz]
    const d = len(sub(target, pos))
    return { id: `red-room-shelves-${i + 1}`, zone: 'library' as ZoneId, pos, target, beamDeg: 19, colorK: 2900, intensity: 3.6 * d * d, weight: 5, fixture: 'concealed' as FixtureKind }
  })
}

/** The Red Room's central plinth under its oculus (p09r), and the hanging sphere of the well (p07r). */
function northAccents(): Accent[] {
  return [
    {
      // the hero coil pot's key: a tight, strong beam from the oculus's rim
      id: 'red-room-plinth',
      zone: 'library',
      pos: [RED_ROOM.cx, RED_ROOM.height - 0.3, RED_ROOM.cz],
      target: [RED_ROOM.cx, 1.25, RED_ROOM.cz],
      beamDeg: 14,
      colorK: 3000,
      intensity: 950,
      weight: 9,
      fixture: 'concealed',
    },
    ...redRoomShelfAccents(),
    {
      id: 'well-sphere',
      zone: 'sphere-well',
      pos: [SPHERE_WELL.cx + 1.2, -0.2, SPHERE_WELL.cz],
      target: [SPHERE_WELL.cx, SPHERE_WELL.sphereY, SPHERE_WELL.cz],
      beamDeg: 18,
      colorK: 2700,
      intensity: 40,
      weight: 4,
      fixture: 'concealed',
    },
  ]
}

/** The Wine Hall's heads sit on the ambulatory's slab rail, ~28° off vertical in front of each bay (p08l). */
const WINE_TRACK_Y = MUSEUM.pavilion.ceilingHeight - 0.3
const WINE_OUT = (WINE_TRACK_Y - 1.25) * Math.tan(28 * DEG)

/** The Wine Hall's plinth wall (d-hallway-1 … 6, p08l): one track head per bay, from the ambulatory's ceiling. */
function wineHallAccents(): Accent[] {
  const ids = Object.keys(SURFACES).filter((k) => k.startsWith('d-hallway-')) as SurfaceId[]
  return ids.map((id) => {
    const s = SURFACES[id]
    const at = (s.range[0] + s.range[1]) / 2
    const p = surfacePoint(id, at, 1.25, 0.55)
    const [nx, , nz] = p.normal
    const pos: Vec3 = [p.position[0] + nx * WINE_OUT, WINE_TRACK_Y, p.position[2] + nz * WINE_OUT]
    return {
      id: `wine-${id}`,
      zone: s.zone,
      pos,
      target: p.position,
      beamDeg: 14,
      colorK: 2700,
      // ≈ 1.4 at the plinths, whatever the throw
      intensity: 1.4 * len(sub(p.position, pos)) ** 2,
      weight: 3,
      fixture: 'track' as FixtureKind,
      stemTo: MUSEUM.pavilion.ceilingHeight,
    }
  })
}

/** Scene-object kinds that are staged pieces (their own pool of light). */
const PIECE_KINDS = new Set<string>([
  'sourced-model',
  'clay-vessel',
  'terracotta-horse',
  'votive-plaque',
  'coil-pot',
  'kumartuli-figure',
  'majuli-mask',
  'ayyanar-horse',
  'relief-register',
  'wine-plinth',
  'round-plinth',
  'round-table',
  'eroded-formation',
  // (curved shelves light themselves: their LED strips)
  'lotus',
  'clay-sphere',
  'horse-procession',
])

/** Zones lit by the sun or with their own staging (they never take object accents). */
const NO_OBJECT_ACCENTS = new Set<string>(['entrance-court', 'parikrama-west', 'parikrama-east', 'sky-rim'])

/**
 * Where a piece's light hangs, by room (every head has a ceiling, a soffit or a ledge above it):
 *   galleries  under the balcony's soffit (a piece beneath it) or under the fascia's lip (a piece
 *              in the open gallery, like The Herd), a little to the side for modelling
 *   court      the dome's springing ledge (a long, high throw: the court keeps its calm planes)
 *   rooms      the ceiling (ambulatory, Wine Hall, annex, satellites), in front of the piece
 * Returns the head's position and the height its stem rises to.
 */
function objectMount(o: SceneObjectConfig, target: Vec3, foot: number): { pos: Vec3; stemTo: number; fixture?: FixtureKind } {
  const [x, , z] = o.position
  const r = Math.hypot(x, z)
  const aDeg = Math.atan2(z, x) / DEG
  const bal = MUSEUM.balcony
  const soffit = MUSEUM.pavilion.mezzanineBand - bal.slab
  if (o.zone === 'ring-a' || o.zone === 'ring-b' || o.zone === 'ring-c' || o.zone === 'duplex') {
    if (r > bal.r0 - 0.2) {
      const [px, pz] = polar(Math.max(bal.r0 + 0.2, r - 1.4), aDeg + 3)
      return { pos: [px, soffit - 0.12, pz], stemTo: soffit }
    }
    const [px, pz] = polar(bal.r0 - 0.1, aDeg + 6)
    return { pos: [px, bal.fascia.y0 - 0.1, pz], stemTo: bal.fascia.y0 }
  }
  if (o.zone === 'inner') {
    const [px, pz] = polar(KEY.ringR - 0.35, aDeg + 4)
    return { pos: [px, MUSEUM.dome.springY - 0.25, pz], stemTo: MUSEUM.dome.springY }
  }
  // high on the ceiling, ~28° off vertical in front of the piece: long, tight museum throws
  const ceil = zoneCeiling(o.zone)
  const rot = ((o.rotationDeg ?? 0) * Math.PI) / 180
  const y = ceil - 0.3
  const out = Math.min(4.5, Math.max(1.0, (y - target[1]) * Math.tan(28 * DEG) + foot * 0.3))
  return { pos: [x + Math.sin(rot) * out, y, z + Math.cos(rot) * out], stemTo: ceil }
}

/** A spot over a placed piece: sized to its footprint, from the room's ceiling or ledge. */
export function objectAccent(o: SceneObjectConfig): Accent | null {
  if (!PIECE_KINDS.has(o.kind) || NO_OBJECT_ACCENTS.has(o.zone)) return null
  // the court's lotus and the Red Room plinth have their own accents above
  if (o.kind === 'lotus' || (o.kind === 'round-plinth' && o.zone === 'library')) return null
  // the Red Room's curved shelves light their own tiers (LED strips): a cone from its ceiling would
  // only paint the red wall above them
  if (Math.hypot(o.position[0] - RED_ROOM.cx, o.position[2] - RED_ROOM.cz) < RED_ROOM.r) return null
  const h = Math.max(0.2, Number(o.height ?? o.props?.height ?? 0.8) || 0.8)
  const foot = o.footprint ? Math.max(o.footprint[0], o.footprint[1]) : Math.max(0.4, h * 0.6)
  const [x, y0, z] = o.position
  const target: Vec3 = [x, y0 + h * 0.6, z]
  const { pos, stemTo, fixture } = objectMount(o, target, foot)
  // pieces above their room's fixtures (the upper register over the balcony) are uplit by its cove
  if (pos[1] < target[1] + 0.6) return null
  const d = len(sub(target, pos))
  const beam = clampBeam((Math.atan((Math.max(foot, h) * 0.55 + 0.15) / d) / DEG) * 1.15)
  const big = h > 2.5 || foot > 2.5
  return {
    id: `obj-${o.id}`,
    zone: o.zone,
    pos,
    target,
    beamDeg: beam,
    colorK: COOL_KEY.has(o.kind) ? 4500 : GALLERY_K[o.zone] ?? (o.zone === 'hallway-d' || o.zone === 'sphere-well' ? 2700 : o.zone === 'annex' ? 3300 : 3000),
    // ≈ 3 at a piece (4.5 at a big one) whatever the throw: a clear pool over the dark ground
    intensity: (big ? 4.5 : 3) * d * d * wareGain(o.zone),
    weight: Math.min(6, 1 + h + foot * 0.5),
    fixture: fixture ?? 'track',
    stemTo,
    // a piece on a plinth or a shelf: its support catches only the top of the beam
    cutY: y0 > 0.3 ? y0 - 0.25 : undefined,
  }
}

/** Ceiling height a fixture may hang from in a zone. */
function zoneCeiling(zone: string): number {
  switch (zone) {
    case 'ring-a':
    case 'ring-b':
    case 'ring-c':
    case 'duplex':
      return MUSEUM.pavilion.mezzanineBand - MUSEUM.balcony.slab
    case 'inner':
      return MUSEUM.dome.springY
    case 'hallway-d':
    case 'entry-e':
    case 'annex':
      return MUSEUM.pavilion.ceilingHeight
    case 'sphere-well':
      return SPHERE_WELL.terraceTopY
    case 'library':
      return SAT_HEIGHT.library ?? 6
    default:
      return SAT_HEIGHT[zone] ?? 6
  }
}

const SAT_HEIGHT: Record<string, number> = Object.fromEntries(SATELLITES.map((s) => [s.id, s.height]))

/** Round stages whose pieces share one beam. */
const STAGE_KINDS = new Set<string>(['round-plinth', 'round-table'])

/** A round stage's top radius (props.r, else half its footprint). */
function stageRadius(o: SceneObjectConfig): number {
  const r = Number(o.props?.r)
  if (Number.isFinite(r) && r > 0) return r
  return o.footprint ? Math.max(o.footprint[0], o.footprint[1]) / 2 : 0.5
}

/** Every accent of the plan and the staged pieces, in a stable order. */
export function buildAccents(objects: readonly SceneObjectConfig[] = SCENE_OBJECTS): Accent[] {
  // a piece on a podium has the podium's sconce already
  const onPodium = (a: Accent) => PODIUM_SLOTS.some((p) => Math.hypot(p.x - a.target[0], p.z - a.target[2]) < PODIUM.size)
  // a round plinth or table holding pieces (the black ware island, the Earth Room table) is one
  // composition under one beam: its pieces share it, and the beam opens to cover the top
  const stages = objects.filter((o) => STAGE_KINDS.has(o.kind)).map((o) => ({ o, r: stageRadius(o) }))
  const stageOf = (o: SceneObjectConfig) =>
    STAGE_KINDS.has(o.kind) ? undefined : stages.find((s) => s.o.zone === o.zone && o.position[1] > 0.1 && Math.hypot(o.position[0] - s.o.position[0], o.position[2] - s.o.position[2]) < s.r + 0.1)
  const held = new Map<string, number>()
  const pieces = objects.filter((o) => {
    const s = stageOf(o)
    if (s) held.set(s.o.id, (held.get(s.o.id) ?? 0) + 1)
    return !s
  })
  const fromObjects = pieces
    .map((o) => {
      const a = objectAccent(o)
      const n = held.get(o.id)
      if (!a || !n) return a
      const r = stageRadius(o)
      const d = len(sub(a.target, a.pos))
      // the beam stops at the stage's top: the pieces glow on it, no warm ring spills on the floor
      const top = o.position[1] + Number(o.height ?? 0)
      return {
        ...a,
        beamDeg: clampBeam((Math.atan((r + 0.1) / d) / DEG) * 1.05),
        intensity: a.intensity * 3,
        weight: Math.min(8, a.weight + n * 0.5),
        cutY: top > 0.05 ? top - 0.03 : a.cutY,
      }
    })
    .filter((a): a is Accent => !!a && !onPodium(a))
  const plan = [...podiumAccents(), ...nicheAccents(), ...courtAccents(), ...earthRoomAccents(), ...northAccents(), ...wineHallAccents(), ...lippanRake(), ...herdKey(objects)]
  // a piece the plan already lights (the Earth Room table under its skylight) is not lit twice
  const planLit = (a: Accent) => plan.some((p) => Math.hypot(p.target[0] - a.target[0], p.target[2] - a.target[2]) < 0.6)
  return [...plan, ...clusterAccents(fromObjects.filter((a) => !planLit(a)))]
}

/**
 * The lippan corridor's raking light (F's outer face): four warm beams from high on H's side,
 * each thrown along the wall at a glancing angle, so the coils model in relief and the mirrors in
 * the knots flash one after another as the visitor walks.
 */
function lippanRake(): Accent[] {
  const F = MUSEUM.innerMainWall
  const face = F.r + F.thickness / 2
  const H = MUSEUM.descriptionWall
  const src = H.r - H.thickness / 2 - 0.4
  const span = F.toDeg - F.fromDeg
  return [0.18, 0.4, 0.6, 0.82].map((f, i) => {
    const a = F.fromDeg + span * f
    const [px, pz] = polar(src, a + (i % 2 ? -11 : 11))
    const [tx, tz] = polar(face + 0.05, a)
    const pos: Vec3 = [px, 4.2, pz]
    const target: Vec3 = [tx, 1.5, tz]
    const d = len(sub(target, pos))
    return { id: `lippan-rake-${i + 1}`, zone: 'entry-e' as ZoneId, pos, target, beamDeg: 22, colorK: 3200, intensity: 4 * d * d, weight: 4, fixture: 'concealed' as FixtureKind }
  })
}

/**
 * The Herd's raking key: one warm beam from the side, under the balcony's edge, that skims the
 * nine horses along their flanks, so the burnished slip models (highlights down the necks, the
 * far side falling to dark) instead of reading flat under a top light.
 */
function herdKey(objects: readonly SceneObjectConfig[]): Accent[] {
  const herd = objects.filter((o) => o.id.startsWith('craft-bankura-herd-'))
  if (!herd.length) return []
  const cx = herd.reduce((s, o) => s + o.position[0], 0) / herd.length
  const cz = herd.reduce((s, o) => s + o.position[2], 0) / herd.length
  const a = Math.atan2(cz, cx) / DEG
  const bal = MUSEUM.balcony
  const soffit = MUSEUM.pavilion.mezzanineBand - bal.slab - 0.12
  // from the side the visitor arrives on (the east arch), just inside the balcony's edge
  const [x, z] = polar(bal.r0 + 0.25, a + 12)
  const target: Vec3 = [cx, 0.85, cz]
  const pos: Vec3 = [x, soffit, z]
  const d = len(sub(target, pos))
  return [{ id: 'herd-key', zone: 'ring-a', pos, target, beamDeg: 22, colorK: 2900, intensity: 5.5 * d * d, weight: 9, fixture: 'track', stemTo: soffit + 0.12 }]
}

/** Pieces closer than this (plan, m) may share one beam. */
const CLUSTER_R = 1.6

/**
 * A group of pieces (the Herd on its stepped plinth, a shelf bay of pots) is one composition:
 * neighbours in a room share the beam of the most visible of them, aimed at the group's middle
 * and opened to cover it (never past the brief's 24°), at the same light on the pieces. The field
 * then spends its cones on more of the room instead of nine on one island.
 */
export function clusterAccents(list: readonly Accent[]): Accent[] {
  const groups: { lead: Accent; members: Accent[] }[] = []
  for (const a of [...list].sort((x, y) => y.weight - x.weight || x.id.localeCompare(y.id))) {
    const g = groups.find(
      (g) =>
        g.lead.zone === a.zone &&
        g.lead.fixture === a.fixture &&
        Math.hypot(g.lead.target[0] - a.target[0], g.lead.target[2] - a.target[2]) < CLUSTER_R &&
        Math.abs(g.lead.target[1] - a.target[1]) < 1 &&
        merged([...g.members, a], g.lead) !== null,
    )
    if (g) g.members.push(a)
    else groups.push({ lead: a, members: [a] })
  }
  return groups.map((g) => (g.members.length === 1 ? g.lead : merged(g.members, g.lead)!)).sort((x, y) => x.id.localeCompare(y.id))
}

/** One beam from `lead`'s fixture over all `members`, or null when it would need more than 24°. */
function merged(members: readonly Accent[], lead: Accent): Accent | null {
  if (members.length === 1) return lead
  const w = members.reduce((s, m) => s + m.weight, 0)
  const target: Vec3 = [0, 1, 2].map((k) => members.reduce((s, m) => s + m.target[k] * m.weight, 0) / w) as Vec3
  const d = len(sub(target, lead.pos))
  const spread = Math.max(...members.map((m) => Math.hypot(m.target[0] - target[0], m.target[1] - target[1], m.target[2] - target[2])))
  const need = (Math.atan((spread + 0.45) / d) / DEG) * 1.1
  if (need > BEAM_MAX) return null
  const dLead = len(sub(lead.target, lead.pos))
  const cuts = members.map((m) => m.cutY)
  return {
    ...lead,
    target,
    beamDeg: clampBeam(need),
    intensity: lead.intensity * (d / dLead) ** 2,
    weight: Math.min(8, w),
    cutY: cuts.every((c) => c !== undefined) ? Math.min(...(cuts as number[])) : undefined,
  }
}

export const ACCENTS: readonly Accent[] = buildAccents()
