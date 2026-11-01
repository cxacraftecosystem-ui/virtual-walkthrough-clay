/**
 * 'ayyanar-horse' — a guardian horse of the kind that stands outside village shrines in Tamil
 * Nadu (GRAND §4.2, §4.3; CRAFTS D15): a hollow build of thrown and coiled sections, tall on
 * four column legs, the neck rising almost straight from a deep chest, the face long, the eyes
 * wide. It wears its trappings in clay: bridle, garlands of beads, a breast band of bells, a
 * saddle cloth with a bordered hem. Firing vents open on the flanks and belly. Limewash over
 * the red body, weathered by monsoons (paint 'weathered'); 'white' is fresh limewash, 'red' the
 * bare fired body.
 *
 *   props {height = 4.2, paint = weathered | white | red, seed}
 *
 * Shown outdoors as a guardian, with no offerings and nothing ritual (CRAFTS §2). Origin at
 * the plinth's floor centre; the horse faces +z. ≈ 9k triangles.
 */
import { useMemo } from 'react'
import * as THREE from 'three'
import { Builder, cyl, lathe, Parts, rbox, rng, type BuiltParts } from './kit'
import { tinted, useModelMaterials, type ModelMaterials } from './modelMaterials'
import { num, str, type ModelProps } from './types'

type Paint = 'weathered' | 'white' | 'red'

/** A tapered limb or neck: overlapping thrown sections along a curve (radius r0 → r1). */
function sections(b: Builder, key: string, curve: THREE.Curve<THREE.Vector3>, r0: number, r1: number, n: number, radial = 20) {
  const up = new THREE.Vector3(0, 1, 0)
  const len = curve.getLength()
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n
    const p = curve.getPointAt(t)
    const d = curve.getTangentAt(t)
    const r = r0 + (r1 - r0) * t
    const e = new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(up, d))
    b.add(key, cyl(r * 0.97, r, (len / n) * 1.25, radial, false), { p: [p.x, p.y, p.z], r: [e.x, e.y, e.z] })
  }
}

/** Beads along a curve (a garland). */
function beads(b: Builder, key: string, curve: THREE.Curve<THREE.Vector3>, r: number, n: number) {
  const g = new THREE.SphereGeometry(r, 8, 6)
  for (let i = 0; i <= n; i++) {
    const p = curve.getPointAt(i / n)
    b.add(key, g, { p: [p.x, p.y, p.z] })
  }
}

/** A garland hanging round the neck: an ellipse in a tilted plane, sagging at the front. */
function garlandCurve(c: THREE.Vector3, rx: number, rz: number, sag: number, tilt: number) {
  const pts: THREE.Vector3[] = []
  for (let i = 0; i < 40; i++) {
    const a = (i / 40) * Math.PI * 2
    const x = Math.cos(a) * rx
    const z = Math.sin(a) * rz
    // the front (z > 0) hangs lower
    const y = -Math.max(0, Math.sin(a)) * sag + z * Math.tan(tilt)
    pts.push(new THREE.Vector3(c.x + x, c.y + y, c.z + z))
  }
  return new THREE.CatmullRomCurve3(pts, true)
}

