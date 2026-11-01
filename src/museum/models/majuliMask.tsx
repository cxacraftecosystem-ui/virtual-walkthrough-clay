/**
 * 'majuli-mask' — a mask in the manner of the satras of Majuli, Assam (GRAND §4.2, §4.3;
 * CRAFTS D9): a frame of split bamboo woven into a shell, covered in cloth dipped in clay,
 * modelled while wet, dried, then painted. Shown as generic forms, oversized as the satra masks
 * are (about a metre tall), hung on the wall from a bamboo bracket ("clay as skin"), never as any
 * named character:
 *
 *   form  face  a broad oval face under a raised crown band: heavy brows, bulging almond eyes,
 *               a long nose with flared wings, full cheeks, closed lips, a rounded chin
 *         bird  round staring eyes in raised rings, a long hooked beak modelled out from the face,
 *               a crest of feather ridges
 *         lion  a snout and a broad nose pad, bulging eyes under a heavy brow, an open mouth
 *               with fangs, a mane of radiating ridges round the face
 *   paint muted earth paints (ochre, red earth, soot, chalk) worn back to the clay; false shows
 *         the bare grey clay-cloth skin
 *
 * The face is sculpted (models/sculpt.ts heightField): a domed relief over the mask's oval, the
 * features modelled in it, the paint laid over them on a canvas registered to the same plan. The
 * woven bamboo shell is larger than the skin, so its weave shows all round it as a border held
 * by a bamboo hoop; the back is open, so the weave shows inside too. Origin on the floor below
 * the mask, the wall 0.2 m behind it (-z); the mask faces +z, its centre at about 1.75 m (the
 * object's height scales it).
 */
import { useMemo } from 'react'
import * as THREE from 'three'
import { Builder, cyl, Parts, rbox, type BuiltParts } from './kit'
import { tinted, useModelMaterials } from './modelMaterials'
import { fbm, gauss, heightField, keyedLoft, sculptDetailFor, withSculptDetail } from './sculpt'
import { useMuseum } from '../state/store'
import { str, type ModelProps } from './types'

type Form = 'face' | 'bird' | 'lion'

/** The weave seen round and inside the shell: a canvas of over-and-under strips. */
let weave: THREE.CanvasTexture | null = null
function weaveTexture() {
  if (!weave) {
    const c = document.createElement('canvas')
    c.width = c.height = 128
    const g = c.getContext('2d')!
    g.fillStyle = '#6e5634'
    g.fillRect(0, 0, 128, 128)
    for (let i = 0; i < 8; i++)
      for (let j = 0; j < 8; j++) {
        const over = (i + j) % 2 === 0
        g.fillStyle = over ? '#c9a868' : '#b08e52'
        if (over) g.fillRect(i * 16 + 1, j * 16 + 3, 14, 10)
        else g.fillRect(i * 16 + 3, j * 16 + 1, 10, 14)
      }
    weave = new THREE.CanvasTexture(c)
    weave.colorSpace = THREE.SRGBColorSpace
    weave.wrapS = weave.wrapT = THREE.RepeatWrapping
    weave.repeat.set(6, 6)
  }
  return weave
}

/** A shell: the front half of an ellipsoid (rx, ry, rz), opening to the back. */
function shell(rx: number, ry: number, rz: number) {
  const g = new THREE.SphereGeometry(1, 28, 20, 0, Math.PI)
  g.scale(rx, ry, rz)
  return g
}

/* ------------------------------------------------------------------ */
/* The sculpted faces — X, Y in -1..1 over the mask's oval            */
/* ------------------------------------------------------------------ */

/** Proportions of each form: half width, half height (m at height 1.9). */
const SIZE: Record<Form, [number, number]> = { face: [0.42, 0.55], bird: [0.42, 0.52], lion: [0.5, 0.55] }
/** Outline (polar multiplier) per form: the face narrows to its chin. */
const OUTLINE: Record<Form, (a: number) => number> = {
  face: (a) => 1 - 0.13 * Math.pow(Math.max(0, -Math.sin(a)), 2),
  bird: (a) => 1 - 0.06 * Math.pow(Math.max(0, -Math.sin(a)), 2),
  lion: () => 1,
}

