/**
 * 'courtyard-garden' — a planted pocket of the Parikrama (PDF p09l "sinuous red walls round tree
 * courtyards"; GRAND §2.6, §5.4): the walled courtyards on the rooms' side, whose trees rise over
 * the 2.3 m red wall, and the sunken gardens on the drum's side behind the parapet.
 *
 *   extent    the object's footprint [along, across], rounded; without one (the usual case in
 *             the Parikrama, where a footprint would also be a collider) a disc reaching halfway
 *             to the next garden (3 … 7 m). Either is clipped to the pocket it stands in: nothing
 *             is planted on the walk or within 0.25 m of a wall (satellites.ts serpentine), so
 *             the garden follows the curve of its walls. Other objects standing in it (the
 *             horses' plinths, say) are planted round.
 *   ground    a bed of soil (Ground054) with a scatter of gravel (`gravel`) and a few boulders
 *   trees     one line per tree, `slug|height` (e.g. `ph-searsia-lucida|3.7`): the sourced tree
 *             (a multi-variant source picks its variants in turn), instanced per model; until
 *             it loads, a procedural multi-stemmed evergreen of that height
 *   shrubs    `shrubs` low plants (sourced shrubs, rooibos, fern, periwinkle; procedural clumps
 *             as the fallback), instanced
 *   basin     a stone water basin at the pocket's deepest point (`wc-hotei-water-basin`)
 *
 * Everything is seeded by `seed` and the object's id. Draw calls: about 6 (instanced).
 * Origin: the footprint's centre on the floor.
 */
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { DEG } from '../config/museum'
import { SCENE_OBJECTS } from '../config/objects'
import { PARIKRAMA, SAT_WALL, SERP_OFFSET, SERPENTINE, serpentineR } from '../config/satellites'
import { injectAtmosphere } from '../lighting/atmosphere/inject'
import { useMaterials } from '../materials/materials'
import { useMuseum } from '../state/store'
import { fbm3, resolveSlug, SourcedInstances, SourcedOr, type InstanceSpot } from './erodedFormation'
import { rng } from './kit'
import { tinted, useModelMaterials } from './modelMaterials'
import { fp, num, str, type ModelProps } from './types'

const noRaycast = () => null

/* ------------------------------------------------------------------ */
/* the pocket                                                          */
/* ------------------------------------------------------------------ */

/** Is the world point (x, z) plantable: not on the Parikrama's walk, clear of its walls? */
export function plantable(x: number, z: number, margin = 0.25): boolean {
  const r = Math.hypot(x, z)
  const a = Math.atan2(z, x) / DEG
  // the wing's angles from the drum outwards: past the rooms' inner wall is a room (the theatre's
  // floor, the library's), never garden, so a garden's disc is cut at the wall
  const inWing = r > PARIKRAMA.r0 - 0.5 && a >= PARIKRAMA.fromDeg - 2 && a <= PARIKRAMA.toDeg + 2
  if (!inWing) return true
  if (r < PARIKRAMA.r0 + margin || r > SAT_WALL.innerC - SAT_WALL.t / 2 - margin) return false
  const c = serpentineR(a)
  return Math.abs(r - c) > SERP_OFFSET + SERPENTINE.t / 2 + margin
}

/* ------------------------------------------------------------------ */
/* procedural plants (fallbacks)                                       */
/* ------------------------------------------------------------------ */

/** A noisy, flattened leaf clump of radius 1 (vertex colour: darker underneath and inside). */
function clumpGeometry(seed: number, detail: number): THREE.BufferGeometry {
  const g = new THREE.IcosahedronGeometry(1, detail)
  const p = g.getAttribute('position')
  const col = new Float32Array(p.count * 3)
  const v = new THREE.Vector3()
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i)
    const n = fbm3(v.x * 1.6, v.y * 1.6, v.z * 1.6, seed, 3)
    v.multiplyScalar(1 + 0.28 * n)
    if (v.y < 0) v.y *= 0.55
    p.setXYZ(i, v.x, v.y, v.z)
    const shade = 0.55 + 0.45 * THREE.MathUtils.clamp((v.y + 0.6) / 1.5, 0, 1) + 0.12 * n
    col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = shade
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3))
  g.computeVertexNormals()
  return g
}

