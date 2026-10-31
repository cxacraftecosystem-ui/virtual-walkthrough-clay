/**
 * The studio's wheel: a small self-contained three.js view (its own renderer and loop, so
 * it runs while the museum canvas is paused behind the overlay), and the turntable shot the
 * studio downloads and sends to the Visitors' Shelf.
 *
 *   const view = new WheelView(canvas); view.setPot(state, fired); view.setSpin(true)
 *   view.fire(reducedMotion)  — kiln glow, the colours turn at its height
 *   renderShot(state, seed)   — a 1200 × 900 canvas: the pot on a turntable, three-quarter view
 */
import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { CM, createPot, type PotHandle } from './potMesh'
import { potSection, type PotState } from './potEngine'

/** The wheel: a heavy disc set spinning with a stick, its hub a little raised. */
const DISC_R = 0.42
const HUB_R = 0.13
const HUB_H = 0.025
/** Wheel speed (rev/s) while throwing; the fired pot turns slowly on the turntable. */
const THROW_RPS = 1.1
const SHOW_RPS = 0.08
const FIRE_MS = 2600

function envFor(renderer: THREE.WebGLRenderer) {
  const pm = new THREE.PMREMGenerator(renderer)
  const env = pm.fromScene(new RoomEnvironment(), 0.04).texture
  pm.dispose()
  return env
}

function discTexture() {
  const cv = document.createElement('canvas')
  cv.width = cv.height = 512
  const g = cv.getContext('2d')!
  g.fillStyle = '#5a3b2d'
  g.fillRect(0, 0, 512, 512)
  // dried clay skin: concentric turning marks, smears of slip and the stick's socket, so the spin reads
  g.translate(256, 256)
  for (let r = 8; r < 256; r += 7) {
    g.strokeStyle = `rgba(${r % 2 ? '25,14,10' : '140,95,70'},${0.1 + (r % 3) * 0.04})`
    g.lineWidth = 1.5
    g.beginPath()
    g.arc(0, 0, r, 0, Math.PI * 2)
    g.stroke()
  }
  for (let i = 0; i < 9; i++) {
    g.rotate(0.71 + i * 0.13)
    g.fillStyle = `rgba(150,95,65,${0.25 + (i % 3) * 0.1})`
    g.beginPath()
    g.ellipse(110 + i * 12, 0, 40, 7, 0.35, 0, Math.PI * 2)
    g.fill()
  }
  g.fillStyle = '#1f130e'
  g.beginPath()
  g.arc(225, 0, 9, 0, Math.PI * 2)
  g.fill()
  const t = new THREE.CanvasTexture(cv)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}

function lights(scene: THREE.Scene, shadowSize: number) {
  scene.add(new THREE.HemisphereLight('#fff1df', '#4a3426', 0.55))
  const key = new THREE.DirectionalLight('#ffe7cc', 2.4)
  key.position.set(0.6, 1.2, 0.8)
  key.castShadow = true
  key.shadow.mapSize.set(shadowSize, shadowSize)
  key.shadow.camera.left = key.shadow.camera.bottom = -0.5
  key.shadow.camera.right = key.shadow.camera.top = 0.5
  key.shadow.camera.near = 0.1
  key.shadow.camera.far = 4
  key.shadow.bias = -0.0005
  key.shadow.radius = 4
  scene.add(key)
  const rim = new THREE.DirectionalLight('#ffd2a8', 1.1)
  rim.position.set(-0.9, 0.7, -0.6)
  scene.add(rim)
}

/** Where the camera should stand to frame a pot (height h, widest radius r, metres). */
function frame(cam: THREE.PerspectiveCamera, h: number, r: number, elev: number, pad = 1.25) {
  const size = Math.max(h * 1.1, r * 2.3, 0.14)
  const vfov = (cam.fov * Math.PI) / 180
  const fit = Math.max(size / (2 * Math.tan(vfov / 2)), size / (2 * Math.tan(vfov / 2) * cam.aspect))
  const dist = fit * pad
  const ty = h * 0.48
  return { pos: new THREE.Vector3(0, ty + Math.sin(elev) * dist, Math.cos(elev) * dist), target: new THREE.Vector3(0, ty, 0) }
}

const widest = (s: PotState) => Math.max(...s.points.map((p) => p.r)) * CM

/* ------------------------------------------------------------------ */
/* Live view                                                           */
/* ------------------------------------------------------------------ */

export class WheelView {
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera = new THREE.PerspectiveCamera(32, 1, 0.01, 10)
  private pot: PotHandle | null = null
  private turn = new THREE.Group()
  private wobble = new THREE.Group()
  private head: THREE.Mesh
  private disposables: { dispose: () => void }[] = []
  private raf = 0
  private last = 0
  private spin = true
  private firedShown = false
  private state: PotState | null = null
  /** Kiln in progress: rendered time so far (ms) and who is waiting for it to cool. */
  private kiln: { t: number; done: () => void } | null = null
  private camPos = new THREE.Vector3()
  private camTarget = new THREE.Vector3()
  private wantPos = new THREE.Vector3()
  private wantTarget = new THREE.Vector3()
  private framed = false
  /** Manual turn (drag / keys) when the wheel is stopped. */
  angle = 0
  onFireGlow: ((glow: number) => void) | null = null

