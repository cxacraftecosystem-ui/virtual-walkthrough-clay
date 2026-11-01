/**
 * MUSEUM CONSTANTS — single source of truth for the clay pavilion's architecture & experience.
 *
 * Units: 1 Three.js unit = 1 metre.
 * Reference: "Clay exhibition layout" (sectional plan, top 3D view, elevation, front entrance
 * spawn point). The plan labels: "Dia 70 ft (approx)", "G: ENTRANCE (15 ft)", "HEIGHT: 20 FT,
 * DUPLEX", podiums "12in × 12in at 4 ft height".
 *
 * World axes (the app convention, kept from the hand block museum)
 *   +x = east,  -x = west,  +y = up
 *   +z = south (entrance side), -z = north
 *   The drawing's annex G points east; it is turned a quarter so the entrance faces +z and the
 *   visitor walks in facing −z (north). Drawing north → +x, drawing west → −z.
 *
 * Plan angles: a = atan2(z, x) measured from +x towards +z (clockwise on the minimap, which
 * draws z downwards). Arcs always run a0 → a1 with a0 < a1. `polar(r, aDeg)` gives [x, z].
 *
 *                        −z (north)
 *                    ┌───── B ─────┐
 *                  C ·   ring of    · A        A on the right as you enter, then B, then C
 *          D notch ◣    podiums      ◢ NE notch
 *        hallway D │  (  ◎ oculus  ) │ E
 *                   ╲   ⌒ F ⌒      ╱
 *                     E  ⌒ H ⌒  E
 *                         │ G │           annex G, 15 ft wide, ~30 ft long
 *                         └ ▲ ┘           door; the visitor spawns outside, facing in
 *                        +z (south)
 *
 * ASSUMPTIONS (the drawing is a concept sketch without a dimension grid; measured from it):
 *  - Scale: the two labelled sizes agree at one scale only if "Dia 70 ft" is the large drum
 *    lobe (the east half round the annex) and 15 ft is the annex's clear width. So the lobe's
 *    interior face is R = 10.67 m (70 ft Ø) and the west gallery ring (A/B/C, a smaller circle
 *    in the drawing, 0.735 × the lobe) has its interior face at 7.85 m. The ring is joined to
 *    the lobe by two radial "notch" walls: one north-east by E, one south-west at D.
 *  - Annex G: 4.57 m clear, interior end face 19.5 m from the centre (~9.1 m ≈ 30 ft beyond
 *    the lobe). The door is 2.1 m × 3.6 m (proportions of the front-entrance view).
 *  - H (gallery description wall) is the curved free-standing wall at the annex mouth, facing
 *    the entrance; E are the two entry ways round its ends; F (inner main wall) is the second,
 *    taller curved wall behind it, which withholds the view of the oculus court until the
 *    visitor turns past it. D is the hallway between the drum and a curved inner wall on the
 *    south-west side, running from the D notch back to E.
 *  - Height 20 ft (6.1 m) overall: 5.75 m clear plus a 0.35 m roof slab. "Duplex" is read as
 *    double height with the band at 10 ft (3.05 m) seen in the elevation; there is no floor up
 *    there.
 *  - Oculus: 2.6 m radius opening in the roof over concentric plinth rings (3.15 / 2.6 / 2.05 /
 *    1.8 m in the drawing). The outermost ring is a low curb visitors walk round.
 *  - Podiums: 11 drawn (3 in A, 5 in B, 3 in C) on a 6.9 m circle, about 12.5° apart; two short
 *    radial fins separate A|B and B|C.
 *  - Landscape plinth disc 15.1 m radius (the outer circle of the drawing); the forecourt in
 *    front of the door extends beyond it.
 */

export const FT = 0.3048
export const DEG = Math.PI / 180

/** Point on a circle about the drum centre: plan angle in degrees → [x, z]. */
export function polar(r: number, aDeg: number, cx = 0, cz = 0): [number, number] {
  return [cx + r * Math.cos(aDeg * DEG), cz + r * Math.sin(aDeg * DEG)]
}

/** The gallery ring's interior face: Ø 105 ft = 1.5 × the drawing's 70 ft (GRAND §0.3). */
const RING_R = 52.5 * FT
/** The drum's wall thickness; H, D and the arches stand on the ring's centreline. */
const DRUM_T = 0.6
const RING_C = RING_R + DRUM_T / 2

