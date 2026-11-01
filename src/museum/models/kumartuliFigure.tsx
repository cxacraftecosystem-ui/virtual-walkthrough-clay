/**
 * 'kumartuli-figure' — a clay image in the making, as in the workshops of Kumartuli, Kolkata
 * (GRAND §4.2, §4.3; CRAFTS D5): a bamboo frame (kathamo) on a plank, straw bound on to it with
 * jute twine to give the body its bulk, then a first coat of coarse grey clay mixed with husk, and
 * last a fine coat of river clay. The figure is shown in progress, never finished: no face is
 * modelled and no eyes are painted (CRAFTS §2).
 *
 *   props {stage = frame | straw | first-coat | fine-coat, height = 2.6}
 *
 * The figure is sculpted as one body (models/sculpt.ts), not stacked capsules: a pleated sari
 * flaring to its hem, hips, a narrow waist, the chest and shoulders, a long neck, an egg-shaped
 * head with its hair gathered at the nape, one arm raised and one lowered, elbows and wrists
 * turned. In straw every form is a ribbed bundle tied with twine, loose straws standing out at
 * the hem and the hands. 'first-coat' presses grey clay over the head, neck, torso, upper arms
 * and the top of the skirt, ragged at its edge, thumb-pressed and husky, the straw still showing
 * below; 'fine-coat' covers the whole figure, smoother and darker where still wet. Origin at the
 * plank's floor centre; the figure faces +z.
 */
import { useMemo } from 'react'
import * as THREE from 'three'
import { Builder, cyl, lathe, Parts, rbox, rng, tube, type BuiltParts } from './kit'
import { tinted, useModelMaterials } from './modelMaterials'
import { fbm, keyedLoft, Loft, noise3, sculptDetailFor, sculptEllipsoid, between, withSculptDetail } from './sculpt'
import { useMuseum } from '../state/store'
import { num, str, type ModelProps } from './types'

type Stage = 'frame' | 'straw' | 'first-coat' | 'fine-coat'
const STAGES: Stage[] = ['frame', 'straw', 'first-coat', 'fine-coat']

/** A bamboo pole between two points, with its nodes. */
function pole(b: Builder, a: THREE.Vector3, c: THREE.Vector3, r: number) {
  const { p, r: rot, len } = between(a, c)
  b.add('bamboo', cyl(r, r * 1.04, len, 12), { p, r: rot })
  const n = Math.max(1, Math.floor(len / (r * 14)))
  const node = lathe(
    [
      [r * 0.98, -r * 0.5],
      [r * 1.16, -r * 0.12],
      [r * 1.2, 0],
      [r * 1.16, r * 0.12],
      [r * 0.98, r * 0.5],
    ],
    12,
  )
  for (let i = 1; i < n; i++) {
    const q = a.clone().lerp(c, i / n)
    b.add('bamboo', node, { p: [q.x, q.y, q.z], r: rot })
  }
}

/** Straw: lengthwise ribs of bundled stalks, twisted a little, lumpy where the bundles are packed. */
function strawRibs(ribs: number, amp: number, twist: number, seed: number) {
  return (t: number, a: number, p: THREE.Vector3) => {
    const rib = Math.abs(Math.sin(a * ribs * 0.5 + t * twist + noise3(p.x * 9, p.y * 9, seed) * 1.4))
    return amp * (0.75 * rib - 0.4) + amp * 0.9 * fbm(p.x * 14 + seed, p.y * 6, p.z * 14, 2)
  }
}

/** Straw's colour: stalks paler and darker along the bundle, greyer where it has weathered. */
const STALK = [new THREE.Color('#e3c98c'), new THREE.Color('#b8955a'), new THREE.Color('#8f7650')]
function stalks(t: number, a: number, p: THREE.Vector3) {
  const n = 0.5 + 0.5 * noise3(Math.cos(a) * 18 + t * 3, Math.sin(a) * 18, p.y * 4)
  const c = STALK[1].clone().lerp(n > 0.5 ? STALK[0] : STALK[2], Math.abs(n - 0.5) * 1.6)
  return c
}

