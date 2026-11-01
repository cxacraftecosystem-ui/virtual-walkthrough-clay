/**
 * The landscape round the pavilion's site (GRAND §2.7): the approach, the forecourt's frame and
 * the land the dome rises out of, seen from the forecourt, through the door, from the Parikrama
 * and the Sky Rim, and from the arrival flight. Planted in layers, as a garden is, so the site
 * reads as lush, cared-for land and never a desert:
 *
 *   avenue ....... jacaranda (Poly Haven, CC0) in pairs either side of the forecourt, their
 *                  violet crowns framing the walk to the door (LOD1, LOD0 on Ultra; shadowed)
 *   near belt .... broadleaf trees (Poly Haven Island Tree 02 and Tree Small 02) in loose groves
 *                  round the plinth, rising over the crescents' berm, Searsia as their understorey
 *   mid belt ..... the same broadleaves in groves out over the meadow (impostors, with the far belt)
 *   far belt ..... impostors of the broadleaves and the jacaranda (architecture/treeImpostors.tsx)
 *                  massed into woods along the rolling terrain ring
 *   border ....... a planted hem of low shrubs round the plinth's edge, so the clay paving ends in
 *                  green, never in a bare slab edge; beds along the forecourt's long sides
 *   ground cover . drifts of the same low shrubs over the meadow
 *   terrain ...... a ring of softly rolling meadow and woodland ground beyond the ground disc
 *
 * The entrance axis to the south is left open between the avenue's trees. Every sourced plant has
 * a procedural stand-in until it loads (or if its slug is missing), so the land is never bare.
 */
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { ZoneId } from '../config/layout'
import { MUSEUM, polar } from '../config/museum'
import { SAT_WALL } from '../config/satellites'
import { SOURCED_REGISTRY } from '../config/sourcedRegistry.generated'
import { mulberry32, TileNoise } from '../materials/noise'
import { ZoneGroup } from '../navigation/zoneCulling'
import { useMuseum } from '../state/store'
import { useHazeDriver, withHaze } from './exteriorHaze'
import { ExteriorNight } from './exteriorNight'
import { bermY, CRESCENT_BERM, SAT_ROOF } from './Satellites'
import { SourcedInstances, type Planting } from './sourcedInstances'
import { TreeImpostors } from './treeImpostors'

/** Centred on the drum. */
const CX = 0
const CZ = 0
/** The terrain ring, in multiples of the plinth's radius (GRAND §1.3 #4: ×2.2 the pavilion's). */
const LR = MUSEUM.landscape.r
export const TERRAIN = { inner: 4.6 * LR, outer: 27.8 * LR, rise: 6 * LR, hill: 0.62 * LR }
/** The belts' radii (m). */
const NEAR = { r0: LR + 3.5, r1: LR + 26 }
const MID = { r0: NEAR.r1, r1: TERRAIN.inner + 0.4 * LR }
const FAR = { r0: MID.r1, r1: TERRAIN.inner + 3.6 * LR }

const FC = MUSEUM.forecourt
/** The approach kept open in front of the forecourt (the avenue's trees stand on its edges). */
const AVENUE_X = FC.halfWidth + 5.5
const inApproach = (x: number, z: number, margin = 0) => z > 0 && Math.abs(x) < AVENUE_X - 2.5 + margin

const SEARSIA = ['ph-searsia-lucida', 'ph-searsia-lucida-b', 'ph-searsia-lucida-c'] as const
/** The broadleaves of the belts (any missing from the registry fall back to Searsia). */
const BROADLEAF = (['ph-island-tree-02', 'ph-tree-small-02'] as const).map((s) => (SOURCED_REGISTRY[s] ? s : SEARSIA[0]))
const JACARANDA = 'ph-jacaranda-tree'
/** Leaf cards: a brightness gain on their colour and the cut-out threshold (lower = fuller crowns). */
const SEARSIA_LEAF = { gain: 1.35, alphaTest: 0.3 }
const BROAD_LEAF = { gain: 1.35, alphaTest: 0.42 }
const JACARANDA_LEAF = { gain: 1.15, alphaTest: 0.38 }

/** Ground height where a plant stands: on the crescents' berm where it runs out, else the meadow. */
function groundY(x: number, z: number): number {
  const r = Math.hypot(x, z)
  const r0 = SAT_WALL.outerOuter + SAT_ROOF.over
  if (r < r0 || r > r0 + CRESCENT_BERM.run) return -0.2
  return Math.max(-0.2, bermY((Math.atan2(z, x) * 180) / Math.PI, r) - 0.12)
}

/* ------------------------------------------------------------------ */
/* Terrain                                                             */
/* ------------------------------------------------------------------ */

