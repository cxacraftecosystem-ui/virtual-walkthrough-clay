/**
 * PROP SCHEMAS — the typed `props` of every spectacle kind (SPECTACLE §2), as pure data.
 *
 * One entry per procedural kind with curator-editable props: the admin renders a typed props
 * editor from it (falling back to raw JSON for anything not listed), and the museum reads
 * defaults through `kindDefaults` (spectacle/settings.ts `kindProps`). No three.js, no React:
 * safe to import from the admin and from the server.
 *
 * `invisible` kinds draw nothing themselves (settings singletons such as 'spectacle'); a
 * `singleton` kind is meant to appear once per exhibition. `owner` names the package that
 * builds the kind's model.
 */

export type PropValue = string | number | boolean

export type PropSchema =
  | { key: string; type: 'number'; default?: number; min?: number; max?: number; step?: number; label?: string }
  | { key: string; type: 'bool'; default?: boolean; label?: string }
  | { key: string; type: 'text'; default?: string; multiline?: boolean; label?: string; help?: string }
  | { key: string; type: 'color'; default?: string; label?: string }
  | { key: string; type: 'select'; options: readonly string[]; default?: string; label?: string }
  /** A media library asset (URL). */
  | { key: string; type: 'media'; default?: string; accept?: 'audio' | 'video' | 'image' | 'model'; label?: string }

export interface KindSchema {
  kind: string
  /** Curator-facing name of the kind. */
  label: string
  /** Builds the model (SPECTACLE §4). */
  owner: 'WP1' | 'WP2' | 'WP3' | 'WP4' | 'WP5' | 'P1' | 'P2' | 'P3' | 'P5' | 'existing'
  props: readonly PropSchema[]
  /** Meant to exist once per exhibition. */
  singleton?: boolean
  /** Draws nothing of its own (settings carried by an object). */
  invisible?: boolean
}

const n = (key: string, def?: number, extra: { min?: number; max?: number; step?: number } = {}): PropSchema => ({ key, type: 'number', default: def, ...extra })
const b = (key: string, def?: boolean): PropSchema => ({ key, type: 'bool', default: def })
const t = (key: string, def?: string, multiline = false): PropSchema => ({ key, type: 'text', default: def, multiline })
const c = (key: string, def?: string): PropSchema => ({ key, type: 'color', default: def })
const s = (key: string, options: readonly string[], def?: string): PropSchema => ({ key, type: 'select', options, default: def })

/** The clay vessel's forms (models/clay.tsx and the grand plan's additions, GRAND §4.3). */
const VESSEL_FORMS = ['matka', 'surahi', 'kulhad', 'diya', 'kettle', 'bowl', 'handi', 'tawa', 'lidded', 'jar', 'vase', 'ghatam'] as const
/** The sourced models' clay finishes (materials/sourcedFinish.ts); 'asis' keeps the scan's own textures. */
const SOURCED_FINISHES = ['asis', 'terracotta', 'red-slip', 'black-burnished', 'buff', 'grey-clay', 'stone', 'plaster'] as const

