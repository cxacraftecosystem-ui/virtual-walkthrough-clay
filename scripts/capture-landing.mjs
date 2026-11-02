/**
 * LANDING-PAGE IMAGERY — captures every picture the landing page (/, app/page.tsx) uses,
 * straight from the running clay pavilion, so the page always shows the real thing.
 *
 *   node scripts/capture-landing.mjs [baseUrl] [quality]          (all shots + hero film)
 *        baseUrl default https://clay-traditions.vercel.app  ·  quality default high
 *   ONLY=hero,f-tour node scripts/capture-landing.mjs              (just these names; the film is "hero-video")
 *   SKIP_VIDEO=1 node scripts/capture-landing.mjs                  (stills only)
 *   CHROME=<path to chrome.exe>                                     (default: Chrome stable)
 *
 * Writes public/brand/landing/ — exactly the names app/page.tsx asks for:
 *   hero.jpg                       full-bleed hero still: the court under the oculus at golden hour
 *   hero.webm · hero-film.jpg      a 9 s muted glide towards the lotus under the oculus (VP9 WebM,
 *                                  ≤ 6 MB, ping-pong so it loops) and its first frame (the poster)
 *   <space>.jpg                    the fifteen "Explore the spaces" cards (canvas only, UI hidden)
 *   f-<feature>.jpg                "The experience" tiles, f-walk and f-hindi (staged, UI visible)
 * and rewrites app/landing/captured.json with the files that exist (any name it does not list
 * renders as the page's quiet placeholder).
 *
 * Poses come from the pavilion's own config wherever it has one: the guided-tour stops
 * (config/tour.ts, via __tour.stops), the Frames of Clay presets (photo-spot objects,
 * config/spectacleObjects/experience.ts, via __photo.applyFrame) and the perches
 * (__museum.perch); the rest are the acceptance poses of scripts/grand-poses.json.
 * The gallery is opened with `?shots` (no banners, prompts or toasts) and `noarrival`.
 * Each shot is independent: one that fails to stage is logged and skipped. Re-run any time.
 */
import fs from 'node:fs'
import path from 'node:path'
import puppeteer from 'puppeteer-core'

const base = (process.argv[2] ?? 'https://clay-traditions.vercel.app').replace(/\/+$/, '')
const quality = process.argv[3] ?? 'high'
const only = (process.env.ONLY ?? '').split(',').filter(Boolean)
const want = (name) => only.length === 0 || only.includes(name)
const out = path.resolve('public/brand/landing')
fs.mkdirSync(out, { recursive: true })

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: 'new',
  args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required', '--mute-audio'],
  protocolTimeout: 900_000,
})
const page = await browser.newPage()
page.on('pageerror', (e) => console.warn('  [page error]', String(e).slice(0, 160)))
await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 })
// English UI, full motion, an empty passport.
await page.evaluateOnNewDocument(() => {
  try {
    localStorage.setItem('museum.lang', 'en')
    localStorage.removeItem('museum.a11y')
    // the passport tile hands its staged stamps over a reload through sessionStorage
    const staged = sessionStorage.getItem('capture.passport')
    if (staged) localStorage.setItem('clay.passport.v1', staged)
    else localStorage.removeItem('clay.passport.v1')
  } catch {}
})
const enter = async () => {
  await page.waitForFunction(() => window.__museum?.store.getState().phase === 'entered', { timeout: 300_000, polling: 500 })
  await page.waitForFunction(() => window.__museum?.store.getState().sceneCompiled !== false, { timeout: 300_000, polling: 500 })
  await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' })
  await sleep(6000)
}
console.log('loading pavilion…')
await page.goto(`${base}/gallery?autostart&noarrival&shots&quality=${quality}&noanalytics&nolive&lang=en`, { waitUntil: 'domcontentloaded', timeout: 300_000 })
await enter()

/* ------------------------------------------------------------------ helpers */

const HIDE_UI_CSS =
  'nextjs-portal { display: none !important; } #root > *:not(.museum-canvas), body > *:not(#root) { visibility: hidden !important; } .museum-canvas, .museum-canvas * { visibility: visible !important; }'
