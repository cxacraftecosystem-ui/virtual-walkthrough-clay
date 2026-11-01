import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useMuseum } from '../state/store'
import { IconClose } from './icons'
import { useTour } from '../tour/engine'
import { useT, type T } from '../i18n'
import { useFocusTrap } from '../a11y/focus'
import { A11ySettings } from '../a11y/A11ySettings'
import { TrailStartCard } from '../trail/TrailUI'
import { useXT, type XKey } from '../spectacle/experienceText'
import { MOMENTS, replayFirstVisits, replayMoment, seenMoments } from '../spectacle/moments'

const HINT_MS = 7000

const K = ({ children }: { children: ReactNode }) => <kbd className="ui-kbd">{children}</kbd>
const G = ({ children }: { children: ReactNode }) => <span className="ui-help__gesture">{children}</span>

function desktopRows(t: T): [string, ReactNode][] {
  return [
    [t('help.look'), <G key="g">{t('help.drag')}</G>],
    [
      t('help.walk'),
      <>
        <K>W</K>
        <K>A</K>
        <K>S</K>
        <K>D</K>
        <K>↑</K>
        <K>↓</K>
      </>,
    ],
    [
      t('help.turn'),
      <>
        <K>←</K>
        <K>→</K>
      </>,
    ],
    [t('help.brisk'), <K key="k">Shift</K>],
    [t('help.walkTo'), <G key="g">{t('help.clickFloor')}</G>],
    [t('help.details'), <G key="g">{t('help.clickArtwork')}</G>],
    [t('help.nearby'), <K key="k">E</K>],
    [t('help.mouseLook'), <K key="k">L</K>],
    [
      t('help.mapHelp'),
      <>
        <K>M</K>
        <K>H</K>
      </>,
    ],
    [
      t('help.tourKeys'),
      <>
        <K>Space</K>
        <K>]</K>
      </>,
    ],
    [
      t('help.tabUi'),
      <>
        <K>Tab</K>
        <K>Shift</K>
      </>,
    ],
    [t('help.closeKey'), <K key="k">Esc</K>],
  ]
}

function touchRows(t: T): [string, ReactNode][] {
  return [
    [t('help.look'), <G key="g">{t('help.dragFinger')}</G>],
    [t('help.walk'), <G key="g">{t('help.joystick')}</G>],
    [t('help.walkTo'), <G key="g">{t('help.tapFloor')}</G>],
    [t('help.details'), <G key="g">{t('help.tapArtwork')}</G>],
    [t('help.travel'), <G key="g">{t('help.tapRoom')}</G>],
    [t('help.guidedTour'), <G key="g">{t('help.routeButton')}</G>],
  ]
}

export const isCoarsePointer = () =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse)').matches

function List({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <ul className="ui-help__list">
      {rows.map(([label, keys]) => (
        <li key={label}>
          <span>{label}</span>
          <span className="ui-help__keys">{keys}</span>
        </li>
      ))}
    </ul>
  )
}

const MOMENTS_CSS = `
.ui-moments { margin-top: 18px; padding-top: 14px; border-top: 1px solid var(--hairline); }
.ui-moments__intro { margin: 6px 0 10px; font-size: 12.5px; color: var(--muted); }
.ui-moments__list { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 4px 14px; }
.ui-moments__item { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 5px 0; border-bottom: 1px solid var(--hairline); font-size: 12.5px; }
.ui-moments__name { display: inline-flex; align-items: center; gap: 7px; }
.ui-moments__dot { width: 6px; height: 6px; border-radius: 50%; background: var(--hairline-strong); flex: none; }
.ui-moments__dot.is-seen { background: var(--accent); }
.ui-moments__play { appearance: none; border: 1px solid var(--hairline-strong); background: transparent; color: var(--ink); border-radius: 999px;
  padding: 4px 10px; font: 500 11px/1 var(--font-ui); cursor: pointer; white-space: nowrap; }
.ui-moments__play:hover, .ui-moments__play:focus-visible { border-color: var(--ink); background: rgba(43,38,33,.05); }
.ui-moments__reset { appearance: none; border: 0; background: none; padding: 0; margin-top: 10px; font: 500 11.5px/1.2 var(--font-ui);
  color: var(--accent); text-decoration: underline; text-underline-offset: 2px; cursor: pointer; }
`

/** Help → Moments: see a moment again (SPECTACLE F30/F33); a dot marks the ones already seen. */
function MomentsPanel() {
  const t = useT()
  const x = useXT()
  const [seen] = useState(seenMoments)
  const [reset, setReset] = useState(false)
  return (
    <section className="ui-moments" aria-labelledby="ui-moments-title">
      <style>{MOMENTS_CSS}</style>
      <h3 id="ui-moments-title" className="ui-kicker">
        {t('spectacle.moments')}
      </h3>
      <p className="ui-moments__intro">{x('xp.momentsIntro')}</p>
      <ul className="ui-moments__list">
        {MOMENTS.map((m) => {
          const name = x(`xp.moment.${m.id}` as XKey)
          return (
            <li key={m.id} className="ui-moments__item">
              <span className="ui-moments__name">
                <span className={`ui-moments__dot${seen.has(String(m.id)) ? ' is-seen' : ''}`} aria-hidden="true" />
                {name}
              </span>
              <button type="button" className="ui-moments__play" aria-label={`${t('spectacle.replay')}: ${name}`} onClick={() => replayMoment(String(m.id))}>
                {t('spectacle.replay')}
              </button>
            </li>
          )
        })}
      </ul>
      <button
        type="button"
        className="ui-moments__reset"
        onClick={() => {
          replayFirstVisits()
          setReset(true)
        }}
        aria-live="polite"
      >
        {reset ? x('xp.momentsResetDone') : x('xp.momentsReset')}
      </button>
    </section>
  )
}

