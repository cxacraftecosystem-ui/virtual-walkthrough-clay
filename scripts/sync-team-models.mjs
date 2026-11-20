/**
 * Brings a clay pavilion whose content lives in its database in line with the workshop team's pieces in
 * src/museum/config/objects.ts (TEAM_PIECES, TEAM_REPLACES) — touching nothing else.
 *   MUSEUM_URL=https://… MUSEUM_ADMIN_EMAIL=… MUSEUM_ADMIN_PASSWORD=… node scripts/sync-team-models.mjs [--dry-run]
 *   node scripts/sync-team-models.mjs --url http://localhost:3971 --email admin@museum.local [--exhibition <id|slug>] [--dry-run]
 *     (the password comes from MUSEUM_ADMIN_PASSWORD, or --password — which lands in your shell history)
 *
 * Why: a database is seeded from the bundled config once (src/server/contentStore.ts seedContent, onlyIfEmpty), so
 * the sixteen team pieces reach a live museum only through the admin API — and the procedural stand-ins they took
 * the place of (the fourteen podium pieces and the Herd's two front horses) stay there until removed, standing on
 * the same podiums. This script does exactly that, as a curator would, for the clay site's default exhibition (or
 * --exhibition):
 *   1. refuses to run unless the server already serves every public/models/team/*.glb (HEAD, and the same byte
 *      length where the server reports one): deploy them first, or the pieces would show only their silhouette;
 *   2. POST /api/auth/login → GET /api/admin/content/stamps (each item's updatedAt) → GET /api/admin/content/objects;
 *   3. a team piece that is not there is created: PUT …/objects/<id> with X-Expected-Updated-At: new;
 *      a team piece that is there but placed or modelled differently from objects.ts is updated with its current
 *      stamp — only the fields this script owns (kind, model, position, rotationDeg, footprint, height, zone and
 *      props.stand); a curator's text (title, description, alt, translations, placeholder, links…) is kept;
 *   4. a replaced stand-in is deleted with its stamp (it goes to the admin's trash and can be restored there) —
 *      once the piece replacing it is in the museum, and only while it is still an untouched stand-in: no `model` of its own, still a placeholder, not
 *      re-kinded, and never saved since it was seeded (its history holds no save after the last re-seed). One a
 *      curator has touched is LEFT, reported, and the run exits 1, so someone decides in the admin rather than
 *      this script throwing curated work away;
 *   5. an item saved by someone else after the stamps were read is refused by the server (409): reported,
 *      skipped, never overwritten, exit 1. A saved tour (an exhibition's tour override) that names a replaced
 *      stand-in is reported (the tour API takes no stamp, so it is not rewritten here: fix it in the admin);
 *   6. logs out, then reads the public content to confirm what visitors get.
 * Running it again is a no-op. --dry-run prints the plan (ids, titles, old → new) and writes nothing.
 *
 * Output: one line per item (id and title, placement — never credentials or cookies) and a summary; exit 1 on
 * any failure, conflict or item left for a curator.
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
const password = arg('password') ?? process.env.MUSEUM_ADMIN_PASSWORD
const exhibition = arg('exhibition')
const dryRun = args.includes('--dry-run')
if (!base || !email || !password) {
  console.error('usage: MUSEUM_URL=… MUSEUM_ADMIN_EMAIL=… MUSEUM_ADMIN_PASSWORD=… node scripts/sync-team-models.mjs [--exhibition <id|slug>] [--dry-run]')
  process.exit(2)
}

const { TEAM_PIECES, TEAM_REPLACES, TEAM_MODEL_DIR } = await tsImport('../src/museum/config/objects.ts', import.meta.url)
const q = exhibition ? `?exhibition=${encodeURIComponent(exhibition)}` : ''
const label = (o) => `${o.id} (${o.title})`

/** The fields of a team piece this script owns; everything else (the curators' text) is kept as stored. */
const OWNED = ['kind', 'model', 'position', 'rotationDeg', 'footprint', 'height', 'zone']
const round = (v) => (typeof v === 'number' ? Math.round(v * 1e6) / 1e6 : Array.isArray(v) ? v.map(round) : v)
const same = (a, b) => JSON.stringify(round(a)) === JSON.stringify(round(b))
function ownedOf(o) {
  const out = {}
  for (const k of OWNED) if (o[k] !== undefined) out[k] = o[k]
  out.stand = o.props?.stand ?? 'none'
  return out
}
const fmt = (v) => (Array.isArray(v) ? `[${v.map((x) => (typeof x === 'number' ? Number(x.toFixed(3)) : x)).join(', ')}]` : typeof v === 'number' ? String(Number(v.toFixed(3))) : String(v))
function diff(prev, next) {
  return Object.keys({ ...prev, ...next })
    .filter((k) => !same(prev[k], next[k]))
    .map((k) => `${k} ${fmt(prev[k])} → ${fmt(next[k])}`)
}
/** Still the procedural stand-in it was seeded as? (no model of its own, a placeholder, not re-kinded) */
const untouchedStandIn = (o) => !o.model && o.placeholder !== false && o.kind !== 'team-piece'

