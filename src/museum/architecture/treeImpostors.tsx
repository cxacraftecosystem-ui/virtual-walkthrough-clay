/**
 * Far trees as impostors of the sourced Searsia (GRAND §2.7, §5): each of the three Poly Haven
 * variants is drawn once, side-on, into a small texture at load, and the far belt stands as
 * crossed cut-out cards wearing those pictures — the same trees the near and mid belts show, at
 * a few triangles each, instead of procedural crowns on sticks.
 *
 * The capture is lit evenly (the card takes the scene's own light and fog); the cards' normals
 * point up, so the sun lights the belt as it lights the ground round it.
 */
import { useGLTF } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { Suspense, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { SOURCED_REGISTRY } from '../config/sourcedRegistry.generated'
import { cutOutTwigCards } from '../materials/foliage'
import { withHaze } from './exteriorHaze'
import type { Planting } from './sourcedInstances'

const SIZE = 384

/** Two crossed vertical cards, 1 wide × 1 tall, standing on y 0, normals up. */
function crossedCards(): THREE.BufferGeometry {
  const pos: number[] = []
  const uv: number[] = []
  const nor: number[] = []
  const idx: number[] = []
  for (let k = 0; k < 2; k++) {
    const a = (k * Math.PI) / 2
    const cx = Math.cos(a) * 0.5
    const cz = Math.sin(a) * 0.5
    const b = pos.length / 3
    pos.push(-cx, 0, -cz, cx, 0, cz, cx, 1, cz, -cx, 1, -cz)
    uv.push(0, 0, 1, 0, 1, 1, 0, 1)
    for (let i = 0; i < 4; i++) nor.push(0, 1, 0)
    idx.push(b, b + 1, b + 2, b, b + 2, b + 3)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3))
  g.setIndex(idx)
  return g
}

/** One horizontal card, 1 × 1, at y 0, normal up (the crown seen from above). */
function topCard(): THREE.BufferGeometry {
  const g = new THREE.PlaneGeometry(1, 1)
  g.rotateX(-Math.PI / 2)
  return g
}

/**
 * Render a model into a square texture, side-on (or from above, `top`); returns it with the
 * model's width / height ratio (from above: its crown's width / height). Leaves are captured with
 * a low cut-out threshold, so the card's crown is a dense canopy, never a few spindly twigs.
 */
function capture(gl: THREE.WebGLRenderer, model: THREE.Object3D, top = false): { tex: THREE.Texture; aspect: number; crownY: number } {
  const root = model.clone(true)
  const made: THREE.Material[] = []
  root.traverse((o) => {
    const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined
    if (m && (m.transparent || m.alphaTest > 0)) {
      const c = m.clone()
      c.transparent = false
      c.alphaTest = 0.18
      c.side = THREE.DoubleSide
      made.push(c)
      ;(o as THREE.Mesh).material = c
    } else if (m) {
      // twig cards authored opaque (materials/foliage.ts): cut out, or the card is a dark sheet
      const c = m.clone()
      if (cutOutTwigCards(c)) {
        made.push(c)
        ;(o as THREE.Mesh).material = c
      } else c.dispose()
    }
  })
  const box = new THREE.Box3().setFromObject(root)
  const size = box.getSize(new THREE.Vector3())
  const c = box.getCenter(new THREE.Vector3())
  const half = top ? Math.max(size.x, size.z) / 2 : Math.max(size.x, size.y) / 2
  const cam = new THREE.OrthographicCamera(-half, half, half, -half, 0.01, 1000)
  if (top) {
    cam.position.set(c.x, box.max.y + 50, c.z)
    cam.up.set(0, 0, -1)
  } else cam.position.set(c.x, c.y, box.max.z + 50)
  cam.lookAt(c.x, c.y, c.z)
  const scene = new THREE.Scene()
  scene.add(root)
  scene.add(new THREE.AmbientLight('#ffffff', 1.6))
  const sun = new THREE.DirectionalLight('#ffffff', 1.4)
  sun.position.set(0.4, 1, 0.8)
  scene.add(sun)
  const rt = new THREE.WebGLRenderTarget(SIZE, SIZE, { samples: 4 })
  rt.texture.colorSpace = THREE.SRGBColorSpace
  const prevTarget = gl.getRenderTarget()
  const prevClear = gl.getClearColor(new THREE.Color())
  const prevAlpha = gl.getClearAlpha()
  const prevTone = gl.toneMapping
  gl.toneMapping = THREE.NoToneMapping
  gl.setRenderTarget(rt)
  gl.setClearColor('#000000', 0)
  gl.clear()
  gl.render(scene, cam)
  gl.setRenderTarget(prevTarget)
  gl.setClearColor(prevClear, prevAlpha)
  gl.toneMapping = prevTone
  made.forEach((m) => m.dispose())
  return { tex: rt.texture, aspect: (top ? Math.max(size.x, size.z) : size.x) / Math.max(1e-3, size.y), crownY: size.y * 0.62 }
}

