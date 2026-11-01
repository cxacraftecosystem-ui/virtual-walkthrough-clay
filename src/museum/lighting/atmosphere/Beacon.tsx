/**
 * The festival's two lights in the sky (SPECTACLE F28, GRAND §6.2 #8):
 *   <AkashDeep>  a great sky lamp of pleated clay-paper hung in the oculus at y 18 on four cords
 *                from the light-well's lip; it carries glow point 1 of the shared injection, so the
 *                dome's upper coffers, the terraces and the pool catch its warmth with no light added.
 *   <Beacon>     a soft column of light rising from the oculus, for the outdoor view and the flight.
 * Both belong to a festival night only (`diya-field {akashDeep, beacon}`); mounted empty at start.
 */
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { kelvinToHex } from '../../config/lighting'
import { MUSEUM } from '../../config/museum'
import { perchZone } from '../../navigation/perch'
import { ZoneGroup } from '../../navigation/zoneCulling'
import { kindProps, spectacleSettings } from '../../spectacle/settings'
import { useMuseum } from '../../state/store'
import { SCENE_OBJECTS } from '../../config/objects'
import { visitor } from '../../state/visitor'
import { diyaNow } from '../diyas/diyaState'
import { ambience } from '../timeOfDayState'
import { GLOW_SLOT, ROOF_Y0, ROOF_Y1, setGlowPoint } from './inject'

/** The lamp hangs on the oculus axis, 2.4 m under the lip, large enough to read across a 32 m dome. */
const LAMP_Y = 18.0
const LAMP_R = 1.2
/** Where its cords meet the light-well's lip. */
const CORD_R = MUSEUM.oculus.r - 0.15

/** An eight-pointed star lantern: two pleated cones round a drum (≈ 200 triangles). */
function lanternGeometry() {
  const pts: THREE.Vector2[] = []
  const n = 9
  for (let i = 0; i <= n; i++) {
    const t = i / n
    // pleated profile: wide at the waist, pointed top and bottom
    const r = LAMP_R * Math.sin(Math.PI * t) ** 0.8 * (1 + 0.08 * Math.cos(t * Math.PI * 6))
    pts.push(new THREE.Vector2(Math.max(r, 0.001), -LAMP_R * 1.3 + t * LAMP_R * 2.6))
  }
  const g = new THREE.LatheGeometry(pts, 16)
  // star points: push alternate vertices out round the waist
  const p = g.getAttribute('position')
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i)
    const z = p.getZ(i)
    const a = Math.atan2(z, x)
    const k = 1 + 0.32 * Math.max(0, Math.cos(a * 8)) * (1 - Math.abs(p.getY(i)) / (LAMP_R * 1.3))
    p.setXYZ(i, x * k, p.getY(i), z * k)
  }
  g.computeVertexNormals()
  return g
}

/**
 * The lamp's glow through its paper: brightest round the waist where the flame sits behind it,
 * falling towards the points, with the pleats reading as faint ribs of light and shade.
 */
let glowTex: THREE.DataTexture | null = null
function paperGlow(): THREE.DataTexture {
  if (glowTex) return glowTex
  const W = 64
  const H = 64
  const d = new Uint8Array(W * H * 4)
  for (let j = 0; j < H; j++)
    for (let i = 0; i < W; i++) {
      const v = j / (H - 1)
      const u = i / (W - 1)
      const core = Math.pow(Math.sin(Math.PI * v), 1.6)
      const pleat = 0.78 + 0.22 * Math.cos(u * Math.PI * 32)
      const k = Math.min(1, (0.12 + 0.88 * core) * pleat)
      d.set([Math.round(255 * k), Math.round(255 * k), Math.round(255 * k), 255], (j * W + i) * 4)
    }
  glowTex = new THREE.DataTexture(d, W, H)
  glowTex.magFilter = THREE.LinearFilter
  glowTex.needsUpdate = true
  return glowTex
}