function Terrain() {
  const geo = useMemo(() => {
    const inner = TERRAIN.inner
    const outer = TERRAIN.outer
    const g = new THREE.RingGeometry(inner, outer, 180, 28)
    g.rotateX(-Math.PI / 2)
    const pos = g.attributes.position as THREE.BufferAttribute
    const noise = new TileNoise(11)
    const patch = new TileNoise(5)
    const colors = new Float32Array(pos.count * 3)
    // meadow greens, a darker woodland floor on the swells, dry gold in patches (warm, never desert)
    const meadow = new THREE.Color('#87994c')
    const wood = new THREE.Color('#6a7a3e')
    const dry = new THREE.Color('#b3a564')
    const c = new THREE.Color()
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i)
      const z = pos.getZ(i)
      const r = Math.hypot(x, z)
      const t = THREE.MathUtils.smoothstep(r, inner, inner + TERRAIN.rise)
      // long, low swells (few octaves): rolling country, never dunes or peaks
      const n = noise.fbm(x / (TERRAIN.rise * 0.9), z / (TERRAIN.rise * 0.9), 64, 64, 3, 0.45)
      // the ring's inner edge dips below the ground disc it meets (a skirt), so no sliver of sky
      // ever shows through the seam between them on the horizon
      const skirt = r < inner + 1 ? 1.2 : 0
      const h = t * (n * 0.5 + 0.5) * TERRAIN.hill - 0.05 - skirt
      pos.setY(i, h)
      const p = patch.fbm(x / 60, z / 60, 64, 64, 3, 0.5) * 0.5 + 0.5
      c.copy(meadow).lerp(wood, THREE.MathUtils.clamp(h / (TERRAIN.hill * 0.6), 0, 1)).lerp(dry, THREE.MathUtils.smoothstep(p, 0.62, 0.85) * 0.55)
      colors.set([c.r, c.g, c.b], i * 3)
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    g.computeVertexNormals()
    return g
  }, [])
  // the land recedes into the horizon's haze (exteriorHaze.ts)
  const mat = useMemo(() => withHaze(new THREE.MeshStandardMaterial({ name: 'terrain', vertexColors: true, roughness: 1 })), [])
  useEffect(
    () => () => {
      geo.dispose()
      mat.dispose()
    },
    [geo, mat],
  )
  return <mesh geometry={geo} material={mat} position={[CX, -0.04, CZ]} raycast={() => null} />
}

/** Terrain height under (x, z) for the far belt (the same field as Terrain, sampled). */
const terrainNoise = new TileNoise(11)
function terrainY(x: number, z: number): number {
  const r = Math.hypot(x, z)
  if (r < TERRAIN.inner) return -0.3
  const t = THREE.MathUtils.smoothstep(r, TERRAIN.inner, TERRAIN.inner + TERRAIN.rise)
  const n = terrainNoise.fbm(x / (TERRAIN.rise * 0.9), z / (TERRAIN.rise * 0.9), 64, 64, 3, 0.45)
  return t * (n * 0.5 + 0.5) * TERRAIN.hill - 0.45
}

/* ------------------------------------------------------------------ */
/* Stand-ins                                                           */
/* ------------------------------------------------------------------ */

/**
 * A tree's crown for the stand-ins: lumpy lobes merged into one soft cloud (smooth shaded, the
 * lobes' vertices pushed in and out by noise), so a grove reads as trees, not spheres.
 */
export function crownGeometry(seed = 3): THREE.BufferGeometry {
  const noise = new TileNoise(seed)
  const lobes: [number, number, number, number][] = [
    [0, 0, 0, 1],
    [0.58, 0.18, 0.22, 0.72],
    [-0.52, 0.1, -0.3, 0.76],
    [0.05, 0.42, -0.1, 0.62],
  ]
  const parts = lobes.map(([x, y, z, r], k) => {
    const g = new THREE.IcosahedronGeometry(r, 1)
    const p = g.attributes.position as THREE.BufferAttribute
    for (let i = 0; i < p.count; i++) {
      const v = new THREE.Vector3(p.getX(i), p.getY(i), p.getZ(i))
      const n = noise.fbm(v.x * 1.7 + k * 3.1, v.z * 1.7 + v.y * 1.3, 64, 64, 3, 0.5)
      v.multiplyScalar(1 + 0.16 * n)
      if (v.y < 0) v.y *= 0.55
      p.setXYZ(i, v.x + x, v.y + y, v.z + z)
    }
    g.deleteAttribute('uv')
    return g
  })
  const merged = mergeGeometries(parts, false)!
  parts.forEach((g) => g.dispose())
  merged.computeVertexNormals()
  return merged
}

