/**
 * CLAY PAVILION MODELS — procedural stand-ins for the three traditions' pieces and the
 * pavilion's own display furniture. Built like every procedural model (kit.tsx): origin at
 * the floor (or podium-top) centre, front faces +z, sized from footprint / height, merged
 * per material and cached by parameters.
 *
 *   podium            {height, top: 'plain' | 'vitrine'}       loose 12 in display podium
 *   clay-vessel       {form, clay, burnish, decor}              turned / hand-built pots (12 forms, 8 bodies,
 *                                                               6 surface decors: models/clayDecor.ts)
 *   terracotta-horse  {scale, style}                            upright horse, long neck, pricked ears;
 *                                                               bankura | gorakhpur (applied beads, bells) | sonepur (smoked)
 *   votive-plaque     {motif, size}                             arched relief plaque on a small stand, up to 1.1 m;
 *                                                               rider | deity | serpent | procession | canopy
 *   oculus-plinth     —                                         the stepped round plinth under the oculus
 *   clay-shelf        {width, rows, fired}                      timber drying shelf with rows of pots
 *
 * ('potters-wheel' is the studio's interactive wheel, models/printStudio.tsx.)
 *
 * These are stand-ins: plain forms and earth colours, nothing that claims to be a particular
 * maker's piece. A GLB (`model`) replaces them once the workshop's objects are scanned.
 */
import * as THREE from 'three'
import { annulusFace, cylinderFace } from '../architecture/shellGeometry'
import { MUSEUM } from '../config/museum'
import { Builder, cyl, lathe, Parts, rbox, rng, tube, useBuilt } from './kit'
import { tinted, useModelMaterials, type ModelMaterials } from './modelMaterials'
import { decorMaterial, isDecor, type ClayDecor } from './clayDecor'
import { fp, geoKey, num, str, type ModelProps } from './types'

/* ------------------------------------------------------------------ */
/* Clay bodies                                                         */
/* ------------------------------------------------------------------ */

export type ClayBody = 'red' | 'black' | 'buff' | 'terracotta' | 'pink' | 'geru' | 'quartz' | 'grey'
export type VesselForm = 'matka' | 'surahi' | 'kulhad' | 'diya' | 'kettle' | 'bowl' | 'handi' | 'tawa' | 'lidded' | 'jar' | 'vase' | 'ghatam'

const CLAY_COLOR: Record<ClayBody, string> = {
  red: '#9a4630',
  terracotta: '#b8633f',
  buff: '#d6b38c',
  black: '#2a2523',
  // the pale pink-buff of Pokaran, a red-earth (geru) slip, the white quartz body of Jaipur blue, unfired grey
  pink: '#d39c84',
  geru: '#8f3d25',
  quartz: '#eeebe4',
  grey: '#8d8780',
}

export const isBody = (v: string): v is ClayBody => v in CLAY_COLOR
const FORMS: VesselForm[] = ['matka', 'surahi', 'kulhad', 'diya', 'kettle', 'bowl', 'handi', 'tawa', 'lidded', 'jar', 'vase', 'ghatam']
const isForm = (v: string): v is VesselForm => (FORMS as string[]).includes(v)

/** Fired-clay material for a body and a burnish (0 = matte, 1 = stone-polished). */
export function clayMaterial(m: ModelMaterials, body: ClayBody, burnish: number): THREE.Material {
  const b = Math.max(0, Math.min(1, burnish))
  const r = Math.round((0.92 - b * 0.62) * 100) / 100
  const n = Math.round((1.1 - b * 0.85) * 100) / 100
  return tinted(m.terracotta, CLAY_COLOR[body], { roughness: r, envMapIntensity: 0.5 + b * 0.7, normalScale: new THREE.Vector2(n, n) })
}

/** Leather-hard, unfired clay (drying shelves). */
const UNFIRED = '#9c8a7b'

/* ------------------------------------------------------------------ */
/* Vessel profiles — [radius, y] outside bottom → rim → inside, unit size */
/* ------------------------------------------------------------------ */

