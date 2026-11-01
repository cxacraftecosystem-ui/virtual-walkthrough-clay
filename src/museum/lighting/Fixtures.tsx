/**
 * VISIBLE FIXTURES (GRAND §6.2 #4) — every accent cone of the field (config/accents.ts) has the
 * fixture it would have in a real museum, so the light reads as designed rather than magic:
 *
 *   sconce   the p02 podium photo's brass wall sconce: a plate on the ring wall, a short arm and a
 *            brass head aimed down at the piece (14, one over each podium)
 *   picture  a brass picture light on a stem from the balcony soffit, raking a B niche
 *   track    a black track head on a stem from the soffit, slab or ledge above it
 *   concealed nothing (the springing ledge, the light-well, the skylight hide their sources)
 *
 * Every head has a glowing lens (it blooms after dark). Instanced: six draws for all of them.
 */
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { buildAccents, type Accent } from '../config/accents'
import { kelvinToHex } from '../config/lighting'
import { SCENE_OBJECTS } from '../config/objects'

const HEAD_L = 0.17
const headGeo = new THREE.CylinderGeometry(0.042, 0.05, HEAD_L, 18, 1, false).rotateX(Math.PI / 2)
const lensGeo = new THREE.CircleGeometry(0.036, 18)
const stemGeo = new THREE.CylinderGeometry(0.007, 0.007, 1, 6).translate(0, 0.5, 0)
const plateGeo = new THREE.BoxGeometry(0.11, 0.24, 0.022)
const armGeo = new THREE.CylinderGeometry(0.011, 0.011, 1, 8).rotateX(Math.PI / 2).translate(0, 0, 0.5)

const brass = new THREE.MeshStandardMaterial({ name: 'fixtureBrass', color: '#a9844c', metalness: 0.85, roughness: 0.32 })
const black = new THREE.MeshStandardMaterial({ name: 'fixtureBlack', color: '#1e1b18', metalness: 0.35, roughness: 0.52 })
const lens = new THREE.MeshStandardMaterial({
  name: 'fixtureLens',
  color: '#fff4e2',
  emissive: new THREE.Color(kelvinToHex(3000)),
  emissiveIntensity: 3.4,
  roughness: 0.3,
})

const m4 = new THREE.Matrix4()
const q = new THREE.Quaternion()
const v = new THREE.Vector3()
const w = new THREE.Vector3()
const one = new THREE.Vector3(1, 1, 1)

function instanced(geo: THREE.BufferGeometry, mat: THREE.Material, mats: THREE.Matrix4[], name: string) {
  const mesh = new THREE.InstancedMesh(geo, mat, Math.max(1, mats.length))
  mats.forEach((m, i) => mesh.setMatrixAt(i, m))
  mesh.count = mats.length
  mesh.instanceMatrix.needsUpdate = true
  mesh.computeBoundingSphere()
  mesh.raycast = () => null
  mesh.name = name
  return mesh
}

/** The head's frame: at `pos`, its +z axis along the beam. */
function aimed(a: Accent, along = 0, scale = one) {
  v.set(a.target[0] - a.pos[0], a.target[1] - a.pos[1], a.target[2] - a.pos[2]).normalize()
  q.setFromUnitVectors(w.set(0, 0, 1), v)
  return new THREE.Matrix4().compose(new THREE.Vector3(a.pos[0], a.pos[1], a.pos[2]).addScaledVector(v, along), q.clone(), scale)
}

export function Fixtures() {
  const meshes = useMemo(() => {
    const accents = buildAccents(SCENE_OBJECTS).filter((a) => a.fixture !== 'concealed')
    const brassHeads: THREE.Matrix4[] = []
    const blackHeads: THREE.Matrix4[] = []
    const lenses: THREE.Matrix4[] = []
    const stems: THREE.Matrix4[] = []
    const plates: THREE.Matrix4[] = []
    const arms: THREE.Matrix4[] = []
    for (const a of accents) {
      ;(a.fixture === 'track' ? blackHeads : brassHeads).push(aimed(a))
      lenses.push(aimed(a, HEAD_L / 2 + 0.002))
      if (a.fixture === 'sconce' && a.wallNormal) {
        // plate on the wall behind the head, an arm out to it
        const [nx, nz] = a.wallNormal
        const wall = new THREE.Vector3(a.pos[0] - nx * 0.13, a.pos[1] + 0.04, a.pos[2] - nz * 0.13)
        q.setFromUnitVectors(w.set(0, 0, 1), v.set(nx, 0, nz))
        plates.push(new THREE.Matrix4().compose(wall, q.clone(), one))
        arms.push(new THREE.Matrix4().compose(wall, q.clone(), new THREE.Vector3(1, 1, 0.12)))
      } else {
        const top = a.stemTo ?? a.pos[1] + 0.12
        const len = Math.max(0.02, top - a.pos[1])
        stems.push(m4.clone().compose(new THREE.Vector3(a.pos[0], a.pos[1], a.pos[2]), q.identity().clone(), new THREE.Vector3(1, len, 1)))
      }
    }
    return [
      instanced(headGeo, brass, brassHeads, 'fixture-heads-brass'),
      instanced(headGeo, black, blackHeads, 'fixture-heads-black'),
      instanced(lensGeo, lens, lenses, 'fixture-lenses'),
      instanced(stemGeo, black, stems, 'fixture-stems'),
      instanced(plateGeo, brass, plates, 'fixture-sconce-plates'),
      instanced(armGeo, brass, arms, 'fixture-sconce-arms'),
    ]
  }, [])
  useEffect(() => () => meshes.forEach((m) => m.dispose()), [meshes])
  return (
    <group name="fixtures">
      {meshes.map((m) => (
        <primitive key={m.name} object={m} />
      ))}
    </group>
  )
}
