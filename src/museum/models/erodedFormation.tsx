/**
 * 'eroded-formation' — a sculpted pillar of layered, wind-cut clay (PDF p05: "sculpted clay
 * formations" round the Earth Room; GRAND §2.5, §6.5): the Earth Room's canyon, the formation
 * gates between the galleries and the pillars flanking the two E arches.
 *
 *   form      a stack of `strata` beds on a rounded footprint (`width` × `depth`), each bed
 *             cut back by the wind according to its hardness, so the soft beds are recessed and
 *             the hard ones stand out as ledges; the pillar waists, leans a little and rounds
 *             off at the top, with vertical runnels where water ran down. Everything stays
 *             inside its footprint ellipse (the gates' colliders are exact).
 *   colour    terracotta, rose and ochre beds (the PDF's swatches) in the shader, from each
 *             vertex's bed coordinate, with fine sediment lines and a mottle; recessed beds are
 *             darkened (baked occlusion in the vertex colour). `palette` narrows the beds to one
 *             family.
 *   surface   the raw-clay normal map (materials.ts `rawClay`), in metres.
 *   source    a sourced rock or cliff scan (GRAND §5.4: `ph-namaqualand-cliff-01`,
 *             `ph-rock-face-01`) from config/sourcedRegistry.generated.ts, fitted into the same
 *             box and recoloured with the same strata. Without the file it is the procedural form.
 *
 * One mesh and one material per formation; geometry cached per shape and tier.
 *
 * The file also carries the installations' shared kit (exported): value noise, the strata
 * material and <SourcedOr/>, which draws a sourced model from the registry with a procedural
 * fallback while it loads or when it is missing.
 */
import { useGLTF } from '@react-three/drei'
import { Suspense, useMemo, type ReactNode } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { SOURCED_REGISTRY } from '../config/sourcedRegistry.generated'
import { injectAtmosphere } from '../lighting/atmosphere/inject'
import { cutOutTwigCards, foliageMaterial, foliageNormals, isLeaf } from '../materials/foliage'
import { useMaterials } from '../materials/materials'
import { makeTriplanar } from '../materials/triplanar'
import { TEXTURE_TILE_METRES } from '../materials/proceduralTextures'
import { useMuseum } from '../state/store'
import { ErrorBoundary } from '../utils/ErrorBoundary'
import { hashStr, rng } from './kit'
import { num, str, type ModelProps } from './types'

/* ------------------------------------------------------------------ */
/* Noise (deterministic value noise, 3D)                               */
/* ------------------------------------------------------------------ */

function h3(x: number, y: number, z: number, s: number) {
  let n = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(z | 0, 2147483647) ^ Math.imul(s | 0, 1274126177)
  n = Math.imul(n ^ (n >>> 13), 1274126177)
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296
}
const fade = (t: number) => t * t * (3 - 2 * t)

/** Smooth value noise in [−1, 1]. */
export function noise3(x: number, y: number, z: number, seed = 0): number {
  const xi = Math.floor(x)
  const yi = Math.floor(y)
  const zi = Math.floor(z)
  const u = fade(x - xi)
  const v = fade(y - yi)
  const w = fade(z - zi)
  const L = (a: number, b: number, t: number) => a + (b - a) * t
  const c = (dx: number, dy: number, dz: number) => h3(xi + dx, yi + dy, zi + dz, seed)
  const x00 = L(c(0, 0, 0), c(1, 0, 0), u)
  const x10 = L(c(0, 1, 0), c(1, 1, 0), u)
  const x01 = L(c(0, 0, 1), c(1, 0, 1), u)
  const x11 = L(c(0, 1, 1), c(1, 1, 1), u)
  return L(L(x00, x10, v), L(x01, x11, v), w) * 2 - 1
}

/** Fractal sum of `oct` octaves of noise3 (≈ [−1, 1]). */
export function fbm3(x: number, y: number, z: number, seed = 0, oct = 4): number {
  let a = 0.5
  let f = 1
  let s = 0
  let n = 0
  for (let i = 0; i < oct; i++) {
    s += a * noise3(x * f, y * f, z * f, seed + i * 17)
    n += a
    a *= 0.5
    f *= 2.03
  }
  return s / n
}

