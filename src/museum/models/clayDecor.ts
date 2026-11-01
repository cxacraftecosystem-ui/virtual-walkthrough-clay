/**
 * CLAY DECOR (GRAND §4.3): the painted, slipped, incised and glazed surfaces of the survey
 * traditions' vessels, drawn once each on a canvas and wrapped round a lathe's outside
 * (u = round the pot, v = up the profile, both 0 → 1; see `decorLathe` in clay.tsx).
 *
 *   slip-flowers     white slip flowers raised on a cobalt and turquoise glaze (Khurja)
 *   silver-incision  fine lattice and flower lines shining silver on burnished black (Nizamabad)
 *   geru-dots        red-earth bands, white dots and black lines on pale clay (Khavda)
 *   blue-floral      cobalt and turquoise scrolls on a white quartz body (Jaipur blue)
 *   trailed-slip     cream and green slip trailed over a brown body (Andretta)
 *   ash-glaze        a wood-fired ash glaze running in drips over speckled stoneware (Golden Bridge)
 *
 * Forms, not makers' designs: the patterns are generic for each tradition's way of working.
 * Each texture is a few hundred kilobytes of GPU memory, built only when a piece wears it.
 */
import * as THREE from 'three'
import { rng } from './kit'

export type ClayDecor = 'none' | 'slip-flowers' | 'silver-incision' | 'geru-dots' | 'blue-floral' | 'trailed-slip' | 'ash-glaze'
export const DECORS: readonly ClayDecor[] = ['none', 'slip-flowers', 'silver-incision', 'geru-dots', 'blue-floral', 'trailed-slip', 'ash-glaze']
export const isDecor = (v: string): v is ClayDecor => (DECORS as readonly string[]).includes(v)

/** Surface of the glaze or slip a decor sits in (the material's own values). */
export const DECOR_SURFACE: Record<Exclude<ClayDecor, 'none'>, { roughness: number; env: number; metalness?: number }> = {
  'slip-flowers': { roughness: 0.22, env: 1.2 },
  'silver-incision': { roughness: 0.3, env: 1.3 },
  'geru-dots': { roughness: 0.85, env: 0.5 },
  'blue-floral': { roughness: 0.16, env: 1.3 },
  'trailed-slip': { roughness: 0.4, env: 0.9 },
  'ash-glaze': { roughness: 0.3, env: 1.1 },
}

const W = 512
const H = 256

function canvas(): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  return [c, c.getContext('2d')!]
}

/** A five-petal flower at (x, y), radius r. */
function flower(g: CanvasRenderingContext2D, x: number, y: number, r: number, petal: string, eye: string, petals = 5) {
  g.fillStyle = petal
  for (let i = 0; i < petals; i++) {
    const a = (i / petals) * Math.PI * 2
    g.beginPath()
    g.ellipse(x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55, r * 0.5, r * 0.3, a, 0, Math.PI * 2)
    g.fill()
  }
  g.fillStyle = eye
  g.beginPath()
  g.arc(x, y, r * 0.24, 0, Math.PI * 2)
  g.fill()
}

/** Repeat `draw` round the pot so the seam at u = 0 / 1 closes. */
function around(n: number, draw: (x: number, i: number) => void) {
  for (let i = 0; i < n; i++) {
    const x = ((i + 0.5) / n) * W
    draw(x, i)
    if (x < 40) draw(x + W, i)
    if (x > W - 40) draw(x - W, i)
  }
}

/** y on the canvas of a height fraction v (0 = foot, 1 = rim). */
const Y = (v: number) => H - v * H

function band(g: CanvasRenderingContext2D, v0: number, v1: number, color: string) {
  g.fillStyle = color
  g.fillRect(0, Y(v1), W, Y(v0) - Y(v1))
}

