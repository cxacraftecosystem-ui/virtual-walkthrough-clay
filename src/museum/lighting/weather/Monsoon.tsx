/**
 * MONSOON THROUGH THE OCULUS (SPECTACLE F15, GRAND §6.2 #7) — the sky closes, the shaft
 * dissolves, and rain falls only through the Ø 10 m opening, 22 m down into the pool round the
 * lotus; outdoors (M+) it falls on the plinth, the forecourt and the open Parikrama — drawn only
 * while the visitor (the camera) is outdoors, so no outdoor rain is ever seen through a wall. The open floors darken and polish (the injection's `uWet`), the water ring
 * reads `rainNow()` for its rings (WP3), and one soft brightening at most every 20 s lifts the
 * sky (no strobe). It passes by itself after `monsoonSec`; then, if the curator allows, the
 * petrichor line is offered (overlays/atmosphere).
 *
 * Streaks are instanced quads moved on the GPU only (a falling phase per streak): one draw for
 * the oculus column, one for the outdoor box that travels with the visitor and skips anything
 * under a roof. Counts per tier; the Still form shows a light, slow fall.
 */
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { DEG, KEY, MUSEUM } from '../../config/museum'
import { SAT_WALL, SATELLITES } from '../../config/satellites'
import { ZONES, zoneAt } from '../../config/layout'
import { perchZone } from '../../navigation/perch'
import { WATER_RING } from '../../config/diyas'
import { ZoneGroup } from '../../navigation/zoneCulling'
import { caption } from '../../spectacle/captions'
import { fireCue, onCue } from '../../spectacle/cues'
import { kindProps, spectacleSettings } from '../../spectacle/settings'
import { useMuseum } from '../../state/store'
import { ATMOS, ROOF_Y1 } from '../atmosphere/inject'
import { sunState } from '../timeOfDayState'
import { stepWeather, useWeather, weatherNow } from './weatherState'

/** The column of rain: just inside the oculus's rim. */
const OC_R = MUSEUM.oculus.r - 0.12
const f = (v: number) => (Number.isInteger(v) ? v.toFixed(1) : String(v))

/** Outdoor box round the visitor (m). */
const BOX = { half: 14, top: 12 }
/** The satellite rooms' span (their roofs keep the rain off), deg. */
const ROOMS_FROM = Math.min(...SATELLITES.map((s) => s.fromDeg))
const ROOMS_TO = Math.max(...SATELLITES.map((s) => s.toDeg))
const OUTDOOR_ZONES = new Set(ZONES.filter((z) => z.outdoor).map((z) => z.id))

