/**
 * 'ghatam-set' — five clay pot drums on a low dais, to play (SPECTACLE F19).
 *
 * Tap a pot (or press 1–5 when standing at the set; Shift for the bright stroke): near the mouth
 * it answers with the deep "gum", on the shoulder with a bright "tak". Hold a press on a pot and
 * the mouth opens for the bending bass, the "gumki". The struck pot trembles and a puff of clay
 * dust lifts from it. Brass plates on the dais carry one to five dots, the keys that play them.
 *
 *   props {count = 5, pitches = '1,1.12,1.26,1.5,1.68' (ratios of Sa), keys = true}
 *   Still form: no trembling or dust — the sound only.
 */
import { useFrame } from '@react-three/fiber'
import { useContext, useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { proximity } from '../interaction/proximity'
import { playGhatam } from '../media/soundscape/craft'
import { SA, ghatamPitches } from '../config/spectacleObjects/craft'
import { useSpectacle } from '../spectacle/settings'
import { Builder, cyl, lathe, Parts, rbox, rng, useBuilt } from './kit'
import { clayMaterial } from './clay'
import { craftKeysAllowed, useCanvasGrab } from './clayBed'
import { useModelMaterials } from './modelMaterials'
import { InMuseumScene } from './sceneContext'
import { geoKey, num, str, type ModelProps } from './types'

/** The pots stand on a low teak table at hand height for a standing player. */
const DAIS_H = 0.5
const GUMKI_MS = 380

/** Ghatam profile (unit height): a broad round belly, a short neck and a thick rolled lip. */
function ghatamProfile(R: number, Hh: number): [number, number][] {
  const out: [number, number][] = [
    [0, 0],
    [0.3, 0],
    [0.62, 0.05],
    [0.9, 0.2],
    [1, 0.42],
    [0.93, 0.64],
    [0.72, 0.8],
    [0.4, 0.89],
    [0.31, 0.93],
    [0.34, 0.97],
    [0.33, 1],
  ].map(([r, y]) => [r * R, y * Hh] as [number, number])
  const t = R * 0.07
  return [...out, [0.33 * R - t, Hh - t * 0.3], [0.29 * R - t, 0.93 * Hh], [0.36 * R - t, 0.89 * Hh], [0.6 * R - t, 0.8 * Hh], [0.85 * R - t, 0.55 * Hh], [0.55 * R - t, 0.1 * Hh], [0, t]]
}

interface Puff {
  pot: number
  t: number
}

const DUST = 10 // grains per puff
const PUFFS = 4

export function GhatamSet({ config }: ModelProps) {
  const inScene = useContext(InMuseumScene)
  const m = useModelMaterials()
  const sp = useSpectacle()
  const still = sp.mode === 'still'
  const count = Math.max(1, Math.min(8, Math.round(num(config, 'count', 5))))
  const pitches = useMemo(() => ghatamPitches(str(config, 'pitches', '1,1.12,1.26,1.5,1.68'), count), [config, count])
  const keysOn = config.props?.keys !== false
  const W = config.footprint?.[0] ?? 1.6
  const D = config.footprint?.[1] ?? 0.7

  // the pots: lower pitches are the larger pots; set out in a shallow arc open to the front
  const pots = useMemo(() => {
    return pitches.map((p, i) => {
      const k = count === 1 ? 0 : i / (count - 1) - 0.5
      const s = Math.pow(1 / p, 0.45)
      const R = 0.17 * s
      const Hh = 0.33 * s
      return { x: k * (W - 0.36), z: -Math.abs(k) * 0.16 + 0.02, R, H: Hh, f0: SA * p, tilt: k * 0.12 }
    })
  }, [pitches, count, W])

  const potGeos = useMemo(() => pots.map((p) => lathe(ghatamProfile(p.R, p.H), 44)), [pots])
  useEffect(() => () => potGeos.forEach((g) => g.dispose()), [potGeos])
  const ringGeo = useMemo(() => new THREE.TorusGeometry(0.1, 0.028, 10, 28), [])
  useEffect(() => () => ringGeo.dispose(), [ringGeo])

  const parts = useBuilt(geoKey('ghatam-set', config, String(count)), () => {
    const b = new Builder()
    // a low teak table: top, apron, four legs and a shelf, with a woven mat on top
    const topT = 0.045
    b.add('teak', rbox(W, topT, D, 0.01), { p: [0, DAIS_H - 0.02 - topT / 2, 0] })
    for (const sz of [-1, 1]) b.add('teak', rbox(W - 0.1, 0.08, 0.025, 0.005), { p: [0, DAIS_H - 0.02 - topT - 0.04, sz * (D / 2 - 0.05)] })
    for (const sx of [-1, 1]) {
      b.add('teak', rbox(0.025, 0.08, D - 0.1, 0.005), { p: [sx * (W / 2 - 0.05), DAIS_H - 0.02 - topT - 0.04, 0] })
      for (const sz of [-1, 1]) b.add('teak', rbox(0.06, DAIS_H - 0.02 - topT, 0.06, 0.008), { p: [sx * (W / 2 - 0.06), (DAIS_H - 0.02 - topT) / 2, sz * (D / 2 - 0.06)] })
    }
    b.add('teak', rbox(W - 0.14, 0.025, D - 0.14, 0.005), { p: [0, 0.12, 0] })
    b.add('mat', rbox(W - 0.06, 0.02, D - 0.06, 0.004), { p: [0, DAIS_H - 0.01, 0] })
    // brass key plates at the front edge: one to five dots
    pots.forEach((p, i) => {
      b.add('brass', rbox(0.07, 0.012, 0.035, 0.003), { p: [p.x, DAIS_H - 0.042, D / 2 + 0.006], r: [Math.PI / 2, 0, 0] })
      for (let d = 0; d <= i; d++) b.add('dot', cyl(0.0035, 0.0035, 0.004, 8), { p: [p.x + (d - i / 2) * 0.011, DAIS_H - 0.042, D / 2 + 0.0125], r: [Math.PI / 2, 0, 0] })
    })
    return b
  })

  const potRefs = useRef<(THREE.Mesh | null)[]>([])
  const root = useRef<THREE.Group>(null)
  const wobble = useRef(pots.map(() => ({ amp: 0, t: 0 })))
  useEffect(() => {
    wobble.current = pots.map(() => ({ amp: 0, t: 0 }))
  }, [pots])
  const puffs = useRef<Puff[]>([])
  const dust = useRef<THREE.InstancedMesh>(null)
  const press = useRef<{ pot: number; at: number; stroke: 'gum' | 'tak' } | null>(null)
  const _w = useMemo(() => new THREE.Vector3(), [])

  const strike = (i: number, stroke: 'gum' | 'tak' | 'gumki', level = 1) => {
    const p = pots[i]
    if (!p || !root.current) return
    strikeHook.fn?.()
    root.current.localToWorld(_w.set(p.x, DAIS_H + p.H * 0.6, p.z))
    playGhatam([_w.x, _w.y, _w.z], p.f0, stroke, level)
    if (still) return
    const w = wobble.current[i]
    w.amp = stroke === 'tak' ? 0.6 : 1
    w.t = 0
    puffs.current.push({ pot: i, t: 0 })
    if (puffs.current.length > PUFFS) puffs.current.shift()
  }

  useCanvasGrab(
    () => potRefs.current,
    {
      down: (hit) => {
        const i = potRefs.current.indexOf(hit.object as THREE.Mesh)
        if (i < 0) return false
        const p = pots[i]
        const local = hit.object.worldToLocal(hit.point.clone())
        // the upper part (round the mouth) gives the bass; the shoulder and belly the bright stroke
        const stroke = local.y > p.H * 0.72 ? 'gum' : 'tak'
        press.current = { pot: i, at: performance.now(), stroke }
        return true
      },
      up: (_e, heldMs) => {
        const pr = press.current
        press.current = null
        if (!pr) return
        strike(pr.pot, heldMs > GUMKI_MS ? 'gumki' : pr.stroke)
      },
    },
    inScene,
  )

  // keys 1–5: only when standing at the set
  useEffect(() => {
    if (!inScene || !keysOn) return
    const onKey = (e: KeyboardEvent) => {
      const n = Number(e.key)
      const code = /^Digit(\d)$/.exec(e.code)
      const i = (code ? Number(code[1]) : n) - 1
      if (!Number.isInteger(i) || i < 0 || i >= pots.length || e.repeat || !craftKeysAllowed(e) || !root.current) return
      root.current.getWorldPosition(_w)
      if (proximity(_w.x, _w.z, 1.2, 2.5) <= 0.5) return
      strike(i, e.shiftKey ? 'tak' : 'gum')
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [inScene, keysOn, pots]) // eslint-disable-line react-hooks/exhaustive-deps

  // automation / tests: window.__ghatam
  useEffect(() => {
    if (!inScene) return
    const g = globalThis as { __ghatam?: unknown }
    let strikes = 0
    g.__ghatam = {
      get strikes() {
        return strikes
      },
      count: pots.length,
    }
    const prev = strikeHook.fn
    strikeHook.fn = () => strikes++
    return () => {
      strikeHook.fn = prev
      g.__ghatam = undefined
    }
  }, [inScene, pots.length])

  const _m = useMemo(() => new THREE.Matrix4(), [])
  const _q = useMemo(() => new THREE.Quaternion(), [])
  const _s = useMemo(() => new THREE.Vector3(), [])
  const _p = useMemo(() => new THREE.Vector3(), [])
  const seeds = useMemo(() => {
    const r = rng('ghatam-dust')
    return Array.from({ length: PUFFS * DUST }, () => [r() * Math.PI * 2, 0.4 + r() * 0.6, r()])
  }, [])

  useFrame((_, dt) => {
    // trembling: a quick damped wobble of the struck pot
    wobble.current.forEach((w, i) => {
      const mesh = potRefs.current[i]
      if (!mesh) return
      if (w.amp > 0.001) {
        w.t += dt
        w.amp *= Math.exp(-dt * 6)
        const a = w.amp * Math.sin(w.t * 52)
        mesh.scale.set(1 + a * 0.012, 1 - a * 0.018, 1 + a * 0.012)
        mesh.rotation.z = pots[i].tilt * 0.2 + a * 0.02
      } else if (mesh.scale.y !== 1) {
        mesh.scale.set(1, 1, 1)
        w.amp = 0
      }
    })
    // dust: grains drift up and out from the struck pot's mouth and fade
    const d = dust.current
    if (!d) return
    let n = 0
    for (let k = 0; k < puffs.current.length; k++) {
      const pf = puffs.current[k]
      pf.t += dt
      const p = pots[pf.pot]
      if (!p) continue
      const life = 1.6
      const u = pf.t / life
      if (u >= 1) continue
      for (let j = 0; j < DUST; j++) {
        const [ang, sp2, ph] = seeds[(k * DUST + j) % seeds.length]
        const r = p.R * 0.35 + u * 0.14 * sp2
        _p.set(p.x + Math.cos(ang) * r, DAIS_H + p.H * (0.95 + u * 0.9 * sp2), p.z + Math.sin(ang) * r)
        const sz = (0.012 + u * 0.03) * (1 - u) * (0.6 + ph * 0.6)
        _s.setScalar(Math.max(0.0001, sz))
        _m.compose(_p, _q, _s)
        d.setMatrixAt(n++, _m)
      }
    }
    puffs.current = puffs.current.filter((p) => p.t < 1.6)
    d.count = n
    d.instanceMatrix.needsUpdate = true
    // no draw call between puffs (the material stays mounted, so it was compiled)
    dustMat.visible = n > 0
  })

  const clay = clayMaterial(m, 'terracotta', 0.35)
  const dark = clayMaterial(m, 'red', 0.5)
  const dustMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#c9a888', transparent: true, opacity: 0.35, depthWrite: false }), [])
  useEffect(() => () => dustMat.dispose(), [dustMat])
  const dustGeo = useMemo(() => new THREE.IcosahedronGeometry(1, 0), [])
  useEffect(() => () => dustGeo.dispose(), [dustGeo])

  return (
    <group ref={root}>
      <Parts parts={parts} materials={{ teak: m.teak, mat: m.rope, brass: m.brass, dot: m.blackSteel }} />
      {pots.map((p, i) => (
        <group key={i} position={[p.x, DAIS_H, p.z]}>
          {/* a coiled cloth ring holds each pot */}
          <mesh geometry={ringGeo} material={m.upholstery} rotation={[Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} scale={p.R / 0.17} receiveShadow />
          <mesh
            ref={(el) => {
              potRefs.current[i] = el
            }}
            geometry={potGeos[i]}
            material={i % 2 ? dark : clay}
            position={[0, 0.012, 0]}
            rotation={[0, 0, p.tilt * 0.2]}
            castShadow
            receiveShadow
          />
        </group>
      ))}
      <instancedMesh ref={dust} args={[dustGeo, dustMat, PUFFS * DUST]} count={0} frustumCulled={false} renderOrder={2} />
    </group>
  )
}

/** Test hook: counts strikes (window.__ghatam.strikes). */
const strikeHook: { fn: (() => void) | null } = { fn: null }
