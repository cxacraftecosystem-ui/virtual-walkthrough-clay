/**
 * MANDALA BAND — polar canvas textures for the oculus crown, the court floor mandala and the
 * jali gobo (SPECTACLE F10, F11).
 *
 * Every texture here is PLAN-MAPPED: it covers the square [−R, R]² of the floor plan about the
 * oculus centre, with
 *
 *     u = 0.5 + x / (2R)      v = 0.5 + z / (2R)          (flipY off: canvas row 0 is v = 0)
 *
 * so a mesh at any height samples it straight from its world (x, z) — the soffit rings, the
 * floor decal and the water ring's analytic reflection all line up with no per-mesh UV work.
 *
 *   getMandalaBand({ pattern, petals, r0, r1, size, gold })   crown (r0 ≥ 2.6) or floor (r0 > 3)
 *       albedo   sRGB colour (alpha = coverage: the floor inlay is see-through between motifs)
 *       normal   tangent-space relief (from a drawn height field)
 *       gold     roughness in G, metalness in B (MeshStandardMaterial roughnessMap/metalnessMap)
 *       gobo     the jali ring's light mask (below)
 *   getJaliGobo(size)       white = open sky, black = pierced clay; R = GOBO_R (the oculus).
 *                           The jali ring (JALI.r0 … r1) is lace, everything inside r0 is open.
 *                           WP2 samples it inside the oculus mask (u, v from the sun-projected
 *                           floor point), so the lace mandala lands on the floor on every tier.
 *
 * Canvas work happens once per (pattern, size) and is cached; textures are never disposed while
 * the page lives (a few MB at most, per SPECTACLE §5).
 */
import * as THREE from 'three'
import { MUSEUM } from '../config/museum'
import { mulberry32 } from './noise'

export interface MandalaBandOptions {
  pattern: 'chakra' | 'lotus' | 'alpana'
  petals: number
  /** Annulus radii (m) the band covers. */
  r0: number
  r1: number
  /** Texture size (px), from the tier's spectacleTexPx. */
  size: number
  gold: boolean
}

export interface MandalaBandTextures {
  albedo: THREE.Texture
  normal: THREE.Texture
  gold: THREE.Texture
  gobo: THREE.Texture
}

/** The pierced terracotta ring hung in the oculus opening (F10); the helix hangs from it. */
export const JALI = { r0: MUSEUM.oculus.r * 0.77, r1: MUSEUM.oculus.r } as const
/** Plan half-extent of the gobo texture: the oculus radius. */
export const GOBO_R = MUSEUM.oculus.r
/** Crown and floor extents (m). */
export const CROWN = { r0: MUSEUM.oculus.r, r1: MUSEUM.oculus.r * 1.77 } as const
/** The floor ring between the pool's edge and the brass floor ring. */
export const FLOOR_MANDALA = { r0: MUSEUM.oculus.rings[0], r1: MUSEUM.oculus.floorRingR } as const

/* ------------------------------------------------------------------ */
/* canvas helpers (shared with friezeTextures.ts / decorTextures.ts)   */
/* ------------------------------------------------------------------ */

export type Ctx = CanvasRenderingContext2D

export function texCanvas(w: number, h: number): [HTMLCanvasElement, Ctx] {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return [c, c.getContext('2d', { willReadFrequently: true })!]
}

/** Red channel of a canvas → 0 … 1 heights. */
export function canvasHeights(c: HTMLCanvasElement): Float32Array {
  const d = c.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, c.width, c.height).data
  const h = new Float32Array(c.width * c.height)
  for (let i = 0; i < h.length; i++) h[i] = d[i * 4] / 255
  return h
}

/**
 * Heights → tangent-space normal map. `k` = relief depth / pixel size (steepness). Rows are kept
 * in canvas order, so build the texture with flipY off (v grows with the canvas row) — or pass
 * `flipRows` for a texture sampled with the canvas' top at v = 1. `wrapX` wraps horizontally.
 */
