import { useEffect, useRef, useState } from 'react'
import { useProgress } from '@react-three/drei'
import { useMuseum } from '../state/store'
import { EXHIBITION_TITLE } from '../config/infographics'
import { ExhibitionPicker } from './ExhibitionPicker'
import { requestAmbientStart } from './audio'
import { tour } from '../tour/engine'
import { suppressArrival } from '../navigation/ArrivalFlight'
import { useLang, useLoc, useT } from '../i18n'
import type { DictKey } from '../i18n/en'
import { LanguageSwitch } from './LanguageMenu'
import { useFocusTrap } from '../a11y/focus'
import { TrailEntryLink } from '../trail/TrailUI'
import './entry.css'

/** Delay before the tour starts walking, so the entry fade has cleared. */
const TOUR_DELAY_MS = 1300

const SAFETY_TIMEOUT_MS = 40000
/** If no loader ever reports (fully procedural scene), declare ready after this. */
const IDLE_GRACE_MS = 1600
const LEAVE_MS = 1150
/** Tips rotate while loading. */
const TIP_MS = 5200
/** Friendly "still working" lines after this long. */
const SLOW_MS = 9000
const SLOWER_MS = 22000
/** Share of the bar given to asset downloads; the rest is shader compilation ("Preparing light"). */
const ASSET_SHARE = 82

const isCoarse = () => typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse)').matches

const TIPS_DESKTOP: DictKey[] = ['entry.tip1', 'entry.tip3', 'entry.tip2', 'entry.tip4', 'entry.tip5', 'entry.tip6']
const TIPS_TOUCH: DictKey[] = ['entry.tip1Touch', 'entry.tip3', 'entry.tip2Touch', 'entry.tip4', 'entry.tip5Touch', 'entry.tip6Touch']

type Step = 0 | 1 | 2
const STEPS: DictKey[] = ['entry.stepTextiles', 'entry.stepLight', 'entry.stepReady']

/** A pot rises on a turning wheel head, its throwing lines running round (pure SVG + CSS). */
function ThrowMotif() {
  // A round-bellied pot, base on the wheel head at y = 80 (outline, then the shoulder and rim).
  const pot = 'M88 80c-7-6-11-15-11-24 0-11 7-20 15-25 3-2 4-4 3-6h30c-1 2 0 4 3 6 8 5 15 14 15 25 0 9-4 18-11 24z'
  return (
    <svg className="ui-throw" viewBox="0 0 220 100" aria-hidden="true" focusable="false">
      <defs>
        <clipPath id="ui-throw-clip">
          <path d={pot} />
        </clipPath>
      </defs>
      <ellipse className="ui-throw__shadow" cx="110" cy="92" rx="70" ry="6" />
      <path className="ui-throw__stand" d="M96 84h28l4 8H92z" />
      <ellipse className="ui-throw__head" cx="110" cy="82" rx="54" ry="7" />
      <ellipse className="ui-throw__spin" cx="110" cy="82" rx="44" ry="5" pathLength="100" />
      <g className="ui-throw__pot">
        <path className="ui-throw__clay" d={pot} />
        <g clipPath="url(#ui-throw-clip)">
          {[34, 46, 58, 70].map((y) => (
            <path key={y} className="ui-throw__line" d={`M60 ${y}h100`} pathLength="100" />
          ))}
        </g>
        <path className="ui-throw__rim" d="M95 25h30" />
      </g>
    </svg>
  )
}

