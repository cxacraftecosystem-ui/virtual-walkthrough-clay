import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { EXHIBITION_TITLE } from '../src/museum/config/infographics'
import captured from './landing/captured.json'
import { ExhibitionList } from './landing/ExhibitionList'
import { Shot } from './landing/Shot'
import { HeroMedia } from './landing/HeroMedia'
import { LandingNav, type NavLink } from './landing/LandingNav'
import './landing/landing.css'

export const metadata: Metadata = {
  title: 'Clay Traditions — A Virtual Pavilion',
}

/** Query params that belong to the 3D gallery (legacy links used to point at `/`). */
const GALLERY_PARAMS = ['autostart', 'quality', 'static', 'debug', 'tour', 'lang', 'renderer', 'exhibition', 'vr', 'noanalytics', 'decor', 'fx', 'shadows', 'area', 'ao', 'bloom', 'dpr']

/*
 * Every picture on this page is a real frame of the pavilion, captured by
 * `node scripts/capture-landing.mjs` into public/brand/landing/. That script also rewrites
 * ./landing/captured.json (bundled, so it works on serverless hosts where /public isn't on
 * disk); anything not listed renders as a quiet placeholder instead of a broken image.
 */
const IMG = '/brand/landing'
const CAPTURED = new Set<string>(captured.files)
const img = (name: string) => (CAPTURED.has(name) ? `${IMG}/${name}` : null)

const NAV: NavLink[] = [
  { href: '#about', label: 'The exhibition' },
  { href: '#spaces', label: 'Spaces' },
  { href: '#experience', label: 'Experience' },
  { href: '#visit', label: 'Visit' },
  { href: '#access', label: 'Access' },
]

const SPACES: { id: string; name: string; line: string; image: string; wide?: boolean }[] = [
  { id: 'entrance-court', name: 'Forecourt', line: 'The drum and its terracotta dome on a landscaped plinth, two tall clay horses either side of the way in.', image: 'forecourt.jpg', wide: true },
  { id: 'annex', name: 'The Earth Room', line: 'Tall formations of layered clay, curved shelves of everyday pots and a round table under a circle of sky.', image: 'annex.jpg' },
  { id: 'entry-e', name: 'Entry Ways', line: 'The title cut into raw clay, a long relief of mud and mirror, and the layers of the earth.', image: 'entry.jpg' },
  { id: 'inner', name: 'The Court', line: 'A coffered dome thirty-two metres across, open to the sky, over a still pool and a red clay lotus.', image: 'oculus.jpg', wide: true },
  { id: 'ring-a', name: 'Gallery A — Bankura', line: 'A herd of terracotta horses against a deep red wall, and a row of lit podiums.', image: 'gallery-a.jpg' },
  { id: 'ring-b', name: 'Gallery B — Molela', line: 'Clay plaques modelled in relief, in tall niches on a white wall.', image: 'gallery-b.jpg' },
  { id: 'ring-c', name: 'Gallery C — Longpi', line: 'Black pots of stone and clay, polished to a soft shine, under one cool light.', image: 'gallery-c.jpg' },
  { id: 'duplex', name: 'The Balcony', line: 'Halfway up the drum, a balcony round the galleries, with niches and reliefs up to the dome.', image: 'balcony.jpg' },
  { id: 'hallway-d', name: 'Hallway', line: 'A wine-red hall with a timber floor, where clay from other parts of the world stands on stepped plinths.', image: 'hallway.jpg' },
  { id: 'parikrama-west', name: 'Parikrama', line: 'An open walk winding between red walls, with trees in courtyards and horses in sunken gardens.', image: 'parikrama.jpg', wide: true },
  { id: 'atlas', name: 'Clay Atlas', line: 'The map of India and the partners who present the exhibition.', image: 'atlas.jpg' },
  { id: 'theatre', name: 'Agni Theatre', line: 'A dim room under a brick vault that glows like a kiln between films.', image: 'theatre.jpg' },
  { id: 'library', name: 'The Red Room', line: 'A round red room of curved shelves, holding clay from many regions of India, round a single pot under the sky.', image: 'library.jpg' },
  { id: 'shop', name: 'The Haat', line: 'Pieces made by potters, on shelves and tables under clay lanterns.', image: 'haat.jpg' },
  { id: 'sphere-well', name: 'The Sphere Well', line: 'Eight metres below the plinth, a red stair winds round a hanging clay sphere.', image: 'sphere-well.jpg' },
]

