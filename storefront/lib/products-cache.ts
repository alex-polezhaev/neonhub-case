import type { Product } from './products'

const VERSION = process.env.NEXT_PUBLIC_PRODUCTS_VERSION ?? 'dev'

let memoryCache: Product[] | null = null

export async function fetchProducts(): Promise<Product[]> {
  if (memoryCache) return memoryCache

  const res = await fetch(`/data/products.json?v=${VERSION}`, {
    cache: 'force-cache',
  })

  if (!res.ok) throw new Error('Failed to load products')

  const data = await res.json()
  memoryCache = Array.isArray(data) ? data : (data.products ?? [])
  return memoryCache!
}
