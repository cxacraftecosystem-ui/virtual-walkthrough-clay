/**
 * FRIEZE TEXTURES — the procession relief round the duplex band (SPECTACLE F20).
 *
 * One seamless tile of eight scenes of the clay's life, drawn as abstract, dignified canvas
 * silhouettes (no faces, no costume): dig · carry · knead · throw · beat · dry · fire · to market,
 * each scene parted from the next by a small rosette, between beaded mouldings. The silhouettes
 * are drawn as a HEIGHT field (figures raised, ground recessed, mouldings proud) which becomes
 * the normal map, and tinted into terracotta for the albedo, darker in the recesses.
 *
 *   getFriezeTile(pxPerM) → { map, normalMap, tileM, bandM }     (wraps in u; v = 0 bottom … 1 top)
 *
 * `scenes` (the curator's text, one scene id per line) reorders or repeats the eight scenes.
 */
import * as THREE from 'three'
import { canvasHeights, heightToNormal, texCanvas, type Ctx } from './mandalaBand'

export const FRIEZE_SCENES = ['dig', 'carry', 'knead', 'throw', 'beat', 'dry', 'fire', 'market'] as const
export type FriezeScene = (typeof FRIEZE_SCENES)[number]

/** Band height and one scene's width (m). */
export const FRIEZE = { bandM: 0.6, sceneM: 1.2, borderM: 0.055, groundM: 0.11 } as const

export interface FriezeTile {
  map: THREE.CanvasTexture
  normalMap: THREE.DataTexture
  tileM: number
  bandM: number
}

type P = [number, number]

/** Joints of a figure, metres from the point between its feet (x right, y up). */
interface Pose {
  hip: P
  neck: P
  head: P
  arms: [P, P][]
  legs: [P, P][]
}

/** A figure as strokes (limbs), a torso and a head, in the current fill/stroke style. */
function figure(c: Ctx, x0: number, toPx: (x: number, y: number) => P, p: Pose, s = 1) {
  const T = (q: P) => toPx(x0 + q[0] * s, q[1] * s)
  const line = (pts: P[], w: number) => {
    c.lineWidth = w
    c.beginPath()
    const [sx, sy] = T(pts[0])
    c.moveTo(sx, sy)
    for (let i = 1; i < pts.length; i++) {
      const [px, py] = T(pts[i])
      c.lineTo(px, py)
    }
    c.stroke()
  }
  const pxm = Math.abs(toPx(1, 0)[0] - toPx(0, 0)[0])
  // torso: a tapering stroke from hip to neck
  line([p.hip, p.neck], 0.055 * s * pxm)
  for (const [k, f] of p.legs) line([p.hip, k, f], 0.034 * s * pxm)
  for (const [e, h] of p.arms) line([p.neck, e, h], 0.024 * s * pxm)
  const [hx, hy] = T(p.head)
  c.beginPath()
  c.arc(hx, hy, 0.032 * s * pxm, 0, Math.PI * 2)
  c.fill()
}

/** A round-bellied pot (matka) standing at (x, y), height h (m). */
function pot(c: Ctx, toPx: (x: number, y: number) => P, x: number, y: number, h: number) {
  const [cx, cy] = toPx(x, y + h * 0.42)
  const [, top] = toPx(x, y + h)
  const pxm = Math.abs(toPx(1, 0)[0] - toPx(0, 0)[0])
  c.beginPath()
  c.ellipse(cx, cy, h * 0.52 * pxm, h * 0.42 * pxm, 0, 0, Math.PI * 2)
  c.fill()
  c.fillRect(cx - h * 0.2 * pxm, top, h * 0.4 * pxm, h * 0.3 * pxm)
  c.fillRect(cx - h * 0.27 * pxm, top - 0.012 * pxm, h * 0.54 * pxm, 0.02 * pxm)
}

const STAND: Pose = {
  hip: [0, 0.19],
  neck: [0, 0.335],
  head: [0, 0.375],
  arms: [
    [
      [-0.04, 0.26],
      [-0.045, 0.19],
    ],
    [
      [0.04, 0.26],
      [0.045, 0.19],
    ],
  ],
  legs: [
    [
      [-0.02, 0.1],
      [-0.03, 0.0],
    ],
    [
      [0.02, 0.1],
      [0.03, 0.0],
    ],
  ],
}

