/**
 * 'relief-register' — a row of square terracotta relief panels in the manner of the Bishnupur
 * temple walls (GRAND §4.2, §4.3; CRAFTS D6): moulded and carved bricks set edge to edge, each
 * framed by a moulded border, the scenes in low relief under a weathered skin of lichen and
 * grime. Generic scenes only (no named episode):
 *
 *   epic        archers and warriors, a chariot wheel, a figure on a throne
 *   procession  horses and elephants in a line, riders, a parasol
 *   boats       a long boat with oarsmen on waves, fish below
 *   daily       figures with pots and lamps, a tree, a pair of musicians
 *
 *   props {panels = 6, scene, weather = 0.5 (0 fresh … 1 lichened)}
 *
 * The register's width is its footprint x, its height the object's height (each panel is a
 * square of that height unless the width is short); depth 0.1. A tile set of six height maps
 * per scene is drawn once on a canvas and used as the panels' bump and colour (raking light
 * picks the relief out without dense geometry). Origin at the bottom centre; the face looks +z.
 */
import { useMemo } from 'react'
import * as THREE from 'three'
import { Builder, Parts, rbox, rng, type BuiltParts } from './kit'
import { tinted, useModelMaterials } from './modelMaterials'
import { fp, num, str, type ModelProps } from './types'

export type ReliefScene = 'epic' | 'procession' | 'boats' | 'daily'
const SCENES: ReliefScene[] = ['epic', 'procession', 'boats', 'daily']
const TILES = 6
const S = 256

/* ------------------------------------------------------------------ */
/* Height maps                                                         */
/* ------------------------------------------------------------------ */

type G = CanvasRenderingContext2D

function blob(g: G, x: number, y: number, rx: number, ry: number, a = 0) {
  g.beginPath()
  g.ellipse(x, y, Math.max(0.5, rx), Math.max(0.5, ry), a, 0, Math.PI * 2)
  g.fill()
}

/** A standing figure (feet at y), height h. */
function figure(g: G, x: number, y: number, h: number, pose: number) {
  blob(g, x, y - h * 0.9, h * 0.09, h * 0.1) // head
  blob(g, x, y - h * 0.6, h * 0.12, h * 0.22) // torso
  blob(g, x - h * 0.05, y - h * 0.22, h * 0.05, h * 0.22, 0.12) // legs
  blob(g, x + h * 0.06, y - h * 0.22, h * 0.05, h * 0.22, -0.12)
  // arms, posed
  blob(g, x - h * 0.16, y - h * (0.62 + pose * 0.12), h * 0.04, h * 0.17, 0.5 + pose)
  blob(g, x + h * 0.16, y - h * (0.6 - pose * 0.08), h * 0.04, h * 0.17, -0.5 - pose * 0.6)
  blob(g, x, y - h * 1.02, h * 0.06, h * 0.03) // crown knot
}

function horse(g: G, x: number, y: number, s: number, dir = 1) {
  blob(g, x, y - s * 0.55, s * 0.42, s * 0.18) // body
  blob(g, x + dir * s * 0.38, y - s * 0.82, s * 0.09, s * 0.24, dir * -0.5) // neck
  blob(g, x + dir * s * 0.52, y - s * 0.98, s * 0.15, s * 0.07, dir * 0.3) // head
  for (const dx of [-0.3, -0.18, 0.2, 0.32]) blob(g, x + dir * s * dx, y - s * 0.2, s * 0.04, s * 0.2)
  blob(g, x - dir * s * 0.45, y - s * 0.5, s * 0.05, s * 0.15, dir * 0.6) // tail
}

function elephant(g: G, x: number, y: number, s: number, dir = 1) {
  blob(g, x, y - s * 0.55, s * 0.48, s * 0.3)
  blob(g, x + dir * s * 0.45, y - s * 0.7, s * 0.2, s * 0.2)
  blob(g, x + dir * s * 0.62, y - s * 0.38, s * 0.06, s * 0.28, dir * 0.2) // trunk
  blob(g, x + dir * s * 0.32, y - s * 0.68, s * 0.12, s * 0.18) // ear
  for (const dx of [-0.32, -0.12, 0.14, 0.32]) blob(g, x + dir * s * dx, y - s * 0.18, s * 0.08, s * 0.2)
}