let uiHidden = false
async function applyUi() {
  await page.evaluate(
    (hide, css) => {
      let el = document.getElementById('capture-hide-ui')
      if (hide && !el) {
        el = document.createElement('style')
        el.id = 'capture-hide-ui'
        el.textContent = css
        document.head.appendChild(el)
      } else if (!hide && el) el.remove()
    },
    uiHidden,
    HIDE_UI_CSS,
  )
}
async function ui(visible) {
  uiHidden = !visible
  await applyUi()
}

/** If the page reloaded (e.g. dev HMR), wait until the pavilion is back. */
async function ensureMuseum() {
  const ok = await page.evaluate(() => window.__museum?.store.getState().phase === 'entered').catch(() => false)
  if (ok) return
  console.log('  (pavilion reloaded — waiting for it to re-enter)')
  await enter()
}

/** Put the pavilion back to a neutral state between shots. */
async function reset() {
  await ensureMuseum()
  await page.evaluate(() => {
    const m = window.__museum
    const s = m.store.getState()
    window.__tour?.tour.exit()
    window.__photo?.exitPhotoMode?.()
    m.unview?.()
    m.leavePerch?.()
    s.select(null)
    s.inspect(null)
    s.setHelpOpen(false)
    s.setDrawer?.(null)
    s.setHovered?.(null)
    s.setNearby?.(null)
    s.setMapOpen(false)
    s.setFestival?.('off')
    s.setWeather?.('clear')
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
  })
  await page.mouse.move(2, 2)
  await sleep(700)
}

/** Time of day; waits until the day clock has stopped easing. */
async function tod(t) {
  await page.evaluate((x) => window.__museum.store.getState().setTimeOfDay(x), t)
  await sleep(400)
  await page.waitForFunction(() => !window.__atmos || !window.__atmos.sunState.moving, { timeout: 30000, polling: 200 }).catch(() => console.log('  (sun still moving)'))
}
/** Standing at eye height: plan x, z, compass yaw, pitch (deg). */
async function go(x, z, yaw, pitch = 0) {
  await page.evaluate((a) => window.__museum.teleport(a[0], a[1], a[2], a[3]), [x, z, yaw, pitch])
}
/** A free camera (x, y, z, yaw, pitch, fov?) — every zone is drawn while it is held. */
async function cam(v) {
  await page.evaluate((a) => window.__museum.view(...a), v)
}
async function tourView(id) {
  const v = await page.evaluate((sid) => window.__tour?.stops.find((s) => s.id === sid)?.view ?? null, id)
  if (!v) throw new Error(`no tour stop "${id}"`)
  return v
}
/** A standing point on the drum's polar grid (r, plan angle) facing another: [x, z, compass yaw]. */
function polarLook(r, aDeg, tr, taDeg) {
  const P = (rr, a) => [rr * Math.cos((a * Math.PI) / 180), rr * Math.sin((a * Math.PI) / 180)]
  const [x, z] = P(r, aDeg)
  const [tx, tz] = P(tr, taDeg)
  return [x, z, ((Math.atan2(tx - x, -(tz - z)) * 180) / Math.PI + 360) % 360]
}
/** Stand at a guided-tour stop's viewpoint (keeps shots in sync with the tour config). */
async function goStop(id) {
  const v = await tourView(id)
  await go(v.x, v.z, v.yawDeg, v.pitchDeg ?? 0)
}
/** A Frames of Clay preset (photo mode: its standing point, view, field of view and time). */
async function goFrame(id) {
  const ok = await page.evaluate((fid) => {
    if (!window.__photo?.photoFrames().some((f) => f.id === fid)) return false
    window.__photo.applyFrame(fid)
    return true
  }, `frame-${id}`)
  if (!ok) throw new Error(`no photo frame "${id}"`)
}
async function perch(id, t) {
  const ok = await page.evaluate((a) => (window.__museum.perch ? (window.__museum.perch(a[0], a[1]), true) : false), [id, t])
  if (!ok) throw new Error('no __museum.perch')
}
async function view(w, h, dpr = 1) {
  await page.setViewport({ width: w, height: h, deviceScaleFactor: dpr })
}
/** Two frames drawn and a beat for the streamed textures. */
async function settle(ms) {
  await sleep(ms)
  await page.waitForFunction(() => window.__museum?.store.getState().sceneCompiled !== false, { timeout: 120000, polling: 300 }).catch(() => {})
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 300)))))
}
async function snap(name, q = 84) {
  await ensureMuseum()
  await applyUi()
  const broken = await page.evaluate(() => [...document.querySelectorAll('nextjs-portal')].some((p) => /Build Error|Runtime Error|Unhandled/i.test(p.shadowRoot?.textContent ?? '')))
  if (broken) throw new Error('Next.js error overlay is showing (dev build broken) — not saving')
  const file = path.join(out, `${name}.jpg`)
  // A flat frame (canvas not drawn yet, e.g. right after a resize) compresses to almost nothing.
  const vp = page.viewport()
  const minBytes = Math.round(vp.width * vp.height * (vp.deviceScaleFactor ?? 1) ** 2 * 0.014)
  for (let attempt = 1; ; attempt++) {
    const buf = await page.screenshot({ type: 'jpeg', quality: q })
    if (buf.length >= minBytes || attempt >= 5) {
      if (buf.length < minBytes) throw new Error(`frame still looks blank after ${attempt} tries (${buf.length} bytes) — not saving`)
      fs.writeFileSync(file, buf)
      break
    }
    await sleep(3000)
  }
  console.log('  saved', path.relative(process.cwd(), file), `${Math.round(fs.statSync(file).size / 1024)} KB`)
}
async function click(selector, textIncludes) {
  const ok = await page.evaluate(
    (sel, txt) => {
      const el = [...document.querySelectorAll(sel)].find((e) => !txt || (e.textContent ?? '').includes(txt))
      if (!el) return false
      el.click()
      return true
    },
    selector,
    textIncludes ?? null,
  )
  if (!ok) throw new Error(`nothing to click: ${selector}${textIncludes ? ` "${textIncludes}"` : ''}`)
}
async function waitFor(fn, arg, ms = 20000) {
  await page.waitForFunction(fn, { timeout: ms, polling: 200 }, arg)
}
async function setLang(label) {
  await click('.ui-lang .ui-icon-btn')
  await sleep(400)
  await click('.ui-lang .ui-quality__opt', label)
  await sleep(800)
}