interface Feature {
  id: string
  title: string
  body: string
  image: string
  /** Second image, revealed diagonally (used for the time-of-day pair). */
  pair?: { image: string; labels: [string, string] }
  large?: boolean
  link?: { href: string; label: string }
}

const FEATURES: Feature[] = [
  {
    id: 'tour',
    title: 'A guided tour, space by space',
    body: 'A narrated walk from the forecourt to the Sphere Well. The caption card tells you what you are looking at — pause, skip or step off the route whenever you like. Curators can also lead live tours for groups.',
    image: 'f-tour.jpg',
    large: true,
    link: { href: '/gallery?autostart&tour', label: 'Start the guided tour' },
  },
  {
    id: 'rides',
    title: 'Up to the dome, down into the well',
    body: 'Ride up the east stair to the balcony or out onto the rim of the oculus, twenty metres above the lotus — or down the spiral of the Sphere Well.',
    image: 'f-rides.jpg',
  },
  {
    id: 'info',
    title: 'Every piece, explained',
    body: 'Select a work, a pot or a panel for the tradition it comes from and how it was made. Pieces recorded by other collections carry their credit.',
    image: 'f-info.jpg',
  },
  {
    id: 'inspect',
    title: 'Pieces in three dimensions',
    body: 'Lift a piece from its podium and turn it in your hands to see it from every side.',
    image: 'f-inspect.jpg',
  },
  {
    id: 'light',
    title: 'Light that changes',
    body: 'Morning, midday, golden hour, dusk and night — the circle of daylight from the oculus moves across the court, and the lotus opens with the sun.',
    image: 'f-golden.jpg',
    pair: { image: 'f-night.jpg', labels: ['Golden hour', 'Night'] },
  },
  {
    id: 'passport',
    title: 'A clay passport',
    body: 'Press a stamp into your clay tablet in every space, and ride to the balcony, the rim and the well for the rest.',
    image: 'f-passport.jpg',
  },
  {
    id: 'photo',
    title: 'Frames of clay',
    body: 'Hide the interface, choose a framed view — the dome’s eye, the herd, the Red Room — and save a still to keep or share.',
    image: 'f-photo.jpg',
  },
]

const STEPS: { title: string; body: string }[] = [
  { title: 'Open the gallery', body: 'It runs in any modern browser — Chrome, Edge, Safari or Firefox. Nothing to install.' },
  { title: 'Walk at eye level', body: 'Drag to look and use W A S D or the arrow keys to walk — or click the floor to stroll there. On a phone, use the on-screen joystick.' },
  { title: 'Find your way', body: 'The floor plan (M) takes you to any space in one step, and H shows every control. A brisk walk (Shift) helps in a pavilion this size.' },
  { title: 'Bring a headset', body: 'On a VR headset the whole pavilion opens in immersive mode, at true scale.' },
]

const ACCESS: string[] = [
  'An accessible text-only guide to every space and work',
  'Reduced motion, high contrast and large text settings',
  'Full keyboard control and screen-reader labels',
  'Narrated tour captions, read aloud in your language',
]

