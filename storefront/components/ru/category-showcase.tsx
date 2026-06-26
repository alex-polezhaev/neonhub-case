"use client"

import { useMemo, useState, useEffect, useRef } from "react"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { ProductCard } from "@/components/catalog"
import { MobileSwipeHint } from "@/components/mobile-swipe-hint"
import { getCategoryAudience, getCategoryMeta, resolveCategoryId, translateCategory } from "@/lib/categories"
import type { Product } from "@/lib/products"
import { ymImpressions } from "@/lib/metrika"

const SHOWCASE_FILTERS = [
  { id: "all", label: "All" },
  { id: "business", label: "For business" },
  { id: "home", label: "For home" },
] as const

type ShowcaseFilterId = (typeof SHOWCASE_FILTERS)[number]["id"]

function hasCatalogPrice(product: Product) {
  return (
    (product.sale_price_rub ?? 0) > 0 ||
    (product.price_rub ?? 0) > 0 ||
    product.sizes_json?.some(size => (size.price_rub ?? 0) > 0)
  )
}

function getFeaturedProductsByCategory(products: Product[], filterId: ShowcaseFilterId) {
  const uniqueProducts = new Map<string, Product>()

  for (const product of products) {
    if (!uniqueProducts.has(product.group_id)) {
      uniqueProducts.set(product.group_id, product)
    }
  }

  const uniqueCategoryIds = new Set<string>()
  for (const product of uniqueProducts.values()) {
    if (!hasCatalogPrice(product)) continue

    for (const categoryId of product.categories ?? []) {
      const resolvedCategoryId = resolveCategoryId(categoryId)
      if (!getCategoryMeta(resolvedCategoryId)) continue
      uniqueCategoryIds.add(resolvedCategoryId)
    }
  }

  const sortedCategoryIds = [...uniqueCategoryIds].sort((left, right) => {
    const leftAudience = filterId === "all" ? getCategoryAudience(left) : filterId
    const rightAudience = filterId === "all" ? getCategoryAudience(right) : filterId

    if (filterId === "all" && leftAudience !== rightAudience) {
      const audienceOrder = { business: 0, home: 1, other: 2 } as const
      return audienceOrder[leftAudience] - audienceOrder[rightAudience]
    }

    return translateCategory(left, "en").localeCompare(translateCategory(right, "en"), "en")
  })

  const categoryIds = sortedCategoryIds.filter((categoryId) => (
    filterId === "all" || getCategoryAudience(categoryId) === filterId
  ))

  return categoryIds.map((categoryId) => {
    const items = [...uniqueProducts.values()]
      .filter((product) => (
        hasCatalogPrice(product) &&
        (product.categories ?? []).some((productCategoryId) => resolveCategoryId(productCategoryId) === categoryId)
      ))

    return {
      id: categoryId,
      label: translateCategory(categoryId, "en"),
      emoji: getCategoryMeta(categoryId)?.emoji ?? "",
      items,
    }
  }).filter((category) => category.items.length > 0)
}

