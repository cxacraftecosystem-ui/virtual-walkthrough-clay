/**
 * 'clay-chimes' — clay bells hung from the Parikrama's pergola (F21): one at each gate and one
 * at each jali slot. The object carries the curator's setting (`count`, gates first, then the
 * slots west to east); the bells are drawn by architecture/Parikrama.tsx with <ChimeSet/>, under
 * both halves of the walk, so this component draws nothing.
 *
 * Each bell is a small thrown terracotta ghanti on a cord, with a clapper and a fired-clay leaf
 * below it that catches the air. As the visitor passes within 1.5 m a bell swings (a damped
 * pendulum) and the cue 'bells:ring' fires with `{ index, x, z, strength }` — the sound is the
 * soundscape's (WP4). Still form: the bells hang still and the cue still fires.
 */
import { useFrame } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { polar } from '../config/museum'
import { JALI_SLOTS, PARIKRAMA, SERP_OFFSET, serpentineR } from '../config/satellites'
import { visitorDistance } from '../interaction/proximity'
import { fireCue } from '../spectacle/cues'
import { useSpectacle } from '../spectacle/settings'
import { lathe } from './kit'
import { useModelMaterials } from './modelMaterials'

export function ClayChimes() {
  return null
}

/** Where the bells hang (plan x, z): the two gates, then the jali slots west → east. */
export function chimePositions(count = 5): [number, number][] {
  // on the walk's centreline at the gates; by each jali, just in from the walk's outer face
  const gate = (a: number) => polar(serpentineR(a), a)
  const jali = (a: number) => polar(serpentineR(a) + SERP_OFFSET - 0.6, a)
  const spots: [number, number][] = [gate(PARIKRAMA.fromDeg + 3), gate(PARIKRAMA.toDeg - 4), ...JALI_SLOTS.map(([a0, a1]) => jali((a0 + a1) / 2))]
  return spots.slice(0, Math.max(0, Math.min(spots.length, Math.round(count))))
}

/** Height of the bell's mouth above the floor; the cord rises to the pergola. */
const BELL_Y = 2.25
const CORD_TOP = PARIKRAMA.roofY0

function bellGeometry() {
  return lathe(
    [
      [0, 0.17],
      [0.02, 0.17],
      [0.03, 0.16],
      [0.05, 0.12],
      [0.07, 0.05],
      [0.085, 0.0],
      [0.078, 0.0],
      [0.062, 0.05],
      [0.044, 0.11],
      [0, 0.12],
    ],
    24,
  )
}

/** The bells (with their clappers and leaves) as one instanced mesh and their cords as one line set: two draws. */
export function ChimeSet({ count }: { count: number }) {
  const m = useModelMaterials()
  const sp = useSpectacle()
  const spots = useMemo(() => chimePositions(count), [count])
  const geo = useMemo(() => {
    const bell = bellGeometry()
    const clapper = new THREE.SphereGeometry(0.022, 12, 8)
    clapper.translate(0, -0.03, 0)
    const leaf = new THREE.CylinderGeometry(0.07, 0.07, 0.012, 3, 1)
    leaf.scale(1, 1, 0.55)
    leaf.rotateX(Math.PI / 2)
    leaf.translate(0, -0.2, 0)
    const parts = [bell, clapper, leaf].map((g) => {
      const n = g.index ? g.toNonIndexed() : g
      for (const k of Object.keys(n.attributes)) if (!['position', 'normal', 'uv'].includes(k)) n.deleteAttribute(k)
      return n
    })
    const merged = mergeGeometries(parts, false)!
    // the pivot is the pergola: hang the set below it
    merged.translate(0, BELL_Y - CORD_TOP, 0)
    ;[bell, clapper, leaf, ...parts].forEach((g) => g !== merged && g.dispose())
    return merged
  }, [])
  useEffect(() => () => geo.dispose(), [geo])
  const cords = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(spots.length * 6), 3))
    return g
  }, [spots])
  useEffect(() => () => cords.dispose(), [cords])
  const cordMat = useMemo(() => new THREE.LineBasicMaterial({ color: '#4a3326' }), [])
  useEffect(() => () => cordMat.dispose(), [cordMat])

  const ref = useRef<THREE.InstancedMesh>(null)
  const st = useRef(spots.map(() => ({ a: 0, v: 0, near: false })))
  useLayoutEffect(() => {
    st.current = spots.map(() => ({ a: 0, v: 0, near: false }))
  }, [spots])
  const mx = useMemo(() => new THREE.Matrix4(), [])
  const q = useMemo(() => new THREE.Quaternion(), [])
  const e = useMemo(() => new THREE.Euler(), [])
  const v = useMemo(() => new THREE.Vector3(), [])
  const one = useMemo(() => new THREE.Vector3(1, 1, 1), [])
  const down = useMemo(() => new THREE.Vector3(), [])

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05)
    const im = ref.current
    const pos = cords.getAttribute('position') as THREE.BufferAttribute
    spots.forEach(([x, z], i) => {
      const s = st.current[i]
      if (!s) return
      const d = visitorDistance(x, z)
      const near = d < 1.5
      if (near && !s.near) {
        const strength = 1 - d / 1.5
        s.v += 1.6 * (0.4 + strength)
        fireCue('bells:ring', { source: 'system', data: { index: i, x, z, strength } })
      }
      s.near = near
      if (sp.mode === 'still') s.a = 0
      else {
        s.v += (-9 * s.a - 0.9 * s.v) * dt
        s.a += s.v * dt
      }
      q.setFromEuler(e.set(s.a * 0.35, 0, s.a * 0.2))
      mx.compose(v.set(x, CORD_TOP, z), q, one)
      im?.setMatrixAt(i, mx)
      // the cord, from the pergola to the bell's crown
      down.set(0, BELL_Y + 0.17 - CORD_TOP, 0).applyQuaternion(q)
      pos.setXYZ(i * 2, x, CORD_TOP, z)
      pos.setXYZ(i * 2 + 1, x + down.x, CORD_TOP + down.y, z + down.z)
    })
    if (im) {
      im.instanceMatrix.needsUpdate = true
      im.computeBoundingSphere()
    }
    pos.needsUpdate = true
  })

  return (
    <group name="clay-chimes">
      <instancedMesh ref={ref} args={[geo, m.terracotta, Math.max(1, spots.length)]} count={spots.length} castShadow raycast={() => null} />
      <lineSegments geometry={cords} material={cordMat} raycast={() => null} frustumCulled={false} />
    </group>
  )
}