export function heightToNormal(h: Float32Array, W: number, H: number, k: number, opts: { wrapX?: boolean; flipRows?: boolean } = {}): THREE.DataTexture {
  const out = new Uint8Array(W * H * 4)
  const at = (x: number, y: number) => {
    if (opts.wrapX) x = (x + W) % W
    else x = x < 0 ? 0 : x >= W ? W - 1 : x
    y = y < 0 ? 0 : y >= H ? H - 1 : y
    return h[y * W + x]
  }
  const sv = opts.flipRows ? -1 : 1
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * k * 0.5
      const dy = (at(x, y + 1) - at(x, y - 1)) * k * 0.5 * sv
      const inv = 1 / Math.sqrt(dx * dx + dy * dy + 1)
      const row = opts.flipRows ? H - 1 - y : y
      const o = (row * W + x) * 4
      out[o] = Math.round((-dx * inv * 0.5 + 0.5) * 255)
      out[o + 1] = Math.round((-dy * inv * 0.5 + 0.5) * 255)
      out[o + 2] = Math.round((inv * 0.5 + 0.5) * 255)
      out[o + 3] = 255
    }
  const t = new THREE.DataTexture(out, W, H, THREE.RGBAFormat, THREE.UnsignedByteType)
  t.colorSpace = THREE.NoColorSpace
  t.generateMipmaps = true
  t.minFilter = THREE.LinearMipmapLinearFilter
  t.magFilter = THREE.LinearFilter
  t.needsUpdate = true
  return t
}

function finish<T extends THREE.Texture>(t: T, srgb: boolean, name: string, flipY = false): T {
  t.name = name
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace
  t.flipY = flipY
  t.wrapS = THREE.ClampToEdgeWrapping
  t.wrapT = THREE.ClampToEdgeWrapping
  t.generateMipmaps = true
  t.minFilter = THREE.LinearMipmapLinearFilter
  t.magFilter = THREE.LinearFilter
  t.anisotropy = 4
  t.needsUpdate = true
  return t
}

/* ------------------------------------------------------------------ */
/* layered painter: colour, height and gold drawn in one pass          */
/* ------------------------------------------------------------------ */

interface Style {
  /** Fill colour (null = leave colour untouched). */
  fill?: string | null
  /** Height grey 0 … 1 (null = untouched). */
  h?: number | null
  /** Gold inlay. */
  gold?: boolean
  /** Stroke instead of fill, width in metres. */
  stroke?: number
}

class Painter {
  readonly a: Ctx
  readonly h: Ctx
  readonly g: Ctx
  readonly C: number
  readonly ppm: number
  constructor(
    readonly size: number,
    readonly R: number,
    transparent: boolean,
  ) {
    ;[, this.a] = texCanvas(size, size)
    ;[, this.h] = texCanvas(size, size)
    ;[, this.g] = texCanvas(size, size)
    this.C = size / 2
    this.ppm = size / (2 * R)
    if (!transparent) {
      this.a.fillStyle = '#000'
      this.a.fillRect(0, 0, size, size)
    }
    this.h.fillStyle = '#000'
    this.h.fillRect(0, 0, size, size)
    this.g.fillStyle = '#000'
    this.g.fillRect(0, 0, size, size)
    for (const c of [this.a, this.h, this.g]) {
      c.translate(this.C, this.C)
      c.scale(this.ppm, this.ppm)
      c.lineJoin = 'round'
      c.lineCap = 'round'
    }
  }

  /** Draw `path` (metres, plan frame) with a style into every layer it touches. */
  draw(path: (c: Ctx) => void, s: Style) {
    const layers: [Ctx, string | null | undefined][] = [
      [this.a, s.fill],
      [this.h, s.h === null || s.h === undefined ? undefined : grey(s.h)],
      [this.g, s.gold === undefined ? undefined : s.gold ? '#fff' : '#000'],
    ]
    for (const [c, col] of layers) {
      if (!col) continue
      c.beginPath()
      path(c)
      if (s.stroke) {
        c.strokeStyle = col
        c.lineWidth = s.stroke
        c.stroke()
      } else {
        c.fillStyle = col
        c.fill('evenodd')
      }
    }
  }