function SectionHead({ num, eyebrow, title, lede, id }: { num: string; eyebrow: string; title: string; lede?: string; id: string }) {
  return (
    <header className="lp-head" data-reveal>
      <p className="lp-eyebrow">
        <span>{num}</span>
        {eyebrow}
      </p>
      <div className="lp-head__row">
        <h2 id={id} className="lp-h2">
          {title}
        </h2>
        {lede && <p className="lp-lede">{lede}</p>}
      </div>
    </header>
  )
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>

export default async function LandingPage({ searchParams }: { searchParams: SearchParams }) {
  // Legacy deep links (`/?autostart…`) and museum-only params go straight to the gallery.
  const sp = await searchParams
  if (Object.keys(sp).some((k) => GALLERY_PARAMS.includes(k))) {
    const qs = new URLSearchParams()
    for (const [k, v] of Object.entries(sp)) {
      if (Array.isArray(v)) v.forEach((x) => qs.append(k, x))
      else if (v !== undefined) qs.append(k, v)
    }
    const q = qs.toString().replace(/=(&|$)/g, '$1')
    redirect(`/gallery${q ? `?${q}` : ''}`)
  }

  const t = EXHIBITION_TITLE
  const heroVideo = img('hero.webm')
  // Poster: the film's first frame, else the hero still, else any captured space (never the
  // share card — it has the title baked in). Nothing captured → a quiet dark gradient.
  const heroPoster = (heroVideo && img('hero-film.jpg')) || img('hero.jpg') || img('oculus.jpg') || img('annex.jpg')
  const closing = img('forecourt.jpg') ?? img('hero.jpg') ?? img('oculus.jpg')
  const year = new Date().getFullYear()

  return (
    <div className="lp" id="top">
      <a className="lp-skip" href="#main">
        Skip to content
      </a>
      <LandingNav links={NAV} />

      <main id="main">
        {/* ─────────────────────────────── Hero */}
        <section className="lp-hero" aria-labelledby="lp-title">
          <HeroMedia poster={heroPoster} video={heroVideo} alt="Inside the virtual pavilion: the oculus court, with daylight falling on the round plinth" />
          <div className="lp-hero__scrim" aria-hidden="true" />
          <div className="lp-hero__inner lp-wrap">
            <div className="lp-hero__text">
              <p className="lp-hero__kicker">{t.kicker}</p>
              <h1 id="lp-title" className="lp-hero__title">
                {t.title}
              </h1>
              <p className="lp-hero__sub">Earth, water, hand and fire — walk through clay traditions of India under a thirty-two-metre dome, in your browser.</p>
              <div className="lp-cta">
                <a className="lp-btn lp-btn--primary lp-btn--lg" href="/gallery">
                  Enter the virtual pavilion
                  <svg className="lp-btn__arrow" viewBox="0 0 20 20" aria-hidden="true">
                    <path d="M4 10h11M11 5.5 15.5 10 11 14.5" />
                  </svg>
                </a>
                <a className="lp-btn lp-btn--glass lp-btn--lg" href="/gallery?autostart&tour">
                  <svg className="lp-btn__play" viewBox="0 0 20 20" aria-hidden="true">
                    <circle cx="10" cy="10" r="8.25" />
                    <path d="M8.3 6.9v6.2l5-3.1z" />
                  </svg>
                  Take the guided tour
                </a>
              </div>
            </div>
            <dl className="lp-hero__facts">
              <div>
                <dt>Spaces</dt>
                <dd>Fifteen to explore</dd>
              </div>
              <div>
                <dt>Languages</dt>
                <dd>
                  English · <span lang="hi">हिन्दी</span> · <span lang="bn">বাংলা</span>
                </dd>
              </div>
              <div>
                <dt>Admission</dt>
                <dd>Free, in the browser</dd>
              </div>
            </dl>
          </div>
          <a className="lp-scroll" href="#about">
            <span>Scroll</span>
            <span className="lp-scroll__line" aria-hidden="true" />
          </a>
        </section>

        {/* ─────────────────────────────── 01 Intro */}
        <section className="lp-section lp-intro" aria-labelledby="about">
          <div className="lp-wrap lp-intro__grid">
            <div data-reveal>
              <p className="lp-eyebrow">
                <span>01</span>The exhibition
              </p>
              <h2 id="about" className="lp-h2 lp-intro__title">
                Every piece begins as a handful of earth.
              </h2>
            </div>
            <div className="lp-intro__body" data-reveal>
              <p className="lp-intro__lead">{t.intro}</p>
              <p>
                Clay is dug, cleaned and kneaded, shaped on the wheel, by hand or in a mould, dried in the shade and fired. This virtual pavilion gathers traditions that work it in different ways. Its three galleries hold the terracotta of
                Bankura in West Bengal, the votive plaques of Molela in Rajasthan and the black pottery of Longpi in Manipur, round a court under a dome thirty-two metres across; the Red Room in the north wing holds clay from many more
                regions of India.
              </p>
              <ul className="lp-intro__facts">
                <li>
                  <strong>{SPACES.length}</strong>
                  <span>spaces to walk through</span>
                </li>
                <li>
                  <strong>3</strong>
                  <span>interface languages</span>
                </li>
                <li>
                  <strong>0</strong>
                  <span>downloads or sign-up needed</span>
                </li>
              </ul>
            </div>
          </div>
        </section>

        <ExhibitionList />

        {/* ─────────────────────────────── 02 Spaces */}
        <section className="lp-section lp-spaces" aria-labelledby="spaces">
          <div className="lp-wrap">
            <SectionHead id="spaces" num="02" eyebrow="Explore the spaces" title="A pavilion you can walk through" lede="From the Earth Room to the court under the dome, round the Parikrama and down into the Sphere Well, each space holds a part of the story. Choose one to begin there." />
            <ul className="lp-spaces__grid">
              {SPACES.map((s, i) => (
                <li key={s.id} className={s.wide ? 'is-wide' : undefined} data-reveal>
                  <a className="lp-space" href={`/gallery#zone=${s.id}`}>
                    <Shot src={img(s.image)} alt="" label={s.name} className="lp-space__img" />
                    <span className="lp-space__meta">
                      <span className="lp-space__num">{String(i + 1).padStart(2, '0')}</span>
                      <span className="lp-space__name">{s.name}</span>
                    </span>
                    <span className="lp-space__line">{s.line}</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ─────────────────────────────── 03 Experience */}
        <section className="lp-section lp-exp" aria-labelledby="experience">
          <div className="lp-wrap">
            <SectionHead id="experience" num="03" eyebrow="The experience" title="More than looking" lede="Every picture below is the pavilion itself — the tours, tools and spaces you will find inside." />
            <ul className="lp-exp__grid">
              {FEATURES.map((f) => {
                const a = img(f.image)
                const b = f.pair ? img(f.pair.image) : null
                return (
                  <li key={f.id} className={`lp-feature${f.large ? ' is-large' : ''}`} data-reveal>
                    {f.pair && a && b ? (
                      <span className="lp-shot lp-feature__img lp-pair">
                        <img src={a} alt={`${f.title}: ${f.pair.labels[0]}`} loading="lazy" decoding="async" />
                        <img className="lp-pair__b" src={b} alt={`${f.title}: ${f.pair.labels[1]}`} loading="lazy" decoding="async" />
                        <span className="lp-pair__label lp-pair__label--a">{f.pair.labels[0]}</span>
                        <span className="lp-pair__label lp-pair__label--b">{f.pair.labels[1]}</span>
                      </span>
                    ) : (
                      <Shot src={a} alt={`${f.title} — in the virtual pavilion`} label={f.title} className="lp-feature__img" />
                    )}
                    <div className="lp-feature__text">
                      <h3>{f.title}</h3>
                      <p>{f.body}</p>
                      {f.link && (
                        <a className="lp-link" href={f.link.href}>
                          {f.link.label}
                          <svg viewBox="0 0 20 20" aria-hidden="true">
                            <path d="M4 10h11M11 5.5 15.5 10 11 14.5" />
                          </svg>
                        </a>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>
        </section>

        {/* ─────────────────────────────── 04 Visit */}
        <section className="lp-section lp-visit" aria-labelledby="visit">
          <div className="lp-wrap lp-split">
            <div className="lp-split__media" data-reveal>
              <Shot src={img('f-walk.jpg')} alt="Walking through Gallery A, with the floor plan open in the corner" label="Walking the galleries" className="lp-split__img" />
            </div>
            <div className="lp-split__text" data-reveal>
              <p className="lp-eyebrow">
                <span>04</span>Plan your visit
              </p>
              <h2 id="visit" className="lp-h2">
                Walk it like a museum
              </h2>
              <ol className="lp-steps">
                {STEPS.map((s) => (
                  <li key={s.title}>
                    <h3>{s.title}</h3>
                    <p>{s.body}</p>
                  </li>
                ))}
              </ol>
              <p className="lp-small">Best on a desktop or laptop, with headphones. Tablets and phones work too — turn them sideways for the widest view.</p>
            </div>
          </div>
        </section>

        {/* ─────────────────────────────── 05 Access */}
        <section className="lp-section lp-access" aria-labelledby="access">
          <div className="lp-wrap lp-split lp-split--flip">
            <div className="lp-split__media" data-reveal>
              <Shot src={img('f-hindi.jpg')} alt="The pavilion interface in Hindi, with a work’s information panel open" label="The pavilion in Hindi" className="lp-split__img" />
            </div>
            <div className="lp-split__text" data-reveal>
              <p className="lp-eyebrow">
                <span>05</span>Accessibility &amp; languages
              </p>
              <h2 id="access" className="lp-h2">
                Open to everyone
              </h2>
              <p className="lp-langs" aria-label="Available languages">
                <span lang="en">English</span>
                <span lang="hi">हिन्दी</span>
                <span lang="bn">বাংলা</span>
              </p>
              <p className="lp-body">The whole pavilion — labels, captions, tour narration and controls — switches language at any time, from the entry screen or the toolbar.</p>
              <ul className="lp-checks">
                {ACCESS.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
              <a className="lp-link" href="/guide">
                Open the accessible text guide
                <svg viewBox="0 0 20 20" aria-hidden="true">
                  <path d="M4 10h11M11 5.5 15.5 10 11 14.5" />
                </svg>
              </a>
            </div>
          </div>
        </section>

        {/* ─────────────────────────────── Partners */}
        <section className="lp-partners" aria-labelledby="lp-partners">
          <div className="lp-wrap" data-reveal>
            <h2 id="lp-partners" className="lp-eyebrow lp-eyebrow--center">
              Presented by
            </h2>
            <ul className="lp-partners__logos">
              <li>
                <img src="/brand/dc-handicrafts.png" width={642} height={240} alt="DC Handicrafts — Indian Handicrafts, continuing tradition" loading="lazy" />
                <span>DC Handicrafts</span>
              </li>
              <li aria-hidden="true" className="lp-partners__rule" />
              <li>
                <img src="/brand/iit-kharagpur.svg" width={268} height={300} alt="Indian Institute of Technology Kharagpur" loading="lazy" />
                <span>IIT Kharagpur</span>
              </li>
            </ul>
          </div>
        </section>

        {/* ─────────────────────────────── Closing CTA */}
        <section className="lp-closing" aria-labelledby="lp-closing">
          {closing && <img className="lp-closing__img" src={closing} alt="" loading="lazy" decoding="async" />}
          <div className="lp-closing__scrim" aria-hidden="true" />
          <div className="lp-wrap lp-closing__inner" data-reveal>
            <p className="lp-hero__kicker">The pavilion is open</p>
            <h2 id="lp-closing" className="lp-closing__title">
              Step inside
            </h2>
            <div className="lp-cta lp-cta--center">
              <a className="lp-btn lp-btn--primary lp-btn--lg" href="/gallery">
                Enter the virtual pavilion
                <svg className="lp-btn__arrow" viewBox="0 0 20 20" aria-hidden="true">
                  <path d="M4 10h11M11 5.5 15.5 10 11 14.5" />
                </svg>
              </a>
              <a className="lp-btn lp-btn--glass lp-btn--lg" href="/gallery?autostart&tour">
                Take the guided tour
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer className="lp-foot">
        <div className="lp-wrap lp-foot__grid">
          <div className="lp-foot__brand">
            <p className="lp-foot__title">Clay Traditions</p>
            <p>A virtual pavilion, presented by DC Handicrafts and IIT Kharagpur.</p>
          </div>
          <nav className="lp-foot__col" aria-label="Visit">
            <p className="lp-foot__label">Visit</p>
            <a href="/gallery">Virtual pavilion</a>
            <a href="/gallery?autostart&tour">Guided tour</a>
            <a href="/guide">Accessible text guide</a>
            <a href="/credits">Credits</a>
          </nav>
          <nav className="lp-foot__col" aria-label="About">
            <p className="lp-foot__label">Exhibition</p>
            <a href="#about">About</a>
            <a href="#spaces">Spaces</a>
            <a href="/admin">Curators</a>
          </nav>
        </div>
        <div className="lp-wrap lp-foot__base">
          <span>© {year} Clay Traditions — A Virtual Pavilion</span>
          <a href="#top">Back to top ↑</a>
        </div>
      </footer>
    </div>
  )
}
