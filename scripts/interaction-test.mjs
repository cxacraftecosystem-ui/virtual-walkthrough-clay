/**
 * Demo-path interaction test for the clay pavilion: walking + collision (annex wall, gallery
 * ring wall, inner main wall F), artwork click → info panel, podium piece click → info panel →
 * 3D inspection viewer, proximity prompt, minimap, the potter's wheel studio, the guided tour
 * from first stop to last, then reports console errors.
 *   node scripts/interaction-test.mjs [baseUrl] [quality]
 *
 * Coordinates come from src/museum/config (layout.ts KEY, artworks.ts, objects.ts, tour.ts):
 * drum centre at the origin, entrance toward +z, compass yaw 0 = north (−z), 90 = east (+x).
 */
import fs from 'node:fs'
import path from 'node:path'
import puppeteer from 'puppeteer-core'

const base = process.argv[2] ?? 'http://localhost:3000'
const quality = process.argv[3] ?? 'medium'
const out = path.resolve(process.env.OUT_DIR ?? 'scripts/out')
const prefix = process.env.PREFIX ?? 't'
fs.mkdirSync(out, { recursive: true })
const shot = (name) => page.screenshot({ path: path.join(out, `${prefix}-${name}.png`) })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let failures = 0
const check = (ok, msg) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`)
  if (!ok) failures++
}

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: 'new',
  args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--window-size=1600,900', '--autoplay-policy=no-user-gesture-required'],
  defaultViewport: { width: 1600, height: 900 },
})
const page = await browser.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))

await page.goto(`${base}/gallery?quality=${quality}`, { waitUntil: 'networkidle0', timeout: 240000 })
// Entry screen → Enter button
await page.waitForFunction(() => window.__museum?.store.getState().phase === 'ready', { timeout: 240000 })
await shot('entry')
const enter = await page.$$eval('button', (bs) => bs.findIndex((b) => /enter/i.test(b.textContent ?? '')))
check(enter >= 0, 'entry screen shows "Enter the exhibition"')
await page.evaluate((i) => document.querySelectorAll('button')[i].click(), enter)
await sleep(2500)
check(await page.evaluate(() => window.__museum.store.getState().phase === 'entered'), 'visitor entered the exhibition')
// Skip the arrival flight if it is playing (the scripted views below teleport anyway).
await page.keyboard.press('Escape')
await sleep(800)

const pos = () => page.evaluate(() => ({ x: window.__museum.visitor.x, z: window.__museum.visitor.z }))
const walk = async (ms, key = 'w') => {
  await page.keyboard.down(key)
  await sleep(ms)
  await page.keyboard.up(key)
  await sleep(400)
}

// Spawn: outside the annex door, facing the pavilion (−z). Walk in through the door.
await page.evaluate(() => window.__museum.teleport(0, 26.5, 0, 0))
await sleep(600)
const p0 = await pos()
await walk(2000)
const p1 = await pos()
check(p0.z - p1.z > 1.5, `W walks forward from the spawn point (moved ${(p0.z - p1.z).toFixed(2)} m)`)
await walk(5000)
const p1b = await pos()
check(p1b.z < 19.5, `the annex door lets the visitor in (z=${p1b.z.toFixed(2)}, door at 19.5)`)

// Collision: the annex's east wall (interior half-width 2.286 m).
await page.evaluate(() => window.__museum.teleport(0, 15.5, 90, 0))
await sleep(300)
await walk(2500)
const p2 = await pos()
check(p2.x > 1.6 && p2.x < 2.286, `annex wall blocks the visitor (x=${p2.x.toFixed(3)}, wall face at 2.286)`)

// Collision: the gallery ring wall in A (r 7.85), walking east between two podiums.
await page.evaluate(() => window.__museum.teleport(4.2, 1.1, 90, 0))
await sleep(300)
await walk(3000)
const p3 = await pos()
const r3 = Math.hypot(p3.x, p3.z)
check(r3 > 7.2 && r3 < 7.85, `gallery ring wall is solid (r=${r3.toFixed(3)}, wall face at 7.85)`)

// Collision: the inner main wall F (court face at r 5.825), walking outward at 70° past the court bench.
await page.evaluate(() => window.__museum.teleport(4 * Math.cos((70 * Math.PI) / 180), 4 * Math.sin((70 * Math.PI) / 180), 160, 0))
await sleep(300)
await walk(2500)
const p4 = await pos()
const r4 = Math.hypot(p4.x, p4.z)
check(r4 > 5.2 && r4 < 5.825, `inner main wall F is solid (r=${r4.toFixed(3)}, face at 5.825)`)

// Artwork click → info panel (clay-a-02 on the A ring wall, above the podium row).
await page.evaluate(() => window.__museum.store.getState().select(null))
await page.evaluate(() => window.__museum.teleport(5.0, -0.95, 79, 10))
await sleep(1800)
await page.mouse.click(800, 240)
await sleep(4000)
const sel = await page.evaluate(() => window.__museum.store.getState().selection)
check(sel?.kind === 'artwork' && /^clay-a-/.test(sel.id), `clicking an artwork selects it (${JSON.stringify(sel)})`)
await shot('artwork-panel')
await page.keyboard.press('Escape')
await sleep(700)
check(await page.evaluate(() => window.__museum.store.getState().selection === null), 'Esc closes the information panel')

// Podium piece click → info panel → 3D viewer (the large horse in A).
await page.evaluate(() => window.__museum.teleport(5.2, 1.6, 102, -14))
await sleep(1800)
await shot('podium-view')
await page.mouse.click(800, 450)
await sleep(3500)
const sel2 = await page.evaluate(() => window.__museum.store.getState().selection)
check(sel2?.kind === 'object' && /^clay-a-/.test(sel2.id), `clicking a podium piece selects it (${JSON.stringify(sel2)})`)
const id2 = sel2?.id ?? 'clay-a-horse'
await page.evaluate((id) => window.__museum.store.getState().inspect(`object:${id}`), id2)
await sleep(2500)
const modal = await page.$('.inspect-root, [class*="inspect-"]')
check(!!modal, 'inspection viewer opens')
await shot('inspect')
await page.mouse.move(700, 450)
await page.mouse.down()
await page.mouse.move(950, 420, { steps: 12 })
await page.mouse.up()
await sleep(900)
await shot('inspect-rotated')
await page.keyboard.press('Escape')
await sleep(800)
check(await page.evaluate(() => window.__museum.store.getState().inspecting === null), 'Esc closes the inspection viewer')
await page.evaluate(() => window.__museum.store.getState().select(null))
await sleep(400)

// Proximity prompt + E (the A tradition panel at the mouth of the east entry way).
await page.evaluate(() => window.__museum.teleport(6.61, 5.95, 132, 3))
await sleep(1500)
const near = await page.evaluate(() => window.__museum.store.getState().nearby)
check(!!near?.id, `proximity prompt near an item (${JSON.stringify(near)})`)
if (near?.id) {
  await page.keyboard.press('e')
  await sleep(900)
  check(await page.evaluate((id) => window.__museum.store.getState().selection?.id === id, near.id), 'E opens the nearby item')
  await page.keyboard.press('Escape')
  await sleep(500)
}

// Minimap.
await page.evaluate(() => window.__museum.store.getState().setMapOpen(true))
await sleep(1200)
const mapPaths = await page.evaluate(() => document.querySelectorAll('.ui-map path, .ui-map polygon').length)
check(mapPaths > 3, `minimap draws the plan (${mapPaths} paths)`)
await shot('minimap')

// The potter's wheel studio (B): the /gallery#object=potters-wheel deep link selects the wheel,
// and selecting the wheel opens the studio instead of the information panel.
await page.goto(`${base}/gallery?quality=${quality}&autostart#object=potters-wheel`, { waitUntil: 'networkidle0', timeout: 240000 })
await page.waitForFunction(() => window.__museum?.store.getState().phase === 'entered', { timeout: 240000 })
await page.waitForFunction(() => window.__clayStudio?.getState().open === true, { timeout: 20000 }).catch(() => {})
await sleep(2500)
check(await page.evaluate(() => window.__clayStudio?.getState().open === true), 'the deep link to the wheel opens the studio')
check(!!(await page.$('.cs-profile')), 'the studio shows the pot profile')
await shot('studio')
await page.evaluate(() => window.__clayStudio.getState().setOpen(false))
await sleep(900)
check(await page.evaluate(() => !window.__clayStudio.getState().open), 'the studio closes')
await page.evaluate(() => window.__museum.store.getState().select(null))

