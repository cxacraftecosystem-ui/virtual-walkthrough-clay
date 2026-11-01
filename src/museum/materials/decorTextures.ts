/**
 * DECOR TEXTURES — canvas-generated, tileable pattern maps for the wall-decor system
 * (config/decor.ts → architecture/WallDecor.tsx). All maps are generated once per size,
 * cached, mipmapped, and physically scaled: `repeat = 1 / tileMetres` on metre UVs.
 *
 * Every motif comes from exhibits/motifs.ts (drawMotif) — the SAME placeholder block
 * library used by the textiles — so the architecture quotes the exhibition's own blocks.
 * Stamps are drawn at all wrap offsets with a per-stamp seeded RNG, so hand-printing
 * imperfections (voids, mottle, grain, bleed, misregistration) stay seamless.
 */
import * as THREE from 'three'
import type { MotifId } from '../config/exhibits'
import { drawMotif, mulberry32, type DrawMotifOptions } from '../exhibits/motifs'
import { TileNoise, clamp01 } from './noise'

export type DecorTextureKind = 'blockPrint' | 'indigoDamask' | 'friezePainted' | 'stoneFrieze' | 'incisedBand' | 'jali'

/** Physical size [width, height] in metres of one tile. */
export const DECOR_TILE_METRES: Record<DecorTextureKind, [number, number]> = {
  blockPrint: [0.9, 0.9],
  indigoDamask: [0.64, 0.64],
  friezePainted: [1.6, 0.8],
  stoneFrieze: [1.2, 0.6],
  incisedBand: [0.6, 0.3],
  jali: [0.5, 0.5],
}

/** Base pixel width at High (scaled per tier by the caller). Height follows the tile aspect. */
export const DECOR_BASE_PX: Record<DecorTextureKind, number> = {
  blockPrint: 512,
  indigoDamask: 512,
  friezePainted: 768,
  stoneFrieze: 512,
  incisedBand: 512,
  jali: 512,
}

export interface DecorTextureSet {
  kind: DecorTextureKind
  width: number
  height: number
  map: THREE.Texture
  normalMap?: THREE.Texture
  alphaMap?: THREE.Texture
}

type Ctx = CanvasRenderingContext2D

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

function makeCanvas(w: number, h: number): [HTMLCanvasElement, Ctx] {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return [c, c.getContext('2d', { willReadFrequently: true })!]
}

function finishTexture(t: THREE.Texture, kind: DecorTextureKind, srgb: boolean, suffix: string) {
  const [tw, th] = DECOR_TILE_METRES[kind]
  t.name = `decor-${kind}-${suffix}`
  t.wrapS = THREE.RepeatWrapping
  t.wrapT = THREE.RepeatWrapping
  t.magFilter = THREE.LinearFilter
  t.minFilter = THREE.LinearMipmapLinearFilter
  t.generateMipmaps = true
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace
  t.repeat.set(1 / tw, 1 / th)
  t.needsUpdate = true
  return t
}

/** Draw a stamp at every wrap offset that can touch the tile (seamless tiling). */
function stamp(ctx: Ctx, W: number, H: number, motif: MotifId, x: number, y: number, size: number, color: string, opts: DrawMotifOptions & { seed?: number } = {}) {
  const r = size * 0.75
  for (const dx of [-W, 0, W])
    for (const dy of [-H, 0, H]) {
      const cx = x + dx
      const cy = y + dy
      if (cx + r < 0 || cx - r > W || cy + r < 0 || cy - r > H) continue
      drawMotif(ctx, motif, cx, cy, size, color, { ...opts, rng: opts.seed !== undefined ? mulberry32(opts.seed) : undefined })
    }
}

/** Soft radial blotches (dye-pot / limewash unevenness), wrapped. */
function blotches(ctx: Ctx, W: number, H: number, rng: () => number, count: number, rMin: number, rMax: number, light: string, dark: string, alpha: number) {
  for (let i = 0; i < count; i++) {
    const x = rng() * W
    const y = rng() * H
    const r = rMin + rng() * (rMax - rMin)
    const col = rng() < 0.5 ? light : dark
    const a = alpha * (0.4 + rng() * 0.6)
    for (const dx of [-W, 0, W])
      for (const dy of [-H, 0, H]) {
        const cx = x + dx
        const cy = y + dy
        if (cx + r < 0 || cx - r > W || cy + r < 0 || cy - r > H) continue
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r)
        g.addColorStop(0, col)
        g.addColorStop(1, 'rgba(0,0,0,0)')
        ctx.globalAlpha = a
        ctx.fillStyle = g
        ctx.fillRect(cx - r, cy - r, r * 2, r * 2)
      }
  }
  ctx.globalAlpha = 1
}

/** Multiply the canvas by periodic value noise (paper/plaster tooth), seamless. */
function toothNoise(ctx: Ctx, W: number, H: number, amp: number, cellsX: number, seed: number) {
  const img = ctx.getImageData(0, 0, W, H)
  const d = img.data
  const n = new TileNoise(seed)
  const cellsY = Math.max(1, Math.round((cellsX * H) / W))
  const cx2 = cellsX * 3
  const cy2 = cellsY * 3
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const u = x / W
      const v = y / H
      const k = 1 + (n.value(u * cellsX, v * cellsY, cellsX, cellsY) * 0.6 + n.value(u * cx2 + 7, v * cy2, cx2, cy2) * 0.4) * amp
      const o = (y * W + x) * 4
      d[o] = d[o] * k
      d[o + 1] = d[o + 1] * k
      d[o + 2] = d[o + 2] * k
    }
  ctx.putImageData(img, 0, 0)
}

/** Blur a canvas seamlessly (tiles 3×3, blurs, crops the centre). */
function blurWrapped(src: HTMLCanvasElement, px: number): HTMLCanvasElement {
  const W = src.width
  const H = src.height
  const [big, b] = makeCanvas(W * 3, H * 3)
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) b.drawImage(src, i * W, j * H)
  const [out, o] = makeCanvas(W, H)
  if ('filter' in o) o.filter = `blur(${px}px)`
  o.drawImage(big, -W, -H)
  if ('filter' in o) o.filter = 'none'
  return out
}

