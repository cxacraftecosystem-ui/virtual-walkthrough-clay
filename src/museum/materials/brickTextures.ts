/**
 * NORTH WING SURFACES — generated (canvas) textures for the satellite rooms' fired-clay
 * surfaces, each cached per resolution:
 *
 *   vaultBrick(px)   the Agni Theatre's barrel vault: hand-made bricks in English bond with deep
 *                    lime joints — albedo, normal, and a JOINT MASK used as the emissive map, so
 *                    the vault "fires" (joints glow ember-orange) by raising emissiveIntensity
 *                    alone: no shader patch, no recompile
 *   roofTile(px)     half-round country tiles (khapra) in overlapping courses for the room roofs
 *                    seen from the arrival flight and the Sky Rim
 *   jaali(px, kind)  a pierced terracotta lattice as an alpha mask (white = clay, black = hole)
 *                    — 'haat' for the Haat's roof, 'screen' for the Parikrama's jali screens,
 *                    'clerestory' for the library's band
 *
 * UVs on the north-wing geometry are metres; each texture states the metres one repeat covers
 * (`*_REPEAT_M`) so a material sets `repeat = 1 / metres`.
 */
import * as THREE from 'three'

const cache = new Map<string, unknown>()
function cached<T>(key: string, make: () => T): T {
  const hit = cache.get(key)
  if (hit) return hit as T
  const v = make()
  cache.set(key, v)
  return v
}

/** Deterministic PRNG (mulberry32). */
function prng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function canvas(w: number, h: number) {
  const cv = document.createElement('canvas')
  cv.width = w
  cv.height = h
  return { cv, ctx: cv.getContext('2d', { willReadFrequently: true })! }
}

function tex(cv: HTMLCanvasElement, srgb: boolean) {
  const t = new THREE.CanvasTexture(cv)
  if (srgb) t.colorSpace = THREE.SRGBColorSpace
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.anisotropy = 8
  t.needsUpdate = true
  return t
}

/** Tangent-space normal map from a greyscale height canvas (wraps at the edges). */
function normalFromHeight(h: HTMLCanvasElement, strength: number): HTMLCanvasElement {
  const w = h.width
  const hh = h.height
  const src = h.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, w, hh).data
  const { cv, ctx } = canvas(w, hh)
  const out = ctx.createImageData(w, hh)
  const H = (x: number, y: number) => src[(((y + hh) % hh) * w + ((x + w) % w)) * 4] / 255
  for (let y = 0; y < hh; y++)
    for (let x = 0; x < w; x++) {
      const dx = (H(x + 1, y) - H(x - 1, y)) * strength
      const dy = (H(x, y + 1) - H(x, y - 1)) * strength
      const l = Math.hypot(dx, dy, 1)
      const i = (y * w + x) * 4
      out.data[i] = ((-dx / l) * 0.5 + 0.5) * 255
      out.data[i + 1] = ((dy / l) * 0.5 + 0.5) * 255
      out.data[i + 2] = ((1 / l) * 0.5 + 0.5) * 255
      out.data[i + 3] = 255
    }
  ctx.putImageData(out, 0, 0)
  return cv
}

/* ------------------------------------------------------------------ */
/* Vault brick                                                         */
/* ------------------------------------------------------------------ */

/** One repeat of the vault brick: 4 stretchers wide, 8 courses tall (metres). */
export const BRICK_REPEAT_M: [number, number] = [0.96, 0.68]
/** The vault's bricks are drawn this much larger than one repeat of BRICK_REPEAT_M. */
const VAULT_SCALE = 1.4

export interface VaultBrick {
  map: THREE.CanvasTexture
  normalMap: THREE.CanvasTexture
  /** White in the joints: the emissive map of the firing. */
  jointMap: THREE.CanvasTexture
}

