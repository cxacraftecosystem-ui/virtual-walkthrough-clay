/**
 * "Shape it yourself" studio — clay bodies, slips, glazes and motif bands offered to visitors.
 *
 * The names are COLOUR NAMES ONLY (what a visitor sees on screen); they make no claim about
 * recipes, minerals or firing temperatures. Each colour has a raw (leather-hard / unfired)
 * and a fired value; the studio's firing step moves from one to the other. The motifs are
 * simple marks made for this museum, not documented traditional designs.
 *
 * Pure data, no DOM — the op-list reducer (potEngine.ts) and its unit tests import it.
 */
import type { DictKey } from '../i18n/en'

export const BODY_IDS = ['red', 'buff', 'black', 'terracotta'] as const
export type ClayBodyId = (typeof BODY_IDS)[number]

export const SLIP_IDS = ['white', 'red', 'black'] as const
export type SlipId = (typeof SLIP_IDS)[number]

export const GLAZE_IDS = ['clear', 'honey', 'green', 'blue'] as const
export type GlazeId = (typeof GLAZE_IDS)[number]

export const MOTIF_IDS = ['zigzag', 'waves', 'dots', 'chevron', 'leaf', 'rings'] as const
export type PotMotifId = (typeof MOTIF_IDS)[number]

export const TECHNIQUES = ['sgraffito', 'stamp'] as const
export type BandTechnique = (typeof TECHNIQUES)[number]

export interface ClayBodyDef {
  id: ClayBodyId
  name: DictKey
  raw: string
  fired: string
  /** Fleck colour (grog / iron specks) and how many per unit area (0..1). */
  fleck: string
  flecks: number
}

export const CLAY_BODIES: ClayBodyDef[] = [
  { id: 'red', name: 'studio.body.red', raw: '#6f3d2d', fired: '#a14b33', fleck: '#3b1d14', flecks: 0.35 },
  { id: 'buff', name: 'studio.body.buff', raw: '#a69380', fired: '#d6bd93', fleck: '#5a3b24', flecks: 0.55 },
  { id: 'black', name: 'studio.body.black', raw: '#4d4946', fired: '#1f1c1b', fleck: '#6d6863', flecks: 0.25 },
  { id: 'terracotta', name: 'studio.body.terracotta', raw: '#86513b', fired: '#c4693f', fleck: '#e3b08a', flecks: 0.45 },
]

export interface SlipDef {
  id: SlipId
  name: DictKey
  raw: string
  fired: string
}

export const SLIPS: SlipDef[] = [
  { id: 'white', name: 'studio.slip.white', raw: '#d6cdbf', fired: '#eee4d2' },
  { id: 'red', name: 'studio.slip.red', raw: '#7c3826', fired: '#9e3d24' },
  { id: 'black', name: 'studio.slip.black', raw: '#3b3734', fired: '#1c1a19' },
]

export interface GlazeDef {
  id: GlazeId
  name: DictKey
  /** Fired tint laid over the clay or slip beneath, and how much it hides it (0..1). */
  tint: string
  cover: number
}

export const GLAZES: GlazeDef[] = [
  { id: 'clear', name: 'studio.glaze.clear', tint: '#fff6e6', cover: 0.1 },
  { id: 'honey', name: 'studio.glaze.honey', tint: '#a8681f', cover: 0.55 },
  { id: 'green', name: 'studio.glaze.green', tint: '#5b7a4c', cover: 0.62 },
  { id: 'blue', name: 'studio.glaze.blue', tint: '#2d4b8c', cover: 0.7 },
]

/** Unfired glaze is a pale powdery coat whatever its fired colour. */
export const RAW_GLAZE = '#e6e0d5'

export interface MotifDef {
  id: PotMotifId
  name: DictKey
  /** Width of one repeat round the pot, and the band's height (cm). */
  pitch: number
  band: number
}

export const POT_MOTIFS: MotifDef[] = [
  { id: 'zigzag', name: 'studio.motif.zigzag', pitch: 2.4, band: 1.8 },
  { id: 'waves', name: 'studio.motif.waves', pitch: 3, band: 1.6 },
  { id: 'dots', name: 'studio.motif.dots', pitch: 1.6, band: 1.2 },
  { id: 'chevron', name: 'studio.motif.chevron', pitch: 2.2, band: 1.8 },
  { id: 'leaf', name: 'studio.motif.leaf', pitch: 2.8, band: 2.2 },
  { id: 'rings', name: 'studio.motif.rings', pitch: 2.2, band: 2 },
]

export const getBody = (id: string) => CLAY_BODIES.find((b) => b.id === id) ?? CLAY_BODIES[0]
export const getSlip = (id: string | null) => (id ? (SLIPS.find((s) => s.id === id) ?? null) : null)
export const getGlaze = (id: string | null) => (id ? (GLAZES.find((g) => g.id === id) ?? null) : null)
export const getPotMotif = (id: string) => POT_MOTIFS.find((m) => m.id === id) ?? POT_MOTIFS[0]

/* ------------------------------------------------------------------ */
/* Colour helpers (pure)                                               */
/* ------------------------------------------------------------------ */

const hex = (c: string): [number, number, number] => {
  const n = parseInt(c.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
const toHex = (r: number, g: number, b: number) => `#${[r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')}`

/** Linear mix of two #rrggbb colours (t = 0 → a, 1 → b). */
export function mixHex(a: string, b: string, t: number): string {
  const x = hex(a)
  const y = hex(b)
  return toHex(x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t)
}

/** Multiply brightness (k < 1 darker, > 1 lighter). */
export function shadeHex(c: string, k: number): string {
  const [r, g, b] = hex(c)
  return toHex(r * k, g * k, b * k)
}
