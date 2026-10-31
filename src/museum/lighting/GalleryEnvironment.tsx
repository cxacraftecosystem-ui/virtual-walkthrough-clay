/**
 * Synchronous light-former environment (reflections + soft irradiance).
 *
 * Built with PMREMGenerator at mount — before the async shader precompile — so every
 * material compiles once with its final env-map variant (drei's <Environment frames>
 * renders on the first frame, which forced a second full round of shader compiles).
 * Uses only emissive panels: no network HDRIs.
 */
import { useThree } from '@react-three/fiber'
import { useLayoutEffect } from 'react'
import * as THREE from 'three'
import { LIGHTING } from '../config/lighting'
import { MUSEUM } from '../config/museum'
import { makePMREM } from '../utils/renderer'

interface Former {
  color: string
  intensity: number
  position: [number, number, number]
  rotation?: [number, number, number]
  size: [number, number]
}

/**
 * Panels matching the round pavilion: the bright open oculus overhead, a ring of twelve
 * rose-clay wall panels below the duplex band and paler blush ones above it, the warm
 * soffit, and the burnished earth floor. Reflections on the burnished podiums, the black
 * Longpi pieces and the floor pick up this warm, round surround.
 */
const R = MUSEUM.drum.ringR
const CH = MUSEUM.pavilion.ceilingHeight
const OC = MUSEUM.oculus.r * 1.8
const BAND = MUSEUM.pavilion.mezzanineBand
const ring = (n: number, y: number, h: number, color: string, intensity: number) =>
  Array.from({ length: n }, (_, i): Former => {
    const a = (i / n) * Math.PI * 2
    return { color, intensity, position: [Math.cos(a) * R, y, Math.sin(a) * R], rotation: [0, -a - Math.PI / 2, 0], size: [((Math.PI * 2 * R) / n) * 1.04, h] }
  })
const FORMERS: Former[] = [
  { color: '#eef4fb', intensity: 7, position: [0, CH + 1.4, 0], rotation: [Math.PI / 2, 0, 0], size: [OC, OC] },
  ...ring(12, BAND / 2, BAND, '#d99a88', 0.75),
  ...ring(12, BAND + (CH - BAND) / 2, CH - BAND, '#ecc2b3', 0.9),
  { color: '#e7c3b2', intensity: 0.35, position: [0, CH + 0.1, 0], rotation: [Math.PI / 2, 0, 0], size: [R * 2, R * 2] },
  { color: '#c99a80', intensity: 0.9, position: [0, -0.4, 0], rotation: [-Math.PI / 2, 0, 0], size: [R * 2, R * 2] },
]

export function GalleryEnvironment() {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)

  useLayoutEffect(() => {
    const env = new THREE.Scene()
    env.background = new THREE.Color('#6d5a52')
    const plane = new THREE.PlaneGeometry(1, 1)
    const mats: THREE.Material[] = []
    for (const f of FORMERS) {
      const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(f.color).multiplyScalar(f.intensity), side: THREE.DoubleSide, toneMapped: false })
      mats.push(mat)
      const mesh = new THREE.Mesh(plane, mat)
      mesh.position.set(...f.position)
      if (f.rotation) mesh.rotation.set(...f.rotation)
      mesh.scale.set(f.size[0], f.size[1], 1)
      env.add(mesh)
    }
    const pmrem = makePMREM(gl)
    // Probe from roughly the visitor's eye position in the gallery ring.
    const target = pmrem.fromScene(env, 0.02, 0.1, 100, { position: new THREE.Vector3(0, 1.6, -5) })
    pmrem.dispose()
    plane.dispose()
    mats.forEach((m) => m.dispose())

    const prev = scene.environment
    scene.environment = target.texture
    scene.environmentIntensity = LIGHTING.ambient.environmentIntensity
    return () => {
      scene.environment = prev
      target.dispose()
    }
  }, [gl, scene])

  return null
}