/** Luminance of a grey canvas → Float32 height (0..1). */
function readHeight(c: HTMLCanvasElement): Float32Array {
  const ctx = c.getContext('2d', { willReadFrequently: true })!
  const d = ctx.getImageData(0, 0, c.width, c.height).data
  const h = new Float32Array(c.width * c.height)
  for (let i = 0; i < h.length; i++) h[i] = d[i * 4] / 255
  return h
}

/**
 * Height (0..1 × `depthM` metres) → tangent-space normal map, wrapping. Canvas rows run
 * top-down while texture V runs bottom-up (flipY), so dv is taken downward.
 */
function normalTexture(h: Float32Array, W: number, H: number, pxM: number, depthM: number, kind: DecorTextureKind): THREE.DataTexture {
  const out = new Uint8Array(W * H * 4)
  const k = depthM / (2 * pxM)
  for (let y = 0; y < H; y++) {
    const ym = (y === 0 ? H : y) - 1
    const yp = y === H - 1 ? 0 : y + 1
    for (let x = 0; x < W; x++) {
      const xm = (x === 0 ? W : x) - 1
      const xp = x === W - 1 ? 0 : x + 1
      const dx = (h[y * W + xp] - h[y * W + xm]) * k
      // canvas y grows downward = -V
      const dy = (h[ym * W + x] - h[yp * W + x]) * k
      const inv = 1 / Math.sqrt(dx * dx + dy * dy + 1)
      // DataTexture rows are bottom-up: write canvas row y into texture row H-1-y
      const o = ((H - 1 - y) * W + x) * 4
      out[o] = Math.round((-dx * inv * 0.5 + 0.5) * 255)
      out[o + 1] = Math.round((-dy * inv * 0.5 + 0.5) * 255)
      out[o + 2] = Math.round((inv * 0.5 + 0.5) * 255)
      out[o + 3] = 255
    }
  }
  const t = new THREE.DataTexture(out, W, H, THREE.RGBAFormat, THREE.UnsignedByteType)
  return finishTexture(t, kind, false, 'normal') as THREE.DataTexture
}

function canvasTexture(c: HTMLCanvasElement, kind: DecorTextureKind): THREE.CanvasTexture {
  return finishTexture(new THREE.CanvasTexture(c), kind, true, 'albedo') as THREE.CanvasTexture
}

const PRINT: DrawMotifOptions = { voids: 0.3, mottle: 0.4, grain: 0.3, bleed: 0.6 }

/* ------------------------------------------------------------------ */
/* Block-print feature wall (atrium) — madder + indigo on warm limewash */
/* ------------------------------------------------------------------ */

function genBlockPrint(W: number): DecorTextureSet {
  const kind: DecorTextureKind = 'blockPrint'
  const [tw, th] = DECOR_TILE_METRES[kind]
  const H = Math.round((W * th) / tw)
  const ppm = W / tw
  const [c, ctx] = makeCanvas(W, H)
  const rng = mulberry32(1207)
  ctx.fillStyle = '#eee0c6'
  ctx.fillRect(0, 0, W, H)
  blotches(ctx, W, H, rng, 26, W * 0.08, W * 0.3, '#f6ecd8', '#dccaa8', 0.35)
  toothNoise(ctx, W, H, 0.035, 48, 5)

  const cell = 0.45 * ppm // 45 cm repeat
  let seed = 90
  // main two-block rosettes: madder filler block, indigo outline block (slightly misregistered)
  for (let j = 0; j < 2; j++)
    for (let i = 0; i < 2; i++) {
      const x = (i + 0.5) * cell
      const y = (j + 0.5) * cell
      const size = 0.34 * ppm
      const mis = () => (rng() - 0.5) * 0.0024 * ppm
      const rot = (rng() - 0.5) * 0.012
      stamp(ctx, W, H, 'rosette', x, y, size, '#b0573f', { ...PRINT, layer: 'fill', alpha: 0.5 + rng() * 0.08, rotation: rot, composite: 'multiply', seed: seed++ })
      stamp(ctx, W, H, 'rosette', x + mis(), y + mis(), size, '#34466c', { ...PRINT, layer: 'outline', alpha: 0.62 + rng() * 0.06, rotation: rot, composite: 'multiply', seed: seed++ })
    }
  // half-drop fillers on the cell corners (these straddle the tile edges → wrapped)
  for (let j = 0; j < 2; j++)
    for (let i = 0; i < 2; i++) {
      const x = i * cell
      const y = j * cell
      const size = 0.12 * ppm
      stamp(ctx, W, H, 'diamond', x, y, size, '#b8674a', { ...PRINT, layer: 'fill', alpha: 0.42, composite: 'multiply', seed: seed++ })
      stamp(ctx, W, H, 'diamond', x, y, size, '#34466c', { ...PRINT, layer: 'outline', alpha: 0.55, composite: 'multiply', seed: seed++ })
    }
  return { kind, width: W, height: H, map: canvasTexture(c, kind) }
}

/* ------------------------------------------------------------------ */
/* Indigo damask (Gallery D) — tone-on-tone block print on indigo lime */
/* ------------------------------------------------------------------ */

