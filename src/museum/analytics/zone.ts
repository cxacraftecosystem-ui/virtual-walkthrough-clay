/**
 * The zone analytics records for the visitor: the perch's zone while on one (the Sky Rim is not
 * a floor, so `zoneAt` cannot find it — SPECTACLE F4), else the zone under the visitor.
 */
import { zoneAt } from '../config/layout'
import { perchZone } from '../navigation/perch'
import { visitor } from '../state/visitor'

export function visitorZone(): string | undefined {
  return perchZone() ?? zoneAt(visitor.x, visitor.z)?.id
}
