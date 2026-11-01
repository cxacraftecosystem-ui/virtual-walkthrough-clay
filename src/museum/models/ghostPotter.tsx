/**
 * 'ghost-potter' — the Ghost Potter on the Great Wheel (SPECTACLE F13).
 *
 * On the oculus plinth a calm, luminous figure (one smooth body: no face, no costume, no joints)
 * squats at a floor-level chak, the Indian potter's wheel, and throws a pot in a `loopSec` loop — centre, open, pull ×3, belly, collar, wire off —
 * and the finished pot rises half a metre into the sun shaft and dissolves into light, while the
 * lowest cups of the kulhad helix brighten (`court:potRise`): everything above began here.
 *
 *   pot      one lathe with a fixed vertex grid (Low 24 × 24, Medium and up 48 × 40); seven
 *            profile keyframes per `form` are reduced with the studio's own pot engine
 *            (studio/potEngine.ts reducePot / profileCurve) and blended on the CPU each frame
 *   hands    the figure's hands follow the wall of the pot (a vertex offset in its glow shader)
 *   figure   a signed-distance body (round cones and ellipsoids, smooth-unioned) meshed once by
 *            marching cubes: one continuous surface, lit by a soft fresnel rim and an additive
 *            inner light
 *   wheel    the chak: a heavy timber wheel with a clay-packed rim ~0.26 m above the plinth, the
 *            potter squatting behind it on a low pira
 *   mirror   High / Ultra: pot and figure reflected in the water ring
 *
 * Still form: the finished pot stands on the resting wheel, the figure's hands at its shoulder.
 * `model` set to a .splat swaps the figure for a real capture (models/artisan.tsx).
 * Placeholder silence: the object carries no factual copy.
 */
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { MUSEUM } from '../config/museum'
import { easeInOut, POTTER_LOOP, potterStage, spanAt } from '../config/spectacleObjects/court'
import { ambience } from '../lighting/timeOfDayState'
import { useMaterials } from '../materials/materials'
import { withWaterMirror } from '../materials/waterShader'
import { fireCue } from '../spectacle/cues'
import { useSpectacle } from '../spectacle/settings'
import { profileCurve, reducePot, START, WALL, FLOOR, type PotOp, type ProfilePoint } from '../studio/potEngine'
import { MarchingCubes } from 'three/examples/jsm/objects/MarchingCubes.js'
import { ArtisanCapture } from './artisan'
import type { ModelProps } from './types'
import { num, str } from './types'
import { POOL, poolMirror } from './waterRing'

const noRaycast = () => null

/**
 * Layout on the plinth (local frame: origin on the plinth's centre disc at the wheel's axis, the
 * potter faces +z). The chak: a heavy wheel close to the ground, turned by a stick in its rim
 * notch; the potter squats behind it on a low pira, knees up either side of the rim.
 */
const WHEEL = { hubR: 0.1, discR: 0.46, discY0: 0.2, discY1: 0.245, rimR: 0.44, rimTube: 0.045, headY1: 0.262 }
/** The pira (low seat) and where the hands rest at the pot (figure frame = wheel frame). */
const FIGURE = { pira: 0.16, piraZ: -0.74, handZ: -0.04 }
/** Height of the scene object's origin above the court floor: the plinth's centre disc (models/clay.tsx). */
export const POTTER_BASE_Y = MUSEUM.oculus.curbHeight - 0.012
const OFFSET_Y = POTTER_BASE_Y
/** cm → m, and how much larger than life the great wheel's pot is thrown. */
const POT_SCALE = 0.01 * 1.5

/* ------------------------------------------------------------------ */
/* the pot's keyframes                                                 */
/* ------------------------------------------------------------------ */

type Form = 'matka' | 'kulhad' | 'surahi' | 'diya'
const STAGES = 7