/** Closed lathe profile (outside up, over the rim, inside down) for a form, scaled to R × H. */
export function vesselProfile(form: VesselForm, R: number, H: number): [number, number][] {
  const t = Math.max(0.004, Math.min(R, H) * 0.06) // wall thickness
  const P = (pts: [number, number][]) => pts.map(([r, y]) => [r * R, y * H] as [number, number])
  switch (form) {
    case 'matka': {
      const out = P([
        [0, 0],
        [0.38, 0],
        [0.62, 0.06],
        [0.88, 0.22],
        [1, 0.45],
        [0.95, 0.62],
        [0.78, 0.78],
        [0.56, 0.88],
        [0.5, 0.93],
        [0.56, 0.97],
        [0.6, 1],
      ])
      return [...out, [0.6 * R - t, H - t * 0.2], [0.5 * R - t, 0.93 * H], [0.56 * R - t, 0.88 * H], [0.78 * R - t, 0.78 * H], [0.9 * R - t, 0.5 * H], [0.6 * R - t, 0.12 * H], [0, t]]
    }
    case 'surahi': {
      const out = P([
        [0, 0],
        [0.42, 0],
        [0.6, 0.05],
        [0.95, 0.2],
        [1, 0.32],
        [0.88, 0.45],
        [0.5, 0.55],
        [0.24, 0.62],
        [0.2, 0.8],
        [0.24, 0.92],
        [0.36, 1],
      ])
      return [...out, [0.36 * R - t, H - t * 0.3], [0.2 * R - t * 0.6, 0.92 * H], [0.16 * R - t * 0.6, 0.8 * H], [0, 0.78 * H]]
    }
    case 'kulhad':
      return [
        [0, 0],
        [0.62 * R, 0],
        [0.66 * R, 0.08 * H],
        [R, H],
        [R - t, H],
        [0.62 * R - t, 0.12 * H],
        [0, 0.12 * H],
      ]
    case 'diya':
      return [
        [0, 0],
        [0.5 * R, 0],
        [0.88 * R, 0.45 * H],
        [R, H],
        [R - t, H],
        [0.8 * R, 0.55 * H],
        [0.4 * R, 0.3 * H],
        [0, 0.28 * H],
      ]
    case 'kettle': {
      // squat round body to the shoulder, short collar for the lid
      const out = P([
        [0, 0],
        [0.42, 0],
        [0.75, 0.08],
        [0.98, 0.32],
        [1, 0.5],
        [0.88, 0.68],
        [0.58, 0.8],
        [0.42, 0.82],
        [0.42, 0.86],
      ])
      return [...out, [0.42 * R - t, 0.86 * H], [0.42 * R - t, 0.8 * H], [0, 0.8 * H]]
    }
    case 'bowl':
      return [
        [0, 0],
        [0.34 * R, 0],
        [0.36 * R, 0.14 * H],
        [0.5 * R, 0.16 * H],
        [0.86 * R, 0.55 * H],
        [R, H],
        [R - t, H],
        [0.84 * R - t, 0.58 * H],
        [0.46 * R, 0.24 * H],
        [0, 0.22 * H],
      ]
    case 'handi': {
      // a wide cooking pot: low round belly, a short flared neck
      const out = P([
        [0, 0],
        [0.45, 0],
        [0.82, 0.12],
        [1, 0.4],
        [0.94, 0.64],
        [0.74, 0.8],
        [0.64, 0.86],
        [0.68, 0.94],
        [0.76, 1],
      ])
      return [...out, [0.76 * R - t, H - t * 0.2], [0.62 * R - t, 0.88 * H], [0.9 * R - t, 0.45 * H], [0, t]]
    }
    case 'tawa':
      // a griddle: a shallow, slightly domed disc with a turned-up rim
      return [
        [0, 0.3 * H],
        [0.6 * R, 0.15 * H],
        [0.94 * R, 0],
        [R, 0.55 * H],
        [R * 0.97, H],
        [R * 0.92, H],
        [0.9 * R, 0.6 * H],
        [0.6 * R, 0.45 * H],
        [0, 0.55 * H],
      ]
    case 'lidded':
      // a storage jar with its lid on: shoulder, lid dome, knob (closed, so no inside)
      return P([
        [0, 0],
        [0.5, 0],
        [0.86, 0.16],
        [1, 0.42],
        [0.9, 0.64],
        [0.64, 0.74],
        [0.66, 0.77],
        [0.62, 0.8],
        [0.48, 0.88],
        [0.2, 0.93],
        [0.14, 0.95],
        [0.16, 0.99],
        [0.1, 1],
        [0, 1],
      ])
    case 'jar': {
      const out = P([
        [0, 0],
        [0.52, 0],
        [0.84, 0.14],
        [1, 0.48],
        [0.92, 0.76],
        [0.62, 0.9],
        [0.56, 0.94],
        [0.64, 0.98],
        [0.66, 1],
      ])
      return [...out, [0.66 * R - t, H - t * 0.2], [0.54 * R - t, 0.92 * H], [0.9 * R - t, 0.5 * H], [0, t]]
    }
    case 'vase': {
      const out = P([
        [0, 0],
        [0.52, 0],
        [0.66, 0.08],
        [1, 0.36],
        [0.86, 0.58],
        [0.44, 0.76],
        [0.36, 0.86],
        [0.42, 0.95],
        [0.56, 1],
      ])
      return [...out, [0.56 * R - t, H - t * 0.3], [0.34 * R - t * 0.6, 0.86 * H], [0, 0.8 * H]]
    }
    case 'ghatam': {
      // the clay pot drum: a big round belly, a narrow thick mouth
      const out = P([
        [0, 0],
        [0.36, 0],
        [0.76, 0.12],
        [1, 0.44],
        [0.94, 0.7],
        [0.66, 0.86],
        [0.34, 0.92],
        [0.3, 0.95],
        [0.36, 0.99],
        [0.38, 1],
      ])
      return [...out, [0.38 * R - t * 1.6, H - t * 0.2], [0.28 * R - t, 0.94 * H], [0, 0.9 * H]]
    }
  }
}

/** Number of leading profile points on a form's outside (a decor wraps only these). */
function outsideCount(form: VesselForm): number {
  const n: Record<VesselForm, number> = { matka: 11, surahi: 11, kettle: 9, handi: 9, jar: 9, vase: 9, ghatam: 10, kulhad: 4, diya: 4, bowl: 6, tawa: 5, lidded: 14 }
  return n[form]
}

/**
 * A vessel's outside with UVs for a decor: u round the pot (0 to 1), v up it by height (0 to 1).
 * The inside (if any) is added plain under `insideKey`.
 */
function decorLathe(b: Builder, key: string, insideKey: string, form: VesselForm, R: number, H: number) {
  const prof = vesselProfile(form, R, H)
  const k = outsideCount(form)
  const g = new THREE.LatheGeometry(
    prof.slice(0, k).map(([r, y]) => new THREE.Vector2(Math.max(0, r), y)),
    48,
  )
  const pos = g.getAttribute('position')
  const uv = g.getAttribute('uv')
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i), Math.min(1, Math.max(0, pos.getY(i) / H)))
  b.add(key, g)
  if (prof.length > k) b.add(insideKey, lathe(prof.slice(k - 1), 40))
}

