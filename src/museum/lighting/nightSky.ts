/**
 * Dusk & night extension of the Preetham sky (three.js Sky): a blue-hour gradient with a warm
 * afterglow band toward the set sun, and a night sky with a moon disc + halo and a procedural,
 * gently twinkling starfield. Pure uniforms — switching time of day never recompiles.
 *
 * Applied to the Sky material in SkyAndSun (patchNightSky); driven each frame by
 * <TimeOfDayController> through `nightSkyUniforms`.
 */
import * as THREE from 'three'

export interface NightSkyUniforms {
  nightMix: { value: number }
  twilightMix: { value: number }
  /** Pastel sunset wash at a low sun (0 … 1). */
  sunsetMix: { value: number }
  moonDir: { value: THREE.Vector3 }
  duskSunDir: { value: THREE.Vector3 }
  /** Monsoon cloud deck (0 … 1) and its one soft brightening (0 … 1). */
  overcastMix: { value: number }
  stormFlash: { value: number }
}

/** Uniform objects of every patched sky material (normally exactly one). */
export const nightSkyUniforms = new Set<NightSkyUniforms>()

const DECLS = /* glsl */ `
uniform float nightMix;
uniform float twilightMix;
uniform float sunsetMix;
uniform vec3 moonDir;
uniform vec3 duskSunDir;
uniform float overcastMix;
uniform float stormFlash;

float mHash( vec3 p ) {
  p = fract( p * 0.3183099 + 0.1 );
  p *= 17.0;
  return fract( p.x * p.y * p.z * ( p.x + p.y + p.z ) );
}

vec3 museumStars( vec3 dir ) {
  vec3 acc = vec3( 0.0 );
  for ( int l = 0; l < 2; l ++ ) {
    float scale = l == 0 ? 170.0 : 380.0;
    float thresh = l == 0 ? 0.975 : 0.985;
    vec3 p = dir * scale;
    vec3 cell = floor( p );
    float h = mHash( cell + float( l ) * 37.0 );
    if ( h > thresh ) {
      vec3 j = vec3( mHash( cell + 1.7 ), mHash( cell + 4.1 ), mHash( cell + 9.3 ) );
      vec3 c = cell + 0.2 + 0.6 * j;
      float d = length( p - c );
      float b = ( h - thresh ) / ( 1.0 - thresh );
      float tw = 0.7 + 0.3 * sin( time * ( 1.3 + 2.6 * j.x ) + j.y * 40.0 );
      vec3 tint = mix( vec3( 0.72, 0.82, 1.0 ), vec3( 1.0, 0.88, 0.72 ), j.z );
      acc += tint * exp( - d * d * 14.0 ) * ( 0.2 + 1.8 * b * b ) * tw;
    }
  }
  return acc;
}

vec3 museumStorm( vec3 sky, vec3 dir ) {
  if ( overcastMix <= 0.0 ) return sky;
  // monsoon deck: a low, heavy grey with a lighter belly toward the horizon, slowly rolling
  float h = max( dir.y, 0.0 );
  vec2 p = dir.xz / max( dir.y + 0.12, 0.05 ) * 0.6 + vec2( time * 0.018, time * 0.007 );
  float roll = 0.5 + 0.5 * sin( p.x * 1.7 + sin( p.y * 2.3 ) * 1.4 ) * sin( p.y * 1.3 - p.x * 0.6 );
  vec3 deck = mix( vec3( 0.33, 0.34, 0.36 ), vec3( 0.16, 0.17, 0.2 ), pow( h, 0.55 ) ) * ( 0.85 + 0.3 * roll );
  deck *= ( 1.0 - 0.94 * nightMix ) * ( 1.0 - 0.55 * twilightMix ) * ( 1.0 + 1.6 * stormFlash );
  return mix( sky, deck, overcastMix );
}

// golden hour: keep the scattered sky's brightness, give it a sunset's pastel colours — peach and
// rose toward the low sun and the horizon, a soft lilac overhead (what the oculus frames)
vec3 museumSunset( vec3 base, vec3 dir ) {
  if ( sunsetMix <= 0.0 ) return base;
  float h = max( dir.y, 0.0 );
  vec2 dd = normalize( dir.xz + vec2( 1e-5 ) );
  float toward = max( dot( normalize( duskSunDir.xz + vec2( 1e-5 ) ), dd ), 0.0 );
  float lum = dot( base, vec3( 0.2126, 0.7152, 0.0722 ) );
  vec3 peach = vec3( 1.32, 0.86, 0.6 );
  vec3 rose = vec3( 1.18, 0.78, 0.86 );
  vec3 lilac = vec3( 0.86, 0.8, 1.22 );
  vec3 hue = mix( mix( peach, rose, smoothstep( 0.0, 0.35, h ) ), lilac, smoothstep( 0.2, 0.85, h ) );
  hue = mix( hue, peach * 1.15, pow( toward, 4.0 ) * exp( - h * 3.0 ) );
  // a touch brighter where the zenith would go dark blue
  vec3 tinted = hue * max( lum, 0.0 ) * ( 1.0 + 0.35 * h );
  return mix( base, tinted, sunsetMix );
}

vec3 museumTwilight( vec3 base, vec3 dir ) {
  base = museumSunset( base, dir );
  if ( twilightMix <= 0.0 && nightMix <= 0.0 ) return museumStorm( base, dir );
  float h = max( dir.y, 0.0 );
  vec2 dd = normalize( dir.xz + vec2( 1e-5 ) );

  // blue hour: deep indigo zenith, lilac horizon, warm afterglow toward the set sun
  vec3 tw = mix( vec3( 0.075, 0.075, 0.13 ), vec3( 0.012, 0.026, 0.085 ), pow( h, 0.42 ) );
  float toward = max( dot( normalize( duskSunDir.xz + vec2( 1e-5 ) ), dd ), 0.0 );
  tw += vec3( 0.34, 0.13, 0.045 ) * pow( toward, 3.0 ) * exp( - h * 10.0 );
  tw += vec3( 0.05, 0.03, 0.06 ) * exp( - h * 5.0 );

  // night: near-black blue, moon disc + halo, stars
  vec3 ng = mix( vec3( 0.007, 0.010, 0.020 ), vec3( 0.0012, 0.0022, 0.0068 ), pow( h, 0.5 ) );
  float md = dot( dir, normalize( moonDir ) );
  ng += vec3( 0.030, 0.040, 0.065 ) * pow( max( md, 0.0 ), 28.0 );
  ng += vec3( 0.92, 0.94, 1.0 ) * 2.4 * smoothstep( 0.99984, 0.99991, md );
  ng += museumStars( dir ) * smoothstep( 0.02, 0.22, dir.y ) * 0.32;

  vec3 sky = mix( base, tw, twilightMix );
  return museumStorm( mix( sky, ng, nightMix ), dir );
}
`

