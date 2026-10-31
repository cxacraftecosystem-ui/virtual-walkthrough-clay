/**
 * Three.js side of the "Shape it yourself" studio: the pot as a LatheGeometry with a painted
 * surface. Used by the studio's wheel view, the PNG turntable shot and the potter's wheel in
 * the pavilion, so all three show exactly the same pot.
 *
 *   buildPotGeometry(state, seed)   — lathe of potSection(), metres, with hand-made unevenness
 *   paintSurface(state, fired, seed) — colour + bump canvases (clay, flecks, slip, bands, glaze)
 *   createPot(state, seed, fired)   — mesh + material, `.update()` to follow a new state
 *
 * UV layout of the painted canvas: u runs once round the pot; v ∈ [V_OUT, 1] is the outside
 * (underside, outer wall, rim) by height, v ∈ [0, V_IN] the inside wall and floor.
 */
import * as THREE from 'three'
import { getBody, getGlaze, getPotMotif, getSlip, mixHex, RAW_GLAZE, shadeHex, type PotMotifId } from './clayPalette'
import { bandRepeats, bandY, mulberry, potSection, type PotSection, type PotState } from './potEngine'

/** cm → metres. */
export const CM = 0.01
const V_OUT = 0.12
const V_IN = 0.1
const TEX_W = 1024
const TEX_H = 512

const clamp01 = (v: number) => Math.max(0, Math.min(1, v))

/* ------------------------------------------------------------------ */
/* Geometry                                                            */
/* ------------------------------------------------------------------ */

function vOf(sec: PotSection, j: number) {
  const y = clamp01(sec.pts[j][1] / sec.height)
  const part = sec.part[j]
  if (part === 'inner') return V_IN * y
  if (part === 'under') return V_OUT
  return V_OUT + (1 - V_OUT) * y
}

/** The pot as a lathe (metres, base on y = 0), with a thrown-by-hand unevenness from `seed`. */
export function buildPotGeometry(state: PotState, seed: number, segments = 96): THREE.LatheGeometry {
  const sec = potSection(state)
  const n = sec.pts.length
  const g = new THREE.LatheGeometry(
    sec.pts.map(([r, y]) => new THREE.Vector2(r * CM, y * CM)),
    segments,
  )
  const uv = g.getAttribute('uv') as THREE.BufferAttribute
  const pos = g.getAttribute('position') as THREE.BufferAttribute
  const vs = sec.pts.map((_, j) => vOf(sec, j))
  const rnd = mulberry(seed ^ 0x51ab)
  const ph = [rnd(), rnd(), rnd(), rnd()].map((v) => v * Math.PI * 2)
  for (let k = 0; k < pos.count; k++) {
    const i = Math.floor(k / n)
    const j = k % n
    uv.setY(k, vs[j])
    // the walls are never perfectly round: a slight oval, a trefoil and a ripple that grow towards the rim
    const phi = (i / segments) * Math.PI * 2
    const h = clamp01(sec.pts[j][1] / sec.height)
    const f = 1 + 0.007 * Math.sin(2 * phi + ph[0]) * h + 0.004 * Math.sin(3 * phi + ph[1]) * (0.3 + h) + 0.0025 * Math.sin(5 * phi + ph[2] + h * 5)
    pos.setX(k, pos.getX(k) * f)
    pos.setZ(k, pos.getZ(k) * f)
    if (sec.part[j] === 'rim') pos.setY(k, pos.getY(k) + 0.0007 * Math.sin(2 * phi + ph[3]))
  }
  uv.needsUpdate = true
  pos.needsUpdate = true
  g.computeBoundingBox()
  g.computeBoundingSphere()
  return g
}

/* ------------------------------------------------------------------ */
/* Motifs                                                              */
/* ------------------------------------------------------------------ */

type Ctx = CanvasRenderingContext2D

/**
 * One repeat of a motif in the box centred on (cx, cy), w × h px. `fill` is false for
 * sgraffito (scratched lines) and true for a stamp (impressed solid shapes).
 */
