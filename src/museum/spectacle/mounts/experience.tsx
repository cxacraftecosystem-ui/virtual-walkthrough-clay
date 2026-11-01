/**
 * In-scene mount of the experience moments (SPECTACLE F4, F30–F33), inside Spectacle.tsx.
 *
 *  • keeps the Clay Passport's requirements: seconds spent in each zone (the theatre stamp asks
 *    for a minute), a film chapter seen to its end (cue `theatre:chapterEnd`);
 *  • awards the stamps without a post: one for arriving on each perch (the balcony, the Sky Rim,
 *    the Sphere Well), "The Red Room" for standing under its disc of sky, and "Made a pot" when
 *    a pot is fired in the clay studio (while it is open);
 *  • the docent's "gather at the oculus": followers walk (or, Still, fade) to the court curb;
 *  • `__museum.perch(id, t)` / `__museum.climb(id)` / `__museum.descend()` /
 *    `__museum.leavePerch()` (at once, where the visitor stands) for the harness and the console;
 *  • `?shots`: the development build's issue indicator is hidden too, so captures show the
 *    building only.
 * The stamp posts and photo spots (config/spectacleObjects/experience.ts) and the perch doors
 * (config/grandObjects/experience.ts) are scene objects; the rides play in VisitorController.
 */
import { useFrame } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import { zoneAt } from '../../config/layout'
import { KEY, polar } from '../../config/museum'
import { RED_ROOM } from '../../config/satellites'
import { compassTo, isPerchId, perchZone, type PerchId } from '../../navigation/perch'
import { climb, descend, leavePerch, perchAt } from '../../navigation/perchActions'
import { useMuseum } from '../../state/store'
import { teleport, visitor } from '../../state/visitor'
import { useClayStudio } from '../../studio/clayStore'
import { goToPose } from '../../tour/navigate'
import { addZoneTime, awardStamp, markFilmSeen, usePassport, type StampId } from '../../trail/passport'
import { onCue } from '../cues'
import { spectacleSettings } from '../settings'

/** Standing just outside the court's curb, on the visitor's side, facing the oculus. */
const CURB_R = KEY.curbR + 0.9
/** The stamp each perch's arrival awards. */
const PERCH_STAMP: Record<PerchId, StampId> = { duplex: 'duplex', 'sky-rim': 'sky-rim', 'sphere-well': 'sphere-well' }
/** Under the Red Room's oculus: this close to its centre counts as standing in the room. */
const RED_ROOM_IN = RED_ROOM.r - 0.4
/** Hidden while capturing (`?shots`): the development build's issue indicator. */
const SHOTS_CSS = 'nextjs-portal{display:none!important}'

function gatherAtOculus() {
  if (useMuseum.getState().phase !== 'entered') return
  if (perchZone()) leavePerch(true)
  const a = (Math.atan2(visitor.z, visitor.x) * 180) / Math.PI
  const [x, z] = polar(CURB_R, a)
  const pose = { x, z, yawDeg: compassTo(x, z, 0, 0), pitchDeg: 6 }
  if (spectacleSettings().mode === 'still') teleport(pose.x, pose.z, pose.yawDeg, pose.pitchDeg)
  else goToPose(pose)
}

/** The perch handles on `window.__museum` (harmless to leave in place: they act only when called). */
function installHooks() {
  const m = (window as unknown as { __museum?: Record<string, unknown> }).__museum
  if (!m || m.perch) return
  m.perch = (id?: string, t?: number) => perchAt(id ?? 'sky-rim', t)
  m.climb = (id?: string) => climb(id)
  m.descend = () => descend()
  m.leavePerch = () => leavePerch(false)
}

export function ExperienceMount() {
  const clock = useRef({ acc: 0 })

  // seconds in each zone (4 Hz is plenty for "a minute in the theatre")
  useFrame((_, dt) => {
    if (useMuseum.getState().phase !== 'entered') return
    const c = clock.current
    c.acc += Math.min(dt, 0.1)
    if (c.acc < 0.25) return
    const z = perchZone() ?? zoneAt(visitor.x, visitor.z)?.id
    if (z) addZoneTime(z, c.acc)
    c.acc = 0
    // the Red Room: standing under its disc of sky
    if (z === 'library' && !usePassport.getState().stamps['red-room'] && Math.hypot(visitor.x - RED_ROOM.cx, visitor.z - RED_ROOM.cz) < RED_ROOM_IN) awardStamp('red-room')
  })

  useEffect(() => {
    const offs = [
      onCue('perch:arrive', (e) => {
        const id = (e.data as { perch?: string } | undefined)?.perch
        if (isPerchId(id)) awardStamp(PERCH_STAMP[id])
      }),
      onCue('theatre:chapterEnd', () => {
        if ((zoneAt(visitor.x, visitor.z)?.id ?? '') === 'theatre') markFilmSeen('theatre')
      }),
      onCue('gather:oculus', (e) => {
        if (e.source === 'docent' && !(e.data as { self?: boolean } | undefined)?.self) gatherAtOculus()
      }),
    ]
    // a pot fired in the clay studio
    const unPot = useClayStudio.subscribe((s, p) => {
      if (s.pot.fired && !p.pot.fired && useMuseum.getState().phase === 'entered') awardStamp('pot')
    })
    return () => {
      offs.forEach((f) => f())
      unPot()
    }
  }, [])

  // harness / console handles on the shared automation object (installed again if the object is replaced)
  useEffect(() => {
    installHooks()
    const id = window.setInterval(installHooks, 1000)
    let style: HTMLStyleElement | null = null
    if (new URLSearchParams(window.location.search).has('shots')) {
      style = document.createElement('style')
      style.textContent = SHOTS_CSS
      document.head.appendChild(style)
    }
    return () => {
      window.clearInterval(id)
      style?.remove()
    }
  }, [])

  return null
}
