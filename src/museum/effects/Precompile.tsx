/**
 * Compile the scene's shaders asynchronously (KHR_parallel_shader_compile via
 * renderer.compileAsync) before the first frame is drawn. Without this, ANGLE/D3D
 * compiles programs synchronously on first render and freezes the page for seconds.
 * Rendering (App frameloop) and the "Enter Exhibition" button wait only for the zones visible
 * from where the visitor stands; every other zone is compiled and first-drawn afterwards, in the
 * background, a few programs at a time between frames.
 *
 * Every animated or hidden material of the spectacle is mounted at startup (count 0, intensity 0,
 * reveal 0) so it is compiled here too, and the shared light engine (lighting/atmosphere/inject.ts)
 * is patched into every lit material first: the program count does not grow after Enter.
 */
import { useProgress } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect } from 'react'
import { create } from 'zustand'
import * as THREE from 'three'
import { withZonesVisible } from '../navigation/zoneCulling'
import { ZONES, ZONE_VISIBILITY, zoneAt, type ZoneId } from '../config/layout'
import { useMuseum } from '../state/store'
import { injectAtmosphereTree, installAtmosphere } from '../lighting/atmosphere/inject'
import { QUALITY_PRESETS, withDevOverrides } from '../config/quality'
import { isWebGPU } from '../utils/renderer'
import { projectionTargets } from '../media/projection/projectionTarget'
import { requestShadowRefresh } from '../lighting/SkyAndSun'
import { teamModels } from '../models/teamPiece'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
/** Never wait longer than this for the team's pieces (their preload gives up sooner on its own). */
const TEAM_WAIT_MAX_MS = 250000
/** Between the background warm-up's slices: frames keep drawing in between. */
const BACKGROUND_PAUSE_MS = 200

/**
 * The first view's preparation, for the loading bar and the note shown if the visitor enters before it ends:
 * the drawables first-drawn of those it needs, and whether this is the visit's first preparation (a tier
 * change prepares again: "Applying graphics settings").
 */
export const usePrecompileProgress = create<{ done: number; total: number; first: boolean }>(() => ({ done: 0, total: 0, first: true }))

/** The zone the camera stands in (null when outside every zone: then everything is compiled up front). */
function zoneOf(p: THREE.Vector3): ZoneId | null {
  return zoneAt(p.x, p.z)?.id ?? null
}

/**
 * Draw the whole scene once where the real frames will go: the composer's half-float buffer when
 * post-processing is on (a small stand-in of the same format), else the canvas itself (still
 * behind the loading screen) — so the programs used are exactly the ones the visit will use.
 */
function warmDraw(gl: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, composer: boolean, zone: ZoneId | null) {
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
    withZonesVisible(zone, () => gl.render(scene, camera))
  } finally {
    gl.setRenderTarget(prev)
    for (const o of culled) o.frustumCulled = true
    rt?.dispose()
  }
  requestShadowRefresh()
}

type Drawable = THREE.Mesh | THREE.Points | THREE.Line | THREE.Sprite

/**
 * What decides a draw's programs: the program each material compiled to (hundreds of materials share
 * a few programs: keying by material drew each of them, minutes on a laptop GPU), a shadow caster's
 * depth variant (alpha test, alpha and displacement maps, side), the object's type and shadow flags,
 * and the geometry's vertex layout (ANGLE on D3D builds a shader variant per input layout on first draw).
 */
function drawKey(o: Drawable, gl: THREE.WebGLRenderer): string {
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
  const mats = (Array.isArray(o.material) ? o.material : [o.material])
    .map((m) => {
      if (!m) return ''
      const program = (gl.properties.get(m) as { currentProgram?: { id: number } }).currentProgram
      const s = m as THREE.MeshStandardMaterial
      const depth = o.castShadow ? `d${m.alphaTest > 0 ? 1 : 0}${s.alphaMap ? 1 : 0}${s.displacementMap ? 1 : 0}${m.side}` : ''
      return (program ? `p${program.id}` : m.uuid) + depth
    })
    .join('+')
  const inst = (o as THREE.InstancedMesh).isInstancedMesh ? `inst${(o as THREE.InstancedMesh).instanceColor ? 'C' : ''}` : ''
  return `${o.type}|${inst}|${(o as THREE.SkinnedMesh).isSkinnedMesh ? 'skin' : ''}|${o.castShadow ? 1 : 0}${o.receiveShadow ? 1 : 0}|${mats}|${attrs}`
}

/**
 * The first draw, in slices: one draw per distinct program set (material × vertex layout ×
 * object type), a few per task, yielding in between. On D3D the driver finishes each shader on
 * its first real draw (about a second each on a laptop GPU); in one go that froze the page for
 * minutes behind the loading screen. Sliced, the page stays live and the cost is the same.
 */
