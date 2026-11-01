import { useEffect, useMemo, useRef, useState } from 'react'
import { useMuseum } from '../state/store'
import { teleport, visitor } from '../state/visitor'
import { BENCHES, BENCH_SIZE, PODIUM, PODIUM_SLOTS, ZONES, zoneAt, type Zone, type ZoneId } from '../config/layout'
import { FLOOR_PLAN } from '../config/plan'
import { MUSEUM } from '../config/museum'
import { SCENE_OBJECTS } from '../config/objects'
import { IconMap, IconMinus } from './icons'
import { translate, useLang, useT, type Lang } from '../i18n'
import { zoneName } from '../i18n/content'
import { perchZone, usePerch } from '../navigation/perch'

/* ------------------------------------------------------------------ */
/* Travel fade (shared by minimap "go to" and HUD reset)               */
/* ------------------------------------------------------------------ */

const FADE_MS = 450
type FadeListener = (on: boolean) => void
const fadeListeners = new Set<FadeListener>()
let travelling = false

/** Fade to warm white, run `move` while hidden, fade back. */
export function travel(move: () => void) {
  if (travelling) return
  travelling = true
  if (fadeListeners.size === 0) {
    move()
    travelling = false
    return
  }
  fadeListeners.forEach((l) => l(true))
  window.setTimeout(() => {
    try {
      move()
    } finally {
      window.setTimeout(() => {
        fadeListeners.forEach((l) => l(false))
        travelling = false
      }, 120)
    }
  }, FADE_MS)
}

export function TravelFade() {
  const [on, setOn] = useState(false)
  useEffect(() => {
    fadeListeners.add(setOn)
    return () => {
      fadeListeners.delete(setOn)
    }
  }, [])
  return <div className={`ui-fade${on ? ' is-on' : ''}`} aria-hidden="true" />
}

/* ------------------------------------------------------------------ */
/* Map geometry (from FLOOR_PLAN: the same paths the admin heatmap draws) */
/* ------------------------------------------------------------------ */

const B = FLOOR_PLAN.bounds

/** Plan aspect (width / height) — the SVG sizes itself from this. */
export const MAP_ASPECT = (B.maxX - B.minX) / (B.maxZ - B.minZ)

const VIEWBOX = `${B.minX} ${B.minZ} ${B.maxX - B.minX} ${B.maxZ - B.minZ}`

/**
 * Marks and labels are sized in plan metres: the grand plan is about 2.2 times the size of the
 * pavilion they were drawn for, so they grow with it and keep their size on screen.
 */
const K = 2.2

interface ZoneLabel {
  small: string
  big?: string
  /** Font size in metres (plan units). */
  size: number
}

/** Label shown in the plan; the three galleries use a big letter. */
function zoneLabel(id: ZoneId, lang: Lang = 'en'): ZoneLabel {
  const short = zoneName(id, lang, true)
  if (id.startsWith('ring-')) return { small: translate(lang, 'map.gallery'), big: id.slice(-1).toUpperCase(), size: 0.72 * K }
  if (id === 'entrance-court') return { small: short, size: 1.05 * K }
  // the Parikrama is a narrow band round the ring: a smaller label keeps it off the galleries'
  if (id.startsWith('parikrama-')) return { small: short, size: 0.5 * K }
  return { small: short, size: 0.7 * K }
}

/** Furniture & installations drawn faintly for orientation (skip foliage/props). */
const PLAN_OBJECTS = SCENE_OBJECTS.filter((o) => o.footprint && !['tree', 'planter'].includes(o.kind))

/** Polygon points of an oriented footprint (rotation about +y, three.js convention). */
function footprintPoints(x: number, z: number, rotationY: number, w: number, d: number) {
  const ux = Math.cos(rotationY)
  const uz = -Math.sin(rotationY)
  const hx = w / 2
  const hz = d / 2
  return [
    [-hx, -hz],
    [hx, -hz],
    [hx, hz],
    [-hx, hz],
  ]
    .map(([u, v]) => `${(x + u * ux - v * uz).toFixed(3)},${(z + u * uz + v * ux).toFixed(3)}`)
    .join(' ')
}

