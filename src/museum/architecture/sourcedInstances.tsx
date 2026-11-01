/**
 * Planting from the sourced library (GRAND §5, §2.7): one optimised Poly Haven model
 * (config/sourcedRegistry.generated.ts) drawn many times as an InstancedMesh per part — the
 * landscape's Searsia belt, the crescents' planted roofs and berms.
 *
 * The models are quantised (KHR_mesh_quantization): each part's node transform is folded into
 * every instance's matrix. Leaf cards authored as alpha BLEND are drawn as alpha-tested cut-outs
 * (no sorting, they cast shadows). Until the model has loaded, or if its slug is missing from the
 * registry, the `fallback` is drawn instead (a procedural stand-in), so the scene never shows a hole.
 */
import { useGLTF } from '@react-three/drei'
import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, type ReactNode } from 'react'
import * as THREE from 'three'
import { SOURCED_REGISTRY } from '../config/sourcedRegistry.generated'

export interface Planting {
  x: number
  y: number
  z: number
  /** Rotation about y (radians) and uniform scale. */
  rot: number
  scale: number
}

interface Props {
  slug: string
  /** Use the registry's LOD1 (the far / many copies) or the full model. */
  lod1?: boolean
  items: Planting[]
  castShadow?: boolean
  receiveShadow?: boolean
  fallback?: ReactNode
  /** Leaf cards: a brightness gain on their colour and the cut-out threshold (lower = fuller crowns). */
  leaf?: { gain: number; alphaTest: number }
}

function Parts({ url, items, castShadow, receiveShadow, leaf }: { url: string; items: Planting[]; castShadow: boolean; receiveShadow: boolean; leaf?: Props['leaf'] }) {
  const { scene } = useGLTF(url, true, true)
  const parts = useMemo(() => {
    scene.updateMatrixWorld(true)
    const out: { geo: THREE.BufferGeometry; mat: THREE.Material; local: THREE.Matrix4 }[] = []
    scene.traverse((o) => {
      const mesh = o as THREE.Mesh
      if (!mesh.isMesh) return
      const src = mesh.material as THREE.MeshStandardMaterial
      const mat = src.clone()
      if (mat.transparent || mat.alphaTest > 0) {
        // leaves: alpha-tested cut-outs, both sides, no sorting
        mat.transparent = false
        mat.depthWrite = true
        mat.alphaTest = leaf?.alphaTest ?? 0.5
        mat.side = THREE.DoubleSide
        if (leaf) mat.color.multiplyScalar(leaf.gain)
      }
      out.push({ geo: mesh.geometry, mat, local: mesh.matrixWorld.clone() })
    })
    return out
  }, [scene, leaf])
  useEffect(() => () => parts.forEach((p) => p.mat.dispose()), [parts])
  return (
    <group>
      {parts.map((p, i) => (
        <PartInstances key={i} geo={p.geo} mat={p.mat} local={p.local} items={items} castShadow={castShadow} receiveShadow={receiveShadow} />
      ))}
    </group>
  )
}

function PartInstances({ geo, mat, local, items, castShadow, receiveShadow }: { geo: THREE.BufferGeometry; mat: THREE.Material; local: THREE.Matrix4; items: Planting[]; castShadow: boolean; receiveShadow: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  useLayoutEffect(() => {
    const im = ref.current
    if (!im) return
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const up = new THREE.Vector3(0, 1, 0)
    items.forEach((it, i) => {
      q.setFromAxisAngle(up, it.rot)
      m.compose(new THREE.Vector3(it.x, it.y, it.z), q, new THREE.Vector3(it.scale, it.scale, it.scale)).multiply(local)
      im.setMatrixAt(i, m)
    })
    im.instanceMatrix.needsUpdate = true
    im.computeBoundingSphere()
  }, [items, local])
  return <instancedMesh ref={ref} args={[geo, mat, items.length]} castShadow={castShadow} receiveShadow={receiveShadow} raycast={() => null} frustumCulled />
}

/** Many copies of one sourced model; the fallback until it loads (or if the slug is unknown). */
export function SourcedInstances({ slug, lod1 = true, items, castShadow = false, receiveShadow = true, fallback = null, leaf }: Props) {
  const entry = SOURCED_REGISTRY[slug]
  if (!entry || items.length === 0) return <>{fallback}</>
  return (
    <Suspense fallback={fallback}>
      <Parts url={lod1 ? entry.lod1 : entry.url} items={items} castShadow={castShadow} receiveShadow={receiveShadow} leaf={leaf} />
    </Suspense>
  )
}

/** The registry's height of a slug (m), or `fallback` when it is not there. */
export function sourcedHeight(slug: string, fallback = 1): number {
  const e = SOURCED_REGISTRY[slug]
  return e ? e.bbox[4] - e.bbox[1] : fallback
}
