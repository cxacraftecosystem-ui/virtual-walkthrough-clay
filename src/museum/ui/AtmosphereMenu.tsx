/**
 * HUD slot: light and weather (SPECTACLE F9, F15, F28) — the live sun or a held time on the day
 * dial, the named moments, the monsoon and the festival of lamps, in one popover.
 *
 * It takes the place of the HUD's older time menu (hidden by atmosphere.css): T still cycles the
 * moments (ui/timeOfDay.ts). The curator decides what may change: `atmosphere {allowScrub}` for
 * the time, `{weather}` ('clear' hides the monsoon), and the festival's 'auto' Diwali window.
 */
import { useEffect, useRef, useState } from 'react'
import { useT } from '../i18n'
import type { DictKey } from '../i18n/en'
import { festivalActive } from '../lighting/diyas/diyaState'
import { kindProps } from '../spectacle/settings'
import { useMuseum } from '../state/store'
import { useAtmosText } from './atmosphereText'
import { DayDial } from './DayDial'
import { TIME_OPTIONS, timeScrubAllowed } from './timeOfDay'
import './atmosphere.css'

function IconSky({ kind }: { kind: 'sun' | 'moon' | 'rain' }) {
  if (kind === 'rain')
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
        <path d="M7 15.5a4 4 0 0 1 .6-7.95A5.5 5.5 0 0 1 18 9.5a3 3 0 0 1-.5 6H7z" />
        <path d="M9 18.5l-1 2M13 18.5l-1 2M17 18.5l-1 2" />
      </svg>
    )
  if (kind === 'moon')
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M19.5 14.5A7.5 7.5 0 0 1 9.5 4.5a7.5 7.5 0 1 0 10 10z" />
      </svg>
    )
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
    </svg>
  )
}

/** Close on an outside press or Esc (the HUD's popover behaviour). */
function usePopover() {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        setOpen(false)
      }
    }
    window.addEventListener('pointerdown', onDown, true)
    window.addEventListener('keydown', onKey, true)
    return () => {
      window.removeEventListener('pointerdown', onDown, true)
      window.removeEventListener('keydown', onKey, true)
    }
  }, [open])
  return { open, setOpen, rootRef }
}

export function AtmosphereMenu() {
  const t = useT()
  const tx = useAtmosText()
  const { open, setOpen, rootRef } = usePopover()
  const mode = useMuseum((s) => s.timeMode)
  const time = useMuseum((s) => s.timeOfDay)
  const weather = useMuseum((s) => s.weather)
  const festival = useMuseum((s) => s.festival)
  const st = useMuseum.getState()
  const scrub = timeScrubAllowed()
  const weatherAllowed = kindProps('atmosphere').weather !== 'clear'
  const festOn = festival === 'on' || (festival === 'auto' && festivalActive())
  const icon = weather === 'monsoon' ? 'rain' : time === 'night' || time === 'dusk' ? 'moon' : 'sun'
  const timeName = mode === 'live' ? t('spectacle.live') : t(`time.${time}` as DictKey)
  // the open popover rises above the banners that sit over the HUD (atmosphere.css)
  useEffect(() => {
    if (!open) return
    document.body.classList.add('ui-atmos-open')
    return () => document.body.classList.remove('ui-atmos-open')
  }, [open])

  return (
    <div className="ui-quality ui-atmos" ref={rootRef}>
      <button
        type="button"
        className="ui-icon-btn"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`${tx('title')}: ${timeName}${weather === 'monsoon' ? `, ${t('spectacle.monsoon')}` : ''}`}
        data-tip={open ? undefined : `${timeName} · T`}
        onClick={() => setOpen((v) => !v)}
      >
        <IconSky kind={icon} />
        {mode === 'live' && <span className="ui-atmos__live" aria-hidden="true" />}
      </button>
      {open && (
        <div className="ui-quality__menu ui-panel ui-atmos__panel" role="dialog" aria-label={tx('title')}>
          <div className="ui-atmos__head">
            <span className="ui-kicker">{t('spectacle.dayDial')}</span>
            <button
              type="button"
              className="ui-atmos__chip ui-atmos__chip--live"
              aria-pressed={mode === 'live'}
              disabled={!scrub}
              onClick={() => st.setTimeMode('live')}
            >
              <span className="ui-atmos__dot" aria-hidden="true" />
              {t('spectacle.live')}
            </button>
          </div>
          <DayDial disabled={!scrub} label={t('spectacle.dayDial')} />
          <div className="ui-atmos__chips" role="group" aria-label={t('time.title')}>
            {TIME_OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                className="ui-atmos__chip"
                aria-pressed={mode === 'manual' && time === o.value}
                disabled={!scrub}
                onClick={() => st.setTimeOfDay(o.value)}
              >
                {t(`time.${o.value}` as DictKey)}
              </button>
            ))}
          </div>
          {weatherAllowed && (
            <div className="ui-atmos__row">
              <span className="ui-kicker">{tx('weather')}</span>
              <div className="ui-atmos__seg" role="radiogroup" aria-label={tx('weather')}>
                {(['clear', 'monsoon'] as const).map((w) => (
                  <button key={w} type="button" role="radio" aria-checked={weather === w} className="ui-atmos__segbtn" onClick={() => st.setWeather(w)}>
                    {t(w === 'clear' ? 'spectacle.clear' : 'spectacle.monsoon')}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="ui-atmos__row">
            <span className="ui-kicker">{tx('lamps')}</span>
            <button type="button" role="switch" aria-checked={festOn} className="ui-atmos__switch" onClick={() => st.setFestival(festOn ? 'off' : 'on')}>
              <span>{t('spectacle.festival')}</span>
              <small>{tx('lampsNote')}</small>
              <span className="ui-atmos__knob" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
