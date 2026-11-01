/**
 * 'majuli-mask' — a mask in the manner of the satras of Majuli, Assam (GRAND §4.2, §4.3;
 * CRAFTS D9): a frame of split bamboo woven into a shell, covered in cloth dipped in clay, dried,
 * then painted. Shown as generic forms, oversized as the satra masks are (about a metre tall),
 * hung on the wall from a bamboo bracket ("clay as skin"), never as any named character:
 *
 *   form  face  a broad face under a painted crown band, almond eyes, closed red lips
 *         bird  a beak modelled in relief, ringed eyes, a crest of painted feathers
 *         lion  a painted mane round the face, an open red mouth
 *   paint muted earth paints (ochre, red earth, soot) worn back to the clay, flat on the skin:
 *         nothing is stuck on; false shows the bare grey clay-cloth skin
 *
 * The woven bamboo shell is larger than the painted skin, so its weave shows all round it as a
 * broad border held by a bamboo hoop; the back is open, so the weave shows inside too. Origin on the floor below
 * the mask, the wall 0.2 m behind it (-z); the mask faces +z, its centre at about 1.75 m (the
 * object's height scales it).
 */
import { useMemo } from 'react'
import * as THREE from 'three'
import { Builder, cyl, Parts, rbox, type BuiltParts } from './kit'
import { tinted, useModelMaterials } from './modelMaterials'
import { str, type ModelProps } from './types'

type Form = 'face' | 'bird' | 'lion'

/** The weave seen inside the shell: a canvas of over-and-under strips. */
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
  // SphereGeometry's half phi 0 → π is already the +z half (z = sin φ sin θ ≥ 0): the face looks
  // out along +z and the open back faces the wall
  const g = new THREE.SphereGeometry(1, 28, 20, 0, Math.PI)
  g.scale(rx, ry, rz)
  return g
}

/**
 * The painted face of a form, as the satra masks are painted: flat colour on the clay-cloth skin,
 * no features stuck on. The canvas maps on to the shell's front half (u across 180°, v down), so
 * the face sits round (0.5, 0.5).
 */