export const MUSEUM = {
  pavilion: {
    /** Parapet top of the drum and annex (GRAND §0.3: 10 m; the dome rises above it). */
    height: 10.0,
    /** Clear height of the ambulatory and annex to the slab soffit; also the dome's springing. */
    ceilingHeight: 9.0,
    roofThickness: 0.6,
    /** Roof slab overhang beyond the drum and annex walls (elevation). */
    roofOverhang: 0.9,
    /** "Duplex": the balcony's walking level, exactly half the clear height (the PDF's band line). */
    mezzanineBand: 4.6,
  },

  drum: {
    /** Interior face radius of the large lobe round the annex (the ring / 0.735, the drawing's ratio). */
    r: 21.75,
    /** Interior face radius of the gallery ring (A, B, C): Ø 32.0 m = 105 ft, 1.5 × the drawing's 70 ft. */
    ringR: RING_R,
    thickness: DRUM_T,
    /** Plan angles (deg) of the two radial notch walls joining ring and lobe. */
    neNotchDeg: 35,
    dNotchDeg: 224,
  },

  /** The coffered dome over the gallery ring (GRAND §1.2): springs from the ring circle at springY. */
  dome: {
    springY: 9.0,
    rise: 12.0,
    shell: 0.7,
    coffers: { rings: 5, perRing: 28, depth: 0.28, steps: 3, stopR: 7.1 },
    ribs: 24,
    /** The stepped oculus (p07r): terraces r0 → r1 at y, outermost first. */
    terraces: [
      { r0: 7.1, r1: 6.4, y: 19.6 },
      { r0: 6.4, r1: 5.7, y: 20.0 },
      { r0: 5.7, r1: 5.0, y: 20.4 },
    ],
    /** The light-well above the open oculus (p07l's thick glowing reveal). */
    lightWell: { y0: 20.4, y1: 21.8 },
    /** Top of the collar round the oculus: the building's highest point. */
    collarTop: 22.2,
  },

  /** The three great arches in the ring circle (on the ring centreline): E east, E west, D. */
  arches: {
    eEast: { fromDeg: 35, toDeg: 52, apex: 7.0 },
    eWest: { fromDeg: 128, toDeg: 146, apex: 7.0 },
    d: { fromDeg: 204, toDeg: 224, apex: 7.0 },
  },

  annex: {
    /** Clear width between the side walls (30 ft: the drawing's 15 ft at the drum's new scale). */
    width: 30 * FT,
    /** z of the end wall's interior face (the door wall). */
    endZ: 34.5,
    thickness: 0.6,
    door: { width: 3.6, height: 6.0 },
    /** Round roof light over the Earth Room's table (centred halfway down the hall). */
    skylight: { r: 2.0 },
  },

  /** H — gallery description wall: the ring circle between the E arches, full height, title outside. */
  descriptionWall: { r: RING_C, thickness: DRUM_T, fromDeg: 52, toDeg: 128, height: 9.0 },

  /** F — inner main wall: the oxblood arc hiding the court, with piers and a lit niche on its court face. */
  innerMainWall: { r: 12.1, thickness: 0.5, fromDeg: 30, toDeg: 150, height: 7.0, piers: 8, niche: { width: 2.2, height: 4.2, depth: 0.6 } },

  /** D — the hallway's inner wall: the ring circle between the D arch and the E-west arch. */
  hallwayWall: { r: RING_C, thickness: DRUM_T, fromDeg: 146, toDeg: 204, height: 9.0 },

  /** Formation gates between the podium runs (A|B, B|C): a radial collider box that P3 fills with eroded clay. */
  fins: { r0: 13.4, r1: 15.6, thickness: 1.6, height: 6.5, atDeg: [-20, -98.5] as const },

  oculus: {
    /** Radius of the open oculus at the top of the dome ("exposed skylight and environment"). */
    r: 5.0,
    /** Concentric rings of the court, outermost first: curb, pool edge, lotus island, lotus. */
    rings: [6.4, 5.6, 1.8, 1.2] as const,
    /** The brass floor ring (p05 floor line). */
    floorRingR: 8.2,
    /** Height and thickness of the curb ring (the visitor walks round it): a low brass-edged lip, so
     *  the pool reads as a still mirror set into the floor (p07l), never a raised tub. */
    curbHeight: 0.12,
    /** The water's surface: just under the curb's brass edge. The lotus floats on it. */
    poolLevel: 0.085,
    curbThickness: 0.8,
  },

  podium: {
    /** 12 in × 12 in, 4 ft tall. */
    size: 12 * 0.0254,
    height: 4 * FT,
    /** Circle the podium centres stand on: 0.9 m in front of the ring wall (p02 photo). */
    ringR: 15.1,
    /** Plan angles (deg) per tradition zone, in walking order A → B → C (14 podiums). */
    anglesDeg: {
      a: [26, 15, 4, -9],
      b: [-30, -41, -52, -63, -74, -85],
      c: [-104, -112, -120, -128],
    },
  },

  /** The duplex balcony round A/B/C (GRAND §1.2): ridden as a perch, never walked on. */
  balcony: { r0: 14.4, r1: RING_R, slab: 0.3, fascia: { y0: 4.0, y1: 4.6 }, balustrade: 1.05, fromDeg: 224, toDeg: 395 },

  /** The upper register on the ring wall over A/B/C: lit niches alternating with relief panels. */
  upperRegister: { y0: 5.2, y1: 8.6, niches: 24, niche: { width: 0.9, height: 1.2, depth: 0.35 } },

  landscape: {
    /** Radius of the landscape plinth disc round the drum (SAT_WALL.outerOuter + 0.4). */
    r: 33.8,
  },

  forecourt: {
    /** Half width of the paved forecourt in front of the annex door. */
    halfWidth: 14,
    /** Far edge of the forecourt (z): deep enough to stand back and see the dome clear the annex. */
    endZ: 68.0,
  },

  walls: {
    exteriorThickness: 0.6,
    /** Recessed shadow gap at wall base (museum detail). */
    shadowGapHeight: 0.022,
  },

  display: {
    /** Eye-level mounting centre. */
    artworkCenterHeight: 1.6,
    /** Distance an artwork stands off its wall (hanging cleats). */
    wallStandOff: 0.004,
    /** Default horizontal gap between an artwork edge and its table. */
    tableGap: 0.45,
  },

  visitor: {
    eyeHeight: 1.62,
    collisionRadius: 0.28,
    /** Unhurried museum pace (m/s). */
    walkSpeed: 1.35,
    /** Raised for the longer walks of the grand plan. */
    briskSpeed: 2.6,
    /** Seconds-ish time constant for acceleration smoothing (higher = snappier). */
    acceleration: 7,
    /** Vertical field of view (deg). Kept moderate to avoid wide-angle distortion. */
    fov: 58,
    /** Minimum horizontal FOV on narrow (portrait) screens. */
    minHorizontalFov: 62,
    lookSensitivity: 0.0032,
    lookDamping: 14,
    pitchLimitDeg: 55,
    /**
     * FRONT ENTRANCE SPAWN POINT: on the forecourt, 29 m outside the annex door, facing in
     * (north, −z): far enough back that the dome rises clear of the annex's parapet, with the
     * drum and the annex in the same frame (p04).
     */
    start: { x: 0, z: 64.0, yawDeg: 0, pitchDeg: 10 },
  },
} as const