function drawScene(g: G, scene: ReliefScene, tile: number) {
  const r = rng(`${scene}-${tile}`)
  const groundY = S * 0.84
  g.fillStyle = '#000'
  g.fillRect(0, 0, S, S)
  // raised frame (white = high), with a bead moulding inside it
  g.fillStyle = '#d0d0d0'
  g.fillRect(0, 0, S, S)
  g.fillStyle = '#202020'
  g.fillRect(14, 14, S - 28, S - 28)
  g.fillStyle = '#909090'
  for (let i = 0; i < 22; i++) {
    blob(g, 18 + (i * (S - 36)) / 21, 18, 3, 3)
    blob(g, 18 + (i * (S - 36)) / 21, S - 18, 3, 3)
  }
  g.fillStyle = '#5a5a5a'
  g.fillRect(22, groundY, S - 44, 6)
  g.fillStyle = '#e8e8e8'
  switch (scene) {
    case 'epic': {
      const kind = tile % 3
      if (kind === 0) {
        // two archers facing, a bow drawn
        figure(g, S * 0.33, groundY, 120, 0.8)
        figure(g, S * 0.68, groundY, 118, -0.4)
        g.strokeStyle = '#e8e8e8'
        g.lineWidth = 4
        g.beginPath()
        g.arc(S * 0.43, groundY - 82, 34, -1.2, 1.2)
        g.stroke()
      } else if (kind === 1) {
        // a chariot wheel and a horse
        horse(g, S * 0.58, groundY, 120)
        g.strokeStyle = '#e8e8e8'
        g.lineWidth = 6
        g.beginPath()
        g.arc(S * 0.28, groundY - 40, 36, 0, Math.PI * 2)
        g.stroke()
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2
          g.beginPath()
          g.moveTo(S * 0.28, groundY - 40)
          g.lineTo(S * 0.28 + Math.cos(a) * 36, groundY - 40 + Math.sin(a) * 36)
          g.stroke()
        }
        figure(g, S * 0.3, groundY - 70, 80, 0.3)
      } else {
        // a seated figure on a throne under an arch, attendants either side
        g.strokeStyle = '#bdbdbd'
        g.lineWidth = 8
        g.beginPath()
        g.arc(S * 0.5, groundY - 100, 62, Math.PI, 0)
        g.stroke()
        blob(g, S * 0.5, groundY - 30, 40, 26)
        figure(g, S * 0.5, groundY - 40, 90, 0.2)
        figure(g, S * 0.22, groundY, 80, 0.5)
        figure(g, S * 0.78, groundY, 80, -0.5)
      }
      break
    }
    case 'procession': {
      if (tile % 2 === 0) {
        horse(g, S * 0.36, groundY, 100)
        figure(g, S * 0.33, groundY - 68, 58, 0.2)
        horse(g, S * 0.72, groundY, 92)
      } else {
        elephant(g, S * 0.5, groundY, 150)
        figure(g, S * 0.48, groundY - 120, 52, 0.4)
        // a parasol over the rider
        g.beginPath()
        g.ellipse(S * 0.48, groundY - 182, 36, 12, 0, Math.PI, 0)
        g.fill()
        g.fillRect(S * 0.48 - 2, groundY - 182, 4, 30)
      }
      break
    }
    case 'boats': {
      // a long boat with a raised prow, oarsmen, waves and fish below
      g.beginPath()
      g.moveTo(S * 0.12, groundY - 92)
      g.quadraticCurveTo(S * 0.5, groundY - 40, S * 0.88, groundY - 110)
      g.lineTo(S * 0.82, groundY - 70)
      g.quadraticCurveTo(S * 0.5, groundY - 22, S * 0.18, groundY - 62)
      g.closePath()
      g.fill()
      for (let i = 0; i < 4; i++) {
        const x = S * (0.3 + i * 0.13)
        figure(g, x, groundY - 66, 54, (i % 2) * 0.6 - 0.3)
        g.save()
        g.strokeStyle = '#e8e8e8'
        g.lineWidth = 3
        g.beginPath()
        g.moveTo(x, groundY - 90)
        g.lineTo(x - 26, groundY - 18)
        g.stroke()
        g.restore()
      }
      g.strokeStyle = '#a8a8a8'
      g.lineWidth = 4
      for (let row = 0; row < 2; row++) {
        g.beginPath()
        for (let x = 22; x < S - 22; x += 4) g.lineTo(x, groundY - 14 + row * 10 + Math.sin(x * 0.12 + row) * 4)
        g.stroke()
      }
      for (let i = 0; i < 3; i++) blob(g, S * (0.3 + i * 0.2 + r() * 0.05), groundY - 4 + 0, 12, 4)
      break
    }
    case 'daily': {
      const kind = tile % 3
      if (kind === 0) {
        // a woman with a pot on her head, a tree
        figure(g, S * 0.36, groundY, 120, 0.9)
        blob(g, S * 0.36, groundY - 134, 18, 14)
        g.fillRect(S * 0.72 - 4, groundY - 110, 8, 110)
        blob(g, S * 0.72, groundY - 140, 44, 36)
      } else if (kind === 1) {
        // two musicians, a drum between
        figure(g, S * 0.28, groundY, 110, -0.4)
        figure(g, S * 0.72, groundY, 110, 0.4)
        blob(g, S * 0.5, groundY - 30, 22, 30)
      } else {
        // a lamp bearer, a cow
        figure(g, S * 0.3, groundY, 118, 0.6)
        blob(g, S * 0.3 - 22, groundY - 116, 9, 7)
        horse(g, S * 0.66, groundY, 96, -1)
      }
      break
    }
  }
}

const cache = new Map<string, { bump: THREE.CanvasTexture; color: THREE.CanvasTexture }>()