const band = (v: number, c: number, s: number) => Math.exp(-(((v - c) / s) ** 2))

/** Relief (in units of the mask's depth) at (X, Y), r the polar radius 0..1. */
function relief(form: Form, X: number, Y: number, r: number): number {
  // the dome: full in the middle, turning back at the rim
  let z = Math.sqrt(Math.max(0, 1 - r * r * 0.9)) * 0.85 + 0.15 * (1 - r)
  const ax = Math.abs(X)
  if (form === 'face') {
    // a raised crown band with bosses
    z += 0.1 * band(Y, 0.8, 0.05) * (ax < 0.8 ? 1 : 0) + 0.06 * band(Y, 0.8, 0.05) * Math.max(0, Math.cos(X * 18))
    // the brows: a ridge arching over each eye
    z += 0.16 * band(Y, 0.32 + 0.06 * Math.cos(((ax - 0.36) / 0.4) * Math.PI), 0.05) * band(ax, 0.36, 0.25)
    // eyes: bulging almonds under a lid
    const eye = Math.max(0, 1 - ((ax - 0.35) / 0.18) ** 2 - ((Y - 0.14) / 0.085) ** 2)
    z += 0.16 * Math.sqrt(eye) - 0.06 * band(Y, 0.24, 0.04) * band(ax, 0.35, 0.16)
    // the nose: a ridge that grows to a rounded tip, the wings flared either side
    const along = THREE.MathUtils.clamp((0.24 - Y) / 0.5, 0, 1)
    z += (0.06 + 0.24 * along * along) * band(X, 0, 0.08 + 0.07 * along) * (Y > -0.3 ? 1 : 0.3 * band(Y, -0.3, 0.05))
    z += 0.12 * gauss(X, Y, 0, -0.24, 0.1, 0.07) + 0.1 * (gauss(X, Y, 0.13, -0.27, 0.07, 0.05) + gauss(X, Y, -0.13, -0.27, 0.07, 0.05))
    // full cheeks
    z += 0.1 * (gauss(X, Y, 0.5, -0.18, 0.22, 0.2) + gauss(X, Y, -0.5, -0.18, 0.22, 0.2))
    // closed lips, a groove between them, the chin
    z += 0.1 * gauss(X, Y, 0, -0.5, 0.24, 0.05) + 0.1 * gauss(X, Y, 0, -0.61, 0.19, 0.055) - 0.07 * band(Y, -0.555, 0.018) * band(X, 0, 0.22)
    z += 0.09 * gauss(X, Y, 0, -0.82, 0.18, 0.09)
  } else if (form === 'bird') {
    // round staring eyes, each in a raised ring
    const d = Math.hypot(ax - 0.38, Y - 0.2)
    z += 0.18 * Math.sqrt(Math.max(0, 1 - (d / 0.15) ** 2)) + 0.12 * band(d, 0.19, 0.03)
    // a heavy brow running into the beak's root
    z += 0.12 * band(Y, 0.42 - 0.12 * Math.max(0, 0.4 - ax), 0.05) * band(ax, 0.3, 0.3)
    z += 0.14 * gauss(X, Y, 0, 0.12, 0.14, 0.14)
    // the crest: feather ridges fanning up from the brow
    if (Y > 0.45) {
      const ang = Math.atan2(Y - 0.3, X)
      z += 0.09 * Math.abs(Math.sin(ang * 9)) * THREE.MathUtils.smoothstep(Y, 0.45, 0.62)
    }
    // feathered cheeks: scallops in rows
    if (Y < 0.05) z += 0.05 * Math.max(0, Math.sin(X * 14) * Math.sin(Y * 16 + (Math.floor(Y * 5) % 2) * 1.5))
  } else {
    // the mane: radiating ridges round the face
    const ang = Math.atan2(Y, X)
    const mane = THREE.MathUtils.smoothstep(r, 0.62, 0.78)
    z += mane * (0.16 * Math.abs(Math.sin(ang * 13 + r * 4)) + 0.06) - 0.08 * band(r, 0.66, 0.03)
    // a heavy brow, bulging eyes
    z += 0.2 * band(Y, 0.36 - 0.06 * ax, 0.07) * band(ax, 0.32, 0.26)
    const eye = Math.max(0, 1 - ((ax - 0.32) / 0.13) ** 2 - ((Y - 0.2) / 0.09) ** 2)
    z += 0.18 * Math.sqrt(eye)
    // the snout, the nose pad on it
    z += 0.26 * gauss(X, Y, 0, -0.22, 0.32, 0.26) + 0.12 * gauss(X, Y, 0, -0.06, 0.15, 0.08)
    z += 0.08 * (gauss(X, Y, 0.17, -0.3, 0.12, 0.1) + gauss(X, Y, -0.17, -0.3, 0.12, 0.1))
    // the open mouth: a deep cavity with fangs at its corners
    const m = Math.max(0, 1 - (X / 0.3) ** 2 - ((Y + 0.52) / 0.11) ** 2)
    z -= 0.42 * Math.sqrt(m)
    z += 0.16 * (gauss(X, Y, 0.16, -0.47, 0.03, 0.05) + gauss(X, Y, -0.16, -0.47, 0.03, 0.05))
    z += 0.06 * gauss(X, Y, 0, -0.72, 0.22, 0.08)
  }
  return z
}

