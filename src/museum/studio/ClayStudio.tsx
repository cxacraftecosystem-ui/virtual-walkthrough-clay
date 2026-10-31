/**
 * <ClayStudio/> — the full-screen "Shape it yourself" potter's wheel overlay.
 *
 * Opened by selecting the potter's wheel in the pavilion (scene object kind 'potters-wheel';
 * 'print-studio' too, so content written for the older kind still opens a studio), or
 * `openClayStudio()`. Drag the profile's control points (or use the tools: pull up, widen,
 * narrow, trim the rim, turn a foot); choose a clay body, slip, glaze and burnish; add
 * sgraffito or stamped motif bands; fire it. Undo / redo / start again; download a turntable
 * shot as PNG; "Place it on the Visitors' Shelf" sends that shot through /api/prints for the
 * same curator review as the hand block museum's Visitors' Wall (needs the backend — in static
 * mode the studio still works and downloads).
 */
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { SITE } from '../../site'
import { SCENE_OBJECTS } from '../config/objects'
import { translate, useT, type DictKey, type T } from '../i18n'
import { useFocusTrap } from '../a11y/focus'
import { pauseAllVideos } from '../media/VideoScreen'
import { useMuseum } from '../state/store'
import { visitor } from '../state/visitor'
import { IconClose } from '../ui/icons'
import { CLAY_BODIES, GLAZES, getBody, getGlaze, getPotMotif, getSlip, MOTIF_IDS, POT_MOTIFS, SLIPS, type BandTechnique, type PotMotifId } from './clayPalette'
import { useClayStudio } from './clayStore'
import { drawPotMotif } from './potMesh'
import { BASE_R, MAX_BANDS, MAX_H, MAX_R, MIN_R, potHeight, potSection, profileCurve, stampCount, type PotState } from './potEngine'
import { pngAt, pngWithin } from './png'
import { PRINT_MAX_BYTES, submitPrint } from './printsApi'
import { renderShot, SHOT_W, WheelView } from './wheelScene'
import './clayStudio.css'

export const openClayStudio = () => useClayStudio.getState().setOpen(true)

declare global {
  interface Window {
    /** Automation / console handle (like window.__museum). */
    __clayStudio?: typeof useClayStudio
  }
}
if (typeof window !== 'undefined') window.__clayStudio = useClayStudio

/** Scene object kinds that open the studio. */
const OPENS_STUDIO = new Set<string>(['potters-wheel', 'print-studio'])

/** Selecting the potter's wheel in the pavilion opens the studio instead of the info panel. */
function useOpenFromSelection() {
  useEffect(
    () =>
      useMuseum.subscribe((s, prev) => {
        const sel = s.selection
        if (!sel || sel === prev.selection || sel.kind !== 'object') return
        const obj = SCENE_OBJECTS.find((o) => o.id === sel.id)
        if (!obj || !OPENS_STUDIO.has(obj.kind)) return
        s.select(null)
        useClayStudio.getState().setOpen(true)
      }),
    [],
  )
}

const pct = (v: number) => Math.round(v * 100)
const cm = (v: number) => (Math.round(v * 10) / 10).toFixed(1)

/** What the curators see next to the picture in the admin (always in English). */
function potSummary(pot: PotState) {
  const en = (k: DictKey) => translate('en', k)
  const slip = getSlip(pot.slip)
  const glaze = getGlaze(pot.glaze)
  const marks = pot.bands.map((b) => `${en(getPotMotif(b.motif).name)} (${en(b.tech === 'stamp' ? 'studio.tech.stamp' : 'studio.tech.sgraffito')})`)
  const blocks = [en(getBody(pot.body).name), ...(pot.burnish ? [en('studio.burnishShort')] : []), ...(pot.fired ? [en('studio.firedShort')] : []), ...marks]
  return {
    motif: pot.bands[0]?.motif ?? pot.body,
    meta: { blocks, dyes: [slip ? en(slip.name) : '', glaze ? en(glaze.name) : ''].filter(Boolean), ground: pot.body, stamps: stampCount(pot) },
  }
}

const pointName = (t: T, i: number, n: number) => (i === 0 ? t('studio.pointBase') : i === n - 1 ? t('studio.pointRim') : t('studio.pointN', { n: i + 1 }))

