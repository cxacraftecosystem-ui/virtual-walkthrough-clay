/**
 * Photo mode: hides the whole overlay for a clean frame; Enter (or the shutter) saves a PNG of
 * the 3D canvas at its current resolution with a small caption strip, Esc exits.
 *
 * Frames of Clay (SPECTACLE F32): photo mode lists the pavilion's framed views — the
 * 'photo-spot' scene objects, each also a brass marker in the floor. Choosing one fades to its
 * standing point and sets its view, field of view, time of day, weather and caption (and plays
 * its moment, e.g. the vault firing); leaving photo mode gives the visitor's own time, weather
 * and field of view back. Depth of field and grain are asked for (`usePhoto.dof`) on High and up.
 */
import { useEffect, useRef, useState } from 'react'
import { loc, rich, useLang, useT } from '../i18n'
import { create } from 'zustand'
import { useMuseum, type TimeOfDay } from '../state/store'
import { tour, useTour } from '../tour/engine'
import { IconCamera, IconClose } from './icons'
import { isCoarsePointer } from './HelpOverlay'
import { awaitRayTraceForCapture, useRayTrace } from '../effects/rayTraceStore'
import { QUALITY_PRESETS } from '../config/quality'
import { SITE } from '../../site'
import { SCENE_OBJECTS, type SceneObjectConfig } from '../config/objects'
import { setFovOverride } from '../navigation/fovOverride'
import { isPerchId, usePerch } from '../navigation/perch'
import { leavePerch, perchAt } from '../navigation/perchActions'
import { fireCue } from '../spectacle/cues'
import { useXT } from '../spectacle/experienceText'
import { spectacleSettings } from '../spectacle/settings'
import { teleport } from '../state/visitor'
import { track } from '../analytics/tracker'
import { travel } from './Minimap'

export const CAPTION = SITE.name

export const usePhoto = create<{
  on: boolean
  flash: number
  /** The Frames of Clay preset in view (a 'photo-spot' object id), or null. */
  frame: string | null
  /** The preset asks for depth of field (PostFX, High and up). */
  dof: boolean
}>(() => ({ on: false, flash: 0, frame: null, dof: false }))

export function enterPhotoMode() {
  const m = useMuseum.getState()
  if (m.phase !== 'entered' || m.inspecting || usePhoto.getState().on) return
  m.select(null)
  m.setHelpOpen(false)
  m.setDrawer(null)
  // A tour walking the camera about is no good for framing a shot.
  if (useTour.getState().active) tour.pause()
  usePhoto.setState({ on: true })
}

export function exitPhotoMode() {
  if (!usePhoto.getState().on) return
  usePhoto.setState({ on: false })
  releaseFrame()
}

export const togglePhotoMode = () => (usePhoto.getState().on ? exitPhotoMode() : enterPhotoMode())

/* ------------------------------------------------------------------ */
/* Frames of Clay                                                      */
/* ------------------------------------------------------------------ */

/** The framed views, in the order the pavilion lists them (curators add 'photo-spot' objects). */
export const photoFrames = (): SceneObjectConfig[] => SCENE_OBJECTS.filter((o) => o.kind === 'photo-spot')

const TIME_OF: Record<string, TimeOfDay> = { morning: 'morning', noon: 'midday', midday: 'midday', golden: 'golden', dusk: 'dusk', night: 'night' }
const numProp = (o: SceneObjectConfig, k: string) => {
  const v = o.props?.[k]
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN
  return Number.isFinite(n) ? n : undefined
}
const strProp = (o: SceneObjectConfig, k: string) => {
  const v = o.props?.[k]
  return typeof v === 'string' ? v.trim() : ''
}

/** What the visitor had before a frame changed it (given back on leaving photo mode). */
let before: { time: TimeOfDay; weather?: string } | null = null

type WeatherStore = { weather?: string; setWeather?: (w: string) => void }

/** A frame's vertical FOV is set for 16:10; a narrower screen widens it to keep the horizontal view. */
function frameFov(fov: number | undefined): number | null {
  if (fov === undefined) return null
  const aspect = window.innerWidth / Math.max(1, window.innerHeight)
  if (aspect >= 1.6) return fov
  const h = 2 * Math.atan(Math.tan((fov * Math.PI) / 360) * 1.6)
  return Math.min(90, (2 * Math.atan(Math.tan(h / 2) / aspect) * 180) / Math.PI)
}

