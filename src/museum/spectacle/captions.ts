/**
 * SOUND CAPTIONS — every sound and music change in the pavilion names itself here, so the
 * caption strip (WP5) can show it to visitors who cannot hear it ("[clay bells ring]").
 *
 *   caption('caption.bells')            show for the default time
 *   caption('caption.kiln', 6000)       …for 6 s; calling again refreshes it, never stacks it
 *
 * Keys are i18n dictionary keys (i18n/en.ts `caption.*`), translated by the strip. The visitor
 * turns captions on in Help (`setCaptionsOn`); the choice is remembered on this device.
 */
import { create } from 'zustand'
import type { DictKey } from '../i18n/en'

export interface ActiveCaption {
  key: DictKey
  /** performance.now() when it should disappear. */
  until: number
}

interface CaptionState {
  on: boolean
  active: ActiveCaption[]
}

const STORE_KEY = 'clay.captions.v1'
const DEFAULT_MS = 4000

function initialOn(): boolean {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem(STORE_KEY) === '1'
  } catch {
    return false
  }
}

export const useCaptions = create<CaptionState>(() => ({ on: initialOn(), active: [] }))

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now())
let timer: ReturnType<typeof setTimeout> | null = null

function prune() {
  timer = null
  const t = now()
  const active = useCaptions.getState().active.filter((c) => c.until > t)
  useCaptions.setState({ active })
  if (active.length) schedule(Math.min(...active.map((c) => c.until)) - t)
}

function schedule(ms: number) {
  if (timer) clearTimeout(timer)
  timer = setTimeout(prune, Math.max(16, ms))
}

/** Show a sound caption (always recorded, shown only while captions are on). */
export function caption(key: DictKey, durationMs = DEFAULT_MS) {
  const until = now() + durationMs
  const rest = useCaptions.getState().active.filter((c) => c.key !== key)
  const active = [...rest, { key, until }]
  useCaptions.setState({ active })
  schedule(Math.min(...active.map((c) => c.until)) - now())
}

export function setCaptionsOn(on: boolean) {
  useCaptions.setState({ on })
  try {
    localStorage.setItem(STORE_KEY, on ? '1' : '0')
  } catch {
    // storage blocked: the choice lasts for this visit
  }
}
