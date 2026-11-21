import { PerformanceMonitor } from '@react-three/drei'
import { Canvas, useThree } from '@react-three/fiber'
import { useEffect, useState } from 'react'
import * as THREE from 'three'
import { LIGHTING } from './museum/config/lighting'
import { MUSEUM } from './museum/config/museum'
import { QUALITY_ORDER, QUALITY_PRESETS, rememberAutoTier, withDevOverrides } from './museum/config/quality'
import { DebugOverlay } from './museum/debug/DebugOverlay'
import { MuseumScene } from './museum/MuseumScene'
import { useArrival } from './museum/navigation/ArrivalFlight'
import { useMuseum } from './museum/state/store'
import { usePrecompileProgress } from './museum/effects/Precompile'
import { teleport, visitor } from './museum/state/visitor'
import { InspectModal } from './museum/ui/InspectModal'
import { UIOverlay } from './museum/ui/UIOverlay'
import { hasWebGL, WebGLUnsupported } from './museum/ui/WebGLUnsupported'
import { ErrorBoundary } from './museum/utils/ErrorBoundary'
import { tr } from './museum/i18n'
import { reportError } from './museum/utils/errorReporter'
import { webgpuGL, webgpuRequested } from './museum/utils/renderer'
import { setSpectacleOff } from './museum/spectacle/settings'
import { SITE } from './site'

// Small automation/debug handle (used by scripts/screenshots.mjs and handy in the console).
declare global {
  interface Window {
    __museum?: { teleport: typeof teleport; visitor: typeof visitor; store: typeof useMuseum; gl?: THREE.WebGLRenderer }
  }
}
window.__museum = { teleport, visitor, store: useMuseum }

/**
 * Adaptive quality ("auto"):
 *  • continuous resolution scaling (no reload, every ~1 s) inside the tier's DPR range, and down to
 *    DPR_FLOOR on a device that cannot hold ~32 fps;
 *  • never a tier change during the visit: a tier change remounts the canvas and recompiles its
 *    programs ("Applying graphics settings…"), which on a laptop GPU kept the visitor waiting for
 *    minutes. A device that keeps falling short drops the spectacle's costly extras (shaft, motes,
 *    halos, mirror, smoke, grade; every geometry stays) at once, and its next visit starts a tier
 *    lower (config/quality.ts rememberAutoTier).
 */
const adaptive = { declined: false }
const DPR_FLOOR = 0.75

function AdaptiveQuality() {
  const quality = useMuseum((s) => s.quality)
  const phase = useMuseum((s) => s.phase)
  const tier = useMuseum((s) => s.tier)
  const setDpr = useThree((s) => s.setDpr)
  const flying = useArrival((s) => s.active)
  const [armed, setArmed] = useState(false)
  useEffect(() => {
    // The arrival flight is the heaviest view of the visit: judge the device after it.
    if (phase !== 'entered' || flying) return
    const t = setTimeout(() => setArmed(true), 5000)
    return () => clearTimeout(t)
  }, [phase, tier, flying])
  if (quality !== 'auto' || !armed) return null
  const [, hi] = QUALITY_PRESETS[tier].dpr
  const deviceMax = Math.min(hi, typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1)
  const lo = Math.min(DPR_FLOOR, deviceMax)
  return (
    <PerformanceMonitor
      ms={400}
      iterations={6}
      bounds={(refresh) => [Math.min(34, refresh * 0.55), Math.max(55, refresh * 0.95)]}
      flipflops={4}
      // starts at the top of the range: factor 1 → the device's DPR (≤ the tier's), factor 0 → DPR_FLOOR
      factor={1}
      onChange={({ factor }) => setDpr(Math.round((lo + (deviceMax - lo) * factor) * 20) / 20)}
      onDecline={() => {
        if (adaptive.declined) return
        adaptive.declined = true
        const i = QUALITY_ORDER.indexOf(useMuseum.getState().tier)
        setSpectacleOff(true)
        rememberAutoTier(QUALITY_ORDER[Math.max(0, i - 1)])
      }}
    />
  )
}

