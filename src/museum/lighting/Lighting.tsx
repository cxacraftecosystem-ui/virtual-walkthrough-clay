/**
 * Lighting rig of the clay pavilion (PDF: "warm white to neutral", exposed daylight), at the
 * grand scale (GRAND §6.2: dark grounds, bright objects):
 *   1. Oculus daylight    — the sun (SkyAndSun) reaches the rotunda only through the Ø 10 m
 *                           oculus; a diffuse sky fill (RectAreaLight) hangs in the light-well,
 *                           another under the Earth Room's skylight
 *   2. Track lights       — heads on the balcony soffit, the ambulatory and annex rails (TrackSpot),
 *                           real lights from the SpotPool (the nearest few cast shadows)
 *   3. Accent field       — up to 24 analytic cones on every podium, niche, plinth and piece
 *                           (atmosphere/AccentField), each with its visible fixture (Fixtures)
 *   4. Coves and the dome — analytic cove lines (atmosphere/CoveLights) and the dome's springing
 *                           uplight, terrace rings and glowing light-well (atmosphere/DomeLight)
 * Plus a light-former environment for PBR reflections and a low global fill, and the colour
 * choreography (atmosphere/choreography.ts) that gives every room its temperature and exposure.
 */
import { useFrame, useThree } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js'
import { kelvinToHex, LIGHTING } from '../config/lighting'
import { KEY, MUSEUM } from '../config/museum'
import { QUALITY_PRESETS, withDevOverrides } from '../config/quality'
import { useMuseum } from '../state/store'
import { ShadowUpdater, SkyAndSun } from './SkyAndSun'
import { SPOT_SHADOWS, SpotPool, spotShadowBudget, spotTint } from './SpotPool'
import { Choreography, grade } from './atmosphere/choreography'
import { CoveLights } from './atmosphere/CoveLights'
import { AccentField } from './atmosphere/AccentField'
import { DomeLight } from './atmosphere/DomeLight'
import { ROOF_Y0, SLAB_Y } from './atmosphere/inject'
import { Fixtures } from './Fixtures'
import { GalleryEnvironment } from './GalleryEnvironment'
import { ambience, sunState } from './timeOfDayState'
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
const SKY_DOWN: [number, number, number] = [0, -1, 0]
const ALONG_Z: [number, number, number] = [0, 0, 1]

/** Clay bounce: a warm sky and a rose-earth ground for the hemisphere fill. */
const HEMI_SKY = '#f0e3d8'
const HEMI_GROUND = '#d3a18b'
/**
 * At a low sun the fill is the open sky's: blue-violet from above, a neutral ground. The warmth of
 * the golden hour lives only in the sun's own colour (dayCurve SUN_K), so the frame never turns
 * sepia.
 */
const LOW_SUN_SKY = new THREE.Color('#c9d2ee')
const LOW_SUN_GROUND = new THREE.Color('#aaa49e')

/**
 * Global fill (hemisphere + environment) follows the room the visitor is in — the theatre is
 * dark, the Haat bright — through the colour choreography's eased `grade` (no shader changes,
 * just intensities and the fill's tint).
 */
function ZoneAmbience({ base }: { base: number }) {
  const ref = useRef<THREE.HemisphereLight>(null)
  const scene = useThree((s) => s.scene)
  const sky = useMemo(() => new THREE.Color(HEMI_SKY), [])
  const ground = useMemo(() => new THREE.Color(HEMI_GROUND), [])
  useFrame(() => {
    // How much fill survives at night: open-air zones go dark, interiors keep a little lamp
    // bounce (NIGHT_BOUNCE of the room's floor), so the lamps, diyas and spots make pools
    const floor = grade.nightFloor * NIGHT_BOUNCE
    const tod = floor + (1 - floor) * ambience.daylight
    const l = ref.current
    if (l) {
      // the hemisphere is the flattest light of all: it falls faster than the fill (fill²)
      l.intensity = base * grade.fill * Math.min(1, grade.fill) * tod
      // L/M: the room's colour rides on the fill (H+ adds the grade pass)
      l.color.copy(sky).lerp(tmp.copy(sky).multiply(grade.tint), TINT_FILL)
      l.groundColor.copy(ground).lerp(tmp.copy(ground).multiply(grade.tint), TINT_FILL)
      const low = sunState.curve.sunset * (1 - ambience.night)
      if (low > 0) {
        l.color.lerp(LOW_SUN_SKY, low)
        l.groundColor.lerp(LOW_SUN_GROUND, low)
      }
    }
    spotTint.color.copy(grade.tint)
    spotTint.amount = TINT_SPOT
    // Per-zone probes (ZoneProbes) already carry each room's real brightness and time of day.
    // The environment is the most even light of all, so a dim room (fill < 1) loses it fastest:
    // that is what lets the drum fall into pools of light rather than a flat haze.
    scene.environmentIntensity = LIGHTING.ambient.environmentIntensity * (probeState.active ? probeState.zoneGain : grade.fill * Math.min(1, grade.fill) * tod)
  })
  return <hemisphereLight ref={ref} args={[HEMI_SKY, HEMI_GROUND, base]} />
}

/** Share of a room's night floor kept as bounce: the night is dark, lit in pools. */
const NIGHT_BOUNCE = 0.3
/** How much of the room's colour reaches the fill and the accent lights. */
const TINT_FILL = 0.35
const TINT_SPOT = 0.22
const tmp = new THREE.Color()

export function Lighting() {
  const tier = useMuseum((s) => s.tier)
  const preset = withDevOverrides(QUALITY_PRESETS[tier])
  const maxTextures = useThree((s) => s.gl.capabilities.maxTextures)
  const oculusSide = MUSEUM.oculus.r * 1.7
  const wellY = ROOF_Y0 - 0.02
  const skySide = MUSEUM.annex.skylight.r * 1.7
  // Without area lights (low tier) lift the hemisphere fill to compensate.
  const hemi = LIGHTING.ambient.hemisphereIntensity * (preset.areaLights ? 1 : 2.4)

  return (
    <>
      <SkyAndSun />
      <ShadowUpdater />
      <Choreography />
      <CoveLights />
      <DomeLight />
      <AccentField />
      <Fixtures />
      <SpotPool size={preset.spotPool} shadows={preset.shadows ? Math.min(SPOT_SHADOWS[tier], spotShadowBudget(maxTextures)) : 0} />

      <ZoneAmbience base={hemi} />

      {/* Reflection/irradiance environment built only from light-formers (no network HDRIs). */}
      <GalleryEnvironment />
      <TimeOfDayController />
      {preset.zoneProbes && probesRequested() && !isWebGPU() && <ZoneProbes />}

      {preset.areaLights && (
        <>
          {/* Diffuse daylight through the oculus, from the mouth of the light well */}
          <AreaLight position={[0, wellY, 0]} dir={SKY_DOWN} lengthAxis={ALONG_Z} width={oculusSide} height={oculusSide} intensity={LIGHTING.skylightFill.intensity * 1.15} color={DAY} daylit />
          {/* … and through the Earth Room's skylight onto the round table */}
          <AreaLight position={[0, SLAB_Y - 0.02, KEY.annexSkylightZ]} dir={SKY_DOWN} lengthAxis={ALONG_Z} width={skySide} height={skySide} intensity={LIGHTING.skylightFill.intensity * 1.6} color={DAY} daylit />
        </>
      )}
    </>
  )
}