  /** `n`-fold repetition: rotates the frame so +x points along each spoke. */
  around(n: number, offsetRad: number, fn: (i: number) => void) {
    for (let i = 0; i < n; i++) {
      const a = offsetRad + (i / n) * Math.PI * 2
      for (const c of [this.a, this.h, this.g]) {
        c.save()
        c.rotate(a)
      }
      fn(i)
      for (const c of [this.a, this.h, this.g]) c.restore()
    }
  }
}

const grey = (v: number) => {
  const x = Math.round(Math.min(1, Math.max(0, v)) * 255)
  return `rgb(${x},${x},${x})`
}

const ring = (r0: number, r1: number) => (c: Ctx) => {
  c.arc(0, 0, r1, 0, Math.PI * 2)
  c.moveTo(r0, 0)
  c.arc(0, 0, r0, 0, Math.PI * 2, true)
}
const circle = (x: number, y: number, r: number) => (c: Ctx) => {
  c.moveTo(x + r, y)
  c.arc(x, y, r, 0, Math.PI * 2)
}
/** A pointed petal on the +x axis from radius ri to ro, half width w (m) at its belly. */
const petal = (ri: number, ro: number, w: number, belly = 0.45) => (c: Ctx) => {
  const m = ri + (ro - ri) * belly
  c.moveTo(ri, 0)
  c.bezierCurveTo(ri + (m - ri) * 0.3, w * 1.05, m, w, ro, 0)
  c.bezierCurveTo(m, -w, ri + (m - ri) * 0.3, -w * 1.05, ri, 0)
}
/** A cusped arch (scallop) opening outward. */
const scallop = (r0: number, r1: number, half: number) => (c: Ctx) => {
  const x0 = r0 * Math.cos(half)
  const y0 = r0 * Math.sin(half)
  c.moveTo(x0, -y0)
  c.quadraticCurveTo(r1 * 1.02, -y0 * 0.98, r1, 0)
  c.quadraticCurveTo(r1 * 1.02, y0 * 0.98, x0, y0)
  c.arc(0, 0, r0, half, -half, true)
}

/** Clay mottle: soft blotches of lighter / darker clay over the colour layer, inside an annulus. */
function mottle(p: Painter, r0: number, r1: number, seed: number, light: string, dark: string, count: number, alpha: number) {
  const rnd = mulberry32(seed)
  const c = p.a
  c.save()
  c.beginPath()
  ring(r0, r1)(c)
  c.clip('evenodd')
  for (let i = 0; i < count; i++) {
    const r = r0 + rnd() * (r1 - r0)
    const a = rnd() * Math.PI * 2
    const s = 0.08 + rnd() * 0.3
    const x = r * Math.cos(a)
    const y = r * Math.sin(a)
    const g = c.createRadialGradient(x, y, 0, x, y, s)
    g.addColorStop(0, rnd() < 0.5 ? light : dark)
    g.addColorStop(1, 'rgba(0,0,0,0)')
    c.globalAlpha = alpha * (0.4 + 0.6 * rnd())
    c.fillStyle = g
    c.fillRect(x - s, y - s, 2 * s, 2 * s)
  }
  c.restore()
  c.globalAlpha = 1
}

/** Height noise: fine tooth everywhere (hand-finished clay, never machine-flat). */
function tooth(p: Painter, seed: number, amp: number) {
  const S = p.size
  const img = p.h.getImageData(0, 0, S, S)
  const d = img.data
  const rnd = mulberry32(seed)
  for (let i = 0; i < d.length; i += 4) {
    const v = d[i] + (rnd() - 0.5) * amp * 255
    const x = v < 0 ? 0 : v > 255 ? 255 : v
    d[i] = d[i + 1] = d[i + 2] = x
  }
  p.h.putImageData(img, 0, 0)
}

/* ------------------------------------------------------------------ */
/* the crown (soffit, seen from below): r 2.6 … 4.6                    */
/* ------------------------------------------------------------------ */

