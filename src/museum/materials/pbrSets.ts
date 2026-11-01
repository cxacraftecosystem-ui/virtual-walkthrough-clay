/**
 * THE PBR LIBRARY (GRAND §6.1): twelve ambientCG sets (CC0), optimised by
 * scripts/optimize-pbr.mjs into public/textures/pbr/<Set>/{color,normal,orm}.{1024,512}.webp.
 *
 *   Clay005             drum interior plaster, dome coffers, gallery floors (tinted per room)
 *   Clay007             H panel, F's corridor face, the drum's exterior, raw-clay fields
 *   Clay009             eroded formations (triplanar), raw-clay fields, the Red Room's clay
 *   Ground054           courtyard soil, pit firing, berms, crescent roofs, the Sphere Well floor
 *   Plaster001          Gallery B's white niche wall, the Atlas lime, the library wings
 *   PaintedPlaster017   annex upper walls, ambulatory ceiling, terraces and light-well (blush)
 *   GlazedTerracotta001 dome ribs, court curb cap, Haat counter, lotus glaze base
 *   GlazedTerracotta002 tinted glazes (stored neutral)
 *   RoofingTiles013A    the dome's exterior, crescent fascia copings (stored neutral)
 *   Bricks051           theatre vault, Sphere Well base course, forecourt edging
 *   Terrazzo004         the court floor
 *   Wood092             the Wine Hall floor, shelves, round table, balcony handrail
 *
 * Per tier (GRAND §6.1, held to the §10 GPU memory budgets — an uncompressed 1K map with its
 * mips is 5.3 MB, a 512 one 1.3 MB): Low loads 6 sets at 512 (colour + normal, 16 MB), Medium 10
 * at 512 with the ORM map (40 MB), High all 12 at 512 with the court's terrazzo and the rotunda's
 * clay in colour at 1K (56 MB), Ultra the same plus colour and normal at 1K for the walls and
 * floors seen closest (80 MB). A set a tier leaves out keeps the material's procedural maps.
 *
 * Materials are built synchronously (useMaterials), so each one starts on its procedural maps
 * and swaps to the library's when they arrive: the same map slots are filled before and after,
 * so the swap never recompiles a program. Tints are given as the TARGET albedo (a PDF swatch);
 * `pbrTint` turns it into the multiply that lands the neutral sets (levelled to a mean of 0.82
 * sRGB) on that swatch.
 */
import * as THREE from 'three'
import type { QualityTier } from '../config/quality'

export type PbrSetId =
  | 'Clay005'
  | 'Clay007'
  | 'Clay009'
  | 'Ground054'
  | 'Plaster001'
  | 'PaintedPlaster017'
  | 'GlazedTerracotta001'
  | 'GlazedTerracotta002'
  | 'RoofingTiles013A'
  | 'Bricks051'
  | 'Terrazzo004'
  | 'Wood092'

/** Metres one tile of each set covers on a surface (geometry UVs are in metres). */
export const PBR_TILE: Record<PbrSetId, number> = {
  Clay005: 2.2,
  Clay007: 2.6,
  Clay009: 2.4,
  Ground054: 2.0,
  Plaster001: 2.4,
  PaintedPlaster017: 2.4,
  GlazedTerracotta001: 1.2,
  GlazedTerracotta002: 1.2,
  RoofingTiles013A: 2.0,
  Bricks051: 1.6,
  Terrazzo004: 1.6,
  Wood092: 2.2,
}

/** Sets stored as levelled greyscale (their tint sets the hue). */
export const PBR_NEUTRAL: ReadonlySet<PbrSetId> = new Set<PbrSetId>(['Clay005', 'Clay007', 'Clay009', 'Plaster001', 'PaintedPlaster017', 'RoofingTiles013A', 'GlazedTerracotta002'])

/** Mean linear albedo of a neutral set (0.82 sRGB). */
const NEUTRAL_MEAN = new THREE.Color().setRGB(0.82, 0.82, 0.82, THREE.SRGBColorSpace).r

const ORDER: PbrSetId[] = ['Clay005', 'Clay007', 'Plaster001', 'Terrazzo004', 'RoofingTiles013A', 'Ground054', 'Clay009', 'PaintedPlaster017', 'Wood092', 'GlazedTerracotta001', 'Bricks051', 'GlazedTerracotta002']

type MapKind = 'color' | 'normal' | 'orm'

export interface PbrTierPlan {
  sets: ReadonlySet<PbrSetId>
  /** Every map's size unless `hero` raises it. */
  size: 512 | 1024
  /** Ambient occlusion + roughness map (Medium and up). */
  orm: boolean
  /** Maps loaded at 1K on this tier (the surfaces seen largest and closest). */
  hero: Partial<Record<PbrSetId, readonly MapKind[]>>
}

/** Which sets, at what size, a tier loads (GRAND §6.1 / §10). */
export function pbrPlan(tier: QualityTier): PbrTierPlan {
  if (tier === 'low') return { sets: new Set(ORDER.slice(0, 6)), size: 512, orm: false, hero: {} }
  if (tier === 'medium') return { sets: new Set(ORDER.slice(0, 10)), size: 512, orm: true, hero: {} }
  if (tier === 'high') return { sets: new Set(ORDER), size: 512, orm: true, hero: { Clay005: ['color'], Terrazzo004: ['color'] } }
  return {
    sets: new Set(ORDER),
    size: 512,
    orm: true,
    hero: { Clay005: ['color', 'normal'], Terrazzo004: ['color', 'normal'], Clay007: ['color', 'normal'], Clay009: ['color'], RoofingTiles013A: ['color'] },
  }
}

