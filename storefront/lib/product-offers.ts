import type { Product, ProductSize } from '@/lib/products'

export function getProductOfferPrice(product: Product): number | null {
  const prices = ((product.sizes_json ?? []) as ProductSize[])
    .map((size) => size.price_usd)
    .filter((price): price is number => typeof price === 'number' && price > 0)

  if (prices.length > 0) {
    return Math.min(...prices)
  }

  return product.sale_price_usd ?? product.price_usd ?? null
}

export function getProductDescription(product: Product): string {
  const price = getProductOfferPrice(product)
  const priceText = price ? ` from $${price.toLocaleString('en-US')}` : ''

  return `${product.name} neon sign.${priceText} Custom-made, fast US shipping, 12V power, 2-year warranty.`
}