/** One drawable for each distinct draw shown for `zone` (null: every zone) that `seen` does not hold yet. */
function representatives(gl: THREE.WebGLRenderer, scene: THREE.Scene, zone: ZoneId | null, seen: Set<string>): Drawable[] {
  const reps: Drawable[] = []
  withZonesVisible(zone, () =>
    scene.traverseVisible((o) => {
      const d = o as Drawable
      if (!(d as THREE.Mesh).isMesh && !(d as THREE.Points).isPoints && !(d as THREE.Line).isLine && !(d as THREE.Sprite).isSprite) return
      const k = drawKey(d, gl)
      if (seen.has(k)) return
      seen.add(k)
      reps.push(d)
    }),
  )
  return reps
}

/**
 * `perSlice` drawables a task and `pause` ms between tasks: three at once behind the loading screen; one at a
 * time, well apart, once the visit is drawing frames in between. `onSlice` reports the drawables done.
 */
async function warmDrawSliced(
  gl: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  composer: boolean,
  reps: Drawable[],
  cancelled: () => boolean,
  { perSlice = 3, pause = 0, onSlice }: { perSlice?: number; pause?: number; onSlice?: (done: number) => void } = {},
) {
  const rt = composer ? new THREE.WebGLRenderTarget(16, 16, { type: THREE.HalfFloatType }) : null
  const prev = gl.getRenderTarget()
  const PER_SLICE = perSlice
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
      onSlice?.(Math.min(reps.length, i + PER_SLICE))
      await sleep(pause)
    }
  } finally {
    rt?.dispose()
  }
}

/* ------------------------------------------------------------------ */
/* Late arrivals: compiled before their first draw                     */
/* ------------------------------------------------------------------ */

/**
 * Objects mounted after the first view is ready (a spectacle moment that mounts when it starts, a room's sun shaft
 * and motes, its strata wall): a material with no program yet was compiled on its first draw, synchronously, the
 * frame stopped for seconds (9 s on entering the theatre). Each such object is held off the frame on a spare layer
 * while its programs compile in parallel (KHR_parallel_shader_compile), the shared light engine patched in first,
 * then let back in.
 */
const HOLD_LAYER = 31
const arrivals: THREE.Object3D[] = []
let watchArrivals = false
const PATCHED = Symbol.for('museum.lateCompile')
const proto = THREE.Object3D.prototype as THREE.Object3D & { [PATCHED]?: boolean }
if (!proto[PATCHED]) {
  proto[PATCHED] = true
  const baseAdd = proto.add
  proto.add = function (this: THREE.Object3D, ...objects: THREE.Object3D[]) {
    const r = baseAdd.apply(this, objects)
    if (watchArrivals) for (const o of objects) if (o !== this) arrivals.push(o)
    return r
  } as typeof baseAdd
}

const inScene = (o: THREE.Object3D, scene: THREE.Scene) => {
  for (let p: THREE.Object3D | null = o; p; p = p.parent) if (p === scene) return true
  return false
}

