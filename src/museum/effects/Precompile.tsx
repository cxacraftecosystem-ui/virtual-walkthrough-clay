/**
 * Compile every scene shader asynchronously (KHR_parallel_shader_compile via
 * renderer.compileAsync) before the first frame is drawn. Without this, ANGLE/D3D
 * compiles programs synchronously on first render and freezes the page for seconds.
 * Rendering (App frameloop) and the "Enter Exhibition" button wait for it.
 *
 * Every animated or hidden material of the spectacle is mounted at startup (count 0, intensity 0,
 * reveal 0) so it is compiled here too, and the shared light engine (lighting/atmosphere/inject.ts)
 * is patched into every lit material first: the program count does not grow after Enter.
 */
import { useProgress } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { useEffect } from 'react'
import * as THREE from 'three'
import { withZonesVisible } from '../navigation/zoneCulling'
import { useMuseum } from '../state/store'
import { injectAtmosphereTree, installAtmosphere } from '../lighting/atmosphere/inject'
import { QUALITY_PRESETS, withDevOverrides } from '../config/quality'
import { isWebGPU } from '../utils/renderer'
import { projectionTargets } from '../media/projection/projectionTarget'
import { requestShadowRefresh } from '../lighting/SkyAndSun'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * Draw the whole scene once where the real frames will go: the composer's half-float buffer when
 * post-processing is on (a small stand-in of the same format), else the canvas itself (still
 * behind the loading screen) — so the programs used are exactly the ones the visit will use.
 */
function warmDraw(gl: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, composer: boolean) {
  const rt = composer ? new THREE.WebGLRenderTarget(16, 16, { type: THREE.HalfFloatType }) : null
  const prev = gl.getRenderTarget()
  // look at everything: no frustum culling for this one draw
  const culled: THREE.Object3D[] = []
  scene.traverse((o) => {
    if (o.frustumCulled) {
      o.frustumCulled = false
      culled.push(o)
    }
  })
  try {
    gl.setRenderTarget(rt)
    // the shadow maps are redrawn on demand only: draw them now too, so every caster's depth
    // program is built here rather than on the first sun move or tier change
    gl.shadowMap.needsUpdate = true
    withZonesVisible(null, () => gl.render(scene, camera))
  } finally {
    gl.setRenderTarget(prev)
    for (const o of culled) o.frustumCulled = true
    rt?.dispose()
  }
  requestShadowRefresh()
}

type Drawable = THREE.Mesh | THREE.Points | THREE.Line | THREE.Sprite

/**
 * What decides a draw's programs beyond its material: the object's type and shadow flags, and the
 * geometry's vertex layout (ANGLE on D3D builds a shader variant per input layout on first draw).
 */
function drawKey(o: Drawable): string {
  const g = o.geometry as THREE.BufferGeometry | undefined
  const attrs = g
    ? Object.entries(g.attributes)
        .map(([n, a]) => {
          const arr = (a as THREE.BufferAttribute).array ?? (a as THREE.InterleavedBufferAttribute).data?.array
          return `${n}${a.itemSize}${arr?.constructor.name ?? ''}${a.normalized ? 'n' : ''}${(a as THREE.InterleavedBufferAttribute).isInterleavedBufferAttribute ? 'i' : ''}`
        })
        .sort()
        .join(',') + (g.morphAttributes.position ? 'M' : '') + (g.index ? (g.index.array.constructor.name === 'Uint32Array' ? 'I32' : 'I') : '')
    : ''
  const mats = (Array.isArray(o.material) ? o.material : [o.material]).map((m) => m?.uuid ?? '').join('+')
  const inst = (o as THREE.InstancedMesh).isInstancedMesh ? `inst${(o as THREE.InstancedMesh).instanceColor ? 'C' : ''}` : ''
  return `${o.type}|${inst}|${(o as THREE.SkinnedMesh).isSkinnedMesh ? 'skin' : ''}|${o.castShadow ? 1 : 0}${o.receiveShadow ? 1 : 0}|${mats}|${attrs}`
}

/**
 * The first draw, in slices: one draw per distinct program set (material × vertex layout ×
 * object type), a few per task, yielding in between. On D3D the driver finishes each shader on
 * its first real draw (about a second each on a laptop GPU); in one go that froze the page for
 * minutes behind the loading screen. Sliced, the page stays live and the cost is the same.
 */
