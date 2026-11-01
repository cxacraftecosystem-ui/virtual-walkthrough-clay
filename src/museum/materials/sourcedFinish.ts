/**
 * SOURCED FINISHES (GRAND §5.2): the clay surfaces an untextured scan wears.
 *
 * Most museum scans in the sourced set (Wikimedia Commons, some Smithsonian) carry geometry only,
 * or a photo texture that reads as a different room's light. A finish gives such a piece one of
 * the pavilion's own bodies: a library set (Clay005 / Clay009 / Plaster001 / Terrazzo-free stone)
 * sampled triplanar at a small-object scale, tinted to the swatch. 'asis' keeps the file's own
 * materials.
 *
 * One material per (finish, tier), shared by every placement, so the seven finishes cost seven
 * programs at most; `SourcedFinishWarmup` mounts each once at startup so effects/Precompile.tsx
 * compiles them before Enter. The maps start as 1 × 1 stand-ins (white albedo, flat normal) and
 * are swapped for the library's when they arrive: textures change, the program does not.
 */
import * as THREE from 'three'
import type { QualityTier } from '../config/quality'
import type { SourcedFinish } from '../config/sourcedRegistry.generated'
import { pbrBase, pbrTint, whiteMap, type PbrSetId } from './pbrSets'
import { makeTriplanar } from './triplanar'

interface FinishSpec {
  set: PbrSetId
  /** Swatch (sRGB): the body colour after firing. */
  color: string
  roughness: number
  /** Normal strength: burnished and glazed bodies are smoother. */
  normal: number
  /** Metres per texture tile: small for hand-sized objects. */
  tile: number
  envMapIntensity: number
}

export const FINISHES: Record<Exclude<SourcedFinish, 'asis'>, FinishSpec> = {
  terracotta: { set: 'Clay005', color: '#b8613e', roughness: 0.9, normal: 0.9, tile: 0.42, envMapIntensity: 0.5 },
  'red-slip': { set: 'Clay005', color: '#9a3a26', roughness: 0.62, normal: 0.55, tile: 0.42, envMapIntensity: 0.75 },
  'black-burnished': { set: 'Clay009', color: '#2b2523', roughness: 0.38, normal: 0.35, tile: 0.42, envMapIntensity: 1.1 },
  buff: { set: 'Clay009', color: '#cfae86', roughness: 0.92, normal: 0.9, tile: 0.42, envMapIntensity: 0.5 },
  'grey-clay': { set: 'Clay009', color: '#8f8a83', roughness: 0.95, normal: 1.0, tile: 0.6, envMapIntensity: 0.45 },
  stone: { set: 'Plaster001', color: '#9b9286', roughness: 0.82, normal: 1.1, tile: 0.5, envMapIntensity: 0.55 },
  plaster: { set: 'Plaster001', color: '#ece6dc', roughness: 0.55, normal: 0.4, tile: 0.5, envMapIntensity: 0.8 },
}

export const FINISH_IDS = Object.keys(FINISHES) as Exclude<SourcedFinish, 'asis'>[]

let flat: THREE.DataTexture | null = null
/** A 1 × 1 flat tangent-space normal (128, 128, 255): holds the normal-map slot open. */
function flatNormal(): THREE.DataTexture {
  if (!flat) {
    flat = new THREE.DataTexture(new Uint8Array([128, 128, 255, 255]), 1, 1, THREE.RGBAFormat)
    flat.needsUpdate = true
  }
  return flat
}

const cache = new Map<string, THREE.MeshStandardMaterial>()

/** The shared material of a finish on a tier (null for 'asis'). */
export function sourcedFinishMaterial(finish: SourcedFinish | string | undefined, tier: QualityTier): THREE.MeshStandardMaterial | null {
  if (!finish || finish === 'asis' || !(finish in FINISHES)) return null
  const key = `${finish}|${tier}`
  let m = cache.get(key)
  if (m) return m
  const f = FINISHES[finish as keyof typeof FINISHES]
  m = new THREE.MeshStandardMaterial({
    name: `sourced-${finish}`,
    color: pbrTint(f.set, f.color),
    roughness: f.roughness,
    metalness: 0,
    envMapIntensity: f.envMapIntensity,
    map: whiteMap(),
    normalMap: flatNormal(),
    roughnessMap: tier === 'low' ? null : whiteMap(),
    aoMap: tier === 'low' ? null : whiteMap(),
  })
  m.normalScale.set(f.normal, f.normal)
  makeTriplanar(m, f.tile)
  const mat = m
  // the library maps when (and if) this tier loads the set; until then the stand-ins hold
  pbrBase(f.set, 'color', tier, (t) => {
    mat.map = t
  })
  pbrBase(f.set, 'normal', tier, (t) => {
    mat.normalMap = t
  })
  if (tier !== 'low')
    pbrBase(f.set, 'orm', tier, (t) => {
      mat.roughnessMap = t
      mat.aoMap = t
    })
  cache.set(key, m)
  return m
}

/** Drop the materials of tiers other than `keep` (their textures belong to the library). */
export function disposeSourcedFinishes(keep: QualityTier) {
  for (const [k, m] of cache)
    if (!k.endsWith(`|${keep}`)) {
      m.dispose()
      cache.delete(k)
    }
}
