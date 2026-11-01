/**
 * THE CLAY PASSPORT (SPECTACLE F31) — UI.
 *
 *   <PassportButton/>   HUD: the clay tablet, with how many stamps are in it
 *   <PassportLayer/>    the tablet itself (a dialog of thirteen roundels), the toast after each
 *                       press, and on completion a printable certificate with the visitor's own
 *                       pot from the clay studio (drawn here, nothing uploaded)
 *   <Roundel/>          one stamp: pressed into clay (relief lit from the top left) or still blank
 */
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { useFocusTrap } from '../a11y/focus'
import { useLang } from '../i18n'
import { useXT, xt, type XKey } from '../spectacle/experienceText'
import { useClayStudio } from '../studio/clayStore'
import { useMuseum } from '../state/store'
import { SITE } from '../../site'
import { STAMPS, STAMP_TOTAL, stampCount, stampDef, usePassport, type StampDef } from './passport'
import { motif } from './stampMotifs'

const CSS = `
.ui-pass-btn { position: relative; }
.ui-pass-btn__n { position: absolute; right: 2px; bottom: 3px; min-width: 15px; height: 15px; padding: 0 3px; border-radius: 8px;
  background: var(--accent); color: var(--accent-ink); font: 600 9px/15px var(--font-ui); text-align: center; pointer-events: none; }
.ui-pass { position: fixed; inset: 0; z-index: 45; display: grid; place-items: center; padding: 16px;
  background: rgba(20, 14, 10, .42); animation: ui-pass-in 260ms var(--ease) both; }
@keyframes ui-pass-in { from { opacity: 0 } to { opacity: 1 } }
.ui-pass__card { position: relative; width: min(640px, 100%); max-height: calc(100vh - 32px); overflow: auto; padding: 26px 26px 20px;
  border-radius: 14px; color: #2b1d14;
  background: radial-gradient(120% 90% at 30% 10%, #e8c9a6 0%, #d8ac83 46%, #c3916a 100%);
  box-shadow: inset 0 2px 0 rgba(255,240,220,.6), inset 0 -3px 0 rgba(90,45,20,.25), 0 30px 80px -30px rgba(0,0,0,.6); }
.ui-pass__card::before { content: ''; position: absolute; inset: 10px; border-radius: 9px; border: 1.5px solid rgba(110,58,30,.28);
  box-shadow: inset 0 1px 0 rgba(255,240,220,.45); pointer-events: none; }
.ui-pass__kicker { font: 500 10.5px/1.2 var(--font-ui); letter-spacing: .26em; text-transform: uppercase; color: rgba(70,35,15,.75); }
.ui-pass__title { font: 500 34px/1.05 var(--font-display); margin: 8px 0 6px; }
.ui-pass__intro { font: 400 13px/1.5 var(--font-ui); margin: 0 0 4px; color: rgba(43,29,20,.85); max-width: 46ch; }
.ui-pass__count { font: 600 12px/1 var(--font-ui); letter-spacing: .04em; color: #6d2f17; }
.ui-pass__grid { list-style: none; margin: 18px 0 8px; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(104px, 1fr)); gap: 14px 10px; }
.ui-pass__cell { display: grid; justify-items: center; gap: 6px; text-align: center; }
.ui-pass__name { font: 600 11.5px/1.25 var(--font-ui); }
.ui-pass__hint { font: 400 10.5px/1.3 var(--font-ui); color: rgba(43,29,20,.7); }
.ui-pass__foot { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; justify-content: space-between; margin-top: 12px; }
.ui-pass__done { font: 500 italic 18px/1.3 var(--font-display); }
.ui-pass__close { position: absolute; top: 12px; right: 12px; color: #2b1d14; }
.ui-pass .ui-btn { min-height: 38px; padding: 0 16px; }
.ui-pass .ui-btn--ghost { color: #2b1d14; border-color: rgba(70,35,15,.4); }
.ui-pass__link { appearance: none; border: 0; background: none; padding: 0; font: 500 11px/1 var(--font-ui); color: rgba(70,35,15,.75);
  text-decoration: underline; text-underline-offset: 2px; cursor: pointer; }
.ui-stamp-toast { position: fixed; left: 50%; bottom: calc(var(--edge) + var(--safe-b) + 64px); z-index: 44; transform: translate(-50%, 10px);
  display: flex; align-items: center; gap: 12px; padding: 8px 18px 8px 8px; border-radius: 999px; opacity: 0; pointer-events: none;
  transition: opacity 320ms var(--ease), transform 320ms var(--ease); font: 500 13px/1.3 var(--font-ui); color: var(--ink); }
.ui-stamp-toast.is-on { opacity: 1; transform: translate(-50%, 0); }
.ui-stamp-toast .ui-roundel { animation: ui-roundel-press 520ms cubic-bezier(.2,.9,.3,1.2) both; }
@keyframes ui-roundel-press { 0% { transform: scale(1.35) rotate(-8deg); opacity: 0 } 55% { transform: scale(.94) rotate(1deg); opacity: 1 } 100% { transform: none } }
.a11y-reduce-motion .ui-stamp-toast .ui-roundel, .a11y-reduce-motion .ui-pass { animation: none; }
.a11y-contrast .ui-pass__card { background: #f1e2cf; }
`