/** Frame a preset: fade to its standing point, set its view, light and caption. */
export function applyFrame(id: string) {
  const o = photoFrames().find((f) => f.id === id)
  if (!o) return
  const m = useMuseum.getState()
  if (m.phase !== 'entered' || m.inspecting) return
  if (!usePhoto.getState().on) enterPhotoMode()
  if (usePerch.getState().perch) leavePerch(false)
  const st = m as unknown as WeatherStore
  before ??= { time: m.timeOfDay, weather: typeof st.weather === 'string' ? st.weather : undefined }
  const timeName = strProp(o, 'time')
  const time = TIME_OF[timeName]
  if (time && time !== m.timeOfDay) m.setTimeOfDay(time)
  if (timeName) fireCue(`time:${timeName}`, { source: 'visitor' })
  const weather = strProp(o, 'weather')
  if (weather) {
    st.setWeather?.(weather)
    fireCue(`weather:${weather}`, { source: 'visitor' })
  }
  const cue = strProp(o, 'cue')
  if (cue) fireCue(cue, { source: 'visitor', data: { frame: o.id } })
  setFovOverride(frameFov(numProp(o, 'fov')))
  usePhoto.setState({ frame: o.id, dof: o.props?.dof === true || o.props?.dof === 'true' })
  // a frame taken from a perch (the Sphere Well's floor) stands on it; the rest on the ground
  const perch = strProp(o, 'perch')
  const move = () => {
    if (isPerchId(perch)) {
      perchAt(perch, numProp(o, 'perchT') ?? 1)
      return
    }
    teleport(o.position[0], o.position[2], numProp(o, 'yawDeg') ?? 0, numProp(o, 'pitchDeg') ?? 0)
  }
  // Still form: a plain cut; otherwise the soft fade the tour and the minimap use
  if (spectacleSettings().mode === 'still') move()
  else travel(move)
  track('moment', { itemId: `frame:${o.id}`, zone: o.zone })
}

/** Give back the visitor's own time, weather and field of view. */
function releaseFrame() {
  setFovOverride(null)
  const b = before
  before = null
  if (usePhoto.getState().frame !== null) usePhoto.setState({ frame: null, dof: false })
  if (!b) return
  const m = useMuseum.getState()
  if (m.timeOfDay !== b.time) m.setTimeOfDay(b.time)
  const st = m as unknown as WeatherStore
  if (b.weather !== undefined && st.weather !== b.weather) st.setWeather?.(b.weather)
}

/** Caption for the PNG: the pavilion's name, and the frame's when one is in view. */
function captionText() {
  const f = usePhoto.getState().frame
  const o = f ? photoFrames().find((x) => x.id === f) : undefined
  const c = o ? strProp(o, 'caption') || o.title : ''
  return c ? `${CAPTION} · ${c}` : CAPTION
}

/* ------------------------------------------------------------------ */
/* Capture                                                             */
/* ------------------------------------------------------------------ */

/** True when the sampled pixels are all transparent/identical (cleared drawing buffer). */
function looksBlank(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const n = 8
  let first = -1
  let varied = false
  let opaque = false
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const d = ctx.getImageData(Math.floor(((i + 0.5) / n) * w), Math.floor(((j + 0.5) / n) * h), 1, 1).data
      const v = (d[0] << 16) | (d[1] << 8) | d[2]
      if (d[3] > 0) opaque = true
      if (first === -1) first = v
      else if (v !== first) varied = true
    }
  }
  return !opaque || !varied
}

/**
 * Copy the WebGL canvas right after a rendered frame. The renderer does not preserve its
 * drawing buffer, so the copy has to happen inside the frame callback that follows R3F's
 * render (rAF callbacks run in registration order; R3F queued its own first).
 */
function grabFrame(tries = 4): Promise<HTMLCanvasElement | null> {
  const gl = window.__museum?.gl
  if (!gl) return Promise.resolve(null)
  return new Promise((resolve) => {
    const attempt = (left: number) =>
      requestAnimationFrame(() => {
        const src = gl.domElement
        const out = document.createElement('canvas')
        out.width = src.width
        out.height = src.height
        const ctx = out.getContext('2d')
        if (!ctx || !out.width || !out.height) return resolve(null)
        ctx.drawImage(src, 0, 0)
        if (!looksBlank(ctx, out.width, out.height)) return resolve(out)
        if (left > 0) return attempt(left - 1)
        resolve(null)
      })
    attempt(tries)
  })
}

