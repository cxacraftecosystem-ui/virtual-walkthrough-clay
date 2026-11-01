/**
 * 'clay-bed' — a waist-high slab of wet clay that takes the visitor's hand (SPECTACLE F17).
 *
 * Drag or tap the clay and a palm and five fingertips sink in, with whorls on the pads; over
 * `healSec` the clay relaxes flat again for the next visitor. E presses a hand where the
 * crosshair (or the centre of the screen) points, or into the middle of the bed. The prints
 * live in a ping-pong heightfield (effects/heightfieldRT.ts), drawn only while there is work to
 * do and only while gallery A is in view.
 *
 *   props {width = 1.1, depth = 0.7, height = 0.86, healSec = 120, clay: 'grey' | 'red' | 'black'}
 *   tiers  L 128² normals only · M 256² · H/U 512² with the surface displaced
 *
 * Also exports the small input helpers the other hands-on pieces share (kiln lever, ghatam):
 * `useCanvasGrab` (a press that starts on the piece is the piece's, never a look-drag) and
 * `craftKeysAllowed`.
 */
import { useFrame, useThree } from '@react-three/fiber'
import { useContext, useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { proximity } from '../interaction/proximity'
import { HEIGHT_GLSL, HeightfieldRT } from '../effects/heightfieldRT'
import { playClayPress } from '../media/soundscape/craft'
import { isZoneVisible } from '../navigation/zoneCulling'
import { useSpectacle } from '../spectacle/settings'
import { useMuseum } from '../state/store'
import { Builder, box, cyl, lathe, Parts, rbox, useBuilt } from './kit'
import { vesselProfile } from './clay'
import { tinted, useModelMaterials } from './modelMaterials'
import { InMuseumScene } from './sceneContext'
import { geoKey, num, str, type ModelProps } from './types'

/* ------------------------------------------------------------------ */
/* Shared input helpers (kiln window, ghatam)                          */
/* ------------------------------------------------------------------ */

/** A key press the hands-on pieces may answer: in the pavilion, nothing typed into, no panel open. */
export function craftKeysAllowed(e: KeyboardEvent): boolean {
  const t = e.target as HTMLElement | null
  if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return false
  if (e.ctrlKey || e.metaKey || e.altKey) return false
  const s = useMuseum.getState()
  return s.phase === 'entered' && !s.inspecting && !s.helpOpen
}

/** True when `o` and all its parents are visible (zone culling hides whole groups). */
export function shown(o: THREE.Object3D | null): boolean {
  for (let p = o; p; p = p.parent) if (!p.visible) return false
  return !!o
}

export interface GrabHandlers {
  /** A press landed on one of the targets: return true to own the gesture. */
  down: (hit: THREE.Intersection, e: PointerEvent) => boolean
  /** While held: the target under the pointer (or null), and the pointer's movement in pixels. */
  move?: (hit: THREE.Intersection | null, e: PointerEvent, dx: number, dy: number) => void
  up?: (e: PointerEvent, heldMs: number) => void
}

const _ray = new THREE.Raycaster()
const _ndc = new THREE.Vector2()

/**
 * A press that starts on one of `targets()` belongs to the piece: it never turns into a
 * look-drag, a click-to-walk or a selection behind it. Mouse look (pointer lock) aims from the
 * screen centre. Presses further than `reach` metres away are left alone.
 */
export function useCanvasGrab(targets: () => (THREE.Object3D | null)[], handlers: GrabHandlers, enabled = true, reach = 4.5) {
  const gl = useThree((s) => s.gl)
  const camera = useThree((s) => s.camera)
  const h = useRef(handlers)
  const t = useRef(targets)
  useEffect(() => {
    h.current = handlers
    t.current = targets
  })
  useEffect(() => {
    if (!enabled) return
    const el = gl.domElement
    let active: number | null = null
    let lx = 0
    let ly = 0
    let at = 0
    const pick = (e: PointerEvent): THREE.Intersection | null => {
      if (document.pointerLockElement) _ndc.set(0, 0)
      else {
        const r = el.getBoundingClientRect()
        _ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
      }
      _ray.setFromCamera(_ndc, camera)
      _ray.far = reach
      const objs = t.current().filter((o): o is THREE.Object3D => shown(o))
      return objs.length ? (_ray.intersectObjects(objs, false)[0] ?? null) : null
    }
    const swallowClick = (ev: Event) => {
      ev.stopPropagation()
      ev.preventDefault()
    }
    const onDown = (e: PointerEvent) => {
      if (active !== null || e.target !== el || (e.pointerType === 'mouse' && e.button !== 0)) return
      const s = useMuseum.getState()
      if (s.phase !== 'entered' || s.inspecting) return
      const hit = pick(e)
      if (!hit || !h.current.down(hit, e)) return
      e.stopPropagation()
      e.preventDefault()
      active = e.pointerId
      lx = e.clientX
      ly = e.clientY
      at = performance.now()
      try {
        el.setPointerCapture(e.pointerId)
      } catch {
        // capture is a nicety; window listeners still follow the pointer
      }
    }
    const onMove = (e: PointerEvent) => {
      if (e.pointerId !== active) return
      e.stopPropagation()
      const dx = e.clientX - lx
      const dy = e.clientY - ly
      lx = e.clientX
      ly = e.clientY
      h.current.move?.(pick(e), e, dx, dy)
    }
    const onUp = (e: PointerEvent) => {
      if (e.pointerId !== active) return
      e.stopPropagation()
      active = null
      h.current.up?.(e, performance.now() - at)
      // the click that follows this press is ours too
      window.addEventListener('click', swallowClick, { capture: true, once: true })
      window.setTimeout(() => window.removeEventListener('click', swallowClick, true), 400)
    }
    window.addEventListener('pointerdown', onDown, true)
    window.addEventListener('pointermove', onMove, true)
    window.addEventListener('pointerup', onUp, true)
    window.addEventListener('pointercancel', onUp, true)
    return () => {
      window.removeEventListener('pointerdown', onDown, true)
      window.removeEventListener('pointermove', onMove, true)
      window.removeEventListener('pointerup', onUp, true)
      window.removeEventListener('pointercancel', onUp, true)
    }
  }, [gl, camera, enabled, reach])
}

/** Aim from the screen centre (crosshair) at `targets`. */
export function centreHit(camera: THREE.Camera, targets: (THREE.Object3D | null)[], reach = 4): THREE.Intersection | null {
  _ndc.set(0, 0)
  _ray.setFromCamera(_ndc, camera)
  _ray.far = reach
  const objs = targets.filter((o): o is THREE.Object3D => shown(o))
  return objs.length ? (_ray.intersectObjects(objs, false)[0] ?? null) : null
}

/* ------------------------------------------------------------------ */
/* The bed                                                             */
/* ------------------------------------------------------------------ */

const CLAY: Record<string, string> = { grey: '#7f776d', red: '#86452f', black: '#3b3633' }
/** Full press depth (m). */
const PRESS_DEPTH = 0.012
const SLAB_T = 0.07
const DRAG_STEP = 0.028 // m between prints along a drag

/** The bed's top surface material: the plaster grain, wet clay, and the heightfield's prints. */
function clayTopMaterial(base: THREE.Material, color: string, hf: HeightfieldRT | null, displace: boolean, size: [number, number]) {
  const src = base as THREE.MeshStandardMaterial
  const mat = new THREE.MeshStandardMaterial({
    name: 'clayBedTop',
    color,
    map: src.map,
    normalMap: src.normalMap,
    roughness: 0.44,
    metalness: 0,
    envMapIntensity: 0.95,
  })
  mat.normalScale.set(0.45, 0.45)
  if (!hf) return mat
  const uniforms = { ...hf.uniforms, uDepthM: { value: PRESS_DEPTH }, uBedSize: { value: new THREE.Vector2(size[0], size[1]) } }
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms)
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
uniform sampler2D uHeight;
uniform float uDepthM;
${HEIGHT_GLSL}
varying vec2 vHfUv;
varying vec3 vAxX;
varying vec3 vAxZ;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
vHfUv = uv;
vAxX = normalize(normalMatrix * vec3(1.0, 0.0, 0.0));
vAxZ = normalize(normalMatrix * vec3(0.0, 0.0, 1.0));
${displace ? 'transformed.y -= uDepthM * hfDecode(texture2D(uHeight, uv).r);' : ''}`,
      )
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
uniform sampler2D uHeight;
uniform vec2 uHfTexel;
uniform float uDepthM;
uniform vec2 uBedSize;
${HEIGHT_GLSL}
varying vec2 vHfUv;
varying vec3 vAxX;
varying vec3 vAxZ;
float hfAt(vec2 uv) { return hfDecode(texture2D(uHeight, uv).r); }`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
vec4 hfC = texture2D(uHeight, vHfUv);
float hfH = hfDecode(hfC.r);
// wet clay is never one colour: a slow mottle where the slip has pooled and dried
float mott = sin(vHfUv.x * 11.0 + sin(vHfUv.y * 7.0) * 1.7) * sin(vHfUv.y * 9.0 - vHfUv.x * 4.0);
diffuseColor.rgb *= 1.0 + 0.06 * mott;
// pressed clay is darker and wetter; the rim a touch lighter where it has been pushed up
diffuseColor.rgb *= 1.0 - 0.22 * smoothstep(0.0, 0.7, hfH) + 0.07 * smoothstep(0.0, -0.15, hfH);`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
roughnessFactor *= mix(1.0, 0.5, smoothstep(0.05, 0.5, hfH));`,
      )
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
{
  float hu = (hfAt(vHfUv + vec2(uHfTexel.x, 0.0)) - hfAt(vHfUv - vec2(uHfTexel.x, 0.0))) / (2.0 * uHfTexel.x);
  float hv = (hfAt(vHfUv + vec2(0.0, uHfTexel.y)) - hfAt(vHfUv - vec2(0.0, uHfTexel.y))) / (2.0 * uHfTexel.y);
  // surface y = −D·h(u, v), u = x / w + ½, v = −z / d + ½
  float sx = uDepthM * hu / uBedSize.x;
  float sz = -uDepthM * hv / uBedSize.y;
  // fingertip whorls: fine ridges round each pad, only where the clay is pressed
  float g = hfC.g;
  float ridge = 0.0;
  if (g < 0.98 && hfH > 0.25) ridge = sin(g * 6.2831853 * 7.0) * smoothstep(1.0, 0.75, g) * 0.5;
  // the long, shallow strokes of the potter's rib that smoothed the bed (gone where a hand pressed)
  ridge += sin(vHfUv.y * 210.0 + sin(vHfUv.x * 13.0) * 4.0 + sin(vHfUv.x * 41.0) * 0.6) * 0.06 * (1.0 - smoothstep(0.05, 0.3, abs(hfH)));
  vec2 rd = vec2(dFdx(ridge), dFdy(ridge));
  vec3 vSigmaX = dFdx(-vViewPosition);
  vec3 vSigmaY = dFdy(-vViewPosition);
  vec3 R1 = cross(vSigmaY, normal);
  vec3 R2 = cross(normal, vSigmaX);
  float fDet = dot(vSigmaX, R1);
  vec3 bumpGrad = sign(fDet) * (rd.x * R1 + rd.y * R2) * 0.0009;
  normal = normalize(normal + vAxX * sx + vAxZ * sz) ;
  normal = normalize(abs(fDet) * normal - bumpGrad);
}`,
      )
  }
  mat.customProgramCacheKey = () => `clayBedTop|${displace ? 'disp' : 'flat'}|${hf.encoded ? 'enc' : 'f16'}`
  return mat
}

/** A box with no top face (the clay's top is its own displaced surface). */
function openBox(w: number, h: number, d: number) {
  const g = new THREE.BoxGeometry(w, h, d)
  const top = g.groups[2] // +y
  const idx = g.index!.array
  const keep: number[] = []
  for (let i = 0; i < idx.length; i++) if (i < top.start || i >= top.start + top.count) keep.push(idx[i])
  g.setIndex(keep)
  g.clearGroups()
  return g
}

export function ClayBed({ config }: ModelProps) {
  const inScene = useContext(InMuseumScene)
  const m = useModelMaterials()
  const gl = useThree((s) => s.gl)
  const camera = useThree((s) => s.camera)
  const sp = useSpectacle()
  const W = num(config, 'width', config.footprint?.[0] ?? 1.1)
  const D = num(config, 'depth', config.footprint?.[1] ?? 0.7)
  const H = num(config, 'height', config.height ?? 0.86)
  const heal = Math.max(5, num(config, 'healSec', 120))
  const clayName = str(config, 'clay', 'grey')
  const color = CLAY[clayName] ?? CLAY.grey
  // the clay sits in a teak tray; a ledge on the right holds a water bowl and a wooden rib
  const ledge = Math.min(0.2, W * 0.16)
  const cw = W - ledge - 0.06
  const cd = D - 0.06
  const cx = -ledge / 2
  const size: [number, number] = [cw, cd]
  const rtPx = inScene ? sp.caps.clayBedRT : 0
  const displace = inScene && sp.caps.clayBedDisplace

  const hf = useMemo(() => (rtPx > 0 ? new HeightfieldRT(gl, rtPx, size) : null), [gl, rtPx, cw, cd]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => hf?.dispose(), [hf])

  const topMat = useMemo(() => clayTopMaterial(m.terracotta, color, hf, displace, size), [m, color, hf, displace, cw, cd]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => topMat.dispose(), [topMat])
  const topGeo = useMemo(() => {
    const g = new THREE.PlaneGeometry(cw, cd, displace ? Math.round(cw * 150) : 1, displace ? Math.round(cd * 150) : 1)
    g.rotateX(-Math.PI / 2)
    return g
  }, [cw, cd, displace])
  useEffect(() => () => topGeo.dispose(), [topGeo])

  const parts = useBuilt(geoKey('clay-bed', config, `${cw}x${cd}`), () => {
    const b = new Builder()
    const trayY = H - SLAB_T // tray floor top
    // the clay slab's sides (its top is the heightfield surface)
    b.add('claySide', openBox(cw, SLAB_T, cd), { p: [cx, trayY + SLAB_T / 2, 0] })
    // teak tray: floor and a rim just proud of the clay
    b.add('teak', box(W, 0.03, D), { p: [0, trayY - 0.015, 0] })
    const rimH = SLAB_T + 0.012
    for (const s of [-1, 1]) {
      b.add('teak', rbox(W, rimH, 0.03, 0.006), { p: [0, trayY + rimH / 2, s * (D / 2 - 0.015)] })
      b.add('teak', rbox(0.03, rimH, D - 0.06, 0.006), { p: [s * (W / 2 - 0.015), trayY + rimH / 2, 0] })
    }
    // divider between the clay and the ledge
    b.add('teak', rbox(0.025, rimH, D - 0.06, 0.005), { p: [cx + cw / 2 + 0.0125, trayY + rimH / 2, 0] })
    // trestle legs and stretchers
    const legH = trayY - 0.03
    for (const sx of [-1, 1])
      for (const sz of [-1, 1]) b.add('teak', rbox(0.05, legH, 0.05, 0.008), { p: [sx * (W / 2 - 0.07), legH / 2, sz * (D / 2 - 0.07)] })
    for (const sx of [-1, 1]) b.add('teak', rbox(0.035, 0.05, D - 0.14, 0.006), { p: [sx * (W / 2 - 0.07), 0.16, 0] })
    b.add('teak', rbox(W - 0.14, 0.05, 0.035, 0.006), { p: [0, 0.16, 0] })
    // on the ledge: a bowl of slip water and a wooden potter's rib
    const lx = W / 2 - ledge / 2 - 0.02
    b.add('bowl', lathe(vesselProfile('bowl', 0.07, 0.06), 28), { p: [lx, trayY + 0.001, -D * 0.18] })
    b.add('slip', cyl(0.058, 0.058, 0.002, 24), { p: [lx, trayY + 0.045, -D * 0.18] })
    b.add('teak', rbox(0.11, 0.008, 0.05, 0.004), { p: [lx, trayY + 0.004, D * 0.2], r: [0, 0.5, 0] })
    return b
  })

  const top = useRef<THREE.Mesh>(null)
  const drag = useRef({ last: null as THREE.Vector3 | null, lastSound: 0 })
  const invite = useRef({ at: -1e9 })
  const healRef = useRef(heal)
  useEffect(() => {
    healRef.current = heal
  }, [heal])
  const _v = useMemo(() => new THREE.Vector3(), [])
  const _inv = useMemo(() => new THREE.Matrix4(), [])

  /** Print a hand at a world point on the bed, fingers pointing away from the camera. */
  const pressAt = (point: THREE.Vector3, uv: THREE.Vector2, strength = 1) => {
    if (!hf || !top.current) return
    _inv.copy(top.current.matrixWorld).invert()
    const cam = _v.copy(camera.position).applyMatrix4(_inv)
    const loc = point.clone().applyMatrix4(_inv)
    // direction camera → point in bed-local plan, as uv-metres (v points to −z)
    const dx = loc.x - cam.x
    const dz = -(loc.z - cam.z)
    const angle = Math.atan2(dx, dz)
    hf.stamp(uv.x, uv.y, angle, strength)
    const now = performance.now()
    if (now - drag.current.lastSound > 220) {
      drag.current.lastSound = now
      playClayPress([point.x, point.y, point.z], strength)
    }
  }

  useCanvasGrab(
    () => [top.current],
    {
      down: (hit) => {
        if (!hit.uv) return false
        pressAt(hit.point, hit.uv, 1)
        drag.current.last = hit.point.clone()
        return true
      },
      move: (hit) => {
        if (!hit?.uv || hit.object !== top.current) return
        const last = drag.current.last
        if (last && last.distanceTo(hit.point) < DRAG_STEP) return
        pressAt(hit.point, hit.uv, 0.8)
        drag.current.last = hit.point.clone()
      },
      up: () => {
        drag.current.last = null
      },
    },
    inScene && !!hf,
  )

  // E: a hand where the crosshair points, else into the middle of the bed
  useEffect(() => {
    if (!inScene || !hf) return
    const onKey = (e: KeyboardEvent) => {
      if ((e.key !== 'e' && e.key !== 'E') || e.repeat || !craftKeysAllowed(e) || !top.current) return
      const p = new THREE.Vector3().setFromMatrixPosition(top.current.matrixWorld)
      if (proximity(p.x, p.z, 1.3, 2.4) < 0.5) return
      const hit = centreHit(camera, [top.current], 3.5)
      if (hit?.uv) pressAt(hit.point, hit.uv, 1)
      else if (useMuseum.getState().nearby) return
      else {
        const uv = new THREE.Vector2(0.5 + (Math.random() - 0.5) * 0.4, 0.5 + (Math.random() - 0.5) * 0.3)
        pressAt(p, uv, 1)
      }
      e.stopPropagation()
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [inScene, hf, camera]) // eslint-disable-line react-hooks/exhaustive-deps

  useFrame((state) => {
    if (!hf) return
    // the field works only while gallery A can be seen; out of sight it waits (and catches up on return)
    if (!isZoneVisible('ring-a')) return
    // an invitation: the first time someone comes up to a smooth bed, a hand has just been here
    const t = state.clock.elapsedTime
    const inv = invite.current
    if (top.current && hf.lastStampAt < 0 && t - inv.at > healRef.current + 30) {
      const e = top.current.matrixWorld.elements
      if (proximity(e[12], e[14], 1.8, 2.8) > 0.5) {
        inv.at = t
        hf.stamp(0.42 + Math.random() * 0.16, 0.45 + Math.random() * 0.1, (Math.random() - 0.5) * 0.6, 0.8)
      }
    }
    hf.update(t, healRef.current)
  })

  // automation / tests: window.__clayBed
  useEffect(() => {
    if (!inScene || !hf) return
    const g = globalThis as { __clayBed?: unknown }
    g.__clayBed = {
      press: (u = 0.5, v = 0.5, angle = 0) => hf.stamp(u, v, angle, 1),
      maxDepth: () => hf.maxDepth(),
      setHeal: (sec: number) => {
        healRef.current = Math.max(1, sec)
      },
      get healSec() {
        return healRef.current
      },
      encoded: hf.encoded,
      size: hf.size,
    }
    return () => {
      if (g.__clayBed) g.__clayBed = undefined
    }
  }, [inScene, hf])

  const sideMat = tinted(m.terracotta, color, { roughness: 0.7, envMapIntensity: 0.6 })
  const slip = tinted(m.terracotta, color, { roughness: 0.15, envMapIntensity: 1.1 })
  return (
    <group>
      <Parts parts={parts} materials={{ claySide: sideMat, teak: m.teak, bowl: m.terracotta, slip }} />
      <mesh ref={top} geometry={topGeo} material={topMat} position={[cx, H, 0]} receiveShadow name="clay-bed-top" />
    </group>
  )
}