/** A multi-stemmed evergreen of height h: stems (bark) and canopy clumps (leaves). */
function treeGeometry(h: number, seed: number, lo: boolean): { bark: THREE.BufferGeometry; leaves: THREE.BufferGeometry } {
  const r = rng(`tree|${seed}`)
  const bark: THREE.BufferGeometry[] = []
  const leaves: THREE.BufferGeometry[] = []
  const stems = 2 + Math.floor(r() * 3)
  const crownY = h * 0.62
  const crownR = h * 0.36
  for (let i = 0; i < stems; i++) {
    const a = (i / stems) * Math.PI * 2 + r() * 0.8
    const lean = 0.12 + r() * 0.22
    const len = crownY * (0.85 + r() * 0.3)
    const top = new THREE.Vector3(Math.cos(a) * lean * len, len, Math.sin(a) * lean * len)
    const base = new THREE.Vector3(Math.cos(a) * 0.06, 0, Math.sin(a) * 0.06)
    const dir = top.clone().sub(base)
    const L = dir.length()
    const c = new THREE.CylinderGeometry(0.035 + h * 0.008, 0.06 + h * 0.016, L, lo ? 5 : 7, 3)
    c.translate(0, L / 2, 0)
    c.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize()))
    c.translate(base.x, base.y, base.z)
    bark.push(c)
  }
  const clumps = lo ? 5 : 9
  for (let i = 0; i < clumps; i++) {
    const a = r() * Math.PI * 2
    const rr = crownR * Math.sqrt(r()) * 0.75
    const s = crownR * (0.42 + r() * 0.3)
    const g = clumpGeometry(seed * 31 + i, lo ? 1 : 2)
    g.scale(s, s * 0.78, s)
    g.translate(Math.cos(a) * rr, crownY + (r() - 0.3) * crownR * 0.7, Math.sin(a) * rr)
    leaves.push(g)
  }
  const merge = (list: THREE.BufferGeometry[]) => {
    const flat = list.map((g) => {
      const x = g.index ? g.toNonIndexed() : g
      if (!x.getAttribute('color')) x.setAttribute('color', new THREE.BufferAttribute(new Float32Array(x.getAttribute('position').count * 3).fill(1), 3))
      return x
    })
    let n = 0
    for (const g of flat) n += g.getAttribute('position').count
    const out = new THREE.BufferGeometry()
    for (const [name, size] of [['position', 3], ['normal', 3], ['uv', 2], ['color', 3]] as const) {
      const arr = new Float32Array(n * size)
      let o = 0
      for (const g of flat) {
        arr.set(g.getAttribute(name).array as Float32Array, o * size)
        o += g.getAttribute('position').count
      }
      out.setAttribute(name, new THREE.BufferAttribute(arr, size))
    }
    return out
  }
  return { bark: merge(bark), leaves: merge(leaves) }
}

const leafCache = new Map<string, THREE.MeshStandardMaterial>()
function leafMaterial(tone: string) {
  let m = leafCache.get(tone)
  if (!m) {
    m = new THREE.MeshStandardMaterial({ name: `leaf-${tone}`, color: new THREE.Color(tone), vertexColors: true, roughness: 0.82, metalness: 0, envMapIntensity: 0.5 })
    injectAtmosphere(m)
    leafCache.set(tone, m)
  }
  return m
}
const pebbleMat = new THREE.MeshStandardMaterial({ name: 'gardenPebble', color: '#ffffff', roughness: 0.9, metalness: 0, envMapIntensity: 0.4 })
injectAtmosphere(pebbleMat)

