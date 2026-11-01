/**
 * MUSEUM MATERIAL LIBRARY
 *
 * One shared set of PBR materials per quality tier. Geometry UVs are in METRES
 * (see geometry.ts → createMeterBoxGeometry), so every procedural texture uses
 * `repeat = 1 / tileMetres` and reads at true physical scale.
 */

import { useMemo } from 'react'
import * as THREE from 'three'
import { QUALITY_PRESETS, withDevOverrides, type QualityTier } from '../config/quality'
import { useMuseum } from '../state/store'
import { disposeTextureSets, getFluteNormalMap, getTextureSet, type PBRTextureSet, type TextureKind } from './proceduralTextures'
import { injectAtmosphere } from '../lighting/atmosphere/inject'
import { applyPbr, pbrTint, type PbrSetId } from './pbrSets'
import { limeBanded } from './limeBands'

export type MaterialKey =
  | 'plaster'
  | 'plasterCeiling'
  | 'oakFloor'
  | 'timberCeiling'
  | 'timber'
  | 'walnut'
  | 'oakFrame'
  | 'paintBlack'
  | 'paintWhite'
  | 'benchWhite'
  | 'shadowGap'
  | 'trackBlack'
  | 'steelWhite'
  | 'glass'
  | 'linen'
  | 'stone'
  | 'deskTop'
  | 'bronze'
  // ── wall finishes (see config/decor.ts, architecture/WallDecor.tsx) ──
  | 'limePlasterWarm'
  | 'limewashOchre'
  | 'indigoPlaster'
  | 'terracottaPlaster'
  | 'madderPlaster'
  | 'sandRender'
  | 'stoneCladding'
  | 'stonePlinth'
  | 'brick'
  | 'flutedTimber'
  | 'brass'
  // ── clay pavilion (architecture/Pavilion.tsx, palette from the design PDF) ──
  /** Rose clay plaster: drum interior below the duplex band. */
  | 'clayRose'
  /** Paler rose clay: drum interior above the band, the oculus light well. */
  | 'clayBlush'
  /** Terracotta clay plaster: hallway wall D, annex interior, niche linings. */
  | 'clayTerracotta'
  /** Ochre clay plaster: entry-way accents, the band ledge. */
  | 'clayOchre'
  /** Pale buff clay: the description wall H (carries the title). */
  | 'clayBuff'
  /** Deep oxblood red clay: the inner main wall F, fins, podiums. */
  | 'oxblood'
  /** Oxblood lacquer: door reveal, plinth curb top (low sheen). */
  | 'oxbloodLacquer'
  /** Raw sun-dried clay: feature patches, the plinth basin. */
  | 'rawClay'
  /** Rammed earth: the pavilion's exterior walls. */
  | 'rammedEarth'
  /** Burnished earth floor (interior). */
  | 'earthFloor'
  /** Oxblood inlay rings in the earth floor. */
  | 'earthInlay'
  /** Ceiling / roof soffit: pale clay. */
  | 'clayCeiling'
  /** Exterior paving: warm sandstone slabs (forecourt, landscape plinth). */
  | 'sandPaving'
  // ── the grand plan's library finishes (GRAND §6.1, materials/pbrSets.ts) ──
  /** The dome's coffered interior: rose clay (Clay005). */
  | 'domeCoffer'
  /** Smooth blush plaster: the dome's terraces and light-well, annex upper walls (PaintedPlaster017). */
  | 'blushPlaster'
  /** The dome's exterior: terracotta tile (RoofingTiles013A). */
  | 'roofTile'
  /** Glazed terracotta: dome ribs, the collar, copings, the curb cap (GlazedTerracotta001). */
  | 'glazedTerracotta'
  /** Gallery A: deep red lacquered limewash (p02). */
  | 'redLacquer'
  /** Gallery B: bright white limewash (Plaster001, p08r). */
  | 'whiteLime'
  /** Gallery C: charcoal clay plaster. */
  | 'charcoalClay'
  /** The court floor: warm polished terrazzo (Terrazzo004). */
  | 'terrazzo'
  /** The Wine Hall floor, the balcony handrail: timber (Wood092, p08l). */
  | 'timberFloor'
  /** The Wine Hall's walls: deep wine clay (p08l). */
  | 'wineWall'
  /** The Parikrama and the Red Room: deep red lime plaster (p09). */
  | 'redLime'
  /** Bare earth: courtyards, berms, planted roofs, the Sphere Well floor (Ground054). */
  | 'groundSoil'
  /** Fired brick: the theatre vault, the Sphere Well's base course, forecourt edging (Bricks051). */
  | 'bricks'
  /** Layered raw clay (Clay009): eroded formations and raw-clay fields (use triplanar on organic meshes). */
  | 'clayStrata'
  /** Raw clay (Clay007): H's title panel, F's corridor face (the lippan's ground). */
  | 'clayPanel'
  /**
   * The Parikrama's walls (and the satellites' walk faces): red lime with a pale lime coping and
   * string course, a darker oxblood plinth and a mottled limewash (materials/limeBands.ts).
   */
  | 'parikramaWall'
  /** The Parikrama's walk: a darker polished oxblood lime, with a sheen that holds the sky. */
  | 'parikramaFloor'

