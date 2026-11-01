/**
 * Zone-based render culling.
 *
 * Each space's content is wrapped in <ZoneGroup zones={[...]}>. Every frame the visitor's
 * zone is resolved and ZONE_VISIBILITY (layout.ts) gives the set of zones that can be seen
 * from it (through openings and round the free-standing walls); groups outside that set are
 * hidden — no draw calls, no shadow casting. Near a zone edge the set of the zone being
 * entered is merged in, so nothing pops. Zones are tested by their real footprint (arc
 * sectors, polygons), and only zones visible from the current one count as "being entered",
 * so a zone behind a wall never leaks in.
 */
import { useFrame } from '@react-three/fiber'
import { useLayoutEffect, useRef, type ReactNode } from 'react'
import type * as THREE from 'three'
import { ZONES, ZONE_VISIBILITY, zoneAt, zoneDistance, type ZoneId } from '../config/layout'
import { DEG, KEY, MUSEUM } from '../config/museum'
import { visitor } from '../state/visitor'
import { requestShadowRefresh } from '../lighting/SkyAndSun'
import { perchZone } from './perch'

const groups = new Map<THREE.Group, ZoneId[]>()
let visible = new Set<ZoneId>(ZONES.map((z) => z.id))
let current: ZoneId | null = null
const MARGIN = 1.6

function applyVisibility() {
  for (const [g, zones] of groups) g.visible = zones.some((z) => visible.has(z))
}

/** Zones within MARGIN of the point that can be seen from `from` — catches thresholds. */
function nearbyZones(x: number, z: number, from: ZoneId): ZoneId[] {
  const open = ZONE_VISIBILITY[from] ?? [from]
  return ZONES.filter((zn) => open.includes(zn.id) && zoneDistance(zn, x, z) <= MARGIN).map((zn) => zn.id)
}

/** Outside every zone (inside a wall or a door threshold): the closest zone footprint. */
function nearestZone(x: number, z: number): ZoneId | null {
  let best: ZoneId | null = null
  let bestD = Infinity
  for (const zn of ZONES) {
    // the roof (level 2) lies over the court: only the perch puts the visitor there
    if (zn.level === 2) continue
    const d = zoneDistance(zn, x, z)
    if (d < bestD) {
      bestD = d
      best = zn.id
    }
  }
  return best
}

/*
 * Deep in the annex the description wall H closes the view north: the rotunda shows only past
 * H's ends, along the sight lines that clear the annex mouth's corners. Each side's zones stay
 * in the set while such a line exists (with a margin), and drop out once the visitor is too far
 * in or too far to that side to see past the end.
 */
const H_WALL = MUSEUM.descriptionWall
const H_OUT = H_WALL.r + H_WALL.thickness / 2 + 0.3
/** H's ends (its entrance face, plus a margin): east (x > 0) and west. */
const H_END = { east: [H_OUT * Math.cos(H_WALL.fromDeg * DEG), H_OUT * Math.sin(H_WALL.fromDeg * DEG)], west: [H_OUT * Math.cos(H_WALL.toDeg * DEG), H_OUT * Math.sin(H_WALL.toDeg * DEG)] } as const
/** The annex mouth's corners, where its side walls meet the drum (a margin wider). */
const MOUTH = { x: KEY.annexHalf + 0.3, z: Math.sqrt(KEY.lobeR * KEY.lobeR - KEY.annexHalf * KEY.annexHalf) }
const PAST_EAST: ZoneId[] = ['ring-a', 'inner', 'duplex']
const PAST_WEST: ZoneId[] = ['ring-c', 'hallway-d', 'inner', 'duplex']

/** Whether a line from (x, z) in the annex clears the mouth's corner on side `s` and passes H's end there. */
function seesPast(x: number, z: number, s: 1 | -1): boolean {
  const [ex, ez] = s > 0 ? H_END.east : H_END.west
  if (z <= MOUTH.z + 0.5) return true
  // sideways run per metre northwards: to the mouth's corner, and to H's end
  const toCorner = (s * MOUTH.x - x) / (z - MOUTH.z)
  const toEnd = (ex - x) / (z - ez)
  return s > 0 ? toCorner > toEnd : toCorner < toEnd
}

/** The annex's own set, narrowed to what the visitor can see from where they stand. */
function annexSet(x: number, z: number): ZoneId[] {
  const all = ZONE_VISIBILITY.annex ?? ['annex']
  const east = seesPast(x, z, 1)
  const west = seesPast(x, z, -1)
  return all.filter((id) => (!PAST_EAST.includes(id) && !PAST_WEST.includes(id)) || (east && PAST_EAST.includes(id)) || (west && PAST_WEST.includes(id)))
}

/** Show every zone regardless of the visitor (e.g. the arrival flight over the roofs). */
let forceAll = false
export function setCullingOverride(all: boolean) {
  forceAll = all
}

export function ZoneCuller({ enabled = true }: { enabled?: boolean }) {
  const last = useRef('')
  useFrame(() => {
    if (!enabled || forceAll) {
      if (last.current !== 'all') {
        visible = new Set(ZONES.map((z) => z.id))
        applyVisibility()
        last.current = 'all'
      }
      return
    }
    const here = perchZone() ?? zoneAt(visitor.x, visitor.z)?.id ?? nearestZone(visitor.x, visitor.z)
    if (here) current = here
    const set = new Set<ZoneId>()
    for (const id of current ? [current, ...nearbyZones(visitor.x, visitor.z, current)] : ZONES.map((z) => z.id)) {
      for (const v of id === 'annex' ? annexSet(visitor.x, visitor.z) : (ZONE_VISIBILITY[id] ?? [id])) set.add(v)
    }
    const key = [...set].sort().join(',')
    if (key !== last.current) {
      last.current = key
      visible = set
      applyVisibility()
      requestShadowRefresh(2)
    }
  })
  return null
}

/** Render children only while one of `zones` is visible from the visitor's position. */
export function ZoneGroup({ zones, children }: { zones: ZoneId[]; children: ReactNode }) {
  const ref = useRef<THREE.Group>(null)
  const key = zones.join(',')
  useLayoutEffect(() => {
    const g = ref.current
    if (!g) return
    groups.set(g, key.split(',') as ZoneId[])
    g.visible = (key.split(',') as ZoneId[]).some((z) => visible.has(z))
    return () => {
      groups.delete(g)
    }
  }, [key])
  return <group ref={ref}>{children}</group>
}

export function isZoneVisible(z: ZoneId) {
  return visible.has(z)
}

/**
 * Temporarily show exactly the zones visible from `zone` (or every zone for null), run `fn`,
 * then restore the visitor's culling set. Used for off-screen captures (probes, path tracing).
 */
export function withZonesVisible<T>(zone: ZoneId | null, fn: () => T): T {
  const saved = visible
  visible = new Set<ZoneId>(zone ? (ZONE_VISIBILITY[zone] ?? [zone]) : ZONES.map((z) => z.id))
  applyVisibility()
  try {
    return fn()
  } finally {
    visible = saved
    applyVisibility()
  }
}
