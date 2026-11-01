/**
 * RAW CLAY FIELDS (PDF p05: "highlighting the raw clay texture patches gives a true essence of
 * the raw materials"; GRAND §3 #25): twelve fields of raw clay, 2–5 m across, thrown onto the
 * walls where no work hangs and left as they dried — lumpy, pinched at the edges, crazed into
 * shrinkage cracks. They are real relief, not decals, so raking light (the Earth Room's beam,
 * the sconces, low sun on the facade) models them.
 *
 *   where     the Earth Room's long walls (3; the east wall's mouth half is the cliff) and its end
 *             wall either side of the portal (2),
 *             the west ambulatory's lobe wall (2), the drum's outer face in the Parikrama's middle
 *             garden (1) and the Sphere Well's round room (2). Never on the entrance facade, and
 *             not in gallery C, where black clay on the charcoal wall read as a hole.
 *   form      flush with the plaster: a field with a ragged, torn edge (never an oval decal),
 *             raised 1–2 cm by handfuls of lumps and the drag of a palm, falling to nothing at the
 *             edge; the shrinkage cracks (5–10 cm cells, curled plate edges) are a tiling crack
 *             map — colour and normal — so they stay crisp at any distance
 *   colour    within a tenth of the host wall's own hue (the raw clay the plaster was made of),
 *             pale on the lumps, dark in the cracks; the edge melts into the wall's tone
 *
 * One merged mesh per culling group (per zone set); geometry per tier, built once.
 */
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import type { ZoneId } from '../config/layout'
import { DEG, KEY, MUSEUM } from '../config/museum'
import { SPHERE_WELL } from '../config/satellites'
import { injectAtmosphere } from '../lighting/atmosphere/inject'
import { useMaterials } from '../materials/materials'
import { fbm3, noise3 } from '../models/erodedFormation'
import { rng } from '../models/kit'
import { ZoneGroup } from '../navigation/zoneCulling'
import { useMuseum } from '../state/store'

type Tone = 'terracotta' | 'clayWarm' | 'clayRose' | 'red' | 'earth'

/** Each field's raw clay, within a tenth of its host wall's own finish (materials.ts LIB). */
const TONES: Record<Tone, string> = {
  terracotta: '#b06a56',
  clayWarm: '#b7735a',
  clayRose: '#b46760',
  red: '#962c22',
  earth: '#bb7a60',
}

/** A host wall: a plane (origin, outward normal; `s` runs along +tangent) or an arc about (cx, cz). */
type Host = { kind: 'plane'; x: number; z: number; nx: number; nz: number } | { kind: 'arc'; cx: number; cz: number; r: number; side: 'in' | 'out'; aDeg: number }

interface Field {
  host: Host
  /** Centre height above the host's floor (m), width along the wall and height. */
  y: number
  w: number
  h: number
  tone: Tone
  /** The host's floor level (world y). */
  floor?: number
}

const AN = MUSEUM.annex
const SW = SPHERE_WELL
/** Middle of the annex's end wall either side of the portal. */
const endMidX = (KEY.doorHalf + KEY.annexHalf) / 2
/** The fields on terracotta walls stay below the band, where the wall is terracotta. */
const BAND = MUSEUM.pavilion.mezzanineBand

