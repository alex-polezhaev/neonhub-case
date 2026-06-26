import type { MetadataRoute } from 'next'
import { getCategoryIds, getProductGroups, getProductsUpdatedAt } from '@/lib/products.server'
import { getSiteUrl } from '@/lib/site'

export const dynamic = 'force-static'

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = getSiteUrl()
  const lastModified = getProductsUpdatedAt()
  const products = getProductGroups()
  const categoryIds = getCategoryIds()

  return [
    {
      url: `${siteUrl}/`,
      lastModified,
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${siteUrl}/catalog/`,
      lastModified,
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${siteUrl}/contacts/`,
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${siteUrl}/delivery-payment/`,
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${siteUrl}/returns/`,
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    ...categoryIds.map((categoryId) => ({
      url: `${siteUrl}/catalog/${categoryId}/`,
      lastModified,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })),
    ...products.map((product) => ({
      url: `${siteUrl}/product/${product.group_id}/`,
      lastModified,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
      images: product.images.map((image) => `${siteUrl}${image}`),
    })),
  ]
}