function build(H: number, seed: number): BuiltParts {
  const b = new Builder()
  const k = H / 4.2
  const r = rng(seed * 7919 + 13)

  // ── plinth: two plastered steps, 0.8 m in all, so the guardian stands over the 6 m portal ──
  const p1 = 0.36 * k
  const p2 = 0.44 * k
  b.add('plinth', rbox(1.75 * k, p1, 3.3 * k, 0.03 * k), { p: [0, p1 / 2, 0] })
  b.add('plinth', rbox(1.5 * k, p2, 3.0 * k, 0.03 * k), { p: [0, p1 + p2 / 2, 0] })
  const y0 = p1 + p2

  // ── legs: columns with a knee band and a flared hoof ────────────────────────
  const legH = 1.32 * k
  const legX = 0.33 * k
  for (const lz of [-0.88 * k, 0.86 * k])
    for (const sx of [-1, 1]) {
      const x = sx * legX
      b.add('lime', cyl(0.165 * k, 0.19 * k, legH, 18), { p: [x, y0 + legH / 2 + 0.1 * k, lz] })
      b.add('lime', cyl(0.24 * k, 0.26 * k, 0.12 * k, 18), { p: [x, y0 + 0.06 * k, lz] })
      b.add('ochre', cyl(0.2 * k, 0.2 * k, 0.07 * k, 18, true), { p: [x, y0 + 0.58 * k, lz] })
      b.add('red', cyl(0.205 * k, 0.205 * k, 0.04 * k, 18, true), { p: [x, y0 + 0.66 * k, lz] })
      b.add('red', cyl(0.25 * k, 0.25 * k, 0.03 * k, 18, true), { p: [x, y0 + 0.13 * k, lz] })
    }

  // ── body: a thrown barrel, a deep chest, a rounded rump ─────────────────────
  const bodyY = y0 + legH + 0.48 * k
  const body = new THREE.CapsuleGeometry(0.56 * k, 1.55 * k, 8, 24)
  body.rotateX(Math.PI / 2)
  body.scale(0.84, 1, 1)
  b.add('lime', body, { p: [0, bodyY, -0.05 * k] })
  const chest = new THREE.SphereGeometry(0.6 * k, 24, 16)
  chest.scale(0.86, 1.05, 0.8)
  b.add('lime', chest, { p: [0, bodyY + 0.12 * k, 0.78 * k] })

  // firing vents: dark round mouths on the flanks and under the belly
  const vent = new THREE.CircleGeometry(0.06 * k, 14)
  for (const sx of [-1, 1])
    for (const z of [-0.6 * k, 0.1 * k]) {
      const g = vent.clone()
      g.rotateY((sx * Math.PI) / 2)
      b.add('dark', g, { p: [sx * 0.475 * k, bodyY - 0.05 * k, z] })
    }
  const under = vent.clone()
  under.rotateX(Math.PI / 2)
  b.add('dark', under, { p: [0, bodyY - 0.565 * k, -0.2 * k] })

  // ── neck: rising steeply from the chest, thick, slightly arched ─────────────
  const neck = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, bodyY + 0.2 * k, 0.86 * k),
    new THREE.Vector3(0, bodyY + 0.75 * k, 1.04 * k),
    new THREE.Vector3(0, bodyY + 1.3 * k, 1.12 * k),
    new THREE.Vector3(0, bodyY + 1.68 * k, 1.1 * k),
  ])
  sections(b, 'lime', neck, 0.42 * k, 0.27 * k, 9)
  const poll = neck.getPointAt(1)
  b.add('lime', new THREE.SphereGeometry(0.28 * k, 18, 12), { p: [poll.x, poll.y, poll.z] })

  // ── head: a long face reaching forward and down, flaring at the muzzle ──────
  const head = lathe(
    [
      [0, 0],
      [0.25, 0.02],
      [0.24, 0.3],
      [0.19, 0.62],
      [0.2, 0.78],
      [0.22, 0.86],
      [0.17, 0.95],
      [0, 0.97],
    ].map(([rr, y]) => [rr * k, y * k] as [number, number]),
    22,
  )
  head.scale(0.82, 1, 1)
  const hd = new THREE.Vector3(0, -0.62, 0.79).normalize()
  const he = new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), hd))
  const hp = poll.clone().add(new THREE.Vector3(0, 0.02 * k, 0.06 * k))
  b.add('lime', head, { p: [hp.x, hp.y, hp.z], r: [he.x, he.y, he.z] })
  const at = (t: number) => hp.clone().add(hd.clone().multiplyScalar(t * k))
  // wide eyes: a white ring, a black pupil, a red rim
  for (const sx of [-1, 1]) {
    const e = at(0.22)
    b.add('red', new THREE.TorusGeometry(0.1 * k, 0.025 * k, 8, 20), { p: [sx * 0.2 * k, e.y + 0.04 * k, e.z], r: [0, (sx * Math.PI) / 2, 0] })
    b.add('white', new THREE.SphereGeometry(0.095 * k, 16, 10), { p: [sx * 0.17 * k, e.y + 0.04 * k, e.z], s: [0.55, 1, 1] })
    b.add('dark', new THREE.SphereGeometry(0.05 * k, 12, 8), { p: [sx * 0.215 * k, e.y + 0.04 * k, e.z + 0.01 * k], s: [0.5, 1, 1] })
    // tall pricked ears
    b.add('lime', cyl(0.015 * k, 0.09 * k, 0.42 * k, 12), { p: [sx * 0.15 * k, poll.y + 0.38 * k, poll.z - 0.02 * k], r: [-0.12, 0, -sx * 0.18] })
    b.add('red', cyl(0.01 * k, 0.05 * k, 0.3 * k, 10), { p: [sx * 0.155 * k, poll.y + 0.36 * k, poll.z + 0.03 * k], r: [-0.12, 0, -sx * 0.18] })
    // nostrils
    const n = at(0.9)
    b.add('dark', new THREE.SphereGeometry(0.045 * k, 10, 8), { p: [sx * 0.08 * k, n.y + 0.02 * k, n.z + 0.03 * k] })
  }
  // bridle: bands round the muzzle and the brow, a strap down the face
  for (const t of [0.42, 0.74]) {
    const c = at(t)
    const band = new THREE.TorusGeometry(0.205 * k, 0.03 * k, 8, 26)
    band.scale(0.85, 1, 1)
    b.add('red', band, { p: [c.x, c.y, c.z], r: [he.x + Math.PI / 2, he.y, he.z] })
  }
  const brow = at(0.02)
  b.add('ochre', new THREE.TorusGeometry(0.29 * k, 0.035 * k, 8, 28), { p: [brow.x, brow.y + 0.05 * k, brow.z], r: [Math.PI / 2 - 0.35, 0, 0] })

  // ── mane: a scalloped crest down the back of the neck ───────────────────────
  const mane = new THREE.Shape()
  const M = 12
  const back: THREE.Vector3[] = []
  for (let i = 0; i <= M; i++) back.push(neck.getPointAt(0.04 + (0.94 * i) / M))
  mane.moveTo(back[0].z - 0.3 * k, back[0].y)
  for (let i = 0; i <= M; i++) {
    const p = back[i]
    const out = (0.38 + 0.12 * Math.sin((i / M) * Math.PI)) * k
    mane.lineTo(p.z - out, p.y + (i % 2 ? 0.05 * k : -0.04 * k))
  }
  for (let i = M; i >= 0; i--) mane.lineTo(back[i].z - 0.2 * k, back[i].y)
  mane.closePath()
  const maneG = new THREE.ExtrudeGeometry(mane, { depth: 0.12 * k, bevelEnabled: true, bevelThickness: 0.02 * k, bevelSize: 0.02 * k, bevelSegments: 1, curveSegments: 4 })
  // the shape was drawn in (z, y): turn it so its x runs along the world z
  maneG.rotateY(-Math.PI / 2)
  maneG.translate(-0.06 * k, 0, 0)
  b.add('mane', maneG)

  // ── trappings ──────────────────────────────────────────────────────────────
  // three bead garlands round the neck's foot, sagging over the chest
  const gc = new THREE.Vector3(0, bodyY + 0.62 * k, 0.98 * k)
  const garlandKeys = ['red', 'ochre', 'green']
  for (let i = 0; i < 3; i++) beads(b, garlandKeys[(i + seed) % 3], garlandCurve(gc.clone().add(new THREE.Vector3(0, -i * 0.14 * k, -i * 0.02 * k)), (0.43 + i * 0.05) * k, (0.4 + i * 0.05) * k, (0.22 + i * 0.12) * k, 0.25), 0.042 * k, 34 + i * 6)
  // breast band with a row of bells
  const band = new THREE.TorusGeometry(0.62 * k, 0.05 * k, 8, 40, Math.PI)
  band.rotateX(Math.PI / 2)
  band.rotateY(Math.PI)
  b.add('red', band, { p: [0, bodyY - 0.06 * k, 0.42 * k], s: [0.82, 1, 0.82] })
  const bell = lathe(
    [
      [0, 0],
      [0.06, 0.01],
      [0.07, 0.06],
      [0.045, 0.11],
      [0.018, 0.13],
      [0, 0.135],
    ].map(([rr, y]) => [rr * k, y * k] as [number, number]),
    12,
  )
  for (let i = 0; i < 9; i++) {
    const a = Math.PI * (0.12 + (0.76 * i) / 8)
    b.add('ochre', bell, { p: [Math.cos(a) * 0.51 * k, bodyY - 0.24 * k, 0.42 * k + Math.sin(a) * 0.51 * k] })
  }
  // saddle cloth over the back with a bordered hem, a saddle seat on top
  const cloth = new THREE.CylinderGeometry(0.62 * k, 0.62 * k, 1.05 * k, 28, 1, true, -Math.PI * 0.62, Math.PI * 1.24)
  cloth.rotateX(Math.PI / 2)
  cloth.scale(0.86, 1, 1)
  b.add('red', cloth, { p: [0, bodyY + 0.02 * k, -0.25 * k] })
  const hem = new THREE.TorusGeometry(0.62 * k, 0.04 * k, 6, 30, Math.PI * 1.24)
  for (const z of [-0.77 * k, 0.27 * k]) {
    const g = hem.clone()
    g.rotateZ(-Math.PI * 0.12 - Math.PI / 2 - Math.PI * 0.5)
    b.add('ochre', g, { p: [0, bodyY + 0.02 * k, z], s: [0.86, 1, 1] })
  }
  b.add('red', rbox(0.62 * k, 0.16 * k, 0.72 * k, 0.05 * k), { p: [0, bodyY + 0.6 * k, -0.25 * k] })
  b.add('ochre', rbox(0.66 * k, 0.05 * k, 0.76 * k, 0.02 * k), { p: [0, bodyY + 0.69 * k, -0.25 * k] })
  b.add('red', rbox(0.5 * k, 0.32 * k, 0.12 * k, 0.04 * k), { p: [0, bodyY + 0.8 * k, -0.6 * k] })
  // tassels hanging at the cloth's corners
  for (const sx of [-1, 1])
    for (const z of [-0.7 * k, 0.18 * k]) {
      b.add('green', cyl(0.02 * k, 0.07 * k, 0.24 * k, 10), { p: [sx * 0.49 * k, bodyY - 0.52 * k, z] })
      b.add('ochre', new THREE.SphereGeometry(0.045 * k, 10, 8), { p: [sx * 0.49 * k, bodyY - 0.38 * k, z] })
    }

  // ── tail: a thick sweep up and back ─────────────────────────────────────────
  const tail = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, bodyY + 0.1 * k, -1.32 * k),
    new THREE.Vector3(0, bodyY - 0.2 * k, -1.62 * k),
    new THREE.Vector3(0, bodyY - 0.75 * k, -1.62 * k),
  ])
  sections(b, 'lime', tail, 0.13 * k, 0.08 * k, 5, 14)
  void r
  return b.build()
}