/* ------------------------------------------------------------------ */
/* Profile editor (half section, draggable control points)            */
/* ------------------------------------------------------------------ */

/** Editor viewBox in cm: x = radius (mirrored on the left), y = height (up). */
const VB = { x: -22, w: 44, y: -2, h: 44 }

function ProfileEditor({ pot, disabled }: { pot: PotState; disabled: boolean }) {
  const t = useT()
  const apply = useClayStudio((s) => s.apply)
  const endGesture = useClayStudio((s) => s.endGesture)
  const at = useClayStudio((s) => s.at)
  const touched = useClayStudio((s) => s.ops.length > 0)
  const svg = useRef<SVGSVGElement>(null)
  const drag = useRef<{ i: number; id: number } | null>(null)
  const [active, setActive] = useState<number | null>(null)
  const sec = useMemo(() => potSection(pot), [pot])
  const base = sec.bodyBase
  const body = getBody(pot.body)
  const fill = pot.fired ? body.fired : body.raw
  const n = pot.points.length
  const h = potHeight(pot)

  // y is up in the pot, down in SVG
  const P = (r: number, y: number) => `${r.toFixed(3)},${(-y).toFixed(3)}`
  const sectionPath = `M${sec.pts.map(([r, y]) => P(r, y)).join(' L')} Z`
  const outer = sec.pts.filter((_, i) => sec.part[i] !== 'inner')
  const silhouette = `M${outer.map(([r, y]) => P(-r, y)).join(' L')} L${P(0, outer[outer.length - 1][1])} L0,0 Z`
  const spline = `M${profileCurve(pot.points, 12)
    .map((p) => P(p.r, p.y + base))
    .join(' L')}`
  const atY = at * h + base

  const toCm = (e: { clientX: number; clientY: number }) => {
    const el = svg.current!
    const pt = el.createSVGPoint()
    pt.x = e.clientX
    pt.y = e.clientY
    const m = el.getScreenCTM()
    if (!m) return { r: 0, y: 0 }
    const p = pt.matrixTransform(m.inverse())
    return { r: p.x, y: -p.y - base }
  }

  const onDown = (i: number) => (e: ReactPointerEvent) => {
    if (disabled || e.button !== 0) return
    e.preventDefault()
    ;(e.currentTarget as Element).setPointerCapture?.(e.pointerId)
    drag.current = { i, id: e.pointerId }
    setActive(i)
    endGesture()
  }
  const onMove = (e: ReactPointerEvent) => {
    const d = drag.current
    if (!d || d.id !== e.pointerId) return
    const p = toCm(e)
    apply({ t: 'set', i: d.i, r: Math.round(p.r * 10) / 10, y: Math.round(p.y * 10) / 10 }, true)
  }
  const onUp = (e: ReactPointerEvent) => {
    const d = drag.current
    if (!d || d.id !== e.pointerId) return
    drag.current = null
    setActive(null)
    endGesture()
  }

  const onKey = (i: number) => (e: ReactKeyboardEvent) => {
    if (disabled) return
    const step = e.shiftKey ? 1 : 0.2
    const p = pot.points[i]
    let r = p.r
    let y = p.y
    if (e.key === 'ArrowRight') r += step
    else if (e.key === 'ArrowLeft') r -= step
    else if (e.key === 'ArrowUp') y += step
    else if (e.key === 'ArrowDown') y -= step
    else if (e.key === 'PageUp') y += 2
    else if (e.key === 'PageDown') y -= 2
    else return
    e.preventDefault()
    // successive nudges of one point are one step to undo (until focus moves on)
    apply({ t: 'set', i, r: Math.round(r * 10) / 10, y: Math.round(y * 10) / 10 }, true)
  }

  return (
    <div className={`cs-profile${disabled ? ' is-fired' : ''}`}>
      <svg
        ref={svg}
        viewBox={`${VB.x} ${-(VB.y + VB.h)} ${VB.w} ${VB.h}`}
        preserveAspectRatio="xMidYMax meet"
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        role="group"
        aria-label={t('studio.profileLabel')}
      >
        {/* height ruler, every 5 cm */}
        <g className="cs-ruler" aria-hidden="true">
          {Array.from({ length: Math.floor(MAX_H / 5) + 1 }, (_, k) => k * 5).map((y) => (
            <g key={y}>
              <line x1={VB.x + 0.6} x2={VB.x + (y % 10 === 0 ? 2.2 : 1.4)} y1={-y} y2={-y} />
              {y % 10 === 0 && (
                <text x={VB.x + 2.8} y={-y + 0.5}>
                  {y}
                </text>
              )}
            </g>
          ))}
          <text x={VB.x + 2.8} y={-MAX_H + 2.4} className="cs-ruler-unit">
            cm
          </text>
        </g>
        <line className="cs-axis" x1={0} x2={0} y1={1} y2={-(VB.y + VB.h)} aria-hidden="true" />
        <rect className="cs-wheelhead" x={-17} y={0} width={34} height={1.2} rx={0.3} aria-hidden="true" />
        <path className="cs-silhouette" d={silhouette} style={{ fill }} aria-hidden="true" />
        <path className="cs-section" d={sectionPath} style={{ fill }} aria-hidden="true" />
        <line className="cs-at" x1={-21} x2={21} y1={-atY} y2={-atY} aria-hidden="true" />
        <path className="cs-spline" d={spline} aria-hidden="true" />
        {pot.points.map((p, i) => {
          const name = pointName(t, i, n)
          return (
            <g
              key={i}
              className={`cs-handle${active === i ? ' is-active' : ''}`}
              transform={`translate(${p.r} ${-(p.y + base)})`}
              tabIndex={disabled ? -1 : 0}
              role="slider"
              aria-label={name}
              aria-valuemin={i === 0 ? BASE_R[0] : MIN_R}
              aria-valuemax={i === 0 ? BASE_R[1] : MAX_R}
              aria-valuenow={p.r}
              aria-valuetext={t('studio.pointValue', { name, r: cm(p.r), y: cm(p.y) })}
              aria-disabled={disabled || undefined}
              onPointerDown={onDown(i)}
              onKeyDown={onKey(i)}
              onBlur={endGesture}
            >
              <circle className="cs-handle-hit" r={2.2} />
              <circle className="cs-handle-dot" r={0.75} />
            </g>
          )
        })}
      </svg>
      {!touched && !disabled && (
        <div className="cs-hint" aria-hidden="true">
          {t('studio.hint')}
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Wheel view                                                          */
/* ------------------------------------------------------------------ */

function WheelPane() {
  const t = useT()
  const pot = useClayStudio((s) => s.pot)
  const seed = useClayStudio((s) => s.seed)
  const firing = useClayStudio((s) => s.firing)
  const reduced = useMuseum((s) => s.reducedMotion)
  const spin = useClayStudio((s) => s.spin)
  const set = useClayStudio((s) => s.set)
  const wrap = useRef<HTMLDivElement>(null)
  const holder = useRef<HTMLDivElement>(null)
  const glow = useRef<HTMLDivElement>(null)
  const view = useRef<WheelView | null>(null)
  const turning = useRef<{ id: number; x: number; a: number } | null>(null)
  const [failed, setFailed] = useState(false)

  // reduced motion stops the wheel (the visitor may still start it)
  useEffect(() => {
    if (reduced) set({ spin: false })
  }, [reduced, set])

  useEffect(() => {
    const box = holder.current
    const el = wrap.current
    if (!box || !el) return
    // each view gets its own canvas: disposing a view releases its GL context for good
    const cv = document.createElement('canvas')
    cv.className = 'cs-wheel-canvas'
    cv.setAttribute('aria-hidden', 'true')
    box.appendChild(cv)
    let v: WheelView
    try {
      v = new WheelView(cv, useClayStudio.getState().seed)
    } catch {
      cv.remove()
      setFailed(true)
      return
    }
    view.current = v
    v.onFireGlow = (g) => {
      if (glow.current) glow.current.style.opacity = String(g)
    }
    const fit = () => {
      const r = el.getBoundingClientRect()
      v.resize(Math.max(1, Math.floor(r.width)), Math.max(1, Math.floor(r.height)))
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    return () => {
      ro.disconnect()
      v.dispose()
      cv.remove()
      view.current = null
    }
  }, [])

  useEffect(() => view.current?.setSeed(seed), [seed])
  useEffect(() => {
    // while the kiln is running the view turns the colours itself, at the height of the glow
    view.current?.setPot(pot, pot.fired && !firing)
  }, [pot, firing])
  useEffect(() => view.current?.setSpin(spin), [spin])

  useEffect(() => {
    if (!firing) return
    const v = view.current
    if (!v) {
      useClayStudio.getState().setFiring(false)
      return
    }
    // resolves when the pot has cooled, or at once if the view goes (the studio closed mid-firing)
    void v.fire(reduced).then(() => useClayStudio.getState().setFiring(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- a change of motion setting mid-firing must not restart it
  }, [firing])

  // drag (or arrow keys) to turn the pot while the wheel is stopped
  const onDown = (e: ReactPointerEvent) => {
    if (spin || !view.current || e.button !== 0) return
    turning.current = { id: e.pointerId, x: e.clientX, a: view.current.angle }
    ;(e.currentTarget as Element).setPointerCapture?.(e.pointerId)
  }
  const onMove = (e: ReactPointerEvent) => {
    const tr = turning.current
    const v = view.current
    if (!tr || tr.id !== e.pointerId || !v) return
    v.angle = tr.a - (e.clientX - tr.x) * 0.012
    v.kick()
  }
  const onUp = () => {
    turning.current = null
  }
  const turnBy = (d: number) => {
    const v = view.current
    if (!v) return
    v.angle += d
    v.kick()
  }

  return (
    <div className="cs-wheel">
      <div className={`cs-wheel-stage${spin ? '' : ' is-turnable'}`} ref={wrap} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
        <div ref={holder} className="cs-wheel-gl" role="img" aria-label={t('studio.wheelLabel')} />
        <div ref={glow} className="cs-kiln-glow" aria-hidden="true" />
        {failed && <p className="cs-wheel-failed">{t('studio.noWebgl')}</p>}
      </div>
      <div className="cs-wheel-bar">
        <button className="cs-btn small" onClick={() => set({ spin: !spin })} aria-pressed={spin} title={t('studio.spinKey')}>
          {spin ? t('studio.stop') : t('studio.spin')}
        </button>
        {!spin && (
          <>
            <button className="cs-btn small" onClick={() => turnBy(-0.4)} aria-label={t('studio.turnLeft')}>
              ‹
            </button>
            <button className="cs-btn small" onClick={() => turnBy(0.4)} aria-label={t('studio.turnRight')}>
              ›
            </button>
          </>
        )}
        <span className="cs-dims" aria-live="polite">
          {t('studio.dims', { h: cm(potSection(pot).height), w: cm(Math.max(...pot.points.map((p) => p.r)) * 2) })}
        </span>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Shelf submission                                                    */
/* ------------------------------------------------------------------ */

type SendState = { kind: 'idle' } | { kind: 'form' } | { kind: 'sending' } | { kind: 'done' } | { kind: 'error'; message: string }

function ShelfDialog({ state, setState }: { state: SendState; setState: (s: SendState) => void }) {
  const t = useT()
  const user = useMuseum((s) => s.user)
  const [name, setName] = useState(user?.displayName ?? '')
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (state.kind === 'form') input.current?.focus()
  }, [state.kind])
  if (state.kind === 'idle') return null
  const send = async () => {
    setState({ kind: 'sending' })
    try {
      const { pot, seed } = useClayStudio.getState()
      const png = await pngWithin(renderShot(pot, seed), PRINT_MAX_BYTES)
      await submitPrint(png, name.trim(), potSummary(pot))
      setState({ kind: 'done' })
    } catch (e) {
      setState({ kind: 'error', message: e instanceof Error && e.message ? e.message : t('studio.sendError') })
    }
  }
  return (
    <div className="cs-dialog-backdrop" onPointerDown={(e) => e.target === e.currentTarget && state.kind !== 'sending' && setState({ kind: 'idle' })}>
      <div className="cs-dialog" role="dialog" aria-modal="true" aria-labelledby="cs-dialog-title">
        {state.kind === 'done' ? (
          <>
            <h2 id="cs-dialog-title">{t('studio.thanks')}</h2>
            <p>{t('studio.thanksBody')}</p>
            <div className="cs-dialog-actions">
              <button className="cs-btn primary" onClick={() => setState({ kind: 'idle' })}>
                {t('studio.back')}
              </button>
            </div>
          </>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              void send()
            }}
          >
            <h2 id="cs-dialog-title">{t('studio.shelf')}</h2>
            <p className="cs-muted">{t('studio.shelfLede')}</p>
            <label className="cs-field">
              <span>{t('studio.nameLabel')}</span>
              <input ref={input} value={name} maxLength={40} onChange={(e) => setName(e.target.value)} placeholder={t('studio.anonymous')} autoComplete="nickname" />
            </label>
            {state.kind === 'error' && (
              <p className="cs-error" role="alert">
                {state.message}
              </p>
            )}
            <div className="cs-dialog-actions">
              <button type="button" className="cs-btn ghost" onClick={() => setState({ kind: 'idle' })} disabled={state.kind === 'sending'}>
                {t('studio.cancel')}
              </button>
              <button type="submit" className="cs-btn primary" disabled={state.kind === 'sending'}>
                {state.kind === 'sending' ? t('studio.sending') : t('studio.send')}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Tool panel                                                          */
/* ------------------------------------------------------------------ */

function Swatch({ color, label, active, onClick, disabled }: { color: string | null; label: string; active: boolean; onClick: () => void; disabled?: boolean }) {
  return (
    <button className={`cs-swatch${active ? ' is-active' : ''}`} onClick={onClick} aria-pressed={active} disabled={disabled}>
      <span className={`cs-swatch-chip${color ? '' : ' is-none'}`} style={color ? { background: color } : undefined} />
      <span className="cs-swatch-label">{label}</span>
    </button>
  )
}

function MotifPreview({ motif, tech, color, ground }: { motif: PotMotifId; tech: BandTechnique; color: string; ground: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const cv = ref.current
    if (!cv) return
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    cv.width = 72 * dpr
    cv.height = 36 * dpr
    const g = cv.getContext('2d')
    if (!g) return
    g.fillStyle = ground
    g.fillRect(0, 0, cv.width, cv.height)
    g.strokeStyle = g.fillStyle = color
    g.lineWidth = 1.6 * dpr
    g.lineCap = g.lineJoin = 'round'
    const w = cv.width / 2
    for (let i = 0; i < 2; i++) drawPotMotif(g, motif, w * (i + 0.5), cv.height / 2, w * 0.9, cv.height * 0.72, tech === 'stamp')
  }, [motif, tech, color, ground])
  return <canvas ref={ref} className="cs-motif-canvas" aria-hidden="true" />
}

function Where({ id }: { id: string }) {
  const t = useT()
  const at = useClayStudio((s) => s.at)
  const set = useClayStudio((s) => s.set)
  return (
    <label className="cs-range" htmlFor={id}>
      <span>{t('studio.where')}</span>
      <input id={id} type="range" min={5} max={95} step={1} value={pct(at)} onChange={(e) => set({ at: Number(e.target.value) / 100 })} aria-valuetext={t('studio.whereValue', { pct: pct(at) })} />
      <output htmlFor={id}>{pct(at)}%</output>
    </label>
  )
}

function PointSliders({ pot, disabled }: { pot: PotState; disabled: boolean }) {
  const t = useT()
  const apply = useClayStudio((s) => s.apply)
  const endGesture = useClayStudio((s) => s.endGesture)
  const n = pot.points.length
  return (
    <div className="cs-points">
      {pot.points.map((p, i) => {
        const name = pointName(t, i, n)
        return (
          <fieldset key={i} className="cs-point" disabled={disabled}>
            <legend>{name}</legend>
            <label className="cs-range">
              <span>{t('studio.radius')}</span>
              <input
                type="range"
                min={i === 0 ? BASE_R[0] : MIN_R}
                max={i === 0 ? BASE_R[1] : MAX_R}
                step={0.1}
                value={p.r}
                onChange={(e) => apply({ t: 'set', i, r: Number(e.target.value), y: p.y }, true)}
                onPointerUp={endGesture}
                onBlur={endGesture}
                aria-valuetext={t('studio.cmValue', { v: cm(p.r) })}
              />
              <output>{cm(p.r)}</output>
            </label>
            {i > 0 && (
              <label className="cs-range">
                <span>{t('studio.height')}</span>
                <input
                  type="range"
                  min={0}
                  max={MAX_H}
                  step={0.1}
                  value={p.y}
                  onChange={(e) => apply({ t: 'set', i, r: p.r, y: Number(e.target.value) }, true)}
                  onPointerUp={endGesture}
                  onBlur={endGesture}
                  aria-valuetext={t('studio.cmValue', { v: cm(p.y) })}
                />
                <output>{cm(p.y)}</output>
              </label>
            )}
          </fieldset>
        )
      })}
    </div>
  )
}

function ToolPanel() {
  const t = useT()
  const pot = useClayStudio((s) => s.pot)
  const at = useClayStudio((s) => s.at)
  const motif = useClayStudio((s) => s.motif)
  const tech = useClayStudio((s) => s.tech)
  const firing = useClayStudio((s) => s.firing)
  const apply = useClayStudio((s) => s.apply)
  const set = useClayStudio((s) => s.set)
  const fire = useClayStudio((s) => s.fire)
  const fired = pot.fired
  const locked = fired || firing
  const body = getBody(pot.body)
  const ground = getSlip(pot.slip)?.raw ?? body.raw
  const markColor = pot.slip ? body.raw : '#2b2621'

  const tools: { op: Parameters<typeof apply>[0]; label: DictKey; hint: DictKey; done?: boolean }[] = [
    { op: { t: 'pull' }, label: 'studio.tool.pull', hint: 'studio.tool.pullHint', done: potHeight(pot) >= MAX_H - 0.01 },
    { op: { t: 'widen', at }, label: 'studio.tool.widen', hint: 'studio.tool.widenHint' },
    { op: { t: 'narrow', at }, label: 'studio.tool.narrow', hint: 'studio.tool.narrowHint' },
    { op: { t: 'trim' }, label: 'studio.tool.trim', hint: 'studio.tool.trimHint' },
    { op: { t: 'foot' }, label: pot.foot ? 'studio.tool.footDone' : 'studio.tool.foot', hint: 'studio.tool.footHint', done: pot.foot },
  ]

  return (
    <aside className="cs-panel" aria-label={t('studio.tools')}>
      <section>
        <h2>{t('studio.shape')}</h2>
        <div className="cs-tools">
          {tools.map((x) => (
            <button key={x.op.t} className="cs-tool" onClick={() => apply(x.op)} disabled={locked || x.done} title={t(x.hint)}>
              <span className="cs-tool-label">{t(x.label)}</span>
              <span className="cs-tool-hint">{t(x.hint)}</span>
            </button>
          ))}
        </div>
        <Where id="cs-where-shape" />
        {fired && <p className="cs-note">{t('studio.firedNote')}</p>}
        <details className="cs-details">
          <summary>{t('studio.points')}</summary>
          <p className="cs-note">{t('studio.pointsNote')}</p>
          <PointSliders pot={pot} disabled={locked} />
        </details>
      </section>

      <section>
        <h2>{t('studio.body')}</h2>
        <div className="cs-swatches">
          {CLAY_BODIES.map((b) => (
            <Swatch key={b.id} color={fired ? b.fired : b.raw} label={t(b.name)} active={pot.body === b.id} onClick={() => apply({ t: 'body', id: b.id })} disabled={locked} />
          ))}
        </div>
        <p className="cs-note">{t('studio.bodyNote')}</p>
      </section>

      <section>
        <h2>{t('studio.surface')}</h2>
        <h3>{t('studio.slip')}</h3>
        <div className="cs-swatches">
          <Swatch color={null} label={t('studio.none')} active={!pot.slip} onClick={() => apply({ t: 'slip', id: null })} disabled={locked} />
          {SLIPS.map((s) => (
            <Swatch key={s.id} color={fired ? s.fired : s.raw} label={t(s.name)} active={pot.slip === s.id} onClick={() => apply({ t: 'slip', id: s.id })} disabled={locked} />
          ))}
        </div>
        <h3>{t('studio.glaze')}</h3>
        <div className="cs-swatches">
          <Swatch color={null} label={t('studio.none')} active={!pot.glaze} onClick={() => apply({ t: 'glaze', id: null })} disabled={locked} />
          {GLAZES.map((g) => (
            <Swatch key={g.id} color={g.tint} label={t(g.name)} active={pot.glaze === g.id} onClick={() => apply({ t: 'glaze', id: g.id })} disabled={locked} />
          ))}
        </div>
        <label className="cs-check">
          <input type="checkbox" checked={pot.burnish} disabled={locked} onChange={(e) => apply({ t: 'burnish', on: e.target.checked })} />
          {t('studio.burnish')}
        </label>
        <p className="cs-note">{t('studio.surfaceNote')}</p>
      </section>

      <section>
        <h2>{t('studio.decorate')}</h2>
        <div className="cs-seg" role="group" aria-label={t('studio.technique')}>
          {(['sgraffito', 'stamp'] as const).map((x) => (
            <button key={x} className={tech === x ? 'is-active' : ''} onClick={() => set({ tech: x })} aria-pressed={tech === x} title={t(x === 'stamp' ? 'studio.tech.stampHint' : 'studio.tech.sgraffitoHint')}>
              {t(x === 'stamp' ? 'studio.tech.stamp' : 'studio.tech.sgraffito')}
            </button>
          ))}
        </div>
        <div className="cs-motifs">
          {MOTIF_IDS.map((id) => {
            const m = POT_MOTIFS.find((x) => x.id === id)!
            return (
              <button key={id} className={`cs-motif${motif === id ? ' is-active' : ''}`} onClick={() => set({ motif: id })} aria-pressed={motif === id}>
                <MotifPreview motif={id} tech={tech} color={markColor} ground={ground} />
                <span>{t(m.name)}</span>
              </button>
            )
          })}
        </div>
        <Where id="cs-where-band" />
        <div className="cs-row">
          <button className="cs-btn small" onClick={() => apply({ t: 'band', motif, tech, at })} disabled={locked || pot.bands.length >= MAX_BANDS}>
            {t('studio.addBand')}
          </button>
          <span className="cs-note inline">{t('studio.bandsCount', { n: pot.bands.length, max: MAX_BANDS })}</span>
        </div>
        <p className="cs-note">{t(tech === 'stamp' ? 'studio.tech.stampHint' : 'studio.tech.sgraffitoHint')}</p>
      </section>

      <section>
        <h2>{t('studio.firing')}</h2>
        <button className="cs-btn fire" onClick={fire} disabled={locked}>
          {firing ? t('studio.firingNow') : fired ? t('studio.firedDone') : t('studio.fire')}
        </button>
        <p className="cs-note">{t('studio.fireNote')}</p>
      </section>
      <p className="cs-foot">{t('studio.foot')}</p>
    </aside>
  )
}

/* ------------------------------------------------------------------ */
/* Overlay                                                             */
/* ------------------------------------------------------------------ */

function StudioOverlay({ onClose }: { onClose: () => void }) {
  const t = useT()
  const s = useClayStudio()
  const online = useMuseum((m) => m.online)
  const [send, setSend] = useState<SendState>({ kind: 'idle' })
  const [closing, setClosing] = useState(false)
  const [busy, setBusy] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  useFocusTrap(root, true)
  // the shelf needs the backend; probe it ourselves too (the museum's health probe is short)
  const [shelfUp, setShelfUp] = useState<boolean | null>(online === true ? true : null)
  useEffect(() => {
    if (online === true) return setShelfUp(true)
    if (new URLSearchParams(window.location.search).has('static')) return setShelfUp(false)
    let alive = true
    const ctrl = new AbortController()
    const tm = setTimeout(() => ctrl.abort(), 20000)
    fetch('/api/prints?limit=1', { signal: ctrl.signal, credentials: 'include' })
      .then((r) => alive && setShelfUp(r.ok && (r.headers.get('content-type') ?? '').includes('json')))
      .catch(() => alive && setShelfUp(false))
      .finally(() => clearTimeout(tm))
    return () => {
      alive = false
      ctrl.abort()
    }
  }, [online])
  // optimistic while probing: a failed send reports its error in the dialog
  const canShelf = shelfUp !== false
  const empty = s.ops.length === 0

  const close = useCallback(() => {
    setClosing(true)
    setTimeout(onClose, 220)
  }, [onClose])

  const download = useCallback(async () => {
    setBusy(true)
    try {
      const { pot, seed } = useClayStudio.getState()
      const png = await pngAt(renderShot(pot, seed), SHOT_W)
      const url = URL.createObjectURL(png)
      const a = document.createElement('a')
      a.href = url
      a.download = `${SITE.fileStem}-my-pot-${new Date().toISOString().slice(0, 10)}.png`
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 4000)
    } finally {
      setBusy(false)
    }
  }, [])

  // keyboard: the studio owns it while open (capture phase, before the museum's shortcuts)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null
      const typing = !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)
      // keys aimed inside the studio go on to its controls (the root stops them before the
      // museum's own listeners); anything else is the studio's alone
      const inside = !!el && !!root.current?.contains(el)
      if (!inside) e.stopPropagation()
      if (typing && e.key !== 'Escape' && (el as HTMLInputElement).type !== 'range' && (el as HTMLInputElement).type !== 'checkbox') return
      const st = useClayStudio.getState()
      const mod = e.ctrlKey || e.metaKey
      if (e.key === 'Escape') {
        if (send.kind !== 'idle') {
          if (send.kind !== 'sending') setSend({ kind: 'idle' })
        } else close()
      } else if (mod && (e.key === 'z' || e.key === 'Z')) {
        if (e.shiftKey) st.redoOp()
        else st.undo()
      } else if (mod && (e.key === 'y' || e.key === 'Y')) st.redoOp()
      else if (!mod && !typing && (e.key === 's' || e.key === 'S')) st.set({ spin: !st.spin })
      else return
      e.preventDefault()
      e.stopPropagation()
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (!root.current?.contains(e.target as Node)) e.stopPropagation()
    }
    window.addEventListener('keydown', onKey, true)
    window.addEventListener('keyup', onKeyUp, true)
    return () => {
      window.removeEventListener('keydown', onKey, true)
      window.removeEventListener('keyup', onKeyUp, true)
    }
  }, [close, send.kind])

  return (
    <div
      ref={root}
      className={`cs-root${closing ? ' is-closing' : ''}${s.firing ? ' is-firing' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label={t('studio.dialog')}
      onKeyDown={(e) => e.stopPropagation()}
      onKeyUp={(e) => e.stopPropagation()}
    >
      <header className="cs-head">
        <div className="cs-title">
          <span className="cs-kicker">{t('studio.kicker')}</span>
          <h1>{t('studio.title')}</h1>
        </div>
        <p className="cs-lede">{t('studio.lede')}</p>
        <button className="cs-close" onClick={close} aria-label={t('studio.close')}>
          <IconClose />
        </button>
      </header>

      <div className="cs-body">
        <main className="cs-main">
          <div className="cs-stage">
            <ProfileEditor pot={s.pot} disabled={s.pot.fired || s.firing} />
            <WheelPane />
          </div>
          <div className="cs-toolbar" role="toolbar" aria-label={t('studio.actions')}>
            <button className="cs-btn" onClick={s.undo} disabled={s.firing || (empty && !s.cleared)} title={t('studio.undoKey')}>
              {t('studio.undo')}
            </button>
            <button className="cs-btn" onClick={s.redoOp} disabled={s.firing || !s.redo.length} title={t('studio.redoKey')}>
              {t('studio.redo')}
            </button>
            <button className="cs-btn ghost" onClick={s.clear} disabled={s.firing || empty}>
              {t('studio.clear')}
            </button>
            <span className="cs-spacer" />
            <button className="cs-btn" onClick={() => void download()} disabled={empty || busy || s.firing}>
              {t('studio.download')}
            </button>
            <button className="cs-btn primary" onClick={() => setSend({ kind: 'form' })} disabled={empty || !canShelf || s.firing} title={canShelf ? undefined : t('studio.offline')}>
              {t('studio.shelf')}
            </button>
          </div>
          {shelfUp === false && <p className="cs-offline">{t('studio.offline')}</p>}
        </main>
        <ToolPanel />
      </div>
      <ShelfDialog state={send} setState={setSend} />
    </div>
  )
}

/** Mount once in the UI overlay. */
export function ClayStudio() {
  useOpenFromSelection()
  const open = useClayStudio((s) => s.open)
  const setOpen = useClayStudio((s) => s.setOpen)

  useEffect(() => {
    if (!open) return
    visitor.frozen = true
    visitor.walkTarget = null
    const m = useMuseum.getState()
    if (m.mouseLook) m.setMouseLook(false)
    try {
      if (document.pointerLockElement) document.exitPointerLock()
    } catch {
      /* ignore */
    }
    pauseAllVideos()
    return () => {
      visitor.frozen = false
    }
  }, [open])

  if (!open) return null
  return <StudioOverlay onClose={() => setOpen(false)} />
}
