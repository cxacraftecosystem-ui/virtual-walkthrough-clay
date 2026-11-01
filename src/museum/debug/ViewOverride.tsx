/**
 * Free camera for captures (GRAND §1.3 #9): `__museum.view(x, y, z, yawDeg, pitchDeg, fov?)`
 * holds the camera at any point (aerial and elevation views, the acceptance poses), with every
 * zone drawn; `__museum.unview()` hands the camera back to the visitor. Yaw is a compass heading
 * (0 = north / −z, 90 = east / +x), pitch is up-positive (deg).
 *
 * `?shots` (the screenshot harness) also hides what is not the building: the live-tour
 * invitation and toasts, the proximity pill and the atmosphere and update toasts.
 *
 * Mounted inside the Canvas after <VisitorController> (spectacle/Spectacle.tsx), so this frame
 * callback overrides the visitor's camera pose while a view is held.
 */
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect } from 'react'
import * as THREE from 'three'
import { MUSEUM } from '../config/museum'
import { setCullingOverride } from '../navigation/zoneCulling'
import { visitor } from '../state/visitor'

interface HeldView {
  x: number
  y: number
  z: number
  yawDeg: number
  pitchDeg: number
  fov?: number
}

let held: HeldView | null = null

/** The held view's plan position, or null while the visitor has the camera (the HUD names its zone). */
export function heldViewAt(): { x: number; z: number } | null {
  return held ? { x: held.x, z: held.z } : null
}

/** Hold the camera at a pose (every zone is drawn while it is held). */
export function holdView(v: HeldView | null) {
  held = v
  visitor.frozen = !!v
  setCullingOverride(!!v)
}

const DEG = Math.PI / 180
/** `?shots` hides every transient overlay: banners, prompts, toasts, the controls hint card and the passport's count badge. */
const SHOTS_CSS = '.live-invite,.live-toasts,.ui-prompt,.ui-atmos-toast,.ui-sw-toast,.ui-stamp-toast,.ui-hint,.ui-pass-btn__n{display:none!important}'

export function ViewOverride() {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
  useEffect(() => {
    const w = window as unknown as { __museum?: Record<string, unknown> }
    const m = w.__museum
    if (m) {
      m.view = (x: number, y: number, z: number, yawDeg: number, pitchDeg: number, fov?: number) => holdView({ x, y, z, yawDeg, pitchDeg, fov })
      m.unview = () => holdView(null)
    }
    let style: HTMLStyleElement | null = null
    if (new URLSearchParams(window.location.search).has('shots')) {
      style = document.createElement('style')
      style.dataset.museumShots = ''
      style.textContent = SHOTS_CSS
      document.head.appendChild(style)
    }
    return () => {
      style?.remove()
      if (held) holdView(null)
    }
  }, [])
  useFrame(() => {
    if (!held) return
    visitor.frozen = true
    camera.position.set(held.x, held.y, held.z)
    // compass yaw → Three's rotation about +y (0 = looking down −z)
    camera.rotation.set(held.pitchDeg * DEG, -held.yawDeg * DEG, 0, 'YXZ')
    const fov = held.fov ?? MUSEUM.visitor.fov
    if (camera.fov !== fov) {
      camera.fov = fov
      camera.updateProjectionMatrix()
    }
  })
  return null
}
