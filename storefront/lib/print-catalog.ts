import { promises as fs } from "fs"
import path from "path"
import { getBusinessInfo } from "@/lib/business"
import { translateCategory } from "@/lib/categories"
import { getColors, type Product, type ProductSize } from "@/lib/products"
import { getProductGroups } from "@/lib/products.server"
import { getSiteUrl } from "@/lib/site"
import {
  PRINT_CATALOG_DEFAULT_GRID_SIZE,
  PRINT_CATALOG_BLEED_MM,
  PRINT_CATALOG_MAX_PRODUCTS,
  PRINT_CATALOG_PAGE_COUNT,
  type PrintCatalogContactLink,
  type PrintCatalogProduct,
  type PrintCatalogRecord,
  type PrintCatalogSummary,
} from "@/lib/print-catalog-shared"

const PRINT_CATALOGS_DIR = path.join(process.cwd(), "data", "print-catalogs")

function getStandardSize(product: Product): ProductSize | null {
  const sizes = product.sizes_json ?? []
  const standardSize = sizes.find(
    (size) => size.tube_mm === 6 && (size.adjustment ?? 0) === 0,
  )

  if (standardSize) {
    return standardSize
  }

  return sizes[0] ?? null
}

function toPrintCatalogProduct(product: Product): PrintCatalogProduct {
  const size = getStandardSize(product)
  const siteUrl = getSiteUrl()

  return {
    groupId: product.group_id,
    slug: product.group_id,
    name: product.name,
    colors: getColors(product),
    categories: product.categories ?? [],
    categoryLabels: (product.categories ?? []).map((category) => translateCategory(category, "en")),
    image: product.images[0] ?? "/placeholder.jpg",
    productUrl: `${siteUrl}/product/${product.group_id}/`,
    widthCm: size?.width_cm ?? product.width_cm ?? null,
    heightCm: size?.height_cm ?? product.height_cm ?? null,
  }
}

export function getPrintCatalogProducts(): PrintCatalogProduct[] {
  return getProductGroups()
    .map(toPrintCatalogProduct)
    .sort((a, b) => a.name.localeCompare(b.name, "en"))
}

export function getPrintCatalogContactLinks(): PrintCatalogContactLink[] {
  const business = getBusinessInfo()
  const telegram = business.sameAs.find((link) => link.includes("t.me"))
  const vk = business.sameAs.find((link) => link.includes("vk.ru"))
  const max = business.sameAs.find((link) => link.includes("max.ru"))

  return [
    {
      id: "site",
      label: "Site",
      value: business.siteUrl.replace(/^https?:\/\//, ""),
      url: business.siteUrl,
    },
    telegram
      ? {
          id: "telegram",
          label: "Telegram",
          value: "@neonhub",
          url: telegram,
        }
      : null,
    vk
      ? {
          id: "vk",
          label: "VK",
          value: "vk.com/neonhub",
          url: vk,
        }
      : null,
    max
      ? {
          id: "max",
          label: "MAX",
          value: "NEON HUB",
          url: max,
        }
      : null,
    {
      id: "email",
      label: "Email",
      value: business.email,
      url: `mailto:${business.email}`,
    },
  ].filter((link): link is PrintCatalogContactLink => link !== null)
}

function isValidPrintCatalogRecord(
  value: unknown,
): value is PrintCatalogRecord {
  if (!value || typeof value !== "object") {
    return false
  }

  const record = value as Partial<PrintCatalogRecord>

  return (
    typeof record.id === "string" &&
    typeof record.title === "string" &&
    Array.isArray(record.productGroupIds) &&
    (record.productsPerPage === 4 ||
      record.productsPerPage === 6 ||
      record.productsPerPage === 8) &&
    typeof record.pageCount === "number" &&
    typeof record.bleedMm === "number" &&
    typeof record.createdAt === "string" &&
    typeof record.updatedAt === "string"
  )
}

async function ensurePrintCatalogsDir() {
  await fs.mkdir(PRINT_CATALOGS_DIR, { recursive: true })
}

function getPrintCatalogPath(id: string) {
  return path.join(PRINT_CATALOGS_DIR, `${id}.json`)
}

function normalizeCatalogTitle(title: string) {
  return title.trim() || "New catalog"
}

export function isPrintCatalogEnabled() {
  return process.env.NODE_ENV === "development"
}

export function createPrintCatalogRecord(input: {
  id?: string
  title: string
  productGroupIds: string[]
  createdAt?: string
}): PrintCatalogRecord {
  const timestamp = new Date().toISOString()

  return {
    id: input.id ?? `catalog-${Date.now()}`,
    title: normalizeCatalogTitle(input.title),
    productGroupIds: input.productGroupIds.slice(0, PRINT_CATALOG_MAX_PRODUCTS),
    productsPerPage: PRINT_CATALOG_DEFAULT_GRID_SIZE,
    pageCount: PRINT_CATALOG_PAGE_COUNT,
    bleedMm: PRINT_CATALOG_BLEED_MM,
    createdAt: input.createdAt ?? timestamp,
    updatedAt: timestamp,
  }
}

export async function listPrintCatalogs(): Promise<PrintCatalogSummary[]> {
  await ensurePrintCatalogsDir()
  const entries = await fs.readdir(PRINT_CATALOGS_DIR, { withFileTypes: true })
  const records = await Promise.all(
    entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
      .map(async (entry) => {
        const data = await fs.readFile(
          path.join(PRINT_CATALOGS_DIR, entry.name),
          "utf-8",
        )
        const parsed = JSON.parse(data)
        return isValidPrintCatalogRecord(parsed) ? parsed : null
      }),
  )

  return records
    .filter((record): record is PrintCatalogRecord => record !== null)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map((record) => ({
      id: record.id,
      title: record.title,
      productCount: record.productGroupIds.length,
      updatedAt: record.updatedAt,
    }))
}

export async function readPrintCatalog(
  id: string,
): Promise<PrintCatalogRecord | null> {
  try {
    const data = await fs.readFile(getPrintCatalogPath(id), "utf-8")
    const parsed = JSON.parse(data)
    return isValidPrintCatalogRecord(parsed) ? parsed : null
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null
    }

    throw error
  }
}

export async function writePrintCatalog(
  record: PrintCatalogRecord,
): Promise<PrintCatalogRecord> {
  await ensurePrintCatalogsDir()
  await fs.writeFile(
    getPrintCatalogPath(record.id),
    JSON.stringify(record, null, 2),
    "utf-8",
  )

  return record
}

export async function deletePrintCatalog(id: string) {
  try {
    await fs.unlink(getPrintCatalogPath(id))
    return true
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return false
    }

    throw error
  }
}