export function EntryScreen() {
  const phase = useMuseum((s) => s.phase)
  const setPhase = useMuseum((s) => s.setPhase)
  const compiled = useMuseum((s) => s.sceneCompiled)
  const still = useMuseum((s) => s.reducedMotion)
  const { progress, loaded, total } = useProgress()
  const [gone, setGone] = useState(phase === 'entered')
  const [shown, setShown] = useState(0)
  const [assetsDone, setAssetsDone] = useState(false)
  const [tipIndex, setTipIndex] = useState(0)
  const [slow, setSlow] = useState(0)
  const mountedAt = useRef(performance.now())
  const enterRef = useRef<HTMLButtonElement>(null)
  const t = useT()
  const L = useLoc()
  const lang = useLang()
  const rootRef = useRef<HTMLDivElement>(null)
  // Modal while shown: Tab stays within the entry screen.
  useFocusTrap(rootRef, phase !== 'entered' && !gone, { autoFocus: false, restore: false })
  const autostart = useRef(
    typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('autostart'),
  )

  // Loading → ready.
  useEffect(() => {
    if (phase !== 'loading') return
    const check = () => {
      const s = useProgress.getState()
      const elapsed = performance.now() - mountedAt.current
      const done = !s.active && (s.progress >= 100 || (s.total === 0 && elapsed > IDLE_GRACE_MS))
      setAssetsDone(done)
      // Also wait for the scene's shaders to finish compiling (see Precompile in MuseumScene).
      const finished = done && useMuseum.getState().sceneCompiled
      if (finished || elapsed > SAFETY_TIMEOUT_MS) {
        if (useMuseum.getState().phase === 'loading') setPhase('ready')
      }
      setSlow(elapsed > SLOWER_MS ? 2 : elapsed > SLOW_MS ? 1 : 0)
    }
    check()
    const id = window.setInterval(check, 250)
    return () => window.clearInterval(id)
  }, [phase, setPhase])

  // Rotating tips while loading.
  useEffect(() => {
    if (phase !== 'loading') return
    const id = window.setInterval(() => setTipIndex((i) => i + 1), TIP_MS)
    return () => window.clearInterval(id)
  }, [phase])

  // Progress figure: downloads fill the first ASSET_SHARE %, then shader compilation creeps
  // toward the end (it reports no progress of its own), and "ready" completes the bar.
  const targetRef = useRef({ phase, progress, total, assetsDone, compiled })
  useEffect(() => {
    targetRef.current = { phase, progress, total, assetsDone, compiled }
  }, [phase, progress, total, assetsDone, compiled])
  useEffect(() => {
    if (phase === 'entered') return
    // ~15 Hz is plenty for a hairline bar (the CSS transition smooths it) and keeps React
    // out of the way while the GPU compiles shaders.
    let last = performance.now()
    const id = window.setInterval(() => {
      const now = performance.now()
      const dt = Math.min(0.25, (now - last) / 1000)
      last = now
      const s = targetRef.current
      setShown((v) => {
        let target: number
        if (s.phase !== 'loading') target = 100
        else if (!s.assetsDone) target = s.total === 0 ? Math.min(40, v + dt * 6) : (s.progress / 100) * ASSET_SHARE
        else target = Math.min(97, Math.max(ASSET_SHARE, v) + dt * 2.2)
        const next = v + (target - v) * Math.min(1, dt * 6)
        return Math.abs(target - next) < 0.1 ? target : next
      })
    }, 66)
    return () => window.clearInterval(id)
  }, [phase])

  const enter = (withTour = false) => {
    if (useMuseum.getState().phase === 'entered') return
    // the tour takes over the camera: skip the arrival flight rather than cut it after 1.3 s
    if (withTour) suppressArrival()
    setPhase('entered')
    if (useMuseum.getState().soundOn) requestAmbientStart()
    if (withTour) window.setTimeout(() => tour.start(0), TOUR_DELAY_MS)
  }

  // Autostart / focus when ready.
  useEffect(() => {
    if (phase !== 'ready') return
    if (autostart.current) {
      enter(new URLSearchParams(window.location.search).has('tour'))
      return
    }
    enterRef.current?.focus({ preventScroll: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  // Unmount after the fade-out.
  useEffect(() => {
    if (phase !== 'entered' || gone) return
    const h = window.setTimeout(() => setGone(true), LEAVE_MS)
    return () => window.clearTimeout(h)
  }, [phase, gone])

  if (gone) return null

  const leaving = phase === 'entered'
  const ready = phase !== 'loading'
  const pct = Math.round(shown)
  const coarse = isCoarse()
  const step: Step = ready ? 2 : assetsDone ? 1 : 0
  const label = ready
    ? t('entry.phaseReady')
    : assetsDone
      ? t('entry.phaseLight')
      : total === 0
        ? t('entry.phaseOpening')
        : t('entry.phaseTextiles')
  const tips = coarse ? TIPS_TOUCH : TIPS_DESKTOP
  const tipKey = tips[tipIndex % tips.length]

  return (
    <div
      ref={rootRef}
      className={`ui-entry${leaving ? ' is-leaving' : ''}${ready ? ' is-ready' : ''}${still ? ' is-still' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="ui-entry-title"
      aria-hidden={leaving || undefined}
    >
      <div className="ui-entry__motif" aria-hidden="true">
        <svg preserveAspectRatio="xMidYMid slice">
          <defs>
            <pattern id="ui-entry-pattern" width="72" height="72" patternUnits="userSpaceOnUse">
              <g fill="none" stroke="currentColor" strokeWidth="1">
                <circle cx="36" cy="36" r="6" />
                <circle cx="36" cy="36" r="13" />
                <circle cx="36" cy="36" r="20" strokeDasharray="2 4" />
                <circle cx="0" cy="0" r="3" />
                <circle cx="72" cy="0" r="3" />
                <circle cx="0" cy="72" r="3" />
                <circle cx="72" cy="72" r="3" />
              </g>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#ui-entry-pattern)" />
        </svg>
      </div>

      <header className="ui-entry__brand" aria-label={t('entry.presentedBy')}>
        {/* Plain <img>: tiny static brand marks from /public (next/image adds nothing here). */}
        <img
          className="ui-entry__logo ui-entry__logo--dc"
          src="/brand/dc-handicrafts.png"
          width={642}
          height={240}
          alt={t('entry.logoDc')}
          decoding="async"
          draggable={false}
        />
        <img
          className="ui-entry__logo ui-entry__logo--iit"
          src="/brand/iit-kharagpur.svg"
          width={268}
          height={300}
          alt={t('entry.logoIit')}
          decoding="async"
          draggable={false}
        />
      </header>

      <div className="ui-entry__inner">
        <ThrowMotif />
        <div className="ui-kicker">{L(EXHIBITION_TITLE, 'kicker')}</div>
        <h1 id="ui-entry-title" className="ui-entry__title">
          {L(EXHIBITION_TITLE, 'title')}
        </h1>
        <p className="ui-entry__subtitle">{t('entry.subtitle')}</p>

        <div className="ui-entry__rule" />

        <div className="ui-entry__status">
          {/* Screen readers hear each stage once — not every percentage tick. */}
          <p className="ui-sr-live" aria-live="polite" aria-atomic="true">
            {label}
          </p>
          <div className="ui-entry__stage">
            {!ready ? (
              <div className="ui-entry__loading">
                <div
                  className="ui-progress"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={pct}
                  aria-valuetext={`${label} ${pct}%`}
                  aria-label={t('entry.loading')}
                >
                  <div className="ui-progress__meta" aria-hidden="true">
                    <span className="ui-progress__label">{label}</span>
                    <span className="ui-progress__pct">{total > 0 && !assetsDone ? `${loaded} / ${total}` : `${pct}%`}</span>
                  </div>
                  <div className="ui-progress__track">
                    <div className="ui-progress__bar" style={{ transform: `scaleX(${Math.max(0.02, shown / 100)})` }} />
                  </div>
                  <ol className="ui-progress__steps" aria-hidden="true">
                    {STEPS.map((k, i) => (
                      <li key={k} className={i < step ? 'is-done' : i === step ? 'is-current' : undefined}>
                        {t(k)}
                      </li>
                    ))}
                  </ol>
                </div>
                <p className="ui-entry__tip">
                  <span className="ui-entry__tip-label">{t('entry.tipLabel')}</span>
                  <span key={tipKey} className="ui-entry__tip-text">
                    {t(tipKey)}
                  </span>
                </p>
                {slow > 0 && <p className="ui-entry__wait">{t(slow > 1 ? 'entry.slower' : 'entry.slow')}</p>}
              </div>
            ) : (
              <div className="ui-entry__actions">
                <button ref={enterRef} type="button" className="ui-btn ui-entry__enter" onClick={() => enter()} disabled={leaving}>
                  {t('entry.enter')}
                </button>
                <button type="button" className="ui-btn ui-btn--ghost ui-entry__tour" onClick={() => enter(true)} disabled={leaving}>
                  {t('entry.tour')}
                </button>
                <TrailEntryLink onStart={() => enter()} disabled={leaving} />
              </div>
            )}
          </div>
          <p className="ui-entry__note">{coarse ? t('entry.noteTouch') : t('entry.noteDesktop')}</p>
          <p className="ui-entry__hint">{coarse ? t('entry.hintTouch') : t('entry.hintDesktop')}</p>
          <a className="ui-entry__guide" href={`/guide${lang === 'en' ? '' : `?lang=${lang}`}`}>
            {t('entry.guide')}
          </a>
          <ExhibitionPicker disabled={leaving} />
        </div>
      </div>

      <LanguageSwitch className="ui-entry__lang" />
      <div className="ui-entry__footer">{L(EXHIBITION_TITLE, 'subtitle')}</div>
    </div>
  )
}
