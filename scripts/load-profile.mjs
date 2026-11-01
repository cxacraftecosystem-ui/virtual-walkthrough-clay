/**
 * Load and render profile (GRAND §10).
 *
 *   node scripts/load-profile.mjs [baseUrl] [--tiers low,medium,high,ultra] [--poses G07,G25,G14,G19]
 *                                 [--json=out.json] [--load-only] [--swiftshader] [--query "&spectacle=off"]
 *   e.g. node scripts/load-profile.mjs http://localhost:3600 --tiers low,high --json=shots/profile.json
 *
 * For each tier it opens `/gallery?quality=<tier>` with the cache and the service worker
 * bypassed (a first visit) and reports:
 *   • load: phase timings, long main-thread tasks and the bytes on the wire until the entry
 *     screen can be dismissed ("download before Enter"), grouped by asset type;
 *   • per profile pose (GRAND §10 worst views; the poses come from scripts/grand-poses.json):
 *     the bytes streamed while settling there, the draw calls and triangles of the scene pass
 *     (the largest single `renderer.render` of a frame; the median frame is checked, the worst
 *     is listed) and of the whole frame, the shadow-map redraws counted apart (the maps are
 *     frozen and redrawn on demand, so they are not part of the visible set), the lights in
 *     the rendered scene, the shader programs, the GPU texture memory (estimated from the
 *     textures the scene references, with mips) and of that the PBR library's share, and the
 *     median and p90 frame time over 90 frames.
 * Every figure is checked against the tier's §10 budget; the exit code is 1 when any is over.
 * Only the first positional argument is read as the base URL (default http://localhost:3600);
 * the old `[baseUrl] [quality]` form still works.
 */
import fs from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer-core'

const argv = process.argv.slice(2)
const pos = argv.filter((a, i) => !a.startsWith('--') && !(i > 0 && /^--(tiers|poses|query)$/.test(argv[i - 1])))
const opt = (k, def) => {
  const eq = argv.find((a) => a.startsWith(`--${k}=`))
  if (eq) return eq.slice(k.length + 3)
  const i = argv.indexOf(`--${k}`)
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : def
}
const has = (k) => argv.includes(`--${k}`)
const base = (pos[0] ?? 'http://localhost:3600').replace(/\/$/, '')
const TIERS = (opt('tiers', pos[1] ?? 'high') ?? 'high').split(',').filter(Boolean)
const POSES = opt('poses', 'G07,G25,G14,G19').split(',').filter(Boolean)
const QUERY = opt('query', '')
const jsonOut = opt('json', undefined)
const LOAD_ONLY = has('load-only')
const CHROME = [process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable'].find((p) => p && fs.existsSync(p))
const SHOTS = JSON.parse(fs.readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'grand-poses.json'), 'utf-8'))
for (const id of POSES) if (!SHOTS[id]) throw new Error(`unknown pose ${id}`)

const MB = 1048576
/** GRAND §10, per tier. */
const BUDGET = {
  low: { calls: 160, tris: 450e3, lights: 6 + 2, texMB: 16, beforeEnterMB: 18, zoneMB: 6 },
  medium: { calls: 280, tris: 1.0e6, lights: 10 + 2, texMB: 40, beforeEnterMB: 25, zoneMB: 8 },
  high: { calls: 420, tris: 2.0e6, lights: 12 + 2, texMB: 64, beforeEnterMB: 30, zoneMB: 10 },
  ultra: { calls: 520, tris: 3.2e6, lights: 14 + 2, texMB: 96, beforeEnterMB: 30, zoneMB: 10 },
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  protocolTimeout: 900000,
  args: has('swiftshader') ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'],
  defaultViewport: { width: 1600, height: 900 },
})

