/**
 * MOTES (SPECTACLE F8) — dust glittering in the oculus beam, drifting slowly down it and
 * swirling away from the visitor's body as they pass. One `Points` draw: positions live in the
 * beam's own coordinates and are placed in the vertex shader (shaftShader.ts), so they always
 * sit in the light whatever the sun does. Counts per tier (0 on Low); none in the Still form;
 * the Turn quickens them.
 */
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { kelvinToHex } from '../../config/lighting'
import { MUSEUM } from '../../config/museum'
import { ZoneGroup } from '../../navigation/zoneCulling'
import { useMuseum } from '../../state/store'
import { visitor } from '../../state/visitor'
import { sunState } from '../timeOfDayState'
import { weatherNow } from '../weather/weatherState'
import { ATMOS } from './inject'
import { MOTE_FRAG, MOTE_VERT } from './shaftShader'
import { turnState } from './turn'

const MAX = 1600

function seeds(count: number) {
  const g = new THREE.BufferGeometry()
  const seed = new Float32Array(MAX * 4)
  let s = 7
  const rnd = () => {
    s ^= s << 13
    s ^= s >>> 17
    s ^= s << 5
    return (s >>> 0) / 4294967296
  }
  for (let i = 0; i < MAX; i++) seed.set([rnd() * Math.PI * 2, rnd(), rnd(), rnd()], i * 4)
  g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(MAX * 3), 3))
  g.setAttribute('aSeed', new THREE.Float32BufferAttribute(seed, 4))
  g.setDrawRange(0, count)
  return g
}

export function Motes({ count }: { count: number }) {
  const gl = useThree((s) => s.gl)
  const { points, mat } = useMemo(() => {
    const mat = new THREE.ShaderMaterial({
      name: 'motes',
      vertexShader: MOTE_VERT,
      fragmentShader: MOTE_FRAG,
      uniforms: {
        uSunDir: { value: new THREE.Vector3(0, 1, 0) },
        uTime: { value: 0 },
        uSpeed: { value: 1 },
        uSize: { value: 30 },
        uVisPos: { value: new THREE.Vector3() },
        uVisVel: { value: new THREE.Vector3() },
        uColor: { value: new THREE.Color() },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
    const points = new THREE.Points(seeds(count), mat)
    points.frustumCulled = false
    points.renderOrder = 41
    points.raycast = () => null
    points.name = 'oculus-motes'
    return { points, mat }
  }, [count])
  useEffect(
    () => () => {
      points.geometry.dispose()
      mat.dispose()
    },
    [points, mat],
  )

  const last = useRef({ x: visitor.x, z: visitor.z, vx: 0, vz: 0 })
  const col = useMemo(() => new THREE.Color(), [])
  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1)
    const u = mat.uniforms
    const L = ATMOS.uAtmosSun.value
    u.uSunDir.value.set(L.x, Math.max(L.y, 0.02), L.z)
    u.uSpeed.value = turnState.motes
    u.uTime.value += dt * turnState.motes
    // size in pixels at 1 m, from the drawing buffer height
    u.uSize.value = 0.009 * gl.getDrawingBufferSize(tmpV).y
    // the visitor's smoothed walking velocity, at body height
    const l = last.current
    if (dt > 0) {
      const vx = (visitor.x - l.x) / dt
      const vz = (visitor.z - l.z) / dt
      const ok = Math.hypot(vx, vz) < 6 // a teleport is not a gust
      const k = 1 - Math.exp(-6 * dt)
      l.vx += ((ok ? vx : 0) - l.vx) * k
      l.vz += ((ok ? vz : 0) - l.vz) * k
    }
    l.x = visitor.x
    l.z = visitor.z
    u.uVisPos.value.set(visitor.x, MUSEUM.visitor.eyeHeight * 0.65, visitor.z)
    u.uVisVel.value.set(l.vx, 0, l.vz)
    const c = sunState.curve
    const lit = (c.shaft * c.intensity) / 4.4 + c.moonShaft * 0.5
    col.set(kelvinToHex(c.colorK)).multiplyScalar(1.4 * lit * (1 - weatherNow.overcast) * turnState.shaft)
    u.uColor.value.copy(col)
    points.visible = !useMuseum.getState().sceneCompiled || lit * (1 - weatherNow.overcast) > 0.01
  })

  return (
    <ZoneGroup zones={['inner']}>
      <primitive object={points} />
    </ZoneGroup>
  )
}

const tmpV = new THREE.Vector2()
