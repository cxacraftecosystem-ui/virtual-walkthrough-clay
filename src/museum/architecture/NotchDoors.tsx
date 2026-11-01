/**
 * THE NOTCH DOORS (SPECTACLE §1.3, F21): the two doorways cut in the drum's notch walls that
 * join the pavilion to the Parikrama walk — at the head of hallway D and beside the entry ways
 * by the NE notch. The Wall draws the piers, the lacquered jambs and the lintel's soffit; this
 * adds what makes each read as a threshold:
 *
 *   architrave ... an oxblood lacquer frame round the opening on both faces, 4 mm proud
 *   threshold .... a dark lacquered clay strip across the floor
 *   daylight ..... from inside the pavilion the walk beyond is bright: a warm wash spills across
 *                  the floor inside each door and a faint warm haze hangs in the opening, both
 *                  fading with the daylight (additive, no light added)
 *
 * The frames merge into the pavilion's shell (they are passed to its <StaticMerge>); the light is
 * drawn separately (transparent).
 */
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { DEG, MUSEUM } from '../config/museum'
import { NOTCH_DOOR } from '../config/satellites'
import { ambience } from '../lighting/timeOfDayState'
import { useMaterials } from '../materials/materials'
import { FaceBuilder, mergeAll } from './shellGeometry'

const T = MUSEUM.drum.thickness
const D = NOTCH_DOOR
const TRIM = { w: 0.11, proud: 0.004 }

/** The two doors: plan angle (deg) and which tangential side is inside the pavilion (+1 = larger angles). */
export const NOTCH_DOORS = [
  { id: 'notch-d', aDeg: MUSEUM.drum.dNotchDeg, inside: -1 as const },
  { id: 'notch-ne', aDeg: MUSEUM.drum.neNotchDeg, inside: 1 as const },
]

/** A quad in the radial plane at angle a, `off` m along the tangent, r0 → r1, y0 → y1, facing ±tangent. */
function radialRect(a: number, off: number, r0: number, r1: number, y0: number, y1: number, facing: 1 | -1) {
  const c = Math.cos(a)
  const s = Math.sin(a)
  const tx = -s
  const tz = c
  const P = (r: number, y: number) => [r * c + tx * off, y, r * s + tz * off]
  const n = [tx * facing, 0, tz * facing]
  const f = new FaceBuilder()
  // seen from +tangent the radius increases to the right
  const q = facing === 1 ? [P(r0, y0), P(r1, y0), P(r1, y1), P(r0, y1)] : [P(r1, y0), P(r0, y0), P(r0, y1), P(r1, y1)]
  f.quad(q, [n, n, n, n], [
    [r0, y0],
    [r1, y0],
    [r1, y1],
    [r0, y1],
  ])
  return f.build()
}

function frameGeometry() {
  const trims: (THREE.BufferGeometry | null)[] = []
  const sills: THREE.BufferGeometry[] = []
  for (const d of NOTCH_DOORS) {
    const a = d.aDeg * DEG
    for (const side of [1, -1] as const) {
      const off = side * (T / 2 + TRIM.proud)
      trims.push(
        radialRect(a, off, D.r0 - TRIM.w, D.r0, 0, D.height + TRIM.w, side),
        radialRect(a, off, D.r1, D.r1 + TRIM.w, 0, D.height + TRIM.w, side),
        radialRect(a, off, D.r0, D.r1, D.height, D.height + TRIM.w, side),
      )
    }
    const g = new THREE.BoxGeometry(D.r1 - D.r0, 0.008, T + 0.08)
    const c = Math.cos(a)
    const s = Math.sin(a)
    const mid = (D.r0 + D.r1) / 2
    g.applyMatrix4(new THREE.Matrix4().makeBasis(new THREE.Vector3(c, 0, s), new THREE.Vector3(0, 1, 0), new THREE.Vector3(-s, 0, c)).setPosition(mid * c, 0.004, mid * s))
    sills.push(g)
  }
  return { trims: mergeAll(trims), sills: mergeAll(sills) }
}