/**
 * The paint of a form, laid flat on the modelled skin and registered to it: canvas x = (X+1)/2,
 * canvas y = (1−Y)/2 (Y up).
 */
const faces = new Map<Form, THREE.CanvasTexture>()
function faceTexture(form: Form): THREE.CanvasTexture {
  const hit = faces.get(form)
  if (hit) return hit
  const W = 1024
  const c = document.createElement('canvas')
  c.width = c.height = W
  const g = c.getContext('2d')!
  const X = (x: number) => ((x + 1) / 2) * W
  const Y = (y: number) => ((1 - y) / 2) * W
  const R = (r: number) => (r / 2) * W
  const ground = form === 'face' ? '#c58f58' : form === 'bird' ? '#6f7356' : '#c99a3e'
  g.fillStyle = ground
  g.fillRect(0, 0, W, W)
  // the paint pooled and darker round the rim, paler on the high points
  const vig = g.createRadialGradient(W / 2, W / 2, W * 0.2, W / 2, W / 2, W * 0.52)
  vig.addColorStop(0, 'rgba(255,240,210,0.10)')
  vig.addColorStop(1, 'rgba(40,20,10,0.45)')
  g.fillStyle = vig
  g.fillRect(0, 0, W, W)
  let seed = form.length * 97 + 11
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647
  const ink = '#1d1612'
  const almond = (cx: number, cy: number, rw: number, rh: number, fill: string, iris = R(rh) * 0.95) => {
    g.fillStyle = fill
    g.strokeStyle = ink
    g.lineWidth = W * 0.008
    g.beginPath()
    g.moveTo(X(cx - rw), Y(cy))
    g.quadraticCurveTo(X(cx), Y(cy + rh * 1.6), X(cx + rw), Y(cy))
    g.quadraticCurveTo(X(cx), Y(cy - rh * 1.6), X(cx - rw), Y(cy))
    g.fill()
    g.stroke()
    g.fillStyle = ink
    g.beginPath()
    g.arc(X(cx), Y(cy), iris, 0, Math.PI * 2)
    g.fill()
    g.fillStyle = 'rgba(255,255,255,0.7)'
    g.beginPath()
    g.arc(X(cx) - iris * 0.3, Y(cy) - iris * 0.3, iris * 0.22, 0, Math.PI * 2)
    g.fill()
  }
  const stroke = (pts: [number, number][], w: number, col: string) => {
    g.strokeStyle = col
    g.lineWidth = W * w
    g.lineCap = 'round'
    g.lineJoin = 'round'
    g.beginPath()
    g.moveTo(X(pts[0][0]), Y(pts[0][1]))
    if (pts.length === 3) g.quadraticCurveTo(X(pts[1][0]), Y(pts[1][1]), X(pts[2][0]), Y(pts[2][1]))
    else for (const p of pts.slice(1)) g.lineTo(X(p[0]), Y(p[1]))
    g.stroke()
  }
  if (form === 'face') {
    // crown band in red earth with chalk bosses
    g.fillStyle = '#8a3524'
    g.fillRect(X(-0.82), Y(0.87), R(1.64), R(0.15))
    g.fillStyle = '#e6d6b4'
    for (let i = 0; i < 9; i++) {
      g.beginPath()
      g.arc(X(-0.7 + i * 0.175), Y(0.8), R(0.035), 0, Math.PI * 2)
      g.fill()
    }
    // soot brows, sweeping out
    for (const s of [-1, 1])
      stroke(
        [
          [s * 0.14, 0.3],
          [s * 0.38, 0.42],
          [s * 0.66, 0.3],
        ],
        0.022,
        ink,
      )
    for (const s of [-1, 1]) almond(s * 0.35, 0.14, 0.17, 0.055, '#efe4cc')
    // kohl lines extending the eyes
    for (const s of [-1, 1])
      stroke(
        [
          [s * 0.52, 0.14],
          [s * 0.62, 0.17],
        ],
        0.008,
        ink,
      )
    // nose wings and nostrils
    g.fillStyle = '#3a2418'
    for (const s of [-1, 1]) {
      g.beginPath()
      g.ellipse(X(s * 0.08), Y(-0.31), R(0.035), R(0.02), 0, 0, Math.PI * 2)
      g.fill()
    }
    // red lips
    g.fillStyle = '#8f2a1c'
    g.beginPath()
    g.ellipse(X(0), Y(-0.5), R(0.22), R(0.05), 0, 0, Math.PI * 2)
    g.fill()
    g.beginPath()
    g.ellipse(X(0), Y(-0.61), R(0.17), R(0.055), 0, 0, Math.PI * 2)
    g.fill()
    stroke(
      [
        [-0.22, -0.555],
        [0, -0.565],
        [0.22, -0.555],
      ],
      0.006,
      ink,
    )
    // a tilak and cheek dots
    g.fillStyle = '#8f2a1c'
    g.fillRect(X(-0.015), Y(0.62), R(0.03), R(0.2))
    g.fillStyle = '#e6d6b4'
    for (const s of [-1, 1])
      for (let i = 0; i < 3; i++) {
        g.beginPath()
        g.arc(X(s * (0.5 + i * 0.06)), Y(-0.12 - i * 0.05), R(0.012), 0, Math.PI * 2)
        g.fill()
      }
  } else if (form === 'bird') {
    // ochre rings round the staring eyes
    for (const s of [-1, 1]) {
      g.fillStyle = '#d2a446'
      g.beginPath()
      g.arc(X(s * 0.38), Y(0.2), R(0.2), 0, Math.PI * 2)
      g.fill()
      g.fillStyle = '#8a3524'
      g.beginPath()
      g.arc(X(s * 0.38), Y(0.2), R(0.15), 0, Math.PI * 2)
      g.fill()
      g.fillStyle = '#efe4cc'
      g.beginPath()
      g.arc(X(s * 0.38), Y(0.2), R(0.11), 0, Math.PI * 2)
      g.fill()
      g.fillStyle = ink
      g.beginPath()
      g.arc(X(s * 0.38), Y(0.2), R(0.06), 0, Math.PI * 2)
      g.fill()
    }
    // the crest's feathers, red and chalk
    for (let i = 0; i < 9; i++) {
      const a = Math.PI * (0.18 + (0.64 * i) / 8)
      stroke(
        [
          [Math.cos(a) * 0.2, 0.3 + Math.sin(a) * 0.2],
          [Math.cos(a) * 0.7, 0.3 + Math.sin(a) * 0.62],
        ],
        0.03,
        i % 2 ? '#8a3524' : '#d9c79e',
      )
    }
    // feathered cheeks
    g.strokeStyle = 'rgba(30,24,16,0.55)'
    g.lineWidth = W * 0.005
    for (let row = 0; row < 5; row++)
      for (let i = -6; i <= 6; i++) {
        g.beginPath()
        g.arc(X(i * 0.14 + (row % 2) * 0.07), Y(-0.05 - row * 0.15), R(0.07), 0.15 * Math.PI, 0.85 * Math.PI)
        g.stroke()
      }
  } else {
    // lion: a red-brown mane in strokes, soot brows, chalk muzzle, a red mouth, chalk fangs
    for (let i = 0; i < 52; i++) {
      const a = (i / 52) * Math.PI * 2
      stroke(
        [
          [Math.cos(a) * 0.66, Math.sin(a) * 0.66],
          [Math.cos(a + 0.08) * 0.97, Math.sin(a + 0.08) * 0.97],
        ],
        0.022,
        i % 3 === 0 ? '#5a2416' : '#8a3524',
      )
    }
    g.fillStyle = '#e2d2ae'
    g.beginPath()
    g.ellipse(X(0), Y(-0.28), R(0.34), R(0.26), 0, 0, Math.PI * 2)
    g.fill()
    for (const s of [-1, 1])
      stroke(
        [
          [s * 0.1, 0.36],
          [s * 0.34, 0.46],
          [s * 0.56, 0.32],
        ],
        0.03,
        ink,
      )
    for (const s of [-1, 1]) almond(s * 0.32, 0.2, 0.13, 0.06, '#e9cf7a', R(0.05))
    g.fillStyle = '#2a1a14'
    g.beginPath()
    g.ellipse(X(0), Y(-0.06), R(0.13), R(0.07), 0, 0, Math.PI * 2)
    g.fill()
    g.fillStyle = '#6e1a12'
    g.beginPath()
    g.ellipse(X(0), Y(-0.52), R(0.31), R(0.12), 0, 0, Math.PI * 2)
    g.fill()
    g.fillStyle = '#efe4cc'
    for (const s of [-1, 1]) {
      g.beginPath()
      g.moveTo(X(s * 0.19), Y(-0.43))
      g.lineTo(X(s * 0.13), Y(-0.43))
      g.lineTo(X(s * 0.16), Y(-0.53))
      g.closePath()
      g.fill()
    }
    // whisker dots
    g.fillStyle = ink
    for (const s of [-1, 1]) for (let i = 0; i < 4; i++) g.fillRect(X(s * (0.14 + i * 0.05)) - 3, Y(-0.2 - (i % 2) * 0.04) - 3, 6, 6)
  }
  // the paint worn back to the clay-cloth in flakes and rubbed patches
  for (let i = 0; i < 420; i++) {
    const big = rnd() > 0.9
    g.fillStyle = rnd() > 0.45 ? `rgba(156,146,130,${big ? 0.25 : 0.4})` : 'rgba(50,32,22,0.16)'
    g.beginPath()
    g.ellipse(rnd() * W, rnd() * W, (big ? 14 : 2) + rnd() * (big ? 30 : 6), (big ? 8 : 1.5) + rnd() * (big ? 16 : 4), rnd() * 3, 0, Math.PI * 2)
    g.fill()
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  faces.set(form, t)
  return t
}

const cache = new Map<string, BuiltParts>()

function build(form: Form, H: number): BuiltParts {
  const b = new Builder()
  const k = H / 1.9
  const cy = 1.75 * k
  // the wall bracket: a bamboo cross-piece the mask is lashed to, on two pegs into the wall
  b.add('bamboo', cyl(0.018 * k, 0.018 * k, 0.62 * k, 10), { p: [0, cy + 0.08 * k, -0.17 * k], r: [0, 0, Math.PI / 2] })
  for (const sx of [-1, 1]) b.add('bamboo', cyl(0.014 * k, 0.014 * k, 0.12 * k, 8), { p: [sx * 0.24 * k, cy + 0.08 * k, -0.21 * k], r: [Math.PI / 2, 0, 0] })
  b.add('stand', rbox(0.7 * k, 0.06 * k, 0.02 * k, 0.004), { p: [0, cy + 0.08 * k, -0.2 * k] })
  const [w0, h0] = SIZE[form]
  const w = w0 * k
  const h = h0 * k
  const D = 0.2 * k
  // the painted, modelled skin: a relief over the oval, a little hand-pressed unevenness in it
  const skin = heightField(w, h, (x, y, r) => D * relief(form, x / w, y / h, r) + 0.004 * k * fbm(x * 9, y * 9, 1, 2), {
    rings: 72,
    segs: 128,
    outline: OUTLINE[form],
  })
  b.add('skin', skin, { p: [0, cy, -0.02 * k] })
  if (form === 'bird') {
    // the beak, modelled out from the face: a long hooked point
    const z0 = -0.02 * k + D * 1.05
    const beak = keyedLoft(
      [new THREE.Vector3(0, cy + 0.02 * h, z0 - 0.06 * k), new THREE.Vector3(0, cy - 0.14 * h, z0 + 0.12 * k), new THREE.Vector3(0, cy - 0.34 * h, z0 + 0.24 * k), new THREE.Vector3(0, cy - 0.58 * h, z0 + 0.26 * k), new THREE.Vector3(0, cy - 0.72 * h, z0 + 0.18 * k)],
      [
        [0.09 * k, 0.12 * k],
        [0.075 * k, 0.09 * k],
        [0.055 * k, 0.06 * k],
        [0.03 * k, 0.03 * k],
        [0.006 * k, 0.008 * k],
      ],
      // a keel along the top of the beak
      { shape: (_t, a) => 1 + 0.18 * Math.pow(Math.max(0, Math.cos(a)), 6) },
    )
    b.add('beak', beak.loft.geometry({ rows: 40, cols: 28, capStart: true, capEnd: true }))
  }
  // the woven bamboo shell: larger than the skin, so its weave shows all round it as a border,
  // and the weave inside, seen round the open back
  b.add('weave', shell(w * 1.2, h * 1.14, 0.12 * k), { p: [0, cy, -0.05 * k] })
  // the bamboo hoop that holds the weave's edge
  const hoop = new THREE.TorusGeometry(1, 0.022, 6, 64)
  hoop.scale(w * 1.2, h * 1.14, 1)
  b.add('bamboo', hoop, { p: [0, cy, -0.05 * k] })
  // a rolled lip of clay-cloth round the skin's edge
  const lipPts: THREE.Vector3[] = []
  for (let i = 0; i < 96; i++) {
    const a = (i / 96) * Math.PI * 2
    const o = OUTLINE[form](a)
    lipPts.push(new THREE.Vector3(Math.cos(a) * w * o, cy + Math.sin(a) * h * o, -0.02 * k + D * relief(form, Math.cos(a) * o, Math.sin(a) * o, 1) * 0.6))
  }
  const lip = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(lipPts, true), 192, 0.016 * k, 6, true)
  b.add('rim', lip)
  return b.build()
}

