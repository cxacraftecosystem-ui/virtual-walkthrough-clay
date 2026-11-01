/**
 * THE KILN FILM — "Earth · Water · Hand · Fire · Ash": the Agni Theatre's generative film (F24),
 * a loop in five chapters drawn by one fragment shader into a ProjectionTarget and shown on the
 * curved screen. It is what the theatre shows when no confirmed film exists, so it makes no
 * claim — it names no place, person or process step; it is clay, moving, in the light of day.
 *
 *   I   EARTH  a riverbank cut in section at sunrise: ochre, kaolin, laterite and silt strata
 *              fold under a gold-to-blue sky, a river glinting at their foot
 *   II  WATER  looking down into the river: teal water and its caustic net, red and cream clay
 *              slip blooming into it and marbling
 *   III HAND   a vessel rises on a turning wheel in a warm pool of light against indigo, two
 *              hands at its wall, the throwing lines spiralling
 *   IV  FIRE   the kiln: flames roll up round the vessel, sparks lift, the pot glows white-hot
 *   V   ASH    morning after the firing: grey-blue light, ash drifting down, smoke curling, the
 *              vessel cooled to terracotta in its bed of ash, the light rising to cream
 *
 * Each chapter opens with its title card (numeral and name, from a small canvas atlas: see
 * `kilnFilmTitles`). Chapters cross-fade over 1.6 s; the loop fades in from and out to black.
 * Between showings (`uPoster` 1) the screen holds a lit poster: the thrown vessel and the film's
 * title. The tier sets the target size, refresh rate and fbm octaves
 * (QUALITY_PRESETS[tier].spectacle.kilnFilmRT). Reduced motion: `uStill` 1 freezes each chapter
 * on one composed frame.
 */
import * as THREE from 'three'

export const KILN_FILM_CHAPTERS = 5

/** The wall oxblood (materials.ts 'oxbloodLacquer'), sRGB: the fired pot's deepest shade. */
const OXBLOOD = new THREE.Color('#6d211c')

/** Chapter names and the film's title, per language (the slate in the lobby lists them too). */
export const KILN_FILM_TEXT: Record<string, { title: string; chapters: string[] }> = {
  en: { title: 'The Kiln Film', chapters: ['Earth', 'Water', 'Hand', 'Fire', 'Ash'] },
  hi: { title: 'आँवे की फ़िल्म', chapters: ['मिट्टी', 'पानी', 'हाथ', 'आग', 'राख'] },
  bn: { title: 'ভাটির ছবি', chapters: ['মাটি', 'জল', 'হাত', 'আগুন', 'ছাই'] },
}
export const kilnFilmText = (lang: string) => KILN_FILM_TEXT[lang] ?? KILN_FILM_TEXT.en

/**
 * The screen's light per chapter (linear-ish RGB, ~0 … 1), for what the picture spills onto the
 * room (the RectAreaLight, the wall halo, the vault and floor washes): matches the shader's
 * dominant colours. Index 5 is the poster.
 */
export const KILN_FILM_SPILL: [number, number, number][] = [
  [1.0, 0.74, 0.42],
  [0.42, 0.78, 0.82],
  [0.98, 0.62, 0.4],
  [1.0, 0.5, 0.16],
  [0.78, 0.82, 0.9],
  [0.95, 0.66, 0.44],
]

/** The spill colour and level at `t` s into the film (chapterSec per chapter), cross-faded like the picture. */
export function kilnFilmSpill(t: number, chapterSec: number, out: THREE.Color): THREE.Color {
  const n = KILN_FILM_CHAPTERS
  const T = ((t % (chapterSec * n)) + chapterSec * n) % (chapterSec * n)
  const ch = Math.min(n - 1, Math.floor(T / chapterSec))
  const tc = (T - ch * chapterSec) / chapterSec
  const fade = 1.6 / chapterSec
  const x = ch < n - 1 ? Math.max(0, Math.min(1, (tc - (1 - fade)) / fade)) : 0
  const a = KILN_FILM_SPILL[ch]
  const b = KILN_FILM_SPILL[Math.min(n - 1, ch + 1)]
  let k = 1
  if (ch === 3) k = 1.15 + 0.25 * Math.sin(t * 9.1) * Math.sin(t * 3.7) // the fire flickers
  if (ch === 4) k = 0.8 + 0.4 * tc // the morning after brightens
  return out.setRGB((a[0] + (b[0] - a[0]) * x) * k, (a[1] + (b[1] - a[1]) * x) * k, (a[2] + (b[2] - a[2]) * x) * k)
}

