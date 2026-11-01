/**
 * "THE WHEEL TURNS" — the arrival flight after "Enter Exhibition" (SPECTACLE F1).
 *
 * The film opens high above the oculus, a bright eye in a terracotta bowl, then sweeps round
 * in plan over the four crescent roofs of the north wing and the pit firing's smoke, and lands
 * on the front view of the drawings: the annex door, from the visitor's start pose.
 *
 *  • The court is never shown: zone culling stays on the visitor's real position (the
 *    forecourt) the whole way, so `inner` is culled and F's reveal is kept for the walk in.
 *  • Forms: Full 13 s on Medium and up; Lite 8 s on Low (and touch); Still, for reduced
 *    motion, three held views (the eye, the crescents, the front) cross-faded through a dip,
 *    no camera move. The curator's `spectacle` object may shorten it (`arrival: 'short'`) or
 *    switch it off (`'off'`).
 *  • Only on the first entry of a browser session (sessionStorage), never with ?autostart,
 *    ?tour or ?noarrival, and not when the guided tour is starting. `__arrival.start()` plays
 *    it on demand (captures).
 *  • Skippable: any key, click/tap, wheel, or the "Skip" button (ArrivalOverlay).
 *  • Camera only: the visitor is frozen at the start pose during the flight, so the hand-over
 *    is seamless. Cue `arrival:eye` fires as the view passes over the oculus.
 *
 * Mount right AFTER <VisitorController> so this frame callback overrides its camera pose.
 */
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { create } from 'zustand'
import { MUSEUM } from '../config/museum'
import { fireCue } from '../spectacle/cues'
import { kindProps, spectacleSettings } from '../spectacle/settings'
import { useMuseum } from '../state/store'
import { visitor } from '../state/visitor'
import { useTour } from '../tour/engine'
import { setCullingOverride } from './zoneCulling'

/** Full flight (s); Lite / `arrival: 'short'`; the Still form's three held views. */
export const ARRIVAL_SECONDS = 13
export const ARRIVAL_SHORT_SECONDS = 8
export const ARRIVAL_STILL_SECONDS = 6.6
const SESSION_KEY = 'museum.arrival'
/** Progress at which the view passes over the oculus. */
const EYE_AT = 0.45

export interface ArrivalState {
  /** Flight running. */
  active: boolean
  /** 0..1 progress (UI: letterbox + title timing). */
  t: number
  /** Skip requested — the overlay dips to black, then the flight ends. */
  skipping: boolean
  /** Still form (reduced motion): held views cross-faded through a dip. */
  still: boolean
  /** The Still form's dip between views. */
  dip: boolean
}

export const useArrival = create<ArrivalState>(() => ({ active: false, t: 0, skipping: false, still: false, dip: false }))

const SKIP_DIP_MS = 320

export function skipArrival() {
  const s = useArrival.getState()
  if (!s.active || s.skipping) return
  useArrival.setState({ skipping: true })
  window.setTimeout(() => endArrival(), SKIP_DIP_MS)
}

function endArrival() {
  setCullingOverride(false)
  if (!useArrival.getState().active) return
  visitor.frozen = false
  useArrival.setState({ active: false, skipping: false, t: 1, dip: false })
}

let suppressed = false
/** Skip the arrival flight for the next entry (e.g. the visitor chose the guided tour). */
export function suppressArrival() {
  suppressed = true
}

/** The curator's choice on the `spectacle` object: 'full' | 'short' | 'off'. */
const arrivalSetting = () => String(kindProps('spectacle').arrival ?? 'full')

function shouldFly() {
  if (typeof window === 'undefined') return false
  if (suppressed) {
    suppressed = false
    return false
  }
  const q = new URLSearchParams(window.location.search)
  if (q.has('autostart') || q.has('tour') || q.has('noarrival')) return false
  if (arrivalSetting() === 'off') return false
  try {
    if (sessionStorage.getItem(SESSION_KEY)) return false
    sessionStorage.setItem(SESSION_KEY, '1')
  } catch {
    /* storage blocked: fly once per page load */
  }
  return true
}

/** Length of this flight (s) for the device and the curator's setting. */
function flightSeconds(still: boolean) {
  if (still) return ARRIVAL_STILL_SECONDS
  const coarse = typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse)').matches
  const lite = spectacleSettings().mode === 'lite' || coarse
  return lite || arrivalSetting() === 'short' ? ARRIVAL_SHORT_SECONDS : ARRIVAL_SECONDS
}

function begin() {
  const still = spectacleSettings().mode === 'still'
  visitor.frozen = true
  setCullingOverride(false)
  useArrival.setState({ active: true, t: 0, skipping: false, still, dip: still })
}

const V = MUSEUM.visitor
const EYE = V.eyeHeight
/** The flight's scale: the plinth's radius and the dome's top (GRAND §1.3 #5). */
const SITE_R = MUSEUM.landscape.r
const DOME_TOP = MUSEUM.dome.collarTop
const S = V.start
const DEG = Math.PI / 180

/** The Still form's held views (progress along the flight) and the dip between them (fraction of a view). */
const STILL_VIEWS = [0.04, EYE_AT + 0.1, 0.8]
const STILL_DIP = 0.16

