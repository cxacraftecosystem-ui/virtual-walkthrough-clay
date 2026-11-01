/**
 * DAY DIAL (SPECTACLE F9) — today's real sun over Kharagpur, drawn as its path: elevation through
 * the 24 hours, the horizon, sunrise and sunset. The sun rides the curve at the time being
 * shown; drag it (or use the keys) and the light follows, the patch sweeping across the court.
 *
 * A slider for assistive technology: arrows ±15 min, Page Up/Down ±1 h, Home / End to sunrise /
 * sunset. Dragging holds a manual time; "Live sun" (in AtmosphereMenu) returns to the clock.
 */
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { clockLabel, istDay, istHoursNow, sunAt, sunriseSunset } from '../lighting/atmosphere/dayCurve'
import { useMuseum } from '../state/store'
import { useAtmosText } from './atmosphereText'

const W = 248
const H = 112
const PAD = 12
const HORIZON = 80
/** px per degree of elevation (above and below the horizon). */
const KY = 0.5

const xOf = (h: number) => PAD + ((((h % 24) + 24) % 24) / 24) * (W - 2 * PAD)
const yOf = (el: number) => HORIZON - Math.max(-58, Math.min(90, el)) * KY

export function DayDial({ disabled = false, label }: { disabled?: boolean; label: string }) {
  const tx = useAtmosText()
  const mode = useMuseum((s) => s.timeMode)
  const held = useMuseum((s) => s.dayHours)
  const setDayHours = useMuseum((s) => s.setDayHours)
  // the live clock moves: re-read it every 30 s
  const [now, setNow] = useState(() => istHoursNow())
  useEffect(() => {
    if (mode !== 'live') return
    const id = window.setInterval(() => setNow(istHoursNow()), 30000)
    return () => window.clearInterval(id)
  }, [mode])
  const hours = mode === 'live' ? now : held

  const day = useMemo(() => istDay(), [])
  const { path, dayFill, rise, set } = useMemo(() => {
    const pts: [number, number][] = []
    for (let i = 0; i <= 96; i++) {
      const h = (i / 96) * 24
      pts.push([xOf(h), yOf(sunAt(day, h).elevationDeg)])
    }
    const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ')
    const { rise, set } = sunriseSunset(day)
    // the part above the horizon, closed along it
    const n = 48
    const top = Array.from({ length: n + 1 }, (_, i) => {
      const h = rise + ((set - rise) * i) / n
      return `L${xOf(h).toFixed(1)} ${Math.min(HORIZON, yOf(sunAt(day, h).elevationDeg)).toFixed(1)}`
    })
    const fill = set > rise ? `M${xOf(rise).toFixed(1)} ${HORIZON} ${top.join(' ')} L${xOf(set).toFixed(1)} ${HORIZON} Z` : ''
    return { path: d, dayFill: fill, rise, set }
  }, [day])

  const sun = sunAt(day, hours)
  const sx = xOf(hours)
  const sy = yOf(sun.elevationDeg)
  const up = sun.elevationDeg > -0.8

  const svg = useRef<SVGSVGElement>(null)
  const dragging = useRef(false)
  const fromPointer = (e: PointerEvent) => {
    const r = svg.current?.getBoundingClientRect()
    if (!r) return
    const x = ((e.clientX - r.left) / r.width) * W
    const h = Math.min(23.99, Math.max(0, ((x - PAD) / (W - 2 * PAD)) * 24))
    setDayHours(Math.round(h * 12) / 12)
  }
  const onDown = (e: PointerEvent<SVGSVGElement>) => {
    if (disabled) return
    dragging.current = true
    e.currentTarget.setPointerCapture(e.pointerId)
    fromPointer(e)
  }
  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    if (dragging.current) fromPointer(e)
  }
  const onUp = () => {
    dragging.current = false
  }
  const onKey = (e: KeyboardEvent) => {
    if (disabled) return
    const step = { ArrowRight: 0.25, ArrowUp: 0.25, ArrowLeft: -0.25, ArrowDown: -0.25, PageUp: 1, PageDown: -1 }[e.key]
    let h: number | null = step !== undefined ? hours + step : null
    if (e.key === 'Home') h = rise
    if (e.key === 'End') h = set
    if (h === null) return
    e.preventDefault()
    e.stopPropagation()
    setDayHours(h)
  }

  return (
    <div className="ui-daydial" data-disabled={disabled || undefined}>
      <div className="ui-daydial__clock" aria-hidden="true">
        <span className="ui-daydial__time">{clockLabel(hours)}</span>
        <small>{tx('istNow')}</small>
      </div>
      <svg
        ref={svg}
        className="ui-daydial__svg"
        viewBox={`0 0 ${W} ${H}`}
        role="slider"
        tabIndex={disabled ? -1 : 0}
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={24}
        aria-valuenow={Math.round(hours * 100) / 100}
        aria-valuetext={clockLabel(hours)}
        aria-disabled={disabled || undefined}
        aria-describedby="ui-daydial-help"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onKeyDown={onKey}
      >
        <defs>
          <linearGradient id="ui-daydial-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#e0a06a" stopOpacity="0.38" />
            <stop offset="1" stopColor="#c96a58" stopOpacity="0.06" />
          </linearGradient>
        </defs>
        {dayFill && <path d={dayFill} fill="url(#ui-daydial-sky)" />}
        <line x1={PAD} x2={W - PAD} y1={HORIZON} y2={HORIZON} className="ui-daydial__horizon" />
        <path d={path} className="ui-daydial__path" />
        {[rise, set].map((h, i) => (
          <g key={i} transform={`translate(${xOf(h).toFixed(1)} ${HORIZON})`}>
            <line y1={-4} y2={4} className="ui-daydial__tick" />
            <text y={18} textAnchor="middle" className="ui-daydial__label">
              {clockLabel(h)}
            </text>
            <title>{tx(i ? 'sunset' : 'sunrise')}</title>
          </g>
        ))}
        {/* the sun (or, below the horizon, the moon's cue: a hollow disc) */}
        <circle cx={sx} cy={sy} r={up ? 10 : 7} className={up ? 'ui-daydial__halo' : 'ui-daydial__halo ui-daydial__halo--night'} />
        <circle cx={sx} cy={sy} r={up ? 5.5 : 4.5} className={up ? 'ui-daydial__sun' : 'ui-daydial__sun ui-daydial__sun--night'} />
      </svg>
      <p id="ui-daydial-help" className="ui-sr">
        {tx('dialHelp')}
      </p>
    </div>
  )
}
