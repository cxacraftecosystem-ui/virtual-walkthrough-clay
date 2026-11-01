/**
 * 'horse-procession' — the votive clay horses in the Parikrama's sunken gardens (SPECTACLE F22,
 * re-fitted for GRAND §2.6 / §4.2).
 *
 * Twenty horses stand in the four drum-side gardens below the walk's parapet, on the low round
 * plinths the installations lay there (config/grandObjects/installations.ts, 'garden-N-plinth-K';
 * without them, on the garden floor along the ring), growing west to east from palm-sized to a
 * 1.2 m horse, and passing from one way of making to the next: Bankura's slip-burnished red,
 * Gorakhpur's bright orange-red, Sonepur's smoke-darkened body. As the visitor walks they wake one by one: a
 * warm raking glow climbs each horse's legs and neck, with a rim of light on its silhouette,
 * and a diya lights at its fore and hind hooves. Horses already passed sink to embers that
 * glow only at the hooves. One accent light slides along with the visitor (M+), and small
 * ghungroo bells move with them (media/soundscape/craft.ts).
 *
 *   props {fromDeg = -128, toDeg = 26, count = 21, scaleFrom = 0.45, scaleTo = 1.2,
 *          glowRadius = 2.2, bells = true}
 *   tiers  L glow only · M+ moving spot and diya flames. Still: glows ease without breathing.
 *
 * The procession spans both halves of the walk, so it is drawn by the craft mount
 * (spectacle/mounts/craft.tsx) inside a zone group of both, not by the scene-object list (which
 * culls by one zone); the 'horse-procession' scene object only carries the curator's props.
 */
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { DEG, polar } from '../config/museum'
import { SCENE_OBJECTS } from '../config/objects'
import { PARIKRAMA, SERPENTINE } from '../config/satellites'
import { horseSlots } from '../config/spectacleObjects/craft'
import { addGlowAttributes, instancedGlowMaterial } from '../effects/instancedGlow'
import { registerSpot, type SpotRequest } from '../lighting/SpotPool'
import type { PropValue } from './propSchemas'
import { useSpectacle } from '../spectacle/settings'
import { visitor } from '../state/visitor'
import { buildHorseGeometry, clayMaterial, vesselProfile } from './clay'
import { lathe } from './kit'
import { useModelMaterials } from './modelMaterials'

/** The scene object draws nothing: the craft mount draws the procession across both zones. */
export function HorseProcession() {
  return null
}

/** A horse's place: plan angle, height, position, the plinth top it stands on, rotation, style tint. */
interface Slot {
  a: number
  h: number
  x: number
  z: number
  y: number
  ry: number
  tint: THREE.Color
}

/** West to east: Bankura, Gorakhpur, Sonepur (instance tints on the shared fired body). */
const STYLE_TINT = [new THREE.Color(0.92, 0.78, 0.74), new THREE.Color(1.18, 0.86, 0.66), new THREE.Color(0.62, 0.5, 0.46)]

const PLINTH_ID = /^garden-(\d+)-plinth-(\d+)$/

/**
 * The horses' places: on the gardens' plinths when the installations have laid them (top =
 * tiers × h), else the craft list's slots along the ring (on the garden floor).
 */
function procession(props: Record<string, PropValue>): Slot[] {
  const s0 = Number(props.scaleFrom ?? 0.45)
  const s1 = Number(props.scaleTo ?? 1.2)
  const plinths = SCENE_OBJECTS.filter((o) => o.kind === 'round-plinth' && PLINTH_ID.test(o.id))
  const base = plinths.length
    ? plinths
        .map((o) => ({ a: Math.atan2(o.position[2], o.position[0]) / DEG, x: o.position[0], z: o.position[2], y: Math.round(Number(o.props?.tiers ?? 1)) * Number(o.props?.h ?? 0.28) }))
        .sort((p, q) => p.a - q.a)
    : horseSlots(props).map((h) => ({ a: h.a, x: h.x, z: h.z, y: 0 }))
  const n = base.length
  return base.map((b, i) => {
    const t = n === 1 ? 1 : i / (n - 1)
    const ar = b.a * DEG
    // never a file of tails: each horse turns well off the walk's line, alternately towards and
    // away from it, so from the walk every one shows its flank and its neck in three-quarter view
    const turn = (i % 2 ? 1 : -1) * (0.85 + 0.35 * Math.abs(Math.sin(i * 7.31)))
    // heights grow along the walk, staggered so neighbours never step in a ramp
    const h = (s0 + (s1 - s0) * t) * (0.86 + 0.28 * Math.abs(Math.sin(i * 3.17 + 0.6)))
    return { ...b, h, ry: Math.atan2(-Math.cos(ar), -Math.sin(ar)) + turn, tint: STYLE_TINT[Math.min(2, Math.floor(t * 3))] }
  })
}

