/**
 * ATMOSPHERE INJECTION — the shared light engine (SPECTACLE §3, GRAND §6.2).
 *
 * A handful of analytic terms are added to every lit material's lighting, so the pavilion gets
 * its light moments with a FIXED light count and no extra passes:
 *
 *   1. Sun mask on the directional light (sun by day, moon by night). The fragment is
 *      projected along the light: under the dome, light arrives only through the open oculus
 *      (the lip at y 20.4 and the light-well's top at the collar must both be clear: a crisp
 *      patch at noon, a crescent at a low sun); under the ambulatory and annex slab only through
 *      the Earth Room's skylight or the annex door; in the Red Room only through its oculus; in
 *      the Sphere Well only through the opening at grade. Outside, the drum, the annex and the
 *      dome's shell (a ray–sphere test) shade what lies behind them, so Low, which has no shadow
 *      maps, still has the building's shadow. On M+ it multiplies the shadow map.
 *   2. Diya irradiance: a top-down light map of the festival lamps (lighting/diyas).
 *   3. Up to 4 analytic glow points: the pit fire, the Akash Deep, the theatre spill, H's title.
 *   4. Cove grazing term: up to 8 concealed LED lines washing walls up or down (CoveLights); only
 *      the architecture's finishes take it (`{coves: true}`), which keeps every other program small.
 *   5. Ring washes: the concealed uplight at the dome's springing (`uDomeWash`) and the three warm
 *      LED rings of the stepped oculus (DomeLight), cheap enough for every material.
 *   6. ACCENT FIELD: up to 24 tight analytic spot cones (config/accents.ts, AccentField), run through
 *      the material's own direct-light equation (Lambert / Phong / physical, specular included),
 *      no shadow. Every podium, niche, plinth and piece gets its pool of light at constant cost.
 *   7. Wet roughness: rain darkens and polishes the open floors (Monsoon).
 *
 * How it reaches the materials: the shader chunks are patched once at module load, every term
 * behind `#ifdef USE_ATMOS`; `injectAtmosphere(mat)` opts a material in (define + the shared
 * uniform objects + a program-cache key) and must run before the material first compiles —
 * materials.ts does it for the library set, Precompile for everything mounted at startup, and
 * a material-level hook (`installAtmosphere`) for any lit material that appears later and has
 * not compiled yet. A material that already compiled is never touched (no mid-visit hitch).
 * WebGPU (experimental) gets none of this: the chunks are GLSL.
 */
import * as THREE from 'three'
import { DEG, KEY, MUSEUM } from '../../config/museum'
import { RED_ROOM, SAT_WALL, SATELLITES, SPHERE_WELL } from '../../config/satellites'
import { isWebGPU } from '../../utils/renderer'

const P = MUSEUM.pavilion
const OC = MUSEUM.oculus
const DOME = MUSEUM.dome

/** The oculus's lip (the lowest terrace's inner edge) and the light-well's top (the collar). */
export const ROOF_Y0 = DOME.terraces[DOME.terraces.length - 1].y
export const ROOF_Y1 = DOME.collarTop
/** The ambulatory and annex slab: its soffit and the parapet's top. */
export const SLAB_Y = P.ceilingHeight
export const SLAB_TOP = P.height

/**
 * Kept for the jali's old consumers: the jali gobo is retired with the soffit crown (GRAND §0.4),
 * so these only mark the light-well's inner ring.
 */
export const JALI_R0 = OC.r * 0.4
export const JALI_Y = ROOF_Y0

/** Satellite rooms whose roofs hold the sun off their floors (the Haat's star lattice is scrimmed: its dapple is drawn soft). */
const SOLID_ROOMS = SATELLITES
const ROOM_SLOTS = 4

/** Most accent cones a program evaluates (the tier's cap is the live count, config/accents.ts). */
export const ACCENT_SLOTS_MAX = 24
/** Cove lines and ring washes. */
export const COVE_SLOTS = 8
export const RING_SLOTS = 4

/** Site box the diya light map covers: the landscape disc and the forecourt (x0, z0, x1, z1). */
export const SITE_BOX = {
  x0: -MUSEUM.landscape.r,
  z0: -MUSEUM.landscape.r,
  x1: MUSEUM.landscape.r,
  z1: Math.max(MUSEUM.forecourt.endZ, MUSEUM.landscape.r),
} as const

