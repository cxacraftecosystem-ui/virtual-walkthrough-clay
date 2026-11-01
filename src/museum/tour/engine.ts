/**
 * Guided-tour engine: walks the visitor from stop to stop (collision-aware routes through
 * doorways, fade-teleport for long hops), faces the subject, lingers while the caption is
 * shown (optionally narrated with speechSynthesis) and moves on.
 *
 * Any manual movement (keys, joystick, click-to-walk, minimap travel) pauses the tour;
 * `resume()` re-plans from wherever the visitor is.
 *
 * "Earth to Fire" (SPECTACLE F30): every stop belongs to a chapter and may carry cues
 * (config/tour.ts `TourCue`). Setting off for a stop in a new chapter fires `chapter:<name>`
 * and the stop's score stem (`music:<stem>`), so the music leads the walk; arriving fires its
 * light preset (`light:<preset>`), its time of day (`time:<preset>`, also applied to the
 * store) and its moments (`fx`), all from source 'tour'. A stop with `until` waits for that cue
 * (e.g. the end of a film chapter) — never less than a short read, never longer than its dwell.
 *
 * Perch stops (GRAND §8 P5: the balcony, the Sphere Well): the tour walks to the perch's door,
 * rides from there to the stop's place on the perch and arrives when the ride does; setting off
 * from a perch for a ground stop, it first rides back down to the door. While the rides are off
 * (`?perch=0`) the perch stops are passed over.
 */
import { create } from 'zustand'
import { TOUR, TOUR_STOPS, type TourChapter, type TourStop, type TourView } from '../config/tour'
import { MUSEUM } from '../config/museum'
import { useMuseum } from '../state/store'
import { teleport, visitor, yawToRad, type WalkTarget } from '../state/visitor'
import { travel } from '../ui/Minimap'
import { track } from '../analytics/tracker'
import { pathLength, planPath, type P2 } from './pathing'
import { bcp47, getLang, useLangStore, type Lang } from '../i18n'
import { hasTourTranslation, tourField } from '../i18n/tourText'
import { fireCue, onCue } from '../spectacle/cues'
import { DEG as RAD_PER_DEG } from '../config/museum'
import { RIDE_MAX_SECONDS, doorOf, doorOutYaw, perchEnabled, usePerch } from '../navigation/perch'
import { descend, leavePerch, rideTo } from '../navigation/perchActions'
import type { TimeOfDay } from '../state/store'

const DEG = Math.PI / 180
/** Switch to the next waypoint this close to the current one (keeps the walk fluid). */
const HANDOFF = 0.6
/** Moving further than this from the stop while viewing counts as taking over. */
const DRIFT = 0.45

export type TourPhase = 'walking' | 'viewing' | 'done'

interface TourState {
  active: boolean
  index: number
  phase: TourPhase
  paused: boolean
  /** Why the tour paused (shown as a hint). */
  pauseReason: 'user' | 'manual' | null
  narration: boolean
  /** 0–1 progress through the current stop's dwell. */
  progress: number
  /** Chapter of the stop being visited ("Earth to Fire"), or null. */
  chapter: TourChapter | null
}

export const useTour = create<TourState>(() => ({
  active: false,
  index: 0,
  phase: 'walking',
  paused: false,
  pauseReason: null,
  narration: false,
  progress: 0,
  chapter: null,
}))

export const narrationSupported = () => typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined'

/* ------------------------------------------------------------------ */
/* Internal run state                                                  */
/* ------------------------------------------------------------------ */

const run = {
  raf: 0,
  path: [] as P2[],
  seg: 0,
  target: null as WalkTarget | null,
  view: null as TourView | null,
  dwellMs: 0,
  elapsed: 0,
  last: 0,
  speaking: false,
  manualAt: 0,
  travelToken: 0,
  lastProgress: -1,
  /** The stop's `until` cue: listening (unsubscribe) and whether it has fired. */
  untilOff: null as (() => void) | null,
  untilHit: false,
  /** Waiting on a ride (up to a perch stop, or down before leaving one): unsubscribe. */
  rideOff: null as (() => void) | null,
}

const set = useTour.setState
const get = useTour.getState

/* ------------------------------------------------------------------ */
/* Manual-input detection                                              */
/* ------------------------------------------------------------------ */

