/**
 * "Shape it yourself" installations in the clay pavilion:
 *
 *  - PottersWheel ('potters-wheel') — a potter's wheel whose head carries the visitor's
 *    current studio pot live (the same lathe and painted surface as the studio; a demo pot
 *    until the visitor shapes one), turning slowly. Selecting it opens the studio overlay
 *    (see src/museum/studio/ClayStudio.tsx). While the overlay is open the museum canvas
 *    stops rendering (frameloop 'never') — it is fully covered. `PrintStudioTable` is the
 *    same model under the hand block museum's kind name ('print-studio').
 *  - VisitorsWall ('visitors-wall', kept so content and admin work unchanged) — the Visitors'
 *    Shelf: a niche unit in limewashed clay whose niches hold the latest approved visitor pots
 *    (GET /api/prints) as framed turntable shots standing on the shelves; empty niches hold a
 *    plain card. One atlas texture, a handful of draw calls for the whole unit.
 */
import { useFrame, useThree } from '@react-three/fiber'
import { useContext, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { tr, useLang } from '../i18n'
import { useMuseum } from '../state/store'
import { SLIPS } from '../studio/clayPalette'
import { useClayStudio } from '../studio/clayStore'
import { createPot, type PotHandle } from '../studio/potMesh'
import { reducePot, type PotOp } from '../studio/potEngine'
import { approvedPrints, type WallPrint } from '../studio/printsApi'
import { VR_MODE } from '../utils/vr'
import { box, Builder, lathe, Parts, rbox, useBuilt } from './kit'
import { tinted, useModelMaterials } from './modelMaterials'
import { InMuseumScene } from './sceneContext'
import { fp, geoKey, num, str, type ModelProps } from './types'

/* ------------------------------------------------------------------ */
/* Shared helpers                                                      */
/* ------------------------------------------------------------------ */

function textCanvas(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) {
  const cv = document.createElement('canvas')
  cv.width = w
  cv.height = h
  const g = cv.getContext('2d')!
  draw(g)
  const t = new THREE.CanvasTexture(cv)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}

/** Stops the (fully covered) museum canvas while the studio overlay is open. */
function PauseWhileStudioOpen() {
  const setFrameloop = useThree((s) => s.setFrameloop)
  const open = useClayStudio((s) => s.open)
  useEffect(() => {
    if (!open) return
    const t = setTimeout(() => setFrameloop('never'), 320) // after the overlay has faded in
    return () => {
      clearTimeout(t)
      setFrameloop('always')
    }
  }, [open, setFrameloop])
  return null
}

/* ------------------------------------------------------------------ */
/* Potter's wheel                                                      */
/* ------------------------------------------------------------------ */

/** The pot on the wheel before the visitor has shaped one: a plain wet jar. */
const DEMO_OPS: PotOp[] = [{ t: 'pull' }, { t: 'widen', at: 0.42 }, { t: 'narrow', at: 0.86 }, { t: 'body', id: 'red' }]
const DEMO_POT = reducePot(DEMO_OPS)
const DEMO_SEED = 0x5eed

/** Rev/s of the wheel in the pavilion (slow: it is on show, not throwing). */
const SHOW_RPS = 0.12

/**
 * A floor-level wheel of the kind set spinning with a stick: a heavy disc on a stone pivot,
 * the clay on a raised hub at its centre, the stick on the floor beside it, slip bowls and a
 * water pot to hand. Built inside `footprint` (default 1 m square); the disc turns with the pot.
 */
export function PottersWheel({ config }: ModelProps) {
  const m = useModelMaterials()
  const inScene = useContext(InMuseumScene)
  const lang = useLang()
  const [W, D] = fp(config, [1, 1])
  const R = Math.max(0.3, Math.min(W, D) / 2 - 0.06)
  const top = num(config, 'wheelTop', 0.16)
  const hubH = 0.025
  const turn = useRef<THREE.Group>(null)

  const ops = useClayStudio((s) => s.ops)
  const pot = useClayStudio((s) => s.pot)
  const seed = useClayStudio((s) => s.seed)
  const mine = ops.length > 0
  const shown = mine ? pot : DEMO_POT
  const shownSeed = mine ? seed : DEMO_SEED

  // the pot mesh follows the studio (re-created only when the seed changes)
  const handle = useMemo<PotHandle>(() => createPot(shown, shownSeed, shown.fired, 64), [shownSeed]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    handle.update(shown, shown.fired)
  }, [handle, shown])
  useEffect(() => () => handle.dispose(), [handle])

  useFrame((_, dt) => {
    if (!inScene || !turn.current || VR_MODE || useMuseum.getState().reducedMotion) return
    turn.current.rotation.y -= Math.PI * 2 * SHOW_RPS * Math.min(dt, 0.1)
  })

  const slipMats = useMemo(() => SLIPS.map((s) => new THREE.MeshStandardMaterial({ color: s.raw, roughness: 0.3, metalness: 0 })), [])
  useEffect(() => () => slipMats.forEach((x) => x.dispose()), [slipMats])
  // the disc is wood under a skin of dried clay; the hub is wet from the last pot
  const discMat = useMemo(() => tinted(m.earthenware, '#5a3b2d', { roughness: 0.92 }), [m.earthenware])
  const hubMat = useMemo(() => tinted(m.earthenware, '#6d4030', { roughness: 0.45 }), [m.earthenware])

  const signTex = useMemo(
    () =>
      textCanvas(512, 200, (g) => {
        g.fillStyle = '#f4ece2'
        g.fillRect(0, 0, 512, 200)
        g.strokeStyle = 'rgba(45,34,29,0.25)'
        g.lineWidth = 2
        g.strokeRect(10, 10, 492, 180)
        g.fillStyle = '#2d221d'
        g.textAlign = 'center'
        g.font = "500 54px 'Cormorant Garamond', Georgia, serif"
        g.fillText(tr('studio.title'), 256, 96, 470)
        g.fillStyle = '#6d5f55'
        g.font = "500 19px Inter, system-ui, sans-serif"
        g.fillText(tr('studio.signLine'), 256, 146, 470)
      }),
    [lang], // eslint-disable-line react-hooks/exhaustive-deps
  )
  useEffect(() => () => signTex.dispose(), [signTex])

  // what turns: the disc (a heavy rim, a thinner web, the hub) — the pot sits on the hub
  const disc = useBuilt(geoKey('potters-wheel-disc', config), () => {
    const b = new Builder()
    const rim = 0.07
    b.add('disc', lathe([[0, top - 0.03], [R - rim, top - 0.03], [R - 0.01, top - 0.045], [R, top - 0.03], [R, top], [R - rim, top + 0.006], [0.14, top], [0, top]], 72))
    b.add('hub', lathe([[0, top], [0.13, top], [0.125, top + hubH], [0, top + hubH]], 48))
    // the socket the stick goes in, near the rim
    b.add('socket', lathe([[0, top + 0.0062], [0.018, top + 0.0062], [0.018, top + 0.0065], [0, top + 0.0065]], 16), { p: [R - 0.05, 0, 0] })
    return b
  })

  const parts = useBuilt(geoKey('potters-wheel', config), () => {
    const b = new Builder()
    // stone pivot under the disc
    b.add('stone', lathe([[0, 0], [0.12, 0], [0.1, top - 0.035], [0, top - 0.035]], 20))
    // the stick, on the floor beside the wheel
    const len = Math.min(0.95, Math.hypot(W, D) * 0.66)
    b.add('stick', rbox(len, 0.022, 0.022, 0.009, 2, 'x'), { p: [-0.02, 0.011, D / 2 - 0.05], r: [0, 0.08, 0] })
    // a water pot in one back corner
    b.add('pot', lathe([[0, 0], [0.07, 0], [0.11, 0.08], [0.105, 0.17], [0.07, 0.2], [0.075, 0.22], [0.065, 0.22], [0.06, 0.205], [0, 0.205]], 28), { p: [-W / 2 + 0.11, 0, -D / 2 + 0.11] })
    return b
  })

  return (
    <group>
      {inScene && <PauseWhileStudioOpen />}
      <Parts parts={parts} materials={{ stone: m.stoneDark, stick: m.teak, pot: m.terracotta }} />
      <group ref={turn}>
        <Parts parts={disc} materials={{ disc: discMat, hub: hubMat, socket: m.darkTimber }} />
        <group position={[0, top + hubH, 0]}>
          <primitive object={handle.mesh} />
        </group>
      </group>
      {/* slip bowls in the other back corner */}
      {slipMats.map((mat, i) => (
        <group key={i} position={[W / 2 - 0.08 - (i % 2) * 0.11, 0, -D / 2 + 0.08 + Math.floor(i / 2) * 0.11]}>
          <mesh material={m.terracotta} castShadow geometry={bowlGeo()} />
          <mesh material={mat} position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.044, 20]} />
          </mesh>
        </group>
      ))}
      {/* a low card at the front corner, angled up toward the visitor */}
      <group position={[W / 2 - 0.17, 0, D / 2 - 0.08]} rotation={[0, -0.35, 0]}>
        <mesh position={[0, 0.16, -0.03]} rotation={[-0.35, 0, 0]} material={m.darkTimber}>
          <boxGeometry args={[0.012, 0.32, 0.012]} />
        </mesh>
        <group position={[0, 0.3, 0]} rotation={[-0.6, 0, 0]}>
          <mesh material={m.darkTimber}>
            <boxGeometry args={[0.3, 0.125, 0.012]} />
          </mesh>
          <mesh position={[0, 0, 0.0065]}>
            <planeGeometry args={[0.285, 0.111]} />
            <meshStandardMaterial map={signTex} roughness={0.8} />
          </mesh>
        </group>
      </group>
    </group>
  )
}

