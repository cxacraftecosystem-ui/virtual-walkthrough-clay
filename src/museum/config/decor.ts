/**
 * WALL FINISHES & DECOR — content only (rendering: architecture/WallDecor.tsx).
 *
 * The pavilion's own clay finishes (rose and terracotta plaster above an oxblood shadow line, the
 * oxblood and ochre inner walls, raw clay patches, the cove glow) are part of the architecture
 * (architecture/Pavilion.tsx, Wall.tsx, RawClayPatches.tsx), so DECOR is empty here. The decor
 * system itself — fields, reliefs, jali, frames, wraps and medallions — is kept for rooms that
 * want an applied finish on a straight wall.
 *
 * Geometry conventions (all metres, world coordinates):
 *   face   a wall-face PLANE: `axis` is the world axis the plane is perpendicular to,
 *          `plane` its coordinate, `normal` the side it faces (+1 / −1 along `axis`).
 *   run    extent along the wall (world z for x-faces, world x for z-faces).
 *   y      height range above the floor.
 * Layers are clipped automatically to the solid parts of the walls on that plane
 * (door openings stay open) unless `clip: false`.
 *
 * Offsets: finish `field` layers sit 1.5 mm proud (under every hung object's 2–4 mm
 * stand-off) with polygonOffset; `relief` elements (dados, rails, friezes, surrounds) are
 * real slabs `depth` deep and are kept clear of hung content (above 3.3 m / below 1.1 m,
 * or with `reserve` rectangles computed from the content configs).
 */
import type { QualityTier } from './quality'
import type { DecorMaterialKey } from '../materials/decorMaterials'
import { ARTWORKS } from './artworks'
import { INFOGRAPHICS } from './infographics'
import { SURFACES, type SurfaceId, type ZoneId } from './layout'
import { MUSEUM } from './museum'
import { VIDEOS } from './videos'

export type Range = [number, number]

export interface DecorFace {
  axis: 'x' | 'z'
  plane: number
  normal: 1 | -1
}

export interface DecorRect {
  run: Range
  y: Range
}

export interface DecorUV {
  /** Band mapping: v spans [y0, y1] → [0, tileHeight] (u scaled equally), for friezes. */
  band?: number
  /** Centre the pattern on the rectangle (symmetric screens). */
  center?: boolean
}

interface Base {
  face: DecorFace
  run: Range
  y: Range
  /** Rectangles on this face to leave untouched. */
  reserve?: DecorRect[]
  /** Clip to the solid wall parts on the plane (default true). */
  clip?: boolean
  /** Cut this element's rectangle out of every other treatment on the same face (surrounds, screens). */
  exclusive?: boolean
  /** Skip below this tier. */
  minTier?: QualityTier
}

/** Flat finish layer (1.5 mm proud by default). */
export interface FieldTreatment extends Base {
  type: 'field'
  material: DecorMaterialKey
  offset?: number
  uv?: DecorUV
}

/** Proud slab: dado, skirting, rail, frieze, cladding course, architrave. */
export interface ReliefTreatment extends Base {
  type: 'relief'
  material: DecorMaterialKey
  /** Material of the slab's top/bottom/end faces (default = material). */
  edgeMaterial?: DecorMaterialKey
  depth: number
  uv?: DecorUV
  /** Split into panels of `width` with `gap` reveals, measured from run[0]. */
  panels?: { width: number; gap: number }
  castShadow?: boolean
}

/** Pierced screen in a carved surround: back (glow / shadow) plane, screen, frame slabs. `run`/`y` = clear opening. */
export interface JaliTreatment extends Base {
  type: 'jali'
  screen: DecorMaterialKey
  back: DecorMaterialKey
  frame: DecorMaterialKey
  frameWidth: number
  frameDepth: number
  screenDepth: number
  /** The carved frame casts shadows (sunlit courtyard). */
  castShadow?: boolean
}

/** Slim frame (e.g. brass fillet) around a rectangle: `run`/`y` = inner edge, drawn outward by `width`. */
export interface FrameTreatment extends Base {
  type: 'frame'
  material: DecorMaterialKey
  width: number
  depth: number
}

/** Wrap a free-standing wall (WALLS id) in a finish on all four sides and the top. */
export interface WrapTreatment {
  type: 'wrap'
  wallId: string
  material: DecorMaterialKey
  y: Range
  offset?: number
  minTier?: QualityTier
}