const RAIN_VERT = /* glsl */ `
attribute vec4 aSeed;       // x, z (unit box / disc), phase, length
uniform float uTime;
uniform float uSpeed;
uniform float uLevel;       // 0 … 1: share of streaks falling
uniform float uOutdoor;     // 1 = the box round the visitor
uniform vec3 uCenter;       // box centre (outdoor)
varying float vA;
varying float vV;
bool roofed(vec2 q) {
  float r = length(q);
  float a = atan(q.y, q.x);
  bool ringSide = a >= ${f((MUSEUM.drum.dNotchDeg - 360) * DEG)} && a <= ${f(MUSEUM.drum.neNotchDeg * DEG)};
  if (r < (ringSide ? ${f(KEY.ringOuterR + MUSEUM.pavilion.roofOverhang)} : ${f(KEY.lobeOuterR + MUSEUM.pavilion.roofOverhang)})) return true;
  if (abs(q.x) < ${f(KEY.annexOuterHalf + MUSEUM.pavilion.roofOverhang)} && q.y > 0.0 && q.y < ${f(KEY.annexOuterZ + MUSEUM.pavilion.roofOverhang)}) return true;
  // the four earth-sheltered rooms on the north side (the Parikrama walk is open to the sky)
  float t = a - ${f(ROOMS_FROM * DEG)};
  t -= 6.2831853 * floor(t / 6.2831853);
  return r > ${f(SAT_WALL.innerC - SAT_WALL.t / 2)} && r < ${f(SAT_WALL.outerOuter + 0.3)} && t <= ${f((ROOMS_TO - ROOMS_FROM) * DEG)};
}
void main() {
  vA = 0.0;
  vV = uv.y;
  if (aSeed.w > uLevel) { gl_Position = vec4(0.0, 0.0, -2.0, 1.0); return; }
  vec3 base;
  float top;
  float bottom;
  if (uOutdoor > 0.5) {
    // a world-fixed lattice wrapped round the visitor, so drops do not travel with them
    vec2 cell = (aSeed.xy - 0.5) * ${f(BOX.half * 2)};
    vec2 w = uCenter.xz + mod(cell - uCenter.xz + ${f(BOX.half)}, ${f(BOX.half * 2)}) - ${f(BOX.half)};
    if (roofed(w)) { gl_Position = vec4(0.0, 0.0, -2.0, 1.0); return; }
    base = vec3(w.x, 0.0, w.y);
    top = ${f(BOX.top)};
    bottom = 0.02;
  } else {
    float ang = aSeed.x * 6.2831853;
    float rr = ${f(OC_R)} * sqrt(aSeed.y);
    base = vec3(cos(ang) * rr, 0.0, sin(ang) * rr);
    top = ${f(ROOF_Y1 + 1.2)};
    // onto the pool, or the lotus on its island in the middle
    bottom = rr > ${f(WATER_RING.r0)} ? ${f(WATER_RING.y)} : 1.1;
  }
  float span = top - bottom;
  float y = top - mod(aSeed.z * span + uTime * uSpeed, span);
  float len = (0.28 + 0.25 * aSeed.w) * min(1.0, uSpeed / 7.0 + 0.2);
  // a thin camera-facing streak (cylindrical billboard)
  vec3 toCam = cameraPosition - vec3(base.x, y, base.z);
  vec3 side = normalize(vec3(toCam.z, 0.0, -toCam.x)) * 0.0028;
  vec3 p = vec3(base.x, y, base.z) + side * (uv.x * 2.0 - 1.0) + vec3(0.0, uv.y * len, 0.0);
  vA = smoothstep(bottom, bottom + 0.15, y) * (1.0 - smoothstep(top - 0.4, top, y + len));
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}
`

const RAIN_FRAG = /* glsl */ `
uniform vec3 uColor;
varying float vA;
varying float vV;
void main() {
  float a = vA * (0.35 + 0.65 * vV);
  if (a <= 0.003) discard;
  gl_FragColor = vec4(uColor * a, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`

function streaks(count: number) {
  const g = new THREE.InstancedBufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0], 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2))
  g.setIndex([0, 1, 2, 0, 2, 3])
  const seed = new Float32Array(count * 4)
  let s = 11
  const rnd = () => {
    s ^= s << 13
    s ^= s >>> 17
    s ^= s << 5
    return (s >>> 0) / 4294967296
  }
  for (let i = 0; i < count; i++) seed.set([rnd(), rnd(), rnd(), (i + 0.5) / count], i * 4)
  g.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seed, 4))
  g.instanceCount = count
  return g
}