const f = (v: number) => (Number.isInteger(v) ? v.toFixed(1) : String(v))

/* ------------------------------------------------------------------ */
/* Shared uniforms                                                     */
/* ------------------------------------------------------------------ */

const black = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1, THREE.RGBAFormat)
black.needsUpdate = true

const vec4s = (n: number, x = 0, y = 0, z = 0, w = 0) => Array.from({ length: n }, () => new THREE.Vector4(x, y, z, w))

export const ATMOS = {
  /** xyz: unit vector towards the directional light; w: 1 = mask on. */
  uAtmosSun: { value: new THREE.Vector4(0, 1, 0, 1) },
  /** Solid satellite roofs: r0, r1 (outside face + eave), a0, a1 (rad), and their edge directions (sin a0, cos a0, sin a1, cos a1). */
  uAtmosRooms: { value: vec4s(ROOM_SLOTS) },
  uAtmosRoomDir: { value: vec4s(ROOM_SLOTS, 0, 1, 0, 1) },
  /** Their roof heights; 0 = slot unused. */
  uAtmosRoomY: { value: new Array<number>(ROOM_SLOTS).fill(0) },
  uAtmosDiyaMap: { value: black as THREE.Texture },
  /** x0, z0, 1/width, 1/depth of the diya map. */
  uAtmosSiteBox: { value: new THREE.Vector4(SITE_BOX.x0, SITE_BOX.z0, 1 / (SITE_BOX.x1 - SITE_BOX.x0), 1 / (SITE_BOX.z1 - SITE_BOX.z0)) },
  uAtmosDiyaGain: { value: 0 },
  /** Glow points: xyz, w = radius (0 = off) / rgb × intensity. */
  uAtmosGlowPos: { value: vec4s(4) },
  uAtmosGlowCol: { value: vec4s(4) },
  /** Coves: cx, cz, r, y / a0, a1 (rad), reach (m), direction (1 up, −1 down) / rgb × intensity, –. */
  uAtmosCoveGeo: { value: vec4s(COVE_SLOTS, 0, 0, 1, 0) },
  uAtmosCoveSpan: { value: vec4s(COVE_SLOTS, 0, 0, 1, 1) },
  uAtmosCoveCol: { value: vec4s(COVE_SLOTS) },
  /** Ring washes about the drum's axis: r, y, reach, direction (1 up, −1 down) / rgb × intensity, –. */
  uAtmosRingGeo: { value: vec4s(RING_SLOTS, 1, 0, 1, 1) },
  uAtmosRingCol: { value: vec4s(RING_SLOTS) },
  /**
   * Accent cones: position, the height below which the cone stops (the piece's foot: the podium or
   * the plinth under it takes no spill; −1e4 = none) / unit direction, cos(outer half-angle) /
   * rgb × intensity, range (m). The beam is full strength over the inner 55 % of its angle.
   */
  uAtmosAccentPos: { value: vec4s(ACCENT_SLOTS_MAX, 0, -100, 0, 1) },
  uAtmosAccentDir: { value: vec4s(ACCENT_SLOTS_MAX, 0, -1, 0, 1) },
  uAtmosAccentCol: { value: vec4s(ACCENT_SLOTS_MAX) },
  /** Live accent count (≤ the program's slots). */
  uAtmosAccentN: { value: 0 },
  /** x: outdoor floors wet, y: the court under the oculus wet, 0 … 1. */
  uAtmosWet: { value: new THREE.Vector4(0, 0, 0, 0) },
}

SOLID_ROOMS.slice(0, ROOM_SLOTS).forEach((s, i) => {
  ATMOS.uAtmosRooms.value[i].set(SAT_WALL.innerC - SAT_WALL.t / 2, SAT_WALL.outerOuter + 0.25, s.fromDeg * DEG, s.toDeg * DEG)
  ATMOS.uAtmosRoomDir.value[i].set(Math.sin(s.fromDeg * DEG), Math.cos(s.fromDeg * DEG), Math.sin(s.toDeg * DEG), Math.cos(s.toDeg * DEG))
  ATMOS.uAtmosRoomY.value[i] = s.height
})

/** Retired with the jali (GRAND §0.4): kept so old callers compile; the oculus casts a clean disc. */
export function setOculusGobo(_tex: THREE.Texture | null, _halfExtent: number = OC.r) {}

