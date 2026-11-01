/**
 * PLANAR MIRROR — a real reflection of the scene in a horizontal water plane (the court pool and
 * the entrance rill on Medium and up), after three's `Reflector`: the scene is drawn once more from
 * the camera mirrored about the plane, with an oblique near plane at the water, into a half-float
 * target that the water shader samples projectively (materials/waterShader.ts `WATER_PLANAR`).
 *
 * The extra render happens in the water mesh's `onBeforeRender`, so it only runs while the water
 * is in view, once per frame (a normal or depth pre-pass, or another mirror's own render, never
 * triggers a second one), and never for a camera other than the visitor's.
 */
import * as THREE from 'three'

export interface PlanarMirror {
  texture: THREE.Texture
  /** World position → mirror texture clip space (bias × projection × view). */
  matrix: THREE.Matrix4
  /** Install on the water mesh: `mesh.onBeforeRender = mirror.onBeforeRender`. */
  onBeforeRender: THREE.Object3D['onBeforeRender']
  dispose(): void
}

let frameId = 0
/** Advance once per frame (the water components call this from useFrame). */
export function tickPlanarMirrors() {
  frameId++
}

/**
 * A mirror about the plane y = `level`. `px` is the target's long side; the short side follows
 * the canvas aspect. `isMain(camera)` says whether a camera is the visitor's view.
 */
export function createPlanarMirror(level: number, px: number, isMain: (c: THREE.Camera) => boolean, samples = 0): PlanarMirror {
  const rt = new THREE.WebGLRenderTarget(px, px, { samples, type: THREE.HalfFloatType })
  rt.texture.generateMipmaps = false
  const matrix = new THREE.Matrix4()
  const mirrorCam = new THREE.PerspectiveCamera()
  const camPos = new THREE.Vector3()
  const look = new THREE.Vector3()
  const rot = new THREE.Matrix4()
  const plane = new THREE.Plane()
  const clip = new THREE.Vector4()
  const q = new THREE.Vector4()
  const size = new THREE.Vector2()
  let last = -1
  const reflectY = (v: THREE.Vector3) => v.setY(2 * level - v.y)

  const onBeforeRender: THREE.Object3D['onBeforeRender'] = function (this: THREE.Object3D, renderer, scene, camera) {
    if (last === frameId || !isMain(camera) || scene.overrideMaterial || !(camera as THREE.PerspectiveCamera).isPerspectiveCamera) return
    camPos.setFromMatrixPosition(camera.matrixWorld)
    if (camPos.y <= level + 1e-3) return
    last = frameId
    // keep the target's aspect with the canvas
    renderer.getDrawingBufferSize(size)
    const aspect = size.x / Math.max(1, size.y)
    const w = aspect >= 1 ? px : Math.round(px * aspect)
    const h = aspect >= 1 ? Math.round(px / aspect) : px
    if (rt.width !== w || rt.height !== h) rt.setSize(w, h)

    const cam = camera as THREE.PerspectiveCamera
    // the mirrored eye, looking at the mirrored target, its up vector mirrored
    rot.extractRotation(cam.matrixWorld)
    look.set(0, 0, -1).applyMatrix4(rot).add(camPos)
    mirrorCam.position.copy(camPos)
    reflectY(mirrorCam.position)
    reflectY(look)
    mirrorCam.up.set(0, 1, 0).applyMatrix4(rot)
    mirrorCam.up.y = -mirrorCam.up.y
    mirrorCam.lookAt(look)
    mirrorCam.near = cam.near
    mirrorCam.far = cam.far
    mirrorCam.layers.mask = cam.layers.mask
    mirrorCam.updateMatrixWorld()
    mirrorCam.projectionMatrix.copy(cam.projectionMatrix)

    matrix.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1)
    matrix.multiply(mirrorCam.projectionMatrix).multiply(mirrorCam.matrixWorldInverse)

    // oblique near plane at the water (Lengyel): nothing below the surface reaches the mirror
    plane.set(new THREE.Vector3(0, 1, 0), -level).applyMatrix4(mirrorCam.matrixWorldInverse)
    clip.set(plane.normal.x, plane.normal.y, plane.normal.z, plane.constant)
    const p = mirrorCam.projectionMatrix.elements
    q.x = (Math.sign(clip.x) + p[8]) / p[0]
    q.y = (Math.sign(clip.y) + p[9]) / p[5]
    q.z = -1
    q.w = (1 + p[10]) / p[14]
    clip.multiplyScalar(2 / clip.dot(q))
    p[2] = clip.x
    p[6] = clip.y
    p[10] = clip.z + 1 - 0.003
    p[14] = clip.w
    mirrorCam.projectionMatrixInverse.copy(mirrorCam.projectionMatrix).invert()

    this.visible = false
    const prevRT = renderer.getRenderTarget()
    const xr = renderer.xr.enabled
    const shadows = renderer.shadowMap.autoUpdate
    renderer.xr.enabled = false
    renderer.shadowMap.autoUpdate = false
    renderer.setRenderTarget(rt)
    renderer.state.buffers.depth.setMask(true)
    if (renderer.autoClear === false) renderer.clear()
    renderer.render(scene, mirrorCam)
    renderer.xr.enabled = xr
    renderer.shadowMap.autoUpdate = shadows
    renderer.setRenderTarget(prevRT)
    const vp = (camera as THREE.Camera & { viewport?: THREE.Vector4 }).viewport
    if (vp) renderer.state.viewport(vp)
    this.visible = true
  }

  return {
    texture: rt.texture,
    matrix,
    onBeforeRender,
    dispose: () => rt.dispose(),
  }
}
