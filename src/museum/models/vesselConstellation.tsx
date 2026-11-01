/**
 * 'vessel-constellation' — the Clay Atlas's signature (F23): twenty-one clay vessels, one for each
 * tradition in the pavilion, hung from the Atlas's ceiling in a long rising arc over the map of
 * India and the partners band. A slow ember runs along them: one vessel after another warms from
 * its foot as if just drawn from the kiln, then cools, west to east, so the line reads as a route
 * travelled across the country without drawing one on the map.
 *
 *   the arc ...... from the west end wall, low (bottom 2.4 m), rising over the map to ~5 m, staying
 *                  high over the partners band and dipping again towards the east end. Every vessel
 *                  that lies in front of the map or the partners hangs high enough that, from the
 *                  room's middle, it projects above the panel: the map and the logos are never
 *                  covered (and never washed: the glow is emissive only, no light source; the
 *                  composer's bloom gives it its halo).
 *   the vessels .. the shared lathe profiles (clay.tsx vesselProfile) in eight clay bodies; one
 *                  merged mesh, one draw call; an `aIdx` attribute picks each vessel's glow
 *   the hangers .. a brass drop from the ceiling and a three-cord sling to the rim (one line set)
 *
 * No labels: the twenty-one names are shown only once the workshop confirms them (GRAND §4.2).
 * Not interactive and no footprint: it hangs overhead and must never catch the clicks meant for
 * the map. Still form: no ember sweep, every vessel holds a low, even warmth.
 *
 * Props: arcR (m, drum radius of the arc), fromDeg / toDeg (plan angles), ceiling (y, m),
 * period (s, one sweep), ember (glow colour). Positioned at any point: the arc is laid out in
 * world (plan) coordinates and brought into the object's local frame.
 */
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { DEG } from '../config/museum'
import { ambience } from '../lighting/timeOfDayState'
import { useSpectacle } from '../spectacle/settings'
import { vesselProfile, type VesselForm } from './clay'
import { useModelMaterials } from './modelMaterials'
import { num, str, type ModelProps } from './types'

const N = 21
const noRaycast = () => null

/** The twenty-one: form, clay colour, radius and height (m). */
const VESSELS: { form: VesselForm; color: string; R: number; H: number }[] = [
  { form: 'matka', color: '#b8633f', R: 0.2, H: 0.36 },
  { form: 'surahi', color: '#8f3d25', R: 0.15, H: 0.48 },
  { form: 'kettle', color: '#2a2523', R: 0.17, H: 0.3 },
  { form: 'handi', color: '#d39c84', R: 0.21, H: 0.3 },
  { form: 'vase', color: '#eeebe4', R: 0.13, H: 0.44 },
  { form: 'ghatam', color: '#9a4630', R: 0.22, H: 0.34 },
  { form: 'lidded', color: '#d6b38c', R: 0.16, H: 0.32 },
  { form: 'jar', color: '#2a2523', R: 0.15, H: 0.4 },
  { form: 'matka', color: '#8d8780', R: 0.23, H: 0.4 },
  { form: 'surahi', color: '#b8633f', R: 0.14, H: 0.52 },
  { form: 'ghatam', color: '#8f3d25', R: 0.25, H: 0.38 },
  { form: 'vase', color: '#9a4630', R: 0.14, H: 0.46 },
  { form: 'handi', color: '#2a2523', R: 0.2, H: 0.28 },
  { form: 'jar', color: '#d39c84', R: 0.16, H: 0.42 },
  { form: 'lidded', color: '#b8633f', R: 0.17, H: 0.34 },
  { form: 'kettle', color: '#8f3d25', R: 0.16, H: 0.28 },
  { form: 'matka', color: '#eeebe4', R: 0.19, H: 0.34 },
  { form: 'vase', color: '#d6b38c', R: 0.13, H: 0.5 },
  { form: 'ghatam', color: '#2a2523', R: 0.21, H: 0.33 },
  { form: 'surahi', color: '#9a4630', R: 0.15, H: 0.46 },
  { form: 'handi', color: '#b8633f', R: 0.22, H: 0.31 },
]

const smooth = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)))
  return t * t * (3 - 2 * t)
}

