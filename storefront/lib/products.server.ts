import fs from 'fs'
import path from 'path'
import type { Product, ProductSize } from './products'
import { resolveCategoryId, translateCategory } from './categories'
import { getSalePrice } from './products'

const PRODUCTS_FILE_PATH = path.join(process.cwd(), 'public', 'data', 'products.json')

function normalizeProduct(product: Product): Product {
  const slug = typeof product.slug === 'string' ? product.slug : String(product.slug ?? '')
  const groupId = typeof product.group_id === 'string' ? product.group_id : String(product.group_id ?? slug)

  return {
    ...product,
    slug,
    group_id: groupId || slug,
  }
}

function readProductsFile(): Product[] {
  const raw = fs.readFileSync(PRODUCTS_FILE_PATH, 'utf-8')
  const data = JSON.parse(raw)
  const products = Array.isArray(data) ? data : data.products ?? []

  return products.map((product) => normalizeProduct(product))
}

export function getProducts(): Product[] {
  return readProductsFile()
}

export function getProductGroups(): Product[] {
  const seen = new Set<string>()

  return readProductsFile().filter((product) => {
    if (!product.group_id || seen.has(product.group_id)) {
      return false
    }

    seen.add(product.group_id)
    return true
  })
}

export function getProductGroupCount(): number {
  return getProductGroups().length
}

function getLowestPricedSize(
  sizes: ProductSize[],
  locale: string,
): { size: ProductSize; price: number } | null {
  const priceField = locale === 'ru' ? 'price_rub' : 'price_usd'
  let match: { size: ProductSize; price: number } | null = null

  for (const size of sizes) {
    const rawPrice = size[priceField]
    if (rawPrice == null || rawPrice <= 0) continue
    if (!match || rawPrice < match.price) match = { size, price: rawPrice }
  }

  return match
}

function getLowestDerivedSizePrice(
  sizes: ProductSize[],
  locale: string,
  unitPrice: number | null,
): { size: ProductSize; price: number } | null {
  if (!unitPrice) return null

  let match: { size: ProductSize; price: number } | null = null

  for (const size of sizes) {
    if (!size.width_cm) continue
    const price = locale === 'ru'
      ? Math.round((size.width_cm / 10) * unitPrice)
      : Math.round((size.width_cm / 2.54) * unitPrice * 100) / 100

    if (price <= 0) continue
    if (!match || price < match.price) match = { size, price }
  }

  return match
}

function getCatalogPrice(product: Product, locale: string): number {
  const sizes = product.sizes_json ?? []
  const tube6Sizes = sizes.filter(size => size.tube_mm === 6)
  const standardSize = tube6Sizes.find(size => (size.adjustment ?? null) === 0)

  if (locale === 'ru') {
    if (standardSize?.price_rub != null && standardSize.price_rub > 0) {
      return standardSize.price_rub
    }

    const fallbackPrice = getLowestPricedSize(sizes, locale)
    if (fallbackPrice) return fallbackPrice.price

    const per10cm = product.price_per_10cm
      ?? (product.sale_price_rub && product.width_cm && product.width_cm > 0
          ? product.sale_price_rub / (product.width_cm / 10) : null)
    if (standardSize?.width_cm && per10cm) {
      return Math.round((standardSize.width_cm / 10) * per10cm)
    }

    const fallbackDerivedPrice = getLowestDerivedSizePrice(sizes, locale, per10cm)
    if (fallbackDerivedPrice) return fallbackDerivedPrice.price
  } else {
    if (standardSize?.price_usd != null && standardSize.price_usd > 0) {
      return standardSize.price_usd
    }

    const fallbackPrice = getLowestPricedSize(sizes, locale)
    if (fallbackPrice) return fallbackPrice.price

    const perIn = product.price_per_in_usd
      ?? (product.sale_price_usd && product.width_in && product.width_in > 0
          ? product.sale_price_usd / product.width_in : null)
    if (standardSize?.width_cm && perIn) {
      return Math.round((standardSize.width_cm / 2.54) * perIn * 100) / 100
    }

    const fallbackDerivedPrice = getLowestDerivedSizePrice(sizes, locale, perIn)
    if (fallbackDerivedPrice) return fallbackDerivedPrice.price
  }

  return getSalePrice(product, locale)
}

function getCatalogVisibleProducts(locale: string): Product[] {
  return getProducts().filter((product) => getCatalogPrice(product, locale) > 0)
}

function getCatalogVisibleProductGroups(locale: string): Product[] {
  const seen = new Set<string>()

  return getCatalogVisibleProducts(locale).filter((product) => {
    if (!product.group_id || seen.has(product.group_id)) {
      return false
    }

    seen.add(product.group_id)
    return true
  })
}

export function getCatalogProductGroupCount(locale: string): number {
  return getCatalogVisibleProductGroups(locale).length
}

export function getCatalogProductGroupCountByCategory(categoryId: string, locale: string): number {
  const resolvedCategoryId = resolveCategoryId(categoryId)

  return getCatalogVisibleProductGroups(locale).filter((product) => (
    product.categories?.some((category) => resolveCategoryId(category) === resolvedCategoryId)
  )).length
}

export function getCategoryIds(): string[] {
  const categories = new Set<string>()

  for (const product of getProductGroups()) {
    for (const category of product.categories ?? []) {
      categories.add(resolveCategoryId(category))
    }
  }

  return [...categories].sort((left, right) => (
    translateCategory(left, 'en').localeCompare(translateCategory(right, 'en'), 'en')
  ))
}

export function getProductsByCategory(categoryId: string): Product[] {
  const resolvedCategoryId = resolveCategoryId(categoryId)

  return getProducts().filter((product) => (
    product.categories?.some((category) => resolveCategoryId(category) === resolvedCategoryId)
  ))
}

export function getProductGroupsByCategory(categoryId: string): Product[] {
  const resolvedCategoryId = resolveCategoryId(categoryId)

  return getProductGroups().filter((product) => (
    product.categories?.some((category) => resolveCategoryId(category) === resolvedCategoryId)
  ))
}

export function getProductGroupCountByCategory(categoryId: string): number {
  return getProductGroupsByCategory(categoryId).length
}

export function getProductsUpdatedAt(): Date {
  return fs.statSync(PRODUCTS_FILE_PATH).mtime
}

export { getProducts as getRUProducts }
