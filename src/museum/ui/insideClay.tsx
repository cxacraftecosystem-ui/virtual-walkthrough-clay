/**
 * "INSIDE THE CLAY" (SPECTACLE F34) — a slow cut through a piece in the 3D viewer.
 *
 * A clipping plane slides through the object from its far side to its middle, and a stencil
 * cap closes the cut face, so the wall reads as solid clay. The cap shows how the piece was
 * built — coils stacked and pinched, slabs joined, thrown on the wheel (streaks rising round
 * the wall), or pressed in a two-part mould — as the curator records it in `props.section`.
 * That is a claim about the piece, so the viewer offers the cut only when the curator has set
 * it and the object is not a placeholder (InspectModal).
 *
 * Forms: Full slides over 3.2 s, Lite 1.6 s, Still shows the finished cut at once. The
 * object's own materials are never touched: the cut works on clones, given back on close.
 * Needs a canvas with a stencil buffer (`gl={{ stencil: true }}`).
 */
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, type RefObject } from 'react'
import * as THREE from 'three'
import { spectacleSettings } from '../spectacle/settings'

export type SectionKind = 'coil' | 'slab' | 'thrown' | 'moulded'
export const SECTION_KINDS: readonly SectionKind[] = ['coil', 'slab', 'thrown', 'moulded']
export const isSection = (v: unknown): v is SectionKind => typeof v === 'string' && (SECTION_KINDS as readonly string[]).includes(v)

/** The cut face's look for each way of building, drawn once per kind. */
const capCache = new Map<SectionKind, THREE.Texture>()
function capTexture(kind: SectionKind): THREE.Texture | null {
  const hit = capCache.get(kind)
  if (hit) return hit
  if (typeof document === 'undefined') return null
  const N = 512
  const c = document.createElement('canvas')
  c.width = c.height = N
  const ctx = c.getContext('2d')
  if (!ctx) return null
  // fired body: orange skins over a darker reduced core
  const g = ctx.createLinearGradient(0, 0, N, 0)
  g.addColorStop(0, '#c4673d')
  g.addColorStop(0.32, '#8a4a33')
  g.addColorStop(0.5, '#6c3d2e')
  g.addColorStop(0.68, '#8a4a33')
  g.addColorStop(1, '#c4673d')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, N, N)
  // grog: small pale grains
  let seed = 7
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  for (let i = 0; i < 900; i++) {
    ctx.fillStyle = `rgba(240,214,180,${0.12 + rnd() * 0.25})`
    ctx.fillRect(rnd() * N, rnd() * N, 1 + rnd() * 2.5, 1 + rnd() * 2)
  }
  ctx.lineCap = 'round'
  if (kind === 'coil') {
    // stacked coils: rounded joins, each slightly offset
    for (let y = 18; y < N; y += 34) {
      ctx.strokeStyle = 'rgba(48,22,12,.55)'
      ctx.lineWidth = 2.5
      ctx.beginPath()
      for (let x = 0; x <= N; x += 16) ctx.lineTo(x, y + Math.sin(x / 37 + y) * 3)
      ctx.stroke()
      ctx.strokeStyle = 'rgba(255,220,180,.18)'
      ctx.lineWidth = 6
      ctx.beginPath()
      for (let x = 0; x <= N; x += 16) ctx.lineTo(x, y + 12 + Math.sin(x / 37 + y) * 3)
      ctx.stroke()
    }
  } else if (kind === 'slab') {
    // a few slabs, scored and joined at an angle
    ctx.strokeStyle = 'rgba(48,22,12,.6)'
    ctx.lineWidth = 3
    for (const [a, b] of [
      [0, 150],
      [0, 330],
    ]) {
      ctx.beginPath()
      ctx.moveTo(a, b)
      ctx.lineTo(N, b + 40)
      ctx.stroke()
      for (let x = 10; x < N; x += 22) {
        ctx.beginPath()
        ctx.moveTo(x, b + (x / N) * 40 - 5)
        ctx.lineTo(x + 6, b + (x / N) * 40 + 5)
        ctx.stroke()
      }
    }
  } else if (kind === 'thrown') {
    // throwing streaks: fine lines rising round the wall
    ctx.strokeStyle = 'rgba(60,28,16,.35)'
    ctx.lineWidth = 1.4
    for (let i = -N; i < N * 2; i += 9) {
      ctx.beginPath()
      ctx.moveTo(i, N)
      ctx.bezierCurveTo(i + 60, N * 0.66, i + 110, N * 0.33, i + 150, 0)
      ctx.stroke()
    }
  } else {
    // two-part mould: the seam, and the pressed skin either side
    ctx.strokeStyle = 'rgba(40,18,10,.7)'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(N / 2, 0)
    ctx.lineTo(N / 2 + 6, N)
    ctx.stroke()
    ctx.strokeStyle = 'rgba(255,224,190,.25)'
    ctx.lineWidth = 2
    for (const x of [N * 0.12, N * 0.88]) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, N)
      ctx.stroke()
    }
  }
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  capCache.set(kind, tex)
  return tex
}

