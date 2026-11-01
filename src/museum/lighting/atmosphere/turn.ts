/**
 * THE TURN (SPECTACLE F7) — the first step into the oculus court:
 *   - the exposure overshoots by 25 % and settles over 1.5 s, as an eye adapting to the light;
 *   - the shaft swells from 0.6 to 1.0 and the motes quicken;
 *   - the 11 podium lights rise in sequence A → B → C, 80 ms apart (their SpotPool requests).
 * (The drone that opens into a fifth is WP4's, on the same cue.)
 *
 * Fired by `zone-first:inner` (once per browser session) and replayed by `reveal:turn` (Help →
 * Moments, the tour). If the visitor reaches a gallery first, the podium lights rise there
 * without the rest, so a podium is never left dim in front of someone. Still form: everything
 * comes up at once, no overshoot. The curator can switch it off (`spectacle {turnReveal}`).
 */
import { PODIUM, PODIUM_SLOTS } from '../../config/layout'
import { onCue } from '../../spectacle/cues'
import { kindProps, spectacleSettings } from '../../spectacle/settings'
import { spotModifiers, type SpotRequest } from '../SpotPool'

/** Dimmed podium lights before the Turn (fraction of their intensity). */
const PRE_PODIUM = 0.32
const PRE_SHAFT = 0.6
const STAGGER_S = 0.08
const RISE_S = 0.6
const OVERSHOOT = 0.25
const SETTLE_S = 1.5

export const turnState = {
  /** Multipliers read by the shaft, the motes and the exposure. */
  shaft: 1,
  motes: 1,
  exposure: 1,
  /** performance.now()/1000 when the Turn started (−1 = never), and when the podiums started rising. */
  at: -1,
  podiumAt: -1,
  /** The court has been revealed (this session). */
  done: true,
  podiumsUp: true,
  still: false,
}

const SEEN_KEY = 'clay.zonesSeen.v1'

function seen(zone: string) {
  try {
    return (JSON.parse(sessionStorage.getItem(SEEN_KEY) ?? '[]') as string[]).includes(zone)
  } catch {
    return true
  }
}

const now = () => performance.now() / 1000

/** Podium slot index of a request (−1 = not a podium light), cached per request. */
const slotOf = new WeakMap<SpotRequest, number>()
function podiumSlot(r: SpotRequest): number {
  let i = slotOf.get(r)
  if (i === undefined) {
    const [tx, ty, tz] = r.target
    i = Math.abs(ty - PODIUM.height) < 0.5 ? PODIUM_SLOTS.findIndex((p) => Math.hypot(p.x - tx, p.z - tz) < 0.3) : -1
    slotOf.set(r, i)
  }
  return i
}

function podiumGain(r: SpotRequest): number {
  if (turnState.podiumsUp && turnState.podiumAt < 0) return 1
  const i = podiumSlot(r)
  if (i < 0) return 1
  if (turnState.podiumAt < 0) return PRE_PODIUM
  if (turnState.still) return 1
  const t = (now() - turnState.podiumAt - i * STAGGER_S) / RISE_S
  if (t <= 0) return PRE_PODIUM
  if (t >= 1) return 1
  const e = t * t * (3 - 2 * t)
  return PRE_PODIUM + (1 - PRE_PODIUM) * e
}

function raisePodiums() {
  if (turnState.podiumsUp) return
  turnState.podiumsUp = true
  turnState.podiumAt = now()
}

function play() {
  const st = spectacleSettings()
  turnState.still = st.mode === 'still'
  turnState.done = true
  turnState.at = now()
  turnState.podiumsUp = false
  raisePodiums()
}

/** Advance the Turn's envelopes (call once per frame). */
export function stepTurn() {
  const s = turnState
  if (!s.done) {
    s.shaft = PRE_SHAFT
    s.motes = 1
    s.exposure = 1
    return
  }
  if (s.at < 0 || s.still) {
    s.shaft = 1
    s.motes = 1
    s.exposure = 1
    return
  }
  const t = now() - s.at
  // exposure: up in 0.15 s, settle by 1.5 s
  s.exposure = 1 + OVERSHOOT * (t < 0.15 ? t / 0.15 : Math.max(0, 1 - (t - 0.15) / (SETTLE_S - 0.15)) ** 2)
  const sw = Math.min(1, t / 2.5)
  s.shaft = PRE_SHAFT + (1 - PRE_SHAFT) * sw * sw * (3 - 2 * sw)
  // the motes quicken, then calm over ~8 s
  s.motes = 1 + 2.2 * Math.exp(-t / 3)
  if (s.podiumAt >= 0 && now() - s.podiumAt > 2 + PODIUM_SLOTS.length * STAGGER_S) s.podiumAt = -1
}

let installed = 0
let offs: (() => void)[] = []

/** Listen for the Turn's cues; call from a mounted component (ref-counted). */
export function installTurn() {
  if (installed++ === 0) {
    const enabled = kindProps('spectacle').turnReveal !== false
    // a reload in the same session keeps the court revealed
    const fresh = enabled && !seen('inner')
    turnState.done = !fresh
    turnState.podiumsUp = !fresh || seen('ring-a') || seen('ring-b') || seen('ring-c')
    turnState.at = -1
    turnState.podiumAt = -1
    spotModifiers.add(podiumGain)
    offs = [
      onCue('zone-first:inner', () => {
        if (enabled && !turnState.done) play()
      }),
      onCue('reveal:turn', () => {
        if (enabled) play()
      }),
      ...(['ring-a', 'ring-b', 'ring-c'] as const).map((z) => onCue(`zone-first:${z}`, () => raisePodiums())),
    ]
  }
  return () => {
    if (--installed === 0) {
      offs.forEach((o) => o())
      offs = []
      spotModifiers.delete(podiumGain)
    }
  }
}
