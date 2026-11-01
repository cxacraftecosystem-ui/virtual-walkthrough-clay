/**
 * 'pit-firing' — pots firing in an open pit on the plinth (SPECTACLE F3): the first thing that
 * says clay is *fired*.
 *
 * A ring of stones (Poly Haven's scanned stone fire pit) on a patch of raw earth round a low mound of ash and straw, with pots half buried in it. By day
 * it smoulders: a crawl of embers in the ash and a thin plume of smoke. At dusk it glows: the
 * ash burns orange through its cracks, embers drift over it, sparks lift at night, the smoke
 * catches the firelight from below and a warm pool of light spreads on the paving (a light
 * cookie, not a light: the pavilion's light count never changes).
 *
 *   props {pots = 7, smoke = true, sparks = true}
 *   tiers  smoke billboards L 0 · M 12 · H/U 32; sparks H/U 40 at night; embers 60 / 120 / 200
 *   Still: the fire glows but nothing drifts, rises or flickers.
 */
import { useFrame } from '@react-three/fiber'
import { useContext, useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { rainNow } from '../lighting/weather/weatherState'
import { BLACKBODY_GLSL } from '../materials/blackbody'
import { useMaterials } from '../materials/materials'
import { useSpectacle } from '../spectacle/settings'
import { PIT_HEAT } from '../config/spectacleObjects/craft'
import { useMuseum } from '../state/store'
import { Builder, cyl, lathe, Parts, rng, useBuilt } from './kit'
import { clayMaterial, vesselProfile, type VesselForm } from './clay'
import { tinted, useModelMaterials } from './modelMaterials'
import { SourcedOr } from './erodedFormation'
import { InMuseumScene } from './sceneContext'
import { geoKey, num, type ModelProps } from './types'

const RING_R = 0.86
/** The scanned stone ring, fitted round the mound (its inner rim just outside the ash). */
const PIT_FIT = { w: 2.15, d: 2.15, h: 0.42 }
/** The raw-earth patch round the pit. */
const EARTH_R = 1.6
const MOUND_R = 0.74
const MOUND_H = 0.16

const NOISE_GLSL = /* glsl */ `
float pfHash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float pfNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(pfHash(i), pfHash(i + vec2(1.0, 0.0)), u.x), mix(pfHash(i + vec2(0.0, 1.0)), pfHash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float pfFbm(vec2 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++) { s += a * pfNoise(p); p *= 2.07; a *= 0.5; } return s; }
`

/** The ash bed: grey ash whose cracks burn with a blackbody glow, crawling slowly. */
function emberBedMaterial(uHeat: { value: number }, uTime: { value: number }) {
  const mat = new THREE.MeshStandardMaterial({ name: 'pitAsh', color: '#3b3632', roughness: 1, metalness: 0, envMapIntensity: 0.3 })
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uHeat = uHeat
    shader.uniforms.uPTime = uTime
    shader.vertexShader = 'varying vec3 vPfLocal;\n' + shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvPfLocal = position;')
    shader.fragmentShader =
      `uniform float uHeat; uniform float uPTime; varying vec3 vPfLocal;\n${NOISE_GLSL}\n${BLACKBODY_GLSL}\n` +
      shader.fragmentShader
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
vec2 pp = vPfLocal.xz * 7.0;
float crawl = pfFbm(pp + vec2(uPTime * 0.05, -uPTime * 0.035));
float cracks = pfFbm(pp * 2.3 - vec2(uPTime * 0.02, uPTime * 0.03));
// the core of the mound is hottest; the rim is grey ash
float core = 1.0 - smoothstep(0.15, ${MOUND_R.toFixed(2)}, length(vPfLocal.xz));
float burn = smoothstep(0.52, 0.78, crawl * 0.6 + cracks * 0.5 + core * 0.25) * core;
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.08, 0.06, 0.05), burn * 0.8);`,
        )
        .replace(
          '#include <emissivemap_fragment>',
          `#include <emissivemap_fragment>
