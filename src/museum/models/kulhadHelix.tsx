/**
 * 'kulhad-helix' — hundreds of red clay cups hung in a slowly turning double helix in the sky
 * well (SPECTACLE F14).
 *
 * Each strand is a cord threaded with kulhads, hung from the jali ring (architecture/OculusJali.tsx)
 * by fine hangers four times a turn; the strands wind `turns` times from just under the well's
 * lip down to 2.5 m while their radius narrows from 1.9 to 1.5 m. The second strand is offset by
 * 0.62 of a half turn (a major and a minor groove, as in a real double helix) and the cups are
 * strung ~0.26 m apart, each tilted, sized and fired a little differently, so the eye reads two
 * airy spirals of cups rather than stacked rings. One InstancedMesh draws every cup (effects/
 * instancedGlow.ts: `aGlow` warmth, `aPhase` breathing), one LineSegments the cords, one
 * instanced billboard the diya flames — three draw calls (+1 for the shadow on High and up).
 *
 *   daylight  runs down the cups; at golden hour they go copper
 *   night     every `diyaEvery`-th cup holds a small diya flame (and glows)
 *   E at the curb (or the `helix:chime` cue)  a ripple runs down both strands as a clink cascade
 *   the potter's pot rising (`court:potRise`)  the lowest cups brighten: everything above began here
 *
 * Still form: no spin, no sway; flames burn steady. Cup count: the prop, capped by the tier.
 */
import { useFrame } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { addGlowAttributes, instancedGlowMaterial } from '../effects/instancedGlow'
import { proximity } from '../interaction/proximity'
import { requestShadowRefresh } from '../lighting/SkyAndSun'
import { ambience } from '../lighting/timeOfDayState'
import { withWaterMirror } from '../materials/waterShader'
import { JALI } from '../materials/mandalaBand'
import { JALI_UNDERSIDE } from '../architecture/OculusJali'
import { caption } from '../spectacle/captions'
import { fireCue, useCue } from '../spectacle/cues'
import { useSpectacle } from '../spectacle/settings'
import { MUSEUM } from '../config/museum'
import { isZoneVisible } from '../navigation/zoneCulling'
import { useMuseum } from '../state/store'
import type { ModelProps } from './types'
import { num, str } from './types'
import { POOL, poolMirror } from './waterRing'

const noRaycast = () => null
const HELIX = { yTop: MUSEUM.pavilion.ceilingHeight - 0.9, yBottom: MUSEUM.pavilion.ceilingHeight - 3.25, rTop: JALI.r0 - 0.08, rBottom: MUSEUM.oculus.r * 0.58 }
/** Cup spacing along a strand (m), and the second strand's phase (× π): the minor groove. */
const SPACING = 0.26
const GROOVE = 0.62
const CUP = { h: 0.095, scale: 1.1 }
const CLAY: Record<string, string> = { terracotta: '#b4553f', red: '#9c3a2b', black: '#2b211d' }

/** A kulhad: thick-walled lathe cup, mouth up, origin at its base centre. */
function kulhadGeometry(segs: number): THREE.BufferGeometry {
  const p = [
    [0.0, 0.0],
    [0.024, 0.0],
    [0.027, 0.006],
    [0.034, 0.05],
    [0.04, 0.09],
    [0.0405, 0.095],
    [0.0355, 0.095],
    [0.0345, 0.088],
    [0.022, 0.012],
    [0.0, 0.01],
  ].map(([r, y]) => new THREE.Vector2(r, y))
  const g = new THREE.LatheGeometry(p, segs)
  g.scale(CUP.scale, CUP.scale, CUP.scale)
  return g
}

interface Layout {
  matrices: Float32Array
  /** Per-cup colour (each kulhad fired a little differently). */
  colors: Float32Array
  /** Strand parameter 0 (top) … 1 (bottom) per cup. */
  s: Float32Array
  /** Cup tops for the flames (x, y, z) and which cup each flame sits in. */
  flames: { pos: Float32Array; cup: Int32Array }
  cords: Float32Array
  count: number
  /** Indices of the lowest cups (one per strand). */
  lowest: number[]
}

