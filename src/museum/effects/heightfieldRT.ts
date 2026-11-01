/**
 * HEIGHTFIELD RT — a ping-pong render target that remembers where hands pressed into wet clay
 * (SPECTACLE F17, the clay bed), and lets the clay relax back over time.
 *
 *   const hf = new HeightfieldRT(gl, 256)
 *   hf.stamp(u, v, angle)            // queue a hand print (uv on the bed, fingers along `angle`)
 *   hf.update(now, healSec)          // once a frame: draws queued prints, relaxes while dirty
 *   material reads hf.texture        // R = depth (0 … 1 of the bed's full press depth; a little
 *                                    //     negative where the displaced clay rises in a rim)
 *                                    // G = fingertip whorl coordinate (0 at a tip's centre, 1 off it)
 *
 * The prints are drawn in metres, so a hand keeps its shape on a bed of any aspect: pass the
 * bed's size. Half-float targets where the device can render to them; otherwise RGBA8 with the
 * depth packed into 0 … 1 (`encoded`, see HEIGHT_GLSL). The relax pass runs only every
 * `relaxEvery` frames and only while the surface is dirty, so an untouched bed costs nothing.
 */
import * as THREE from 'three'

/** Shader helpers shared with the material that reads the field. */
export const HEIGHT_GLSL = /* glsl */ `
uniform float uHfEncoded;
float hfDecode(float v) { return uHfEncoded > 0.5 ? v * 1.25 - 0.25 : v; }
float hfEncode(float h) { return uHfEncoded > 0.5 ? (clamp(h, -0.25, 1.0) + 0.25) / 1.25 : h; }
`

