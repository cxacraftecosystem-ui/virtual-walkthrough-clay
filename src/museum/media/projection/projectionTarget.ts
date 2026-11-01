/**
 * PROJECTION TARGET — a full-screen shader drawn into its own render target at a capped rate,
 * for generated pictures shown on a surface in the scene (the Agni Theatre's Kiln Film).
 *
 *   const pt = new ProjectionTarget(material, 1024, 344)
 *   useFrame(({ gl }, dt) => pt.tick(gl, dt, hz, visible))   // draws at most `hz` times a second
 *   <meshBasicMaterial map={pt.texture} />
 *
 * Nothing is drawn while `visible` is false (the room is culled), so the picture costs nothing
 * from elsewhere in the pavilion. The target is linear; the material that shows it does the
 * output colour conversion like any other texture.
 */
import * as THREE from 'three'

/** Every live target, so the startup compile (effects/Precompile.tsx) can build their programs too. */
export const projectionTargets = new Set<ProjectionTarget>()

export class ProjectionTarget {
  readonly target: THREE.WebGLRenderTarget
  private readonly scene = new THREE.Scene()
  private readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
  private readonly quad: THREE.Mesh
  private acc = Infinity

  constructor(
    readonly material: THREE.ShaderMaterial,
    width: number,
    height: number,
  ) {
    this.target = new THREE.WebGLRenderTarget(width, height, {
      depthBuffer: false,
      stencilBuffer: false,
      magFilter: THREE.LinearFilter,
      minFilter: THREE.LinearFilter,
      generateMipmaps: false,
      type: THREE.UnsignedByteType,
    })
    this.target.texture.name = 'projectionTarget'
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material)
    this.quad.frustumCulled = false
    this.scene.add(this.quad)
    projectionTargets.add(this)
  }

  /** Build the shader's program ahead of its first draw (the room may not be seen for minutes). */
  compile(gl: THREE.WebGLRenderer) {
    return gl.compileAsync(this.scene, this.camera)
  }

  get texture() {
    return this.target.texture
  }

  setSize(width: number, height: number) {
    if (this.target.width === width && this.target.height === height) return
    this.target.setSize(width, height)
    this.acc = Infinity
  }

  /** Redraw now on the next tick (e.g. after a uniform jump). */
  invalidate() {
    this.acc = Infinity
  }

  /** Draw if `visible` and at least 1/hz s have passed since the last draw. Returns true when it drew. */
  tick(gl: THREE.WebGLRenderer, dt: number, hz: number, visible: boolean): boolean {
    this.acc += dt
    if (!visible || this.acc < 1 / Math.max(1, hz)) return false
    this.acc = 0
    const prev = gl.getRenderTarget()
    const xr = gl.xr.enabled
    gl.xr.enabled = false
    gl.setRenderTarget(this.target)
    gl.render(this.scene, this.camera)
    gl.setRenderTarget(prev)
    gl.xr.enabled = xr
    return true
  }

  dispose() {
    projectionTargets.delete(this)
    this.target.dispose()
    this.quad.geometry.dispose()
  }
}
