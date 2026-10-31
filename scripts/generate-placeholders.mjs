/**
 * PLACEHOLDER STUDY GENERATOR — clay pavilion
 *
 *   run:  node scripts/generate-placeholders.mjs            (the artwork studies)
 *         BRAND=1 node scripts/generate-placeholders.mjs    (also the share card and app icon)
 *
 * Opens scripts/clay-placeholder-gen.html in headless Chrome via puppeteer-core, draws each
 * procedural study on a canvas and writes it to public/artworks/ as <name>.jpg plus the
 * responsive variants the museum loads (<name>.2048.webp, <name>.1024.webp — see
 * src/museum/exhibits/artworkTexture.ts). With BRAND=1 it also writes public/brand/og-image.jpg
 * and public/brand/icon-512.png.
 *
 * Options (env):  CHROME_PATH=<path to chrome.exe>   ONLY=clay-a-01.jpg,clay-b-02.jpg
 *                 FORCE=1  overwrite a file that already exists
 *
 * These images are stand-ins for layout and lighting only: reliefs, plaques and pots drawn
 * in the manner of each tradition, with no caption and no claim to depict a documented object.
 * Existing files are never overwritten without FORCE=1, so the workshop's photographs, once
 * dropped in under the same names, are safe from a re-run.
 */
import puppeteer from 'puppeteer-core'
import { access, mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const PUBLIC = path.join(ROOT, 'public')
const OUT = path.join(PUBLIC, 'artworks')
const CHROME = process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const PAGE = pathToFileURL(path.join(ROOT, 'scripts', 'clay-placeholder-gen.html')).href
const FORCE = !!process.env.FORCE

const exists = (f) =>
  access(f).then(
    () => true,
    () => false,
  )

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  // the page loads its fonts from node_modules over file://
  args: ['--no-sandbox', '--disable-gpu-sandbox', '--allow-file-access-from-files'],
  protocolTimeout: 600_000,
})

/** Decode a data URL and write it, unless the file exists (FORCE=1 overwrites). */
async function save(file, dataUrl) {
  if (!FORCE && (await exists(file))) {
    console.log(`  skip ${path.relative(ROOT, file)} (exists; FORCE=1 to overwrite)`)
    return
  }
  const buf = Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64')
  await writeFile(file, buf)
  console.log(`  ${path.relative(ROOT, file)}  ${(buf.length / 1024).toFixed(0)} KB`)
}

try {
  const page = await browser.newPage()
  page.on('console', (m) => m.type() === 'error' && console.error('[page]', m.text()))
  page.on('pageerror', (e) => console.error('[page error]', e.message))
  await page.goto(PAGE, { waitUntil: 'load', timeout: 120_000 })
  await page.waitForFunction('window.placeholderReady === true', { timeout: 120_000 })

  await mkdir(OUT, { recursive: true })
  let files = await page.evaluate(() => window.PLACEHOLDER_SPECS)
  const only = process.env.ONLY ? process.env.ONLY.split(',').map((s) => s.trim()) : null
  if (only) files = files.filter((f) => only.includes(f))
  for (const file of files) {
    const stem = file.replace(/\.jpg$/, '')
    await save(path.join(OUT, file), await page.evaluate((f) => window.renderPlaceholder(f, 0.9), file))
    for (const edge of [2048, 1024]) {
      await save(path.join(OUT, `${stem}.${edge}.webp`), await page.evaluate((f, e) => window.renderPlaceholder(f, 0.9, e, 'webp'), file, edge))
    }
  }
  console.log(`Placeholder studies: ${files.length} in ${path.relative(ROOT, OUT)}`)

  if (process.env.BRAND) {
    const brand = await page.evaluate(() => window.BRAND_SPECS)
    for (const file of brand) await save(path.join(PUBLIC, ...file.split('/')), await page.evaluate((f) => window.renderPlaceholder(f, 0.9), file))
  }
} finally {
  await browser.close()
}
