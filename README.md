# Clay Traditions — Virtual Pavilion

A web-based, real-time 3D pavilion of three Indian clay traditions — **Bankura terracotta** (West Bengal),
the **votive plaques of Molela** (Rajasthan) and **Longpi black pottery** (Manipur) — built with
**Next.js 16**, React 19, TypeScript, Three.js (r186), React Three Fiber and drei, with a Postgres/S3-ready
backend and admin (Next.js Route Handlers).

The building follows the *Clay exhibition layout* drawings (sectional plan, top 3D view, elevation and the
front-entrance spawn point): a round, double-height pavilion on a landscaped plinth, entered through a
straight annex. Inside, a description wall and a taller inner wall hold back the view; three tradition
galleries follow the drum wall past a row of slender podiums; the centre opens to the sky through an
oculus over a round, stepped plinth; a curved hallway leads back to the entrance.

This app is the sister of the **hand block printing museum** (`virtual-walkthrough`). The two are separate
deployments of the same code base that **share one Postgres database and one S3 bucket** — see
*Two apps, one database* below.

---

## The pavilion

| Space | Zone id | What is there |
|---|---|---|
| Entrance forecourt | `entrance-court` | The spawn point, 7 m outside the door, facing in; planters; benches on the plinth |
| G — Entrance hall | `annex` | 15 ft wide; the *Three traditions* panel (east wall); the Visitors' Shelf (west wall) |
| H — Description wall | (`annex`) | Exhibition title and introduction (`EXHIBITION_TITLE`, surface `h-description`) |
| E — Entry ways | `entry-e` | The two ways round H; F's outer face; the Gallery A panel |
| A — Bankura terracotta | `ring-a` | 3 podiums (horses, a water pot); a relief at eye level, two in the upper register |
| B — Molela plaques | `ring-b` | 5 podiums (three plaques, cups, a lamp); three works above; the visitors' potter's wheel |
| C — Longpi pottery | `ring-c` | 3 podiums (kettle, bowl, cooking pot); three works on the curved hallway wall; a bench |
| Oculus court | `inner` | The open oculus over the stepped plinth; the exhibition statement on F's court face |
| D — Hallway | `hallway-d` | Five making panels (prepare, form, dry, fire, finish); drying shelves, unfired and fired |

Each tradition has five hero pieces: two hung works (`hero: true` in `config/artworks.ts`) and three podium
pieces (`PODIUM_PIECES` in `config/objects.ts`). The guided tour runs forecourt → entrance hall → F → E →
A → B → C → oculus court → hallway (`config/tour.ts`, captions in English, Hindi and Bengali).

**Everything the workshop has not yet supplied is a stand-in**, flagged `placeholder: true` and silent to
visitors: works are procedural studies described as "made for this exhibition, in the manner of …", podium
pieces are procedural models, maker profiles are hidden. See `docs/CONTENT_STILL_NEEDED.md`.

---

## How to run

```bash
npm install
npm run dev          # http://localhost:3000   (landing at /, pavilion at /gallery, admin at /admin)
```

Locally there is nothing to configure: SQLite (`.data/museum.sqlite`) and disk media (`.data/media`) are used
automatically. Dev admin login: `admin@museum.local` / `admin12345` (set `ADMIN_EMAIL` / `ADMIN_PASSWORD` to
change). Never set `USE_REMOTE=1` for everyday work — it points the dev server at the production database and
bucket, which the hand block museum shares.

Useful URL parameters (on `/gallery`):

| Parameter | Effect |
|---|---|
| `?quality=low\|medium\|high\|ultra\|auto` | force a graphics tier (also selectable in the UI) |
| `?autostart` | skip the "Enter" button once loading completes (`&tour` starts the guided tour) |
| `?static` | ignore the backend (bundled content, social features hidden) |
| `?lang=hi\|bn` | Hindi / Bengali interface and captions |
| `?debug` | **dev only** — FPS/GPU stats, collision shapes, coordinates |
| `?noarrival` | skip the arrival flight |
| `#zone=ring-b`, `#object=clay-a-horse`, `#artwork=clay-c-01` | deep links (also used by the QR labels, `/qr/<kind>/<id>`) |

Controls: drag to look (or **L** for mouse-look), **WASD**/arrows to walk, click the floor to walk there, click a
work or a piece for details, **E** for the nearby item, **M** map, **T** time of day, **P** photo mode, **H** help.

## How to build

```bash
npm run build        # next build
npm run start        # production server on http://localhost:3000
npm run typecheck    # TypeScript 7, the native compiler
npm run lint
npm test             # unit tests (tests/unit), no database needed — includes the pavilion geometry tests
```

Node.js 24. As in the hand block museum, TypeScript 7 (`@typescript/native`) runs the typecheck and TypeScript 6
(`typescript`) serves typescript-eslint and `next build`.

## How to deploy

Vercel (native Next.js), as a **separate project** from the hand block museum, with the **same**
`DATABASE_URL` (Supabase Postgres) and the **same** S3 bucket (`S3_BUCKET`, `AWS_REGION`, optional CloudFront
`S3_PUBLIC_BASE_URL`). Set in addition:

