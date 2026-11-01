/**
 * The pavilion's named moments as data (no React, no three): the ones a visitor can replay from
 * Help → Moments, with where each is best seen, and the ones a docent may play for a live tour
 * (SPECTACLE F30, F33). Behaviour: spectacle/moments.ts, live/session.ts.
 */
import type { TourView } from '../config/tour'
import { MUSEUM, polar } from '../config/museum'
import { SAT_WALL, THEATRE } from '../config/satellites'
import type { CueId } from './cues'

export interface Moment {
  id: CueId
  /** Where to stand to see it (compass yaw), or a tour stop id. */
  at: TourView | string
  /** Fire this long after arriving (ms). */
  delayMs?: number
}

const F = MUSEUM.innerMainWall
/** The oculus court, from in front of F on the entry side, looking in over the pool. */
const COURT: TourView = { x: 0, z: F.r - F.thickness / 2 - 1.35, yawDeg: 0, pitchDeg: 4 }
/** The Turn: just past F's east end, where the court opens up at once. */
const [TURN_X, TURN_Z] = polar(F.r + 1.4, F.fromDeg - 6)
/** The corridor between F and H, on the axis, facing H's strata face. */
const CORRIDOR_Z = (F.r + F.thickness / 2 + MUSEUM.drum.ringR) / 2
/** The theatre: from the screen end, looking back up at the vault. */
const VAULT_AT = polar(SAT_WALL.outerFace - 1.6, THEATRE.screenTo - 2)
/** Standing at (x, z), facing (tx, tz) (compass yaw). */
const lookAt = (x: number, z: number, tx: number, tz: number, pitchDeg: number): TourView => ({ x, z, yawDeg: ((Math.atan2(tx - x, -(tz - z)) * 180) / Math.PI + 360) % 360, pitchDeg })

export const MOMENTS: readonly Moment[] = [
  { id: 'arrival:eye', at: { x: MUSEUM.visitor.start.x, z: MUSEUM.visitor.start.z, yawDeg: MUSEUM.visitor.start.yawDeg, pitchDeg: MUSEUM.visitor.start.pitchDeg } },
  { id: 'reveal:turn', at: { x: TURN_X, z: TURN_Z, yawDeg: 294, pitchDeg: 12 } },
  { id: 'court:mandala', at: COURT },
  { id: 'court:drip', at: COURT },
  { id: 'helix:chime', at: { ...COURT, pitchDeg: 26 } },
  { id: 'strata:sweep', at: { x: 0, z: CORRIDOR_Z, yawDeg: 180, pitchDeg: 5 } },
  { id: 'podium:spot', at: 'gallery-b' },
  { id: 'parikrama:alpana', at: 'parikrama' },
  { id: 'bells:ring', at: 'parikrama' },
  { id: 'theatre:firing', at: lookAt(VAULT_AT[0], VAULT_AT[1], ...polar(SAT_WALL.innerFace, THEATRE.screenFrom), 14) },
  { id: 'theatre:kilnFilm', at: 'theatre' },
  { id: 'weather:monsoon', at: COURT },
  { id: 'night:diyas', at: COURT },
]

/**
 * The moments a docent may play for everyone following the tour. Only these ids are accepted
 * from a signed envelope; `podium:spot` carries the podium number.
 */
export const DOCENT_MOMENTS = ['theatre:dim', 'theatre:kilnFilm', 'weather:monsoon', 'night:diyas', 'bells:ring', 'podium:spot', 'gather:oculus'] as const
export type DocentMoment = (typeof DOCENT_MOMENTS)[number]
