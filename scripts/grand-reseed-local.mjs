/**
 * Re-seed the clay pavilion's LOCAL content after the grand rescale (GRAND §1.3 #8).
 *
 * Content curated on the old, smaller plan carries coordinates that would float in mid-air in
 * the grand rotunda (the museum keeps its bundled objects and tour while the server's content
 * predates layout epoch 2, and says so in the console). This script clears the clay site's rows
 * from CLAY's own local SQLite database so the next server start seeds it again from the
 * bundled content:
 *   - deletes the `content_items` of every exhibition whose `site` is 'clay';
 *   - deletes the meta key `clay:seeded_at`, so the bootstrap seeds again.
 * Revisions, the audit log and every other site's rows are left alone.
 *
 * It refuses to run against anything but a local file under `.data/`: never with USE_REMOTE set,
 * never with a DATABASE_URL, never on a path outside the project's `.data/` folder. Production
 * content is never touched.
 *
 *   node scripts/grand-reseed-local.mjs [--db .data/museum.sqlite] [--dry]
 *
 * Stop the dev server first (the database is opened for writing).
 */
import { existsSync } from 'node:fs'
import { dirname, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DatabaseSync } from 'node:sqlite'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 && i + 1 < args.length ? args[i + 1] : def
}
const DRY = args.includes('--dry')
const SITE = 'clay'

function refuse(why) {
  console.error(`grand-reseed-local: refusing — ${why}`)
  process.exit(2)
}

const on = (v) => ['1', 'true', 'yes', 'on'].includes(String(v ?? '').trim().toLowerCase())
if (on(process.env.USE_REMOTE)) refuse('USE_REMOTE is set')
if (process.env.DATABASE_URL) refuse('DATABASE_URL is set (this script only ever touches the local SQLite file)')
const db = resolve(ROOT, opt('db', process.env.DB_PATH ?? '.data/museum.sqlite'))
const dataDir = resolve(ROOT, '.data') + sep
if (!db.startsWith(dataDir)) refuse(`${db} is not under ${dataDir}`)
if (!existsSync(db)) refuse(`${relative(ROOT, db)} does not exist`)

const conn = new DatabaseSync(db)
try {
  const exhibitions = conn.prepare('SELECT id FROM exhibitions WHERE site = ?').all(SITE).map((r) => String(r.id))
  const count = (id) => Number(conn.prepare('SELECT COUNT(*) AS n FROM content_items WHERE exhibition_id = ?').get(id).n)
  for (const id of exhibitions) console.log(`  ${id}: ${count(id)} content item(s)`)
  if (DRY) {
    console.log('dry run: nothing deleted')
  } else {
    conn.exec('BEGIN')
    for (const id of exhibitions) conn.prepare('DELETE FROM content_items WHERE exhibition_id = ?').run(id)
    conn.prepare('DELETE FROM meta WHERE key = ?').run(`${SITE}:seeded_at`)
    conn.exec('COMMIT')
    console.log(`cleared ${exhibitions.length} clay exhibition(s) in ${relative(ROOT, db)}; the next server start seeds them from the bundled content`)
  }
} catch (e) {
  try {
    conn.exec('ROLLBACK')
  } catch {
    /* not in a transaction */
  }
  throw e
} finally {
  conn.close()
}