/** Limewash weathering in the vertex colours: grime pooling low and streaking down, lichen at the foot. */
function weather(g: THREE.BufferGeometry, H: number, seed: number) {
  const pos = g.getAttribute('position')
  const col = new Float32Array(pos.count * 3)
  const white = new THREE.Color('#ece6da')
  const grime = new THREE.Color('#8a7a68')
  const red = new THREE.Color('#9a4a34')
  const lichen = new THREE.Color('#7f8461')
  const c = new THREE.Color()
  const s = seed * 1.7
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const y = pos.getY(i)
    const z = pos.getZ(i)
    const h = y / H
    // broad vertical rain streaks: a slow noise in x / z only, stretched down (never a fine grain)
    const streak = 0.5 + 0.5 * Math.sin(x * 4.2 + s) * Math.sin(z * 3.4 + y * 0.35 + s * 2)
    const patch = 0.5 + 0.5 * Math.sin(x * 1.6 + z * 1.2 + y * 0.9 + s) * Math.cos(z * 2.1 - y * 1.3)
    c.copy(white)
    c.lerp(grime, Math.min(0.55, (1 - h) * 0.4 + streak * 0.14))
    // the matte limewash has worn through to the red body in broad patches
    if (patch > 0.68) c.lerp(red, Math.min(1, (patch - 0.68) * 3.6))
    if (h < 0.3) c.lerp(lichen, (0.3 - h) * 1.1 * (0.5 + 0.5 * streak))
    col[i * 3] = c.r
    col[i * 3 + 1] = c.g
    col[i * 3 + 2] = c.b
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3))
}