const faces = new Map<Form, THREE.CanvasTexture>()
function faceTexture(form: Form): THREE.CanvasTexture {
  const hit = faces.get(form)
  if (hit) return hit
  const W = 512
  const c = document.createElement('canvas')
  c.width = c.height = W
  const g = c.getContext('2d')!
  const ground = form === 'face' ? '#c08e62' : form === 'bird' ? '#7a7656' : '#b4843e'
  g.fillStyle = ground
  g.fillRect(0, 0, W, W)
  // the paint worn back to the clay-cloth in places
  let seed = form.length * 97
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647
  for (let i = 0; i < 140; i++) {
    g.fillStyle = rnd() > 0.5 ? 'rgba(150,140,126,0.22)' : 'rgba(60,40,28,0.12)'
    g.beginPath()
    g.ellipse(rnd() * W, rnd() * W, 4 + rnd() * 16, 3 + rnd() * 10, rnd() * 3, 0, Math.PI * 2)
    g.fill()
  }
  const X = (u: number) => u * W
  const Y = (v: number) => v * W
  const almond = (u: number, v: number, rw: number, rh: number, fill: string, line = '#1d1612') => {
    g.fillStyle = fill
    g.strokeStyle = line
    g.lineWidth = W * 0.008
    g.beginPath()
    g.moveTo(X(u - rw), Y(v))
    g.quadraticCurveTo(X(u), Y(v - rh), X(u + rw), Y(v))
    g.quadraticCurveTo(X(u), Y(v + rh), X(u - rw), Y(v))
    g.fill()
    g.stroke()
    g.fillStyle = line
    g.beginPath()
    g.arc(X(u), Y(v), W * rh * 0.55, 0, Math.PI * 2)
    g.fill()
  }
  const brow = (u: number, v: number, rw: number, color = '#1d1612') => {
    g.strokeStyle = color
    g.lineWidth = W * 0.014
    g.lineCap = 'round'
    g.beginPath()
    g.moveTo(X(u - rw), Y(v + 0.012))
    g.quadraticCurveTo(X(u), Y(v - 0.03), X(u + rw), Y(v + 0.012))
    g.stroke()
  }
  if (form === 'face') {
    // a crown band, the brows, almond eyes, a painted nose line and closed red lips
    g.fillStyle = '#a6804a'
    g.fillRect(X(0.18), Y(0.1), X(0.64), Y(0.07))
    g.fillStyle = '#7c3a28'
    for (let i = 0; i < 7; i++) {
      g.beginPath()
      g.arc(X(0.24 + i * 0.087), Y(0.135), W * 0.012, 0, Math.PI * 2)
      g.fill()
    }
    for (const s of [-1, 1]) {
      brow(0.5 + s * 0.085, 0.38, 0.06)
      almond(0.5 + s * 0.085, 0.45, 0.05, 0.022, '#efe6d4')
    }
    g.strokeStyle = '#5a3a26'
    g.lineWidth = W * 0.007
    g.beginPath()
    g.moveTo(X(0.5), Y(0.44))
    g.lineTo(X(0.49), Y(0.58))
    g.quadraticCurveTo(X(0.5), Y(0.6), X(0.515), Y(0.585))
    g.stroke()
    g.fillStyle = '#8a2a1c'
    g.beginPath()
    g.ellipse(X(0.5), Y(0.68), W * 0.06, W * 0.018, 0, 0, Math.PI * 2)
    g.fill()
    // a tilak
    g.fillRect(X(0.494), Y(0.27), X(0.012), Y(0.07))
  } else if (form === 'bird') {
    // the beak painted flat, ringed eyes, a crest of painted feathers
    for (const s of [-1, 1]) {
      g.fillStyle = '#d0a24c'
      g.beginPath()
      g.arc(X(0.5 + s * 0.1), Y(0.42), W * 0.045, 0, Math.PI * 2)
      g.fill()
      almond(0.5 + s * 0.1, 0.42, 0.035, 0.022, '#efe6d4')
    }
    g.fillStyle = '#c8962e'
    g.strokeStyle = '#1d1612'
    g.lineWidth = W * 0.008
    g.beginPath()
    g.moveTo(X(0.43), Y(0.5))
    g.lineTo(X(0.57), Y(0.5))
    g.lineTo(X(0.5), Y(0.74))
    g.closePath()
    g.fill()
    g.stroke()
    g.strokeStyle = '#7c3a28'
    g.lineWidth = W * 0.02
    for (let i = 0; i < 5; i++) {
      g.beginPath()
      g.moveTo(X(0.4 + i * 0.05), Y(0.28))
      g.lineTo(X(0.36 + i * 0.07), Y(0.1))
      g.stroke()
    }
  } else {
    // lion: a painted mane round the face, brows, eyes, a broad nose and an open red mouth
    g.strokeStyle = '#7c3a28'
    g.lineWidth = W * 0.022
    for (let i = 0; i < 22; i++) {
      const a = (i / 22) * Math.PI * 2
      g.beginPath()
      g.moveTo(X(0.5 + Math.cos(a) * 0.2), Y(0.5 + Math.sin(a) * 0.3))
      g.lineTo(X(0.5 + Math.cos(a) * 0.3), Y(0.5 + Math.sin(a) * 0.44))
      g.stroke()
    }
    for (const s of [-1, 1]) {
      brow(0.5 + s * 0.09, 0.36, 0.07, '#3a1e14')
      almond(0.5 + s * 0.09, 0.43, 0.05, 0.024, '#e9d9a8')
    }
    g.fillStyle = '#2a1a14'
    g.beginPath()
    g.ellipse(X(0.5), Y(0.55), W * 0.05, W * 0.03, 0, 0, Math.PI * 2)
    g.fill()
    g.fillStyle = '#8a2a1c'
    g.beginPath()
    g.ellipse(X(0.5), Y(0.66), W * 0.08, W * 0.035, 0, 0, Math.PI * 2)
    g.fill()
    g.fillStyle = '#efe6d4'
    for (const s of [-1, 1]) g.fillRect(X(0.5 + s * 0.04 - 0.008), Y(0.64), X(0.016), Y(0.03))
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  faces.set(form, t)
  return t
}

const cache = new Map<string, BuiltParts>()

function build(form: Form, H: number): BuiltParts {
  const b = new Builder()
  const k = H / 1.9
  const cy = 1.75 * k
  // the wall bracket: a bamboo cross-piece the mask is lashed to, on two pegs into the wall
  b.add('bamboo', rbox(0.62 * k, 0.035 * k, 0.035 * k, 0.005), { p: [0, cy + 0.08 * k, -0.17 * k] })
  for (const sx of [-1, 1]) b.add('bamboo', cyl(0.014 * k, 0.014 * k, 0.12 * k, 8), { p: [sx * 0.24 * k, cy + 0.08 * k, -0.21 * k], r: [Math.PI / 2, 0, 0] })
  b.add('stand', rbox(0.7 * k, 0.06 * k, 0.02 * k, 0.004), { p: [0, cy + 0.08 * k, -0.2 * k] })
  // oversized: about a metre from crown to chin
  const w = form === 'lion' ? 0.5 : form === 'bird' ? 0.42 : 0.44
  const h = form === 'bird' ? 0.5 : 0.55
  // the painted skin outside (its features are paint; only the bird's beak stands proud)
  b.add('skin', shell(w * k, h * k, 0.2 * k), { p: [0, cy, 0] })
  if (form === 'bird') {
    // the beak modelled in clay-cloth over the painted one: a four-sided point, curving down
    const beak = new THREE.ConeGeometry(0.075 * k, 0.24 * k, 4, 3)
    beak.rotateY(Math.PI / 4)
    beak.scale(1, 1, 0.55)
    b.add('gold', beak, { p: [0, cy - 0.22 * h * k, 0.27 * k], r: [Math.PI / 2 + 0.45, 0, 0] })
  }
  // the woven bamboo shell: larger than the skin, so its weave shows all round it as a broad
  // border, and the weave inside, seen round the open back
  b.add('weave', shell(w * 1.22 * k, h * 1.16 * k, 0.12 * k), { p: [0, cy, -0.05 * k] })
  const inner = shell(w * k * 0.97, h * k * 0.97, 0.19 * k)
  const idx = inner.getIndex()!
  // flip the inner shell's winding so its inside faces the visitor looking round the back
  for (let i = 0; i < idx.count; i += 3) {
    const a = idx.getX(i)
    idx.setX(i, idx.getX(i + 2))
    idx.setX(i + 2, a)
  }
  inner.computeVertexNormals()
  b.add('weave', inner, { p: [0, cy, -0.004 * k] })
  // the bamboo hoop that holds the weave's edge
  const hoop = new THREE.TorusGeometry(1, 0.022, 6, 48)
  hoop.scale(w * 1.22 * k, h * 1.16 * k, 1)
  b.add('bamboo', hoop, { p: [0, cy, -0.05 * k] })
  return b.build()
}

export function MajuliMask({ config }: ModelProps) {
  const m = useModelMaterials()
  const formS = str(config, 'form', 'face')
  const form: Form = formS === 'bird' || formS === 'lion' ? formS : 'face'
  const paint = config.props?.paint !== false
  const H = config.height ?? 1.9
  const parts = useMemo(() => {
    const key = `${form}|${H}`
    let hit = cache.get(key)
    if (!hit) cache.set(key, (hit = build(form, H)))
    return hit
  }, [form, H])
  const mats = useMemo(() => {
    const bare = tinted(m.terracotta, '#9a948a', { roughness: 1 })
    // muted earth paints over the clay-cloth: worn ochre, a sooty green-grey, red earth
    const painted = (m.terracotta as THREE.MeshStandardMaterial).clone()
    painted.map = faceTexture(form)
    painted.color.set('#ffffff')
    painted.roughness = 0.85
    const weaveMat = (m.rope as THREE.MeshStandardMaterial).clone()
    weaveMat.map = weaveTexture()
    weaveMat.color.set('#ffffff')
    weaveMat.side = THREE.DoubleSide
    return {
      stand: m.darkTimber,
      bamboo: tinted(m.oak, '#b89a62', { roughness: 0.6 }),
      weave: weaveMat,
      skin: paint ? painted : bare,
      white: paint ? tinted(m.terracotta, '#c9b89c', { roughness: 0.9 }) : bare,
      black: paint ? tinted(m.terracotta, '#231b16', { roughness: 0.85 }) : bare,
      red: paint ? tinted(m.terracotta, '#7c3a28', { roughness: 0.9 }) : bare,
      gold: paint ? tinted(m.terracotta, '#a6804a', { roughness: 0.85 }) : bare,
    }
  }, [m, form, paint])
  return <Parts parts={parts} materials={mats} />
}
