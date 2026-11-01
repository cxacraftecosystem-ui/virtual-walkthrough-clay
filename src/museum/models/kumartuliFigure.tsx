/**
 * 'kumartuli-figure' — a clay image in the making, as in the workshops of Kumartuli, Kolkata
 * (GRAND §4.2, §4.3; CRAFTS D5): a bamboo frame (kathamo) on a plank, straw bound on to it with
 * twine to give the body its bulk, then a first coat of coarse grey clay mixed with husk, and
 * last a fine coat of river clay. The figure is shown in progress, never finished: no face is
 * modelled and no eyes are painted (CRAFTS §2).
 *
 *   props {stage = frame | straw | first-coat | fine-coat, height = 2.6}
 *
 * 'first-coat' clothes the torso and the head only, ragged at its edge, and leaves the straw and
 * twine of the arms, shoulders, neck and skirt showing, the bamboo frame standing out of it; 'fine-coat' covers the whole figure, smoother and darker where still wet. Origin at the
 * plank's floor centre; the figure faces +z.
 */
import { useMemo } from 'react'
import * as THREE from 'three'
import { Builder, cyl, lathe, Parts, rbox, rng, type BuiltParts } from './kit'
import { tinted, useModelMaterials } from './modelMaterials'
import { num, str, type ModelProps } from './types'

type Stage = 'frame' | 'straw' | 'first-coat' | 'fine-coat'
const STAGES: Stage[] = ['frame', 'straw', 'first-coat', 'fine-coat']

/** A pole between two points. */
function pole(b: Builder, key: string, a: THREE.Vector3, c: THREE.Vector3, r: number) {
  const d = c.clone().sub(a)
  const len = d.length()
  const e = new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()))
  const mid = a.clone().add(c).multiplyScalar(0.5)
  b.add(key, cyl(r, r, len, 10), { p: [mid.x, mid.y, mid.z], r: [e.x, e.y, e.z] })
  // the bamboo's nodes
  const n = Math.max(1, Math.floor(len / 0.35))
  for (let i = 1; i < n; i++) {
    const p = a.clone().lerp(c, i / n)
    b.add(key, cyl(r * 1.18, r * 1.18, r * 0.6, 10), { p: [p.x, p.y, p.z], r: [e.x, e.y, e.z] })
  }
}

/** A capsule between two points (a straw bundle or a coat of clay over it). */
function capsule(b: Builder, key: string, a: THREE.Vector3, c: THREE.Vector3, r: number, rough = 0, seed = 1) {
  const d = c.clone().sub(a)
  const len = d.length()
  const g = new THREE.CapsuleGeometry(r, Math.max(0.001, len), 6, 16)
  if (rough > 0) lumpy(g, rough, seed)
  const e = new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()))
  const mid = a.clone().add(c).multiplyScalar(0.5)
  b.add(key, g, { p: [mid.x, mid.y, mid.z], r: [e.x, e.y, e.z] })
}

/** Push vertices along their normals by a smooth noise: hand-pressed clay, bunched straw. */
function lumpy(g: THREE.BufferGeometry, amp: number, seed: number) {
  const pos = g.getAttribute('position')
  const nor = g.getAttribute('normal')
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const y = pos.getY(i)
    const z = pos.getZ(i)
    const n = Math.sin(x * 23 + seed) * Math.sin(y * 19 + seed * 2) * Math.sin(z * 21 + seed * 3) + 0.5 * Math.sin(x * 51 + y * 47 + z * 43)
    pos.setXYZ(i, x + nor.getX(i) * n * amp, y + nor.getY(i) * n * amp, z + nor.getZ(i) * n * amp)
  }
  g.computeVertexNormals()
}

/** Twine lashings round a bundle. */
function lash(b: Builder, a: THREE.Vector3, c: THREE.Vector3, r: number, n: number) {
  const d = c.clone().sub(a).normalize()
  const e = new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), d))
  for (let i = 1; i <= n; i++) {
    const p = a.clone().lerp(c, i / (n + 1))
    b.add('twine', new THREE.TorusGeometry(r * 1.02, r * 0.05, 5, 20), { p: [p.x, p.y, p.z], r: [e.x, e.y, e.z] })
  }
}

const cache = new Map<string, BuiltParts>()

