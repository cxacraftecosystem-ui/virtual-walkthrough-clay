/**
 * The grand plan's crafts (GRAND §4, §5): silence, attribution and staging.
 *
 *  - while the traditions are unconfirmed, no survey tradition's name, place or caption is in
 *    any object's text; in curator review (`?review`) all 21 are;
 *  - no misattribution: a sourced scan never stands as a tradition's piece; every placed scan is
 *    credited and, if a visitor can open it, says what and where it is from ("Clay elsewhere",
 *    "In stone", …), or it is a generic form with a "Study" title;
 *  - the staging counts hold (§4.2), and nothing of the crafts list floats: wall pieces stand on
 *    a bracket, floor pieces carry a footprint.
 *
 * npm test
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { CRAFTS } from '../../src/museum/content/crafts'
import { SCENE_OBJECTS, type SceneObjectConfig } from '../../src/museum/config/objects'
import { GRAND_CRAFTS_OBJECTS } from '../../src/museum/config/grandObjects/crafts'
import { SOURCED_REGISTRY } from '../../src/museum/config/sourcedRegistry.generated'

const DEEP_DIVES = new Set(['bankura', 'molela', 'longpi'])
const texts = (o: SceneObjectConfig) => [o.title, o.description, o.alt, o.i18n?.hi?.title, o.i18n?.hi?.description, o.i18n?.hi?.alt, o.i18n?.bn?.title, o.i18n?.bn?.description, o.i18n?.bn?.alt].filter((t): t is string => !!t)

describe('grand crafts: placeholder silence (§4.1)', () => {
  it('names no survey tradition while they are unconfirmed', () => {
    const survey = CRAFTS.filter((c) => !DEEP_DIVES.has(c.slug))
    for (const o of SCENE_OBJECTS)
      for (const t of texts(o))
        for (const c of survey) {
          for (const s of [c.name, c.place, c.caption, c.i18n.hi?.name, c.i18n.bn?.name, c.i18n.hi?.caption, c.i18n.bn?.caption].filter((x): x is string => !!x))
            assert.ok(!t.includes(s), `${o.id} shows "${s.slice(0, 40)}" of ${c.slug}`)
        }
  })

  it('shows all 21 in curator review', async () => {
    const g = globalThis as { window?: unknown }
    const had = 'window' in g
    g.window = { location: { search: '?review' } }
    try {
      // a second instance of the module, built in review mode (a query makes it a new module)
      const url: string = '../../src/museum/config/grandObjects/crafts.ts?review'
      const mod = (await import(url)) as { GRAND_CRAFTS_OBJECTS: SceneObjectConfig[] }
      const all = mod.GRAND_CRAFTS_OBJECTS.flatMap(texts).join('\n')
      for (const c of CRAFTS) assert.ok(all.includes(c.name), `${c.slug} (${c.name}) is not shown in review`)
    } finally {
      if (!had) delete g.window
    }
  })

  it('keeps every tradition piece a titled placeholder study', () => {
    for (const o of GRAND_CRAFTS_OBJECTS.filter((x) => x.id.startsWith('craft-'))) {
      assert.equal(o.placeholder, true, `${o.id} is not a placeholder`)
      assert.match(o.title, /Study$/, `${o.id}: "${o.title}" is not a descriptive "Study" title`)
      assert.ok(o.i18n?.hi?.title && o.i18n?.bn?.title, `${o.id} has no Hindi or Bengali title`)
    }
  })
})

describe('grand crafts: no misattribution (§4.1, §5.3)', () => {
  const ELSEWHERE = /^(Clay elsewhere|In stone|Carved in|Cast in|Where clay becomes|From clay to stone|A sculpture by)/

  it('never gives a sourced scan a tradition’s id or title', () => {
    for (const o of SCENE_OBJECTS.filter((x) => x.kind === 'sourced-model')) {
      assert.ok(!o.id.startsWith('craft-'), `${o.id}: a sourced scan stands as a tradition's piece`)
      for (const c of CRAFTS) assert.ok(!o.title.includes(c.name), `${o.id} is titled with ${c.name}`)
    }
  })

  it('labels every placed scan: credited, with a finish, and either "elsewhere" or a generic form', () => {
    for (const o of SCENE_OBJECTS.filter((x) => x.kind === 'sourced-model')) {
      const slug = String(o.props?.slug ?? '')
      const e = SOURCED_REGISTRY[slug]
      assert.ok(e, `${o.id}: slug ${slug} is not in the registry`)
      assert.ok(typeof o.props?.finish === 'string', `${o.id} has no finish`)
      // a slug-only object takes its credit from the registry at mount (models/SceneObjects.tsx)
      assert.ok((o.credit?.author && o.credit.license) || (e.credit.author && e.credit.license), `${o.id} carries no credit`)
      if (o.interactive) assert.match(o.description ?? '', ELSEWHERE, `${o.id}: an exhibit scan must say what and where it is from`)
      else assert.ok(e.role === 'dressing' || e.role === 'tree' || e.role === 'rock' || /Study|stand|table|Bracket/i.test(o.title) || !o.description, `${o.id}: a scan shown without a label must be a generic form`)
    }
  })

  it('credits CC BY scans with their attribution line', () => {
    for (const [slug, e] of Object.entries(SOURCED_REGISTRY)) if (e.credit.license === 'CC-BY-4.0') assert.ok(e.credit.attribution.length > 10, `${slug}`)
  })
})

describe('grand crafts: staging (§4.2)', () => {
  const ids = new Set(GRAND_CRAFTS_OBJECTS.map((o) => o.id))

  it('has unique ids that do not collide with the rest of the scene', () => {
    assert.equal(ids.size, GRAND_CRAFTS_OBJECTS.length)
    const others = SCENE_OBJECTS.filter((o) => !GRAND_CRAFTS_OBJECTS.includes(o))
    for (const o of others) assert.ok(!ids.has(o.id), `${o.id} is listed twice`)
  })

  it('stages every tradition', () => {
    for (const c of CRAFTS) assert.ok([...ids].some((id) => id.startsWith(`craft-${c.slug}-`) || id === `craft-${c.slug}-wall`), `${c.slug} has no piece`)
  })

  it('stages the counts of the plan', () => {
    const count = (re: RegExp) => GRAND_CRAFTS_OBJECTS.filter((o) => re.test(o.id)).length
    assert.equal(count(/^craft-bankura-herd-/), 9, 'nine horses in The Herd')
    assert.equal(count(/^craft-molela-niche-/), 5, 'five niche plaques')
    assert.equal(count(/^craft-longpi-island-/), 12, 'twelve pieces of black ware')
    assert.equal(count(/-register-\d+$/), 24, 'twenty-four register pieces')
    assert.equal(count(/^craft-bishnupur-relief-/), 12, 'twelve relief panels')
    assert.equal(count(/-parikrama$/), 13, 'thirteen Parikrama niches')
    assert.equal(count(/^craft-majuli-mask-/), 5, 'five masks')
    assert.equal(count(/^craft-ayyanar-guardian-/), 2, 'two guardians')
    assert.ok(count(/-redroom-/) >= 50, 'the Red Room survey')
    assert.ok(GRAND_CRAFTS_OBJECTS.length >= 200)
  })

  it('stands the guardians as 4.2 m horses outdoors', () => {
    for (const o of GRAND_CRAFTS_OBJECTS.filter((x) => x.kind === 'ayyanar-horse' && x.zone === 'entrance-court')) assert.equal(o.props?.height, 4.2)
  })

  it('puts every raised piece on something', () => {
    // anything in the scene with a top: podiums, plinths, tables, the installations' furniture
    const supports = SCENE_OBJECTS.filter((o) => o.height !== undefined)
    for (const o of GRAND_CRAFTS_OBJECTS) {
      const y = o.position[1]
      if (y < 0.02 || o.kind === 'podium' || o.kind === 'relief-register') continue
      // on a podium of the row, on a support of this list, on another package's furniture, or in a niche (B, at the sill)
      const onRow = Math.abs(y - 1.2192) < 0.01
      const top = (s: SceneObjectConfig) => s.position[1] + (typeof s.props?.height === 'number' && s.kind !== 'sourced-model' ? (s.props.height as number) : (s.height ?? 0))
      const onSupport = supports.some((s) => s !== o && Math.hypot(s.position[0] - o.position[0], s.position[2] - o.position[2]) < 2.5 && Math.abs(top(s) - y) < 0.03)
      const inNiche = o.id.startsWith('craft-molela-niche-')
      assert.ok(onRow || onSupport || inNiche || o.zone === 'library' || o.zone === 'hallway-d', `${o.id} at y ${y.toFixed(2)} stands on nothing`)
    }
  })
})
