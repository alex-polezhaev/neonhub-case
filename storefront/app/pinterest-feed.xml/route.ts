import { getProductGroups } from '@/lib/products.server'
import { getSiteUrl } from '@/lib/site'
import { CATEGORY_META, getCategoryAudience } from '@/lib/categories'

// Google Product Taxonomy IDs
// 6394 = Home & Garden > Decor > Novelty Signs
// 5589 = Business & Industrial > Signage
const getGoogleCategory = (categoryId: string): string => {
  const audience = getCategoryAudience(categoryId)
  return audience === 'business' ? '5589' : '6394'
}

export const dynamic = 'force-static'

function getMinPrice(product: ReturnType<typeof getProductGroups>[number]): number {
  const sizes = product.sizes_json ?? []
  const prices = sizes.map(s => s.price_rub).filter((p): p is number => typeof p === 'number' && p > 0)
  return prices.length > 0 ? Math.min(...prices) : 0
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export async function GET() {
  const siteUrl = getSiteUrl()
  const products = getProductGroups()

  const items = products
    .map(product => {
      const price = getMinPrice(product)
      if (price <= 0 || !product.images?.[0]) return null

      const categoryId = product.categories?.[0] ?? 'other'
      const categoryMeta = CATEGORY_META[categoryId]
      const categoryLabel = categoryMeta?.en ?? categoryId
      const productUrl = `${siteUrl}/product/${product.group_id}/`
      const imageUrl = `${siteUrl}${product.images[0]}`
      const title = escapeXml(product.name)
      const description = escapeXml(
        `Neon sign ${product.name}. Category: ${categoryLabel}. Custom-made, fast shipping. 12V power supply, 2-year warranty.`
      )
      const salePrice = product.sale_percent
        ? Math.round(price / (1 - product.sale_percent / 100))
        : null

      return `
    <item>
      <g:id>${escapeXml(product.group_id)}</g:id>
      <g:title>${title}</g:title>
      <g:description>${description}</g:description>
      <g:link>${productUrl}</g:link>
      <g:image_link>${imageUrl}</g:image_link>${product.images[1] ? `
      <g:additional_image_link>${siteUrl}${product.images[1]}</g:additional_image_link>` : ''}
      <g:price>${(salePrice ?? price).toFixed(2)} USD</g:price>${salePrice ? `
      <g:sale_price>${price.toFixed(2)} USD</g:sale_price>` : ''}
      <g:availability>in stock</g:availability>
      <g:condition>new</g:condition>
      <g:brand>NEON HUB</g:brand>
      <g:product_type>${escapeXml(categoryLabel)}</g:product_type>
      <g:google_product_category>${getGoogleCategory(categoryId)}</g:google_product_category>
    </item>`
    })
    .filter(Boolean)
    .join('')

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>NEON HUB — Neon Signs</title>
    <link>${siteUrl}/</link>
    <description>Catalog of neon signs for business and home. Custom-made, fast shipping.</description>${items}
  </channel>
</rss>`

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=86400',
    },
  })
}