/** Analytic glow point `slot` (0 pit, 1 Akash Deep, 2 theatre spill, 3 H's title); radius 0 turns it off. */
export const GLOW_SLOT = { pit: 0, akashDeep: 1, theatre: 2, spare: 3 } as const
export function setGlowPoint(slot: number, x: number, y: number, z: number, radius: number, color: THREE.Color, intensity: number) {
  const on = radius > 0 && intensity > 0
  ATMOS.uAtmosGlowPos.value[slot].set(x, y, z, on ? radius : 0)
  ATMOS.uAtmosGlowCol.value[slot].set(color.r * intensity, color.g * intensity, color.b * intensity, 0)
}

/* ------------------------------------------------------------------ */
/* GLSL                                                                */
/* ------------------------------------------------------------------ */

const RING_A0 = (MUSEUM.drum.dNotchDeg - 360) * DEG
const RING_A1 = MUSEUM.drum.neNotchDeg * DEG
const ROOF_R_LOBE = KEY.lobeOuterR + P.roofOverhang
const ROOF_R_RING = KEY.ringOuterR + P.roofOverhang
const SKY_Z = KEY.annexSkylightZ
const SKY_R = MUSEUM.annex.skylight.r

const PARS = /* glsl */ `
#ifdef USE_ATMOS
uniform vec4 uAtmosSun;
uniform vec4 uAtmosRooms[${ROOM_SLOTS}];
uniform vec4 uAtmosRoomDir[${ROOM_SLOTS}];
uniform float uAtmosRoomY[${ROOM_SLOTS}];
uniform sampler2D uAtmosDiyaMap;
uniform vec4 uAtmosSiteBox;
uniform float uAtmosDiyaGain;
uniform vec4 uAtmosGlowPos[4];
uniform vec4 uAtmosGlowCol[4];
#ifdef USE_ATMOS_COVE
uniform vec4 uAtmosCoveGeo[${COVE_SLOTS}];
uniform vec4 uAtmosCoveSpan[${COVE_SLOTS}];
uniform vec4 uAtmosCoveCol[${COVE_SLOTS}];
#endif
uniform vec4 uAtmosRingGeo[${RING_SLOTS}];
uniform vec4 uAtmosRingCol[${RING_SLOTS}];
#if ATMOS_ACCENTS > 0
uniform vec4 uAtmosAccentPos[ATMOS_ACCENTS];
uniform vec4 uAtmosAccentDir[ATMOS_ACCENTS];
uniform vec4 uAtmosAccentCol[ATMOS_ACCENTS];
uniform int uAtmosAccentN;
#endif
uniform vec4 uAtmosWet;

// ring sector of the drum (A, B, C side): between its two notch directions (a span under 180°,
// so two half-plane tests, no atan); the lobe is the rest
bool atmosRingSide(vec2 q) {
  return q.x * ${f(Math.sin(RING_A0))} - q.y * ${f(Math.cos(RING_A0))} <= 0.0 && q.x * ${f(Math.sin(RING_A1))} - q.y * ${f(Math.cos(RING_A1))} >= 0.0;
}

// under the main roof's footprint (with the eaves): drum lobe, gallery ring, annex
bool atmosRoofCovers(vec2 q) {
  float r = length(q);
  if (r < ${f(ROOF_R_RING)} || (r < ${f(ROOF_R_LOBE)} && !atmosRingSide(q))) return true;
  return abs(q.x) < ${f(KEY.annexOuterHalf + P.roofOverhang)} && q.y > 0.0 && q.y < ${f(KEY.annexOuterZ + P.roofOverhang)};
}

// inside the building's interior faces (the space the roof and the dome shelter)
bool atmosIndoors(vec2 q) {
  float r = length(q);
  if (r < ${f(KEY.ringR)} || (r < ${f(KEY.lobeR)} && !atmosRingSide(q))) return true;
  return abs(q.x) < ${f(KEY.annexHalf)} && q.y > 0.0 && q.y < ${f(KEY.annexEndZ)};
}

// inside a sector under 180° given its edge directions (sin a0, cos a0, sin a1, cos a1)
bool atmosInSector(vec2 q, vec4 e) {
  return q.x * e.x - q.y * e.y <= 0.0 && q.x * e.z - q.y * e.w >= 0.0;
}

// 1 where the ray from P toward the light crosses the plane y within radius r of c (soft 3 cm rim)
float atmosOpen(vec3 P, vec3 L, float y, vec2 c, float r) {
  float t = (y - P.y) / L.y;
  vec2 q = P.xz + L.xz * t - c;
  // the sun's penumbra: its half-degree disc softens the edge with distance from the opening
  // (≈ 0.2 m on the court floor, more up a far wall), never a hard cut-out wedge
  float w = 0.03 + 0.0065 * abs(t);
  return 1.0 - smoothstep(r - w, r + w, length(q));
}

// the dome's shell (a sphere cap above the springing, open at the oculus) between P and the light
bool atmosDomeShades(vec3 P, vec3 L) {
  vec3 oc = P - vec3(0.0, ${f(KEY.domeCentreY)}, 0.0);
  float b = dot(oc, L);
  float c = dot(oc, oc) - ${f(KEY.domeSphereR * KEY.domeSphereR)};
  float disc = b * b - c;
  if (disc <= 0.0) return false;
  float s = sqrt(disc);
  for (int i = 0; i < 2; i++) {
    float t = i == 0 ? -b - s : -b + s;
    if (t < 0.08) continue;
    vec3 h = P + L * t;
    if (h.y > ${f(DOME.springY)} && dot(h.xz, h.xz) > ${f(OC.r * OC.r)}) return true;
  }
  return false;
}

// direct light (sun or moon) reaching P
float atmosSunMask(vec3 P) {
  vec3 L = uAtmosSun.xyz;
  if (uAtmosSun.w < 0.5) return 1.0;
  bool inside = atmosIndoors(P.xz);
  if (L.y < 0.005) return inside || P.y < -0.05 ? 0.0 : 1.0;
  // the Sphere Well: below grade, only through the opening
  vec2 wq = P.xz - vec2(${f(SPHERE_WELL.cx)}, ${f(SPHERE_WELL.cz)});
  if (P.y < -0.05 && dot(wq, wq) < ${f((SPHERE_WELL.roomR + 0.6) ** 2)}) return atmosOpen(P, L, 0.0, vec2(${f(SPHERE_WELL.cx)}, ${f(SPHERE_WELL.cz)}), ${f(SPHERE_WELL.openingR)});
  float m = 1.0;
  // the dome's own exterior (tiles, ribs, cornice, the rim's plinth) stands over the rotunda's
  // plan but outside its shell: it takes the open sky like any roof
  vec3 dc = P - vec3(0.0, ${f(KEY.domeCentreY)}, 0.0);
  bool domeOutside = P.y > ${f(DOME.springY)} && dot(P.xz, P.xz) > ${f((OC.r + 0.5) ** 2)} && dot(dc, dc) > ${f((KEY.domeSphereR + 0.45) ** 2)};
  if (inside && !domeOutside) {
    if (dot(P.xz, P.xz) < ${f(KEY.ringR * KEY.ringR)}) {
      // under the dome: the oculus's lip, then the top of the light-well
      if (P.y < ${f(ROOF_Y0)}) m = atmosOpen(P, L, ${f(ROOF_Y0)}, vec2(0.0), ${f(OC.r)});
      if (P.y < ${f(ROOF_Y1)}) m *= atmosOpen(P, L, ${f(ROOF_Y1)}, vec2(0.0), ${f(OC.r)});
      return m;
    }
    if (P.y < ${f(SLAB_Y)}) {
      // under the slab: the Earth Room's skylight (through its whole depth) …
      vec2 sc = vec2(0.0, ${f(SKY_Z)});
      m = atmosOpen(P, L, ${f(SLAB_Y)}, sc, ${f(SKY_R)}) * atmosOpen(P, L, ${f(SLAB_TOP)}, sc, ${f(SKY_R)});
      // … or a low southern sun through the annex door
      if (L.z > 0.01) {
        float t = (${f(KEY.annexEndZ)} - P.z) / L.z;
        vec3 d = P + L * t;
        // (soft-edged, and only while the sun is low: a high sun's patch inside the door is a hard,
        // flat band on the floor where no shadow map softens it)
        float door = (1.0 - smoothstep(${f(MUSEUM.annex.door.height - 0.4)}, ${f(MUSEUM.annex.door.height + 0.4)}, d.y)) * (1.0 - smoothstep(${f(MUSEUM.annex.door.width / 2 - 0.15)}, ${f(MUSEUM.annex.door.width / 2 + 0.15)}, abs(d.x))) * (1.0 - smoothstep(0.35, 0.6, L.y));
        if (t > 0.0) m = max(m, door);
      }
      return m;
    }
  } else if (!inside && P.y < ${f(SLAB_TOP)}) {
    // outside: the drum's and the annex's own bulk (the roof's own surface, inside the plan and
    // above the springing, is not under it)
    vec2 q = P.xz + L.xz * ((${f(SLAB_TOP)} - P.y) / L.y);
    if (atmosRoofCovers(q)) return 0.0;
  }
  if (atmosDomeShades(P, L)) return 0.0;
  // the Red Room: its own drum under a frosted laylight in its oculus (RedRoomShell): the sun is
  // scattered into the room's soft daylight, never a hard sun ellipse climbing its red wall
  vec2 rq = P.xz - vec2(${f(RED_ROOM.cx)}, ${f(RED_ROOM.cz)});
  if (P.y < ${f(RED_ROOM.height)} && dot(rq, rq) < ${f((RED_ROOM.r + 0.05) ** 2)}) return 0.0;
  for (int i = 0; i < ${ROOM_SLOTS}; i++) {
    float h = uAtmosRoomY[i];
    if (h <= 0.0 || P.y >= h) continue;
    vec4 rm = uAtmosRooms[i];
    vec4 rd = uAtmosRoomDir[i];
    float rp = length(P.xz);
    if (rp > ${f(SAT_WALL.innerFace)} && rp < ${f(SAT_WALL.outerFace)} && atmosInSector(P.xz, rd)) { m = 0.0; break; }
    vec2 q = P.xz + L.xz * ((h - P.y) / L.y);
    float rq2 = length(q);
    if (rq2 > rm.x && rq2 < rm.y && atmosInSector(q, rd)) { m = 0.0; break; }
  }
  return m;
}
#endif
`