const CLAY = { oxblood: '#6e2a20', terracotta: '#a9553a', rose: '#c98a74', blush: '#dcae98', buff: '#ead2b6', slip: '#f0e3cc', black: '#231a16', gold: '#c99a3e', ochre: '#c4893f' }

function paintCrown(p: Painter, o: MandalaBandOptions) {
  const n = Math.max(8, Math.round(o.petals))
  const A = CLAY
  // ── band 1: step 1 underside (2.60 … 3.05), oxblood with a ring of buff lotus buds ──
  p.draw(ring(2.55, 3.07), { fill: A.oxblood, h: 0.35, gold: false })
  p.around(n * 2, 0, () => p.draw(petal(2.66, 3.0, 0.07), { fill: A.buff, h: 0.75 }))
  p.around(n * 2, 0, () => p.draw(petal(2.72, 2.93, 0.028), { fill: o.gold ? A.gold : A.ochre, h: 0.85, gold: o.gold }))
  p.around(n * 4, Math.PI / (n * 4), () => p.draw(circle(2.99, 0, 0.018), { fill: A.buff, h: 0.7 }))
  p.draw(ring(2.6, 2.625), { fill: o.gold ? A.gold : A.buff, h: 0.8, gold: o.gold })
  // ── band 2: step 2 underside (3.05 … 3.50), terracotta chevrons ──
  p.draw(ring(3.03, 3.52), { fill: A.terracotta, h: 0.35, gold: false })
  p.around(n * 3, 0, () => {
    const half = Math.PI / (n * 3)
    p.draw(
      (c) => {
        c.moveTo(3.1 * Math.cos(-half), 3.1 * Math.sin(-half))
        c.lineTo(3.44, 0)
        c.lineTo(3.1 * Math.cos(half), 3.1 * Math.sin(half))
        c.closePath()
      },
      { fill: A.blush, h: 0.7 },
    )
    p.draw(
      (c) => {
        c.moveTo(3.17 * Math.cos(-half * 0.55), 3.17 * Math.sin(-half * 0.55))
        c.lineTo(3.36, 0)
        c.lineTo(3.17 * Math.cos(half * 0.55), 3.17 * Math.sin(half * 0.55))
        c.closePath()
      },
      { fill: A.oxblood, h: 0.45 },
    )
  })
  p.draw(ring(3.47, 3.49), { fill: o.gold ? A.gold : A.buff, h: 0.8, gold: o.gold })
  // ── band 3: the main soffit (3.50 … 4.60), rose clay with the great petals ──
  p.draw(ring(3.48, 4.62), { fill: A.rose, h: 0.3, gold: false })
  mottle(p, 3.48, 4.62, 41, 'rgba(240,200,180,0.55)', 'rgba(120,60,45,0.35)', 260, 0.35)
  const half = Math.PI / n
  if (o.pattern === 'chakra') {
    // the wheel: spokes, arched cusps between them, a rim of beads
    p.around(n, 0, () => {
      p.draw(scallop(3.62, 4.3, half * 0.92), { fill: A.blush, h: 0.6 })
      p.draw(scallop(3.7, 4.16, half * 0.7), { fill: A.terracotta, h: 0.45 })
      p.draw(petal(3.78, 4.08, 0.06, 0.5), { fill: A.buff, h: 0.8 })
    })
    p.around(n, half, () => {
      p.draw((c) => c.rect(3.55, -0.022, 0.95, 0.044), { fill: o.gold ? A.gold : A.oxblood, h: 0.85, gold: o.gold })
      p.draw(circle(4.33, 0, 0.06), { fill: A.oxblood, h: 0.75 })
      p.draw(circle(4.33, 0, 0.03), { fill: o.gold ? A.gold : A.buff, h: 0.9, gold: o.gold })
    })
  } else if (o.pattern === 'lotus') {
    // two layers of lotus petals, the back row offset half a petal
    p.around(n, half, () => p.draw(petal(3.58, 4.38, 0.42 * Math.sin(half) * 3.9, 0.5), { fill: A.blush, h: 0.55 }))
    p.around(n, 0, () => {
      p.draw(petal(3.56, 4.28, 0.36 * Math.sin(half) * 3.9, 0.48), { fill: A.buff, h: 0.75 })
      p.draw(petal(3.66, 4.1, 0.05, 0.5), { fill: o.gold ? A.gold : A.terracotta, h: 0.85, gold: o.gold })
    })
  } else {
    // alpana: white slip curls (spirals) on the rose ground, drawn as strokes
    p.around(n, 0, () => {
      p.draw(
        (c) => {
          c.moveTo(3.6, 0)
          c.bezierCurveTo(3.85, 0.2, 4.15, 0.15, 4.2, -0.02)
          c.bezierCurveTo(4.24, -0.16, 4.07, -0.2, 4.02, -0.08)
          c.bezierCurveTo(3.99, 0.0, 4.07, 0.04, 4.1, -0.03)
        },
        { fill: A.slip, h: 0.8, stroke: 0.035 },
      )
      p.draw(
        (c) => {
          c.moveTo(3.6, 0)
          c.bezierCurveTo(3.85, -0.2, 4.15, -0.15, 4.2, 0.02)
          c.bezierCurveTo(4.24, 0.16, 4.07, 0.2, 4.02, 0.08)
          c.bezierCurveTo(3.99, 0.0, 4.07, -0.04, 4.1, 0.03)
        },
        { fill: A.slip, h: 0.8, stroke: 0.035 },
      )
      p.draw(circle(4.36, 0, 0.035), { fill: o.gold ? A.gold : A.slip, h: 0.85, gold: o.gold })
    })
  }
  // outer border: gold ring, beads, a dentil edge into the plain soffit
  p.draw(ring(4.44, 4.465), { fill: o.gold ? A.gold : A.oxblood, h: 0.85, gold: o.gold })
  p.around(n * 6, 0, () => p.draw(circle(4.505, 0, 0.022), { fill: A.buff, h: 0.75 }))
  p.draw(ring(4.55, 4.6), { fill: A.oxblood, h: 0.5 })
  p.draw(ring(3.52, 3.545), { fill: o.gold ? A.gold : A.oxblood, h: 0.85, gold: o.gold })
}

