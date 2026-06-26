import { getBusinessInfo } from '@/lib/business'
import { getCategoryMeta, resolveCategoryId, translateCategory } from '@/lib/categories'
import { getKeywordText, getProductSeoKeywords } from '@/lib/keywords.server'
import { getProductDescription, getProductOfferPrice } from '@/lib/product-offers'
import type { Product, ProductSize } from '@/lib/products'
import { getRUProducts } from '@/lib/products.server'
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
    const existing = groups.get(key)

    if (existing) {
      existing.variants.push(product)
      continue
    }

    groups.set(key, { product, variants: [product] })
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

  return getCategoryMeta(categoryId) ? translateCategory(categoryId, 'en') : categoryId
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

function getSizeSummary(product: Product): { width: number; height: number } | null {
  const sizes = (product.sizes_json ?? []) as ProductSize[]
  const withDimensions = sizes.filter(
    (size): size is ProductSize & { width_cm: number; height_cm: number } =>
      typeof size.width_cm === 'number' &&
      size.width_cm > 0 &&
      typeof size.height_cm === 'number' &&
      size.height_cm > 0,
  )

  if (withDimensions.length === 0) {
    if (
      typeof product.width_cm === 'number' &&
      product.width_cm > 0 &&
      typeof product.height_cm === 'number' &&
      product.height_cm > 0
    ) {
      return {
        width: product.width_cm,
        height: product.height_cm,
      }
    }

    return null
  }

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

function getPowerRange(product: Product): string | null {
  const powerValues = ((product.sizes_json ?? []) as ProductSize[])
    .map((size) => size.power_w)
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
        if (color === 'cool white') {
          labels.add('White')
          continue
        }
        if (color === 'warm white') {
          labels.add('Warm white')
          continue
        }
        if (color === 'white') {
          labels.add('White')
          continue
        }
        if (color === 'neutral') {
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

function buildCatalogDescription(product: Product): string {
  const baseDescription = getProductDescription(product)
  const keywordText = getKeywordText(getProductSeoKeywords(product, 12), 5)

  if (!keywordText) {
    return trimText(baseDescription, 320)
  }

  return trimText(`${baseDescription} Popular search queries: ${keywordText}.`, 320)
}

function buildOfferXml(group: ProductGroup, categoryMap: Map<string, number>, siteUrl: string): string | null {
  const { product, variants } = group
  const price = getProductOfferPrice(product)
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
  const name = `${business.name} ${product.name} neon sign`
  const description = buildCatalogDescription(product)
  const images = getUniqueImages(variants, siteUrl)
  const sizeSummary = getSizeSummary(product)
  const colorList = getColorList(variants)
  const powerRange = getPowerRange(product)
  const searchKeywordText = getKeywordText(getProductSeoKeywords(product, 10), 6)

  const lines = [
    `    <offer id="${escapeXml(product.group_id)}">`,
    `      <name>${escapeXml(name)}</name>`,
    `      <vendor>${escapeXml(business.name)}</vendor>`,
    `      <vendorCode>${escapeXml(product.group_id)}</vendorCode>`,
    `      <url>${escapeXml(url)}</url>`,
    `      <price>${price}</price>`,
    '      <currencyId>USD</currencyId>',
    `      <categoryId>${categoryId}</categoryId>`,
    '      <available>true</available>',
    ...images.map((image) => `      <picture>${escapeXml(image)}</picture>`),
    `      <description>${escapeXml(description)}</description>`,
    '      <sales_notes>Price and shipping time are confirmed after the order is placed.</sales_notes>',
    '      <manufacturer_warranty>true</manufacturer_warranty>',
    ...(colorList ? [`      <param name="Glow color">${escapeXml(colorList)}</param>`] : []),
    ...(sizeSummary ? [`      <param name="Width" unit="cm">${sizeSummary.width}</param>`] : []),
    ...(sizeSummary ? [`      <param name="Height" unit="cm">${sizeSummary.height}</param>`] : []),
    ...(powerRange ? [`      <param name="Power">${escapeXml(powerRange)}</param>`] : []),
    ...(categoryLabel ? [`      <param name="Catalog category">${escapeXml(categoryLabel)}</param>`] : []),
    ...(searchKeywordText ? [`      <param name="Search queries">${escapeXml(searchKeywordText)}</param>`] : []),
    '      <param name="Material">Acrylic backing and flexible LED neon</param>',
    '      <param name="Power supply">12V adapter</param>',
    '      <param name="Warranty">2 years</param>',
    '    </offer>',
  ]

  return lines.join('\n')
}

function buildCatalogFeedXml(): string {
  const siteUrl = getSiteUrl()
  const business = getBusinessInfo()
  const groups = groupProducts(getRUProducts())
    .filter(({ product }) => !!product.group_id)
    .filter(({ product }) => {
      const price = getProductOfferPrice(product)
      return typeof price === 'number' && price > 0
    })
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
    `<yml_catalog date="${formatYmlDate(new Date())}">`,
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
  const body = buildCatalogFeedXml()

  return new Response(body, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  })
}
