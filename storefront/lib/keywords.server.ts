import fs from 'fs'
import path from 'path'
import type { Product } from './products'
import { getCategoryAudience, resolveCategoryId, translateCategory } from './categories'

type KeywordMap = Record<string, string[]>

type KeywordsFile = {
  common_keys?: string[]
  business?: KeywordMap
  home?: KeywordMap
}

const KEYWORDS_FILE_PATH = path.join(process.cwd(), 'public', 'data', 'keywords.json')

let cachedKeywordsFile: KeywordsFile | null = null

function normalizeKeyword(value: string): string {
  return value.trim()
}

function uniqueKeywords(values: string[], limit = 20): string[] {
  const seen = new Set<string>()
  const unique: string[] = []

  for (const value of values) {
    const keyword = normalizeKeyword(value)
    const fingerprint = keyword.toLowerCase()

    if (!keyword || seen.has(fingerprint)) continue

    seen.add(fingerprint)
    unique.push(keyword)

    if (unique.length >= limit) {
      break
    }
  }

  return unique
}

function readKeywordsFile(): KeywordsFile {
  if (cachedKeywordsFile) return cachedKeywordsFile

  const raw = fs.readFileSync(KEYWORDS_FILE_PATH, 'utf-8')
  cachedKeywordsFile = JSON.parse(raw) as KeywordsFile

  return cachedKeywordsFile
}

export function getCommonSeoKeywords(limit = 20): string[] {
  const data = readKeywordsFile()

  return uniqueKeywords(data.common_keys ?? [], limit)
}

export function getCategorySeoKeywords(categoryId: string, limit = 20): string[] {
  const data = readKeywordsFile()
  const resolvedCategoryId = resolveCategoryId(categoryId)
  const categoryKeywords = [
    ...(data.business?.[resolvedCategoryId] ?? []),
    ...(data.home?.[resolvedCategoryId] ?? []),
  ]

  return uniqueKeywords([
    ...categoryKeywords,
    ...getCommonSeoKeywords(limit),
  ], limit)
}

export function getProductSeoKeywords(product: Pick<Product, 'keywords' | 'categories'>, limit = 20): string[] {
  const categoryKeywords = (product.categories ?? []).flatMap((categoryId) => getCategorySeoKeywords(categoryId, limit))

  return uniqueKeywords([
    ...(product.keywords ?? []),
    ...categoryKeywords,
  ], limit)
}

export function getKeywordText(keywords: string[], limit = 8): string {
  return uniqueKeywords(keywords, limit).join(', ')
}

function trimText(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value

  const trimmed = value.slice(0, maxLength - 1).trim()

  return `${trimmed.replace(/[,\s]+$/, '')}…`
}

export function getCategorySeoCopy(categoryId: string) {
  const resolvedCategoryId = resolveCategoryId(categoryId)
  const categoryLabel = translateCategory(resolvedCategoryId, 'en')
  const categoryLabelLower = categoryLabel.toLowerCase()
  const audience = getCategoryAudience(resolvedCategoryId)
  const keywords = getCategorySeoKeywords(resolvedCategoryId, 16)
  const keywordText = getKeywordText(keywords, 6)
  const titleSubject = audience === 'business'
    ? `for ${categoryLabelLower}`
    : categoryLabelLower
  const introSubject = audience === 'business'
    ? `for ${categoryLabelLower}`
    : `in the ${categoryLabelLower} category`

  const description = keywordText
    ? `NEON HUB catalog: neon signs ${titleSubject}, ${keywordText}. Ready-made designs, custom size and color, fast US shipping.`
    : `NEON HUB catalog: neon signs ${titleSubject}. Ready-made designs, custom size and color, fast US shipping.`

  const intro = keywordText
    ? `A selection of neon signs ${introSubject}: ${keywordText}. Pick a ready-made design or adapt it to your size, color and use case.`
    : `A selection of neon signs ${introSubject}. Pick a ready-made design or adapt it to your size, color and use case.`

  return {
    title: trimText(`Neon signs ${titleSubject} | NEON HUB`, 65),
    description: trimText(description, 170),
    intro: trimText(intro, 220),
    keywords,
  }
}

export function getProductSeoDescription(product: Pick<Product, 'name' | 'keywords' | 'categories'>): string {
  const keywords = getProductSeoKeywords(product, 12)
  const keywordText = getKeywordText(keywords, 5)
  const description = keywordText
    ? `${product.name} neon sign. Themes and searches: ${keywordText}. Custom-made, fast US shipping, 12V power, 2-year warranty.`
    : `${product.name} neon sign. Custom-made, fast US shipping, 12V power, 2-year warranty.`

  return trimText(description, 175)
}