export interface ConstellationSlot {
  /** World (plan) position of the vessel's foot, and its drum angle (deg). */
  x: number
  y: number
  z: number
  aDeg: number
}

/**
 * Where each vessel hangs (world): even steps of plan angle from `fromDeg` to `toDeg`, the foot
 * high (≈ 4.8–5.05 m) across the middle (the map and the partners band) and lower at both ends,
 * west lowest; the radius swings ±0.3 m so the line has depth and reads as a constellation.
 */
export function constellationSlots(arcR: number, fromDeg: number, toDeg: number): ConstellationSlot[] {
  const out: ConstellationSlot[] = []
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1)
    const aDeg = fromDeg + (toDeg - fromDeg) * t
    // the high band: from 23 % to 88 % of the span (west of the map's edge to east of the partners)
    const west = smooth(0.23, 0.02, t)
    const east = smooth(0.88, 1.0, t)
    const crest = 4.86 + 0.14 * Math.sin(Math.PI * Math.min(1, Math.max(0, (t - 0.2) / 0.7)))
    let y = crest - (crest - 2.45) * west - (crest - 3.1) * east
    // an alternating stagger (slight in the high band, where it must stay clear of the panels)
    const stag = ((i * 7) % 3) - 1
    y += stag * (west + east > 0.2 ? 0.2 : 0.05)
    const r = arcR + 0.3 * Math.sin(i * 1.7)
    const a = aDeg * DEG
    out.push({ x: r * Math.cos(a), y, z: r * Math.sin(a), aDeg })
  }
  return out
}

type Uniforms = { uGlow: { value: Float32Array }; uEmber: { value: THREE.Color } }

