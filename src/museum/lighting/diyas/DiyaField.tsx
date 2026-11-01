/**
 * DIYA NIGHT (SPECTACLE F28, F2; GRAND §6.2 #8) — clay lamps that light at dusk. On a festival
 * night (the visitor's toggle, or the curator's Diwali window) every set lights in a spiral wave
 * from the pool round the lotus outward: round the curb, the podium bases, along the Wine Hall and
 * the serpentine Parikrama, round the Sphere Well's rim, out through the Earth Room and down the
 * forecourt to the disc's edge — 200 / 400 / 800 lamps by tier. Otherwise only the court and the
 * threshold are lit (config/diyas.ts EVENING_SETS).
 *
 * Draw calls: bowls (one InstancedMesh, ~100 triangles a lamp, a warm inner glow), flames and
 * halos (one instanced quad pair: a teardrop flame and a soft halo), and the room light, which
 * is not a light at all: a top-down light map of Gaussian splats (inject.ts `uAtmosDiyaMap`),
 * re-rendered a few times a second for the flicker (static on Low). A few SpotPool lights are
 * lent to the clusters nearest the visitor. Flicker stays under 3 Hz and 10 % of the flame's
 * brightness; the Still form neither flickers nor runs the wave.
 *
 * Toggling the festival or the time changes uniforms only: no geometry is rebuilt, nothing
 * compiles (every material is mounted, empty, at startup).
 */
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { kelvinToHex } from '../../config/lighting'
import { DIYA_CAPS, DIYAS, EVENING_SETS, standingDiyas, thinDiyas, type Diya, type DiyaSet, DIYA_SETS } from '../../config/diyas'
import { COLLIDERS, ignoreLow, pointDistance } from '../../navigation/collision'
import { kindProps, spectacleSettings, useSpectacle } from '../../spectacle/settings'
import { fireCue, onCue } from '../../spectacle/cues'
import { useMuseum } from '../../state/store'
import { visitor } from '../../state/visitor'
import { ambience } from '../timeOfDayState'
import { ATMOS, SITE_BOX } from '../atmosphere/inject'
import { grade } from '../atmosphere/choreography'
import { coveMaster } from '../atmosphere/CoveLights'
import { registerSpot, type SpotRequest } from '../SpotPool'
import { diyaNow, festivalActive } from './diyaState'

/** Seconds the spiral wave takes from the water ring to the disc's edge. */
const WAVE_S = 22
/** Lamps light from dusk (ambience.night), with a little hysteresis. */
const ON_AT = 0.24
const OFF_AT = 0.16
/** Splat radius (σ, m) and peak of one lamp in the light map. */
const SPLAT_SIGMA = 0.55
const SPLAT_PEAK = 0.9
/** A lent spot (2.4 m up, wide) hangs at least this far from a wall, or it burns the wall beside it. */
const SPOT_CLEAR = 1.0
/** Distance (m, plan) from (x, z) to the nearest wall or tall fixture. */
const wallClearance = (x: number, z: number) => COLLIDERS.reduce((m, c) => (ignoreLow(c) ? m : Math.min(m, pointDistance(c, x, z))), Infinity)

const sets = (): DiyaSet[] => {
  const v = String(kindProps('diya-field').sets ?? '')
  const list = v
    .split(',')
    .map((s) => s.trim())
    .filter((s): s is DiyaSet => (DIYA_SETS as readonly string[]).includes(s))
  return list.length ? list : [...DIYA_SETS]
}

/* ------------------------------------------------------------------ */
/* Shaders                                                             */
/* ------------------------------------------------------------------ */

/** Lit level of a lamp: the evening sets follow uEve, the festival-only ones uFest. */
const LIT = /* glsl */ `
uniform float uWaveEve;   // wave position (seq units) of the evening lamps
uniform float uWaveFest;  // … of the festival-only lamps
uniform float uFest;      // 0 … 1 festival
uniform float uOn;        // 0 … 1 master
float diyaLit(float seq, float evening) {
  float w = evening > 0.5 ? uWaveEve : uWaveFest;
  float l = smoothstep(seq, seq + 0.035, w);
  return l * uOn * (evening > 0.5 ? 1.0 : uFest);
}
`

