/**
 * A three-dimensional exhibit, standing either
 *   - on a PODIUM of the row (`podium: 'pod-…'`, see placement.ts exhibitPodium): the piece on
 *     the podium top with a small label on the podium's front; the podium and its top light
 *     are architecture (architecture/Pavilion.tsx), so nothing else is drawn here; or
 *   - on a low display TABLE by its wall (surface + at), lit by its own track spot.
 * Clicking the piece opens the 3D inspection viewer; clicking the table / label opens its
 * information.
 */
import type { ThreeEvent } from '@react-three/fiber'
import { Suspense, useEffect, useMemo } from 'react'
import { DISPLAY_TABLE, type ExhibitConfig } from '../config/exhibits'
import { PODIUM } from '../config/layout'
import { LIGHTING } from '../config/lighting'
import type { Vec3 } from '../config/museum'
import { QUALITY_PRESETS, withDevOverrides } from '../config/quality'
import { registerItem } from '../interaction/registry'
import { TrackSpot } from '../lighting/TrackLight'
import { mountFor } from '../lighting/tracks'
import { createMeterBoxGeometry } from '../materials/geometry'
import { useMaterials } from '../materials/materials'
import { createLabelTexture } from '../materials/wallGraphics'
import { focusOn } from '../navigation/focus'
import { useMuseum } from '../state/store'
import { ErrorBoundary } from '../utils/ErrorBoundary'
import { useAsyncTexture } from '../utils/useAsyncTexture'
import { Artifact3D } from './Artifact3D'
import { tablePlacement } from './placement'

const T = DISPLAY_TABLE

/** Low clay-topped display table (the pavilion's alternative to a podium). */
function DisplayTable() {
  const m = useMaterials()
  const geo = useMemo(
    () => ({
      top: createMeterBoxGeometry(T.length, 0.04, T.depth),
      base: createMeterBoxGeometry(T.length - 0.14, T.height - 0.06, T.depth - 0.14),
      gap: createMeterBoxGeometry(T.length - 0.18, 0.03, T.depth - 0.18),
    }),
    [],
  )
  useEffect(() => () => Object.values(geo).forEach((g) => g.dispose()), [geo])
  return (
    <group>
      <mesh geometry={geo.top} material={m.clayTerracotta} position={[0, T.height - 0.02, 0]} castShadow receiveShadow />
      <mesh geometry={geo.base} material={m.oxblood} position={[0, (T.height - 0.06) / 2 + 0.02, 0]} castShadow receiveShadow />
      <mesh geometry={geo.gap} material={m.shadowGap} position={[0, 0.015, 0]} receiveShadow />
    </group>
  )
}

/** Small printed label: on the table top, or on the podium's front face. */
function ExhibitLabel({ exhibit, onPodium }: { exhibit: ExhibitConfig; onPodium: boolean }) {
  const w = onPodium ? 0.22 : 0.16
  const h = onPodium ? 0.09 : 0.07
  const tex = useAsyncTexture(
    () =>
      createLabelTexture(
        [
          { text: exhibit.title, style: 'title' },
          { text: 'Click to inspect in 3D', style: 'meta' },
        ],
        w,
        h,
      ),
    [exhibit.title, w, h],
  )
  if (!tex) return null
  const pos: Vec3 = onPodium ? [0, PODIUM.height - 0.16, PODIUM.size / 2 + 0.002] : [0.28, T.height + 0.003, T.depth / 2 - 0.07]
  return (
    <mesh position={pos} rotation={onPodium ? [0, 0, 0] : [-Math.PI / 2 + 0.35, 0, 0]}>
      <boxGeometry args={[w, h, 0.003]} />
      <meshStandardMaterial map={tex} roughness={0.85} />
    </mesh>
  )
}

export function Exhibit({ exhibit }: { exhibit: ExhibitConfig }) {
  const tier = useMuseum((s) => s.tier)
  const preset = withDevOverrides(QUALITY_PRESETS[tier])
  const inspect = useMuseum((s) => s.inspect)
  const select = useMuseum((s) => s.select)
  const place = useMemo(() => tablePlacement(exhibit), [exhibit])
  const onPodium = !!place.podium
  const [px, , pz] = place.position
  const nx = Math.sin(place.rotationY)
  const nz = Math.cos(place.rotationY)
  const topY = onPodium ? PODIUM.height : T.height

  useEffect(
    () =>
      registerItem({
        id: exhibit.id,
        kind: 'exhibit',
        title: exhibit.title,
        center: [px, topY + 0.12, pz],
        normal: [nx, 0, nz],
        size: onPodium ? [0.5, 0.5] : [T.length, 0.5],
        viewDistance: onPodium ? 1.2 : 1.35,
      }),
    [exhibit.id, exhibit.title, px, pz, nx, nz, topY, onPodium],
  )

  // tables carry their own accent light; a podium's comes with the podium
  const spot = useMemo(() => {
    if (onPodium) return null
    const mount = mountFor(exhibit.placement.surface, exhibit.placement.at)
    const target: Vec3 = [px, T.height, pz]
    const dist = Math.hypot(mount[0] - px, mount[1] - T.height, mount[2] - pz)
    return { mount, target, intensity: LIGHTING.track.tableIntensity * (dist / 3.4) ** 2, angle: Math.atan(0.62 / dist) * 1.3 }
  }, [onPodium, exhibit.placement.surface, exhibit.placement.at, px, pz])

  const onPieceClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    if (e.delta > 6 || useMuseum.getState().phase !== 'entered') return
    inspect(exhibit.id)
  }
  const onInfoClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    if (e.delta > 6 || useMuseum.getState().phase !== 'entered') return
    select({ kind: 'exhibit', id: exhibit.id })
    focusOn('exhibit', exhibit.id)
  }
  const pointer = (on: boolean) => (e: ThreeEvent<PointerEvent>) => {
    if (on) e.stopPropagation()
    document.body.style.cursor = on ? 'pointer' : ''
  }

  return (
    <group>
      <group position={place.position} rotation={[0, place.rotationY, 0]}>
        <group onClick={onInfoClick} onPointerOver={pointer(true)} onPointerOut={pointer(false)}>
          {!onPodium && <DisplayTable />}
          <ExhibitLabel exhibit={exhibit} onPodium={onPodium} />
        </group>
        <group position={onPodium ? [0, topY, 0] : [-0.12, topY, -0.02]} onClick={onPieceClick} onPointerOver={pointer(true)} onPointerOut={pointer(false)}>
          <ErrorBoundary fallback={null}>
            <Suspense fallback={null}>
              <Artifact3D exhibit={exhibit} />
            </Suspense>
          </ErrorBoundary>
        </group>
      </group>
      {spot && preset.tableSpots && <TrackSpot position={spot.mount} target={spot.target} intensity={spot.intensity} angle={spot.angle} />}
    </group>
  )
}
