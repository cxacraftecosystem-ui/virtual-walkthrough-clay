/**
 * 'lotus' — the red clay lotus on the pool's island under the oculus (PDF p07l; GRAND §3 #33,
 * §6.5 "the lotus opens and closes with the sun").
 *
 *   petals    `layers` rings of `petals` glazed petals, each a thick, cupped, pointed shell with
 *             fine veins and a glaze that pools deep red at the base and breaks pale on the rims.
 *             One instanced mesh per ring; the rings alternate by half a petal.
 *   heart     a flat-topped seed pod (ochre glaze, its seed sockets inlaid dark) in a crown of
 *             stamens, on a low clay calyx.
 *   water     no bud and no lily pads: the pool holds the sky and the lotus alone (p07l).
 *   bloom     'sun' opens the petals with the sun's elevation (closed below the horizon, wide
 *             open from about 30°), easing towards it, so a change of the day clock plays the
 *             bloom; 'open' / 'closed' hold it. Reduced motion snaps. The first full opening of
 *             a session fires the cue 'court:lotus' (the bloom chime).
 *
 * Origin: the island's top (the object stands at the court centre, y = the curb height).
 * Nothing here takes a pointer hit, so a click on the water still drops a ripple and a click on
 * the floor still walks the visitor; the object's own shell (interactive) opens its panel.
 * Draw calls: one per petal ring, plus the heart (≈ 3).
 */
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { MUSEUM } from '../config/museum'
import { injectAtmosphere } from '../lighting/atmosphere/inject'
import { sunState } from '../lighting/timeOfDayState'
import { fireCue } from '../spectacle/cues'
import { useMuseum } from '../state/store'
import { useSpectacle } from '../spectacle/settings'
import { withWaterMirror } from '../materials/waterShader'
import { POOL, poolMirror } from './waterRing'
import { rng } from './kit'
import { num, str, type ModelProps } from './types'

const noRaycast = () => null
const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

/* ------------------------------------------------------------------ */
/* geometry                                                            */
/* ------------------------------------------------------------------ */

/**
 * One petal: a thick shell, base at the origin, growing along +y, cupped towards +z (the
 * flower's heart), `len` long and `wid` wide. Vertex colour: glaze depth (dark at the base and
 * in the veins, pale on the rims and the tip).
 */
function petalGeometry(len: number, wid: number, cup: number, thick: number, segU: number, segV: number): THREE.BufferGeometry {
  const pos: number[] = []
  const col: number[] = []
  const idx: number[] = []
  // a broad spoon: narrow at the foot, widest at 0.6, a round (never pointed) tip
  const width = (v: number) => (v < 0.6 ? wid * (0.3 + 0.7 * Math.sin((Math.PI / 2) * smooth(0, 0.6, v))) : wid * Math.sqrt(Math.max(0, 1 - Math.pow((v - 0.6) / 0.4, 2))))
  const surf = (u: number, v: number, side: number): [number, number, number, number] => {
    const w = width(v)
    const x = u * w * 0.5
    const y = v * len
    // the cup across the petal, deepest a third of the way up; the tip lifts out a little
    let z = cup * (1 - u * u) * Math.sin(Math.PI * Math.min(1, v * 1.15)) - 0.06 * len * Math.pow(v, 3)
    // veins: shallow grooves running up the petal
    const vein = Math.pow(Math.abs(Math.cos(u * Math.PI * 4.5)), 6) * smooth(0.05, 0.4, v) * (1 - smooth(0.75, 1, v))
    z -= 0.0045 * vein * len
    z -= side * thick * (0.55 + 0.45 * (1 - v)) * (1 - 0.6 * u * u)
    // glaze: pools at the base and in the veins, breaks pale on the rims and the tip
    const g = 0.62 + 0.38 * smooth(0, 0.55, v) + 0.25 * Math.pow(Math.abs(u), 3) + 0.18 * smooth(0.82, 1, v) - 0.2 * vein
    return [x, y, z, g]
  }
  const grid = (side: number) => {
    const base = pos.length / 3
    for (let j = 0; j <= segV; j++) {
      const v = j / segV
      for (let i = 0; i <= segU; i++) {
        const u = -1 + (2 * i) / segU
        const [x, y, z, g] = surf(u, v, side)
        pos.push(x, y, z)
        col.push(g, g, g)
      }
    }
    for (let j = 0; j < segV; j++)
      for (let i = 0; i < segU; i++) {
        const a = base + j * (segU + 1) + i
        const b = a + segU + 1
        if (side === 0) idx.push(a, a + 1, b, a + 1, b + 1, b)
        else idx.push(a, b, a + 1, a + 1, b, b + 1)
      }
    return base
  }
  const f = grid(0)
  const k = grid(1)
  // the rim: join the two shells along both edges
  const row = segU + 1
  for (let j = 0; j < segV; j++) {
    for (const i of [0, segU]) {
      const a = f + j * row + i
      const b = f + (j + 1) * row + i
      const c = k + j * row + i
      const d = k + (j + 1) * row + i
      if (i === 0) idx.push(a, b, c, c, b, d)
      else idx.push(a, c, b, c, d, b)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

/** A lathe with metre uvs and a vertex colour per profile point. */
function latheC(profile: [number, number, number][], seg: number) {
  const g = new THREE.LatheGeometry(
    profile.map(([r, y]) => new THREE.Vector2(Math.max(1e-4, r), y)),
    seg,
  )
  const n = g.getAttribute('position').count
  const c = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) {
    const p = profile[i % profile.length][2]
    c[i * 3] = c[i * 3 + 1] = c[i * 3 + 2] = p
  }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3))
  return g
}