/* ------------------------------------------------------------------ */
/* the court floor (r 3.2 … 5.6): terracotta, slip and black tile      */
/* ------------------------------------------------------------------ */

/**
 * The floor's own, quieter palette: slip-brown where the crown has black, a warm buff for the
 * slip, so the inlay sits under the objects (about 40 % less contrast) instead of fighting them.
 */
const FLOOR_CLAY = { ...CLAY, black: '#5e3d2e', slip: '#d6bc9c', oxblood: '#7c3a2a', terracotta: '#a65a3e' }

function paintFloor(p: Painter, o: MandalaBandOptions) {
  const n = Math.max(8, Math.round(o.petals))
  const A = FLOOR_CLAY
  const half = Math.PI / n
  // inner black-tile band with slip dots
  p.draw(ring(3.2, 3.46), { fill: A.black, h: 0.45 })
  p.around(n * 4, 0, () => p.draw(circle(3.33, 0, 0.032), { fill: A.slip, h: 0.6 }))
  p.draw(ring(3.48, 3.5), { fill: A.slip, h: 0.55 })
  // the petal ring
  if (o.pattern === 'alpana') {
    p.around(n, 0, () => {
      p.draw(petal(3.56, 4.32, 0.2, 0.5), { fill: A.slip, h: 0.6 })
      p.draw(petal(3.66, 4.18, 0.12, 0.5), { fill: A.terracotta, h: 0.5 })
      p.draw(circle(3.88, 0, 0.05), { fill: A.black, h: 0.45 })
    })
  } else {
    p.around(n, 0, () => {
      p.draw(petal(3.54, 4.36, 0.3, 0.46), { fill: A.slip, h: 0.6 })
      p.draw(petal(3.58, 4.3, 0.25, 0.46), { fill: A.terracotta, h: 0.55 })
      p.draw(petal(3.7, 4.12, 0.09, 0.5), { fill: A.black, h: 0.45 })
    })
    p.around(n, half, () => p.draw(petal(3.62, 4.04, 0.1, 0.5), { fill: A.oxblood, h: 0.5 }))
  }
  // slip chevron ring
  p.draw(ring(4.4, 4.62), { fill: A.black, h: 0.45 })
  p.around(n * 4, 0, () => {
    const h2 = Math.PI / (n * 4)
    p.draw(
      (c) => {
        c.moveTo(4.43 * Math.cos(-h2 * 0.8), 4.43 * Math.sin(-h2 * 0.8))
        c.lineTo(4.59, 0)
        c.lineTo(4.43 * Math.cos(h2 * 0.8), 4.43 * Math.sin(h2 * 0.8))
        c.closePath()
      },
      { fill: A.slip, h: 0.6 },
    )
  })
  // outer great petals: alternating terracotta and black, slip tips
  p.around(n * 2, 0, (i) => {
    const h2 = Math.PI / (n * 2)
    p.draw(scallop(4.66, 5.34, h2 * 0.9), { fill: i % 2 ? A.black : A.terracotta, h: 0.55 })
    p.draw(petal(4.78, 5.24, 0.06, 0.55), { fill: A.slip, h: 0.6 })
  })
  // border
  p.draw(ring(5.38, 5.42), { fill: A.slip, h: 0.55 })
  p.around(n * 8, 0, () => p.draw(circle(5.5, 0, 0.035), { fill: A.terracotta, h: 0.6 }))
  p.draw(ring(5.57, 5.6), { fill: A.black, h: 0.5 })
}