/* ------------------------------------------------------------------ */
/* Strata material                                                     */
/* ------------------------------------------------------------------ */

export type StrataPalette = 'mixed' | 'terracotta' | 'rose' | 'ochre'

/** Bed colours: the PDF's three swatches (#C96A58 terracotta, #E8968F rose, #E0A06A ochre) and their deeper and paler beds. */
const PALETTES: Record<StrataPalette, string[]> = {
  mixed: ['#c96a58', '#d9906a', '#e8968f', '#a9503f', '#d47e64', '#e9b39c'],
  terracotta: ['#c96a58', '#b65a46', '#d47c62', '#9e4a3a', '#cf7355', '#e09a7c'],
  rose: ['#e8968f', '#d9827a', '#efb0a4', '#c97068', '#f2c1b4', '#dc8c80'],
  ochre: ['#d99068', '#c97a55', '#e3a57e', '#b9684a', '#e8b48f', '#cf835e'],
}

const strataCache = new Map<string, THREE.MeshStandardMaterial>()

/**
 * The formations' material: bed colours from the per-vertex bed coordinate `aStrata`, sediment
 * lines, a mottle, the baked occlusion in the vertex colour and the raw-clay normal map. One
 * program for every formation (the palette and seed are uniforms).
 */
export function strataMaterial(rawClay: THREE.Material, palette: StrataPalette, seed: number, opts: { triplanar?: number; cutZ?: number } = {}): THREE.MeshStandardMaterial {
  const src = rawClay as THREE.MeshStandardMaterial
  const key = `${src.uuid}|${palette}|${seed}|${opts.triplanar ?? ''}|${opts.cutZ ?? ''}`
  const hit = strataCache.get(key)
  if (hit) return hit
  const pal = PALETTES[palette].map((c) => new THREE.Color(c))
  const uniforms = { uPal: { value: pal }, uSeed: { value: (seed % 97) + 0.37 }, uCutZ: { value: opts.cutZ ?? -1e6 } }
  const m = new THREE.MeshStandardMaterial({
    name: 'p3Strata',
    color: '#ffffff',
    vertexColors: true,
    normalMap: src.normalMap,
    normalScale: new THREE.Vector2(1.25, 1.25),
    roughnessMap: src.roughnessMap,
    roughness: 1,
    metalness: 0,
    envMapIntensity: 0.32,
  })
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms)
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aStrata;\nvarying float vStrata;\nvarying vec3 vObjPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvStrata = aStrata;\nvObjPos = position;')
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
uniform vec3 uPal[6];
uniform float uSeed;
uniform float uCutZ;
varying float vStrata;
varying vec3 vObjPos;
float p3h(float n) { return fract(sin(n * 12.9898 + uSeed * 78.233) * 43758.5453); }
float p3n(vec3 p) {
  vec3 i = floor(p); vec3 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  float n = i.x + i.y * 57.0 + i.z * 113.0;
  return mix(mix(mix(p3h(n), p3h(n + 1.0), f.x), mix(p3h(n + 57.0), p3h(n + 58.0), f.x), f.y),
             mix(mix(p3h(n + 113.0), p3h(n + 114.0), f.x), mix(p3h(n + 170.0), p3h(n + 171.0), f.x), f.y), f.z);
}
vec3 p3bed(float L) { return uPal[int(mod(floor(p3h(L) * 6.0), 6.0))]; }`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
// a scan sunk into a wall keeps only its front: the rest would show through the wall's far side
if (vObjPos.z < uCutZ) discard;
{
  float u = vStrata + (p3n(vObjPos * 2.3) - 0.5) * 0.12;
  float L = floor(u);
  float s = u - L;
  vec3 bed = mix(p3bed(L), p3bed(L + 1.0), smoothstep(0.82, 1.0, s));
  // fine sediment lines inside each bed, and a darker parting at the bed's base
  float lines = 0.93 + 0.07 * sin(u * 37.0 + p3n(vObjPos * 5.0) * 3.0);
  float parting = mix(0.78, 1.0, smoothstep(0.0, 0.06, s));
  float mottle = 0.86 + 0.28 * p3n(vObjPos * 7.5 + uSeed);
  diffuseColor.rgb *= bed * lines * parting * mottle;
}`,
      )
  }
  m.customProgramCacheKey = () => 'p3Strata'
  // a large scan samples the raw clay triplanar (its own UVs are a photo atlas's, not metres)
  if (opts.triplanar) makeTriplanar(m, opts.triplanar)
  // the light engine's terms (oculus mask, accent cones, coves) on top of the strata
  injectAtmosphere(m)
  strataCache.set(key, m)
  return m
}

