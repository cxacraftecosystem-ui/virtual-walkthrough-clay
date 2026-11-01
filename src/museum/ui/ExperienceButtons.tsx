/**
 * HUD slot: the Clay Passport and the perch rides (SPECTACLE F4, F31; GRAND §8 P5).
 *
 * The passport button is always there. At a perch door (while the rides are offered) one button
 * per perch the door leads to: at the east stair "Up to the balcony" and "Up to the Sky Rim",
 * at the Sphere Well's gate "Down into the Sphere Well". On a perch, "Come down".
 */
import { useEffect, useState } from 'react'
import { perchEnabled, usePerch, type PerchId } from '../navigation/perch'
import { climb, descend, nearPerchDoor } from '../navigation/perchActions'
import { useXT, type XKey } from '../spectacle/experienceText'
import { PassportButton } from '../trail/PassportUI'
import { tour, useTour } from '../tour/engine'

function IconClimb({ down }: { down: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M5 20h4v-4h4v-4h4V8h3" />
      <path d={down ? 'M8 4v6M5.5 7.5L8 10l2.5-2.5' : 'M8 10V4M5.5 6.5L8 4l2.5 2.5'} />
    </svg>
  )
}

function IconPerch({ id }: { id: PerchId }) {
  // the balcony: a ring with a railing; the rim: the dome with its eye; the well: a spiral round a sphere
  const d =
    id === 'duplex'
      ? ['M4 15h16', 'M6 15v-3M10 15v-3M14 15v-3M18 15v-3', 'M4 12h16', 'M12 19v-4']
      : id === 'sky-rim'
        ? ['M3.5 18a8.5 8.5 0 0 1 17 0', 'M9 9.8h6', 'M12 6v3.8', 'M3 18h18']
        : ['M12 4v3', 'M7 10c0-2 10-2 10 0s-10 3-10 5 10 2 10 0', 'M12 16.5v3.5']
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {d.map((p) => (
        <path key={p} d={p} />
      ))}
      {id === 'sphere-well' && <circle cx="12" cy="12.5" r="1.8" />}
    </svg>
  )
}

const RIDE_KEY: Record<PerchId, XKey> = { duplex: 'xp.ride.duplex', 'sky-rim': 'xp.ride.sky-rim', 'sphere-well': 'xp.ride.sphere-well' }

/** One button per perch at a door, "Come down" on a perch (nothing otherwise). */
function PerchButtons() {
  const x = useXT()
  const perched = usePerch((s) => !!s.perch && !s.ride)
  const riding = usePerch((s) => !!s.ride)
  const [door, setDoor] = useState<readonly PerchId[] | null>(null)
  const [enabled] = useState(perchEnabled)
  useEffect(() => {
    if (!enabled) return
    let last = ''
    const id = window.setInterval(() => {
      const d = nearPerchDoor()
      const key = d?.id ?? ''
      if (key !== last) {
        last = key
        setDoor(d ? d.perches : null)
      }
    }, 300)
    return () => window.clearInterval(id)
  }, [enabled])
  if (riding) return null
  if (perched) {
    const label = x('xp.comeDown')
    return (
      <button type="button" className="ui-icon-btn" aria-label={label} data-tip={label} onClick={() => descend()}>
        <IconClimb down />
      </button>
    )
  }
  if (!enabled || !door) return null
  return (
    <>
      {door.map((id) => {
        const label = x(RIDE_KEY[id])
        return (
          <button
            key={id}
            type="button"
            className="ui-icon-btn"
            aria-label={label}
            data-tip={label}
            onClick={() => {
              if (useTour.getState().active) tour.pause()
              climb(id)
            }}
          >
            <IconPerch id={id} />
          </button>
        )
      })}
    </>
  )
}

export function ExperienceButtons() {
  return (
    <>
      <PassportButton />
      <PerchButtons />
    </>
  )
}