/* ------------------------------------------------------------------ */
/* the jali ring and its gobo                                          */
/* ------------------------------------------------------------------ */

/** Pierced pattern of the jali ring (white = solid clay), drawn at plan scale R = GOBO_R. */
function paintJali(c: Ctx, solid: string, open: string) {
  const { r0, r1 } = JALI
  c.fillStyle = solid
  c.beginPath()
  ring(r0, r1)(c)
  c.fill('evenodd')
  c.fillStyle = open
  const n = 32
  for (let i = 0; i < n; i++) {
    c.save()
    c.rotate((i / n) * Math.PI * 2)
    // a lancet window and a quatrefoil above it
    c.beginPath()
    petal(r0 + 0.07, r1 - 0.17, 0.085, 0.42)(c)
    c.fill()
    c.beginPath()
    for (const [dx, dy] of [
      [0.045, 0],
      [-0.045, 0],
      [0, 0.045],
      [0, -0.045],
    ])
      circle(r1 - 0.1 + dx * 0.8, dy * 0.8, 0.03)(c)
    c.fill()
    c.restore()
    c.save()
    c.rotate(((i + 0.5) / n) * Math.PI * 2)
    c.beginPath()
    circle(r0 + 0.16, 0, 0.032)(c)
    c.fill()
    c.restore()
  }
}

const goboCache = new Map<number, THREE.CanvasTexture>()

/** The jali ring as a light mask over the oculus (white = open). R = GOBO_R. */
export function getJaliGobo(size: number): THREE.CanvasTexture {
  let t = goboCache.get(size)
  if (t) return t
  const [cv, c] = texCanvas(size, size)
  c.fillStyle = '#000'
  c.fillRect(0, 0, size, size)
  c.translate(size / 2, size / 2)
  c.scale(size / (2 * GOBO_R), size / (2 * GOBO_R))
  c.fillStyle = '#fff'
  c.beginPath()
  circle(0, 0, GOBO_R)(c)
  c.fill()
  paintJali(c, '#000', '#fff')
  t = finish(new THREE.CanvasTexture(cv), false, `jali-gobo-${size}`)
  goboCache.set(size, t)
  return t
}

const jaliAlphaCache = new Map<number, THREE.CanvasTexture>()