function genIndigoDamask(W: number): DecorTextureSet {
  const kind: DecorTextureKind = 'indigoDamask'
  const [tw, th] = DECOR_TILE_METRES[kind]
  const H = Math.round((W * th) / tw)
  const ppm = W / tw
  const [c, ctx] = makeCanvas(W, H)
  const rng = mulberry32(3301)
  ctx.fillStyle = '#2d3a5a'
  ctx.fillRect(0, 0, W, H)
  blotches(ctx, W, H, rng, 30, W * 0.06, W * 0.32, '#3a4a70', '#222c46', 0.45)
  let seed = 400
  const q = 0.16 * ppm
  // boteh (teardrop) half-drop, alternately mirrored
  for (const [x, y, mirror] of [
    [q, q, false],
    [3 * q, 3 * q, true],
  ] as const) {
    stamp(ctx, W, H, 'teardrop', x, y, 0.27 * ppm, '#4a5b85', { ...PRINT, mottle: 0.55, layer: 'fill', alpha: 0.6, mirror, seed: seed++ })
    stamp(ctx, W, H, 'teardrop', x, y, 0.27 * ppm, '#5c6d96', { ...PRINT, layer: 'outline', alpha: 0.5, mirror, seed: seed++ })
  }
  for (const [x, y] of [
    [3 * q, q],
    [q, 3 * q],
  ] as const) {
    stamp(ctx, W, H, 'rosette', x, y, 0.1 * ppm, '#4d5e88', { ...PRINT, layer: 'all', alpha: 0.5, seed: seed++ })
  }
  toothNoise(ctx, W, H, 0.05, 40, 11)
  return { kind, width: W, height: H, map: canvasTexture(c, kind) }
}

/* ------------------------------------------------------------------ */
/* Painted frieze (craft court, reception, atrium cornice)             */
/* ------------------------------------------------------------------ */

function genFriezePainted(W: number): DecorTextureSet {
  const kind: DecorTextureKind = 'friezePainted'
  const [tw, th] = DECOR_TILE_METRES[kind]
  const H = Math.round((W * th) / tw)
  const ppm = W / tw
  const m = (v: number) => v * ppm
  const [c, ctx] = makeCanvas(W, H)
  const rng = mulberry32(777)
  const band = (y0: number, y1: number, col: string) => {
    ctx.fillStyle = col
    ctx.fillRect(0, m(y0), W, m(y1 - y0))
  }
  const LIME = '#ece2cc'
  const MADDER = '#8f3a2b'
  const OCHRE = '#c9973f'
  const INDIGO = '#26344f'
  band(0, 0.8, INDIGO)
  band(0, 0.035, MADDER)
  band(0.035, 0.045, LIME)
  band(0.045, 0.058, OCHRE)
  band(0.742, 0.755, OCHRE)
  band(0.755, 0.765, LIME)
  band(0.765, 0.8, MADDER)
  blotches(ctx, W, H, rng, 28, W * 0.03, W * 0.12, '#33446a', '#1c263b', 0.4)
  // dentil chains just inside the rules
  ctx.fillStyle = LIME
  ctx.globalAlpha = 0.85
  const pitch = 0.04
  for (let x = 0; x < 1.6 - 1e-6; x += pitch) {
    for (const [yb, dir] of [
      [0.066, 1],
      [0.734, -1],
    ] as const) {
      ctx.beginPath()
      ctx.moveTo(m(x + 0.006), m(yb))
      ctx.lineTo(m(x + pitch - 0.006), m(yb))
      ctx.lineTo(m(x + pitch / 2), m(yb + dir * 0.022))
      ctx.closePath()
      ctx.fill()
    }
  }
  ctx.globalAlpha = 1
  let seed = 700
  // roundels with rosettes
  for (const x of [0.4, 1.2]) {
    ctx.strokeStyle = LIME
    ctx.lineWidth = m(0.012)
    ctx.beginPath()
    ctx.arc(m(x), m(0.4), m(0.25), 0, Math.PI * 2)
    ctx.stroke()
    ctx.strokeStyle = OCHRE
    ctx.lineWidth = m(0.006)
    ctx.beginPath()
    ctx.arc(m(x), m(0.4), m(0.228), 0, Math.PI * 2)
    ctx.stroke()
    stamp(ctx, W, H, 'rosette', m(x), m(0.4), m(0.4), '#b24c36', { ...PRINT, layer: 'fill', alpha: 0.95, seed: seed++ })
    stamp(ctx, W, H, 'rosette', m(x), m(0.4), m(0.4), LIME, { ...PRINT, layer: 'outline', alpha: 0.95, seed: seed++ })
  }
  // leaf-trail sprigs between the roundels (x = 0 wraps)
  for (const x of [0, 0.8]) {
    stamp(ctx, W, H, 'leaf-trail', m(x), m(0.4), m(0.36), OCHRE, { ...PRINT, layer: 'fill', alpha: 0.9, rotation: Math.PI / 2, seed: seed++ })
    stamp(ctx, W, H, 'leaf-trail', m(x), m(0.4), m(0.36), LIME, { ...PRINT, layer: 'outline', alpha: 0.9, rotation: Math.PI / 2, seed: seed++ })
  }
  for (const x of [0.2, 0.6, 1.0, 1.4])
    for (const y of [0.17, 0.63]) stamp(ctx, W, H, 'diamond', m(x), m(y), m(0.07), OCHRE, { ...PRINT, layer: 'all', alpha: 0.9, seed: seed++ })
  toothNoise(ctx, W, H, 0.04, 64, 21)
  return { kind, width: W, height: H, map: canvasTexture(c, kind) }
}

/* ------------------------------------------------------------------ */
/* Carved stone frieze (exterior cornice, courtyard string course)     */
/* ------------------------------------------------------------------ */