/** The heart: calyx, seed pod with inlaid sockets, and a crown of stamens (one geometry). */
function heartGeometry(R: number, seg: number): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = []
  const pod = R * 0.3
  // calyx: a low clay bowl the petals spring from
  parts.push(latheC([[0, 0, 0.5], [R * 0.2, 0, 0.5], [R * 0.24, R * 0.05, 0.55], [R * 0.2, R * 0.12, 0.6], [R * 0.12, R * 0.14, 0.6]], seg))
  // seed pod: an inverted cone, its flat top raised a little
  const h0 = R * 0.12
  const h1 = R * 0.34
  parts.push(latheC([[R * 0.08, h0, 0.85], [pod * 0.62, h0 + (h1 - h0) * 0.45, 0.95], [pod * 0.96, h1 - 0.02, 1], [pod, h1, 1.05], [pod * 0.97, h1 + 0.012, 1.1], [0, h1 + 0.03, 1.1]], seg))
  // seed sockets: small dark discs on the top, in two rings and a centre
  const sockets: [number, number][] = [[0, 0]]
  for (const [rr, n] of [[0.42, 7], [0.78, 13]] as const) for (let i = 0; i < n; i++) sockets.push([pod * rr * Math.cos((i / n) * Math.PI * 2), pod * rr * Math.sin((i / n) * Math.PI * 2)])
  for (const [x, z] of sockets) {
    const d = new THREE.CircleGeometry(pod * 0.085, 10)
    d.rotateX(-Math.PI / 2)
    d.translate(x, h1 + 0.031 - (Math.hypot(x, z) / pod) * 0.02 + 0.002, z)
    const n = d.getAttribute('position').count
    d.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3).fill(0.18), 3))
    d.deleteAttribute('uv')
    parts.push(d)
  }
  // stamens: slender filaments leaning out from under the pod, each tipped with an anther
  const r = rng('lotus-stamens')
  const nSt = 56
  for (let i = 0; i < nSt; i++) {
    const a = (i / nSt) * Math.PI * 2 + r() * 0.05
    const lean = 0.35 + r() * 0.25
    const L = R * (0.17 + r() * 0.05)
    const fil = new THREE.CylinderGeometry(0.006, 0.009, L, 4, 1, true)
    fil.translate(0, L / 2, 0)
    const tip = new THREE.CylinderGeometry(0.012, 0.012, L * 0.22, 5)
    tip.translate(0, L * 1.06, 0)
    for (const g of [fil, tip]) {
      g.rotateZ(-lean)
      g.rotateY(-a)
      g.translate(Math.cos(a) * pod * 0.75, h0 + R * 0.02, Math.sin(a) * pod * 0.75)
      const n = g.getAttribute('position').count
      g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3).fill(g === tip ? 1.15 : 0.95), 3))
      g.deleteAttribute('uv')
      parts.push(g)
    }
  }
  for (const p of parts) if (p.getAttribute('uv')) p.deleteAttribute('uv')
  const nonIdx = parts.map((p) => (p.index ? p.toNonIndexed() : p))
  return mergeSimple(nonIdx)
}

