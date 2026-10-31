/**
 * EXHIBITS — three-dimensional pieces on a podium of the row or on a low display table by a
 * wall (exhibits/Exhibit.tsx), each opening the 3D inspection viewer.
 *
 * To show a real scanned or modelled piece, drop a GLB into /public/models and set `model`.
 * Without one, a clay vessel stands in (exhibits/ClayVesselPlaceholder.tsx). `placeholderMotif`,
 * `placeholderSize` and `inkColor` belong to the shared content schema (the admin edits them in
 * both museums); the pavilion's stand-in reads only the tradition.
 */

import type { SurfaceId } from './layout'
import type { ContentI18n } from '../i18n/core'

export type MotifId = 'rosette' | 'teardrop' | 'star-lattice' | 'leaf-trail' | 'diamond'

export interface ExhibitConfig {
  id: string
  title: string
  tradition: string
  /** Artwork this block relates to. */
  artworkId: string
  placement: {
    surface: SurfaceId
    /** Coordinate along the wall (see artworks.ts). */
    at: number
  }
  /** GLB/GLTF under /public/models. Optional. */
  model?: string
  /** Uniform scale applied to the GLB (models should be authored in metres). */
  modelScale?: number
  /** Placeholder generation (used when `model` is missing). */
  placeholderMotif: MotifId
  /** Carved face size of the placeholder block (m). */
  placeholderSize?: [number, number]
  /** Ink colour used for the impression swatch beside the block. */
  inkColor: string
  material?: string
  technique?: string
  artisan?: string
  /** "Meet the maker" profile id (src/museum/content/artisans.ts / admin → Makers). */
  artisanId?: string
  region?: string
  description?: string
  placeholder?: boolean
  /** Alternative text describing the block (guide, screen readers). */
  alt?: string
  /** Optional Hindi / Bengali overrides of the text fields. */
  i18n?: ContentI18n<'title' | 'tradition' | 'artisan' | 'region' | 'material' | 'technique' | 'description' | 'alt'>
}

/**
 * The pavilion has no display tables: its three-dimensional pieces stand on the podium row and
 * are scene objects (objects.ts, PODIUM_PIECES). The type and the list stay so the shared admin
 * and content API keep working; a curator can still add a table piece here if one is wanted.
 */
export const EXHIBITS: ExhibitConfig[] = []

/** Display table dimensions (brushed timber). */
export const DISPLAY_TABLE = { length: 0.9, depth: 0.55, height: 0.86, wallGap: 0.12 }

export function getExhibit(id: string) {
  return EXHIBITS.find((e) => e.id === id)
}