function genStoneFrieze(W: number): DecorTextureSet {
  const kind: DecorTextureKind = 'stoneFrieze'
  const [tw, th] = DECOR_TILE_METRES[kind]
  const H = Math.round((W * th) / tw)
  const ppm = W / tw
  const pxM = 1 / ppm
  const m = (v: number) => v * ppm
  const [hc, h] = makeCanvas(W, H)
  // height: 0 = deepest ground, 1 = face of the stone
  h.fillStyle = '#5a5a5a'
  h.fillRect(0, 0, W, H)
  const band = (y0: number, y1: number, g: string) => {
    h.fillStyle = g
    h.fillRect(0, m(y0), W, m(y1 - y0))
  }
  band(0, 0.055, '#ffffff')
  band(0.055, 0.068, '#8a8a8a')
  band(0.532, 0.545, '#8a8a8a')
  band(0.545, 0.6, '#ffffff')
  // bead line in the fillets
  h.fillStyle = '#d0d0d0'
  for (let x = 0.015; x < 1.2; x += 0.03) {
    for (const y of [0.0615, 0.5385]) {
      h.beginPath()
      h.ellipse(m(x), m(y), m(0.009), m(0.005), 0, 0, Math.PI * 2)
      h.fill()
    }
  }
  let seed = 1300
  for (const x of [0.3, 0.9]) {
    stamp(h, W, H, 'rosette', m(x), m(0.3), m(0.4), '#e6e6e6', { layer: 'fill', seed: seed++ })
    stamp(h, W, H, 'rosette', m(x), m(0.3), m(0.4), '#9a9a9a', { layer: 'outline', seed: seed++ })
  }
  for (const x of [0, 0.6]) {
    stamp(h, W, H, 'star-lattice', m(x), m(0.3), m(0.3), '#d8d8d8', { layer: 'fill', seed: seed++ })
    stamp(h, W, H, 'star-lattice', m(x), m(0.3), m(0.3), '#8c8c8c', { layer: 'outline', seed: seed++ })
  }
  const blurred = blurWrapped(hc, Math.max(1, W / 340))
  const height = readHeight(blurred)

  const [ac, a] = makeCanvas(W, H)
  const img = a.createImageData(W, H)
  const d = img.data
  const n = new TileNoise(55)
  const cells = Math.round(W / 3)
  const cellsY = Math.round(H / 3)
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x
      const g = n.value((x / W) * cells, (y / H) * cellsY, cells, cellsY)
      const ao = 0.8 + 0.2 * height[i]
      const k = ao * (1 + g * 0.035)
      d[i * 4] = clamp01((222 / 255) * k) * 255
      d[i * 4 + 1] = clamp01((200 / 255) * k) * 255
      d[i * 4 + 2] = clamp01((169 / 255) * k) * 255
      d[i * 4 + 3] = 255
    }
  a.putImageData(img, 0, 0)
  toothNoise(a, W, H, 0.03, 60, 77)
  return { kind, width: W, height: H, map: canvasTexture(ac, kind), normalMap: normalTexture(height, W, H, pxM, 0.012, kind) }
}

/* ------------------------------------------------------------------ */
/* Incised band (passage) — a fine lozenge chain cut into the plaster  */
/* ------------------------------------------------------------------ */

function genIncisedBand(W: number): DecorTextureSet {
  const kind: DecorTextureKind = 'incisedBand'
  const [tw, th] = DECOR_TILE_METRES[kind]
  const H = Math.round((W * th) / tw)
  const ppm = W / tw
  const m = (v: number) => v * ppm
  const [hc, h] = makeCanvas(W, H)
  h.fillStyle = '#ffffff'
  h.fillRect(0, 0, W, H)
  h.strokeStyle = '#000000'
  h.fillStyle = '#000000'
  h.lineCap = 'round'
  h.lineJoin = 'round'
  h.lineWidth = Math.max(1.2, m(0.0025))
  for (const y of [0.03, 0.27]) {
    h.beginPath()
    h.moveTo(0, m(y))
    h.lineTo(W, m(y))
    h.stroke()
  }
  for (const cx of [0.15, 0.45]) {
    for (const s of [1, 0.62]) {
      h.beginPath()
      h.moveTo(m(cx - 0.13 * s), m(0.15))
      h.lineTo(m(cx), m(0.15 - 0.09 * s))
      h.lineTo(m(cx + 0.13 * s), m(0.15))
      h.lineTo(m(cx), m(0.15 + 0.09 * s))
      h.closePath()
      h.stroke()
    }
    h.beginPath()
    h.arc(m(cx), m(0.15), m(0.008), 0, Math.PI * 2)
    h.fill()
  }
  for (const cx of [0, 0.3, 0.6]) {
    for (const dy of [-0.05, 0.05]) {
      h.beginPath()
      h.arc(m(cx), m(0.15 + dy), m(0.005), 0, Math.PI * 2)
      h.fill()
    }
  }
  const blurred = blurWrapped(hc, Math.max(0.8, W / 600))
  const height = readHeight(blurred)
  const [ac, a] = makeCanvas(W, H)
  const img = a.createImageData(W, H)
  const d = img.data
  for (let i = 0; i < height.length; i++) {
    const k = 0.86 + 0.14 * height[i]
    d[i * 4] = 230 * k
    d[i * 4 + 1] = 224 * k
    d[i * 4 + 2] = 214 * k
    d[i * 4 + 3] = 255
  }
  a.putImageData(img, 0, 0)
  toothNoise(a, W, H, 0.02, 40, 91)
  return { kind, width: W, height: H, map: canvasTexture(ac, kind), normalMap: normalTexture(height, W, H, 1 / ppm, 0.0015, kind) }
}

/* ------------------------------------------------------------------ */
/* Jali — pierced stone lattice (alpha-tested)                         */
/* ------------------------------------------------------------------ */