const CONE_LEN = 4.6 * K
const CONE_HALF = (34 * Math.PI) / 180
const CONE_PATH = `M0 0 L${-Math.sin(CONE_HALF) * CONE_LEN} ${-Math.cos(CONE_HALF) * CONE_LEN} A${CONE_LEN} ${CONE_LEN} 0 0 1 ${
  Math.sin(CONE_HALF) * CONE_LEN
} ${-Math.cos(CONE_HALF) * CONE_LEN} Z`

export function Minimap() {
  const phase = useMuseum((s) => s.phase)
  const mapOpen = useMuseum((s) => s.mapOpen)
  const setMapOpen = useMuseum((s) => s.setMapOpen)
  const selection = useMuseum((s) => s.selection)
  const inspecting = useMuseum((s) => s.inspecting)
  const markerRef = useRef<SVGGElement>(null)
  const t = useT()
  const lang = useLang()
  const [current, setCurrent] = useState<ZoneId | undefined>(undefined)
  // on a perch (the Sky Rim, the balcony, the Sphere Well) the plan shows a badge at its place
  const perchOn = usePerch((s) => s.perch?.zone ?? null)
  const perchAnchor = perchOn ? (ZONES.find((z) => z.id === perchOn)?.anchor ?? [0, 0]) : null
  const [narrow, setNarrow] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 720)

  useEffect(() => {
    const onResize = () => setNarrow(window.innerWidth <= 720)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // Per-frame marker update (no React re-render).
  useEffect(() => {
    if (!mapOpen || phase !== 'entered') return
    let raf = 0
    let lastZone: ZoneId | undefined
    let frame = 0
    const tick = () => {
      const g = markerRef.current
      if (g) {
        const deg = (-visitor.yaw * 180) / Math.PI
        g.setAttribute('transform', `translate(${visitor.x.toFixed(3)} ${visitor.z.toFixed(3)}) rotate(${deg.toFixed(2)})`)
      }
      if (frame++ % 15 === 0) {
        const z = perchZone() ?? zoneAt(visitor.x, visitor.z)?.id
        if (z !== lastZone) {
          lastZone = z
          setCurrent(z)
        }
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [mapOpen, phase])

  const walls = useMemo(() => FLOOR_PLAN.walls.map((w) => <path key={w.id} className={`ui-map__wall ui-map__wall--${w.kind}`} d={w.d} />), [])

  const items = useMemo(
    () => [
      ...BENCHES.map((b) => (
        <polygon key={b.id} className="ui-map__bench" points={footprintPoints(b.x, b.z, b.along === 'x' ? 0 : Math.PI / 2, BENCH_SIZE.length, BENCH_SIZE.depth)} />
      )),
      ...PODIUM_SLOTS.map((p) => <polygon key={p.id} className="ui-map__podium" points={footprintPoints(p.x, p.z, p.rotationY, PODIUM.size * 1.6, PODIUM.size * 1.6)} />),
      ...PLAN_OBJECTS.map((o) => (
        <polygon
          key={o.id}
          className="ui-map__bench ui-map__object"
          points={footprintPoints(o.position[0], o.position[2], ((o.rotationDeg ?? 0) * Math.PI) / 180, o.footprint![0], o.footprint![1])}
        />
      )),
    ],
    [],
  )

  if (phase !== 'entered') return null

  const go = (z: Zone) => {
    travel(() => teleport(z.spawn.x, z.spawn.z, z.spawn.yawDeg))
    if (narrow) setMapOpen(false)
  }

  // On phones the map yields to the info sheet.
  const hiddenForSheet = narrow && (!!selection || !!inspecting)

  return (
    <div className="ui-map" style={hiddenForSheet ? { opacity: 0, pointerEvents: 'none' } : undefined}>
      {mapOpen ? (
        <div className="ui-map__card ui-panel ui-interactive">
          <div className="ui-map__head">
            <span className="ui-kicker">{t('map.title')}</span>
            <button type="button" className="ui-icon-btn" aria-label={t('map.hide')} onClick={() => setMapOpen(false)}>
              <IconMinus />
            </button>
          </div>
          <svg className="ui-map__svg" viewBox={VIEWBOX} style={{ aspectRatio: String(MAP_ASPECT), ['--map-aspect' as string]: String(MAP_ASPECT) }} role="group" aria-label={t('map.group')}>
            <defs>
              <radialGradient id="ui-map-cone" cx="0" cy="0" r={CONE_LEN} gradientUnits="userSpaceOnUse">
                <stop offset="0" stopColor="#8a5a3b" stopOpacity="0.42" />
                <stop offset="1" stopColor="#8a5a3b" stopOpacity="0" />
              </radialGradient>
            </defs>

            {FLOOR_PLAN.zones.map((z) => (
              <path key={`f-${z.id}`} className={`ui-map__floor ui-map__floor--${z.id}`} d={z.d} />
            ))}
            <circle className="ui-map__oculus" cx={0} cy={0} r={MUSEUM.oculus.r} />

            {items}
            {walls}

            {FLOOR_PLAN.zones.map((pz) => {
              const z = ZONES.find((zz) => zz.id === pz.id)!
              const l = zoneLabel(z.id, lang)
              const cx = pz.cx
              const cy = pz.cz
              const isCur = current === z.id
              return (
                <g key={z.id} className={`ui-map__zone-g${isCur ? ' is-current' : ''}`}>
                  <path
                    className={`ui-map__zone${isCur ? ' is-current' : ''}`}
                    d={pz.d}
                    role="button"
                    tabIndex={0}
                    aria-label={t('map.goTo', { room: zoneName(z.id, lang) })}
                    aria-current={isCur ? 'location' : undefined}
                    onClick={() => go(z)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        go(z)
                      }
                    }}
                  >
                    <title>{t('map.goTo', { room: zoneName(z.id, lang) })}</title>
                  </path>
                  {l.big ? (
                    <>
                      <text className="ui-map__label" x={cx} y={cy - 1.75 * K} style={{ fontSize: l.size }}>
                        {l.small}
                      </text>
                      <text className="ui-map__label ui-map__label--big" x={cx} y={cy + 0.35 * K}>
                        {l.big}
                      </text>
                    </>
                  ) : (
                    <text className={`ui-map__label${l.size >= 1 ? ' ui-map__label--room' : ''}`} x={cx} y={cy} dominantBaseline="middle" style={{ fontSize: l.size }}>
                      {l.small}
                    </text>
                  )}
                </g>
              )
            })}

            {perchOn && perchAnchor && (
              <text className="ui-map__roof" x={perchAnchor[0]} y={perchOn === 'sky-rim' ? -MUSEUM.oculus.r - 0.9 * K : perchAnchor[1]}>
                {zoneName(perchOn, lang, true)}
              </text>
            )}

            <g ref={markerRef} style={{ pointerEvents: 'none' }}>
              <path className="ui-map__cone" d={CONE_PATH} />
              <circle className="ui-map__dot" r={0.5 * K} />
            </g>

            <g transform={`translate(${B.minX + 1.6} ${B.minZ + 1.8}) scale(2.2)`} aria-hidden="true">
              <path d="M0 -0.42 L0.2 0.18 L0 0.06 L-0.2 0.18 Z" fill="#6f665c" />
              <text className="ui-map__north" y={0.78}>
                N
              </text>
            </g>
          </svg>
        </div>
      ) : (
        <button type="button" className="ui-map__toggle ui-panel" aria-label={t('map.show')} onClick={() => setMapOpen(true)}>
          <IconMap />
          <span>{t('map.button')}</span>
        </button>
      )}
    </div>
  )
}
