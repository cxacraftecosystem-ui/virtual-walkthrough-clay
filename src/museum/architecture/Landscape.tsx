/**
 * The landscape round the pavilion's site, seen from the forecourt, through the door and from
 * the arrival flight (GRAND §2.7):
 *
 *   near belt .... Searsia lucida, the sourced Poly Haven trees in three variants (LOD1,
 *                  instanced), standing round the plinth's edge and beyond the crescents' berm;
 *                  a procedural stand-in until they load
 *   mid belt ..... the same sourced Searsia (LOD1, instanced) on the near edge of the terrain
 *                  ring, so the trees the arrival and the elevation see are real trees (Medium up)
 *   far belt ..... impostors of the same sourced Searsia (crossed cards, one draw per variant)
 *   forecourt .... low sourced shrubs and rooibos in beds along the forecourt's long edges, so the
 *                  paving ends in planting, never in a bare slab edge
 *   ground cover . drifts of the same low shrubs round the plinth and before the near belt
 *   terrain ...... a ring of softly rolling ground beyond the ground disc
 *
 * The entrance axis to the south is left open. No shadows beyond the near belt.
 */
import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { ZoneId } from '../config/layout'
import { MUSEUM, polar } from '../config/museum'
import { SAT_WALL, SATELLITES } from '../config/satellites'
import { mulberry32, TileNoise } from '../materials/noise'
import { ZoneGroup } from '../navigation/zoneCulling'
import { useMuseum } from '../state/store'
import { SourcedInstances, type Planting } from './sourcedInstances'
import { TreeImpostors } from './treeImpostors'

/** Centred on the drum. */
const CX = 0
const CZ = 0
/** The terrain ring and the tree belt, in multiples of the plinth's radius (GRAND §1.3 #4: ×2.2 the pavilion's). */
const LR = MUSEUM.landscape.r
export const TERRAIN = { inner: 4.6 * LR, outer: 27.8 * LR, rise: 6 * LR, hill: 1.45 * LR }
const BELT = { r0: 3.85 * LR, span: 4.6 * LR }
/** The sourced mid belt takes the belt's nearest band; the procedural canopies stand beyond it. */
const MID = { r0: BELT.r0 - 0.6 * LR, r1: BELT.r0 + 0.9 * LR }

function Terrain() {
  const geo = useMemo(() => {
    const inner = TERRAIN.inner
    const outer = TERRAIN.outer
    const g = new THREE.RingGeometry(inner, outer, 160, 24)
    g.rotateX(-Math.PI / 2)
    const pos = g.attributes.position as THREE.BufferAttribute
    const noise = new TileNoise(11)
    const colors = new Float32Array(pos.count * 3)
    // dry grass and pale earth, a cool ochre (never olive, never brown murk at golden hour)
    const low = new THREE.Color('#a49b70')
    const high = new THREE.Color('#bcb08c')
    const c = new THREE.Color()
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i)
      const z = pos.getZ(i)
      const r = Math.hypot(x, z)
      const t = THREE.MathUtils.smoothstep(r, inner, inner + TERRAIN.rise)
      const n = noise.fbm(x / (TERRAIN.rise * 0.66), z / (TERRAIN.rise * 0.66), 64, 64, 4, 0.5)
      // the ring's inner edge dips below the ground disc it meets (a skirt), so no sliver of sky
      // ever shows through the seam between them on the horizon
      const skirt = r < inner + 1 ? 1.2 : 0
      const h = t * (n * 0.5 + 0.5) * TERRAIN.hill - 0.05 - skirt
      pos.setY(i, h)
      c.copy(low).lerp(high, THREE.MathUtils.clamp(h / 20, 0, 1))
      colors.set([c.r, c.g, c.b], i * 3)
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    g.computeVertexNormals()
    return g
  }, [])
  return (
    <mesh geometry={geo} position={[CX, -0.04, CZ]} raycast={() => null}>
      <meshStandardMaterial vertexColors roughness={1} />
    </mesh>
  )
}

/**
 * A far tree's crown: three lumpy lobes merged into one soft cloud (smooth shaded, the lobes'
 * vertices pushed in and out by noise), so the belt reads as dry-country trees, not spheres.
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
      // flatter underneath, as a crown in the sun
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

/** The far belt's plantings per variant (clear of the entrance axis), beyond the mid belt on Medium up. */
export function farBelt(count: number, r0: number): Planting[][] {
  const rnd = mulberry32(42)
  const out: Planting[][] = SEARSIA.map(() => [])
  let i = 0
  let guard = 0
  while (i < count && guard++ < count * 20) {
    const a = rnd() * Math.PI * 2
    const r = r0 + rnd() * (BELT.r0 + BELT.span - r0)
    const x = CX + Math.cos(a) * r * 1.15
    const z = CZ + Math.sin(a) * r
    // keep the entrance axis (south) open so the facade view reads as an approach
    if (z > MUSEUM.forecourt.endZ + 8 && Math.abs(x) < 16) continue
    out[i % SEARSIA.length].push({ x, y: -0.3, z, rot: rnd() * Math.PI * 2, scale: 2.4 + rnd() * 2.2 })
    i++
  }
  return out
}

