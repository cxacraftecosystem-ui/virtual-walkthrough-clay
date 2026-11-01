/**
 * WEATHER STATE — clear sky or monsoon (SPECTACLE F15).
 *
 * `weather` is the choice (the menu, a docent cue, the curator's 'auto' chance at dusk);
 * `rain` (0 … 1) is what the rest of the pavilion reads, eased in over ~6 s and out over ~8 s:
 * the water ring's ripples (WP3), the wet floors (§3 `uWet`), the closing sky, the shaft fading.
 * `flash` (0 … 1) is the one gentle brightening a storm allows: at most once per 20 s, 1.5 s
 * long, never a strobe (SPECTACLE §7.13). The monsoon passes by itself after `monsoonSec`.
 *
 * Written every frame by lighting/weather/Monsoon.tsx (`stepWeather`), read without
 * subscriptions in render loops (`rainNow`, `weatherNow`).
 */
import { create } from 'zustand'

export type Weather = 'clear' | 'monsoon'

export interface WeatherState {
  weather: Weather
  /** Rain intensity now, 0 … 1 (eases in and out round the weather change). */
  rain: number
  setWeather: (w: Weather) => void
}

export const useWeather = create<WeatherState>((set) => ({
  weather: 'clear',
  rain: 0,
  setWeather: (weather) => {
    set({ weather })
    weatherNow.since = 0
  },
}))

/** Per-frame values (no React): eased rain, wetness that lingers after it, the storm brightening. */
export const weatherNow = {
  rain: 0,
  /** Surfaces dry more slowly than the rain stops. */
  wet: 0,
  /** Sky closed by cloud (leads the rain a little). */
  overcast: 0,
  /** Brightening envelope 0 … 1. */
  flash: 0,
  /** Seconds since the current weather was chosen. */
  since: 0,
  /** Seconds until the next brightening may start. */
  nextFlash: 8,
  flashT: -1,
}

/** Rain intensity for render loops (no subscription). */
export const rainNow = () => weatherNow.rain

const RAIN_IN_PER_S = 1 / 6
const RAIN_OUT_PER_S = 1 / 8
const DRY_PER_S = 1 / 40
const FLASH_SEC = 1.5
const FLASH_GAP_SEC = 20

/**
 * Advance the weather by `dt` seconds. `still` (reduced motion) skips the brightening; the
 * monsoon returns to clear after `monsoonSec`. Returns true when the rain value changed.
 */
export function stepWeather(dt: number, monsoonSec: number, still: boolean): boolean {
  const st = useWeather.getState()
  const w = weatherNow
  w.since += dt
  if (st.weather === 'monsoon' && monsoonSec > 0 && w.since > monsoonSec) st.setWeather('clear')
  const target = useWeather.getState().weather === 'monsoon' ? 1 : 0
  const prev = w.rain
  // the sky closes first, the rain follows; on clearing the rain stops first
  w.overcast += Math.sign(target - w.overcast) * Math.min(Math.abs(target - w.overcast), dt / 4)
  const lead = target > 0 ? Math.max(0, w.overcast - 0.35) / 0.65 : target
  const k = target > w.rain ? RAIN_IN_PER_S : RAIN_OUT_PER_S
  w.rain += Math.sign(lead - w.rain) * Math.min(Math.abs(lead - w.rain), dt * k)
  w.wet = Math.max(w.rain, w.wet - dt * DRY_PER_S)
  // one soft brightening at a time, only in full rain
  if (w.flashT >= 0) {
    w.flashT += dt
    const t = w.flashT / FLASH_SEC
    w.flash = t >= 1 ? 0 : t < 0.15 ? t / 0.15 : Math.pow(1 - (t - 0.15) / 0.85, 2)
    if (t >= 1) w.flashT = -1
  } else {
    w.flash = 0
    w.nextFlash -= dt
    if (!still && w.rain > 0.85 && w.nextFlash <= 0) {
      w.flashT = 0
      w.nextFlash = FLASH_GAP_SEC + 10 * Math.random()
    }
  }
  // the store copy moves in 2 % steps (React readers re-render a few dozen times, not every frame)
  const stored = useWeather.getState().rain
  if (w.rain !== stored && (Math.abs(w.rain - stored) >= 0.02 || w.rain === 0 || w.rain === 1)) useWeather.setState({ rain: w.rain })
  return w.rain !== prev
}