const GROUPS: { zones: ZoneId[]; fields: Field[] }[] = [
  {
    // the Earth Room: its long walls behind the shelves and formations, and either side of the portal
    zones: ['annex', 'entry-e', 'entrance-court'],
    fields: [
      { host: { kind: 'plane', x: KEY.annexHalf, z: AN.endZ - 3.4, nx: -1, nz: 0 }, y: BAND * 0.48, w: 3.4, h: BAND * 0.8, tone: 'terracotta' },
      { host: { kind: 'plane', x: -KEY.annexHalf, z: KEY.annexMouthZ + 4.4, nx: 1, nz: 0 }, y: BAND * 0.5, w: 4.0, h: BAND * 0.84, tone: 'clayRose' },
      { host: { kind: 'plane', x: -KEY.annexHalf, z: AN.endZ - 3.0, nx: 1, nz: 0 }, y: BAND * 0.5, w: 3.2, h: BAND * 0.82, tone: 'clayWarm' },
      { host: { kind: 'plane', x: endMidX, z: AN.endZ, nx: 0, nz: -1 }, y: BAND * 0.46, w: 2.2, h: BAND * 0.76, tone: 'terracotta' },
      { host: { kind: 'plane', x: -endMidX, z: AN.endZ, nx: 0, nz: -1 }, y: BAND * 0.5, w: 2.2, h: BAND * 0.8, tone: 'clayWarm' },
    ],
  },
  {
    // the west ambulatory's lobe wall
    zones: ['entry-e', 'annex', 'hallway-d'],
    fields: [
      { host: { kind: 'arc', cx: 0, cz: 0, r: KEY.lobeR, side: 'in', aDeg: 108 }, y: 2.2, w: 3.4, h: 3.6, tone: 'terracotta' },
      { host: { kind: 'arc', cx: 0, cz: 0, r: KEY.lobeR, side: 'in', aDeg: 136 }, y: 2.0, w: 2.8, h: 3.2, tone: 'clayRose' },
    ],
  },
  {
    // the drum's outer face behind the horses in the Parikrama's middle garden
    zones: ['parikrama-east', 'parikrama-west'],
    fields: [{ host: { kind: 'arc', cx: 0, cz: 0, r: KEY.ringOuterR, side: 'out', aDeg: -31 }, y: 2.0, w: 4.6, h: 2.8, tone: 'earth' }],
  },
  {
    // the Sphere Well's round room
    zones: ['entrance-court'],
    fields: [
      { host: { kind: 'arc', cx: SW.cx, cz: SW.cz, r: SW.roomR, side: 'in', aDeg: 25 }, y: 2.4, w: 4.4, h: 3.6, tone: 'red', floor: SW.floorY },
      { host: { kind: 'arc', cx: SW.cx, cz: SW.cz, r: SW.roomR, side: 'in', aDeg: 205 }, y: 2.6, w: 4.0, h: 3.8, tone: 'red', floor: SW.floorY },
    ],
  },
]

/* ------------------------------------------------------------------ */
/* The crack map: a tiling Voronoi of shrinkage plates (5–10 cm)        */
/* ------------------------------------------------------------------ */

/** The crack map's tile (m) and its cells across: ~7.5 cm plates. */
const CRACK_TILE = 0.6
const CRACK_CELLS = 8

let crackMaps: { map: THREE.Texture; normal: THREE.Texture; size: number } | null = null

/** Colour (plates pale, cracks dark) and normal (plates curl up at their edges, cracks cut in) maps. */
function getCrackMaps(size: number) {
  if (crackMaps && crackMaps.size === size) return crackMaps
  const N = CRACK_CELLS
  const r = rng('clay-crack-map')
  const pts = Array.from({ length: N * N }, (_, i) => ({ x: (i % N) + 0.12 + r() * 0.76, y: Math.floor(i / N) + 0.12 + r() * 0.76, v: 0.86 + r() * 0.2 }))
  const height = new Float32Array(size * size)
  const tone = new Float32Array(size * size)
  const crackW = 0.055 // in cell units (~4 mm)
  for (let py = 0; py < size; py++)
    for (let px = 0; px < size; px++) {
      const x = ((px + 0.5) / size) * N
      const y = ((py + 0.5) / size) * N
      const xi = Math.floor(x)
      const yi = Math.floor(y)
      let f1 = 9
      let f2 = 9
      let near = 0
      for (let j = -1; j <= 1; j++)
        for (let i = -1; i <= 1; i++) {
          const cx = (xi + i + N) % N
          const cy = (yi + j + N) % N
          const p = pts[cy * N + cx]
          const d = Math.hypot(p.x + (xi + i - cx) - x, p.y + (yi + j - cy) - y)
          if (d < f1) {
            f2 = f1
            f1 = d
            near = cy * N + cx
          } else if (d < f2) f2 = d
        }
      const e = (f2 - f1) / 2 // distance to the crack (cell units)
      const crack = 1 - THREE.MathUtils.smoothstep(e, crackW * 0.4, crackW)
      // the plate's edge curls up as it shrinks, its middle sags a little
      const curl = Math.exp(-Math.pow((e - crackW * 1.6) / (crackW * 1.4), 2))
      const k = py * size + px
      height[k] = (1 - crack) * (0.55 + 0.3 * curl - 0.12 * f1)
      tone[k] = pts[near].v * (1 - 0.62 * crack) * (0.96 + 0.08 * curl)
    }
  const col = new Uint8Array(size * size * 4)
  const nor = new Uint8Array(size * size * 4)
  const strength = size / 64
  for (let py = 0; py < size; py++)
    for (let px = 0; px < size; px++) {
      const k = py * size + px
      const hx = height[py * size + ((px + 1) % size)] - height[py * size + ((px - 1 + size) % size)]
      const hy = height[((py + 1) % size) * size + px] - height[((py - 1 + size) % size) * size + px]
      const nx = -hx * strength
      const ny = -hy * strength
      const l = Math.hypot(nx, ny, 1)
      nor.set([Math.round((nx / l / 2 + 0.5) * 255), Math.round((ny / l / 2 + 0.5) * 255), Math.round((1 / l / 2 + 0.5) * 255), 255], k * 4)
      const t = Math.round(THREE.MathUtils.clamp(tone[k], 0, 1) * 255)
      col.set([t, t, t, 255], k * 4)
    }
  const make = (data: Uint8Array, srgb: boolean) => {
    const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat)
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.repeat.set(1 / CRACK_TILE, 1 / CRACK_TILE)
    t.magFilter = THREE.LinearFilter
    t.minFilter = THREE.LinearMipmapLinearFilter
    t.generateMipmaps = true
    t.anisotropy = 8
    if (srgb) t.colorSpace = THREE.SRGBColorSpace
    t.needsUpdate = true
    return t
  }
  crackMaps = { map: make(col, true), normal: make(nor, false), size }
  return crackMaps
}