const MOVE_KEYS = new Set(['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'])
let listening = false
function listen() {
  if (listening) return
  listening = true
  window.addEventListener('keydown', (e) => {
    const t = e.target as HTMLElement | null
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
    if (MOVE_KEYS.has(e.key.toLowerCase())) run.manualAt = performance.now()
  })
}

const manualInput = () => performance.now() - run.manualAt < 400 || Math.abs(visitor.joystick.x) + Math.abs(visitor.joystick.y) > 0.05

/* ------------------------------------------------------------------ */
/* Narration                                                           */
/* ------------------------------------------------------------------ */

let narrationEl: HTMLAudioElement | null = null

/** Best installed voice for a BCP-47 tag (exact region first, then language; local voices preferred). */
function pickVoice(tag: string): SpeechSynthesisVoice | null {
  try {
    const voices = window.speechSynthesis.getVoices()
    const lower = tag.toLowerCase()
    const base = lower.split('-')[0]
    const exact = voices.filter((v) => v.lang.toLowerCase().replace('_', '-') === lower)
    const lang = voices.filter((v) => v.lang.toLowerCase().startsWith(base))
    const pool = exact.length ? exact : lang
    return pool.find((v) => v.localService) ?? pool[0] ?? null
  } catch {
    return null
  }
}

function speakSynth(stop: TourStop, lang: Lang) {
  // Speak the caption in the visitor's language when a translation exists, else English.
  const useLang: Lang = hasTourTranslation(stop, lang) ? lang : 'en'
  const title = tourField(stop, 'title', useLang)
  const text = tourField(stop, 'text', useLang)
  const tag = bcp47(useLang)
  const u = new SpeechSynthesisUtterance(`${title}. ${text}`)
  u.rate = TOUR.narrationRate
  u.lang = tag
  const voice = pickVoice(tag)
  if (voice) u.voice = voice
  u.onend = u.onerror = () => {
    run.speaking = false
  }
  run.speaking = true
  window.speechSynthesis.speak(u)
}

function speak(stop: TourStop) {
  stopSpeaking()
  if (!get().narration) return
  const lang = getLang()
  // Recorded audio-guide narration (per language) wins over speech synthesis.
  const url = stop.narrationAudio?.[lang]
  if (url) {
    try {
      const el = new Audio(url)
      narrationEl = el
      el.onended = () => {
        run.speaking = false
      }
      el.onerror = () => {
        if (narrationEl !== el) return
        narrationEl = null
        run.speaking = false
        if (narrationSupported()) speakSynth(stop, lang)
      }
      run.speaking = true
      void el.play().catch(() => el.onerror?.(new Event('error')))
      return
    } catch {
      /* fall through to synthesis */
    }
  }
  if (!narrationSupported()) return
  try {
    speakSynth(stop, lang)
  } catch {
    run.speaking = false
  }
}

function stopSpeaking() {
  run.speaking = false
  if (narrationEl) {
    try {
      narrationEl.onerror = null
      narrationEl.pause()
    } catch {
      /* ignore */
    }
    narrationEl = null
  }
  try {
    if (narrationSupported()) window.speechSynthesis.cancel()
  } catch {
    /* ignore */
  }
}

/* ------------------------------------------------------------------ */
/* Cues ("Earth to Fire")                                              */
/* ------------------------------------------------------------------ */

/** A stop that waits for a cue still gives the visitor this long to read its caption. */
const UNTIL_MIN_MS = 6000

const TIME_OF: Record<string, TimeOfDay> = { morning: 'morning', noon: 'midday', midday: 'midday', golden: 'golden', dusk: 'dusk', night: 'night' }

/** Setting off for a stop: a new chapter, and the score stem that leads the walk. */
function cueDeparture(stop: TourStop) {
  if (stop.chapter && stop.chapter !== get().chapter) {
    set({ chapter: stop.chapter })
    fireCue(`chapter:${stop.chapter}`, { source: 'tour', data: { stop: stop.id } })
  }
  if (stop.cue?.music) fireCue(`music:${stop.cue.music}`, { source: 'tour', data: { stop: stop.id, chapter: stop.chapter } })
}

