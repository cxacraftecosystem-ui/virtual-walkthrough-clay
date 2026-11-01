/**
 * CARVED TEXT — the pavilion's one type system for lettering in the building (GRAND §6.4):
 * canvas → height → normal map, rendered either as letters cut into clay (`carved`) or as brass
 * strips laid into a surface (`inlay`).
 *
 *   carved   the letters are incised: the colour map darkens their floors and walls (the
 *            occlusion of a 6–12 mm cut), the normal map gives every stroke two lit walls under
 *            raking light. Used for the H title panel and the satellite plaques.
 *   inlay    brass letters flush in a dark ground: colour, metalness and roughness maps from
 *            the same glyphs (brass is metal 1, rough 0.3; the ground lacquer is metal 0).
 *            Used for the arch lintels.
 *
 * Every size is a physical cap height in metres; layout is in metres too and rasterised at
 * `pxPerM` (capped at 4096 px a side). The display face is the serif the landing page already
 * ships (Cormorant Garamond), the small text Inter; Devanagari and Bengali fall back to the
 * system's faces. Shapes only — nothing here is placed; exhibits/WallGraphics.tsx and the
 * experience models mount the results.
 */
import * as THREE from 'three'
import { ensureWallFonts } from '../materials/wallGraphics'

export const SERIF = '"Cormorant Garamond", "Cormorant", "Iowan Old Style", Georgia, serif'
export const SANS = 'Inter, "Helvetica Neue", Helvetica, Arial, sans-serif'
const MAX_PX = 4096
/** Cap height as a fraction of the em in the two faces (to set type by cap height). */
const CAP = { serif: 0.63, sans: 0.73 } as const

export interface CarvedLine {
  text: string
  /** Cap height (m). */
  cap: number
  face?: 'serif' | 'sans'
  weight?: number
  /** Letter spacing (em). */
  tracking?: number
  upper?: boolean
  /** Space above this line (m), after the previous line's baseline gap. */
  before?: number
  /** Running text: wrap to the block width with this line height (× cap / CAP). */
  wrap?: number
}

export interface CarvedLayout {
  /** Panel size (m). */
  width: number
  height: number
  lines: CarvedLine[]
  /** Margins (m). */
  pad?: number
  align?: 'left' | 'center'
  /** Raster density (px per metre). */
  pxPerM?: number
  /** Vertical placement of the block in the panel. */
  valign?: 'top' | 'middle'
}

export interface CarvedMaps {
  /** Glyph coverage (white letters on black), linear. */
  mask: HTMLCanvasElement
  /** Size of a pixel (m). */
  m: number
  W: number
  H: number
}

function setFont(ctx: CanvasRenderingContext2D, weight: number, px: number, family: string, spacingEm = 0) {
  ctx.font = `${weight} ${px.toFixed(2)}px ${family}`
  const c = ctx as CanvasRenderingContext2D & { letterSpacing?: string }
  if ('letterSpacing' in c) c.letterSpacing = `${(spacingEm * px).toFixed(2)}px`
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const out: string[] = []
  for (const para of text.split('\n')) {
    const words = para.split(/\s+/).filter(Boolean)
    let line = ''
    for (const w of words) {
      const test = line ? `${line} ${w}` : w
      if (ctx.measureText(test).width <= maxW || !line) line = test
      else {
        out.push(line)
        line = w
      }
    }
    if (line) out.push(line)
  }
  return out
}

/** Lay the lines out and draw their coverage (white on black). */
export async function glyphMask(L: CarvedLayout): Promise<CarvedMaps> {
  await ensureWallFonts()
  const s = Math.min(L.pxPerM ?? 900, MAX_PX / Math.max(L.width, L.height))
  const W = Math.max(2, Math.round(L.width * s))
  const H = Math.max(2, Math.round(L.height * s))
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = '#fff'
  ctx.textBaseline = 'alphabetic'
  const pad = L.pad ?? Math.min(L.width, L.height) * 0.08
  const innerW = L.width - pad * 2
  const centre = (L.align ?? 'left') === 'center'
  ctx.textAlign = centre ? 'center' : 'left'
  const x = centre ? (L.width / 2) * s : pad * s

  // lay out (baselines in metres from the top), then shift the block to its vertical place
  const laid: { text: string; y: number; font: [number, number, string, number] }[] = []
  let y = 0
  let first = true
  for (const line of L.lines) {
    const face = line.face ?? 'serif'
    const em = line.cap / CAP[face]
    const font: [number, number, string, number] = [line.weight ?? (face === 'serif' ? 500 : 400), em * s, face === 'serif' ? SERIF : SANS, line.tracking ?? 0]
    setFont(ctx, ...font)
    const text = line.upper ? line.text.toUpperCase() : line.text
    // a single line wider than the block is set smaller until it fits
    if (!line.wrap) {
      const w = ctx.measureText(text).width
      if (w > innerW * s) {
        font[1] *= (innerW * s) / w
        setFont(ctx, ...font)
      }
    }
    const rows = line.wrap ? wrapText(ctx, text, innerW * s) : [text]
    y += (first ? 0 : (line.before ?? line.cap * 0.9)) + line.cap
    for (let i = 0; i < rows.length; i++) {
      if (i > 0) y += em * (line.wrap ?? 1.5)
      laid.push({ text: rows[i], y, font })
    }
    first = false
  }
  const blockH = y
  const top = (L.valign ?? 'middle') === 'top' ? pad : Math.max(pad, (L.height - blockH) / 2)
  for (const l of laid) {
    setFont(ctx, ...l.font)
    ctx.fillText(l.text, x, (top + l.y) * s)
  }
  return { mask: canvas, m: 1 / s, W, H }
}