/** The far belt: impostors of the sourced Searsia (architecture/treeImpostors.tsx), never crowns on sticks. */
function Trees() {
  const tier = useMuseum((s) => s.tier)
  const count = tier === 'low' ? 220 : 420
  // Medium up, the sourced mid belt holds the near band: the impostors start beyond it
  const r0 = tier === 'low' ? BELT.r0 : MID.r1
  const sets = useMemo(() => farBelt(count, r0), [count, r0])
  return <TreeImpostors slugs={SEARSIA} sets={sets} />
}

/** The crescents' berm reaches this far out (CRESCENT_BERM in Satellites.tsx): the near belt stands beyond it. */
const BERM_OUTER = SAT_WALL.outerOuter + 9
const SEARSIA = ['ph-searsia-lucida', 'ph-searsia-lucida-b', 'ph-searsia-lucida-c'] as const
/** The Searsia's leaves: brighter and fuller than the scan's cut-outs, so the belt reads as living evergreen, not dead scrub. */
const SEARSIA_LEAF = { gain: 1.45, alphaTest: 0.3 }

/** Near-belt plantings per variant: round the plinth's edge, clear of the berm and the entrance axis. */
export function nearBelt(count: number): Planting[][] {
  const rnd = mulberry32(7)
  const out: Planting[][] = SEARSIA.map(() => [])
  const LR = MUSEUM.landscape.r
  const wing0 = SATELLITES[0].fromDeg - 6
  const wing1 = SATELLITES[SATELLITES.length - 1].toDeg + 6
  let i = 0
  let guard = 0
  while (i < count && guard++ < count * 20) {
    const aDeg = rnd() * 360 - 180
    const inWing = aDeg > wing0 && aDeg < wing1
    const r = (inWing ? BERM_OUTER + 1.5 : LR + 3) + rnd() * 16
    const [x, z] = polar(r, aDeg)
    // the approach stays open: no tree in front of the forecourt
    if (z > 0 && Math.abs(x) < MUSEUM.forecourt.halfWidth + 10) continue
    out[i % SEARSIA.length].push({ x, y: -0.2, z, rot: rnd() * Math.PI * 2, scale: 2.3 + rnd() * 1.2 })
    i++
  }
  return out
}

/** A procedural stand-in for a variant (until the sourced tree loads). */
function StandIn({ items }: { items: Planting[] }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  const geo = useMemo(() => crownGeometry(5), [])
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#5d6b3f', roughness: 0.95 }), [])
  useLayoutEffect(() => {
    const im = ref.current
    if (!im) return
    const m = new THREE.Matrix4()
    items.forEach((it, k) => {
      const h = 2.2 * it.scale
      m.compose(new THREE.Vector3(it.x, it.y + h * 0.62, it.z), new THREE.Quaternion(), new THREE.Vector3(h * 0.4, h * 0.36, h * 0.4))
      im.setMatrixAt(k, m)
    })
    im.instanceMatrix.needsUpdate = true
    im.computeBoundingSphere()
  }, [items])
  return <instancedMesh ref={ref} args={[geo, mat, items.length]} raycast={() => null} />
}

/** The spaces open to the landscape. */
const OUTDOOR_ZONES: ZoneId[] = ['entrance-court', 'parikrama-west', 'parikrama-east', 'sphere-well', 'sky-rim']

/** The mid belt: sourced Searsia on the terrain ring's near band, clear of the entrance axis. */
export function midBelt(count: number): Planting[][] {
  const rnd = mulberry32(19)
  const out: Planting[][] = SEARSIA.map(() => [])
  let i = 0
  let guard = 0
  while (i < count && guard++ < count * 20) {
    const a = rnd() * Math.PI * 2
    const r = MID.r0 + rnd() * (MID.r1 - MID.r0)
    const x = CX + Math.cos(a) * r * 1.15
    const z = CZ + Math.sin(a) * r
    if (z > MUSEUM.forecourt.endZ + 8 && Math.abs(x) < 16) continue
    out[i % SEARSIA.length].push({ x, y: -0.3, z, rot: rnd() * Math.PI * 2, scale: 2.6 + rnd() * 1.8 })
    i++
  }
  return out
}

function MidBelt() {
  const tier = useMuseum((s) => s.tier)
  const count = tier === 'medium' ? 56 : tier === 'high' ? 100 : 140
  const sets = useMemo(() => midBelt(count), [count])
  if (tier === 'low') return null
  return (
    <ZoneGroup zones={OUTDOOR_ZONES}>
      <group name="mid-belt">
        {SEARSIA.map((slug, i) => (
          <SourcedInstances key={slug} slug={slug} items={sets[i]} leaf={SEARSIA_LEAF} fallback={<StandIn items={sets[i]} />} />
        ))}
      </group>
    </ZoneGroup>
  )
}