/** Add a vessel (merged under `key`) at p, with rotation about y. */
function addVessel(b: Builder, key: string, form: VesselForm, R: number, H: number, p: [number, number, number] = [0, 0, 0], ry = 0, extrasKey?: string) {
  b.add(key, lathe(vesselProfile(form, R, H), 40), { p, r: [0, ry, 0] })
  const ek = extrasKey ?? key
  const c = Math.cos(ry)
  const s = Math.sin(ry)
  const rot = (x: number, z: number): [number, number] => [p[0] + x * c + z * s, p[2] - x * s + z * c]
  if (form === 'diya') {
    // pinched spout at local +x
    const [x, z] = rot(R * 0.98, 0)
    b.add(key, cyl(R * 0.12, R * 0.2, H * 0.5, 10), { p: [x, p[1] + H * 0.72, z], r: [0, ry, Math.PI / 2 - 0.5] })
  }
  if (form === 'kettle') {
    // spout, lid, cane-bound handle across the top
    const sp = new THREE.CatmullRomCurve3([new THREE.Vector3(R * 0.82, H * 0.45, 0), new THREE.Vector3(R * 1.12, H * 0.6, 0), new THREE.Vector3(R * 1.3, H * 0.78, 0)])
    const spout = tube(sp, R * 0.08, 12, 10)
    b.add(key, spout, { p, r: [0, ry, 0] })
    b.add(key, cyl(R * 0.38, R * 0.44, H * 0.05, 32), { p: [p[0], p[1] + H * 0.885, p[2]] })
    b.add(key, cyl(R * 0.07, R * 0.09, H * 0.07, 16), { p: [p[0], p[1] + H * 0.94, p[2]] })
    const arc = new THREE.EllipseCurve(0, 0, R * 0.62, H * 0.42, 0, Math.PI, false, 0)
    const pts = arc.getPoints(20).map((q) => new THREE.Vector3(0, H * 0.72 + q.y, q.x))
    b.add(ek, tube(new THREE.CatmullRomCurve3(pts), R * 0.045, 24, 8), { p, r: [0, ry, 0] })
  }
}

/* ------------------------------------------------------------------ */
/* clay-vessel                                                         */
/* ------------------------------------------------------------------ */

export function ClayVessel({ config }: ModelProps) {
  const m = useModelMaterials()
  const formS = str(config, 'form', 'matka')
  const form: VesselForm = isForm(formS) ? formS : 'matka'
  const bodyS = str(config, 'clay', 'terracotta')
  const body: ClayBody = isBody(bodyS) ? bodyS : 'terracotta'
  const burnish = num(config, 'burnish', body === 'black' ? 0.8 : 0.2)
  const decorS = str(config, 'decor', 'none')
  const decor: ClayDecor = isDecor(decorS) ? decorS : 'none'
  const H = config.height ?? 0.3
  const [fx, fz] = fp(config, [H, H])
  // the kettle's spout and the diya's lip reach past the body
  const R = (Math.min(fx, fz) / 2) * (form === 'kettle' ? 0.78 : form === 'diya' ? 0.82 : 1)
  const parts = useBuilt(geoKey('clay-vessel', config), () => {
    const b = new Builder()
    if (decor === 'none') addVessel(b, 'body', form, R, H, [0, 0, 0], 0, 'cane')
    else {
      decorLathe(b, 'decor', 'body', form, R, H)
      // the kettle's spout, lid and handle and the diya's spout come from the plain builder
      if (form === 'kettle' || form === 'diya') {
        const extra = new Builder()
        addVessel(extra, 'lathe', form, R, H, [0, 0, 0], 0, 'cane')
        for (const p of extra.build()) if (p.key === 'cane') b.add('cane', p.geometry)
      }
    }
    return b
  })
  const plain = clayMaterial(m, body, burnish)
  return <Parts parts={parts} materials={{ body: plain, decor: decor === 'none' ? plain : decorMaterial(m.terracotta, decor), cane: m.rope }} />
}

/* ------------------------------------------------------------------ */
/* terracotta-horse                                                    */
/* ------------------------------------------------------------------ */

/**
 * Upright terracotta horse in the manner of the votive horses of Bengal: one continuous body
 * swept from the rump up the arched neck to a long face with an open, hollow mouth, on four
 * column legs, with tall flared ears and a scalloped crest; slip-burnished red darkening to
 * chocolate (vertex colour, with baked occlusion). Seen in profile (body along local x).
 */
export type HorseStyle = 'bankura' | 'gorakhpur' | 'sonepur'
const isHorseStyle = (v: string): v is HorseStyle => v === 'bankura' || v === 'gorakhpur' || v === 'sonepur'

export function TerracottaHorse({ config }: ModelProps) {
  const m = useModelMaterials()
  const scale = num(config, 'scale', 1)
  const styleS = str(config, 'style', 'bankura')
  const style: HorseStyle = isHorseStyle(styleS) ? styleS : 'bankura'
  const H = config.height ?? 0.5 * scale
  const parts = useBuilt(geoKey('terracotta-horse', config), () => horseBuilder(H, style))
  return <Parts parts={parts} materials={horseMaterials(m, style)} />
}

/**
 * The bodies of the three horse styles: Bankura slip-burnished red to chocolate; Gorakhpur a
 * bright orange-red with ochre-picked ornament; Sonepur red with the dark smoke patches of a
 * chaff-pit firing.
 */
export function horseMaterials(m: ModelMaterials, style: HorseStyle): Record<string, THREE.Material> {
  if (style === 'gorakhpur')
    return { clay: tinted(m.terracotta, '#c4492b', { roughness: 0.62, envMapIntensity: 0.8 }), slip: tinted(m.terracotta, '#d9a24a', { roughness: 0.6 }), ornament: tinted(m.terracotta, '#b8401f', { roughness: 0.55, envMapIntensity: 0.9 }) }
  if (style === 'sonepur') return { clay: clayMaterial(m, 'terracotta', 0.2), slip: clayMaterial(m, 'red', 0.1), smoke: tinted(m.terracotta, '#2e2420', { roughness: 0.9 }) }
  // the body's red-to-chocolate slip and its baked occlusion are in the vertex colour; a burnished sheen
  // (a stone-polished red slip: tight highlights that run down the necks under a raking light)
  return { clay: tinted(m.terracotta, '#ffffff', { roughness: 0.28, envMapIntensity: 1.35, vertexColors: true }), slip: tinted(m.terracotta, '#2a140e', { roughness: 0.42, envMapIntensity: 0.7 }) }
}