function drawCaption(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d')!
  const s = Math.max(0.5, Math.min(canvas.width, canvas.height * 1.6) / 1600)
  const pad = 26 * s
  const font = `500 ${Math.round(24 * s)}px 'Cormorant Garamond', Cormorant, Garamond, 'Times New Roman', serif`
  ctx.font = font
  const text = captionText()
  const textW = ctx.measureText(text).width
  const ruleW = 22 * s
  const gap = 12 * s
  const boxH = 46 * s
  const boxW = pad * 0.8 + ruleW + gap + textW + pad * 0.8
  const x = pad
  const y = canvas.height - pad - boxH
  ctx.save()
  ctx.fillStyle = 'rgba(245, 241, 232, 0.8)'
  ctx.shadowColor = 'rgba(43, 38, 33, 0.18)'
  ctx.shadowBlur = 18 * s
  ctx.shadowOffsetY = 4 * s
  ctx.beginPath()
  ctx.roundRect(x, y, boxW, boxH, 6 * s)
  ctx.fill()
  ctx.restore()
  // accent rule, then the caption
  ctx.fillStyle = '#8a5a3b'
  ctx.fillRect(x + pad * 0.8, y + boxH / 2 - 0.75 * s, ruleW, Math.max(1, 1.5 * s))
  ctx.fillStyle = '#2b2621'
  ctx.textBaseline = 'middle'
  ctx.font = font
  ctx.fillText(text, x + pad * 0.8 + ruleW + gap, y + boxH / 2 + 1 * s)
}

const stamp = () => {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
}

let capturing = false

