/**
 * 'lippan-wall' — lippan kaam, the mud-and-mirror relief of Kutch (GRAND §4.2, §4.3; CRAFTS D11),
 * along the outer face of F, the inner main wall: a 25 m band of raised clay coils, limewashed
 * white on a pale lime-clay ground, with round mirrors pressed into the coils' knots. The
 * mirrors reflect the room and catch the accent lights as the visitor walks the corridor.
 *
 *   props {pattern = lattice | peacock | flower, mirrors = 0.5 (share of the knots that carry
 *          one), surfaces = 'f-outer-1,…,f-outer-5' (the F facets it covers)}
 *
 * The object stands at the origin; the band is built on F's arc from the layout constants
 * (MUSEUM.innerMainWall). The coils are a raking-lit relief map on a bent ground panel, with a
 * real rolled coil along the top and the bottom; the mirrors are one instanced mesh.
 */
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { DEG, MUSEUM, polar } from '../config/museum'
import { injectAtmosphere } from '../lighting/atmosphere/inject'
import { mergeAll } from '../architecture/shellGeometry'
import { useMuseum } from '../state/store'
import { bendToCylinder, wallGrid } from './bend'
import { rng } from './kit'
import { tinted, useModelMaterials } from './modelMaterials'
import { num, str, type ModelProps } from './types'

type Pattern = 'lattice' | 'peacock' | 'flower'

const F = MUSEUM.innerMainWall
/** The band: from just above the floor to above eye level, on F's corridor face. */
const Y0 = 0.45
const Y1 = 3.85
/** One pattern tile (m), square. */
const TILE = 1.15
/** Stand-off of the ground panel from F's face. */
const OFF = 0.012
const R = F.r + F.thickness / 2 + OFF

const PX = 512

/** Tile-space (0 … 1) centres of the knots that carry a mirror. */
function knots(pattern: Pattern): [number, number, number][] {
  const out: [number, number, number][] = []
  if (pattern === 'lattice') {
    for (let i = 0; i <= 4; i++) for (let j = 0; j <= 4; j++) if ((i + j) % 2 === 0) out.push([i / 4, j / 4, i % 4 === 0 || j % 4 === 0 ? 0.022 : 0.032])
  } else if (pattern === 'peacock') {
    out.push([0.5, 0.42, 0.04], [0.5, 0.78, 0.022])
    for (let i = 0; i < 7; i++) {
      const a = Math.PI * (0.15 + (0.7 * i) / 6)
      out.push([0.5 + Math.cos(a) * 0.3, 0.42 + Math.sin(a) * 0.3, 0.02])
    }
    for (const x of [0.06, 0.94]) for (let j = 0; j < 4; j++) out.push([x, 0.12 + j * 0.25, 0.018])
  } else {
    out.push([0.5, 0.5, 0.042])
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2
      out.push([0.5 + Math.cos(a) * 0.22, 0.5 + Math.sin(a) * 0.22, 0.02])
    }
    for (const [x, y] of [
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
    ])
      out.push([x, y, 0.03])
  }
  return out
}