export function drawPotMotif(g: Ctx, motif: PotMotifId, cx: number, cy: number, w: number, h: number, fill: boolean) {
  const P = (x: number, y: number): [number, number] => [cx + x * w, cy + y * h]
  const poly = (pts: [number, number][], close = false) => {
    g.beginPath()
    pts.forEach(([x, y], i) => {
      const [px, py] = P(x, y)
      if (i) g.lineTo(px, py)
      else g.moveTo(px, py)
    })
    if (close) g.closePath()
  }
  const ellipse = (x: number, y: number, rx: number, ry: number) => {
    const [px, py] = P(x, y)
    g.beginPath()
    g.ellipse(px, py, Math.abs(rx * w), Math.abs(ry * h), 0, 0, Math.PI * 2)
  }
  switch (motif) {
    case 'zigzag':
      if (fill) {
        poly([[-0.42, 0.32], [-0.21, -0.32], [0, 0.32]], true)
        g.fill()
        poly([[0.08, -0.32], [0.29, 0.32], [0.5, -0.32]], true)
        g.globalAlpha *= 0.55
        g.fill()
        g.globalAlpha /= 0.55
      } else {
        poly([[-0.5, 0.3], [-0.25, -0.3], [0, 0.3], [0.25, -0.3], [0.5, 0.3]])
        g.stroke()
      }
      break
    case 'waves': {
      const pts: [number, number][] = []
      for (let i = 0; i <= 16; i++) {
        const x = -0.5 + i / 16
        pts.push([x, Math.sin((x + 0.5) * Math.PI * 2) * 0.28])
      }
      if (fill) {
        for (let i = 16; i >= 0; i--) pts.push([pts[i][0], pts[i][1] + 0.18])
        poly(pts, true)
        g.fill()
      } else {
        poly(pts)
        g.stroke()
      }
      break
    }
    case 'dots':
      if (fill) {
        ellipse(0, 0, 0.26, 0.3)
        g.fill()
      } else {
        ellipse(0, 0, 0.22, 0.26)
        g.stroke()
        ellipse(0, 0, 0.05, 0.06)
        g.fill()
      }
      break
    case 'chevron':
      for (const o of fill ? [0] : [-0.16, 0.16]) {
        if (fill) {
          poly([[-0.4, -0.3], [0, 0.18], [0.4, -0.3], [0.4, -0.04], [0, 0.42], [-0.4, -0.04]], true)
          g.fill()
        } else {
          poly([[-0.4, -0.22 + o], [0, 0.18 + o], [0.4, -0.22 + o]])
          g.stroke()
        }
      }
      break
    case 'leaf': {
      g.beginPath()
      const [ax, ay] = P(-0.42, 0)
      const [bx, by] = P(0.42, 0)
      const [c1x, c1y] = P(0, -0.42)
      const [c2x, c2y] = P(0, 0.42)
      g.moveTo(ax, ay)
      g.quadraticCurveTo(c1x, c1y, bx, by)
      g.quadraticCurveTo(c2x, c2y, ax, ay)
      if (fill) g.fill()
      else {
        g.stroke()
        poly([[-0.36, 0], [0.36, 0]])
        g.stroke()
      }
      break
    }
    case 'rings':
      ellipse(0, 0, 0.34, 0.38)
      g.stroke()
      ellipse(0, 0, 0.18, 0.2)
      if (fill) g.fill()
      else g.stroke()
      break
  }
}

/* ------------------------------------------------------------------ */
/* Surface                                                             */
/* ------------------------------------------------------------------ */

const makeCanvas = (w: number, h: number) => {
  const cv = document.createElement('canvas')
  cv.width = w
  cv.height = h
  return cv
}

export interface Surface {
  map: HTMLCanvasElement
  bump: HTMLCanvasElement
}

/** Canvas row of a point `y` cm up the outside. */
const rowOut = (sec: PotSection, y: number) => (1 - (V_OUT + (1 - V_OUT) * clamp01(y / sec.height))) * TEX_H
const ROW_IN_TOP = (1 - V_IN) * TEX_H