/** The size of one map of a set on a tier. */
export function pbrMapSize(plan: PbrTierPlan, set: PbrSetId, kind: MapKind): 512 | 1024 {
  return plan.hero[set]?.includes(kind) ? 1024 : plan.size
}

/** GPU bytes a tier's library takes once every set has loaded (RGBA8, with mips). */
export function pbrGpuBytes(tier: QualityTier): number {
  const plan = pbrPlan(tier)
  const kinds: MapKind[] = plan.orm ? ['color', 'normal', 'orm'] : ['color', 'normal']
  let bytes = 0
  for (const set of plan.sets) for (const k of kinds) bytes += (pbrMapSize(plan, set, k) ** 2 * 4 * 4) / 3
  return bytes
}

/**
 * The multiply that brings a set's mean albedo to the target swatch (`hex`, sRGB). For the
 * neutral sets it is target ÷ their mean, clamped; for the authored sets the swatch is used as is.
 */
export function pbrTint(set: PbrSetId | null, hex: string): THREE.Color {
  const c = new THREE.Color(hex)
  if (!set || !PBR_NEUTRAL.has(set)) return c
  return new THREE.Color(Math.min(1, c.r / NEUTRAL_MEAN), Math.min(1, c.g / NEUTRAL_MEAN), Math.min(1, c.b / NEUTRAL_MEAN))
}

/* ------------------------------------------------------------------ */
/* Loading: one base texture per (set, map, size), cloned per material */
/* ------------------------------------------------------------------ */

interface Slot {
  tex: THREE.Texture
  loaded: boolean
  waiting: ((t: THREE.Texture) => void)[]
}
const slots = new Map<string, Slot>()
let loader: THREE.TextureLoader | null = null

function baseTexture(set: PbrSetId, kind: MapKind, size: number, ready: (t: THREE.Texture) => void) {
  const key = `${set}/${kind}.${size}`
  let s = slots.get(key)
  if (!s) {
    loader ??= new THREE.TextureLoader()
    const slot: Slot = { tex: null as unknown as THREE.Texture, loaded: false, waiting: [] }
    slot.tex = loader.load(
      `/textures/pbr/${set}/${kind}.${size}.webp`,
      (t) => {
        slot.loaded = true
        for (const w of slot.waiting.splice(0)) w(t)
      },
      undefined,
      () => {
        // a missing map leaves the procedural one in place
        slot.waiting.length = 0
      },
    )
    slot.tex.colorSpace = kind === 'color' ? THREE.SRGBColorSpace : THREE.NoColorSpace
    slot.tex.wrapS = slot.tex.wrapT = THREE.RepeatWrapping
    s = slot
    slots.set(key, s)
  }
  if (s.loaded) ready(s.tex)
  else s.waiting.push(ready)
}

/** A 1 × 1 white map: holds the aoMap slot open until the ORM map arrives (no recompile). */
let white: THREE.DataTexture | null = null
export function whiteMap(): THREE.DataTexture {
  if (!white) {
    white = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1, THREE.RGBAFormat)
    white.needsUpdate = true
  }
  return white
}

export interface PbrOptions {
  /** Metres per tile (default: the set's own). */
  tile?: number
  anisotropy?: number
  /** Also use the set's AO (Medium and up). Default true. */
  ao?: boolean
}

/** Every material a tier patched, so a later tier switch never leaves one waiting. */
const patched = new WeakSet<THREE.Material>()

/**
 * Point a material's maps at a library set (when the tier loads it). Until the maps arrive the
 * material keeps the maps it has; it must already HAVE a map, a normal map and (for the ORM) a
 * roughness map, so the swap changes textures, never the program.
 */
export function applyPbr(mat: THREE.MeshStandardMaterial, set: PbrSetId, tier: QualityTier, o: PbrOptions = {}): boolean {
  const plan = pbrPlan(tier)
  if (!plan.sets.has(set)) return false
  const rep = 1 / (o.tile ?? PBR_TILE[set])
  const aniso = o.anisotropy ?? 4
  const load = (kind: MapKind, assign: (t: THREE.Texture) => void) =>
    baseTexture(set, kind, pbrMapSize(plan, set, kind), (base) => {
      const t = base.clone()
      t.repeat.set(rep, rep)
      t.anisotropy = aniso
      t.needsUpdate = true
      assign(t)
    })
  load('color', (t) => {
    mat.map = t
  })
  load('normal', (t) => {
    mat.normalMap = t
  })
  if (plan.orm) {
    if (o.ao !== false && !mat.aoMap) mat.aoMap = whiteMap()
    if (!mat.roughnessMap) mat.roughnessMap = whiteMap()
    load('orm', (t) => {
      mat.roughnessMap = t
      if (o.ao !== false) mat.aoMap = t
    })
  }
  patched.add(mat)
  return true
}

/** The base (un-repeated) colour map of a set at the tier's size, for owners that build their own material (triplanar). */
export function pbrBase(set: PbrSetId, kind: MapKind, tier: QualityTier, ready: (t: THREE.Texture) => void): boolean {
  const plan = pbrPlan(tier)
  if (!plan.sets.has(set) || (kind === 'orm' && !plan.orm)) return false
  baseTexture(set, kind, pbrMapSize(plan, set, kind), ready)
  return true
}

/** Licence record of the library (shown on /credits). */
export const PBR_CREDITS = {
  author: 'ambientCG',
  source: 'https://ambientcg.com',
  license: 'CC0' as const,
  licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
  sets: ORDER,
}
