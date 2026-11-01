/**
 * 'clay-sphere' — the clay sphere hanging at the heart of the Sphere Well (PDF p07r "a spiral
 * stair round a sphere"; GRAND §2.7, §6.5).
 *
 *   form      a sphere of radius `r`, coil-built: faint horizontal coil ridges smoothed by the
 *             paddle, a joining seam at the equator, a hand-pressed unevenness and burnish marks
 *             (baked into the vertex colour), turning once every `spinSec` (0 or reduced motion:
 *             still)
 *   finish    red (deep red slip, burnished), terracotta or grey (unfired)
 *   uplit     the floor washers' warm light on its underside (an emissive ramp)
 *   hanging   a slender bronze rod from the sphere's crown straight up to grade (world y 0), so
 *             it hangs from the well's opening
 *
 * Origin: the sphere's centre (place the object at the centre's height). Draw calls: 2.
 */
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { injectAtmosphere } from '../lighting/atmosphere/inject'
import { useMaterials } from '../materials/materials'
import { useMuseum } from '../state/store'
import { fbm3 } from './erodedFormation'
import { num, str, type ModelProps } from './types'

const noRaycast = () => null

const FINISH: Record<string, { color: string; rough: number }> = {
  red: { color: '#9a2a1d', rough: 0.3 },
  terracotta: { color: '#b8603f', rough: 0.6 },
  grey: { color: '#8c857c', rough: 0.85 },
}

function sphereGeometry(r: number, w: number, h: number): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(r, w, h)
  const p = g.getAttribute('position')
  const col = new Float32Array(p.count * 3)
  const v = new THREE.Vector3()
  const coils = Math.max(12, Math.round(r * 22))
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i)
    const lat = Math.asin(THREE.MathUtils.clamp(v.y / r, -1, 1))
    const nrm = v.clone().normalize()
    // coil ridges (paddled almost smooth), the equator seam and a hand-pressed unevenness
    const coil = 0.5 + 0.5 * Math.cos(((lat + Math.PI / 2) / Math.PI) * coils * Math.PI * 2)
    const seam = Math.exp(-Math.pow(lat / 0.012, 2))
    const press = fbm3(nrm.x * 2.2, nrm.y * 2.2, nrm.z * 2.2, 7, 3)
    // burnished smooth: the coils paddled away, only a whisper of the hand left
    const d = r * (0.0006 * coil - 0.0015 * seam + 0.0025 * press)
    v.addScaledVector(nrm, d)
    p.setXYZ(i, v.x, v.y, v.z)
    // burnish: bright streaks where the stone ran, darker in the coil valleys and the seam
    const burnish = 0.92 + 0.08 * Math.max(0, fbm3(nrm.x * 6, nrm.y * 1.2, nrm.z * 6, 13, 3)) - 0.02 * (1 - coil) - 0.12 * seam
    col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = burnish
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3))
  g.computeVertexNormals()
  return g
}

const matCache = new Map<string, THREE.MeshStandardMaterial>()

/**
 * The washers on the floor below light the sphere's underside: a warm emissive ramp on the
 * sphere's v coordinate (0 at the south pole), strongest under it and gone by the equator, so the
 * ball reads as lit from beneath against the dark room (the well's real lights are the sky).
 */
let uplightTex: THREE.DataTexture | null = null
function uplightRamp(): THREE.DataTexture {
  if (uplightTex) return uplightTex
  const N = 64
  const d = new Uint8Array(N * 4)
  for (let i = 0; i < N; i++) {
    const v = i / (N - 1)
    // warm washers from beneath; the sky from the opening above on the crown (blush, p07r)
    const k = Math.pow(Math.max(0, 1 - v / 0.55), 1.6)
    const t = 0.55 * Math.pow(Math.max(0, (v - 0.6) / 0.4), 1.4)
    d.set([Math.min(255, Math.round(255 * k + 255 * t)), Math.min(255, Math.round(150 * k + 196 * t)), Math.min(255, Math.round(90 * k + 182 * t)), 255], i * 4)
  }
  uplightTex = new THREE.DataTexture(d, 1, N)
  uplightTex.colorSpace = THREE.SRGBColorSpace
  uplightTex.magFilter = THREE.LinearFilter
  uplightTex.needsUpdate = true
  return uplightTex
}