function layout(count: number, turns: number, strands: number, diyaEvery: number): Layout {
  // never closer than SPACING along the strand: tight cups read as rings, not a helix
  const rMid = (HELIX.rTop + HELIX.rBottom) / 2
  const strandLen = Math.hypot(turns * Math.PI * 2 * rMid, HELIX.yTop - HELIX.yBottom)
  const per = Math.max(12, Math.min(Math.floor(count / strands), Math.floor(strandLen / SPACING)))
  const n = per * strands
  const matrices = new Float32Array(n * 16)
  const colors = new Float32Array(n * 3)
  const col = new THREE.Color()
  const s = new Float32Array(n)
  const cords: number[] = []
  const flamePos: number[] = []
  const flameCup: number[] = []
  const lowest: number[] = []
  const m = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const e = new THREE.Euler()
  const v = new THREE.Vector3()
  const sc = new THREE.Vector3(1, 1, 1)
  const hash = (i: number, k: number) => {
    const x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453
    return x - Math.floor(x)
  }
  const at = (a0: number, t: number): [number, number, number] => {
    const a = a0 + t * turns * Math.PI * 2
    const r = THREE.MathUtils.lerp(HELIX.rTop, HELIX.rBottom, t)
    return [r * Math.cos(a), THREE.MathUtils.lerp(HELIX.yTop, HELIX.yBottom, t), r * Math.sin(a)]
  }
  let i = 0
  for (let k = 0; k < strands; k++) {
    // two strands: offset by GROOVE·π, not π, so the pair reads as a double helix
    const a0 = strands === 2 ? k * GROOVE * Math.PI : (k / strands) * Math.PI * 2
    // the strand's own cord, threading the cups (a fine polyline)
    const segs = Math.ceil(turns * 48)
    for (let j = 0; j < segs; j++) {
      const p0 = at(a0, j / segs)
      const p1 = at(a0, (j + 1) / segs)
      cords.push(p0[0], p0[1] + CUP.h * CUP.scale, p0[2], p1[0], p1[1] + CUP.h * CUP.scale, p1[2])
    }
    // hangers: four per turn, straight down from the jali ring to the strand
    const hangers = Math.round(turns * 4)
    for (let j = 0; j <= hangers; j++) {
      const p = at(a0, j / hangers)
      const a = Math.atan2(p[2], p[0])
      cords.push(JALI.r0 * Math.cos(a), JALI_UNDERSIDE, JALI.r0 * Math.sin(a), p[0], p[1] + CUP.h * CUP.scale, p[2])
    }
    // the cups, threaded along the strand, each hanging upright by its rim, turned its own way
    for (let c = 0; c < per; c++) {
      const t = (c + 0.5) / per
      const [x, y, z] = at(a0, t)
      // each cup hangs a little askew, and no two were thrown quite the same size
      e.set((hash(i, 1) - 0.5) * 0.3, (i * 2.399) % (Math.PI * 2), (hash(i, 2) - 0.5) * 0.3)
      q.setFromEuler(e)
      v.set(x, y, z)
      const k1 = 0.86 + 0.28 * hash(i, 3)
      sc.set(k1, k1 * (0.92 + 0.16 * hash(i, 4)), k1)
      m.compose(v, q, sc)
      m.toArray(matrices, i * 16)
      // the kiln's spread: some cups paler and buff, a few darker where the fire smoked them
      const f = hash(i, 5)
      col.setRGB(1, 1, 1)
      if (f < 0.18) col.setRGB(1.12, 1.08, 1.0)
      else if (f > 0.86) col.setRGB(0.68, 0.6, 0.56)
      else col.multiplyScalar(0.9 + 0.2 * hash(i, 6))
      col.toArray(colors, i * 3)
      s[i] = t
      if (diyaEvery > 0 && c % diyaEvery === 0) {
        flamePos.push(x, y + CUP.h * CUP.scale * 0.92, z)
        flameCup.push(i)
      }
      if (c >= per - 3) lowest.push(i)
      i++
    }
  }
  return { matrices, colors, s, flames: { pos: new Float32Array(flamePos), cup: new Int32Array(flameCup) }, cords: new Float32Array(cords), count: n, lowest }
}

