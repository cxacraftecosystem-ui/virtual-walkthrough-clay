/**
 * SPECTACLE SETTINGS — what each moment may do on this device, right now.
 *
 * `useSpectacle()` merges the tier's caps (config/quality.ts `spectacle`) with the curator's
 * `spectacle` singleton (an invisible scene object; props in models/propSchemas.ts) and the
 * visitor's preferences, and names the form every moment plays:
 *
 *   'full'   everything the tier allows
 *   'lite'   Low tier, or `spectacleOff` (AdaptiveQuality could not hold 30 fps on Low, or
 *            `?spectacle=off`): no shaft, motes, halos, mirror, smoke or grade — the sun mask,
 *            the diya map and all geometry stay
 *   'still'  reduced motion (the a11y setting, the OS preference, or `?reducedMotion`): no
 *            camera moves, spins, flicker or particles; every moment shows its final state
 *
 * `kindProps(kind)` gives a kind's props: schema defaults overlaid with the first scene object
 * of that kind (for singletons such as 'atmosphere' or 'theatre-house').
 */
import { create } from 'zustand'
import { QUALITY_PRESETS, type SpectacleCaps } from '../config/quality'
import { SCENE_OBJECTS } from '../config/objects'
import { kindDefaults, type PropValue } from '../models/propSchemas'
import { useMuseum } from '../state/store'

export type SpectacleMode = 'full' | 'lite' | 'still'

const query = () => (typeof window === 'undefined' ? new URLSearchParams() : new URLSearchParams(window.location.search))
const flagOn = (q: URLSearchParams, k: string) => q.has(k) && q.get(k) !== '0' && q.get(k) !== 'false'

/** Session-wide switches (not persisted). */
export const useSpectacleState = create<{ spectacleOff: boolean; forceStill: boolean }>(() => {
  const q = query()
  return { spectacleOff: q.get('spectacle') === 'off', forceStill: flagOn(q, 'reducedMotion') }
})

/** AdaptiveQuality turns the costly extras off when even Low cannot hold 30 fps (App.tsx). */
export function setSpectacleOff(off: boolean) {
  if (useSpectacleState.getState().spectacleOff !== off) useSpectacleState.setState({ spectacleOff: off })
}

/** Props of `kind`: its schema defaults, overlaid with the first scene object of that kind. */
export function kindProps(kind: string): Record<string, PropValue> {
  const o = SCENE_OBJECTS.find((x) => x.kind === kind)
  return { ...kindDefaults(kind), ...(o?.props ?? {}) }
}

export interface SpectacleSettings {
  mode: SpectacleMode
  caps: SpectacleCaps
  /** The `spectacle` singleton's props (arrival, turnReveal, music, ambience). */
  props: Record<string, PropValue>
  /** True when the costly extras are off (Lite). */
  off: boolean
  reducedMotion: boolean
}

/** Non-React snapshot (render loops, cue handlers). */
export function spectacleSettings(): SpectacleSettings {
  const { tier, reducedMotion } = useMuseum.getState()
  const { spectacleOff, forceStill } = useSpectacleState.getState()
  return build(tier, reducedMotion || forceStill, spectacleOff)
}

const SINGLETON = kindProps('spectacle')

function build(tier: keyof typeof QUALITY_PRESETS, still: boolean, off: boolean): SpectacleSettings {
  const caps = QUALITY_PRESETS[tier].spectacle
  const mode: SpectacleMode = still ? 'still' : tier === 'low' || off ? 'lite' : 'full'
  return { mode, caps, props: SINGLETON, off, reducedMotion: still }
}

export function useSpectacle(): SpectacleSettings {
  const tier = useMuseum((s) => s.tier)
  const reducedMotion = useMuseum((s) => s.reducedMotion)
  const spectacleOff = useSpectacleState((s) => s.spectacleOff)
  const forceStill = useSpectacleState((s) => s.forceStill)
  return build(tier, reducedMotion || forceStill, spectacleOff)
}
