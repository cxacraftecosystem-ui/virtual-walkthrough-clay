/**
 * Physically based daylight: Preetham atmospheric-scattering sky (three.js Sky,
 * with sun disc + procedural clouds) and a shadow-casting sun aligned to it.
 * The dome, its collar, the slab and the drum cast shadows, so direct sun reaches the rotunda
 * ONLY through the open oculus (the Earth Room through its skylight; low in the south, a slice
 * through the door).
 */
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { Sky } from 'three/examples/jsm/objects/Sky.js'
import { kelvinToHex, LIGHTING } from '../config/lighting'
import { KEY, MUSEUM } from '../config/museum'
import { SAT_WALL, SATELLITES, SPHERE_WELL } from '../config/satellites'
import { zoneAt } from '../config/layout'
import { visitor } from '../state/visitor'
import { perchZone } from '../navigation/perch'
import { QUALITY_PRESETS, withDevOverrides } from '../config/quality'
import { useMuseum } from '../state/store'
import { patchNightSky } from './nightSky'
import { sunState } from './timeOfDayState'
import { MOON } from './atmosphere/dayCurve'
import { ATMOS } from './atmosphere/inject'
import { weatherNow } from './weather/weatherState'
import { isWebGPU, makeWebGPUSky } from '../utils/renderer'
import { VR_MODE } from '../utils/vr'

const DEG = Math.PI / 180
/** Sky saturation: a desaturated haze-blue by day, the full colour at sunset and by night. */
const SKY_SAT = { day: 0.55, sunset: 1.0 }

/** Unit vector pointing TOWARD the sun. Azimuth: 0 = north(-z), 90 = east(+x). */
export function sunDirection(elevationDeg: number = LIGHTING.sun.elevationDeg, azimuthDeg: number = LIGHTING.sun.azimuthDeg) {
  const el = elevationDeg * DEG
  const az = azimuthDeg * DEG
  return new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)).normalize()
}

/**
 * Shadow frusta, fitted per zone (GRAND §1.2 performance, §6.2): the map is spent where the
 * visitor is.
 *   rotunda  the court, the galleries and the balcony: just the dome's circle (r 17.5), so the
 *            oculus's sun patch is crisp (≈ 0.85 cm a texel at 4096²)
 *   drum     the ambulatory and the Wine Hall: the whole drum with its eaves
 *   site     outside and in the Earth Room: the building, the annex and the forecourt to its far
 *            edge (the guardians' and the dome's long shadows)
 *   wing     the Parikrama, the rooms and the Sky Rim: the whole north wing
 *   well     the Sphere Well's room, round its opening
 */
const ROOF_R = KEY.lobeOuterR + MUSEUM.pavilion.roofOverhang
const FRUSTA = {
  rotunda: { target: new THREE.Vector3(0, 0, 0), half: KEY.ringR + 1.5 },
  drum: { target: new THREE.Vector3(0, 0, 0), half: ROOF_R + 1 },
  site: { target: new THREE.Vector3(0, 0, (MUSEUM.forecourt.endZ - ROOF_R) / 2), half: (MUSEUM.forecourt.endZ + ROOF_R) / 2 + 2 },
  wing: { target: new THREE.Vector3(0, 0, 0), half: SAT_WALL.outerOuter + 1.5 },
  well: { target: new THREE.Vector3(SPHERE_WELL.cx, SPHERE_WELL.floorY / 2, SPHERE_WELL.cz), half: SPHERE_WELL.roomR + 1 },
}
const ROTUNDA_ZONES = new Set<string>(['inner', 'ring-a', 'ring-b', 'ring-c', 'duplex'])
const WING_ZONES = new Set<string>(['parikrama-west', 'parikrama-east', 'sky-rim', ...SATELLITES.map((s) => s.id)])
const frustumFor = (zoneId: string) =>
  ROTUNDA_ZONES.has(zoneId)
    ? FRUSTA.rotunda
    : zoneId === 'sphere-well'
      ? FRUSTA.well
      : zoneId === 'entrance-court' || zoneId === 'annex'
        ? FRUSTA.site
        : WING_ZONES.has(zoneId)
          ? FRUSTA.wing
          : FRUSTA.drum
const SUN_TARGET = FRUSTA.site.target
/** The sun light's distance from its target, and the shadow camera's depth: clear of the dome's top from any frustum. */
const SUN_DIST = 2 * FRUSTA.site.half