/** Sway (all cups) and the chime ripple (a pulse running down the strands), in the vertex shader. */
function withHelixMotion<M extends THREE.Material>(mat: M, u: HelixUniforms): M {
  const prev = mat.onBeforeCompile
  mat.onBeforeCompile = (shader, renderer) => {
    prev?.call(mat, shader, renderer)
    Object.assign(shader.uniforms, u)
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
attribute float aS;
uniform float uHTime;
uniform float uSway;
uniform float uChimeT;
uniform float uChimeAmp;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
{
  float ph = aS * 23.0;
  float age = uHTime - uChimeT;
  float front = age * 0.55;
  float pulse = uChimeAmp * exp(-pow((aS - front) * 9.0, 2.0)) * step(0.0, age);
  float ang = uSway * 0.05 * sin(uHTime * 0.7 + ph) + pulse * 0.45 * sin(age * 14.0);
  // swing about the rim (the cord's knot), round the local x axis
  float pivot = ${(CUP.h * CUP.scale).toFixed(4)};
  vec3 p = transformed - vec3(0.0, pivot, 0.0);
  float c = cos(ang), s = sin(ang);
  p = vec3(p.x, c * p.y - s * p.z, s * p.y + c * p.z);
  transformed = p + vec3(0.0, pivot, 0.0);
}`,
      )
  }
  const prevKey = mat.customProgramCacheKey.bind(mat)
  mat.customProgramCacheKey = () => `${prevKey()}|helixMotion`
  mat.needsUpdate = true
  return mat
}

type HelixUniforms = { uHTime: { value: number }; uSway: { value: number }; uChimeT: { value: number }; uChimeAmp: { value: number } }

/* ------------------------------------------------------------------ */
/* diya flames                                                         */
/* ------------------------------------------------------------------ */

function flameMaterial() {
  return new THREE.ShaderMaterial({
    name: 'helixFlame',
    uniforms: { uTime: { value: 0 }, uGain: { value: 0 }, uFlicker: { value: 1 }, uSize: { value: 0.05 } },
    vertexShader: /* glsl */ `
attribute vec3 aCenter;
attribute float aSeed;
uniform float uTime;
uniform float uSize;
uniform float uFlicker;
varying vec2 vUv;
varying float vF;
void main() {
  vUv = uv;
  float f = 1.0 + uFlicker * 0.12 * sin(uTime * 13.0 + aSeed * 40.0) * sin(uTime * 7.3 + aSeed * 11.0);
  vF = f;
  vec4 mv = modelViewMatrix * vec4(aCenter, 1.0);
  mv.xy += (uv - vec2(0.5, 0.2)) * vec2(uSize * 0.6, uSize * 1.4 * f);
  gl_Position = projectionMatrix * mv;
}`,
    fragmentShader: /* glsl */ `
uniform float uGain;
varying vec2 vUv;
varying float vF;
void main() {
  vec2 p = vUv - vec2(0.5, 0.25);
  p.x *= 2.2;
  float d = length(vec2(p.x, p.y * (p.y > 0.0 ? 0.55 : 1.4)));
  float core = smoothstep(0.32, 0.0, d);
  float halo = smoothstep(0.5, 0.0, d) * 0.35;
  vec3 col = mix(vec3(1.0, 0.45, 0.12), vec3(1.0, 0.86, 0.55), core);
  gl_FragColor = vec4(col * (core * 2.4 + halo) * uGain * vF, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
}

function flameGeometry(pos: Float32Array): THREE.InstancedBufferGeometry {
  const base = new THREE.PlaneGeometry(1, 1)
  base.translate(0.5, 0.5, 0)
  const g = new THREE.InstancedBufferGeometry()
  g.index = base.index
  g.setAttribute('position', base.getAttribute('position'))
  g.setAttribute('uv', base.getAttribute('uv'))
  g.setAttribute('aCenter', new THREE.InstancedBufferAttribute(pos, 3))
  const seeds = new Float32Array(pos.length / 3)
  for (let i = 0; i < seeds.length; i++) seeds[i] = (i * 0.618034) % 1
  g.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 1))
  g.instanceCount = pos.length / 3
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 4, 0), 4)
  return g
}

/* ------------------------------------------------------------------ */
/* the kind                                                            */
/* ------------------------------------------------------------------ */