/** The coil drawing of one tile, white on black (the relief's height). */
function drawTile(g: CanvasRenderingContext2D, pattern: Pattern) {
  const S = PX
  g.fillStyle = '#000'
  g.fillRect(0, 0, S, S)
  g.strokeStyle = '#fff'
  g.fillStyle = '#fff'
  g.lineCap = 'round'
  g.lineJoin = 'round'
  // thick rolled coils (≈ 4 cm on the wall), so the relief reads as clay rope, never wire mesh
  const line = (pts: [number, number][], w = 20) => {
    g.lineWidth = w
    g.beginPath()
    pts.forEach(([x, y], i) => (i ? g.lineTo(x * S, (1 - y) * S) : g.moveTo(x * S, (1 - y) * S)))
    g.stroke()
  }
  const ring = (x: number, y: number, r: number, w = 17) => {
    g.lineWidth = w
    g.beginPath()
    g.arc(x * S, (1 - y) * S, r * S, 0, Math.PI * 2)
    g.stroke()
  }
  if (pattern === 'lattice') {
    // a diamond lattice with doubled coils, small triangles in its cells
    for (let i = -4; i <= 4; i++) {
      line([
        [i / 4, 0],
        [i / 4 + 1, 1],
      ])
      line([
        [i / 4 + 1, 0],
        [i / 4, 1],
      ])
      line(
        [
          [i / 4 + 0.03, 0],
          [i / 4 + 1.03, 1],
        ],
        4,
      )
    }
    for (let i = 0; i < 4; i++)
      for (let j = 0; j < 4; j++)
        if ((i + j) % 2 === 1) {
          const cx = (i + 0.5) / 4
          const cy = (j + 0.5) / 4
          line(
            [
              [cx - 0.05, cy - 0.04],
              [cx + 0.05, cy - 0.04],
              [cx, cy + 0.05],
              [cx - 0.05, cy - 0.04],
            ],
            6,
          )
        }
  } else if (pattern === 'peacock') {
    // a peacock under an arch: body, crest, a fan of tail eyes; dotted borders either side
    line(
      [
        [0.14, 0.02],
        [0.14, 0.62],
      ],
      9,
    )
    line(
      [
        [0.86, 0.02],
        [0.86, 0.62],
      ],
      9,
    )
    g.lineWidth = 9
    g.beginPath()
    g.arc(0.5 * S, 0.38 * S, 0.36 * S, Math.PI, 0)
    g.stroke()
    ring(0.5, 0.42, 0.075)
    for (let i = 0; i < 7; i++) {
      const a = Math.PI * (0.15 + (0.7 * i) / 6)
      line([
        [0.5, 0.42],
        [0.5 + Math.cos(a) * 0.27, 0.42 + Math.sin(a) * 0.27],
      ])
      ring(0.5 + Math.cos(a) * 0.3, 0.42 + Math.sin(a) * 0.3, 0.035, 6)
    }
    line(
      [
        [0.5, 0.36],
        [0.47, 0.2],
        [0.53, 0.12],
        [0.5, 0.05],
      ],
      12,
    )
    line(
      [
        [0.5, 0.48],
        [0.5, 0.74],
      ],
      6,
    )
  } else {
    // rosettes: a ring of petals round a knot, quarter rosettes at the corners
    ring(0.5, 0.5, 0.1)
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2
      g.lineWidth = 7
      g.beginPath()
      g.ellipse((0.5 + Math.cos(a) * 0.22) * S, (1 - (0.5 + Math.sin(a) * 0.22)) * S, 0.07 * S, 0.035 * S, -a, 0, Math.PI * 2)
      g.stroke()
    }
    for (const [x, y] of [
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
    ])
      ring(x, y, 0.16)
  }
  // a border coil at the tile's top and bottom joins the tiles into one band
  line(
    [
      [0, 0.005],
      [1, 0.005],
    ],
    6,
  )
}

const maps = new Map<Pattern, { bump: THREE.CanvasTexture; color: THREE.CanvasTexture }>()

