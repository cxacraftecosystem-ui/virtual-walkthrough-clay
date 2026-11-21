/**
 * Brings a deployed clay pavilion's artworks in line with src/museum/config/artworks.ts for the works that are no
 * longer stand-ins (`placeholder: false`: a real photograph in place of a generated study) — touching nothing else.
 *
 *   MUSEUM_URL=https://… MUSEUM_ADMIN_EMAIL=… MUSEUM_ADMIN_PASSWORD=… node scripts/sync-artwork-photos.mjs [--dry-run]
 *     [--exhibition <id|slug>]   (default: the site's default exhibition)
 *
 * The database is seeded from the bundled config once, so a work reaches a live museum only through the admin API.
 * Like a careful curator, this script:
 *   - refuses to run until the server serves the work's image (and its .1024/.2048.webp variants);
 *   - replaces a stored work only while it is still the untouched stand-in: flagged placeholder, its generated
 *     image (/artworks/<id>.jpg), a study's note ("A study made for this exhibition…"), never saved by a person
 *     (no `updatedBy` in its stamp). One a curator has changed is LEFT and reported (exit 1);
 *   - sends the stamp as X-Expected-Updated-At (a save in the meantime → 409: reported, skipped, exit 1);
 *   - signs out, then reads the public content to confirm what visitors get.
 * Running it again is a no-op; --dry-run writes nothing. Never prints credentials or cookies.
 */
import { tsImport } from 'tsx/esm/api'

const args = process.argv.slice(2)
const arg = (name) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] : undefined
}
const base = (arg('url') ?? process.env.MUSEUM_URL ?? '').replace(/\/+$/, '')
const email = arg('email') ?? process.env.MUSEUM_ADMIN_EMAIL
const password = process.env.MUSEUM_ADMIN_PASSWORD
const exhibition = arg('exhibition')
const dryRun = args.includes('--dry-run')
if (!base || !email || !password) {
  console.error('usage: MUSEUM_URL=… MUSEUM_ADMIN_EMAIL=… MUSEUM_ADMIN_PASSWORD=… node scripts/sync-artwork-photos.mjs [--exhibition <id|slug>] [--dry-run]')
  process.exit(2)
}

const { ARTWORKS } = await tsImport('../src/museum/config/artworks.ts', import.meta.url)
const WORKS = ARTWORKS.filter((a) => a.placeholder === false)
const q = exhibition ? `?exhibition=${encodeURIComponent(exhibition)}` : ''
const label = (o) => `${o.id} (${o.title})`
const canon = (v) =>
  Array.isArray(v)
    ? `[${v.map(canon).join(',')}]`
    : v && typeof v === 'object'
      ? `{${Object.keys(v)
          .filter((k) => v[k] !== undefined)
          .sort()
          .map((k) => `${JSON.stringify(k)}:${canon(v[k])}`)
          .join(',')}}`
      : JSON.stringify(v ?? null)
/** The stored work holds every field of `want`, and no stand-in field `want` lacks. */
const holds = (cur, want) => Object.keys(want).every((k) => canon(cur[k]) === canon(want[k])) && ['deepZoom', 'highRes', 'artisanId'].every((k) => want[k] !== undefined || cur[k] === undefined)

let cookie = ''
async function call(method, path, body, headers = {}) {
  let res
  for (let attempt = 0; ; attempt++) {
    try {
      res = await fetch(`${base}${path}`, {
        method,
        headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(cookie ? { cookie } : {}), ...headers },
        body: body ? JSON.stringify(body) : undefined,
        redirect: 'manual',
      })
      break
    } catch (e) {
      // a dropped connection, retried twice; a stamped write that did land is then refused (409), never doubled
      if (attempt >= 2) throw e
      await new Promise((ok) => setTimeout(ok, 1000 * (attempt + 1)))
    }
  }
  const text = await res.text()
  let json
  try {
    json = text ? JSON.parse(text) : undefined
  } catch {
    json = undefined
  }
  return { res, json }
}
const why = (r) => `${r.res.status} ${r.json?.message ?? r.json?.error ?? r.res.statusText}`