/** A procedural stand-in (until the sourced tree loads): a crown `h` × the planting's scale tall. */
function StandIn({ items, h = 2.2, color = '#4f6534' }: { items: Planting[]; h?: number; color?: string }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  const geo = useMemo(() => crownGeometry(5), [])
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color, roughness: 0.95 }), [color])
  useLayoutEffect(() => {
    const im = ref.current
    if (!im) return
    const m = new THREE.Matrix4()
    items.forEach((it, k) => {
      const hh = h * it.scale
      m.compose(new THREE.Vector3(it.x, it.y + hh * 0.62, it.z), new THREE.Quaternion(), new THREE.Vector3(hh * 0.4, hh * 0.36, hh * 0.4))
      im.setMatrixAt(k, m)
    })
    im.instanceMatrix.needsUpdate = true
    im.computeBoundingSphere()
  }, [items, h])
  return <instancedMesh ref={ref} args={[geo, mat, items.length]} raycast={() => null} />
}

/* ------------------------------------------------------------------ */
/* Placement                                                           */
/* ------------------------------------------------------------------ */

/** The avenue: jacaranda pairs along the forecourt's long edges, and a pair framing the drum. */
export function avenue(): Planting[] {
  const rnd = mulberry32(3)
  const out: Planting[] = []
  const lr = MUSEUM.landscape.r
  for (let z = lr + 4; z <= FC.endZ + 10; z += 10.5)
    for (const s of [-1, 1]) out.push({ x: s * (AVENUE_X + (rnd() - 0.5) * 0.8), y: -0.2, z: z + (rnd() - 0.5) * 1.2, rot: rnd() * Math.PI * 2, scale: 0.9 + rnd() * 0.25 })
  // two more on the plinth's shoulders, the dome between them from the forecourt
  for (const s of [-1, 1]) {
    const [x, z] = polar(lr + 6, s < 0 ? 128 : 52)
    out.push({ x, y: groundY(x, z), z, rot: rnd() * Math.PI * 2, scale: 1.05 })
  }
  return out
}

/** Grove-clustered plantings in a ring (r0 … r1), split over `kinds` variants, clear of the approach. */
function groves(seed: number, count: number, r0: number, r1: number, kinds: number, scale: [number, number], perGrove: [number, number], spread: number): Planting[][] {
  const rnd = mulberry32(seed)
  const out: Planting[][] = Array.from({ length: kinds }, () => [])
  let i = 0
  let guard = 0
  while (i < count && guard++ < count * 40) {
    const a = rnd() * Math.PI * 2
    const r = r0 + Math.sqrt(rnd()) * (r1 - r0)
    const cx = CX + Math.cos(a) * r
    const cz = CZ + Math.sin(a) * r
    const n = perGrove[0] + Math.floor(rnd() * (perGrove[1] - perGrove[0] + 1))
    const kind = Math.floor(rnd() * kinds)
    for (let k = 0; k < n && i < count; k++) {
      const b = rnd() * Math.PI * 2
      const d = Math.sqrt(rnd()) * spread
      const x = cx + Math.cos(b) * d
      const z = cz + Math.sin(b) * d
      if (Math.hypot(x, z) < r0 || inApproach(x, z, 2)) continue
      // most of a grove is one kind, a few of the other
      const v = rnd() < 0.8 ? kind : Math.floor(rnd() * kinds)
      out[v].push({ x, y: Math.hypot(x, z) > TERRAIN.inner ? terrainY(x, z) : groundY(x, z), z, rot: rnd() * Math.PI * 2, scale: scale[0] + rnd() * (scale[1] - scale[0]) })
      i++
    }
  }
  return out
}

/** Near belt: broadleaf groves round the plinth and over the berm. */
export const nearBelt = (count: number) => groves(7, count, NEAR.r0, NEAR.r1, BROADLEAF.length, [1.7, 2.6], [3, 6], 7)
/** Understorey: Searsia among the near belt's groves, at their own (shrub) scale. */
export const understorey = (count: number) => groves(13, count, NEAR.r0 - 1, NEAR.r1 + 6, SEARSIA.length, [1.0, 1.6], [2, 4], 6)
/** Mid belt: groves out over the meadow. */
export const midBelt = (count: number) => groves(19, count, MID.r0, MID.r1, BROADLEAF.length, [1.9, 3.0], [4, 9], 14)
/** Far belt: woods massed along the terrain ring (impostors): broadleaves, and jacaranda in bloom among them. */
export function farBelt(count: number): Planting[][] {
  const [a, b] = groves(42, count, FAR.r0, FAR.r1, 2, [2.2, 3.4], [14, 30], 30)
  const jac: Planting[] = []
  const rnd = mulberry32(43)
  const keep = (p: Planting) => {
    if (rnd() < 0.1) jac.push({ ...p, scale: 0.8 + rnd() * 0.4 })
    else return true
    return false
  }
  return [a.filter(keep), b.filter(keep), jac]
}