export type MuseumMaterials = Record<MaterialKey, THREE.Material>

interface TexturedOpts {
  color: string
  normalScale: number
  /** Multiplies the roughness map (map values are absolute, so 1 = as authored). */
  roughness?: number
  envMapIntensity?: number
  name: string
}

function textured(set: PBRTextureSet, o: TexturedOpts): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({
    name: o.name,
    color: new THREE.Color(o.color),
    map: set.map,
    roughnessMap: set.roughnessMap,
    roughness: o.roughness ?? 1,
    normalMap: set.normalMap,
    normalScale: new THREE.Vector2(o.normalScale, o.normalScale),
    metalness: 0,
    envMapIntensity: o.envMapIntensity ?? 1,
  })
  return m
}

function solid(name: string, color: string, roughness: number, metalness = 0, envMapIntensity = 1): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ name, color: new THREE.Color(color), roughness, metalness, envMapIntensity })
}

/**
 * Wall-finish texture sizes scale with the tier's textureSize (Low ½, Medium/High 1×,
 * Ultra 2×) around a base tuned for ≤ 20 MB of extra GPU memory on High.
 */
export function finishTextureSize(tier: QualityTier, base: number): number {
  const s = QUALITY_PRESETS[tier].textureSize / 1024
  return Math.max(128, Math.min(2048, Math.round(base * s)))
}
const FINISH_BASE = { limewash: 512, stained: 512, ashlar: 512, brick: 384, clayPlaster: 1024, rawClay: 512, rammedEarth: 512, earthFloor: 1024 } as const

/** Every procedural texture size a tier uses (kept alive when switching tiers). */
function tierTextureSizes(tier: QualityTier): number[] {
  const sz = QUALITY_PRESETS[tier].textureSize
  return [sz, Math.min(sz, 1024), ...Object.values(FINISH_BASE).map((b) => finishTextureSize(tier, b))]
}

/** Lime / render finish on the neutral limewash set, tinted by `color`. */
function limeFinish(set: PBRTextureSet, name: string, color: string, normalScale = 0.55, roughness = 0.93): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    name,
    color: new THREE.Color(color),
    map: set.map,
    normalMap: set.normalMap,
    normalScale: new THREE.Vector2(normalScale, normalScale),
    roughness,
    metalness: 0,
    envMapIntensity: 0.55,
  })
}