function patternMaps(pattern: Pattern) {
  let hit = maps.get(pattern)
  if (!hit) {
    const h = document.createElement('canvas')
    h.width = h.height = PX
    drawTile(h.getContext('2d')!, pattern)
    const soft = document.createElement('canvas')
    soft.width = soft.height = PX
    const sg = soft.getContext('2d')!
    // a rounded profile: the coil's height falls off over a few millimetres either side
    sg.filter = 'blur(5px)'
    sg.drawImage(h, 0, 0)
    // colour: a pale lime-clay ground, the coils limewashed whiter, a soft shadow where each coil
    // meets the ground (so the relief reads even in flat light)
    const c = document.createElement('canvas')
    c.width = c.height = PX
    const cg = c.getContext('2d')!
    cg.fillStyle = '#cbb596'
    cg.fillRect(0, 0, PX, PX)
    const r = rng(pattern)
    for (let i = 0; i < 900; i++) {
      cg.fillStyle = r() > 0.5 ? 'rgba(120,96,70,0.12)' : 'rgba(230,214,190,0.14)'
      cg.fillRect(r() * PX, r() * PX, 2 + r() * 6, 2 + r() * 6)
    }
    cg.save()
    cg.filter = 'blur(9px)'
    cg.globalAlpha = 0.32
    cg.globalCompositeOperation = 'multiply'
    const shade = document.createElement('canvas')
    shade.width = shade.height = PX
    const shg = shade.getContext('2d')!
    shg.fillStyle = '#fff'
    shg.fillRect(0, 0, PX, PX)
    shg.globalCompositeOperation = 'difference'
    shg.drawImage(h, 0, 0)
    cg.drawImage(shade, 4, -4)
    cg.restore()
    cg.globalCompositeOperation = 'source-over'
    cg.globalAlpha = 0.85
    cg.filter = 'blur(1.5px)'
    const white = document.createElement('canvas')
    white.width = white.height = PX
    const wg = white.getContext('2d')!
    wg.drawImage(h, 0, 0)
    wg.globalCompositeOperation = 'source-in'
    wg.fillStyle = '#f6f1e8'
    wg.fillRect(0, 0, PX, PX)
    // the coil drawing is white on black: keep the coils only (black → transparent)
    const id = wg.getImageData(0, 0, PX, PX)
    const hd = h.getContext('2d')!.getImageData(0, 0, PX, PX)
    for (let i = 0; i < id.data.length; i += 4) id.data[i + 3] = hd.data[i]
    wg.putImageData(id, 0, 0)
    cg.drawImage(white, 0, 0)
    cg.globalAlpha = 1
    cg.filter = 'none'
    const bump = new THREE.CanvasTexture(soft)
    bump.colorSpace = THREE.NoColorSpace
    const color = new THREE.CanvasTexture(c)
    color.colorSpace = THREE.SRGBColorSpace
    for (const t of [bump, color]) {
      t.wrapS = t.wrapT = THREE.RepeatWrapping
      t.repeat.set(1 / TILE, 1 / TILE)
      t.anisotropy = 8
    }
    hit = { bump, color }
    maps.set(pattern, hit)
  }
  return hit
}

/** The F facets the band covers → [fromDeg, toDeg] on F's arc. */
function arcOf(surfaces: string): [number, number] {
  const ids = surfaces
    .split(',')
    .map((s) => Number(/f-outer-(\d)/.exec(s.trim())?.[1]))
    .filter((n) => n >= 1 && n <= 5)
  if (!ids.length) return [F.fromDeg, F.toDeg]
  // facets are numbered in walking order (decreasing plan angle): f-outer-1 is at toDeg
  const step = (F.toDeg - F.fromDeg) / 5
  const lo = Math.min(...ids)
  const hi = Math.max(...ids)
  return [F.toDeg - hi * step, F.toDeg - (lo - 1) * step]
}

