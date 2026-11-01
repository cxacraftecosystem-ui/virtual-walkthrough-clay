/**
 * SPECTACLE OVERLAYS — the HTML layer of the spectacle phase (inside UIOverlay, over the canvas).
 *   overlays/atmosphere  WP2  day dial, night toast, festival
 *   overlays/experience  WP5  caption strip, passport, perch controls, moments
 */
import { ErrorBoundary } from '../utils/ErrorBoundary'
import { AtmosphereOverlay } from './overlays/atmosphere'
import { ExperienceOverlay } from './overlays/experience'

export function SpectacleOverlays() {
  return (
    <>
      <ErrorBoundary fallback={null}>
        <AtmosphereOverlay />
      </ErrorBoundary>
      <ErrorBoundary fallback={null}>
        <ExperienceOverlay />
      </ErrorBoundary>
    </>
  )
}