function build(H: number, stage: Stage): BuiltParts {
  const b = new Builder()
  const k = H / 2.6
  const V = (x: number, y: number, z = 0) => new THREE.Vector3(x * k, y * k, z * k)
  const straw = stage !== 'frame'
  const upperClay = stage === 'first-coat' || stage === 'fine-coat'
  const allClay = stage === 'fine-coat'
  const coat = allClay ? 'fine' : 'clay'
  const r = rng(`${H}|${stage}`)

  // the plank and the frame: a spine, shoulder and hip bars, arms, a back stay
  b.add('plank', rbox(1.2 * k, 0.1 * k, 0.86 * k, 0.01), { p: [0, 0.05 * k, 0] })
  b.add('plank', rbox(1.1 * k, 0.05 * k, 0.12 * k, 0.005), { p: [0, 0.125 * k, -0.3 * k] })
  pole(b, 'bamboo', V(0, 0.1, -0.12), V(0, 2.55, -0.08), 0.03 * k)
  pole(b, 'bamboo', V(-0.46, 1.86, -0.06), V(0.46, 1.86, -0.06), 0.022 * k)
  pole(b, 'bamboo', V(-0.28, 1.06, -0.06), V(0.28, 1.06, -0.06), 0.022 * k)
  // one arm raised (a gesture, not a deity's attribute), one lowered
  pole(b, 'bamboo', V(0.46, 1.86, -0.04), V(0.62, 2.38, 0.16), 0.018 * k)
  pole(b, 'bamboo', V(-0.46, 1.86, -0.04), V(-0.58, 1.26, 0.12), 0.018 * k)
  pole(b, 'bamboo', V(0, 0.1, -0.42), V(0, 1.9, -0.12), 0.02 * k)
  for (const sx of [-1, 1]) pole(b, 'bamboo', V(sx * 0.32, 0.1, 0), V(sx * 0.2, 1.06, -0.04), 0.018 * k)

  if (straw) {
    // the bulk in straw: a flared skirt, the torso, neck and head, the arms
    const skirt = lathe(
      [
        [0, 0.12],
        [0.46, 0.12],
        [0.44, 0.3],
        [0.36, 0.7],
        [0.28, 1.0],
        [0.24, 1.14],
        [0, 1.16],
      ].map(([rr, y]) => [rr * k, y * k] as [number, number]),
      26,
    )
    skirt.scale(1, 1, 0.78)
    lumpy(skirt, 0.012 * k, 3)
    b.add(upperClay && allClay ? coat : 'straw', skirt)
    if (!allClay) lash(b, V(0, 0.2, 0), V(0, 1.1, 0), 0.4 * k, 0)
    for (const y of [0.32, 0.56, 0.8, 1.02]) {
      const t = new THREE.TorusGeometry((0.44 - (y - 0.12) * 0.2) * k, 0.008 * k, 5, 30)
      t.rotateX(Math.PI / 2)
      t.scale(1, 1, 0.78)
      if (!allClay) b.add('twine', t, { p: [0, y * k, 0] })
    }
    const torsoA = V(0, 1.18, 0)
    const torsoB = V(0, 1.78, 0)
    const neck = V(0, 2.0, 0.02)
    const head = V(0, 2.2, 0.03)
    const armR = [V(0.46, 1.84, 0.02), V(0.6, 2.32, 0.18)] as const
    const armL = [V(-0.46, 1.84, 0.02), V(-0.56, 1.3, 0.14)] as const
    const parts: [THREE.Vector3, THREE.Vector3, number, boolean][] = [
      [torsoA, torsoB, 0.25 * k, true],
      [V(-0.4, 1.82, 0), V(0.4, 1.82, 0), 0.1 * k, true],
      [torsoB, neck, 0.075 * k, true],
      [armR[0], armR[1], 0.068 * k, true],
      [armL[0], armL[1], 0.068 * k, true],
    ]
    for (const [a, c, rr] of parts) {
      capsule(b, 'straw', a, c, rr, 0.01 * k, r() * 10)
      lash(b, a, c, rr, 3)
    }
    b.add('straw', new THREE.SphereGeometry(0.15 * k, 16, 12), { p: [head.x, head.y, head.z], s: [0.92, 1.12, 0.95] })
    if (upperClay) {
      // the coat: a little fuller than the straw, pressed on by hand, no face modelled. The first
      // coat is partial (the torso and the head only, its edge ragged): the arms, the shoulders
      // and the neck still show their straw and twine, the frame its bamboo
      const coated = allClay ? parts : parts.slice(0, 1)
      for (const [a, c, rr] of coated) capsule(b, coat, a, c, rr + (allClay ? 0.025 : 0.014) * k, allClay ? 0.004 * k : 0.016 * k, r() * 10)
      const hg = new THREE.SphereGeometry(0.175 * k, 24, 16)
      lumpy(hg, allClay ? 0.003 * k : 0.01 * k, 7)
      b.add(coat, hg, { p: [head.x, head.y, head.z], s: [0.9, 1.14, 0.95] })
      // a chest and a waist band in the first coat, the clay still ragged at its lower edge
      const waist = lathe(
        [
          [0.27, 1.06],
          [0.29, 1.18],
          [0.26, 1.24],
        ].map(([rr, y]) => [rr * k, y * k] as [number, number]),
        24,
      )
      waist.scale(1.04, 1, 0.82)
      lumpy(waist, 0.012 * k, 5)
      b.add(coat, waist)
    }
  }
  return b.build()
}

export function KumartuliFigure({ config }: ModelProps) {
  const m = useModelMaterials()
  const stageS = str(config, 'stage', 'first-coat')
  const stage: Stage = (STAGES as string[]).includes(stageS) ? (stageS as Stage) : 'first-coat'
  const H = num(config, 'height', config.height ?? 2.6)
  const parts = useMemo(() => {
    const key = `${H}|${stage}`
    let hit = cache.get(key)
    if (!hit) cache.set(key, (hit = build(H, stage)))
    return hit
  }, [H, stage])
  const mats = useMemo(
    () => ({
      plank: m.darkTimber,
      // desaturated, as the workshop is: pale dry straw, grey-green bamboo, dark twine
      bamboo: tinted(m.oak, '#a39672', { roughness: 0.6 }),
      straw: tinted(m.rope, '#b3a47e', { roughness: 1 }),
      twine: tinted(m.rope, '#4a3f33', { roughness: 1 }),
      // the first coat is grey, husky and drying pale; the fine coat darker, still wet
      clay: tinted(m.terracotta, '#9a958e', { roughness: 1 }),
      fine: tinted(m.terracotta, '#6f6a64', { roughness: 0.55, envMapIntensity: 0.8 }),
    }),
    [m],
  )
  return <Parts parts={parts} materials={mats} />
}