/** Hand-pressed clay: broad lumps, thumb dimples, a husky grain. */
function pressed(amp: number, seed: number) {
  return (_t: number, _a: number, p: THREE.Vector3) => {
    const lumps = fbm(p.x * 7 + seed, p.y * 7, p.z * 7, 3)
    const dimple = Math.min(0, noise3(p.x * 26 + seed, p.y * 22, p.z * 26) + 0.35) * 0.9
    return amp * (lumps + dimple)
  }
}

/** Twine lashed round a loft at t. */
function lashing(b: Builder, loft: Loft, t: number, r: number, turns = 2) {
  for (let i = 0; i < turns; i++) {
    const ring = loft.ring(t + i * 0.008, r * 1.2, 40)
    b.add('twine', tube(ring, r, 44, 4))
  }
}

const cache = new Map<string, BuiltParts>()

function build(H: number, stage: Stage): BuiltParts {
  const b = new Builder()
  const k = H / 2.6
  const V = (x: number, y: number, z = 0) => new THREE.Vector3(x * k, y * k, z * k)
  const straw = stage !== 'frame'
  const coated = stage === 'first-coat' || stage === 'fine-coat'
  const fine = stage === 'fine-coat'
  const coat = fine ? 'fine' : 'clay'
  const r = rng(`${H}|${stage}`)
  const tw = 0.0045 * k // twine radius

  // ── the plank on two runners, and the bamboo frame: spine, shoulder and hip bars, the arms' canes, a back stay
  b.add('plank', rbox(1.2 * k, 0.07 * k, 0.86 * k, 0.008 * k, 2, 'x'), { p: [0, 0.075 * k, 0] })
  for (const sz of [-1, 1]) b.add('plank', rbox(1.2 * k, 0.04 * k, 0.09 * k, 0.006 * k, 2, 'x'), { p: [0, 0.02 * k, sz * 0.32 * k] })
  pole(b, V(0, 0.11, -0.1), V(0, 2.55, -0.06), 0.028 * k)
  pole(b, V(-0.4, 1.78, -0.05), V(0.4, 1.78, -0.05), 0.02 * k)
  pole(b, V(-0.3, 1.02, -0.05), V(0.3, 1.02, -0.05), 0.02 * k)
  pole(b, V(0, 0.11, -0.42), V(0, 1.9, -0.11), 0.02 * k)
  for (const sx of [-1, 1]) pole(b, V(sx * 0.34, 0.11, 0.02), V(sx * 0.2, 1.02, -0.04), 0.017 * k)
  // the arms' canes run out through the straw and stand proud of the hands
  const armR = [V(0.22, 1.75, -0.01), V(0.36, 1.88, 0.05), V(0.43, 2.0, 0.12), V(0.48, 2.14, 0.18), V(0.51, 2.26, 0.22), V(0.53, 2.33, 0.25), V(0.54, 2.4, 0.27)]
  const armL = [V(-0.22, 1.75, -0.01), V(-0.33, 1.62, 0.02), V(-0.37, 1.47, 0.07), V(-0.39, 1.35, 0.12), V(-0.405, 1.25, 0.16), V(-0.41, 1.19, 0.185), V(-0.41, 1.11, 0.2)]
  pole(b, armR[0].clone().add(V(0, 0, -0.03)), armR[6].clone().add(V(0.01, 0.1, 0.02)), 0.012 * k)
  pole(b, armL[0].clone().add(V(0, 0, -0.03)), armL[6].clone().add(V(0, -0.09, 0.01)), 0.012 * k)
  if (!straw) return b.build()

  // ── the forms ────────────────────────────────────────────────────────────
  const PI = Math.PI
  // skirt: a sari falling from the hips, flaring to the hem, pleats fanned at the front (a = π)
  const skirt = keyedLoft(
    [V(0, 0.12, 0.02), V(0, 0.36, 0.015), V(0, 0.66, 0.01), V(0, 0.9, 0), V(0, 1.08, 0)],
    (
      [
        [0.4, 0.5],
        [0.355, 0.45],
        [0.295, 0.385],
        [0.225, 0.315],
        [0.19, 0.285],
      ] as [number, number][]
    ).map(([u, s]) => [u * k, s * k] as [number, number]),
    {
      shape: (t, a) => {
        const low = (1 - t) * (1 - t)
        const front = Math.exp(-(((a - PI) / 0.42) ** 2))
        const pleats = front * Math.sin((a - PI) * 30) * 0.028 * (0.25 + low)
        const folds = Math.sin(a * 6 + 1.3 + t * 1.5) * 0.022 * low + Math.sin(a * 11 + 0.4) * 0.01 * low
        // the pleat fan stands out a little at the front, falling straight
        return 1 + pleats + folds + front * 0.05 * low
      },
    },
  )
  // torso: hips, waist, ribs, chest, shoulders, and on up the neck
  const torso = keyedLoft(
    [V(0, 0.98, 0), V(0, 1.2, 0.005), V(0, 1.4, 0.012), V(0, 1.56, 0.02), V(0, 1.7, 0.005), V(0, 1.8, 0), V(0, 1.9, 0.02), V(0, 2.04, 0.03)],
    (
      [
        [0.195, 0.285],
        [0.14, 0.2],
        [0.15, 0.215],
        [0.165, 0.235],
        [0.135, 0.275],
        [0.105, 0.21],
        [0.066, 0.085],
        [0.058, 0.06],
      ] as [number, number][]
    ).map(([u, s]) => [u * k, s * k] as [number, number]),
    {
      shape: (t, a) => {
        // the chest's two volumes at the front, the spine's furrow at the back (a = 0)
        const chest = Math.exp(-(((t - 0.43) / 0.11) ** 2)) * (Math.exp(-(((a - (PI - 0.5)) / 0.32) ** 2)) + Math.exp(-(((a - (PI + 0.5)) / 0.32) ** 2)))
        const furrow = Math.exp(-((a / 0.22) ** 2)) * Math.exp(-(((t - 0.35) / 0.25) ** 2))
        return 1 + 0.13 * chest - 0.05 * furrow
      },
    },
  )
  const arm = (pts: THREE.Vector3[]) =>
    keyedLoft(
      pts,
      (
        [
          [0.088, 0.09],
          [0.064, 0.066],
          [0.048, 0.05],
          [0.05, 0.054],
          [0.032, 0.042],
          [0.02, 0.05],
          [0.012, 0.034],
        ] as [number, number][]
      ).map(([u, s]) => [u * k, s * k] as [number, number]),
      { side: new THREE.Vector3(0, 0, 1) },
    )
  const arms = [arm(armR), arm(armL)]
  // (a full head on a long neck, its crown and back of the skull rounded out, so the figure reads as
  // an image in the making, never a headless dress-form)
  const head = { c: V(0, 2.19, 0.03), rx: 0.115 * k, ry: 0.15 * k, rz: 0.128 * k }
  // the head: an egg, narrowing to the chin, the face a flat plane, hair gathered at the nape
  const headDisp = (amp: number) => (d: THREE.Vector3) => {
    const chin = d.y < -0.2 ? (d.y + 0.2) * 0.25 * (Math.abs(d.x) + 0.2) : 0
    const facePlane = d.z > 0.55 ? -(d.z - 0.55) * 0.18 : 0
    return (chin + facePlane) * head.ry + amp * fbm(d.x * 3, d.y * 3, d.z * 3, 2)
  }

  // ── straw: everything bundled and tied ───────────────────────────────────
  b.add('straw', skirt.loft.geometry({ rows: 56, cols: 120, displace: strawRibs(44, 0.011 * k, 2, 1), color: stalks }))
  b.add('straw', torso.loft.geometry({ rows: 60, cols: 80, displace: strawRibs(30, 0.009 * k, 3, 2), capEnd: true, color: stalks }))
  for (const [i, a] of arms.entries()) b.add('straw', a.loft.geometry({ rows: 44, cols: 36, displace: strawRibs(12, 0.007 * k, 2, 3 + i), capStart: true, capEnd: true, color: stalks }))
  b.add('strawHead', sculptEllipsoid(head.rx * 0.92, head.ry * 0.94, head.rz * 0.92, (d) => headDisp(0.004 * k)(d) + 0.004 * k * Math.abs(Math.sin(Math.atan2(d.x, d.z) * 9 + d.y * 3)), 40, 28), {
    p: [head.c.x, head.c.y, head.c.z],
  })
  // the hair: a heavy mass of jute over the crown and down the back of the head, gathered into a
  // bun at the nape (the image's hair is jute, fixed before the clay; the face stays unmodelled)
  b.add('twine', sculptEllipsoid(head.rx * 1.06, head.ry * 0.78, head.rz * 0.98, (d) => (d.z > 0.35 ? -0.5 * (d.z - 0.35) * head.rz : 0) + 0.006 * k * Math.abs(Math.sin(Math.atan2(d.x, d.y) * 22)), 40, 28), {
    p: [head.c.x, head.c.y + head.ry * 0.3, head.c.z - head.rz * 0.12],
  })
  b.add('twine', sculptEllipsoid(0.085 * k, 0.075 * k, 0.07 * k, (d) => 0.006 * k * Math.abs(Math.sin(Math.atan2(d.x, d.y) * 14 + d.z * 4))), { p: [0, head.c.y - 0.06 * k, head.c.z - head.rz - 0.03 * k], r: [0.4, 0, 0] })
  // twine: bands round the skirt, the waist, the chest, and three lashings on each limb
  if (!fine) {
    for (const t of [0.12, 0.34, 0.56, 0.78, 0.95]) lashing(b, skirt.loft, t, tw, 2)
    for (const t of [0.1, 0.3, 0.62]) lashing(b, torso.loft, t, tw, 2)
    for (const a of arms) for (const t of [0.12, 0.42, 0.72]) lashing(b, a.loft, t, tw * 0.8, 3)
  }
  // loose straws: standing out of the hem, the shoulders' ends and the hands
  const strands = (from: THREE.Vector3, dir: THREE.Vector3, len: number, n: number, spread: number) => {
    for (let i = 0; i < n; i++) {
      const d = dir
        .clone()
        .add(new THREE.Vector3((r() - 0.5) * spread, (r() - 0.5) * spread, (r() - 0.5) * spread))
        .normalize()
      const L = len * (0.5 + r() * 0.7)
      const s = from.clone().add(new THREE.Vector3((r() - 0.5) * 0.03 * k, (r() - 0.5) * 0.03 * k, (r() - 0.5) * 0.03 * k))
      const m = s.clone().addScaledVector(d, L * 0.5).add(new THREE.Vector3(0, -L * 0.06, 0))
      const e = s.clone().addScaledVector(d, L)
      e.y -= L * 0.12
      b.add('strawLoose', tube(new THREE.CatmullRomCurve3([s, m, e]), 0.0018 * k, 6, 3))
    }
  }
  if (!fine) {
    for (let i = 0; i < 46; i++) {
      const a = (i / 46) * PI * 2 + r() * 0.1
      const p = skirt.loft.point(0.03, a, 0)
      const out = skirt.loft.outward(0.03, a)
      strands(p, out.add(new THREE.Vector3(0, -0.25, 0)), 0.09 * k, 1, 0.5)
    }
    for (const a of arms) {
      const tip = a.loft.point(1, 0)
      const dir = a.loft.frame(1).T
      strands(tip, dir, 0.11 * k, 14, 0.9)
    }
  }

  if (coated) {
    // ── clay: pressed on over the straw ─────────────────────────────────────
    const amp = fine ? 0.0016 * k : 0.0055 * k
    const off = fine ? 0.017 * k : 0.012 * k
    // the first coat stops raggedly: on the skirt below the hips, on the arms at the elbows
    const edgeSkirt = (a: number, p: THREE.Vector3) => 0.66 + 0.07 * noise3(Math.cos(a) * 2.2, Math.sin(a) * 2.2, 3) + 0.03 * noise3(p.x * 30, p.y * 30, p.z * 30)
    // past its edge the coat thins and dives under the straw: a soft, torn edge, not a cut
    const dive = (past: number) => (off + 0.028 * k) * THREE.MathUtils.smoothstep(past, -0.004, 0.03)
    const edgeArm = (a: number, p: THREE.Vector3) => 0.4 + 0.08 * noise3(Math.cos(a) * 1.6, Math.sin(a) * 1.6, 9) + 0.03 * noise3(p.x * 30, p.y * 30, p.z * 30)
    b.add(
      coat,
      skirt.loft.geometry({
        rows: 56,
        cols: 120,
        offset: off,
        displace: fine ? pressed(amp, 4) : (t, a, p) => pressed(amp, 4)(t, a, p) - dive(edgeSkirt(a, p) - t),
      }),
    )
    b.add(coat, torso.loft.geometry({ rows: 60, cols: 80, offset: off, displace: pressed(amp, 5), capEnd: true }))
    for (const [i, a] of arms.entries())
      b.add(
        coat,
        a.loft.geometry({
          rows: 44,
          cols: 36,
          offset: off * 0.8,
          displace: fine ? pressed(amp * 0.8, 6 + i) : (t, an, p) => pressed(amp * 0.8, 6 + i)(t, an, p) - dive(t - edgeArm(an, p)),
          capStart: true,
          capEnd: fine,
        }),
      )
    b.add(coat, sculptEllipsoid(head.rx, head.ry, head.rz, (d) => headDisp(amp)(d), 48, 32), { p: [head.c.x, head.c.y, head.c.z] })
    // the hair gathered at the nape, a coil of clay
    b.add(coat, sculptEllipsoid(0.075 * k, 0.065 * k, 0.06 * k, (d) => amp * fbm(d.x * 4, d.y * 4, d.z * 4)), { p: [0, 2.12 * k, -0.08 * k], r: [0.4, 0, 0] })
  }
  return b.build()
}

