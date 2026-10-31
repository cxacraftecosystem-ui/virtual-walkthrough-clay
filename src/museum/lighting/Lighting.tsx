/**
 * Lighting rig of the clay pavilion (PDF: "warm white to neutral", exposed daylight):
 *   1. Oculus daylight    — the sun (SkyAndSun) reaches the interior only through the open
 *                           oculus; a diffuse sky fill (RectAreaLight) hangs in the light well
 *   2. Track lights       — warm-white heads on the ring, oculus, entry and annex rails (TrackSpot)
 *   3. Accent spotlights  — one per artwork / panel / podium (see exhibits/, architecture/Pavilion)
 *   4. Cove glow          — RectAreaLights at the duplex band washing the upper drum, with the
 *                           additive glow film of architecture/Pavilion's CoveWash on every tier
 * Plus a light-former environment for PBR reflections and soft global fill.
 */
import { useFrame, useThree } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { zoneAt } from '../config/layout'
import { visitor } from '../state/visitor'
import * as THREE from 'three'
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js'
import { kelvinToHex, LIGHTING } from '../config/lighting'
import { DEG, KEY, MUSEUM } from '../config/museum'
import { OCULUS_STEPS } from '../architecture/CeilingAndSkylight'
import { BAND_Y } from '../architecture/Wall'
import { QUALITY_PRESETS, withDevOverrides } from '../config/quality'
import { useMuseum } from '../state/store'
import { ShadowUpdater, SkyAndSun } from './SkyAndSun'
import { SpotPool } from './SpotPool'
import { GalleryEnvironment } from './GalleryEnvironment'
import { ambience } from './timeOfDayState'
import { TimeOfDayController } from './NightLights'
import { probeState, ZoneProbes } from './ZoneProbes'
import { isWebGPU } from '../utils/renderer'

/** Experimental per-zone probes are opt-in (`?probes`) until verified on target hardware. */
const probesRequested = () => typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('probes')

RectAreaLightUniformsLib.init()

/** Quaternion so a RectAreaLight (emits along local -z) faces `dir`, with its height axis along `lengthAxis`. */
function rectOrientation(dir: THREE.Vector3, lengthAxis: THREE.Vector3) {
  const z = dir.clone().normalize().negate()
  const y = lengthAxis.clone().sub(z.clone().multiplyScalar(lengthAxis.dot(z))).normalize()
  const x = new THREE.Vector3().crossVectors(y, z).normalize()
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z))
}

interface AreaProps {
  position: [number, number, number]
  dir: [number, number, number]
  lengthAxis: [number, number, number]
  width: number
  height: number
  intensity: number
  color: string
  /** Daylight source: dimmed with the time of day (ambience.daylight). */
  daylit?: boolean
}

function AreaLight({ position, dir, lengthAxis, width, height, intensity, color, daylit }: AreaProps) {
  const q = useMemo(() => rectOrientation(new THREE.Vector3(...dir), new THREE.Vector3(...lengthAxis)), [dir, lengthAxis])
  const ref = useRef<THREE.RectAreaLight>(null)
  useFrame(() => {
    if (daylit && ref.current) ref.current.intensity = intensity * ambience.daylight
  })
  return <rectAreaLight ref={ref} position={position} quaternion={q} width={width} height={height} intensity={intensity} color={color} />
}

const DAY = kelvinToHex(LIGHTING.skylightFill.colorK)
/** Cove LEDs: 3500 K, between the track's warm white and the daylight. */
const COVE = kelvinToHex(3500, 0.3)
const SKY_DOWN: [number, number, number] = [0, -1, 0]
const ALONG_Z: [number, number, number] = [0, 0, 1]

/** Clay bounce: a warm sky and a rose-earth ground for the hemisphere fill. */
const HEMI_SKY = '#f0e3d8'
const HEMI_GROUND = '#d3a18b'

interface Cove {
  /** Plan angle (deg) of the light's centre. */
  aDeg: number
  /** Interior face radius of the wall it washes. */
  r: number
  /** Length along the wall (m). */
  length: number
}

/**
 * Cove washes at the duplex band, one per large stretch of drum: gallery A, B, C on the ring
 * wall and the entry ways on the lobe behind the description wall. Each sits just off the
 * wall, aimed up and out, so it lights the upper drum and lifts the ceiling.
 */