/** Title-card atlas rows: the five chapters, then the poster title. */
const TITLE_ROWS = KILN_FILM_CHAPTERS + 1
const NUMERALS = ['I', 'II', 'III', 'IV', 'V']

/**
 * The title cards, drawn once per language into one canvas: row k (top first) is chapter k's
 * card (a numeral, the name in a large serif, a hairline), the last row the poster's title and
 * the chapter list. White on transparent with a soft shadow, laid out for the screen's aspect.
 */
export function kilnFilmTitles(lang: string, aspect: number, fontsReady?: Promise<void>): THREE.CanvasTexture {
  const W = 1536
  const rowH = Math.round(W / Math.max(1, aspect))
  const cv = document.createElement('canvas')
  cv.width = W
  cv.height = rowH * TITLE_ROWS
  const tex = new THREE.CanvasTexture(cv)
  tex.colorSpace = THREE.NoColorSpace
  tex.minFilter = THREE.LinearFilter
  tex.generateMipmaps = false
  const draw = () => {
    const ctx = cv.getContext('2d')
    if (!ctx) return
    const txt = kilnFilmText(lang)
    const serif = lang === 'en' ? '"Cormorant Garamond", Georgia, serif' : '"Noto Serif Devanagari", "Noto Serif Bengali", Georgia, serif'
    const sans = 'Inter, "Noto Sans Devanagari", "Noto Sans Bengali", Arial, sans-serif'
    ctx.clearRect(0, 0, cv.width, cv.height)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.shadowColor = 'rgba(0,0,0,0.55)'
    ctx.shadowBlur = rowH * 0.05
    const spaced = (s: string, px: number) => {
      if ('letterSpacing' in ctx) (ctx as unknown as { letterSpacing: string }).letterSpacing = `${px}px`
      return s
    }
    for (let k = 0; k < TITLE_ROWS; k++) {
      const y0 = k * rowH
      const cx = W / 2
      ctx.fillStyle = 'rgba(255,246,232,0.96)'
      if (k < KILN_FILM_CHAPTERS) {
        ctx.font = `600 ${Math.round(rowH * 0.075)}px ${sans}`
        ctx.fillText(spaced(`${NUMERALS[k]}`, rowH * 0.03), cx, y0 + rowH * 0.34)
        spaced('', 0)
        ctx.font = `500 ${Math.round(rowH * 0.2)}px ${serif}`
        const name = lang === 'en' ? txt.chapters[k].toUpperCase() : txt.chapters[k]
        ctx.fillText(spaced(name, lang === 'en' ? rowH * 0.035 : 0), cx, y0 + rowH * 0.53)
        spaced('', 0)
        ctx.fillRect(cx - rowH * 0.22, y0 + rowH * 0.67, rowH * 0.44, Math.max(2, rowH * 0.006))
      } else {
        ctx.font = `600 ${Math.round(rowH * 0.06)}px ${sans}`
        ctx.fillText(spaced(lang === 'en' ? 'NOW SHOWING' : '', rowH * 0.03), cx, y0 + rowH * 0.25)
        spaced('', 0)
        ctx.font = `500 ${Math.round(rowH * 0.17)}px ${serif}`
        ctx.fillText(txt.title, cx, y0 + rowH * 0.44)
        ctx.font = `400 ${Math.round(rowH * 0.075)}px ${serif}`
        ctx.fillText(txt.chapters.join('  ·  '), cx, y0 + rowH * 0.62)
      }
    }
    tex.needsUpdate = true
  }
  draw()
  fontsReady?.then(draw).catch(() => {})
  return tex
}

export interface KilnFilmUniforms {
  [k: string]: THREE.IUniform
  /** Seconds into the loop (0 … 5·uChapterSec). */
  uTime: THREE.IUniform<number>
  uChapterSec: THREE.IUniform<number>
  uOctaves: THREE.IUniform<number>
  uAspect: THREE.IUniform<number>
  uStill: THREE.IUniform<number>
  /** 1: the poster between showings (the vessel and the title). */
  uPoster: THREE.IUniform<number>
  /** Overall level (0 = black): fades with the house. */
  uLevel: THREE.IUniform<number>
  uOxblood: THREE.IUniform<THREE.Vector3>
  uTitles: THREE.IUniform<THREE.Texture | null>
}

const VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`

export const KILN_FILM_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform float uTime;
uniform float uChapterSec;
uniform float uOctaves;
uniform float uAspect;
uniform float uStill;
uniform float uPoster;
uniform float uLevel;
uniform vec3 uOxblood;
uniform sampler2D uTitles;

#define ROWS ${TITLE_ROWS.toFixed(1)}
#define NCH ${KILN_FILM_CHAPTERS.toFixed(1)}

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  mat2 r = mat2(0.8, -0.6, 0.6, 0.8);
  for (int i = 0; i < 6; i++) {
    if (float(i) >= uOctaves) break;
    v += a * noise(p);
    p = r * p * 2.03 + 11.7;
    a *= 0.5;
  }
  return v;
}
vec3 lin(vec3 c) { return pow(max(c, 0.0), vec3(2.2)); }

/* I — EARTH: a riverbank in section at sunrise */
vec3 earth(vec2 p, float t) {
  float pan = t * 0.22;
  vec2 q = vec2(p.x + pan, p.y);
  // the bank's crest against the sky
  float crest = 0.42 + 0.16 * fbm(vec2(q.x * 0.9, 2.0)) - 0.05 * sin(q.x * 1.3);
  // sky: gold at the horizon to a clear blue, the sun low on the left
  vec2 sun = vec2(-0.85 + 0.25 * t, 0.62 + 0.12 * t);
  float sd = length(p - sun);
  vec3 sky = mix(vec3(1.0, 0.80, 0.50), vec3(0.42, 0.64, 0.86), smoothstep(crest - 0.05, 1.05, p.y));
  sky += vec3(1.0, 0.86, 0.6) * (exp(-sd * 9.0) * 1.2 + exp(-sd * 2.4) * 0.35);
  // strata, folding slowly
  float fold = 0.14 + 0.18 * smoothstep(0.0, 1.0, t);
  float y = q.y + fold * sin(q.x * 1.4 + 0.6) * (0.6 + 0.4 * sin(q.x * 0.5 + t * 1.2)) + 0.1 * fbm(q * 2.0 + vec2(t * 0.5, 0.0));
  float band = y * 6.0;
  float i = floor(band);
  float f = fract(band);
  float k = hash(vec2(i, 3.0));
  vec3 soils[6];
  soils[0] = vec3(0.88, 0.64, 0.30);
  soils[1] = vec3(0.80, 0.42, 0.24);
  soils[2] = vec3(0.96, 0.92, 0.82);
  soils[3] = vec3(0.68, 0.30, 0.17);
  soils[4] = vec3(0.62, 0.62, 0.50);
  soils[5] = vec3(0.74, 0.54, 0.36);
  int idx = int(mod(i * 7.0 + floor(k * 3.0), 6.0));
  vec3 c = soils[0];
  for (int s = 0; s < 6; s++) if (s == idx) c = soils[s];
  c *= 0.85 + 0.25 * fbm(q * vec2(9.0, 30.0) + i);
  c *= mix(0.62, 1.0, smoothstep(0.0, 0.07, f) * smoothstep(1.0, 0.93, f));
  // low sun from the left: warm on the face, rim-lit at the crest
  c *= 0.82 + 0.3 * smoothstep(1.4, -1.4, p.x);
  c += vec3(0.5, 0.32, 0.12) * smoothstep(0.12, 0.0, crest - p.y) * step(p.y, crest);
  // grass on the crest
  float grass = smoothstep(0.03, 0.0, crest - p.y) * step(p.y, crest + 0.02 * noise(vec2(q.x * 60.0, 0.0)));
  c = mix(c, vec3(0.46, 0.52, 0.22), grass * 0.8);
  // the river at the foot, glinting
  float river = smoothstep(-0.70, -0.74, p.y + 0.03 * sin(q.x * 3.0 + t * 4.0));
  vec3 rc = mix(vec3(0.30, 0.50, 0.56), vec3(0.62, 0.74, 0.78), smoothstep(-1.0, -0.72, p.y));
  rc += vec3(1.0, 0.85, 0.6) * pow(noise(vec2(q.x * 14.0 + t * 3.0, p.y * 40.0)), 14.0) * 1.2;
  c = mix(c, rc, river);
  vec3 col = mix(c, sky, smoothstep(crest, crest + 0.012, p.y));
  return lin(col);
}

/* II — WATER: into the river; slip blooming and marbling in the caustic light */
vec3 water(vec2 p, float t) {
  vec2 q = p * 1.5;
  float a = t * 1.2;
  // teal water with a caustic net
  vec3 deep = vec3(0.07, 0.30, 0.38);
  vec3 shallow = vec3(0.24, 0.60, 0.64);
  vec3 c = mix(deep, shallow, smoothstep(-1.0, 1.0, p.y + 0.4 * fbm(q + a * 0.2)));
  // caustics: two layers of ridged, domain-warped noise (an organic net, never a grid)
  vec2 cq = q * 2.2 + vec2(fbm(q * 0.9 + a * 0.3), fbm(q * 0.9 + 7.0 - a * 0.25)) * 1.2;
  float r1 = 1.0 - abs(noise(cq * 1.7 + vec2(a * 0.6, -a * 0.4)) * 2.0 - 1.0);
  float r2 = 1.0 - abs(noise(cq * 2.9 + vec2(-a * 0.5, a * 0.7) + 4.0) * 2.0 - 1.0);
  float caus = pow(r1, 9.0) + 0.6 * pow(r2, 12.0);
  c += vec3(0.6, 0.92, 0.88) * caus * 0.55;
  // the slip clouds, growing through the chapter
  vec2 w1 = vec2(fbm(q + vec2(0.0, a * 0.4)), fbm(q + vec2(5.2, 1.3 - a * 0.3)));
  vec2 w2 = vec2(fbm(q + 3.0 * w1 + vec2(1.7, 9.2) + a * 0.25), fbm(q + 3.0 * w1 + vec2(8.3, 2.8)));
  float v = fbm(q + 3.2 * w2);
  float amount = mix(0.2, 0.75, smoothstep(0.0, 0.85, t));
  float cloud = smoothstep(1.0 - amount, 1.0 - amount + 0.28, v + 0.25 * length(w2));
  vec3 slipRed = vec3(0.86, 0.44, 0.26);
  vec3 slipCream = vec3(0.98, 0.90, 0.74);
  vec3 slip = mix(slipRed, slipCream, smoothstep(0.45, 0.75, v + 0.2 * w2.x));
  slip *= 0.85 + 0.3 * fbm(q * 3.0 + w1);
  c = mix(c, slip, cloud * 0.92);
  // light glancing off the surface
  float sheen = pow(smoothstep(0.6, 0.72, fbm(q * 2.0 + w1 * 2.0 + a * 0.2)), 3.0);
  c += vec3(0.4, 0.42, 0.38) * sheen;
  return lin(c);
}

/* the vessel's half-width at height y (0 … h), as thrown: a cylinder opening into a belly, a collar */
float vesselR(float y, float h, float grow) {
  float u = clamp(y / max(h, 1e-3), 0.0, 1.0);
  float belly = 0.34 * sin(3.14159 * pow(u, 0.85)) * grow;
  float collar = 0.11 + 0.05 * smoothstep(0.86, 1.0, u);
  return mix(0.16, collar, smoothstep(0.7, 0.95, u) * grow) + belly * (1.0 - smoothstep(0.75, 1.0, u)) + 0.02;
}

/* the thrown vessel at growth t: mask, normalised x across it, height fraction */
void vessel(vec2 p, float t, out float mask, out float nx, out float vy) {
  float base = -0.62;
  float h = mix(0.25, 1.05, smoothstep(0.02, 0.75, t));
  float grow = smoothstep(0.25, 0.9, t);
  float y = p.y - base;
  float r = vesselR(y, h, grow);
  mask = step(0.0, y) * step(y, h) * smoothstep(r, r - 0.006, abs(p.x));
  nx = clamp(p.x / max(r, 1e-3), -1.0, 1.0);
  vy = clamp(y / h, 0.0, 1.0);
}

/* III — HAND: a vessel rises on the wheel, in a warm pool of light against indigo */
vec3 hand(vec2 p, float t, float hands) {
  float base = -0.62;
  vec3 bg = mix(vec3(0.10, 0.13, 0.24), vec3(0.20, 0.26, 0.40), smoothstep(-1.0, 1.0, p.y));
  float pool = exp(-dot(p * vec2(0.8, 1.1), p * vec2(0.8, 1.1)) * 1.4);
  bg = mix(bg, vec3(0.86, 0.56, 0.34), pool * 0.75);
  float mask;
  float nx;
  float vy;
  vessel(p, t, mask, nx, vy);
  float h = mix(0.25, 1.05, smoothstep(0.02, 0.75, t));
  float grow = smoothstep(0.25, 0.9, t);
  // the wheel head: a flat ellipse with streaks turning
  vec2 wq = vec2(p.x / 0.62, (p.y - base + 0.02) / 0.08);
  float wheel = smoothstep(1.0, 0.94, length(wq)) * step(p.y, base + 0.02);
  float ang = atan(wq.y, wq.x * 0.2);
  float streak = 0.5 + 0.5 * sin(ang * 14.0 + t * 40.0);
  vec3 c = mix(bg, mix(vec3(0.42, 0.30, 0.22), vec3(0.62, 0.46, 0.34), streak), wheel);
  // the thrown wall: lit from the left with a cool rim on the right, throwing lines spiralling
  float shade = 0.4 + 0.6 * clamp(0.6 - 0.8 * nx + 0.4 * sqrt(1.0 - nx * nx), 0.0, 1.0);
  float lines = 0.9 + 0.1 * sin((p.y - base) * 70.0 + nx * 3.0 - t * 35.0);
  vec3 clay = vec3(0.90, 0.56, 0.38) * shade * lines;
  clay += vec3(0.30, 0.42, 0.62) * smoothstep(0.7, 1.0, nx) * 0.6;
  clay += vec3(0.22, 0.18, 0.14) * pow(max(0.0, 1.0 - abs(nx + 0.4) * 1.6), 3.0);
  c = mix(c, clay, mask);
  // two hands, warm brown, pressing the wall at the throwing height
  float hy = base + h * (0.25 + 0.55 * fract(t * 2.0));
  for (int s = 0; s < 2; s++) {
    float sg = s == 0 ? -1.0 : 1.0;
    float rr = vesselR(hy - base, h, grow);
    vec2 hp = p - vec2(sg * (rr + 0.17), hy);
    hp.y *= 1.7;
    float d = length(hp) - 0.15;
    float fingers = length(vec2(hp.x + sg * 0.12, hp.y * 0.7)) - 0.06;
    float m = smoothstep(0.02, -0.02, min(d, fingers)) * hands * smoothstep(0.98, 0.9, t) * smoothstep(0.02, 0.12, t);
    vec3 skin = vec3(0.50, 0.30, 0.20) * (0.7 + 0.5 * smoothstep(0.1, -0.2, hp.x * sg + hp.y * 0.3));
    c = mix(c, skin, m);
  }
  return lin(c);
}

/* IV — FIRE: the kiln, flames rolling up round the glowing vessel, sparks lifting */
vec3 fire(vec2 p, float t) {
  float mask;
  float nx;
  float vy;
  vessel(p, 1.0, mask, nx, vy);
  float heat = 0.55 + 0.45 * smoothstep(0.0, 0.5, t) * (1.0 - 0.5 * smoothstep(0.75, 1.0, t));
  vec2 q = vec2(p.x * 1.3, p.y * 0.9 - t * 2.4);
  float n = fbm(q * 2.0 + vec2(0.0, -t * 7.0));
  float n2 = fbm(q * 4.1 + vec2(3.0, -t * 10.0));
  float flame = smoothstep(0.08, 1.05, (n * 0.75 + n2 * 0.5) * 1.3 - (p.y + 0.8) * 0.4) * heat;
  vec3 fc = mix(vec3(0.85, 0.16, 0.03), vec3(1.0, 0.62, 0.12), smoothstep(0.25, 0.7, flame));
  fc = mix(fc, vec3(1.0, 0.95, 0.72), smoothstep(0.72, 1.0, flame));
  vec3 bg = mix(vec3(0.16, 0.05, 0.03), vec3(0.32, 0.10, 0.04), smoothstep(1.0, -1.0, p.y));
  vec3 c = bg + fc * flame * 1.1;
  // sparks
  vec2 sp = vec2(p.x * 9.0, p.y * 5.0 - t * 30.0);
  vec2 cell = floor(sp);
  vec2 fr = fract(sp) - 0.5 - (vec2(hash(cell), hash(cell + 3.1)) - 0.5) * 0.6;
  float spark = smoothstep(0.06, 0.0, length(fr * vec2(1.0, 0.45))) * step(0.82, hash(cell + 7.7));
  c += vec3(1.0, 0.7, 0.3) * spark * (0.6 + 0.6 * smoothstep(-1.0, 0.5, p.y));
  // the vessel: blackbody, white-hot at the belly
  float core = heat * (1.0 - nx * nx) * (0.55 + 0.45 * sin(3.14159 * vy));
  vec3 hot = mix(vec3(0.85, 0.22, 0.06), vec3(1.0, 0.62, 0.22), smoothstep(0.1, 0.55, core));
  hot = mix(hot, vec3(1.0, 0.9, 0.66), smoothstep(0.55, 0.95, core));
  hot *= 0.8 + 0.3 * fbm(p * 6.0 + vec2(0.0, -t * 3.0));
  c = mix(c, hot, mask);
  return lin(c);
}

/* V — ASH: the morning after the firing, ash drifting, the vessel cooled to terracotta */
vec3 ash(vec2 p, float t) {
  vec3 bg = mix(vec3(0.62, 0.66, 0.74), vec3(0.92, 0.86, 0.78), smoothstep(-0.6, 1.0, p.y));
  bg = mix(bg, vec3(0.98, 0.93, 0.84), smoothstep(0.0, 1.0, t) * 0.5);
  // smoke curling up
  vec2 sq = vec2(p.x * 1.4 + 0.3 * sin(p.y * 2.0 + t * 2.0), p.y * 0.8 - t * 0.9);
  float smoke = smoothstep(0.45, 0.85, fbm(sq * 2.2 + fbm(sq * 3.0) * 0.8)) * smoothstep(-0.4, 0.6, p.y) * (1.0 - 0.6 * t);
  vec3 c = mix(bg, vec3(0.46, 0.48, 0.54), smoke * 0.55);
  // the bed of ash
  float bed = -0.62 + 0.05 * fbm(vec2(p.x * 3.0, 1.0));
  float inBed = smoothstep(bed + 0.01, bed - 0.01, p.y);
  vec3 ashC = mix(vec3(0.70, 0.70, 0.70), vec3(0.88, 0.87, 0.84), fbm(p * 14.0));
  c = mix(c, ashC * (0.75 + 0.25 * smoothstep(-1.0, bed, p.y)), inBed);
  // the vessel, cooled: terracotta, deeper at the foot, a little ash on its shoulder
  float mask;
  float nx;
  float vy;
  vessel(p, 1.0, mask, nx, vy);
  float shade = 0.45 + 0.55 * clamp(0.6 - 0.7 * nx + 0.4 * sqrt(1.0 - nx * nx), 0.0, 1.0);
  vec3 tc = mix(vec3(0.52, 0.20, 0.14), vec3(0.84, 0.44, 0.27), smoothstep(0.0, 0.6, vy)) * shade;
  tc = mix(tc, vec3(0.80, 0.78, 0.74), smoothstep(0.75, 0.95, vy) * smoothstep(0.55, 0.8, fbm(p * 18.0)) * 0.6);
  tc *= 0.9 + 0.15 * fbm(p * 10.0);
  c = mix(c, tc, mask);
  // flakes of ash drifting down
  for (int l = 0; l < 2; l++) {
    float fl = float(l);
    vec2 aq = vec2(p.x * (7.0 + fl * 5.0) + sin(p.y * 3.0 + t * 5.0 + fl) * 0.6, p.y * (7.0 + fl * 5.0) + t * (8.0 - fl * 3.0));
    vec2 cell = floor(aq);
    vec2 fr = fract(aq) - 0.5 - (vec2(hash(cell + fl), hash(cell + 5.3)) - 0.5) * 0.7;
    float flake = smoothstep(0.08, 0.0, length(fr)) * step(0.7, hash(cell + 2.2 + fl));
    c = mix(c, vec3(0.97, 0.96, 0.94), flake * (0.7 - fl * 0.25));
  }
  return lin(c);
}

// one return through a result variable: ANGLE's HLSL flags early returns here as possibly uninitialised
vec3 chapter(float i, vec2 p, float t) {
  vec3 c;
  if (i < 0.5) c = earth(p, t);
  else if (i < 1.5) c = water(p, t);
  else if (i < 2.5) c = hand(p, t, 1.0);
  else if (i < 3.5) c = fire(p, t);
  else c = ash(p, t);
  return c;
}

/* a title card from the atlas: row k (0 = top) over the whole frame */
vec4 title(float k) {
  vec2 uv = vec2(vUv.x, (ROWS - 1.0 - k + vUv.y) / ROWS);
  return texture2D(uTitles, uv);
}

void main() {
  vec2 p = vUv * 2.0 - 1.0;
  p.x *= uAspect * 0.5;
  vec3 col;
  float T = 0.0;
  if (uPoster > 0.5) {
    // the poster: the thrown vessel in its pool of light, the title over it
    col = hand(p, 1.0, 0.0) * 0.7;
    vec4 tt = title(NCH);
    col = mix(col, lin(tt.rgb), tt.a);
    T = 10.0;
  } else {
    float total = uChapterSec * NCH;
    T = mod(uTime, total);
    float ch = floor(T / uChapterSec);
    float tc = (T - ch * uChapterSec) / uChapterSec;
    if (uStill > 0.5) tc = 0.72;
    float fade = 1.6 / uChapterSec;
    col = chapter(ch, p, tc);
    float x = smoothstep(1.0 - fade, 1.0, tc) * (uStill > 0.5 ? 0.0 : 1.0);
    if (x > 0.0) {
      vec3 next = ch < NCH - 1.5 ? chapter(ch + 1.0, p, 0.0) : vec3(0.0);
      col = mix(col, next, x);
    }
    // the chapter's title card: in over 1 s from 0.6 s, held, out by 5.5 s (still: always shown small)
    float s = tc * uChapterSec;
    float ta = uStill > 0.5 ? 0.0 : smoothstep(0.6, 1.6, s) * (1.0 - smoothstep(4.2, 5.4, s));
    if (ta > 0.0) {
      vec4 tt = title(ch);
      col = mix(col * (1.0 - 0.25 * ta), lin(tt.rgb), tt.a * ta);
    }
    col *= smoothstep(0.0, 1.2, T);
  }
  // projection: soft vignette, a hint of grain
  float v = smoothstep(1.4, 0.4, length(vec2(p.x / (uAspect * 0.5), p.y)));
  col *= mix(0.8, 1.0, v);
  col += (hash(vUv * 917.0 + uTime) - 0.5) * 0.01;
  // a projector's punch with a soft shoulder (the screen is unlit and not tone-mapped)
  col = max(col, 0.0) * 1.45;
  col = col / (1.0 + 0.22 * col);
  gl_FragColor = vec4(col * uLevel, 1.0);
}
`