let cookie = ''
async function call(method, p, body, headers = {}) {
  const res = await fetch(`${base}${p}`, {
    method,
    headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(cookie ? { cookie } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined,
    redirect: 'manual',
  })
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

// 1. every team GLB must be live first, or the pieces would show only their silhouette
const dir = path.join(ROOT, 'public', TEAM_MODEL_DIR)
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.glb'))
const wanted = new Set(TEAM_PIECES.map((o) => o.model))
const notServed = []
for (const f of files) {
  const url = `${TEAM_MODEL_DIR}${f}`
  const r = await fetch(`${base}${url}`, { method: 'HEAD' }).catch((e) => ({ ok: false, status: e.message }))
  const len = r.ok ? Number(r.headers.get('content-length') ?? NaN) : NaN
  const local = fs.statSync(path.join(dir, f)).size
  if (!r.ok) notServed.push(`${url} (${r.status})`)
  else if (Number.isFinite(len) && len > 0 && len !== local) notServed.push(`${url} (serves ${len} bytes, this checkout has ${local}: deploy this version)`)
}
for (const m of wanted) if (!files.includes(path.basename(m))) notServed.push(`${m} (not in public/models/team/ here)`)
if (notServed.length) {
  console.error(`not served yet — deploy public/models/team/ first:\n  ${notServed.join('\n  ')}`)
  process.exit(1)
}
console.log(`models: all ${files.length} served`)

// 2. sign in (curator or above)
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

const n = { created: 0, updated: 0, current: 0, deleted: 0, absent: 0, left: 0, conflicts: 0, failed: 0 }
const replacedIds = new Set(TEAM_REPLACES.map((r) => r.id))
try {
  // stamps first: an item saved after this read carries a newer stamp than the one sent, so its write is refused
  const stamps = await call('GET', `/api/admin/content/stamps${q}`)
  if (!stamps.res.ok) throw new Error(`reading stamps failed: ${why(stamps)}`)
  const list = await call('GET', `/api/admin/content/objects${q}`)
  if (!list.res.ok) throw new Error(`listing objects failed: ${why(list)}`)
  const current = new Map(list.json.map((o) => [o.id, o]))
  const stampOf = (id) => stamps.json?.stamps?.[`objects/${id}`]?.updatedAt
  /** Team pieces that stand in the museum after this run (a stand-in goes only once its replacement is there). */
  const standing = new Set()

  // 3. the team's pieces: create, or bring their placement in line
  console.log('the workshop team’s pieces:')
  for (const want of TEAM_PIECES) {
    const have = current.get(want.id)
    if (!have) {
      if (dryRun) {
        n.created++
        standing.add(want.id)
        console.log(`  would create   ${label(want)}  ${want.model}  at ${fmt(want.position)} ${fmt(want.rotationDeg)}°`)
        continue
      }
      const r = await call('PUT', `/api/admin/content/objects/${encodeURIComponent(want.id)}${q}`, want, { 'x-expected-updated-at': 'new' })
      if (r.res.ok) {
        n.created++
        standing.add(want.id)
        console.log(`  created        ${label(want)}`)
      } else if (r.res.status === 409) {
        n.conflicts++
        console.error(`  CONFLICT       ${label(want)}: created by someone else meanwhile (${r.json?.updatedBy ?? '?'}) — skipped, not overwritten`)
      } else {
        n.failed++
        console.error(`  FAILED         ${label(want)}: ${why(r)}`)
      }
      continue
    }
    standing.add(want.id)
    const changes = diff(ownedOf(have), ownedOf(want))
    if (!changes.length) {
      n.current++
      console.log(`  up to date     ${label(have)}`)
      continue
    }
    if (dryRun) {
      n.updated++
      console.log(`  would update   ${label(have)}: ${changes.join('; ')}`)
      continue
    }
    const stamp = stampOf(want.id)
    if (!stamp) {
      n.failed++
      console.error(`  FAILED         ${label(have)}: no stamp for it, not written`)
      continue
    }
    // the item exactly as stored, with only the owned fields replaced (the API strips updatedAt/updatedBy)
    const body = { ...have }
    for (const k of OWNED) {
      if (want[k] === undefined) delete body[k]
      else body[k] = want[k]
    }
    const props = { ...(have.props ?? {}) }
    if (want.props?.stand) props.stand = want.props.stand
    else delete props.stand
    if (Object.keys(props).length) body.props = props
    else delete body.props
    delete body.updatedAt
    delete body.updatedBy
    const r = await call('PUT', `/api/admin/content/objects/${encodeURIComponent(want.id)}${q}`, body, { 'x-expected-updated-at': stamp })
    if (r.res.ok) {
      n.updated++
      console.log(`  updated        ${label(have)}: ${changes.join('; ')}`)
    } else if (r.res.status === 409) {
      n.conflicts++
      console.error(`  CONFLICT       ${label(have)}: changed at ${r.json?.updatedAt ?? '?'} by someone else — skipped, not overwritten`)
    } else {
      n.failed++
      console.error(`  FAILED         ${label(have)}: ${why(r)}`)
    }
  }

  // 4. the stand-ins they replaced
  console.log('the stand-ins they replaced:')
  for (const { id, by } of TEAM_REPLACES) {
    const have = current.get(id)
    if (!have) {
      n.absent++
      console.log(`  already gone   ${id}  (→ ${by})`)
      continue
    }
    if (!standing.has(by)) {
      n.left++
      console.error(`  LEFT           ${label(have)}: ${by} is not in the museum (see above) — the stand-in stays until it is`)
      continue
    }
    // edited since it was (re)seeded? Seeding writes no revision; a save, a restore or a re-creation does
    const hist = await call('GET', `/api/admin/content/objects/${encodeURIComponent(id)}/history${q}`)
    if (!hist.res.ok) {
      n.failed++
      console.error(`  FAILED         ${label(have)}: reading its history failed: ${why(hist)} — not deleted`)
      continue
    }
    const latest = hist.json?.revisions?.[0]
    const edited = !!latest && latest.op !== 'delete'
    if (!untouchedStandIn(have) || edited) {
      n.left++
      const what = have.model ? 'given it a model' : have.placeholder === false ? 'marked it as no longer a placeholder' : have.kind === 'team-piece' ? 'made it a team piece' : `edited it (${latest.op} by ${latest.actorEmail ?? '?'}, ${latest.at})`
      console.error(`  LEFT           ${label(have)}: a curator has ${what} — not deleted; it stands where ${by} now stands: move or delete it in the admin`)
      continue
    }
    if (dryRun) {
      n.deleted++
      console.log(`  would delete   ${label(have)}  (stand-in, ${have.kind}) → ${by}`)
      continue
    }
    const stamp = stampOf(id)
    if (!stamp) {
      n.failed++
      console.error(`  FAILED         ${label(have)}: no stamp for it, not deleted`)
      continue
    }
    const r = await call('DELETE', `/api/admin/content/objects/${encodeURIComponent(id)}${q}`, undefined, { 'x-expected-updated-at': stamp })
    if (r.res.ok) {
      n.deleted++
      console.log(`  deleted        ${label(have)}  (in the admin's trash) → ${by}`)
    } else if (r.res.status === 409) {
      n.conflicts++
      console.error(`  CONFLICT       ${label(have)}: changed at ${r.json?.updatedAt ?? '?'} by someone else — not deleted`)
    } else {
      n.failed++
      console.error(`  FAILED         ${label(have)}: ${why(r)}`)
    }
  }
} catch (e) {
  n.failed++
  console.error(e instanceof Error ? e.message : String(e))
} finally {
  await call('POST', '/api/auth/logout').catch(() => undefined)
}

// 5–6. what visitors get: the public content, and a saved tour that still names a stand-in
let tourStale = 0
const pub = await call('GET', `/api/content${q}`)
if (pub.res.ok) {
  const ids = new Set((pub.json?.objects ?? []).map((o) => o.id))
  const shown = TEAM_PIECES.filter((o) => ids.has(o.id)).length
  const stale = TEAM_REPLACES.filter((r) => ids.has(r.id)).length
  console.log(`visitors ${dryRun ? 'now get' : 'get'} ${shown}/${TEAM_PIECES.length} team pieces and ${stale} of the replaced stand-ins`)
  for (const s of pub.json?.tour ?? []) {
    if (s?.item?.kind === 'object' && replacedIds.has(s.item.id)) {
      tourStale++
      console.error(`  TOUR           the saved tour's stop “${s.title ?? s.id}” names ${s.item.id}, which was replaced by ${TEAM_REPLACES.find((r) => r.id === s.item.id).by}: change it in the admin (Tour)`)
    }
  }
} else console.error(`reading the public content failed: ${why(pub)}`)

const verb = dryRun ? 'would ' : ''
console.log(
  `${verb}create ${n.created}, ${verb}update ${n.updated}, up to date ${n.current}; ${verb}delete ${n.deleted} stand-in(s), already gone ${n.absent}` +
    `${n.left ? `, LEFT for a curator ${n.left}` : ''}${n.conflicts ? `, CONFLICTS ${n.conflicts}` : ''}${n.failed ? `, FAILED ${n.failed}` : ''}${tourStale ? `, tour stops to fix ${tourStale}` : ''}`,
)
process.exit(n.failed || n.conflicts || n.left || tourStale ? 1 : 0)