/**
 * The horse's geometry, `H` metres tall, merged per material ('clay' body, 'slip' bands and
 * eyes) — for instanced use (the Parikrama's horse procession). The caller owns the result.
 */
export function buildHorseGeometry(H = 0.5): { clay: THREE.BufferGeometry; slip: THREE.BufferGeometry } {
  const built = horseBuilder(H).build()
  const get = (key: string) => built.find((p) => p.key === key)!.geometry
  return { clay: get('clay'), slip: get('slip') }
}

function horseBuilder(H: number, style: HorseStyle = 'bankura') {
    const b = new Builder()
    const k = H / 0.5 // model authored 0.5 m tall
    const legH = 0.17 * k
    const bodyY = legH + 0.035 * k
    const bodyL = 0.24 * k
    const bodyR = 0.045 * k
    // one continuous fired body (no stacked tubes): a sweep along the spine from the rump through
    // the back and chest, up the arched neck to the poll and down the long face to an open,
    // hollow mouth — the way a Bankura horse's thrown and joined parts read once paddled smooth
    const spineY = bodyY
    const spine = new THREE.CatmullRomCurve3(
      [
        [-0.125, 0.012],
        [-0.06, 0.0],
        [0.03, -0.002],
        [0.105, 0.008],
        [0.142, 0.07],
        [0.158, 0.15],
        [0.166, 0.214],
        [0.2, 0.224],
        [0.245, 0.19],
        [0.272, 0.158],
      ].map(([x, y]) => new THREE.Vector3(x * k, spineY + y * k, 0)),
      false,
      'centripetal',
    )
    // cross-section half-height / half-width along the spine (t 0 = rump, 1 = muzzle)
    const SEC: [number, number, number][] = [
      [0, 0.036, 0.034],
      [0.1, 0.047, 0.044],
      [0.28, 0.05, 0.046],
      [0.4, 0.056, 0.05],
      [0.5, 0.047, 0.041],
      [0.62, 0.037, 0.032],
      [0.72, 0.03, 0.026],
      [0.8, 0.027, 0.022],
      [0.92, 0.022, 0.019],
      [1, 0.026, 0.022],
    ]
    const secAt = (t: number) => {
      let i = 0
      while (i < SEC.length - 2 && SEC[i + 1][0] < t) i++
      const [t0, h0, w0] = SEC[i]
      const [t1, h1, w1] = SEC[i + 1]
      const f = THREE.MathUtils.smoothstep(t, t0, t1)
      return [(h0 + (h1 - h0) * f) * k, (w0 + (w1 - w0) * f) * k]
    }
    const RED = new THREE.Color('#d2683f')
    const CHOC = new THREE.Color('#5e2c1b')
    {
      const NA = 72
      const NR = 28
      // the open mouth: past the muzzle's rim the surface turns in and runs back into the head
      const LIP = [
        { back: 0.0, s: 0.86 },
        { back: 0.012, s: 0.72 },
        { back: 0.034, s: 0.62 },
      ]
      const rows = NA + 1 + LIP.length
      const pos: number[] = []
      const col: number[] = []
      const uv: number[] = []
      const end = spine.getPointAt(1)
      const endT = spine.getTangentAt(1)
      for (let j = 0; j < rows; j++) {
        const lip = j > NA ? LIP[j - NA - 1] : null
        const t = lip ? 1 : j / NA
        const p = lip ? end.clone().addScaledVector(endT, -lip.back * k) : spine.getPointAt(t)
        const T = spine.getTangentAt(t)
        const N = new THREE.Vector3(-T.y, T.x, 0).normalize()
        let [rh, rw] = secAt(t)
        if (lip) {
          rh *= lip.s
          rw *= lip.s
        }
        for (let i = 0; i <= NR; i++) {
          const a = (i / NR) * Math.PI * 2
          // flat-bottomed belly, a ridge along the back
          const c = Math.cos(a)
          const sn = Math.sin(a)
          const ridge = c > 0 ? 1 + 0.06 * Math.pow(c, 8) : 1 - 0.05 * Math.pow(-c, 2)
          const v = p.clone().addScaledVector(N, c * rh * ridge).add(new THREE.Vector3(0, 0, sn * rw))
          pos.push(v.x, v.y, v.z)
          uv.push((i / NR) * 0.3 * k, t * 0.6 * k)
          // slip-burnished red, darkening to chocolate at the muzzle, the mouth and the belly (AO)
          const toFace = THREE.MathUtils.smoothstep(t, 0.7, 1)
          const under = THREE.MathUtils.clamp(-c, 0, 1)
          const ao = lip ? 0.32 : 1 - 0.32 * Math.pow(under, 1.5)
          const cc = RED.clone().lerp(CHOC, 0.15 + 0.55 * toFace + 0.25 * under).multiplyScalar(ao)
          col.push(cc.r, cc.g, cc.b)
        }
      }
      // the rump: closed by a rounded fan
      const tail = spine.getPointAt(0)
      const tailIdx = pos.length / 3
      const tailP = tail.clone().addScaledVector(spine.getTangentAt(0), -0.018 * k)
      pos.push(tailP.x, tailP.y, tailP.z)
      uv.push(0, 0)
      const cr = RED.clone().lerp(CHOC, 0.25)
      col.push(cr.r, cr.g, cr.b)
      const idx: number[] = []
      for (let j = 0; j < rows - 1; j++)
        for (let i = 0; i < NR; i++) {
          const a = j * (NR + 1) + i
          const b2 = a + NR + 1
          idx.push(a, a + 1, b2, a + 1, b2 + 1, b2)
        }
      for (let i = 0; i < NR; i++) idx.push(tailIdx, i + 1, i)
      const g = new THREE.BufferGeometry()
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
      g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
      g.setIndex(idx)
      g.computeVertexNormals()
      b.add('clay', g)
    }
    // the neck's own curve (for the styles' collars and smoke) and the poll
    const neck = new THREE.CatmullRomCurve3([0.4, 0.5, 0.6, 0.7].map((t) => spine.getPointAt(t)))
    const poll = spine.getPointAt(0.74)
    const headY = poll.y
    // legs: thrown columns flaring to the hoof, chocolate towards the foot
    for (const lx of [-1, 1])
      for (const lz of [-1, 1]) {
        const leg = cyl(0.015 * k, 0.021 * k, legH + 0.05 * k, 14, false, 4)
        const lp = leg.getAttribute('position')
        const lc = new Float32Array(lp.count * 3)
        for (let i = 0; i < lp.count; i++) {
          const f = THREE.MathUtils.clamp(lp.getY(i) / (legH + 0.05 * k) + 0.5, 0, 1)
          const c = CHOC.clone().lerp(RED, 0.25 + 0.6 * f)
          lc.set([c.r, c.g, c.b], i * 3)
        }
        leg.setAttribute('color', new THREE.BufferAttribute(lc, 3))
        b.add('clay', leg, { p: [lx * (lx > 0 ? 0.09 : 0.085) * k, (legH + 0.05 * k) / 2, lz * 0.026 * k], r: [lz * 0.05, 0, -lx * 0.04] })
      }
    // flared, upright ears: flattened cones, open to the front
    for (const s of [-1, 1]) b.add('clay', cyl(0.003 * k, 0.017 * k, 0.09 * k, 12), { p: [poll.x - 0.004 * k, poll.y + 0.055 * k, s * 0.016 * k], r: [s * 0.24, 0, 0.1], s: [1, 1, 0.5], color: '#a8472b' })
    // the crest: a scalloped mane standing up along the back of the neck
    const mane = new THREE.Shape()
    const M = 9
    const back: THREE.Vector3[] = []
    for (let i = 0; i <= M; i++) back.push(spine.getPointAt(0.44 + (0.3 * i) / M))
    const nOut = (i: number) => {
      const T = spine.getTangentAt(0.44 + (0.3 * i) / M)
      return [T.y, -T.x]
    }
    mane.moveTo(back[0].x, back[0].y)
    for (let i = 0; i <= M; i++) {
      const p = back[i]
      const [nx, ny] = nOut(i)
      const r0 = secAt(0.44 + (0.3 * i) / M)[0]
      const out = r0 + (0.016 + 0.008 * Math.sin((i / M) * Math.PI) + (i % 2 ? 0.004 : -0.002)) * k
      mane.lineTo(p.x - nx * out, p.y - ny * out)
    }
    for (let i = M; i >= 0; i--) {
      const [nx, ny] = nOut(i)
      const r0 = secAt(0.44 + (0.3 * i) / M)[0] * 0.6
      mane.lineTo(back[i].x - nx * r0, back[i].y - ny * r0)
    }
    mane.closePath()
    const maneGeo = new THREE.ExtrudeGeometry(mane, { depth: 0.01 * k, bevelEnabled: true, bevelThickness: 0.003 * k, bevelSize: 0.003 * k, bevelSegments: 2, curveSegments: 4 })
    maneGeo.translate(0, 0, -0.005 * k)
    b.add('clay', maneGeo, { color: '#a34a2c' })
    // tail: a short upturned stub
    b.add('clay', cyl(0.007 * k, 0.014 * k, 0.07 * k, 10), { p: [-0.15 * k, spineY + 0.03 * k, 0], r: [0, 0, 0.75], color: '#8a3a22' })
    // incised eyes (no painted bands: the burnish carries the body)
    for (const s of [-1, 1]) b.add('slip', new THREE.SphereGeometry(0.0055 * k, 8, 6), { p: [poll.x + 0.028 * k, headY - 0.006 * k, s * 0.02 * k] })
    if (style === 'gorakhpur') {
      // applied ornament: bead collars on the neck, a breast band of hanging bells, a studded saddle cloth
      const bead = new THREE.SphereGeometry(0.0055 * k, 8, 6)
      for (let i = 0; i < 4; i++) {
        const t = 0.1 + i * 0.2
        const p = neck.getPointAt(t)
        const r = (0.041 - 0.015 * t) * k + 0.003 * k
        for (let j = 0; j < 14; j++) {
          const a = (j / 14) * Math.PI * 2
          b.add('ornament', bead, { p: [p.x + Math.cos(a) * r * 0.35, p.y + Math.sin(a) * r * 0.2, Math.sin(a) * r] })
        }
      }
      const bell = lathe(
        [
          [0, 0],
          [0.008, 0.002],
          [0.009, 0.01],
          [0.005, 0.016],
          [0, 0.017],
        ].map(([r, y]) => [r * k, y * k] as [number, number]),
        10,
      )
      for (let j = 0; j < 9; j++) {
        const z = (j / 8 - 0.5) * bodyR * 1.8
        b.add('slip', bell, { p: [bodyL / 2 + 0.012 * k, bodyY - bodyR * 0.95 - 0.017 * k, z] })
      }
      b.add('ornament', cyl(bodyR * 1.07, bodyR * 1.07, 0.06 * k, 24, true), { p: [-0.01 * k, bodyY, 0], r: [0, 0, Math.PI / 2] })
      for (let j = 0; j < 12; j++) {
        const a = (j / 12) * Math.PI - Math.PI / 2
        b.add('slip', bead, { p: [-0.01 * k + ((j % 3) - 1) * 0.018 * k, bodyY + Math.sin(a + Math.PI / 2) * bodyR * 1.08, Math.cos(a + Math.PI / 2) * bodyR * 1.08] })
      }
    }
    if (style === 'sonepur') {
      // smoke from the chaff pit: dark patches lying on the body, flank and neck
      const r = rng(Math.round(H * 1000))
      for (let i = 0; i < 9; i++) {
        const blot = new THREE.SphereGeometry(0.03 * k * (0.6 + r() * 0.7), 10, 6)
        blot.scale(1, 0.6, 0.25)
        const a = r() * Math.PI * 2
        const along = (r() - 0.5) * bodyL * 0.9
        b.add('smoke', blot, { p: [along, bodyY + Math.sin(a) * bodyR * 0.88, Math.cos(a) * bodyR * 0.88], r: [a, 0, 0] })
      }
      const p = neck.getPointAt(0.55)
      const blot = new THREE.SphereGeometry(0.03 * k, 10, 6)
      blot.scale(0.6, 1.2, 0.3)
      b.add('smoke', blot, { p: [p.x, p.y, 0.028 * k] })
    }
    return b
}

