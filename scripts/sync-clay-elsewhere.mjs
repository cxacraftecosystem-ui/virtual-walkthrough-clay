/**
 * Brings a clay pavilion whose content lives in its database in line with Clay Elsewhere's second set and the Longpi
 * teapot (src/museum/config/grandObjects/crafts.ts, installations.ts) — touching nothing else.
 *   MUSEUM_URL=https://… MUSEUM_ADMIN_EMAIL=… MUSEUM_ADMIN_PASSWORD=… node scripts/sync-clay-elsewhere.mjs [--dry-run]
 *     [--exhibition <id|slug>]   (default: the site's default exhibition)
 *
 * Why: a database is seeded from the bundled config once. The grand plan's objects a stored set lacks are added
 * from the bundle at load (content/content.ts applyContent), but a stored object wins over its bundled version: the
 * Wine Hall's first scans would keep their old places among the new ones, and the black ware island's first kettle
 * study would stand where the teapot now stands. Like a careful curator, this script:
 *   1. refuses to run until the server serves every model the hall and the island name (deploy first);
 *   2. signs in and reads the stamps and the stored objects;
 *   3. for every object of the Wine Hall (hallway-d: its plinths and scans) and the teapot:
 *        not stored → created (X-Expected-Updated-At: new), so curators can edit it in the admin;
 *        stored as bundled now → left;
 *        stored exactly as the previous bundle had it (scripts/clay-elsewhere-previous.json) → replaced, with its
 *        stamp; stored otherwise (a curator's change) → LEFT and reported (exit 1);
 *   4. deletes the island's first kettle study (RETIRED) with its stamp, once the teapot is stored, and only while
 *      it is still exactly as seeded (it goes to the admin's trash); a changed one is LEFT (exit 1);
 *   5. a save in the meantime → 409: reported, skipped, never overwritten (exit 1);
 *   6. signs out, then reads the public content to confirm what visitors get.
 * Running it again is a no-op; --dry-run writes nothing. Never prints credentials or cookies.
 */
import fs from 'node:fs'
import path from 'node:path'
import { tsImport } from 'tsx/esm/api'

const ROOT = path.resolve(import.meta.dirname, '..')
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
  console.error('usage: MUSEUM_URL=… MUSEUM_ADMIN_EMAIL=… MUSEUM_ADMIN_PASSWORD=… node scripts/sync-clay-elsewhere.mjs [--exhibition <id|slug>] [--dry-run]')
  process.exit(2)
}

const { SCENE_OBJECTS } = await tsImport('../src/museum/config/objects.ts', import.meta.url)
const { SOURCED_REGISTRY } = await tsImport('../src/museum/config/sourcedRegistry.generated.ts', import.meta.url)
const PREVIOUS = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/clay-elsewhere-previous.json'), 'utf8')).objects
/** The island's first kettle study, replaced by the scanned Longpi teapot. */
const RETIRED = [{ id: 'craft-longpi-island-1', by: 'longpi-teapot-scan' }]
const WANT = SCENE_OBJECTS.filter((o) => (o.zone === 'hallway-d' && (o.kind === 'sourced-model' || o.kind === 'wine-plinth')) || o.id === 'longpi-teapot-scan')
for (const r of RETIRED) if (!PREVIOUS[r.id]) throw new Error(`clay-elsewhere-previous.json has no ${r.id}`)

const q = exhibition ? `?exhibition=${encodeURIComponent(exhibition)}` : ''
const label = (o) => `${o.id} (${o.title})`
/** JSON with sorted keys and rounded numbers: a stored item may come back with its keys reordered (Postgres jsonb). */
const canon = (v) =>
  Array.isArray(v)
    ? `[${v.map(canon).join(',')}]`
    : v && typeof v === 'object'
      ? `{${Object.keys(v)
          .filter((k) => v[k] !== undefined)
          .sort()
          .map((k) => `${JSON.stringify(k)}:${canon(v[k])}`)
          .join(',')}}`
      : JSON.stringify(typeof v === 'number' ? Math.round(v * 1e6) / 1e6 : (v ?? null))
const same = (a, b) => canon(a) === canon(b)
const fmt = (v) => (Array.isArray(v) ? `[${v.map((x) => (typeof x === 'number' ? Number(x.toFixed(3)) : x)).join(', ')}]` : typeof v === 'number' ? String(Number(v.toFixed(3))) : JSON.stringify(v)?.slice(0, 60))
const diff = (a, b) =>
  Object.keys({ ...a, ...b })
    .filter((k) => !same(a[k], b[k]))
    .map((k) => `${k} ${fmt(a[k])} → ${fmt(b[k])}`)
    .join('; ')

