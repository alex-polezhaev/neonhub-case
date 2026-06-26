import { getBusinessInfo } from '@/lib/business'
import { getCategoryMeta, resolveCategoryId, translateCategory } from '@/lib/categories'
import { getProductDescription, getProductOfferPrice } from '@/lib/product-offers'
import type { Product, ProductSize } from '@/lib/products'
import { getProductsUpdatedAt, getRUProducts } from '@/lib/products.server'
import { getSiteUrl } from '@/lib/site'
import { colorLabel } from '@/lib/utils'

export const dynamic = 'force-static'

type ProductGroup = {
  product: Product
  variants: Product[]
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function formatYmlDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')

  return `${year}-${month}-${day} ${hours}:${minutes}`
}

function groupProducts(products: Product[]): ProductGroup[] {
  const groups = new Map<string, ProductGroup>()

  for (const product of products) {
    const key = product.group_id || product.slug
    if (!key) continue

    const existing = groups.get(key)
    if (existing) {
      existing.variants.push(product)
      continue
    }

    groups.set(key, {
      product,
      variants: [product],
    })
  }

  return [...groups.values()]
}

function getPrimaryCategoryId(product: Product): string | null {
  const categoryId = product.categories.find((category) => getCategoryMeta(category)) ?? product.categories[0] ?? null

  return categoryId ? resolveCategoryId(categoryId) : null
}

function getPrimaryCategoryLabel(product: Product): string | null {
  const categoryId = getPrimaryCategoryId(product)
  if (!categoryId) return null

  return translateCategory(categoryId, 'en')
}

function collectCategoryMap(groups: ProductGroup[]): Map<string, number> {
  const categoryLabels = new Set<string>()

  for (const { product } of groups) {
    const categoryLabel = getPrimaryCategoryLabel(product)
    if (categoryLabel) categoryLabels.add(categoryLabel)
  }

  return new Map(
    [...categoryLabels]
      .sort((left, right) => left.localeCompare(right, 'en'))
      .map((categoryLabel, index) => [categoryLabel, index + 1]),
  )
}

function getUniqueImages(variants: Product[], siteUrl: string): string[] {
  const seen = new Set<string>()
  const images: string[] = []

  for (const variant of variants) {
    for (const image of variant.images ?? []) {
      const absoluteUrl = image.startsWith('http') ? image : `${siteUrl}${image}`
      if (seen.has(absoluteUrl)) continue

      seen.add(absoluteUrl)
      images.push(absoluteUrl)

      if (images.length >= 10) {
        return images
      }
    }
  }

  return images
}

function getSizeSummary(variants: Product[]): { width: number; height: number } | null {
  const sizes = variants.flatMap((variant) => (variant.sizes_json ?? []) as ProductSize[])
  const withDimensions = sizes.filter(
    (size): size is ProductSize & { width_cm: number; height_cm: number } =>
      typeof size.width_cm === 'number' &&
      size.width_cm > 0 &&
      typeof size.height_cm === 'number' &&
      size.height_cm > 0,
  )

  if (withDimensions.length > 0) {
    const narrowest = withDimensions.reduce((current, size) => (
      size.width_cm < current.width ? { width: size.width_cm, height: size.height_cm } : current
    ), {
      width: withDimensions[0].width_cm,
      height: withDimensions[0].height_cm,
    })

    return {
      width: narrowest.width,
      height: narrowest.height,
    }
  }

  const fallback = variants.find(
    (variant) =>
      typeof variant.width_cm === 'number' &&
      variant.width_cm > 0 &&
      typeof variant.height_cm === 'number' &&
      variant.height_cm > 0,
  )

  if (!fallback || !fallback.width_cm || !fallback.height_cm) {
    return null
  }

  return {
    width: fallback.width_cm,
    height: fallback.height_cm,
  }
}

function getPowerRange(variants: Product[]): string | null {
  const powerValues = variants
    .flatMap((variant) => ((variant.sizes_json ?? []) as ProductSize[]).map((size) => size.power_w))
    .filter((value): value is number => typeof value === 'number' && value > 0)

  if (powerValues.length === 0) return null

  const min = Math.min(...powerValues)
  const max = Math.max(...powerValues)

  return min === max ? `${min} W` : `${min}-${max} W`
}

function getColorList(variants: Product[]): string | null {
  const labels = new Set<string>()

  for (const variant of variants) {
    const rawColors = Array.isArray(variant.color) ? variant.color : [variant.color]

    for (const rawColor of rawColors) {
      if (!rawColor) continue

      for (const token of rawColor.split(',')) {
        const color = token.trim()
        if (!color) continue

        if (color === 'cool white' || color === 'white') {
          labels.add('White')
          continue
        }

        if (color === 'warm white' || color === 'neutral') {
          labels.add('Warm white')
          continue
        }

        labels.add(colorLabel(color, 'en'))
      }
    }
  }

  if (labels.size === 0) return null

  return [...labels].join(', ')
}

function trimText(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value

  const trimmed = value.slice(0, maxLength - 1).trim()

  return `${trimmed.replace(/[,\s]+$/, '')}…`
}

