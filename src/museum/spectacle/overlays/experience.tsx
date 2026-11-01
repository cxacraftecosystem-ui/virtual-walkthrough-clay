/**
 * HTML overlay of the experience moments (SPECTACLE F4, F30–F33), inside SpectacleOverlays:
 *
 *  • the caption strip: every sound and music change named at the foot of the view, while the
 *    visitor has sound captions on (Help → settings);
 *  • the Clay Passport: the tablet, the toast after each press, and what a press does — a
 *    thunk, a haptic pulse, an anonymous `stamp` event, a cue and a sound caption;
 *  • the prompt beside a stamp post ("Press the stamp · E"), a perch door ("Up to the balcony ·
 *    E" at the east stair, "Down into the Sphere Well · E" at the well's gate) and a photo spot
 *    ("P for Frames of Clay"), and those keys; Esc on a perch comes back down;
 *  • the rides: the edges of the view darken a little at the ride's middle and below grade in
 *    the well (Full), nothing over the view (Lite), or a dip to black (Still); then a note on
 *    arrival naming the perch and how to walk it;
 *  • the docent's "gather at the oculus" note.
 * Everything is announced to screen readers (a11y/A11yLayer `announce`).
 */
import { useEffect, useRef, useState } from 'react'
import { announce } from '../../a11y/A11yLayer'
import { track } from '../../analytics/tracker'
import { getAudioContext } from '../../media/audioEngine'
import { SCENE_OBJECTS } from '../../config/objects'
import { rich, useT, type DictKey } from '../../i18n'
import { perchEnabled, ridePose, usePerch, type PerchId } from '../../navigation/perch'
import { climb, descend, nearPerchDoor } from '../../navigation/perchActions'
import { useMuseum } from '../../state/store'
import { visitor } from '../../state/visitor'
import { PassportLayer } from '../../trail/PassportUI'
import { onStampPress, pressStamp, stampDef, usePassport } from '../../trail/passport'
import { applyFrame, usePhoto } from '../../ui/PhotoMode'
import { isCoarsePointer } from '../../ui/HelpOverlay'
import { useTour, tour } from '../../tour/engine'
import { caption, setCaptionsOn, useCaptions } from '../captions'
import { onCue, fireCue } from '../cues'
import { isXKey, useXT, xt, type XKey } from '../experienceText'
import { spectacleSettings } from '../settings'

const CSS = `
.ui-captions { position: fixed; left: 50%; bottom: calc(var(--edge) + var(--safe-b) + 110px); transform: translateX(-50%); z-index: 43;
  display: grid; gap: 4px; justify-items: center; pointer-events: none; max-width: min(640px, calc(100vw - 32px)); }
.ui-captions__line { padding: 5px 12px; border-radius: 4px; background: rgba(16, 12, 9, .78); color: #f6efe4;
  font: 500 14px/1.35 var(--font-ui); letter-spacing: .01em; text-align: center; animation: ui-cap-in 220ms var(--ease) both; }
.a11y-large .ui-captions__line { font-size: 17px; }
@keyframes ui-cap-in { from { opacity: 0; transform: translateY(4px) } to { opacity: 1; transform: none } }
.ui-xp-prompt { cursor: pointer; }
.ui-xp-note { position: fixed; left: 50%; top: calc(var(--edge) + var(--safe-t) + 70px); transform: translate(-50%, -6px); z-index: 43;
  padding: 10px 18px; border-radius: 999px; font: 500 13px/1.35 var(--font-ui); color: var(--ink); opacity: 0; pointer-events: none;
  transition: opacity 420ms var(--ease), transform 420ms var(--ease); text-align: center; max-width: calc(100vw - 32px); }
.ui-xp-note.is-on { opacity: 1; transform: translate(-50%, 0); }
.ui-xp-note small { display: block; font-weight: 400; font-size: 11.5px; color: var(--muted); margin-top: 2px; }
.ui-ride { position: fixed; inset: 0; z-index: 42; pointer-events: none; opacity: 0; transition: opacity 260ms ease; }
.ui-ride.is-on { opacity: 1; }
.ui-ride__dark { position: absolute; inset: 0; background: radial-gradient(120% 90% at 50% 50%, rgba(20,9,4,.2) 0%, rgba(14,6,3,.74) 100%); }
.ui-ride__dip { position: absolute; inset: 0; background: #0b0a09; opacity: 0; transition: opacity 360ms ease; }
.ui-ride__dip.is-on { opacity: 1; }
`