/* ------------------------------------------------------------------ */
/* votive-plaque                                                       */
/* ------------------------------------------------------------------ */

type PlaqueMotif = 'rider' | 'deity' | 'serpent' | 'procession' | 'canopy'
const MOTIFS: PlaqueMotif[] = ['rider', 'deity', 'serpent', 'procession', 'canopy']

/** Extruded shape from z = 0 to `depth` (+ a small bevel either side), with metre UVs. */
function extrude(shape: THREE.Shape, depth: number, bevel = depth * 0.3) {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 16 })
  g.translate(0, 0, bevel)
  // metre UVs from x/y
  const pos = g.getAttribute('position')
  const uv = g.getAttribute('uv')
  for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i), pos.getY(i))
  return g
}

const ellipse = (cx: number, cy: number, rx: number, ry: number) => {
  const s = new THREE.Shape()
  s.absellipse(cx, cy, rx, ry, 0, Math.PI * 2, false, 0)
  return s
}

/** Relief shapes (plaque-local, unit = plaque width 1, origin at the bottom centre) by paint colour. */
function motifShapes(motif: PlaqueMotif): Record<'ochre' | 'white' | 'red' | 'dark', THREE.Shape[]> {
  const out = { ochre: [] as THREE.Shape[], white: [] as THREE.Shape[], red: [] as THREE.Shape[], dark: [] as THREE.Shape[] }
  if (motif === 'rider') {
    out.white.push(ellipse(0, 0.5, 0.26, 0.11)) // horse body
    out.white.push(ellipse(0.27, 0.66, 0.05, 0.15)) // neck
    out.white.push(ellipse(0.33, 0.8, 0.09, 0.045)) // head
    for (const x of [-0.18, -0.09, 0.1, 0.19]) out.white.push(ellipse(x, 0.33, 0.025, 0.1)) // legs
    out.red.push(ellipse(-0.02, 0.72, 0.07, 0.13)) // rider body
    out.ochre.push(ellipse(-0.02, 0.92, 0.055, 0.06)) // rider head
    out.dark.push(ellipse(-0.08, 0.53, 0.12, 0.03)) // saddle cloth
  } else if (motif === 'deity') {
    const canopy = new THREE.Shape()
    canopy.moveTo(-0.36, 0.9)
    canopy.quadraticCurveTo(0, 1.2, 0.36, 0.9)
    canopy.lineTo(0.32, 0.86)
    canopy.quadraticCurveTo(0, 1.12, -0.32, 0.86)
    canopy.closePath()
    out.ochre.push(canopy)
    out.red.push(ellipse(0, 0.5, 0.2, 0.2)) // seated body / lap
    out.white.push(ellipse(0, 0.78, 0.075, 0.085)) // head
    out.ochre.push(ellipse(0, 0.885, 0.06, 0.03)) // crown
    for (const s of [-1, 1]) out.white.push(ellipse(s * 0.2, 0.56, 0.035, 0.12)) // arms
    out.dark.push(ellipse(0, 0.27, 0.27, 0.04)) // seat
  } else if (motif === 'procession') {
    // three small riders in a row under a band of dots (a frieze plaque)
    for (const [i, x] of [-0.3, 0, 0.3].entries()) {
      const y = 0.42 + (i === 1 ? 0.06 : 0)
      out.white.push(ellipse(x, y, 0.11, 0.05))
      out.white.push(ellipse(x + 0.1, y + 0.08, 0.025, 0.07))
      out.white.push(ellipse(x + 0.13, y + 0.15, 0.04, 0.022))
      for (const dx of [-0.07, 0.07]) out.white.push(ellipse(x + dx, y - 0.08, 0.014, 0.05))
      out.red.push(ellipse(x - 0.01, y + 0.11, 0.035, 0.06))
      out.ochre.push(ellipse(x - 0.01, y + 0.2, 0.026, 0.028))
    }
    for (let i = 0; i < 9; i++) out.ochre.push(ellipse(-0.36 + i * 0.09, 0.86, 0.022, 0.022))
    out.dark.push(ellipse(0, 0.27, 0.42, 0.025))
  } else if (motif === 'canopy') {
    // a standing figure in a shrine: two pillars, a stepped canopy, a lotus base
    for (const sx of [-1, 1]) out.ochre.push(ellipse(sx * 0.3, 0.55, 0.035, 0.3))
    const roof = new THREE.Shape()
    roof.moveTo(-0.4, 0.86)
    roof.lineTo(0.4, 0.86)
    roof.lineTo(0.28, 0.96)
    roof.lineTo(0.12, 0.98)
    roof.quadraticCurveTo(0, 1.14, -0.12, 0.98)
    roof.lineTo(-0.28, 0.96)
    roof.closePath()
    out.red.push(roof)
    out.white.push(ellipse(0, 0.74, 0.06, 0.07))
    out.red.push(ellipse(0, 0.52, 0.11, 0.17))
    for (const sx of [-1, 1]) out.white.push(ellipse(sx * 0.13, 0.55, 0.025, 0.11))
    out.dark.push(ellipse(0, 0.3, 0.2, 0.045))
    for (let i = 0; i < 5; i++) out.ochre.push(ellipse(-0.16 + i * 0.08, 0.26, 0.035, 0.02))
  } else {
    // hooded serpent: coils + raised hood
    for (let i = 0; i < 3; i++) out.white.push(ellipse(0, 0.26 + i * 0.12, 0.28 - i * 0.06, 0.06))
    out.red.push(ellipse(0, 0.72, 0.17, 0.2)) // hood
    out.ochre.push(ellipse(0, 0.74, 0.08, 0.12)) // hood mark
    out.white.push(ellipse(0, 0.93, 0.06, 0.05)) // head
  }
  return out
}

