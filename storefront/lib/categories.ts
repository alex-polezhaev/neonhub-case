export type CategoryMeta = {
  en: string
  ru: string
  emoji: string
}

export const CATEGORY_META: Record<string, CategoryMeta> = {
  all:      { en: 'ALL CATEGORIES', ru: 'ALL CATEGORIES', emoji: '' },
  business: { en: 'BUSINESS SIGNAGE', ru: 'BUSINESS SIGNAGE', emoji: '🏪' },
  home:     { en: 'HOME & DECOR',     ru: 'HOME & DECOR',     emoji: '🏠' },
  bar:      { en: 'BAR & EVENTS',     ru: 'BAR & EVENTS',     emoji: '🍸' },
  custom:   { en: 'CUSTOM & LOGO',    ru: 'CUSTOM & LOGO',    emoji: '✨' },
  quotes:   { en: 'QUOTES & WORDS',   ru: 'QUOTES & WORDS',   emoji: '💬' },
}

export const CATEGORY_ALIASES: Record<string, string> = {
  signage: 'business',
  shop: 'business',
  store: 'business',
  events: 'bar',
  party: 'bar',
  nightlife: 'bar',
  decor: 'home',
  interior: 'home',
  logo: 'custom',
  logos: 'custom',
  branding: 'custom',
  phrases: 'quotes',
  words: 'quotes',
  motivation: 'quotes',
  text: 'quotes',
}

export const BUSINESS_CATEGORY_IDS = [
  'business',
  'bar',
] as const

export const HOME_CATEGORY_IDS = [
  'home',
  'quotes',
] as const

function titleCase(value: string): string {
  return value
    .replace(/[-_]+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

export function resolveCategoryId(id: string): string {
  return CATEGORY_ALIASES[id] ?? id
}

export function getCategoryMeta(id: string): CategoryMeta | null {
  return CATEGORY_META[resolveCategoryId(id)] ?? null
}

export function getCategoryAudience(id: string): 'business' | 'home' | 'other' {
  const resolvedId = resolveCategoryId(id)

  if (BUSINESS_CATEGORY_IDS.includes(resolvedId as (typeof BUSINESS_CATEGORY_IDS)[number])) {
    return 'business'
  }

  if (HOME_CATEGORY_IDS.includes(resolvedId as (typeof HOME_CATEGORY_IDS)[number])) {
    return 'home'
  }

  return 'other'
}

export function translateCategory(id: string, _locale: string = 'en'): string {
  const resolvedId = resolveCategoryId(id)
  const meta = CATEGORY_META[resolvedId]

  if (!meta) {
    return titleCase(resolvedId)
  }

  return meta.en
}

export function getCategorySeoText(id: string) {
  const resolvedId = resolveCategoryId(id)
  const label = translateCategory(resolvedId, 'en')
  const labelLower = label.toLowerCase()

  return {
    title: `Neon signs ${labelLower} | NEON HUB`,
    description: `The "${label}" category in the NEON HUB catalog. Photos, examples, prices and custom-made neon signs with fast US shipping.`,
    intro: `A selection of neon signs in the ${labelLower} category. These are current models you can order as-is or adapt to your size, color and use case.`,
  }
}
