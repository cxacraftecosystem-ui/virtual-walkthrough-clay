/**
 * GLB/glTF scene-object loader.
 *
 * - Loads with drei `useGLTF` (cached per URL).
 * - Bakes node transforms and MERGES primitives that share a material, so a model costs
 *   one draw call per material however many nodes it has (Poly Haven plants: 4 → 2).
 *   The merged set is cached per URL and shared by every placement (no scene clones).
 * - Fits it: scale = `modelScale`, else `height / bbox height` (else 1); bottom at y = 0,
 *   centred on the footprint origin. Shadows on.
 * - Optimised files (scripts/optimize-assets.mjs → public/models/opt/) use EXT_meshopt_compression +
 *   KHR_mesh_quantization + EXT_texture_webp: drei's useGLTF enables MeshoptDecoder by default, and
 *   quantised attributes are converted to float before transforms are baked. Legacy Poly Haven paths
 *   (content stored in the DB before the switch) are mapped to their optimised GLB.
 * - `material` replaces every part's material (the sourced models' clay finishes, GRAND §5.2);
 *   `useMergedModel` hands the merged parts to the instance batcher (models/sourcedModel.tsx).
 */
import { useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { atmosKey, injectAtmosphere } from '../lighting/atmosphere/inject'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

export interface MergedModel {
  parts: { geometry: THREE.BufferGeometry; material: THREE.Material }[]
  box: THREE.Box3
}

const merged = new Map<string, MergedModel>()

/** '/models/cc0/<id>/<id>_1k.gltf' → '/models/opt/cc0/<id>.glb' (verified by scripts/verify-optimized-models.mjs). */
export function resolveModelUrl(url: string) {
  const m = /^\/models\/cc0\/([\w-]+)\/\1_1k\.gltf$/.exec(url)
  return m ? `/models/opt/cc0/${m[1]}.glb` : url
}

/** Quantised (normalized int) attributes → Float32, so applyMatrix4 cannot clamp and merges match. */
function dequantize(g: THREE.BufferGeometry) {
  for (const [name, a] of Object.entries(g.attributes)) {
    // meshopt output is often interleaved (int16 vec3 padded to an 8-byte stride)
    if (a instanceof THREE.BufferAttribute && a.array instanceof Float32Array) continue
    const out = new Float32Array(a.count * a.itemSize)
    for (let i = 0; i < a.count; i++) for (let k = 0; k < a.itemSize; k++) out[i * a.itemSize + k] = a.getComponent(i, k)
    g.setAttribute(name, new THREE.BufferAttribute(out, a.itemSize))
  }
  return g
}

/**
 * A vertex normal of zero length (some exported scans carry a few) normalises to NaN in the shader, and the
 * post-processing bloom smears one NaN pixel over the whole frame, blacking out the museum. Such a vertex takes
 * the area-weighted normal of its triangles (straight up if it has none); every valid normal is left alone.
 */
function repairZeroNormals(g: THREE.BufferGeometry) {
  const n = g.getAttribute('normal') as THREE.BufferAttribute | undefined
  if (!n) return
  let bad: Map<number, THREE.Vector3> | null = null
  for (let v = 0; v < n.count; v++) {
    if (Math.hypot(n.getX(v), n.getY(v), n.getZ(v)) > 1e-6) continue
    ;(bad ??= new Map()).set(v, new THREE.Vector3())
  }
  if (!bad) return
  const p = g.getAttribute('position')
  const idx = g.index
  const [a, b, c, f] = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()]
  const count = idx ? idx.count : p.count
  for (let t = 0; t + 2 < count; t += 3) {
    const tri = idx ? [idx.getX(t), idx.getX(t + 1), idx.getX(t + 2)] : [t, t + 1, t + 2]
    if (!tri.some((v) => bad.has(v))) continue
    a.fromBufferAttribute(p, tri[0])
    b.fromBufferAttribute(p, tri[1]).sub(a)
    c.fromBufferAttribute(p, tri[2]).sub(a)
    f.crossVectors(b, c)
    for (const v of tri) bad.get(v)?.add(f)
  }
  for (const [v, s] of bad) {
    if (s.lengthSq() > 0) s.normalize()
    else s.set(0, 1, 0)
    n.setXYZ(v, s.x, s.y, s.z)
  }
  n.needsUpdate = true
}

