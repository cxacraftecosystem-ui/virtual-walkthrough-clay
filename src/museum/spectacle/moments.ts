/**
 * MOMENTS — the pavilion's named moments a visitor can see again (Help → Moments, SPECTACLE
 * F30/F33). Each is a cue (spectacle/cues.ts) with the place it belongs to: replaying one
 * takes the visitor there (the soft fade the tour uses; a cut in the Still form), then fires
 * the cue from source 'replay'. The arrival is replayed as the flight itself.
 *
 * Moments that need a package which has not landed simply fire into silence — firing never fails.
 */
import { track } from '../analytics/tracker'
import { TOUR_STOPS, type TourView } from '../config/tour'
import { usePerch } from '../navigation/perch'
import { leavePerch } from '../navigation/perchActions'
import { useMuseum } from '../state/store'
import { teleport } from '../state/visitor'
import { travel } from '../ui/Minimap'
import { cueHistory, fireCue, resetZoneFirst } from './cues'
import { MOMENTS, type Moment } from './momentList'
import { spectacleSettings } from './settings'

export { MOMENTS }
export type { Moment }

/** Ids of moments seen this visit (fired by anyone but a replay). */
export function seenMoments(): Set<string> {
  return new Set(cueHistory.filter((e) => e.source !== 'replay').map((e) => String(e.id)))
}

const viewOf = (m: Moment): TourView | null => (typeof m.at === 'string' ? (TOUR_STOPS.find((s) => s.id === m.at)?.view ?? null) : m.at)

/** Go to where a moment lives and play it again. */
export function replayMoment(id: string) {
  const m = MOMENTS.find((x) => x.id === id)
  if (!m) return
  const st = useMuseum.getState()
  st.setHelpOpen(false)
  st.select(null)
  if (usePerch.getState().perch) leavePerch(false)
  track('moment', { itemId: String(m.id), meta: { source: 'replay' } })
  if (m.id === 'arrival:eye') {
    const a = (window as unknown as { __arrival?: { start: () => void } }).__arrival
    a?.start()
    return
  }
  const v = viewOf(m)
  const play = () => window.setTimeout(() => fireCue(m.id, { source: 'replay' }), m.delayMs ?? 700)
  if (!v) {
    play()
    return
  }
  const move = () => {
    teleport(v.x, v.z, v.yawDeg, v.pitchDeg ?? 0)
    play()
  }
  if (spectacleSettings().mode === 'still') move()
  else travel(move)
}

/** "Let the rooms greet me again": the first-visit moments play again on the next entry to each room. */
export function replayFirstVisits() {
  resetZoneFirst()
}
