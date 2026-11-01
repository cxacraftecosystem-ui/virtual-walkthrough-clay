/**
 * Grand screenshot harness (GRAND §9): enters the gallery at each quality tier, takes each
 * acceptance pose from scripts/grand-poses.json and writes `<out>/<tier>/<id>.png`. Console
 * errors and page errors are logged and counted — zero is an acceptance gate (exit code 1
 * otherwise). Adapted from the spectacle harness (clay-stage scripts/spectacle-shots.mjs).
 *
 *   node scripts/grand-shots.mjs [--port 3600] [--tiers low,high] [--shots G01,G07,G23]
 *                                [--out shots/grand] [--width 1280 --height 800]
 *                                [--query "&spectacle=off"] [--frames]
 *                                [--chrome "C:/Program Files/Google/Chrome/Application/chrome.exe"]
 *
 * Needs a running dev server (`node_modules/.bin/next dev -p <port>`). A pose is either
 *   pose  [x, z, compass yaw, pitch]   standing at eye height (__museum.teleport), or
 *   view  [x, y, z, yaw, pitch, fov?]  a free camera (__museum.view), for aerial and elevation views;
 * and may set `time`, `weather`, `festival`, `map` or a `perch` [id, t] (a missing hook is skipped
 * with a note, never an error). The gallery is opened with `?shots` (no banners, pills or toasts)
 * and `noarrival`. Each shot waits for the shader compile and for the day clock to settle.
 * `--frames` also samples the mean frame time over two seconds at each pose.
 */
import { mkdirSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer-core'

const args = process.argv.slice(2)
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 && i + 1 < args.length ? args[i + 1] : def
}
const PORT = Number(opt('port', '3600'))
const TIERS = opt('tiers', 'low,high').split(',').filter(Boolean)
const OUT = resolve(opt('out', 'shots/grand'))
const WIDTH = Number(opt('width', '1280'))
const HEIGHT = Number(opt('height', '800'))
const CHROME = opt('chrome', process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe')
const SETTLE_MS = Number(opt('settle', '3000'))
const QUERY = opt('query', '')
const FRAMES = args.includes('--frames')

/** id → { name, pose | view, time?, weather?, festival?, map?, perch? } */
const SHOTS = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'grand-poses.json'), 'utf-8'))
const wanted = opt('shots', Object.keys(SHOTS).join(',')).split(',').filter(Boolean)
for (const id of wanted) if (!SHOTS[id]) throw new Error(`unknown shot ${id} (known: ${Object.keys(SHOTS).join(', ')})`)

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', `--window-size=${WIDTH},${HEIGHT}`],
  defaultViewport: { width: WIDTH, height: HEIGHT },
})

let problems = 0
try {
  for (const tier of TIERS) {
    const dir = join(OUT, tier)
    mkdirSync(dir, { recursive: true })
    const page = await browser.newPage()
    const logs = []
    page.on('console', (m) => {
      if (m.type() === 'error') logs.push(`[error] ${m.text()}`)
      else if (m.type() === 'warn' || m.type() === 'warning') logs.push(`[warn] ${m.text()}`)
    })
    page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`))
    const url = `http://localhost:${PORT}/gallery?autostart&noarrival&shots&quality=${tier}${QUERY}`
    console.log(`\n${tier}: ${url}`)
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 300000 })
    await page.waitForFunction(() => window.__museum?.store.getState().phase === 'entered', { timeout: 240000 })
    await sleep(1500)
    for (const id of wanted) {
      const s = SHOTS[id]
      const notes = []
      // a tier change or a hot reload recompiles: never shoot a frozen "Applying graphics settings" frame
      await page.waitForFunction(() => window.__museum?.store.getState().sceneCompiled, { timeout: 300000 })
      const note0 = await page.evaluate((shot) => {
        const m = window.__museum
        const st = m.store.getState()
        const notes = []
        st.setMapOpen?.(!!shot.map)
        st.setTimeOfDay?.(shot.time ?? 'midday')
        if (shot.weather) {
          if (st.setWeather) st.setWeather(shot.weather)
          else notes.push('no setWeather')
        } else st.setWeather?.('clear')
        st.setFestival?.(shot.festival ?? 'off')
        m.unview?.()
        if (shot.perch) {
          if (m.perch) {
            m.perch(shot.perch[0], shot.perch[1]) // the perch sets its own view
            return notes.join('; ')
          }
          notes.push('no __museum.perch')
        }
        m.leavePerch?.()
        if (shot.view) {
          if (m.view) m.view(...shot.view)
          else notes.push('no __museum.view')
          return notes.join('; ')
        }
        m.teleport(shot.pose[0], shot.pose[1], shot.pose[2], shot.pose[3])
        return notes.join('; ')
      }, s)
      if (note0) notes.push(note0)
      await sleep(SETTLE_MS)
      // the day clock eases to a new time of day: wait until the sun has stopped moving
      await page
        .waitForFunction(() => !window.__atmos || !window.__atmos.sunState.moving, { timeout: 30000, polling: 200 })
        .catch(() => notes.push('sun still moving'))
      // the rain eases in over ~6 s and out over ~8 s
      await page
        .waitForFunction(
          (wet) => {
            const w = window.__atmos?.weatherNow
            return !w || Math.abs(w.rain - (wet ? 1 : 0)) < 0.02
          },
          { timeout: 30000, polling: 200 },
          s.weather === 'monsoon',
        )
        .catch(() => notes.push('rain still easing'))
      await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 300)))))
      if (FRAMES) {
        const ms = await page.evaluate(
          () =>
            new Promise((r) => {
              const t = []
              let last = performance.now()
              const end = last + 2000
              const tick = (now) => {
                t.push(now - last)
                last = now
                if (now < end) requestAnimationFrame(tick)
                else r(t.reduce((a, b) => a + b, 0) / t.length)
              }
              requestAnimationFrame(tick)
            }),
        )
        notes.push(`${ms.toFixed(1)} ms/frame`)
      }
      const file = join(dir, `${id}.png`)
      await page.screenshot({ path: file })
      console.log(`  ${id} ${s.name}${notes.length ? ` (${notes.join('; ')})` : ''} → ${file}`)
    }
    await page.evaluate(() => window.__museum?.unview?.())
    const errors = logs.filter((l) => !l.startsWith('[warn]'))
    problems += errors.length
    console.log(`  console: ${errors.length} error(s), ${logs.length - errors.length} warning(s)`)
    for (const l of logs.slice(0, 40)) console.log('    ', l.slice(0, 400))
    await page.close()
  }
} finally {
  await browser.close()
}
if (problems) {
  console.log(`\n${problems} console error(s): acceptance gate failed`)
  process.exit(1)
}
console.log('\nno console errors')
