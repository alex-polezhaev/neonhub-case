import { getProductGroups } from '@/lib/products.server'
import { getSiteUrl } from '@/lib/site'
import { CATEGORY_META } from '@/lib/categories'

export const dynamic = 'force-static'

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

export async function GET() {
  const siteUrl = getSiteUrl()
  const products = getProductGroups()

  const urls = products
    .filter(p => p.images?.length > 0)
    .map(product => {
      const pageUrl = `${siteUrl}/product/${product.group_id}/`
      const categoryId = product.categories?.[0] ?? 'other'
      const categoryLabel = CATEGORY_META[categoryId]?.en ?? categoryId

      const imageEntries = product.images.slice(0, 4).map((image, i) => {
        const imageUrl = `${siteUrl}${image}`
        const title = i === 0
          ? `Neon sign ${product.name}`
          : `Neon sign ${product.name} — photo ${i + 1}`
        const caption = `${product.name} — neon sign, category: ${categoryLabel}. NEON HUB.`

        return `
    <image:image>
      <image:loc>${escapeXml(imageUrl)}</image:loc>
      <image:title>${escapeXml(title)}</image:title>
      <image:caption>${escapeXml(caption)}</image:caption>
    </image:image>`
      }).join('')

      return `
  <url>
    <loc>${pageUrl}</loc>${imageEntries}
  </url>`
    })
    .join('')

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">${urls}
</urlset>`

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=86400',
    },
  })
}