function useSky() {
  return useMemo(() => {
    // Experimental WebGPU path: TSL SkyMesh (GLSL patches below are WebGL-only).
    const gpuSky = isWebGPU() ? makeWebGPUSky() : null
    const sky = gpuSky ?? new Sky()
    sky.scale.setScalar(2000)
    const mat = sky.material as THREE.ShaderMaterial
    mat.uniforms.skyExposure = mat.uniforms.skyExposure ?? { value: LIGHTING.sky.exposure }
    mat.uniforms.skySat = mat.uniforms.skySat ?? { value: SKY_SAT.day }
    // an architectural-render sky: the Preetham blue pulled towards a pale haze, most of all at
    // the horizon (never a cartoon blue over the terracotta); dusk and night keep their colour
    if (!gpuSky) mat.fragmentShader = mat.fragmentShader
      .replace('uniform float time;', 'uniform float time;\nuniform float skyExposure;\nuniform float skySat;')
      .replace(
        'gl_FragColor = vec4( texColor, 1.0 );',
        `vec3 skyC = texColor * skyExposure;
			float skyL = dot( skyC, vec3( 0.2126, 0.7152, 0.0722 ) );
			float skyHaze = 1.0 - smoothstep( 0.0, 0.45, direction.y );
			skyC = mix( vec3( skyL ) * vec3( 1.03, 1.01, 0.98 ), skyC, clamp( skySat - 0.3 * skyHaze * ( 1.0 - skySat ), 0.0, 1.0 ) );
			gl_FragColor = vec4( skyC, 1.0 );`,
      )
    const u = mat.uniforms
    const s = LIGHTING.sky
    u.turbidity.value = s.turbidity
    u.rayleigh.value = s.rayleigh
    u.mieCoefficient.value = s.mieCoefficient
    u.mieDirectionalG.value = s.mieDirectionalG
    u.cloudCoverage.value = s.clouds.enabled ? s.clouds.coverage : 0
    u.cloudDensity.value = s.clouds.density
    u.cloudElevation.value = s.clouds.elevation
    u.cloudScale.value = s.clouds.scale
    u.cloudSpeed.value = s.clouds.speed
    u.sunPosition.value.copy(sunDirection())
    if (!gpuSky) patchNightSky(mat)
    sky.frustumCulled = false
    sky.renderOrder = -10
    return sky
  }, [])
}