function genJali(W: number): DecorTextureSet {
  const kind: DecorTextureKind = 'jali'
  const [tw, th] = DECOR_TILE_METRES[kind]
  const H = Math.round((W * th) / tw)
  const ppm = W / tw
  const m = (v: number) => v * ppm
  // mask: white = stone, black = hole
  const [mc, mk] = makeCanvas(W, H)
  mk.fillStyle = '#ffffff'
  mk.fillRect(0, 0, W, H)
  mk.fillStyle = '#000000'
  const cell = tw / 3
  const n = Math.round(tw / cell)
  const a = cell * 0.36 // half-side of the star's squares
  const star = (cx: number, cy: number) => {
    for (const rot of [0, Math.PI / 4]) {
      mk.save()
      mk.translate(m(cx), m(cy))
      mk.rotate(rot)
      mk.fillRect(-m(a), -m(a), m(2 * a), m(2 * a))
      mk.restore()
    }
  }
  const diamond = (cx: number, cy: number, r: number) => {
    mk.beginPath()
    mk.moveTo(m(cx - r), m(cy))
    mk.lineTo(m(cx), m(cy - r))
    mk.lineTo(m(cx + r), m(cy))
    mk.lineTo(m(cx), m(cy + r))
    mk.closePath()
    mk.fill()
  }
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++) {
      star((i + 0.5) * cell, (j + 0.5) * cell)
      // corner holes (wrap: draw at the far edges too)
      for (const [dx, dy] of [
        [0, 0],
        [n, 0],
        [0, n],
        [n, n],
      ])
        diamond((i + dx) * cell, (j + dy) * cell, cell * 0.18)
    }
  const soft = readHeight(blurWrapped(mc, Math.max(1, W / 170)))

  // albedo stays OPAQUE (no dark fringes at the pierced edges); the pattern lives in alphaMap
  const [ac, ax] = makeCanvas(W, H)
  const img = ax.createImageData(W, H)
  const d = img.data
  const tn = new TileNoise(313)
  const cells = Math.round(W / 4)
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x
      const g = tn.value((x / W) * cells, (y / H) * cells, cells, cells)
      const ao = 0.72 + 0.28 * soft[i]
      const k = ao * (1 + g * 0.04)
      d[i * 4] = clamp01((226 / 255) * k) * 255
      d[i * 4 + 1] = clamp01((208 / 255) * k) * 255
      d[i * 4 + 2] = clamp01((180 / 255) * k) * 255
      d[i * 4 + 3] = 255
    }
  ax.putImageData(img, 0, 0)
  return { kind, width: W, height: H, map: canvasTexture(ac, kind), normalMap: normalTexture(soft, W, H, 1 / ppm, 0.02, kind), alphaMap: coverageMips(mc, kind) }
}

/**
 * Alpha-test mask with hand-built mip chain: each level is a 2× box downsample whose
 * values are re-sharpened around 0.5, so the piercings keep their size at a distance
 * instead of closing up (the classic alpha-test mip shrinkage).
 */
function coverageMips(mask: HTMLCanvasElement, kind: DecorTextureKind, lineArt = false): THREE.CanvasTexture {
  const levels: HTMLCanvasElement[] = [mask]
  let prev = mask
  while (prev.width > 1 || prev.height > 1) {
    const w = Math.max(1, prev.width >> 1)
    const h = Math.max(1, prev.height >> 1)
    const [c, ctx] = makeCanvas(w, h)
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(prev, 0, 0, w, h)
    if (w >= 4 && h >= 4) {
      const img = ctx.getImageData(0, 0, w, h)
      const d = img.data
      for (let i = 0; i < d.length; i += 4) {
        // screens: re-sharpen around 0.5; line art: boost so fine strokes survive minification
        const v = (lineArt ? clamp01((d[i] / 255) * 1.8) : clamp01((d[i] / 255 - 0.5) * 1.7 + 0.5)) * 255
        d[i] = d[i + 1] = d[i + 2] = v
        d[i + 3] = 255
      }
      ctx.putImageData(img, 0, 0)
    }
    levels.push(c)
    prev = c
  }
  const t = new THREE.CanvasTexture(mask)
  finishTexture(t, kind, false, 'alpha')
  t.mipmaps = levels as unknown as THREE.CanvasTexture['mipmaps']
  t.generateMipmaps = false
  return t
}

/* ------------------------------------------------------------------ */
/* cache                                                               */
/* ------------------------------------------------------------------ */

const GEN: Record<DecorTextureKind, (w: number) => DecorTextureSet> = {
  blockPrint: genBlockPrint,
  indigoDamask: genIndigoDamask,
  friezePainted: genFriezePainted,
  stoneFrieze: genStoneFrieze,
  incisedBand: genIncisedBand,
  jali: genJali,
}

const cache = new Map<string, DecorTextureSet>()

/** Generated once per (kind, width) and cached. */
export function getDecorTexture(kind: DecorTextureKind, width: number, anisotropy: number): DecorTextureSet {
  const key = `${kind}:${width}`
  let set = cache.get(key)
  if (!set) {
    set = GEN[kind](width)
    cache.set(key, set)
  }
  for (const t of [set.map, set.normalMap, set.alphaMap]) {
    if (t && t.anisotropy !== anisotropy) {
      t.anisotropy = anisotropy
      if (t.version > 0) t.needsUpdate = true
    }
  }
  return set
}

/** Dispose cached decor textures whose key is not in `keep`. */
export function disposeDecorTextures(keep: Set<string>) {
  for (const [key, set] of cache) {
    if (keep.has(key)) continue
    set.map.dispose()
    set.normalMap?.dispose()
    set.alphaMap?.dispose()
    cache.delete(key)
  }
}

export const decorTextureKey = (kind: DecorTextureKind, width: number) => `${kind}:${width}`

/* ------------------------------------------------------------------ */
/* SVG medallions (config/decor.ts 'medallion')                        */
/* ------------------------------------------------------------------ */

export interface MedallionTextures {
  /** Silhouette mask for alphaMap/alphaTest (coverage-preserving mips). */
  alphaMap: THREE.Texture
  /** Relief normal map derived from the softened silhouette. */
  normalMap: THREE.Texture
}

const medallionCache = new Map<string, Promise<MedallionTextures>>()

function unTile(t: THREE.Texture) {
  t.wrapS = THREE.ClampToEdgeWrapping
  t.wrapT = THREE.ClampToEdgeWrapping
  t.repeat.set(1, 1)
  t.needsUpdate = true
  return t
}

/**
 * Rasterise a single-colour SVG (fill="currentColor") into a square mask at `size` px and
 * derive a relief normal map (`normalSize` px) from it. Cached per (url, sizes); the SVG
 * is fetched once, drawn through an <img> (no DOM insertion, no script execution).
 * `sizeM` is the physical diameter the relief depth is calibrated to.
 */