  constructor(
    canvas: HTMLCanvasElement,
    private seed: number,
  ) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' })
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.05
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    const env = envFor(this.renderer)
    this.scene.environment = env
    this.scene.environmentIntensity = 0.55
    this.disposables.push(env)
    lights(this.scene, 1024)

    // the disc (top at y = −HUB_H, so the pot sits on the hub at y = 0) on a dark earthen floor
    const discTex = discTexture()
    const discTop = new THREE.MeshStandardMaterial({ map: discTex, roughness: 0.9, metalness: 0 })
    const discSide = new THREE.MeshStandardMaterial({ color: '#4a3025', roughness: 0.95, metalness: 0 })
    const discGeo = new THREE.CylinderGeometry(DISC_R, DISC_R - 0.01, 0.05, 96)
    this.head = new THREE.Mesh(discGeo, [discSide, discTop, discSide])
    this.head.position.y = -HUB_H - 0.025
    this.head.receiveShadow = true
    const hubMat = new THREE.MeshStandardMaterial({ color: '#6d4030', roughness: 0.4, metalness: 0 })
    const hubGeo = new THREE.CylinderGeometry(HUB_R * 0.97, HUB_R, HUB_H, 64)
    const hub = new THREE.Mesh(hubGeo, hubMat)
    hub.position.y = 0.025 + HUB_H / 2
    hub.receiveShadow = true
    this.head.add(hub)
    const floorMat = new THREE.MeshStandardMaterial({ color: '#3a2519', roughness: 1, metalness: 0 })
    const floorGeo = new THREE.CircleGeometry(1.6, 64)
    const floor = new THREE.Mesh(floorGeo, floorMat)
    floor.rotation.x = -Math.PI / 2
    floor.position.y = -0.2
    floor.receiveShadow = true
    const pivotMat = new THREE.MeshStandardMaterial({ color: '#6b625a', roughness: 0.9, metalness: 0 })
    const pivotGeo = new THREE.CylinderGeometry(0.09, 0.12, 0.13, 24)
    const pivot = new THREE.Mesh(pivotGeo, pivotMat)
    pivot.position.y = -0.2 + 0.065
    this.scene.add(floor, pivot)
    this.disposables.push(discTex, discTop, discSide, discGeo, hubMat, hubGeo, floorMat, floorGeo, pivotMat, pivotGeo)

    this.turn.add(this.head)
    this.wobble.add(this.turn)
    this.scene.add(this.wobble)
  }

  setSeed(seed: number) {
    if (seed === this.seed) return
    this.seed = seed
    this.pot?.dispose()
    this.pot?.mesh.removeFromParent()
    this.pot = null
    if (this.state) this.setPot(this.state, this.firedShown)
  }

  setPot(state: PotState, fired: boolean) {
    this.state = state
    this.firedShown = fired
    if (!this.pot) {
      this.pot = createPot(state, this.seed, fired)
      this.turn.add(this.pot.mesh)
    } else this.pot.update(state, fired)
    const sec = potSection(state)
    const f = frame(this.camera, sec.height * CM, widest(state), 0.32)
    this.wantPos.copy(f.pos)
    this.wantTarget.copy(f.target)
    if (!this.framed) {
      this.framed = true
      this.camPos.copy(f.pos)
      this.camTarget.copy(f.target)
    }
    this.kick()
  }

  setSpin(on: boolean) {
    this.spin = on
    this.kick()
  }

  /** Kiln glow; the colours change at its height. Returns when the pot has cooled. */
  fire(instant: boolean): Promise<void> {
    if (!this.state) return Promise.resolve()
    if (instant) {
      this.setPot(this.state, true)
      return Promise.resolve()
    }
    // paced by rendered frames (each counts for at most 0.4 s), so a slow device still sees the glow
    this.kiln?.done()
    return new Promise((resolve) => {
      this.kiln = { t: 0, done: resolve }
      this.kick()
    })
  }

  resize(w: number, h: number) {
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    this.renderer.setPixelRatio(dpr)
    this.renderer.setSize(w, h, false)
    this.camera.aspect = w / Math.max(1, h)
    this.camera.updateProjectionMatrix()
    if (this.state) this.setPot(this.state, this.firedShown)
    this.kick()
  }

  /** Make sure a frame is coming (the loop sleeps when nothing moves). */
  kick() {
    if (!this.raf) this.raf = requestAnimationFrame(this.tick)
  }

  private tick = (now: number) => {
    this.raf = 0
    const elapsed = this.last ? (now - this.last) / 1000 : 0
    const dt = Math.min(0.05, elapsed)
    this.last = now
    let moving = false
    const fired = this.state?.fired ?? false

    if (this.spin) {
      this.angle += dt * Math.PI * 2 * (fired ? SHOW_RPS : THROW_RPS)
      moving = true
    }
    this.turn.rotation.y = -this.angle
    // a wet pot on a running wheel never sits quite still
    if (this.spin && !fired) {
      const t = now / 1000
      this.wobble.rotation.z = Math.sin(t * 7.1) * 0.006
      this.wobble.rotation.x = Math.cos(t * 7.1) * 0.006
      this.wobble.position.x = Math.sin(t * 6.9 + 1) * 0.0006
    } else {
      this.wobble.rotation.set(0, 0, 0)
      this.wobble.position.set(0, 0, 0)
    }

    if (this.kiln && this.pot && this.state) {
      // at most 0.4 s per frame: even a very slow device shows several frames of glow
      this.kiln.t += Math.min(0.4, elapsed) * 1000
      const k = Math.min(1, this.kiln.t / FIRE_MS)
      const glow = Math.pow(Math.sin(Math.PI * k), 1.4)
      this.pot.material.emissive.setRGB(1, 0.36, 0.1)
      this.pot.material.emissiveIntensity = glow * 1.1
      if (k >= 0.5 && !this.firedShown) this.setPot(this.state, true)
      this.onFireGlow?.(glow)
      if (k >= 1) {
        const { done } = this.kiln
        this.kiln = null
        this.pot.material.emissiveIntensity = 0
        this.onFireGlow?.(0)
        done()
      }
      moving = true
    }

    // ease the camera to the new framing
    const ease = 1 - Math.exp(-dt * 6)
    this.camPos.lerp(this.wantPos, ease)
    this.camTarget.lerp(this.wantTarget, ease)
    if (this.camPos.distanceTo(this.wantPos) > 1e-4 || this.camTarget.distanceTo(this.wantTarget) > 1e-4) moving = true
    this.camera.position.copy(this.camPos)
    this.camera.lookAt(this.camTarget)

    this.renderer.render(this.scene, this.camera)
    if (moving) this.kick()
    else this.last = 0
  }

  dispose() {
    cancelAnimationFrame(this.raf)
    this.raf = 0
    // closing mid-firing: the pot is fired all the same
    this.kiln?.done()
    this.kiln = null
    this.pot?.dispose()
    for (const d of this.disposables) d.dispose()
    this.renderer.dispose()
    // free the context now: browsers cap live WebGL contexts and the studio may be opened many times
    this.renderer.forceContextLoss()
  }
}

