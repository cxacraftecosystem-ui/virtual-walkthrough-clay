/**
 * Visual validation harness for the clay pavilion: opens /gallery in Chrome (GPU), walks the
 * demo path by teleporting to key viewpoints, saves screenshots and reports console errors.
 *
 *   node scripts/screenshots.mjs [baseUrl] [quality] [only=name1,name2] [time=night]
 *   (default baseUrl http://localhost:3000, quality high) → scripts/out/*.png
 *   OUT_DIR / PREFIX (env) change the output folder and add a file-name prefix.
 */
import fs from 'node:fs'
import path from 'node:path'
import puppeteer from 'puppeteer-core'

const base = process.argv[2] ?? 'http://localhost:3000'
const quality = process.argv[3] ?? 'high'
const only = (process.argv.find((a) => a.startsWith('only=')) ?? '').slice(5).split(',').filter(Boolean)
const time = (process.argv.find((a) => a.startsWith('time=')) ?? '').slice(5)
const width = Number(process.env.W ?? 1600)
const height = Number(process.env.H ?? 900)
const outDir = path.resolve(process.env.OUT_DIR ?? 'scripts/out')
const prefix = process.env.PREFIX ? `${process.env.PREFIX}-` : ''
fs.mkdirSync(outDir, { recursive: true })

const CHROME = process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe'

// Plan angle a = atan2(z, x) (0° east, 90° the entrance side); compass yaw 0 = north (−z), 90 = east.
const DEG = Math.PI / 180
const polar = (r, a) => [r * Math.cos(a * DEG), r * Math.sin(a * DEG)]
const yawTo = (x, z, tx, tz) => ((Math.atan2(tx - x, -(tz - z)) / DEG) % 360 + 360) % 360
/** Stand at polar(r, a), look at polar(tr, ta). */
const at = (r, a, tr, ta, pitch = 0) => {
  const [x, z] = polar(r, a)
  const [tx, tz] = polar(tr, ta)
  return [x, z, yawTo(x, z, tx, tz), pitch]
}

// name, x, z, compass heading (0 = north), pitch (deg) — drum Ø 21.3 m centred on the origin,
// annex G toward +z (door at z 19.5), spawn at (0, 26.5).
const SHOTS = [
  ['01-spawn', 0, 26.5, 0, 6],
  ['02-forecourt-side', 13.2, 14.5, 300, 4],
  ['03-annex', 0, 17.6, 0, 3],
  ['04-description-wall', 0, 13.6, 0, 6],
  ['05-entry-way', ...at(7.45, 100, 6.9, 42, 4)],
  ['06-entry-east', ...at(9.2, 64, 7.0, 105, 2)],
  ['07-gallery-a', ...at(3.4, 30, 7.85, 8, 6)],
  ['08-podiums-a', ...at(5.2, -18, 6.9, -62, -2)],
  ['09-gallery-b', ...at(3.4, -40, 7.85, -55, 6)],
  ['10-potters-wheel', ...at(3.2, -55, 4.2, -72.5, -12)],
  ['11-gallery-c', ...at(3.6, 205, 7.85, 238, 6)],
  ['12-hallway', ...at(9.3, 212, 9.3, 170, 3)],
  ['13-hallway-shelves', ...at(9.6, 180, 8.1, 200, -4)],
  ['14-court', ...at(4.6, -110, 0, 0, 2)],
  ['15-oculus-up', 0.4, 4.2, 0, 52],
  ['16-statement', 0, 3.75, 180, 7],
  ['17-visitors-shelf', 0.6, 15.6, 270, 0],
]
const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-webgl', `--window-size=${width},${height}`],
  defaultViewport: { width, height, deviceScaleFactor: 1 },
})
const page = await browser.newPage()
const logs = []
page.on('console', (m) => {
  if (['error', 'warning', 'warn'].includes(m.type())) logs.push(`[${m.type()}] ${m.text()}`)
})
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`))
page.on('requestfailed', (r) => logs.push(`[requestfailed] ${r.url()} ${r.failure()?.errorText}`))

const t0 = Date.now()
await page.goto(`${base}/gallery?autostart&quality=${quality}${time ? `&time=${time}` : ''}`, { waitUntil: 'networkidle0', timeout: 240000 })
await page.waitForFunction(() => window.__museum?.store.getState().phase === 'entered', { timeout: 240000 })
if (time) await page.evaluate((t) => window.__museum.store.getState().setTimeOfDay(t), time)
// CLEAN=1 hides the interface for architecture checks.
if (process.env.CLEAN) await page.addStyleTag({ content: '.ui-hud, .ui-map, .ui-live-invite, [class*="ui-live"], .ui-prompt, .ui-title, nextjs-portal { visibility: hidden !important; }' })
console.log(`entered after ${((Date.now() - t0) / 1000).toFixed(1)} s`)
const renderer = await page.evaluate(() => {
  const gl = document.createElement('canvas').getContext('webgl2')
  const ext = gl?.getExtension('WEBGL_debug_renderer_info')
  return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'unknown'
})
console.log('GPU:', renderer)
await new Promise((r) => setTimeout(r, 3500))

for (const [name, x, z, yaw, pitch] of SHOTS) {
  if (only.length && !only.some((o) => name.includes(o))) continue
  await page.evaluate((a) => window.__museum.teleport(a[0], a[1], a[2], a[3]), [x, z, yaw, pitch])
  await new Promise((r) => setTimeout(r, 1600))
  const fps = await page.evaluate(
    () =>
      new Promise((res) => {
        let n = 0
        const s = performance.now()
        const f = () => (++n < 30 ? requestAnimationFrame(f) : res(Math.round((30 * 1000) / (performance.now() - s))))
        requestAnimationFrame(f)
      }),
  )
  await page.screenshot({ path: path.join(outDir, `${prefix}${name}${time ? `-${time}` : ''}.png`) })
  console.log(`${name}  ~${fps} fps`)
}

fs.writeFileSync(path.join(outDir, 'console.log'), logs.join('\n'))
console.log(`console issues: ${logs.length} (see ${path.join(outDir, 'console.log')})`)
for (const l of logs.slice(0, 25)) console.log('  ', l.slice(0, 300))
await browser.close()