/** Op list per form, and after how many ops each of stages 1 … 6 is reached (stage 0 is the centred lump). */
const FORMS: Record<Form, { ops: PotOp[]; marks: number[] }> = {
  matka: {
    ops: [{ t: 'pull' }, { t: 'pull' }, { t: 'pull' }, ...rep({ t: 'widen', at: 0.45 }, 4), ...rep({ t: 'narrow', at: 0.84 }, 4), { t: 'widen', at: 1 }],
    marks: [0, 1, 2, 3, 7, 12],
  },
  kulhad: {
    ops: [{ t: 'narrow', at: 0.05 }, { t: 'narrow', at: 0.05 }, { t: 'pull' }, { t: 'widen', at: 0.95 }, { t: 'narrow', at: 0.15 }, { t: 'trim' }, { t: 'trim' }],
    marks: [0, 2, 3, 4, 5, 7],
  },
  surahi: {
    ops: [{ t: 'pull' }, { t: 'pull' }, { t: 'pull' }, { t: 'pull' }, { t: 'pull' }, ...rep({ t: 'widen', at: 0.28 }, 4), ...rep({ t: 'narrow', at: 0.72 }, 5), { t: 'widen', at: 1 }],
    marks: [0, 2, 4, 5, 9, 15],
  },
  diya: {
    ops: [...rep({ t: 'widen', at: 1 }, 3), { t: 'widen', at: 0.7 }, { t: 'trim' }, { t: 'trim' }, { t: 'trim' }, { t: 'trim' }, { t: 'trim' }, { t: 'trim' }],
    marks: [0, 1, 3, 4, 7, 10],
  },
}

function rep(op: PotOp, n: number): PotOp[] {
  return Array.from({ length: n }, () => op)
}

/** Resample a polyline to `n` points evenly by arc length. */
function resample(pts: ProfilePoint[], n: number): ProfilePoint[] {
  const d = [0]
  for (let i = 1; i < pts.length; i++) d.push(d[i - 1] + Math.hypot(pts[i].r - pts[i - 1].r, pts[i].y - pts[i - 1].y))
  const L = d[d.length - 1] || 1
  const out: ProfilePoint[] = []
  let k = 1
  for (let i = 0; i < n; i++) {
    const s = (L * i) / (n - 1)
    while (k < d.length - 1 && d[k] < s) k++
    const t = (s - d[k - 1]) / Math.max(1e-6, d[k] - d[k - 1])
    out.push({ r: pts[k - 1].r + (pts[k].r - pts[k - 1].r) * t, y: pts[k - 1].y + (pts[k].y - pts[k - 1].y) * t })
  }
  return out
}

/**
 * The closed lathe outline of a stage (cm): axis at the base → up the outer wall → over the rim →
 * down the inner wall → the inner floor → the axis. `open` 0 collapses the inside to a dome (the
 * centred lump), 1 is a thrown pot.
 */
function outline(points: ProfilePoint[], open: number, nOuter: number, nInner: number): ProfilePoint[] {
  const outer = resample(profileCurve(points, 10), nOuter)
  const top = outer[outer.length - 1]
  const inner: ProfilePoint[] = []
  for (let i = 0; i < nInner; i++) {
    const t = i / (nInner - 1)
    // walk down from the rim to the floor, offset inward by the wall
    const y = top.y + (FLOOR - top.y) * t
    let r = 0
    for (let j = 1; j < outer.length; j++) {
      if (outer[j].y >= y) {
        const a = outer[j - 1]
        const b = outer[j]
        const k = b.y === a.y ? 0 : (y - a.y) / (b.y - a.y)
        r = a.r + (b.r - a.r) * k
        break
      }
    }
    const rIn = Math.max(0.3, r - WALL * (t < 0.04 ? 0.65 : 1)) * (1 - t * t * 0.0)
    // closed: the inside shrinks to a small dome at the top of the lump
    const dome = { r: rIn * 0.25 * (1 - t), y: top.y + 0.6 - t * 0.6 }
    inner.push({ r: dome.r + (rIn - dome.r) * open, y: dome.y + (y - dome.y) * open })
  }
  const floorY = FLOOR * open + (top.y + 0.0) * (1 - open)
  return [{ r: 0, y: 0 }, ...outer, ...inner, { r: 0, y: floorY }]
}

/** The seven keyframe outlines of a form (cm). */
function keyframes(form: Form, nOuter: number, nInner: number): ProfilePoint[][] {
  const f = FORMS[form]
  const lump = START.points.map((p) => ({ r: p.r * 1.06, y: p.y * 0.78 }))
  const frames: ProfilePoint[][] = [outline(lump, 0, nOuter, nInner)]
  for (let s = 1; s < STAGES; s++) {
    const st = reducePot(f.ops.slice(0, f.marks[s - 1] + (s === 1 ? 0 : 0)))
    frames.push(outline(st.points, 1, nOuter, nInner))
  }
  return frames
}

/* ------------------------------------------------------------------ */
/* the loop                                                            */
/* ------------------------------------------------------------------ */