const WAKE_UP = 1.3 // glow per second rising
const SLEEP = 0.45 // … and falling
const EMBER = 0.24

/** Adds the rake (glow climbing from the hooves with the glow) and a rim term to the instanced glow. */
function rakeGlow<M extends THREE.MeshStandardMaterial>(mat: M): M {
  const prev = mat.onBeforeCompile
  mat.onBeforeCompile = (shader, renderer) => {
    prev.call(mat, shader, renderer)
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vRake;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRake = position.y;')
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vRake;').replace(
      'totalEmissiveRadiance += uGlowColor * vGlow * uGlowGain * glowBreath;',
      `{
  // the glow climbs from the hooves (height 0) to the ears (1) as the horse wakes
  float rise = smoothstep(vRake - 0.16, vRake + 0.04, vGlow * 1.22);
  float rim = pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), 2.4);
  totalEmissiveRadiance += uGlowColor * uGlowGain * glowBreath * rise * min(1.0, vGlow * 1.6) * (0.4 + 1.1 * rim * rim);
}`,
    )
  }
  const key = mat.customProgramCacheKey.bind(mat)
  mat.customProgramCacheKey = () => `${key()}|horseRake`
  return mat
}

const FLAME_VS = /* glsl */ `
attribute float aOn;
attribute float aSeed;
uniform float uTime;
varying vec2 vUv;
varying float vOn;
varying float vSeed;
void main() {
  vUv = uv;
  vOn = aOn;
  vSeed = aSeed;
  // a camera-facing (about y) flame standing on its lamp
  vec4 c = modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  vec3 right = normalize(vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]));
  float flick = 1.0 + 0.08 * sin(uTime * (7.0 + aSeed * 3.0) + aSeed * 20.0);
  vec3 w = c.xyz + right * position.x * aOn + vec3(0.0, position.y * aOn * flick, 0.0);
  gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
}
`
const FLAME_FS = /* glsl */ `
varying vec2 vUv;
varying float vOn;
varying float vSeed;
void main() {
  vec2 q = vUv - vec2(0.5, 0.0);
  float w = 0.42 * (1.0 - vUv.y) * smoothstep(0.0, 0.18, vUv.y) + 0.05 * (1.0 - vUv.y);
  float a = smoothstep(w, w * 0.2, abs(q.x)) * (1.0 - smoothstep(0.6, 1.0, vUv.y)) * vOn;
  vec3 c = mix(vec3(1.0, 0.92, 0.6), vec3(1.0, 0.45, 0.1), smoothstep(0.1, 0.9, vUv.y));
  gl_FragColor = vec4(c * a * 2.6, a);
}
`