function rainMesh(count: number, outdoor: boolean) {
  const mat = new THREE.ShaderMaterial({
    name: outdoor ? 'rainOutdoor' : 'rainOculus',
    vertexShader: RAIN_VERT,
    fragmentShader: RAIN_FRAG,
    uniforms: {
      uTime: { value: 0 },
      uSpeed: { value: 7.5 },
      uLevel: { value: 0 },
      uOutdoor: { value: outdoor ? 1 : 0 },
      uCenter: { value: new THREE.Vector3() },
      uColor: { value: new THREE.Color(0.32, 0.34, 0.37) },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
  const mesh = new THREE.Mesh(streaks(Math.max(1, count)), mat)
  mesh.frustumCulled = false
  mesh.renderOrder = 30
  mesh.raycast = () => null
  mesh.name = mat.name
  return mesh
}

export function Monsoon({ drops, outdoor }: { drops: number; outdoor: boolean }) {
  const oculus = useMemo(() => rainMesh(drops, false), [drops])
  const box = useMemo(() => (outdoor ? rainMesh(drops * 2, true) : null), [drops, outdoor])
  useEffect(
    () => () => {
      for (const m of [oculus, box]) {
        if (!m) continue
        m.geometry.dispose()
        ;(m.material as THREE.Material).dispose()
      }
    },
    [oculus, box],
  )

  const props = useMemo(() => kindProps('atmosphere'), [])
  const monsoonSec = typeof props.monsoonSec === 'number' ? props.monsoonSec : 90
  const chance = typeof props.monsoonChance === 'number' ? props.monsoonChance : 0.15
  const auto = props.weather === 'auto'

  // keep the museum store's copy in step when someone else (a docent cue, WP3) sets the weather
  useEffect(
    () =>
      useWeather.subscribe((s, prev) => {
        if (s.weather !== prev.weather && useMuseum.getState().weather !== s.weather) useMuseum.setState({ weather: s.weather })
      }),
    [],
  )
  useEffect(
    () =>
      onCue('weather:monsoon', (e) => {
        const d = e.data as { phase?: string } | undefined
        if (d?.phase) return // our own announcements
        if (props.weather !== 'clear') useMuseum.getState().setWeather('monsoon')
      }),
    [props.weather],
  )

  const run = useRef({ was: 0, rolled: false, flashing: false, captionT: 0 })
  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1)
    const still = spectacleSettings().mode === 'still'
    stepWeather(dt, monsoonSec, still)
    const w = weatherNow
    const r = run.current
    // 'auto': a chance of a monsoon once a visit, as dusk falls
    if (auto && !r.rolled && useMuseum.getState().phase === 'entered' && sunState.elevationDeg < 4 && sunState.elevationDeg > -4 && sunState.hours > 12) {
      r.rolled = true
      if (Math.random() < chance) useMuseum.getState().setWeather('monsoon')
    }
    // announcements: start, brightening, end (sound and captions follow them)
    if (w.rain > 0.05 && r.was <= 0.05) {
      fireCue('weather:monsoon', { source: 'system', data: { phase: 'start' } })
      caption('caption.rain', 6000)
      r.captionT = 25
    }
    if (w.rain > 0.05) {
      r.captionT -= dt
      if (r.captionT <= 0) {
        caption('caption.rain', 5000)
        r.captionT = 25
      }
    }
    if (w.flash > 0 && !r.flashing) fireCue('weather:monsoon', { source: 'system', data: { phase: 'thunder' } })
    r.flashing = w.flash > 0
    if (w.rain <= 0.05 && r.was > 0.05) fireCue('weather:monsoon', { source: 'system', data: { phase: 'end' } })
    r.was = w.rain

    ATMOS.uAtmosWet.value.set(w.wet, w.wet, 0, 0)
    const level = still ? Math.min(w.rain, 0.35) : w.rain
    for (const m of [oculus, box]) {
      if (!m) continue
      const u = (m.material as THREE.ShaderMaterial).uniforms
      u.uLevel.value = level
      u.uSpeed.value = still ? 2.5 : 7.5
      u.uTime.value += dt
      // lit by the sky: faint by day, fainter at night, brighter in the flash
      const sky = 0.25 + 0.75 * sunState.curve.daylight
      u.uColor.value.setRGB(0.2, 0.215, 0.235).multiplyScalar(sky * (1 + 1.5 * w.flash))
      m.visible = !useMuseum.getState().sceneCompiled || level > 0.001
    }
    if (box) {
      const c = (box.material as THREE.ShaderMaterial).uniforms.uCenter.value as THREE.Vector3
      // the camera, not the visitor: the arrival flight and the roof see it too
      c.copy(cameraPos)
      // outdoor rain only while the camera is outdoors (above the roofs, on the Sky Rim, outside)
      const perched = perchZone()
      const z = perched ?? zoneAt(cameraPos.x, cameraPos.z)?.id
      const outside = cameraPos.y > MUSEUM.pavilion.height + 0.5 || (z !== undefined && OUTDOOR_ZONES.has(z))
      if (useMuseum.getState().sceneCompiled) box.visible = box.visible && outside
    }
  })
  useFrame((state) => {
    cameraPos.copy(state.camera.position)
  }, -1)

  return (
    <>
      <ZoneGroup zones={['inner']}>
        <primitive object={oculus} />
      </ZoneGroup>
      {box && <primitive object={box} />}
    </>
  )
}

const cameraPos = new THREE.Vector3()