const failures = []
async function shot(name, fn) {
  if (!want(name)) return
  console.log(name)
  try {
    await reset()
    await fn()
  } catch (e) {
    failures.push(name)
    console.warn(`  SKIPPED ${name}: ${String(e?.message ?? e).split('\n')[0]}`)
  }
}

/* ------------------------------------------------------------------ hero */

// The court under the oculus at golden hour: the lotus on its still pool, the circle of sky
// and the coffered dome above, the galleries' red wall round it (the hero alt text says so).
const HERO = { view: [0, 1.4, 10.4, 0, 8, 56], tod: 'golden' }
await shot('hero', async () => {
  await ui(false)
  await view(1920, 1080, 1.334)
  await tod(HERO.tod)
  await cam(HERO.view)
  await settle(5000)
  await snap('hero', 82)
})

/* ------------------------------------------------------------------ spaces (canvas only) */

// name → how to stand there: { tour } a guided-tour stop · { frame } a Frames of Clay preset ·
// { pose } [x, z, yaw, pitch] at eye height · { view } a free camera · { perch } [id, t].
const SPACES = [
  ['forecourt', { view: [-12, 2.2, 56, 22, 5, 58] }, 'golden'],
  ['annex', { tour: 'earth-room' }, 'midday'],
  ['entry', { pose: [-1.6, 22.8, 34, 4] }, 'midday'],
  ['oculus', { frame: 'dome-eye' }, 'midday'],
  ['gallery-a', { frame: 'herd' }, 'midday'],
  ['gallery-b', { tour: 'gallery-b' }, 'midday'],
  ['gallery-c', { tour: 'gallery-c' }, 'midday'],
  ['balcony', { perch: ['duplex', 0.5] }, 'midday'],
  ['hallway', { frame: 'wine-hall' }, 'midday'],
  ['parikrama', { frame: 'serpentine' }, 'golden'],
  ['atlas', { frame: 'atlas' }, 'midday'],
  ['theatre', { tour: 'theatre' }, 'midday'],
  ['library', { frame: 'red-room' }, 'midday'],
  ['haat', { tour: 'haat' }, 'midday'],
  ['sphere-well', { perch: ['sphere-well', 1] }, 'midday'],
]
async function stand(v) {
  if (v.tour) await goStop(v.tour)
  else if (v.frame) await goFrame(v.frame)
  else if (v.pose) await go(...v.pose)
  else if (v.view) await cam(v.view)
  else if (v.perch) await perch(...v.perch)
}
for (const [name, v, t] of SPACES) {
  await shot(name, async () => {
    await ui(false)
    await view(1280, 800)
    await tod(t)
    await stand(v)
    // a frame sets its own time of day; the theatre's film needs a moment to come up
    if (v.frame) await tod(t)
    await settle(name === 'theatre' ? 9000 : 4500)
    await snap(name)
  })
}