/** Alpha mask of the jali ring itself (white = clay), plan-mapped at R = GOBO_R. */
export function getJaliAlpha(size: number): THREE.CanvasTexture {
  let t = jaliAlphaCache.get(size)
  if (t) return t
  const [cv, c] = texCanvas(size, size)
  c.fillStyle = '#000'
  c.fillRect(0, 0, size, size)
  c.translate(size / 2, size / 2)
  c.scale(size / (2 * GOBO_R), size / (2 * GOBO_R))
  paintJali(c, '#fff', '#000')
  t = finish(new THREE.CanvasTexture(cv), false, `jali-alpha-${size}`)
  jaliAlphaCache.set(size, t)
  return t
}

/* ------------------------------------------------------------------ */
/* public                                                              */
/* ------------------------------------------------------------------ */

const cache = new Map<string, MandalaBandTextures>()

/**
 * The band's textures (plan-mapped over [−r1, r1]²). A band starting at the oculus (r0 ≤ 2.7) is
 * the crown; one starting further out is the floor mandala. Returns null outside the browser.
 */
export function getMandalaBand(opts: MandalaBandOptions): MandalaBandTextures | null {
  if (typeof document === 'undefined') return null
  const crown = opts.r0 <= 2.7
  const size = Math.max(256, Math.min(2048, opts.size))
  const key = `${crown ? 'crown' : 'floor'}|${opts.pattern}|${Math.round(opts.petals)}|${opts.gold}|${size}`
  const hit = cache.get(key)
  if (hit) return hit
  const R = crown ? CROWN.r1 : FLOOR_MANDALA.r1
  const p = new Painter(size, R, !crown)
  if (crown) paintCrown(p, opts)
  else paintFloor(p, opts)
  tooth(p, crown ? 7 : 11, 0.05)
  // a little blur on the height so the relief reads as carved, not stamped
  const [bc, b] = texCanvas(size, size)
  b.filter = `blur(${Math.max(0.6, size / 900)}px)`
  b.drawImage(p.h.canvas, 0, 0)
  const pxM = (2 * R) / size
  const depth = crown ? 0.012 : 0.004
  const normal = finish(heightToNormal(canvasHeights(bc), size, size, depth / pxM), false, `mandala-normal-${key}`)
  // roughness (G) / metalness (B) from the gold mask
  const gd = p.g.getImageData(0, 0, size, size).data
  const orm = new Uint8Array(size * size * 4)
  for (let i = 0; i < size * size; i++) {
    const gold = gd[i * 4] / 255
    orm[i * 4] = 255
    orm[i * 4 + 1] = Math.round((0.86 - 0.56 * gold) * 255)
    orm[i * 4 + 2] = Math.round(gold * 0.95 * 255)
    orm[i * 4 + 3] = 255
  }
  const goldTex = finish(new THREE.DataTexture(orm, size, size, THREE.RGBAFormat), false, `mandala-orm-${key}`)
  const albedo = finish(new THREE.CanvasTexture(p.a.canvas), true, `mandala-albedo-${key}`)
  const out: MandalaBandTextures = { albedo, normal, gold: goldTex, gobo: getJaliGobo(Math.min(1024, size)) }
  cache.set(key, out)
  return out
}

/** Plan → band UV: u = 0.5 + x / (2R), v = 0.5 + z / (2R). */
export function planUV(x: number, z: number, R: number): [number, number] {
  return [0.5 + x / (2 * R), 0.5 + z / (2 * R)]
}

/** Overwrite a geometry's uv with plan-mapped coordinates over [−R, R]². */
export function setPlanUV(geo: THREE.BufferGeometry, R: number) {
  const p = geo.getAttribute('position')
  const uv = new Float32Array(p.count * 2)
  for (let i = 0; i < p.count; i++) {
    uv[i * 2] = 0.5 + p.getX(i) / (2 * R)
    uv[i * 2 + 1] = 0.5 + p.getZ(i) / (2 * R)
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  return geo
}