/** Forecourt beds: low shrubs along both long edges and across the far end, so the paving ends in planting. */
const BED_SLUGS = ['ph-shrub-02', 'ph-shrub-03', 'ph-wild-rooibos-bush', 'ph-shrub-04'] as const
export function forecourtBeds(step: number): Planting[][] {
  const rnd = mulberry32(23)
  const out: Planting[][] = BED_SLUGS.map(() => [])
  const FC = MUSEUM.forecourt
  const edge = FC.halfWidth + 0.9
  let k = 0
  const put = (x: number, z: number) => {
    out[k++ % BED_SLUGS.length].push({ x: x + (rnd() - 0.5) * 0.6, y: -0.16, z: z + (rnd() - 0.5) * 0.6, rot: rnd() * Math.PI * 2, scale: 0.9 + rnd() * 0.6 })
  }
  // from just beyond the plinth's disc to the forecourt's end, both sides
  const z0 = Math.sqrt(Math.max(0, MUSEUM.landscape.r ** 2 - edge * edge)) + 1.5
  for (let z = z0; z <= FC.endZ + 1; z += step) for (const s of [-1, 1]) put(s * edge, z)
  // across the far end, leaving the axis open
  for (let x = -FC.halfWidth; x <= FC.halfWidth; x += step) if (Math.abs(x) > 3.5) put(x, FC.endZ + 0.9)
  return out
}

function ForecourtBeds() {
  const tier = useMuseum((s) => s.tier)
  const sets = useMemo(() => forecourtBeds(tier === 'low' ? 3.2 : 1.8), [tier])
  return (
    <ZoneGroup zones={['entrance-court', 'sky-rim']}>
      <group name="forecourt-beds">
        {BED_SLUGS.map((slug, i) => (
          <SourcedInstances key={slug} slug={slug} items={sets[i]} castShadow={tier !== 'low'} />
        ))}
      </group>
    </ZoneGroup>
  )
}

function NearBelt() {
  const tier = useMuseum((s) => s.tier)
  const count = tier === 'low' ? 28 : tier === 'medium' ? 48 : 72
  const sets = useMemo(() => nearBelt(count), [count])
  return (
    // drawn only while an outdoor space is in view (the rotunda's rooms never see the belt)
    <ZoneGroup zones={OUTDOOR_ZONES}>
      <group name="near-belt">
        {SEARSIA.map((slug, i) => (
          <SourcedInstances key={slug} slug={slug} items={sets[i]} castShadow={tier !== 'low'} leaf={SEARSIA_LEAF} fallback={<StandIn items={sets[i]} />} />
        ))}
      </group>
    </ZoneGroup>
  )
}

/**
 * Ground cover: drifts of low sourced shrubs on the ground round the plinth and in front of the
 * near belt, so the site reads as planted land and the trees stand in undergrowth, never on bare
 * mottle. The approach in front of the forecourt stays open.
 */
export function groundCover(count: number): Planting[][] {
  const rnd = mulberry32(31)
  const out: Planting[][] = BED_SLUGS.map(() => [])
  const LR = MUSEUM.landscape.r
  let i = 0
  let guard = 0
  while (i < count && guard++ < count * 30) {
    // drifts: a centre, then three to six plants round it
    const aDeg = rnd() * 360 - 180
    const r = LR + 1.5 + rnd() * 26
    const [cx, cz] = polar(r, aDeg)
    if (cz > 0 && Math.abs(cx) < MUSEUM.forecourt.halfWidth + 4) continue
    const n = 3 + Math.floor(rnd() * 4)
    for (let k = 0; k < n && i < count; k++, i++) {
      const a = rnd() * Math.PI * 2
      const d = rnd() * 2.2
      out[i % BED_SLUGS.length].push({ x: cx + Math.cos(a) * d, y: -0.2, z: cz + Math.sin(a) * d, rot: rnd() * Math.PI * 2, scale: 0.8 + rnd() * 0.9 })
    }
  }
  return out
}

function GroundCover() {
  const tier = useMuseum((s) => s.tier)
  const count = tier === 'low' ? 60 : tier === 'medium' ? 140 : 240
  const sets = useMemo(() => groundCover(count), [count])
  return (
    <ZoneGroup zones={OUTDOOR_ZONES}>
      <group name="ground-cover">
        {BED_SLUGS.map((slug, i) => (
          <SourcedInstances key={slug} slug={slug} items={sets[i]} castShadow={false} />
        ))}
      </group>
    </ZoneGroup>
  )
}

export function Landscape() {
  return (
    <group>
      <Terrain />
      <Trees />
      <MidBelt />
      <NearBelt />
      <ForecourtBeds />
      <GroundCover />
    </group>
  )
}