/** A runtime error inside the 3D scene — distinct from "no WebGL" so it isn't misdiagnosed. */
function SceneError() {
  return (
    <div className="ui-nogl" role="alert">
      <div className="ui-nogl__inner">
        <div className="ui-kicker">A Virtual Exhibition</div>
        <h1 className="ui-nogl__title">{SITE.defaultExhibitionTitle}</h1>
        <p>Something went wrong while loading the gallery. Reloading usually fixes it.</p>
        <p>
          <button type="button" className="ui-btn ui-btn--ghost" onClick={() => window.location.reload()}>
            Reload
          </button>
        </p>
      </div>
    </div>
  )
}

export default function App() {
  const tier = useMuseum((s) => s.tier)
  const compiled = useMuseum((s) => s.sceneCompiled)
  const entered = useMuseum((s) => s.phase === 'entered')
  // entered before the first view was ready (the entry screen's safety timeout): say what is happening
  const prep = usePrecompileProgress()
  const preset = withDevOverrides(QUALITY_PRESETS[tier])
  const [supported] = useState(hasWebGL)
  const [lost, setLost] = useState(false)

  if (!supported || lost) return <WebGLUnsupported />

  const s = MUSEUM.visitor.start
  return (
    <>
      <div className="museum-canvas">
        <ErrorBoundary key={tier} fallback={<SceneError />}>
          <Canvas
            key={tier}
            frameloop={compiled ? 'always' : 'never'}
            dpr={preset.dpr}
            // PCF ('percentage'): three r186 removed PCFSoftShadowMap (its PCF path is already filtered).
            shadows={preset.shadows ? 'percentage' : false}
            // `?renderer=webgpu` (experimental, navigator.gpu only) → WebGPURenderer with WebGL fallback.
            gl={webgpuRequested() ? (webgpuGL({ antialias: preset.antialias, toneMappingExposure: LIGHTING.exposure }) as never) : {
              antialias: preset.antialias,
              powerPreference: 'high-performance',
              stencil: false,
              toneMapping: THREE.NeutralToneMapping,
              toneMappingExposure: LIGHTING.exposure,
            }}
            camera={{ fov: MUSEUM.visitor.fov, near: 0.05, far: 3000, position: [s.x, MUSEUM.visitor.eyeHeight, s.z] }}
            onCreated={({ gl }) => {
              if (window.__museum) window.__museum.gl = gl
              const canvas = gl.domElement
              let restored = false
              canvas.addEventListener('webglcontextrestored', () => {
                restored = true
              })
              canvas.addEventListener('webglcontextlost', (e) => {
                e.preventDefault()
                restored = false
                // R3F disposes (and deliberately loses) the old context whenever the Canvas
                // remounts — e.g. on a quality change. Only a loss on the LIVE canvas that the
                // browser doesn't restore within a few seconds is a genuine GPU failure.
                window.setTimeout(() => {
                  if (canvas.isConnected && !restored) {
                    reportError(new Error('WebGL context lost (not restored within 3 s)'), { kind: 'webgl' })
                    setLost(true)
                  }
                }, 3000)
              })
            }}
          >
            <MuseumScene />
            <AdaptiveQuality />
          </Canvas>
        </ErrorBoundary>
      </div>
      {!compiled && entered && (
        <div
          role="status"
          style={{
            position: 'fixed',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 40,
            padding: '12px 20px',
            borderRadius: 6,
            background: 'rgba(245, 241, 232, 0.92)',
            color: '#2b2621',
            font: '500 13px/1.4 Inter, system-ui, sans-serif',
            letterSpacing: '0.04em',
            boxShadow: '0 12px 32px -12px rgba(43,38,33,.3)',
            pointerEvents: 'none',
          }}
        >
          {prep.first ? `${tr('hud.preparingMuseum')}${prep.total ? ` ${Math.round((100 * prep.done) / prep.total)}%` : ''}` : tr('hud.applyingGraphics')}
        </div>
      )}
      <UIOverlay />
      <ErrorBoundary fallback={null}>
        <InspectModal />
      </ErrorBoundary>
      <DebugOverlay />
    </>
  )
}
