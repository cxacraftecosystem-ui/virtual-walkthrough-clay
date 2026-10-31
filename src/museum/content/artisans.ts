/**
 * "Meet the maker" — artisan profiles (bundled fallback + runtime store).
 *
 * The bundled profiles are empty stand-ins (`placeholder: true`): no real people are named or
 * described here, and visitors never see them (findPublicArtisan). Real profiles are supplied by
 * the workshop and entered by curators in the admin (Makers); the server then replaces ARTISANS
 * in place (see content.ts → applyContent). Artworks / exhibits reference a profile with `artisanId`.
 */

export interface Artisan {
  id: string
  name: string
  /** Cluster / region, free text exactly as supplied by the workshop. */
  cluster: string
  craft: string
  bio: string
  /** Portrait image URL (media library or /public). */
  portrait: string
  contact: string
  /** "Visit the maker". */
  website: string
  /** "Buy (fair trade)". */
  shopUrl: string
  /** "Commission". */
  commissionUrl: string
  verified: boolean
  placeholder: boolean
  sort?: number
}

const placeholder = (id: string, n: number): Artisan => ({
  id,
  name: `Maker profile ${n}`,
  cluster: '',
  craft: 'Clay',
  bio: '',
  portrait: '',
  contact: '',
  website: '',
  shopUrl: '',
  commissionUrl: '',
  verified: false,
  placeholder: true,
  sort: n,
})

/**
 * Mutable runtime list (replaced in place by the content API). One stand-in per tradition; the ids are
 * the pavilion's own (maker ids are global in the database the two sites share).
 */
export const ARTISANS: Artisan[] = [placeholder('clay-maker-placeholder-a', 1), placeholder('clay-maker-placeholder-b', 2), placeholder('clay-maker-placeholder-c', 3)]

/** Seed links: which bundled items point to which placeholder profile (the hero works of each tradition). */
export const SEED_ARTISAN_LINKS: Record<string, Record<string, string>> = {
  artworks: {
    'clay-a-01': 'clay-maker-placeholder-a',
    'clay-a-02': 'clay-maker-placeholder-a',
    'clay-b-01': 'clay-maker-placeholder-b',
    'clay-b-02': 'clay-maker-placeholder-b',
    'clay-c-01': 'clay-maker-placeholder-c',
    'clay-c-02': 'clay-maker-placeholder-c',
  },
}

export const findArtisan = (id: string | undefined) => (id ? ARTISANS.find((a) => a.id === id) : undefined)

/** A profile visitors may see: stand-in profiles (`placeholder`) stay hidden until the workshop's details are in. */
export const findPublicArtisan = (id: string | undefined) => {
  const a = findArtisan(id)
  return a && !a.placeholder ? a : undefined
}

/** Where an object link (config/objects.ts `links`) leads for visitors, or undefined when it leads nowhere yet. */
export function resolveHref(label: string, href: string | undefined, artisanId: string | undefined): string | undefined {
  const maker = findPublicArtisan(artisanId)
  if (maker) {
    if (/visit the maker/i.test(label)) return safeUrl(maker.website) ?? href
    if (/^buy/i.test(label)) return safeUrl(maker.shopUrl) ?? href
  }
  if (!href) return undefined
  // a maker page that visitors cannot see (stand-in profile) is not linked
  const makerPage = /^\/makers\/([^/?#]+)/.exec(href)
  if (makerPage && !findPublicArtisan(decodeURIComponent(makerPage[1]))) return undefined
  // only site-relative paths or http(s) URLs
  return href.startsWith('/') && !href.startsWith('//') ? href : safeUrl(href)
}

/** Only http(s) links are rendered (no javascript:/data: from content). */
export const safeUrl = (u: string | undefined) => (u && /^https?:\/\//i.test(u.trim()) ? u.trim() : undefined)
