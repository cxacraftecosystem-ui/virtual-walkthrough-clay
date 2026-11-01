/**
 * Where the ring wall is carved (GRAND §2.5), shared by the wall that cuts it (Wall.tsx) and the
 * owners that fill it: the upper register's lit niches and relief panels over A/B/C (the duplex),
 * Gallery B's five carved niches (config/accents.ts places their raking lights), F's piers and
 * its lit court niche, and H's title panel.
 *
 * Angles are plan degrees (a = atan2(z, x)); the ring's span runs 224° → 395° (D notch → NE notch).
 */
import { DEG, KEY, MUSEUM } from '../config/museum'

const UR = MUSEUM.upperRegister
const BAL = MUSEUM.balcony

/** The upper register's niche: sill and head heights (centred in the register), width, depth. */
export const REGISTER_NICHE = {
  width: UR.niche.width,
  depth: UR.niche.depth,
  y0: (UR.y0 + UR.y1) / 2 - UR.niche.height / 2,
  y1: (UR.y0 + UR.y1) / 2 + UR.niche.height / 2,
} as const

export interface RegisterSlot {
  kind: 'niche' | 'panel'
  /** 0-based within its kind, in walking order (A → C, decreasing angle). */
  index: number
  /** Plan angle of the slot's centre (deg, in the ring's 224 … 395 span). */
  aDeg: number
  /** Slot width on the wall (m): the niche's opening, or the room a relief panel may take. */
  width: number
}

/**
 * The register's rhythm: the balcony's span divided into 2 × niches equal bays, niches and relief
 * panels alternating, a niche first at each end. Walking order: from A's end (395°) towards C.
 */
export function upperRegisterSlots(): RegisterSlot[] {
  const n = UR.niches
  const bay = (BAL.toDeg - BAL.fromDeg) / (2 * n)
  const bayM = bay * DEG * KEY.ringR
  const out: RegisterSlot[] = []
  for (let i = 0; i < 2 * n; i++) {
    const aDeg = BAL.toDeg - bay * (i + 0.5)
    const niche = i % 2 === 0
    out.push({ kind: niche ? 'niche' : 'panel', index: Math.floor(i / 2), aDeg, width: niche ? REGISTER_NICHE.width : bayM * 0.92 })
  }
  return out
}

/** Gallery B's carved niches (p08r, GRAND §2.5): 1.1 w × 2.6 h × 0.35 deep, sill 0.9. */
export const B_NICHE_SIZE = { width: 1.1, height: 2.6, sill: 0.9, depth: 0.35 } as const

/** Gallery B's five niches, each halfway between two of its six podiums (the same rule as config/accents.ts). */
export function bNiches(): { aDeg: number; width: number; y0: number; y1: number; depth: number }[] {
  const b = MUSEUM.podium.anglesDeg.b
  const N = B_NICHE_SIZE
  return b.slice(1).map((a, i) => ({ aDeg: (a + b[i]) / 2 + 360, width: N.width, y0: N.sill, y1: N.sill + N.height, depth: N.depth }))
}

/** The galleries' spans on the ring's interior face (deg, in the 224 … 395 domain): C, B, A. */
export const GALLERY_SPANS = {
  c: [MUSEUM.drum.dNotchDeg, MUSEUM.fins.atDeg[1] + 360] as const,
  b: [MUSEUM.fins.atDeg[1] + 360, MUSEUM.fins.atDeg[0] + 360] as const,
  a: [MUSEUM.fins.atDeg[0] + 360, MUSEUM.drum.neNotchDeg + 360] as const,
}

/* ------------------------------------------------------------------ */
/* F — the inner main wall's court face (p07l)                         */
/* ------------------------------------------------------------------ */

const F = MUSEUM.innerMainWall

/** F's rounded head: the radius of the half-round on top of the wall. */
export const F_HEAD = F.thickness / 2

/** F's piers: offsets (deg) either side of the centre niche, width, how far they stand proud. */
export const F_PIERS = { offsetsDeg: [11, 33, 46, 57] as const, width: 0.9, proud: 0.6, height: F.height - 0.1 } as const

/** F's centre niche: a surround as proud as the piers, the opening 2.2 × 4.2 from the floor. */
export const F_NICHE = { aDeg: (F.fromDeg + F.toDeg) / 2, width: F.niche.width, height: F.niche.height, depth: F.niche.depth, frame: 0.45 } as const

/** Every pier's plan angle (deg). */
export function fPierAngles(): number[] {
  return F_PIERS.offsetsDeg.flatMap((o) => [F_NICHE.aDeg - o, F_NICHE.aDeg + o]).sort((a, b) => a - b)
}

/* ------------------------------------------------------------------ */
/* H — the description wall's title panel                              */
/* ------------------------------------------------------------------ */

/** The recessed raw-clay panel on H's outer face that carries the carved title (P5). */
export const H_PANEL = { aDeg: 90, width: 6.0, y0: 1.1, y1: 5.1, recess: 0.08 } as const
