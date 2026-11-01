/**
 * 'sourced-model' — a 3D model found online (Poly Haven, Smithsonian Open Access, Wikimedia
 * Commons), optimised by scripts/optimize-sourced.mjs and named by its registry slug
 * (config/sourcedRegistry.generated.ts). GRAND §5.2.
 *
 *   slug    registry key; the model, its size and its credit come from the registry
 *   finish  'asis' keeps the file's own materials; a clay finish (materials/sourcedFinish.ts)
 *           dresses an untextured scan in one of the pavilion's bodies
 *   lod     true: LOD0 near the visitor, LOD1 beyond the tier's radius (Low: LOD1 only)
 *
 * The object's height (config.height, else the registry's) fits the model; origin at the base
 * centre, front +z as authored.
 *
 * Loading never shows a hole: until the GLB arrives (or if it fails) a soft clay silhouette of
 * the registry's bounding box stands in its place. Files stream by zone: the models of the
 * visitor's zone and of the zones seen from it load first, the entrance's during the entry
 * screen, the rest once the visit has settled (`SourcedStreamer`, mounted by the crafts mount).
 *
 * Three or more plain (non-interactive) placements of one slug and finish are drawn as one
 * instanced mesh per part (`SourcedBatches`); their own objects then draw nothing.
 */
import { useFrame, useThree } from '@react-three/fiber'
import { Suspense, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import * as THREE from 'three'
import { ZONE_VISIBILITY, zoneAt, type ZoneId } from '../config/layout'
import { SCENE_OBJECTS, type SceneObjectConfig } from '../config/objects'
import { SOURCED_REGISTRY, type SourcedEntry } from '../config/sourcedRegistry.generated'
import type { QualityTier } from '../config/quality'
import { sourcedFinishMaterial } from '../materials/sourcedFinish'
import { ZoneGroup } from '../navigation/zoneCulling'
import { perchZone } from '../navigation/perch'
import { useMuseum } from '../state/store'
import { visitor } from '../state/visitor'
import { ErrorBoundary } from '../utils/ErrorBoundary'
import { GLTFModel, preloadModel, useMergedModel } from './GLTFModel'
import { lathe } from './kit'
import { tinted, useModelMaterials } from './modelMaterials'
import { InMuseumScene } from './sceneContext'
import { str, type ModelProps } from './types'

/* ------------------------------------------------------------------ */
/* Registry helpers                                                    */
/* ------------------------------------------------------------------ */

export const sourcedOf = (slug: string | undefined): SourcedEntry | undefined => (slug ? SOURCED_REGISTRY[slug] : undefined)

/** Authored (registry) height of a slug, metres. */
export const sourcedHeight = (e: SourcedEntry) => e.bbox[4] - e.bbox[1]

/** Footprint [x, z] of a slug at `height` (default its own). */
export function sourcedFootprint(e: SourcedEntry, height = sourcedHeight(e)): [number, number] {
  const s = height / sourcedHeight(e)
  return [(e.bbox[3] - e.bbox[0]) * s, (e.bbox[5] - e.bbox[2]) * s]
}

/** LOD0 radius per tier (GRAND §10); Low draws LOD1 only. */
const LOD0_RADIUS: Record<QualityTier, number> = { low: 0, medium: 8, high: 14, ultra: 20 }

/* ------------------------------------------------------------------ */
/* Zone streaming                                                      */
/* ------------------------------------------------------------------ */

/** Zones whose sourced models may load now; null = all of them. */
let wanted: Set<ZoneId> | null = new Set<ZoneId>(['entrance-court', 'annex'])
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())
const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => {
    listeners.delete(l)
  }
}

function want(zones: Iterable<ZoneId>) {
  if (!wanted) return
  let grew = false
  for (const z of zones)
    if (!wanted.has(z)) {
      wanted.add(z)
      grew = true
    }
  if (grew) {
    // every url of the newly wanted zones starts loading at once (the components mount next)
    wanted = new Set(wanted)
    emit()
  }
}

function wantAll() {
  if (!wanted) return
  wanted = null
  emit()
}

/** Whether a model in `zone` may load (always, outside the museum scene). */
export function useStreamed(zone: ZoneId, inScene: boolean): boolean {
  return useSyncExternalStore(
    subscribe,
    () => !inScene || wanted === null || wanted.has(zone),
    () => false,
  )
}

/**
 * Keeps the wanted set in step with the visitor: the zone they stand in (or ride a perch in) and
 * every zone seen from it. Some seconds after Enter, once the first rooms have arrived, it lets
 * the rest load.
 */