/** Mount once in the scene, beside <Precompile>. */
export function LateCompile() {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const get = useThree((s) => s.get)
  const compiled = useMuseum((s) => s.sceneCompiled)
  useEffect(() => {
    watchArrivals = compiled && !isWebGPU()
    if (!watchArrivals) arrivals.length = 0
    return () => {
      watchArrivals = false
      arrivals.length = 0
    }
  }, [compiled])
  useFrame(() => {
    if (!arrivals.length) return
    for (const root of arrivals.splice(0)) {
      if (!inScene(root, scene)) continue
      const held: [THREE.Object3D, number][] = []
      root.traverse((o) => {
        const m = (o as THREE.Mesh).material
        if (!m) return
        const mats = Array.isArray(m) ? m : [m]
        if (mats.every((x) => !x || (gl.properties.get(x) as { currentProgram?: unknown }).currentProgram !== undefined)) return
        held.push([o, o.layers.mask])
        o.layers.set(HOLD_LAYER)
      })
      if (!held.length) continue
      const release = () => {
        for (const [o, mask] of held) if (o.layers.mask === 1 << HOLD_LAYER) o.layers.mask = mask
      }
      try {
        injectAtmosphereTree(root, gl)
        gl.compileAsync(root, get().camera, scene).then(release, release)
      } catch {
        release()
      }
    }
  })
  return null
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
      // Wait for loaders (artwork images, models) to go idle, max 20 s — and for the workshop team's pieces
      // (models/teamPiece.tsx: loaded and on the GPU, or given up on), so their programs compile here too.
      for (;;) {
        if (cancelled) return
        const p = useProgress.getState()
        const elapsed = performance.now() - start
        const team = teamModels()
        if (((!p.active && elapsed > 900) || elapsed > 20000) && (team.settled || elapsed > TEAM_WAIT_MAX_MS)) break
        await sleep(150)
      }
      await sleep(300) // let Suspense commits and canvas typography settle
      // Every lit material mounted now joins the shared light engine before it compiles (SPECTACLE §3);
      // later ones are caught by the hook installed below.
      injectAtmosphereTree(scene, gl)
      // Programs depend on the target drawn into (tone mapping and colour space are applied in
      // the shader only when drawing to the canvas): compile for where the frames will go, the
      // composer's half-float buffer when post-processing is on, or nothing is reused on the first draw.
      const { tier } = useMuseum.getState()
      const composer = withDevOverrides(QUALITY_PRESETS[tier]).postprocessing
      const compile = (zone: ZoneId | null) => {
        const standIn = composer ? new THREE.WebGLRenderTarget(16, 16, { type: THREE.HalfFloatType }) : null
        const prevTarget = gl.getRenderTarget()
        gl.setRenderTarget(standIn)
        try {
          // compileAsync traverses only visible objects (synchronously, before its promise)
          return withZonesVisible(zone, () => gl.compileAsync(scene, get().camera)).finally(() => standIn?.dispose())
        } finally {
          gl.setRenderTarget(prevTarget)
        }
      }
      // 1. What the visitor sees first, behind the loading screen: the zones visible from where they stand
      // (the forecourt on arrival, the room they are in after a tier change). Compiling and first-drawing the
      // whole museum here kept a laptop GPU behind "Applying graphics settings…" for minutes.
      const here = zoneOf(get().camera.position)
      const seen = new Set<string>()
      try {
        const t0 = performance.now()
        await compile(here)
        // One small offscreen draw of each distinct program: the driver finishes each program on its first
        // real draw, so that cost lands here, not on the visitor's first frames.
        const t1 = performance.now()
        if (!cancelled && !isWebGPU()) {
          const reps = representatives(gl, scene, here, seen)
          usePrecompileProgress.setState({ done: 0, total: reps.length })
          await warmDrawSliced(gl, scene, get().camera, composer, reps, () => cancelled, { onSlice: (done) => usePrecompileProgress.setState({ done }) })
          // then the view's zones once (quick now): anything the slices missed, and a full shadow map
          if (!cancelled) warmDraw(gl, scene, get().camera, composer, here)
        }
        if (process.env.NODE_ENV !== 'production')
          console.info(
            `[museum] ${here ?? 'every zone'}: ${gl.info.programs?.length ?? '?'} programs, compile ${((t1 - t0) / 1000).toFixed(1)} s, first draw ${((performance.now() - t1) / 1000).toFixed(1)} s`,
          )
      } catch (err) {
        console.warn('[museum] async shader compile failed; falling back to on-demand compile', err)
      }
      if (cancelled) return
      setSceneCompiled(true)
      usePrecompileProgress.setState({ first: false })
      // 2. The rest of the museum, while the visit runs, a zone at a time (the one the visitor is in or nearest
      // first): compiled in parallel (KHR_parallel_shader_compile: off the main thread), then each program not drawn
      // yet first-drawn offscreen, one at a time between frames, so a room entered later is ready before the
      // visitor reaches it. (All the zones at once built ~80 programs in one main-thread burst.)
      if (here === null || isWebGPU()) return
      try {
        await sleep(1500)
        // generated pictures drawn into their own targets (the Kiln Film, in the theatre) live outside the scene:
        // compiled for their target, off the main thread, long before the visitor can reach them
        for (const pt of projectionTargets) {
          if (cancelled) return
          await pt.compile(gl)
        }
        const done = new Set<ZoneId>([here])
        while (!cancelled) {
          const at = zoneOf(get().camera.position) ?? here
          const next = [...(ZONE_VISIBILITY[at] ?? []), ...ZONES.map((z) => z.id)].find((z) => !done.has(z))
          if (!next) break
          done.add(next)
          await compile(next)
          if (cancelled) return
          await warmDrawSliced(gl, scene, get().camera, composer, representatives(gl, scene, next, seen), () => cancelled, { perSlice: 1, pause: BACKGROUND_PAUSE_MS })
          await sleep(BACKGROUND_PAUSE_MS)
        }
      } catch (err) {
        console.warn('[museum] background shader warm-up stopped', err)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [gl, scene, get])

  return null
}