export function HorseProcessionView({ props }: { props: Record<string, PropValue> }) {
  const m = useModelMaterials()
  const sp = useSpectacle()
  const still = sp.mode === 'still'
  const diyasOn = sp.caps.horseDiyas
  const spotOn = sp.caps.horseSpot
  const slots = useMemo(() => procession(props), [props])
  // the horses stand a garden's depth from the walk: wake them from the path beside them
  const glowR = Math.max(0.8, Number(props.glowRadius ?? 2.2)) + 1.4
  const n = slots.length

  const geo = useMemo(() => buildHorseGeometry(1), [])
  useEffect(
    () => () => {
      geo.clay.dispose()
      geo.slip.dispose()
    },
    [geo],
  )
  const mats = useMemo(() => {
    const clay = rakeGlow(instancedGlowMaterial((clayMaterial(m, 'terracotta', 0.15) as THREE.MeshStandardMaterial).clone(), { color: '#ff9a52', gain: 1.1, breath: 0.07, breathHz: 0.3 }))
    const slip = rakeGlow(instancedGlowMaterial((clayMaterial(m, 'red', 0.1) as THREE.MeshStandardMaterial).clone(), { color: '#ff7a3c', gain: 0.9, breath: 0.07, breathHz: 0.3 }))
    return { clay, slip }
  }, [m])
  useEffect(
    () => () => {
      mats.clay.dispose()
      mats.slip.dispose()
    },
    [mats],
  )

  const clayMesh = useRef<THREE.InstancedMesh>(null)
  const slipMesh = useRef<THREE.InstancedMesh>(null)
  const glowAttrs = useRef<THREE.InstancedBufferAttribute[]>([])
  const state = useRef<{ glow: Float32Array; target: Float32Array; woke: Uint8Array }>({ glow: new Float32Array(0), target: new Float32Array(0), woke: new Uint8Array(0) })

  // instance matrices and glow attributes
  useEffect(() => {
    const attrs: THREE.InstancedBufferAttribute[] = []
    const mm = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    for (const mesh of [clayMesh.current, slipMesh.current]) {
      if (!mesh) continue
      slots.forEach((s, i) => {
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), s.ry)
        mm.compose(new THREE.Vector3(s.x, s.y, s.z), q, new THREE.Vector3(s.h, s.h, s.h))
        mesh.setMatrixAt(i, mm)
        if (mesh === clayMesh.current) mesh.setColorAt(i, s.tint)
      })
      mesh.instanceMatrix.needsUpdate = true
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
      mesh.computeBoundingSphere()
      attrs.push(addGlowAttributes(mesh, n, 22).glow)
    }
    glowAttrs.current = attrs
    state.current = { glow: new Float32Array(n), target: new Float32Array(n), woke: new Uint8Array(n) }
  }, [slots, n])

  // diyas: two lamps per horse, on its plinth's lip towards the walk, beside the fore and hind hooves
  const lamps = useMemo(() => {
    const out: { x: number; y: number; z: number; horse: number }[] = []
    slots.forEach((s, i) => {
      const ar = s.a * DEG
      const half = Math.min(0.24, 0.173 * s.h) // the hooves sit ±0.173·h along the body (models/clay.tsx horse)
      // the body runs along the model's x, turned by ry; the lamps sit a little towards the walk
      const bx = Math.cos(s.ry)
      const bz = -Math.sin(s.ry)
      for (const sgn of [-1, 1]) out.push({ x: s.x + Math.cos(ar) * 0.12 + bx * sgn * half, y: s.y, z: s.z + Math.sin(ar) * 0.12 + bz * sgn * half, horse: i })
    })
    return out
  }, [slots])
  const diyaGeo = useMemo(() => lathe(vesselProfile('diya', 0.028, 0.02), 18), [])
  const flameGeo = useMemo(() => {
    const g = new THREE.PlaneGeometry(0.03, 0.06, 1, 4)
    g.translate(0, 0.03, 0)
    return g
  }, [])
  useEffect(
    () => () => {
      diyaGeo.dispose()
      flameGeo.dispose()
    },
    [diyaGeo, flameGeo],
  )
  const uTime = useMemo(() => ({ value: 0 }), [])
  const flameMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        name: 'horseDiyaFlame',
        vertexShader: FLAME_VS,
        fragmentShader: FLAME_FS,
        uniforms: { uTime },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    [uTime],
  )
  useEffect(() => () => flameMat.dispose(), [flameMat])
  const diyaMesh = useRef<THREE.InstancedMesh>(null)
  const flameMesh = useRef<THREE.InstancedMesh>(null)
  const flameOn = useRef<THREE.InstancedBufferAttribute | null>(null)
  useEffect(() => {
    const mm = new THREE.Matrix4()
    const dm = diyaMesh.current
    const fm = flameMesh.current
    lamps.forEach((l, i) => {
      mm.makeTranslation(l.x, l.y, l.z)
      dm?.setMatrixAt(i, mm)
      mm.makeTranslation(l.x, l.y + 0.018, l.z)
      fm?.setMatrixAt(i, mm)
    })
    if (dm) {
      dm.instanceMatrix.needsUpdate = true
      dm.computeBoundingSphere()
    }
    if (fm) {
      fm.instanceMatrix.needsUpdate = true
      const on = new THREE.InstancedBufferAttribute(new Float32Array(lamps.length), 1)
      on.setUsage(THREE.DynamicDrawUsage)
      const seed = new THREE.InstancedBufferAttribute(new Float32Array(lamps.map((_, i) => ((i * 0.61803) % 1) as number)), 1)
      fm.geometry.setAttribute('aOn', on)
      fm.geometry.setAttribute('aSeed', seed)
      flameOn.current = on
    }
  }, [lamps])

  // the accent light that walks with the visitor
  const spot = useRef<SpotRequest | null>(null)
  useEffect(() => {
    if (!spotOn) return
    const req: SpotRequest = { position: [0, 2.9, 0], target: [0, 0.5, 0], intensity: 0, angle: 0.3, penumbra: 0.95, color: '#ffcf9e', tag: 'horse-procession' }
    spot.current = req
    const off = registerSpot(req)
    return () => {
      off()
      spot.current = null
    }
  }, [spotOn])

  useFrame((st, dt) => {
    const s = state.current
    if (s.glow.length !== n) return
    if (!still) uTime.value = st.clock.elapsedTime
    for (const mat of [mats.clay, mats.slip]) {
      const u = mat.userData.uniforms
      u.uTime.value = st.clock.elapsedTime
      u.uBreath.value = still ? 0 : 0.07
    }
    const onWalk = visitor.x * visitor.x + visitor.z * visitor.z
    const inBand = onWalk > (PARIKRAMA.r0 - 0.5) ** 2 && onWalk < (PARIKRAMA.r1 + 0.5) ** 2
    let nearest = -1
    let nearestD = 1e9
    let changed = false
    for (let i = 0; i < n; i++) {
      const h = slots[i]
      const d = Math.hypot(visitor.x - h.x, visitor.z - h.z)
      if (inBand && d < glowR) s.woke[i] = 2 // awake
      else if (s.woke[i] === 2 && d > glowR + 0.6) s.woke[i] = 1 // passed: embers
      s.target[i] = s.woke[i] === 2 ? 1 : s.woke[i] === 1 ? EMBER : 0
      const g = s.glow[i]
      const t = s.target[i]
      const next = still ? t : t > g ? Math.min(t, g + WAKE_UP * dt) : Math.max(t, g - SLEEP * dt)
      if (next !== g) {
        s.glow[i] = next
        changed = true
      }
      if (s.woke[i] === 2 && d < nearestD) {
        nearestD = d
        nearest = i
      }
    }
    if (changed) {
      for (const a of glowAttrs.current) {
        for (let i = 0; i < n; i++) a.setX(i, s.glow[i])
        a.needsUpdate = true
      }
      const on = flameOn.current
      if (on && diyasOn) {
        lamps.forEach((l, i) => on.setX(i, Math.min(1, s.glow[l.horse] * 1.25)))
        on.needsUpdate = true
      }
    }
    // the moving accent: above the nearest awake horse, fading with distance
    const req = spot.current
    if (req) {
      if (nearest >= 0) {
        const h = slots[nearest]
        const [ox, oz] = polar(Math.hypot(h.x, h.z) + 1.2, h.a)
        req.position = [ox, SERPENTINE.wallH + 0.6, oz]
        req.target = [h.x, h.y + h.h * 0.55, h.z]
        req.intensity = 9 * s.glow[nearest]
      } else req.intensity = 0
    }
  })

  return (
    <group name="horse-procession">
      <instancedMesh ref={clayMesh} args={[geo.clay, mats.clay, n]} castShadow receiveShadow />
      <instancedMesh ref={slipMesh} args={[geo.slip, mats.slip, n]} castShadow />
      <instancedMesh ref={diyaMesh} args={[diyaGeo, m.earthenware, lamps.length]} receiveShadow />
      <instancedMesh ref={flameMesh} args={[flameGeo, flameMat, lamps.length]} frustumCulled={false} renderOrder={3} />
    </group>
  )
}