const LIST: KindSchema[] = [
  // ── Experience (WP5) ─────────────────────────────────────────────────────────────
  {
    kind: 'spectacle',
    label: 'Spectacle settings',
    owner: 'WP5',
    singleton: true,
    invisible: true,
    // layoutEpoch: the plan the bundled coordinates belong to (2 = GRAND); older server content is set aside
    props: [s('arrival', ['full', 'short', 'off'], 'full'), b('turnReveal', true), n('music', 0.6, { min: 0, max: 1, step: 0.05 }), n('ambience', 0.8, { min: 0, max: 1, step: 0.05 }), n('layoutEpoch', 2)],
  },
  { kind: 'perch-door', label: 'Perch door (climb to a perch)', owner: 'WP5', props: [s('perch', ['sky-rim', 'duplex', 'sphere-well'], 'sky-rim'), t('label')] },
  { kind: 'stamp-post', label: 'Clay Passport stamp post', owner: 'WP5', props: [t('stamp'), t('motif'), t('requires')] },
  {
    kind: 'photo-spot',
    label: 'Photo spot',
    owner: 'WP5',
    props: [n('yawDeg'), n('pitchDeg'), n('fov'), t('time'), t('weather'), t('caption'), b('dof'), s('perch', ['', 'duplex', 'sky-rim', 'sphere-well'], ''), n('perchT', 1, { min: 0, max: 1, step: 0.01 })],
  },

  // ── Light, sky and atmosphere (WP2) ──────────────────────────────────────────────
  {
    kind: 'atmosphere',
    label: 'Atmosphere (time, weather, festival)',
    owner: 'WP2',
    singleton: true,
    invisible: true,
    props: [
      s('defaultTime', ['live', 'morning', 'noon', 'golden', 'night'], 'live'),
      b('allowScrub', true),
      s('weather', ['clear', 'menu', 'auto'], 'menu'),
      n('monsoonSec', 90),
      n('monsoonChance', 0.15, { min: 0, max: 1, step: 0.01 }),
      b('petrichorCaption', false),
      n('gradeStrength', 1, { min: 0, max: 1, step: 0.05 }),
      b('reveal', true),
      s('festival', ['auto', 'on', 'off'], 'auto'),
      t('festivalFrom', '11-01'),
      t('festivalTo', '11-15'),
    ],
  },
  {
    kind: 'oculus-light',
    label: 'Oculus light (sun shaft, motes)',
    owner: 'WP2',
    singleton: true,
    invisible: true,
    props: [b('shaft', true), n('shaftStrength', 1, { min: 0, max: 2, step: 0.05 }), b('motes', true), s('gobo', ['mandala-16', 'none'], 'mandala-16')],
  },
  { kind: 'cove-light', label: 'Cove light', owner: 'WP2', invisible: true, props: [t('walls'), n('colorK', 3000), n('intensity', 1, { min: 0, max: 3, step: 0.05 })] },
  {
    kind: 'diya-field',
    label: 'Diya Night (festival of lamps)',
    owner: 'WP2',
    singleton: true,
    props: [t('sets', 'curb,pool,podiums,hallway,parikrama,annex,path,edge'), n('colorK', 1900), n('flicker', 0.6, { min: 0, max: 1, step: 0.05 }), s('ignite', ['spiral', 'instant'], 'spiral'), b('beacon', true), b('akashDeep', true)],
  },

  // ── Oculus court, mandalas, duplex band (WP3) ────────────────────────────────────
  { kind: 'water-rill', label: 'Water rill', owner: 'WP3', props: [n('length', 8.4), n('width', 0.4)] },
  {
    kind: 'strata-wall',
    label: 'Earth section (strata wall)',
    owner: 'WP3',
    props: [t('surfaces', 'h-inner-1,h-inner-2,h-inner-3,h-inner-4'), t('layers', undefined, true), n('sweepSec', 40)],
  },
  {
    kind: 'court-mandala',
    label: 'Court mandala (crown, floor, sundial)',
    owner: 'WP3',
    singleton: true,
    props: [s('pattern', ['chakra', 'lotus', 'alpana'], 'chakra'), n('petals', 16), b('gold', true), n('spinSec', 600), b('floor', false), b('sundial', true)],
  },
  // r0 0 = a full pool (GRAND §7)
  { kind: 'water-ring', label: 'Water ring / pool', owner: 'WP3', singleton: true, props: [n('r0', 1.8, { min: 0 }), n('r1', 5.55, { min: 0 }), n('level', 0.38), b('tapRipples', true), c('tint', '#1a1210')] },
  {
    kind: 'ghost-potter',
    label: 'Ghost potter on the great wheel',
    owner: 'WP3',
    props: [s('form', ['matka', 'kulhad', 'surahi', 'diya'], 'matka'), n('loopSec', 45), b('rise', true), b('linkHelix', true), t('model', '')],
  },
  {
    kind: 'kulhad-helix',
    label: 'Kulhad helix',
    owner: 'WP3',
    singleton: true,
    props: [n('count', 0), n('turns', 2.25), n('strands', 2), n('spin', 0.03), s('clay', ['terracotta', 'red', 'black'], 'terracotta'), n('diyaEvery', 4), b('chime', true)],
  },
  { kind: 'tool-mandala', label: 'Mandala of clay tools', owner: 'WP3', props: [n('size', 1.9), n('rings', 3), t('folds', '8,12,16'), n('spinSec', 600), t('tools', undefined, true)] },
  { kind: 'duplex-frieze', label: 'Procession frieze (duplex band)', owner: 'WP3', singleton: true, invisible: true, props: [t('scenes', undefined, true), n('seed', 1), b('cove', true)] },

  // ── Hands-on craft and sound (WP4) ───────────────────────────────────────────────
  { kind: 'pit-firing', label: 'Pit firing', owner: 'WP4', props: [n('pots', 7), b('smoke', true), b('sparks', true)] },
  { kind: 'clay-bed', label: 'Clay bed (press your hand)', owner: 'WP4', props: [n('width', 1.1), n('depth', 0.7), n('height', 0.86), n('healSec', 120), s('clay', ['grey', 'red', 'black'], 'grey')] },
  { kind: 'kiln-window', label: 'Kiln window (firing timeline)', owner: 'WP4', props: [s('form', ['matka', 'kulhad', 'bowl'], 'matka'), s('branch', ['none', 'smoked'], 'smoked'), n('autoSec', 30)] },
  { kind: 'ghatam-set', label: 'Ghatam ensemble', owner: 'WP4', props: [n('count', 5), t('pitches', '1,1.12,1.26,1.5,1.68'), b('keys', true)] },
  {
    kind: 'horse-procession',
    label: 'Horse procession',
    owner: 'WP4',
    singleton: true,
    props: [n('fromDeg', -128), n('toDeg', 26), n('count', 21), n('scaleFrom', 0.45), n('scaleTo', 1.2), n('glowRadius', 2.2), b('bells', true)],
  },

  // ── Satellite rooms and the Parikrama (WP1) ──────────────────────────────────────
  { kind: 'living-alpana', label: 'Living alpana (Parikrama floor)', owner: 'WP1', singleton: true, props: [s('pattern', ['kolam-a', 'kolam-b'], 'kolam-a'), c('color', '#efe6d6'), n('width', 1.4)] },
  { kind: 'clay-chimes', label: 'Clay chimes', owner: 'WP1', props: [n('count', 5)] },
  { kind: 'compass-mandala', label: 'Compass mandala (dik-mandala)', owner: 'WP1', props: [n('r', 1.3), c('ink', '#7a2a22')] },
  { kind: 'programme-board', label: 'Programme board', owner: 'WP1', props: [t('films', undefined, true), t('title')] },
  {
    kind: 'theatre-house',
    label: 'Theatre house (lights, firing, Kiln Film)',
    owner: 'WP1',
    singleton: true,
    props: [n('dimTo', 0.22, { min: 0, max: 1, step: 0.01 }), n('fadeSec', 2), n('firingSec', 20), b('kilnFilm', true), n('chapterSec', 24)],
  },
  { kind: 'soil-archive', label: 'Soil archive', owner: 'WP1', props: [n('cols', 12), n('rows', 5), t('palette', undefined, true)] },
  { kind: 'archive-cabinet', label: 'Archive cabinet', owner: 'WP1', props: [n('cols', 4), n('rows', 3), { key: 'drawers', type: 'text', multiline: true, help: 'One drawer per line: id|title|objectId' }] },
  { kind: 'listening-post', label: 'Listening post', owner: 'WP1', props: [{ key: 'clip', type: 'media', accept: 'audio' }, t('speaker'), n('durationSec')] },
  { kind: 'lantern-canopy', label: 'Lantern canopy', owner: 'WP1', props: [n('count', 30), n('rows', 3), n('y', 3.4), c('color')] },

  // ── Existing kinds that gain props in this phase ─────────────────────────────────
  { kind: 'map-wall', label: 'Map of India wall', owner: 'existing', props: [n('width'), n('height'), n('bottom'), t('title'), t('kicker'), t('pins', undefined, true), s('finish', ['linen', 'clay'], 'clay')] },
  { kind: 'credits-panel', label: 'Credits / partners panel', owner: 'existing', props: [s('layout', ['credits', 'partners'], 'partners')] },
  { kind: 'theatre-seating', label: 'Theatre seating', owner: 'existing', props: [n('seats'), n('arcR')] },
  { kind: 'bookcase', label: 'Bookcase', owner: 'existing', props: [n('width'), n('shelves'), n('curveR')] },
  { kind: 'reading-table', label: 'Reading table', owner: 'existing', props: [b('round', false), n('r', 0.7)] },
  { kind: 'shop-shelf', label: 'Shop shelf', owner: 'existing', props: [s('dressing', ['cloth', 'clay'], 'clay'), n('curveR'), n('tiers')] },
  { kind: 'shop-table', label: 'Shop table', owner: 'existing', props: [s('dressing', ['cloth', 'clay'], 'clay'), n('curveR'), n('tiers')] },

  // ── The clay pieces, with the grand plan's additive props (GRAND §4.3, §7; P2) ───
  {
    kind: 'clay-vessel',
    label: 'Clay vessel',
    owner: 'P2',
    props: [
      s('form', VESSEL_FORMS, 'matka'),
      s('clay', ['terracotta', 'red', 'black', 'buff', 'pink', 'geru', 'quartz', 'grey'], 'terracotta'),
      n('burnish', 0.3, { min: 0, max: 1, step: 0.05 }),
      s('decor', ['none', 'slip-flowers', 'silver-incision', 'geru-dots', 'blue-floral', 'trailed-slip', 'ash-glaze'], 'none'),
    ],
  },
  { kind: 'terracotta-horse', label: 'Terracotta horse', owner: 'P2', props: [n('scale', 1, { min: 0.2, max: 3, step: 0.05 }), s('style', ['bankura', 'gorakhpur', 'sonepur'], 'bankura')] },
  { kind: 'votive-plaque', label: 'Votive plaque', owner: 'P2', props: [s('motif', ['rider', 'deity', 'serpent', 'procession', 'canopy'], 'rider'), n('size', 0.4, { min: 0.2, max: 1.1, step: 0.05 })] },

  // ── The grand plan's new kinds (GRAND §7) ─────────────────────────────────────────
  { kind: 'sourced-model', label: 'Sourced 3D model', owner: 'P2', props: [t('slug', ''), s('finish', SOURCED_FINISHES, 'asis'), b('lod', true)] },
  { kind: 'ayyanar-horse', label: 'Ayyanar guardian horse', owner: 'P2', props: [n('height', 4.2, { min: 1, max: 6, step: 0.1 }), s('paint', ['weathered', 'white', 'red'], 'weathered'), n('seed', 1)] },
  { kind: 'relief-register', label: 'Relief register (Bishnupur)', owner: 'P2', props: [n('panels', 6, { min: 1, max: 24 }), s('scene', ['epic', 'procession', 'boats', 'daily'], 'epic'), n('weather', 0.5, { min: 0, max: 1, step: 0.05 })] },
  { kind: 'lippan-wall', label: 'Lippan relief (mud and mirror)', owner: 'P2', props: [s('pattern', ['lattice', 'peacock', 'flower'], 'lattice'), n('mirrors', 0.5, { min: 0, max: 1, step: 0.05 }), t('surfaces', 'f-outer-1,f-outer-2,f-outer-3,f-outer-4,f-outer-5')] },
  { kind: 'coil-pot', label: 'Coil pot (cut-away)', owner: 'P2', props: [n('coils', 18, { min: 4, max: 60 }), b('cutaway', true)] },
  { kind: 'kumartuli-figure', label: 'Kumartuli figure in progress', owner: 'P2', props: [s('stage', ['frame', 'straw', 'first-coat', 'fine-coat'], 'first-coat'), n('height', 2.6, { min: 0.5, max: 4, step: 0.1 })] },
  { kind: 'majuli-mask', label: 'Majuli mask', owner: 'P2', props: [s('form', ['face', 'bird', 'lion'], 'face'), b('paint', true)] },
  {
    kind: 'eroded-formation',
    label: 'Eroded clay formation',
    owner: 'P3',
    props: [n('height', 6, { min: 0.5, max: 9 }), n('width', 2.4, { min: 0.3 }), n('depth', 1.4, { min: 0.3 }), n('seed', 1), n('strata', 7, { min: 1, max: 20 }), t('source', ''), s('palette', ['mixed', 'terracotta', 'rose', 'ochre'], 'mixed'), b('uniform', false), n('keepFront', 0, { min: 0 })],
  },
  { kind: 'round-table', label: 'Fluted round table', owner: 'P3', props: [n('r', 1.2, { min: 0.3 }), n('height', 0.9, { min: 0.3 }), n('flutes', 48, { min: 0, max: 128 }), s('finish', ['timber', 'clay'], 'timber')] },
  { kind: 'lotus', label: 'Clay lotus', owner: 'P3', singleton: true, props: [n('r', 1.6, { min: 0.3 }), n('petals', 16, { min: 5, max: 40 }), n('layers', 2, { min: 1, max: 4 }), c('color', '#b3261e'), s('bloom', ['sun', 'open', 'closed'], 'sun')] },
  { kind: 'spiral-stair', label: 'Spiral stair', owner: 'P3', props: [n('r0', 4.6, { min: 0.5 }), n('r1', 6.1, { min: 1 }), n('turns', 1.25, { min: 0.25, max: 4, step: 0.05 }), n('rise', 5.4, { min: 0.5 }), s('finish', ['red', 'terracotta'], 'red')] },
  { kind: 'clay-sphere', label: 'Clay sphere', owner: 'P3', props: [n('r', 1.6, { min: 0.2 }), n('spinSec', 240, { min: 0 }), s('finish', ['red', 'terracotta', 'grey'], 'red')] },
  { kind: 'wine-plinth', label: 'Wine plinth (stepped)', owner: 'P3', props: [n('steps', 3, { min: 1, max: 6 }), n('width', 2.4, { min: 0.3 }), n('depth', 0.9, { min: 0.3 }), n('height', 1.1, { min: 0.2 }), b('vitrine', false)] },
  {
    kind: 'curved-shelf',
    label: 'Curved shelf',
    owner: 'P3',
    props: [
      n('curveR', 4.2, { min: 0.5 }),
      n('spanDeg', 40, { min: 5, max: 360 }),
      n('tiers', 4, { min: 1, max: 8 }),
      n('tierGap', 0.42, { min: 0.15, step: 0.01 }),
      n('depth', 0.32, { min: 0.1, step: 0.01 }),
      s('finish', ['lacquer-red', 'timber', 'clay'], 'lacquer-red'),
      { key: 'items', type: 'text', multiline: true, help: 'One per line: slug-or-form|count' },
      b('lit', true),
    ],
  },
  { kind: 'round-plinth', label: 'Round plinth (tiered)', owner: 'P3', props: [n('tiers', 2, { min: 1, max: 5 }), n('r', 1.4, { min: 0.2 }), n('h', 0.6, { min: 0.05 }), c('color', '#7d1a17')] },
  { kind: 'courtyard-garden', label: 'Courtyard garden', owner: 'P3', props: [t('trees', ''), n('shrubs', 8, { min: 0, max: 60 }), b('gravel', true), b('basin', false), n('seed', 1)] },
]

export const KIND_SCHEMAS: Readonly<Record<string, KindSchema>> = Object.fromEntries(LIST.map((k) => [k.kind, k]))

/**
 * Props any object may carry, whatever its kind: shop tags (one per line,
 * `form|village|technique|price|makerShare|link`; price and share are shown only when filled in
 * and the object is not a placeholder) and the inspector's "Inside the clay" section.
 */
export const COMMON_PROPS: readonly PropSchema[] = [
  { key: 'tags', type: 'text', multiline: true, help: 'One per line: form|village|technique|price|makerShare|link' },
  s('section', ['coil', 'slab', 'thrown', 'moulded', 'none'], 'none'),
]

/** Defaults of a kind's props (only those with a default). */
export function kindDefaults(kind: string): Record<string, PropValue> {
  const out: Record<string, PropValue> = {}
  for (const p of KIND_SCHEMAS[kind]?.props ?? []) if (p.default !== undefined) out[p.key] = p.default
  return out
}