/** A blurred copy of the mask (the cut's sloped walls), as a Float32 height field 0 … 1. */
function heightField(maps: CarvedMaps, wallM: number): Float32Array {
  const { mask, W, H, m } = maps
  const blur = Math.max(1, Math.round(wallM / m))
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const ctx = c.getContext('2d')!
  ctx.filter = `blur(${blur}px)`
  ctx.drawImage(mask, 0, 0)
  ctx.filter = 'none'
  const d = ctx.getImageData(0, 0, W, H).data
  // where the browser has no canvas filter, the sharp mask still reads (the walls are steeper)
  const out = new Float32Array(W * H)
  for (let i = 0; i < W * H; i++) out[i] = d[i * 4] / 255
  return out
}

/** Tangent-space normal map from a height field (Sobel), `depthM` deep over walls `wallM` wide. */
function normalCanvas(h: Float32Array, W: number, H: number, m: number, depthM: number, sign: 1 | -1): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const ctx = c.getContext('2d')!
  const img = ctx.createImageData(W, H)
  const k = (sign * depthM) / (2 * m)
  const at = (x: number, y: number) => h[Math.min(H - 1, Math.max(0, y)) * W + Math.min(W - 1, Math.max(0, x))]
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * k
      // canvas rows run down, uv v runs up
      const dy = -(at(x, y + 1) - at(x, y - 1)) * k
      const len = Math.hypot(dx, dy, 1)
      const i = (y * W + x) * 4
      img.data[i] = ((-dx / len) * 0.5 + 0.5) * 255
      img.data[i + 1] = ((-dy / len) * 0.5 + 0.5) * 255
      img.data[i + 2] = ((1 / len) * 0.5 + 0.5) * 255
      img.data[i + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  return c
}

function tex(c: HTMLCanvasElement, name: string, srgb: boolean): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c)
  t.name = name
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace
  t.anisotropy = 8
  t.minFilter = THREE.LinearMipmapLinearFilter
  t.magFilter = THREE.LinearFilter
  t.generateMipmaps = true
  t.needsUpdate = true
  return t
}

export interface CarvedOptions {
  /** Ground colour of the clay (sRGB hex) and the colour of a cut's floor. */
  ground: string
  floor?: string
  /** Depth of the cut and width of its sloped walls (m). */
  depth?: number
  wall?: number
  /** Faint mottling of the ground (raw clay): 0 … 1. */
  grain?: number
  seed?: number
}