console.log(`museum: ${base}${exhibition ? `, exhibition ${exhibition}` : ' (default exhibition)'}${dryRun ? ' — dry run' : ''}`)
if (!WORKS.length) {
  console.log('no photographed works in artworks.ts — nothing to do')
  process.exit(0)
}

// 1. the images must be live first
const missing = []
for (const w of WORKS) {
  const stem = w.image.replace(/\.(jpe?g|png)$/i, '')
  for (const f of [w.image, `${stem}.1024.webp`, `${stem}.2048.webp`]) {
    let r = null
    for (let attempt = 0; attempt < 3 && !r; attempt++) {
      r = await fetch(`${base}${f}`, { method: 'HEAD' }).catch(() => null)
      if (!r) await new Promise((ok) => setTimeout(ok, 1000 * (attempt + 1)))
    }
    if (!r?.ok) missing.push(`${f} (${r ? r.status : 'fetch failed'})`)
  }
}
if (missing.length) {
  console.error(`not served yet — deploy public/artworks first:\n  ${missing.join('\n  ')}`)
  process.exit(1)
}
console.log(`images: all served for ${WORKS.length} work(s)`)

// 2. sign in
const login = await call('POST', '/api/auth/login', { email, password })
if (!login.res.ok) {
  console.error(`sign-in failed: ${why(login)}`)
  process.exit(1)
}
cookie = login.res.headers
  .getSetCookie()
  .map((c) => c.split(';')[0])
  .join('; ')
console.log(`signed in (${login.json?.role ?? 'unknown role'})`)

const n = { written: 0, current: 0, left: 0, conflicts: 0, failed: 0 }
try {
  const stamps = await call('GET', `/api/admin/content/stamps${q}`)
  const list = await call('GET', `/api/admin/content/artworks${q}`)
  for (const r of [stamps, list]) if (!r.res.ok) throw new Error(`reading content failed: ${why(r)}`)
  const current = new Map(list.json.map((a) => [a.id, a]))
  for (const want of WORKS) {
    const cur = current.get(want.id)
    const stamp = stamps.json.stamps?.[`artworks/${want.id}`]
    if (!cur) {
      n.left++
      console.error(`  LEFT      ${want.id} — not in the museum (removed by a curator?)`)
      continue
    }
    if (holds(cur, want)) {
      n.current++
      console.log(`  ok        ${label(cur)}`)
      continue
    }
    const untouched = cur.placeholder === true && cur.image === `/artworks/${want.id}.jpg` && /^A study made for this exhibition/.test(cur.description ?? '') && !stamp?.updatedBy
    if (!untouched) {
      n.left++
      console.error(`  LEFT      ${label(cur)} — a curator has changed it; the photograph (${want.image}) is in artworks.ts if wanted`)
      continue
    }
    if (dryRun) {
      console.log(`  would replace ${label(cur)} → ${label(want)}  ${want.image}`)
      continue
    }
    const r = await call('PUT', `/api/admin/content/artworks/${encodeURIComponent(want.id)}${q}`, want, { 'x-expected-updated-at': stamp?.updatedAt ?? 'new' })
    if (r.res.ok) {
      n.written++
      console.log(`  replaced  ${label(cur)} → ${label(want)}`)
    } else if (r.res.status === 409) {
      n.conflicts++
      console.error(`  CONFLICT  ${label(cur)} — saved by ${r.json?.updatedBy ?? 'someone'} meanwhile; skipped`)
    } else {
      n.failed++
      console.error(`  FAILED    ${label(cur)}: ${why(r)}`)
    }
  }
} catch (e) {
  n.failed++
  console.error(String(e?.message ?? e))
} finally {
  await call('POST', '/api/auth/logout').catch(() => {})
  cookie = ''
}

const pub = await call('GET', `/api/content${q}`)
if (pub.res.ok) {
  const arts = new Map((pub.json.artworks ?? []).map((a) => [a.id, a]))
  console.log(`visitors get ${WORKS.filter((w) => arts.get(w.id)?.image === w.image).length}/${WORKS.length} photographed work(s)`)
}
console.log(`${dryRun ? 'dry run — nothing written; ' : `written ${n.written}, `}up to date ${n.current}, left ${n.left}, conflicts ${n.conflicts}, failed ${n.failed}`)
process.exit(n.left || n.conflicts || n.failed ? 1 : 0)