/* ------------------------------------------------------------------ */
/* Caption strip                                                       */
/* ------------------------------------------------------------------ */

function CaptionStrip() {
  const on = useCaptions((s) => s.on)
  const active = useCaptions((s) => s.active)
  const t = useT()
  const x = useXT()
  if (!on || !active.length) return null
  return (
    <div className="ui-captions" role="log" aria-live="polite" aria-label={t('spectacle.captions')}>
      {active.slice(-3).map((c) => (
        <div key={c.key} className="ui-captions__line">
          {isXKey(c.key) ? x(c.key) : t(c.key)}
        </div>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* A press: thunk, haptics, cue, event                                 */
/* ------------------------------------------------------------------ */

/** A short, low clay thunk (only with sound on, once audio is unlocked). */
function thunk() {
  if (!useMuseum.getState().soundOn) return
  const ctx = getAudioContext(false)
  if (!ctx || ctx.state !== 'running') return
  const t0 = ctx.currentTime + 0.17 // lands with the stamp
  const out = ctx.createGain()
  out.gain.value = 0.32
  out.connect(ctx.destination)
  const osc = ctx.createOscillator()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(130, t0)
  osc.frequency.exponentialRampToValueAtTime(52, t0 + 0.16)
  const og = ctx.createGain()
  og.gain.setValueAtTime(0.0001, t0)
  og.gain.exponentialRampToValueAtTime(1, t0 + 0.006)
  og.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.22)
  osc.connect(og).connect(out)
  const n = Math.floor(ctx.sampleRate * 0.09)
  const buf = ctx.createBuffer(1, n, ctx.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n) ** 2
  const noise = ctx.createBufferSource()
  noise.buffer = buf
  const lp = ctx.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = 900
  const ng = ctx.createGain()
  ng.gain.value = 0.5
  noise.connect(lp).connect(ng).connect(out)
  osc.start(t0)
  osc.stop(t0 + 0.26)
  noise.start(t0)
  osc.onended = () => out.disconnect()
}

function usePressEffects() {
  useEffect(
    () =>
      onStampPress((id, result, post) => {
        const name = xt(`xp.stamp.${id}` as XKey)
        if (result === 'locked') {
          announce(xt('xp.needsTheatre'))
          return
        }
        if (result === 'already') {
          announce(xt('xp.already'))
          return
        }
        const still = spectacleSettings().mode === 'still'
        if (post) {
          thunk()
          caption('caption.stamp' as DictKey, 2500)
          if (!still) {
            try {
              navigator.vibrate?.(28)
            } catch {
              /* no haptics */
            }
          }
        }
        announce(xt('xp.stamped', { name }))
        fireCue('passport:stamp', { source: 'visitor', data: { stamp: id } })
        const zone = stampDef(id)?.zone
        track('stamp', { itemId: id, zone })
      }),
    [],
  )
}

/* ------------------------------------------------------------------ */
/* Prompt and keys                                                     */
/* ------------------------------------------------------------------ */

type Target = { kind: 'stamp'; id: string; post: string; requires: string } | { kind: 'climb'; id: PerchId } | { kind: 'frame'; id: string } | null

const POSTS = () => SCENE_OBJECTS.filter((o) => o.kind === 'stamp-post')
const FRAMES = () => SCENE_OBJECTS.filter((o) => o.kind === 'photo-spot')
const STAMP_REACH = 1.7
const FRAME_REACH = 0.75

/** What the visitor stands beside (stamp post first, then a perch door, then a photo spot). */
function nearestTarget(): Target {
  const s = useMuseum.getState()
  if (s.phase !== 'entered' || usePerch.getState().perch || usePerch.getState().ride) return null
  let best: Target = null
  let bestD = Infinity
  for (const o of POSTS()) {
    const d = Math.hypot(visitor.x - o.position[0], visitor.z - o.position[2])
    if (d < STAMP_REACH && d < bestD) {
      bestD = d
      const p = o.props ?? {}
      best = { kind: 'stamp', id: String(p.stamp ?? ''), post: o.id, requires: String(p.requires ?? '') }
    }
  }
  if (best) return best
  const door = perchEnabled() ? nearPerchDoor() : null
  if (door) return { kind: 'climb', id: door.perches[0] }
  for (const o of FRAMES()) {
    const d = Math.hypot(visitor.x - o.position[0], visitor.z - o.position[2])
    if (d < FRAME_REACH && d < bestD) {
      bestD = d
      best = { kind: 'frame', id: o.id }
    }
  }
  return best
}

function act(t: Target) {
  if (!t) return
  if (t.kind === 'stamp') pressStamp(t.id, t.post, t.requires)
  else if (t.kind === 'climb') {
    if (useTour.getState().active) tour.pause()
    climb(t.id)
  } else applyFrame(t.id)
}

const isTyping = (e: KeyboardEvent) => {
  const el = e.target as HTMLElement | null
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)
}

function useTarget(): Target {
  const [target, setTarget] = useState<Target>(null)
  const key = useRef('')
  useEffect(() => {
    const id = window.setInterval(() => {
      const t = nearestTarget()
      const k = t ? `${t.kind}:${'id' in t ? t.id : ''}` : ''
      if (k !== key.current) {
        key.current = k
        setTarget(t)
      }
    }, 250)
    return () => window.clearInterval(id)
  }, [])
  return target
}

/** E (stamp, ride), P beside a photo spot, Esc on a perch. Runs before the pavilion's own shortcuts. */
function useKeys(target: Target) {
  const ref = useRef(target)
  useEffect(() => {
    ref.current = target
  })
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || e.repeat || isTyping(e)) return
      const s = useMuseum.getState()
      if (s.phase !== 'entered' || s.inspecting || s.helpOpen || s.selection) return
      const P = usePerch.getState()
      if (e.key === 'Escape' && P.perch && !P.ride && !usePhoto.getState().on) {
        descend()
      } else if ((e.key === 'e' || e.key === 'E') && !s.nearby && ref.current && ref.current.kind !== 'frame') {
        act(ref.current)
      } else if ((e.key === 'p' || e.key === 'P') && !usePhoto.getState().on && ref.current?.kind === 'frame') {
        act(ref.current)
      } else return
      e.preventDefault()
      e.stopImmediatePropagation()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [])
}

function Prompt({ target }: { target: Target }) {
  const t = useT()
  const x = useXT()
  const nearby = useMuseum((s) => !!s.nearby)
  const blocked = useMuseum((s) => s.phase !== 'entered' || !!s.selection || !!s.inspecting || s.helpOpen)
  const photo = usePhoto((s) => s.on)
  const touring = useTour((s) => s.active && !s.paused)
  const [last, setLast] = useState<Target>(target)
  if (target && target !== last) setLast(target)
  const shown = target ?? last
  const visible = !!target && !nearby && !blocked && !photo && !touring
  const coarse = isCoarsePointer()
  if (!shown) return null
  const title = shown.kind === 'stamp' ? x(`xp.stamp.${shown.id}` as XKey) : shown.kind === 'climb' ? x(`xp.ride.${shown.id}` as XKey) : x('xp.frames')
  const action =
    shown.kind === 'stamp' ? t('spectacle.stamp') : shown.kind === 'climb' ? '' : x('xp.frameGo')
  const key = shown.kind === 'frame' ? 'P' : 'E'
  return (
    <button
      type="button"
      className={`ui-prompt ui-panel ui-xp-prompt${visible ? ' is-visible' : ''}`}
      aria-hidden={!visible || undefined}
      tabIndex={visible ? 0 : -1}
      onClick={() => act(shown)}
    >
      <span className="ui-prompt__title">{title}</span>
      <span className="ui-prompt__sep" aria-hidden="true">
        ·
      </span>
      <span className="ui-prompt__action">
        {action ? `${action} ` : ''}
        {coarse ? t('prompt.tap') : rich('{key}', { key: <kbd className="ui-kbd">{key}</kbd> })}
      </span>
    </button>
  )
}

/* ------------------------------------------------------------------ */
/* The ride                                                            */
/* ------------------------------------------------------------------ */

/** The rides: the view's edges darken at the ride's middle and below grade (Full); Still dips to black. */
function RideOverlay() {
  const ride = usePerch((s) => s.ride)
  const [dark, setDark] = useState(0)
  const [dip, setDip] = useState(false)
  useEffect(() => {
    if (!ride) {
      setDark(0)
      setDip(false)
      return
    }
    let raf = 0
    const tick = () => {
      raf = requestAnimationFrame(tick)
      const u = Math.min(1, ride.elapsed / ride.dur)
      if (ride.still) {
        setDip(u > 0.12 && u < 0.88)
        return
      }
      if (ride.lite) return
      const pose = ridePose(ride.dir === 'up' ? u : 1 - u, ride.t, ride.path)
      setDark(Math.round(pose.shade * 50) / 50)
    }
    tick()
    return () => cancelAnimationFrame(raf)
  }, [ride])
  return (
    <div className={`ui-ride${ride ? ' is-on' : ''}`} aria-hidden="true">
      {ride && !ride.still && !ride.lite && <div className="ui-ride__dark" style={{ opacity: dark }} />}
      <div className={`ui-ride__dip${dip ? ' is-on' : ''}`} />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Notes (perch arrival, back down, docent gather)                     */
/* ------------------------------------------------------------------ */

/** The perch a cue is about (its data), the Sky Rim by default. */
const perchOf = (data: unknown): PerchId => {
  const p = (data as { perch?: string } | undefined)?.perch
  return p === 'duplex' || p === 'sphere-well' ? p : 'sky-rim'
}

function Notes() {
  const [note, setNote] = useState<{ text: string; sub?: string; n: number } | null>(null)
  const [on, setOn] = useState(false)
  useEffect(() => {
    const show = (text: string, sub?: string, ms = 5200) => {
      setNote((p) => ({ text, sub, n: (p?.n ?? 0) + 1 }))
      setOn(true)
      announce(sub ? `${text} ${sub}` : text)
      window.clearTimeout(timer)
      timer = window.setTimeout(() => setOn(false), ms)
    }
    let timer = 0
    const offs = [
      onCue('perch:arrive', (e) => {
        const id = perchOf(e.data)
        show(xt(`xp.on.${id}` as XKey), isCoarsePointer() ? undefined : xt(`xp.onHint.${id}` as XKey), 6500)
      }),
      onCue('perch:climb', (e) => announce(xt(`xp.riding.${perchOf(e.data)}` as XKey))),
      onCue('perch:descend', (e) => announce(xt(perchOf(e.data) === 'sphere-well' ? 'xp.risingWell' : 'xp.descending'))),
      onCue('perch:leave', (e) => {
        if (e.source === 'visitor') show(xt(perchOf(e.data) === 'sphere-well' ? 'xp.backWell' : 'xp.back'), undefined, 3200)
      }),
      onCue('gather:oculus', (e) => {
        if (e.source === 'docent' && !(e.data as { self?: boolean } | undefined)?.self) show(xt('xp.gather'), undefined, 4200)
      }),
    ]
    return () => {
      offs.forEach((f) => f())
      window.clearTimeout(timer)
    }
  }, [])
  if (!note) return null
  return (
    <div className={`ui-xp-note ui-panel${on ? ' is-on' : ''}`} role="status" aria-hidden={!on || undefined}>
      {note.text}
      {note.sub && <small>{note.sub}</small>}
    </div>
  )
}

/* ------------------------------------------------------------------ */

// Automation / console handle (like window.__photo); the cut-away demo only outside production.
if (typeof window !== 'undefined') {
  ;(window as unknown as { __xp?: unknown }).__xp = {
    usePassport,
    pressStamp,
    applyFrame,
    caption,
    setCaptionsOn,
    usePerch,
    ...(process.env.NODE_ENV !== 'production'
      ? {
          /** Open the 3D viewer on an object as if the curator had recorded how it was built. */
          inspectSection(id: string, section: string) {
            const o = SCENE_OBJECTS.find((x) => x.id === id)
            if (!o) return false
            o.props = { ...(o.props ?? {}), section }
            o.placeholder = false
            useMuseum.getState().inspect(`object:${id}`)
            return true
          },
        }
      : {}),
  }
}

export function ExperienceOverlay() {
  const target = useTarget()
  useKeys(target)
  usePressEffects()
  return (
    <>
      <style>{CSS}</style>
      <RideOverlay />
      <Prompt target={target} />
      <Notes />
      <PassportLayer />
      <CaptionStrip />
    </>
  )
}
