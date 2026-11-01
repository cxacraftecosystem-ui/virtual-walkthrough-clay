/**
 * <StaticObjectBatches/> — draws the still scene objects' meshes in batches (GRAND §10 draw calls).
 *
 * The staged crafts are hundreds of small procedural objects (podiums, brackets, plaques, vessels,
 * shelves, plinths), each a handful of meshes: drawn one by one they cost a draw call per mesh.
 * Objects of the kinds below never move a mesh after they are built, so their meshes are baked,
 * per zone, per 16 m cell of the plan and per material, into one geometry each (world transforms
 * applied, every attribute kept); the originals are hidden but stay in the scene, so the raycasts
 * that read them (walls, floors, the colliders' probes) are unchanged. Each zone's batches sit in
 * that zone's ZoneGroup, so the zone culling holds; the 16 m cells keep frustum culling useful.
 *
 * Other still groups join by a tag (`batchTag`): the track heads (lighting/TrackLight.tsx).
 *
 * Materials are shared, so what animates a material (a kiln's glow uniform, the light engine's
 * injection) animates the batch too. Interaction never reads the meshes: interactive objects
 * answer through their own invisible hit box (SceneObjects.tsx), which is never batched.
 *
 * The batches follow the scene: every BATCH_POLL_MS the candidate meshes' signature (mesh,
 * geometry, material, visibility) is compared with the last one, and the batches are rebuilt
 * when it changes — a model that finished loading a texture, a tier switch, edited content.
 */
import { useThree } from '@react-three/fiber'
import { useEffect, useMemo, useState } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { ZONES, type ZoneId } from '../config/layout'
import type { SceneObjectConfig } from '../config/objects'
import { ZoneGroup } from '../navigation/zoneCulling'

/** Kinds whose meshes never move, show or hide after they are built (no per-frame transform). */
export const STATIC_KINDS: ReadonlySet<SceneObjectConfig['kind']> = new Set<SceneObjectConfig['kind']>([
  'podium',
  'votive-plaque',
  'relief-register',
  'clay-vessel',
  'terracotta-horse',
  'ayyanar-horse',
  'wine-plinth',
  'round-plinth',
  'curved-shelf',
  'clay-shelf',
  'majuli-mask',
  'kumartuli-figure',
  'coil-pot',
  'eroded-formation',
  'garden-bench',
  'planter',
  'oculus-plinth',
  'perch-door',
  'kiln-window',
  'lippan-wall',
])

const BATCH_POLL_MS = 1500
/** Plan cell (m) that bounds a batch, so frustum culling still drops what is off screen. */
const CELL = 16
const BATCHED = '__batched'

const baseBeforeRender = THREE.Object3D.prototype.onBeforeRender

/** A mesh that may join a batch: plain, opaque, single-material, drawn in the normal order. */
function batchable(mesh: THREE.Mesh): boolean {
  if (!mesh.isMesh || (mesh as THREE.InstancedMesh).isInstancedMesh || (mesh as unknown as THREE.SkinnedMesh).isSkinnedMesh) return false
  if (Array.isArray(mesh.material) || !mesh.material || mesh.material.transparent) return false
  if (mesh.renderOrder !== 0 || !mesh.frustumCulled || mesh.onBeforeRender !== baseBeforeRender) return false
  const r3f = (mesh as unknown as { __r3f?: { handlers?: Record<string, unknown> } }).__r3f
  if (r3f?.handlers && Object.keys(r3f.handlers).length > 0) return false
  const g = mesh.geometry as THREE.BufferGeometry
  if (!g?.attributes.position || Object.keys(g.morphAttributes).length > 0) return false
  return true
}

/** Whether every ancestor up to (not including) `stop` is visible. */
function shownUpTo(o: THREE.Object3D, stop: THREE.Object3D): boolean {
  for (let p = o.parent; p && p !== stop; p = p.parent) if (!p.visible) return false
  return true
}

const attrKey = (g: THREE.BufferGeometry) =>
  Object.keys(g.attributes)
    .sort()
    .map((k) => {
      const a = g.attributes[k] as THREE.BufferAttribute
      return `${k}:${a.itemSize}:${a.normalized ? 1 : 0}:${a.array.constructor.name}`
    })
    .join(',')

interface Candidate {
  mesh: THREE.Mesh
  zone: ZoneId
  cell: string
}

/**
 * Tag a still group outside the scene objects (a fixture, say) for batching: its zone and plan
 * position. Spread it on the group as `userData`.
 */
export const batchTag = (zone: ZoneId | undefined, x: number, z: number) => (zone ? { [BATCH_ZONE]: zone, [BATCH_XZ]: [x, z] } : {})
const BATCH_ZONE = 'batchZone'
const BATCH_XZ = 'batchXZ'

/** Where a still group stands: a static scene object (groups named `object-<id>`) or a tagged group. */
function stillGroup(o: THREE.Object3D, byId: Map<string, SceneObjectConfig>): { zone: ZoneId; x: number; z: number } | null {
  const tagged = o.userData[BATCH_ZONE] as ZoneId | undefined
  if (tagged) {
    const [x, z] = o.userData[BATCH_XZ] as [number, number]
    return { zone: tagged, x, z }
  }
  if (!o.name.startsWith('object-')) return null
  const cfg = byId.get(o.name.slice('object-'.length))
  if (!cfg || cfg.model || !STATIC_KINDS.has(cfg.kind)) return null
  return { zone: cfg.zone as ZoneId, x: cfg.position[0], z: cfg.position[2] }
}