/* ------------------------------------------------------------------ */
/* Procedural formation                                                */
/* ------------------------------------------------------------------ */

export interface FormationSpec {
  h: number
  w: number
  d: number
  seed: number
  strata: number
}

/**
 * The beds of a formation: `strata` beds of uneven thickness (a thin hard band, a thick soft one,
 * never a regular stack), as a map from height fraction t (0 … 1) to the bed coordinate u (bed
 * index + fraction). Shared by the procedural pillar and a sourced scan.
 */
export function bedMap(seed: number, strata: number): (t: number) => number {
  const r = rng(`beds|${seed}`)
  const thick = Array.from({ length: strata }, () => {
    const v = r()
    // mostly middling beds, now and then a thin band or a thick massive one
    return v < 0.18 ? 0.3 + r() * 0.3 : v > 0.82 ? 1.7 + r() * 0.9 : 0.7 + r() * 0.7
  })
  const sum = thick.reduce((a, b) => a + b, 0)
  const B = [0]
  for (const k of thick) B.push(B[B.length - 1] + k / sum)
  return (t: number) => {
    if (t <= 0) return t * strata
    if (t >= 1) return strata + (t - 1) * strata
    let L = 0
    while (L < strata - 1 && B[L + 1] <= t) L++
    return L + (t - B[L]) / (B[L + 1] - B[L])
  }
}

/**
 * The pillar as a deformed tube of `ny` rings × `ns` sides, capped. Attributes: position,
 * normal, uv (metres / the raw-clay tile), color (occlusion) and aStrata (bed coordinate).
 */