/** Forecourt beds: low shrubs along both long edges and across the far end, so the paving ends in planting. */
const BED_SLUGS = ['ph-shrub-02', 'ph-shrub-03', 'ph-wild-rooibos-bush', 'ph-shrub-04'] as const
export function forecourtBeds(step: number): Planting[][] {
  const rnd = mulberry32(23)
  const out: Planting[][] = BED_SLUGS.map(() => [])
  const edge = FC.halfWidth + 0.9
  let k = 0
  const put = (x: number, z: number, s = 1) => {
    out[k++ % BED_SLUGS.length].push({ x: x + (rnd() - 0.5) * 0.6, y: -0.16, z: z + (rnd() - 0.5) * 0.6, rot: rnd() * Math.PI * 2, scale: (0.9 + rnd() * 0.7) * s })
  }
  // from just beyond the plinth's disc to the forecourt's end, both sides, two rows deep
  const z0 = Math.sqrt(Math.max(0, MUSEUM.landscape.r ** 2 - edge * edge)) + 1.5
  for (let z = z0; z <= FC.endZ + 1; z += step)
    for (const s of [-1, 1]) {
      put(s * edge, z)
      put(s * (edge + 1.3), z + step / 2, 1.25)
    }
  // across the far end, leaving the axis open
  for (let x = -FC.halfWidth; x <= FC.halfWidth; x += step) if (Math.abs(x) > 3.5) put(x, FC.endZ + 0.9)
  return out
}

/** The plinth's hem: a band of low shrubs round its edge, behind the berm's foot where the wing is. */
export function border(step: number): Planting[][] {
  const rnd = mulberry32(29)
  const out: Planting[][] = BED_SLUGS.map(() => [])
  const lr = MUSEUM.landscape.r
  const n = Math.ceil((2 * Math.PI * lr) / step)
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + (rnd() - 0.5) * 0.01
    for (let row = 0; row < 2; row++) {
      const r = lr + 0.7 + row * 1.2 + rnd() * 0.5
      const x = Math.cos(a) * r
      const z = Math.sin(a) * r
      // the forecourt's mouth stays open; the berm's own planting covers the wing
      if (z > 0 && Math.abs(x) < FC.halfWidth + 0.5) continue
      const y = groundY(x, z)
      if (y > 0.4) continue
      out[(i + row) % BED_SLUGS.length].push({ x, y: y + 0.04, z, rot: rnd() * Math.PI * 2, scale: 0.9 + rnd() * 0.7 + row * 0.3 })
    }
  }
  return out
}

/**
 * Ground cover: drifts of low sourced shrubs on the meadow round the plinth and under the groves,
 * so the trees stand in undergrowth. The approach in front of the forecourt stays open.
 */
export function groundCover(count: number): Planting[][] {
  const rnd = mulberry32(31)
  const out: Planting[][] = BED_SLUGS.map(() => [])
  const lr = MUSEUM.landscape.r
  let i = 0
  let guard = 0
  while (i < count && guard++ < count * 30) {
    const aDeg = rnd() * 360 - 180
    const r = lr + 3 + rnd() * 40
    const [cx, cz] = polar(r, aDeg)
    if (inApproach(cx, cz)) continue
    const n = 3 + Math.floor(rnd() * 5)
    for (let k = 0; k < n && i < count; k++, i++) {
      const a = rnd() * Math.PI * 2
      const d = rnd() * 2.6
      const x = cx + Math.cos(a) * d
      const z = cz + Math.sin(a) * d
      out[i % BED_SLUGS.length].push({ x, y: groundY(x, z), z, rot: rnd() * Math.PI * 2, scale: 0.8 + rnd() * 1.0 })
    }
  }
  return out
}

/* ------------------------------------------------------------------ */
/* Layers                                                              */
/* ------------------------------------------------------------------ */

/**
 * The spaces open to the landscape. The parikrama's walls hide the planting beyond the satellites,
 * and the rooms off it (theatre, atlas, library) see the parikrama: tagging the parikrama here drew
 * every sourced tree from inside those rooms (GRAND §10: ~10M triangles at H). The parikrama still
 * sees the forecourt (layout.ts ZONE_VISIBILITY), so the planting shows from its south ends.
 */