export function MajuliMask({ config }: ModelProps) {
  const m = useModelMaterials()
  const formS = str(config, 'form', 'face')
  const form: Form = formS === 'bird' || formS === 'lion' ? formS : 'face'
  const paint = config.props?.paint !== false
  const H = config.height ?? 1.9
  // tessellation by tier (sculpt.ts): the form is the same, the facets fewer
  const d = sculptDetailFor(useMuseum((s) => s.tier))
  const parts = useMemo(() => {
    const key = `${form}|${H}|${d}`
    let hit = cache.get(key)
    if (!hit) cache.set(key, (hit = withSculptDetail(d, () => build(form, H))))
    return hit
  }, [form, H, d])
  const mats = useMemo(() => {
    const bare = tinted(m.terracotta, '#9a948a', { roughness: 1 })
    // muted earth paints over the clay-cloth; the plaster normal map gives the cloth's grain
    const painted = (m.terracotta as THREE.MeshStandardMaterial).clone()
    painted.map = faceTexture(form)
    painted.color.set('#ffffff')
    painted.roughness = 0.82
    painted.normalScale.set(0.7, 0.7)
    const weaveMat = (m.rope as THREE.MeshStandardMaterial).clone()
    weaveMat.map = weaveTexture()
    weaveMat.color.set('#ffffff')
    weaveMat.side = THREE.DoubleSide
    return {
      stand: m.darkTimber,
      bamboo: tinted(m.oak, '#b89a62', { roughness: 0.6 }),
      weave: weaveMat,
      skin: paint ? painted : bare,
      rim: paint ? tinted(m.terracotta, '#5a3324', { roughness: 0.9 }) : bare,
      beak: paint ? tinted(m.terracotta, '#c8962e', { roughness: 0.7 }) : bare,
    }
  }, [m, form, paint])
  return <Parts parts={parts} materials={mats} />
}