function draw(decor: Exclude<ClayDecor, 'none'>, g: CanvasRenderingContext2D) {
  const r = rng(decor)
  switch (decor) {
    case 'slip-flowers': {
      // cobalt ground, a turquoise shoulder, raised white flowers on the belly
      band(g, 0, 1, '#1f3f8c')
      band(g, 0.7, 0.86, '#2a8f9b')
      band(g, 0, 0.08, '#d9cbb0')
      for (const v of [0.69, 0.87]) band(g, v, v + 0.012, '#f4efe2')
      around(9, (x) => {
        flower(g, x, Y(0.45), 20, '#f6f1e4', '#e0b13a', 6)
        g.strokeStyle = '#f6f1e4'
        g.lineWidth = 3
        g.beginPath()
        g.moveTo(x + 22, Y(0.45))
        g.quadraticCurveTo(x + 32, Y(0.58), x + 46, Y(0.5))
        g.stroke()
        flower(g, x + 28, Y(0.78), 7, '#f6f1e4', '#1f3f8c')
      })
      break
    }
    case 'silver-incision': {
      band(g, 0, 1, '#151312')
      g.strokeStyle = '#d8d6d0'
      g.lineWidth = 1.6
      // a lattice band round the belly and flowers in its diamonds
      for (let i = -8; i <= 16; i++) {
        g.beginPath()
        g.moveTo(i * 32, Y(0.3))
        g.lineTo(i * 32 + 64, Y(0.62))
        g.moveTo(i * 32 + 64, Y(0.3))
        g.lineTo(i * 32, Y(0.62))
        g.stroke()
      }
      for (const v of [0.29, 0.31, 0.62, 0.64, 0.82]) {
        g.beginPath()
        g.moveTo(0, Y(v))
        g.lineTo(W, Y(v))
        g.stroke()
      }
      around(16, (x) => {
        g.beginPath()
        for (let k = 0; k < 4; k++) {
          const a = (k / 4) * Math.PI * 2
          g.moveTo(x, Y(0.46))
          g.quadraticCurveTo(x + Math.cos(a + 0.6) * 9, Y(0.46) + Math.sin(a + 0.6) * 9, x + Math.cos(a) * 10, Y(0.46) + Math.sin(a) * 10)
        }
        g.stroke()
        // a leaf scroll on the shoulder
        g.beginPath()
        g.ellipse(x, Y(0.73), 9, 4, 0.6, 0, Math.PI * 2)
        g.stroke()
      })
      break
    }
    case 'geru-dots': {
      band(g, 0, 1, '#dcc4a3')
      band(g, 0.55, 0.78, '#8e3b23')
      band(g, 0, 0.1, '#8e3b23')
      g.fillStyle = '#f3ecdf'
      around(36, (x) => {
        g.beginPath()
        g.arc(x, Y(0.665), 4, 0, Math.PI * 2)
        g.fill()
      })
      g.strokeStyle = '#2a201a'
      g.lineWidth = 2
      for (const v of [0.53, 0.8, 0.12]) {
        g.beginPath()
        g.moveTo(0, Y(v))
        g.lineTo(W, Y(v))
        g.stroke()
      }
      // hanging triangles below the band
      around(18, (x) => {
        g.beginPath()
        g.moveTo(x - 9, Y(0.53))
        g.lineTo(x + 9, Y(0.53))
        g.lineTo(x, Y(0.42))
        g.closePath()
        g.stroke()
      })
      break
    }
    case 'blue-floral': {
      band(g, 0, 1, '#f2f1ec')
      band(g, 0.88, 1, '#1d3c8f')
      band(g, 0, 0.06, '#1d3c8f')
      g.strokeStyle = '#1d3c8f'
      g.lineWidth = 3
      // a running scroll with flowers and leaves
      g.beginPath()
      for (let x = -20; x <= W + 20; x += 4) {
        const y = Y(0.5) + Math.sin((x / W) * Math.PI * 2 * 5) * 22
        if (x === -20) g.moveTo(x, y)
        else g.lineTo(x, y)
      }
      g.stroke()
      around(10, (x, i) => {
        const up = i % 2 === 0
        flower(g, x, Y(up ? 0.66 : 0.34), 14, '#3a9fb0', '#1d3c8f', 8)
        g.fillStyle = '#5c9a4a'
        g.beginPath()
        g.ellipse(x + 18, Y(up ? 0.58 : 0.42), 9, 4, up ? -0.7 : 0.7, 0, Math.PI * 2)
        g.fill()
      })
      break
    }
    case 'trailed-slip': {
      band(g, 0, 1, '#6e4426')
      band(g, 0.72, 1, '#8a5a2e')
      g.lineCap = 'round'
      // loops of cream slip trailed from the shoulder, with green between
      around(7, (x, i) => {
        g.strokeStyle = i % 2 ? '#d9c79c' : '#e8dcbd'
        g.lineWidth = 6
        g.beginPath()
        g.moveTo(x - 30, Y(0.72))
        g.bezierCurveTo(x - 20, Y(0.2), x + 20, Y(0.2), x + 30, Y(0.72))
        g.stroke()
        g.strokeStyle = '#5f7a3a'
        g.lineWidth = 4
        g.beginPath()
        g.moveTo(x - 12, Y(0.66))
        g.bezierCurveTo(x - 6, Y(0.38), x + 6, Y(0.38), x + 12, Y(0.66))
        g.stroke()
      })
      break
    }
    case 'ash-glaze': {
      // speckled grey-green glaze, pooled darker towards the foot, with runs down from the rim
      const grd = g.createLinearGradient(0, 0, 0, H)
      grd.addColorStop(0, '#93a07c')
      grd.addColorStop(0.6, '#7d8a66')
      grd.addColorStop(0.82, '#5a5440')
      grd.addColorStop(1, '#8a7c66')
      g.fillStyle = grd
      g.fillRect(0, 0, W, H)
      for (let i = 0; i < 46; i++) {
        const x = r() * W
        const len = 0.2 + r() * 0.45
        g.strokeStyle = `rgba(${150 + r() * 40},${170 + r() * 30},${120 + r() * 30},0.55)`
        g.lineWidth = 3 + r() * 5
        g.beginPath()
        g.moveTo(x, 0)
        g.lineTo(x + (r() - 0.5) * 6, Y(1 - len))
        g.stroke()
      }
      for (let i = 0; i < 1400; i++) {
        g.fillStyle = r() > 0.5 ? 'rgba(40,32,24,0.5)' : 'rgba(220,214,190,0.4)'
        g.fillRect(r() * W, r() * H, 1.5, 1.5)
      }
      break
    }
  }
}

const cache = new Map<string, THREE.CanvasTexture>()

/** The colour map of a decor (sRGB, wraps round the pot). */
export function decorTexture(decor: Exclude<ClayDecor, 'none'>): THREE.CanvasTexture {
  let t = cache.get(decor)
  if (!t) {
    const [c, g] = canvas()
    draw(decor, g)
    t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    t.wrapS = THREE.RepeatWrapping
    t.anisotropy = 4
    cache.set(decor, t)
  }
  return t
}

const matCache = new Map<string, THREE.MeshStandardMaterial>()

/** A decor's material, built on `base` (the shared clay material's maps). */
export function decorMaterial(base: THREE.Material, decor: Exclude<ClayDecor, 'none'>): THREE.Material {
  const key = `${base.uuid}|${decor}`
  let m = matCache.get(key)
  if (!m) {
    const s = DECOR_SURFACE[decor]
    m = (base as THREE.MeshStandardMaterial).clone()
    m.color.set('#ffffff')
    m.map = decorTexture(decor)
    m.roughness = s.roughness
    m.envMapIntensity = s.env
    m.normalScale.set(0.25, 0.25)
    matCache.set(key, m)
  }
  return m
}