/* ------------------------------------------------------------------ features (UI visible) */

const FEATURE_W = 1440
const FEATURE_H = 900

// Walking Gallery A with the floor plan open: past the Herd, towards the entry ways.
await shot('f-walk', async () => {
  await ui(true)
  await view(FEATURE_W, FEATURE_H)
  await tod('midday')
  await go(...polarLook(9.6, -14, 15, 22), 3)
  await page.evaluate(() => window.__museum.store.getState().setMapOpen(true))
  await settle(4000)
  await snap('f-walk')
})

// The guided tour at the lotus under the oculus, its caption card up.
await shot('f-tour', async () => {
  await ui(true)
  await view(FEATURE_W, FEATURE_H)
  await tod('midday')
  const idx = await page.evaluate(() => window.__tour.stops.findIndex((s) => s.id === 'court'))
  if (idx < 0) throw new Error('no tour stop "court"')
  await goStop('court')
  await page.evaluate((i) => window.__tour.tour.start(i), idx)
  await waitFor(() => window.__tour.useTour.getState().phase === 'viewing', null, 60000)
  await settle(3000)
  await snap('f-tour')
})

// A ride: out on the Sky Rim, twenty metres above the lotus.
await shot('f-rides', async () => {
  await ui(true)
  await view(FEATURE_W, FEATURE_H)
  await tod('midday')
  await perch('sky-rim', 0.5)
  await settle(5000)
  await snap('f-rides')
})

// The information panel on a Bankura horse, standing on its podium (pod-a-1: r 15.1 m, 26°).
await shot('f-info', async () => {
  await ui(true)
  await view(FEATURE_W, FEATURE_H)
  await tod('midday')
  await go(...polarLook(12.9, 31, 15.1, 26), -4)
  await settle(1500)
  await page.evaluate(() => window.__museum.store.getState().select({ kind: 'object', id: 'clay-a-horse' }))
  await waitFor(() => !!document.querySelector('.ui-info.is-open'), null, 15000)
  await settle(2500)
  await snap('f-info')
})

// The 3D viewer on the Bankura horse.
await shot('f-inspect', async () => {
  await ui(true)
  await view(FEATURE_W, FEATURE_H)
  await tod('midday')
  await go(...polarLook(12.9, 31, 15.1, 26), -4)
  await page.evaluate(() => window.__museum.store.getState().inspect('object:clay-a-horse'))
  await waitFor(() => !!document.querySelector('.inspect-root canvas') && !!window.__museum.store.getState().inspecting, null, 30000)
  await settle(5000)
  await snap('f-inspect')
})

// The time-of-day pair: the same view of the court at golden hour and at night with the diyas
// lit (the landing page reveals one over the other on a diagonal, so the framing must match).
const LIGHT_VIEW = { tour: 'court' }
await shot('f-golden', async () => {
  await ui(false)
  await view(FEATURE_W, FEATURE_H)
  await tod('golden')
  await stand(LIGHT_VIEW)
  await settle(4500)
  await snap('f-golden')
})
await shot('f-night', async () => {
  await ui(false)
  await view(FEATURE_W, FEATURE_H)
  await tod('night')
  await page.evaluate(() => window.__museum.store.getState().setFestival?.('on'))
  await stand(LIGHT_VIEW)
  await settle(6000)
  await snap('f-night')
})