const T = POTTER_LOOP
const ease = easeInOut
const span = spanAt
const stageAt = potterStage

/* ------------------------------------------------------------------ */
/* the figure: one smooth body                                         */
/* ------------------------------------------------------------------ */

type V3 = [number, number, number]
type Prim = { t: 'cone'; a: V3; b: V3; ra: number; rb: number } | { t: 'ell'; c: V3; r: V3 }

/** Round cone a → b (radii ra, rb): a capsule that tapers. */
function sdCone(px: number, py: number, pz: number, a: V3, b: V3, ra: number, rb: number) {
  const bx = b[0] - a[0]
  const by = b[1] - a[1]
  const bz = b[2] - a[2]
  const qx = px - a[0]
  const qy = py - a[1]
  const qz = pz - a[2]
  const h = Math.min(1, Math.max(0, (qx * bx + qy * by + qz * bz) / (bx * bx + by * by + bz * bz)))
  return Math.hypot(qx - bx * h, qy - by * h, qz - bz * h) - (ra + (rb - ra) * h)
}
/** Ellipsoid (the usual bound: good near the surface, which is all marching cubes needs). */
function sdEll(px: number, py: number, pz: number, c: V3, r: V3) {
  const x = (px - c[0]) / r[0]
  const y = (py - c[1]) / r[1]
  const z = (pz - c[2]) / r[2]
  const k0 = Math.hypot(x, y, z)
  const k1 = Math.hypot(x / r[0], y / r[1], z / r[2])
  return k1 > 1e-9 ? (k0 * (k0 - 1)) / k1 : -Math.min(r[0], r[1], r[2])
}
/** Polynomial smooth minimum: the parts flow into each other over ~k metres, no creases. */
function smin(a: number, b: number, k: number) {
  const h = Math.max(k - Math.abs(a - b), 0) / k
  return Math.min(a, b) - h * h * k * 0.25
}

/** The squatting potter, in the wheel frame: its primitives and the two hand rests. */
function potterPrims(): { prims: Prim[]; handL: V3; handR: V3 } {
  const hipY = FIGURE.pira + 0.1
  const hipZ = FIGURE.piraZ + 0.02
  const sh: V3 = [0, hipY + 0.5, hipZ + 0.26]
  const head: V3 = [0, sh[1] + 0.2, sh[2] + 0.1]
  const prims: Prim[] = [
    // pelvis on the pira, a torso bent forward over the wheel, the shoulders, the bowed head
    { t: 'ell', c: [0, hipY, hipZ], r: [0.17, 0.11, 0.14] },
    { t: 'cone', a: [0, hipY + 0.04, hipZ + 0.01], b: [0, sh[1] - 0.06, sh[2] - 0.03], ra: 0.14, rb: 0.12 },
    { t: 'ell', c: [0, sh[1] - 0.03, sh[2]], r: [0.19, 0.075, 0.11] },
    { t: 'cone', a: [0, sh[1], sh[2] + 0.02], b: [0, head[1] - 0.1, head[2] - 0.03], ra: 0.045, rb: 0.042 },
    { t: 'ell', c: head, r: [0.085, 0.105, 0.098] },
  ]
  const hands: V3[] = []
  for (const s of [-1, 1]) {
    // knees up either side of the wheel's rim, shins down to the feet on the plinth
    const hip: V3 = [s * 0.1, hipY - 0.01, hipZ + 0.02]
    const knee: V3 = [s * 0.27, hipY + 0.3, hipZ + 0.3]
    const foot: V3 = [s * 0.3, 0.05, hipZ + 0.42]
    prims.push({ t: 'cone', a: hip, b: knee, ra: 0.075, rb: 0.056 })
    prims.push({ t: 'cone', a: knee, b: foot, ra: 0.055, rb: 0.04 })
    prims.push({ t: 'ell', c: [foot[0], 0.035, foot[2] + 0.05], r: [0.045, 0.032, 0.1] })
    // arms: shoulder → elbow by the knee → the hand at the pot
    const shoulder: V3 = [s * 0.18, sh[1] - 0.05, sh[2]]
    const elbow: V3 = [s * 0.27, sh[1] - 0.27, sh[2] + 0.2]
    const hand: V3 = [s * 0.16, WHEEL.headY1 + 0.06, FIGURE.handZ]
    prims.push({ t: 'cone', a: shoulder, b: elbow, ra: 0.048, rb: 0.04 })
    prims.push({ t: 'cone', a: elbow, b: hand, ra: 0.038, rb: 0.03 })
    prims.push({ t: 'ell', c: hand, r: [0.03, 0.05, 0.06] })
    hands.push(hand)
  }
  return { prims, handL: hands[0], handR: hands[1] }
}