export function SkyAndSun() {
  const sky = useSky()
  const tier = useMuseum((s) => s.tier)
  const preset = withDevOverrides(QUALITY_PRESETS[tier])
  const light = useRef<THREE.DirectionalLight>(null)
  const gl = useThree((s) => s.gl)
  const dir = useMemo(() => sunDirection(), [])
  const target = useMemo(() => {
    const o = new THREE.Object3D()
    o.position.copy(SUN_TARGET)
    o.updateMatrixWorld()
    return o
  }, [])
  const currentZone = useRef<string>('')
  const currentFrustum = useRef<(typeof FRUSTA)[keyof typeof FRUSTA]>(FRUSTA.site)

  useEffect(() => {
    const l = light.current
    if (!l) return
    l.target = target
    const cam = l.shadow.camera
    const half = currentFrustum.current.half
    cam.left = -half
    cam.right = half
    cam.top = half
    cam.bottom = -half
    cam.near = 1
    cam.far = 2 * SUN_DIST
    cam.updateProjectionMatrix()
    l.shadow.mapSize.set(preset.shadowMapSize, preset.shadowMapSize)
    l.shadow.bias = -0.0004
    l.shadow.normalBias = 0.025
    l.shadow.radius = 3
    if (l.shadow.map) {
      l.shadow.map.dispose()
      l.shadow.map = null
    }
    gl.shadowMap.needsUpdate = true
  }, [preset.shadowMapSize, target, gl])

  // Time of day: every frame the rendered sun (timeOfDayState `sunState`, glided by
  // <TimeOfDayController>) moves the light, the sky and the oculus mask. Below the horizon the
  // same light is the moon (dayCurve.ts); the sky keeps the real, set sun for its afterglow.
  const color = useMemo(() => new THREE.Color(), [])
  const last = useRef({ el: 999, az: 999, at: 0 })
  useFrame((state) => {
    const c = sunState.curve
    dir.copy(sunDirection(c.lightElevationDeg, c.lightAzimuthDeg))
    const u = (sky.material as THREE.ShaderMaterial).uniforms
    u.sunPosition.value.copy(sunDirection(sunState.elevationDeg, sunState.azimuthDeg))
    if (u.moonDir) u.moonDir.value.copy(sunDirection(MOON.elevationDeg, MOON.azimuthDeg))
    if (u.duskSunDir) u.duskSunDir.value.copy(u.sunPosition.value)
    const o = weatherNow.overcast
    u.turbidity.value = c.turbidity + 6 * o
    u.rayleigh.value = c.rayleigh
    u.skyExposure.value = c.skyExposure
    if (u.skySat) u.skySat.value = Math.min(1, SKY_SAT.day + (SKY_SAT.sunset - SKY_SAT.day) * Math.max(c.sunset * 1.6, c.night, c.twilight))
    if (u.overcastMix) u.overcastMix.value = o
    if (u.stormFlash) u.stormFlash.value = weatherNow.flash
    const l = light.current
    if (l) {
      // cloud takes most of the direct light; the oculus shaft and the patch fade with it
      l.intensity = c.intensity * (1 - 0.88 * o)
      l.color.copy(color.set(kelvinToHex(c.colorK)))
      l.position.copy(dir).multiplyScalar(SUN_DIST).add(target.position)
    }
    ATMOS.uAtmosSun.value.set(dir.x, dir.y, dir.z, 1)
    // Shadows: every 3rd frame while the sun glides, else whenever it has moved a little (the live
    // sun moves ~0.25° a minute: that is a refresh every ~5 min).
    const L = last.current
    const moved = Math.abs(c.lightElevationDeg - L.el) + Math.abs(c.lightAzimuthDeg - L.az)
    if (sunState.moving ? state.clock.elapsedTime - L.at > 0.05 && moved > 0.02 : moved > 1.2) {
      L.el = c.lightElevationDeg
      L.az = c.lightAzimuthDeg
      L.at = state.clock.elapsedTime
      requestShadowRefresh(sunState.moving ? 1 : 3)
    }
  })

  // The frustum follows the visitor between the drum and the outside (FRUSTA); it is
  // (re)applied when that changes. Re-rendered only on change.
  useFrame((_, dt) => {
    if (!VR_MODE) (sky.material as THREE.ShaderMaterial).uniforms.time.value += dt
    const id = perchZone() ?? zoneAt(visitor.x, visitor.z)?.id ?? currentZone.current
    if (id && id !== currentZone.current) {
      currentZone.current = id
      const f = frustumFor(id)
      if (f === currentFrustum.current) return
      currentFrustum.current = f
      const c = f.target
      target.position.copy(c)
      target.updateMatrixWorld()
      // Size the orthographic shadow frustum to the space (+ margin for the oblique sun).
      const l = light.current
      if (l) {
        const half = f.half
        const cam = l.shadow.camera
        cam.left = -half
        cam.right = half
        cam.top = half
        cam.bottom = -half
        cam.updateProjectionMatrix()
      }
      light.current?.position.copy(dir.clone().multiplyScalar(SUN_DIST).add(c))
      requestShadowRefresh()
    }
  })

  const pos = dir.clone().multiplyScalar(SUN_DIST).add(SUN_TARGET)
  return (
    <>
      <primitive object={sky} />
      <primitive object={target} />
      <directionalLight
        ref={light}
        position={pos.toArray()}
        intensity={LIGHTING.sun.intensity}
        color={kelvinToHex(LIGHTING.sun.colorK)}
        castShadow={preset.shadows}
      />
    </>
  )
}

/**
 * The scene is static, so shadow maps are rendered on demand: continuously while
 * assets stream in, then frozen — a large, invisible performance win.
 */
let refreshFrames = 0
/** How long the shadow maps keep redrawing after (re)configuration, and after a late asset loads (ms). */
const SHADOW_SETTLE_MS = 4000
const SHADOW_LATE_MS = 600
/** Ask the frozen shadow map to re-render for a few frames (after moving the frustum / loading assets). */
export function requestShadowRefresh(frames = 3) {
  refreshFrames = Math.max(refreshFrames, frames)
}

export function ShadowUpdater() {
  const gl = useThree((s) => s.gl)
  const tier = useMuseum((s) => s.tier)
  /**
   * Refresh until this time (performance.now(), ms). The windows are in time, not frames: a
   * window of frames lasts far longer on a slow GPU, and every refreshed frame redraws every
   * shadow map — the court then stayed in it for half a minute after each late asset.
   */
  const until = useRef(0)
  useEffect(() => {
    gl.shadowMap.autoUpdate = false
    gl.shadowMap.needsUpdate = true
    until.current = performance.now() + SHADOW_SETTLE_MS
  }, [gl, tier])
  // Late assets (artworks, GLBs) re-arm a short refresh window when they finish loading.
  useEffect(() => {
    const mgr = THREE.DefaultLoadingManager
    const prev = mgr.onLoad
    mgr.onLoad = () => {
      until.current = Math.max(until.current, performance.now() + SHADOW_LATE_MS)
      prev?.()
    }
    return () => {
      mgr.onLoad = prev
    }
  }, [])
  useFrame(() => {
    // Refresh for the first ~4 s after (re)configuration, then freeze.
    if (performance.now() < until.current) gl.shadowMap.needsUpdate = true
    if (refreshFrames > 0) {
      refreshFrames--
      gl.shadowMap.needsUpdate = true
    }
  })
  return null
}
