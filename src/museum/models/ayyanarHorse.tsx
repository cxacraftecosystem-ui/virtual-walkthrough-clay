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
 * Sculpted (models/sculpt.ts), not stacked: one paddled skin from the tail root through the
 * barrel and chest up the neck to the poll; a long head with a heavy jowl, a cut mouth, flared
 * nostrils and bulging lidded eyes; turned legs with knee and fetlock; locks of mane along the
 * crest; a saddle cloth draped over the back with a scalloped, bound and tasselled hem.
 *
 * Shown outdoors as a guardian, with no offerings and nothing ritual (CRAFTS §2). Origin at
 * the plinth's floor centre; the horse faces +z.
 */
import { useMemo } from 'react'
import * as THREE from 'three'
import { Builder, cyl, lathe, Parts, rbox, tube, type BuiltParts } from './kit'
import { fbm, keyedLoft, sculptDetailFor, sculptEllipsoid, withSculptDetail } from './sculpt'
import { useMuseum } from '../state/store'
import { tinted, useModelMaterials, type ModelMaterials } from './modelMaterials'
import { num, str, type ModelProps } from './types'

type Paint = 'weathered' | 'white' | 'red'

const PI = Math.PI

/** Beads along a curve (a garland). */
function beads(b: Builder, key: string, curve: THREE.Curve<THREE.Vector3>, r: number, n: number) {
  const g = sculptEllipsoid(r, r * 0.86, r, undefined, 8, 6)
  for (let i = 0; i < n; i++) {
    const p = curve.getPointAt(i / n)
    b.add(key, g, { p: [p.x, p.y, p.z] })
  }
}

/** A clay bell: a lathed cup with a neck and a ring, mouth down once turned over. */
function bellGeo(s: number) {
  return lathe(
    (
      [
        [0, 0.004],
        [0.05, 0],
        [0.066, 0.02],
        [0.062, 0.06],
        [0.046, 0.1],
        [0.022, 0.122],
        [0.012, 0.14],
        [0, 0.142],
      ] as [number, number][]
    ).map(([rr, y]) => [rr * s, y * s] as [number, number]),
    14,
  )
}

/** Euler that turns +z to `dir`. */
function facing(dir: THREE.Vector3): [number, number, number] {
  const e = new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir.clone().normalize()))
  return [e.x, e.y, e.z]
}