export function ArrivalFlight() {
  const camera = useThree((s) => s.camera)

  const path = useMemo(() => {
    // Final look target lies along the visitor's start view direction (yaw 0 = north, pitch up).
    const fx = -Math.sin(-S.yawDeg * DEG)
    const fz = -Math.cos(-S.yawDeg * DEG)
    const end = new THREE.Vector3(S.x, EYE, S.z)
    const endLook = end.clone().add(new THREE.Vector3(fx * 10, Math.tan(S.pitchDeg * DEG) * 10, fz * 10))
    // SPECTACLE F1 at the grand scale: high over the dome's oculus from the north, round over the
    // crescent roofs (west), past the Sphere Well (south-west), down onto the axis behind the
    // spawn and in to the front view of the drum, the annex and the dome.
    const pos = new THREE.CatmullRomCurve3(
      [
        new THREE.Vector3(-0.355 * SITE_R, 4.28 * DOME_TOP, -2.22 * SITE_R),
        new THREE.Vector3(-1.83 * SITE_R, 2.16 * DOME_TOP, -0.3 * SITE_R),
        new THREE.Vector3(-1.33 * SITE_R, 1.17 * DOME_TOP, 1.36 * SITE_R),
        new THREE.Vector3(0, 0.405 * DOME_TOP, 2.07 * SITE_R),
        end,
      ],
      false,
      'centripetal',
    )
    // eyes on the dome, then down the axis to the portal
    const look = new THREE.CatmullRomCurve3(
      [
        new THREE.Vector3(0, 0.45 * DOME_TOP, 0),
        new THREE.Vector3(0, 0.45 * DOME_TOP, 0),
        new THREE.Vector3(0, 0.36 * DOME_TOP, 0.3 * SITE_R),
        new THREE.Vector3(0, 0.27 * DOME_TOP, 0.6 * SITE_R),
        endLook,
      ],
      false,
      'centripetal',
    )
    return { pos, look }
  }, [])

  // Start on entry.
  useEffect(() => {
    const start = () => {
      if (!shouldFly()) return
      begin()
    }
    if (useMuseum.getState().phase === 'entered') return
    return useMuseum.subscribe((s, p) => {
      if (s.phase === 'entered' && p.phase !== 'entered') start()
    })
  }, [])

  // Skip on any input; the tour or a tier change (canvas remount) also ends it.
  useEffect(
    () =>
      useArrival.subscribe((s, p) => {
        if (!s.active || p.active) return
        const onInput = (e: Event) => {
          if (e instanceof KeyboardEvent && (e.ctrlKey || e.metaKey || e.altKey)) return
          // the skipping key must not also trigger its normal shortcut (photo mode, panels, …)
          if (e instanceof KeyboardEvent) {
            e.preventDefault()
            e.stopPropagation()
          }
          skipArrival()
        }
        const opts = { capture: true } as const
        window.addEventListener('keydown', onInput, opts)
        window.addEventListener('pointerdown', onInput, opts)
        window.addEventListener('wheel', onInput, opts)
        const unsub = useArrival.subscribe((a) => {
          if (a.active) return
          window.removeEventListener('keydown', onInput, opts)
          window.removeEventListener('pointerdown', onInput, opts)
          window.removeEventListener('wheel', onInput, opts)
          unsub()
        })
      }),
    [],
  )
  useEffect(() => () => endArrival(), [])

  const tmpP = useMemo(() => new THREE.Vector3(), [])
  const tmpL = useMemo(() => new THREE.Vector3(), [])
  const clock = useMemo(() => ({ t: 0, eye: false, secs: ARRIVAL_SECONDS }), [])

  useFrame((_, rawDt) => {
    const a = useArrival.getState()
    if (!a.active) {
      clock.t = 0
      clock.eye = false
      return
    }
    if (useTour.getState().active) {
      endArrival()
      return
    }
    visitor.frozen = true
    if (clock.t === 0) clock.secs = flightSeconds(a.still)
    clock.t += Math.min(rawDt, 0.05)
    const t = Math.min(1, clock.t / clock.secs)
    let u: number
    let dip = false
    if (a.still) {
      // three held views; the overlay dips to black across each change
      const n = STILL_VIEWS.length
      const i = Math.min(n - 1, Math.floor(t * n))
      const f = t * n - i
      u = STILL_VIEWS[i]
      // dark before each change (the overlay fades in 300 ms) and lifting just after it
      dip = f > 1 - STILL_DIP || f < STILL_DIP * 0.5
    } else {
      // Ease in/out (smootherstep) along the key frames.
      u = t * t * t * (t * (t * 6 - 15) + 10)
    }
    path.pos.getPoint(u, tmpP)
    path.look.getPoint(u, tmpL)
    camera.position.copy(tmpP)
    camera.lookAt(tmpL)
    if (!clock.eye && u >= EYE_AT - 0.02 && (!a.still || u >= EYE_AT)) {
      clock.eye = true
      fireCue('arrival:eye', { source: 'system', data: { still: a.still } })
    }
    if (Math.abs(t - a.t) > 0.01 || t >= 1 || dip !== a.dip) useArrival.setState({ t, dip })
    if (t >= 1) {
      // Hand over exactly at the start pose (VisitorController takes the camera next frame).
      endArrival()
    }
  })

  return null
}

// Automation / console handle: play the flight now (captures), whatever the session has seen.
if (typeof window !== 'undefined') {
  ;(window as unknown as { __arrival?: unknown }).__arrival = {
    start: () => {
      if (useMuseum.getState().phase === 'entered' && !useArrival.getState().active) begin()
    },
    useArrival,
  }
}