| Variable | Clay pavilion | Why |
|---|---|---|
| `NEXT_PUBLIC_LIVE_ROOM` | `clay-pavilion` (the default from `src/site.ts`) | live tours and presence must not mix with the museum's room |
| `NEXT_PUBLIC_SITE_URL` | the pavilion's origin | canonical URLs, sitemap, share cards, QR labels |
| `GOOGLE_CLIENT_ID` | the same client, with the pavilion's origin added to its authorised JavaScript origins | staff keep one Google sign-in |

See `infra/deploy-vercel.md`, `infra/setup-supabase.md` and `.env.example` for the rest; they apply unchanged.

### Two apps, one database

`src/site.ts` is the only file that differs by design between the two repositories:

```ts
SITE = { id: 'clay', defaultExhibitionId: 'clay-traditions', liveRoom: 'clay-pavilion', metaPrefix: 'clay:', … }
```

Every per-site row in the shared database (exhibitions, makers, media, visitor pots, comments, favourites,
analytics, client errors) carries `site = SITE.id`, so each app reads and writes only its own. Users, sessions and
the access list are shared: a curator signs in once and has the same role in both admins. Meta keys this app owns
are prefixed `clay:` (`seeded_at`, …), so seeding one site never counts as seeding the other. On first start the
server makes sure the `clay-traditions` exhibition exists for this site and seeds it from the bundled config
(`src/museum/config`). Exhibition ids are global, so a new exhibition here must not reuse an id from the museum.

Migrations are shared too: both apps run the same `supabase/migrations/*.sql`; the runner takes an advisory lock and
refuses a migration whose checksum differs from the one recorded, so deploy migrations from one app at a time.

These must be **identical** in both deployments: `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `MASTER_ADMIN_EMAILS` (otherwise
each cold start re-syncs the access list's master rows and re-hashes the admin password, revoking the other app's
admin sessions), `LIVE_TOKEN_SECRET`, `S3_PREFIX` (media rows store keys without it; each app rebuilds addresses
with its own), `DATABASE_URL`, `S3_BUCKET` and `S3_PUBLIC_BASE_URL`. Uploads are told apart by their `site` column,
not by folder. The S3 CORS rule needs the pavilion's origin for direct uploads (`infra/s3-cors.json`). Deploy the hand block museum's site-aware build first: until it has started against
the shared database, the pavilion does not create its exhibition and refuses to start (`docs/API.md`). Deploy order
and the rest: the hand block museum's README → *Two apps, one database*, and `infra/deploy-vercel.md` → *The second
app*.

---

## Project structure

```
src/site.ts        which site this build is (see above)
src/museum/
  config/          ← ALL content and constants (edit these, not the rendering code)
    museum.ts        pavilion dimensions (ft → m), drum and ring radii, annex, walls H / F / D, oculus, podiums
    layout.ts        derived walls (arcs and segments), display surfaces (faceted runs), zones, podium slots
    plan.ts          FLOOR_PLAN — the SVG plan the minimap and the admin heatmap draw
    artworks.ts      hung works (images, placement, frames, metadata) + TRADITIONS, atAngle(), midAt()
    objects.ts       podium pieces, oculus plinth, potter's wheel, Visitors' Shelf, shelves, benches
    infographics.ts  wall panels, the H title wall text, the welcome text
    amenities.ts     wayfinding totems and the "Find the motifs" trail
    tour.ts          guided-tour stops + navigation waypoints
    videos.ts        film screens (none yet)
    exhibits.ts      table pieces (none: the pavilion displays on podiums)
  architecture/    walls, roof and oculus, floor, landscape
  models/          procedural models — clay.tsx (vessels, horse, plaque, oculus plinth, shelves, podium)
  studio/          the potter's-wheel studio (shape, finish, fire, set on the Visitors' Shelf)
  i18n/            en / hi / bn dictionaries and tour captions