const PRE = /* glsl */ `
#ifdef USE_ATMOS
  vec3 atmosP = (geometryPosition - viewMatrix[3].xyz) * mat3(viewMatrix);
  vec3 atmosN = normalize(geometryNormal * mat3(viewMatrix));
  float atmosSunM = atmosSunMask(atmosP);
  // the patch on the rotunda's walls is held below the floor's: a vertical face in the oculus's
  // sun (the white lime of B) reads as warm light on plaster, never a blown white wedge
  bool atmosRotunda = dot(atmosP.xz, atmosP.xz) < ${f(KEY.ringR * KEY.ringR + 1.0)} && atmosP.y < ${f(DOME.springY)};
  if (atmosRotunda) atmosSunM *= mix(0.55, 1.0, abs(atmosN.y));
  #ifdef STANDARD
  if (uAtmosWet.x + uAtmosWet.y > 0.0 && atmosN.y > 0.6 && atmosP.y < 0.8 && atmosP.y > -0.05) {
    float rr = length(atmosP.xz);
    // the open sky falls on the forecourt, the plinth and the Parikrama walk (no longer roofed);
    // the rooms and the building stay dry, and under the dome only the oculus's footprint is wet
    bool sheltered = atmosRoofCovers(atmosP.xz) || (rr > ${f(SAT_WALL.innerC - SAT_WALL.t / 2)} && rr < ${f(SAT_WALL.outerOuter + 0.25)} && atmosP.z < 0.0);
    float wet = sheltered ? 0.0 : uAtmosWet.x;
    wet = max(wet, uAtmosWet.y * (1.0 - smoothstep(${f(OC.r - 0.1)}, ${f(OC.r + 0.4)}, rr)));
    material.diffuseColor *= 1.0 - 0.38 * wet;
    material.roughness = mix(material.roughness, 0.14, 0.85 * wet);
  }
  #endif
#endif
`

