/**
 * THE RED ROOM'S SHELL (GRAND §2.7, p09r "round red room with shelves and a central plinth"):
 * what the round wall (WALLS 'rr-*', drawn by Wall.tsx in red lime) leaves open — its ceiling and
 * the oculus, and the drum's head where it rises through the library's roof. Its shelves and the
 * two-tier plinth are P3's; its floor is Floor.tsx's (so it stays clickable).
 *
 *   ceiling ...... deep red at the wall's head, a concealed warm cove where it meets the wall
 *   oculus ....... r 1.5 open to the sky at the head of a stepped light-well of pale plaster
 *                  (as the dome's), rising 1.6 m through and above the roof cap
 *   roof cap ..... a glazed terracotta ring over the drum's head, a slim fascia round it
 */
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { RED_ROOM } from '../config/satellites'
import { StaticMerge } from '../effects/StaticMerge'
import { ambience } from '../lighting/timeOfDayState'
import { useMaterials } from '../materials/materials'
import { Mesh, revolve, type V2 } from './sweep'

const RR = RED_ROOM
const FULL = Math.PI * 2
/** The cap over the drum: its thickness and how far it overhangs the wall. */
export const RED_ROOM_CAP = { t: 0.3, over: 0.12 }

/** The oculus's light-well (as the dome's): a stepped plaster reveal rising above the cap. */
export const RED_ROOM_WELL = { stepR: RED_ROOM.oculusR + 0.45, stepH: 0.55, rise: 1.6 }

function shellGeometry() {
  const red = new Mesh()
  const cap = new Mesh()
  const cove = new Mesh()
  const well = new Mesh()
  const { cx, cz } = RR
  const h = RR.height - 0.004
  const rOut = RR.r + RR.t
  const down: V2 = [0, -1]
  const inn: V2 = [-1, 0]
  const W = RED_ROOM_WELL
  // the ceiling, the cove where it meets the wall (a slot of light under a small drop)
  revolve(red, cx, cz, [[W.stepR, h], [RR.r - 0.3, h]], 0, FULL, 96, [down, down])
  revolve(red, cx, cz, [[RR.r - 0.3, h], [RR.r - 0.3, h - 0.22]], 0, FULL, 96, [inn, inn])
  revolve(red, cx, cz, [[RR.r - 0.3, h - 0.22], [RR.r - 0.002, h - 0.22]], 0, FULL, 96, [down, down])
  revolve(cove, cx, cz, [[RR.r - 0.3 + 0.004, h - 0.004], [RR.r - 0.004, h - 0.004]], 0, FULL, 96, [down, down])
  // the oculus's light-well: a deep pale plaster reveal, one step in, rising above the cap, so
  // the sky is a soft-edged disc at the head of a glowing shaft and never a sticker on the ceiling
  const wellTop = h + W.rise
  revolve(well, cx, cz, [[W.stepR, h + W.stepH], [W.stepR, h]], 0, FULL, 96, [inn, inn])
  revolve(well, cx, cz, [[RR.oculusR, h + W.stepH], [W.stepR, h + W.stepH]], 0, FULL, 96, [down, down])
  revolve(well, cx, cz, [[RR.oculusR, wellTop], [RR.oculusR, h + W.stepH]], 0, FULL, 64, [inn, inn])
  // the cap: its top, fascia and soffit, and the light-well's drum standing up through it
  const top = RR.height + RED_ROOM_CAP.t
  const r1 = rOut + RED_ROOM_CAP.over
  const drum = RR.oculusR + 0.18
  revolve(cap, cx, cz, [[r1, RR.height - 0.02], [r1, top], [drum, top], [drum, wellTop], [RR.oculusR, wellTop]], 0, FULL, 96)
  revolve(cap, cx, cz, [[rOut - 0.002, RR.height - 0.02], [r1, RR.height - 0.02]], 0, FULL, 96, [down, down])
  return { red: red.build(), cap: cap.build(), cove: cove.build(), well: well.build() }
}

const coveMat = new THREE.MeshStandardMaterial({ name: 'redRoomCove', color: '#5a1410', emissive: new THREE.Color('#ff6a3c'), emissiveIntensity: 1.4, roughness: 0.7 })

export function RedRoomShell() {
  const m = useMaterials()
  const geo = useMemo(shellGeometry, [])
  useEffect(() => () => Object.values(geo).forEach((g) => g?.dispose()), [geo])
  useFrame(() => {
    coveMat.emissiveIntensity = 0.9 + 1.4 * ambience.night
  })
  return (
    <group name="red-room-shell">
      <StaticMerge name="red-room">
        {geo.red && <mesh geometry={geo.red} material={m.redLime} castShadow receiveShadow />}
        {geo.cap && <mesh geometry={geo.cap} material={m.glazedTerracotta} castShadow receiveShadow />}
        {geo.well && <mesh geometry={geo.well} material={m.blushPlaster} receiveShadow />}
      </StaticMerge>
      {geo.cove && <mesh geometry={geo.cove} material={coveMat} raycast={() => null} />}
    </group>
  )
}