/**
 * One field's mesh in world space: position, normal (computed), uv (metres) and colour.
 *
 * A fine grid over the field's box with a ragged outline (a squarish thrown field whose edge was
 * torn back, not an oval): inside, lumps and the drag of a palm lift it up to ~1.5 cm; towards the
 * edge it falls flush into the plaster and fades out through a noisy alpha mask (vertex alpha), so
 * the outline is a soft torn edge rather than the stepped edge of trimmed grid cells. Cells wholly
 * outside the mask are dropped.
 */
function fieldGeometry(f: Field, seed: number, cell: number): THREE.BufferGeometry {
  const r = rng(`clayfield|${seed}`)
  const base = new THREE.Color(TONES[f.tone])
  const floor = f.floor ?? 0
  // the outline: a superellipse (squarish) whose radius is torn by noise at three scales
  const rim = (ang: number) => {
    const c = Math.cos(ang)
    const sn = Math.sin(ang)
    const p = 3.2
    const sq = Math.pow(Math.pow(Math.abs(c), p) + Math.pow(Math.abs(sn), p), -1 / p)
    return sq * (0.86 + 0.1 * fbm3(c * 1.4 + seed, sn * 1.4, seed * 0.3, seed, 3) + 0.05 * fbm3(c * 7, sn * 7, seed + 2, seed, 2) + 0.025 * noise3(c * 23, sn * 23, seed, seed + 9))
  }
  const place = (s: number, t: number, out: number): [number, number, number] => {
    const H = f.host
    const y = floor + f.y + t
    if (H.kind === 'plane') {
      // tangent: the normal turned a quarter (the visitor facing the wall has +s to the right)
      const tx = H.nz
      const tz = -H.nx
      return [H.x + tx * s + H.nx * out, y, H.z + tz * s + H.nz * out]
    }
    // +s to the visitor's right, `out` towards the visitor (into the room for an inside face)
    const along = H.side === 'in' ? 1 : -1
    const a = H.aDeg * DEG + (along * s) / H.r
    const rr = H.r - along * out
    return [H.cx + Math.cos(a) * rr, y, H.cz + Math.sin(a) * rr]
  }
  // the palm's drag: one direction per field
  const dragA = r() * Math.PI
  const dc = Math.cos(dragA)
  const ds = Math.sin(dragA)
  const nu = Math.max(8, Math.round(f.w / cell))
  const nv = Math.max(8, Math.round(f.h / cell))
  const pos: number[] = []
  const uv: number[] = []
  const col: number[] = []
  const alpha: number[] = []
  for (let j = 0; j <= nv; j++)
    for (let i = 0; i <= nu; i++) {
      const u = (i / nu) * 2 - 1
      const v = (j / nv) * 2 - 1
      const rho = Math.hypot(u, v) / Math.max(1e-6, rim(Math.atan2(v, u)))
      const s = (u * f.w) / 2
      const t = (v * f.h) / 2
      // the torn edge: a soft band ~25 cm wide, broken up by fine noise so it frays, never steps
      const fray = 0.07 * fbm3(s * 6.5, t * 6.5, seed + 13, seed, 3)
      const a = THREE.MathUtils.smoothstep(1 - rho + fray, 0, 0.2)
      alpha.push(a)
      // 1 inside, falling to 0 (flush, the wall's own tone) at the torn edge
      const edge = THREE.MathUtils.smoothstep(1 - rho, 0, 0.16)
      const lump = Math.max(0, fbm3(s * 2.2, t * 2.2, seed * 0.37, seed + 3, 4)) * 0.011
      const drag = fbm3((s * dc + t * ds) * 1.1, (t * dc - s * ds) * 12, seed + 7, seed, 3) * 0.003
      const out = 0.003 + edge * (0.004 + lump + drag)
      pos.push(...place(s, t, out))
      uv.push(s + seed * 0.37, t + seed * 0.71)
      const shade = THREE.MathUtils.lerp(1, 0.9 + 9 * lump + 20 * drag, edge)
      col.push(base.r * shade, base.g * shade, base.b * shade, a)
    }
  const idx: number[] = []
  const at = (i: number, j: number) => j * (nu + 1) + i
  for (let j = 0; j < nv; j++)
    for (let i = 0; i < nu; i++) {
      const a = at(i, j)
      const b = at(i + 1, j)
      const c = at(i, j + 1)
      const d = at(i + 1, j + 1)
      if (alpha[a] + alpha[b] + alpha[c] + alpha[d] <= 0) continue
      // CCW seen from the visitor (s right, t up, out towards the viewer)
      idx.push(a, b, d, a, d, c)
    }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 4))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