/** Full controls reference (H / ? button) plus the short hint strip after entering. */
export function HelpOverlay() {
  const helpOpen = useMuseum((s) => s.helpOpen)
  const setHelpOpen = useMuseum((s) => s.setHelpOpen)
  const entered = useMuseum((s) => s.phase === 'entered')
  const hintBlocked = useMuseum((s) => !!s.nearby || !!s.selection || !!s.inspecting || !!s.drawer)
  const touring = useTour((s) => s.active)
  const coarse = isCoarsePointer()
  const closeRef = useRef<HTMLButtonElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const t = useT()

  useEffect(() => {
    if (helpOpen) closeRef.current?.focus({ preventScroll: true })
  }, [helpOpen])
  useFocusTrap(cardRef, helpOpen && entered, { onEscape: () => setHelpOpen(false) })

  return (
    <>
      <HintStrip entered={entered} coarse={coarse} suppressed={helpOpen || hintBlocked || touring} />
      {helpOpen && entered && (
        <div
          className="ui-help"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ui-help-title"
          onPointerDown={(e) => {
            if (e.target === e.currentTarget) setHelpOpen(false)
          }}
        >
          <div className="ui-help__card ui-panel" ref={cardRef}>
            <button ref={closeRef} type="button" className="ui-icon-btn ui-help__close" aria-label={t('help.close')} onClick={() => setHelpOpen(false)}>
              <IconClose />
            </button>
            <div className="ui-kicker">{t('help.kicker')}</div>
            <h2 id="ui-help-title" className="ui-help__title">
              {t('help.title')}
            </h2>
            <div className="ui-help__cols">
              <section className={`ui-help__col${coarse ? ' ui-help__col--secondary' : ''}`} style={{ order: coarse ? 2 : 1 }}>
                <h3 className="ui-kicker">{t('help.desktop')}</h3>
                <List rows={desktopRows(t)} />
              </section>
              <section className={`ui-help__col${coarse ? '' : ' ui-help__col--secondary'}`} style={{ order: coarse ? 1 : 2 }}>
                <h3 className="ui-kicker">{t('help.touch')}</h3>
                <List rows={touchRows(t)} />
              </section>
            </div>
            <p className="ui-help__foot">{t('help.foot')}</p>
            <p className="ui-help__foot">{t('help.perches')}</p>
            <p className="ui-help__foot">
              <a href="/credits">{t('help.credits')} →</a>
            </p>
            <TrailStartCard />
            <MomentsPanel />
            <A11ySettings />
          </div>
        </div>
      )}
    </>
  )
}

function HintStrip({ entered, coarse, suppressed }: { entered: boolean; coarse: boolean; suppressed: boolean }) {
  const t = useT()
  // 'wait' → 'on' (1.3 s after entering) → 'done'. The display countdown only runs while the
  // strip is actually visible, so entering straight into the guided tour (or next to an item)
  // postpones the hint until the visitor takes over instead of silently losing it.
  const [stage, setStage] = useState<'wait' | 'on' | 'done'>('wait')

  useEffect(() => {
    if (!entered) return
    const a = window.setTimeout(() => setStage((v) => (v === 'wait' ? 'on' : v)), 1300)
    return () => window.clearTimeout(a)
  }, [entered])

  useEffect(() => {
    if (stage !== 'on' || suppressed) return
    const b = window.setTimeout(() => setStage('done'), HINT_MS)
    return () => window.clearTimeout(b)
  }, [stage, suppressed])

  const shown = entered && stage === 'on' && !suppressed
  const setVisible = (v: boolean) => setStage(v ? 'on' : 'done')

  // [label, text, is a key]
  const items: [string, string, boolean][] = coarse
    ? [
        [t('hint.drag'), t('hint.toLook'), false],
        [t('hint.joystick'), t('hint.toWalk'), false],
        [t('hint.tap'), t('hint.anArtwork'), false],
      ]
    : [
        [t('hint.drag'), t('hint.toLook'), false],
        ['W A S D', t('hint.toWalk'), true],
        [t('hint.click'), t('hint.anArtwork'), false],
        ['H', t('hint.forHelp'), true],
      ]

  return (
    <div className={`ui-hint ui-panel${shown ? ' is-visible' : ''}`} role="status" aria-hidden={!shown || undefined}>
      <div className="ui-hint__items">
        {items.map(([k, v, isKey]) => (
          <span key={k}>
            {!isKey ? <strong style={{ fontWeight: 600 }}>{k}</strong> : <K>{k}</K>}
            {v}
          </span>
        ))}
      </div>
      <button type="button" className="ui-icon-btn" aria-label={t('hint.dismiss')} tabIndex={shown ? 0 : -1} onClick={() => setVisible(false)}>
        <IconClose />
      </button>
    </div>
  )
}