export function AkashDeep() {
  const on = kindProps('diya-field').akashDeep !== false
  const { group, paper, cords } = useMemo(() => {
    const paper = new THREE.MeshStandardMaterial({
      name: 'akashDeepPaper',
      color: '#f2d2b0',
      emissive: new THREE.Color(kelvinToHex(2100)),
      emissiveMap: paperGlow(),
      emissiveIntensity: 0,
      roughness: 0.9,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
    })
    const lamp = new THREE.Mesh(lanternGeometry(), paper)
    lamp.position.set(0, LAMP_Y, 0)
    lamp.raycast = () => null
    // the flame inside: a small bright core seen through the paper
    const core = new THREE.Mesh(new THREE.SphereGeometry(LAMP_R * 0.32, 16, 12), new THREE.MeshBasicMaterial({ name: 'akashDeepCore', color: new THREE.Color(kelvinToHex(2400)).multiplyScalar(3), transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }))
    core.position.set(0, LAMP_Y, 0)
    core.raycast = () => null
    // four cords up to the light-well's lip
    const cp: number[] = []
    for (let k = 0; k < 4; k++) {
      const a = (k * Math.PI) / 2 + Math.PI / 4
      cp.push(0, LAMP_Y + LAMP_R * 1.3, 0, Math.cos(a) * CORD_R, ROOF_Y0, Math.sin(a) * CORD_R)
    }
    const cg = new THREE.BufferGeometry()
    cg.setAttribute('position', new THREE.Float32BufferAttribute(cp, 3))
    const cords = new THREE.LineSegments(cg, new THREE.LineBasicMaterial({ name: 'akashDeepCord', color: '#3a2a20' }))
    cords.raycast = () => null
    const group = new THREE.Group()
    group.name = 'akash-deep'
    group.add(lamp, core, cords)
    return { group, paper, cords }
  }, [])
  useEffect(
    () => () => {
      group.traverse((o) => (o as THREE.Mesh).geometry?.dispose())
      paper.dispose()
      group.traverse((o) => {
        const mm = (o as THREE.Mesh).material as THREE.Material | undefined
        if (mm && mm !== paper && mm.name === 'akashDeepCore') mm.dispose()
      })
      ;(cords.material as THREE.Material).dispose()
    },
    [group, paper, cords],
  )
  const glow = useMemo(() => new THREE.Color(kelvinToHex(1900)), [])
  useFrame((state) => {
    const k = on ? diyaNow.festival : 0
    // stood down while the visitor looks down the light-well from the Sky Rim: the lamp would
    // fill the view of the lotus 20 m below (its glow on the dome stays)
    group.visible = !useMuseum.getState().sceneCompiled || (k > 0.01 && perchZone() !== 'sky-rim')
    // a slow turn on the air from the oculus (held still for reduced motion)
    if (spectacleSettings().mode !== 'still') group.rotation.y = state.clock.elapsedTime * 0.05
    paper.emissiveIntensity = 3.2 * k
    setGlowPoint(GLOW_SLOT.akashDeep, 0, LAMP_Y, 0, 6.0, glow, 3.2 * k)
  })
  return (
    <ZoneGroup zones={['inner']}>
      <primitive object={group} />
    </ZoneGroup>
  )
}

/**
 * The guardians' night light: the shared glow point 3 low between the two Ayyanar horses on the
 * forecourt, a warm ground wash that models their white flanks after dark (no light added). It
 * follows the night, festival or not; by day it is off.
 */
export function GuardianGlow() {
  const at = useMemo(() => {
    // only the forecourt's guardians: the small Ayyanar horses on shelves elsewhere must not pull
    // the centre (and the radius) across the whole site, which washed every room orange at night
    const hs = SCENE_OBJECTS.filter((o) => o.kind === 'ayyanar-horse' && o.zone === 'entrance-court')
    if (!hs.length) return null
    const x = hs.reduce((s, o) => s + o.position[0], 0) / hs.length
    const z = hs.reduce((s, o) => s + o.position[2], 0) / hs.length
    const spread = Math.max(...hs.map((o) => Math.hypot(o.position[0] - x, o.position[2] - z)))
    return { x, z, r: spread + 4 }
  }, [])
  const col = useMemo(() => new THREE.Color(kelvinToHex(2600)), [])
  useFrame(() => {
    // the spare slot is shared with the throat of the kiln (H's glow): the guardians have it
    // while the visitor is outside the annex's door
    if (!at || visitor.z < MUSEUM.annex.endZ) return
    setGlowPoint(GLOW_SLOT.spare, at.x, 0.6, at.z + 1.5, at.r, col, 2.4 * ambience.night)
  })
  return null
}

const BEACON_H = 60

export function Beacon() {
  const on = kindProps('diya-field').beacon !== false
  const { mesh, mat } = useMemo(() => {
    const geo = new THREE.CylinderGeometry(MUSEUM.oculus.r * 0.95, MUSEUM.oculus.r * 1.25, BEACON_H, 32, 1, true)
    geo.translate(0, ROOF_Y1 + BEACON_H / 2, 0)
    const mat = new THREE.ShaderMaterial({
      name: 'roofBeacon',
      uniforms: { uColor: { value: new THREE.Color(kelvinToHex(3800)) }, uLevel: { value: 0 } },
      vertexShader: /* glsl */ `
        varying float vH;
        varying vec3 vN;
        varying vec3 vView;
        void main() {
          vH = (position.y - ${ROOF_Y1.toFixed(3)}) / ${BEACON_H.toFixed(1)};
          vec4 w = modelMatrix * vec4(position, 1.0);
          vN = normalize(mat3(modelMatrix) * normal);
          vView = normalize(cameraPosition - w.xyz);
          gl_Position = projectionMatrix * viewMatrix * w;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor;
        uniform float uLevel;
        varying float vH;
        varying vec3 vN;
        varying vec3 vView;
        void main() {
          // a breath of warm-white light over the oculus: soft radial falloff (bright through the
          // column's middle, gone at its skin), fading upward within a few metres of the roof
          float edge = pow(abs(dot(normalize(vN), vView)), 2.0);
          float a = edge * exp(-vH * 15.0) * smoothstep(0.0, 0.01, vH) * uLevel;
          vec3 warm = mix(vec3(1.0, 0.95, 0.88), uColor, smoothstep(0.0, 0.25, vH));
          gl_FragColor = vec4(warm * a * 0.55, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.frustumCulled = false
    mesh.renderOrder = 42
    mesh.raycast = () => null
    mesh.name = 'roof-beacon'
    return { mesh, mat }
  }, [])
  useEffect(
    () => () => {
      mesh.geometry.dispose()
      mat.dispose()
    },
    [mesh, mat],
  )
  useFrame(() => {
    const k = on ? diyaNow.festival : 0
    mat.uniforms.uLevel.value = k
    mesh.visible = !useMuseum.getState().sceneCompiled || k > 0.01
  })
  return <primitive object={mesh} />
}