export function buildFormation(s: FormationSpec, ny: number, ns: number): THREE.BufferGeometry {
  const r = rng(`formation|${s.seed}`)
  const a = s.w / 2
  const b = s.d / 2
  const n = 2.6
  const ellipseR = (th: number) => 1 / Math.pow(Math.pow(Math.abs(Math.cos(th) / a), n) + Math.pow(Math.abs(Math.sin(th) / b), n), 1 / n)
  // the profile: a broad foot, a waist, bulges where the hard beds are thick, a rounded crown
  const bumps = Array.from({ length: 4 }, () => ({ c: 0.2 + r() * 0.6, s: 0.08 + r() * 0.12, a: (r() - 0.45) * 0.34 }))
  // a flat, wind-planed top (a mesa, not a dome): the crown rounds only its last few centimetres
  const crownT = 0.955 + r() * 0.02
  const profile = (t: number) => {
    let p = 0.94 - 0.1 * t + 0.08 * Math.exp(-t / 0.07)
    for (const k of bumps) p += k.a * 0.6 * Math.exp(-(((t - k.c) / k.s) ** 2))
    if (t > crownT) p *= Math.pow(Math.max(0, 1 - ((t - crownT) / (1 - crownT)) ** 2), 0.25)
    return Math.max(0, p)
  }
  const hard = Array.from({ length: s.strata + 3 }, () => r())
  const lean = [(r() - 0.5) * 0.5 * a, (r() - 0.5) * 0.5 * b]
  const grooveK = 3 + Math.floor(r() * 4)
  const sd = s.seed * 7 + 3
  const beds = bedMap(s.seed, s.strata)
  // each bed's scoop has its own shape (some cut low, some high, some barely): no stacked tyres
  const scoopQ = Array.from({ length: s.strata + 3 }, () => 0.45 + r() * 1.6)
  const scoopA = Array.from({ length: s.strata + 3 }, () => (r() < 0.25 ? 0.25 : 0.6 + r() * 0.6))
  // the beds dip across the pillar, and the wind cuts one side deeper (a sweeping undercut)
  const dip = [(r() - 0.5) * 0.09, (r() - 0.5) * 0.09]
  const wind = r() * Math.PI * 2

  const rows = ny + 1
  const cols = ns + 1
  const pos = new Float32Array((rows * cols + 1) * 3)
  const uv = new Float32Array((rows * cols + 1) * 2)
  const col = new Float32Array((rows * cols + 1) * 3)
  const bed = new Float32Array(rows * cols + 1)
  const tile = TEXTURE_TILE_METRES.rawClay
  const perim = Math.PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b)))
  for (let j = 0; j < rows; j++) {
    const t = j / ny
    const y = t * s.h
    const lt = Math.pow(t, 1.5)
    for (let i = 0; i < cols; i++) {
      const th = ((i % ns) / ns) * Math.PI * 2
      const cx = Math.cos(th)
      const cz = Math.sin(th)
      const re = ellipseR(th)
      // bed coordinate, warped round the pillar so the beds dip and pinch
      const warp = 0.05 * fbm3(cx * 0.9 + 3.1, y * 0.18, cz * 0.9, sd, 3)
      const u = beds(t + dip[0] * cx + dip[1] * cz + warp)
      const L = Math.floor(u)
      const f = u - L
      const Lc = Math.max(0, Math.min(scoopQ.length - 1, L + 1))
      const lee = Math.max(0, Math.cos(th - wind))
      // p05's wind-cut strata: soft beds scooped deep, hard beds left as ledges whose lip juts
      // out over the bed below (an overhang: the radius grows up the bed, then drops at its top)
      const hd = hard[Math.max(0, Math.min(hard.length - 1, L + 1))]
      const soft = 1 - hd
      const ledge = hd > 0.45 ? (hd - 0.45) * 0.42 * THREE.MathUtils.smoothstep(f, 0.35, 0.86) * (1 - THREE.MathUtils.smoothstep(f, 0.9, 0.985)) : 0
      const scoop = Math.pow(Math.sin(Math.PI * Math.pow(Math.min(1, Math.max(0, f)), scoopQ[Lc])), 0.6)
      const recess = soft * 0.26 * scoopA[Lc] * scoop + 0.05 * Math.pow(Math.max(0, 1 - f / 0.1), 2) - ledge
      // the sweeping undercut: the lower third pared back on the wind's side
      const undercut = 0.22 * lee * Math.exp(-(((t - 0.2) / 0.16) ** 2))
      const groove = 1 - 0.07 * Math.pow(Math.abs(Math.sin(th * grooveK + 2.2 * fbm3(cx, y * 0.3, cz, sd + 5, 2))), 6)
      const px = cx * re
      const pz = cz * re
      const nse = fbm3(px * 1.1, y * 0.55, pz * 1.1, sd + 11, 4) * 0.13 + noise3(px * 4.2, y * 3.1, pz * 4.2, sd + 23) * 0.03
      const rad = re * profile(t) * (1 - recess - undercut) * groove * (1 + nse)
      let x = lean[0] * lt + cx * rad
      let z = lean[1] * lt + cz * rad
      // never outside the footprint ellipse
      const e = Math.pow(Math.pow(Math.abs(x / a), n) + Math.pow(Math.abs(z / b), n), 1 / n)
      if (e > 0.985) {
        x *= 0.985 / e
        z *= 0.985 / e
      }
      const k = j * cols + i
      pos[k * 3] = x
      pos[k * 3 + 1] = y
      pos[k * 3 + 2] = z
      uv[k * 2] = ((i / ns) * perim) / tile
      uv[k * 2 + 1] = y / tile
      // the undercut beneath each ledge sits in shadow; the ledge's top catches the light
      const ao = Math.max(0.38, Math.min(1.08, 1 - Math.max(0, recess) * 2.0 + ledge * 0.6 - 0.25 * Math.exp(-y / 0.35)))
      col[k * 3] = col[k * 3 + 1] = col[k * 3 + 2] = ao
      bed[k] = u
    }
  }
  // the crown's apex
  const top = rows * cols
  pos[top * 3] = lean[0]
  pos[top * 3 + 1] = s.h
  pos[top * 3 + 2] = lean[1]
  col[top * 3] = col[top * 3 + 1] = col[top * 3 + 2] = 1
  bed[top] = s.strata
  const idx: number[] = []
  for (let j = 0; j < ny; j++)
    for (let i = 0; i < ns; i++) {
      const p = j * cols + i
      const q = p + cols
      idx.push(p, q, p + 1, p + 1, q, q + 1)
    }
  for (let i = 0; i < ns; i++) idx.push(ny * cols + i, top, ny * cols + i + 1)
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  g.setAttribute('color', new THREE.BufferAttribute(col, 3))
  g.setAttribute('aStrata', new THREE.BufferAttribute(bed, 1))
  g.setIndex(idx)
  g.computeVertexNormals()
  // the seam column is duplicated (for the uv): give both copies the averaged normal
  const nor = g.getAttribute('normal') as THREE.BufferAttribute
  for (let j = 0; j < rows; j++) {
    const p0 = j * cols
    const p1 = j * cols + ns
    const v = new THREE.Vector3(nor.getX(p0) + nor.getX(p1), nor.getY(p0) + nor.getY(p1), nor.getZ(p0) + nor.getZ(p1)).normalize()
    nor.setXYZ(p0, v.x, v.y, v.z)
    nor.setXYZ(p1, v.x, v.y, v.z)
  }
  g.computeBoundingBox()
  g.computeBoundingSphere()
  return g
}

