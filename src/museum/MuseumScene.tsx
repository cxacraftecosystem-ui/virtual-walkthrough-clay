/**
 * MuseumScene — composes architecture, lighting, content and navigation.
 * Pure composition: all dimensions come from config/, all content from config/*.
 */
import { Suspense } from 'react'
import { Pavilion } from './architecture/Pavilion'
import { WallDecor } from './architecture/WallDecor'
import { ARTWORKS } from './config/artworks'
import { EXHIBITS } from './config/exhibits'
import { SURFACES } from './config/layout'
import { INFOGRAPHICS } from './config/infographics'
import { DebugScene } from './debug/DebugScene'
import { PostFX } from './effects/PostFX'
import { RayTraceManager } from './effects/PathTracer'
import { ArrivalFlight } from './navigation/ArrivalFlight'
import { PresenceLayer } from './live/PresenceLayer'
import { XRRoot } from './xr/XRRoot'
import { useXRMode } from './xr/xrStore'
import { Precompile } from './effects/Precompile'
import { ZoneCuller, ZoneGroup } from './navigation/zoneCulling'
import { Artwork } from './exhibits/Artwork'
import { Exhibit } from './exhibits/Exhibit'
import { exhibitPodium } from './exhibits/placement'
import { ProductWall, RevealWallTitle } from './exhibits/WallGraphics'
import { Lighting } from './lighting/Lighting'
import { VideoScreens } from './media/VideoScreens'
import { VisitorController } from './navigation/VisitorController'
import { SceneObjects } from './models/SceneObjects'
import { Amenities } from './amenities/Amenities'
import { useMuseum } from './state/store'
import { ErrorBoundary } from './utils/ErrorBoundary'

/**
 * R3F only raycasts objects that have handlers. These no-op handlers make the whole
 * architecture part of pointer hit-testing, so (with the nearest-hit filter in
 * VisitorController) walls occlude clicks and hover on exhibits behind them.
 */
const occlude = () => {}

function Architecture() {
  return (
    <group onClick={occlude} onPointerOver={occlude}>
      <Pavilion />
      <WallDecor />
    </group>
  )
}

function Content() {
  return (
    <group>
      {ARTWORKS.map((a) => (
        <ZoneGroup key={a.id} zones={[SURFACES[a.placement.surface]?.zone ?? 'inner']}>
          <Artwork config={a} />
        </ZoneGroup>
      ))}
      {EXHIBITS.map((e) => (
        <ZoneGroup key={e.id} zones={[exhibitPodium(e)?.zone ?? SURFACES[e.placement.surface]?.zone ?? 'inner']}>
          <ErrorBoundary fallback={null}>
            <Exhibit exhibit={e} />
          </ErrorBoundary>
        </ZoneGroup>
      ))}
      <ZoneGroup zones={[SURFACES['h-description'].zone, 'entrance-court', 'entry-e']}>
        <RevealWallTitle />
      </ZoneGroup>
      <ZoneGroup zones={[...new Set(INFOGRAPHICS.map((i) => SURFACES[i.placement.surface]?.zone ?? 'inner'))]}>
        <ProductWall />
      </ZoneGroup>
    </group>
  )
}

export function MuseumScene() {
  const debug = useMuseum((s) => s.debug)
  const inXR = useXRMode((s) => s.mode === 'vr')
  return (
    <>
      <VisitorController />
      <ArrivalFlight />
      <ZoneCuller />
      <Lighting />
      <Architecture />
      <Suspense fallback={null}>
        <Content />
        <VideoScreens />
        <SceneObjects />
        <ErrorBoundary fallback={null}>
          <Amenities />
        </ErrorBoundary>
      </Suspense>
      {/* post-processing can't render into a WebXR framebuffer: off while in VR */}
      {!inXR && <PostFX />}
      {!inXR && <RayTraceManager />}
      {debug && <DebugScene />}
      <Precompile />
      <PresenceLayer />
      <XRRoot />
    </>
  )
}