const FLAME_VERT = /* glsl */ `
${LIT}
attribute vec3 aPos;
attribute vec4 aLamp;     // seq, evening, phase, scale
attribute float aPart;    // 0 flame, 1 halo
uniform float uTime;
uniform float uFlicker;
uniform float uHalo;
varying vec2 vUv;
varying float vPart;
varying float vLit;
varying float vFlick;
void main() {
  float lit = diyaLit(aLamp.x, aLamp.y);
  vLit = lit;
  vPart = aPart;
  vUv = uv;
  float ph = aLamp.z;
  // under 3 Hz, under 10 % luminance
  float fl = 0.5 * sin(uTime * 6.9 + ph) + 0.3 * sin(uTime * 14.6 + ph * 2.3) + 0.2 * sin(uTime * 3.1 + ph * 5.1);
  vFlick = 1.0 - 0.08 * uFlicker * (0.5 + 0.5 * fl);
  vec3 c = aPos + vec3(0.0, 0.035 * aLamp.w, 0.0);
  vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 camUp = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  vec3 p;
  if (aPart < 0.5) {
    // flame: a small upright billboard, swaying a touch with the flicker
    float h = 0.065 * aLamp.w * (0.85 + 0.3 * lit) * (0.96 + 0.04 * fl * uFlicker);
    float w = 0.03 * aLamp.w;
    vec3 sway = right * (0.006 * uFlicker * sin(uTime * 2.2 + ph) * position.y);
    p = c + right * (position.x * w) + vec3(0.0, position.y * h, 0.0) + sway;
  } else {
    float s = uHalo * aLamp.w;
    p = c + vec3(0.0, 0.03, 0.0) + (right * position.x + camUp * (position.y - 0.5)) * s;
  }
  if (lit <= 0.001) p = vec3(0.0, -50.0, 0.0);
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}
`

