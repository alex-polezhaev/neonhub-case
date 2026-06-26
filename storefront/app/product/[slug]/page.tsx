import type { Metadata } from "next"
import { Suspense } from "react"
import { notFound } from "next/navigation"
import Link from "next/link"
import { HeaderRU } from "@/components/ru/header"
import { FooterRU } from "@/components/ru/footer"
import { ContactsRU } from "@/components/ru/contacts"
import { ProductView } from "@/components/product-view"
import { getBusinessInfo } from "@/lib/business"
import { getCategoryMeta, resolveCategoryId, translateCategory } from "@/lib/categories"
import { getProductSeoDescription, getProductSeoKeywords } from "@/lib/keywords.server"
import type { Product } from "@/lib/products"
import { getProductDescription, getProductOfferPrice } from "@/lib/product-offers"
import { getProductGroups, getProductsByCategory, getRUProducts } from "@/lib/products.server"
import { getSiteUrl } from "@/lib/site"

export const dynamicParams = false

export function generateStaticParams() {
  return getProductGroups().map((product) => ({ slug: product.group_id }))
}

function buildProductJsonLd(product: Product, slug: string) {
  const siteUrl = getSiteUrl()
  const url = `${siteUrl}/product/${slug}/`
  const price = getProductOfferPrice(product)
  const business = getBusinessInfo()
  const keywords = getProductSeoKeywords(product, 12)

  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    sku: product.group_id,
    name: product.name,
    image: product.images.map((image) => `${siteUrl}${image}`),
    description: getProductDescription(product),
    keywords: keywords.join(', '),
    mainEntityOfPage: url,
    category: product.categories.map((category) => translateCategory(category, 'en')).join(', '),
    brand: {
      '@type': 'Brand',
      name: business.name,
    },
    offers: price
      ? {
          '@type': 'Offer',
          url,
          price,
          priceCurrency: 'USD',
          availability: 'https://schema.org/InStock',
          seller: {
            '@type': 'Organization',
            name: business.name,
            url: `${business.siteUrl}/`,
            telephone: business.phone,
            email: business.email,
          },
        }
      : undefined,
  }
}

function buildBreadcrumbJsonLd(product: Product, slug: string, categoryId: string | null) {
  const siteUrl = getSiteUrl()
  const url = `${siteUrl}/product/${slug}/`
  const categoryUrl = categoryId ? `${siteUrl}/catalog/${categoryId}/` : `${siteUrl}/catalog/`
  const categoryName = categoryId ? translateCategory(categoryId, 'en') : 'Catalog'

  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: `${siteUrl}/`,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Catalog',
        item: `${siteUrl}/catalog/`,
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: categoryName,
        item: categoryUrl,
      },
      {
        '@type': 'ListItem',
        position: 4,
        name: product.name,
        item: url,
      },
    ],
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const product = getProductGroups().find((item) => item.group_id === slug)

  if (!product) {
    return {
      robots: {
        index: false,
        follow: false,
      },
    }
  }

  const description = getProductSeoDescription(product)
  const keywords = getProductSeoKeywords(product, 16)
  const siteUrl = getSiteUrl()
  const images = product.images.slice(0, 4).map((image) => `${siteUrl}${image}`)

  return {
    title: `${product.name} - custom neon sign | NEON HUB`,
    description,
    keywords,
    alternates: {
      canonical: `/product/${slug}/`,
    },
    openGraph: {
      title: `${product.name} - neon sign | NEON HUB`,
      description,
      type: 'website',
      url: `/product/${slug}/`,
      images,
    },
  }
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const products = getRUProducts()

  const product = products.find(p => p.group_id === slug)
  if (!product) notFound()

  const variants = products.filter(p => p.group_id === slug)
  const relatedCategoryId = product.categories.find((category) => getCategoryMeta(category)) ?? product.categories[0] ?? null
  const normalizedCategoryId = relatedCategoryId ? resolveCategoryId(relatedCategoryId) : null
  const relatedProducts = relatedCategoryId ? getProductsByCategory(relatedCategoryId) : []
  const productKeywords = getProductSeoKeywords(product, 10)
  const productJsonLd = buildProductJsonLd(product, slug)
  const breadcrumbJsonLd = buildBreadcrumbJsonLd(product, slug, normalizedCategoryId)

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#050505]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(productJsonLd).replace(/</g, '\\u003c'),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(breadcrumbJsonLd).replace(/</g, '\\u003c'),
        }}
      />
      <div className="scanlines pointer-events-none fixed inset-0 z-[100]" />
      <Suspense fallback={null}>
        <HeaderRU />
      </Suspense>
      <Suspense fallback={<div className="min-h-screen bg-[#050505]" />}>
        <ProductView
          initialProduct={product}
          variants={variants}
          relatedProducts={relatedProducts}
          relatedCategoryId={normalizedCategoryId}
          locale="en"
        />
      </Suspense>
      {productKeywords.length > 0 ? (
        <section className="relative z-10 mx-auto max-w-7xl px-4 pb-8 md:px-6">
          <div className="border border-[#1a1a2e] bg-[#0b0b12]/80 p-6">
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-[#FF9000]">
              Search queries
            </p>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-[#9a9aac] md:text-base">
              This model is searched for using queries related to {product.name.toLowerCase()} and designs for interiors, business, and gifts.
              {normalizedCategoryId ? (
                <>
                  {" "}
                  Browse more in the category{" "}
                  <Link href={`/catalog/${normalizedCategoryId}/`} className="text-[#FF9000] transition-colors hover:text-[#ffc066]">
                    {translateCategory(normalizedCategoryId, "en").toLowerCase()}
                  </Link>
                  .
                </>
              ) : null}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {productKeywords.map((keyword) => (
                <span
                  key={keyword}
                  className="border border-[#2c2c44] bg-[#11111a] px-3 py-2 text-xs font-bold uppercase tracking-[0.18em] text-[#f0f0f0]"
                >
                  {keyword}
                </span>
              ))}
            </div>
          </div>
        </section>
      ) : null}
      <ContactsRU />
      <Suspense fallback={null}>
        <FooterRU />
      </Suspense>
    </main>
  )
}