/**
 * Feature switches of the grand plan. `clayStudio` restores the visitors' potter's wheel and the
 * Visitors' Shelf (GRAND §0.2: the clay preview is taken down for the time being).
 */
export const GRAND_FLAGS = { clayStudio: false } as const

/* ------------------------------------------------------------------ */
/* Derived key coordinates (computed, never hand-typed elsewhere)      */
/* ------------------------------------------------------------------ */

const d = MUSEUM.drum
const an = MUSEUM.annex

export const KEY = {
  /** Lobe interior / outer face radii. */
  lobeR: d.r,
  lobeOuterR: d.r + d.thickness,
  /** Gallery ring interior / outer face radii. */
  ringR: d.ringR,
  ringOuterR: d.ringR + d.thickness,
  /** Half the annex clear width (x of the side walls' interior faces). */
  annexHalf: an.width / 2,
  /** x of the annex side walls' outer faces. */
  annexOuterHalf: an.width / 2 + an.thickness,
  /** z where the annex's interior faces meet the lobe's interior face (the mouth). */
  annexMouthZ: Math.sqrt(d.r * d.r - (an.width / 2) ** 2),
  annexEndZ: an.endZ,
  /** z of the end wall's outer face (the entrance front). */
  annexOuterZ: an.endZ + an.thickness,
  doorHalf: an.door.width / 2,
  /** Half-angle (deg) of the gap in the lobe where the annex joins it (at the wall centreline). */
  annexGapDeg: Math.asin((an.width / 2 + an.thickness / 2) / (d.r + d.thickness / 2)) / DEG,
  ceiling: MUSEUM.pavilion.ceilingHeight,
  /** Ring wall centreline (the dome's supports: H, D and the arches stand on it). */
  ringC: d.ringR + d.thickness / 2,
  /** Lobe wall centreline. */
  lobeC: d.r + d.thickness / 2,
  /** The ambulatory's middle (between the ring's outer face and the lobe). */
  ambMidR: (d.ringR + d.thickness + d.r) / 2,
  podiumR: MUSEUM.podium.ringR,
  curbR: MUSEUM.oculus.rings[0],
  poolR: MUSEUM.oculus.rings[1],
  balcony: MUSEUM.balcony,
  /** The dome's sphere (radius, centre height) through the springing circle and the crown. */
  domeSphereR: (d.ringR * d.ringR + MUSEUM.dome.rise * MUSEUM.dome.rise) / (2 * MUSEUM.dome.rise),
  domeCentreY: MUSEUM.dome.springY + MUSEUM.dome.rise - (d.ringR * d.ringR + MUSEUM.dome.rise * MUSEUM.dome.rise) / (2 * MUSEUM.dome.rise),
  domeTop: MUSEUM.dome.collarTop,
  /** Centre of the annex skylight (halfway down the hall). */
  annexSkylightZ: (Math.sqrt(d.r * d.r - (an.width / 2) ** 2) + an.endZ) / 2,
}

/** An arch in the ring circle: chord, spring height (apex − chord / 2) and mid angle. */
export function archOf(a: { fromDeg: number; toDeg: number; apex: number }) {
  const chord = 2 * KEY.ringC * Math.sin(((a.toDeg - a.fromDeg) / 2) * DEG)
  return { ...a, chord, spring: a.apex - chord / 2, midDeg: (a.fromDeg + a.toDeg) / 2 }
}
export const ARCH = { eEast: archOf(MUSEUM.arches.eEast), eWest: archOf(MUSEUM.arches.eWest), d: archOf(MUSEUM.arches.d) } as const

export type Vec3 = [number, number, number]
