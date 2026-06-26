export interface Product {
  slug: string
  group_id: string
  name: string
  categories: string[]
  keywords?: string[]

  price_usd: number | null
  sale_price_usd: number | null
  price_rub: number | null
  sale_price_rub: number | null

  color?: string | string[]

  width_in: number | null
  height_in: number | null
  width_cm: number | null
  height_cm: number | null

  price_per_10cm?: number | null
  price_per_in_usd?: number | null
  sale_percent?: number | null

  sizes?: unknown[]
  size_preview?: string | null
  sizes_json?: ProductSize[]
  for_whom?: string[]

  images: string[]
}

export interface ProductSize {
  size_preview?: string | null
  tube_mm?: number | null
  adjustment?: number | null
  width_cm?: number | null
  height_cm?: number | null
  power_w?: number | null
  price_rub?: number | null
  price_usd?: number | null
}

export function getPrice(p: Product, locale: string) {
  return locale === 'ru' ? (p.price_rub ?? 0) : (p.price_usd ?? 0)
}

export function getSalePrice(p: Product, locale: string) {
  return locale === 'ru' ? (p.sale_price_rub ?? 0) : (p.sale_price_usd ?? 0)
}

export function getWidth(p: Product, locale: string) {
  return locale === 'ru' ? (p.width_cm ?? 0) : (p.width_in ?? 0)
}

export function getHeight(p: Product, locale: string) {
  return locale === 'ru' ? (p.height_cm ?? 0) : (p.height_in ?? 0)
}

export function getColor(p: Product): string {
  if (!p || !p.color) return ''
  return Array.isArray(p.color) ? p.color[0] ?? '' : p.color
}

export function getColors(p: Product): string[] {
  if (!p || !p.color) return ['cyan']
  return Array.isArray(p.color) ? p.color : [p.color]
}

export function getProductSizeKey(size?: ProductSize | null): string {
  if (!size) return ""

  return [
    size.tube_mm ?? "",
    size.adjustment ?? "",
    size.width_cm ?? "",
    size.height_cm ?? "",
  ].join(":")
}
