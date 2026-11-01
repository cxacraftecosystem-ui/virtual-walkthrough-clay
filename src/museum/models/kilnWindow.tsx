/**
 * 'kiln-window' — one pot's life, seen through the glass of a brick kiln (SPECTACLE F18).
 *
 * A pot sits in the kiln's chamber behind an arched glass window. As the visitor comes near it
 * walks through its stages on its own — wet, leather-hard, bone-dry, in the fire (the chamber
 * and the pot glow, the glass shimmers with heat), fired terracotta — and, when the curator
 * allows the smoked branch, on into a smoked-black finish. The brass lever on the right drives
 * it by hand (drag it, or tap the window for the next stage); six studs under the sill show
 * where the pot is. No temperatures are shown (placeholder honesty): colour only.
 *
 *   props {form: 'matka' | 'kulhad' | 'bowl', branch: 'none' | 'smoked', autoSec = 30}
 *   tiers  glass: L/M plain · H heat shimmer · U transmission. Still: the stages snap, no flames.
 */
import { useFrame } from '@react-three/fiber'
import { useContext, useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { proximity } from '../interaction/proximity'
import { glowRamp } from '../materials/blackbody'
import { playKilnWhoosh, playLeverNotch } from '../media/soundscape/craft'
import { kilnAutoStage, kilnHeat } from '../config/spectacleObjects/craft'
import { useSpectacle } from '../spectacle/settings'
import { Builder, box, cyl, lathe, Parts, rbox, rng, useBuilt } from './kit'
import { vesselProfile, type VesselForm } from './clay'
import { craftKeysAllowed, useCanvasGrab } from './clayBed'
import { useModelMaterials } from './modelMaterials'
import { InMuseumScene } from './sceneContext'
import { geoKey, num, str, type ModelProps } from './types'

/* ------------------------------------------------------------------ */
/* Dimensions (local: front +z, origin floor centre)                   */
/* ------------------------------------------------------------------ */

// a low kiln niche (hip height), not a chimney: the window is looked down into
const H = 1.12 // body height
const FRONT_T = 0.11 // front slab thickness
const OPEN = { w: 0.46, sill: 0.5, h: 0.5 } // window: width, sill height, height incl. the arch
const CHAMBER = { w: 0.62, h: 0.54, d: 0.34 }
/** Chamber floor height (a little below the sill, so the pot sits in the window). */
const CHAMBER_Y0 = OPEN.sill - 0.04
const LEVER = { x: 0.36, y: OPEN.sill, r: 0.075 }

/** Stage → look of the pot. Index = stage 0 … 5. */
const STAGES = [
  { color: '#4f4741', rough: 0.26 }, // wet
  { color: '#6d6157', rough: 0.58 }, // leather-hard
  { color: '#b4a692', rough: 0.95 }, // bone-dry
  { color: '#5b3424', rough: 0.85 }, // in the fire
  { color: '#b25f3c', rough: 0.86 }, // fired terracotta
  { color: '#242120', rough: 0.42 }, // smoked black
]

/* ------------------------------------------------------------------ */
/* Brick                                                               */
/* ------------------------------------------------------------------ */

let brickTex: THREE.CanvasTexture | null = null
/** A 0.9 m tile of hand-made bricks (0.225 × 0.075 m with mortar), staggered courses, dark lime-and-ash mortar. */
function brickTexture(): THREE.CanvasTexture | null {
  if (brickTex || typeof document === 'undefined') return brickTex
  const px = 512
  const c = document.createElement('canvas')
  c.width = c.height = px
  const g = c.getContext('2d')
  if (!g) return null
  g.fillStyle = '#4e4036'
  g.fillRect(0, 0, px, px)
  const rnd = rng('kiln-bricks')
  const rows = 12
  const cols = 4
  const bh = px / rows
  const bw = px / cols
  const m = 2
  for (let r = 0; r < rows; r++) {
    const off = r % 2 ? bw / 2 : 0
    for (let k = -1; k <= cols; k++) {
      const x = k * bw + off
      const t = rnd()
      const hue = 12 + t * 14
      const light = 30 + rnd() * 14
      g.fillStyle = `hsl(${hue}, ${42 + rnd() * 18}%, ${light}%)`
      g.fillRect(x + m, r * bh + m, bw - 2 * m, bh - 2 * m)
      // a scorched face here and there
      if (rnd() < 0.18) {
        g.fillStyle = 'rgba(30, 18, 12, 0.35)'
        g.fillRect(x + m, r * bh + m, bw - 2 * m, bh - 2 * m)
      }
      // speckle
      for (let i = 0; i < 14; i++) {
        g.fillStyle = `rgba(${rnd() < 0.5 ? '255,230,200' : '40,20,10'}, ${0.08 + rnd() * 0.1})`
        g.fillRect(x + m + rnd() * (bw - 2 * m), r * bh + m + rnd() * (bh - 2 * m), 2, 2)
      }
    }
  }
  brickTex = new THREE.CanvasTexture(c)
  brickTex.colorSpace = THREE.SRGBColorSpace
  brickTex.wrapS = brickTex.wrapT = THREE.RepeatWrapping
  brickTex.repeat.set(1 / 0.9, 1 / 0.9)
  brickTex.anisotropy = 4
  return brickTex
}

/** Window outline: a rectangle with a round arch, centred on x = 0, sill at y = 0. */
function windowShape(w: number, h: number): THREE.Shape {
  const r = w / 2
  const s = new THREE.Shape()
  s.moveTo(-r, 0)
  s.lineTo(r, 0)
  s.lineTo(r, h - r)
  s.absarc(0, h - r, r, 0, Math.PI, false)
  s.lineTo(-r, 0)
  return s
}

function frontSlab(): THREE.BufferGeometry {
  const W = 0.9
  const s = new THREE.Shape()
  s.moveTo(-W / 2, 0)
  s.lineTo(W / 2, 0)
  s.lineTo(W / 2, H)
  s.lineTo(-W / 2, H)
  s.lineTo(-W / 2, 0)
  const hole = windowShape(OPEN.w, OPEN.h)
  const pts = hole.getPoints(24).map((p) => new THREE.Vector2(p.x, p.y + OPEN.sill))
  s.holes.push(new THREE.Path(pts))
  const g = new THREE.ExtrudeGeometry(s, { depth: FRONT_T, bevelEnabled: false, curveSegments: 24 })
  // metre UVs on every face (the brick tile is metre-scaled)
  const pos = g.getAttribute('position')
  const nor = g.getAttribute('normal')
  const uv = g.getAttribute('uv')
  for (let i = 0; i < pos.count; i++) {
    const ax = Math.abs(nor.getX(i))
    const az = Math.abs(nor.getZ(i))
    const ay = Math.abs(nor.getY(i))
    if (az >= ax && az >= ay) uv.setXY(i, pos.getX(i), pos.getY(i))
    else if (ax >= ay) uv.setXY(i, pos.getZ(i), pos.getY(i))
    else uv.setXY(i, pos.getX(i), pos.getZ(i))
  }
  return g
}

/** The voussoirs of the arch: wedge bricks round the opening's round head, with mortar joints between. */
function archRing(rIn: number, rOut: number, depth: number, n = 11): THREE.BufferGeometry[] {
  const out: THREE.BufferGeometry[] = []
  const gap = 0.006 / ((rIn + rOut) / 2) // a 6 mm joint
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI + gap / 2
    const a1 = ((i + 1) / n) * Math.PI - gap / 2
    const s = new THREE.Shape()
    s.moveTo(Math.cos(a0) * rIn, Math.sin(a0) * rIn)
    s.lineTo(Math.cos(a0) * rOut, Math.sin(a0) * rOut)
    s.absarc(0, 0, rOut, a0, a1, false)
    s.lineTo(Math.cos(a1) * rIn, Math.sin(a1) * rIn)
    s.absarc(0, 0, rIn, a1, a0, true)
    const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.002, bevelSegments: 1, curveSegments: 4 })
    // brick-face UVs: across and along the wedge
    const pos = g.getAttribute('position')
    const uv = g.getAttribute('uv')
    for (let k = 0; k < pos.count; k++) uv.setXY(k, Math.atan2(pos.getY(k), pos.getX(k)) * 0.3 + i * 0.37, Math.hypot(pos.getX(k), pos.getY(k)))
    out.push(g)
  }
  return out
}