/** Paints the pot's surface: clay, flecks, slip, burnish, motif bands and glaze, raw or fired. */
export function paintSurface(state: PotState, fired: boolean, seed: number, into?: Surface): Surface {
  const map = into?.map ?? makeCanvas(TEX_W, TEX_H)
  const bump = into?.bump ?? makeCanvas(TEX_W, TEX_H)
  const g = map.getContext('2d')!
  const b = bump.getContext('2d')!
  const sec = potSection(state)
  const rnd = mulberry(seed ^ 0x2f17)
  const body = getBody(state.body)
  const slip = getSlip(state.slip)
  const glaze = getGlaze(state.glaze)
  const bodyCol = fired ? body.fired : body.raw
  const slipCol = slip ? (fired ? slip.fired : slip.raw) : null
  const outerTop = 0
  const footRow = rowOut(sec, sec.bodyBase + 0.3)

  g.globalAlpha = 1
  g.globalCompositeOperation = 'source-over'
  g.fillStyle = bodyCol
  g.fillRect(0, 0, TEX_W, TEX_H)
  b.fillStyle = '#808080'
  b.fillRect(0, 0, TEX_W, TEX_H)

  // throwing rings — faint horizontal ridges left by the fingers
  for (let y = outerTop; y < ROW_IN_TOP; y += 3 + rnd() * 5) {
    const light = rnd() > 0.5
    g.fillStyle = light ? 'rgba(255,240,220,0.05)' : 'rgba(40,20,10,0.06)'
    g.fillRect(0, y, TEX_W, 1 + rnd() * 2)
    b.fillStyle = light ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'
    b.fillRect(0, y, TEX_W, 2)
  }

  // slip: the outside above the foot, a little uneven at its lower edge
  if (slipCol) {
    g.fillStyle = slipCol
    g.beginPath()
    g.moveTo(0, 0)
    g.lineTo(TEX_W, 0)
    for (let x = TEX_W; x >= 0; x -= 32) g.lineTo(x, footRow - 4 - rnd() * 8)
    g.closePath()
    g.fill()
  }

  // flecks (grog, iron specks) — fewer show through a slip
  const flecks = Math.round(body.flecks * 2600 * (slipCol ? 0.25 : 1))
  g.fillStyle = body.fleck
  for (let i = 0; i < flecks; i++) {
    g.globalAlpha = 0.25 + rnd() * 0.45
    const r = 0.5 + rnd() * rnd() * 2.2
    g.beginPath()
    g.ellipse(rnd() * TEX_W, rnd() * TEX_H, r * 1.4, r, 0, 0, Math.PI * 2)
    g.fill()
  }
  g.globalAlpha = 1

  // burnish: polished streaks
  if (state.burnish) {
    for (let i = 0; i < 260; i++) {
      g.fillStyle = `rgba(255,248,236,${0.03 + rnd() * 0.05})`
      g.fillRect(rnd() * TEX_W, rnd() * ROW_IN_TOP, 18 + rnd() * 40, 1 + rnd() * 2)
    }
  }

  // motif bands
  for (const band of state.bands) {
    const m = getPotMotif(band.motif)
    const yc = bandY(state, band) + sec.bodyBase
    const r0 = rowOut(sec, yc + m.band / 2)
    const r1 = rowOut(sec, yc - m.band / 2)
    const n = bandRepeats(state, band)
    const pitch = TEX_W / n
    const hpx = r1 - r0
    const cy = (r0 + r1) / 2
    const stamp = band.tech === 'stamp'
    // scratching through a slip shows the clay beneath; with no slip it reads as a darker incision
    const surface = slipCol ?? bodyCol
    const line = stamp ? shadeHex(surface, 0.62) : slipCol ? bodyCol : shadeHex(bodyCol, 0.55)
    g.strokeStyle = g.fillStyle = line
    g.lineWidth = stamp ? 2.2 : 1.8
    g.lineCap = g.lineJoin = 'round'
    b.strokeStyle = b.fillStyle = 'rgba(0,0,0,0.9)'
    b.lineWidth = stamp ? 3 : 2
    b.lineCap = b.lineJoin = 'round'
    if (!stamp) {
      // scratched rules above and below
      for (const yy of [r0, r1]) {
        g.fillRect(0, yy - 0.8, TEX_W, 1.6)
        b.fillRect(0, yy - 1, TEX_W, 2)
      }
    }
    for (let i = 0; i < n; i++) {
      const jx = (rnd() - 0.5) * pitch * 0.04
      const jy = (rnd() - 0.5) * hpx * 0.05
      const cx = (i + 0.5) * pitch + jx
      g.globalAlpha = stamp ? 0.7 + rnd() * 0.25 : 0.95
      drawPotMotif(g, band.motif, cx, cy + jy, pitch * 0.9, hpx * 0.86, stamp)
      drawPotMotif(b, band.motif, cx, cy + jy, pitch * 0.9, hpx * 0.86, stamp)
      if (stamp) {
        // the lip of the impression catches the light
        g.globalAlpha = 0.18
        g.strokeStyle = 'rgba(255,240,225,1)'
        g.lineWidth = 1
        drawPotMotif(g, band.motif, cx + 1, cy + jy + 1, pitch * 0.9, hpx * 0.86, false)
        g.strokeStyle = line
        g.lineWidth = 2.2
      }
    }
    g.globalAlpha = 1
  }

  // glaze: inside and out, stopping short of the foot with a slightly wavering edge
  if (glaze) {
    const dripRow = rowOut(sec, sec.bodyBase + 1.3)
    const glazePath = (ctx: Ctx) => {
      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.lineTo(TEX_W, 0)
      for (let x = TEX_W; x >= 0; x -= 16) ctx.lineTo(x, dripRow - 3 + Math.sin(x * 0.03 + seed) * 2.5 + (rnd() - 0.5) * 3)
      ctx.closePath()
    }
    if (fired) {
      g.save()
      glazePath(g)
      g.clip()
      g.globalAlpha = glaze.cover
      g.fillStyle = glaze.tint
      g.fillRect(0, 0, TEX_W, TEX_H)
      // the glaze pools darker where it gathers
      g.globalAlpha = 0.18
      g.fillStyle = shadeHex(glaze.tint, 0.6)
      g.fillRect(0, dripRow - 10, TEX_W, 10)
      g.restore()
      g.globalAlpha = glaze.cover
      g.fillStyle = glaze.tint
      g.fillRect(0, ROW_IN_TOP, TEX_W, TEX_H - ROW_IN_TOP)
      // a thicker run along every incision or impression
      g.globalAlpha = Math.min(0.5, glaze.cover * 0.6)
      g.fillStyle = shadeHex(glaze.tint, 0.55)
      g.globalCompositeOperation = 'multiply'
      g.drawImage(bumpMask(bump), 0, 0)
      g.globalCompositeOperation = 'source-over'
      g.globalAlpha = 1
    } else {
      const raw = mixHex(RAW_GLAZE, glaze.tint, 0.12)
      g.save()
      glazePath(g)
      g.clip()
      g.globalAlpha = 0.82
      g.fillStyle = raw
      g.fillRect(0, 0, TEX_W, TEX_H)
      g.restore()
      g.globalAlpha = 0.82
      g.fillStyle = raw
      g.fillRect(0, ROW_IN_TOP, TEX_W, TEX_H - ROW_IN_TOP)
      g.globalAlpha = 1
      // powdery speckle
      for (let i = 0; i < 1400; i++) {
        g.fillStyle = `rgba(255,255,255,${0.1 + rnd() * 0.2})`
        g.fillRect(rnd() * TEX_W, rnd() * TEX_H, 1.5, 1.5)
      }
    }
  }
  return { map, bump }
}

