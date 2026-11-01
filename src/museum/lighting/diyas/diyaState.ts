/**
 * DIYA STATE — is it a night of lamps, and how far has the wave run (SPECTACLE F28)?
 *
 * Written each frame by <DiyaField>; read by anyone whose lamps belong to the night: the helix's
 * cup flames (WP3), the horses' hoof diyas (WP4), the Akash Deep and the beacon.
 *
 *   diyaNow.lit        0 … 1, the lamps' master level (fades in at dusk, out at dawn)
 *   diyaNow.festival   0 … 1, the festival of lamps (every set), eased
 *   diyaNow.wave       seconds since the festival's spiral wave began (−1 = not running)
 */
import { inWindow, istMonthDay } from '../atmosphere/dayCurve'
import { kindProps } from '../../spectacle/settings'
import { useMuseum } from '../../state/store'

export const diyaNow = {
  lit: 0,
  festival: 0,
  wave: -1,
}

/** Is the festival of lamps on? The visitor's choice, else the curator's ('auto' = the Diwali window). */
export function festivalActive(now: Date = new Date()): boolean {
  const choice = useMuseum.getState().festival
  if (choice === 'on') return true
  if (choice === 'off') return false
  const p = kindProps('atmosphere')
  if (p.festival === 'on') return true
  if (p.festival === 'off') return false
  return inWindow(istMonthDay(now), String(p.festivalFrom ?? '11-01'), String(p.festivalTo ?? '11-15'))
}