export function ClaySphere({ config }: ModelProps) {
  const core = useMaterials()
  const tier = useMuseum((s) => s.tier)
  const reduced = useMuseum((s) => s.reducedMotion)
  const r = Math.max(0.2, num(config, 'r', 1.6))
  const spinSec = Math.max(0, num(config, 'spinSec', 240))
  const finish = str(config, 'finish', 'red')
  const f = FINISH[finish] ?? FINISH.red
  const lo = tier === 'low'
  const geo = useMemo(() => sphereGeometry(r, lo ? 64 : 160, lo ? 48 : 120), [r, lo])
  // the rod: from the crown up to world y 0 (the well's opening)
  const rodLen = Math.max(0, -(config.position?.[1] ?? 0) - r)
  const rod = useMemo(() => {
    if (rodLen <= 0.05) return null
    const g = new THREE.CylinderGeometry(0.018, 0.018, rodLen, 8)
    g.translate(0, r + rodLen / 2, 0)
    const cap = new THREE.CylinderGeometry(0.06, 0.09, 0.08, 16)
    cap.translate(0, r + 0.02, 0)
    const merged = new THREE.BufferGeometry()
    const parts = [g, cap].map((x) => x.toNonIndexed())
    const n = parts.reduce((s, x) => s + x.getAttribute('position').count, 0)
    const pos = new Float32Array(n * 3)
    const nor = new Float32Array(n * 3)
    let o = 0
    for (const x of parts) {
      pos.set(x.getAttribute('position').array as Float32Array, o * 3)
      nor.set(x.getAttribute('normal').array as Float32Array, o * 3)
      o += x.getAttribute('position').count
    }
    merged.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    merged.setAttribute('normal', new THREE.BufferAttribute(nor, 3))
    return merged
  }, [r, rodLen])
  useEffect(() => () => {
    geo.dispose()
    rod?.dispose()
  }, [geo, rod])

  const mat = useMemo(() => {
    const k = `${core.rawClay.uuid}|${finish}`
    let m = matCache.get(k)
    if (!m) {
      // smooth burnished slip (no crack map): the room reads in its sheen and a rim of sky light
      m = new THREE.MeshStandardMaterial({ name: 'claySphere', color: new THREE.Color(f.color), vertexColors: true, roughness: f.rough, metalness: 0, envMapIntensity: 1.2, emissive: new THREE.Color('#ff9a5a'), emissiveMap: uplightRamp(), emissiveIntensity: 0.7 })
      m.onBeforeCompile = (shader) => {
        shader.fragmentShader = shader.fragmentShader.replace(
          '#include <emissivemap_fragment>',
          '#include <emissivemap_fragment>\n  float sphereRim = pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), 2.6);\n  totalEmissiveRadiance += vec3(1.0, 0.56, 0.46) * sphereRim * 0.9;',
        )
      }
      m.customProgramCacheKey = () => 'claySphereRim'
      injectAtmosphere(m)
      matCache.set(k, m)
    }
    return m
  }, [core.rawClay, finish, f])

  const spin = useRef<THREE.Mesh>(null)
  useFrame((_, dt) => {
    if (!spin.current || reduced || spinSec <= 0) return
    spin.current.rotation.y += ((Math.PI * 2) / spinSec) * Math.min(dt, 0.1)
  })

  return (
    <group name="clay-sphere">
      <mesh ref={spin} geometry={geo} material={mat} castShadow receiveShadow raycast={noRaycast} />
      {rod && <mesh geometry={rod} material={core.bronze} castShadow raycast={noRaycast} />}
    </group>
  )
}