const QUAD_VS = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`

/** One right hand, palm down, fingers along +y (metres). Depth 0 … 1 and the whorl coordinate. */
const HAND_GLSL = /* glsl */ `
float capsule(vec2 p, vec2 a, vec2 b, float r, out float t) {
  vec2 pa = p - a, ba = b - a;
  t = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * t) - r;
}
// returns (depth, whorl)
vec2 hand(vec2 p) {
  float depth = 0.0;
  float whorl = 1.0;
  // palm: an ellipse, deepest at the heel
  vec2 q = p / vec2(0.043, 0.052);
  float pd = length(q);
  depth = max(depth, (1.0 - smoothstep(0.55, 1.0, pd)) * (0.62 + 0.16 * smoothstep(0.4, -0.6, q.y)));
  // fingers: base, tip, radius
  vec2 A[5]; vec2 B[5]; float R[5];
  A[0] = vec2(-0.040, -0.006); B[0] = vec2(-0.074, 0.040); R[0] = 0.0112; // thumb
  A[1] = vec2(-0.027, 0.046);  B[1] = vec2(-0.033, 0.114); R[1] = 0.0095;
  A[2] = vec2(-0.008, 0.050);  B[2] = vec2(-0.008, 0.127); R[2] = 0.0098;
  A[3] = vec2(0.012, 0.047);   B[3] = vec2(0.017, 0.117);  R[3] = 0.0093;
  A[4] = vec2(0.030, 0.038);   B[4] = vec2(0.041, 0.094);  R[4] = 0.0080;
  for (int i = 0; i < 5; i++) {
    float t;
    float d = capsule(p, A[i], B[i], R[i], t);
    // fingers press harder towards their pads
    float f = (1.0 - smoothstep(-R[i] * 0.55, 0.0015, d)) * mix(0.55, 1.0, smoothstep(0.35, 0.95, t));
    depth = max(depth, f);
    // the pad: an elliptical whorl round a point just short of the tip
    vec2 c = mix(A[i], B[i], 0.9);
    vec2 dir = normalize(B[i] - A[i]);
    vec2 rel = vec2(dot(p - c, vec2(dir.y, -dir.x)), dot(p - c, dir));
    float w = length(rel / vec2(R[i] * 0.95, R[i] * 1.45));
    if (w < 1.0) whorl = min(whorl, w);
  }
  return vec2(depth, whorl);
}
`

const BRUSH_FS = /* glsl */ `
precision highp float;
uniform sampler2D uPrev;
uniform vec2 uCenter;   // uv
uniform vec2 uSize;     // bed size (m)
uniform float uAngle;   // radians, finger direction from +v
uniform float uStrength;
varying vec2 vUv;
${HEIGHT_GLSL}
${HAND_GLSL}
void main() {
  vec4 prev = texture2D(uPrev, vUv);
  float h = hfDecode(prev.r);
  float g = prev.g;
  vec2 q = (vUv - uCenter) * uSize;
  float c = cos(uAngle), s = sin(uAngle);
  vec2 p = vec2(c * q.x - s * q.y, s * q.x + c * q.y);
  vec2 hw = hand(p);
  float d = hw.x * uStrength;
  // the clay pushed aside rises in a soft rim round the print
  vec2 hw2 = hand(p * 0.86);
  float rim = max(0.0, hw2.x - hw.x) * 0.22 * uStrength;
  float nh = max(h, d);
  if (d < 0.02) nh = max(-0.25, nh - rim * (1.0 - smoothstep(0.0, 0.2, h)));
  // a fresh print overwrites the old whorls under it
  if (d > 0.3) g = hw.y;
  gl_FragColor = vec4(hfEncode(nh), g, 0.0, 1.0);
}
`

const RELAX_FS = /* glsl */ `
precision highp float;
uniform sampler2D uPrev;
uniform vec2 uTexel;
uniform float uStep;    // depth healed this pass (of full depth)
uniform float uBlur;
varying vec2 vUv;
${HEIGHT_GLSL}
void main() {
  vec4 prev = texture2D(uPrev, vUv);
  float h = hfDecode(prev.r);
  float n = hfDecode(texture2D(uPrev, vUv + vec2(uTexel.x, 0.0)).r) + hfDecode(texture2D(uPrev, vUv - vec2(uTexel.x, 0.0)).r)
          + hfDecode(texture2D(uPrev, vUv + vec2(0.0, uTexel.y)).r) + hfDecode(texture2D(uPrev, vUv - vec2(0.0, uTexel.y)).r);
  h = mix(h, n * 0.25, uBlur);
  h = h > 0.0 ? max(0.0, h - uStep) : min(0.0, h + uStep);
  float g = abs(h) < 0.03 ? 1.0 : prev.g;
  gl_FragColor = vec4(hfEncode(h), g, 0.0, 1.0);
}
`

const CLEAR_FS = /* glsl */ `
precision highp float;
${HEIGHT_GLSL}
void main() { gl_FragColor = vec4(hfEncode(0.0), 1.0, 0.0, 1.0); }
`

interface Stamp {
  u: number
  v: number
  angle: number
  strength: number
}

/** True when this renderer can draw into half-float colour targets. */
export function canRenderHalfFloat(gl: THREE.WebGLRenderer) {
  const ext = gl.extensions
  return ext.has('EXT_color_buffer_float') || ext.has('EXT_color_buffer_half_float')
}

export class HeightfieldRT {
  readonly size: number
  readonly encoded: boolean
  private targets: [THREE.WebGLRenderTarget, THREE.WebGLRenderTarget]
  private read = 0
  private scene = new THREE.Scene()
  private camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
  private quad: THREE.Mesh
  private brush: THREE.ShaderMaterial
  private relax: THREE.ShaderMaterial
  private clear: THREE.ShaderMaterial
  private queue: Stamp[] = []
  private frame = 0
  private lastRelax = 0
  /** Time (s, the caller's clock) of the last print; -1 = clean. */
  lastStampAt = -1
  /** Uniforms for the material that reads the field (texture follows the ping-pong). */
  readonly uniforms: { uHeight: { value: THREE.Texture }; uHfEncoded: { value: number }; uHfTexel: { value: THREE.Vector2 } }

  constructor(
    private gl: THREE.WebGLRenderer,
    size: number,
    bedSize: [number, number],
    private relaxEvery = 6,
  ) {
    this.size = size
    this.encoded = !canRenderHalfFloat(gl)
    const mk = () =>
      new THREE.WebGLRenderTarget(size, size, {
        type: this.encoded ? THREE.UnsignedByteType : THREE.HalfFloatType,
        format: THREE.RGBAFormat,
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        wrapS: THREE.ClampToEdgeWrapping,
        wrapT: THREE.ClampToEdgeWrapping,
        depthBuffer: false,
        stencilBuffer: false,
        generateMipmaps: false,
      })
    this.targets = [mk(), mk()]
    const enc = { value: this.encoded ? 1 : 0 }
    this.brush = new THREE.ShaderMaterial({
      vertexShader: QUAD_VS,
      fragmentShader: BRUSH_FS,
      uniforms: {
        uPrev: { value: null },
        uCenter: { value: new THREE.Vector2() },
        uSize: { value: new THREE.Vector2(bedSize[0], bedSize[1]) },
        uAngle: { value: 0 },
        uStrength: { value: 1 },
        uHfEncoded: enc,
      },
      depthTest: false,
      depthWrite: false,
    })
    this.relax = new THREE.ShaderMaterial({
      vertexShader: QUAD_VS,
      fragmentShader: RELAX_FS,
      uniforms: { uPrev: { value: null }, uTexel: { value: new THREE.Vector2(1 / size, 1 / size) }, uStep: { value: 0 }, uBlur: { value: 0.1 }, uHfEncoded: enc },
      depthTest: false,
      depthWrite: false,
    })
    this.clear = new THREE.ShaderMaterial({ vertexShader: QUAD_VS, fragmentShader: CLEAR_FS, uniforms: { uHfEncoded: enc }, depthTest: false, depthWrite: false })
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.clear)
    this.quad.frustumCulled = false
    this.scene.add(this.quad)
    this.uniforms = { uHeight: { value: this.targets[0].texture }, uHfEncoded: enc, uHfTexel: { value: new THREE.Vector2(1 / size, 1 / size) } }
    this.reset()
  }

  get texture(): THREE.Texture {
    return this.targets[this.read].texture
  }

  /** Queue a hand print at bed uv (u, v), fingers pointing along `angle` (radians from +v). */
  stamp(u: number, v: number, angle: number, strength = 1) {
    if (this.queue.length < 16) this.queue.push({ u, v, angle, strength })
  }

  /** Smooth the clay flat at once. */
  reset() {
    this.pass(this.clear, 0)
    this.pass(this.clear, 1)
    this.uniforms.uHeight.value = this.texture
    this.lastStampAt = -1
  }

  /** True while prints are still relaxing. */
  dirty(now: number, healSec: number) {
    return this.lastStampAt >= 0 && now - this.lastStampAt < healSec + 1
  }

  /** Draw queued prints and relax the clay. `now` in seconds; `healSec` = time a full print takes to vanish. */
  update(now: number, healSec: number) {
    this.frame++
    for (const s of this.queue.splice(0)) {
      this.brush.uniforms.uPrev.value = this.texture
      this.brush.uniforms.uCenter.value.set(s.u, s.v)
      this.brush.uniforms.uAngle.value = s.angle
      this.brush.uniforms.uStrength.value = s.strength
      this.pass(this.brush, 1 - this.read)
      this.read = 1 - this.read
      this.lastStampAt = now
      if (this.lastRelax <= 0) this.lastRelax = now
    }
    if (this.lastStampAt >= 0 && this.frame % this.relaxEvery === 0) {
      if (!this.dirty(now, healSec)) {
        // fully healed: one clean pass, then the surface is idle
        this.reset()
        this.lastRelax = 0
      } else {
        const dt = Math.min(1, Math.max(0, now - this.lastRelax))
        this.lastRelax = now
        this.relax.uniforms.uPrev.value = this.texture
        // a full-depth print relaxes away over healSec (a touch early, so the clean pass is invisible)
        this.relax.uniforms.uStep.value = (dt / Math.max(1, healSec)) * 1.08
        this.pass(this.relax, 1 - this.read)
        this.read = 1 - this.read
      }
    }
    this.uniforms.uHeight.value = this.texture
  }

  /** Deepest press now (0 … 1), read back from the GPU — tests and debugging only. */
  maxDepth(): number {
    const n = this.size
    const t = this.targets[this.read]
    let max = 0
    if (this.encoded) {
      const buf = new Uint8Array(n * n * 4)
      this.gl.readRenderTargetPixels(t, 0, 0, n, n, buf)
      for (let i = 0; i < buf.length; i += 4) max = Math.max(max, (buf[i] / 255) * 1.25 - 0.25)
    } else {
      const buf = new Uint16Array(n * n * 4)
      this.gl.readRenderTargetPixels(t, 0, 0, n, n, buf)
      for (let i = 0; i < buf.length; i += 4) max = Math.max(max, THREE.DataUtils.fromHalfFloat(buf[i]))
    }
    return max
  }

  private pass(mat: THREE.ShaderMaterial, into: number) {
    const gl = this.gl
    const prevTarget = gl.getRenderTarget()
    const prevXr = gl.xr.enabled
    const prevAuto = gl.autoClear
    gl.xr.enabled = false
    gl.autoClear = false
    this.quad.material = mat
    gl.setRenderTarget(this.targets[into])
    gl.render(this.scene, this.camera)
    gl.setRenderTarget(prevTarget)
    gl.autoClear = prevAuto
    gl.xr.enabled = prevXr
  }

  dispose() {
    for (const t of this.targets) t.dispose()
    this.brush.dispose()
    this.relax.dispose()
    this.clear.dispose()
    this.quad.geometry.dispose()
  }
}