/** Arriving: the stop's light, time of day and moments; start waiting for its `until` cue. */
function cueArrival(stop: TourStop) {
  clearUntil()
  const c = stop.cue
  if (!c) return
  const data = { stop: stop.id, chapter: stop.chapter }
  if (c.light) fireCue(`light:${c.light}`, { source: 'tour', data })
  if (c.time) {
    const tod = TIME_OF[c.time]
    if (tod && useMuseum.getState().timeOfDay !== tod) useMuseum.getState().setTimeOfDay(tod)
    fireCue(`time:${c.time}`, { source: 'tour', data })
  }
  for (const id of c.fx ?? []) fireCue(id, { source: 'tour', data })
  if (c.until) {
    run.untilHit = false
    run.untilOff = onCue(c.until, () => {
      run.untilHit = true
    })
  }
}

function clearUntil() {
  run.untilOff?.()
  run.untilOff = null
  run.untilHit = false
}

/* ------------------------------------------------------------------ */
/* Walking                                                             */
/* ------------------------------------------------------------------ */

function clearWalk() {
  if (run.target && visitor.walkTarget && sameTarget(visitor.walkTarget, run.target)) visitor.walkTarget = null
  run.target = null
  run.path = []
  run.seg = 0
}

const sameTarget = (a: WalkTarget, b: WalkTarget) => a === b || (a.x === b.x && a.z === b.z && a.onArrive === b.onArrive)

function aimSegment() {
  const p = run.path[run.seg]
  const view = run.view!
  const lastSeg = run.seg === run.path.length - 1
  let t: WalkTarget
  if (lastSeg) {
    t = { x: p.x, z: p.z, yaw: yawToRad(view.yawDeg), pitch: (view.pitchDeg ?? 0) * DEG, onArrive: arrive }
  } else {
    const dx = p.x - visitor.x
    const dz = p.z - visitor.z
    t = { x: p.x, z: p.z, yaw: Math.atan2(-dx, -dz), pitch: 1.5 * DEG, onArrive: advanceSegment }
  }
  run.target = t
  visitor.walkTarget = t
}

function advanceSegment() {
  if (!get().active || get().phase !== 'walking' || get().paused) return
  if (run.seg < run.path.length - 1) {
    run.seg++
    aimSegment()
  }
}

/** Fade out, place the visitor at the stop, fade in, then arrive. */
function jumpTo(view: TourView) {
  clearWalk()
  const token = ++run.travelToken
  let moved = false
  const move = () => {
    moved = true
    if (token !== run.travelToken) return
    teleport(view.x, view.z, view.yawDeg, view.pitchDeg ?? 0)
    window.setTimeout(() => {
      if (token === run.travelToken && get().active && get().phase === 'walking') arrive()
    }, 250)
  }
  travel(move)
  // travel() ignores calls while another fade runs: fall back to a direct move.
  window.setTimeout(() => {
    if (!moved && token === run.travelToken) move()
  }, 1400)
}

/** Stop waiting on a ride. */
function clearRide() {
  run.rideOff?.()
  run.rideOff = null
}

/**
 * Wait for a ride's cue (`perch:arrive` up, `perch:leave` down), then `next`; if the ride never
 * ends (a stalled tab), carry on anyway after the longest ride.
 */
function awaitRide(cue: 'perch:arrive' | 'perch:leave', next: () => void) {
  clearRide()
  const token = run.travelToken
  let done = false
  const go = () => {
    if (done) return
    done = true
    clearRide()
    if (token === run.travelToken && get().active) next()
  }
  const off = onCue(cue, go)
  const timer = window.setTimeout(() => {
    if (done || token !== run.travelToken) return
    // never stall: settle wherever the ride should have ended
    if (cue === 'perch:leave' && usePerch.getState().perch) leavePerch(true)
    go()
  }, (RIDE_MAX_SECONDS + 3) * 1000)
  run.rideOff = () => {
    off()
    window.clearTimeout(timer)
  }
}

/** Where the tour walks to for a stop: its view, or for a perch stop the perch's door. */
function groundView(stop: TourStop): TourView {
  if (!stop.perch) return stop.view
  const d = doorOf(stop.perch.id)
  // facing the door, back to where the ride will leave from
  return { x: d.stand[0], z: d.stand[1], yawDeg: (doorOutYaw(d) + 180) % 360, pitchDeg: 4 }
}

/** The next stop the tour can show from `i` on (perch stops only while the rides are offered). */
function showable(i: number): number {
  let k = i
  while (k < TOUR_STOPS.length && TOUR_STOPS[k].perch && !perchEnabled()) k++
  return k
}

