/**
 * TRIPLANAR (GRAND §6.1): organic meshes (eroded formations, scans with no usable UVs, raw-clay
 * fields, boulders) sample the library's maps by world position instead of UVs, so a texture
 * never stretches over a lathe's poles or a scan's broken charts.
 *
 * `makeTriplanar(material, metresPerTile)` patches a MeshStandardMaterial in place: its map,
 * roughness map (green), AO map (red) and normal map are read from three world-aligned
 * projections blended by the surface normal (normals by Ben Golus' "whiteout" blend). The
 * material keeps every map slot it had, so it shares a program with no other material only
 * through its cache key. Works with instancing; chains any onBeforeCompile already set (the
 * atmosphere injection).
 */
import * as THREE from 'three'

const VERT_HEAD = /* glsl */ `
varying vec3 vTriP;
varying vec3 vTriN;
`

const FRAG_HEAD = /* glsl */ `
uniform float uTriScale;
varying vec3 vTriP;
varying vec3 vTriN;
vec3 triWeights() {
  vec3 w = pow(abs(normalize(vTriN)), vec3(4.0));
  return w / max(dot(w, vec3(1.0)), 1e-4);
}
vec4 triSample(sampler2D t) {
  vec3 w = triWeights();
  vec3 p = vTriP * uTriScale;
  return texture2D(t, p.zy) * w.x + texture2D(t, p.xz) * w.y + texture2D(t, p.xy) * w.z;
}
`

/** Patch `mat` to sample its maps triplanar at `tile` metres per repeat. Returns the same material. */
export function makeTriplanar<T extends THREE.MeshStandardMaterial>(mat: T, tile: number): T {
  const prev = mat.onBeforeCompile
  const prevKey = mat.customProgramCacheKey.bind(mat)
  mat.onBeforeCompile = (shader, renderer) => {
    prev.call(mat, shader, renderer)
    shader.uniforms.uTriScale = { value: 1 / tile }
    shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>\n${VERT_HEAD}`).replace(
      '#include <project_vertex>',
      `#include <project_vertex>
{
  vec4 triWP = vec4(transformed, 1.0);
  vec3 triN = objectNormal;
  #ifdef USE_INSTANCING
    triWP = instanceMatrix * triWP;
    triN = mat3(instanceMatrix) * triN;
  #endif
  triWP = modelMatrix * triWP;
  vTriP = triWP.xyz;
  vTriN = normalize(mat3(modelMatrix) * triN);
}`,
    )
    let f = shader.fragmentShader.replace('#include <common>', `#include <common>\n${FRAG_HEAD}`)
    f = f.replace(
      '#include <map_fragment>',
      `#ifdef USE_MAP
  diffuseColor *= triSample(map);
#endif`,
    )
    f = f.replace(
      '#include <roughnessmap_fragment>',
      `float roughnessFactor = roughness;
#ifdef USE_ROUGHNESSMAP
  roughnessFactor *= triSample(roughnessMap).g;
#endif`,
    )
    f = f.replace(
      '#include <aomap_fragment>',
      `#ifdef USE_AOMAP
  float ambientOcclusion = (triSample(aoMap).r - 1.0) * aoMapIntensity + 1.0;
  reflectedLight.indirectDiffuse *= ambientOcclusion;
  #if defined( USE_CLEARCOAT )
    clearcoatSpecularIndirect *= ambientOcclusion;
  #endif
  #if defined( USE_ENVMAP ) && defined( STANDARD )
    float dotNV = saturate( dot( geometryNormal, geometryViewDir ) );
    reflectedLight.indirectSpecular *= computeSpecularOcclusion( dotNV, ambientOcclusion, material.roughness );
  #endif
#endif`,
    )
    f = f.replace(
      '#include <normal_fragment_maps>',
      `#ifdef USE_NORMALMAP
{
  vec3 w = triWeights();
  vec3 n = normalize(vTriN);
  vec3 p = vTriP * uTriScale;
  vec3 tx = texture2D(normalMap, p.zy).xyz * 2.0 - 1.0;
  vec3 ty = texture2D(normalMap, p.xz).xyz * 2.0 - 1.0;
  vec3 tz = texture2D(normalMap, p.xy).xyz * 2.0 - 1.0;
  tx.xy *= normalScale; ty.xy *= normalScale; tz.xy *= normalScale;
  tx = vec3(tx.xy + n.zy, abs(tx.z) * n.x);
  ty = vec3(ty.xy + n.xz, abs(ty.z) * n.y);
  tz = vec3(tz.xy + n.xy, abs(tz.z) * n.z);
  vec3 wn = normalize(tx.zyx * w.x + ty.xzy * w.y + tz.xyz * w.z);
  normal = normalize((viewMatrix * vec4(wn, 0.0)).xyz);
  #ifdef DOUBLE_SIDED
    normal *= faceDirection;
  #endif
}
#endif`,
    )
    shader.fragmentShader = f
  }
  mat.customProgramCacheKey = () => `${prevKey()}|triplanar`
  mat.needsUpdate = true
  return mat
}