/** The hand block museum's kind name for its studio table — the same studio entrance here. */
export const PrintStudioTable = PottersWheel

let bowl: THREE.BufferGeometry | null = null
function bowlGeo() {
  bowl ??= lathe(
    [
      [0, 0],
      [0.03, 0],
      [0.045, 0.012],
      [0.052, 0.03],
      [0.05, 0.036],
      [0.046, 0.034],
      [0.04, 0.028],
      [0, 0.028],
    ],
    20,
  )
  return bowl
}

/* ------------------------------------------------------------------ */
/* Visitors' Shelf                                                     */
/* ------------------------------------------------------------------ */

const CELL_PX = 384
const CELL_PY = 288
/** Frames lean back against the niche wall by this much (radians). */
const LEAN = 0.12

function emptyCell(g: CanvasRenderingContext2D, x: number, y: number) {
  g.save()
  g.translate(x, y)
  const grd = g.createLinearGradient(0, 0, 0, CELL_PY)
  grd.addColorStop(0, '#efe5d8')
  grd.addColorStop(1, '#e2d3c1')
  g.fillStyle = grd
  g.fillRect(0, 0, CELL_PX, CELL_PY)
  // a faint pot outline, so the card reads as a place waiting for one
  g.strokeStyle = 'rgba(120, 80, 60, 0.18)'
  g.lineWidth = 3
  g.beginPath()
  g.moveTo(CELL_PX / 2 - 34, CELL_PY * 0.72)
  g.bezierCurveTo(CELL_PX / 2 - 70, CELL_PY * 0.5, CELL_PX / 2 - 30, CELL_PY * 0.32, CELL_PX / 2 - 26, CELL_PY * 0.22)
  g.moveTo(CELL_PX / 2 + 34, CELL_PY * 0.72)
  g.bezierCurveTo(CELL_PX / 2 + 70, CELL_PY * 0.5, CELL_PX / 2 + 30, CELL_PY * 0.32, CELL_PX / 2 + 26, CELL_PY * 0.22)
  g.moveTo(CELL_PX / 2 - 34, CELL_PY * 0.72)
  g.lineTo(CELL_PX / 2 + 34, CELL_PY * 0.72)
  g.stroke()
  g.fillStyle = 'rgba(90, 60, 45, 0.4)'
  g.textAlign = 'center'
  g.font = "italic 24px 'Cormorant Garamond', Georgia, serif"
  g.fillText(tr('studio.shelfEmpty'), CELL_PX / 2, CELL_PY * 0.88, CELL_PX - 24)
  g.restore()
}