const formationCache = new Map<string, THREE.BufferGeometry>()

/** Rings / sides per tier: the beds need about ten rings a metre on the upper tiers. */
function resolution(tier: string, h: number): [number, number] {
  const perM = tier === 'low' ? 5 : tier === 'medium' ? 8 : 11
  const sides = tier === 'low' ? 26 : tier === 'medium' ? 38 : 52
  return [Math.max(16, Math.min(96, Math.round(h * perM))), sides]
}

function formationGeometry(spec: FormationSpec, tier: string) {
  const [ny, ns] = resolution(tier, spec.h)
  const key = `${spec.h}|${spec.w}|${spec.d}|${spec.seed}|${spec.strata}|${ny}|${ns}`
  let g = formationCache.get(key)
  if (!g) {
    g = buildFormation(spec, ny, ns)
    formationCache.set(key, g)
  }
  return g
}

/* ------------------------------------------------------------------ */
/* Sourced models (GRAND §5): registry → GLB, with a fallback          */
/* ------------------------------------------------------------------ */

/** Is this slug in the generated registry (its optimised file exists)? */
export const sourcedEntry = (slug: string | undefined) => (slug ? SOURCED_REGISTRY[slug] : undefined)

/**
 * The registry slug for `slug` or one of its variants (`<slug>-b`, `<slug>-2`, …): a list may
 * name a multi-variant source by its base slug, and `nth` cycles through the base and its variants.
 */
export function resolveSlug(slug: string | undefined, nth = 0): string | undefined {
  if (!slug) return undefined
  const variants = Object.keys(SOURCED_REGISTRY)
    .filter((k) => k.startsWith(`${slug}-`) && /^[a-z0-9]{1,2}$/.test(k.slice(slug.length + 1)))
    .sort()
  const all = [...(SOURCED_REGISTRY[slug] ? [slug] : []), ...variants]
  return all.length ? all[nth % all.length] : undefined
}

const mergedSourced = new Map<string, THREE.BufferGeometry[] & { materials?: THREE.Material[] }>()
const leafMats = new Map<THREE.Material, THREE.Material>()