/** The cube the figure is meshed in (wheel frame, m). */
const FIG_BOX = { cx: 0, cy: 0.56, cz: -0.36, half: 0.62 }
const figureCache = new Map<number, THREE.BufferGeometry>()

/**
 * Mesh the potter's distance field once (marching cubes, `res`³ cells): a single closed surface
 * with smooth normals, so the glow has no seams, joints or overlapping shells. Shared (never
 * disposed): one small mesh per resolution for the life of the page.
 */
function potterGeometry(res: number): THREE.BufferGeometry {
  const hit = figureCache.get(res)
  if (hit) return hit
  const { prims } = potterPrims()
  const mc = new MarchingCubes(res, new THREE.MeshBasicMaterial(), false, false, 120000)
  const { cx, cy, cz, half } = FIG_BOX
  const n = mc.size
  const iso = mc.isolation
  for (let z = 0; z < n; z++)
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++) {
        const px = cx + ((x - n / 2) / (n / 2)) * half
        const py = cy + ((y - n / 2) / (n / 2)) * half
        const pz = cz + ((z - n / 2) / (n / 2)) * half
        let d = 1e9
        for (const p of prims) d = smin(d, p.t === 'cone' ? sdCone(px, py, pz, p.a, p.b, p.ra, p.rb) : sdEll(px, py, pz, p.c, p.r), 0.06)
        mc.field[x + y * n + z * n * n] = iso - d * 2400
      }
  mc.update()
  const count = mc.count
  const pos = new Float32Array(count * 3)
  const nor = new Float32Array(count * 3)
  for (let i = 0; i < count * 3; i += 3) {
    pos[i] = cx + mc.positionArray[i] * half
    pos[i + 1] = cy + mc.positionArray[i + 1] * half
    pos[i + 2] = cz + mc.positionArray[i + 2] * half
    const l = Math.hypot(mc.normalArray[i], mc.normalArray[i + 1], mc.normalArray[i + 2]) || 1
    nor[i] = mc.normalArray[i] / l
    nor[i + 1] = mc.normalArray[i + 1] / l
    nor[i + 2] = mc.normalArray[i + 2] / l
  }
  mc.geometry.dispose()
  ;(mc.material as THREE.Material).dispose()
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3))
  g.computeBoundingSphere()
  figureCache.set(res, g)
  return g
}

/* ------------------------------------------------------------------ */
/* materials                                                           */
/* ------------------------------------------------------------------ */

type GlowU = { uColor: { value: THREE.Color }; uTime: { value: number }; uHandL: { value: THREE.Vector3 }; uHandR: { value: THREE.Vector3 }; uRestL: { value: THREE.Vector3 }; uRestR: { value: THREE.Vector3 }; uGain: { value: number } }