/** The architraves and brass thresholds (static: merged with the pavilion's shell). */
export function NotchDoorFrames() {
  const m = useMaterials()
  const geo = useMemo(frameGeometry, [])
  useEffect(() => () => Object.values(geo).forEach((g) => g?.dispose()), [geo])
  return (
    <group name="notch-door-frames">
      {geo.trims && <mesh geometry={geo.trims} material={m.oxbloodLacquer} receiveShadow />}
      {/* a dark fired-clay sill: matte brass read as a flat ochre slab in the dim walk */}
      {geo.sills && <mesh geometry={geo.sills} material={m.oxbloodLacquer} receiveShadow />}
    </group>
  )
}

/** Soft fan of light on the floor inside a door: 1 at the sill, fading over `len` metres and to the sides. */
let spillTex: THREE.CanvasTexture | null = null
function spillTexture() {
  if (spillTex) return spillTex
  const W = 128
  const cv = document.createElement('canvas')
  cv.width = W
  cv.height = W
  const ctx = cv.getContext('2d')!
  const img = ctx.createImageData(W, W)
  for (let y = 0; y < W; y++)
    for (let x = 0; x < W; x++) {
      const u = x / (W - 1) // across the door
      const v = y / (W - 1) // away from the door
      const spread = 0.5 + v * 0.35
      const across = Math.max(0, 1 - Math.abs(u - 0.5) / spread)
      const a = Math.pow(1 - v, 1.6) * across * across
      const i = (y * W + x) * 4
      img.data[i] = img.data[i + 1] = img.data[i + 2] = Math.round(a * 255)
      img.data[i + 3] = 255
    }
  ctx.putImageData(img, 0, 0)
  spillTex = new THREE.CanvasTexture(cv)
  return spillTex
}

/** The daylight spilling in at each door (floor wash + haze in the opening). */
export function NotchDoorLight() {
  const geo = useMemo(() => {
    const floor: THREE.BufferGeometry[] = []
    const haze: (THREE.BufferGeometry | null)[] = []
    const len = 2.6
    for (const d of NOTCH_DOORS) {
      const a = d.aDeg * DEG
      const c = Math.cos(a)
      const s = Math.sin(a)
      const tx = -s * d.inside
      const tz = c * d.inside
      // the wash: from the wall's inside face into the pavilion, as wide as the door at the sill
      const w = D.r1 - D.r0 + 0.6
      const g = new THREE.PlaneGeometry(w, len)
      g.rotateX(-Math.PI / 2)
      // the texture's bright edge (v = 1) is at local −z: turn local +z to point into the pavilion,
      // keeping the basis right-handed (x along the radius times the inside sense)
      const mid = (D.r0 + D.r1) / 2
      const basis = new THREE.Matrix4().makeBasis(new THREE.Vector3(c * d.inside, 0, s * d.inside), new THREE.Vector3(0, 1, 0), new THREE.Vector3(tx, 0, tz))
      g.applyMatrix4(basis.setPosition(mid * c + tx * (T / 2 + len / 2), 0.005, mid * s + tz * (T / 2 + len / 2)))
      floor.push(g)
      haze.push(radialRect(a, d.inside * (T / 2 + 0.02), D.r0 + 0.02, D.r1 - 0.02, 0.02, D.height - 0.02, (d.inside === 1 ? 1 : -1) as 1 | -1))
    }
    return { floor: mergeAll(floor), haze: mergeAll(haze) }
  }, [])
  useEffect(() => () => Object.values(geo).forEach((g) => g?.dispose()), [geo])
  const mats = useMemo(() => {
    const floor = new THREE.MeshBasicMaterial({ name: 'doorSpill', color: '#ffcf96', alphaMap: spillTexture(), transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: true, polygonOffset: true, polygonOffsetFactor: -2 })
    const haze = new THREE.MeshBasicMaterial({ name: 'doorHaze', color: '#ffd9a8', transparent: true, opacity: 0.06, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
    return { floor, haze }
  }, [])
  useEffect(
    () => () => {
      mats.floor.dispose()
      mats.haze.dispose()
    },
    [mats],
  )
  useFrame(() => {
    const day = ambience.daylight
    mats.floor.opacity = 0.34 * day
    mats.haze.opacity = 0.07 * day
  })
  return (
    <group name="notch-door-light">
      {geo.floor && <mesh geometry={geo.floor} material={mats.floor} raycast={() => null} renderOrder={1} />}
      {geo.haze && <mesh geometry={geo.haze} material={mats.haze} raycast={() => null} renderOrder={2} />}
    </group>
  )
}