/** All meshes of a loaded GLB baked into one geometry per material (cached per url). */
function bakeScene(url: string, scene: THREE.Object3D): { geometry: THREE.BufferGeometry; material: THREE.Material }[] {
  const hit = mergedSourced.get(url)
  if (hit?.materials) return hit.map((geometry, i) => ({ geometry, material: hit.materials![i] }))
  scene.updateMatrixWorld(true)
  const groups = new Map<THREE.Material, THREE.BufferGeometry[]>()
  scene.traverse((o) => {
    const mesh = o as THREE.Mesh
    if (!mesh.isMesh) return
    const src = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material
    // leaf cards: a cut-out canopy lit as one mass (materials/foliage.ts), one material per source
    const leaf = isLeaf(src)
    let mat: THREE.Material
    if (leaf) {
      mat = leafMats.get(src) ?? foliageMaterial(src, 1.3, 0.42)
      leafMats.set(src, mat)
    } else if (!leafMats.has(src)) {
      // twig cards authored opaque: cut out by their texture's alpha (a clone, the GLB's own stays)
      const c = src.clone()
      mat = cutOutTwigCards(c) ? c : src
      if (mat !== src) leafMats.set(src, mat)
      else c.dispose()
    } else mat = leafMats.get(src)!
    let g = mesh.geometry.clone()
    // a scan whose material reads vertex colours keeps them: without the attribute WebGL feeds
    // the shader black, and the rock renders as a hole in the ground
    const keep = (mat as THREE.MeshStandardMaterial).vertexColors ? ['position', 'normal', 'uv', 'color'] : ['position', 'normal', 'uv']
    for (const [name, attr] of Object.entries(g.attributes)) {
      if (!keep.includes(name)) {
        g.deleteAttribute(name)
        continue
      }
      if (!(attr.array instanceof Float32Array) || (attr as THREE.InterleavedBufferAttribute).isInterleavedBufferAttribute) {
        const out = new Float32Array(attr.count * attr.itemSize)
        for (let i = 0; i < attr.count; i++) for (let k = 0; k < attr.itemSize; k++) out[i * attr.itemSize + k] = attr.getComponent(i, k)
        g.setAttribute(name, new THREE.BufferAttribute(out, attr.itemSize))
      }
    }
    if (!g.getAttribute('uv')) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.getAttribute('position').count * 2), 2))
    if (!g.getAttribute('normal')) g.computeVertexNormals()
    if (keep.length === 4 && !g.getAttribute('color')) g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(g.getAttribute('position').count * 3).fill(1), 3))
    g.applyMatrix4(mesh.matrixWorld)
    if (leaf) {
      const f = foliageNormals(g)
      g.dispose()
      g = f
    }
    const list = groups.get(mat) ?? []
    list.push(g.index ? g : g)
    groups.set(mat, list)
  })
  const geos: THREE.BufferGeometry[] & { materials?: THREE.Material[] } = []
  const mats: THREE.Material[] = []
  for (const [mat, list] of groups) {
    const indexed = list.every((g) => !!g.index)
    const norm = list.map((g) => (indexed ? g : g.index ? g.toNonIndexed() : g))
    const m = norm.length === 1 ? norm[0] : mergeGeometries(norm, false)
    if (!m) continue
    geos.push(m)
    mats.push(mat)
  }
  geos.materials = mats
  mergedSourced.set(url, geos)
  return geos.map((geometry, i) => ({ geometry, material: mats[i] }))
}

export interface SourcedFit {
  /** Target box (m): the model is scaled to it, base at y 0, centred. Omitted axes keep the uniform scale of `h`. */
  w?: number
  h: number
  d?: number
  /** Recolour every part with this material (e.g. the strata). */
  material?: THREE.Material
  /** Called with the fitted geometry (to add attributes such as aStrata), once per url and fit. */
  prepare?: (g: THREE.BufferGeometry) => void
  castShadow?: boolean
}

const fittedCache = new Map<string, { geometry: THREE.BufferGeometry; material: THREE.Material }[]>()

function SourcedInner({ url, fit, fitKey }: { url: string; fit: SourcedFit; fitKey: string }) {
  const gltf = useGLTF(url)
  const parts = useMemo(() => {
    const key = `${url}|${fitKey}`
    const hit = fittedCache.get(key)
    if (hit) return hit
    const baked = bakeScene(url, gltf.scene)
    const box = new THREE.Box3()
    for (const p of baked) {
      p.geometry.computeBoundingBox()
      box.union(p.geometry.boundingBox!)
    }
    const size = box.getSize(new THREE.Vector3())
    const sy = fit.h / Math.max(1e-3, size.y)
    const sx = fit.w ? fit.w / Math.max(1e-3, size.x) : sy
    const sz = fit.d ? fit.d / Math.max(1e-3, size.z) : sy
    const c = box.getCenter(new THREE.Vector3())
    const mtx = new THREE.Matrix4().makeScale(sx, sy, sz).multiply(new THREE.Matrix4().makeTranslation(-c.x, -box.min.y, -c.z))
    const out = baked.map((p) => {
      const g = p.geometry.clone().applyMatrix4(mtx)
      g.computeBoundingBox()
      g.computeBoundingSphere()
      fit.prepare?.(g)
      return { geometry: g, material: fit.material ?? p.material }
    })
    fittedCache.set(key, out)
    return out
  }, [url, gltf.scene, fit, fitKey])
  return (
    <>
      {parts.map((p, i) => (
        <mesh key={i} geometry={p.geometry} material={p.material} castShadow={fit.castShadow !== false} receiveShadow />
      ))}
    </>
  )
}