const POST = /* glsl */ `
#ifdef USE_ATMOS
  {
    vec3 atmosIrr = vec3(0.0);
    // 2. festival lamps (top-down light map, strongest near the floor)
    if (uAtmosDiyaGain > 0.0) {
      vec2 duv = (atmosP.xz - uAtmosSiteBox.xy) * uAtmosSiteBox.zw;
      if (duv.x > 0.0 && duv.y > 0.0 && duv.x < 1.0 && duv.y < 1.0) {
        float hf = exp(-abs(atmosP.y - 0.12) * 1.15) * (0.55 + 0.45 * max(atmosN.y, 0.0));
        // fade out towards the map's border: no hard orange edge where the lamps' map ends
        vec2 de = min(duv, 1.0 - duv);
        hf *= smoothstep(0.0, 0.04, min(de.x, de.y));
        atmosIrr += textureLod(uAtmosDiyaMap, duv, 0.0).rgb * (uAtmosDiyaGain * hf);
      }
    }
    // 3. glow points
    for (int i = 0; i < 4; i++) {
      vec4 gp = uAtmosGlowPos[i];
      if (gp.w <= 0.0) continue;
      vec3 d = gp.xyz - atmosP;
      float d2 = max(dot(d, d), 1e-4);
      float r2 = gp.w * gp.w;
      float win = clamp(1.0 - pow(d2 / (16.0 * r2), 2.0), 0.0, 1.0);
      atmosIrr += uAtmosGlowCol[i].rgb * (max(dot(atmosN, d * inversesqrt(d2)), 0.0) * r2 / (d2 + 0.25 * r2) * win * win);
    }
    // 4. cove lines: grazing wash beside the concealed LEDs (architecture only)
    #ifdef USE_ATMOS_COVE
    for (int i = 0; i < ${COVE_SLOTS}; i++) {
      vec4 cc = uAtmosCoveCol[i];
      if (cc.r + cc.g + cc.b <= 0.0) continue;
      vec4 cg = uAtmosCoveGeo[i];
      vec4 cs = uAtmosCoveSpan[i];
      // only on the lit side of the line (above an uplight, below a downlight), near its circle
      float side = (atmosP.y - cg.w) * cs.w;
      if (side < -0.2) continue;
      vec2 rel = atmosP.xz - cg.xy;
      if (abs(length(rel) - cg.z) > cs.z) continue;
      float t = atan(rel.y, rel.x) - cs.x;
      t -= 6.2831853 * floor(t / 6.2831853);
      float span = cs.y - cs.x;
      if (t > span) t = (t - span < 6.2831853 - t) ? span : 0.0;
      float ac = cs.x + t;
      vec3 c = vec3(cg.x + cg.z * cos(ac), cg.w, cg.y + cg.z * sin(ac));
      vec3 d = c - atmosP;
      float dist = length(d);
      float lit = smoothstep(-0.2, 0.4, side);
      float fall = 1.0 / (1.0 + dist * dist * 1.4) * (1.0 - smoothstep(cs.z * 0.6, cs.z, dist));
      atmosIrr += cc.rgb * (max(dot(atmosN, d / max(dist, 1e-3)), 0.0) * fall * lit);
    }
    #endif
    // 5. ring washes about the axis: the dome's springing uplight, the oculus terraces' LED rings
    float atmosR = length(atmosP.xz);
    for (int i = 0; i < ${RING_SLOTS}; i++) {
      vec4 rc = uAtmosRingCol[i];
      if (rc.r + rc.g + rc.b <= 0.0) continue;
      vec4 rg = uAtmosRingGeo[i];
      float side = (atmosP.y - rg.y) * rg.w;
      if (side < -0.1 || side > rg.z || abs(atmosR - rg.x) > rg.z) continue;
      vec2 dirXZ = atmosR > 1e-3 ? atmosP.xz / atmosR : vec2(1.0, 0.0);
      vec3 c = vec3(dirXZ.x * rg.x, rg.y, dirXZ.y * rg.x);
      vec3 d = c - atmosP;
      float dist = max(length(d), 1e-3);
      float k = 3.0 / (rg.z * rg.z);
      float fall = 1.0 / (1.0 + dist * dist * k) * (1.0 - smoothstep(rg.z * 0.7, rg.z, dist));
      atmosIrr += rc.rgb * (max(dot(atmosN, d / dist), 0.0) * fall * smoothstep(-0.1, 0.25, side));
    }
    // 6. accent cones: tight analytic spots. The loop only gathers (a small body, quick to compile
    // on D3D): their diffuse joins the irradiance, and their highlight is one GGX lobe along the
    // cones' brightness-weighted direction (physical materials only)
    #if ATMOS_ACCENTS > 0
    vec3 atmosSpecCol = vec3(0.0);
    vec3 atmosSpecDir = vec3(0.0);
    for (int i = 0; i < ATMOS_ACCENTS; i++) {
      if (i >= uAtmosAccentN) break;
      vec4 ac = uAtmosAccentCol[i];
      vec4 ap = uAtmosAccentPos[i];
      vec3 d = ap.xyz - atmosP;
      float d2 = dot(d, d);
      if (d2 > ac.w * ac.w) continue;
      vec3 l = d * inversesqrt(max(d2, 1e-4));
      vec4 ad = uAtmosAccentDir[i];
      float cd = -dot(l, ad.xyz);
      float nl = dot(atmosN, l);
      if (cd <= ad.w || atmosP.y < ap.w || nl <= 0.0) continue;
      float win = clamp(1.0 - d2 * d2 / (ac.w * ac.w * ac.w * ac.w), 0.0, 1.0);
      vec3 E = ac.rgb * (smoothstep(ad.w, 1.0 - (1.0 - ad.w) * 0.3, cd) * smoothstep(ap.w, ap.w + 0.03, atmosP.y) * win * win / max(d2, 0.04));
      atmosIrr += E * nl;
      atmosSpecCol += E * nl;
      atmosSpecDir += l * dot(E, vec3(0.3333));
    }
    #endif
    reflectedLight.directDiffuse += atmosIrr * BRDF_Lambert(material.diffuseColor);
    #if ATMOS_ACCENTS > 0 && defined(STANDARD)
    if (dot(atmosSpecDir, atmosSpecDir) > 1e-8) {
      vec3 atmosLV = normalize((viewMatrix * vec4(normalize(atmosSpecDir), 0.0)).xyz);
      reflectedLight.directSpecular += atmosSpecCol * BRDF_GGX(atmosLV, geometryViewDir, geometryNormal, material);
    }
    #endif
  }
#endif
`