/** Draw scene `id` in the box starting at x0 (m), on the ground line gy (m). */
function scene(c: Ctx, id: FriezeScene, x0: number, gy: number, toPx: (x: number, y: number) => P, pxm: number) {
  const at = (x: number, y: number) => toPx(x, y + gy)
  const fig = (x: number, p: Pose, s = 1) => figure(c, x, at, p, s)
  const stroke = (pts: P[], w: number) => {
    c.lineWidth = w * pxm
    c.beginPath()
    const [sx, sy] = at(x0 + pts[0][0], pts[0][1])
    c.moveTo(sx, sy)
    for (const q of pts.slice(1)) {
      const [px, py] = at(x0 + q[0], q[1])
      c.lineTo(px, py)
    }
    c.stroke()
  }
  const blob = (x: number, y: number, rx: number, ry: number) => {
    const [cx, cy] = at(x, y)
    c.beginPath()
    c.ellipse(cx, cy, rx * pxm, ry * pxm, 0, 0, Math.PI * 2)
    c.fill()
  }
  switch (id) {
    case 'dig': {
      // two diggers bent over the pit, hoes raised and falling
      for (const [dx, up] of [
        [0.32, 1],
        [0.78, 0],
      ] as const) {
        const hand: P = up ? [0.06, 0.4] : [0.14, 0.2]
        fig(x0 + dx, { hip: [0, 0.18], neck: [0.09, 0.29], head: [0.125, 0.32], arms: [[[0.06, 0.33], hand], [[0.1, 0.25], [hand[0] + 0.03, hand[1] - 0.02]]], legs: [[[-0.03, 0.09], [-0.06, 0]], [[0.04, 0.1], [0.06, 0]]] })
        const blade: P = up ? [0.0, 0.52] : [0.26, 0.04]
        stroke([[dx + hand[0], hand[1]], [dx + blade[0], blade[1]]], 0.012)
        blob(x0 + dx + blade[0] + 0.02, blade[1], 0.035, 0.018)
      }
      blob(x0 + 0.58, -0.005, 0.14, 0.035)
      break
    }
    case 'carry': {
      // a line of three carrying baskets of clay on their heads
      for (const [i, dx] of [0.22, 0.58, 0.94].entries()) {
        const step = i % 2 ? 1 : -1
        fig(x0 + dx, { ...STAND, arms: [[[-0.05, 0.38], [-0.04, 0.43]], [[0.05, 0.36], [0.04, 0.43]]], legs: [[[-0.02 * step, 0.1], [-0.06 * step, 0]], [[0.03 * step, 0.1], [0.06 * step, 0]]] })
        blob(x0 + dx, 0.44, 0.075, 0.03)
        blob(x0 + dx, 0.475, 0.05, 0.022)
      }
      break
    }
    case 'knead': {
      // treading the clay in a shallow pit, and pressing a mound with both hands
      blob(x0 + 0.38, 0.02, 0.22, 0.04)
      fig(x0 + 0.34, { hip: [0, 0.22], neck: [0, 0.36], head: [0, 0.4], arms: [[[-0.05, 0.3], [-0.04, 0.23]], [[0.05, 0.3], [0.04, 0.23]]], legs: [[[-0.03, 0.14], [-0.04, 0.035]], [[0.05, 0.16], [0.03, 0.08]]] })
      blob(x0 + 0.86, 0.05, 0.12, 0.06)
      fig(x0 + 0.72, { hip: [0, 0.16], neck: [0.07, 0.28], head: [0.1, 0.31], arms: [[[0.1, 0.22], [0.15, 0.11]], [[0.08, 0.2], [0.13, 0.1]]], legs: [[[-0.02, 0.08], [-0.04, 0]], [[0.04, 0.08], [0.05, 0]]] })
      break
    }
    case 'throw': {
      // a potter at the wheel; a finished pot waits beside
      blob(x0 + 0.62, 0.05, 0.2, 0.028)
      stroke([[0.62, 0.0], [0.62, 0.05]], 0.03)
      pot(c, at, x0 + 0.62, 0.075, 0.14)
      fig(x0 + 0.36, { hip: [0, 0.07], neck: [0.04, 0.22], head: [0.065, 0.26], arms: [[[0.12, 0.17], [0.2, 0.15]], [[0.1, 0.13], [0.19, 0.12]]], legs: [[[0.12, 0.13], [0.15, 0.0]], [[0.09, 0.11], [0.12, 0.0]]] })
      pot(c, at, x0 + 0.96, 0, 0.16)
      break
    }
    case 'beat': {
      // shaping with paddle and anvil: the paddle raised
      fig(x0 + 0.42, { hip: [0, 0.07], neck: [0.0, 0.22], head: [0.02, 0.26], arms: [[[0.09, 0.3], [0.15, 0.38]], [[0.08, 0.15], [0.13, 0.12]]], legs: [[[0.13, 0.12], [0.18, 0.0]], [[-0.06, 0.08], [0.0, 0.0]]] })
      stroke([[0.57, 0.38], [0.62, 0.45]], 0.014)
      blob(x0 + 0.645, 0.48, 0.035, 0.022)
      pot(c, at, x0 + 0.6, 0.05, 0.16)
      pot(c, at, x0 + 0.92, 0, 0.12)
      break
    }
    case 'dry': {
      // pots drying in rows under the sun
      const [sx, sy] = at(x0 + 0.95, 0.4)
      c.beginPath()
      c.arc(sx, sy, 0.05 * pxm, 0, Math.PI * 2)
      c.fill()
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2
        stroke([[0.95 + Math.cos(a) * 0.07, 0.4 + Math.sin(a) * 0.07], [0.95 + Math.cos(a) * 0.1, 0.4 + Math.sin(a) * 0.1]], 0.008)
      }
      for (let i = 0; i < 5; i++) pot(c, at, x0 + 0.12 + i * 0.13, 0, 0.1 + (i % 2) * 0.02)
      for (let i = 0; i < 4; i++) pot(c, at, x0 + 0.18 + i * 0.13, 0.13, 0.08)
      stroke([[0.06, 0.125], [0.66, 0.125]], 0.008)
      break
    }
    case 'fire': {
      // the kiln: a dome with its mouth, flames, a firer feeding it
      const [kx, ky] = at(x0 + 0.62, 0)
      c.beginPath()
      c.ellipse(kx, ky, 0.3 * pxm, 0.3 * pxm, 0, Math.PI, 0)
      c.fill()
      for (let i = 0; i < 5; i++) {
        const fx = 0.48 + i * 0.07
        const h = 0.07 + (i % 2) * 0.05
        const [b0x, b0y] = at(x0 + fx - 0.025, 0.3)
        const [tx, ty] = at(x0 + fx, 0.3 + h)
        const [b1x, b1y] = at(x0 + fx + 0.025, 0.3)
        c.beginPath()
        c.moveTo(b0x, b0y)
        c.quadraticCurveTo(b0x, ty + (b0y - ty) * 0.4, tx, ty)
        c.quadraticCurveTo(b1x, ty + (b1y - ty) * 0.4, b1x, b1y)
        c.fill()
      }
      fig(x0 + 0.18, { hip: [0, 0.17], neck: [0.07, 0.29], head: [0.1, 0.32], arms: [[[0.12, 0.24], [0.2, 0.17]], [[0.1, 0.22], [0.18, 0.15]]], legs: [[[-0.02, 0.09], [-0.05, 0]], [[0.04, 0.09], [0.05, 0]]] })
      stroke([[0.36, 0.17], [0.46, 0.08]], 0.012)
      break
    }
    case 'market': {
      // to market: a yoke across the shoulders, a pot hung at each end; a second carrier follows
      for (const dx of [0.36, 0.86]) {
        fig(x0 + dx, { ...STAND, arms: [[[-0.07, 0.33], [-0.11, 0.34]], [[0.07, 0.33], [0.1, 0.34]]], legs: [[[-0.02, 0.1], [-0.06, 0]], [[0.03, 0.1], [0.06, 0]]] })
        stroke([[dx - 0.2, 0.335], [dx + 0.2, 0.335]], 0.012)
        for (const e of [-0.18, 0.18]) {
          stroke([[dx + e, 0.335], [dx + e, 0.2]], 0.004)
          pot(c, at, x0 + dx + e, 0.08, 0.12)
        }
      }
      break
    }
  }
}