/**
 * A sourced model from the registry (its LOD1 on Low), fitted into `fit`; `fallback` while it
 * loads, when the slug is not in the registry, or when the file fails.
 */
export function SourcedOr({ slug, fit, fallback }: { slug: string | undefined; fit: SourcedFit; fallback: ReactNode }) {
  const tier = useMuseum((s) => s.tier)
  const entry = sourcedEntry(slug)
  if (!entry) return <>{fallback}</>
  const url = tier === 'low' && entry.lod1 ? entry.lod1 : entry.url
  const fitKey = `${fit.w ?? ''}|${fit.h}|${fit.d ?? ''}|${fit.material?.uuid ?? ''}`
  return (
    <ErrorBoundary key={url} fallback={fallback}>
      <Suspense fallback={fallback}>
        <SourcedInner url={url} fit={fit} fitKey={fitKey} />
      </Suspense>
    </ErrorBoundary>
  )
}

/** One placement of an instanced sourced model: floor point, yaw (rad) and target height (m). */
export interface InstanceSpot {
  p: [number, number, number]
  rotY: number
  h: number
  /** Optional squash of the width (1 = the model's own proportions). */
  sx?: number
}

const unitCache = new Map<string, { geometry: THREE.BufferGeometry; material: THREE.Material }[]>()

function InstancesInner({ url, spots, material, castShadow }: { url: string; spots: InstanceSpot[]; material?: THREE.Material; castShadow: boolean }) {
  const gltf = useGLTF(url)
  const parts = useMemo(() => {
    const key = `${url}|unit`
    let hit = unitCache.get(key)
    if (!hit) {
      const baked = bakeScene(url, gltf.scene)
      const box = new THREE.Box3()
      for (const p of baked) {
        p.geometry.computeBoundingBox()
        box.union(p.geometry.boundingBox!)
      }
      const size = box.getSize(new THREE.Vector3())
      const k = 1 / Math.max(1e-3, size.y)
      const c = box.getCenter(new THREE.Vector3())
      const mtx = new THREE.Matrix4().makeScale(k, k, k).multiply(new THREE.Matrix4().makeTranslation(-c.x, -box.min.y, -c.z))
      hit = baked.map((p) => {
        const g = p.geometry.clone().applyMatrix4(mtx)
        g.computeBoundingSphere()
        return { geometry: g, material: p.material }
      })
      unitCache.set(key, hit)
    }
    return hit
  }, [url, gltf.scene])
  const matrices = useMemo(() => {
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const up = new THREE.Vector3(0, 1, 0)
    return spots.map((s) => m.compose(new THREE.Vector3(...s.p), q.setFromAxisAngle(up, s.rotY), new THREE.Vector3(s.h * (s.sx ?? 1), s.h, s.h * (s.sx ?? 1))).clone())
  }, [spots])
  return (
    <>
      {parts.map((p, i) => (
        <instancedMesh
          key={`${i}-${spots.length}`}
          args={[p.geometry, material ?? p.material, spots.length]}
          castShadow={castShadow}
          receiveShadow
          ref={(mesh) => {
            if (!mesh) return
            matrices.forEach((m, j) => mesh.setMatrixAt(j, m))
            mesh.instanceMatrix.needsUpdate = true
            mesh.computeBoundingSphere()
          }}
        />
      ))}
    </>
  )
}

/**
 * Many placements of one sourced model as instanced meshes (one draw per material part): trees,
 * shrubs, rocks. The model is scaled so its height is 1, then by each spot's `h`. `fallback`
 * while it loads, when the slug is missing or the file fails.
 */