const cache = new Map<string, BuiltParts>()

function materialsFor(m: ModelMaterials, paint: Paint): Record<string, THREE.Material> {
  const weathered = paint === 'weathered'
  const lime =
    paint === 'red'
      ? tinted(m.terracotta, '#a24a30', { roughness: 0.92 })
      : weathered
        ? tinted(m.powderVC, '#ffffff', { roughness: 1, envMapIntensity: 0.4, normalScale: new THREE.Vector2(0.35, 0.35) })
        : tinted(m.plaster ?? m.terracotta, '#efeae0', { roughness: 0.95 })
  const fade = (hex: string) => (weathered ? tinted(m.terracotta, hex, { roughness: 0.95, envMapIntensity: 0.4 }) : tinted(m.terracotta, hex, { roughness: 0.8 }))
  return {
    lime,
    plinth: tinted(m.terracotta, weathered ? '#cfc6b6' : '#e2dccf', { roughness: 1 }),
    red: fade(weathered ? '#8f3324' : '#a8261b'),
    // the bead garlands are fired clay: three terracottas, not painted toy colours
    ochre: fade(weathered ? '#b4643f' : '#c0683e'),
    green: fade(weathered ? '#7a3524' : '#86391f'),
    white: tinted(m.terracotta, '#f3efe6', { roughness: 0.6 }),
    dark: tinted(m.terracotta, '#1b1714', { roughness: 0.8 }),
    mane: fade(weathered ? '#5a2a20' : '#7a1f17'),
  }
}

export function AyyanarHorse({ config }: ModelProps) {
  const m = useModelMaterials()
  const H = num(config, 'height', config.height ?? 4.2)
  const paintS = str(config, 'paint', 'weathered')
  const paint: Paint = paintS === 'white' || paintS === 'red' ? paintS : 'weathered'
  const seed = Math.round(num(config, 'seed', 1))
  const parts = useMemo(() => {
    const key = `${H}|${seed}|${paint}`
    let hit = cache.get(key)
    if (!hit) {
      hit = build(H, seed)
      if (paint === 'weathered') for (const p of hit) if (p.key === 'lime') weather(p.geometry, H, seed)
      cache.set(key, hit)
    }
    return hit
  }, [H, seed, paint])
  const mats = useMemo(() => materialsFor(m, paint), [m, paint])
  return <Parts parts={parts} materials={mats} />
}