export function VotivePlaque({ config }: ModelProps) {
  const m = useModelMaterials()
  const motifS = str(config, 'motif', 'rider')
  const motif: PlaqueMotif = (MOTIFS as string[]).includes(motifS) ? (motifS as PlaqueMotif) : 'rider'
  // `size` (the plaque's height, up to 1.1 m for the niche wall) wins over the object's height
  const sizeP = config.props?.size
  const H = typeof sizeP === 'number' ? sizeP : (config.height ?? 0.38)
  const fx = typeof sizeP === 'number' ? sizeP * 0.7 : fp(config, [0.26, 0.26])[0]
  const parts = useBuilt(geoKey('votive-plaque', config), () => {
    const b = new Builder()
    const W = fx * 0.9
    const ph = H - 0.03 // plaque height above its stand
    // a real slab and real relief: modelled up 3 % of the plaque's height (≥ 15 mm on the niche
    // wall's 0.6–1.1 m plaques), so raking light from the niche head models every figure
    const T = Math.max(0.025, H * 0.05)
    const RELIEF = Math.max(0.005, H * 0.026)
    const lean = -0.12
    // arched slab
    const slab = new THREE.Shape()
    slab.moveTo(-W / 2, 0)
    slab.lineTo(W / 2, 0)
    slab.lineTo(W / 2, ph - W / 2)
    slab.absarc(0, ph - W / 2, W / 2, 0, Math.PI, false)
    slab.lineTo(-W / 2, 0)
    const SB = 0.003
    const slabG = extrude(slab, T - 2 * SB, SB)
    slabG.translate(0, 0, -T / 2)
    // front face of the slab (painted parts sit just proud of it)
    const front = T / 2 + 0.0004
    const tilt = (g: THREE.BufferGeometry, z: number) => {
      g.translate(0, 0, z)
      g.rotateX(lean)
      g.translate(0, 0.03, 0)
      return g
    }
    b.add('clay', tilt(slabG, 0))
    // painted border band
    const border = new THREE.Shape()
    border.moveTo(-W / 2 + 0.008, 0.008)
    border.lineTo(W / 2 - 0.008, 0.008)
    border.lineTo(W / 2 - 0.008, ph - W / 2)
    border.absarc(0, ph - W / 2, W / 2 - 0.008, 0, Math.PI, false)
    border.closePath()
    const hole = new THREE.Path()
    hole.moveTo(-W / 2 + 0.02, 0.02)
    hole.lineTo(W / 2 - 0.02, 0.02)
    hole.lineTo(W / 2 - 0.02, ph - W / 2)
    hole.absarc(0, ph - W / 2, W / 2 - 0.02, 0, Math.PI, false)
    hole.closePath()
    border.holes.push(hole)
    b.add('red', tilt(extrude(border, 0.0015, 0), front))
    // relief
    const shapes = motifShapes(motif)
    const sc = W * 0.82
    for (const [key, list] of Object.entries(shapes)) {
      for (const sh of list) {
        const g = extrude(sh, RELIEF * 0.55, RELIEF * 0.45)
        g.scale(sc, ph / 1.1, 1)
        g.translate(0, 0.01, 0)
        b.add(key, tilt(g, front))
      }
    }
    // small stand behind the foot
    b.add('clay', rbox(W * 0.7, 0.03, 0.08, 0.006), { p: [0, 0.015, 0] })
    return b
  })
  const clay = clayMaterial(m, 'terracotta', 0.1)
  // unpainted fired terracotta carries the relief; the slip colours are sparse and worn
  return (
    <Parts
      parts={parts}
      materials={{
        clay,
        red: tinted(m.terracotta, '#9a4630', { roughness: 0.9 }),
        ochre: tinted(m.terracotta, '#c08a5c', { roughness: 0.9 }),
        white: tinted(m.terracotta, '#c99a7c', { roughness: 0.9 }),
        dark: tinted(m.terracotta, '#6a3a2a', { roughness: 0.9 }),
      }}
    />
  )
}