function buildMaterials(tier: QualityTier): MuseumMaterials {
  const preset = withDevOverrides(QUALITY_PRESETS[tier])
  const size = preset.textureSize
  const aniso = preset.textureAnisotropy

  // Only the floor (large, seen at grazing angles) benefits from 2048 maps;
  // everything else is capped at 1024 to keep generation time low on 'ultra'.
  const tex = (kind: TextureKind): PBRTextureSet => {
    const set = getTextureSet(kind, kind === 'oakFloor' ? size : Math.min(size, 1024), aniso)
    const r = 1 / set.tileMetres
    for (const t of [set.map, set.roughnessMap, set.normalMap]) t.repeat.set(r, r)
    return set
  }
  // Linen is fine-scaled; smaller sets are plenty and cheaper.
  const linenSet = (() => {
    const set = getTextureSet('linen', Math.min(size, 1024), aniso)
    const r = 1 / set.tileMetres
    for (const t of [set.map, set.roughnessMap, set.normalMap]) t.repeat.set(r, r)
    return set
  })()

  const plaster = tex('plaster')
  const oak = tex('oakFloor')
  const timber = tex('timber')
  const walnut = tex('walnut')
  const stone = tex('stone')
  // the forecourt and the plinth: the same stone at 2.5 × the slab (1.5 m lime slabs, a large
  // format that reads as architecture from the spawn, never a tile grid)
  const paving: PBRTextureSet = (() => {
    const k = 0.4
    const [map, roughnessMap, normalMap] = [stone.map, stone.roughnessMap, stone.normalMap].map((t) => {
      const c = t.clone()
      c.repeat.set(t.repeat.x * k, t.repeat.y * k)
      c.needsUpdate = true
      return c
    })
    return { ...stone, map, roughnessMap, normalMap, tileMetres: stone.tileMetres / k }
  })()

  // Wall finishes: smaller sets (albedo + normal only — constant roughness keeps memory low).
  const finish = (kind: TextureKind, base: number): PBRTextureSet => {
    const set = getTextureSet(kind, finishTextureSize(tier, base), aniso)
    const r = 1 / set.tileMetres
    for (const t of [set.map, set.roughnessMap, set.normalMap]) t.repeat.set(r, r)
    return set
  }
  const lime = finish('limewash', FINISH_BASE.limewash)
  const stained = finish('limewashStained', FINISH_BASE.stained)
  const ashlar = finish('ashlar', FINISH_BASE.ashlar)
  const brick = finish('brick', FINISH_BASE.brick)
  const clay = finish('clayPlaster', FINISH_BASE.clayPlaster)
  const raw = finish('rawClay', FINISH_BASE.rawClay)
  const rammed = finish('rammedEarth', FINISH_BASE.rammedEarth)
  const earth = finish('earthFloor', FINISH_BASE.earthFloor)
  /** Clay plaster tinted by `color`; keeps the set's roughness map (raw patches are matte). */
  const clayFinish = (name: string, color: string, normalScale = 0.8, roughness = 1, envMapIntensity = 0.5) =>
    textured(clay, { name, color, normalScale, roughness, envMapIntensity })
  const flute = getFluteNormalMap()
  flute.repeat.set(1 / 0.045, 1) // 45 mm reeds

  const glass = new THREE.MeshPhysicalMaterial({
    name: 'glass',
    color: new THREE.Color('#d9ecf0'),
    transparent: true,
    opacity: 0.16,
    roughness: 0.03,
    metalness: 0,
    ior: 1.5,
    depthWrite: false,
    envMapIntensity: 1.2,
    side: THREE.DoubleSide,
    // One pass for both faces: thin glazing never needs back-to-front face sorting.
    forceSinglePass: true,
  })

  const mats: MuseumMaterials = {
    plaster: textured(plaster, { name: 'plaster', color: '#ece6dc', normalScale: 0.25, envMapIntensity: 0.6 }),
    plasterCeiling: textured(plaster, { name: 'plasterCeiling', color: '#f0eee9', normalScale: 0.2, envMapIntensity: 0.5 }),
    oakFloor: textured(oak, { name: 'oakFloor', color: '#ffffff', normalScale: 0.35, envMapIntensity: 0.8 }),
    timberCeiling: textured(timber, { name: 'timberCeiling', color: '#fff8ee', normalScale: 0.4, roughness: 1.05, envMapIntensity: 0.6 }),
    timber: textured(timber, { name: 'timber', color: '#f7ecdc', normalScale: 0.45, envMapIntensity: 0.8 }),
    walnut: textured(walnut, { name: 'walnut', color: '#ffffff', normalScale: 0.4, envMapIntensity: 0.9 }),
    oakFrame: textured(timber, { name: 'oakFrame', color: '#ecdcc4', normalScale: 0.35, roughness: 0.95, envMapIntensity: 0.9 }),
    paintBlack: solid('paintBlack', '#1d1c1b', 0.55, 0, 0.8),
    paintWhite: solid('paintWhite', '#f4f2ee', 0.7, 0, 0.7),
    benchWhite: solid('benchWhite', '#f1eee8', 0.55, 0, 0.8),
    shadowGap: solid('shadowGap', '#2d2a27', 0.9, 0, 0.3),
    trackBlack: solid('trackBlack', '#1a1a1a', 0.45, 0.6, 1),
    steelWhite: solid('steelWhite', '#f2f1ee', 0.5, 0.2, 0.9),
    glass,
    linen: textured(linenSet, { name: 'linen', color: '#e9e0d0', normalScale: 0.6, envMapIntensity: 0.5 }),
    stone: textured(stone, { name: 'stone', color: '#ffffff', normalScale: 0.5, envMapIntensity: 0.7 }),
    deskTop: solid('deskTop', '#f3f1ec', 0.32, 0, 0.9),
    bronze: solid('bronze', '#5a4a3a', 0.35, 0.8, 1),

    limePlasterWarm: limeFinish(lime, 'limePlasterWarm', '#f1e6d2', 0.45),
    limewashOchre: new THREE.MeshStandardMaterial({
      name: 'limewashOchre',
      color: new THREE.Color('#ffffff'),
      map: stained.map,
      normalMap: lime.normalMap,
      normalScale: new THREE.Vector2(0.6, 0.6),
      roughness: 0.94,
      envMapIntensity: 0.5,
    }),
    indigoPlaster: limeFinish(lime, 'indigoPlaster', '#34466e', 0.6, 0.9),
    terracottaPlaster: limeFinish(lime, 'terracottaPlaster', '#c07a5a', 0.6),
    madderPlaster: limeFinish(lime, 'madderPlaster', '#7d3a2e', 0.6, 0.9),
    sandRender: limeFinish(lime, 'sandRender', '#e2cfb0', 0.6, 0.95),
    stoneCladding: new THREE.MeshStandardMaterial({
      name: 'stoneCladding',
      map: ashlar.map,
      normalMap: ashlar.normalMap,
      normalScale: new THREE.Vector2(0.7, 0.7),
      roughness: 0.86,
      envMapIntensity: 0.6,
    }),
    stonePlinth: new THREE.MeshStandardMaterial({
      name: 'stonePlinth',
      color: new THREE.Color('#bda78d'),
      map: ashlar.map,
      normalMap: ashlar.normalMap,
      normalScale: new THREE.Vector2(0.8, 0.8),
      roughness: 0.82,
      envMapIntensity: 0.6,
    }),
    brick: new THREE.MeshStandardMaterial({
      name: 'brick',
      map: brick.map,
      normalMap: brick.normalMap,
      normalScale: new THREE.Vector2(1, 1),
      roughness: 0.9,
      envMapIntensity: 0.45,
    }),
    flutedTimber: new THREE.MeshStandardMaterial({
      name: 'flutedTimber',
      color: new THREE.Color('#cfb496'),
      map: timber.map,
      roughnessMap: timber.roughnessMap,
      roughness: 1.05,
      normalMap: flute,
      normalScale: new THREE.Vector2(1, 1),
      envMapIntensity: 0.8,
    }),
    brass: solid('brass', '#b8955a', 0.32, 1, 1.1),

    clayRose: clayFinish('clayRose', '#d4978a'),
    clayBlush: clayFinish('clayBlush', '#e3b9ab', 0.7),
    clayTerracotta: clayFinish('clayTerracotta', '#bd8371'),
    clayOchre: clayFinish('clayOchre', '#cba486'),
    clayBuff: clayFinish('clayBuff', '#e9d7c3', 0.6),
    oxblood: clayFinish('oxblood', '#7a2c27', 0.9, 0.95, 0.45),
    oxbloodLacquer: new THREE.MeshStandardMaterial({
      name: 'oxbloodLacquer',
      color: new THREE.Color('#6d211c'),
      map: clay.map,
      normalMap: clay.normalMap,
      normalScale: new THREE.Vector2(0.15, 0.15),
      roughness: 0.38,
      envMapIntensity: 0.8,
    }),
    rawClay: textured(raw, { name: 'rawClay', color: '#c27d5f', normalScale: 1.1, envMapIntensity: 0.35 }),
    rammedEarth: textured(rammed, { name: 'rammedEarth', color: '#ffffff', normalScale: 1, envMapIntensity: 0.45 }),
    earthFloor: textured(earth, { name: 'earthFloor', color: '#d8b39b', normalScale: 0.45, envMapIntensity: 0.75 }),
    earthInlay: textured(earth, { name: 'earthInlay', color: '#8c3a2f', normalScale: 0.45, roughness: 0.85, envMapIntensity: 0.7 }),
    clayCeiling: limeFinish(lime, 'clayCeiling', '#f1ddd2', 0.4, 0.95),
    // pale lime, a little warm, never pink
    sandPaving: textured(paving, { name: 'sandPaving', color: '#e2d6c2', normalScale: 0.7, envMapIntensity: 0.5 }),

    domeCoffer: clayFinish('domeCoffer', '#d99886', 0.6, 1, 0.5),
    blushPlaster: clayFinish('blushPlaster', '#efc7b8', 0.35, 0.95, 0.5),
    roofTile: textured(rammed, { name: 'roofTile', color: '#b45a40', normalScale: 1, envMapIntensity: 0.5 }),
    glazedTerracotta: clayFinish('glazedTerracotta', '#c76a4c', 0.4, 0.42, 1.0),
    redLacquer: clayFinish('redLacquer', '#912a22', 0.3, 0.6, 0.7),
    whiteLime: limeFinish(lime, 'whiteLime', '#f3efe8', 0.45, 0.92),
    charcoalClay: clayFinish('charcoalClay', '#3d3633', 0.8, 1, 0.4),
    terrazzo: textured(stone, { name: 'terrazzo', color: '#efe2d6', normalScale: 0.15, roughness: 0.35, envMapIntensity: 1.0 }),
    timberFloor: textured(oak, { name: 'timberFloor', color: '#a8754f', normalScale: 0.35, roughness: 0.75, envMapIntensity: 0.8 }),
    wineWall: clayFinish('wineWall', '#4f1d24', 0.5, 0.95, 0.4),
    redLime: clayFinish('redLime', '#a32a1f', 0.55, 0.95, 0.45),
    parikramaWall: clayFinish('parikramaWall', '#a32a1f', 0.55, 0.95, 0.45),
    parikramaFloor: clayFinish('parikramaFloor', '#5e1f1b', 0.3, 0.42, 1.0),
    groundSoil: textured(earth, { name: 'groundSoil', color: '#8a6a52', normalScale: 0.9, envMapIntensity: 0.35 }),
    bricks: new THREE.MeshStandardMaterial({ name: 'bricks', map: brick.map, normalMap: brick.normalMap, roughnessMap: brick.roughnessMap, normalScale: new THREE.Vector2(1, 1), roughness: 0.95, envMapIntensity: 0.45 }),
    clayStrata: textured(raw, { name: 'clayStrata', color: '#c27d5f', normalScale: 1.1, envMapIntensity: 0.35 }),
    clayPanel: textured(raw, { name: 'clayPanel', color: '#c79a7c', normalScale: 1, envMapIntensity: 0.35 }),
  }

  // The library (GRAND §6.1): each finish's target albedo (a PDF swatch or its shade) on its set.
  // A tier that leaves a set out keeps the procedural maps and colour above.
  const LIB: [MaterialKey, PbrSetId, string, { normal?: number; rough?: number; tile?: number; ao?: boolean }?][] = [
    ['clayRose', 'Clay005', '#cf8a7c', { normal: 0.6 }],
    ['clayBlush', 'Clay005', '#e3b3a5', { normal: 0.5 }],
    ['clayTerracotta', 'Clay005', '#b86f5b', { normal: 0.6 }],
    ['clayOchre', 'Clay005', '#d29b6b', { normal: 0.6 }],
    ['clayBuff', 'Clay005', '#e4cfb9', { normal: 0.5 }],
    ['oxblood', 'Clay005', '#6e2620', { normal: 0.6 }],
    ['oxbloodLacquer', 'Clay005', '#5e1f1b', { normal: 0.12, rough: 0.45 }],
    ['rawClay', 'Clay009', '#b8775b', { normal: 1.2 }],
    ['rammedEarth', 'Clay007', '#c27d63', { normal: 0.9, tile: 3.2 }],
    ['earthFloor', 'Clay005', '#9f6c58', { normal: 0.35, rough: 0.62 }],
    ['earthInlay', 'Clay005', '#6e2a22', { normal: 0.3, rough: 0.55 }],
    ['clayCeiling', 'PaintedPlaster017', '#edd5c9', { normal: 0.35 }],
    ['domeCoffer', 'Clay005', '#d6917f', { normal: 0.55, tile: 2.8 }],
    ['blushPlaster', 'PaintedPlaster017', '#eebba8', { normal: 0.3 }],
    ['roofTile', 'RoofingTiles013A', '#c46a4c', { normal: 1.0, tile: 1.6 }],
    ['glazedTerracotta', 'GlazedTerracotta001', '#e2a58c', { normal: 0.5, rough: 0.55 }],
    ['redLacquer', 'Clay005', '#8f2620', { normal: 0.25, rough: 0.62 }],
    ['whiteLime', 'Plaster001', '#f8f6f1', { normal: 0.35 }],
    // lifted so the wall reads ≈ #4a4644 in C's light (black ware on black read as a void)
    // (a troweled lime plaster's grain, so the C wall between the podiums is a surface, not a flat dark sheet)
    ['charcoalClay', 'Plaster001', '#7a7470', { normal: 1.2, tile: 1.6 }],
    // a warm lime-and-brick terrazzo, never a grey granite counter
    ['terrazzo', 'Terrazzo004', '#efcfb2', { normal: 0.12, rough: 0.8 }],
    ['timberFloor', 'Wood092', '#c8915f', { normal: 0.7, rough: 0.7, tile: 2.4 }],
    // p08l's mauve wine, not a brick red under the warm light
    ['wineWall', 'Clay005', '#4a2234', { normal: 0.45 }],
    ['redLime', 'Clay005', '#a3261c', { normal: 0.5 }],
    // a touch less saturated than the Red Room's red: the walk is in daylight (p09l)
    ['parikramaWall', 'Clay005', '#a3322a', { normal: 0.55 }],
    ['parikramaFloor', 'Clay005', '#4e1a17', { normal: 0.25, rough: 0.34 }],
    ['groundSoil', 'Ground054', '#d9c8b4', { normal: 1.0 }],
    ['bricks', 'Bricks051', '#f2e2d8', { normal: 1.0, tile: 1.4 }],
    ['clayStrata', 'Clay009', '#c27a5e', { normal: 1.2 }],
    ['clayPanel', 'Clay007', '#c49478', { normal: 1.0 }],
  ]
  for (const [key, set, target, o = {}] of LIB) {
    const m = mats[key] as THREE.MeshStandardMaterial
    if (!applyPbr(m, set, tier, { tile: o.tile, anisotropy: aniso, ao: o.ao })) continue
    m.color = pbrTint(set, target)
    if (o.normal !== undefined) m.normalScale.set(o.normal, o.normal)
    if (o.rough !== undefined) m.roughness = o.rough
  }
  // Gallery B's white limewash keeps reading white under a neutral room light: the bounce of its
  // own picture lights and the court's daylight off the opposite wall (p08r), never a grey sheet
  const white = mats.whiteLime as THREE.MeshStandardMaterial
  // (scaled with the daylight each frame — `WHITE_LIME_GLOW` in architecture/Pavilion.tsx — so at
  // night the wall falls dark and the niche spots carry the room)
  white.emissive.set('#fff3e8')
  white.emissiveIntensity = 0.1
  // the court's terrazzo: a soft honed sheen, never blotchy mirror highlights
  ;(mats.terrazzo as THREE.MeshStandardMaterial).envMapIntensity = 0.6
  // The Parikrama's value structure (p09l in daylight: pale lime heads, a dark splash plinth, a
  // limewash that drifts between rose and oxblood, never one flat red)
  // (p09: plain red walls — no pale coping or string course; a dark splash plinth only)
  limeBanded(mats.parikramaWall as THREE.MeshStandardMaterial, {
    key: 'parikrama-plain',
    dado: { y: 0.3, color: '#4a1714', mix: 0.6 },
    mottle: { amount: 0.5, light: '#c8604f', dark: '#74201a', scale: 0.55 },
  })
  ;(mats.parikramaFloor as THREE.MeshStandardMaterial).envMapIntensity = 1.1
  // The shared light engine (oculus mask, lamps, glows, coves, wet floors): patched in before
  // anything compiles or StaticMerge bakes the architecture (SPECTACLE §3).
  for (const m of Object.values(mats)) injectAtmosphere(m, { coves: true })
  return mats
}