function buildShortDescription(product: Product, price: number): string {
  const categoryLabel = getPrimaryCategoryLabel(product)?.toLowerCase()
  const categoryText = categoryLabel ? ` in the ${categoryLabel} category` : ''

  return trimText(
    `${product.name} neon sign${categoryText}. From $${price.toLocaleString('en-US')}. Custom-made to order.`,
    160,
  )
}

function buildDescription(product: Product, variants: Product[], price: number): string {
  const base = getProductDescription(product)
  const colors = getColorList(variants)
  const sizeSummary = getSizeSummary(variants)

  const details = [
    colors ? `Colors: ${colors}.` : null,
    sizeSummary ? `Smallest size: ${sizeSummary.width}x${sizeSummary.height} cm.` : null,
    'Fast US shipping, 12V power, 2-year warranty.',
    `From $${price.toLocaleString('en-US')}.`,
  ].filter(Boolean)

  return trimText([base, ...details].join(' '), 320)
}

function getGroupPrice(variants: Product[]): number | null {
  const prices = variants
    .map((variant) => getProductOfferPrice(variant))
    .filter((price): price is number => typeof price === 'number' && price > 0)

  if (prices.length === 0) return null

  return Math.min(...prices)
}

function buildOfferXml(group: ProductGroup, categoryMap: Map<string, number>, siteUrl: string): string | null {
  const { product, variants } = group
  const price = getGroupPrice(variants)
  const categoryLabel = getPrimaryCategoryLabel(product)

  if (!price || !categoryLabel) {
    return null
  }

  const categoryId = categoryMap.get(categoryLabel)
  if (!categoryId) {
    return null
  }

  const business = getBusinessInfo()
  const url = `${siteUrl}/product/${product.group_id}/`
  const images = getUniqueImages(variants, siteUrl)
  const description = buildDescription(product, variants, price)
  const shortDescription = buildShortDescription(product, price)
  const sizeSummary = getSizeSummary(variants)
  const colorList = getColorList(variants)
  const powerRange = getPowerRange(variants)

  const lines = [
    `    <offer id="${escapeXml(product.group_id)}" available="true">`,
    `      <name>${escapeXml(product.name)}</name>`,
    `      <vendor>${escapeXml(business.name)}</vendor>`,
    `      <vendorCode>${escapeXml(product.group_id)}</vendorCode>`,
    `      <url>${escapeXml(url)}</url>`,
    `      <price>${price}</price>`,
    '      <currencyId>USD</currencyId>',
    `      <categoryId>${categoryId}</categoryId>`,
    ...images.map((image) => `      <picture>${escapeXml(image)}</picture>`),
    `      <description>${escapeXml(description)}</description>`,
    `      <shortDescription>${escapeXml(shortDescription)}</shortDescription>`,
    '      <sales_notes>Price and production time are confirmed after the order is placed.</sales_notes>',
    '      <manufacturer_warranty>true</manufacturer_warranty>',
    ...(colorList ? [`      <param name="Glow color">${escapeXml(colorList)}</param>`] : []),
    ...(sizeSummary ? [`      <param name="Width" unit="cm">${sizeSummary.width}</param>`] : []),
    ...(sizeSummary ? [`      <param name="Height" unit="cm">${sizeSummary.height}</param>`] : []),
    ...(powerRange ? [`      <param name="Power">${escapeXml(powerRange)}</param>`] : []),
    `      <param name="Type">Neon sign</param>`,
    `      <param name="Catalog category">${escapeXml(categoryLabel)}</param>`,
    '      <param name="Material">Acrylic backing and flexible LED neon</param>',
    '      <param name="Power supply">12V adapter</param>',
    '      <param name="Warranty">2 years</param>',
    '    </offer>',
  ]

  return lines.join('\n')
}

export function buildYandexBusinessFeedXml(): string {
  const siteUrl = getSiteUrl()
  const business = getBusinessInfo()
  const groups = groupProducts(getRUProducts())
    .filter(({ variants }) => getGroupPrice(variants) !== null)
    .sort((left, right) => left.product.name.localeCompare(right.product.name, 'en'))

  const categoryMap = collectCategoryMap(groups)
  const offers = groups
    .map((group) => buildOfferXml(group, categoryMap, siteUrl))
    .filter((offer): offer is string => Boolean(offer))

  const categories = [...categoryMap.entries()]
    .sort((left, right) => left[1] - right[1])
    .map(([categoryLabel, categoryId]) => `      <category id="${categoryId}">${escapeXml(categoryLabel)}</category>`)

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!DOCTYPE yml_catalog SYSTEM "shops.dtd">',
    `<yml_catalog date="${formatYmlDate(getProductsUpdatedAt())}">`,
    '  <shop>',
    `    <name>${escapeXml(business.name)}</name>`,
    `    <company>${escapeXml(business.legalName)}</company>`,
    `    <url>${escapeXml(`${siteUrl}/`)}</url>`,
    '    <currencies>',
    '      <currency id="USD" rate="1"/>',
    '    </currencies>',
    '    <categories>',
    ...categories,
    '    </categories>',
    '    <offers>',
    ...offers,
    '    </offers>',
    '  </shop>',
    '</yml_catalog>',
    '',
  ].join('\n')
}

export async function GET() {
  const body = buildYandexBusinessFeedXml()

  return new Response(body, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  })
}