/* ------------------------------------------------------------------ */
/* oculus-plinth                                                       */
/* ------------------------------------------------------------------ */

/**
 * The pool court under the oculus (GRAND §2.5, p07l) on the drawn rings (MUSEUM.oculus.rings): a
 * low curb (its top at the curb height, a brass edge drawn by the water ring) round a pool set
 * into the floor, its floor a dark basin under one full disc of still water. No island shows:
 * the lotus floats on the water. The curb's outer edge is the layout's solid 'oculus-plinth'
 * collider.
 */
export const OCULUS_PLINTH = (() => {
  const [curb, pool, island, centre] = MUSEUM.oculus.rings
  const top = MUSEUM.oculus.curbHeight
  const floor = MUSEUM.oculus.poolLevel - 0.06
  // the island and its centre stay as numbers (older pieces measure from them), sunk under the water
  return { curb: { r: curb, y: top }, pool: { r: pool, y: floor }, island: { r: island, y: floor }, centre: { r: centre, y: floor }, top }
})()

export function OculusPlinth() {
  const m = useModelMaterials()
  const parts = useBuilt('oculus-plinth', () => {
    const b = new Builder()
    const full = Math.PI * 2
    const P = OCULUS_PLINTH
    // crisp faces only (no lathe: its averaged normals would round every step)
    const add = (key: string, ...g: (THREE.BufferGeometry | null)[]) => g.forEach((x) => x && b.add(key, x))
    // the curb: outer face, top, and its inner face down to the pool's floor
    add('step0', cylinderFace(0, 0, P.curb.r, 0, full, 0, P.curb.y, 'out'), annulusFace(0, 0, P.pool.r, P.curb.r, 0, full, P.curb.y, true), cylinderFace(0, 0, P.pool.r, 0, full, P.pool.y, P.curb.y, 'in'))
    // the pool's floor, under the water
    add('step1', annulusFace(0, 0, 0, P.pool.r, 0, full, P.pool.y, true))
    return b
  })
  // a dark stone curb and a black basin: the pool reads as still water holding the sky
  const curb = tinted(m.terracotta, '#2a1712', { roughness: 0.55, envMapIntensity: 0.5 })
  const basin = tinted(m.terracotta, '#07080a', { roughness: 0.6, envMapIntensity: 0.2 })
  return <Parts parts={parts} materials={{ step0: curb, step1: basin }} />
}