/** Merge non-indexed geometries with position, normal (kept smooth) and a grey colour. */
function mergeSimple(list: THREE.BufferGeometry[]): THREE.BufferGeometry {
  let n = 0
  for (const g of list) n += g.getAttribute('position').count
  const pos = new Float32Array(n * 3)
  const nor = new Float32Array(n * 3)
  const col = new Float32Array(n * 3)
  let o = 0
  for (const g of list) {
    if (!g.getAttribute('normal')) g.computeVertexNormals()
    const p = g.getAttribute('position')
    const nn = g.getAttribute('normal')
    const c = g.getAttribute('color')
    for (let i = 0; i < p.count; i++) {
      const k = (o + i) * 3
      pos[k] = p.getX(i)
      pos[k + 1] = p.getY(i)
      pos[k + 2] = p.getZ(i)
      nor[k] = nn.getX(i)
      nor[k + 1] = nn.getY(i)
      nor[k + 2] = nn.getZ(i)
      const v = c ? c.getX(i) : 1
      col[k] = col[k + 1] = col[k + 2] = v
    }
    o += p.count
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3))
  g.setAttribute('color', new THREE.BufferAttribute(col, 3))
  return g
}

/* ------------------------------------------------------------------ */
/* materials                                                           */
/* ------------------------------------------------------------------ */

const matCache = new Map<string, THREE.MeshStandardMaterial>()

/**
 * Glazed clay: a glossy standard material (a physical clearcoat would add a second specular lobe
 * to every accent cone of the light engine and stall the shader compile on D3D).
 */
function glaze(key: string, color: string, tier: string, o: { rough?: number } = {}): THREE.MeshStandardMaterial {
  const k = `${key}|${color}|${tier === 'low' ? 'lo' : 'hi'}`
  const hit = matCache.get(k)
  if (hit) return hit
  const m = new THREE.MeshStandardMaterial({ name: `lotus-${key}`, color: new THREE.Color(color), vertexColors: true, roughness: o.rough ?? 0.26, metalness: 0, envMapIntensity: tier === 'low' ? 0.9 : 1.25 })
  injectAtmosphere(m)
  matCache.set(k, m)
  return m
}

/** The petals as the pool holds them (High / Ultra): the glaze, drawn mirrored onto the water. */
function mirrorGlaze(color: string, tier: string): THREE.MeshStandardMaterial {
  const k = `mirror|${color}|${tier === 'low' ? 'lo' : 'hi'}`
  const hit = matCache.get(k)
  if (hit) return hit
  // a dark, faint reflection (the pool is dark water, not a mirror): darker than the glaze, a
  // third opaque, clipped to the water's annulus by withWaterMirror
  const m = new THREE.MeshStandardMaterial({ name: 'lotus-petal-mirror', color: new THREE.Color(color).multiplyScalar(0.5), vertexColors: true, roughness: 0.3, metalness: 0, envMapIntensity: 0.6 })
  injectAtmosphere(m)
  withWaterMirror(m, { level: POOL.level, r0: POOL.r0, r1: POOL.r1 }, 0.3)
  matCache.set(k, m)
  return m
}

/* ------------------------------------------------------------------ */
/* the kind                                                            */
/* ------------------------------------------------------------------ */

/** The first full opening this session has been announced. */
const BLOOMED = { done: false }

/** How open the lotus wants to be (0 closed … 1 wide open) for the bloom mode. */
function bloomTarget(mode: string): number {
  if (mode === 'open') return 1
  if (mode === 'closed') return 0
  return smooth(-1.5, 30, sunState.elevationDeg)
}

interface Ring {
  n: number
  len: number
  /** Tilt from vertical (rad): closed, open. */
  tilt: [number, number]
  /** Radius of the petals' feet. */
  foot: number
  phase: number
}

const _m = new THREE.Matrix4()
const _q = new THREE.Quaternion()
const _lean = new THREE.Quaternion()
const _p = new THREE.Vector3()
const _s = new THREE.Vector3(1, 1, 1)
const Y_AXIS = new THREE.Vector3(0, 1, 0)
const X_AXIS = new THREE.Vector3(1, 0, 0)