/** The figure's glow (after models/artisan.tsx), with hands that follow the pot. */
function figureMaterial(u: GlowU, mirror: boolean) {
  return new THREE.ShaderMaterial({
    name: mirror ? 'ghostPotterMirror' : 'ghostPotter',
    uniforms: { ...u, uMirLevel: { value: POOL.level }, uMirR0: { value: POOL.r0 }, uMirR1: { value: POOL.r1 } },
    defines: mirror ? { MIRROR: '' } : {},
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.FrontSide,
    vertexShader: /* glsl */ `
uniform vec3 uHandL;
uniform vec3 uHandR;
uniform vec3 uRestL;
uniform vec3 uRestR;
varying vec3 vN;
varying vec3 vW;
varying float vY;
void main() {
  vec3 p = position;
  // hands (and a little of the forearm) carried to where the pot needs them
  float wl = 1.0 - smoothstep(0.03, 0.2, distance(p, uRestL));
  float wr = 1.0 - smoothstep(0.03, 0.2, distance(p, uRestR));
  p += uHandL * wl + uHandR * wr;
  vec4 wp = modelMatrix * vec4(p, 1.0);
  vN = normalize(mat3(modelMatrix) * normal);
  vW = wp.xyz;
  vY = position.y;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`,
    fragmentShader: /* glsl */ `
uniform mat4 projectionMatrix;
uniform vec3 uColor;
uniform float uTime;
uniform float uGain;
uniform float uMirLevel;
uniform float uMirR0;
uniform float uMirR1;
varying vec3 vN;
varying vec3 vW;
varying float vY;
void main() {
#ifdef MIRROR
  vec3 md = vW - cameraPosition;
  if (md.y > -1e-4 || vW.y > uMirLevel) discard;
  vec3 mq = cameraPosition + md * ((uMirLevel - cameraPosition.y) / md.y);
  float mr = length(mq.xz);
  if (mr < uMirR0 + 0.01 || mr > uMirR1 - 0.01) discard;
  vec4 mc = projectionMatrix * viewMatrix * vec4(mq, 1.0);
  gl_FragDepth = clamp((mc.z / mc.w) * 0.5 + 0.5 - 2e-6, 0.0, 1.0);
#endif
  vec3 v = normalize(cameraPosition - vW);
  float f = 1.0 - abs(dot(normalize(vN), v));
  // a soft fresnel skin and a warm light inside the body, strongest at its core
  float rim = pow(f, 2.6);
  float core = pow(1.0 - f, 1.5);
  float breathe = 0.93 + 0.07 * sin(uTime * 0.9);
  // a slow rise of light through the body, never stripes
  float drift = 0.94 + 0.06 * sin(vY * 9.0 - uTime * 1.1);
  vec3 inner = vec3(1.0, 0.62, 0.34) * core * 0.16;
  vec3 skin = uColor * rim * 0.62;
  vec3 col = (inner + skin + uColor * 0.035) * breathe * drift * uGain;
#ifdef MIRROR
  col *= 0.45;
#endif
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`,
  })
}

type PotU = { uDissolve: { value: number }; uLight: { value: number } }

/** Wet clay that can dissolve into light (a noise threshold with a glowing edge). */
function withDissolve<M extends THREE.MeshStandardMaterial>(m: M, u: PotU): M {
  const prev = m.onBeforeCompile
  m.onBeforeCompile = (shader, r) => {
    prev?.call(m, shader, r)
    Object.assign(shader.uniforms, u)
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vPotP;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvPotP = position;')
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
uniform float uDissolve;
uniform float uLight;
varying vec3 vPotP;
float potEdge;
float potHash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float potNoise(vec3 x) {
  vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(potHash(i), potHash(i + vec3(1,0,0)), f.x), mix(potHash(i + vec3(0,1,0)), potHash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(potHash(i + vec3(0,0,1)), potHash(i + vec3(1,0,1)), f.x), mix(potHash(i + vec3(0,1,1)), potHash(i + vec3(1,1,1)), f.x), f.y), f.z);
}`,
      )
      .replace(
        '#include <clipping_planes_fragment>',
        `#include <clipping_planes_fragment>
{
  float n = potNoise(vPotP * 38.0) * 0.6 + potNoise(vPotP * 90.0) * 0.4;
  float d = n - uDissolve * 1.1 + 0.05;
  if (d < 0.0) discard;
  potEdge = 1.0 - smoothstep(0.0, 0.08, d);
}`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
totalEmissiveRadiance += vec3(1.0, 0.78, 0.5) * (uLight * 1.4 + potEdge * step(0.001, uDissolve) * 4.0);`,
      )
  }
  const prevKey = m.customProgramCacheKey.bind(m)
  m.customProgramCacheKey = () => `${prevKey()}|potDissolve`
  m.needsUpdate = true
  return m
}

/* ------------------------------------------------------------------ */
/* the kind                                                            */
/* ------------------------------------------------------------------ */

const FORM_IDS: Form[] = ['matka', 'kulhad', 'surahi', 'diya']