/** The incised / impressed marks of a bump canvas as a dark-on-transparent mask. */
let maskCv: HTMLCanvasElement | null = null
function bumpMask(bump: HTMLCanvasElement) {
  maskCv ??= makeCanvas(TEX_W, TEX_H)
  const m = maskCv.getContext('2d')!
  m.clearRect(0, 0, TEX_W, TEX_H)
  const src = bump.getContext('2d')!.getImageData(0, 0, TEX_W, TEX_H)
  const out = m.createImageData(TEX_W, TEX_H)
  for (let i = 0; i < src.data.length; i += 4) {
    const d = src.data[i] < 70 ? 1 : 0
    out.data[i] = out.data[i + 1] = out.data[i + 2] = 40
    out.data[i + 3] = d * 255
  }
  m.putImageData(out, 0, 0)
  return maskCv
}

/* ------------------------------------------------------------------ */
/* Material                                                            */
/* ------------------------------------------------------------------ */

export interface Finish {
  roughness: number
  clearcoat: number
  clearcoatRoughness: number
  sheen: number
  bumpScale: number
}

/** How the surface takes the light: leather-hard clay, burnished, raw glaze, fired glaze. */
export function finishFor(state: PotState, fired: boolean): Finish {
  const relief = state.bands.length ? 1.6 : 0.8
  if (state.glaze) {
    return fired
      ? { roughness: 0.16, clearcoat: 0.7, clearcoatRoughness: 0.08, sheen: 0, bumpScale: relief * 0.5 }
      : { roughness: 0.96, clearcoat: 0, clearcoatRoughness: 1, sheen: 0, bumpScale: relief * 0.6 }
  }
  if (state.burnish) return { roughness: fired ? 0.34 : 0.42, clearcoat: fired ? 0.25 : 0.1, clearcoatRoughness: 0.4, sheen: 0.4, bumpScale: relief * 0.8 }
  return { roughness: fired ? 0.86 : 0.7, clearcoat: 0, clearcoatRoughness: 1, sheen: 0, bumpScale: relief }
}

