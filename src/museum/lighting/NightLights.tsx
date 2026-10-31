/**
 * Time-of-day controller + night lighting.
 *
 *  • <TimeOfDayController> eases `ambience` (timeOfDayState.ts) toward the selected preset and
 *    applies it: renderer exposure (the eye adapts at night), sky dusk/night uniforms, cloud cover.
 *  • <CourtyardLanterns> — bronze wall lanterns beside the entrance door. Their glass glows
 *    and their downlights come on at dusk/night. The downlights are SpotPool REQUESTS (the pool
 *    has a fixed number of real lights), switched off by day (intensity 0 → never ranked), so
 *    switching time of day never changes the light count or recompiles a shader.
 *  • <FacadeUplights> — small in-ground uplights round the foot of the drum and the annex,
 *    grazing the rammed earth with scalloped pools of warm light at dusk and night. Glow
 *    only (an additive film on the walls + emissive lenses): no real lights.
 */
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { kelvinToHex, LIGHTING } from '../config/lighting'
import { zoneAt } from '../config/layout'
import { KEY, MUSEUM } from '../config/museum'
import { ZoneGroup } from '../navigation/zoneCulling'
import { useMuseum } from '../state/store'
import { ambience, ambienceTarget, snapAmbience, type AmbienceKey } from './timeOfDayState'
import { nightSkyUniforms } from './nightSky'
import { registerSpot, type SpotRequest } from './SpotPool'

const EASE_PER_S = 1.6
const FACADE_GLOW = new THREE.Color('#ffc27a')
const glassScan = { t: 0, k: 0, mats: [] as THREE.MeshPhysicalMaterial[] }