/* ------------------------------------------------------------------ */
/* Chunk patch (once)                                                  */
/* ------------------------------------------------------------------ */

let patched = false
const DIR_INFO = 'getDirectionalLightInfo( directionalLight, directLight );'
const VIEW_DIR = 'vec3 geometryViewDir = ( isOrthographic ) ? vec3( 0, 0, 1 ) : normalize( vViewPosition );'
const CLEARCOAT_N = 'vec3 geometryClearcoatNormal = vec3( 0.0 );'

/** Patch three's light chunks (idempotent). Returns false where unsupported (WebGPU, unknown chunk text). */
export function patchAtmosphereChunks(): boolean {
  if (patched) return true
  if (isWebGPU()) return false
  // diagnostic kill-switch: `?atmos=off` renders the pavilion without the shared light engine
  if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('atmos') === 'off') return false
  const C = THREE.ShaderChunk as unknown as Record<string, string>
  // three's own chunks, kept once per page: a second copy of this module (a hot reload, a split
  // chunk) patches from the originals instead of patching the patched text again
  const G = globalThis as unknown as { __atmosChunks?: { pars: string; begin: string } }
  G.__atmosChunks ??= { pars: C.lights_pars_begin, begin: C.lights_fragment_begin }
  const begin = G.__atmosChunks.begin
  if (!begin.includes(DIR_INFO) || !begin.includes(VIEW_DIR) || !begin.includes(CLEARCOAT_N)) {
    console.warn('[atmosphere] unexpected three.js light chunk; the oculus mask is off')
    return false
  }
  C.lights_pars_begin = `${G.__atmosChunks.pars}\n${PARS}`
  C.lights_fragment_begin = `${begin
    .replace(VIEW_DIR, `${VIEW_DIR}\n${PRE}`)
    // golden hour through the oculus: inside the rotunda the low sun's orange is held to a warm
    // white, so it never floods the galleries orange (the forecourt keeps the full colour)
    .replace(
      DIR_INFO,
      `${DIR_INFO}\n#ifdef USE_ATMOS\n\t\tdirectLight.color *= atmosSunM;\n\t\tif (atmosRotunda) directLight.color = mix(directLight.color, vec3(dot(directLight.color, vec3(0.299, 0.587, 0.114))) * vec3(1.0, 0.92, 0.82), 0.55) * 0.85;\n#endif`,
    )}\n${POST}`
  patched = true
  return true
}

/* ------------------------------------------------------------------ */
/* Opting materials in                                                 */
/* ------------------------------------------------------------------ */

/** Opted-in / exempt materials. Not userData: Material.clone() copies userData but not the shader hook. */
const opted = new WeakSet<THREE.Material>()
const skipped = new WeakSet<THREE.Material>()

/**
 * Accent slots compiled into the programs. Decided once from the GPU's fragment uniform budget
 * (installAtmosphere): 24 where there is room (desktop), 12 on a tight budget (phones), so a
 * Low device never fails to link. The live count is the tier's cap (AccentField).
 */
let accentSlots = ACCENT_SLOTS_MAX
export const accentProgramSlots = () => accentSlots

type LitMaterial = THREE.MeshStandardMaterial | THREE.MeshLambertMaterial | THREE.MeshPhongMaterial

const isLit = (m: THREE.Material): m is LitMaterial =>
  (m as THREE.MeshStandardMaterial).isMeshStandardMaterial === true ||
  (m as THREE.MeshLambertMaterial).isMeshLambertMaterial === true ||
  (m as THREE.MeshPhongMaterial).isMeshPhongMaterial === true

export interface AtmosFlags {
  /** Exempt the material (e.g. the partner logos' ground): nothing is added. */
  skip?: boolean
  /** Also take the cove wash (the architecture's wall, ceiling and floor finishes). */
  coves?: boolean
}

/**
 * Opt a lit material into the atmosphere terms. Call before it first compiles; safe to call
 * twice. Unlit, shader and already-opted materials are left alone. Returns true when opted in.
 */
export function injectAtmosphere(mat: THREE.Material, flags: AtmosFlags = {}): boolean {
  if (flags.skip) {
    skipped.add(mat)
    return false
  }
  if (opted.has(mat) || skipped.has(mat) || !isLit(mat)) return false
  if (!patchAtmosphereChunks()) return false
  opted.add(mat)
  mat.defines = { ...(mat.defines ?? {}), USE_ATMOS: '', ...(flags.coves ? { USE_ATMOS_COVE: '' } : {}) }
  const prev = mat.onBeforeCompile
  mat.onBeforeCompile = (shader, renderer) => {
    prev?.call(mat, shader, renderer)
    Object.assign(shader.uniforms, ATMOS)
    shader.fragmentShader = `#define ATMOS_ACCENTS ${accentSlots}\n${shader.fragmentShader}`
  }
  const prevKey = mat.customProgramCacheKey.bind(mat)
  mat.customProgramCacheKey = () => `${prevKey()}|atmos${flags.coves ? 'C' : ''}${accentSlots}`
  mat.needsUpdate = true
  return true
}