/* ------------------------------------------------------------------ */
/* Cache: one live tier; the previous one is disposed shortly after     */
/* a switch (after React has swapped every mesh to the new set).        */
/* ------------------------------------------------------------------ */

const cache = new Map<QualityTier, MuseumMaterials>()
let currentTier: QualityTier | null = null
let disposeTimer: ReturnType<typeof setTimeout> | null = null

function scheduleDisposal() {
  if (disposeTimer) clearTimeout(disposeTimer)
  disposeTimer = setTimeout(() => {
    disposeTimer = null
    if (!currentTier) return
    for (const [tier, mats] of cache) {
      if (tier === currentTier) continue
      for (const m of Object.values(mats)) {
        // the paving's maps are this tier's own clones of the stone set (the sets are disposed below)
        const sm = m as THREE.MeshStandardMaterial
        if (m.name === 'sandPaving') for (const t of [sm.map, sm.roughnessMap, sm.normalMap]) t?.dispose()
        m.dispose()
      }
      cache.delete(tier)
    }
    disposeTextureSets(...tierTextureSizes(currentTier))
  }, 1500)
}

/** Cached, non-hook factory. Switching tiers disposes the previous tier's set (deferred). */
export function getMaterials(tier: QualityTier): MuseumMaterials {
  let mats = cache.get(tier)
  if (!mats) {
    mats = buildMaterials(tier)
    cache.set(tier, mats)
  } else if (tier !== currentTier) {
    // Re-apply anisotropy (textures may be shared with a tier of the same size).
    const aniso = withDevOverrides(QUALITY_PRESETS[tier]).textureAnisotropy
    for (const m of Object.values(mats)) {
      if (m instanceof THREE.MeshStandardMaterial)
        for (const t of [m.map, m.roughnessMap, m.normalMap])
          if (t && t.anisotropy !== aniso) {
            t.anisotropy = aniso
            t.needsUpdate = true
          }
    }
  }
  if (currentTier !== null && currentTier !== tier) {
    currentTier = tier
    scheduleDisposal()
  }
  currentTier = tier
  return mats
}

/** React hook: materials for the current quality tier (stable identity per tier). */
export function useMaterials(): MuseumMaterials {
  const tier = useMuseum((s) => s.tier)
  return useMemo(() => getMaterials(tier), [tier])
}
