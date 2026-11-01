/**
 * FOLIAGE — leaf cards lit as a canopy. A sourced tree's leaves are alpha cut-out cards whose own
 * normals flip from lit to black as they turn, and whose back faces go black against the sun: up
 * close they read as big dark paper shapes. `foliageNormals` points every leaf vertex's normal out
 * from the crown's middle (biased up), and `foliageShading` stops the back face flipping it, so a
 * crown takes the light as one soft mass, the way a real canopy reads.
 */
import * as THREE from 'three'

/** A copy of a leaf geometry with crown-shaped normals (the caller owns it). */
export function foliageNormals(src: THREE.BufferGeometry): THREE.BufferGeometry {
  const g = src.clone()
  const p = g.getAttribute('position')
  g.computeBoundingBox()
  const c = g.boundingBox!.getCenter(new THREE.Vector3())
  const size = g.boundingBox!.getSize(new THREE.Vector3())
  const n = new Float32Array(p.count * 3)
  const v = new THREE.Vector3()
  const old = g.getAttribute('normal')
  const o = new THREE.Vector3()
  for (let i = 0; i < p.count; i++) {
    v.set((p.getX(i) - c.x) / Math.max(size.x, 1e-3), (p.getY(i) - c.y) / Math.max(size.y, 1e-3), (p.getZ(i) - c.z) / Math.max(size.z, 1e-3))
    v.normalize()
    v.y += 0.55
    if (old) {
      o.set(old.getX(i), old.getY(i), old.getZ(i)).normalize()
      // keep a little of the card's own facing, for leaf-to-leaf variation
      v.addScaledVector(o, 0.25 * Math.sign(o.dot(v) || 1))
    }
    v.normalize()
    n.set([v.x, v.y, v.z], i * 3)
  }
  g.setAttribute('normal', new THREE.BufferAttribute(n, 3))
  return g
}

/** Patch a leaf material (in place): both faces of a card share the crown normal. */
export function foliageShading<M extends THREE.Material>(mat: M): M {
  const prev = mat.onBeforeCompile
  mat.onBeforeCompile = (sh, r) => {
    prev.call(mat, sh, r)
    sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_begin>', THREE.ShaderChunk.normal_fragment_begin.replace('float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;', 'float faceDirection = 1.0;'))
  }
  const prevKey = mat.customProgramCacheKey.bind(mat)
  mat.customProgramCacheKey = () => `${prevKey()}|foliage`
  mat.needsUpdate = true
  return mat
}

/** A leaf material as an alpha-tested, double-sided canopy (a new material; the caller owns it). */
export function foliageMaterial(src: THREE.Material, gain = 1.25, alphaTest = 0.4): THREE.Material {
  const m = src.clone() as THREE.MeshStandardMaterial
  m.transparent = false
  m.depthWrite = true
  m.alphaTest = alphaTest
  m.side = THREE.DoubleSide
  if (m.color) m.color.multiplyScalar(gain)
  return foliageShading(m)
}

/** Is this material a leaf card (alpha blended or cut out)? */
export const isLeaf = (m: THREE.Material) => m.transparent || m.alphaTest > 0

/**
 * Twig cards: Poly Haven's trees carry their fine branches as textured cards whose material is
 * authored opaque (no alpha mode), so the card's empty texels draw as big dark sheets. Cut them
 * out by their texture's alpha (a bark texture's alpha is 1 everywhere, so real branches keep
 * every texel). Patches `m` in place; returns whether it did.
 */
export function cutOutTwigCards(m: THREE.Material): boolean {
  const s = m as THREE.MeshStandardMaterial
  if (!s.map || isLeaf(m) || !/branch|twig/i.test(m.name)) return false
  s.alphaTest = 0.5
  s.side = THREE.DoubleSide
  s.needsUpdate = true
  return true
}