/* ------------------------------------------------------------------ */
/* Roundel                                                             */
/* ------------------------------------------------------------------ */

let roundelSeq = 0

/** One stamp: pressed into a fired-clay disc, or a blank disc with a ghost of what will be pressed there. */
export function Roundel({ def, pressed, size = 76, style }: { def: Pick<StampDef, 'motif'>; pressed: boolean; size?: number; style?: CSSProperties }) {
  const [uid] = useState(() => `rd${++roundelSeq}`)
  const m = motif(def.motif)
  const paths = (stroke: string, dx: number, dy: number, w: number) => (
    <g transform={`translate(${dx} ${dy})`} stroke={stroke} strokeWidth={w} fill="none" strokeLinecap="round" strokeLinejoin="round">
      {m.stroke.map((d, i) => (
        <path key={i} d={d} />
      ))}
      {(m.fill ?? []).map((d, i) => (
        <path key={`f${i}`} d={d} fill={stroke} />
      ))}
    </g>
  )
  return (
    <svg className="ui-roundel" width={size} height={size} viewBox="0 0 100 100" aria-hidden="true" focusable="false" style={style}>
      <defs>
        <radialGradient id={`${uid}-g`} cx="38%" cy="32%" r="75%">
          <stop offset="0" stopColor={pressed ? '#d39a72' : '#dcb593'} />
          <stop offset="1" stopColor={pressed ? '#9a5537' : '#b88763'} />
        </radialGradient>
      </defs>
      <circle cx="50" cy="50" r="48" fill={`url(#${uid}-g)`} />
      <circle cx="50" cy="50" r="47" fill="none" stroke="rgba(255,236,214,.5)" strokeWidth="1.2" />
      {pressed ? (
        <>
          {/* the pressed field, sunk a little: dark top-left lip, lit bottom-right */}
          <circle cx="50" cy="50" r="40" fill="#a35d3e" />
          <circle cx="49.2" cy="49.2" r="40" fill="none" stroke="rgba(60,24,10,.45)" strokeWidth="1.6" />
          <circle cx="50.8" cy="50.8" r="40" fill="none" stroke="rgba(255,226,196,.45)" strokeWidth="1.2" />
          <g transform="translate(50 50) scale(0.66) translate(-50 -50)">
            {paths('rgba(255,224,190,.55)', 1.1, 1.1, 6)}
            {paths('rgba(58,22,9,.75)', -0.8, -0.8, 6)}
            {paths('#7e3d24', 0, 0, 5)}
          </g>
        </>
      ) : (
        <>
          <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(90,45,20,.35)" strokeWidth="1.4" strokeDasharray="3 4" />
          <g transform="translate(50 50) scale(0.66) translate(-50 -50)" opacity="0.16">
            {paths('#5a2a14', 0, 0, 4)}
          </g>
        </>
      )}
    </svg>
  )
}

const stampName = (id: string) => xt(`xp.stamp.${id}` as XKey)

function hintKey(d: StampDef): XKey {
  if (d.how === 'pot') return 'xp.hint.pot'
  if (d.how === 'perch' || d.how === 'visit') return `xp.hint.${d.id}` as XKey
  if (d.id === 'theatre') return 'xp.hint.theatre'
  return 'xp.hint.post'
}

/* ------------------------------------------------------------------ */
/* HUD button                                                          */
/* ------------------------------------------------------------------ */

export function IconPassport() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <rect x="4.5" y="3.5" width="15" height="17" rx="2.5" />
      <circle cx="12" cy="11" r="3.6" />
      <path d="M12 9.2v3.6M10.2 11h3.6" />
      <path d="M8.5 17h7" />
    </svg>
  )
}

export function PassportButton() {
  const n = usePassport((s) => stampCount(s))
  const open = usePassport((s) => s.open)
  const setOpen = usePassport((s) => s.setOpen)
  const x = useXT()
  const label = `${x('xp.passportOpen')} — ${x('xp.passportCount', { n, total: STAMP_TOTAL })}`
  return (
    <button type="button" className="ui-icon-btn ui-pass-btn" aria-label={label} data-tip={label} aria-pressed={open} onClick={() => setOpen(!open)}>
      <style>{CSS}</style>
      <IconPassport />
      {n > 0 && <span className="ui-pass-btn__n">{n}</span>}
    </button>
  )
}

