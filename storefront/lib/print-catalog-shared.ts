export const PRINT_CATALOG_PAGE_COUNT = 16
export const PRINT_CATALOG_BLEED_MM = 0
export const PRINT_CATALOG_PRODUCT_PAGE_COUNT = PRINT_CATALOG_PAGE_COUNT - 2
export const PRINT_CATALOG_GRID_SIZES = [4, 6, 8] as const
export type PrintCatalogGridSize = (typeof PRINT_CATALOG_GRID_SIZES)[number]
export const PRINT_CATALOG_DEFAULT_GRID_SIZE: PrintCatalogGridSize = 4
export const PRINT_CATALOG_PRODUCTS_PER_PAGE = PRINT_CATALOG_DEFAULT_GRID_SIZE

export function getPrintCatalogMaxProducts(productsPerPage: PrintCatalogGridSize) {
  return PRINT_CATALOG_PRODUCT_PAGE_COUNT * productsPerPage
}

export const PRINT_CATALOG_MAX_PRODUCTS =
  getPrintCatalogMaxProducts(PRINT_CATALOG_DEFAULT_GRID_SIZE)
export const PRINT_CATALOG_ABSOLUTE_MAX_PRODUCTS =
  getPrintCatalogMaxProducts(8)

export interface PrintCatalogProduct {
  groupId: string
  slug: string
  name: string
  colors: string[]
  categories: string[]
  categoryLabels: string[]
  image: string
  productUrl: string
  widthCm: number | null
  heightCm: number | null
}

export interface PrintCatalogContactLink {
  id: string
  label: string
  value: string
  url: string
}

export interface PrintCatalogRecord {
  id: string
  title: string
  productGroupIds: string[]
  productsPerPage: PrintCatalogGridSize
  pageCount: number
  bleedMm: number
  createdAt: string
  updatedAt: string
}

export interface PrintCatalogSummary {
  id: string
  title: string
  productCount: number
  updatedAt: string
}
