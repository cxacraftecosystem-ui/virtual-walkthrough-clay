/**
 * Accent-light pool.
 *
 * Every track fixture registers a light REQUEST; a fixed pool of real SpotLights is
 * assigned each moment to the requests that matter most to the visitor (near, in
 * line of sight), with short cross-fades. A fixed light count keeps shaders small and
 * stable (no recompiles), which is what makes the museum fast to load and render on
 * integrated GPUs, while every artwork in view stays lit.
 */
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { Vec3 } from '../config/museum'
import { ignoreLow, segmentBlocked } from '../navigation/collision'
import { visitor } from '../state/visitor'
import { requestShadowRefresh } from './SkyAndSun'

export interface SpotRequest {
  position: Vec3
  target: Vec3
  intensity: number
  angle: number
  penumbra: number
  color: string
  /** Neutral white (e.g. the partner logos): exempt from the zone colour choreography. */
  neutral?: boolean
  /** Free-form owner tag, so a feature can find and adjust its own requests. */
  tag?: string
}

export const spotRequests = new Map<string, SpotRequest>()

/**
 * Intensity modifiers (the moments): each returns a gain for a request (1 = unchanged), e.g. the
 * Turn raising the podium lights in sequence. Applied on top of `intensity` every frame.
 */
export const spotModifiers = new Set<(req: SpotRequest) => number>()

/** Colour choreography (lighting/atmosphere/choreography.ts): a tint and how much of it reaches the spots. */
export const spotTint = { color: new THREE.Color(1, 1, 1), amount: 0 }
let nextId = 0
export function registerSpot(req: SpotRequest) {
  const id = `spot-${nextId++}`
  spotRequests.set(id, req)
  return () => {
    spotRequests.delete(id)
  }
}

interface Slot {
  light: THREE.SpotLight
  target: THREE.Object3D
  id: string | null
  weight: number
}

const FADE_PER_S = 3.5
const tinted = new THREE.Color()

/** What each slot lights now: its target and its weight (0 … 1), read by the AccentField. */
export const poolLit: { x: number; y: number; z: number; w: number; e: number }[] = []

/** Shadow-casting slots per tier (GRAND §10). */
export const SPOT_SHADOWS = { low: 0, medium: 2, high: 4, ultra: 6 } as const

/**
 * Spot shadow maps a fragment shader can afford: every shadowed spot takes a texture unit in every
 * lit program, beside a scanned material's own maps (up to 9 on a physical one), the environment,
 * the festival lamps' map and the sun's shadow. On a 16-unit GPU that leaves 4.
 */
export const spotShadowBudget = (maxTextureUnits: number) => Math.max(0, maxTextureUnits - 12)
const SPOT_SHADOW_PX = 1024

function score(req: SpotRequest) {
  const [tx, , tz] = req.target
  const dx = tx - visitor.x
  const dz = tz - visitor.z
  const d = Math.hypot(dx, dz)
  // Probe point slightly off the lit surface, toward the fixture.
  const px = tx + (req.position[0] - tx) * 0.25
  const pz = tz + (req.position[2] - tz) * 0.25
  // low colliders (podiums, the plinth, benches, tables) never hide a light's target
  const blocked = segmentBlocked(visitor.x, visitor.z, px, pz, ignoreLow)
  const fx = -Math.sin(visitor.yaw)
  const fz = -Math.cos(visitor.yaw)
  // thresholds at the grand plan's scale (×2.04 the pavilion's)
  const behind = d > 3.1 && (dx * fx + dz * fz) / d < -0.2
  return d + (blocked ? 82 : 0) + (behind ? 12 : 0)
}

export function SpotPool({ size, shadows = 0 }: { size: number; shadows?: number }) {
  const slots = useMemo<Slot[]>(
    () =>
      Array.from({ length: size }, (_, i) => {
        const light = new THREE.SpotLight('#ffffff', 0, 0, 0.5, 0.8, 2)
        const target = new THREE.Object3D()
        light.target = target
        // fixed per tier: the light count and the programs never change during a visit
        light.castShadow = i < shadows
        if (light.castShadow) {
          light.shadow.mapSize.set(SPOT_SHADOW_PX, SPOT_SHADOW_PX)
          light.shadow.bias = -0.0006
          light.shadow.normalBias = 0.02
          light.shadow.camera.near = 0.2
          light.shadow.camera.far = 40
        }
        return { light, target, id: null, weight: 0 }
      }),
    [size, shadows],
  )
  const timer = useRef(1)
  const desired = useRef<Set<string>>(new Set())

  useFrame((_, dt) => {
    timer.current += dt
    if (timer.current > 0.2) {
      timer.current = 0
      // Switched-off requests (e.g. courtyard lanterns by day) never take a slot.
      const ranked = [...spotRequests.entries()]
        .filter(([, r]) => r.intensity > 0)
        .map(([id, r]) => [id, score(r)] as const)
        .sort((a, b) => a[1] - b[1])
      desired.current = new Set(ranked.slice(0, size).map(([id]) => id))
    }
    const want = desired.current
    const assigned = new Set(slots.map((s) => s.id).filter((x): x is string => x !== null && want.has(x)))
    const pending = [...want].filter((id) => !assigned.has(id))
    for (const s of slots) {
      const req = s.id ? spotRequests.get(s.id) : undefined
      const keep = s.id !== null && want.has(s.id) && req !== undefined
      if (keep) s.weight = Math.min(1, s.weight + dt * FADE_PER_S)
      else s.weight = Math.max(0, s.weight - dt * FADE_PER_S)
      if (s.weight === 0 && !keep) {
        // Slot is free: take the next pending request (fade in from 0).
        s.id = pending.shift() ?? null
        // a shadowed slot that moves redraws its (frozen, on-demand) shadow map
        if (s.id && s.light.castShadow) requestShadowRefresh(2)
      }
      const r = s.id ? spotRequests.get(s.id) : undefined
      const lit = poolLit[slots.indexOf(s)] ?? (poolLit[slots.indexOf(s)] = { x: 0, y: -99, z: 0, w: 0, e: 0 })
      if (r) {
        lit.x = r.target[0]
        lit.y = r.target[1]
        lit.z = r.target[2]
        lit.w = s.weight
        s.light.position.set(r.position[0], r.position[1], r.position[2])
        s.target.position.set(r.target[0], r.target[1], r.target[2])
        s.target.updateMatrixWorld()
        s.light.angle = r.angle
        s.light.penumbra = r.penumbra
        s.light.color.set(r.color)
        if (!r.neutral && spotTint.amount > 0) s.light.color.lerp(tinted.copy(s.light.color).multiply(spotTint.color), spotTint.amount)
        let gain = 1
        for (const m of spotModifiers) gain *= m(r)
        s.light.intensity = r.intensity * s.weight * gain
        // illuminance on the target at full weight (candela / d²), so an accent can tell a real pool from a glimmer
        const [px, py, pz] = r.position
        lit.e = (r.intensity * gain) / Math.max(0.05, (px - lit.x) ** 2 + (py - lit.y) ** 2 + (pz - lit.z) ** 2)
      } else {
        s.light.intensity = 0
        lit.w = 0
      }
    }
    poolLit.length = slots.length
  })

  return (
    <group>
      {slots.map((s, i) => (
        <group key={i}>
          <primitive object={s.light} />
          <primitive object={s.target} />
        </group>
      ))}
    </group>
  )
}