const FLAME_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uHaloGain;
varying vec2 vUv;
varying float vPart;
varying float vLit;
varying float vFlick;
void main() {
  vec3 col;
  if (vPart < 0.5) {
    // teardrop: round below, pointed above
    vec2 p = vec2(vUv.x - 0.5, vUv.y);
    float wid = 0.5 * sqrt(max(0.0, sin(3.14159 * pow(p.y, 0.62)))) * (1.0 - 0.35 * p.y);
    float d = abs(p.x) / max(wid, 1e-3);
    float a = 1.0 - smoothstep(0.55, 1.0, d);
    a *= smoothstep(0.0, 0.08, p.y) * (1.0 - smoothstep(0.86, 1.0, p.y));
    float core = (1.0 - smoothstep(0.0, 0.5, d)) * (1.0 - smoothstep(0.15, 0.6, p.y));
    col = mix(uColor * 2.4, vec3(4.2, 3.6, 2.6), core) * a;
    col *= mix(1.0, 0.55, smoothstep(0.55, 1.0, p.y));
  } else {
    float r = length(vUv - 0.5) * 2.0;
    col = uColor * exp(-r * r * 4.5) * uHaloGain * (1.0 - smoothstep(0.85, 1.0, r));
  }
  col *= vLit * vFlick;
  if (dot(col, vec3(1.0)) < 0.0005) discard;
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`

const SPLAT_VERT = /* glsl */ `
${LIT}
attribute vec3 aPos;
attribute vec4 aLamp;
uniform vec4 uBox;        // x0, z0, 1/width, 1/depth
uniform float uSigma;
uniform float uTime;
uniform float uFlicker;
varying vec2 vOff;
varying float vLit;
void main() {
  vLit = diyaLit(aLamp.x, aLamp.y) * (1.0 - 0.06 * uFlicker * (0.5 + 0.5 * sin(uTime * 6.3 + aLamp.z)));
  vOff = position.xy * 3.2;              // in σ units
  vec2 w = aPos.xz + position.xy * 3.2 * uSigma;
  vec2 ndc = (w - uBox.xy) * uBox.zw * 2.0 - 1.0;
  gl_Position = vec4(vLit > 0.001 ? ndc : vec2(-9.0), 0.0, 1.0);
}
`

const SPLAT_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uEncode;
varying vec2 vOff;
varying float vLit;
void main() {
  float g = exp(-0.5 * dot(vOff, vOff));
  gl_FragColor = vec4(uColor * g * vLit * uEncode, 1.0);
}
`

/* ------------------------------------------------------------------ */
/* Geometry                                                            */
/* ------------------------------------------------------------------ */

/** A shallow clay lamp with a pinched lip: ~100 triangles. */
function bowlGeometry() {
  const pts = [
    [0.0, 0.0],
    [0.03, 0.0],
    [0.046, 0.008],
    [0.055, 0.022],
    [0.056, 0.03],
    [0.05, 0.031],
    [0.042, 0.02],
    [0.024, 0.013],
    [0.0, 0.012],
  ].map(([x, y]) => new THREE.Vector2(x, y))
  const g = new THREE.LatheGeometry(pts, 7)
  g.computeVertexNormals()
  return g
}

function lampAttributes(geo: THREE.InstancedBufferGeometry, lamps: Diya[], evening: ReadonlySet<DiyaSet>) {
  const pos = new Float32Array(lamps.length * 3)
  const lamp = new Float32Array(lamps.length * 4)
  lamps.forEach((d, i) => {
    pos.set([d.x, d.y, d.z], i * 3)
    lamp.set([d.seq, evening.has(d.set) ? 1 : 0, (i * 2.399) % (Math.PI * 2), d.scale], i * 4)
  })
  geo.setAttribute('aPos', new THREE.InstancedBufferAttribute(pos, 3))
  geo.setAttribute('aLamp', new THREE.InstancedBufferAttribute(lamp, 4))
  geo.instanceCount = lamps.length
}

/** Flame + halo quads as one instanced geometry (aPart 0 / 1). */
function flameGeometry(lamps: Diya[], evening: ReadonlySet<DiyaSet>) {
  const g = new THREE.InstancedBufferGeometry()
  const position = [-0.5, 0, 0, 0.5, 0, 0, 0.5, 1, 0, -0.5, 1, 0, -0.5, 0, 0, 0.5, 0, 0, 0.5, 1, 0, -0.5, 1, 0]
  const uv = [0, 0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1]
  const part = [0, 0, 0, 0, 1, 1, 1, 1]
  g.setAttribute('position', new THREE.Float32BufferAttribute(position, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setAttribute('aPart', new THREE.Float32BufferAttribute(part, 1))
  // halos first, flames over them
  g.setIndex([4, 5, 6, 4, 6, 7, 0, 1, 2, 0, 2, 3])
  lampAttributes(g, lamps, evening)
  return g
}

function splatGeometry(lamps: Diya[], evening: ReadonlySet<DiyaSet>) {
  const g = new THREE.InstancedBufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3))
  g.setIndex([0, 1, 2, 0, 2, 3])
  lampAttributes(g, lamps, evening)
  return g
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

interface Cluster {
  x: number
  z: number
  seq: number
  evening: boolean
  req: SpotRequest
}

export function DiyaField() {
  const gl = useThree((s) => s.gl)
  const st = useSpectacle()
  const caps = st.caps
  const tier = useMuseum((s) => s.tier)
  // GRAND §6.2 #8: 200 / 400 / 800 lamps
  const cap = DIYA_CAPS[tier]
  const props = useMemo(() => kindProps('diya-field'), [])
  const flicker = typeof props.flicker === 'number' ? props.flicker : 0.6
  const colorK = typeof props.colorK === 'number' ? props.colorK : 1900
  const instant = props.ignite === 'instant'
  const spotsLent = st.caps.diyaMapPx >= 512 ? 4 : st.caps.diyaMapPx >= 256 ? 3 : 2

  // none inside furniture or a display: the scene's colliders decide
  const lamps = useMemo(() => thinDiyas(standingDiyas(DIYAS, (x, z) => COLLIDERS.some((c) => pointDistance(c, x, z) < 0.05)), sets(), cap), [cap])
  const evening = useMemo(() => new Set<DiyaSet>(EVENING_SETS), [])

  // shared lit uniforms (one object per uniform, shared by every material below)
  const lit = useMemo(
    () => ({
      uWaveEve: { value: 0 },
      uWaveFest: { value: 0 },
      uFest: { value: 0 },
      uOn: { value: 0 },
      uTime: { value: 0 },
      uFlicker: { value: flicker },
    }),
    [flicker],
  )
  const color = useMemo(() => new THREE.Color(kelvinToHex(colorK)), [colorK])

  /* bowls */
  const bowls = useMemo(() => {
    const mat = new THREE.MeshStandardMaterial({ name: 'diyaBowl', color: '#9c4a34', roughness: 0.78, metalness: 0 })
    mat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, lit, { uGlowCol: { value: color } })
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>\n${LIT}\nattribute vec4 aLamp;\nvarying float vDiyaLit;\nvarying float vDiyaY;`)
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>\nvDiyaLit = diyaLit(aLamp.x, aLamp.y);\nvDiyaY = position.y;\n// a bowl is set out with its lamp: hidden while its set is not part of the night\nfloat diyaShow = uOn * (aLamp.y > 0.5 ? 1.0 : step(0.01, uFest));\ntransformed *= aLamp.w * step(0.001, diyaShow);`,
        )
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>\nuniform vec3 uGlowCol;\nvarying float vDiyaLit;\nvarying float vDiyaY;`)
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\ntotalEmissiveRadiance += uGlowCol * vDiyaLit * (0.25 + 1.4 * smoothstep(0.012, 0.03, vDiyaY));`)
    }
    mat.customProgramCacheKey = () => 'diyaBowl'
    const mesh = new THREE.InstancedMesh(bowlGeometry(), mat, lamps.length)
    const m4 = new THREE.Matrix4()
    const lampAttr = new Float32Array(lamps.length * 4)
    lamps.forEach((d, i) => {
      mesh.setMatrixAt(i, m4.makeRotationY(i * 1.7).setPosition(d.x, d.y, d.z))
      lampAttr.set([d.seq, evening.has(d.set) ? 1 : 0, 0, d.scale], i * 4)
    })
    mesh.geometry.setAttribute('aLamp', new THREE.InstancedBufferAttribute(lampAttr, 4))
    mesh.instanceMatrix.needsUpdate = true
    mesh.frustumCulled = false
    mesh.castShadow = false
    mesh.receiveShadow = false
    mesh.raycast = () => null
    mesh.name = 'diya-bowls'
    return mesh
  }, [lamps, evening, lit, color])

  /* flames and halos */
  const flames = useMemo(() => {
    const mat = new THREE.ShaderMaterial({
      name: 'diyaFlames',
      vertexShader: FLAME_VERT,
      fragmentShader: FLAME_FRAG,
      uniforms: { ...lit, uColor: { value: color }, uHalo: { value: 0.42 }, uHaloGain: { value: 0.32 } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
    const mesh = new THREE.Mesh(flameGeometry(lamps, evening), mat)
    mesh.frustumCulled = false
    mesh.renderOrder = 20
    mesh.raycast = () => null
    mesh.name = 'diya-flames'
    return mesh
  }, [lamps, evening, lit, color])

  /* the light map */
  const map = useMemo(() => {
    const px = caps.diyaMapPx
    const half = gl.extensions.has('EXT_color_buffer_float') || gl.extensions.has('EXT_color_buffer_half_float')
    const rt = new THREE.WebGLRenderTarget(px, Math.round((px * (SITE_BOX.z1 - SITE_BOX.z0)) / (SITE_BOX.x1 - SITE_BOX.x0)), {
      type: half ? THREE.HalfFloatType : THREE.UnsignedByteType,
      depthBuffer: false,
      stencilBuffer: false,
      magFilter: THREE.LinearFilter,
      minFilter: THREE.LinearFilter,
      generateMipmaps: false,
    })
    rt.texture.name = 'diyaLightMap'
    const encode = half ? 1 : 0.25
    const mat = new THREE.ShaderMaterial({
      name: 'diyaSplat',
      vertexShader: SPLAT_VERT,
      fragmentShader: SPLAT_FRAG,
      uniforms: {
        ...lit,
        uBox: { value: ATMOS.uAtmosSiteBox.value },
        uSigma: { value: SPLAT_SIGMA },
        uColor: { value: color.clone().multiplyScalar(SPLAT_PEAK) },
        uEncode: { value: encode },
      },
      depthTest: false,
      depthWrite: false,
      transparent: true,
      blending: THREE.AdditiveBlending,
    })
    const mesh = new THREE.Mesh(splatGeometry(lamps, evening), mat)
    mesh.frustumCulled = false
    const scene = new THREE.Scene()
    scene.add(mesh)
    const cam = new THREE.OrthographicCamera()
    return { rt, scene, cam, mesh, decode: 1 / encode, dirty: true, t: 0 }
  }, [gl, caps.diyaMapPx, lamps, evening, lit, color])

  useEffect(() => {
    // compile the splat program now, not on the first lamp
    try {
      gl.compile(map.scene, map.cam)
    } catch {
      /* compiled on first use */
    }
    return () => {
      map.rt.dispose()
      map.mesh.geometry.dispose()
      ;(map.mesh.material as THREE.Material).dispose()
      if (ATMOS.uAtmosDiyaMap.value === map.rt.texture) {
        ATMOS.uAtmosDiyaGain.value = 0
      }
    }
  }, [gl, map])
  useEffect(
    () => () => {
      bowls.geometry.dispose()
      ;(bowls.material as THREE.Material).dispose()
      bowls.dispose()
      flames.geometry.dispose()
      ;(flames.material as THREE.Material).dispose()
    },
    [bowls, flames],
  )

  /* SpotPool lights lent to the nearest lit clusters */
  const clusters = useMemo<Cluster[]>(() => {
    const out: Cluster[] = []
    const chunk = 10
    for (let i = 0; i < lamps.length; i += chunk) {
      const g = lamps.slice(i, i + chunk)
      if (g.some((d) => d.set === 'pool' || d.set === 'curb')) continue // the court has its own light
      let x = g.reduce((s, d) => s + d.x, 0) / g.length
      let z = g.reduce((s, d) => s + d.z, 0) / g.length
      // a run of lamps that turns a corner (through a doorway) has its middle in the wall: hang the
      // light over the lamp of the run that stands clearest of the walls instead, or lend none
      if (wallClearance(x, z) < SPOT_CLEAR) {
        const best = g.map((d) => [d, wallClearance(d.x, d.z)] as const).sort((p, q) => q[1] - p[1])[0]
        if (!best || best[1] < SPOT_CLEAR * 0.6) continue
        x = best[0].x
        z = best[0].z
      }
      out.push({
        x,
        z,
        seq: g[0].seq,
        evening: evening.has(g[0].set),
        req: { position: [x, 2.4, z], target: [x, 0, z], intensity: 0, angle: 0.95, penumbra: 1, color: kelvinToHex(colorK), tag: 'diya' },
      })
    }
    return out
  }, [lamps, evening, colorK])
  const lent = useRef<{ req: SpotRequest; off: () => void }[]>([])
  useEffect(() => {
    lent.current = Array.from({ length: spotsLent }, () => {
      const req: SpotRequest = { position: [0, 2.4, 0], target: [0, 0, 0], intensity: 0, angle: 0.95, penumbra: 1, color: kelvinToHex(colorK), tag: 'diya' }
      return { req, off: registerSpot(req) }
    })
    return () => lent.current.forEach((l) => l.off())
  }, [spotsLent, colorK])

  /* the night: ignition, the wave, the map */
  const run = useRef({ on: false, fest: false, eveAt: -1, festAt: -1, festPending: false, festCheck: 0, festNow: false, pick: 0, frames: 0 })
  useEffect(
    () =>
      onCue('night:diyas', (e) => {
        // a docent, the tour or Help → Moments lights the festival now, at night
        if (e.source !== 'docent' && e.source !== 'tour' && e.source !== 'visitor' && e.source !== 'replay') return
        const st = useMuseum.getState()
        st.setFestival('on')
        if (ambience.night < 0.3) st.setTimeOfDay('night')
      }),
    [],
  )

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 0.1)
    const r = run.current
    const t = state.clock.elapsedTime
    const still = spectacleSettings().mode === 'still'
    r.festCheck -= dt
    if (r.festCheck <= 0) {
      r.festCheck = 1
      r.festNow = festivalActive()
    }
    const wasOn = r.on
    r.on = ambience.night > (r.on ? OFF_AT : ON_AT)
    const entered = useMuseum.getState().phase === 'entered'
    // the first frames: a visit that begins at night finds the evening lamps already lit
    if (r.frames++ < 2 || !entered) {
      if (r.on) r.eveAt = -1e6
      r.festPending = r.on && r.festNow
    } else if (r.on && !wasOn) {
      r.eveAt = t
      r.festPending = r.festNow
    }
    // the festival's spiral runs when someone is there to see it (after Enter)
    if (r.on && r.festNow && !r.fest && entered) r.festPending = true
    if (r.festPending && entered && r.on && r.festNow) {
      r.festPending = false
      r.festAt = t
      fireCue('night:diyas', { source: 'system' })
    }
    r.fest = r.festNow && r.festAt >= 0
    const u = lit
    u.uOn.value += ((r.on ? 1 : 0) - u.uOn.value) * (1 - Math.exp(-(r.on ? 3 : ambience.night < 0.05 ? 5 : 2.2) * dt))
    if (!r.on && (u.uOn.value < 0.01 || (ambience.night < 0.02 && u.uOn.value < 0.2))) u.uOn.value = 0
    u.uFest.value += ((r.fest ? 1 : 0) - u.uFest.value) * (1 - Math.exp(-2.5 * dt))
    const waveOf = (at: number) => (still || instant || at < 0 ? 2 : (t - at) / WAVE_S)
    u.uWaveEve.value = waveOf(r.eveAt)
    u.uWaveFest.value = r.fest && !r.festPending ? waveOf(r.festAt) : 0
    if (!still) u.uTime.value += dt
    u.uFlicker.value = still ? 0 : flicker
    diyaNow.lit = u.uOn.value
    diyaNow.festival = u.uFest.value * u.uOn.value
    diyaNow.wave = r.fest && r.on ? t - r.festAt : -1

    // the pavilion goes dark, then the lamps take over (coves down to half on a festival night)
    const dark = r.fest && r.on && !still ? Math.max(0, 1 - (t - r.festAt) / 5) : 0
    grade.festival = 1 - 0.2 * dark
    coveMaster.gain = 1 - 0.5 * diyaNow.festival
    ;(flames.material as THREE.ShaderMaterial).uniforms.uHalo.value = st.off ? 0 : caps.grade ? 0.3 : 0.42
    flames.visible = !useMuseum.getState().sceneCompiled || u.uOn.value > 0
    bowls.visible = flames.visible

    // the light map: re-rendered at the tier's rate while lit (once, then held, on Low)
    const lamp = u.uOn.value > 0
    ATMOS.uAtmosDiyaMap.value = map.rt.texture
    ATMOS.uAtmosDiyaGain.value = lamp ? map.decode : 0
    if (lamp) {
      const hz = caps.diyaMapHz
      const settling = u.uOn.value < 0.999 || (u.uFest.value > 0.001 && u.uFest.value < 0.999) || u.uWaveEve.value < 1.2 || (r.fest && u.uWaveFest.value < 1.2)
      map.t -= dt
      const due = hz > 0 ? map.t <= 0 : settling ? map.t <= 0 : map.dirty
      if (due) {
        map.t = hz > 0 ? 1 / hz : 0.25
        map.dirty = settling
        const prevTarget = gl.getRenderTarget()
        const prevClear = gl.getClearColor(tmpC)
        const prevAlpha = gl.getClearAlpha()
        gl.setRenderTarget(map.rt)
        gl.setClearColor(0x000000, 1)
        gl.clear(true, false, false)
        gl.render(map.scene, map.cam)
        gl.setRenderTarget(prevTarget)
        gl.setClearColor(prevClear, prevAlpha)
      }
    } else map.dirty = true

    // lend spots to the nearest lit clusters, a few times a second
    r.pick -= dt
    if (r.pick <= 0) {
      r.pick = 0.4
      const ranked = lamp
        ? clusters
            .filter((c) => (c.evening ? u.uWaveEve.value : u.uWaveFest.value * (r.fest ? 1 : 0)) > c.seq)
            .map((c) => [c, Math.hypot(c.x - visitor.x, c.z - visitor.z)] as const)
            .sort((a, b) => a[1] - b[1])
        : []
      lent.current.forEach((l, i) => {
        const c = ranked[i]?.[0]
        if (!c || ranked[i][1] > 9) {
          l.req.intensity = 0
          return
        }
        l.req.position = [c.x, 2.4, c.z]
        l.req.target = [c.x, 0, c.z]
        l.req.intensity = 7 * u.uOn.value
      })
    }
  })

  return (
    <>
      <primitive object={bowls} />
      <primitive object={flames} />
    </>
  )
}

const tmpC = new THREE.Color()