/** Opt in every lit material under `root` that has not compiled yet on `renderer`. */
export function injectAtmosphereTree(root: THREE.Object3D, renderer?: THREE.WebGLRenderer) {
  let n = 0
  root.traverse((o) => {
    const mats = (o as THREE.Mesh).material
    if (!mats) return
    for (const m of Array.isArray(mats) ? mats : [mats]) {
      if (opted.has(m) || skipped.has(m) || !isLit(m)) continue
      if (renderer && compiled(renderer, m)) continue
      if (injectAtmosphere(m)) n++
    }
  })
  return n
}

function compiled(renderer: THREE.WebGLRenderer, m: THREE.Material) {
  return (renderer.properties.get(m) as { currentProgram?: unknown }).currentProgram !== undefined
}

let hooked: THREE.WebGLRenderer | null = null
const baseHook = THREE.Material.prototype.onBeforeRender

/**
 * Catch lit materials that appear after startup (a late model, a tier switch): just before their
 * first draw — still uncompiled — they are opted in. Materials with their own onBeforeRender are
 * left to Precompile / their owners. Also sizes the accent slots to the GPU.
 */
export function installAtmosphere(renderer: THREE.WebGLRenderer) {
  if (!patchAtmosphereChunks()) return () => {}
  // three's own lights, shadows and the material take most of the budget; 24 cones need 72 vectors
  accentSlots = renderer.capabilities.maxFragmentUniforms >= 512 ? ACCENT_SLOTS_MAX : 12
  hooked = renderer
  THREE.Material.prototype.onBeforeRender = function (this: THREE.Material, r: THREE.WebGLRenderer) {
    if (hooked === r && !opted.has(this) && !skipped.has(this) && isLit(this) && !compiled(r, this)) injectAtmosphere(this)
  } as typeof baseHook
  return () => {
    if (hooked === renderer) {
      hooked = null
      THREE.Material.prototype.onBeforeRender = baseHook
    }
  }
}