let cookie = ''
async function call(method, p, body, headers = {}) {
  let res
  for (let attempt = 0; ; attempt++) {
    try {
      res = await fetch(`${base}${p}`, {
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

// 1. every model must be served first
const urls = [...new Set(WANT.filter((o) => o.kind === 'sourced-model').flatMap((o) => [SOURCED_REGISTRY[o.props.slug]?.url, SOURCED_REGISTRY[o.props.slug]?.lod1]))]
if (urls.some((u) => !u)) throw new Error('a scan names a slug the registry does not have')
const missing = []
for (const u of urls) {
  let r = null
  for (let attempt = 0; attempt < 3 && !r; attempt++) {
    r = await fetch(`${base}${u}`, { method: 'HEAD' }).catch(() => null)
    if (!r) await new Promise((ok) => setTimeout(ok, 1000 * (attempt + 1)))
  }
  if (!r?.ok) missing.push(`${u} (${r ? r.status : 'fetch failed'})`)
}
if (missing.length) {
  console.error(`not served yet — deploy public/models/sourced first:\n  ${missing.join('\n  ')}`)
  process.exit(1)
}
console.log(`models: all ${urls.length} served`)

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

const n = { created: 0, replaced: 0, deleted: 0, current: 0, left: 0, conflicts: 0, failed: 0 }
const report = (r, ok, what) => {
  if (r.res.ok) {
    n[ok]++
    console.log(what)
  } else if (r.res.status === 409) {
    n.conflicts++
    console.error(`  CONFLICT  ${what.trim()} — saved by ${r.json?.updatedBy ?? 'someone'} meanwhile; skipped`)
  } else {
    n.failed++
    console.error(`  FAILED    ${what.trim()}: ${why(r)}`)
  }
}
try {
  const stamps = await call('GET', `/api/admin/content/stamps${q}`)
  const list = await call('GET', `/api/admin/content/objects${q}`)
  for (const r of [stamps, list]) if (!r.res.ok) throw new Error(`reading content failed: ${why(r)}`)
  const stored = new Map(list.json.map((o) => [o.id, o]))
  const stampOf = (id) => stamps.json.stamps?.[`objects/${id}`]

  // 3. the hall's plinths and scans, and the teapot
  for (const want of WANT) {
    const cur = stored.get(want.id)
    const put = (stamp) => call('PUT', `/api/admin/content/objects/${encodeURIComponent(want.id)}${q}`, want, { 'x-expected-updated-at': stamp })
    if (!cur) {
      if (dryRun) console.log(`  would create  ${label(want)}`)
      else report(await put('new'), 'created', `  created   ${label(want)}`)
      continue
    }
    if (same(cur, want)) {
      n.current++
      continue
    }
    if (!PREVIOUS[want.id] || !same(cur, PREVIOUS[want.id])) {
      n.left++
      console.error(`  LEFT      ${label(cur)} — not as the previous bundle had it (a curator's change?): ${diff(cur, want)}`)
      continue
    }
    if (dryRun) console.log(`  would replace ${label(cur)}: ${diff(cur, want)}`)
    else report(await put(stampOf(want.id)?.updatedAt ?? 'new'), 'replaced', `  replaced  ${label(cur)}: ${diff(cur, want)}`)
  }

  // 4. the retired kettle study, once its replacement is stored
  const after = dryRun ? stored : new Map((await call('GET', `/api/admin/content/objects${q}`)).json?.map((o) => [o.id, o]) ?? [])
  for (const { id, by } of RETIRED) {
    const cur = stored.get(id)
    if (!cur) continue
    if (!same(cur, PREVIOUS[id])) {
      n.left++
      console.error(`  LEFT      ${label(cur)} — changed since it was seeded; remove it in the admin if the teapot should replace it`)
      continue
    }
    if (!dryRun && !after.has(by)) {
      n.failed++
      console.error(`  FAILED    ${label(cur)}: ${by} is not stored yet — not deleted`)
      continue
    }
    if (dryRun) console.log(`  would delete  ${label(cur)} (replaced by ${by})`)
    else report(await call('DELETE', `/api/admin/content/objects/${encodeURIComponent(id)}${q}`, undefined, { 'x-expected-updated-at': stampOf(id)?.updatedAt ?? '' }), 'deleted', `  deleted   ${label(cur)} (replaced by ${by}; in the admin's trash)`)
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
  const objs = new Map((pub.json.objects ?? []).map((o) => [o.id, o]))
  const placed = WANT.filter((w) => same(objs.get(w.id)?.position, w.position)).length
  console.log(`visitors get ${placed}/${WANT.length} of the hall's and the island's objects as bundled${RETIRED.some((r) => objs.has(r.id)) ? ', and the retired kettle study is still there' : ''}`)
}
console.log(`${dryRun ? 'dry run — nothing written; ' : `created ${n.created}, replaced ${n.replaced}, deleted ${n.deleted}, `}up to date ${n.current}, left ${n.left}, conflicts ${n.conflicts}, failed ${n.failed}`)
process.exit(n.left || n.conflicts || n.failed ? 1 : 0)