totalEmissiveRadiance += emberRamp(0.55 + 0.4 * burn * uHeat) * burn * (0.25 + 1.4 * uHeat);`,
        )
  }
  mat.customProgramCacheKey = () => 'pitAsh'
  return mat
}

/* ------------------------------------------------------------------ */
/* Smoke, sparks, embers                                               */
/* ------------------------------------------------------------------ */

const SMOKE_VS = /* glsl */ `
attribute float aSeed;
uniform float uTime;
uniform float uOn;
varying vec2 vUv;
varying float vLife;
varying float vSeed;
varying float vY;
void main() {
  vUv = uv;
  vSeed = aSeed;
  float period = 7.0 + aSeed * 3.0;
  float life = fract(uTime / period + aSeed);
  vLife = life;
  // rises, spreads and leans with a slow breeze
  float y = 0.25 + life * (3.0 + aSeed * 0.8);
  vec3 c = vec3(sin(aSeed * 40.0) * 0.25 + life * life * 0.9, y, cos(aSeed * 31.0) * 0.25 + sin(uTime * 0.2 + aSeed * 6.0) * 0.2 * life);
  vY = y;
  float size = (0.35 + life * 1.4) * (0.8 + aSeed * 0.4) * uOn;
  vec4 wc = modelMatrix * vec4(c, 1.0);
  vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  float rot = aSeed * 6.28 + life * 1.2;
  vec2 p = mat2(cos(rot), -sin(rot), sin(rot), cos(rot)) * position.xy;
  vec3 w = wc.xyz + (right * p.x + up * p.y) * size;
  gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
}
`
const SMOKE_FS = /* glsl */ `
uniform float uHeat;
uniform vec3 uDay;
varying vec2 vUv;
varying float vLife;
varying float vSeed;
varying float vY;
${NOISE_GLSL}
void main() {
  vec2 q = vUv - 0.5;
  float r = length(q) * 2.0;
  float n = pfFbm(vUv * 3.0 + vSeed * 17.0 + vLife * 1.5);
  float puff = smoothstep(1.0, 0.25, r + (n - 0.5) * 0.6);
  // fade in at the fire, out as it thins
  float a = puff * smoothstep(0.0, 0.12, vLife) * (1.0 - smoothstep(0.55, 1.0, vLife)) * 0.22;
  // lit from below by the fire, more so at night and near the ground
  float under = (1.0 - smoothstep(0.3, 2.4, vY)) * uHeat;
  vec3 c = mix(uDay, vec3(1.0, 0.48, 0.2), under * 0.7);
  gl_FragColor = vec4(c, a);
}
`

const SPARK_VS = /* glsl */ `
attribute float aSeed;
uniform float uTime;
uniform float uOn;
uniform float uPx;
varying float vA;
void main() {
  float period = 1.6 + aSeed * 1.8;
  float life = fract(uTime / period + aSeed * 7.13);
  float ang = aSeed * 51.0;
  vec3 p = vec3(cos(ang) * 0.3 * aSeed, 0.2 + life * (1.6 + aSeed * 1.4), sin(ang) * 0.3 * aSeed);
  p.x += sin(life * 9.0 + aSeed * 20.0) * 0.12 * life;
  p.z += cos(life * 7.0 + aSeed * 13.0) * 0.12 * life;
  vA = (1.0 - life) * smoothstep(0.0, 0.06, life) * uOn;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = uPx * (0.6 + aSeed) * 0.035 / max(0.1, -mv.z) * uOn;
  gl_Position = projectionMatrix * mv;
}
`
const SPARK_FS = /* glsl */ `
varying float vA;
void main() {
  vec2 q = gl_PointCoord - 0.5;
  float a = smoothstep(0.5, 0.0, length(q)) * vA;
  gl_FragColor = vec4(vec3(1.0, 0.62, 0.25) * a * 3.0, a);
}
`

const EMBER_VS = /* glsl */ `
attribute float aSeed;
uniform float uTime;
uniform float uHeat;
uniform float uPx;
varying float vA;
void main() {
  float ang = aSeed * 97.0 + uTime * (0.05 + aSeed * 0.08);
  float r = sqrt(fract(aSeed * 13.7)) * ${(MOUND_R * 0.9).toFixed(2)};
  float h = ${MOUND_H.toFixed(2)} * (1.0 - (r * r) / ${(MOUND_R * MOUND_R).toFixed(3)}) + 0.02 + fract(aSeed * 5.3) * 0.12 * (0.5 + 0.5 * sin(uTime * 0.6 + aSeed * 30.0));
  vec3 p = vec3(cos(ang) * r, h, sin(ang) * r);
  // a slow glow, well under the flicker limit
  vA = (0.35 + 0.65 * (0.5 + 0.5 * sin(uTime * (0.8 + aSeed * 1.4) + aSeed * 40.0))) * (0.35 + 0.65 * uHeat);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = uPx * (0.4 + fract(aSeed * 3.1) * 0.6) * 0.03 / max(0.1, -mv.z);
  gl_Position = projectionMatrix * mv;
}
`
const EMBER_FS = /* glsl */ `
varying float vA;
void main() {
  vec2 q = gl_PointCoord - 0.5;
  float a = smoothstep(0.5, 0.05, length(q)) * vA;
  gl_FragColor = vec4(vec3(1.0, 0.45, 0.12) * a * 2.4, a);
}
`

const COOKIE_FS = /* glsl */ `
uniform float uHeat;
varying vec2 vUv;
void main() {
  float r = length(vUv - 0.5) * 2.0;
  float a = pow(1.0 - smoothstep(0.2, 1.0, r), 1.6) * smoothstep(0.15, 0.32, r) * uHeat * uHeat;
  gl_FragColor = vec4(vec3(1.0, 0.46, 0.18) * a * 0.6, 1.0);
}
`
const COOKIE_VS = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`