function nameTag(g: CanvasRenderingContext2D, x: number, y: number, name: string) {
  g.save()
  g.font = "500 15px Inter, system-ui, sans-serif"
  const label = name.length > 26 ? `${name.slice(0, 25)}…` : name
  const w = Math.min(CELL_PX - 20, g.measureText(label).width + 20)
  const tx = x + CELL_PX - w - 10
  const ty = y + CELL_PY - 34
  g.fillStyle = 'rgba(248, 242, 234, 0.94)'
  g.fillRect(tx, ty, w, 24)
  g.strokeStyle = 'rgba(45, 34, 29, 0.2)'
  g.strokeRect(tx + 0.5, ty + 0.5, w - 1, 23)
  g.fillStyle = '#3a2c25'
  g.textAlign = 'left'
  g.fillText(label, tx + 10, ty + 17, w - 20)
  g.restore()
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.decoding = 'async'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`failed to load ${url}`))
    img.src = url
  })
}

export function VisitorsWall({ config }: ModelProps) {
  const m = useModelMaterials()
  const lang = useLang()
  const cols = Math.max(1, Math.round(num(config, 'cols', 6)))
  const rows = Math.max(1, Math.round(num(config, 'rows', 3)))
  const width = num(config, 'width', 4.2)
  const bottom = num(config, 'bottom', 0.55)
  const depth = num(config, 'depth', 0.3)
  const title = str(config, 'title', '')
  const pitchX = width / cols
  const nicheH = pitchX * 0.86
  const T = 0.03 // board thickness
  const fw = (pitchX - T) * 0.7 // frame width
  const fh = fw * 0.75
  const border = 0.022
  const fd = 0.022 // frame depth
  const n = cols * rows
  const totalH = rows * nicheH + T
  const [prints, setPrints] = useState<WallPrint[]>([])

  useEffect(() => {
    let alive = true
    void approvedPrints().then((p) => alive && setPrints(p.slice(0, n)))
    return () => {
      alive = false
    }
  }, [n])

  const atlas = useMemo(() => {
    const cv = document.createElement('canvas')
    cv.width = CELL_PX * cols
    cv.height = CELL_PY * rows
    const t = new THREE.CanvasTexture(cv)
    t.colorSpace = THREE.SRGBColorSpace
    t.anisotropy = 8
    return t
  }, [cols, rows])
  useEffect(() => () => atlas.dispose(), [atlas])

  // empty cards first, then the pots as they arrive (newest top-left)
  useEffect(() => {
    let alive = true
    const cv = atlas.image as HTMLCanvasElement
    const g = cv.getContext('2d')!
    for (let i = 0; i < n; i++) emptyCell(g, (i % cols) * CELL_PX, Math.floor(i / cols) * CELL_PY)
    atlas.needsUpdate = true
    void Promise.all(
      prints.map(async (p, i) => {
        try {
          const img = await loadImage(p.url)
          if (!alive) return
          const x = (i % cols) * CELL_PX
          const y = Math.floor(i / cols) * CELL_PY
          // cover-fit the shot into its 4:3 cell
          const k = Math.max(CELL_PX / img.naturalWidth, CELL_PY / img.naturalHeight)
          const w = img.naturalWidth * k
          const h = img.naturalHeight * k
          g.save()
          g.beginPath()
          g.rect(x, y, CELL_PX, CELL_PY)
          g.clip()
          g.drawImage(img, x + (CELL_PX - w) / 2, y + (CELL_PY - h) / 2, w, h)
          g.restore()
          nameTag(g, x, y, p.displayName || tr('studio.anonymous'))
          atlas.needsUpdate = true
        } catch {
          /* keep the empty card */
        }
      }),
    )
    return () => {
      alive = false
    }
  }, [prints, atlas, cols, n, lang])

  /** Niche i: centre x, shelf top y. */
  const niche = (i: number): [number, number] => {
    const c = i % cols
    const r = Math.floor(i / cols)
    return [-width / 2 + pitchX * (c + 0.5), bottom + T + (rows - 1 - r) * nicheH]
  }
  // a leaning frame: local (x, y) on the frame face → world, the frame's foot at (cx, sy, zFoot)
  const zFoot = depth * 0.42
  const lean = (cx: number, sy: number, x: number, y: number, z: number): [number, number, number] => [cx + x, sy + y * Math.cos(LEAN) + z * Math.sin(LEAN), zFoot - y * Math.sin(LEAN) + z * Math.cos(LEAN)]

  const parts = useBuilt(geoKey('visitors-shelf', config), () => {
    const b = new Builder()
    // carcass: back, shelves, dividers, a recessed plinth
    b.add('back', box(width, totalH, 0.02), { p: [0, bottom + totalH / 2, 0.01] })
    for (let r = 0; r <= rows; r++) b.add('board', rbox(width + T, T, depth, 0.004, 1, 'x'), { p: [0, bottom + T / 2 + r * nicheH, depth / 2] })
    for (let c = 0; c <= cols; c++) b.add('board', rbox(T, totalH, depth, 0.004, 1, 'y'), { p: [-width / 2 + c * pitchX, bottom + totalH / 2, depth / 2] })
    b.add('board', box(width - 0.04, bottom, depth - 0.05), { p: [0, bottom / 2, (depth - 0.05) / 2] })
    // frames: four bars and a backing board, leaning on the niche wall
    for (let i = 0; i < n; i++) {
      const [cx, sy] = niche(i)
      const at = (x: number, y: number) => lean(cx, sy, x, y, fd / 2)
      const bars: [number, number, number, number][] = [
        [0, fh - border / 2, fw, border],
        [0, border / 2, fw, border],
        [-fw / 2 + border / 2, fh / 2, border, fh - 2 * border],
        [fw / 2 - border / 2, fh / 2, border, fh - 2 * border],
      ]
      for (const [x, y, w, h] of bars) b.add('frame', rbox(w, h, fd, 0.003), { p: at(x, y), r: [-LEAN, 0, 0] })
      b.add('frameBack', box(fw - 0.004, fh - 0.004, 0.004), { p: lean(cx, sy, 0, fh / 2, 0.002), r: [-LEAN, 0, 0] })
    }
    return b
  })

  const shotGeo = useMemo(() => {
    const pos: number[] = []
    const uv: number[] = []
    const idx: number[] = []
    const iw = fw - 2 * border - 0.012
    const ih = fh - 2 * border - 0.012
    for (let i = 0; i < n; i++) {
      const [cx, sy] = niche(i)
      const c = i % cols
      const r = Math.floor(i / cols)
      const u0 = c / cols
      const u1 = (c + 1) / cols
      const v1 = 1 - r / rows
      const v0 = 1 - (r + 1) / rows
      const k = pos.length / 3
      const z = 0.008
      const y0 = fh / 2 - ih / 2
      const y1 = fh / 2 + ih / 2
      pos.push(...lean(cx, sy, -iw / 2, y0, z), ...lean(cx, sy, iw / 2, y0, z), ...lean(cx, sy, iw / 2, y1, z), ...lean(cx, sy, -iw / 2, y1, z))
      uv.push(u0, v0, u1, v0, u1, v1, u0, v1)
      idx.push(k, k + 1, k + 2, k, k + 2, k + 3)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
    g.setIndex(idx)
    g.computeVertexNormals()
    return g
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n, cols, rows, fw, fh, width, bottom, depth])
  useEffect(() => () => shotGeo.dispose(), [shotGeo])

  const shotMat = useMemo(() => new THREE.MeshStandardMaterial({ map: atlas, roughness: 0.6, metalness: 0, envMapIntensity: 0.35 }), [atlas])
  useEffect(() => () => shotMat.dispose(), [shotMat])
  // limewashed rose clay for the carcass, a deep red-clay back for depth
  const boardMat = useMemo(() => tinted(m.terracotta, '#d6a593', { roughness: 0.95 }), [m.terracotta])
  const backMat = useMemo(() => tinted(m.terracotta, '#7c3a2c', { roughness: 0.98 }), [m.terracotta])

  const plaque = useMemo(
    () =>
      textCanvas(1024, 256, (g) => {
        g.clearRect(0, 0, 1024, 256)
        g.fillStyle = '#2d221d'
        g.textAlign = 'left'
        g.font = "500 92px 'Cormorant Garamond', Georgia, serif"
        g.fillText(title || tr('studio.shelfName'), 8, 112, 1000)
        g.fillStyle = '#3a2c25'
        g.font = "600 27px Inter, system-ui, sans-serif"
        g.fillText(tr('studio.shelfLine'), 12, 176, 1000)
      }),
    [title, lang], // eslint-disable-line react-hooks/exhaustive-deps
  )
  useEffect(() => () => plaque.dispose(), [plaque])
  const plaqueW = Math.min(2.4, width)
  const plaqueY = bottom + totalH + 0.32

  // Built from its back (z 0) forward; centred on the footprint like every model (origin at floor centre).
  return (
    <group position={[0, 0, -depth / 2]}>
      <Parts parts={parts} materials={{ back: backMat, board: boardMat, frame: m.darkTimber, frameBack: m.darkTimber }} />
      <mesh geometry={shotGeo} material={shotMat} receiveShadow />
      <mesh position={[-width / 2 + plaqueW / 2, plaqueY, 0.004]}>
        <planeGeometry args={[plaqueW, plaqueW / 4]} />
        <meshStandardMaterial map={plaque} transparent roughness={0.9} depthWrite={false} />
      </mesh>
    </group>
  )
}