/** Adds a per-vessel ember glow, strongest at the foot, to a standard material. */
function withEmber<M extends THREE.Material>(mat: M, u: Uniforms): M {
  const prev = mat.onBeforeCompile
  mat.onBeforeCompile = (shader, renderer) => {
    prev?.call(mat, shader, renderer)
    shader.uniforms.uGlow = u.uGlow
    shader.uniforms.uEmber = u.uEmber
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
attribute float aIdx;
attribute float aH;
uniform float uGlow[${N}];
varying float vEmber;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
vEmber = uGlow[int(aIdx + 0.5)] * (0.18 + 0.82 * pow(1.0 - clamp(aH, 0.0, 1.0), 1.6));`,
      )
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
uniform vec3 uEmber;
varying float vEmber;`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
totalEmissiveRadiance += uEmber * vEmber;`,
      )
  }
  const prevKey = mat.customProgramCacheKey.bind(mat)
  mat.customProgramCacheKey = () => `${prevKey()}|vesselEmber`
  mat.needsUpdate = true
  return mat
}

export function VesselConstellation({ config }: ModelProps) {
  const m = useModelMaterials()
  const sp = useSpectacle()
  const still = sp.mode === 'still'
  const arcR = num(config, 'arcR', 31.6)
  const fromDeg = num(config, 'fromDeg', -124.5)
  const toDeg = num(config, 'toDeg', -97.5)
  const ceiling = num(config, 'ceiling', 6.0)
  const period = Math.max(6, num(config, 'period', 28))
  const ember = str(config, 'ember', '#ff7a32')
  const segs = sp.caps.lathePotSegs >= 48 ? 40 : 24
  const [px, , pz] = config.position
  const rot = (config.rotationDeg ?? 0) * DEG

  const built = useMemo(() => {
    // world → the object's local frame (the group sits at config.position, turned by rotationDeg)
    const c = Math.cos(rot)
    const s = Math.sin(rot)
    const local = (wx: number, wz: number): [number, number] => {
      const dx = wx - px
      const dz = wz - pz
      return [dx * c - dz * s, dx * s + dz * c]
    }
    const slots = constellationSlots(arcR, fromDeg, toDeg)
    const parts: THREE.BufferGeometry[] = []
    const lines: number[] = []
    const col = new THREE.Color()
    slots.forEach((slot, i) => {
      const v = VESSELS[i]
      const [lx, lz] = local(slot.x, slot.z)
      const g = new THREE.LatheGeometry(
        vesselProfile(v.form, v.R, v.H).map(([r, y]) => new THREE.Vector2(r, y)),
        segs,
      )
      // each turned its own way and tipped a hair off plumb, as a hand-tied sling hangs
      g.rotateY(i * 2.399)
      g.rotateZ(((i * 37) % 7 - 3) * 0.008)
      g.translate(lx, slot.y, lz)
      const n = g.getAttribute('position').count
      const aIdx = new Float32Array(n).fill(i)
      const aH = new Float32Array(n)
      const colors = new Float32Array(n * 3)
      col.set(v.color)
      const pos = g.getAttribute('position')
      for (let k = 0; k < n; k++) {
        aH[k] = (pos.getY(k) - slot.y) / v.H
        colors[k * 3] = col.r
        colors[k * 3 + 1] = col.g
        colors[k * 3 + 2] = col.b
      }
      g.setAttribute('aIdx', new THREE.BufferAttribute(aIdx, 1))
      g.setAttribute('aH', new THREE.BufferAttribute(aH, 1))
      g.setAttribute('color', new THREE.BufferAttribute(colors, 3))
      parts.push(g)
      // the hanger: a drop from the ceiling to a knot above the mouth, a three-cord sling to the rim
      const top = slot.y + v.H
      const knot = top + 0.22
      lines.push(lx, ceiling - 0.01, lz, lx, knot, lz)
      const rimR = vesselProfile(v.form, v.R, v.H).reduce((acc, [r, y]) => (y > v.H * 0.9 && r > acc ? r : acc), v.R * 0.4)
      for (let k = 0; k < 3; k++) {
        const a = i * 0.9 + (k / 3) * Math.PI * 2
        lines.push(lx, knot, lz, lx + Math.cos(a) * rimR, top - 0.01, lz + Math.sin(a) * rimR)
      }
    })
    const body = mergeGeometries(parts, false)!
    for (const g of parts) g.dispose()
    body.computeBoundingSphere()
    const wires = new THREE.BufferGeometry()
    wires.setAttribute('position', new THREE.Float32BufferAttribute(lines, 3))
    return { body, wires }
  }, [arcR, fromDeg, toDeg, ceiling, segs, px, pz, rot])

  const uniforms = useMemo<Uniforms>(() => ({ uGlow: { value: new Float32Array(N) }, uEmber: { value: new THREE.Color(ember) } }), [ember])
  const bodyMat = useMemo(() => {
    const src = m.terracotta as THREE.MeshStandardMaterial
    const mat = src.clone()
    mat.name = 'constellationClay'
    mat.color.set('#ffffff')
    mat.vertexColors = true
    mat.roughness = 0.62
    mat.envMapIntensity = 0.8
    return withEmber(mat, uniforms)
  }, [m, uniforms])
  const wireMat = useMemo(() => new THREE.LineBasicMaterial({ name: 'constellationWire', color: '#8a6a3c', transparent: true, opacity: 0.55, depthWrite: false }), [])

  useEffect(
    () => () => {
      built.body.dispose()
      built.wires.dispose()
    },
    [built],
  )
  useEffect(
    () => () => {
      bodyMat.dispose()
      wireMat.dispose()
    },
    [bodyMat, wireMat],
  )

  useFrame(({ clock }) => {
    const g = uniforms.uGlow.value
    // a low warmth that rises after dark, and one ember running west → east
    const base = 0.16 + 0.34 * ambience.night
    if (still) {
      g.fill(base + 0.12)
      return
    }
    const t = clock.elapsedTime
    // the ember runs the line in 80 % of the period and rests between passes
    const head = ((t % period) / period) * 1.25 - 0.1
    for (let i = 0; i < N; i++) {
      const d = i / (N - 1) - head
      // a sharp leading edge, a slow cooling tail
      const w = d > 0 ? Math.exp(-(d * d) / 0.0016) : Math.exp(-(d * d) / 0.012)
      g[i] = base + 0.05 * Math.sin(t * 0.6 + i * 1.3) + 2.1 * w
    }
  })

  return (
    <group>
      <mesh geometry={built.body} material={bodyMat} raycast={noRaycast} />
      <lineSegments geometry={built.wires} material={wireMat} raycast={noRaycast} />
    </group>
  )
}
