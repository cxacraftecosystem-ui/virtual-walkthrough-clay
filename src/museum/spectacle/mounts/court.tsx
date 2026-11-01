/**
 * In-scene mount: oculus court, mandalas and duplex band (SPECTACLE F2 rill, F6, F10–F14, F16, F20).
 * Owned by WP3. Mounted by spectacle/Spectacle.tsx inside its own error boundary.
 *
 * The court's pieces are scene objects (config/spectacleObjects/court.ts → models/*), culled with
 * the zone they stand in. Only the procession frieze is drawn from here: it runs round the whole
 * drum, so each of its runs is culled with the rooms that can see that stretch of wall.
 */
import { DuplexFriezeBand } from '../../architecture/DuplexFrieze'

export function CourtMount() {
  return <DuplexFriezeBand />
}
