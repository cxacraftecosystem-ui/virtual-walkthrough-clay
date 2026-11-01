/**
 * The forecourt and the landscape plinth in handmade clay tiles (the exterior's own finish): square
 * terracotta pavers, 0.4 m, laid in fields of 11 × 11 framed by a band of brick-on-edge in a deeper
 * red, every tile a little different (ochre, rose, deep terracotta, the odd scorched one), set in a
 * pale lime joint. Drawn once into canvases (colour, roughness, normal) at load, tiled on the
 * plinth's metre UVs (`repeat = 1 / FIELD`): no image to download.
 */
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { mulberry32 } from '../materials/noise'

/** One field: 11 tiles of 0.4 m and a 0.4 m band of brick-on-edge (m). */
const TILE = 0.4
const TILES = 11
const FIELD = TILE * (TILES + 1)

const PALETTE = ['#bf7752', '#c7815c', '#b8704d', '#cc8a63', '#bb7957', '#c47d55', '#b5704f', '#c98762']
const BAND = '#a2573c'
const JOINT = '#d9ccb6'

function draw(px: number) {
  const s = px / FIELD
  const rnd = mulberry32(17)
  const col = document.createElement('canvas')
  const rough = document.createElement('canvas')
  const height = document.createElement('canvas')
  for (const c of [col, rough, height]) c.width = c.height = px
  const cc = col.getContext('2d')!
  const rc = rough.getContext('2d')!
  const hc = height.getContext('2d')!
  // joints first: the whole field is mortar, low and rough
  cc.fillStyle = JOINT
  cc.fillRect(0, 0, px, px)
  rc.fillStyle = '#f0f0f0'
  rc.fillRect(0, 0, px, px)
  hc.fillStyle = '#000'
  hc.fillRect(0, 0, px, px)
  const joint = Math.max(1.5, 0.012 * s)
  const tile = (x: number, y: number, w: number, h: number, color: string, r: number) => {
    const c = new THREE.Color(color)
    // per tile: lightness and warmth drift, an occasional scorched (darker) piece from the kiln
    const scorch = rnd() < 0.04 ? 0.84 : 1
    c.offsetHSL((rnd() - 0.5) * 0.015, (rnd() - 0.5) * 0.06, (rnd() - 0.5) * 0.04)
    c.multiplyScalar(scorch)
    const x0 = x + joint / 2
    const y0 = y + joint / 2
    const ww = w - joint
    const hh = h - joint
    cc.fillStyle = `#${c.getHexString()}`
    cc.fillRect(x0, y0, ww, hh)
    // a soft edge wear: the face a shade lighter at its centre
    const g = cc.createRadialGradient(x0 + ww / 2, y0 + hh / 2, 0, x0 + ww / 2, y0 + hh / 2, Math.max(ww, hh) * 0.75)
    g.addColorStop(0, 'rgba(255,236,214,0.07)')
    g.addColorStop(1, 'rgba(60,24,10,0.10)')
    cc.fillStyle = g
    cc.fillRect(x0, y0, ww, hh)
    const rv = Math.round(255 * Math.min(1, r + (rnd() - 0.5) * 0.12))
    rc.fillStyle = `rgb(${rv},${rv},${rv})`
    rc.fillRect(x0, y0, ww, hh)
    // height: tiles proud of the joint, slightly domed (handmade), a little tilt
    const hg = hc.createRadialGradient(x0 + ww * (0.4 + rnd() * 0.2), y0 + hh * (0.4 + rnd() * 0.2), 0, x0 + ww / 2, y0 + hh / 2, Math.max(ww, hh) * 0.8)
    hg.addColorStop(0, '#fff')
    hg.addColorStop(1, '#b8b8b8')
    hc.fillStyle = hg
    hc.fillRect(x0, y0, ww, hh)
  }
  // the band: brick-on-edge (0.4 × 0.1) round the field, along both of its sides (it tiles)
  const bw = TILE * s
  const bl = 0.1 * s
  for (let k = 0; k < Math.ceil(px / bl); k++) {
    tile(k * bl, 0, bl, bw, BAND, 0.85)
    tile(0, bw + k * bl, bw, bl, BAND, 0.85)
  }
  // the field of squares
  for (let i = 0; i < TILES; i++) for (let j = 0; j < TILES; j++) tile(bw + i * TILE * s, bw + j * TILE * s, TILE * s, TILE * s, PALETTE[Math.floor(rnd() * PALETTE.length)], 0.78)
  // fine speckle on the clay (grog), only on the colour
  const img = cc.getImageData(0, 0, px, px)
  const d = img.data
  for (let i = 0; i < d.length; i += 4) {
    const n = (rnd() - 0.5) * 14
    d[i] += n
    d[i + 1] += n * 0.9
    d[i + 2] += n * 0.8
  }
  cc.putImageData(img, 0, 0)
  return { col, rough, normal: heightToNormal(hc, px, 2.2) }
}

/** A tangent-space normal map from a height canvas (central differences; `px` a power of two). */
function heightToNormal(hc: CanvasRenderingContext2D, px: number, strength: number): HTMLCanvasElement {
  const h = hc.getImageData(0, 0, px, px).data
  const out = document.createElement('canvas')
  out.width = out.height = px
  const oc = out.getContext('2d')!
  const img = oc.createImageData(px, px)
  const o = img.data
  const m = px - 1
  for (let y = 0; y < px; y++) {
    const yu = ((y - 1) & m) * px
    const yd = ((y + 1) & m) * px
    const yr = y * px
    for (let x = 0; x < px; x++) {
      const dx = ((h[(yr + ((x + 1) & m)) * 4] - h[(yr + ((x - 1) & m)) * 4]) / 255) * strength
      const dy = ((h[(yd + x) * 4] - h[(yu + x) * 4]) / 255) * strength
      const l = 1 / Math.sqrt(dx * dx + dy * dy + 1)
      const i = (yr + x) * 4
      o[i] = (-dx * l * 0.5 + 0.5) * 255
      o[i + 1] = (dy * l * 0.5 + 0.5) * 255
      o[i + 2] = (l * 0.5 + 0.5) * 255
      o[i + 3] = 255
    }
  }
  oc.putImageData(img, 0, 0)
  return out
}

/** The clay-tile paving material (its own canvases; disposed with the component). */
export function useClayPaving(tier: string): THREE.MeshStandardMaterial {
  const mat = useMemo(() => {
    // 1024 px over 4.8 m: a tile is ~64 px (the canvases are drawn on the main thread at load)
    const px = tier === 'low' ? 512 : 1024
    const { col, rough, normal } = draw(px)
    const tex = (c: HTMLCanvasElement, srgb: boolean) => {
      const t = new THREE.CanvasTexture(c)
      t.wrapS = t.wrapT = THREE.RepeatWrapping
      t.repeat.set(1 / FIELD, 1 / FIELD)
      t.anisotropy = 8
      if (srgb) t.colorSpace = THREE.SRGBColorSpace
      return t
    }
    return new THREE.MeshStandardMaterial({
      name: 'clayTilePaving',
      map: tex(col, true),
      roughnessMap: tex(rough, false),
      roughness: 1,
      normalMap: tex(normal, false),
      normalScale: new THREE.Vector2(0.8, 0.8),
      metalness: 0,
      envMapIntensity: 0.5,
    })
  }, [tier])
  useEffect(
    () => () => {
      mat.map?.dispose()
      mat.roughnessMap?.dispose()
      mat.normalMap?.dispose()
      mat.dispose()
    },
    [mat],
  )
  return mat
}
