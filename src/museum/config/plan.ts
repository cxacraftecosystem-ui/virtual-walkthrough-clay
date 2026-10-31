/**
 * FLOOR PLAN — the building as SVG paths in world metres (x → svg x, z → svg y), for the museum
 * minimap and the admin heatmap. Building-neutral seam: neither reads WALLS directly.
 * Arcs are written with SVG 'A' commands; angles grow from +x towards +z, which is SVG's
 * positive (clockwise on screen) sweep direction.
 */
import { WALLS, ZONES, type WallShape, type ZoneShape } from './layout'
import { MUSEUM } from './museum'

export interface PlanBounds {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
}
export interface PlanWall {
  id: string
  kind: string
  d: string
}
export interface PlanZone {
  id: string
  name: string
  d: string
  cx: number
  cz: number
}

const TAU = Math.PI * 2
const f = (n: number) => String(Math.round(n * 1000) / 1000)
const pt = (cx: number, cz: number, r: number, a: number) => `${f(cx + r * Math.cos(a))} ${f(cz + r * Math.sin(a))}`

/** Arc from a0 to a1 (a0 < a1) at radius r; `reverse` draws it a1 → a0. Splits full circles. */
function arcTo(cx: number, cz: number, r: number, a0: number, a1: number, reverse = false): string {
  if (r <= 0) return ` L${f(cx)} ${f(cz)}`
  const span = a1 - a0
  if (span >= TAU - 1e-9) {
    // two half circles back to the start
    const s = reverse ? -1 : 1
    const start = reverse ? a1 : a0
    return ` A${f(r)} ${f(r)} 0 0 ${reverse ? 0 : 1} ${pt(cx, cz, r, start + s * Math.PI)} A${f(r)} ${f(r)} 0 0 ${reverse ? 0 : 1} ${pt(cx, cz, r, start)}`
  }
  const large = span > Math.PI ? 1 : 0
  return reverse ? ` A${f(r)} ${f(r)} 0 ${large} 0 ${pt(cx, cz, r, a0)}` : ` A${f(r)} ${f(r)} 0 ${large} 1 ${pt(cx, cz, r, a1)}`
}

/** Closed outline of an annular sector (r0 may be 0). */
export function sectorPath(cx: number, cz: number, r0: number, r1: number, a0: number, a1: number): string {
  const full = a1 - a0 >= TAU - 1e-9
  if (full) {
    // outer circle, then the inner circle as a separate (hole) subpath
    let d = `M${pt(cx, cz, r1, a0)}${arcTo(cx, cz, r1, a0, a1)} Z`
    if (r0 > 0) d += ` M${pt(cx, cz, r0, a0)}${arcTo(cx, cz, r0, a0, a1, true)} Z`
    return d
  }
  const start = r0 > 0 ? `M${pt(cx, cz, r0, a0)} L${pt(cx, cz, r1, a0)}` : `M${f(cx)} ${f(cz)} L${pt(cx, cz, r1, a0)}`
  const back = r0 > 0 ? ` L${pt(cx, cz, r0, a1)}${arcTo(cx, cz, r0, a0, a1, true)}` : ''
  return `${start}${arcTo(cx, cz, r1, a0, a1)}${back} Z`
}

function polyPath(points: [number, number][]) {
  return points.map((p, i) => `${i ? 'L' : 'M'}${f(p[0])} ${f(p[1])}`).join(' ') + ' Z'
}

const signedArea = (pts: [number, number][]) => pts.reduce((s, p, i) => s + p[0] * pts[(i + 1) % pts.length][1] - pts[(i + 1) % pts.length][0] * p[1], 0)

/** Polygon with holes, holes wound opposite to the outline so the default (nonzero) fill leaves them empty. */
function polyWithHoles(points: [number, number][], holes: [number, number][][] = []) {
  const sign = Math.sign(signedArea(points))
  return [polyPath(points), ...holes.map((h) => polyPath(Math.sign(signedArea(h)) === sign ? h.slice().reverse() : h))].join(' ')
}

export function wallShapePath(s: WallShape): string {
  if (s.kind === 'arc') return sectorPath(s.cx, s.cz, s.r - s.thickness / 2, s.r + s.thickness / 2, s.a0, s.a1)
  const len = Math.hypot(s.bx - s.ax, s.bz - s.az) || 1
  const nx = (-(s.bz - s.az) / len) * (s.thickness / 2)
  const nz = ((s.bx - s.ax) / len) * (s.thickness / 2)
  return polyPath([
    [s.ax + nx, s.az + nz],
    [s.bx + nx, s.bz + nz],
    [s.bx - nx, s.bz - nz],
    [s.ax - nx, s.az - nz],
  ])
}

export function zoneShapePath(s: ZoneShape): string {
  if (s.kind === 'sector') return sectorPath(s.cx, s.cz, s.r0, s.r1, s.a0, s.a1)
  if (s.kind === 'poly') return polyWithHoles(s.points, s.holes)
  return s.parts.map(zoneShapePath).join(' ')
}

function buildPlan() {
  const walls: PlanWall[] = WALLS.filter((w) => w.kind !== 'boundary' && w.collide !== false).map((w) => ({
    id: w.id,
    kind: w.kind,
    d: w.shape
      ? wallShapePath(w.shape)
      : polyPath([
          [w.min[0], w.min[2]],
          [w.max[0], w.min[2]],
          [w.max[0], w.max[2]],
          [w.min[0], w.max[2]],
        ]),
  }))
  const zones: PlanZone[] = ZONES.map((z) => ({
    id: z.id,
    name: z.name,
    d: z.shape
      ? zoneShapePath(z.shape)
      : polyPath([
          [z.rect.minX, z.rect.minZ],
          [z.rect.maxX, z.rect.minZ],
          [z.rect.maxX, z.rect.maxZ],
          [z.rect.minX, z.rect.maxZ],
        ]),
    cx: z.anchor[0],
    cz: z.anchor[1],
  }))
  // The whole walkable site: landscape disc + forecourt, with a little margin.
  const pad = 0.6
  const L = MUSEUM.landscape.r
  const bounds: PlanBounds = {
    minX: Math.min(-L, ...ZONES.map((z) => z.rect.minX)) - pad,
    maxX: Math.max(L, ...ZONES.map((z) => z.rect.maxX)) + pad,
    minZ: Math.min(-L, ...ZONES.map((z) => z.rect.minZ)) - pad,
    maxZ: Math.max(L, ...ZONES.map((z) => z.rect.maxZ)) + pad,
  }
  return { bounds, walls, zones }
}

export const FLOOR_PLAN: { bounds: PlanBounds; walls: PlanWall[]; zones: PlanZone[] } = buildPlan()