/**
 * SVG medallion hung on a display surface (curator-movable): a single-colour SVG
 * (fill="currentColor", under /public) rasterised to a crisp alpha-tested relief,
 * recoloured per location, with an optional slow "breathing" backlight halo.
 * Placements that would touch hung content or floor objects against the wall are dropped.
 */
export interface MedallionTreatment {
  type: 'medallion'
  /** Public URL of the SVG. */
  svg: string
  surface: SurfaceId
  at: number
  centerHeight: number
  /** Diameter (m). */
  size: number
  color: string
  metalness?: number
  roughness?: number
  /** Relief strength (normal-map scale, default 1). */
  relief?: number
  /**
   * 'relief' (default): alpha-tested, chased metal / carved look.
   * 'paint': alpha-blended stencil — soft, alias-free edges on light walls at a distance.
   */
  finish?: 'relief' | 'paint'
  /** Distance off the wall face (default 6 mm). */
  offset?: number
  /** Slow backlight: halo colour, peak intensity, period (s). */
  glow?: { color: string; intensity: number; period?: number }
  /**
   * Layered roundel around the mandala (all sizes are fractions of `size`):
   * a painted backing disc, a second smaller mandala rotated into the open centre
   * (optionally turning very slowly), raised brass rings and a domed centre boss.
   */
  ornate?: {
    disc?: { color: string; scale?: number; roughness?: number }
    inner?: { color: string; scale?: number; rotationDeg?: number; metalness?: number; roughness?: number; spinPeriod?: number }
    rings?: { color: string; radii: number[]; tube?: number }
    boss?: { color: string; scale?: number }
  }
  minTier?: QualityTier
}

export type DecorTreatment = FieldTreatment | ReliefTreatment | JaliTreatment | FrameTreatment | WrapTreatment | MedallionTreatment

export interface DecorGroup {
  id: string
  /** Rendered while any of these zones is visible (ZoneGroup). */
  zones: ZoneId[]
  treatments: DecorTreatment[]
}

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

/**
 * Face + usable run of a display surface (layout.ts).
 * DecorFace is an axis-aligned plane, while the pavilion's surfaces are straight runs at any
 * angle ('along'): the face snaps to the dominant axis of the surface normal, which is exact
 * for the annex walls only. Use it on axis-aligned surfaces.
 */
function surf(id: SurfaceId): { face: DecorFace; run: Range } {
  const s = SURFACES[id]
  const xFace = Math.abs(s.normal[0]) >= Math.abs(s.normal[1])
  const f: DecorFace = xFace ? { axis: 'x', plane: s.a[0], normal: s.normal[0] < 0 ? -1 : 1 } : { axis: 'z', plane: s.a[1], normal: s.normal[1] < 0 ? -1 : 1 }
  return { face: f, run: [s.range[0], s.range[1]] }
}

/**
 * Rectangles occupied by content hung on a surface (artworks + label, videos, infographics),
 * grown by `margin`, in the surface's own run coordinate (`at`).
 */
export function contentReserves(id: SurfaceId, margin = 0.2): DecorRect[] {
  const out: DecorRect[] = []
  const add = (at: number, cy: number, w: number, h: number, labelSide = 0) => {
    const lab = labelSide > 0 ? 0.62 : 0
    out.push({ run: [at - w / 2 - margin, at + w / 2 + margin + lab], y: [cy - h / 2 - margin, cy + h / 2 + margin] })
  }
  for (const a of ARTWORKS)
    if (a.placement.surface === id) add(a.placement.at, a.placement.centerHeight ?? MUSEUM.display.artworkCenterHeight, a.maxWidth, a.maxHeight, a.label === false ? 0 : 1)
  for (const v of VIDEOS) if (v.placement.surface === id) add(v.placement.at, v.placement.centerHeight, v.width, (v.width * 9) / 16)
  for (const g of INFOGRAPHICS) if (g.placement.surface === id) add(g.placement.at, g.placement.centerHeight ?? MUSEUM.display.artworkCenterHeight, g.width, g.height)
  return out
}

/** Face of a display surface (for renderers). */
export const surfaceFace = (id: SurfaceId): DecorFace => surf(id).face

/** Applied finishes; none in the pavilion (its clay finishes are built with the walls, see above). */
export const DECOR: DecorGroup[] = []