/** Hand-made brick in English bond (a course of stretchers, a course of headers). */
export function vaultBrick(px = 512): VaultBrick {
  return cached(`vault-brick-${px}`, () => {
    const W = px
    const Hh = Math.round((px * BRICK_REPEAT_M[1]) / BRICK_REPEAT_M[0])
    const albedo = canvas(W, Hh)
    const height = canvas(W, Hh)
    const joints = canvas(W, Hh)
    const r = prng(7331)
    const a = albedo.ctx
    const h = height.ctx
    const j = joints.ctx
    // lime mortar
    a.fillStyle = '#b8a48c'
    a.fillRect(0, 0, W, Hh)
    h.fillStyle = '#202020'
    h.fillRect(0, 0, W, Hh)
    j.fillStyle = '#ffffff'
    j.fillRect(0, 0, W, Hh)
    const courses = 8
    const ch = Hh / courses
    const joint = Math.max(2, Math.round(px / 110))
    const tones = ['#9c4a33', '#a85338', '#8d412d', '#b25e3f', '#7f3a28', '#a0503a', '#934530']
    for (let c = 0; c < courses; c++) {
      const header = c % 2 === 1
      const n = header ? 8 : 4
      const bw = W / n
      const off = header ? bw / 2 : 0
      for (let i = -1; i < n + 1; i++) {
        const x0 = i * bw + off + joint / 2
        const y0 = c * ch + joint / 2
        const w = bw - joint
        const hgt = ch - joint
        // body colour, a fire-flash on some, a soft darker edge
        const base = tones[Math.floor(r() * tones.length)]
        a.fillStyle = base
        a.fillRect(x0, y0, w, hgt)
        if (r() < 0.35) {
          const g = a.createLinearGradient(x0, y0, x0 + w, y0 + hgt)
          g.addColorStop(0, 'rgba(40,18,10,0.35)')
          g.addColorStop(0.5 + r() * 0.3, 'rgba(40,18,10,0)')
          a.fillStyle = g
          a.fillRect(x0, y0, w, hgt)
        }
        for (let k = 0; k < 18; k++) {
          a.fillStyle = r() < 0.5 ? `rgba(240,200,160,${r() * 0.12})` : `rgba(40,16,8,${r() * 0.14})`
          a.fillRect(x0 + r() * w, y0 + r() * hgt, 1 + r() * 3, 1 + r() * 2)
        }
        // height: bricks proud of the joint, slightly pillowed
        const hg = h.createLinearGradient(x0, y0, x0, y0 + hgt)
        const top = 190 + Math.floor(r() * 40)
        hg.addColorStop(0, `rgb(${top - 40},${top - 40},${top - 40})`)
        hg.addColorStop(0.2, `rgb(${top},${top},${top})`)
        hg.addColorStop(0.8, `rgb(${top},${top},${top})`)
        hg.addColorStop(1, `rgb(${top - 50},${top - 50},${top - 50})`)
        h.fillStyle = hg
        h.fillRect(x0, y0, w, hgt)
        j.fillStyle = '#000000'
        j.fillRect(x0 - 1, y0 - 1, w + 2, hgt + 2)
      }
    }
    // the joints glow brightest deep in the bed joints: soften the mask a touch
    j.globalCompositeOperation = 'source-over'
    const n = normalFromHeight(height.cv, 2.4)
    const map = tex(albedo.cv, true)
    const normalMap = tex(n, false)
    const jointMap = tex(joints.cv, true)
    // drawn at 1.4 × the brick (a bolder bond reads across the vault instead of moiré-ing)
    for (const t of [map, normalMap, jointMap]) t.repeat.set(1 / (BRICK_REPEAT_M[0] * VAULT_SCALE), 1 / (BRICK_REPEAT_M[1] * VAULT_SCALE))
    return { map, normalMap, jointMap }
  })
}

/* ------------------------------------------------------------------ */
/* Roof tile                                                           */
/* ------------------------------------------------------------------ */