// The Clay Passport, part-way round: a visitor's stamps from the rooms already walked.
await shot('f-passport', async () => {
  await ui(true)
  await view(FEATURE_W, FEATURE_H)
  await tod('midday')
  await goStop('court')
  const t = new Date().toISOString()
  const stamps = Object.fromEntries(['arrival', 'a', 'b', 'c', 'oculus', 'duplex', 'sky-rim'].map((id) => [id, t]))
  await page.evaluate((s) => sessionStorage.setItem('capture.passport', JSON.stringify({ v: 1, stamps: s })), stamps)
  // the passport reads its stamps when the page loads
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 300_000 })
  await enter()
  await page.evaluate(() => sessionStorage.removeItem('capture.passport'))
  await reset()
  await tod('midday')
  await goStop('court')
  await settle(2500)
  await click('.ui-pass-btn')
  await waitFor(() => !!document.querySelector('.ui-pass__card'), null, 10000)
  await settle(1500)
  await snap('f-passport')
  await click('.ui-pass__close').catch(() => {})
  await page.evaluate(() => localStorage.removeItem('clay.passport.v1'))
})

// Photo mode on the Firelight preset (the pit firing at dusk), its frames row and shutter awake.
await shot('f-photo', async () => {
  await ui(true)
  await view(FEATURE_W, FEATURE_H)
  await goFrame('pit')
  await settle(6000)
  // the controls rest out of sight until the pointer moves
  await page.mouse.move(FEATURE_W * 0.5, FEATURE_H * 0.4)
  await page.mouse.move(FEATURE_W * 0.52, FEATURE_H * 0.42, { steps: 4 })
  await sleep(700)
  await snap('f-photo')
})

// Last: switches the UI language — Hindi, with a piece's panel open.
await shot('f-hindi', async () => {
  await ui(true)
  await view(FEATURE_W, FEATURE_H)
  await tod('midday')
  await goStop('gallery-c')
  await setLang('हिन्दी')
  await page.evaluate(() => window.__museum.store.getState().select({ kind: 'object', id: 'clay-c-kettle' }))
  await waitFor(() => !!document.querySelector('.ui-info.is-open'), null, 15000)
  await settle(3000)
  await snap('f-hindi')
  await page.evaluate(() => window.__museum.store.getState().select(null))
  await setLang('English').catch(() => {})
})

/* ------------------------------------------------------------------ hero film */

// Frame-by-frame (deterministic, smooth however fast headless Chrome renders): step the
// camera, grab a JPEG, then encode VP9 with WebCodecs in a second tab (same origin) and mux a
// video-only WebM. Muted; loops seamlessly (the eased glide plays forward then back).
const FILM = { w: 1600, h: 900, fps: 30, seconds: 4.5, bitrate: 2_600_000 }
// a slow drift in across the court towards the lotus, the gaze lifting a little towards the oculus
const GLIDE = { from: [0, 1.4, 10.6, 356, 7, 56], to: [0, 1.6, 8.2, 4, 13, 58] }