function mergeFields(list: THREE.BufferGeometry[]): THREE.BufferGeometry {
  // indexed merge: the grids are fine, so shared vertices matter
  let n = 0
  let ni = 0
  for (const g of list) {
    n += g.getAttribute('position').count
    ni += g.getIndex()!.count
  }
  const out = new THREE.BufferGeometry()
  for (const [name, size] of [['position', 3], ['normal', 3], ['uv', 2], ['color', 4]] as const) {
    const arr = new Float32Array(n * size)
    let o = 0
    for (const g of list) {
      arr.set(g.getAttribute(name).array as Float32Array, o * size)
      o += g.getAttribute('position').count
    }
    out.setAttribute(name, new THREE.BufferAttribute(arr, size))
  }
  const index = new Uint32Array(ni)
  let o = 0
  let base = 0
  for (const g of list) {
    const src = g.getIndex()!.array
    for (let k = 0; k < src.length; k++) index[o + k] = src[k] + base
    o += src.length
    base += g.getAttribute('position').count
  }
  out.setIndex(new THREE.BufferAttribute(index, 1))
  list.forEach((g) => g.dispose())
  out.computeBoundingSphere()
  return out
}

const matCache = new Map<string, THREE.MeshStandardMaterial>()

export function RawClayPatches() {
  const core = useMaterials()
  const tier = useMuseum((s) => s.tier)
  // twice the vertex density of the first cut (cell / √2), so the soft edge and the lumps stay smooth
  const cell = tier === 'low' ? 0.085 : tier === 'medium' ? 0.057 : 0.042
  const groups = useMemo(() => {
    let seed = 11
    return GROUPS.map((g) => ({ zones: g.zones, geometry: mergeFields(g.fields.map((f) => fieldGeometry(f, seed++, cell))) }))
  }, [cell])
  useEffect(() => () => groups.forEach((g) => g.geometry.dispose()), [groups])
  const mat = useMemo(() => {
    const size = tier === 'low' ? 256 : 512
    const key = `${core.rawClay.uuid}|${size}`
    let m = matCache.get(key)
    if (!m) {
      const maps = getCrackMaps(size)
      const src = core.rawClay as THREE.MeshStandardMaterial
      m = new THREE.MeshStandardMaterial({ name: 'rawClayField', color: '#ffffff', vertexColors: true, map: maps.map, normalMap: maps.normal, normalScale: new THREE.Vector2(1.6, 1.6), roughnessMap: src.roughnessMap, roughness: 1, metalness: 0, envMapIntensity: 0.3, transparent: true, depthWrite: false })
      injectAtmosphere(m, { coves: true })
      matCache.set(key, m)
    }
    return m
  }, [core.rawClay, tier])
  return (
    <group name="raw-clay-fields">
      {groups.map((g, i) => (
        <ZoneGroup key={i} zones={g.zones}>
          <mesh geometry={g.geometry} material={mat} receiveShadow renderOrder={1} raycast={() => null} />
        </ZoneGroup>
      ))}
    </group>
  )
}