/** Add the dusk/night terms to a (possibly already patched) three.js Sky material. Idempotent. */
export function patchNightSky(mat: THREE.ShaderMaterial) {
  if ((mat.uniforms as Record<string, unknown>).nightMix) return
  const u: NightSkyUniforms = {
    nightMix: { value: 0 },
    twilightMix: { value: 0 },
    sunsetMix: { value: 0 },
    moonDir: { value: new THREE.Vector3(0.4, 0.7, 0.5).normalize() },
    duskSunDir: { value: new THREE.Vector3(-1, 0, 0) },
    overcastMix: { value: 0 },
    stormFlash: { value: 0 },
  }
  Object.assign(mat.uniforms, u)
  const anchor = 'vec3 texColor = ( Lin + L0 ) * 0.04 + sundiscColor + vec3( 0.0, 0.0003, 0.00075 );'
  if (!mat.fragmentShader.includes(anchor) || !mat.fragmentShader.includes('uniform float time;')) {
    console.warn('[museum] sky shader layout changed; dusk/night sky disabled')
    return
  }
  mat.fragmentShader = mat.fragmentShader
    .replace('uniform float time;', `uniform float time;\n${DECLS}`)
    .replace(anchor, `${anchor}\n\t\t\ttexColor = museumTwilight( texColor, direction );`)
  mat.needsUpdate = true
  nightSkyUniforms.add(u)
}
