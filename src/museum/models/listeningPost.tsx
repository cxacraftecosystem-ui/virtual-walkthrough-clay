/**
 * 'listening-post' — a listening seat in the Kothi Library (F25): a low thrown-clay seat with a
 * cushion, and beside it on a brass stem a flared terracotta horn at the ear of a seated
 * listener, ringed by a thin light that pulses with the voice.
 *
 * Clicking the seat plays `props.clip` (an oral history) through the horn, and the ring follows
 * the recording's loudness (an AnalyserNode, once audio is unlocked). With no clip — or while
 * the object is a placeholder — it is silent and the ring rests at a faint glow: nothing is
 * played or announced before a recording exists.
 *
 * Local space: origin at the seat's centre on the floor, the listener faces +z, the horn stands
 * at the listener's right.
 */
import { useFrame } from '@react-three/fiber'
import { useContext, useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { getAudioContext } from '../media/audioEngine'
import { useMuseum } from '../state/store'
import { Builder, cyl, lathe, Parts, rbox, useBuilt } from './kit'
import { InMuseumScene } from './sceneContext'
import { tinted, useModelMaterials } from './modelMaterials'
import { geoKey, str, type ModelProps } from './types'

const HORN = { x: 0.34, y: 1.12, z: -0.02, len: 0.34, mouth: 0.13 }

interface Player {
  el: HTMLAudioElement
  analyser: AnalyserNode | null
  data: Uint8Array<ArrayBuffer> | null
}

export function ListeningPost({ config }: ModelProps) {
  const m = useModelMaterials()
  const inScene = useContext(InMuseumScene)
  const clip = config.placeholder ? '' : str(config, 'clip', '')

  const parts = useBuilt(geoKey('listening-post', config), () => {
    const b = new Builder()
    // the seat: a squat thrown form, burnished, with a madder cushion
    b.add('clay', lathe([[0, 0], [0.2, 0.0], [0.25, 0.08], [0.27, 0.22], [0.25, 0.4], [0.22, 0.42], [0, 0.42]], 40))
    b.add('cushion', rbox(0.46, 0.07, 0.46, 0.03, 3, 'x'), { p: [0, 0.455, 0] })
    // the stem: a clay foot, a brass rod, the horn's elbow
    b.add('clay', lathe([[0, 0], [0.13, 0], [0.12, 0.05], [0.04, 0.09], [0, 0.09]], 28), { p: [HORN.x, 0, HORN.z] })
    b.add('brass', cyl(0.012, 0.012, HORN.y - 0.09, 10), { p: [HORN.x, 0.09 + (HORN.y - 0.09) / 2, HORN.z] })
    // the horn: a flared trumpet turned to face the listener's ear (local −x, a little forward)
    const horn = lathe([[0.022, 0], [0.026, 0.08], [0.036, 0.18], [0.06, 0.26], [HORN.mouth, HORN.len], [HORN.mouth - 0.008, HORN.len], [0.05, 0.25], [0.03, 0.17], [0.018, 0.0]], 36)
    horn.rotateZ(Math.PI / 2)
    horn.rotateY(-0.35)
    b.add('horn', horn, { p: [HORN.x + 0.02, HORN.y, HORN.z] })
    return b
  })
  const cushion = useMemo(() => tinted(m.upholstery, '#7c2f22', { roughness: 1 }), [m.upholstery])

  // the ring of light round the horn's mouth
  const ringMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#f6e2c4', emissive: new THREE.Color('#ffb877'), emissiveIntensity: 0.35, roughness: 0.5 }), [])
  useEffect(() => () => ringMat.dispose(), [ringMat])
  const mouth = useMemo(() => {
    const d = new THREE.Vector3(-1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), -0.35)
    const p = new THREE.Vector3(HORN.x + 0.02, HORN.y, HORN.z).addScaledVector(d, HORN.len)
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), d)
    return { p, q }
  }, [])

  const player = useRef<Player | null>(null)
  useEffect(() => {
    if (!inScene || !clip) return
    const unsub = useMuseum.subscribe((s, prev) => {
      const sel = s.selection
      if (!sel || sel === prev.selection || sel.kind !== 'object' || sel.id !== config.id) return
      let p = player.current
      if (!p) {
        const el = new Audio(clip)
        el.crossOrigin = 'anonymous'
        let analyser: AnalyserNode | null = null
        let data: Uint8Array<ArrayBuffer> | null = null
        const ctx = getAudioContext(true)
        if (ctx) {
          try {
            const src = ctx.createMediaElementSource(el)
            analyser = ctx.createAnalyser()
            analyser.fftSize = 256
            data = new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount))
            src.connect(analyser)
            analyser.connect(ctx.destination)
          } catch {
            analyser = null
          }
        }
        p = player.current = { el, analyser, data }
      }
      if (p.el.paused) void p.el.play().catch(() => {})
      else p.el.pause()
    })
    return () => {
      unsub()
      const p = player.current
      if (p) {
        p.el.pause()
        p.el.src = ''
      }
      player.current = null
    }
  }, [inScene, clip, config.id])

  useFrame(() => {
    const p = player.current
    let level = 0
    if (p && !p.el.paused && p.analyser && p.data) {
      p.analyser.getByteTimeDomainData(p.data)
      let sum = 0
      for (let i = 0; i < p.data.length; i++) {
        const v = (p.data[i] - 128) / 128
        sum += v * v
      }
      level = Math.min(1, Math.sqrt(sum / p.data.length) * 4)
    } else if (p && !p.el.paused) level = 0.5
    ringMat.emissiveIntensity = 0.35 + 2.4 * level
  })

  return (
    <group>
      <Parts parts={parts} materials={{ clay: m.earthenware, cushion, brass: m.brass, horn: m.terracotta }} />
      <mesh position={mouth.p} quaternion={mouth.q} material={ringMat} raycast={() => null}>
        <torusGeometry args={[HORN.mouth + 0.012, 0.006, 8, 48]} />
      </mesh>
    </group>
  )
}