/* ------------------------------------------------------------------ */
/* The tablet                                                          */
/* ------------------------------------------------------------------ */

function PassportDialog() {
  const stamps = usePassport((s) => s.stamps)
  const completedAt = usePassport((s) => s.completedAt)
  const setOpen = usePassport((s) => s.setOpen)
  const reset = usePassport((s) => s.reset)
  const lang = useLang()
  const x = useXT()
  const card = useRef<HTMLDivElement>(null)
  const close = () => setOpen(false)
  useFocusTrap(card, true, { onEscape: close })
  const n = stampCount({ stamps })
  const fmt = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString(lang === 'en' ? 'en-IN' : lang === 'hi' ? 'hi-IN' : 'bn-IN', { day: 'numeric', month: 'short' })
    } catch {
      return ''
    }
  }
  return (
    <div className="ui-pass ui-interactive" role="dialog" aria-modal="true" aria-labelledby="ui-pass-title" onPointerDown={(e) => e.target === e.currentTarget && close()}>
      <div className="ui-pass__card" ref={card}>
        <button type="button" className="ui-icon-btn ui-pass__close" aria-label={x('xp.close')} onClick={close}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
        <div className="ui-pass__kicker">{SITE.shortName}</div>
        <h2 id="ui-pass-title" className="ui-pass__title">
          {x('xp.certTitle')}
        </h2>
        <p className="ui-pass__intro">{x('xp.passportIntro')}</p>
        <div className="ui-pass__count" aria-live="polite">
          {x('xp.passportCount', { n, total: STAMP_TOTAL })}
        </div>
        <ul className="ui-pass__grid">
          {STAMPS.map((d) => {
            const at = stamps[d.id]
            return (
              <li key={d.id} className="ui-pass__cell">
                <Roundel def={d} pressed={!!at} />
                <span className="ui-pass__name">{x(`xp.stamp.${d.id}` as XKey)}</span>
                <span className="ui-pass__hint">{at ? fmt(at) : x(hintKey(d))}</span>
              </li>
            )
          })}
        </ul>
        <div className="ui-pass__foot">
          {completedAt ? (
            <>
              <span className="ui-pass__done">{x('xp.complete')}</span>
              <button type="button" className="ui-btn" onClick={() => printCertificate()}>
                {x('xp.certificate')}
              </button>
            </>
          ) : (
            <span />
          )}
          {n > 0 && (
            <button
              type="button"
              className="ui-pass__link"
              onClick={() => {
                if (window.confirm(x('xp.resetConfirm'))) reset()
              }}
            >
              {x('xp.reset')}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Toast                                                               */
/* ------------------------------------------------------------------ */

function StampToast() {
  const last = usePassport((s) => s.last)
  const x = useXT()
  const [shown, setShown] = useState<typeof last>(null)
  const [on, setOn] = useState(false)
  useEffect(() => {
    if (!last) return
    setShown(last)
    setOn(true)
    const id = window.setTimeout(() => setOn(false), last.result === 'stamped' ? 3400 : 2600)
    return () => window.clearTimeout(id)
  }, [last])
  const d = shown ? stampDef(shown.id) : undefined
  if (!shown || !d) return null
  const text = shown.result === 'stamped' ? x('xp.stamped', { name: stampName(d.id) }) : shown.result === 'already' ? x('xp.already') : x('xp.needsTheatre')
  return (
    <div className={`ui-stamp-toast ui-panel${on ? ' is-on' : ''}`} role="status" aria-hidden={!on || undefined}>
      <Roundel key={shown.n} def={d} pressed={shown.result !== 'locked'} size={42} />
      <span>{text}</span>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Certificate                                                         */
/* ------------------------------------------------------------------ */

/** The visitor's pot (clay studio profile) as an SVG path, or a plain thrown pot. */
function potPath(): string {
  const pts = useClayStudio.getState().pot?.points ?? []
  if (pts.length < 3) return 'M40 18H60Q57 27 64 32Q82 44 77 64Q72 84 50 86Q28 84 23 64Q18 44 36 32Q43 27 40 18Z'
  const maxR = Math.max(...pts.map((p) => p.r), 1e-6)
  const ys = pts.map((p) => p.y)
  const y0 = Math.min(...ys)
  const y1 = Math.max(...ys)
  const h = Math.max(1e-6, y1 - y0)
  const s = Math.min(34 / maxR, 72 / h)
  const X = (r: number, side: 1 | -1) => (50 + side * r * s).toFixed(2)
  const Y = (y: number) => (88 - (y - y0) * s).toFixed(2)
  const right = pts.map((p) => `${X(p.r, 1)} ${Y(p.y)}`)
  const left = [...pts].reverse().map((p) => `${X(p.r, -1)} ${Y(p.y)}`)
  return `M${right.join('L')}L${left.join('L')}Z`
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)

function roundelSvg(id: string, size: number) {
  const m = motif(stampDef(id)?.motif)
  const g = (stroke: string, dx: number, w: number) =>
    `<g transform="translate(${dx} ${dx})" stroke="${stroke}" stroke-width="${w}" fill="none" stroke-linecap="round" stroke-linejoin="round">${m.stroke.map((d) => `<path d="${d}"/>`).join('')}${(m.fill ?? []).map((d) => `<path d="${d}" fill="${stroke}"/>`).join('')}</g>`
  return `<svg width="${size}" height="${size}" viewBox="0 0 100 100"><circle cx="50" cy="50" r="48" fill="#c98a62"/><circle cx="50" cy="50" r="40" fill="#a35d3e"/><g transform="translate(50 50) scale(0.66) translate(-50 -50)">${g('rgba(255,224,190,.55)', 1.1, 6)}${g('rgba(58,22,9,.75)', -0.8, 6)}${g('#7e3d24', 0, 5)}</g></svg>`
}

function printCertificate() {
  const { completedAt } = usePassport.getState()
  const lang = document.documentElement.lang || 'en'
  const date = (() => {
    try {
      return new Date(completedAt ?? Date.now()).toLocaleDateString(lang || 'en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
    } catch {
      return ''
    }
  })()
  const roundels = STAMPS.map((d) => `<figure>${roundelSvg(d.id, 74)}<figcaption>${esc(stampName(d.id))}</figcaption></figure>`).join('')
  const html = `<!doctype html><html lang="${esc(lang || 'en')}"><head><meta charset="utf-8"><title>${esc(xt('xp.certTitle'))} — ${esc(SITE.name)}</title>
<style>
@page { size: A4 landscape; margin: 12mm; }
body { margin: 0; font-family: 'Cormorant Garamond', Garamond, 'Times New Roman', serif; color: #2b1d14; background: #f3e6d4; }
.sheet { min-height: 100vh; box-sizing: border-box; padding: 28px 40px; border: 10px solid #b9784f; outline: 2px solid #7e3d24; outline-offset: -18px; display: grid; grid-template-columns: 1fr 220px; gap: 28px; align-items: start; }
h1 { font-weight: 500; font-size: 44px; margin: 6px 0 4px; letter-spacing: .01em; }
.k { font: 500 11px/1 Inter, system-ui, sans-serif; letter-spacing: .3em; text-transform: uppercase; color: #7e3d24; }
p { font-size: 19px; margin: 0 0 18px; font-style: italic; }
.grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 10px 6px; }
figure { margin: 0; display: grid; justify-items: center; gap: 4px; }
figcaption { font: 500 10px/1.2 Inter, system-ui, sans-serif; text-align: center; }
.pot { text-align: center; } .pot svg { width: 200px; height: 220px; } .pot div { font: 500 11px/1 Inter, system-ui, sans-serif; letter-spacing: .2em; text-transform: uppercase; color: #7e3d24; }
</style></head><body><div class="sheet"><div><div class="k">${esc(SITE.name)}</div><h1>${esc(xt('xp.certTitle'))}</h1><p>${esc(xt('xp.certText', { date }))}</p><div class="grid">${roundels}</div></div>
<div class="pot"><svg viewBox="0 0 100 100"><ellipse cx="50" cy="90" rx="30" ry="4" fill="rgba(60,25,10,.18)"/><path d="${potPath()}" fill="#9a5537" stroke="#5a2a14" stroke-width="1.2"/></svg><div>${esc(xt('xp.certPot'))}</div></div></div>
<script>window.onload = function () { setTimeout(function () { window.print() }, 300) }</script></body></html>`
  const w = window.open('', '_blank', 'width=1100,height=780')
  if (!w) return
  w.document.open()
  w.document.write(html)
  w.document.close()
}

/* ------------------------------------------------------------------ */
/* Layer                                                               */
/* ------------------------------------------------------------------ */

export function PassportLayer() {
  const open = usePassport((s) => s.open)
  const celebrate = usePassport((s) => s.celebrate)
  const entered = useMuseum((s) => s.phase === 'entered')
  // completion: open the tablet on its finished page
  useEffect(() => {
    if (!celebrate) return
    const id = window.setTimeout(() => {
      usePassport.setState({ open: true, celebrate: false })
    }, 1800)
    return () => window.clearTimeout(id)
  }, [celebrate])
  return (
    <>
      <style>{CSS}</style>
      <StampToast />
      {open && entered && <PassportDialog />}
    </>
  )
}