app/               landing (/), /gallery, /guide (text-only guide), /makers/<id>, /qr/<kind>/<id>, admin, api
src/server/        backend (Postgres/SQLite, S3/disk storage, auth, analytics)
public/artworks/   placeholder studies (scripts/generate-placeholders.mjs) — replace with photographs
```

Scale: **1 unit = 1 metre**. Axes: +x east, +y up, **−z north**; the entrance faces +z and the visitor walks in
facing −z. Plan angles are measured from +x towards +z (`polar(r, aDeg)` in `config/museum.ts`).

## How to add or move a work

Every display surface in the pavilion is a straight run ('along'), cut from the curved walls as facets. `at` is
metres along the run from its start (the admin labels it "metres along wall"). In code, `atAngle(surface, aDeg)`
gives the `at` where a plan angle meets a surface and `midAt(surface)` its middle:

```ts
work('a', 'clay-a-04', ['Title', 'शीर्षक', 'শিরোনাম'], { surface: 'a-outer-1', at: atAngle('a-outer-1', 28), centerHeight: 1.6 }, {
  maxWidth: 0.9, maxHeight: 1.2, frame: 'natural-wood', alt: '…', altHi: '…', altBn: '…',
})
```

Above the podium row use `centerHeight: 2.85` and `label: false` (the upper register). The surfaces and their
lengths are listed in `config/layout.ts` (`SurfaceId`); the plan render in the admin heatmap shows where they are.
Curators normally do all of this in the admin (Content), which writes to the database instead of the config.

To put a piece on a podium, add an entry to `PODIUM_PIECES` in `config/objects.ts` with the slot id (`pod-a-1` …
`pod-c-3`), a kind (`clay-vessel` with `form` / `clay` / `burnish`, `terracotta-horse`, `votive-plaque` with
`motif`) and a height; it stands on the podium top facing the court. To show a scan instead, set `model` to a GLB.

## Placeholders

```bash
node scripts/generate-placeholders.mjs            # the nine studies → public/artworks/*.jpg + .2048/.1024.webp
BRAND=1 FORCE=1 node scripts/generate-placeholders.mjs   # also the share card and app icon
```

The generator draws in headless Chrome (`CHROME_PATH` if Chrome is not at the default Windows location) and never
overwrites an existing file without `FORCE=1`, so photographs dropped in under the same names are safe.
`app/landing/captured.json` lists the landing-page screenshots; it is empty until the pavilion's frames are
captured, and the landing page shows quiet clay-ring panels meanwhile.

## Design assumptions (the drawings are concept sketches without a dimension grid)

- **Scale.** "Dia 70 ft (approx)" and the 15 ft entrance agree at one scale only if 70 ft is the large drum
  lobe round the annex: its interior face is R = 10.67 m. The A/B/C gallery ring is the smaller circle of the
  drawing, interior face 7.85 m, joined to the lobe by two radial notch walls (north-east by E, south-west at D).
- **Height** 20 ft (6.1 m) overall: 5.75 m clear plus a 0.35 m roof. "Duplex" is read as double height with the
  band at 10 ft seen in the elevation; there is no upper floor.
- **Annex G** 4.57 m clear (15 ft), about 30 ft beyond the lobe; door 2.1 × 3.6 m. The visitor spawns on the
  forecourt outside it, facing in (the drawing's annex points east; the app turns it to face +z).
- **H** is the free-standing curved wall at the annex mouth; **E** the two ways round its ends; **F** a taller curved
  wall behind it that hides the oculus court; **D** the hallway between the drum and a curved inner wall.
- **Oculus** 2.6 m radius over a stepped plinth of the drawn concentric rings (3.15 / 2.6 / 2.05 / 1.8 m).
- **Podiums** 12 in × 12 in × 4 ft, eleven as drawn (3 in A, 5 in B, 3 in C), on a 6.9 m circle; short fins
  separate the galleries.
- **Landscape plinth** 15.1 m radius; the paved forecourt extends beyond it in front of the door.
- **Palette** terracotta, rose clay and ochre, with deep oxblood walls for drama (the inspiration pages); warm
  white to neutral track light, daylight through the oculus.
- **Content** — the three traditions are working titles; the panel text keeps to general facts about working clay
  and a few widely documented facts about each tradition, all flagged for the workshop to confirm.

---

## Backend & admin

Identical to the hand block museum (the admin code is byte-identical in both repositories): content, media
library, exhibitions, makers, visitor pots (the *Visitor prints* queue), comments, analytics and curator
heatmaps, client errors, users and the access list, with an audit log and per-item history. The API contract is
`docs/API.md`; roles, Google sign-in, the two storage modes, migrations, retention and the security notes are
described in the hand block museum's README and apply unchanged.

- Run: `npm run dev`, then `/admin`. Content saves bump the content version; the pavilion loads `/api/content` at
  start-up and falls back to the bundled config when the API is unreachable.
- Reset: admin → Content → *Reset to defaults* re-seeds the current exhibition from `src/museum/config`.
- Makers: the seeded profiles are empty stand-ins, hidden from visitors (`/makers/<id>` answers "not found" for
  them) until a curator enters what the workshop supplies and clears *Hidden from visitors*.
- Content capture (photographs, scans, text): `docs/CONTENT_CAPTURE.md`.

Every save, delete and restore of an item is kept as a revision (admin: history, restore, trash), and every admin
change — content, texts, tour, exhibitions, makers, media, moderation, roles, access list, analytics retention —
writes one line to the activity log (`GET /api/admin/activity`, the dashboard's *Recent activity*). An editor sends
the stamp it loaded (`X-Expected-Updated-At`), so a save that would overwrite a colleague's newer change is refused
with a 409 that carries their version.

```
src/server/
  contentStore.ts       content rows (JSON/jsonb) + version, revisions, seeding from bundledContent()
  site.ts               the site every query is scoped to (src/site.ts), metaKey(), runAsSite() for tests
  audit.ts              the activity log (audit_log)
  handlers/             content, auth (+ Google), favorites, comments, analytics, media, users (+ access list),
                        overview (dashboard + activity)
supabase/migrations/    Postgres schema, byte-identical with the hand block museum's
```