export function CategoryShowcaseRU({ products }: { products: Product[] }) {
  const [activeFilter, setActiveFilter] = useState<ShowcaseFilterId>("all")
  const scrollRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const categories = useMemo(
    () => getFeaturedProductsByCategory(products, activeFilter),
    [products, activeFilter],
  )
  useEffect(() => {
    const allItems = categories.flatMap((c, ci) =>
      c.items.map((p, pi) => {
        const sizes = (p.sizes_json ?? []) as Array<{ price_rub?: number | null }>
        const minPrice = sizes.reduce((min, s) => {
          const pr = s.price_rub ?? 0
          return pr > 0 && pr < min ? pr : min
        }, Infinity)
        return { id: p.slug, name: p.name, price: minPrice === Infinity ? 0 : minPrice, category: c.id, variant: p.color ? (Array.isArray(p.color) ? p.color[0] : p.color) : '', position: ci * 5 + pi + 1 }
      })
    )
    if (allItems.length > 0) ymImpressions(allItems)
  }, [categories])

  const variantsByGroup = useMemo(
    () => products.reduce<Record<string, Product[]>>((acc, product) => {
      acc[product.group_id] = acc[product.group_id] ? [...acc[product.group_id], product] : [product]
      return acc
    }, {}),
    [products],
  )

  return (
    <section id="catalog" className="relative overflow-hidden bg-[#050505] pb-24 pt-32">
      <div className="absolute inset-0">
        <div className="absolute right-0 top-0 h-[420px] w-[420px] rounded-full bg-[#FF9000] opacity-10 blur-[170px]" />
        <div className="absolute bottom-0 left-0 h-[380px] w-[380px] rounded-full bg-white opacity-5 blur-[150px]" />
      </div>
      <div className="cyber-grid absolute inset-0" />

      <div className="relative z-10 mx-auto max-w-7xl px-4 md:px-6">
        <div className="max-w-3xl">
          <p className="text-sm font-bold uppercase tracking-[0.3em] text-[#FF9000]">
            Examples by category
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            {SHOWCASE_FILTERS.map((filter) => {
              const isActive = activeFilter === filter.id
              return (
                <button
                  key={filter.id}
                  type="button"
                  onClick={() => setActiveFilter(filter.id)}
                  className="border-2 px-4 py-2 text-xs font-bold uppercase tracking-widest transition-all"
                  style={isActive ? {
                    borderColor: "#FF9000",
                    backgroundColor: "#FF9000",
                    color: "#000",
                    boxShadow: "0 0 10px #FF9000, 0 0 25px rgba(255,144,0,0.35)",
                  } : {
                    borderColor: "#1a1a2e",
                    backgroundColor: "transparent",
                    color: "#888899",
                  }}
                >
                  {filter.label}
                </button>
              )
            })}
          </div>
          <div className="mt-8">
            <Link
              href="/catalog/"
              className="inline-flex items-center gap-2 border-2 border-[#FF9000] bg-[#FF9000] px-6 py-3 text-sm font-bold uppercase tracking-widest text-black transition-colors hover:bg-transparent hover:text-[#FF9000]"
            >
              Open full catalog
              <ArrowRight size={18} />
            </Link>
          </div>
        </div>

        <div className="mt-14 space-y-10">
          {categories.map((category) => (
            <section
              key={category.id}
              className="p-0 md:border-2 md:border-[#1a1a2e] md:bg-[#0a0a0f]/70 md:p-7 md:backdrop-blur-sm"
            >
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <h3 className="font-tektur text-2xl font-bold uppercase tracking-wide text-[#f0f0f0] md:text-3xl">
                    {category.emoji ? `${category.emoji} ${category.label}` : category.label}
                  </h3>
                </div>
                <Link
                  href={`/catalog/${category.id}/`}
                  className="inline-flex items-center gap-2 self-start border border-[#FF9000] px-4 py-2 text-xs font-bold uppercase tracking-widest text-[#FF9000] transition-colors hover:bg-[#FF9000] hover:text-black"
                >
                  View in catalog
                  <ArrowRight size={16} />
                </Link>
              </div>

              <div className="relative mt-6">
                <MobileSwipeHint
                  className="absolute inset-y-0 left-0 right-0 z-10"
                  onPrev={() => {
                    const el = scrollRefs.current[category.id]
                    if (!el) return
                    const card = el.querySelector('div') as HTMLElement | null
                    el.scrollBy({ left: -(card?.offsetWidth ?? 240) * 2, behavior: "smooth" })
                  }}
                  onNext={() => {
                    const el = scrollRefs.current[category.id]
                    if (!el) return
                    const card = el.querySelector('div') as HTMLElement | null
                    el.scrollBy({ left: (card?.offsetWidth ?? 240) * 2, behavior: "smooth" })
                  }}
                />
                <div
                  ref={(node) => {
                    scrollRefs.current[category.id] = node
                  }}
                  className="flex gap-3 overflow-x-auto pb-2 md:gap-6 md:pt-0"
                >
                  {category.items.map((product) => (
                    <div
                      key={product.group_id}
                      className="min-w-[calc(50%-0.375rem)] md:min-w-[calc(33.333%-1rem)] lg:min-w-[calc(25%-1.125rem)] xl:min-w-[calc(20%-1.2rem)]"
                    >
                      <ProductCard
                        product={product}
                        variants={variantsByGroup[product.group_id] ?? [product]}
                        locale="en"
                        queryString={`category=${category.id}`}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </section>
          ))}
        </div>
      </div>
    </section>
  )
}