function build(H: number, seed: number): BuiltParts {
  const b = new Builder()
  const k = H / 4.2
  const V = (x: number, y: number, z: number) => new THREE.Vector3(x * k, y * k, z * k)
  const S = (l: [number, number][]) => l.map(([u, s]) => [u * k, s * k] as [number, number])
  // hand-paddled clay: broad, soft unevenness, never a machine-smooth surface
  const paddled = (amp: number, sd: number) => (_t: number, _a: number, p: THREE.Vector3) => amp * k * fbm((p.x * 2.4) / k + sd, (p.y * 2.4) / k, (p.z * 2.4) / k, 3)

  // ── plinth: two plastered steps, 0.8 m in all, so the guardian stands over the 6 m portal ──
  const p1 = 0.36 * k
  const p2 = 0.44 * k
  b.add('plinth', rbox(1.75 * k, p1, 3.3 * k, 0.04 * k, 3), { p: [0, p1 / 2, 0] })
  b.add('plinth', rbox(1.5 * k, p2, 3.0 * k, 0.04 * k, 3), { p: [0, p1 + p2 / 2, 0] })
  const y0 = (p1 + p2) / k

  // ── legs: thrown columns, a knee, a fetlock, a flared hoof; anklets of beads ──────────────
  for (const lz of [-0.9, 0.82])
    for (const sx of [-1, 1]) {
      const x = sx * 0.33
      const leg = keyedLoft(
        [V(x, y0, lz), V(x, y0 + 0.13, lz), V(x, y0 + 0.3, lz), V(x, y0 + 0.55, lz), V(x, y0 + 0.74, lz), V(x, y0 + 1.0, lz), V(x * 0.97, y0 + 1.45, lz)],
        S([
          [0.25, 0.25],
          [0.2, 0.2],
          [0.168, 0.168],
          [0.152, 0.152],
          [0.182, 0.176],
          [0.17, 0.168],
          [0.21, 0.2],
        ]),
      )
      b.add('lime', leg.loft.geometry({ rows: 36, cols: 28, displace: paddled(0.012, sx + lz), capStart: true }))
      b.add('red', tube(leg.loft.ring(0.47, 0.012 * k, 32), 0.022 * k, 40, 6))
      b.add('ochre', tube(leg.loft.ring(0.52, 0.012 * k, 32), 0.022 * k, 40, 6))
      beads(b, 'ochre', leg.loft.ring(0.2, 0.03 * k, 32), 0.03 * k, 16)
      b.add('red', tube(leg.loft.ring(0.07, 0.01 * k, 32), 0.018 * k, 40, 6))
    }

  // ── body and neck: one paddled skin from the root of the tail up to the poll ─────────────
  const body = keyedLoft(
    [V(0, 2.66, -1.44), V(0, 2.7, -1.2), V(0, 2.64, -0.7), V(0, 2.58, -0.1), V(0, 2.64, 0.5), V(0, 2.98, 0.92), V(0, 3.42, 1.06), V(0, 3.82, 1.1), V(0, 4.04, 1.1)],
    S([
      [0.2, 0.18],
      [0.5, 0.44],
      [0.6, 0.48],
      [0.62, 0.5],
      [0.64, 0.5],
      [0.54, 0.43],
      [0.43, 0.35],
      [0.35, 0.29],
      [0.26, 0.24],
    ]),
    {
      shape: (_t, a) => {
        // a flatter belly, a ridge along the spine
        const c = Math.cos(a)
        const belly = c < 0 ? -0.06 * c * c : 0
        const ridge = 0.04 * Math.pow(Math.max(0, c), 10)
        return 1 + belly + ridge
      },
    },
  )
  const K = body.keys
  b.add('lime', body.loft.geometry({ rows: 110, cols: 48, displace: paddled(0.02, 3), capStart: true, capEnd: true }))

  // ── head: a long face reaching forward and down, a heavy jowl, a flaring muzzle ───────────
  const poll = body.loft.frame(1).p
  const hd = new THREE.Vector3(0, -0.62, 0.79).normalize()
  const H0 = poll.clone().add(V(0, 0.04, -0.06))
  const hAt = (d: number) => H0.clone().addScaledVector(hd, d * k)
  const head = keyedLoft(
    [hAt(0), hAt(0.28), hAt(0.58), hAt(0.84), hAt(1.0)],
    S([
      [0.3, 0.27],
      [0.25, 0.225],
      [0.205, 0.19],
      [0.25, 0.215],
      [0.15, 0.14],
    ]),
    {
      shape: (t, a) => {
        const c = Math.cos(a)
        // the jowl swells under the cheek; the nasal bone runs as a ridge down the face
        const jowl = 0.3 * Math.exp(-(((t - 0.12) / 0.16) ** 2)) * Math.pow(Math.max(0, -c), 1.5)
        const nose = 0.05 * Math.pow(Math.max(0, c), 8)
        return 1 + jowl + nose
      },
    },
  )
  // the mouth: a deep cut round the muzzle
  const mouth = (t: number, a: number) => -0.035 * k * Math.exp(-(((Math.cos(a) + 0.38) / 0.09) ** 2)) * THREE.MathUtils.smoothstep(t, 0.68, 0.82)
  const headPad = paddled(0.012, 7)
  b.add('lime', head.loft.geometry({ rows: 60, cols: 48, displace: (t, a, p) => mouth(t, a) + headPad(t, a, p), capStart: true, capEnd: true }))
  for (const sx of [-1, 1]) {
    // wide, bulging eyes under a heavy brow: white, a dark iris, a red lid
    const t = 0.24
    const a = sx * 1.2
    const out = head.loft.outward(t, a)
    const q = head.loft.point(t, a, 0)
    const rot = facing(out)
    b.add('white', sculptEllipsoid(0.11 * k, 0.085 * k, 0.07 * k, undefined, 24, 16), { p: [q.x, q.y, q.z], r: rot })
    const iris = q.clone().addScaledVector(out, 0.055 * k)
    b.add('dark', sculptEllipsoid(0.05 * k, 0.05 * k, 0.022 * k, undefined, 16, 10), { p: [iris.x, iris.y, iris.z], r: rot })
    const lid = new THREE.TorusGeometry(0.105 * k, 0.026 * k, 8, 28)
    lid.scale(1, 0.8, 1)
    b.add('red', lid, { p: [q.x, q.y, q.z], r: rot })
    const brow = q.clone().addScaledVector(head.loft.frame(t).N, 0.08 * k).addScaledVector(out, 0.015 * k)
    b.add('lime', sculptEllipsoid(0.12 * k, 0.04 * k, 0.05 * k), { p: [brow.x, brow.y, brow.z], r: rot })
    // flared nostrils
    const nq = head.loft.point(0.9, sx * 0.55, 0)
    const nOut = facing(head.loft.outward(0.9, sx * 0.55))
    b.add('lime', new THREE.TorusGeometry(0.05 * k, 0.022 * k, 8, 20), { p: [nq.x, nq.y, nq.z], r: nOut })
    b.add('dark', sculptEllipsoid(0.045 * k, 0.03 * k, 0.012 * k), { p: [nq.x, nq.y, nq.z], r: nOut })
    // tall pricked ears, cupped to the front, red inside
    const base = poll.clone().add(V(sx * 0.14, 0.12, 0))
    const ear = keyedLoft(
      [base, base.clone().add(V(sx * 0.03, 0.18, 0.02)), base.clone().add(V(sx * 0.06, 0.36, 0.03)), base.clone().add(V(sx * 0.08, 0.48, 0.02))],
      S([
        [0.06, 0.09],
        [0.05, 0.1],
        [0.035, 0.065],
        [0.008, 0.01],
      ]),
      { shape: (_t, an) => 1 - 0.45 * Math.exp(-(((Math.abs(an) - PI) / 0.7) ** 2)) },
    )
    b.add('lime', ear.loft.geometry({ rows: 16, cols: 20, capEnd: true }))
    const inner = ear.loft.point(0.4, PI, 0.004 * k)
    b.add('red', sculptEllipsoid(0.05 * k, 0.12 * k, 0.012 * k), { p: [inner.x, inner.y, inner.z], r: [0.1, 0, -sx * 0.15] })
    // a boss at the cheek where the bridle's straps meet
    const cq = head.loft.point(0.42, sx * 1.6, 0.02 * k)
    b.add('ochre', sculptEllipsoid(0.055 * k, 0.055 * k, 0.025 * k), { p: [cq.x, cq.y, cq.z], r: facing(head.loft.outward(0.42, sx * 1.6)) })
  }
  // bridle: a band round the muzzle and the brow, a strap down the face
  b.add('red', tube(head.loft.ring(0.7, 0.012 * k, 36), 0.028 * k, 48, 6))
  b.add('red', tube(head.loft.ring(0.06, 0.02 * k, 36), 0.028 * k, 48, 6))
  const strap: THREE.Vector3[] = []
  for (let i = 0; i <= 8; i++) strap.push(head.loft.point(0.06 + (0.64 * i) / 8, 0, 0.012 * k))
  b.add('red', tube(new THREE.CatmullRomCurve3(strap), 0.024 * k, 24, 6))

  // ── mane: sculpted locks standing along the crest, a forelock between the ears ────────────
  const LOCKS = 13
  for (let i = 0; i < LOCKS; i++) {
    const t = K[5] + ((1 - K[5]) * (i + 0.5)) / LOCKS
    const f = body.loft.frame(t)
    const q = body.loft.point(t, 0, 0.03 * k)
    const lean = f.N.clone().multiplyScalar(0.7).addScaledVector(f.T, -0.7).normalize()
    const sz = 0.75 + 0.35 * Math.sin((i / (LOCKS - 1)) * PI)
    const e = new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), lean))
    const lock = sculptEllipsoid(0.07 * k * sz, 0.17 * k * sz, 0.05 * k * sz, (d) => 0.012 * k * Math.sin(d.y * 6 + d.x * 4) - (d.y > 0.4 ? 0.04 * k * (d.y - 0.4) : 0), 16, 12)
    b.add('mane', lock, { p: [q.x + (i % 2 ? 0.035 : -0.035) * k, q.y, q.z], r: [e.x, e.y, e.z] })
  }
  const fore = poll.clone().add(V(0, 0.1, 0.1))
  b.add('mane', sculptEllipsoid(0.08 * k, 0.14 * k, 0.06 * k), { p: [fore.x, fore.y, fore.z], r: [0.5, 0, 0] })

  // ── trappings ────────────────────────────────────────────────────────────────────────────
  // three bead garlands round the foot of the neck, sagging over the chest (a = π: the front)
  const garlandKeys = ['red', 'ochre', 'green']
  for (let i = 0; i < 3; i++) {
    const t = K[5] + 0.02 + i * 0.03
    const sag = (0.1 + i * 0.12) * k
    const g = body.loft.ring(t, 0.04 * k, 48, (a) => sag * Math.pow(Math.max(0, -Math.cos(a)), 1.4))
    beads(b, garlandKeys[(i + seed) % 3], g, 0.045 * k, 40 + i * 6)
  }
  // a collar higher on the neck, a pendant boss at its front
  const collarT = K[6] + 0.01
  b.add('red', tube(body.loft.ring(collarT, 0.02 * k, 40), 0.04 * k, 56, 8))
  b.add('ochre', tube(body.loft.ring(collarT + 0.012, 0.03 * k, 40), 0.018 * k, 56, 6))
  {
    const q = body.loft.point(collarT, PI, 0.06 * k)
    b.add('ochre', sculptEllipsoid(0.09 * k, 0.11 * k, 0.04 * k), { p: [q.x, q.y - 0.08 * k, q.z], r: facing(body.loft.outward(collarT, PI)) })
  }
  // breast band round the chest, a row of hanging bells
  const breast: THREE.Vector3[] = []
  for (let i = 0; i <= 20; i++) {
    const th = -PI / 2 + (PI * i) / 20
    breast.push(V(Math.sin(th) * 0.545, 2.5 + 0.04 * Math.cos(th), 0.42 + 0.52 * Math.cos(th)))
  }
  const breastC = new THREE.CatmullRomCurve3(breast)
  b.add('red', tube(breastC, 0.05 * k, 48, 8))
  b.add('ochre', tube(new THREE.CatmullRomCurve3(breast.map((p) => p.clone().add(V(0, -0.055, 0)))), 0.02 * k, 48, 6))
  const bell = bellGeo(k * 1.15)
  for (let i = 1; i < 12; i++) {
    const p = breastC.getPointAt(i / 12)
    b.add('ochre', bell, { p: [p.x, p.y - 0.06 * k, p.z], r: [PI, 0, 0] })
  }
  // saddle cloth over the back, its hem scalloped and bound, a tassel at each scallop
  const tc0 = K[1] + 0.07
  const tc1 = K[4] - 0.06
  const SC = 7
  const hemA = (t: number) => 1.9 + 0.14 * Math.abs(Math.sin(((t - tc0) / (tc1 - tc0)) * PI * SC))
  b.add('cloth', body.loft.geometry({ t0: tc0, t1: tc1, rows: 70, cols: 40, offset: 0.03 * k, arange: (t) => [-hemA(t), hemA(t)], displace: paddled(0.008, 11) }))
  for (const sx of [-1, 1]) {
    const hem: THREE.Vector3[] = []
    for (let i = 0; i <= 70; i++) {
      const t = tc0 + ((tc1 - tc0) * i) / 70
      hem.push(body.loft.point(t, sx * hemA(t), 0.035 * k))
    }
    b.add('ochre', tube(new THREE.CatmullRomCurve3(hem), 0.026 * k, 90, 6))
    for (let s = 0; s <= SC; s++) {
      const t = tc0 + ((tc1 - tc0) * s) / SC
      const q = body.loft.point(t, sx * hemA(t), 0.04 * k)
      b.add('green', cyl(0.02 * k, 0.065 * k, 0.2 * k, 10), { p: [q.x, q.y - 0.12 * k, q.z] })
      b.add('ochre', sculptEllipsoid(0.04 * k, 0.04 * k, 0.04 * k, undefined, 10, 8), { p: [q.x, q.y - 0.01 * k, q.z] })
    }
  }
  for (const t of [tc0, tc1]) {
    const edge: THREE.Vector3[] = []
    for (let i = 0; i <= 24; i++) edge.push(body.loft.point(t, -hemA(t) + (2 * hemA(t) * i) / 24, 0.034 * k))
    b.add('red', tube(new THREE.CatmullRomCurve3(edge), 0.024 * k, 48, 6))
  }
  // the seat: a padded saddle with a raised cantle and pommel
  {
    const tm = (tc0 + tc1) / 2
    const top = body.loft.point(tm, 0, 0.05 * k)
    b.add('red', sculptEllipsoid(0.34 * k, 0.09 * k, 0.46 * k), { p: [top.x, top.y + 0.02 * k, top.z] })
    for (const dz of [-0.42, 0.4]) b.add('red', sculptEllipsoid(0.26 * k, 0.12 * k, 0.07 * k), { p: [top.x, top.y + 0.08 * k, top.z + dz * k] })
  }
  // girth strap under the belly
  b.add('ochre', tube(body.loft.ring(K[3] - 0.02, 0.035 * k, 40), 0.03 * k, 48, 6))

  // firing vents: dark round mouths with a thrown lip, low on the flanks
  for (const sx of [-1, 1])
    for (const t of [K[2], K[3] + 0.03]) {
      const a = sx * 1.95
      const q = body.loft.point(t, a, 0)
      const o = facing(body.loft.outward(t, a))
      b.add('lime', new THREE.TorusGeometry(0.07 * k, 0.022 * k, 8, 20), { p: [q.x, q.y, q.z], r: o })
      b.add('dark', sculptEllipsoid(0.065 * k, 0.065 * k, 0.012 * k), { p: [q.x, q.y, q.z], r: o })
    }

  // ── tail: a thick sweep down from the rump, a flared tuft ────────────────────────────────
  const tail = keyedLoft(
    [V(0, 2.82, -1.32), V(0, 2.72, -1.58), V(0, 2.3, -1.7), V(0, 1.85, -1.66), V(0, 1.6, -1.6)],
    S([
      [0.13, 0.12],
      [0.12, 0.11],
      [0.1, 0.09],
      [0.13, 0.11],
      [0.05, 0.05],
    ]),
  )
  b.add('mane', tail.loft.geometry({ rows: 40, cols: 24, displace: (t, a) => 0.012 * k * Math.abs(Math.sin(a * 6 + t * 8)) * THREE.MathUtils.smoothstep(t, 0.2, 0.6), capStart: true, capEnd: true }))
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
    // the saddle cloth is an open skin over the back: seen from below its hem too
    cloth: tinted(m.terracotta, weathered ? '#8f3324' : '#a8261b', { roughness: weathered ? 0.95 : 0.8, envMapIntensity: weathered ? 0.4 : 0.6, side: THREE.DoubleSide }),
  }
}

export function AyyanarHorse({ config }: ModelProps) {
  const m = useModelMaterials()
  const H = num(config, 'height', config.height ?? 4.2)
  const paintS = str(config, 'paint', 'weathered')
  const paint: Paint = paintS === 'white' || paintS === 'red' ? paintS : 'weathered'
  const seed = Math.round(num(config, 'seed', 1))
  // tessellation by tier (sculpt.ts): the form is the same, the facets fewer
  const d = sculptDetailFor(useMuseum((s) => s.tier))
  const parts = useMemo(() => {
    const key = `${H}|${seed}|${paint}|${d}`
    let hit = cache.get(key)
    if (!hit) {
      hit = withSculptDetail(d, () => build(H, seed))
      if (paint === 'weathered') for (const p of hit) if (p.key === 'lime') weather(p.geometry, H, seed)
      cache.set(key, hit)
    }
    return hit
  }, [H, seed, paint, d])
  const mats = useMemo(() => materialsFor(m, paint), [m, paint])
  return <Parts parts={parts} materials={mats} />
}