/** Height map (bump) and weathered colour of one tile. */
function tileMaps(scene: ReliefScene, tile: number, weatherK: number) {
  const key = `${scene}|${tile}|${weatherK.toFixed(2)}`
  let hit = cache.get(key)
  if (!hit) {
    const hc = document.createElement('canvas')
    hc.width = hc.height = S
    const hg = hc.getContext('2d')!
    drawScene(hg, scene, tile)
    // soften the cut edges a little: relief is modelled, not stamped
    const blurred = document.createElement('canvas')
    blurred.width = blurred.height = S
    const bg = blurred.getContext('2d')!
    bg.filter = 'blur(1.6px)'
    bg.drawImage(hc, 0, 0)
    const cc = document.createElement('canvas')
    cc.width = cc.height = S
    const cg = cc.getContext('2d')!
    // fired brick, a little darker in the hollows, lichen and grime by the weather
    cg.fillStyle = '#a5563a'
    cg.fillRect(0, 0, S, S)
    cg.globalAlpha = 0.35
    cg.globalCompositeOperation = 'multiply'
    cg.drawImage(blurred, 0, 0)
    cg.globalCompositeOperation = 'source-over'
    const r = rng(key)
    for (let i = 0; i < 260 * weatherK; i++) {
      const lich = r() > 0.45
      cg.globalAlpha = 0.18 + r() * 0.3 * weatherK
      cg.fillStyle = lich ? (r() > 0.5 ? '#8c9474' : '#a7a58b') : '#3e2c24'
      const x = r() * S
      const y = lich ? r() * S : S * (0.5 + r() * 0.5)
      blob(cg, x, y, 2 + r() * 9, 2 + r() * (lich ? 9 : 22))
    }
    cg.globalAlpha = 1
    const bump = new THREE.CanvasTexture(blurred)
    bump.colorSpace = THREE.NoColorSpace
    const color = new THREE.CanvasTexture(cc)
    color.colorSpace = THREE.SRGBColorSpace
    for (const t of [bump, color]) t.anisotropy = 4
    hit = { bump, color }
    cache.set(key, hit)
  }
  return hit
}

const matCache = new Map<string, THREE.MeshStandardMaterial>()

function tileMaterial(base: THREE.Material, scene: ReliefScene, tile: number, weatherK: number) {
  const key = `${base.uuid}|${scene}|${tile}|${weatherK.toFixed(2)}`
  let m = matCache.get(key)
  if (!m) {
    const { bump, color } = tileMaps(scene, tile, weatherK)
    m = (base as THREE.MeshStandardMaterial).clone()
    m.color.set('#ffffff')
    m.map = color
    m.bumpMap = bump
    m.bumpScale = 6
    m.normalMap = null
    m.roughness = 0.95
    matCache.set(key, m)
  }
  return m
}

/* ------------------------------------------------------------------ */
/* Model                                                               */
/* ------------------------------------------------------------------ */

const builtCache = new Map<string, BuiltParts>()

export function ReliefRegister({ config }: ModelProps) {
  const m = useModelMaterials()
  const n = Math.max(1, Math.min(24, Math.round(num(config, 'panels', 6))))
  const sceneS = str(config, 'scene', 'epic')
  const scene: ReliefScene = (SCENES as string[]).includes(sceneS) ? (sceneS as ReliefScene) : 'epic'
  const weatherK = Math.max(0, Math.min(1, num(config, 'weather', 0.5)))
  const H = config.height ?? 0.9
  const [W] = fp(config, [H * n, 0.1])
  const parts = useMemo(() => {
    const key = `${n}|${W.toFixed(3)}|${H.toFixed(3)}`
    let hit = builtCache.get(key)
    if (!hit) {
      const b = new Builder()
      const gap = 0.012
      const pw = W / n - gap
      const ph = Math.min(H, pw * 1.25)
      const D = 0.1
      for (let i = 0; i < n; i++) {
        const x = -W / 2 + (i + 0.5) * (W / n)
        // the panel's face: its own UV square (one tile each)
        const face = new THREE.PlaneGeometry(pw, ph)
        b.add(`t${i % TILES}`, face, { p: [x, (H - ph) / 2 + ph / 2, D + 0.0005] })
        b.add('brick', rbox(pw, ph, D, 0.008), { p: [x, (H - ph) / 2 + ph / 2, D / 2] })
      }
      // a moulded string course above and below the row
      b.add('brick', rbox(W + 0.06, 0.06, D + 0.04, 0.01), { p: [0, 0.03, D / 2] })
      b.add('brick', rbox(W + 0.06, 0.06, D + 0.04, 0.01), { p: [0, H - 0.03, D / 2] })
      hit = b.build()
      builtCache.set(key, hit)
    }
    return hit
  }, [n, W, H])
  const mats = useMemo(() => {
    // the brick body: the same fired red without a scene on it
    const out: Record<string, THREE.Material> = { brick: tinted(m.terracotta, '#9e5236', { roughness: 0.95 }) }
    for (let i = 0; i < TILES; i++) out[`t${i}`] = tileMaterial(m.terracotta, scene, i + 1, weatherK)
    return out
  }, [m, scene, weatherK])
  return <Parts parts={parts} materials={mats} />
}