/** A rosette divider centred at x (m), mid-band. */
function rosette(c: Ctx, toPx: (x: number, y: number) => P, x: number, y: number, pxm: number) {
  const [cx, cy] = toPx(x, y)
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2
    c.beginPath()
    c.ellipse(cx + Math.cos(a) * 0.028 * pxm, cy + Math.sin(a) * 0.028 * pxm, 0.022 * pxm, 0.01 * pxm, a, 0, Math.PI * 2)
    c.fill()
  }
  c.beginPath()
  c.arc(cx, cy, 0.014 * pxm, 0, Math.PI * 2)
  c.fill()
}

const cache = new Map<string, FriezeTile>()

/** The seamless tile at `pxPerM` (capped at 4096 px wide), scenes in `order`. */
export function getFriezeTile(pxPerM: number, order: FriezeScene[] = [...FRIEZE_SCENES]): FriezeTile {
  const scenes = order.length ? order : [...FRIEZE_SCENES]
  const tileM = scenes.length * FRIEZE.sceneM
  const ppm = Math.min(pxPerM, 4096 / tileM)
  const W = Math.round(tileM * ppm)
  const H = Math.round(FRIEZE.bandM * ppm)
  const key = `${scenes.join(',')}|${W}`
  const hit = cache.get(key)
  if (hit) return hit
  const pxm = W / tileM
  // canvas: x right (m), y up from the band's bottom (m)
  const toPx = (x: number, y: number): P => [x * pxm, (FRIEZE.bandM - y) * pxm]
  const [hc, h] = texCanvas(W, H)
  // ground (recessed field)
  h.fillStyle = 'rgb(105,105,105)'
  h.fillRect(0, 0, W, H)
  // mouldings: a proud fillet with a row of beads, top and bottom
  const b = FRIEZE.borderM
  for (const [y0, y1] of [
    [0, b],
    [FRIEZE.bandM - b, FRIEZE.bandM],
  ]) {
    h.fillStyle = 'rgb(200,200,200)'
    const [, py0] = toPx(0, y1)
    h.fillRect(0, py0, W, (y1 - y0) * pxm)
    h.fillStyle = 'rgb(150,150,150)'
    const [, pm] = toPx(0, (y0 + y1) / 2)
    h.fillRect(0, pm - 0.004 * pxm, W, 0.008 * pxm)
    h.fillStyle = 'rgb(240,240,240)'
    for (let x = 0.02; x < tileM; x += 0.045) {
      const [bx, by] = toPx(x, (y0 + y1) / 2)
      h.beginPath()
      h.arc(bx, by, 0.012 * pxm, 0, Math.PI * 2)
      h.fill()
    }
  }
  // ground line
  h.fillStyle = 'rgb(165,165,165)'
  const [, gy0] = toPx(0, FRIEZE.groundM)
  h.fillRect(0, gy0, W, 0.016 * pxm)
  // the scenes, raised (drawn twice across the wrap so nothing is cut at the seam)
  h.fillStyle = 'rgb(235,235,235)'
  h.strokeStyle = 'rgb(235,235,235)'
  h.lineCap = 'round'
  h.lineJoin = 'round'
  for (const wrap of [-tileM, 0, tileM]) {
    scenes.forEach((id, i) => {
      const x0 = wrap + i * FRIEZE.sceneM
      scene(h, id, x0, FRIEZE.groundM + 0.016, toPx, pxm)
      rosette(h, toPx, x0, (FRIEZE.bandM) / 2 + 0.03, pxm)
    })
  }
  // soften: carved, not cut
  const [sc, s] = texCanvas(W, H)
  s.filter = `blur(${Math.max(0.8, pxm * 0.004)}px)`
  // blur across the seam: draw the tile with its neighbours either side
  s.drawImage(hc, -W, 0)
  s.drawImage(hc, 0, 0)
  s.drawImage(hc, W, 0)
  const heights = canvasHeights(sc)
  const normalMap = heightToNormal(heights, W, H, (0.012 * pxm) / 1, { wrapX: true, flipRows: true })
  normalMap.name = `frieze-normal-${W}`
  normalMap.wrapS = THREE.RepeatWrapping
  normalMap.wrapT = THREE.ClampToEdgeWrapping
  // albedo: terracotta, the raised figures a little warmer and lighter, the recesses darker
  const [ac, a] = texCanvas(W, H)
  const img = a.createImageData(W, H)
  const lo = [0x7d, 0x35, 0x24]
  const mid = [0xa3, 0x4e, 0x34]
  const hi = [0xc9, 0x78, 0x52]
  for (let i = 0; i < W * H; i++) {
    const v = heights[i]
    const t = Math.min(1, Math.max(0, (v - 0.35) / 0.6))
    const g = (k: number) => (t < 0.5 ? lo[k] + (mid[k] - lo[k]) * (t / 0.5) : mid[k] + (hi[k] - mid[k]) * ((t - 0.5) / 0.5))
    const grain = ((i * 2654435761) >>> 0) / 4294967296
    const n = 0.94 + grain * 0.1
    img.data[i * 4] = Math.min(255, g(0) * n)
    img.data[i * 4 + 1] = Math.min(255, g(1) * n)
    img.data[i * 4 + 2] = Math.min(255, g(2) * n)
    img.data[i * 4 + 3] = 255
  }
  a.putImageData(img, 0, 0)
  const map = new THREE.CanvasTexture(ac)
  map.name = `frieze-albedo-${W}`
  map.colorSpace = THREE.SRGBColorSpace
  map.wrapS = THREE.RepeatWrapping
  map.wrapT = THREE.ClampToEdgeWrapping
  map.anisotropy = 8
  map.needsUpdate = true
  const tile = { map, normalMap, tileM, bandM: FRIEZE.bandM }
  cache.set(key, tile)
  return tile
}

/** Parse the `scenes` prop (one id per line or comma separated); unknown ids are dropped. */
export function parseScenes(text: string): FriezeScene[] {
  return text
    .split(/[\n,]/)
    .map((s) => s.trim().toLowerCase())
    .filter((s): s is FriezeScene => (FRIEZE_SCENES as readonly string[]).includes(s))
}