function ProceduralTree({ p, h, seed, rotY, lo }: { p: [number, number, number]; h: number; seed: number; rotY: number; lo: boolean }) {
  const m = useModelMaterials()
  const geo = useMemo(() => treeGeometry(h, seed, lo), [h, seed, lo])
  useEffect(() => () => {
    geo.bark.dispose()
    geo.leaves.dispose()
  }, [geo])
  return (
    <group position={p} rotation={[0, rotY, 0]}>
      <mesh geometry={geo.bark} material={m.bark} castShadow receiveShadow raycast={noRaycast} />
      <mesh geometry={geo.leaves} material={leafMaterial('#5b7442')} castShadow receiveShadow raycast={noRaycast} />
    </group>
  )
}

/** Instanced procedural clumps (shrubs, or boulders with a stone material). */
function Clumps({ spots, material, seed, detail, colors }: { spots: InstanceSpot[]; material: THREE.Material; seed: number; detail: number; colors?: THREE.Color[] }) {
  const geo = useMemo(() => {
    const g = clumpGeometry(seed, detail)
    g.translate(0, 0.55, 0)
    g.scale(0.5, 1 / 1.55, 0.5)
    return g
  }, [seed, detail])
  useEffect(() => () => geo.dispose(), [geo])
  return (
    <instancedMesh
      key={`${spots.length}-${geo.uuid}`}
      args={[geo, material, spots.length]}
      castShadow
      receiveShadow
      raycast={noRaycast}
      ref={(mesh) => {
        if (!mesh) return
        const mtx = new THREE.Matrix4()
        const q = new THREE.Quaternion()
        const up = new THREE.Vector3(0, 1, 0)
        spots.forEach((s, i) => {
          mesh.setMatrixAt(i, mtx.compose(new THREE.Vector3(...s.p), q.setFromAxisAngle(up, s.rotY), new THREE.Vector3(s.h * (s.sx ?? 1), s.h, s.h * (s.sx ?? 1))))
          if (colors) mesh.setColorAt(i, colors[i % colors.length])
        })
        mesh.instanceMatrix.needsUpdate = true
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
        mesh.computeBoundingSphere()
      }}
    />
  )
}

/* ------------------------------------------------------------------ */
/* the kind                                                            */
/* ------------------------------------------------------------------ */

const SHRUB_SLUGS = ['ph-shrub-03', 'ph-wild-rooibos-bush', 'ph-fern-02', 'ph-periwinkle-plant', 'ph-shrub-04', 'ph-shrub-02']
const BOULDER_SLUGS = ['ph-namaqualand-boulder-03', 'ph-namaqualand-boulder-04', 'ph-namaqualand-boulder-05']

interface TreeLine {
  slug: string
  h: number
}

function parseTrees(text: string): TreeLine[] {
  return text
    .split(/\r?\n|;/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const [slug, h] = l.split('|').map((s) => s.trim())
      return { slug, h: Math.max(0.5, Math.min(12, Number(h) || 3.5)) }
    })
}