export function KumartuliFigure({ config }: ModelProps) {
  const m = useModelMaterials()
  const stageS = str(config, 'stage', 'first-coat')
  const stage: Stage = (STAGES as string[]).includes(stageS) ? (stageS as Stage) : 'first-coat'
  const H = num(config, 'height', config.height ?? 2.6)
  // tessellation by tier (sculpt.ts): the form is the same, the facets fewer
  const d = sculptDetailFor(useMuseum((s) => s.tier))
  const parts = useMemo(() => {
    const key = `${H}|${stage}|${d}`
    let hit = cache.get(key)
    if (!hit) cache.set(key, (hit = withSculptDetail(d, () => build(H, stage))))
    return hit
  }, [H, stage, d])
  const mats = useMemo(
    () => ({
      plank: m.darkTimber,
      // seasoned bamboo, dry paddy straw, dark jute twine
      bamboo: tinted(m.oak, '#b39e6e', { roughness: 0.55 }),
      straw: tinted(m.rope, '#ffffff', { roughness: 0.95, normalScale: new THREE.Vector2(1.6, 1.6), vertexColors: true }),
      strawHead: tinted(m.rope, '#bfa268', { roughness: 0.95, normalScale: new THREE.Vector2(1.6, 1.6) }),
      strawLoose: tinted(m.rope, '#cdb27a', { roughness: 0.9 }),
      twine: tinted(m.rope, '#5a4632', { roughness: 1 }),
      // the first coat is grey, husky and drying pale at its edges; the fine coat darker, still wet
      clay: tinted(m.terracotta, '#8f8b84', { roughness: 0.97, normalScale: new THREE.Vector2(2.2, 2.2), envMapIntensity: 0.4 }),
      fine: tinted(m.terracotta, '#6c6761', { roughness: 0.5, normalScale: new THREE.Vector2(0.6, 0.6), envMapIntensity: 0.85 }),
    }),
    [m],
  )
  return <Parts parts={parts} materials={mats} />
}