export interface PotHandle {
  mesh: THREE.Mesh
  material: THREE.MeshPhysicalMaterial
  /** Rebuild after a change; returns the section the geometry was built from. */
  update: (state: PotState, fired: boolean) => PotSection
  dispose: () => void
}

/** A pot mesh that follows state changes (re-meshes on shape, repaints on finish). */
export function createPot(state: PotState, seed: number, fired: boolean, segments = 96): PotHandle {
  const surf: Surface = { map: makeCanvas(TEX_W, TEX_H), bump: makeCanvas(TEX_W, TEX_H) }
  const map = new THREE.CanvasTexture(surf.map)
  map.colorSpace = THREE.SRGBColorSpace
  map.wrapS = THREE.RepeatWrapping
  map.anisotropy = 8
  const bump = new THREE.CanvasTexture(surf.bump)
  bump.wrapS = THREE.RepeatWrapping
  const material = new THREE.MeshPhysicalMaterial({ map, bumpMap: bump, roughness: 0.7, metalness: 0, side: THREE.FrontSide, envMapIntensity: 0.9 })
  const mesh = new THREE.Mesh<THREE.BufferGeometry, THREE.MeshPhysicalMaterial>(new THREE.BufferGeometry(), material)
  mesh.castShadow = true
  mesh.receiveShadow = true
  let shapeKey = ''
  let paintKey = ''
  let sec: PotSection = potSection(state)

  const update = (s: PotState, f: boolean) => {
    const sk = JSON.stringify([s.points, s.foot, s.trims])
    if (sk !== shapeKey) {
      shapeKey = sk
      mesh.geometry.dispose()
      mesh.geometry = buildPotGeometry(s, seed, segments)
      sec = potSection(s)
      paintKey = '' // bands follow the wall
    }
    const pk = JSON.stringify([s.body, s.slip, s.glaze, s.burnish, s.bands, f])
    if (pk !== paintKey) {
      paintKey = pk
      paintSurface(s, f, seed, surf)
      map.needsUpdate = true
      bump.needsUpdate = true
      const fin = finishFor(s, f)
      material.roughness = fin.roughness
      material.clearcoat = fin.clearcoat
      material.clearcoatRoughness = fin.clearcoatRoughness
      material.sheen = fin.sheen
      material.sheenColor.set('#fff1dc')
      material.sheenRoughness = 0.5
      material.bumpScale = fin.bumpScale
    }
    return sec
  }
  update(state, fired)
  return {
    mesh,
    material,
    update,
    dispose: () => {
      mesh.geometry.dispose()
      material.dispose()
      map.dispose()
      bump.dispose()
    },
  }
}
