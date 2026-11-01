import type { Metadata } from 'next'
import { PBR_CREDITS, SOURCED_REGISTRY, type SourcedCredit } from '../../src/museum/config/sourcedRegistry.generated'
import cc0Library from '../../public/models/cc0/CREDITS.json'
import './credits.css'

/**
 * /credits — every 3D model and material the pavilion uses that was made by someone else
 * (GRAND §5.3): the sourced models (scripts/optimize-sourced.mjs → the generated registry), the
 * ambientCG material library, and the Poly Haven props of the original build. Each line names
 * the work, its author, where it was found and its licence, with a link to both; works under
 * CC BY 4.0 carry their attribution line as the licence asks.
 */

export const metadata: Metadata = {
  title: 'Credits — Clay Traditions',
  description: 'The 3D models, scans and materials used in the Clay Traditions virtual pavilion, with their authors, sources and licences.',
}

const LICENCE_NAME: Record<SourcedCredit['license'], string> = {
  CC0: 'CC0 1.0 (public domain dedication)',
  'CC-BY-4.0': 'CC BY 4.0',
  PD: 'Public domain (Wikimedia Commons tag)',
}

const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

interface Row {
  key: string
  credit: SourcedCredit
}

function CreditList({ rows }: { rows: Row[] }) {
  return (
    <ul className="credits-list">
      {rows.map(({ key, credit: c }) => (
        <li key={key} className="credits-item">
          <p className="credits-title">{c.title}</p>
          <p className="credits-meta">
            <span>{c.author}</span>
            {' · '}
            <a href={c.source} target="_blank" rel="noopener noreferrer">
              {hostOf(c.source)}
            </a>
            {' · '}
            <a href={c.licenseUrl} target="_blank" rel="noopener noreferrer license">
              {LICENCE_NAME[c.license]}
            </a>
          </p>
          {c.license === 'CC-BY-4.0' && <p className="credits-attribution">{c.attribution}</p>}
        </li>
      ))}
    </ul>
  )
}

interface Cc0Model {
  id: string
  name: string
  authors: string[]
  url: string
}

export default function CreditsPage() {
  const models: Row[] = Object.entries(SOURCED_REGISTRY)
    .map(([slug, e]) => ({ key: slug, credit: e.credit }))
    .sort((a, b) => a.credit.title.localeCompare(b.credit.title))
  const ccBy = models.filter((r) => r.credit.license === 'CC-BY-4.0')
  const others = models.filter((r) => r.credit.license !== 'CC-BY-4.0')
  const materials: Row[] = PBR_CREDITS.map((c) => ({ key: c.title, credit: c }))
  const props: Row[] = ((cc0Library as { models?: Cc0Model[] }).models ?? []).map((m) => ({
    key: m.id,
    credit: { title: m.name, author: m.authors.join(', '), source: m.url, license: 'CC0', licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/', attribution: '' },
  }))
  return (
    <main className="credits-root">
      <div className="credits-page">
        <header className="credits-head">
          <p className="credits-kicker">Clay Traditions</p>
          <h1>Credits</h1>
          <p className="credits-lede">
            Some of what you see in the pavilion was made by others and shared openly: 3D scans from museums, models and materials from open libraries. They are listed here with their authors and licences. Objects from other places and times are shown as themselves, in the
            Wine Hall, “Clay Elsewhere”.
          </p>
          <p className="credits-back">
            <a href="/">Back to the pavilion</a>
          </p>
        </header>

        <section aria-labelledby="by">
          <h2 id="by">Scans shared under CC BY 4.0</h2>
          <p className="credits-note">These works ask to be credited. Each is shown with the attribution line its licence requires.</p>
          <CreditList rows={ccBy} />
        </section>

        <section aria-labelledby="models">
          <h2 id="models">3D models and scans</h2>
          <p className="credits-note">Public domain or CC0: free to use without conditions, credited here all the same.</p>
          <CreditList rows={others} />
        </section>

        <section aria-labelledby="materials">
          <h2 id="materials">Materials</h2>
          <p className="credits-note">The surfaces of walls, floors and the dome are built from these texture sets.</p>
          <CreditList rows={materials} />
        </section>

        {props.length > 0 && (
          <section aria-labelledby="props">
            <h2 id="props">Props</h2>
            <CreditList rows={props} />
          </section>
        )}
      </div>
    </main>
  )
}