function mergeScene(url: string, scene: THREE.Object3D): MergedModel {
  const hit = merged.get(url)
  if (hit) return hit
  scene.updateMatrixWorld(true)
  const groups = new Map<THREE.Material, THREE.BufferGeometry[]>()
  scene.traverse((o) => {
    const mesh = o as THREE.Mesh
    if (!mesh.isMesh || (mesh as unknown as THREE.SkinnedMesh).isSkinnedMesh) return
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    if (mats.length !== 1) return
    const g = dequantize(mesh.geometry.clone())
    g.applyMatrix4(mesh.matrixWorld)
    // scans exported without normals would render flat black under a finish
    if (!g.getAttribute('normal')) g.computeVertexNormals()
    else repairZeroNormals(g)
    let list = groups.get(mats[0])
    if (!list) groups.set(mats[0], (list = []))
    list.push(g)
  })
  const parts: MergedModel['parts'] = []
  const box = new THREE.Box3()
  for (const [material, list] of groups) {
    let geos = list
    if (list.length > 1) {
      // keep only the attributes every primitive has, and a consistent index state
      const common = Object.keys(list[0].attributes).filter((k) => list.every((g) => !!g.attributes[k]))
      const indexed = list.every((g) => !!g.index)
      geos = list.map((g) => {
        for (const k of Object.keys(g.attributes)) if (!common.includes(k)) g.deleteAttribute(k)
        g.morphAttributes = {}
        return indexed ? g : g.index ? g.toNonIndexed() : g
      })
    }
    const m = geos.length === 1 ? geos[0] : mergeGeometries(geos, false)
    if (m) {
      m.computeBoundingBox()
      m.computeBoundingSphere()
      box.union(m.boundingBox!)
      parts.push({ geometry: m, material })
    } else {
      for (const g of geos) {
        g.computeBoundingBox()
        box.union(g.boundingBox!)
        parts.push({ geometry: g, material })
      }
    }
    const mat = material as THREE.MeshStandardMaterial
    // Poly Haven foliage uses alpha MASK: make sure shadows respect it
    if (mat.alphaTest > 0) mat.side = THREE.DoubleSide
    // A transmissive glTF material (KHR_materials_transmission, e.g. a lantern's glass) makes
    // three.js render every opaque object a second time into a transmission target, every
    // frame, for the whole scene. Plain alpha reads the same at gallery distance.
    const phys = material as THREE.MeshPhysicalMaterial
    if (phys.transmission > 0) {
      phys.transmission = 0
      phys.transparent = true
      phys.opacity = Math.min(phys.opacity, 0.35)
      phys.depthWrite = false
    }
  }
  const res = { parts, box }
  merged.set(url, res)
  return res
}

export interface GLTFModelProps {
  url: string
  /** Explicit uniform scale (wins over `height`). */
  scale?: number
  /** Target height (m) when `scale` is absent. */
  height?: number
  /** One material for every part (a sourced model's clay finish, materials/sourcedFinish.ts). */
  material?: THREE.Material | null
  castShadow?: boolean
  /**
   * A key light of its own (in the museum): the parts draw with their own copies of the materials, each lit by
   * one cone aimed at this placement from above and in front (lighting/atmosphere/inject.ts USE_ATMOS_KEY), so
   * every model is lit whatever the room's shared accent cones are on.
   */
  keyLight?: boolean
}

/** The key's irradiance at the model's centre (the atmosphere's units; an accent cone gives a piece about 12). */
const KEY_E = 9
/** Warm white, about 3600 K. */
const KEY_COLOR = new THREE.Color('#fff0dc')
const _c = new THREE.Vector3()
const _size = new THREE.Vector3()
const _front = new THREE.Vector3()
const _pos = new THREE.Vector3()
const _dir = new THREE.Vector3()
const _box = new THREE.Box3()