/* ------------------------------------------------------------------ */
/* Turntable shot                                                      */
/* ------------------------------------------------------------------ */

export const SHOT_W = 1200
export const SHOT_H = 900

function backdrop() {
  const cv = document.createElement('canvas')
  cv.width = 64
  cv.height = 256
  const g = cv.getContext('2d')!
  const grd = g.createLinearGradient(0, 0, 0, 256)
  grd.addColorStop(0, '#efe4d4')
  grd.addColorStop(0.62, '#dcc7ae')
  grd.addColorStop(1, '#b99a7c')
  g.fillStyle = grd
  g.fillRect(0, 0, 64, 256)
  const t = new THREE.CanvasTexture(cv)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

/** The pot on a turntable against a warm sweep (a new canvas, SHOT_W × SHOT_H). */
export function renderShot(state: PotState, seed: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = SHOT_W
  canvas.height = SHOT_H
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true })
  const trash: { dispose: () => void }[] = []
  try {
    renderer.setPixelRatio(1)
    renderer.setSize(SHOT_W, SHOT_H, false)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.05
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    const scene = new THREE.Scene()
    const bg = backdrop()
    scene.background = bg
    const env = envFor(renderer)
    scene.environment = env
    scene.environmentIntensity = 0.55
    trash.push(bg, env)
    lights(scene, 2048)

    // turntable: a low plinth with a lighter top
    const plinthMat = new THREE.MeshStandardMaterial({ color: '#d9cdbb', roughness: 0.9 })
    const plinthGeo = new THREE.CylinderGeometry(0.26, 0.27, 0.04, 96)
    const plinth = new THREE.Mesh(plinthGeo, plinthMat)
    plinth.position.y = -0.02
    plinth.receiveShadow = true
    const floorMat = new THREE.ShadowMaterial({ opacity: 0.18 })
    const floorGeo = new THREE.PlaneGeometry(4, 4)
    const floor = new THREE.Mesh(floorGeo, floorMat)
    floor.rotation.x = -Math.PI / 2
    floor.position.y = -0.04
    floor.receiveShadow = true
    scene.add(plinth, floor)
    trash.push(plinthMat, plinthGeo, floorMat, floorGeo)

    const pot = createPot(state, seed, state.fired, 160)
    pot.mesh.rotation.y = -0.6
    scene.add(pot.mesh)
    trash.push(pot)

    const cam = new THREE.PerspectiveCamera(28, SHOT_W / SHOT_H, 0.01, 10)
    const f = frame(cam, potSection(state).height * CM, widest(state), 0.3, 1.45)
    cam.position.copy(f.pos)
    cam.lookAt(f.target)
    renderer.render(scene, cam)
    // copy out so the GL context can go
    const out = document.createElement('canvas')
    out.width = SHOT_W
    out.height = SHOT_H
    out.getContext('2d')!.drawImage(canvas, 0, 0)
    return out
  } finally {
    for (const d of trash) d.dispose()
    renderer.dispose()
    renderer.forceContextLoss()
  }
}
