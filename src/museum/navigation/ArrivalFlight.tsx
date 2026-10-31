/**
 * CINEMATIC ARRIVAL — after "Enter Exhibition", a ~11 s drone-style flight: in high over the
 * landscape plinth, across the round roof and straight over the open oculus (looking down
 * into the court and its plinth), then a long turn over the annex roof and down to the
 * entrance front, settling on the forecourt in the visitor's start pose facing the door.
 *
 *  • Only on the first entry of a browser session (sessionStorage), never with ?autostart,
 *    never with prefers-reduced-motion, and not when the guided tour is starting.
 *  • Skippable: any key, click/tap, wheel, or the "Skip" button (ArrivalOverlay).
 *  • Camera only: the visitor is frozen at the start pose during the flight (zone culling,
 *    accent spots and shadows are already set up for the atrium), so the hand-over is seamless.
 *
 * Mount right AFTER <VisitorController> so this frame callback overrides its camera pose.
 */
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { create } from 'zustand'
import { KEY, MUSEUM } from '../config/museum'
import { useMuseum } from '../state/store'
import { visitor } from '../state/visitor'
import { useTour } from '../tour/engine'
import { setCullingOverride } from './zoneCulling'

export const ARRIVAL_SECONDS = 11
const SESSION_KEY = 'museum.arrival'

export interface ArrivalState {
  /** Flight running. */
  active: boolean
  /** 0..1 progress (UI: letterbox + title timing). */
  t: number
  /** Skip requested — the overlay dips to black, then the flight ends. */
  skipping: boolean
}

export const useArrival = create<ArrivalState>(() => ({ active: false, t: 0, skipping: false }))

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
  useArrival.setState({ active: false, skipping: false, t: 1 })
}

let suppressed = false
/** Skip the arrival flight for the next entry (e.g. the visitor chose the guided tour). */
export function suppressArrival() {
  suppressed = true
}

function shouldFly() {
  if (typeof window === 'undefined') return false
  if (suppressed) {
    suppressed = false
    return false
  }
  const q = new URLSearchParams(window.location.search)
  if (q.has('autostart') || q.has('tour') || q.has('noarrival')) return false
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return false
  const st = useMuseum.getState()
  if (st.reducedMotion) return false
  // Low tier / touch devices: drawing every room at once risks stalls and context loss.
  if (st.tier === 'low' || window.matchMedia?.('(pointer: coarse)').matches) return false
  try {
    if (sessionStorage.getItem(SESSION_KEY)) return false
    sessionStorage.setItem(SESSION_KEY, '1')
  } catch {
    /* storage blocked: fly once per page load */
  }
  return true
}

const V = MUSEUM.visitor
const EYE = V.eyeHeight
const S = V.start
const DEG = Math.PI / 180

export function ArrivalFlight() {
  const camera = useThree((s) => s.camera)

  const path = useMemo(() => {
    // Final look target lies along the visitor's start view direction (yaw 0 = north, pitch up).
    const fx = -Math.sin(-S.yawDeg * DEG)
    const fz = -Math.cos(-S.yawDeg * DEG)
    const end = new THREE.Vector3(S.x, EYE, S.z)
    const endLook = end.clone().add(new THREE.Vector3(fx * 10, Math.tan(S.pitchDeg * DEG) * 10, fz * 10))
    const door = new THREE.Vector3(0, MUSEUM.annex.door.height * 0.6, KEY.annexOuterZ)
    const top = MUSEUM.pavilion.height
    const pos = new THREE.CatmullRomCurve3(
      [
        new THREE.Vector3(-36, top + 26, -32), // high over the landscape, north-west
        new THREE.Vector3(-15, top + 18, -12),
        new THREE.Vector3(-1.2, top + 11, -0.8), // over the open oculus, looking down into the court
        new THREE.Vector3(11, top + 9, 9), // a long turn out over the annex roof
        new THREE.Vector3(8, top + 3, door.z + 12),
        new THREE.Vector3(1.5, 2.8, door.z + 8), // down in front of the entrance
        end,
      ],
      false,
      'centripetal',
    )
    const look = new THREE.CatmullRomCurve3(
      [
        new THREE.Vector3(0, 2, 0),
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0.1, 0, 0.15), // straight down through the oculus onto the plinth
        new THREE.Vector3(0, 3, KEY.annexEndZ - 4),
        new THREE.Vector3(0, door.y, door.z - 2),
        new THREE.Vector3(0, door.y, door.z - 3),
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
      visitor.frozen = true
      useArrival.setState({ active: true, t: 0, skipping: false })
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
  const clock = useMemo(() => ({ t: 0 }), [])

  useFrame((_, rawDt) => {
    const a = useArrival.getState()
    if (!a.active) {
      clock.t = 0
      return
    }
    if (useTour.getState().active) {
      endArrival()
      return
    }
    visitor.frozen = true
    clock.t += Math.min(rawDt, 0.05)
    const t = Math.min(1, clock.t / ARRIVAL_SECONDS)
    // Ease in/out (smootherstep) along the key frames.
    const u = t * t * t * (t * (t * 6 - 15) + 10)
    path.pos.getPoint(u, tmpP)
    path.look.getPoint(u, tmpL)
    camera.position.copy(tmpP)
    camera.lookAt(tmpL)
    // Above the roof every room can be seen (the court through the oculus); once down at the
    // facade, normal zone culling resumes.
    setCullingOverride(u < 0.6)
    if (Math.abs(t - a.t) > 0.01 || t >= 1) useArrival.setState({ t })
    if (t >= 1) {
      // Hand over exactly at the start pose (VisitorController takes the camera next frame).
      endArrival()
    }
  })

  return null
}