const COVES: Cove[] = [
  { aDeg: 8, r: KEY.ringR, length: 4.2 },
  { aDeg: -55, r: KEY.ringR, length: 5.2 },
  { aDeg: -118, r: KEY.ringR, length: 4.2 },
  { aDeg: 90, r: KEY.lobeR, length: 6 },
]

function coveProps(c: Cove) {
  const a = c.aDeg * DEG
  const ox = Math.cos(a)
  const oz = Math.sin(a)
  const d = 0.6
  return {
    position: [ox * (c.r - d), BAND_Y + 0.05, oz * (c.r - d)] as [number, number, number],
    dir: [ox * 0.35, 1, oz * 0.35] as [number, number, number],
    lengthAxis: [-oz, 0, ox] as [number, number, number],
  }
}
const COVE_LIGHTS = COVES.map((c) => ({ key: c.aDeg, length: c.length, ...coveProps(c) }))

/**
 * Global fill (hemisphere + environment) is scaled per zone — e.g. the theatre is dark —
 * and eased as the visitor walks between rooms (no shader changes, just intensities).
 */
const ZONE_AMBIENT: Record<string, number> = {
  'entrance-court': 1.25,
  annex: 0.92,
  'entry-e': 0.95,
  'ring-a': 1,
  'ring-b': 1,
  'ring-c': 1,
  'hallway-d': 0.85,
  inner: 1.12,
}
/** Fraction of the hemisphere/env fill kept at full night (the rest is daylight bounce). */
const NIGHT_FILL_FLOOR: Record<string, number> = { 'entrance-court': 0.04 }

function ZoneAmbience({ base }: { base: number }) {
  const ref = useRef<THREE.HemisphereLight>(null)
  const scene = useThree((s) => s.scene)
  const k = useRef(1)
  const floor = useRef(0.3)
  useFrame((_, dt) => {
    const id = zoneAt(visitor.x, visitor.z)?.id
    const target = id ? (ZONE_AMBIENT[id] ?? 1) : k.current
    k.current += (target - k.current) * (1 - Math.exp(-2.5 * dt))
    // How much fill survives at night: open-air zones go dark, interiors keep lamp bounce.
    const floorTarget = id ? (NIGHT_FILL_FLOOR[id] ?? 0.3) : floor.current
    floor.current += (floorTarget - floor.current) * (1 - Math.exp(-2.5 * dt))
    // Hemisphere = bounce fill; mostly daylight, so it fades at dusk/night (lamps keep some).
    const tod = floor.current + (1 - floor.current) * ambience.daylight
    if (ref.current) ref.current.intensity = base * k.current * tod
    // Per-zone probes (ZoneProbes) already carry each room's real brightness and time of day.
    scene.environmentIntensity = LIGHTING.ambient.environmentIntensity * (probeState.active ? probeState.zoneGain : k.current * tod)
  })
  return <hemisphereLight ref={ref} args={[HEMI_SKY, HEMI_GROUND, base]} />
}

export function Lighting() {
  const tier = useMuseum((s) => s.tier)
  const preset = withDevOverrides(QUALITY_PRESETS[tier])
  const oculusSide = MUSEUM.oculus.r * 1.7
  const wellY = OCULUS_STEPS[0].y - 0.02
  // Without area lights (low tier) lift the hemisphere fill to compensate.
  const hemi = LIGHTING.ambient.hemisphereIntensity * (preset.areaLights ? 1 : 2.4)

  return (
    <>
      <SkyAndSun />
      <ShadowUpdater />
      <SpotPool size={preset.spotPool} />

      <ZoneAmbience base={hemi} />

      {/* Reflection/irradiance environment built only from light-formers (no network HDRIs). */}
      <GalleryEnvironment />
      <TimeOfDayController />
      {preset.zoneProbes && probesRequested() && !isWebGPU() && <ZoneProbes />}

      {preset.areaLights && (
        <>
          {/* Diffuse daylight through the oculus, from the mouth of the light well */}
          <AreaLight position={[0, wellY, 0]} dir={SKY_DOWN} lengthAxis={ALONG_Z} width={oculusSide} height={oculusSide} intensity={LIGHTING.skylightFill.intensity * 1.15} color={DAY} daylit />
          {/* Cove glow at the duplex band */}
          {COVE_LIGHTS.map((c) => (
            <AreaLight key={c.key} position={c.position} dir={c.dir} lengthAxis={c.lengthAxis} width={0.14} height={c.length} intensity={LIGHTING.cove.intensity * 4} color={COVE} />
          ))}
        </>
      )}
    </>
  )
}