/** Seeded noise for the clay's mottle. */
function rand(seed: number) {
  let a = seed >>> 0 || 1
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Letters cut into clay: colour (with the cut's occlusion) and normal maps. */
export async function carvedMaps(L: CarvedLayout, o: CarvedOptions): Promise<{ map: THREE.CanvasTexture; normalMap: THREE.CanvasTexture; W: number; H: number }> {
  const g = await glyphMask(L)
  const depth = o.depth ?? Math.max(0.004, Math.min(0.014, (L.lines[0]?.cap ?? 0.1) * 0.03))
  const wall = o.wall ?? depth * 0.9
  const h = heightField(g, wall)
  const col = document.createElement('canvas')
  col.width = g.W
  col.height = g.H
  const ctx = col.getContext('2d')!
  ctx.fillStyle = o.ground
  ctx.fillRect(0, 0, g.W, g.H)
  // raw clay: broad soft mottle and fine speckle
  const r = rand(o.seed ?? 7)
  const grain = o.grain ?? 0.5
  if (grain > 0) {
    for (let i = 0; i < 60; i++) {
      const x = r() * g.W
      const y = r() * g.H
      const rad = (0.08 + r() * 0.35) / g.m
      const gr = ctx.createRadialGradient(x, y, 0, x, y, rad)
      const a = (0.05 + r() * 0.07) * grain
      gr.addColorStop(0, r() > 0.5 ? `rgba(255,236,214,${a})` : `rgba(60,28,14,${a})`)
      gr.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = gr
      ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2)
    }
    const n = Math.min(40000, Math.round((g.W * g.H) / 90))
    for (let i = 0; i < n; i++) {
      ctx.fillStyle = r() > 0.5 ? `rgba(255,240,220,${0.06 * grain})` : `rgba(40,20,10,${0.08 * grain})`
      ctx.fillRect(r() * g.W, r() * g.H, 1.5, 1.5)
    }
  }
  // the cut: its floor darker (occluded), its walls shading into it
  const img = ctx.getImageData(0, 0, g.W, g.H)
  const fl = new THREE.Color(o.floor ?? '#2a160d')
  const fr = fl.r * 255
  const fg = fl.g * 255
  const fb = fl.b * 255
  for (let i = 0; i < g.W * g.H; i++) {
    const k = Math.min(1, h[i] * 1.15) * 0.82
    if (k <= 0.002) continue
    const j = i * 4
    img.data[j] = img.data[j] * (1 - k) + fr * k
    img.data[j + 1] = img.data[j + 1] * (1 - k) + fg * k
    img.data[j + 2] = img.data[j + 2] * (1 - k) + fb * k
  }
  ctx.putImageData(img, 0, 0)
  const nrm = normalCanvas(h, g.W, g.H, g.m, depth, -1)
  return { map: tex(col, 'carved', true), normalMap: tex(nrm, 'carvedNormal', false), W: g.W, H: g.H }
}

/** Brass letters laid flush into a lacquered ground: colour, metal-rough (G rough, B metal) and normal maps. */
export async function inlayMaps(
  L: CarvedLayout,
  o: { ground: string; brass?: string },
): Promise<{ map: THREE.CanvasTexture; metalnessMap: THREE.CanvasTexture; normalMap: THREE.CanvasTexture }> {
  const g = await glyphMask(L)
  const mctx = g.mask.getContext('2d')!
  const md = mctx.getImageData(0, 0, g.W, g.H).data
  const col = document.createElement('canvas')
  col.width = g.W
  col.height = g.H
  const ctx = col.getContext('2d')!
  const img = ctx.createImageData(g.W, g.H)
  const gr = new THREE.Color(o.ground)
  const br = new THREE.Color(o.brass ?? '#c8a265')
  const mr = document.createElement('canvas')
  mr.width = g.W
  mr.height = g.H
  const mrc = mr.getContext('2d')!
  const mi = mrc.createImageData(g.W, g.H)
  for (let i = 0; i < g.W * g.H; i++) {
    const k = md[i * 4] / 255
    const j = i * 4
    img.data[j] = (gr.r * (1 - k) + br.r * k) * 255
    img.data[j + 1] = (gr.g * (1 - k) + br.g * k) * 255
    img.data[j + 2] = (gr.b * (1 - k) + br.b * k) * 255
    img.data[j + 3] = 255
    // metalness (B) and roughness (G) as three.js reads them
    mi.data[j] = 255
    mi.data[j + 1] = (0.55 * (1 - k) + 0.3 * k) * 255
    mi.data[j + 2] = k * 255
    mi.data[j + 3] = 255
  }
  ctx.putImageData(img, 0, 0)
  mrc.putImageData(mi, 0, 0)
  // a hairline bevel where brass meets lacquer
  const h = heightField(g, g.m * 2)
  const nrm = normalCanvas(h, g.W, g.H, g.m, 0.0015, 1)
  return { map: tex(col, 'inlay', true), metalnessMap: tex(mr, 'inlayMR', false), normalMap: tex(nrm, 'inlayNormal', false) }
}

/** Curved strip of a circle (centre cx, cz; radius r) facing out, centred on plan angle `aMid` (rad), u left → right seen from outside. */
export function curvedStrip(r: number, aMid: number, width: number, height: number, y0: number, inward = false, cx = 0, cz = 0): THREE.BufferGeometry {
  const half = width / 2 / r
  const n = Math.max(8, Math.ceil(width / 0.1))
  const pos: number[] = []
  const nor: number[] = []
  const uv: number[] = []
  const idx: number[] = []
  for (let i = 0; i <= n; i++) {
    const u = i / n
    // seen from outside, the plan angle increases to the left; from inside, to the right
    const a = inward ? aMid - half + u * 2 * half : aMid + half - u * 2 * half
    const c = Math.cos(a)
    const sn = Math.sin(a)
    for (const v of [0, 1]) {
      pos.push(cx + r * c, y0 + v * height, cz + r * sn)
      nor.push(inward ? -c : c, 0, inward ? -sn : sn)
      uv.push(u, v)
    }
  }
  for (let i = 0; i < n; i++) {
    const k = i * 2
    // u runs left → right as seen from the side the strip faces, so one winding serves both
    idx.push(k, k + 2, k + 3, k, k + 3, k + 1)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  g.computeBoundingSphere()
  return g
}