/* ------------------------------------------------------------------ */
/* Glass                                                               */
/* ------------------------------------------------------------------ */

function glassMaterial(kind: 'plain' | 'shimmer' | 'transmission', uHeat: { value: number }, uTime: { value: number }): THREE.MeshStandardMaterial {
  if (kind === 'transmission') {
    const m = new THREE.MeshPhysicalMaterial({ name: 'kilnGlass', color: '#ffffff', roughness: 0.06, metalness: 0, transmission: 1, thickness: 0.006, ior: 1.5, envMapIntensity: 1.1 })
    patchShimmer(m, uHeat, uTime)
    return m
  }
  const m = new THREE.MeshStandardMaterial({ name: 'kilnGlass', color: '#dfe8e6', roughness: 0.04, metalness: 0, transparent: true, opacity: 0.16, envMapIntensity: 1.4, depthWrite: false })
  if (kind === 'shimmer') patchShimmer(m, uHeat, uTime)
  return m
}

/** Heat shimmer: a slow, scrolling ripple of the glass normal, only while the pot is in the fire. */
function patchShimmer(m: THREE.MeshStandardMaterial, uHeat: { value: number }, uTime: { value: number }) {
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uHeat = uHeat
    shader.uniforms.uKTime = uTime
    shader.vertexShader = 'varying vec3 vKw;\n' + shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvKw = (modelMatrix * vec4(transformed, 1.0)).xyz;')
    shader.fragmentShader =
      'uniform float uHeat; uniform float uKTime; varying vec3 vKw;\n' +
      shader.fragmentShader.replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
{
  float t = uKTime;
  vec2 p = vec2(vKw.x + vKw.z, vKw.y) * 38.0;
  vec2 g = vec2(sin(p.y * 0.9 - t * 3.1 + sin(p.x * 0.7)), cos(p.x * 1.1 + t * 2.3)) + 0.5 * vec2(sin(p.y * 2.3 - t * 4.7), cos(p.x * 2.1 - p.y * 0.6 + t * 3.9));
  normal = normalize(normal + vec3(g * 0.05 * uHeat, 0.0));
}`,
      )
  }
  m.customProgramCacheKey = () => `kilnGlassShimmer|${m.type}`
}

/* ------------------------------------------------------------------ */
/* Flames (behind the pot, in the chamber)                             */
/* ------------------------------------------------------------------ */

const FLAME_VS = /* glsl */ `
attribute float aSeed;
uniform float uTime;
uniform float uHeat;
varying vec2 vUv;
varying float vSeed;
void main() {
  vUv = uv;
  vSeed = aSeed;
  vec3 p = position;
  // each tongue sways and stretches on its own rhythm
  float sway = sin(uTime * (2.1 + aSeed * 1.7) + aSeed * 6.0) * 0.012 * uv.y;
  p.x += sway;
  p.y *= 0.55 + 0.45 * uHeat + 0.12 * sin(uTime * (3.0 + aSeed * 2.0) + aSeed * 9.0);
  gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(p, 1.0);
}
`
const FLAME_FS = /* glsl */ `
uniform float uTime;
uniform float uHeat;
varying vec2 vUv;
varying float vSeed;
void main() {
  vec2 q = vUv - vec2(0.5, 0.0);
  float w = 0.5 * (1.0 - vUv.y) * (1.0 - vUv.y * 0.35);
  float body = smoothstep(w, w * 0.25, abs(q.x + sin(vUv.y * 7.0 - uTime * 6.0 + vSeed * 5.0) * 0.06 * vUv.y));
  float tip = 1.0 - smoothstep(0.55, 1.0, vUv.y);
  float a = body * tip * uHeat;
  vec3 c = mix(vec3(1.0, 0.85, 0.45), vec3(1.0, 0.32, 0.06), smoothstep(0.0, 0.8, vUv.y));
  gl_FragColor = vec4(c * a * 2.2, a);
}
`

/* ------------------------------------------------------------------ */
/* Model                                                               */
/* ------------------------------------------------------------------ */

const FORMS: VesselForm[] = ['matka', 'kulhad', 'bowl']

const smooth = (x: number) => x * x * (3 - 2 * x)

export function KilnWindow({ config }: ModelProps) {
  const inScene = useContext(InMuseumScene)
  const m = useModelMaterials()
  const sp = useSpectacle()
  const formS = str(config, 'form', 'matka')
  const form: VesselForm = (FORMS as string[]).includes(formS) ? (formS as VesselForm) : 'matka'
  const smoked = str(config, 'branch', 'smoked') === 'smoked'
  const autoSec = Math.max(8, num(config, 'autoSec', 30))
  const last = smoked ? 5 : 4
  const still = sp.mode === 'still'
  const glassKind: 'plain' | 'shimmer' | 'transmission' = !inScene ? 'plain' : sp.caps.heatShimmer ? (sp.caps.spectacleTexPx >= 2048 ? 'transmission' : 'shimmer') : 'plain'

  const tex = useMemo(() => brickTexture(), [])
  const brick = useMemo(() => {
    const mat = new THREE.MeshStandardMaterial({ name: 'kilnBrick', color: '#ffffff', map: tex, roughness: 0.92, metalness: 0, envMapIntensity: 0.45 })
    const src = m.terracotta as THREE.MeshStandardMaterial
    if (src.normalMap) {
      mat.normalMap = src.normalMap
      mat.normalScale.set(0.8, 0.8)
    }
    return mat
  }, [m, tex])
  const arch = useMemo(() => new THREE.MeshStandardMaterial({ name: 'kilnArch', color: '#7d3a24', roughness: 0.9, envMapIntensity: 0.4, map: tex }), [tex])
  // the chamber: soot-dark brick that glows from within while the pot is fired
  const chamber = useMemo(() => new THREE.MeshStandardMaterial({ name: 'kilnChamber', color: '#6a4a3a', roughness: 1, side: THREE.BackSide, emissive: new THREE.Color('#000000'), map: tex }), [tex])
  const coal = useMemo(() => new THREE.MeshStandardMaterial({ name: 'kilnCoal', color: '#1e1814', roughness: 0.9, emissive: new THREE.Color('#000000') }), [])
  const pot = useMemo(() => new THREE.MeshStandardMaterial({ name: 'kilnPot', color: STAGES[0].color, roughness: STAGES[0].rough, metalness: 0, envMapIntensity: 0.8, emissive: new THREE.Color('#000000') }), [])
  const studs = useMemo(() => Array.from({ length: 6 }, () => new THREE.MeshStandardMaterial({ name: 'kilnStud', color: '#b58a4a', metalness: 1, roughness: 0.35, emissive: new THREE.Color('#000000') })), [])
  const uHeat = useMemo(() => ({ value: 0 }), [])
  const uTime = useMemo(() => ({ value: 0 }), [])
  const glass = useMemo(() => glassMaterial(glassKind, uHeat, uTime), [glassKind, uHeat, uTime])
  const flameMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        name: 'kilnFlame',
        vertexShader: FLAME_VS,
        fragmentShader: FLAME_FS,
        uniforms: { uTime, uHeat: { value: 0 } },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    [uTime],
  )
  useEffect(
    () => () => {
      for (const x of [brick, arch, chamber, coal, pot, glass, flameMat, ...studs]) x.dispose()
    },
    [brick, arch, chamber, coal, pot, glass, flameMat, studs],
  )

  const zf = 0.3 // front face z (body depth 0.6, centred)
  const parts = useBuilt(geoKey('kiln-window', config), () => {
    const b = new Builder()
    // the body is hollow round the chamber (1 cm clear of it, so no face is shared):
    // side walls, back wall, the base under the chamber and the crown over it
    const zb = -0.3 // back face
    const zs = zf - FRONT_T // back of the front slab
    const cw = CHAMBER.w / 2 + 0.01
    const y0 = CHAMBER_Y0 - 0.01
    const y1 = CHAMBER_Y0 + CHAMBER.h + 0.01
    const zc = zs - CHAMBER.d - 0.01
    const blk = (x0: number, x1: number, ya: number, yb: number, za: number, zz: number) =>
      b.add('brick', box(x1 - x0, yb - ya, zz - za), { p: [(x0 + x1) / 2, (ya + yb) / 2, (za + zz) / 2] })
    blk(-0.45, -cw, 0.06, H, zb, zs)
    blk(cw, 0.45, 0.06, H, zb, zs)
    blk(-cw, cw, 0.06, y0, zb, zs)
    blk(-cw, cw, y1, H, zb, zs)
    blk(-cw, cw, y0, y1, zb, zc)
    b.add('brick', frontSlab(), { p: [0, 0, zs] })
    // brick arch over the window head, a stone sill, a stone cap and plinth
    for (const v of archRing(OPEN.w / 2 + 0.004, OPEN.w / 2 + 0.09, 0.018)) b.add('arch', v, { p: [0, OPEN.sill + OPEN.h - OPEN.w / 2, zf] })
    b.add('stone', rbox(OPEN.w + 0.08, 0.05, 0.09, 0.008), { p: [0, OPEN.sill - 0.025, zf + 0.02] })
    b.add('stone', rbox(0.96, 0.05, 0.66, 0.01), { p: [0, H + 0.025, 0] })
    b.add('stone', rbox(0.96, 0.06, 0.66, 0.01), { p: [0, 0.03, 0] })
    // the pot's stand on the chamber floor
    b.add('stand', cyl(0.07, 0.085, 0.06, 18), { p: [0, CHAMBER_Y0 + 0.03, zs - CHAMBER.d / 2] })
    // the lever's brass plate, right of the window
    b.add('brass', cyl(LEVER.r, LEVER.r, 0.008, 28, false), { p: [LEVER.x, LEVER.y, zf + 0.004], r: [Math.PI / 2, 0, 0] })
    return b
  })
  // the chamber: an open box (no front) behind the window, larger than the opening
  const chamberGeo = useMemo(() => {
    const g = new THREE.BoxGeometry(CHAMBER.w, CHAMBER.h, CHAMBER.d)
    const front = g.groups[4] // +z
    const idx = g.index!.array
    const keep: number[] = []
    for (let i = 0; i < idx.length; i++) if (i < front.start || i >= front.start + front.count) keep.push(idx[i])
    g.setIndex(keep)
    g.clearGroups()
    // brick UVs in metres
    const pos = g.getAttribute('position')
    const uv = g.getAttribute('uv')
    for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) + pos.getZ(i), pos.getY(i))
    return g
  }, [])
  const potGeo = useMemo(() => {
    const R = form === 'bowl' ? 0.13 : form === 'kulhad' ? 0.075 : 0.12
    const Hh = form === 'bowl' ? 0.1 : form === 'kulhad' ? 0.13 : 0.24
    return lathe(vesselProfile(form, R, Hh), 40)
  }, [form])
  const coalGeo = useMemo(() => {
    const b = new Builder()
    const r = rng('kiln-coals')
    for (let i = 0; i < 26; i++) {
      const a = r() * Math.PI * 2
      const rr = 0.08 + r() * 0.17
      b.add('c', new THREE.DodecahedronGeometry(0.018 + r() * 0.016, 0), { p: [Math.cos(a) * rr, 0.012, Math.sin(a) * rr * 0.6], r: [r() * 3, r() * 3, r() * 3] })
    }
    return b.build()[0].geometry
  }, [])
  const flameGeo = useMemo(() => {
    const g = new THREE.PlaneGeometry(0.09, 0.24, 1, 6)
    g.translate(0, 0.12, 0)
    return g
  }, [])
  const flames = useRef<THREE.InstancedMesh>(null)
  const FLAMES = 7
  useEffect(() => {
    const f = flames.current
    if (!f) return
    const r = rng('kiln-flames')
    const seed = new Float32Array(FLAMES)
    const mm = new THREE.Matrix4()
    for (let i = 0; i < FLAMES; i++) {
      const x = (i / (FLAMES - 1) - 0.5) * 0.44
      const z = -0.06 - r() * 0.08
      const s = 0.7 + r() * 0.6
      mm.compose(new THREE.Vector3(x, 0, z), new THREE.Quaternion(), new THREE.Vector3(s, s * (1 - Math.abs(x) * 1.2), 1))
      f.setMatrixAt(i, mm)
      seed[i] = r()
    }
    f.geometry.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seed, 1))
    f.instanceMatrix.needsUpdate = true
  }, [flameGeo])

  // --- state: the stage, manual or automatic ---------------------------------------------
  const st = useRef({ stage: 0, target: 0, manualAt: -1e9, autoT: 0, lastNotch: 0, wasFire: false, holding: false })
  const lever = useRef<THREE.Group>(null)
  const leverHit = useRef<THREE.Mesh>(null)
  const glassMesh = useRef<THREE.Mesh>(null)
  const root = useRef<THREE.Group>(null)
  const _p = useMemo(() => new THREE.Vector3(), [])
  const _c = useMemo(() => new THREE.Color(), [])
  const _c2 = useMemo(() => new THREE.Color(), [])
  const _g = useMemo(() => new THREE.Color(), [])

  const setManual = (s: number) => {
    const x = st.current
    x.target = Math.max(0, Math.min(last, s))
    x.manualAt = performance.now() / 1000
  }

  useCanvasGrab(
    () => [leverHit.current, glassMesh.current],
    {
      down: (hit) => {
        if (hit.object === glassMesh.current) {
          const x = st.current
          setManual(Math.round(x.target) >= last ? 0 : Math.round(x.target) + 1)
          return true
        }
        st.current.holding = true
        return true
      },
      move: (_hit, _e, dx, dy) => {
        if (!st.current.holding) return
        const x = st.current
        // pulling the lever down (or to the right) moves the pot along its life
        setManual(x.target + (dy + dx * 0.6) * 0.011)
      },
      up: () => {
        const x = st.current
        if (x.holding) setManual(Math.round(x.target))
        x.holding = false
      },
    },
    inScene,
  )

  // keyboard: [ and ] step the pot back and forth when standing at the kiln
  useEffect(() => {
    if (!inScene) return
    const onKey = (e: KeyboardEvent) => {
      if ((e.key !== '[' && e.key !== ']') || !craftKeysAllowed(e) || !root.current) return
      root.current.getWorldPosition(_p)
      if (proximity(_p.x, _p.z, 1.4, 2.6) < 0.5) return
      setManual(Math.round(st.current.target) + (e.key === ']' ? 1 : -1))
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [inScene]) // eslint-disable-line react-hooks/exhaustive-deps

  useFrame((state, dt) => {
    const x = st.current
    const t = state.clock.elapsedTime
    if (!still) uTime.value = t
    const now = performance.now() / 1000
    if (inScene && root.current) {
      root.current.getWorldPosition(_p)
      const near = proximity(_p.x, _p.z, 1.6, 3.6)
      const manual = now - x.manualAt < 15
      if (!manual) {
        if (near > 0.3) {
          x.autoT += dt
          if (x.autoT > autoSec + 6) x.autoT = 0 // rest on the last stage, then begin again
          x.target = kilnAutoStage(x.autoT, autoSec, last)
        } else if (near === 0 && x.autoT > 0) {
          // left alone, the kiln cools and a fresh pot is set in
          x.autoT = 0
          x.target = 0
        }
      }
    }
    // ease (or snap, in the Still form) towards the target
    x.stage = still ? Math.round(x.target) : x.stage + (x.target - x.stage) * Math.min(1, dt * 2.4)
    const s = x.stage
    // notches as the lever passes a stage; the fire's roar as the pot goes in
    const notch = Math.round(s)
    if (notch !== x.lastNotch && Math.abs(s - notch) < 0.12) {
      x.lastNotch = notch
      if (inScene && root.current) playLeverNotch([_p.x, OPEN.sill, _p.z])
    }
    const fire = s > 2.6 && s < 3.6
    if (fire && !x.wasFire && inScene) playKilnWhoosh([_p.x, OPEN.sill + 0.2, _p.z])
    x.wasFire = fire

    // pot colour: between the two stages it sits between
    const k = Math.min(STAGES.length - 2, Math.floor(s))
    const f = Math.min(1, Math.max(0, s - k))
    pot.color.set(_c.set(STAGES[k].color).lerp(_c2.set(STAGES[k + 1].color), f))
    pot.roughness = STAGES[k].rough + (STAGES[k + 1].rough - STAGES[k].rough) * f
    const heat = kilnHeat(s)
    glowRamp(0.5 + 0.45 * heat, _g)
    pot.emissive.copy(_g).multiplyScalar(heat * 0.9)
    // a little warmth always lingers in the chamber, so the pot reads even when cold
    chamber.emissive.copy(_g).multiplyScalar(heat * 0.3)
    // embers always smoulder in the arch: the niche reads as a living kiln at every stage
    chamber.emissive.r += 0.16
    chamber.emissive.g += 0.055
    chamber.emissive.b += 0.018
    pot.emissive.r += 0.05
    pot.emissive.g += 0.018
    pot.emissive.b += 0.006
    coal.emissive.copy(glowRamp(0.62 + 0.3 * heat, _g)).multiplyScalar(0.5 + heat * 0.9)
    uHeat.value = heat
    flameMat.uniforms.uHeat.value = still ? 0 : smooth(Math.min(1, heat * 1.3))
    // no draw call while the chamber is cold (the material stays mounted, so it was compiled)
    flameMat.visible = flameMat.uniforms.uHeat.value > 0.001
    // lever angle follows the stage: up (+55°) wet → down (−55°) at the last stage
    if (lever.current) lever.current.rotation.z = THREE.MathUtils.degToRad(55 - (s / 5) * 110)
    for (let i = 0; i < studs.length; i++) {
      const on = Math.max(0, 1 - Math.abs(s - i) * 1.6)
      studs[i].emissive.setRGB(1, 0.62, 0.3).multiplyScalar(on * 0.9)
      studs[i].visible = i <= last
    }
  })

  const potY = CHAMBER_Y0 + 0.06
  const chamberZ = zf - FRONT_T - CHAMBER.d / 2
  return (
    <group ref={root}>
      <Parts parts={parts} materials={{ brick, arch, stone: m.stoneFine, stand: m.earthenware, brass: m.brass }} />
      <mesh geometry={chamberGeo} material={chamber} position={[0, CHAMBER_Y0 + CHAMBER.h / 2, chamberZ]} />
      <mesh geometry={coalGeo} material={coal} position={[0, CHAMBER_Y0, chamberZ - 0.02]} />
      <mesh geometry={potGeo} material={pot} position={[0, potY, chamberZ]} castShadow />
      <instancedMesh ref={flames} args={[flameGeo, flameMat, FLAMES]} position={[0, CHAMBER_Y0, chamberZ]} frustumCulled={false} renderOrder={3} />
      {/* the glass, set back in the reveal */}
      <mesh ref={glassMesh} position={[0, OPEN.sill, zf - FRONT_T * 0.45]} material={glass} renderOrder={4}>
        <shapeGeometry args={[windowShape(OPEN.w, OPEN.h), 24]} />
      </mesh>
      {/* stage studs under the sill */}
      {studs.map((mat, i) => (
        <mesh key={i} material={mat} position={[(i - 2.5) * 0.05, OPEN.sill - 0.075, zf + 0.008]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.009, 0.011, 0.012, 14]} />
        </mesh>
      ))}
      {/* the lever: pivot at the plate's centre */}
      <group ref={lever} position={[LEVER.x, LEVER.y, zf + 0.012]}>
        <mesh material={m.brass} position={[0, 0.06, 0.012]} castShadow>
          <cylinderGeometry args={[0.007, 0.009, 0.12, 12]} />
        </mesh>
        <mesh material={m.darkTimber} position={[0, 0.13, 0.012]} castShadow>
          <sphereGeometry args={[0.018, 16, 12]} />
        </mesh>
        <mesh material={m.brass} position={[0, 0, 0.008]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.016, 0.016, 0.012, 16]} />
        </mesh>
        {/* a generous invisible grip, so the lever is easy to catch on a phone */}
        <mesh ref={leverHit} position={[0, 0.08, 0.02]} visible={inScene}>
          <boxGeometry args={[0.12, 0.2, 0.06]} />
          <meshBasicMaterial colorWrite={false} depthWrite={false} />
        </mesh>
      </group>
    </group>
  )
}