export function CourtyardGarden({ config }: ModelProps) {
  const core = useMaterials()
  const tier = useMuseum((s) => s.tier)
  const lo = tier === 'low'
  const auto = !config.footprint
  // without a footprint: a disc reaching halfway to the nearest other garden
  const autoR = useMemo(() => {
    let near = 14
    for (const o of SCENE_OBJECTS) {
      if (o.kind !== 'courtyard-garden' || o.id === config.id) continue
      near = Math.min(near, Math.hypot(o.position[0] - config.position[0], o.position[2] - config.position[2]))
    }
    return Math.max(3, Math.min(7, near / 2))
  }, [config.id, config.position])
  const [W, D] = auto ? [autoR * 2, autoR * 2] : fp(config, [6, 3])
  const seed = Math.round(num(config, 'seed', 1))
  const trees = str(config, 'trees', '')
  const shrubCount = Math.round(Math.max(0, Math.min(60, num(config, 'shrubs', 8))))
  const gravel = config.props?.gravel !== false && config.props?.gravel !== 'false'
  const basin = config.props?.basin === true || config.props?.basin === 'true'
  const [px, , pz] = config.position
  const rot = ((config.rotationDeg ?? 0) * Math.PI) / 180

  const layout = useMemo(() => {
    const r = rng(`garden|${config.id}|${seed}`)
    const cos = Math.cos(rot)
    const sin = Math.sin(rot)
    // local (x, z) → world, as the scene object's group turns it
    const world = (x: number, z: number): [number, number] => [px + x * cos + z * sin, pz - x * sin + z * cos]
    // a rounded rectangle W × D, `m` inside its edge
    const rc = auto ? W / 2 : Math.min(W, D) * 0.4
    // other objects standing in the garden: planted round
    const others = SCENE_OBJECTS.filter((o) => o.id !== config.id && o.kind !== 'courtyard-garden' && Math.hypot(o.position[0] - px, o.position[2] - pz) < Math.max(W, D) / 2 + 1)
    const inBox = (x: number, z: number, m = 0) => {
      const dx = Math.max(0, Math.abs(x) - (W / 2 - rc))
      const dz = Math.max(0, Math.abs(z) - (D / 2 - rc))
      return Math.hypot(dx, dz) <= rc - m
    }
    const ok = (x: number, z: number, m = 0.25) => inBox(x, z, Math.min(m, D / 4)) && plantable(...world(x, z), m)
    const sample = (m: number) => {
      for (let i = 0; i < 40; i++) {
        const x = (r() - 0.5) * W
        const z = (r() - 0.5) * D
        if (ok(x, z, m)) return [x, z] as [number, number]
      }
      return null
    }
    // depth of plantable ground round a point (for trees and the basin: the roomiest spots)
    const room = (x: number, z: number) => {
      let d = 0
      for (const k of [0.4, 0.8, 1.2, 1.6]) {
        let all = true
        for (let a = 0; a < 8; a++) if (!ok(x + Math.cos(a) * k, z + Math.sin(a) * k, 0.1)) all = false
        if (all) d = k
      }
      return d
    }
    const taken: { x: number; z: number; r: number }[] = others.map((o) => {
      // back into the garden's local frame
      const dx = o.position[0] - px
      const dz = o.position[2] - pz
      const half = o.footprint ? Math.hypot(o.footprint[0], o.footprint[1]) / 2 : 0.45
      return { x: dx * cos - dz * sin, z: dx * sin + dz * cos, r: half }
    })
    const free = (x: number, z: number, rr: number) => taken.every((t) => Math.hypot(t.x - x, t.z - z) > t.r + rr)
    // basin first, at the roomiest point
    let basinAt: [number, number] | null = null
    if (basin) {
      let best = -1
      for (let i = 0; i < 80; i++) {
        const s = sample(0.4)
        if (!s) continue
        const q = room(...s)
        if (q > best) {
          best = q
          basinAt = s
        }
      }
      if (basinAt) taken.push({ x: basinAt[0], z: basinAt[1], r: 0.9 })
    }
    const treeLines = parseTrees(trees)
    const treeSpots: (TreeLine & { x: number; z: number; rotY: number; nth: number })[] = []
    const nthOf = new Map<string, number>()
    for (const t of treeLines) {
      let pick: [number, number] | null = null
      let best = -1
      for (let i = 0; i < 60; i++) {
        const s = sample(0.5)
        if (!s || !free(s[0], s[1], 1.0)) continue
        const q = room(...s) + r() * 0.3
        if (q > best) {
          best = q
          pick = s
        }
      }
      if (!pick) continue
      taken.push({ x: pick[0], z: pick[1], r: 1.0 })
      const nth = nthOf.get(t.slug) ?? 0
      nthOf.set(t.slug, nth + 1)
      treeSpots.push({ ...t, x: pick[0], z: pick[1], rotY: r() * Math.PI * 2, nth })
    }
    const shrubs: InstanceSpot[] = []
    for (let i = 0; i < shrubCount * 3 && shrubs.length < shrubCount; i++) {
      const s = sample(0.3)
      if (!s || !free(s[0], s[1], 0.35)) continue
      taken.push({ x: s[0], z: s[1], r: 0.35 })
      shrubs.push({ p: [s[0], 0, s[1]], rotY: r() * Math.PI * 2, h: 0.35 + r() * 0.45 })
    }
    const boulders: InstanceSpot[] = []
    const nb = Math.max(1, Math.round((W * D) / 9))
    for (let i = 0; i < nb * 4 && boulders.length < nb; i++) {
      const s = sample(0.45)
      if (!s || !free(s[0], s[1], 0.45)) continue
      taken.push({ x: s[0], z: s[1], r: 0.45 })
      boulders.push({ p: [s[0], -0.05, s[1]], rotY: r() * Math.PI * 2, h: 0.35 + r() * 0.4, sx: 1.4 + r() * 0.6 })
    }
    // a few larger stones among the gravel
    const accents: InstanceSpot[] = []
    for (let i = 0; i < 40 && gravel && accents.length < Math.round((W * D) / 4); i++) {
      const s = sample(0.2)
      if (!s || !free(s[0], s[1], 0.15)) continue
      accents.push({ p: [s[0], 0, s[1]], rotY: r() * Math.PI * 2, h: 0.08 + r() * 0.1 })
    }
    const pebbles: InstanceSpot[] = []
    const pebbleColors: THREE.Color[] = []
    if (gravel) {
      // one try per slot: the density follows the planted area, not the box
      const n = Math.round(W * D * (lo ? 5 : 14))
      for (let i = 0; i < n; i++) {
        const x = (r() - 0.5) * W
        const z = (r() - 0.5) * D
        if (!ok(x, z, 0.12)) continue
        const s: [number, number] = [x, z]
        pebbles.push({ p: [s[0], 0.0, s[1]], rotY: r() * Math.PI * 2, h: 0.025 + r() * 0.035, sx: 1.2 + r() * 0.8 })
        const c = new THREE.Color().setHSL(0.07 + r() * 0.04, 0.12 + r() * 0.18, 0.5 + r() * 0.25)
        pebbleColors.push(c)
      }
    }
    // the soil bed: 0.2 m cells inside the box and the pocket
    const cell = lo ? 0.3 : 0.2
    const pos: number[] = []
    const uv: number[] = []
    const nx = Math.ceil(W / cell)
    const nz = Math.ceil(D / cell)
    for (let i = 0; i < nx; i++)
      for (let j = 0; j < nz; j++) {
        const x0 = -W / 2 + i * cell
        const z0 = -D / 2 + j * cell
        if (!ok(x0 + cell / 2, z0 + cell / 2, 0.08)) continue
        const y = 0.012
        const q = [
          [x0, z0],
          [x0, z0 + cell],
          [x0 + cell, z0 + cell],
          [x0 + cell, z0],
        ]
        for (const k of [0, 1, 2, 0, 2, 3]) {
          pos.push(q[k][0], y, q[k][1])
          uv.push(q[k][0], q[k][1])
        }
      }
    const bed = new THREE.BufferGeometry()
    bed.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    bed.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
    bed.setAttribute('normal', new THREE.Float32BufferAttribute(new Float32Array(pos.length).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3))
    return { basinAt, treeSpots, shrubs, boulders, accents, pebbles, pebbleColors, bed }
  }, [config.id, seed, rot, px, pz, W, D, auto, trees, shrubCount, gravel, basin, lo])
  useEffect(() => () => layout.bed.dispose(), [layout])

  // trees grouped by the model they resolve to
  const treeGroups = useMemo(() => {
    const map = new Map<string, { slug: string | undefined; spots: (InstanceSpot & { seed: number })[] }>()
    for (const t of layout.treeSpots) {
      const slug = resolveSlug(t.slug, t.nth)
      const key = slug ?? `proc:${t.slug}`
      const g = map.get(key) ?? { slug, spots: [] }
      g.spots.push({ p: [t.x, 0, t.z], rotY: t.rotY, h: t.h, seed: Math.round(t.x * 100 + t.z * 7) })
      map.set(key, g)
    }
    return [...map.values()]
  }, [layout])

  const shrubSlug = useMemo(() => {
    const r = rng(`garden-shrub|${config.id}|${seed}`)
    const start = Math.floor(r() * SHRUB_SLUGS.length)
    for (let k = 0; k < SHRUB_SLUGS.length; k++) {
      const s = resolveSlug(SHRUB_SLUGS[(start + k) % SHRUB_SLUGS.length])
      if (s) return s
    }
    return undefined
  }, [config.id, seed])
  const boulderSlug = useMemo(() => BOULDER_SLUGS.map((s) => resolveSlug(s)).find(Boolean), [])
  const shrubColors = useMemo(() => ['#5f7a45', '#6f8650', '#566b3d', '#7b8a58', '#4f6a3a'].map((c) => new THREE.Color(c)), [])

  return (
    <group name="courtyard-garden">
      {/* p09l: the courts are paved in grey stone round the trees, not bare soil */}
      <mesh geometry={layout.bed} material={tinted(core.stone, '#a7a29b', { roughness: 0.82 })} receiveShadow raycast={noRaycast} />
      {layout.pebbles.length > 0 && <Clumps spots={layout.pebbles} material={pebbleMat} seed={3} detail={0} colors={layout.pebbleColors} />}
      {layout.boulders.length > 0 && (
        <SourcedInstances slug={boulderSlug} spots={layout.boulders} fallback={<Clumps spots={layout.boulders} material={core.stone} seed={9} detail={1} />} />
      )}
      {layout.accents.length > 0 && <SourcedInstances slug={resolveSlug('ph-rock-07')} spots={layout.accents} fallback={null} />}
      {layout.shrubs.length > 0 && (
        <SourcedInstances slug={shrubSlug} spots={layout.shrubs} fallback={<Clumps spots={layout.shrubs} material={leafMaterial('#ffffff')} seed={seed + 5} detail={1} colors={shrubColors} />} />
      )}
      {treeGroups.map((g, i) => (
        <SourcedInstances
          key={i}
          slug={g.slug}
          spots={g.spots}
          fallback={
            <>
              {g.spots.map((s, k) => (
                <ProceduralTree key={k} p={s.p} h={s.h} seed={s.seed} rotY={s.rotY} lo={lo} />
              ))}
            </>
          }
        />
      ))}
      {layout.basinAt && (
        <group position={[layout.basinAt[0], 0, layout.basinAt[1]]}>
          <SourcedOr slug={resolveSlug('wc-hotei-water-basin')} fit={{ h: 1.0 }} fallback={<StoneBasin />} />
        </group>
      )}
    </group>
  )
}

/** Fallback basin: a low carved stone bowl holding still water. */
function StoneBasin() {
  const core = useMaterials()
  const geo = useMemo(() => {
    const g = new THREE.LatheGeometry(
      [
        [0, 0],
        [0.42, 0],
        [0.5, 0.2],
        [0.52, 0.55],
        [0.48, 0.62],
        [0.4, 0.6],
        [0.36, 0.5],
        [0, 0.48],
      ].map(([r, y]) => new THREE.Vector2(r, y)),
      40,
    )
    const water = new THREE.CircleGeometry(0.37, 32)
    water.rotateX(-Math.PI / 2)
    water.translate(0, 0.56, 0)
    return { g, water }
  }, [])
  useEffect(() => () => {
    geo.g.dispose()
    geo.water.dispose()
  }, [geo])
  return (
    <>
      <mesh geometry={geo.g} material={core.stone} castShadow receiveShadow raycast={noRaycast} />
      <mesh geometry={geo.water} material={core.glass} raycast={noRaycast} />
    </>
  )
}