interface Patched {
  mesh: THREE.Mesh
  original: THREE.Material | THREE.Material[]
  clones: THREE.Material[]
  helpers: THREE.Object3D[]
}

/**
 * Cuts the meshes under `target` while `on`. Mount inside the viewer's <Canvas>.
 */
export function SectionCut({ target, kind, on }: { target: RefObject<THREE.Object3D | null>; kind: SectionKind; on: boolean }) {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const plane = useMemo(() => new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0), [])
  const state = useRef<{ patched: Patched[]; from: number; to: number; start: number; dur: number; caps: THREE.Mesh[] } | null>(null)

  useEffect(() => {
    const root = target.current
    if (!on || !root) return
    const box = new THREE.Box3().setFromObject(root)
    if (box.isEmpty()) return
    const size = box.getSize(new THREE.Vector3())
    const centre = box.getCenter(new THREE.Vector3())
    const mode = spectacleSettings().mode
    const dur = mode === 'still' ? 0 : mode === 'lite' ? 1600 : 3200
    const from = box.max.x + 0.002
    const to = centre.x
    plane.constant = mode === 'still' ? to : from
    gl.localClippingEnabled = true

    const capMat = () =>
      new THREE.MeshStandardMaterial({
        map: capTexture(kind),
        roughness: 0.9,
        metalness: 0,
        stencilWrite: true,
        stencilRef: 0,
        stencilFunc: THREE.NotEqualStencilFunc,
        stencilFail: THREE.ReplaceStencilOp,
        stencilZFail: THREE.ReplaceStencilOp,
        stencilZPass: THREE.ReplaceStencilOp,
      })
    const stencilMat = (side: THREE.Side, op: THREE.StencilOp) =>
      new THREE.MeshBasicMaterial({
        side,
        clippingPlanes: [plane],
        depthWrite: false,
        depthTest: false,
        colorWrite: false,
        stencilWrite: true,
        stencilFunc: THREE.AlwaysStencilFunc,
        stencilFail: op,
        stencilZFail: op,
        stencilZPass: op,
      })

    const patched: Patched[] = []
    const caps: THREE.Mesh[] = []
    const meshes: THREE.Mesh[] = []
    root.traverse((o) => {
      const m = o as THREE.Mesh
      if (m.isMesh && m.visible && !m.userData.sectionHelper) meshes.push(m)
    })
    meshes.forEach((mesh, i) => {
      const original = mesh.material
      const list = Array.isArray(original) ? original : [original]
      const clones = list.map((mat) => {
        const c = mat.clone()
        c.clippingPlanes = [plane]
        c.clipShadows = true
        c.side = THREE.DoubleSide
        return c
      })
      mesh.material = Array.isArray(original) ? clones : clones[0]
      const helpers: THREE.Object3D[] = []
      if (!(mesh as THREE.InstancedMesh).isInstancedMesh) {
        const back = new THREE.Mesh(mesh.geometry, stencilMat(THREE.BackSide, THREE.IncrementWrapStencilOp))
        const front = new THREE.Mesh(mesh.geometry, stencilMat(THREE.FrontSide, THREE.DecrementWrapStencilOp))
        for (const h of [back, front]) {
          h.renderOrder = 10 + i * 3
          h.userData.sectionHelper = true
          mesh.add(h)
          helpers.push(h)
        }
        // the cap: a plane on the cut, drawn only where this mesh's stencil says "inside"
        const cap = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), capMat())
        cap.renderOrder = 11 + i * 3
        cap.userData.sectionHelper = true
        cap.onAfterRender = (r) => r.clearStencil()
        scene.add(cap)
        caps.push(cap)
        helpers.push(cap)
      }
      patched.push({ mesh, original, clones, helpers })
    })
    // caps (in world space, like the plane) span the object's cross-section, facing +x
    for (const cap of caps) {
      cap.rotation.set(0, Math.PI / 2, 0)
      cap.scale.set(size.z * 1.2 + 0.01, size.y * 1.2 + 0.01, 1)
      cap.position.set(plane.constant, centre.y, centre.z)
    }
    state.current = { patched, from, to, start: performance.now(), dur, caps }

    return () => {
      for (const p of patched) {
        p.mesh.material = p.original
        p.clones.forEach((c) => c.dispose())
        for (const h of p.helpers) {
          h.removeFromParent()
          const hm = h as THREE.Mesh
          if (hm.userData.sectionHelper && hm.geometry !== p.mesh.geometry) hm.geometry.dispose()
          ;(hm.material as THREE.Material).dispose()
        }
      }
      state.current = null
      gl.localClippingEnabled = false
    }
  }, [on, kind, gl, scene, plane, target])

  useFrame(() => {
    const s = state.current
    if (!s) return
    const k = s.dur > 0 ? Math.min(1, (performance.now() - s.start) / s.dur) : 1
    const e = 1 - (1 - k) ** 3
    plane.constant = s.from + (s.to - s.from) * e
    for (const cap of s.caps) cap.position.x = plane.constant
  })

  return null
}