/** Save a PNG of the current view. Resolves false when nothing could be captured. */
export async function capturePhoto(): Promise<boolean> {
  if (capturing) return false
  capturing = true
  try {
    try {
      await document.fonts?.load(`500 24px 'Cormorant Garamond'`)
    } catch {
      /* fall back to the serif stack */
    }
    // Ray-traced view running: let it converge so the PNG is the path-traced image.
    await awaitRayTraceForCapture()
    const frame = await grabFrame()
    if (!frame) return false
    drawCaption(frame)
    const blob = await new Promise<Blob | null>((r) => frame.toBlob(r, 'image/png'))
    if (!blob) return false
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${SITE.fileStem}-${stamp()}.png`
    document.body.appendChild(a)
    a.click()
    a.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 4000)
    usePhoto.setState((s) => ({ flash: s.flash + 1 }))
    return true
  } finally {
    capturing = false
  }
}

// Automation / console handle.
if (typeof window !== 'undefined') {
  ;(window as unknown as { __photo?: unknown }).__photo = { usePhoto, enterPhotoMode, exitPhotoMode, capturePhoto, grabFrame, applyFrame, photoFrames }
}

/* ------------------------------------------------------------------ */
/* Overlay                                                             */
/* ------------------------------------------------------------------ */

const HINT_MS = 3200
const IDLE_MS = 2600

export function PhotoMode() {
  const on = usePhoto((s) => s.on)
  const flash = usePhoto((s) => s.flash)
  const entered = useMuseum((s) => s.phase === 'entered')
  const inspecting = useMuseum((s) => !!s.inspecting)
  const [hint, setHint] = useState(false)
  const [awake, setAwake] = useState(true)
  const idle = useRef(0)
  const coarse = isCoarsePointer()

  // Leaving the museum view or opening the 3D viewer ends photo mode.
  useEffect(() => {
    if (on && (!entered || inspecting)) exitPhotoMode()
  }, [on, entered, inspecting])

  useEffect(() => {
    if (!on) return
    setHint(true)
    setAwake(true)
    const t = window.setTimeout(() => setHint(false), HINT_MS)
    // Controls rest out of sight until the pointer moves.
    const wake = () => {
      setAwake(true)
      window.clearTimeout(idle.current)
      idle.current = window.setTimeout(() => setAwake(false), IDLE_MS)
    }
    wake()
    window.addEventListener('pointermove', wake)
    window.addEventListener('pointerdown', wake)
    return () => {
      window.clearTimeout(t)
      window.clearTimeout(idle.current)
      window.removeEventListener('pointermove', wake)
      window.removeEventListener('pointerdown', wake)
    }
  }, [on])

  const t = useT()
  if (!on) return null

  return (
    <div className="ui-photo">
      <div className={`ui-photo__hint ui-panel${hint ? ' is-visible' : ''}`} role="status">
        <IconCamera />
        {coarse ? (
          <span>{rich(t('photo.hintTouch'), { capture: <strong>{t('photo.captureWord')}</strong>, close: <strong>✕</strong> })}</span>
        ) : (
          <span>{rich(t('photo.hintDesktop'), { esc: <kbd className="ui-kbd">Esc</kbd>, enter: <kbd className="ui-kbd">Enter</kbd> })}</span>
        )}
      </div>
      <div className={`ui-photo__bar ui-panel ui-interactive${awake || coarse ? ' is-awake' : ''}`}>
        <button type="button" className="ui-photo__shutter" aria-label={t('photo.capture')} onClick={() => void capturePhoto()}>
          <span aria-hidden="true" />
          {t('photo.captureWord')}
        </button>
        <RayTraceToggle />
        <button type="button" className="ui-icon-btn" aria-label={t('photo.exit')} onClick={exitPhotoMode}>
          <IconClose />
        </button>
      </div>
      <FramesRow awake={awake || coarse} />
      {flash > 0 && <div key={flash} className="ui-photo__flash" aria-hidden="true" />}
    </div>
  )
}

/** Ray-traced view toggle + live sample counter (effects/PathTracer.tsx does the work). */
function RayTraceToggle() {
  const t = useT()
  const tier = useMuseum((s) => s.tier)
  const choice = useRayTrace((s) => s.enabled)
  const status = useRayTrace((s) => s.status)
  const samples = useRayTrace((s) => s.samples)
  const total = useRayTrace((s) => s.target)
  const setEnabled = useRayTrace((s) => s.setEnabled)
  if (status === 'unsupported') return null
  const on = choice ?? QUALITY_PRESETS[tier].pathTracing
  const label =
    !on || status === 'off'
      ? null
      : status === 'waiting'
        ? t('photo.rt.waiting')
        : status === 'building'
          ? t('photo.rt.building')
          : status === 'compiling'
            ? t('photo.rt.compiling')
            : status === 'converged'
              ? t('photo.rt.converged', { n: String(samples) })
              : t('photo.rt.tracing', { n: String(samples), total: String(total) })
  return (
    <>
      {label && (
        <span
          role="status"
          aria-live="polite"
          style={{ font: '500 11px/1.2 Inter, system-ui, sans-serif', letterSpacing: '0.04em', color: 'var(--ink-soft, #6b6157)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', padding: '0 4px' }}
        >
          {label}
        </span>
      )}
      <button
        type="button"
        className="ui-icon-btn"
        aria-pressed={on}
        aria-label={t('photo.raytraceHint')}
        title={t('photo.raytraceHint')}
        onClick={() => setEnabled(!on)}
        style={{ width: 'auto', padding: '0 10px', font: '600 11px/1 Inter, system-ui, sans-serif', letterSpacing: '0.08em', textTransform: 'uppercase' }}
      >
        {t('photo.raytrace')}
      </button>
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Frames row                                                          */
/* ------------------------------------------------------------------ */

const FRAMES_CSS = `
.ui-frames { position: fixed; left: 50%; bottom: calc(var(--safe-b, 0px) + 86px); transform: translateX(-50%);
  display: flex; align-items: center; gap: 6px; padding: 6px 8px; max-width: calc(100vw - 24px); overflow-x: auto;
  opacity: 0; transition: opacity 400ms var(--ease, ease); scrollbar-width: none; }
.ui-frames.is-awake { opacity: 1; }
.ui-frames__label { font: 500 10.5px/1 var(--font-ui, Inter, sans-serif); letter-spacing: .22em; text-transform: uppercase;
  color: var(--muted, #6f665c); padding: 0 6px 0 4px; white-space: nowrap; }
.ui-frames__chip { appearance: none; border: 1px solid var(--hairline, rgba(43,38,33,.14)); background: transparent;
  color: var(--ink, #2b2621); border-radius: 999px; padding: 7px 12px; white-space: nowrap; cursor: pointer;
  font: 500 12px/1 var(--font-ui, Inter, sans-serif); transition: background 160ms, border-color 160ms; }
.ui-frames__chip:hover, .ui-frames__chip:focus-visible { background: rgba(43,38,33,.07); outline: none; }
.ui-frames__chip:focus-visible { box-shadow: 0 0 0 2px var(--accent, #8a5a3b); }
.ui-frames__chip.is-on { background: var(--accent, #8a5a3b); border-color: var(--accent, #8a5a3b); color: var(--accent-ink, #fbf7f0); }
@media (max-width: 600px) { .ui-frames { bottom: calc(var(--safe-b, 0px) + 78px); } .ui-frames__label { display: none; } }
`

/** Frames of Clay: the framed views, as a row of chips above the shutter bar. */
function FramesRow({ awake }: { awake: boolean }) {
  const frame = usePhoto((s) => s.frame)
  const lang = useLang()
  const x = useXT()
  const frames = photoFrames()
  if (!frames.length) return null
  return (
    <div className={`ui-frames ui-panel ui-interactive${awake ? ' is-awake' : ''}`} role="group" aria-label={x('xp.frames')}>
      <style>{FRAMES_CSS}</style>
      <span className="ui-frames__label">{x('xp.frames')}</span>
      {frames.map((f) => (
        <button key={f.id} type="button" className={`ui-frames__chip${frame === f.id ? ' is-on' : ''}`} aria-pressed={frame === f.id} onClick={() => applyFrame(f.id)}>
          {loc(f, 'title', lang) ?? f.title}
        </button>
      ))}
    </div>
  )
}