export function KulhadHelix({ config }: ModelProps) {
  const sp = useSpectacle()
  const cap = sp.caps.helixCups
  const want = Math.round(num(config, 'count', 0))
  const count = Math.max(24, want > 0 ? Math.min(want, cap) : cap)
  const turns = num(config, 'turns', 2.25)
  const strands = Math.max(1, Math.min(4, Math.round(num(config, 'strands', 2))))
  const spin = num(config, 'spin', 0.03)
  const clay = CLAY[str(config, 'clay', 'terracotta')] ?? CLAY.terracotta
  const diyaEvery = Math.max(0, Math.round(num(config, 'diyaEvery', 4)))
  const chime = config.props?.chime !== false && config.props?.chime !== 'false'
  const still = sp.mode === 'still'
  const shadows = sp.caps.helixShadows && sp.mode !== 'lite'
  const segs = sp.caps.lathePotSegs >= 48 ? 12 : 9

  const L = useMemo(() => layout(count, turns, strands, diyaEvery), [count, turns, strands, diyaEvery])
  const geo = useMemo(() => kulhadGeometry(segs), [segs])
  const motion = useMemo<HelixUniforms>(() => ({ uHTime: { value: 0 }, uSway: { value: 1 }, uChimeT: { value: -100 }, uChimeAmp: { value: 0 } }), [])
  const base = useMemo(() => new THREE.Color(clay), [clay])
  const mat = useMemo(() => withHelixMotion(instancedGlowMaterial(new THREE.MeshStandardMaterial({ name: 'kulhad', color: base.clone(), roughness: 0.72, metalness: 0.0 }), { color: '#ff9442', gain: 2.2, breath: 0.08, breathHz: 0.3 }), motion), [base, motion])
  const mirrorMat = useMemo(
    () =>
      withWaterMirror(
        withHelixMotion(instancedGlowMaterial(new THREE.MeshStandardMaterial({ name: 'kulhadMirror', color: base.clone().multiplyScalar(0.7), roughness: 0.8 }), { color: '#ff9442', gain: 2.2, breath: 0.08, breathHz: 0.3 }), motion),
        { level: POOL.level, r0: POOL.r0, r1: POOL.r1 },
        0.55,
      ),
    [base, motion],
  )
  const cordGeo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(L.cords, 3))
    return g
  }, [L])
  const cordMat = useMemo(() => new THREE.LineBasicMaterial({ name: 'helixCord', color: '#3a2820', transparent: true, opacity: 0.26, depthWrite: false }), [])
  const flames = useMemo(() => flameGeometry(L.flames.pos), [L])
  const flameMat = useMemo(() => flameMaterial(), [])
  useEffect(
    () => () => {
      geo.dispose()
      cordGeo.dispose()
      flames.dispose()
    },
    [geo, cordGeo, flames],
  )
  useEffect(
    () => () => {
      mat.dispose()
      mirrorMat.dispose()
      cordMat.dispose()
      flameMat.dispose()
    },
    [mat, mirrorMat, cordMat, flameMat],
  )

  const cups = useRef<THREE.InstancedMesh>(null)
  const mirror = useRef<THREE.InstancedMesh>(null)
  const spinG = useRef<THREE.Group>(null)
  const mirrorSpin = useRef<THREE.Group>(null)
  const glowAttr = useRef<THREE.InstancedBufferAttribute | null>(null)

  useLayoutEffect(() => {
    const mesh = cups.current
    if (!mesh) return
    mesh.instanceMatrix.array.set(L.matrices)
    mesh.instanceMatrix.needsUpdate = true
    mesh.instanceColor = new THREE.InstancedBufferAttribute(L.colors, 3)
    mesh.count = L.count
    const { glow } = addGlowAttributes(mesh, L.count, 7)
    glowAttr.current = glow
    geo.setAttribute('aS', new THREE.InstancedBufferAttribute(L.s, 1))
    mesh.computeBoundingSphere()
    const mm = mirror.current
    if (mm) {
      mm.instanceMatrix = mesh.instanceMatrix
      mm.instanceColor = mesh.instanceColor
      mm.count = L.count
      mm.computeBoundingSphere()
    }
  }, [L, geo])

  // glow per cup: night diyas, the potter's rising pot, the chime cascade
  const state = useMemo(() => ({ lowGlow: 0, chimeAt: -100, shadowT: 0, lastNight: -1 }), [])
  const chimeNow = (source: 'visitor' | 'tour' | 'replay' | 'docent' | 'system' | 'zone' = 'visitor') => {
    if (!chime) return
    state.chimeAt = motion.uHTime.value
    motion.uChimeT.value = motion.uHTime.value
    motion.uChimeAmp.value = still ? 0 : 1
    caption('caption.bells')
    if (source === 'visitor') fireCue('helix:chime', { source })
  }
  useCue('helix:chime', (e) => {
    if (e.source !== 'visitor') chimeNow(e.source)
  })
  useCue('court:potRise', () => {
    state.lowGlow = 1
  })
  // E at the curb rings the helix (the curb's own E — information about the oculus — still opens)
  useEffect(() => {
    if (!chime) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'e' && e.key !== 'E') return
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      if (useMuseum.getState().phase !== 'entered') return
      if (proximity(0, 0, 3.9, 4.6) < 0.5) return
      chimeNow('visitor')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const copper = useMemo(() => new THREE.Color('#c0602f'), [])
  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime
    motion.uHTime.value = t
    motion.uSway.value = still ? 0 : 1
    const u = (mat.userData as { uniforms: { uTime: { value: number }; uBreath: { value: number } } }).uniforms
    u.uTime.value = t
    u.uBreath.value = still ? 0 : 0.08
    const mu = (mirrorMat.userData as { uniforms: { uTime: { value: number } } }).uniforms
    mu.uTime.value = t
    // golden hour turns the cups copper
    mat.color.copy(base).lerp(copper, ambience.twilight * 0.55)
    mirrorMat.color.copy(mat.color).multiplyScalar(0.7)
    // spin the whole helix (mirror follows)
    if (!still && spinG.current) spinG.current.rotation.y += spin * Math.min(dt, 0.1)
    if (mirrorSpin.current && spinG.current) mirrorSpin.current.rotation.y = spinG.current.rotation.y
    // glow: diyas by night, the lowest cups at the potter's rise, the chime front
    const g = glowAttr.current
    if (g) {
      const night = ambience.night
      state.lowGlow = Math.max(0, state.lowGlow - dt / 6)
      const age = t - state.chimeAt
      const chimeOn = age >= 0 && age < 3.5
      const nightKey = Math.round(night * 50)
      if (chimeOn || state.lowGlow > 0 || nightKey !== state.lastNight) {
        state.lastNight = nightKey
        const arr = g.array as Float32Array
        arr.fill(0)
        if (night > 0.01) for (const c of L.flames.cup) arr[c] = 0.55 * night
        if (state.lowGlow > 0) for (const c of L.lowest) arr[c] = Math.max(arr[c], state.lowGlow)
        if (chimeOn) {
          const front = age * 0.55
          for (let i = 0; i < L.count; i++) {
            const d = (L.s[i] - front) * 9
            const p = Math.exp(-d * d)
            if (p > 0.02) arr[i] = Math.max(arr[i], p * 0.7)
          }
        }
        g.needsUpdate = true
      }
    }
    flameMat.uniforms.uTime.value = t
    flameMat.uniforms.uGain.value = ambience.night
    flameMat.uniforms.uFlicker.value = still ? 0 : 1
    // High: the helix casts its turning shadow; refresh the frozen shadow map twice a second
    if (shadows && !still && isZoneVisible('inner')) {
      state.shadowT += dt
      if (state.shadowT > 0.5) {
        state.shadowT = 0
        requestShadowRefresh(1)
      }
    }
  })

  const showMirror = poolMirror()
  const mirrorLevel = POOL.level
  return (
    <group name="kulhad-helix">
      <group ref={spinG}>
        <instancedMesh ref={cups} args={[geo, mat, L.count]} castShadow={shadows} receiveShadow frustumCulled={false} raycast={noRaycast} />
        <lineSegments geometry={cordGeo} material={cordMat} raycast={noRaycast} />
        <mesh geometry={flames} material={flameMat} frustumCulled={false} renderOrder={5} raycast={noRaycast} />
      </group>
      {/* the reflection in the pool (High / Ultra); kept mounted so its program compiles at start */}
      <group position={[0, 2 * mirrorLevel, 0]} scale={[1, -1, 1]} visible={showMirror}>
        <group ref={mirrorSpin}>
          <instancedMesh ref={mirror} args={[geo, mirrorMat, L.count]} frustumCulled={false} renderOrder={3} raycast={noRaycast} />
        </group>
      </group>
    </group>
  )
}