export function SourcedStreamer() {
  const phase = useMuseum((s) => s.phase)
  const acc = useRef(0)
  useFrame((_, dt) => {
    acc.current += dt
    if (acc.current < 0.4 || wanted === null) return
    acc.current = 0
    const here = perchZone() ?? zoneAt(visitor.x, visitor.z)?.id
    if (here) want(ZONE_VISIBILITY[here] ?? [here])
  })
  useEffect(() => {
    if (phase !== 'entered') return
    const t = setTimeout(() => {
      const idle = (globalThis as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback
      if (idle) idle(wantAll, { timeout: 4000 })
      else wantAll()
    }, 9000)
    return () => clearTimeout(t)
  }, [phase])
  return null
}

/** For tests and shots: load everything now. */
export function streamAllSourced() {
  wantAll()
}

/* ------------------------------------------------------------------ */
/* Fallback: a soft clay silhouette of the bounding box                */
/* ------------------------------------------------------------------ */

const silhouettes = new Map<string, THREE.BufferGeometry>()

function silhouette(e: SourcedEntry, h: number): THREE.BufferGeometry {
  const [w, d] = sourcedFootprint(e, h)
  const key = `${w.toFixed(3)}|${d.toFixed(3)}|${h.toFixed(3)}`
  let g = silhouettes.get(key)
  if (!g) {
    const r = Math.max(0.02, Math.min(w, d) / 2)
    g = lathe(
      [
        [0, 0],
        [r * 0.78, 0],
        [r, h * 0.32],
        [r * 0.9, h * 0.7],
        [r * 0.62, h * 0.94],
        [r * 0.5, h],
        [0, h],
      ],
      20,
    )
    // an oval plan for long pieces (reliefs, benches)
    g.scale(w / Math.min(w, d), 1, d / Math.min(w, d))
    silhouettes.set(key, g)
  }
  return g
}

function Silhouette({ entry, height }: { entry: SourcedEntry; height: number }) {
  const m = useModelMaterials()
  const geo = silhouette(entry, height)
  const mat = tinted(m.terracotta, '#a98a72', { roughness: 1, transparent: true, opacity: 0.55, depthWrite: false })
  return <mesh geometry={geo} material={mat} />
}

/* ------------------------------------------------------------------ */
/* The model                                                           */
/* ------------------------------------------------------------------ */

/** Ids of the objects drawn by a batch (they render nothing themselves). */
const batched = new Set<string>()
let plan: Batch[] | null = null

/** The scene's batches, planned once from SCENE_OBJECTS (after the content has loaded). */
function batchPlan(): Batch[] {
  if (!plan) {
    plan = planBatches(SCENE_OBJECTS)
    for (const b of plan) for (const o of b.members) batched.add(o.id)
  }
  return plan
}

export function SourcedModel({ config }: ModelProps) {
  const inScene = useContext(InMuseumScene)
  const entry = sourcedOf(str(config, 'slug', ''))
  if (!entry) return <SlugMissing config={config} />
  if (inScene && (batchPlan(), batched.has(config.id))) return null
  return <SourcedResolved config={config} entry={entry} inScene={inScene} />
}

/** An unknown slug (a curator's typo, a model not yet optimised): the plain clay mass. */
function SlugMissing({ config }: ModelProps) {
  const m = useModelMaterials()
  const h = config.height ?? 0.4
  const [w, d] = config.footprint ?? [h * 0.6, h * 0.6]
  return (
    <mesh position={[0, h / 2, 0]} material={tinted(m.terracotta, '#a98a72', { roughness: 1 })}>
      <boxGeometry args={[w, h, d]} />
    </mesh>
  )
}

function SourcedResolved({ config, entry, inScene }: { config: SceneObjectConfig; entry: SourcedEntry; inScene: boolean }) {
  const tier = useMuseum((s) => s.tier)
  const finish = str(config, 'finish', entry.finish)
  const material = useMemo(() => sourcedFinishMaterial(finish, tier), [finish, tier])
  const height = config.height ?? sourcedHeight(entry)
  const lodOn = config.props?.lod !== false
  const streamed = useStreamed(config.zone as ZoneId, inScene)
  const near = useNear(config.position, inScene && lodOn ? LOD0_RADIUS[tier] : Infinity)
  const fallback = <Silhouette entry={entry} height={height} />
  if (!streamed) return fallback
  const far = <GLTFModel url={entry.lod1} height={height} material={material} />
  if (!near) return <Loaded key="lod1" fallback={fallback}>{far}</Loaded>
  // LOD0 loads behind LOD1 (which is small), so a swap never flashes the silhouette
  return (
    <Loaded key="lod0" fallback={fallback}>
      <Suspense fallback={far}>
        <GLTFModel url={entry.url} height={height} material={material} />
      </Suspense>
    </Loaded>
  )
}

function Loaded({ fallback, children }: { fallback: ReactNode; children: ReactNode }) {
  return (
    <ErrorBoundary fallback={fallback}>
      <Suspense fallback={fallback}>{children}</Suspense>
    </ErrorBoundary>
  )
}

/** Within `radius` of the camera (checked a few times a second, with 1 m of hysteresis). */
function useNear(position: [number, number, number], radius: number): boolean {
  const camera = useThree((s) => s.camera)
  const [near, setNear] = useState(() => radius === Infinity || Math.hypot(camera.position.x - position[0], camera.position.z - position[2]) < radius)
  const acc = useRef(Math.random() * 0.3)
  const state = useRef(near)
  useFrame((_, dt) => {
    if (radius === Infinity) {
      if (!state.current) setNear((state.current = true))
      return
    }
    acc.current += dt
    if (acc.current < 0.3) return
    acc.current = 0
    const d = Math.hypot(camera.position.x - position[0], camera.position.y - position[1], camera.position.z - position[2])
    const next = state.current ? d < radius + 1 : d < radius
    if (next !== state.current) setNear((state.current = next))
  })
  return near
}

/* ------------------------------------------------------------------ */
/* Instance batches                                                    */
/* ------------------------------------------------------------------ */

interface Batch {
  key: string
  entry: SourcedEntry
  finish: string
  members: SceneObjectConfig[]
  zones: ZoneId[]
}

/** Group the plain sourced placements of `objects` (≥ 3 of one slug and finish) into batches. */
export function planBatches(objects: readonly SceneObjectConfig[]): Batch[] {
  const groups = new Map<string, Batch>()
  for (const o of objects) {
    if (o.kind !== 'sourced-model' || o.interactive || o.inspectable) continue
    const entry = sourcedOf(str(o, 'slug', ''))
    if (!entry) continue
    const finish = str(o, 'finish', entry.finish)
    const key = `${str(o, 'slug', '')}|${finish}`
    let b = groups.get(key)
    if (!b) groups.set(key, (b = { key, entry, finish, members: [], zones: [] }))
    b.members.push(o)
    if (!b.zones.includes(o.zone)) b.zones.push(o.zone)
  }
  return [...groups.values()].filter((b) => b.members.length >= 3)
}

/** Draws every batch of the scene's objects; their objects step aside. Mount once, inside the scene. */
export function SourcedBatches() {
  const batches = batchPlan()
  return (
    <group name="sourced-batches">
      {batches.map((b) => (
        <ZoneGroup key={b.key} zones={b.zones}>
          <BatchStream batch={b} />
        </ZoneGroup>
      ))}
    </group>
  )
}

function BatchStream({ batch }: { batch: Batch }) {
  // a batch spans its members' zones: it loads when the first of them is wanted
  const anyWanted = useSyncExternalStore(
    subscribe,
    () => wanted === null || batch.zones.some((z) => wanted!.has(z)),
    () => false,
  )
  const tier = useMuseum((s) => s.tier)
  const material = useMemo(() => sourcedFinishMaterial(batch.finish, tier), [batch.finish, tier])
  if (!anyWanted) return null
  // batches are scenery (trees, rocks, pots in rows): LOD1 on Low, LOD0 from Medium up
  const url = tier === 'low' ? batch.entry.lod1 : batch.entry.url
  return (
    <ErrorBoundary fallback={null}>
      <Suspense fallback={null}>
        <BatchMesh url={url} batch={batch} material={material} />
      </Suspense>
    </ErrorBoundary>
  )
}

const _m = new THREE.Matrix4()
const _q = new THREE.Quaternion()
const _p = new THREE.Vector3()
const _s = new THREE.Vector3()
const _y = new THREE.Vector3(0, 1, 0)

function BatchMesh({ url, batch, material }: { url: string; batch: Batch; material: THREE.Material | null }) {
  const model = useMergedModel(url)
  const meshes = useRef<(THREE.InstancedMesh | null)[]>([])
  const fits = useMemo(() => {
    const size = model.box.getSize(new THREE.Vector3())
    const c = model.box.getCenter(new THREE.Vector3())
    return batch.members.map((o) => {
      const h = o.height ?? sourcedHeight(batch.entry)
      const s = size.y > 1e-4 ? h / size.y : 1
      return { o, s, off: new THREE.Vector3(-c.x * s, -model.box.min.y * s, -c.z * s) }
    })
  }, [model, batch])
  useEffect(() => {
    for (const mesh of meshes.current) {
      if (!mesh) continue
      fits.forEach(({ o, s, off }, i) => {
        _q.setFromAxisAngle(_y, ((o.rotationDeg ?? 0) * Math.PI) / 180)
        _p.copy(off).applyQuaternion(_q).add(_s.set(o.position[0], o.position[1], o.position[2]))
        _m.compose(_p, _q, _s.setScalar(s))
        mesh.setMatrixAt(i, _m)
      })
      mesh.instanceMatrix.needsUpdate = true
      mesh.computeBoundingSphere()
    }
  }, [fits])
  return (
    <>
      {model.parts.map((p, i) => (
        <instancedMesh
          key={i}
          ref={(m) => {
            meshes.current[i] = m
          }}
          args={[p.geometry, material ?? p.material, fits.length]}
          castShadow
          receiveShadow
        />
      ))}
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Preload and placement helpers                                       */
/* ------------------------------------------------------------------ */

/** Start fetching the entrance's sourced models (LOD1, and LOD0 above Low) during the entry screen. */
export function preloadEntranceSourced(objects: readonly SceneObjectConfig[], tier: QualityTier) {
  for (const o of objects) {
    if (o.kind !== 'sourced-model' || (o.zone !== 'entrance-court' && o.zone !== 'annex')) continue
    const e = sourcedOf(str(o, 'slug', ''))
    if (!e) continue
    preloadModel(e.lod1)
    if (tier !== 'low') preloadModel(e.url)
  }
}