export function LippanWall({ config }: ModelProps) {
  const m = useModelMaterials()
  const patternS = str(config, 'pattern', 'lattice')
  const pattern: Pattern = patternS === 'peacock' || patternS === 'flower' ? patternS : 'lattice'
  const share = Math.max(0, Math.min(1, num(config, 'mirrors', 0.5)))
  const [a0, a1] = arcOf(str(config, 'surfaces', ''))
  // keep the band clear of F's rounded ends
  const from = a0 + 1.2
  const to = a1 - 1.2
  const mid = (from + to) / 2
  const len = ((to - from) * DEG) * R
  const tier = useMuseum((st) => st.tier)
  const coilSides = tier === 'low' ? 4 : 6

  const geo = useMemo(() => {
    const ground = bendToCylinder(wallGrid(-len / 2, len / 2, Y0, Y1, 0.25), { r: R, aMidDeg: mid, concave: false })
    // the rolled coils along the top and bottom of the band
    const coil = (y: number) => {
      const pts: THREE.Vector3[] = []
      const n = Math.ceil(len / 0.2)
      for (let i = 0; i <= n; i++) {
        const a = (to - ((to - from) * i) / n) * DEG
        pts.push(new THREE.Vector3(Math.cos(a) * (R + 0.01), y, Math.sin(a) * (R + 0.01)))
      }
      return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), n, 0.028, 8, false)
    }
    // the lattice's coils as raised geometry (the relief map alone read as a printed wallpaper):
    // half-round rolls of clay along the drawing's diagonals u − v = k/4 and u + v = k/4 (tile
    // units, the colour map's own lines), clipped to the band; the map keeps the fine doubled coils
    let lattice: THREE.BufferGeometry | null = null
    if (pattern === 'lattice') {
      const tubes: THREE.BufferGeometry[] = []
      const x0 = -len / 2
      const x1 = len / 2
      const step = TILE / 4
      for (const dir of [1, -1]) {
        // a line y = dir·x − dir·c (x − y = c for dir 1; x + y = c for dir −1), c on the 1/4-tile grid
        const kLo = Math.floor((dir === 1 ? x0 - Y1 : x0 + Y0) / step) - 1
        const kHi = Math.ceil((dir === 1 ? x1 - Y0 : x1 + Y1) / step) + 1
        for (let k = kLo; k <= kHi; k++) {
          const c = k * step
          // clip the segment to the band
          let xa = dir === 1 ? Y0 + c : c - Y1
          let xb = dir === 1 ? Y1 + c : c - Y0
          xa = Math.max(xa, x0 + 0.03)
          xb = Math.min(xb, x1 - 0.03)
          if (xb - xa < 0.05) continue
          const yAt = (x: number) => (dir === 1 ? x - c : c - x)
          const pa = new THREE.Vector3(xa, yAt(xa), 0.004)
          const pb = new THREE.Vector3(xb, yAt(xb), 0.004)
          const n = Math.max(2, Math.ceil(pa.distanceTo(pb) / 0.18))
          tubes.push(new THREE.TubeGeometry(new THREE.LineCurve3(pa, pb), n, 0.012, coilSides, false))
        }
      }
      const merged = mergeAll(tubes)
      lattice = merged ? bendToCylinder(merged, { r: R, aMidDeg: mid, concave: false }) : null
    }
    return { ground, top: coil(Y1 + 0.03), bottom: coil(Y0 - 0.03), lattice }
  }, [len, mid, from, to, pattern, coilSides])
  useEffect(() => () => Object.values(geo).forEach((g) => g?.dispose()), [geo])

  const groundMat = useMemo(() => {
    const { bump, color } = patternMaps(pattern)
    const mat = (m.terracotta as THREE.MeshStandardMaterial).clone()
    mat.color.set('#ffffff')
    mat.map = color
    mat.bumpMap = bump
    // the lattice's main coils are geometry: the map carries only the fine relief
    mat.bumpScale = pattern === 'lattice' ? 4 : 9
    mat.normalMap = null
    mat.roughness = 0.97
    mat.envMapIntensity = 0.45
    return mat
  }, [m, pattern])
  useEffect(() => () => groundMat.dispose(), [groundMat])
  const coilMat = tinted(m.terracotta, '#ece4d4', { roughness: 0.95 })

  // mirrors: on a share of the knots of every tile, facing out of the wall
  const mirrors = useMemo(() => {
    const ks = knots(pattern)
    const r = rng(`${pattern}|${share}`)
    const list: { x: number; y: number; s: number }[] = []
    const tiles = Math.ceil(len / TILE)
    const rows = Math.ceil((Y1 - Y0) / TILE)
    if (pattern === 'lattice') {
      // on the coils' crossings (x, y on the quarter-tile grid, i + j even), bigger at the tile's knots
      const q = TILE / 4
      for (let i = Math.ceil(-len / 2 / q); i <= Math.floor(len / 2 / q); i++)
        for (let j = Math.ceil(Y0 / q); j <= Math.floor(Y1 / q); j++) {
          if ((((i + j) % 2) + 2) % 2 !== 0) continue
          const x = i * q
          const y = j * q
          if (x < -len / 2 + 0.05 || x > len / 2 - 0.05 || y < Y0 + 0.05 || y > Y1 - 0.05) continue
          if (r() < share) list.push({ x, y, s: i % 4 === 0 || j % 4 === 0 ? 0.022 : 0.032 })
        }
      return list
    }
    for (let tx = 0; tx < tiles; tx++)
      for (let ty = 0; ty < rows; ty++)
        for (const [u, v, s] of ks) {
          const x = -len / 2 + (tx + u) * TILE
          const y = Y0 + (ty + v) * TILE
          if (x < -len / 2 + 0.05 || x > len / 2 - 0.05 || y < Y0 + 0.05 || y > Y1 - 0.05) continue
          if (r() < share) list.push({ x, y, s })
        }
    return list
  }, [pattern, share, len])
  const disc = useMemo(() => new THREE.CircleGeometry(1, 16), [])
  const mirrorMat = useMemo(() => {
    // polished: a sharp highlight in each disc (the corridor glitters as one walks it), and a
    // faint silvering of their own so they read even off-axis
    const mm = new THREE.MeshStandardMaterial({ name: 'lippan-mirror', color: '#f4f7f9', metalness: 1, roughness: 0.05, envMapIntensity: 3.6, emissive: new THREE.Color('#fff4e2'), emissiveIntensity: 0.12 })
    // the accent cones' highlight (inject.ts): each disc catches the corridor's spots as it is passed
    injectAtmosphere(mm)
    return mm
  }, [])
  const rim = useMemo(() => new THREE.RingGeometry(1, 1.45, 16), [])
  const inst = useRef<THREE.InstancedMesh>(null)
  const rims = useRef<THREE.InstancedMesh>(null)
  useEffect(() => {
    const o = new THREE.Object3D()
    mirrors.forEach((mm, i) => {
      const a = mid * DEG - mm.x / R
      // proud of the coils' crowns (the coils rise 1.6 cm), so each mirror sits in its knot
      const [x, z] = polar(R + (pattern === 'lattice' ? 0.019 : 0.016), a / DEG)
      o.position.set(x, mm.y, z)
      // the disc's +z faces out of the wall (away from the drum centre)
      o.rotation.set(0, Math.atan2(Math.cos(a), Math.sin(a)), 0)
      // mirrors as big as the knots hold (2.5–5 cm across), so they flash in the accent light
      o.scale.setScalar(mm.s * TILE * 1.05)
      o.updateMatrix()
      inst.current?.setMatrixAt(i, o.matrix)
      o.position.set(x - Math.cos(a) * 0.004, mm.y, z - Math.sin(a) * 0.004)
      o.updateMatrix()
      rims.current?.setMatrixAt(i, o.matrix)
    })
    for (const im of [inst.current, rims.current]) {
      if (!im) continue
      im.instanceMatrix.needsUpdate = true
      im.computeBoundingSphere()
    }
  }, [mirrors, mid, pattern])
  useEffect(
    () => () => {
      disc.dispose()
      rim.dispose()
      mirrorMat.dispose()
    },
    [disc, rim, mirrorMat],
  )

  return (
    <group name="lippan-wall">
      <mesh geometry={geo.ground} material={groundMat} receiveShadow />
      <mesh geometry={geo.top} material={coilMat} castShadow receiveShadow />
      <mesh geometry={geo.bottom} material={coilMat} castShadow receiveShadow />
      {geo.lattice && <mesh geometry={geo.lattice} material={coilMat} receiveShadow />}
      <instancedMesh ref={inst} args={[disc, mirrorMat, mirrors.length]} />
      <instancedMesh ref={rims} args={[rim, coilMat, mirrors.length]} />
    </group>
  )
}
