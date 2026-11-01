/**
 * SPECTACLE — the in-scene mount point of the spectacle phase (inside the Canvas, MuseumScene).
 *
 * One mount per package, each owning its own file, so parallel work never touches a shared one:
 *   mounts/rooms          WP1  satellite rooms, Parikrama, Sky Rim shells
 *   mounts/court          WP3  oculus court, mandalas, duplex band
 *   mounts/atmosphere     WP2  sun shaft, motes, weather, diyas, choreography
 *   mounts/craft          WP4  hands-on craft and sound
 *   mounts/experience     WP5  perch, stamps, photo spots, cue engine
 * and the grand plan's (GRAND §8):
 *   mounts/architecture   P1   dome, arches, balcony, east stair, Red Room and Sphere Well shells
 *   mounts/crafts         P2   the traditions and the sourced models outside their scene objects
 *   mounts/installations  P3   the PDF installations and set dressing
 * Each mount sits in its own error boundary: a failing moment never takes the pavilion down.
 * The zone-first cues (spectacle/cues.ts) and the capture camera (debug/ViewOverride.tsx) are mounted here.
 */
import { Suspense } from 'react'
import { ViewOverride } from '../debug/ViewOverride'
import { ErrorBoundary } from '../utils/ErrorBoundary'
import { ZoneFirstCues } from './cues'
import { ArchitectureMount } from './mounts/architecture'
import { AtmosphereMount } from './mounts/atmosphere'
import { CourtMount } from './mounts/court'
import { CraftMount } from './mounts/craft'
import { CraftsMount } from './mounts/crafts'
import { ExperienceMount } from './mounts/experience'
import { InstallationsMount } from './mounts/installations'
import { RoomsMount } from './mounts/rooms'

const MOUNTS = [RoomsMount, CourtMount, AtmosphereMount, CraftMount, ExperienceMount, ArchitectureMount, CraftsMount, InstallationsMount]

export function Spectacle() {
  return (
    <group name="spectacle">
      <ZoneFirstCues />
      {/* captures: __museum.view(…) and ?shots (after the visitor's camera, so it wins) */}
      <ViewOverride />
      {MOUNTS.map((M, i) => (
        <ErrorBoundary key={i} fallback={null}>
          <Suspense fallback={null}>
            <M />
          </Suspense>
        </ErrorBoundary>
      ))}
    </group>
  )
}