export function TimeOfDayController() {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)

  // First frame already correct (no fade from midday on load).
  useEffect(() => {
    snapAmbience(useMuseum.getState().timeOfDay)
  }, [])

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1)
    const target = ambienceTarget(useMuseum.getState().timeOfDay)
    const k = 1 - Math.exp(-EASE_PER_S * dt)
    for (const key of Object.keys(ambience) as AmbienceKey[]) {
      const d = target[key] - ambience[key]
      ambience[key] = Math.abs(d) < 1e-4 ? target[key] : ambience[key] + d * k
    }
    gl.toneMappingExposure = LIGHTING.exposure * ambience.exposure
    for (const u of nightSkyUniforms) {
      u.nightMix.value = ambience.night * ambience.night
      u.twilightMix.value = ambience.twilight
    }
    // Thinner cloud at night so the stars read (clouds are unlit and would just be black).
    const sky = scene.children.find((o) => (o as THREE.Mesh & { isSky?: boolean }).isSky) as THREE.Mesh | undefined
    const cu = (sky?.material as THREE.ShaderMaterial | undefined)?.uniforms?.cloudCoverage
    if (cu && LIGHTING.sky.clouds.enabled) cu.value = LIGHTING.sky.clouds.coverage * (1 - 0.55 * ambience.night)

    // Glowing facade: seen from OUTSIDE at night (arrival flight, forecourt) the glazing — atrium
    // facade and roof lights — carries the warm interior glow. From inside it stays clear glass.
    glassScan.t -= dt
    if (glassScan.t <= 0) {
      glassScan.t = 3
      glassScan.mats = []
      scene.traverse((o) => {
        const m = (o as THREE.Mesh).material as THREE.MeshPhysicalMaterial | undefined
        if (m && !Array.isArray(m) && m.name === 'glass' && m.emissive && !glassScan.mats.includes(m)) glassScan.mats.push(m)
      })
    }
    const c = camera.position
    const outside = c.y > MUSEUM.pavilion.height + 0.4 || (zoneAt(c.x, c.z)?.outdoor ?? true)
    const glow = ambience.night * (outside ? 1 : 0)
    glassScan.k += (glow - glassScan.k) * (1 - Math.exp(-4 * dt))
    for (const m of glassScan.mats) {
      m.emissive.copy(FACADE_GLOW)
      m.emissiveIntensity = glassScan.k * 2.4
    }
  })

  return (
    <>
      <CourtyardLanterns />
      <FacadeUplights />
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Courtyard wall lanterns                                             */
/* ------------------------------------------------------------------ */

const MOUNT_Y = 2.55

/** Wall-mounted positions: [x, z] + outward normal — a pair either side of the annex door. */
const LANTERNS: { x: number; z: number; nx: number; nz: number }[] = [
  { x: -(KEY.doorHalf + 0.75), z: KEY.annexOuterZ, nx: 0, nz: 1 },
  { x: KEY.doorHalf + 0.75, z: KEY.annexOuterZ, nx: 0, nz: 1 },
]

const bronze = new THREE.MeshStandardMaterial({ color: '#3a2c20', roughness: 0.45, metalness: 0.85 })
const lanternGlass = new THREE.MeshStandardMaterial({
  color: '#e9dcc3',
  roughness: 0.55,
  emissive: new THREE.Color(kelvinToHex(LIGHTING.lanterns.colorK)),
  emissiveIntensity: 0,
})

function CourtyardLanterns() {
  const color = kelvinToHex(LIGHTING.lanterns.colorK)
  const requests = useMemo<SpotRequest[]>(
    () =>
      LANTERNS.map((l) => ({
        position: [l.x + l.nx * 0.3, MOUNT_Y - 0.05, l.z + l.nz * 0.3],
        target: [l.x + l.nx * 2.6, 0, l.z + l.nz * 2.6],
        intensity: 0,
        angle: 1.05,
        penumbra: 0.9,
        color,
      })),
    [color],
  )

  useEffect(() => {
    const offs = requests.map((r) => registerSpot(r))
    return () => offs.forEach((off) => off())
  }, [requests])

  useFrame(() => {
    const n = ambience.night
    lanternGlass.emissiveIntensity = LIGHTING.lanterns.emissive * n
    const cd = n > 0.02 ? LIGHTING.lanterns.intensity * n : 0
    for (const r of requests) r.intensity = cd
  })

  return (
    <ZoneGroup zones={['entrance-court', 'annex']}>
      {LANTERNS.map((l, i) => {
        const yaw = Math.atan2(l.nx, l.nz)
        return (
          <group key={i} position={[l.x, MOUNT_Y, l.z]} rotation={[0, yaw, 0]}>
            {/* back plate */}
            <mesh position={[0, 0.02, 0.02]} material={bronze}>
              <boxGeometry args={[0.13, 0.34, 0.03]} />
            </mesh>
            {/* bracket arm */}
            <mesh position={[0, 0.16, 0.15]} material={bronze}>
              <boxGeometry args={[0.025, 0.025, 0.24]} />
            </mesh>
            {/* lantern: cap, glass, base */}
            <mesh position={[0, 0.13, 0.3]} material={bronze}>
              <cylinderGeometry args={[0.02, 0.11, 0.07, 6]} />
            </mesh>
            <mesh position={[0, 0.0, 0.3]} material={lanternGlass}>
              <cylinderGeometry args={[0.075, 0.065, 0.2, 6]} />
            </mesh>
            <mesh position={[0, -0.11, 0.3]} material={bronze}>
              <cylinderGeometry args={[0.07, 0.04, 0.03, 6]} />
            </mesh>
          </group>
        )
      })}
    </ZoneGroup>
  )
}

/* ------------------------------------------------------------------ */
/* Facade uplights                                                     */
/* ------------------------------------------------------------------ */

/** Spacing of the uplights along the walls (m), their pool height, setback and film offset. */
const UP = { pitch: 2.6, height: 4.2, setback: 0.32, off: 0.012 }

/** Scalloped pool: bright at the foot, a widening cone fading up the wall; u repeats per light. */
function scallopTexture() {
  const W = 64
  const H = 64
  const data = new Uint8Array(W * H * 4)
  for (let y = 0; y < H; y++) {
    const v = y / (H - 1)
    for (let x = 0; x < W; x++) {
      const u = (x + 0.5) / W - 0.5
      const spread = 0.13 + 0.2 * v
      const a = Math.exp(-((u / spread) ** 2)) * Math.pow(1 - v, 1.7) * Math.min(1, v * 25 + 0.4)
      // alphaMap reads the green channel
      const g = Math.round(Math.min(1, a) * 255)
      data.set([g, g, g, 255], (y * W + x) * 4)
    }
  }
  const t = new THREE.DataTexture(data, W, H, THREE.RGBAFormat)
  t.wrapS = THREE.RepeatWrapping
  t.magFilter = THREE.LinearFilter
  t.minFilter = THREE.LinearFilter
  t.needsUpdate = true
  return t
}

/**
 * The washed exterior faces — drum lobe, gallery ring, both annex sides — as quads facing out
 * (counter-clockwise seen from outside; u counts lights, v runs up the wall), and the lights'
 * ground positions.
 */
function exteriorRuns() {
  const pos: number[] = []
  const uv: number[] = []
  const lights: [number, number][] = []
  const y0 = 0.02
  const y1 = UP.height
  const quad = (p: number[][], u: number[]) => {
    p.forEach((q, i) => {
      pos.push(q[0], q[1], q[2])
      uv.push(u[i], q[1] > y0 ? 1 : 0)
    })
  }
  const arc = (r: number, a0: number, a1: number) => {
    const len = (a1 - a0) * r
    const n = Math.max(1, Math.round(len / UP.pitch))
    const steps = Math.max(8, Math.ceil(len / 0.4))
    const R = r + UP.off
    const P = (t: number, y: number) => [R * Math.cos(t), y, R * Math.sin(t)]
    for (let i = 0; i < steps; i++) {
      const t0 = a0 + ((a1 - a0) * i) / steps
      const t1 = a0 + ((a1 - a0) * (i + 1)) / steps
      const u0 = ((t0 - a0) / (a1 - a0)) * n
      const u1 = ((t1 - a0) / (a1 - a0)) * n
      quad([P(t0, y0), P(t0, y1), P(t1, y1), P(t1, y0)], [u0, u0, u1, u1])
    }
    for (let k = 0; k < n; k++) {
      const a = a0 + ((k + 0.5) / n) * (a1 - a0)
      lights.push([(r + UP.setback) * Math.cos(a), (r + UP.setback) * Math.sin(a)])
    }
  }
  const DEGR = Math.PI / 180
  const gap = Math.acos(KEY.annexOuterHalf / KEY.lobeOuterR)
  arc(KEY.lobeOuterR, MUSEUM.drum.neNotchDeg * DEGR, gap - 0.04)
  arc(KEY.lobeOuterR, Math.PI - gap + 0.04, MUSEUM.drum.dNotchDeg * DEGR)
  arc(KEY.ringOuterR, MUSEUM.drum.dNotchDeg * DEGR, (MUSEUM.drum.neNotchDeg + 360) * DEGR)
  // annex sides, from the lobe to the entrance front
  const za = Math.sqrt(KEY.lobeOuterR ** 2 - KEY.annexOuterHalf ** 2) + 0.3
  const zb = KEY.annexOuterZ - 0.4
  const n = Math.max(1, Math.round((zb - za) / UP.pitch))
  for (const side of [1, -1]) {
    const x = side * (KEY.annexOuterHalf + UP.off)
    // east face: +z is on the viewer's left; west face: on the right
    if (side > 0) quad([[x, y0, zb], [x, y0, za], [x, y1, za], [x, y1, zb]], [0, n, n, 0])
    else quad([[x, y0, za], [x, y0, zb], [x, y1, zb], [x, y1, za]], [0, n, n, 0])
    for (let k = 0; k < n; k++) lights.push([side * (KEY.annexOuterHalf + UP.setback), za + ((k + 0.5) / n) * (zb - za)])
  }
  const idx: number[] = []
  for (let b = 0; b < pos.length / 3; b += 4) idx.push(b, b + 1, b + 2, b, b + 2, b + 3)
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  g.computeBoundingSphere()
  return { geo: g, lights }
}

function FacadeUplights() {
  const { geo, mat, disc, lens, inst } = useMemo(() => {
    const { geo, lights } = exteriorRuns()
    const color = new THREE.Color(kelvinToHex(2700))
    const mat = new THREE.MeshBasicMaterial({ name: 'facadeUplight', color, alphaMap: scallopTexture(), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })
    const disc = new THREE.CircleGeometry(0.07, 16).rotateX(-Math.PI / 2)
    const lens = new THREE.MeshStandardMaterial({ color: '#2a2622', emissive: color, emissiveIntensity: 0, roughness: 0.4 })
    const inst = new THREE.InstancedMesh(disc, lens, lights.length)
    const m4 = new THREE.Matrix4()
    lights.forEach(([x, z], i) => inst.setMatrixAt(i, m4.makeTranslation(x, 0.006, z)))
    inst.instanceMatrix.needsUpdate = true
    inst.raycast = () => null
    return { geo, mat, disc, lens, inst }
  }, [])
  useEffect(
    () => () => {
      geo.dispose()
      mat.alphaMap?.dispose()
      mat.dispose()
      disc.dispose()
      lens.dispose()
      inst.dispose()
    },
    [geo, mat, disc, lens, inst],
  )
  useFrame(() => {
    const n = ambience.night
    mat.opacity = 0.85 * n
    mat.visible = n > 0.01
    lens.emissiveIntensity = 2.5 * n
  })
  return (
    <ZoneGroup zones={['entrance-court', 'annex']}>
      <mesh geometry={geo} material={mat} renderOrder={1} raycast={() => null} />
      <primitive object={inst} />
    </ZoneGroup>
  )
}