export function GhostPotter({ config }: ModelProps) {
  const model = str(config, 'model', '')
  if (/\.splat(\?|#|$)/i.test(model)) return <ArtisanCapture config={{ ...config, kind: 'splat', model }} />
  return <Ghost config={config} />
}

function Ghost({ config }: ModelProps) {
  const sp = useSpectacle()
  const m = useMaterials()
  const formRaw = str(config, 'form', 'matka')
  const form: Form = (FORM_IDS as string[]).includes(formRaw) ? (formRaw as Form) : 'matka'
  const loopSec = Math.max(12, num(config, 'loopSec', 45))
  const rise = config.props?.rise !== false && config.props?.rise !== 'false'
  const linkHelix = config.props?.linkHelix !== false && config.props?.linkHelix !== 'false'
  const still = sp.mode === 'still'
  const hi = sp.caps.lathePotSegs >= 48
  const segs = hi ? 48 : 24
  const rows = hi ? 40 : 24
  const nOuter = Math.round(rows * 0.6)
  const nInner = rows - nOuter - 2

  const frames = useMemo(() => keyframes(form, nOuter, nInner), [form, nOuter, nInner])
  const P = frames[0].length
  const potGeo = useMemo(() => {
    const g = new THREE.LatheGeometry(
      frames[STAGES - 1].map((p) => new THREE.Vector2(p.r * POT_SCALE, p.y * POT_SCALE)),
      segs,
    )
    const pos = g.getAttribute('position') as THREE.BufferAttribute
    pos.setUsage(THREE.DynamicDrawUsage)
    return g
  }, [frames, segs])
  useEffect(() => () => potGeo.dispose(), [potGeo])

  const potU = useMemo<PotU>(() => ({ uDissolve: { value: 0 }, uLight: { value: 0 } }), [])
  const potMat = useMemo(() => {
    const base = hi ? new THREE.MeshPhysicalMaterial({ name: 'wetClay', color: '#8a5a44', roughness: 0.42, clearcoat: 0.6, clearcoatRoughness: 0.35 }) : new THREE.MeshStandardMaterial({ name: 'wetClay', color: '#8a5a44', roughness: 0.45 })
    base.emissive = new THREE.Color('#000000')
    return withDissolve(base, potU)
  }, [hi, potU])
  const potMirrorMat = useMemo(() => withWaterMirror(withDissolve(new THREE.MeshStandardMaterial({ name: 'wetClayMirror', color: '#6e4636', roughness: 0.5 }), potU), { level: POOL.level, r0: POOL.r0, r1: POOL.r1 }, 0.55), [potU])
  useEffect(
    () => () => {
      potMat.dispose()
      potMirrorMat.dispose()
    },
    [potMat, potMirrorMat],
  )

  // the figure's hand rest positions (wheel frame, as built by potterPrims)
  const rests = useMemo(() => potterPrims(), [])
  const restL = useMemo(() => new THREE.Vector3(...rests.handL), [rests])
  const restR = useMemo(() => new THREE.Vector3(...rests.handR), [rests])
  const figGeo = useMemo(() => potterGeometry(hi ? 64 : 44), [hi])
  const glowU = useMemo<GlowU>(() => ({ uColor: { value: new THREE.Color('#ffd7ad') }, uTime: { value: 0 }, uHandL: { value: new THREE.Vector3() }, uHandR: { value: new THREE.Vector3() }, uRestL: { value: restL }, uRestR: { value: restR }, uGain: { value: 1 } }), [restL, restR])
  const figMat = useMemo(() => figureMaterial(glowU, false), [glowU])
  const figMirrorMat = useMemo(() => figureMaterial(glowU, true), [glowU])
  useEffect(
    () => () => {
      figMat.dispose()
      figMirrorMat.dispose()
    },
    [figMat, figMirrorMat],
  )

  // the chak: a low hub on its pivot, the timber wheel, its heavy clay rim with the stick's
  // notch (it turns with the wheel, so the spin reads), the slip-wet centre, and the pira
  const wheel = useMemo(() => {
    const ped = new THREE.CylinderGeometry(WHEEL.hubR * 0.85, WHEEL.hubR * 1.25, WHEEL.discY0, 20)
    ped.translate(0, WHEEL.discY0 / 2, 0)
    const disc = new THREE.CylinderGeometry(WHEEL.discR * 0.97, WHEEL.discR, WHEEL.discY1 - WHEEL.discY0, 56)
    disc.translate(0, (WHEEL.discY0 + WHEEL.discY1) / 2, 0)
    const rim = new THREE.TorusGeometry(WHEEL.rimR, WHEEL.rimTube, 10, 56)
    rim.rotateX(Math.PI / 2)
    rim.translate(0, WHEEL.discY1 - 0.01, 0)
    const notch = new THREE.CylinderGeometry(0.018, 0.018, 0.012, 10)
    notch.translate(WHEEL.rimR, WHEEL.discY1 + WHEEL.rimTube - 0.012, 0)
    const pan = new THREE.CylinderGeometry(0.13, 0.15, WHEEL.headY1 - WHEEL.discY1, 32)
    pan.translate(0, (WHEEL.discY1 + WHEEL.headY1) / 2, 0)
    const stool = new THREE.BoxGeometry(0.42, FIGURE.pira, 0.3)
    stool.translate(0, FIGURE.pira / 2, FIGURE.piraZ)
    return { ped, disc, rim, notch, pan, stool }
  }, [])
  useEffect(() => () => Object.values(wheel).forEach((g) => g.dispose()), [wheel])
  const slip = useMemo(() => new THREE.MeshStandardMaterial({ name: 'wheelSlip', color: '#6f4a3a', roughness: 0.3, metalness: 0, side: THREE.DoubleSide }), [])
  useEffect(() => () => slip.dispose(), [slip])

  const wire = useMemo(() => new THREE.MeshBasicMaterial({ name: 'cuttingWire', color: new THREE.Color(2.2, 1.8, 1.3), transparent: true, opacity: 0, depthWrite: false }), [])
  useEffect(() => () => wire.dispose(), [wire])

  const potG = useRef<THREE.Group>(null)
  const potMirrorG = useRef<THREE.Group>(null)
  const head = useRef<THREE.Group>(null)
  const wireM = useRef<THREE.Mesh>(null)
  const st = useMemo(() => ({ lastU: 0, stage: -1, risen: false }), [])

  /** Blend keyframes into the lathe positions. */
  const shape = (stage: number) => {
    const s = Math.max(0, Math.min(STAGES - 1, stage))
    const i = Math.min(STAGES - 2, Math.floor(s))
    const t = s - i
    const a = frames[i]
    const b = frames[i + 1]
    const pos = potGeo.getAttribute('position') as THREE.BufferAttribute
    for (let j = 0; j < P; j++) {
      const r = (a[j].r + (b[j].r - a[j].r) * t) * POT_SCALE
      const y = (a[j].y + (b[j].y - a[j].y) * t) * POT_SCALE
      for (let k = 0; k <= segs; k++) {
        const phi = (k / segs) * Math.PI * 2
        pos.setXYZ(k * P + j, r * Math.sin(phi), y, r * Math.cos(phi))
      }
    }
    pos.needsUpdate = true
    potGeo.computeVertexNormals()
    potGeo.computeBoundingSphere()
  }
  /** Outer radius (m) of the current pot at height y (m above the head). */
  const radiusAt = (stage: number, y: number) => {
    const s = Math.max(0, Math.min(STAGES - 1, stage))
    const i = Math.min(STAGES - 2, Math.floor(s))
    const t = s - i
    let best = 0
    for (let j = 1; j < 1 + nOuter; j++) {
      const yy = (frames[i][j].y + (frames[i + 1][j].y - frames[i][j].y) * t) * POT_SCALE
      if (yy >= y) return (frames[i][j].r + (frames[i + 1][j].r - frames[i][j].r) * t) * POT_SCALE
      best = (frames[i][j].r + (frames[i + 1][j].r - frames[i][j].r) * t) * POT_SCALE
    }
    return best
  }
  const heightAt = (stage: number) => {
    const s = Math.max(0, Math.min(STAGES - 1, stage))
    const i = Math.min(STAGES - 2, Math.floor(s))
    const t = s - i
    const j = nOuter
    return (frames[i][j].y + (frames[i + 1][j].y - frames[i][j].y) * t) * POT_SCALE
  }

  useFrame(({ clock }, dt) => {
    const time = clock.elapsedTime
    glowU.uTime.value = time
    glowU.uGain.value = 0.85 + 0.35 * ambience.night
    const u = still ? T.collar[1] : (time % loopSec) / loopSec
    const stage = still ? STAGES - 1 : stageAt(u)
    if (Math.abs(stage - st.stage) > 1e-4) {
      shape(stage)
      st.stage = stage
    }
    // wheel turns (slows to rest while the pot rises)
    const turning = still ? 0 : u < T.wire[1] ? 1 : u > T.rest[0] + 0.02 ? 0.4 : 0.15
    if (head.current) head.current.rotation.y += turning * 6.5 * Math.min(dt, 0.1)
    if (potG.current) potG.current.rotation.y += turning * 6.5 * Math.min(dt, 0.1)
    // wire off: a glowing taut wire passes under the pot
    const w = still ? 0 : span(u, T.wire)
    wire.opacity = w > 0 && w < 1 ? Math.sin(w * Math.PI) * 0.9 : 0
    if (wireM.current) wireM.current.position.z = -0.3 + w * 0.6
    // rise and dissolve into light
    const r = still || !rise ? 0 : span(u, T.rise)
    const lift = ease(Math.min(1, r * 1.4)) * 0.5
    const dissolve = still ? 0 : Math.max(0, (r - 0.35) / 0.65)
    const fadeIn = still ? 1 : span(u, [0, 0.025])
    potU.uDissolve.value = u < T.rise[0] ? 1 - fadeIn : u >= T.rest[0] ? 1 : dissolve
    potU.uLight.value = r * 0.9
    if (potG.current) potG.current.position.y = WHEEL.headY1 + lift
    if (potMirrorG.current && potG.current) {
      potMirrorG.current.position.y = potG.current.position.y
      potMirrorG.current.rotation.y = potG.current.rotation.y
    }
    if (!still && r > 0 && !st.risen) {
      st.risen = true
      if (linkHelix) fireCue('court:potRise', { source: 'system' })
    }
    if (u < T.rise[0]) st.risen = false
    // hands follow the wall
    let hy = 0.06
    if (still) hy = heightAt(stage) * 0.6
    else if (u < T.open[0]) hy = 0.05 + 0.02 * Math.sin(time * 3)
    else if (u < T.pulls[0]) hy = heightAt(stage) * 0.8
    else if (u < T.belly[0]) {
      const p = span(u, T.pulls) * 3
      hy = heightAt(stage) * (0.1 + 0.85 * Math.min(1, (p - Math.floor(p)) / 0.75))
    } else if (u < T.collar[0]) hy = heightAt(stage) * 0.45
    else if (u < T.wire[0]) hy = heightAt(stage) * 0.85
    const away = u >= T.wire[0] && !still ? Math.min(1, span(u, [T.wire[0], T.wire[0] + 0.02])) : 0
    const rr = radiusAt(stage, hy) + 0.035
    const target = new THREE.Vector3(rr, hy + WHEEL.headY1, FIGURE.handZ)
    glowU.uHandR.value.set(target.x - restR.x, target.y - restR.y, 0).multiplyScalar(1 - away)
    glowU.uHandL.value.set(-target.x - restL.x, target.y - restL.y, 0).multiplyScalar(1 - away)
  })

  const showMirror = poolMirror()
  const lvl = POOL.level
  return (
    <group name="ghost-potter">
      {/* the chak */}
      <mesh geometry={wheel.ped} material={m.shadowGap} receiveShadow raycast={noRaycast} />
      <group ref={head}>
        <mesh geometry={wheel.disc} material={m.timber} castShadow receiveShadow raycast={noRaycast} />
        <mesh geometry={wheel.rim} material={m.clayTerracotta} castShadow receiveShadow raycast={noRaycast} />
        <mesh geometry={wheel.notch} material={m.shadowGap} raycast={noRaycast} />
        <mesh geometry={wheel.pan} material={slip} receiveShadow raycast={noRaycast} />
      </group>
      <mesh geometry={wheel.stool} material={m.timber} castShadow receiveShadow raycast={noRaycast} />
      <mesh ref={wireM} position={[0, WHEEL.headY1 + 0.004, -0.3]} material={wire} raycast={noRaycast} renderOrder={4}>
        <boxGeometry args={[0.62, 0.002, 0.002]} />
      </mesh>
      {/* the pot */}
      <group ref={potG} position={[0, WHEEL.headY1, 0]}>
        {/* no shadow: the shadow map is frozen between refreshes, a moving pot would leave a stale one */}
        <mesh geometry={potGeo} material={potMat} receiveShadow raycast={noRaycast} />
      </group>
      {/* the potter */}
      <mesh geometry={figGeo} material={figMat} renderOrder={3} raycast={noRaycast} />
      {/* reflections in the pool (High / Ultra): the parent mirrors about the water plane */}
      <group visible={showMirror}>
        <group position={[0, 2 * (lvl - OFFSET_Y), 0]} scale={[1, -1, 1]}>
          <group ref={potMirrorG} position={[0, WHEEL.headY1, 0]}>
            <mesh geometry={potGeo} material={potMirrorMat} renderOrder={3} raycast={noRaycast} />
          </group>
          <mesh geometry={figGeo} material={figMirrorMat} renderOrder={3} raycast={noRaycast} />
        </group>
      </group>
    </group>
  )
}