function goStop(i: number) {
  i = showable(i)
  const stop = TOUR_STOPS[i]
  if (!stop) {
    if (i >= TOUR_STOPS.length && get().active) {
      set({ phase: 'done', progress: 1 })
      track('tour_complete', { meta: { stops: TOUR_STOPS.length } })
    }
    return
  }
  run.travelToken++
  stopSpeaking()
  clearWalk()
  clearRide()
  run.view = groundView(stop)
  run.elapsed = 0
  run.lastProgress = -1
  clearUntil()
  set({ index: i, phase: 'walking', paused: false, pauseReason: null, progress: 0 })

  // on a perch: ride back down to its door before setting off (or stay, for a stop on the same perch)
  const P = usePerch.getState()
  if (P.ride) leavePerch(true)
  else if (P.perch) {
    if (stop.perch?.id === P.perch.id) {
      leavePerch(false)
    } else {
      awaitRide('perch:leave', () => goStop(i))
      descend()
      return
    }
  }
  cueDeparture(stop)

  const from = { x: visitor.x, z: visitor.z }
  const target = run.view
  const path = planPath(from, target)
  // Reduced motion: never glide the camera between stops — soft fade-cut instead.
  if (!path || pathLength(from, path) > TOUR.teleportBeyond || useMuseum.getState().reducedMotion) {
    jumpTo(target)
    return
  }
  run.path = path
  run.seg = 0
  aimSegment()
}

function arrive() {
  const s = get()
  if (!s.active || s.phase !== 'walking') return
  const stop = TOUR_STOPS[s.index]
  // a perch stop: at its door now; ride to the stop's place, then arrive
  if (stop.perch && usePerch.getState().perch?.id !== stop.perch.id) {
    run.target = null
    run.path = []
    const perch = stop.perch
    awaitRide('perch:arrive', () => {
      run.view = { x: visitor.x, z: visitor.z, yawDeg: ((-visitor.yaw / RAD_PER_DEG) % 360 + 360) % 360, pitchDeg: visitor.pitch / RAD_PER_DEG }
      arrive()
    })
    rideTo(perch.id, perch.t)
    return
  }
  run.travelToken++
  run.target = null
  run.path = []
  run.dwellMs = (stop.dwellSec ?? TOUR.dwellSec) * 1000
  run.elapsed = 0
  set({ phase: 'viewing', progress: 0 })
  speak(stop)
  cueArrival(stop)
}

function finishStop() {
  const s = get()
  if (showable(s.index + 1) >= TOUR_STOPS.length) {
    set({ phase: 'done', progress: 1 })
    track('tour_complete', { meta: { stops: TOUR_STOPS.length } })
    return
  }
  goStop(s.index + 1)
}

function pauseFor(reason: 'user' | 'manual') {
  const s = get()
  if (!s.active || s.paused || s.phase === 'done') return
  run.travelToken++ // cancel pending fade-arrivals and ride waits
  clearRide()
  if (s.phase === 'walking') clearWalk()
  stopSpeaking()
  set({ paused: true, pauseReason: reason })
}

/* ------------------------------------------------------------------ */
/* Frame loop                                                          */
/* ------------------------------------------------------------------ */

function tick(now: number) {
  run.raf = requestAnimationFrame(tick)
  const dt = Math.min(100, now - (run.last || now))
  run.last = now
  const s = get()
  if (!s.active || s.paused || s.phase === 'done') return
  const st = useMuseum.getState()
  if (st.inspecting) {
    pauseFor('manual')
    return
  }

  if (s.phase === 'walking') {
    if (!run.target) return // fading
    const cur = visitor.walkTarget
    if (!cur || !sameTarget(cur, run.target)) {
      if (cur && cur.x === run.target.x && cur.z === run.target.z) {
        // Visitor looked around mid-walk (yaw override stripped): keep going.
        run.target = cur
      } else if (cur || manualInput()) {
        pauseFor('manual') // click-to-walk, keys or joystick
        return
      } else {
        // The controller gave up (blocked): never get stuck — fade to the stop instead.
        jumpTo(run.view!)
        return
      }
    }
    // Early hand-off to the next waypoint so the walk does not stop at every corner.
    if (run.seg < run.path.length - 1) {
      const p = run.path[run.seg]
      if (Math.hypot(p.x - visitor.x, p.z - visitor.z) < HANDOFF) advanceSegment()
    }
    return
  }

  // viewing
  const v = run.view!
  if (manualInput() || Math.hypot(visitor.x - v.x, visitor.z - v.z) > DRIFT + MUSEUM.visitor.collisionRadius) {
    pauseFor('manual')
    return
  }
  if (st.selection) return // reading the info panel: hold the stop
  if (run.speaking) {
    run.elapsed = Math.min(run.elapsed + dt, run.dwellMs * 0.9)
  } else {
    run.elapsed += dt
  }
  const progress = Math.min(1, run.elapsed / run.dwellMs)
  if (Math.abs(progress - run.lastProgress) > 0.01) {
    run.lastProgress = progress
    set({ progress })
  }
  // a stop waiting for a cue (the end of a film chapter) moves on once it has fired
  if (run.untilOff && run.untilHit && run.elapsed >= UNTIL_MIN_MS && !run.speaking) {
    finishStop()
    return
  }
  if (run.elapsed >= run.dwellMs) finishStop()
}