export function Lotus({ config }: ModelProps) {
  const tier = useMuseum((s) => s.tier)
  const reduced = useMuseum((s) => s.reducedMotion)
  const sp = useSpectacle()
  const R = Math.max(0.3, num(config, 'r', 1.6))
  const petals = Math.round(Math.min(40, Math.max(5, num(config, 'petals', 16))))
  const layers = Math.round(Math.min(4, Math.max(1, num(config, 'layers', 2))))
  const color = str(config, 'color', '#b3261e')
  const bloom = str(config, 'bloom', 'sun')
  const lo = tier === 'low'

  const rings = useMemo<Ring[]>(
    () =>
      Array.from({ length: layers }, (_, i) => {
        const k = layers === 1 ? 0 : i / (layers - 1)
        return {
          n: petals,
          len: R * (0.98 - 0.3 * k),
          tilt: [0.28 - 0.18 * k, 1.28 - 0.62 * k] as [number, number],
          foot: R * (0.2 - 0.07 * k),
          phase: (i % 2) * 0.5,
        }
      }).reverse(),
    [layers, petals, R],
  )
  const geos = useMemo(
    // broad rounded petals, about 0.6 as wide as long (p07l), deeply cupped
    () => rings.map((rg) => petalGeometry(rg.len, Math.min(rg.len * 0.62, ((2 * Math.PI * (rg.foot + rg.len * 0.42)) / rg.n) * 1.55), rg.len * 0.2, Math.max(0.012, rg.len * 0.016), lo ? 10 : 16, lo ? 12 : 24)),
    [rings, lo],
  )
  const heart = useMemo(() => heartGeometry(R, lo ? 20 : 40), [R, lo])
  useEffect(() => () => [...geos, heart].forEach((g) => g.dispose()), [geos, heart])

  const petalMat = useMemo(() => glaze('petal', color, tier), [color, tier])
  const heartMat = useMemo(() => glaze('heart', '#d39a3a', tier, { rough: 0.45 }), [tier])

  const refs = useRef<(THREE.InstancedMesh | null)[]>([])
  // the bloom mirrored in the still water round the island (High / Ultra)
  const mirror = poolMirror() && !lo
  const mirrorMat = useMemo(() => (mirror ? mirrorGlaze(color, tier) : null), [mirror, color, tier])
  const mirrorRefs = useRef<(THREE.InstancedMesh | null)[]>([])
  const st = useRef({ open: -1, shown: -1 })

  const place = (open: number) => {
    rings.forEach((rg, li) => {
      const mesh = refs.current[li]
      if (!mesh) return
      const tilt = rg.tilt[0] + (rg.tilt[1] - rg.tilt[0]) * open
      for (let i = 0; i < rg.n; i++) {
        const a = ((i + rg.phase) / rg.n) * Math.PI * 2 + li * 0.07
        // each petal a touch different: the clay was shaped by hand
        const jitter = Math.sin(i * 12.9898 + li * 4.1) * 0.04
        _p.set(Math.cos(a) * rg.foot, R * 0.08, Math.sin(a) * rg.foot)
        // face the petal's cup to the heart, then lean it out by the tilt
        _q.setFromAxisAngle(Y_AXIS, -a - Math.PI / 2)
        _q.multiply(_lean.setFromAxisAngle(X_AXIS, -(tilt + jitter)))
        _s.setScalar(1 + jitter * 0.6)
        _m.compose(_p, _q, _s)
        mesh.setMatrixAt(i, _m)
        mirrorRefs.current[li]?.setMatrixAt(i, _m)
      }
      mesh.instanceMatrix.needsUpdate = true
      mesh.computeBoundingSphere()
      const mm = mirrorRefs.current[li]
      if (mm) {
        mm.instanceMatrix.needsUpdate = true
        mm.computeBoundingSphere()
      }
    })
  }

  useFrame((_, dt) => {
    const target = bloomTarget(bloom)
    const s = st.current
    if (s.open < 0 || reduced || sp.mode === 'still') s.open = target
    else s.open += (target - s.open) * Math.min(1, Math.min(dt, 0.1) * 1.2)
    if (Math.abs(s.open - s.shown) > 1e-4) {
      place(s.open)
      s.shown = s.open
    }
    if (!BLOOMED.done && s.open > 0.92 && bloom === 'sun') {
      BLOOMED.done = true
      fireCue('court:lotus', { source: 'system' })
    }
  })
  // place once the meshes exist (the first frame also does, this covers a paused loop)
  useEffect(() => {
    place(Math.max(0, st.current.open < 0 ? bloomTarget(bloom) : st.current.open))
    st.current.shown = -1
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rings, geos, mirrorMat])

  return (
    <group name="lotus">
      {rings.map((rg, i) => (
        <instancedMesh
          key={`${i}-${rg.n}-${geos[i].uuid}`}
          ref={(m) => {
            refs.current[i] = m
          }}
          args={[geos[i], petalMat, rg.n]}
          castShadow
          receiveShadow
          raycast={noRaycast}
        />
      ))}
      <mesh geometry={heart} material={heartMat} castShadow receiveShadow raycast={noRaycast} />
      {mirrorMat && (
        // mirrored about the water plane (local: the object stands on the water, MUSEUM.oculus.poolLevel)
        <group position={[0, 2 * (POOL.level - MUSEUM.oculus.poolLevel), 0]} scale={[1, -1, 1]}>
          {rings.map((rg, i) => (
            <instancedMesh
              key={`m${i}-${rg.n}-${geos[i].uuid}`}
              ref={(m) => {
                mirrorRefs.current[i] = m
              }}
              args={[geos[i], mirrorMat, rg.n]}
              frustumCulled={false}
              raycast={noRaycast}
            />
          ))}
        </group>
      )}
    </group>
  )
}