async function warmDrawSliced(gl: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, composer: boolean, cancelled: () => boolean) {
  const reps: Drawable[] = []
  const seen = new Set<string>()
  withZonesVisible(null, () =>
    scene.traverseVisible((o) => {
      const d = o as Drawable
      if (!(d as THREE.Mesh).isMesh && !(d as THREE.Points).isPoints && !(d as THREE.Line).isLine && !(d as THREE.Sprite).isSprite) return
      const k = drawKey(d)
      if (seen.has(k)) return
      seen.add(k)
      reps.push(d)
    }),
  )
  const rt = composer ? new THREE.WebGLRenderTarget(16, 16, { type: THREE.HalfFloatType }) : null
  const prev = gl.getRenderTarget()
  const PER_SLICE = 3
  try {
    for (let i = 0; i < reps.length; i += PER_SLICE) {
      if (cancelled()) return
      const batch = new Set<THREE.Object3D>(reps.slice(i, i + PER_SLICE).filter((o) => o.parent))
      if (!batch.size) continue
      withZonesVisible(null, () => {
        // only this slice's drawables are shown; their ancestors stay as they are
        const hidden: THREE.Object3D[] = []
        const culled: THREE.Object3D[] = []
        scene.traverse((o) => {
          const isDraw = (o as THREE.Mesh).isMesh || (o as THREE.Points).isPoints || (o as THREE.Line).isLine || (o as THREE.Sprite).isSprite
          if (isDraw && o.visible && !batch.has(o)) {
            o.visible = false
            hidden.push(o)
          }
          if (batch.has(o) && o.frustumCulled) {
            o.frustumCulled = false
            culled.push(o)
          }
        })
        try {
          gl.setRenderTarget(rt)
          gl.render(scene, camera)
        } finally {
          gl.setRenderTarget(prev)
          for (const o of hidden) o.visible = true
          for (const o of culled) o.frustumCulled = true
        }
      })
      await sleep(0)
    }
  } finally {
    rt?.dispose()
  }
}

export function Precompile() {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  // Camera read at compile time, not a dependency: <XR> swaps the camera on session start/end,
  // which must not reset sceneCompiled (frameloop 'never' would blank the headset).
  const get = useThree((s) => s.get)

  useEffect(() => installAtmosphere(gl), [gl])

  useEffect(() => {
    const { setSceneCompiled } = useMuseum.getState()
    setSceneCompiled(false)
    let cancelled = false
    const start = performance.now()
    ;(async () => {
      // Wait for loaders (artwork images, models) to go idle, max 20 s.
      for (;;) {
        if (cancelled) return
        const p = useProgress.getState()
        const elapsed = performance.now() - start
        if ((!p.active && elapsed > 900) || elapsed > 20000) break
        await sleep(150)
      }
      await sleep(300) // let Suspense commits and canvas typography settle
      // Every lit material mounted now joins the shared light engine before it compiles (SPECTACLE §3);
      // later ones are caught by the hook installed below.
      injectAtmosphereTree(scene, gl)
      try {
        // compileAsync traverses only visible objects (synchronously, before its promise): show every
        // zone for that traversal so culled rooms don't compile on first entry after a tier change.
        const t0 = performance.now()
        // Programs depend on the target drawn into (tone mapping and colour space are applied in
        // the shader only when drawing to the canvas): compile for where the frames will go, the
        // composer's half-float buffer when post-processing is on, or nothing is reused on the first draw.
        const { tier } = useMuseum.getState()
        const composer = withDevOverrides(QUALITY_PRESETS[tier]).postprocessing
        const standIn = composer ? new THREE.WebGLRenderTarget(16, 16, { type: THREE.HalfFloatType }) : null
        const prevTarget = gl.getRenderTarget()
        gl.setRenderTarget(standIn)
        let compiling: Promise<unknown>
        try {
          compiling = withZonesVisible(null, () => gl.compileAsync(scene, get().camera))
        } finally {
          gl.setRenderTarget(prevTarget)
        }
        await compiling.finally(() => standIn?.dispose())
        // generated pictures drawn into their own targets (the Kiln Film) live outside the scene
        await Promise.all([...projectionTargets].map((pt) => pt.compile(gl)))
        // One small offscreen draw of everything (every zone, every moment still mounted visible
        // with nothing to show): the driver finishes each program on its first real draw, so that
        // cost lands here, behind the loading screen, not on the first festival night or monsoon.
        const t1 = performance.now()
        if (!cancelled && !isWebGPU()) {
          await warmDrawSliced(gl, scene, get().camera, composer, () => cancelled)
          // then the whole scene once (quick now): anything the slices missed, and a full shadow map
          if (!cancelled) warmDraw(gl, scene, get().camera, composer)
        }
        if (process.env.NODE_ENV !== 'production')
          console.info(
            `[museum] ${gl.info.programs?.length ?? '?'} programs: compile ${((t1 - t0) / 1000).toFixed(1)} s, first draw ${((performance.now() - t1) / 1000).toFixed(1)} s`,
          )
      } catch (err) {
        console.warn('[museum] async shader compile failed; falling back to on-demand compile', err)
      }
      if (!cancelled) setSceneCompiled(true)
    })()
    return () => {
      cancelled = true
    }
  }, [gl, scene, get])

  return null
}
