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
 * Panels matching the rotunda: the bright open oculus 20 m overhead, a ring of twelve darker
 * clay wall panels below the balcony and above it, the dim coffered dome, and the earth and
 * terrazzo floor (GRAND §6.2 "dark grounds": the environment fill is low, the accents carry).
 * Reflections on the burnished podiums, the black Longpi pieces and the floor pick up this warm,
 * round surround.
 */
const R = MUSEUM.drum.ringR
const CH = MUSEUM.dome.springY
const OC = MUSEUM.oculus.r * 1.8
const BAND = MUSEUM.pavilion.mezzanineBand
const ring = (n: number, y: number, h: number, color: string, intensity: number) =>
  Array.from({ length: n }, (_, i): Former => {
    const a = (i / n) * Math.PI * 2
    return { color, intensity, position: [Math.cos(a) * R, y, Math.sin(a) * R], rotation: [0, -a - Math.PI / 2, 0], size: [((Math.PI * 2 * R) / n) * 1.04, h] }
  })
/** The dome (GRAND §1.2): its oculus's lip and a dimmer coffered band between the springing and the lip. */
const DOME = MUSEUM.dome
const LIP = DOME.terraces[DOME.terraces.length - 1].y
const FORMERS: Former[] = [
  { color: '#eef4fb', intensity: 7, position: [0, LIP + 1.0, 0], rotation: [Math.PI / 2, 0, 0], size: [OC, OC] },
  ...ring(12, BAND / 2, BAND, '#b8705e', 0.45),
  ...ring(12, BAND + (CH - BAND) / 2, CH - BAND, '#c99484', 0.5),
  // the coffered dome: a low warm glow, darker than the walls (the dome's drama is its light)
  { color: '#b07a66', intensity: 0.22, position: [0, (DOME.springY + LIP) / 2, 0], rotation: [Math.PI / 2, 0, 0], size: [R * 1.6, R * 1.6] },
  { color: '#a8806a', intensity: 0.6, position: [0, -0.4, 0], rotation: [-Math.PI / 2, 0, 0], size: [R * 2, R * 2] },
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