/** Minimal video-only WebM (EBML) muxer for VP9 chunks. */
function muxWebM({ width, height, fps, chunks, durationMs }) {
  const TE = new TextEncoder()
  const cat = (parts) => {
    const res = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
    let o = 0
    for (const p of parts) {
      res.set(p, o)
      o += p.length
    }
    return res
  }
  const idB = (id) => {
    const b = []
    for (let v = id; v > 0; v = Math.floor(v / 256)) b.unshift(v & 0xff)
    return new Uint8Array(b)
  }
  const vsize = (n) => {
    for (let len = 1; len <= 8; len++) {
      if (n < 2 ** (7 * len) - 1) {
        const res = new Uint8Array(len)
        let v = n
        for (let i = len - 1; i >= 0; i--) {
          res[i] = v % 256
          v = Math.floor(v / 256)
        }
        res[0] |= 1 << (8 - len)
        return res
      }
    }
    throw new Error('size too large')
  }
  const E = (id, payload) => cat([idB(id), vsize(payload.length), payload])
  const M = (id, children) => E(id, cat(children))
  const U = (id, v, width = 0) => {
    const b = []
    let x = v
    do {
      b.unshift(x % 256)
      x = Math.floor(x / 256)
    } while (x > 0)
    while (b.length < width) b.unshift(0)
    return E(id, new Uint8Array(b))
  }
  const S = (id, s) => E(id, TE.encode(s))
  const F = (id, v) => {
    const b = new Uint8Array(8)
    new DataView(b.buffer).setFloat64(0, v)
    return E(id, b)
  }
  const header = M(0x1a45dfa3, [U(0x4286, 1), U(0x42f7, 1), U(0x42f2, 4), U(0x42f3, 8), S(0x4282, 'webm'), U(0x4287, 4), U(0x4285, 2)])
  const info = M(0x1549a966, [U(0x2ad7b1, 1_000_000), F(0x4489, durationMs), S(0x4d80, 'capture-landing'), S(0x5741, 'capture-landing')])
  const tracks = M(0x1654ae6b, [
    M(0xae, [U(0xd7, 1), U(0x73c5, 1), U(0x83, 1), S(0x86, 'V_VP9'), U(0x23e383, Math.round(1e9 / fps)), M(0xe0, [U(0xb0, width), U(0xba, height)])]),
  ])
  const clusters = []
  let cur = null
  for (const c of chunks) {
    const ms = Math.round(c.timestamp / 1000)
    if (!cur || (c.key && ms !== cur.ms) || ms - cur.ms > 30000) {
      cur = { ms, parts: [U(0xe7, ms)] }
      clusters.push(cur)
    }
    const hdr = new Uint8Array(4)
    hdr[0] = 0x81
    new DataView(hdr.buffer).setInt16(1, ms - cur.ms)
    hdr[3] = c.key ? 0x80 : 0
    cur.parts.push(E(0xa3, cat([hdr, c.data])))
  }
  const clusterBytes = clusters.map((c) => M(0x1f43b675, c.parts))
  const seek = (id, pos) => M(0x4dbb, [E(0x53ab, idB(id)), U(0x53ac, pos, 8)])
  const seekHeadLen = M(0x114d9b74, [seek(0x1549a966, 0), seek(0x1654ae6b, 0), seek(0x1c53bb6b, 0)]).length
  const infoPos = seekHeadLen
  const tracksPos = infoPos + info.length
  let pos = tracksPos + tracks.length
  const cuePoints = clusterBytes.map((cb, i) => {
    const cp = M(0xbb, [U(0xb3, clusters[i].ms), M(0xb7, [U(0xf7, 1), U(0xf1, pos, 8)])])
    pos += cb.length
    return cp
  })
  const cues = M(0x1c53bb6b, cuePoints)
  const seekHead = M(0x114d9b74, [seek(0x1549a966, infoPos), seek(0x1654ae6b, tracksPos), seek(0x1c53bb6b, pos)])
  return cat([header, M(0x18538067, [seekHead, info, tracks, ...clusterBytes, cues])])
}

