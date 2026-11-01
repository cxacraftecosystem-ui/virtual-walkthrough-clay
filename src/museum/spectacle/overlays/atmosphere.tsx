/**
 * HTML overlay of light and weather (SPECTACLE F9, F15). Owned by WP2; mounted by
 * spectacle/SpectacleOverlays.tsx inside its own error boundary.
 *
 *   - Live sun at night: once a visit, a quiet offer — "It's night in Kharagpur. See it by day?"
 *   - After a monsoon passes, if the curator has confirmed it (`atmosphere {petrichorCaption}`),
 *     one line about petrichor and mitti attar. Silent otherwise: it is a factual claim.
 */
import { useEffect, useState } from 'react'
import { useT } from '../../i18n'
import { bucketOf, istDay, istHoursNow } from '../../lighting/atmosphere/dayCurve'
import { useWeather } from '../../lighting/weather/weatherState'
import { useMuseum } from '../../state/store'
import { useAtmosText } from '../../ui/atmosphereText'
import { kindProps } from '../settings'
import '../../ui/atmosphere.css'

const TOAST_KEY = 'clay.nightToast.v1'
const TOAST_MS = 14000
const NOTE_MS = 11000

function NightToast() {
  const t = useT()
  const tx = useAtmosText()
  const phase = useMuseum((s) => s.phase)
  const mode = useMuseum((s) => s.timeMode)
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (phase !== 'entered' || mode !== 'live') return
    let seen = false
    try {
      seen = sessionStorage.getItem(TOAST_KEY) === '1'
    } catch {
      /* storage blocked: offer once per page */
    }
    if (seen) return
    const night = bucketOf(istDay(), istHoursNow()) === 'night'
    if (!night) return
    const show = window.setTimeout(() => {
      setShow(true)
      try {
        sessionStorage.setItem(TOAST_KEY, '1')
      } catch {
        /* ignore */
      }
    }, 2500)
    return () => window.clearTimeout(show)
  }, [phase, mode])

  useEffect(() => {
    if (!show) return
    const id = window.setTimeout(() => setShow(false), TOAST_MS)
    return () => window.clearTimeout(id)
  }, [show])
  // a change of time from anywhere answers the question
  useEffect(() => {
    if (show && mode !== 'live') setShow(false)
  }, [show, mode])

  if (!show) return null
  return (
    <div className="ui-atmos-toast ui-panel" role="status" aria-live="polite">
      <span>{t('spectacle.nightToast')}</span>
      <span className="ui-atmos-toast__actions">
        <button
          type="button"
          className="ui-btn"
          onClick={() => {
            useMuseum.getState().setTimeOfDay('midday')
            setShow(false)
          }}
        >
          {tx('byDay')}
        </button>
        <button type="button" className="ui-btn ui-btn--ghost" onClick={() => setShow(false)}>
          {tx('stayNight')}
        </button>
      </span>
    </div>
  )
}

function PetrichorNote() {
  const tx = useAtmosText()
  const allowed = kindProps('atmosphere').petrichorCaption === true
  const weather = useWeather((s) => s.weather)
  const rain = useWeather((s) => s.rain)
  const [rained, setRained] = useState(false)
  const [show, setShow] = useState(false)
  useEffect(() => {
    if (rain > 0.5) setRained(true)
  }, [rain])
  useEffect(() => {
    if (allowed && rained && weather === 'clear' && rain === 0) {
      setRained(false)
      setShow(true)
    }
  }, [allowed, rained, weather, rain])
  useEffect(() => {
    if (!show) return
    const id = window.setTimeout(() => setShow(false), NOTE_MS)
    return () => window.clearTimeout(id)
  }, [show])
  if (!show) return null
  return (
    <p className="ui-atmos-note ui-panel" role="status" aria-live="polite">
      {tx('petrichor')}
    </p>
  )
}

export function AtmosphereOverlay() {
  return (
    <>
      <NightToast />
      <PetrichorNote />
    </>
  )
}
