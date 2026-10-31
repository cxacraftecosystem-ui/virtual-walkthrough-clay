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

export const MUSEUM = {
  pavilion: {
    /** Overall height, ground to roof top (20 ft). */
    height: 6.1,
    /** Clear interior height to the underside of the roof slab. */
    ceilingHeight: 5.75,
    roofThickness: 0.35,
    /** Roof slab overhang beyond the drum and annex walls (elevation). */
    roofOverhang: 0.45,
    /** "Duplex" band: the horizontal line half way up the drum and annex (10 ft). */
    mezzanineBand: 3.05,
  },

  drum: {
    /** Interior face radius of the large lobe round the annex (70 ft Ø). */
    r: 10.67,
    /** Interior face radius of the west gallery ring (A, B, C). */
    ringR: 7.85,
    thickness: 0.35,
    /** Plan angles (deg) of the two radial notch walls joining ring and lobe. */
    neNotchDeg: 35,
    dNotchDeg: 224,
  },

  annex: {
    /** Clear width between the side walls (15 ft). */
    width: 15 * FT,
    /** z of the end wall's interior face (the door wall). */
    endZ: 19.5,
    thickness: 0.35,
    door: { width: 2.1, height: 3.6 },
  },

  /** H — gallery description wall: free-standing arc at the annex mouth, facing the entrance. */
  descriptionWall: { r: 8.0, thickness: 0.25, fromDeg: 52, toDeg: 128, height: 3.6 },

  /** F — inner main wall: taller arc behind H, hiding the oculus court from the entrance. */
  innerMainWall: { r: 5.95, thickness: 0.25, fromDeg: 30, toDeg: 150, height: 4.2 },

  /** D — the hallway's inner wall (the drum lobe is its outer wall). */
  hallwayWall: { r: 8.05, thickness: 0.2, fromDeg: 146, toDeg: 204, height: 3.6 },

  /** Short radial fins between the podium runs (A|B, B|C). */
  fins: { r0: 6.4, r1: 7.35, thickness: 0.12, height: 2.4, atDeg: [-20, -98.5] as const },

  oculus: {
    /** Radius of the open skylight in the roof ("exposed skylight and environment"). */
    r: 2.6,
    /** Concentric plinth rings under it, outermost first (drawing). */
    rings: [3.15, 2.6, 2.05, 1.8] as const,
    /** Height of the outer curb ring (the visitor walks round it). */
    curbHeight: 0.45,
    curbThickness: 0.3,
  },

  podium: {
    /** 12 in × 12 in, 4 ft tall. */
    size: 12 * 0.0254,
    height: 4 * FT,
    /** Circle the podium centres stand on (in front of the ring wall). */
    ringR: 6.9,
    /** Plan angles (deg) per tradition zone, in walking order A → B → C (as drawn). */
    anglesDeg: {
      a: [16, 3, -10],
      b: [-37, -49, -61, -74, -88],
      c: [-108, -121, -134],
    },
  },

  landscape: {
    /** Radius of the landscape plinth disc round the drum. */
    r: 15.1,
  },

  forecourt: {
    /** Half width of the paved forecourt in front of the annex door. */
    halfWidth: 8,
    /** Far edge of the forecourt (z). */
    endZ: 29.5,
  },

  walls: {
    exteriorThickness: 0.35,
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
    briskSpeed: 2.3,
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
     * FRONT ENTRANCE SPAWN POINT: on the forecourt, 7 m outside the annex door, facing in
     * (north, −z) with the whole entrance front in view.
     */
    start: { x: 0, z: 26.5, yawDeg: 0, pitchDeg: 6 },
  },
} as const

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
}

export type Vec3 = [number, number, number]