function seeds(n: number, key: string) {
  const r = rng(key)
  return new Float32Array(Array.from({ length: n }, () => r()))
}

const FORMS: VesselForm[] = ['matka', 'kulhad', 'matka', 'bowl', 'diya', 'matka', 'kulhad', 'bowl']

export function PitFiring({ config }: ModelProps) {
  const inScene = useContext(InMuseumScene)
  const m = useModelMaterials()
  const core = useMaterials()
  const sp = useSpectacle()
  const still = sp.mode === 'still'
  const nPots = Math.max(0, Math.min(12, Math.round(num(config, 'pots', 7))))
  const smokeOn = inScene && config.props?.smoke !== false
  const sparksOn = inScene && config.props?.sparks !== false
  const nSmoke = smokeOn ? sp.caps.smoke : 0
  const nSparks = sparksOn ? sp.caps.sparks : 0
  const nEmbers = inScene ? sp.caps.embers : 0
  const tod = useMuseum((s) => s.timeOfDay)
  const heatTarget = PIT_HEAT[tod] ?? 0.3

  // the stone ring: Poly Haven's scanned stone fire pit, fitted round the mound; the faceted field
  // stones only while it loads (or if the file is missing)
  const stones = useBuilt('pit-firing-stones', () => {
    const b = new Builder()
    const r = rng('pit-stones')
    const n = 26
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + r() * 0.08
      const sz = 0.075 + r() * 0.05
      const g = new THREE.DodecahedronGeometry(1, 0)
      b.add(i % 3 ? 'stone' : 'stoneDark', g, { p: [Math.cos(a) * (RING_R + r() * 0.04), sz * 0.45, Math.sin(a) * (RING_R + r() * 0.04)], r: [r() * 3, r() * 3, r() * 3], s: [sz * (1.1 + r() * 0.5), sz * (0.7 + r() * 0.3), sz * (0.9 + r() * 0.4)] })
    }
    return b
  })
  const parts = useBuilt(geoKey('pit-firing', config), () => {
    const b = new Builder()
    const r = rng('pit-stones')
    // straw and sticks over the mound, some charred
    for (let i = 0; i < 70; i++) {
      const a = r() * Math.PI * 2
      const rr = Math.sqrt(r()) * MOUND_R * 0.95
      const y = MOUND_H * (1 - (rr * rr) / (MOUND_R * MOUND_R)) + 0.006
      const len = 0.12 + r() * 0.22
      b.add(rr > 0.45 ? 'straw' : 'char', cyl(0.004, 0.005, len, 5), { p: [Math.cos(a) * rr, y, Math.sin(a) * rr], r: [Math.PI / 2 + (r() - 0.5) * 0.4, r() * Math.PI * 2, (r() - 0.5) * 0.5] })
    }
    // pots half buried in the ash, leaning this way and that
    for (let i = 0; i < nPots; i++) {
      const a = (i / Math.max(1, nPots)) * Math.PI * 2 + 0.4 + r() * 0.3
      const rr = nPots === 1 ? 0 : 0.28 + r() * 0.2
      const form = FORMS[i % FORMS.length]
      const R = form === 'diya' ? 0.06 : form === 'kulhad' ? 0.05 : form === 'bowl' ? 0.1 : 0.1 + r() * 0.03
      const Hh = form === 'diya' ? 0.04 : form === 'kulhad' ? 0.09 : form === 'bowl' ? 0.08 : 0.17 + r() * 0.05
      const ground = MOUND_H * (1 - (rr * rr) / (MOUND_R * MOUND_R))
      b.add(i % 3 === 1 ? 'potDark' : 'pot', lathe(vesselProfile(form, R, Hh), 28), {
        p: [Math.cos(a) * rr, ground - Hh * 0.38, Math.sin(a) * rr],
        r: [(r() - 0.5) * 0.6, r() * 3, (r() - 0.5) * 0.6],
      })
    }
    return b
  })

  const uHeat = useMemo(() => ({ value: heatTarget }), []) // eslint-disable-line react-hooks/exhaustive-deps
  const uTime = useMemo(() => ({ value: 0 }), [])
  const uOn = useMemo(() => ({ value: 1 }), [])
  const uSparkOn = useMemo(() => ({ value: 0 }), [])
  const uPx = useMemo(() => ({ value: 800 }), [])
  const ash = useMemo(() => emberBedMaterial(uHeat, uTime), [uHeat, uTime])
  const moundGeo = useMemo(() => {
    // a low dome of ash, profile from its rim up to the crown
    const pts: THREE.Vector2[] = []
    for (let i = 16; i >= 0; i--) {
      const rr = (i / 16) * MOUND_R
      pts.push(new THREE.Vector2(rr, MOUND_H * (1 - (rr * rr) / (MOUND_R * MOUND_R)) + 0.004))
    }
    return new THREE.LatheGeometry(pts, 48)
  }, [])

  const smokeMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        name: 'pitSmoke',
        vertexShader: SMOKE_VS,
        fragmentShader: SMOKE_FS,
        uniforms: { uTime, uOn, uHeat, uDay: { value: new THREE.Color('#bdb6ad') } },
        transparent: true,
        depthWrite: false,
      }),
    [uTime, uOn, uHeat],
  )
  const sparkMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        name: 'pitSparks',
        vertexShader: SPARK_VS,
        fragmentShader: SPARK_FS,
        uniforms: { uTime, uOn: uSparkOn, uPx },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    [uTime, uSparkOn, uPx],
  )
  const emberMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        name: 'pitEmbers',
        vertexShader: EMBER_VS,
        fragmentShader: EMBER_FS,
        uniforms: { uTime, uHeat, uPx },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    [uTime, uHeat, uPx],
  )
  const cookieMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        name: 'pitCookie',
        vertexShader: COOKIE_VS,
        fragmentShader: COOKIE_FS,
        uniforms: { uHeat },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      }),
    [uHeat],
  )
  useEffect(
    () => () => {
      for (const x of [ash, smokeMat, sparkMat, emberMat, cookieMat]) x.dispose()
      moundGeo.dispose()
    },
    [ash, smokeMat, sparkMat, emberMat, cookieMat, moundGeo],
  )

  const smokeGeo = useMemo(() => {
    const g = new THREE.InstancedBufferGeometry()
    const quad = new THREE.PlaneGeometry(1, 1)
    g.index = quad.index
    g.setAttribute('position', quad.getAttribute('position'))
    g.setAttribute('uv', quad.getAttribute('uv'))
    g.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds(Math.max(1, nSmoke), 'pit-smoke'), 1))
    g.instanceCount = nSmoke
    return g
  }, [nSmoke])
  const pointsGeo = (n: number, key: string) => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(Math.max(1, n) * 3), 3))
    g.setAttribute('aSeed', new THREE.BufferAttribute(seeds(Math.max(1, n), key), 1))
    g.setDrawRange(0, n)
    return g
  }
  const sparkGeo = useMemo(() => pointsGeo(nSparks, 'pit-sparks'), [nSparks])
  const emberGeo = useMemo(() => pointsGeo(nEmbers, 'pit-embers'), [nEmbers])
  useEffect(
    () => () => {
      smokeGeo.dispose()
      sparkGeo.dispose()
      emberGeo.dispose()
    },
    [smokeGeo, sparkGeo, emberGeo],
  )

  useFrame((state, dt) => {
    if (!still) uTime.value = state.clock.elapsedTime
    uHeat.value += (heatTarget - uHeat.value) * Math.min(1, dt * 0.6)
    // by day only a faint thread of smoke (no grey smudge over the noon forecourt); a plume once lit
    // and the rain lays the smoke: no plume across the monsoon sky
    uOn.value = still ? 0 : (0.18 + 0.82 * Math.min(1, uHeat.value / 0.85)) * (1 - 0.97 * rainNow())
    // sparks only after dusk, never in the Still form
    const want = !still && heatTarget >= 0.85 ? 1 : 0
    uSparkOn.value += (want - uSparkOn.value) * Math.min(1, dt * 0.8)
    uPx.value = state.size.height * state.viewport.dpr
    // day smoke is pale; at night a warm grey that the fire lights from below
    ;(smokeMat.uniforms.uDay.value as THREE.Color).set(heatTarget >= 0.85 ? '#6f6863' : '#c4beb6')
  })

  const earthMat = useMemo(() => {
    const soil = core.groundSoil as THREE.MeshStandardMaterial
    return new THREE.MeshStandardMaterial({ name: 'pitEarth', color: '#8a6a52', map: soil.map, normalMap: soil.normalMap, roughnessMap: soil.roughnessMap, roughness: 1, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 })
  }, [core.groundSoil])
  useEffect(() => () => earthMat.dispose(), [earthMat])
  const potMat = clayMaterial(m, 'terracotta', 0.1)
  const potDark = clayMaterial(m, 'black', 0.2)
  const straw = tinted(m.rope, '#b39a62', { roughness: 1 })
  const char = tinted(m.rope, '#2a2420', { roughness: 1 })
  return (
    <group>
      {/* a patch of raw earth round the pit, so it sits in the ground, never on paving */}
      <mesh material={earthMat} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]} receiveShadow>
        <circleGeometry args={[EARTH_R, 48]} />
      </mesh>
      <SourcedOr slug="ph-stone-fire-pit" fit={PIT_FIT} fallback={<Parts parts={stones} materials={{ stone: m.stoneFine, stoneDark: m.stoneDark }} />} />
      <Parts parts={parts} materials={{ straw, char, pot: potMat, potDark }} />
      <mesh geometry={moundGeo} material={ash} receiveShadow />
      {inScene && (
        <>
          <mesh material={cookieMat} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]} renderOrder={1}>
            <planeGeometry args={[6, 6]} />
          </mesh>
          <mesh geometry={smokeGeo} material={smokeMat} frustumCulled={false} renderOrder={6} />
          <points geometry={sparkGeo} material={sparkMat} frustumCulled={false} renderOrder={7} />
          <points geometry={emberGeo} material={emberMat} frustumCulled={false} renderOrder={5} />
        </>
      )}
    </group>
  )
}
