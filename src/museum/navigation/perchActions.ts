/**
 * PERCH ACTIONS — riding to, walking on and coming down from a perch (SPECTACLE F4, GRAND §8 P5).
 * The maths and the state live in ./perch.ts (imported everywhere, so it stays light); these
 * actions touch the visitor, cues and analytics, and are called by the HUD, the doors, the
 * keyboard, VR and the screenshot harness.
 *
 *   climb(id?)         ride from the door the visitor stands at to a perch (the door's first
 *                      perch when no id is given): the balcony or the Sky Rim from the east
 *                      stair, the well's floor from its rim
 *   rideTo(id, t)      ride from its door straight to a place on a perch (the tour's stops)
 *   descend()          ride back to the door of the perch the visitor is on
 *   perchAt(id, t)     stand on a perch at once (no ride: harness, VR, restore)
 *   leavePerch()       back on the ground at the perch's door at once (tour start, minimap travel)
 *
 * Forms: Full plays the rail at its own length (perch.ts `rideSeconds`); Lite plays it at 0.8×
 * without the overlay's shading; Still (reduced motion) dips to black and cuts.
 * The controller (VisitorController, or VRRig in VR) plays the ride frame by frame and calls
 * `finishRide()`.
 */
import { track } from '../analytics/tracker'
import { fireCue } from '../spectacle/cues'
import { spectacleSettings } from '../spectacle/settings'
import { teleport, visitor, yawToRad } from '../state/visitor'
import { DEG } from '../config/museum'
import {
  ARRIVAL_T,
  RIDE_STILL_SECONDS,
  doorNear,
  doorOf,
  doorOutYaw,
  normT,
  pathOf,
  pathPoint,
  pathY,
  perchView,
  rideSeconds,
  usePerch,
  type PerchDoor,
  type PerchPath,
} from './perch'

function startRide(dir: 'up' | 'down', path: PerchPath, t: number) {
  const s = spectacleSettings()
  const still = s.mode === 'still'
  const lite = s.mode === 'lite'
  const dur = (still ? RIDE_STILL_SECONDS : rideSeconds(path, t) * (lite ? 0.8 : 1)) * 1000
  // the perch's zone holds for the whole ride: the stair and the roof see what the perch sees
  usePerch.setState({ perch: path, t, ride: { dir, path, start: performance.now(), elapsed: 0, dur, still, lite, t } })
  visitor.walkTarget = null
  visitor.vx = 0
  visitor.vz = 0
  fireCue(dir === 'up' ? 'perch:climb' : 'perch:descend', { source: 'visitor', data: { perch: path.id } })
  track('perch', { zone: path.zone, meta: { dir, still, perch: path.id } })
}

/**
 * Ride up (or down, into the well) to a perch. Without an id: the first perch of the door the
 * visitor stands at, or the Sky Rim. Ignored while a ride plays or already perched.
 */
export function climb(id?: string) {
  const s = usePerch.getState()
  if (s.ride || s.perch) return
  const near = doorNear(visitor.x, visitor.z)
  const path = pathOf(id ?? near?.perches[0] ?? 'sky-rim')
  startRide('up', path, ARRIVAL_T[path.id])
}

/** Ride from the perch's door straight to position `t` on it (the tour). Ignored while a ride plays or already perched. */
export function rideTo(id: string, t: number) {
  const s = usePerch.getState()
  if (s.ride || s.perch) return
  const path = pathOf(id)
  startRide('up', path, normT(path, t))
}

/** Ride back to the door of the perch the visitor is on. */
export function descend() {
  const s = usePerch.getState()
  if (s.ride || !s.perch) return
  startRide('down', s.perch, s.t)
}

/** Place the visitor on a perch at once, at `t` (0 … 1 along it; default where its ride arrives). */
export function perchAt(id = 'sky-rim', t?: number) {
  const path = pathOf(id)
  const tt = normT(path, t ?? ARRIVAL_T[path.id])
  const q = pathPoint(path, tt)
  const view = perchView(path, tt)
  usePerch.setState({ perch: path, t: tt, ride: null })
  visitor.x = q.x
  visitor.z = q.z
  visitor.yaw = yawToRad(view.yawDeg)
  visitor.pitch = view.pitchDeg * DEG
  visitor.vx = 0
  visitor.vz = 0
  visitor.walkTarget = null
}

/** Stand at a door, back to it. */
function toDoor(d: PerchDoor) {
  teleport(d.stand[0], d.stand[1], doorOutYaw(d), 0)
}

/** Back on the ground at once, at the perch's door (or wherever the visitor was just teleported). */
export function leavePerch(atDoor = true) {
  const s = usePerch.getState()
  const path = s.perch ?? s.ride?.path
  if (!path) return
  usePerch.setState({ perch: null, ride: null })
  if (atDoor) toDoor(doorOf(path.id))
  fireCue('perch:leave', { source: 'system', data: { perch: path.id } })
}

/** The ride has played to its end: settle on the perch, or on the ground at its door. */
export function finishRide() {
  const r = usePerch.getState().ride
  if (!r) return
  if (r.dir === 'up') {
    perchAt(r.path.id, r.t)
    fireCue('perch:arrive', { source: 'visitor', data: { perch: r.path.id } })
  } else {
    usePerch.setState({ perch: null, ride: null })
    toDoor(doorOf(r.path.id))
    fireCue('perch:leave', { source: 'visitor', data: { perch: r.path.id } })
  }
}

/** The door the visitor stands close enough to for a ride (null on a perch or away from both). */
export function nearPerchDoor(): PerchDoor | null {
  if (usePerch.getState().perch) return null
  return doorNear(visitor.x, visitor.z)
}

/** Floor height of the visitor's perch right now (0 on the ground). */
export function perchFloorY(): number {
  const s = usePerch.getState()
  return s.perch ? pathY(s.perch, s.t) : 0
}