// Guided tour, start to finish (walks between stops; each stop is skipped once viewed).
const stops = await page.evaluate(() => window.__tour.stops.length)
await page.evaluate(() => window.__tour.tour.start(0))
let viewed = 0
for (let i = 0; i < stops; i++) {
  const ok = await page
    .waitForFunction((n) => { const s = window.__tour.useTour.getState(); return s.index === n && s.phase === 'viewing' }, { timeout: 60000 }, i)
    .then(() => true)
    .catch(() => false)
  if (!ok) {
    check(false, `tour reaches stop ${i}`)
    break
  }
  viewed++
  await sleep(1400)
  const id = await page.evaluate(() => window.__tour.stops[window.__tour.useTour.getState().index].id)
  await shot(`tour-${String(i + 1).padStart(2, '0')}-${id}`)
  // the last stop is left to finish its dwell on its own
  if (i < stops - 1) await page.evaluate(() => window.__tour.tour.next())
}
check(viewed === stops, `tour visited all ${stops} stops (${viewed})`)
await page.waitForFunction(() => window.__tour.useTour.getState().phase === 'done', { timeout: 120000 }).catch(() => {})
const tourEnd = await page.evaluate(() => window.__tour.useTour.getState())
check(tourEnd.phase === 'done' || !tourEnd.active, `tour finishes (${JSON.stringify({ active: tourEnd.active, phase: tourEnd.phase })})`)
await page.evaluate(() => window.__tour.tour.exit())

const ignorable = (e) => /THREE\.|WebGL: |GL_INVALID|favicon|Failed to load resource: the server responded with a status of 404|ERR_ABORTED|Realtime|websocket/i.test(e)
const real = errors.filter((e) => !ignorable(e))
check(real.length === 0, `no page errors (${real.length}; ${errors.length - real.length} ignorable)`)
for (const e of [...new Set(errors)].slice(0, 12)) console.log('   ', e.slice(0, 300))
await browser.close()
console.log(failures ? `${failures} FAILURE(S)` : 'ALL CHECKS PASSED')
process.exit(failures ? 1 : 0)
