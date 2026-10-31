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
import { visitor } from '../state/visitor'
import { requestShadowRefresh } from '../lighting/SkyAndSun'

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
    const d = zoneDistance(zn, x, z)
    if (d < bestD) {
      bestD = d
      best = zn.id
    }
  }
  return best
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
    const here = zoneAt(visitor.x, visitor.z)?.id ?? nearestZone(visitor.x, visitor.z)
    if (here) current = here
    const set = new Set<ZoneId>()
    for (const id of current ? [current, ...nearbyZones(visitor.x, visitor.z, current)] : ZONES.map((z) => z.id)) {
      for (const v of ZONE_VISIBILITY[id] ?? [id]) set.add(v)
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