/** One repeat of the roof tiles (metres): 6 tiles across, 4 courses. */
export const TILE_REPEAT_M: [number, number] = [1.2, 1.0]

export function roofTile(px = 512): { map: THREE.CanvasTexture; normalMap: THREE.CanvasTexture } {
  return cached(`roof-tile-${px}`, () => {
    const W = px
    const Hh = Math.round((px * TILE_REPEAT_M[1]) / TILE_REPEAT_M[0])
    const albedo = canvas(W, Hh)
    const height = canvas(W, Hh)
    const r = prng(911)
    const a = albedo.ctx
    const h = height.ctx
    a.fillStyle = '#5a2a1c'
    a.fillRect(0, 0, W, Hh)
    h.fillStyle = '#000'
    h.fillRect(0, 0, W, Hh)
    const cols = 6
    const rows = 4
    const tw = W / cols
    const th = Hh / rows
    for (let row = rows; row >= -1; row--)
      for (let c = -1; c <= cols; c++) {
        const x = c * tw + (row % 2 ? tw / 2 : 0)
        const y = row * th
        const tone = 150 + Math.floor(r() * 40)
        const base = `rgb(${tone + 30},${Math.floor(tone * 0.5)},${Math.floor(tone * 0.33)})`
        // half-round tile: lighter crown, shaded flanks
        const g = a.createLinearGradient(x, 0, x + tw, 0)
        g.addColorStop(0, 'rgba(50,20,12,1)')
        g.addColorStop(0.18, base)
        g.addColorStop(0.5, `rgb(${tone + 60},${Math.floor(tone * 0.66)},${Math.floor(tone * 0.45)})`)
        g.addColorStop(0.82, base)
        g.addColorStop(1, 'rgba(50,20,12,1)')
        a.fillStyle = g
        a.beginPath()
        a.roundRect(x + 1, y - th * 0.15, tw - 2, th * 1.15, [tw * 0.1, tw * 0.1, tw * 0.45, tw * 0.45])
        a.fill()
        if (r() < 0.3) {
          a.fillStyle = `rgba(30,30,20,${0.12 + r() * 0.15})`
          a.fillRect(x + tw * 0.3, y + th * r() * 0.6, tw * 0.4, th * 0.3)
        }
        const hg = h.createLinearGradient(x, 0, x + tw, 0)
        hg.addColorStop(0, '#202020')
        hg.addColorStop(0.5, '#ffffff')
        hg.addColorStop(1, '#202020')
        h.fillStyle = hg
        h.beginPath()
        h.roundRect(x + 1, y - th * 0.15, tw - 2, th * 1.15, [tw * 0.1, tw * 0.1, tw * 0.45, tw * 0.45])
        h.fill()
      }
    const map = tex(albedo.cv, true)
    const normalMap = tex(normalFromHeight(height.cv, 3.2), false)
    for (const t of [map, normalMap]) t.repeat.set(1 / TILE_REPEAT_M[0], 1 / TILE_REPEAT_M[1])
    return { map, normalMap }
  })
}

/* ------------------------------------------------------------------ */
/* Jaali (pierced lattice)                                             */
/* ------------------------------------------------------------------ */

export type JaaliKind = 'haat' | 'screen' | 'clerestory'

/** Metres one repeat of each lattice covers (square). */
export const JAALI_REPEAT_M: Record<JaaliKind, number> = { haat: 0.6, screen: 0.42, clerestory: 0.35 }

/**
 * Alpha mask of a pierced lattice (white = clay, black = open), square, tileable:
 *   haat        eight-pointed stars in a grid of squares (light falls in star-shaped dapples)
 *   screen      interlaced circles (the classic "four petals" jali)
 *   clerestory  a fine, organic quatrefoil jali: four small lobes per cell round a clay boss,
 *               tiny piercings between (about a quarter open, so it never reads as a grater)
 */