/** The meshes of the still groups under `root`. */
function candidates(root: THREE.Object3D, byId: Map<string, SceneObjectConfig>): Candidate[] {
  const out: Candidate[] = []
  const seen = new Set<THREE.Object3D>()
  root.traverse((o) => {
    const at = stillGroup(o, byId)
    if (!at) return
    const cell = `${Math.floor(at.x / CELL)}:${Math.floor(at.z / CELL)}`
    o.traverse((c) => {
      const mesh = c as THREE.Mesh
      if (!mesh.isMesh || seen.has(mesh) || !batchable(mesh)) return
      // a mesh the model hides itself stays out (a batched one was hidden by us)
      if (!mesh.visible && !mesh.userData[BATCHED]) return
      if (!shownUpTo(mesh, o)) return
      seen.add(mesh)
      out.push({ mesh, zone: at.zone, cell })
    })
  })
  return out
}

/** Mesh, geometry, material, visibility and where it stands (a re-aimed head moves its batch). */
const signature = (list: Candidate[]) =>
  list
    .map((c) => {
      const e = c.mesh.matrixWorld.elements
      return `${c.mesh.id}/${(c.mesh.geometry as THREE.BufferGeometry).id}/${(c.mesh.material as THREE.Material).uuid}/${c.mesh.visible ? 1 : 0}/${(e[0] + e[2] + e[8] + e[12] + e[13] + e[14]).toFixed(3)}`
    })
    .join('|')

/** Hand every batched mesh back (visible again, unflagged). */
function release(list: Candidate[]) {
  for (const { mesh } of list) {
    if (!mesh.userData[BATCHED]) continue
    mesh.visible = true
    delete mesh.userData[BATCHED]
  }
}

/** Build the batches into the zones' groups; returns the meshes it hid. */
function build(list: Candidate[], groups: Map<ZoneId, THREE.Group>): Candidate[] {
  const buckets = new Map<string, { zone: ZoneId; material: THREE.Material; cast: boolean; receive: boolean; items: Candidate[] }>()
  for (const c of list) {
    const m = c.mesh
    const g = m.geometry as THREE.BufferGeometry
    const key = `${c.zone}|${c.cell}|${(m.material as THREE.Material).uuid}|${m.castShadow}|${m.receiveShadow}|${g.index ? 'i' : 'n'}|${attrKey(g)}`
    let b = buckets.get(key)
    if (!b) buckets.set(key, (b = { zone: c.zone, material: m.material as THREE.Material, cast: m.castShadow, receive: m.receiveShadow, items: [] }))
    b.items.push(c)
  }
  const hidden: Candidate[] = []
  for (const b of buckets.values()) {
    if (b.items.length < 2) continue
    const group = groups.get(b.zone)
    if (!group) continue
    group.updateWorldMatrix(true, false)
    const inv = new THREE.Matrix4().copy(group.matrixWorld).invert()
    const geos = b.items.map(({ mesh }) => {
      const g = (mesh.geometry as THREE.BufferGeometry).clone()
      g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, mesh.matrixWorld))
      g.clearGroups()
      return g
    })
    const merged = mergeGeometries(geos, false)
    geos.forEach((g) => g.dispose())
    if (!merged) continue
    merged.computeBoundingSphere()
    const mesh = new THREE.Mesh(merged, b.material)
    mesh.name = `batch:${b.material.name || b.material.type}`
    mesh.castShadow = b.cast
    mesh.receiveShadow = b.receive
    mesh.raycast = () => null // the hidden originals answer raycasts
    group.add(mesh)
    for (const c of b.items) {
      c.mesh.visible = false
      c.mesh.userData[BATCHED] = true
      hidden.push(c)
    }
  }
  return hidden
}

function clear(groups: Map<ZoneId, THREE.Group>) {
  for (const g of groups.values())
    for (const child of [...g.children]) {
      g.remove(child)
      ;(child as THREE.Mesh).geometry?.dispose()
    }
}

/** Mount once, inside the scene, with the scene objects' list. */
export function StaticObjectBatches({ objects }: { objects: readonly SceneObjectConfig[] }) {
  const scene = useThree((s) => s.scene)
  const groups = useMemo(() => new Map<ZoneId, THREE.Group>(ZONES.map((z) => [z.id, Object.assign(new THREE.Group(), { name: `batches-${z.id}` })])), [])
  const [ready, setReady] = useState(false)

  useEffect(() => {
    setReady(true)
    const byId = new Map(objects.map((o) => [o.id, o]))
    let last = ''
    let hidden: Candidate[] = []
    const tick = () => {
      const r = scene
      const list = candidates(r, byId)
      const sig = signature(list)
      if (sig === last) return
      clear(groups)
      release(hidden)
      r.updateMatrixWorld(true)
      hidden = build(list, groups)
      // the signature after hiding, so the next poll sees the steady state
      last = signature(candidates(r, byId))
    }
    tick()
    const id = window.setInterval(tick, BATCH_POLL_MS)
    return () => {
      window.clearInterval(id)
      clear(groups)
      release(hidden)
    }
  }, [scene, objects, groups])

  if (!ready) return null
  return (
    <group name="static-batches">
      {[...groups].map(([zone, g]) => (
        <ZoneGroup key={zone} zones={[zone]}>
          <primitive object={g} />
        </ZoneGroup>
      ))}
    </group>
  )
}