if (!process.env.SKIP_VIDEO && want('hero-video')) {
  console.log('hero-video')
  try {
    await reset()
    await ui(false)
    await view(FILM.w, FILM.h, 1)
    await tod(HERO.tod)
    const { from, to } = GLIDE
    await cam(from)
    await settle(5000)
    const n = Math.round(FILM.fps * FILM.seconds)
    const ease = (t) => t * t * (3 - 2 * t)
    const frames = []
    for (let i = 0; i < n; i++) {
      const k = ease(i / (n - 1))
      // yaw (index 3) turns the short way round (356° → 4° is 8°, not 352°)
      const pose = from.map((a, j) => a + (j === 3 ? ((((to[j] - a) % 360) + 540) % 360) - 180 : to[j] - a) * k)
      await page.evaluate(
        (a) =>
          new Promise((r) => {
            window.__museum.view(...a)
            requestAnimationFrame(() => requestAnimationFrame(() => r()))
          }),
        pose,
      )
      frames.push(await page.screenshot({ type: 'jpeg', quality: 92, encoding: 'base64' }))
      if (i % 30 === 0) console.log(`  frame ${i}/${n}`)
    }
    // ping-pong so the loop has no jump
    const seq = [...frames, ...frames.slice(1, -1).reverse()]
    const enc = await browser.newPage()
    await enc.goto(`${base}/favicon.svg`)
    await enc.evaluate((f) => {
      window.__chunks = []
      window.__err = null
      window.__enc = new VideoEncoder({
        output: (c) => {
          const d = new Uint8Array(c.byteLength)
          c.copyTo(d)
          window.__chunks.push({ timestamp: c.timestamp, key: c.type === 'key', data: d })
        },
        error: (e) => (window.__err = String(e)),
      })
      window.__enc.configure({ codec: 'vp09.00.40.08', width: f.w, height: f.h, bitrate: f.bitrate, framerate: f.fps, bitrateMode: 'variable', latencyMode: 'quality' })
    }, FILM)
    for (let i = 0; i < seq.length; i++) {
      await enc.evaluate(
        async (b64, idx, f) => {
          const blob = await (await fetch(`data:image/jpeg;base64,${b64}`)).blob()
          const bmp = await createImageBitmap(blob)
          const frame = new VideoFrame(bmp, { timestamp: Math.round((idx * 1e6) / f.fps), duration: Math.round(1e6 / f.fps) })
          window.__enc.encode(frame, { keyFrame: idx % (f.fps * 3) === 0 })
          frame.close()
          bmp.close()
          while (window.__enc.encodeQueueSize > 4) await new Promise((r) => setTimeout(r, 2))
          if (window.__err) throw new Error(window.__err)
        },
        seq[i],
        i,
        FILM,
      )
    }
    // hand the chunks back as base64 (typed arrays don't survive the CDP bridge)
    const chunks = await enc.evaluate(async () => {
      await window.__enc.flush()
      window.__enc.close()
      const b64 = (u8) => {
        let s = ''
        for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000))
        return btoa(s)
      }
      return window.__chunks.map((c) => ({ timestamp: c.timestamp, key: c.key, data: b64(c.data) }))
    })
    await enc.close()
    const bytes = muxWebM({
      width: FILM.w,
      height: FILM.h,
      fps: FILM.fps,
      chunks: chunks.map((c) => ({ ...c, data: new Uint8Array(Buffer.from(c.data, 'base64')) })),
      durationMs: (seq.length * 1000) / FILM.fps,
    })
    const file = path.join(out, 'hero.webm')
    fs.writeFileSync(file, bytes)
    const mb = bytes.length / 1048576
    console.log('  saved', path.relative(process.cwd(), file), `${mb.toFixed(2)} MB, ${(seq.length / FILM.fps).toFixed(1)} s`)
    if (mb > 6) console.warn('  WARNING: hero.webm is over 6 MB — lower FILM.bitrate')
    // the film's first frame doubles as its poster, so the poster → video swap is invisible
    fs.writeFileSync(path.join(out, 'hero-film.jpg'), Buffer.from(frames[0], 'base64'))
  } catch (e) {
    failures.push('hero-video')
    console.warn('  SKIPPED hero-video:', String(e?.message ?? e).split('\n')[0])
  }
}

await browser.close()

// The names app/page.tsx asks for.
const EXPECTED = [
  'hero.jpg',
  'hero.webm',
  'hero-film.jpg',
  ...SPACES.map(([n]) => `${n}.jpg`),
  ...['walk', 'tour', 'rides', 'info', 'inspect', 'golden', 'night', 'passport', 'photo', 'hindi'].map((f) => `f-${f}.jpg`),
]

// Tell the landing page which images exist (bundled JSON: works on serverless hosts too).
{
  const files = fs
    .readdirSync(out)
    .filter((f) => EXPECTED.includes(f) && fs.statSync(path.join(out, f)).size > 0)
    .sort()
  const stray = fs.readdirSync(out).filter((f) => !EXPECTED.includes(f))
  if (stray.length) console.warn(`not used by the landing page (not listed): ${stray.join(', ')}`)
  const manifest = path.resolve('app/landing/captured.json')
  const note = 'Written by scripts/capture-landing.mjs — the landing-page images that exist in public/brand/landing/.'
  fs.writeFileSync(manifest, JSON.stringify({ note, files }, null, 2) + '\n')
  console.log(`wrote ${path.relative(process.cwd(), manifest)} (${files.length} files)`)
  const missing = EXPECTED.filter((f) => !files.includes(f))
  if (missing.length) console.warn(`still missing (placeholders shown): ${missing.join(', ')}`)
}
console.log(failures.length ? `done — skipped: ${failures.join(', ')}` : 'done — all shots captured')