export function SourcedInstances({ slug, spots, fallback, material, castShadow = true }: { slug: string | undefined; spots: InstanceSpot[]; fallback: ReactNode; material?: THREE.Material; castShadow?: boolean }) {
  const tier = useMuseum((s) => s.tier)
  const entry = sourcedEntry(slug)
  if (!entry || spots.length === 0) return <>{fallback}</>
  const url = tier === 'low' && entry.lod1 ? entry.lod1 : entry.url
  return (
    <ErrorBoundary key={url} fallback={fallback}>
      <Suspense fallback={fallback}>
        <InstancesInner url={url} spots={spots} material={material} castShadow={castShadow} />
      </Suspense>
    </ErrorBoundary>
  )
}

/* ------------------------------------------------------------------ */
/* the kind                                                            */
/* ------------------------------------------------------------------ */

const PALETTE_IDS: StrataPalette[] = ['mixed', 'terracotta', 'rose', 'ochre']

export function ErodedFormation({ config }: ModelProps) {
  const core = useMaterials()
  const tier = useMuseum((s) => s.tier)
  const h = Math.max(0.5, num(config, 'height', config.height ?? 6))
  const w = Math.max(0.3, num(config, 'width', config.footprint?.[0] ?? 2.4))
  const d = Math.max(0.3, num(config, 'depth', config.footprint?.[1] ?? 1.4))
  const seed = Math.round(num(config, 'seed', 1))
  const strata = Math.max(1, Math.min(20, Math.round(num(config, 'strata', 7))))
  const palRaw = str(config, 'palette', 'mixed')
  const palette = (PALETTE_IDS as string[]).includes(palRaw) ? (palRaw as StrataPalette) : 'mixed'
  const source = resolveSlug(str(config, 'source', '') || undefined, seed)
  // a scan scaled uniformly by its height (never stretched into the box), and kept only in front
  // of `keepFront` metres of its depth when it is sunk into a wall
  const uniform = config.props?.uniform === true
  const keepFront = num(config, 'keepFront', 0)
  const entry = sourcedEntry(source)
  const scanDepth = entry ? ((entry.bbox[5] - entry.bbox[2]) * h) / Math.max(1e-3, entry.bbox[4] - entry.bbox[1]) : d
  const cutZ = uniform && keepFront > 0 ? scanDepth / 2 - keepFront : undefined
  // a scan's own UVs are a photo atlas's, and a procedural pillar's run round its cross-section by
  // angle (stretched where the erosion cuts deep, the streaks seen up close): every formation
  // samples the raw clay triplanar, in metres
  const scanned = !!entry
  const mat = useMemo(
    () => strataMaterial(core.rawClay, palette, seed + hashStr(config.id) % 13, scanned ? { triplanar: 1.4, cutZ } : { triplanar: 1.4 }),
    [core.rawClay, palette, seed, config.id, scanned, cutZ],
  )
  const geo = useMemo(() => formationGeometry({ h, w, d, seed, strata }, tier), [h, w, d, seed, strata, tier])
  // a sourced scan takes the same beds: its bed coordinate is its height in the pillar
  const fit = useMemo<SourcedFit>(
    () => ({
      w: uniform ? undefined : w * 0.98,
      h,
      d: uniform ? undefined : d * 0.98,
      material: mat,
      // a scan sunk into a wall casts no shadow (its hidden back would shade the outside)
      castShadow: !(uniform && keepFront > 0),
      prepare: (g) => {
        const p = g.getAttribute('position')
        const bed = new Float32Array(p.count)
        const col = new Float32Array(p.count * 3)
        const beds = bedMap(seed, strata)
        for (let i = 0; i < p.count; i++) {
          bed[i] = beds(p.getY(i) / h)
          col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = Math.min(1, 0.62 + p.getY(i) * 0.4)
        }
        g.setAttribute('aStrata', new THREE.BufferAttribute(bed, 1))
        g.setAttribute('color', new THREE.BufferAttribute(col, 3))
      },
    }),
    [w, h, d, mat, strata, seed, uniform, keepFront],
  )
  const procedural = <mesh geometry={geo} material={mat} castShadow receiveShadow />
  return <SourcedOr slug={source} fit={fit} fallback={procedural} />
}