export function loadMedallionTextures(url: string, size: number, normalSize: number, sizeM: number, anisotropy: number): Promise<MedallionTextures> {
  const key = `${url}:${size}:${normalSize}`
  let p = medallionCache.get(key)
  if (!p) {
    p = (async () => {
      const src = await (await fetch(url)).text()
      // white silhouette, strokes slightly dilated so the fine line work reads across a room
      const svg = src.replace(/currentColor/g, '#ffffff').replace(/<svg\b/,'<svg stroke="#ffffff" stroke-width="1.3" stroke-linejoin="round"')
      const blobUrl = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))
      try {
        const img = new Image()
        img.decoding = 'async'
        img.src = blobUrl
        await img.decode()
        const [mc, m] = makeCanvas(size, size)
        m.fillStyle = '#000000'
        m.fillRect(0, 0, size, size)
        m.drawImage(img, 0, 0, size, size)
        const alphaMap = unTile(coverageMips(mc, 'jali', true))
        alphaMap.name = `medallion-alpha-${size}`
        // relief: softened silhouette → rounded, hand-chased edges
        const [nc, n] = makeCanvas(normalSize, normalSize)
        n.drawImage(mc, 0, 0, normalSize, normalSize)
        const [bc, b] = makeCanvas(normalSize, normalSize)
        if ('filter' in b) b.filter = `blur(${Math.max(1, normalSize / 400)}px)`
        b.drawImage(nc, 0, 0)
        const normalMap = unTile(normalTexture(readHeight(bc), normalSize, normalSize, sizeM / normalSize, 0.008, 'jali'))
        normalMap.name = `medallion-normal-${normalSize}`
        for (const t of [alphaMap, normalMap]) t.anisotropy = anisotropy
        return { alphaMap, normalMap }
      } finally {
        URL.revokeObjectURL(blobUrl)
      }
    })()
    p.catch(() => medallionCache.delete(key))
    medallionCache.set(key, p)
  }
  return p
}

/** Soft radial halo (shared) for backlit medallions. */
let halo: THREE.CanvasTexture | null = null
export function getHaloTexture(): THREE.CanvasTexture {
  if (halo) return halo
  const [c, ctx] = makeCanvas(128, 128)
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64)
  g.addColorStop(0, 'rgba(255,255,255,0.0)')
  g.addColorStop(0.42, 'rgba(255,255,255,0.55)')
  g.addColorStop(0.62, 'rgba(255,255,255,0.35)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 128, 128)
  halo = new THREE.CanvasTexture(c)
  halo.colorSpace = THREE.SRGBColorSpace
  halo.name = 'medallion-halo'
  return halo
}

/* ------------------------------------------------------------------ */
/* Earth section — the strata wall (SPECTACLE F6)                      */
/* ------------------------------------------------------------------ */

/** One layer of the section, listed bottom → top; `thickness` is relative (they are scaled to fill). */
export interface StrataLayer {
  name: string
  color: string
  thickness: number
  kind: 'kaolin' | 'laterite' | 'clay' | 'silt' | 'sand' | 'topsoil'
}

/** A typical river-plain section (not a survey): kaolin, laterite, sand, clay, silt with lenses, topsoil. */
export const DEFAULT_STRATA: StrataLayer[] = [
  { name: 'Kaolin', color: '#ddd5c4', thickness: 0.5, kind: 'kaolin' },
  { name: 'Laterite', color: '#9a4426', thickness: 0.85, kind: 'laterite' },
  { name: 'Sand', color: '#c7a271', thickness: 0.4, kind: 'sand' },
  { name: 'Clay', color: '#646d75', thickness: 0.35, kind: 'clay' },
  { name: 'Silt', color: '#a8957a', thickness: 0.8, kind: 'silt' },
  { name: 'Topsoil', color: '#3e2a1e', thickness: 0.5, kind: 'topsoil' },
]

const STRATA_KINDS = ['kaolin', 'laterite', 'clay', 'silt', 'sand', 'topsoil'] as const
/** How far each kind stands proud of the section (m): the hard beds weather out, the soft ones back. */
const STRATA_RELIEF: Record<StrataLayer['kind'], number> = { kaolin: 0.0, laterite: 0.05, sand: -0.02, clay: 0.025, silt: 0.005, topsoil: 0.035 }