const kindOf = (url, type) => {
  let p = url
  try {
    p = new URL(url).pathname
  } catch {
    /* data: and blob: */
  }
  if (p.startsWith('/models/sourced/')) return 'sourced'
  if (/\.(glb|gltf|bin)$/i.test(p) || p.startsWith('/models/')) return 'models'
  if (p.startsWith('/textures/pbr/')) return 'pbr'
  if (p.startsWith('/artworks/') || /\/artworks\//.test(p)) return 'artworks'
  if (/\.(mp4|webm|m3u8|ts)$/i.test(p) || type === 'Media') return 'video'
  if (/\.(jpe?g|png|webp|avif|ktx2|hdr|exr)$/i.test(p)) return 'textures'
  if (/\.(mp3|ogg|m4a|wav|opus)$/i.test(p)) return 'audio'
  if (type === 'Script' || /\.m?js$/.test(p)) return 'js'
  if (type === 'Stylesheet') return 'css'
  if (type === 'Font') return 'fonts'
  return 'other'
}

const results = []
let over = 0
const check = (label, value, limit) => {
  const ok = value <= limit
  if (!ok) over++
  return `${label} ${ok ? 'ok' : 'OVER'}`
}

try {
  for (const tier of TIERS) {
    const budget = BUDGET[tier] ?? BUDGET.high
    const page = await browser.newPage()
    await page.setCacheEnabled(false)
    // the museum's service worker answers repeat visits from its own cache (encodedDataLength 0):
    // bypass it, so every tier is measured as a first visit
    await page.setBypassServiceWorker(true)
    const errors = []
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
    page.on('pageerror', (e) => errors.push(e.message))
    const cdp = await page.createCDPSession()
    await cdp.send('Network.enable')
    const reqs = new Map()
    let bytes = {}
    let count = {}
    cdp.on('Network.responseReceived', (e) => reqs.set(e.requestId, kindOf(e.response.url, e.type)))
    cdp.on('Network.loadingFinished', (e) => {
      const k = reqs.get(e.requestId) ?? 'other'
      bytes[k] = (bytes[k] ?? 0) + e.encodedDataLength
      count[k] = (count[k] ?? 0) + 1
    })
    const takeBytes = () => {
      const out = { bytes, count, total: Object.values(bytes).reduce((a, b) => a + b, 0) }
      bytes = {}
      count = {}
      return out
    }
    await page.evaluateOnNewDocument(() => {
      window.__long = []
      new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__long.push([Math.round(e.startTime), Math.round(e.duration)]))).observe({ type: 'longtask', buffered: true })
    })

    // ── load ───────────────────────────────────────────────────────────────────────────
    const t0 = Date.now()
    console.log(`\n${tier}: ${base}/gallery?quality=${tier}${QUERY}`)
    await page.goto(`${base}/gallery?quality=${tier}&noarrival&shots${QUERY}`, { timeout: 300000 })
    let last = ''
    const marks = {}
    for (;;) {
      const ph = await page.evaluate(() => {
        const s = window.__museum?.store.getState()
        return s ? `${s.phase} compiled=${s.sceneCompiled}` : 'boot'
      })
      if (ph !== last) {
        const t = (Date.now() - t0) / 1000
        console.log(`  ${t.toFixed(1)} s  phase=${ph}`)
        if (ph.startsWith('ready') && marks.ready === undefined) marks.ready = t
        if (ph.includes('compiled=true') && marks.compiled === undefined) marks.compiled = t
        last = ph
      }
      const since = (Date.now() - t0) / 1000
      if ((marks.ready !== undefined && (marks.compiled !== undefined || since - marks.ready > 20)) || since > 180) break
      await sleep(100)
    }
    await page.waitForNetworkIdle({ idleTime: 1000, timeout: 30000 }).catch(() => undefined)
    const long = await page.evaluate(() => window.__long)
    const load = takeBytes()
    console.log(`  long tasks > 200 ms: ${JSON.stringify(long.filter((l) => l[1] > 200))}, total long-task ms ${long.reduce((a, l) => a + l[1], 0)}`)
    console.log('  download before Enter, by type:')
    for (const [k, v] of Object.entries(load.bytes).sort((a, b) => b[1] - a[1])) console.log(`    ${k.padEnd(9)} ${(v / MB).toFixed(2).padStart(7)} MB  (${load.count[k]} requests)`)
    console.log(`    total     ${(load.total / MB).toFixed(2).padStart(7)} MB  ${check(`≤ ${budget.beforeEnterMB} MB`, load.total / MB, budget.beforeEnterMB)}`)
    const result = { tier, firstLoadSec: marks, longTaskMs: long.reduce((a, l) => a + l[1], 0), beforeEnter: load, poses: [] }
    results.push(result)
    if (LOAD_ONLY) {
      await page.close()
      continue
    }

    // ── enter, then profile each pose ──────────────────────────────────────────────────
    await page.evaluate(() => {
      const s = window.__museum.store.getState()
      if (s.phase !== 'entered') (s.enter ?? s.setPhase)?.call(s, 'entered')
    })
    await page.waitForFunction(() => window.__museum?.store.getState().phase === 'entered', { timeout: 240000 }).catch(async () => {
      // the entry screen's button: the store hook names differ between builds
      await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => /enter|begin|start/i.test(b.textContent ?? ''))?.click())
      await page.waitForFunction(() => window.__museum?.store.getState().phase === 'entered', { timeout: 240000 })
    })
    await page.evaluate(() => {
      // wrap the renderer: per frame, the scene pass (largest render call) and the frame sum.
      // Draws into a shadow map (depth / distance materials) are counted apart: the shadow maps
      // are frozen and redrawn on demand, so they are not part of the visible set.
      const gl = window.__museum.gl
      const raw = gl.render.bind(gl)
      const rawDraw = gl.renderBufferDirect.bind(gl)
      const f = { calls: 0, tris: 0, maxCalls: 0, maxTris: 0, shadowCalls: 0, shadowTris: 0, scene: null, pass: null }
      window.__frame = f
      gl.renderBufferDirect = (camera, scene, geometry, material, object, group) => {
        const p = f.pass
        if (p) {
          const idx = geometry.index ? geometry.index.count : (geometry.attributes.position?.count ?? 0)
          const n = Math.min(group ? group.count : idx, idx) * (object.isInstancedMesh ? object.count : 1)
          const tris = object.isMesh ? n / 3 : 0
          if (material.isMeshDepthMaterial || material.isMeshDistanceMaterial) {
            f.shadowCalls++
            f.shadowTris += tris
          } else {
            p.calls++
            p.tris += tris
          }
        }
        return rawDraw(camera, scene, geometry, material, object, group)
      }
      gl.render = (scene, camera) => {
        const p = (f.pass = { calls: 0, tris: 0 })
        raw(scene, camera)
        f.pass = null
        f.calls += p.calls
        f.tris += p.tris
        if (p.calls > f.maxCalls) {
          f.maxCalls = p.calls
          f.maxTris = p.tris
          f.scene = scene
        }
      }
    })
    takeBytes()
    for (const id of POSES) {
      const s = SHOTS[id]
      await page.waitForFunction(() => window.__museum?.store.getState().sceneCompiled, { timeout: 300000 })
      await page.evaluate((shot) => {
        const m = window.__museum
        const st = m.store.getState()
        st.setMapOpen?.(false)
        st.setTimeOfDay?.(shot.time ?? 'midday')
        st.setWeather?.(shot.weather ?? 'clear')
        st.setFestival?.(shot.festival ?? 'off')
        m.unview?.()
        if (shot.perch && m.perch) return m.perch(shot.perch[0], shot.perch[1])
        m.leavePerch?.()
        if (shot.view && m.view) return m.view(...shot.view)
        m.teleport(shot.pose[0], shot.pose[1], shot.pose[2], shot.pose[3])
      }, s)
      await sleep(s.festival === 'on' ? 12000 : 4000)
      await page.waitForFunction(() => !window.__atmos || !window.__atmos.sunState.moving, { timeout: 30000, polling: 200 }).catch(() => undefined)
      await page.waitForNetworkIdle({ idleTime: 1000, timeout: 30000 }).catch(() => undefined)
      const streamed = takeBytes()
      const r = await page.evaluate(async () => {
        const f = window.__frame
        const frames = []
        const times = []
        let lastT = performance.now()
        await new Promise((done) => {
          const tick = () => {
            const t = performance.now()
            times.push(t - lastT)
            lastT = t
            frames.push({ calls: f.calls, tris: f.tris, maxCalls: f.maxCalls, maxTris: f.maxTris, shadowCalls: f.shadowCalls, shadowTris: f.shadowTris })
            f.calls = f.tris = f.maxCalls = f.maxTris = f.shadowCalls = f.shadowTris = 0
            if (times.length < 91) requestAnimationFrame(tick)
            else done()
          }
          f.calls = f.tris = f.maxCalls = f.maxTris = f.shadowCalls = f.shadowTris = 0
          requestAnimationFrame(tick)
        })
        times.shift()
        frames.shift()
        times.sort((a, b) => a - b)
        const maxOf = (k) => Math.max(...frames.map((x) => x[k]))
        const medOf = (k) => frames.map((x) => x[k]).sort((a, b) => a - b)[Math.floor(frames.length / 2)]
        const shadowFrames = frames.filter((x) => x.shadowCalls > 0).length
        // lights and textures of the scene pass
        const scene = f.scene
        let lights = 0
        let shadowLights = 0
        const tex = new Map()
        const addTex = (t) => {
          // clones (a set at another repeat) share one GPU texture through their Source
          const key = t?.source?.uuid ?? t?.uuid
          if (!t || !t.isTexture || tex.has(key)) return
          const img = t.image
          const w = img?.width ?? img?.data?.width ?? 0
          const h = img?.height ?? img?.data?.height ?? 0
          const src = img?.currentSrc ?? img?.src ?? t.userData?.url ?? t.name ?? ''
          const bpp = t.isDataTexture && t.type !== 1009 ? 8 : 4
          tex.set(key, { bytes: w * h * bpp * (t.generateMipmaps === false ? 1 : 4 / 3), src: String(src) })
        }
        scene?.traverseVisible((o) => {
          if (o.isLight && o.intensity > 0) {
            lights++
            if (o.castShadow) shadowLights++
          }
          const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : []
          for (const m of mats) {
            for (const v of Object.values(m)) addTex(v)
            if (m.uniforms) for (const u of Object.values(m.uniforms)) addTex(u?.value)
          }
        })
        const texBytes = [...tex.values()].reduce((a, t) => a + t.bytes, 0)
        const pbrBytes = [...tex.values()].filter((t) => /textures\/pbr\//.test(t.src)).reduce((a, t) => a + t.bytes, 0)
        const gl = window.__museum.gl
        return {
          zone: `${window.__museum.visitor.x.toFixed(1)},${window.__museum.visitor.z.toFixed(1)}`,
          medianMs: times[Math.floor(times.length / 2)],
          p90Ms: times[Math.floor(times.length * 0.9)],
          sceneCalls: medOf('maxCalls'),
          sceneTris: medOf('maxTris'),
          sceneCallsMax: maxOf('maxCalls'),
          sceneTrisMax: maxOf('maxTris'),
          shadowCallsMax: maxOf('shadowCalls'),
          shadowTrisMax: maxOf('shadowTris'),
          shadowFrames,
          frameCalls: maxOf('calls'),
          frameTris: maxOf('tris'),
          lights,
          shadowLights,
          programs: gl.info.programs?.length ?? null,
          textures: tex.size,
          texMB: texBytes / 1048576,
          pbrMB: pbrBytes / 1048576,
        }
      })
      const zoneMB = streamed.total / MB
      const verdict = [
        check(`calls ≤ ${budget.calls}`, r.sceneCalls, budget.calls),
        check(`tris ≤ ${budget.tris / 1e3}k`, r.sceneTris, budget.tris),
        check(`lights ≤ ${budget.lights}`, r.lights, budget.lights),
        check(`PBR tex ≤ ${budget.texMB} MB`, r.pbrMB, budget.texMB),
        check(`streamed ≤ ${budget.zoneMB} MB`, zoneMB, budget.zoneMB),
      ]
      console.log(
        `  ${id.padEnd(4)} ${s.name.padEnd(12)} at ${String(r.zone).padEnd(12)} ${r.medianMs.toFixed(1)} ms (p90 ${r.p90Ms.toFixed(1)})  ` +
          `scene ${r.sceneCalls} calls / ${(r.sceneTris / 1e3).toFixed(0)}k tris (worst ${r.sceneCallsMax} / ${(r.sceneTrisMax / 1e3).toFixed(0)}k), frame ${r.frameCalls} / ${(r.frameTris / 1e3).toFixed(0)}k  ` +
          `shadow redraw ${r.shadowCallsMax} / ${(r.shadowTrisMax / 1e3).toFixed(0)}k in ${r.shadowFrames} of 90 frames  ` +
          `lights ${r.lights} (${r.shadowLights} shadowed)  programs ${r.programs}  tex ${r.texMB.toFixed(1)} MB (PBR ${r.pbrMB.toFixed(1)})  ` +
          `streamed ${zoneMB.toFixed(2)} MB\n        ${verdict.join(', ')}`,
      )
      result.poses.push({ id, name: s.name, ...r, streamed })
    }
    result.consoleErrors = errors
    console.log(`  console errors: ${errors.length}`)
    for (const e of errors.slice(0, 20)) console.log('    ', e.slice(0, 300))
    await page.close()
  }
} finally {
  await browser.close()
}
if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify({ base, at: new Date().toISOString(), results }, null, 2) + '\n')
if (over) {
  console.log(`\n${over} figure(s) over the §10 budget`)
  process.exit(1)
}
console.log('\nall figures within the §10 budgets')
