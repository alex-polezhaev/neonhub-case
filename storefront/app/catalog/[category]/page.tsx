import type { Metadata } from "next"
import { Suspense } from "react"
import { notFound, permanentRedirect } from "next/navigation"
import Link from "next/link"
import { HeaderRU } from "@/components/ru/header"
import { FooterRU } from "@/components/ru/footer"
import { Catalog } from "@/components/catalog"
import { CATEGORY_ALIASES, resolveCategoryId, translateCategory } from "@/lib/categories"
import { getCategorySeoCopy } from "@/lib/keywords.server"
import { getCatalogProductGroupCountByCategory, getCategoryIds, getProductGroupsByCategory, getProductsByCategory } from "@/lib/products.server"
import { getSiteUrl } from "@/lib/site"

export const dynamicParams = false

function buildCategoryJsonLd(categoryId: string, categoryLabel: string) {
  const siteUrl = getSiteUrl()
  const products = getProductGroupsByCategory(categoryId)
  const seo = getCategorySeoCopy(categoryId)

  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `${categoryLabel} - neon signs catalog`,
    description: seo.description,
    url: `${siteUrl}/catalog/${categoryId}/`,
    keywords: seo.keywords.join(", "),
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: products.length,
      itemListElement: products.slice(0, 24).map((product, index) => ({
        "@type": "ListItem",
        position: index + 1,
        url: `${siteUrl}/product/${product.group_id}/`,
        name: product.name,
      })),
    },
  }
}

function buildBreadcrumbJsonLd(categoryId: string, categoryLabel: string) {
  const siteUrl = getSiteUrl()

  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: `${siteUrl}/`,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Catalog",
        item: `${siteUrl}/catalog/`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: categoryLabel,
        item: `${siteUrl}/catalog/${categoryId}/`,
      },
    ],
  }
}

export function generateStaticParams() {
  const categoryIds = getCategoryIds()
  const aliasIds = Object.entries(CATEGORY_ALIASES)
    .filter(([, target]) => categoryIds.includes(target))
    .map(([alias]) => alias)

  return [...new Set([...categoryIds, ...aliasIds])].map((category) => ({ category }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string }>
}): Promise<Metadata> {
  const { category } = await params
  const categoryId = resolveCategoryId(category)
  const categoryProducts = getProductsByCategory(categoryId)

  if (categoryProducts.length === 0) {
    return {
      robots: {
        index: false,
        follow: false,
      },
    }
  }

  const seo = getCategorySeoCopy(categoryId)

  return {
    title: seo.title,
    description: seo.description,
    keywords: seo.keywords,
    alternates: {
      canonical: `/catalog/${categoryId}/`,
    },
    openGraph: {
      title: seo.title,
      description: seo.description,
      type: "website",
      url: `/catalog/${categoryId}/`,
    },
  }
}

export default async function CategoryCatalogPage({
  params,
}: {
  params: Promise<{ category: string }>
}) {
  const { category } = await params
  const categoryId = resolveCategoryId(category)

  if (category !== categoryId) {
    permanentRedirect(`/catalog/${categoryId}/`)
  }

  const categoryProducts = getProductsByCategory(categoryId)
  if (categoryProducts.length === 0) notFound()

  const seo = getCategorySeoCopy(categoryId)
  const categoryLabel = translateCategory(categoryId, "en")
  const categoryCount = getCatalogProductGroupCountByCategory(categoryId, "en")
  const collectionJsonLd = buildCategoryJsonLd(categoryId, categoryLabel)
  const breadcrumbJsonLd = buildBreadcrumbJsonLd(categoryId, categoryLabel)

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#050505]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(collectionJsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(breadcrumbJsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <div className="scanlines pointer-events-none fixed inset-0 z-[100]" />
      <Suspense fallback={null}>
        <HeaderRU />
      </Suspense>
      <section className="relative z-10 mx-auto max-w-7xl px-4 pb-6 pt-32 md:px-6">
        <p className="text-sm font-bold uppercase tracking-[0.3em] text-[#FF9000]">
          Catalog category
        </p>
        <h1 className="mt-4 font-tektur text-4xl font-bold uppercase tracking-wide text-[#f0f0f0] md:text-6xl">
          {categoryLabel}
        </h1>
        <p className="mt-6 max-w-3xl text-sm leading-6 text-[#9a9aac] md:text-base md:leading-7">
          {seo.intro}
        </p>
        <p className="mt-4 text-sm font-bold uppercase tracking-[0.24em] text-[#FF9000] md:text-base">
          In this category: {categoryCount}
        </p>
        <div className="mt-6 flex flex-wrap gap-4">
          <Link
            href="/catalog/"
            className="inline-flex items-center border-2 border-[#1a1a2e] px-6 py-3 text-sm font-bold uppercase tracking-widest text-[#f0f0f0] transition-colors hover:border-[#FF9000] hover:text-[#FF9000]"
          >
            All categories
          </Link>
        </div>
      </section>
      <Catalog locale="en" activeCategoryId={categoryId} compactTop />
      {seo.keywords.length > 0 ? (
        <section className="relative z-10 mx-auto max-w-7xl px-4 pb-8 md:px-6">
          <div className="border border-[#1a1a2e] bg-[#0b0b12]/80 p-6">
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-[#FF9000]">
              Category SEO queries
            </p>
            <p className="mt-3 max-w-4xl text-sm leading-7 text-[#9a9aac] md:text-base">
              {seo.description}
            </p>
            <div className="mt-4 flex flex-wrap gap-1.5 md:gap-2">
              {seo.keywords.map((keyword) => (
                <span
                  key={keyword}
                  className="border border-[#2c2c44] bg-[#11111a] px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[#f0f0f0] md:px-3 md:py-2 md:text-xs md:tracking-[0.18em]"
                >
                  {keyword}
                </span>
              ))}
            </div>
          </div>
        </section>
      ) : null}
      <Suspense fallback={null}>
        <FooterRU />
      </Suspense>
    </main>
  )
}