let blank: THREE.DataTexture | null = null
/** A 1×1 transparent stand-in for the title atlas. */
function blankTitles() {
  if (!blank) {
    blank = new THREE.DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1)
    blank.needsUpdate = true
  }
  return blank
}

/** The film's shader material (one per theatre); drive `uniforms.uTime` and draw it with a ProjectionTarget. */
export function kilnFilmMaterial(octaves: number, aspect: number, titles: THREE.Texture | null = null): THREE.ShaderMaterial & { uniforms: KilnFilmUniforms } {
  const ox = OXBLOOD.clone().convertSRGBToLinear()
  const uniforms: KilnFilmUniforms = {
    uTime: { value: 0 },
    uChapterSec: { value: 24 },
    uOctaves: { value: octaves },
    uAspect: { value: aspect },
    uStill: { value: 0 },
    uPoster: { value: 0 },
    uLevel: { value: 1 },
    uOxblood: { value: new THREE.Vector3(ox.r, ox.g, ox.b) },
    // never unbound: an unbound sampler reads opaque black, which would blank the picture
    uTitles: { value: titles ?? blankTitles() },
  }
  const m = new THREE.ShaderMaterial({ name: 'kilnFilm', vertexShader: VERT, fragmentShader: KILN_FILM_FRAG, uniforms, depthTest: false, depthWrite: false })
  return m as THREE.ShaderMaterial & { uniforms: KilnFilmUniforms }
}