/** Aim a placement's key from its world bounds: above and in front of it (its +z), the cone just covering it. */
function aimKey(g: THREE.Object3D, mats: THREE.Material[]) {
  _box.setFromObject(g)
  if (_box.isEmpty()) return
  _box.getCenter(_c)
  _box.getSize(_size)
  const H = Math.max(0.05, _size.y)
  const R = Math.max(_size.x, _size.z) / 2
  _front.set(0, 0, 1).transformDirection(g.matrixWorld)
  _front.y = 0
  if (_front.lengthSq() < 1e-6) _front.set(0, 0, 1)
  _front.normalize()
  _pos.copy(_c).addScaledVector(_front, R + 0.6 + 0.5 * H)
  _pos.y += 0.7 * H + 1.0
  const d = _pos.distanceTo(_c)
  const half = Math.min(Math.atan((Math.max(H, 2 * R) * 0.62) / d) * 1.2, 0.75)
  _dir.copy(_c).sub(_pos).normalize()
  const I = KEY_E * d * d
  for (const m of mats) {
    const k = atmosKey(m)
    if (!k) continue
    k.pos.value.set(_pos.x, _pos.y, _pos.z, 0)
    k.dir.value.set(_dir.x, _dir.y, _dir.z, Math.cos(half))
    k.col.value.set(KEY_COLOR.r * I, KEY_COLOR.g * I, KEY_COLOR.b * I, d * 2.5)
  }
}

/** The merged parts and bounds of a loaded GLB (cached per URL): for instancing (models/sourcedModel.tsx). */
export function useMergedModel(url: string): MergedModel {
  const src = resolveModelUrl(url)
  const { scene } = useGLTF(src, true, true)
  return useMemo(() => mergeScene(src, scene), [src, scene])
}

export function GLTFModel({ url, scale, height, material, castShadow = true, keyLight = false }: GLTFModelProps) {
  // Draco + meshopt decoders on: admin "3D scan import" output is EXT_meshopt_compression +
  // KHR_mesh_quantization + EXT_texture_webp (all handled by three-stdlib's GLTFLoader).
  const src = resolveModelUrl(url)
  const { scene } = useGLTF(src, true, true)
  const model = useMemo(() => mergeScene(src, scene), [src, scene])
  const fit = useMemo(() => {
    const size = model.box.getSize(new THREE.Vector3())
    const c = model.box.getCenter(new THREE.Vector3())
    const s = scale ?? (height && size.y > 1e-4 ? height / size.y : 1)
    return { s, offset: [-c.x * s, -model.box.min.y * s, -c.z * s] as [number, number, number] }
  }, [model, scale, height])
  // a keyed placement draws with its own copies (textures and programs shared): its key is its own
  const keyed = useMemo(() => {
    if (!keyLight) return null
    return model.parts.map((p) => {
      const m = (material ?? p.material).clone()
      injectAtmosphere(m, { key: true })
      return m
    })
  }, [keyLight, model, material])
  useEffect(() => () => keyed?.forEach((m) => m.dispose()), [keyed])
  const group = useRef<THREE.Group>(null)
  const aimed = useRef<THREE.Matrix4 | null>(null)
  // aimed before the first frame: a fresh placement (a scan swapping detail levels) never draws one frame unlit
  useLayoutEffect(() => {
    const g = group.current
    if (!g || !keyed) return
    g.updateWorldMatrix(true, true)
    aimKey(g, keyed)
    aimed.current = g.matrixWorld.clone()
  }, [keyed])
  useFrame(() => {
    const g = group.current
    if (!g || !keyed) return
    // aimed once its place is known, and again only if it moves (a curator's edit)
    if (aimed.current?.equals(g.matrixWorld)) return
    aimKey(g, keyed)
    aimed.current = g.matrixWorld.clone()
  })
  return (
    <group ref={group} position={fit.offset} scale={fit.s}>
      {model.parts.map((p, i) => (
        <mesh key={i} geometry={p.geometry} material={keyed ? keyed[i] : (material ?? p.material)} castShadow={castShadow} receiveShadow />
      ))}
    </group>
  )
}

/** Start fetching a model early (e.g. while the entry screen is up). */
export function preloadModel(url: string) {
  useGLTF.preload(resolveModelUrl(url), true, true)
}
