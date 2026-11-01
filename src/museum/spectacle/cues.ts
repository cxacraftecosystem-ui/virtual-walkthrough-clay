/**
 * SPECTACLE CUES — one tiny event bus for the pavilion's moments (SPECTACLE §2).
 *
 * A cue is a named moment ("reveal:turn", "theatre:firing", "zone-first:inner"…). Anything may
 * fire one: the tour engine (stop cues), the docent (live session), the visitor (Help → Moments,
 * a bell), or the pavilion itself (the first time a visitor steps into a zone). Features listen
 * with `useCue` (React) or `onCue` (anywhere) and play their Full, Lite or Still form
 * (spectacle/settings.ts) — firing never fails when nobody listens.
 *
 * `zone-first:<zone>` fires once per browser session, the first time the visitor stands in
 * that zone (remembered in sessionStorage), from <ZoneFirstCues/> mounted by Spectacle.tsx.
 */
import { useFrame } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import { zoneAt, type ZoneId } from '../config/layout'
import { perchZone } from '../navigation/perch'
import { useMuseum } from '../state/store'
import { visitor } from '../state/visitor'

/** The named moments (open-ended: packages may add their own `area:name` ids). */
export type KnownCue =
  | 'arrival:eye'
  | 'reveal:turn'
  | 'court:mandala'
  | 'court:drip'
  | 'strata:sweep'
  | 'theatre:firing'
  | 'theatre:kilnFilm'
  | 'theatre:dim'
  | 'weather:monsoon'
  | 'night:diyas'
  | 'night:preview'
  | 'bells:ring'
  | 'podium:spot'
  | 'gather:oculus'
  | 'helix:chime'
  | 'music:drone'
  | 'music:pulse'
  | 'music:wind'
  | 'music:coda'
  | 'parikrama:alpana'
  | `zone-first:${ZoneId}`

export type CueId = KnownCue | (string & {})

/** Who fired the cue: decides e.g. whether a docent cue may override the visitor's settings. */
export type CueSource = 'tour' | 'docent' | 'visitor' | 'zone' | 'replay' | 'system'

export interface CueEvent {
  id: CueId
  source: CueSource
  data?: unknown
  /** performance.now() when fired. */
  at: number
}

type Listener = (e: CueEvent) => void

const listeners = new Map<string, Set<Listener>>()
/** Listeners for every cue ('*'). */
const ANY = '*'

/** The last cues fired (newest last), for Help → Moments and debugging. */
export const cueHistory: CueEvent[] = []
const HISTORY = 40

/** Fire a cue. Listeners run synchronously; one that throws never stops the others. */
export function fireCue(id: CueId, opts: { source?: CueSource; data?: unknown } = {}): CueEvent {
  const e: CueEvent = { id, source: opts.source ?? 'system', data: opts.data, at: typeof performance !== 'undefined' ? performance.now() : Date.now() }
  cueHistory.push(e)
  if (cueHistory.length > HISTORY) cueHistory.splice(0, cueHistory.length - HISTORY)
  for (const key of [id, ANY]) {
    const set = listeners.get(key)
    if (!set) continue
    for (const fn of [...set]) {
      try {
        fn(e)
      } catch (err) {
        console.error(`[spectacle] cue ${id}:`, err)
      }
    }
  }
  return e
}

/** Listen for a cue (or '*' for every cue) outside React. Returns the unsubscribe function. */
export function onCue(id: CueId | '*', fn: Listener): () => void {
  let set = listeners.get(id)
  if (!set) listeners.set(id, (set = new Set()))
  set.add(fn)
  return () => {
    set.delete(fn)
  }
}

/** Listen for a cue from a component; the latest `fn` is always called (no re-subscribe per render). */
export function useCue(id: CueId | '*', fn: Listener) {
  const ref = useRef(fn)
  useEffect(() => {
    ref.current = fn
  })
  useEffect(() => onCue(id, (e) => ref.current(e)), [id])
}

/* ------------------------------------------------------------------ */
/* zone-first:<zone>                                                    */
/* ------------------------------------------------------------------ */

const SEEN_KEY = 'clay.zonesSeen.v1'

function readSeen(): Set<string> {
  try {
    return new Set(JSON.parse(sessionStorage.getItem(SEEN_KEY) ?? '[]') as string[])
  } catch {
    return new Set()
  }
}

function writeSeen(seen: Set<string>) {
  try {
    sessionStorage.setItem(SEEN_KEY, JSON.stringify([...seen]))
  } catch {
    // private mode / storage blocked: the cue simply fires again next session
  }
}

/** Forget which zones were seen (Help → Moments "replay", tests). */
export function resetZoneFirst() {
  writeSeen(new Set())
}

/**
 * Fires `zone-first:<zone>` (and `zone:<zone>` on every change) as the visitor walks. Checked a
 * few times a second; the roof perch reports its own zone first. Mounted once, inside the Canvas.
 */
export function ZoneFirstCues() {
  const st = useRef({ frame: 0, zone: null as string | null, seen: null as Set<string> | null })
  useFrame(() => {
    const s = st.current
    if (s.frame++ % 8 !== 0) return
    if (useMuseum.getState().phase !== 'entered') return
    const z = perchZone() ?? zoneAt(visitor.x, visitor.z)?.id ?? null
    if (!z || z === s.zone) return
    s.zone = z
    fireCue(`zone:${z}`, { source: 'zone' })
    s.seen = readSeen() // re-read: Help → Moments may have reset it (resetZoneFirst)
    if (s.seen.has(z)) return
    s.seen.add(z)
    writeSeen(s.seen)
    fireCue(`zone-first:${z}` as CueId, { source: 'zone' })
  })
  return null
}