function Belt({ slug, items }: { slug: string; items: Planting[] }) {
  const entry = SOURCED_REGISTRY[slug]
  const { scene } = useGLTF(entry.lod1 ?? entry.url, true, true)
  const gl = useThree((s) => s.gl)
  const height = entry.bbox[4] - entry.bbox[1]
  const card = useMemo(() => capture(gl, scene), [gl, scene])
  const crown = useMemo(() => capture(gl, scene, true), [gl, scene])
  const geo = useMemo(() => crossedCards(), [])
  const geoTop = useMemo(() => topCard(), [])
  // the far woods recede into the horizon's haze with the terrain (exteriorHaze.ts)
  const mat = useMemo(() => withHaze(new THREE.MeshStandardMaterial({ name: 'treeImpostor', map: card.tex, alphaTest: 0.32, side: THREE.DoubleSide, roughness: 1, metalness: 0 })), [card])
  // the crown from above (aerial and roof views): the canopy, not two crossed cards seen edge-on.
  // One-sided (facing up): seen from below, from the ground beside a near tree (Low draws the
  // near belt and the avenue as cards), the picture of a crown's top drew as an opaque black blob
  const matTop = useMemo(() => withHaze(new THREE.MeshStandardMaterial({ name: 'treeImpostorTop', map: crown.tex, alphaTest: 0.32, side: THREE.FrontSide, roughness: 1, metalness: 0 })), [crown])
  useEffect(
    () => () => {
      mat.dispose()
      matTop.dispose()
      geo.dispose()
      geoTop.dispose()
      card.tex.dispose()
      crown.tex.dispose()
    },
    [mat, matTop, geo, geoTop, card, crown],
  )
  const ref = useRef<THREE.InstancedMesh>(null)
  const refTop = useRef<THREE.InstancedMesh>(null)
  useLayoutEffect(() => {
    const im = ref.current
    if (!im) return
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const up = new THREE.Vector3(0, 1, 0)
    items.forEach((it, i) => {
      const h = height * it.scale
      q.setFromAxisAngle(up, it.rot)
      m.compose(new THREE.Vector3(it.x, it.y, it.z), q, new THREE.Vector3(h * card.aspect, h, h * card.aspect))
      im.setMatrixAt(i, m)
    })
    im.instanceMatrix.needsUpdate = true
    im.computeBoundingSphere()
    const im2 = refTop.current
    if (!im2) return
    items.forEach((it, i) => {
      const w = height * it.scale * crown.aspect * 0.9
      q.setFromAxisAngle(up, it.rot)
      m.compose(new THREE.Vector3(it.x, it.y + crown.crownY * it.scale, it.z), q, new THREE.Vector3(w, 1, w))
      im2.setMatrixAt(i, m)
    })
    im2.instanceMatrix.needsUpdate = true
    im2.computeBoundingSphere()
  }, [items, height, card, crown])
  return (
    <group>
      <instancedMesh ref={ref} args={[geo, mat, items.length]} raycast={() => null} />
      <instancedMesh ref={refTop} args={[geoTop, matTop, items.length]} raycast={() => null} />
    </group>
  )
}

/** The far belt: impostors of the sourced trees, one instanced draw per variant. */
export function TreeImpostors({ slugs, sets }: { slugs: readonly string[]; sets: Planting[][] }) {
  return (
    <group name="far-belt">
      {slugs.map((slug, i) =>
        SOURCED_REGISTRY[slug] && sets[i]?.length ? (
          <Suspense key={slug} fallback={null}>
            <Belt slug={slug} items={sets[i]} />
          </Suspense>
        ) : null,
      )}
    </group>
  )
}