const OUTDOOR_ZONES: ZoneId[] = ['entrance-court', 'sphere-well', 'sky-rim']

type Tier = 'low' | 'medium' | 'high' | 'ultra'
const byTier = (tier: string, l: number, m: number, h: number, u: number) => ({ low: l, medium: m, high: h, ultra: u })[tier as Tier] ?? m

function Avenue() {
  const tier = useMuseum((s) => s.tier)
  const items = useMemo(avenue, [])
  // Low (phones, GRAND §10 ≤ 450k triangles): the avenue stands as impostors with the woods
  if (tier === 'low') return null
  return (
    <ZoneGroup zones={[...OUTDOOR_ZONES, 'annex']}>
      <group name="avenue">
        <SourcedInstances slug={JACARANDA} lod1={tier !== 'ultra'} items={items} castShadow leaf={JACARANDA_LEAF} fallback={<StandIn items={items} h={11} color="#6f5aa0" />} />
      </group>
    </ZoneGroup>
  )
}

function Belts() {
  const tier = useMuseum((s) => s.tier)
  // GRAND §10 budgets: the belts are instanced LOD1 on every tier (~11k triangles a tree; the full
  // 40k model only reads within a few metres, and nobody stands there); the mid belt is drawn as
  // impostors with the far woods (Woods)
  // Low: the near belt is drawn as impostors with the woods (Woods)
  const near = useMemo(() => (tier === 'low' ? [[], []] : nearBelt(byTier(tier, 24, 40, 50, 110))), [tier])
  const under = useMemo(() => understorey(byTier(tier, 0, 20, 30, 60)), [tier])
  return (
    <ZoneGroup zones={OUTDOOR_ZONES}>
      <group name="near-belt">
        {BROADLEAF.map((slug, i) => (
          <SourcedInstances key={`n${i}`} slug={slug} lod1 items={near[i]} castShadow={tier === 'high' || tier === 'ultra'} leaf={BROAD_LEAF} fallback={<StandIn items={near[i]} h={4.2} />} />
        ))}
        {SEARSIA.map((slug, i) => (
          <SourcedInstances key={`u${i}`} slug={slug} lod1 items={under[i] ?? []} leaf={SEARSIA_LEAF} />
        ))}
      </group>
    </ZoneGroup>
  )
}

/** The mid and far belts: impostors of the sourced trees, never crowns on sticks. */
function Woods() {
  const tier = useMuseum((s) => s.tier)
  const sets = useMemo(() => {
    const far = farBelt(byTier(tier, 500, 900, 1400, 1800))
    const mid = midBelt(byTier(tier, 80, 120, 220, 300))
    // on Low the near belt and the avenue join them as cards (Belts, Avenue draw nothing there)
    const near = tier === 'low' ? nearBelt(24) : []
    const extra = [...BROADLEAF.map((_, i) => [...(mid[i] ?? []), ...(near[i] ?? [])]), tier === 'low' ? avenue() : []]
    return far.map((set, i) => [...set, ...(extra[i] ?? [])])
  }, [tier])
  return <TreeImpostors slugs={[...BROADLEAF, JACARANDA]} sets={sets} />
}

function Plantings() {
  const tier = useMuseum((s) => s.tier)
  const beds = useMemo(() => forecourtBeds(tier === 'low' ? 4.4 : 1.6), [tier])
  const hem = useMemo(() => border(tier === 'low' ? 5 : 1.7), [tier])
  const cover = useMemo(() => groundCover(byTier(tier, 30, 100, 140, 380)), [tier])
  return (
    <>
      <ZoneGroup zones={['entrance-court', 'sky-rim', 'annex']}>
        <group name="forecourt-beds">
          {BED_SLUGS.map((slug, i) => (
            <SourcedInstances key={slug} slug={slug} lod1={tier !== 'ultra'} items={beds[i]} castShadow={tier !== 'low'} />
          ))}
        </group>
      </ZoneGroup>
      <ZoneGroup zones={OUTDOOR_ZONES}>
        <group name="border">
          {BED_SLUGS.map((slug, i) => (
            <SourcedInstances key={slug} slug={slug} lod1 items={hem[i]} castShadow={false} />
          ))}
        </group>
        <group name="ground-cover">
          {BED_SLUGS.map((slug, i) => (
            <SourcedInstances key={slug} slug={slug} lod1 items={cover[i]} castShadow={false} />
          ))}
        </group>
      </ZoneGroup>
    </>
  )
}

export function Landscape() {
  useHazeDriver()
  return (
    <group>
      <Terrain />
      <Woods />
      <Belts />
      <Avenue />
      <Plantings />
      <ExteriorNight />
    </group>
  )
}