export function jaali(px: number, kind: JaaliKind): THREE.CanvasTexture {
  return cached(`jaali-${kind}-${px}`, () => {
    const { cv, ctx } = canvas(px, px)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, px, px)
    ctx.fillStyle = '#000000'
    const S = px
    if (kind === 'haat') {
      // 2 × 2 stars per repeat
      const n = 2
      const c = S / n
      for (let i = 0; i < n; i++)
        for (let k = 0; k < n; k++) {
          const cx = c * (i + 0.5)
          const cy = c * (k + 0.5)
          ctx.beginPath()
          for (let p = 0; p < 16; p++) {
            const ang = (p / 16) * Math.PI * 2 + Math.PI / 8
            const rad = p % 2 === 0 ? c * 0.4 : c * 0.24
            const x = cx + Math.cos(ang) * rad
            const y = cy + Math.sin(ang) * rad
            if (p === 0) ctx.moveTo(x, y)
            else ctx.lineTo(x, y)
          }
          ctx.closePath()
          ctx.fill()
          // small diamonds at the cell corners
          ctx.beginPath()
          const d = c * 0.07
          const x = c * i
          const y = c * k
          ctx.moveTo(x, y - d)
          ctx.lineTo(x + d, y)
          ctx.lineTo(x, y + d)
          ctx.lineTo(x - d, y)
          ctx.closePath()
          ctx.fill()
        }
    } else if (kind === 'screen') {
      // interlaced circles: the lens-shaped petals stay clay, the four-pointed gaps are open
      const n = 2
      const c = S / n
      ctx.fillStyle = '#000000'
      for (let i = 0; i <= n; i++)
        for (let k = 0; k <= n; k++) {
          ctx.beginPath()
          ctx.arc(c * i, c * k, c * 0.44, 0, Math.PI * 2)
          ctx.fill()
        }
      ctx.fillStyle = '#ffffff'
      ctx.lineWidth = c * 0.09
      ctx.strokeStyle = '#ffffff'
      for (let i = 0; i <= n; i++)
        for (let k = 0; k <= n; k++) {
          for (const [ox, oy] of [
            [0.5, 0],
            [0, 0.5],
          ]) {
            ctx.beginPath()
            ctx.arc(c * (i + ox), c * (k + oy), c * 0.5, 0, Math.PI * 2)
            ctx.stroke()
          }
        }
      ctx.lineWidth = c * 0.07
      for (let i = 0; i <= n; i++) {
        ctx.beginPath()
        ctx.moveTo(c * i, 0)
        ctx.lineTo(c * i, S)
        ctx.moveTo(0, c * i)
        ctx.lineTo(S, c * i)
        ctx.stroke()
      }
    } else {
      // quatrefoils: four leaf-shaped lobes round a solid boss, alternate cells turned 45°, with
      // a pin-hole at every cell corner (tiles in both directions)
      const n = 4
      const c = S / n
      for (let i = 0; i < n; i++)
        for (let k = 0; k < n; k++) {
          const cx = c * (i + 0.5)
          const cy = c * (k + 0.5)
          const turn = (i + k) % 2 ? Math.PI / 4 : 0
          for (let p = 0; p < 4; p++) {
            const a = turn + (p / 4) * Math.PI * 2
            ctx.save()
            ctx.translate(cx + Math.cos(a) * c * 0.2, cy + Math.sin(a) * c * 0.2)
            ctx.rotate(a)
            ctx.beginPath()
            ctx.ellipse(0, 0, c * 0.15, c * 0.075, 0, 0, Math.PI * 2)
            ctx.fill()
            ctx.restore()
          }
          ctx.beginPath()
          ctx.arc(c * i, c * k, c * 0.045, 0, Math.PI * 2)
          ctx.fill()
        }
    }
    const t = tex(cv, false)
    t.repeat.set(1 / JAALI_REPEAT_M[kind], 1 / JAALI_REPEAT_M[kind])
    return t
  })
}
