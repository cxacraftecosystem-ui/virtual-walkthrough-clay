/**
 * Time of day for the HUD (SPECTACLE F9): live sun or a held clock time, and the named moments.
 *
 * The lighting reads the store's `timeMode` / `dayHours` (lighting/atmosphere/dayCurve.ts turns
 * them into the sun). A visit starts as the curator chose (`atmosphere.defaultTime`, normally
 * Live); the visitor's change is remembered for the rest of the browser session only, so the
 * next visit starts with the real sun again.
 */
import { useEffect } from 'react'
import { kindProps } from '../spectacle/settings'
import { useMuseum, type TimeOfDay } from '../state/store'

export const TIME_OPTIONS: { value: TimeOfDay; label: string; note: string }[] = [
  { value: 'morning', label: 'Morning', note: 'Cool, low sun' },
  { value: 'midday', label: 'Midday', note: 'Bright, overhead' },
  { value: 'golden', label: 'Golden hour', note: 'Warm, raking light' },
  { value: 'dusk', label: 'Dusk', note: 'Deep blue hour' },
  { value: 'night', label: 'Night', note: 'Moonlit, lamps lit' },
]

export const timeLabel = (t: TimeOfDay) => TIME_OPTIONS.find((o) => o.value === t)?.label ?? t

const KEY = 'clay.time.v1'
const isTime = (v: unknown): v is TimeOfDay => TIME_OPTIONS.some((o) => o.value === v)

/** The curator's starting time ('live' or a named moment; the schema's 'noon' is the midday preset). */
export function defaultTime(): 'live' | TimeOfDay {
  const v = kindProps('atmosphere').defaultTime
  if (v === 'noon') return 'midday'
  return v === 'live' || isTime(v) ? v : 'live'
}

/** May the visitor change the time (the curator's `allowScrub`)? */
export const timeScrubAllowed = () => kindProps('atmosphere').allowScrub !== false

/** T shortcut: live → morning → midday → golden hour → dusk → night → live. */
export function cycleTimeOfDay() {
  if (!timeScrubAllowed()) return
  const s = useMuseum.getState()
  if (s.timeMode === 'live') return s.setTimeOfDay(TIME_OPTIONS[0].value)
  const i = TIME_OPTIONS.findIndex((o) => o.value === s.timeOfDay)
  if (i === TIME_OPTIONS.length - 1) s.setTimeMode('live')
  else s.setTimeOfDay(TIME_OPTIONS[(i + 1) % TIME_OPTIONS.length].value)
}

function applyStart() {
  const s = useMuseum.getState()
  try {
    const stored = JSON.parse(sessionStorage.getItem(KEY) ?? 'null') as { mode?: unknown; hours?: unknown } | null
    if (stored?.mode === 'live') return s.setTimeMode('live')
    if (stored?.mode === 'manual' && typeof stored.hours === 'number' && isFinite(stored.hours)) return s.setDayHours(stored.hours)
  } catch {
    /* storage unavailable: start as the curator chose */
  }
  const d = defaultTime()
  if (d === 'live') s.setTimeMode('live')
  else s.setTimeOfDay(d)
}

/** Start the visit at the curator's time (or this session's last choice) and remember changes. */
export function useTimeOfDayPersistence() {
  useEffect(() => {
    applyStart()
    return useMuseum.subscribe((s, prev) => {
      if (s.timeMode === prev.timeMode && s.dayHours === prev.dayHours) return
      try {
        sessionStorage.setItem(KEY, JSON.stringify(s.timeMode === 'live' ? { mode: 'live' } : { mode: 'manual', hours: s.dayHours }))
      } catch {
        /* ignore */
      }
    })
  }, [])
}