/* ------------------------------------------------------------------ */
/* podium (loose)                                                      */
/* ------------------------------------------------------------------ */

export function Podium({ config }: ModelProps) {
  const m = useModelMaterials()
  const H = num(config, 'height', config.height ?? MUSEUM.podium.height)
  // a bracket or stand with no collider gives its size as props w / d instead of a footprint
  const [fx, fz] = fp(config, [num(config, 'w', MUSEUM.podium.size), num(config, 'd', MUSEUM.podium.size)])
  const vitrine = str(config, 'top', 'plain') === 'vitrine'
  const parts = useBuilt(geoKey('podium', config), () => {
    const b = new Builder()
    b.add('gap', rbox(fx - 0.02, 0.025, fz - 0.02, 0.002), { p: [0, 0.0125, 0] })
    b.add('body', rbox(fx, H - 0.025, fz, 0.004), { p: [0, 0.025 + (H - 0.025) / 2, 0] })
    if (vitrine) b.add('glass', rbox(fx - 0.01, fx * 1.1, fz - 0.01, 0.002), { p: [0, H + (fx * 1.1) / 2, 0] })
    return b
  })
  return <Parts parts={parts} materials={{ body: m.oxblood, gap: m.shadowGap, glass: m.glass }} />
}

/* ------------------------------------------------------------------ */
/* clay-shelf                                                          */
/* ------------------------------------------------------------------ */

/**
 * Drying shelf: timber uprights and planks, each plank carrying a row of pots — leather-hard
 * (`fired: false`, or a title that says "unfired") or fired terracotta.
 */
export function ClayShelf({ config }: ModelProps) {
  const m = useModelMaterials()
  const W = num(config, 'width', fp(config, [1.6, 0.34])[0])
  const D = fp(config, [W, 0.34])[1]
  const H = config.height ?? 1.9
  const rows = Math.max(1, Math.min(6, Math.round(num(config, 'rows', 3))))
  const firedProp = config.props?.fired
  const fired = typeof firedProp === 'boolean' ? firedProp : !/unfired/i.test(config.title)
  const parts = useBuilt(geoKey('clay-shelf', config, String(fired)), () => {
    const b = new Builder()
    const post = 0.045
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.add('wood', rbox(post, H, post, 0.004), { p: [sx * (W / 2 - post / 2), H / 2, sz * (D / 2 - post / 2)] })
    const pitch = (H - 0.12) / rows
    const r = rng(config.id)
    for (let i = 0; i < rows; i++) {
      const y = 0.12 + i * pitch
      b.add('plank', rbox(W - 0.01, 0.028, D, 0.004, 2, 'x'), { p: [0, y, 0] })
      // pots along the plank
      let x = -W / 2 + 0.08
      while (x < W / 2 - 0.12) {
        const form = (['matka', 'kulhad', 'bowl', 'matka', 'surahi'] as VesselForm[])[Math.floor(r() * 5)]
        const h = Math.min(pitch - 0.08, form === 'kulhad' ? 0.09 + r() * 0.03 : form === 'bowl' ? 0.07 + r() * 0.03 : form === 'surahi' ? 0.24 + r() * 0.04 : 0.15 + r() * 0.06)
        const R = form === 'surahi' ? h * 0.38 : form === 'bowl' ? h * 1.1 : form === 'kulhad' ? h * 0.45 : h * 0.55
        if (x + R > W / 2 - 0.06) break
        addVessel(b, 'pot', form, R, h, [x + R, y + 0.014, (r() - 0.5) * (D - 2 * R - 0.04) * 0.6], r() * Math.PI * 2)
        x += 2 * R + 0.03 + r() * 0.05
      }
    }
    return b
  })
  const pot = fired ? clayMaterial(m, 'terracotta', 0.05) : tinted(m.terracotta, UNFIRED, { roughness: 0.97 })
  return <Parts parts={parts} materials={{ wood: m.darkTimber, plank: m.oak, pot }} />
}