/** Parse the `layers` prop: one per line, `name|#colour|thickness|kind`, bottom first. */
export function parseStrata(text: string): StrataLayer[] {
  const out: StrataLayer[] = []
  for (const line of text.split('\n')) {
    const [name, color, th, kind] = line.split('|').map((s) => s.trim())
    if (!name || !/^#[0-9a-f]{6}$/i.test(color ?? '')) continue
    const t = Number(th)
    out.push({ name, color, thickness: Number.isFinite(t) && t > 0 ? t : 0.5, kind: (STRATA_KINDS as readonly string[]).includes(kind) ? (kind as StrataLayer['kind']) : 'silt' })
  }
  return out.length >= 2 ? out : DEFAULT_STRATA
}

export interface StrataShader {
  /**
   * GLSL defining `void strata(vec2 p, out vec3 albedo, out float height)`: `p` is (metres along
   * the wall, metres above the floor), `albedo` linear colour, `height` 0 … 1 (1 = proud); and
   * `float strataRelief(vec2 p)`, each bed's weathered depth in metres (+ = proud), for displacement.
   */
  glsl: string
  /** Layer tops (m above the section's foot, before the waviness), for checks and labels. */
  tops: number[]
  /** Program cache key (layers + seed + detail). */
  key: string
}

const glslF = (v: number) => (Number.isInteger(v) ? `${v}.0` : `${v}`)

/**
 * The earth section as a procedural shader, sharp at any distance (SPECTACLE F6): wavy layer
 * contacts, chalky kaolin, laterite with iron nodules and pale vesicles, cross-bedded sand with
 * pebbles, blue-grey clay, laminated silt with clay lenses, crumbly topsoil with roots reaching
 * down. `y0 … y1` is the section's height on the wall; `octaves` the noise detail (by tier).
 */
export function genStrata(layers: StrataLayer[], seed: number, y0: number, y1: number, octaves: number): StrataShader {
  const total = layers.reduce((s, l) => s + l.thickness, 0)
  const tops: number[] = []
  let acc = y0
  for (const l of layers) {
    acc += ((y1 - y0) * l.thickness) / total
    tops.push(acc)
  }
  const col = (hex: string) => {
    const c = new THREE.Color(hex)
    return `vec3(${c.r.toFixed(4)}, ${c.g.toFixed(4)}, ${c.b.toFixed(4)})`
  }
  const rootLo = tops[Math.max(0, layers.length - 3)] ?? y0
  const rootMid = tops[Math.max(0, layers.length - 2)] ?? y1
  const sd = glslF(((seed * 9301 + 49297) % 233280) / 2332.8)
  // the layer the point is in: compare against each wavy contact in turn
  const pick = layers
    .map((l, i) => {
      const top = i === layers.length - 1 ? '1e9' : `${glslF(+tops[i].toFixed(4))} + contact(p.x, ${glslF(i + 1)})`
      return `${i === 0 ? '' : 'else '}if (p.y < ${top}) { k = ${STRATA_KINDS.indexOf(l.kind)}; li = ${i}; base = ${col(l.color)}; lo = ${i === 0 ? glslF(y0) : `${glslF(+tops[i - 1].toFixed(4))} + contact(p.x, ${glslF(i)})`}; hi = ${top}; }`
    })
    .join('\n  ')
  // the neighbours' colours (the contacts blend across a few centimetres) and each layer's relief
  const baseOf = layers.map((l, i) => `${i === 0 ? '' : 'else '}if (i == ${i}) return ${col(l.color)};`).join('\n  ')
  const reliefSteps = layers
    .slice(1)
    .map((l, j) => {
      const i = j + 1
      const d = STRATA_RELIEF[l.kind] - STRATA_RELIEF[layers[i - 1].kind]
      return `r += ${glslF(+d.toFixed(4))} * smoothstep(-w, w, p.y - (${glslF(+tops[i - 1].toFixed(4))} + contact(p.x, ${glslF(i)})));`
    })
    .join('\n  ')
  const glsl = /* glsl */ `
float sHash(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec2 sHash2(vec2 p) { return vec2(sHash(p), sHash(p + 17.31)); }
float sNoise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(sHash(i), sHash(i + vec2(1.0, 0.0)), u.x), mix(sHash(i + vec2(0.0, 1.0)), sHash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float sFbm(vec2 p) {
  float a = 0.5, s = 0.0;
  for (int i = 0; i < ${Math.max(2, octaves)}; i++) { s += a * sNoise(p); p = p * 2.03 + 11.7; a *= 0.5; }
  return s;
}
/** Nearest feature in a jittered grid: (distance, cell id). */
vec2 sCell(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); float d = 8.0; float id = 0.0;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec2 g = vec2(float(x), float(y));
    vec2 o = sHash2(i + g + ${sd});
    float dd = length(g + o - f);
    if (dd < d) { d = dd; id = sHash(i + g + 3.7); }
  }
  return vec2(d, id);
}
/** The wavy contact between layer n-1 and n, as an offset (m) along the wall. */
float contact(float x, float n) {
  return 0.11 * (sFbm(vec2(x * 0.45 + n * 7.1, n * 3.3)) - 0.5) + 0.035 * sin(x * 0.7 + n * 2.0) + 0.015 * (sNoise(vec2(x * 6.0, n)) - 0.5);
}
vec3 strataBase(int i) {
  ${baseOf}
  return vec3(0.5);
}
/**
 * Differential erosion (m, + = proud of the panel): hard laterite and the clay band stand out, the
 * sand is scoured back, the topsoil overhangs; each step is a soft shoulder of a few centimetres.
 */
float strataRelief(vec2 p) {
  float w = 0.035 + 0.03 * sNoise(vec2(p.x * 1.3, 5.0));
  float r = ${glslF(STRATA_RELIEF[layers[0].kind])};
  ${reliefSteps}
  return r + 0.012 * (sNoise(p * vec2(2.4, 5.0)) - 0.5) + 0.006 * (sNoise(p * 11.0) - 0.5);
}
void strata(vec2 p0, out vec3 albedo, out float height) {
  int k = 0; int li = 0; vec3 base = vec3(0.5); float lo = 0.0; float hi = 1.0;
  // interfingered contacts: the layer test wanders a few centimetres
  vec2 p = vec2(p0.x, p0.y + 0.025 * (sNoise(p0 * vec2(9.0, 4.0)) - 0.5));
  ${pick}
  p = p0;
  float n1 = sFbm(p * vec2(2.2, 3.0));
  float n2 = sNoise(p * 38.0);
  float grain = sHash(floor(p * 420.0));
  // colour drifts at two scales: no two metres of a section are alike
  float big = sFbm(p * vec2(0.35, 0.9) + 21.0);
  vec3 c = base * (0.78 + 0.34 * big) * (0.92 + 0.16 * n1);
  float h = 0.45 + 0.1 * n1;
  if (k == 0) {
    // kaolin: chalky, faint pink iron stains
    c = mix(c, c * vec3(1.05, 0.9, 0.86), smoothstep(0.55, 0.75, sFbm(p * vec2(1.4, 4.0) + 3.0)) * 0.6);
    c *= 0.97 + 0.06 * grain;
    h = 0.42 + 0.05 * n1;
  } else if (k == 1) {
    // laterite: mottled rust and ochre, dark iron nodules, pale vesicles
    float m = sFbm(p * vec2(3.0, 5.0) + 9.0);
    c = mix(c, vec3(0.62, 0.30, 0.12), smoothstep(0.45, 0.7, m) * 0.7);
    c = mix(c, vec3(0.28, 0.10, 0.05), smoothstep(0.62, 0.8, sFbm(p * 6.0 + 2.0)) * 0.6);
    // nodules at their true size (a few millimetres to a centimetre), never sticker-sized
    vec2 wq = p * 52.0 + 0.9 * vec2(sNoise(p * 71.0), sNoise(p * 67.0 + 4.0));
    vec2 nod = sCell(wq);
    float nsz = mix(0.12, 0.34, sHash(vec2(nod.y, 5.0)));
    float nodule = smoothstep(nsz, nsz * 0.55, nod.x) * step(0.62, nod.y);
    c = mix(c, mix(vec3(0.17, 0.06, 0.035), vec3(0.32, 0.12, 0.05), sHash(vec2(nod.y, 1.0))), nodule * 0.8);
    vec2 ves = sCell(p * 64.0 + 5.0 + 0.6 * sNoise(p * 80.0));
    float pit = smoothstep(0.22, 0.1, ves.x) * step(0.9, ves.y);
    c = mix(c, vec3(0.80, 0.56, 0.34), pit * 0.7);
    h = 0.5 + 0.18 * nodule - 0.3 * pit + 0.08 * n2;
  } else if (k == 2) {
    // clay: blue-grey, smooth, faint horizontal banding
    c *= 0.94 + 0.08 * sin(p.y * 90.0 + n1 * 4.0);
    c = mix(c, vec3(0.16, 0.20, 0.25), 0.35);
    h = 0.4 + 0.03 * n1;
  } else if (k == 3) {
    // silt: fine laminations; clay lenses
    float lam = sin((p.y + 0.012 * sFbm(p * vec2(1.5, 0.5))) * 520.0);
    c *= 0.96 + 0.05 * lam + 0.03 * grain;
    h = 0.48 + 0.04 * lam;
    float cell = floor(p.x / 1.7);
    vec2 r = sHash2(vec2(cell, 4.0));
    vec2 lc = vec2((cell + 0.25 + 0.5 * r.x) * 1.7, mix(lo, hi, 0.3 + 0.4 * r.y));
    vec2 q = (p - lc) / vec2(0.35 + 0.35 * r.y, 0.035 + 0.03 * r.x);
    float lens = smoothstep(1.0, 0.85, dot(q, q));
    c = mix(c, vec3(0.36, 0.38, 0.40), lens);
    h = mix(h, 0.4, lens);
  } else if (k == 4) {
    // sand: speckled grain, faint cross-bedding, pebbles
    c *= 0.86 + 0.28 * grain;
    float cross = sin((p.x * 0.8 + p.y * 2.2 + 0.05 * sin(p.x * 3.0)) * 140.0);
    c *= 0.97 + 0.03 * cross;
    vec2 pq = p * vec2(34.0, 44.0) + 0.7 * vec2(sNoise(p * 59.0), sNoise(p * 49.0 + 2.0));
    vec2 pb = sCell(pq);
    float psz = mix(0.16, 0.36, sHash(vec2(pb.y, 6.0)));
    float peb = smoothstep(psz, psz * 0.75, pb.x) * step(0.86, pb.y);
    vec3 pc = mix(vec3(0.28, 0.26, 0.24), vec3(0.58, 0.52, 0.44), sHash(vec2(pb.y, 2.0)));
    c = mix(c, pc * (0.8 + 0.4 * (1.0 - pb.x / psz)), peb);
    h = 0.5 + 0.1 * grain + 0.4 * peb * (1.0 - pb.x / psz);
  } else {
    // topsoil: dark, crumbly, with roots reaching down
    float crumb = sFbm(p * 9.0 + 4.0);
    c *= 0.75 + 0.5 * crumb;
    h = 0.5 + 0.3 * (crumb - 0.5) + 0.08 * n2;
  }
  // roots: wandering dark threads from the topsoil down into the silt below it
  float rootLo = ${glslF(+rootLo.toFixed(4))};
  if (p.y > rootLo) {
    float wx = p.x + 0.06 * sin(p.y * 7.0 + sNoise(vec2(p.x * 3.0, 1.0)) * 6.0) + 0.04 * (sFbm(vec2(p.y * 4.0, p.x)) - 0.5);
    float lane = fract(wx * 2.6);
    float id = floor(wx * 2.6);
    float reach = mix(rootLo, ${glslF(+rootMid.toFixed(4))}, sHash(vec2(id, 7.0)));
    float thick = mix(0.012, 0.03, sHash(vec2(id, 3.0))) * smoothstep(reach, reach + 0.25, p.y);
    float root = smoothstep(thick, thick * 0.4, abs(lane - 0.5) / 2.6) * step(0.35, sHash(vec2(id, 9.0)));
    c = mix(c, vec3(0.10, 0.06, 0.04), root * 0.85);
    h = mix(h, 0.7, root);
  }
  // water has percolated down: faint iron-stained streaks
  float streak = smoothstep(0.62, 0.85, sFbm(vec2(p.x * 7.0, p.y * 0.35) + 13.0));
  c = mix(c, c * vec3(1.12, 0.86, 0.7), streak * 0.35);
  // each contact: a darker skin and a small step
  float t = (p.y - lo) / max(1e-3, hi - lo);
  c *= 1.0 - 0.12 * exp(-(1.0 - t) * (hi - lo) * 60.0);
  h -= 0.1 * exp(-t * (hi - lo) * 80.0);
  // soft contacts: each layer bleeds into the next over a few ragged centimetres (never a ruled line)
  float soft = 0.05 + 0.05 * sFbm(vec2(p.x * 2.1, float(li) * 3.7));
  if (li > 0) c = mix(c, strataBase(li - 1) * (0.9 + 0.2 * n1), 0.5 * (1.0 - smoothstep(0.0, soft, p.y - lo)));
  if (li < ${layers.length - 1}) c = mix(c, strataBase(li + 1) * (0.9 + 0.2 * n1), 0.5 * (1.0 - smoothstep(0.0, soft, hi - p.y)));
  albedo = c;
  height = clamp(h, 0.0, 1.0);
}
`
  return { glsl, tops, key: `${JSON.stringify(layers)}|${seed}|${octaves}|${y0}|${y1}` }
}