/* ------------------------------------------------------------------ */
/* Public controls                                                     */
/* ------------------------------------------------------------------ */

export const tour = {
  start(index = 0) {
    if (typeof window === 'undefined') return
    listen()
    const m = useMuseum.getState()
    m.select(null)
    m.setHelpOpen(false)
    m.setDrawer(null)
    if (!get().active) track('tour_start', { meta: { from: TOUR_STOPS[index]?.id ?? '' } })
    // the tour starts on the ground: off a perch first (at its door)
    if (usePerch.getState().perch || usePerch.getState().ride) leavePerch(true)
    set({ active: true, chapter: get().active ? get().chapter : null })
    cancelAnimationFrame(run.raf)
    run.last = 0
    run.raf = requestAnimationFrame(tick)
    goStop(Math.max(0, Math.min(TOUR_STOPS.length - 1, index)))
  },
  /** Idempotent: safe to call at any point (mid-walk, mid-fade, while narrating, twice). */
  exit() {
    run.travelToken++ // cancels pending fade-arrivals and the jumpTo fallback
    clearRide()
    cancelAnimationFrame(run.raf)
    run.raf = 0
    stopSpeaking()
    clearWalk()
    clearUntil()
    run.view = null
    run.elapsed = 0
    set({ active: false, paused: false, pauseReason: null, phase: 'walking', progress: 0, chapter: null })
  },
  pause() {
    pauseFor('user')
  },
  resume() {
    const s = get()
    if (!s.active) return
    if (s.phase === 'done') return
    const v = run.view
    const away = !v || Math.hypot(visitor.x - v.x, visitor.z - v.z) > DRIFT
    if (s.phase === 'walking' || away) {
      goStop(s.index) // re-plan from here
    } else {
      set({ paused: false, pauseReason: null })
      if (run.elapsed < run.dwellMs * 0.5) speak(TOUR_STOPS[s.index])
    }
  },
  toggle() {
    if (get().paused) tour.resume()
    else tour.pause()
  },
  next() {
    const s = get()
    if (!s.active) return
    if (showable(s.index + 1) < TOUR_STOPS.length) goStop(s.index + 1)
  },
  prev() {
    const s = get()
    if (!s.active) return
    // back past any stop the tour cannot show
    let k = s.index - 1
    while (k > 0 && TOUR_STOPS[k].perch && !perchEnabled()) k--
    goStop(Math.max(0, k))
  },
  restart() {
    tour.start(0)
  },
  setNarration(on: boolean) {
    set({ narration: on && narrationSupported() })
    if (!on) stopSpeaking()
    else {
      const s = get()
      if (s.active && s.phase === 'viewing' && !s.paused) speak(TOUR_STOPS[s.index])
    }
  },
}

// Automation / console handle (like window.__museum in App.tsx).
if (typeof window !== 'undefined') {
  ;(window as unknown as { __tour?: unknown }).__tour = { tour, useTour, stops: TOUR_STOPS }
}

// Changing language mid-stop re-reads the caption in the new language.
if (typeof window !== 'undefined') {
  useLangStore.subscribe((st, prev) => {
    if (st.lang === prev.lang) return
    const s = get()
    if (s.active && s.narration && s.phase === 'viewing' && !s.paused) speak(TOUR_STOPS[s.index])
  })
}
