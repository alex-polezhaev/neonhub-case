"use client"

import { useState, useRef, useEffect, useMemo, useCallback } from "react"
import Link from "next/link"
import { ArrowUp, ChevronDown, Search, ShoppingBag, X } from "lucide-react"
import { useCart } from "@/components/cart-provider"
import { usePathname, useRouter } from "next/navigation"
import { colorLabel, getColorConfig, getCardColorStyles, directusImage } from "@/lib/utils"
import type { Product, ProductSize } from "@/lib/products"
import { fetchProducts } from "@/lib/products-cache"
import { getSalePrice, getColor, getColors, getProductSizeKey } from "@/lib/products"
import { getCategoryAudience, getCategoryMeta, resolveCategoryId } from "@/lib/categories"

function fakeDiscount(groupId: string): number {
  let hash = 0
  for (let i = 0; i < groupId.length; i++) hash = (hash * 31 + groupId.charCodeAt(i)) & 0xffffffff
  return 10 + (Math.abs(hash) % 31) // 10–40%
}

function getLowestPricedSize(
  sizes: ProductSize[],
  locale: string,
): { size: ProductSize; price: number } | null {
  const priceField = locale === 'ru' ? 'price_rub' : 'price_usd'
  let match: { size: ProductSize; price: number } | null = null

  for (const size of sizes) {
    const rawPrice = size[priceField]
    if (rawPrice == null || rawPrice <= 0) continue
    if (!match || rawPrice < match.price) match = { size, price: rawPrice }
  }

  return match
}

function getLowestDerivedSizePrice(
  sizes: ProductSize[],
  locale: string,
  unitPrice: number | null,
): { size: ProductSize; price: number } | null {
  if (!unitPrice) return null

  let match: { size: ProductSize; price: number } | null = null

  for (const size of sizes) {
    if (!size.width_cm) continue
    const price = locale === 'ru'
      ? Math.round((size.width_cm / 10) * unitPrice)
      : Math.round((size.width_cm / 2.54) * unitPrice * 100) / 100

    if (price <= 0) continue
    if (!match || price < match.price) match = { size, price }
  }

  return match
}

function getCatalogPriceInfo(p: Product, locale: string): { price: number; size: ProductSize | null } {
  const sizes = p.sizes_json ?? []
  const tube6Sizes = sizes.filter(size => size.tube_mm === 6)
  const standardSize = tube6Sizes.find(size => (size.adjustment ?? null) === 0)

  if (locale === 'ru') {
    if (standardSize?.price_rub != null && standardSize.price_rub > 0) {
      return { price: standardSize.price_rub, size: standardSize }
    }

    const fallbackPrice = getLowestPricedSize(sizes, locale)
    if (fallbackPrice) return fallbackPrice

    const per10cm = p.price_per_10cm
      ?? (p.sale_price_rub && p.width_cm && p.width_cm > 0
          ? p.sale_price_rub / (p.width_cm / 10) : null)
    if (standardSize?.width_cm && per10cm) {
      return { price: Math.round((standardSize.width_cm / 10) * per10cm), size: standardSize }
    }

    const fallbackDerivedPrice = getLowestDerivedSizePrice(sizes, locale, per10cm)
    if (fallbackDerivedPrice) return fallbackDerivedPrice
  } else {
    if (standardSize?.price_usd != null && standardSize.price_usd > 0) {
      return { price: standardSize.price_usd, size: standardSize }
    }

    const fallbackPrice = getLowestPricedSize(sizes, locale)
    if (fallbackPrice) return fallbackPrice

    const perIn = p.price_per_in_usd
      ?? (p.sale_price_usd && p.width_in && p.width_in > 0
          ? p.sale_price_usd / p.width_in : null)
    if (standardSize?.width_cm && perIn) {
      return { price: Math.round((standardSize.width_cm / 2.54) * perIn * 100) / 100, size: standardSize }
    }

    const fallbackDerivedPrice = getLowestDerivedSizePrice(sizes, locale, perIn)
    if (fallbackDerivedPrice) return fallbackDerivedPrice
  }

  return { price: getSalePrice(p, locale), size: null }
}

function getMinPrice(p: Product, locale: string): number {
  return getCatalogPriceInfo(p, locale).price
}

function getSizesPriceRange(p: Product, locale: string): { min: number; max: number } {
  const sizes = p.sizes_json ?? []
  const priceField = locale === 'ru' ? 'price_rub' : 'price_usd'
  const per = locale === 'ru' ? (p.price_per_10cm ?? null) : (p.price_per_in_usd ?? null)
  let min = Infinity, max = 0
  for (const size of sizes) {
    const direct = size[priceField]
    if (direct && direct > 0) {
      if (direct < min) min = direct
      if (direct > max) max = direct
      continue
    }
    if (per && size.width_cm) {
      const derived = locale === 'ru'
        ? Math.round((size.width_cm / 10) * per)
        : Math.round((size.width_cm / 2.54) * per * 100) / 100
      if (derived > 0) {
        if (derived < min) min = derived
        if (derived > max) max = derived
      }
    }
  }
  return { min: min === Infinity ? 0 : min, max }
}
import { ANALYTICS_GOALS } from "@/lib/analytics-goals"
import { ymAddToCart, ymClick, ymGoal, ymImpressions } from "@/lib/metrika"
import { vkAddToCart } from "@/lib/vk-pixel"

const translitMap: Record<string, string> = {}

// Brand aliases for non-standard spellings
const brandAliases: Record<string, string> = {}

function normalizeQuery(q: string): string {
  const lower = q.toLowerCase().trim()
  if (brandAliases[lower]) return brandAliases[lower]
  return lower.split('').map(c => translitMap[c] ?? c).join('')
}

const PRICE_FILTERS = [
  { id: 'all', labelRu: 'ANY PRICE', labelEn: 'ANY PRICE' },
  { id: 'p5',  labelRu: 'under $65',            labelEn: 'under $65',   max: 5000,  maxUsd: 65  },
  { id: 'p10', labelRu: 'under $130',           labelEn: 'under $130',  max: 10000, maxUsd: 130 },
  { id: 'p20', labelRu: 'under $260',           labelEn: 'under $260',  max: 20000, maxUsd: 260 },
  { id: 'p99', labelRu: 'over $260',       labelEn: 'over $260',   min: 20000, minUsd: 260 },
]

type CategoryGroupView = 'all' | 'business' | 'home' | 'other'
type MobileFilterSection = 'collection' | 'categories' | 'price' | null

function hardGradient(hexes: string[]): string {
  const step = 100 / hexes.length
  const stops = hexes.map((h, i) => `${h} ${i * step}% ${(i + 1) * step}%`).join(', ')
  return `linear-gradient(135deg, ${stops})`
}

export function ProductCard({ product, variants, locale = 'en', queryString = '', position = 0 }: { product: Product; variants: Product[]; locale?: string; queryString?: string; position?: number }) {
  const [active, setActive] = useState(variants[0])
  const [isFlickering, setIsFlickering] = useState(false)
  const [loadedUrls, setLoadedUrls] = useState<Set<string>>(new Set())
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { addItem } = useCart()

  const markLoaded = (url: string) => setLoadedUrls(prev => prev.has(url) ? prev : new Set(prev).add(url))

  useEffect(() => {
    // randomize the initial color only on the client, after hydration
    if (variants.length > 1) {
      setActive(variants[Math.floor(Math.random() * variants.length)])
    }

    function schedule() {
      const delay = 5000 + Math.random() * 15000
      timeoutRef.current = setTimeout(() => {
        setIsFlickering(true)
        setTimeout(() => {
          if (variants.length > 1) {
            setActive(prev => {
              const others = variants.filter(v => v.slug !== prev.slug)
              return others.length > 0 ? others[Math.floor(Math.random() * others.length)] : prev
            })
          }
          setIsFlickering(false)
        }, 600)
        schedule()
      }, delay)
    }

    schedule()
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current) }
  }, [variants])

  const colors = getColors(active)
  const cc = getColorConfig(colors[0] ?? 'cyan')
  const cardStyles = getCardColorStyles(colors)
  const priceInfo = getCatalogPriceInfo(active, locale)
  const hrefParams = new URLSearchParams(queryString)
  const selectedSizeKey = getProductSizeKey(priceInfo.size)
  if (selectedSizeKey) hrefParams.set('size', selectedSizeKey)
  else hrefParams.delete('size')
  const href = `/product/${product.group_id}${hrefParams.toString() ? `?${hrefParams.toString()}` : ''}`
  const activeColorKey = getColor(active) || null
  const activeColorLabel = activeColorKey ? colorLabel(activeColorKey, locale) : null
  const catalogSizeLabel = priceInfo.size?.width_cm
    ? `${priceInfo.size.width_cm} × ${priceInfo.size.height_cm ?? "?"} cm`
    : null

  const isMulti = colors.length > 1

  return (
    <div
      className={`group relative block ${isMulti
        ? `p-[2px] ${cardStyles.className}`
        : `overflow-hidden border-2 bg-[#0a0a0f]/80 backdrop-blur-sm ${cardStyles.className}`
      } ${isFlickering ? "neon-flicker-once" : ""}`}
      style={{
        ...cardStyles.style,
        boxShadow: cardStyles.boxShadow,
        transition: 'box-shadow 0.6s, border-color 0.6s',
      }}
    >
      <Link
        href={href}
        className="block h-full"
        onClick={() => {
          sessionStorage.setItem('catalog_scroll', String(window.scrollY))
          ymClick({ id: active.slug, name: active.name, price: getMinPrice(active, locale), category: active.categories[0] ?? '', variant: getColor(active), position })
        }}
      >
        <div className={isMulti ? "relative overflow-hidden bg-[#0a0a0f] h-full" : "contents"}>
          {/* Sale Badge */}
          {product.sale_percent ? (
            <div className="absolute left-2 top-2 z-10 px-2 py-1 text-xs font-bold uppercase tracking-wider text-black md:left-3 md:top-3"
              style={{ backgroundColor: locale === 'ru' ? '#FF9000' : '#ff2d95' }}>
              -{product.sale_percent}%
            </div>
          ) : null}

          {/* Product Display */}
          <div className="relative aspect-square overflow-hidden bg-gradient-to-br from-[#0a0a0f] to-[#1a1a2e]">
            {active.images && active.images.length > 0 ? (
              <>
                {/* Loading placeholder */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="animate-pulse text-xs font-bold uppercase tracking-widest text-[#888899]">
                    {locale === 'ru' ? 'Loading...' : 'Loading...'}
                  </span>
                </div>

                <img
                  key={active.slug}
                  src={directusImage(active.images[0], 20, 800)}
                  alt={locale === 'ru' ? `Neon sign ${active.name}` : `Neon sign ${active.name}`}
                  loading="lazy"
                  ref={(el) => { if (el?.complete) markLoaded(active.images[0]) }}
                  style={{ opacity: loadedUrls.has(active.images[0]) ? 1 : 0, transition: 'opacity 0.5s', position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                  onLoad={() => markLoaded(active.images[0])}
                  className={`transition-all duration-500 ${active.images.length > 1 ? 'group-hover:opacity-0' : 'group-hover:scale-105 group-hover:brightness-50'}`}
                />
                {active.images.length > 1 ? (
                  <img
                    src={directusImage(active.images[1], 20, 800)}
                    alt={locale === 'ru' ? `Neon sign ${active.name} - alternate view` : `Neon sign ${active.name} - alternate view`}
                    loading="lazy"
                    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                    className="opacity-0 transition-all duration-500 group-hover:opacity-100"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center bg-[#050505]/60 opacity-0 transition-opacity duration-500 group-hover:opacity-100">
                    <span className="text-sm uppercase tracking-widest text-[#888899]">{locale === 'ru' ? 'view' : 'view'}</span>
                  </div>
                )}
              </>
            ) : (
              <>
                {/* Text-based product - Neon On */}
                <div className="absolute inset-0 flex items-center justify-center p-4 transition-opacity duration-500 group-hover:opacity-0">
                  <span className={`text-center font-sans text-lg font-black uppercase tracking-wider md:text-3xl ${cc.textClass}`}>
                    {active.name}
                  </span>
                </div>

                {/* Text-based product - Neon Off (hover) */}
                <div className="absolute inset-0 flex items-center justify-center p-4 opacity-0 transition-opacity duration-500 group-hover:opacity-100">
                  <span
                    className="text-center font-sans text-lg font-black uppercase tracking-wider md:text-3xl"
                    style={{ color: cc.hex + '4d', textShadow: 'none' }}
                  >
                    {active.name}
                  </span>
                  <span className="absolute bottom-4 right-4 text-xs uppercase tracking-widest text-[#888899]">
                    off
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Product Info */}
          <div className="border-t-2 border-[#1a1a2e] p-3 md:p-5">
            <h3 className={`${locale === 'ru' ? 'font-tektur' : 'font-sans'} text-sm font-bold uppercase tracking-wide text-[#f0f0f0] md:text-lg`}>
              {product.name}
            </h3>

            <div className="mt-2 relative min-h-[4.5rem] md:mt-4 md:min-h-[3.5rem]">
              <div className="transition-all duration-300 md:group-hover:pointer-events-none md:group-hover:translate-y-2 md:group-hover:opacity-0 md:group-focus-within:pointer-events-none md:group-focus-within:translate-y-2 md:group-focus-within:opacity-0">
                {/* Color dots — mobile: above price, desktop: next to price */}
                <div className="flex gap-1 md:hidden">
                  {variants.map((v, i) => {
                    const vc = getColors(v)
                    const dotStyle = vc.length > 1
                      ? { background: hardGradient(vc.map(c => getColorConfig(c).hex)) }
                      : { backgroundColor: getColorConfig(vc[0] ?? 'cyan').hex }
                    return (
                      <span
                        key={`${v.slug}-${i}`}
                        className={`h-2.5 w-2.5 rounded-full border transition-all duration-500 ${v.slug === active.slug ? "border-white scale-125" : "border-[#1a1a2e]"}`}
                        style={dotStyle}
                      />
                    )
                  })}
                </div>

                <div className="mt-2 flex items-center justify-between md:mt-0">
                  <div className="flex flex-col gap-0">
                    {(() => {
                      const minPrice = priceInfo.price
                      const listPrice = active.sale_percent
                        ? Math.round(minPrice / (1 - active.sale_percent / 100))
                        : null

                      const range = getSizesPriceRange(active, locale)
                      const rangeMin = range.min
                      const rangeMax = range.max
                      const showRange = rangeMax > rangeMin

                      return (<>
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-black md:text-2xl transition-colors duration-500 whitespace-nowrap" style={{ color: cc.hex }}>
                            {locale === 'ru' ? `$${minPrice}` : `$${minPrice}`}
                          </span>
                          {listPrice && (
                            <span className="text-xs text-[#888899] line-through md:text-base whitespace-nowrap">
                              {locale === 'ru' ? `$${listPrice}` : `$${listPrice}`}
                            </span>
                          )}
                        </div>
                        {showRange && (
                          <span className="text-xs text-[#555566] whitespace-nowrap">
                            {locale === 'ru'
                              ? `$${rangeMin.toLocaleString('en')} – $${rangeMax.toLocaleString('en')}`
                              : `$${rangeMin} – $${rangeMax}`}
                          </span>
                        )}
                      </>)
                    })()}
                  </div>

                  <div className="hidden gap-1 md:flex">
                    {variants.map((v, i) => {
                      const vc = getColors(v)
                      const dotStyle = vc.length > 1
                        ? { background: hardGradient(vc.map(c => getColorConfig(c).hex)) }
                        : { backgroundColor: getColorConfig(vc[0] ?? 'cyan').hex }
                      return (
                        <span
                          key={`${v.slug}-${i}`}
                          className={`h-3 w-3 rounded-full border transition-all duration-500 ${
                            v.slug === active.slug ? "border-white scale-125" : "border-[#1a1a2e]"
                          }`}
                          style={dotStyle}
                        />
                      )
                    })}
                  </div>
                </div>
              </div>

              <button
                type="button"
                aria-label={locale === 'ru' ? 'Add to cart' : 'Add to cart'}
                className="pointer-events-none absolute inset-x-0 top-0 hidden h-full translate-y-2 items-center justify-center gap-2 border-2 border-[#FF9000] bg-[#FF9000] px-4 text-xs font-black uppercase tracking-[0.22em] text-black opacity-0 shadow-[0_0_14px_rgba(255,144,0,0.3)] transition-all duration-300 md:flex md:group-hover:pointer-events-auto md:group-hover:translate-y-0 md:group-hover:opacity-100 md:group-focus-within:pointer-events-auto md:group-focus-within:translate-y-0 md:group-focus-within:opacity-100"
                onClick={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  ymAddToCart({
                    id: active.slug,
                    name: active.name,
                    price: priceInfo.price,
                    category: active.categories[0] ?? "catalog",
                    variant: activeColorKey ?? "",
                    quantity: 1,
                  })
                  ymGoal(ANALYTICS_GOALS.addToCart, {
                    source: "catalog",
                    product_id: active.slug,
                    product_name: active.name,
                    category: active.categories[0] ?? "catalog",
                    variant: activeColorKey ?? "",
                    size: catalogSizeLabel ?? "",
                    price: priceInfo.price,
                  })
                  vkAddToCart({
                    source: "catalog",
                    productId: active.group_id,
                    productName: active.name,
                    category: active.categories[0] ?? "catalog",
                    variant: activeColorKey ?? "",
                    size: catalogSizeLabel ?? "",
                    price: priceInfo.price,
                    quantity: 1,
                  })
                  addItem({
                    groupId: active.group_id,
                    slug: active.slug,
                    href,
                    name: active.name,
                    locale,
                    price: priceInfo.price,
                    image: active.images[0] ?? null,
                    colorKey: activeColorKey,
                    colorLabel: activeColorLabel,
                    sizeKey: selectedSizeKey || null,
                    sizeLabel: catalogSizeLabel,
                  })
                }}
              >
                <ShoppingBag size={16} strokeWidth={2.3} />
                <span>{locale === 'ru' ? 'Add to cart' : 'Add to cart'}</span>
              </button>
            </div>
          </div>
        </div>
      </Link>
    </div>
  )
}

export function Catalog({
  locale = 'en',
  activeCategoryId = 'all',
  compactTop = false,
}: {
  locale?: string
  activeCategoryId?: string
  compactTop?: boolean
}) {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchProducts()
      .then(setProducts)
      .finally(() => setLoading(false))
  }, [])
  const pathname = usePathname()
  const router = useRouter()
  const [catalogQueryString, setCatalogQueryString] = useState('')

  useEffect(() => {
    const qs = window.location.search.startsWith('?')
      ? window.location.search.slice(1)
      : window.location.search
    if (qs) setCatalogQueryString(qs)
  }, [])
  const catalogParams = useMemo(
    () => new URLSearchParams(catalogQueryString),
    [catalogQueryString],
  )
  const [query, setQuery] = useState("")
  const priceFilter = catalogParams.get("price") || "all"
  const normalizedActiveCategoryId = resolveCategoryId(activeCategoryId)
  const [categoryView, setCategoryView] = useState<CategoryGroupView>('all')
  const [openMobileSection, setOpenMobileSection] = useState<MobileFilterSection>('categories')
  const [showScrollTop, setShowScrollTop] = useState(false)

  useEffect(() => {
    setCategoryView(
      normalizedActiveCategoryId === 'all'
        ? 'all'
        : getCategoryAudience(normalizedActiveCategoryId),
    )
  }, [normalizedActiveCategoryId])

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 900)
    }

    handleScroll()
    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  useEffect(() => {
    const syncFromLocation = () => {
      const nextQueryString = window.location.search.startsWith("?")
        ? window.location.search.slice(1)
        : window.location.search
      setCatalogQueryString(nextQueryString)
    }

    window.addEventListener("popstate", syncFromLocation)
    return () => window.removeEventListener("popstate", syncFromLocation)
  }, [])

  useEffect(() => {
    const saved = sessionStorage.getItem('catalog_scroll')
    if (saved) {
      sessionStorage.removeItem('catalog_scroll')
      const y = parseInt(saved, 10)
      requestAnimationFrame(() => window.scrollTo({ top: y, behavior: 'instant' }))
    }
  }, [])

  useEffect(() => {
    if (products.length === 0) return
    const seen = new Set<string>()
    const unique = products.filter(p => seen.has(p.group_id) ? false : (seen.add(p.group_id), true))
    ymImpressions(unique.map((p, i) => ({
      id: p.slug, name: p.name, price: getMinPrice(p, locale),
      category: p.categories[0] ?? '', variant: getColor(p), position: i + 1,
    })))
  }, [products, locale])

  const baseFiltered = useMemo(() => {
    let result = products.filter((product) => getMinPrice(product, locale) > 0)

    if (priceFilter && priceFilter !== 'all') {
      const pf = PRICE_FILTERS.find(f => f.id === priceFilter)
      if (pf) {
        result = result.filter(p => {
          const price = getMinPrice(p, locale)
          if ('min' in pf) return price > (locale === 'ru' ? pf.min! : pf.minUsd!)
          return price <= (locale === 'ru' ? pf.max! : pf.maxUsd!)
        })
      }
    }
    return result
  }, [priceFilter, products, locale])

  const availableCategories = useMemo(() => {
    const seenGroups = new Set<string>()
    const uniqueBase = baseFiltered.filter((product) => {
      if (seenGroups.has(product.group_id)) return false
      seenGroups.add(product.group_id)
      return true
    })

    const categoryCounts = uniqueBase.reduce<Record<string, number>>((acc, product) => {
      for (const categoryId of product.categories ?? []) {
        const resolvedCategoryId = resolveCategoryId(categoryId)
        acc[resolvedCategoryId] = (acc[resolvedCategoryId] ?? 0) + 1
      }
      return acc
    }, {})

    const ids = new Set(baseFiltered.flatMap((product) => (
      (product.categories ?? []).map((categoryId) => resolveCategoryId(categoryId))
    )))
    const all = { id: 'all', label: locale === 'ru' ? 'ALL' : 'ALL', emoji: '', count: uniqueBase.length }
    const rest = [...ids]
      .filter(id => id !== 'all')
      .map(id => {
        const meta = getCategoryMeta(id)
        return {
          id,
          label: meta ? (locale === 'ru' ? meta.ru : meta.en) : id.toUpperCase(),
          emoji: meta?.emoji ?? '',
          count: categoryCounts[id] ?? 0,
        }
      })
      .sort((left, right) => {
        if (right.count !== left.count) return right.count - left.count
        return left.label.localeCompare(right.label, locale === 'ru' ? 'ru' : 'en')
      })
    return [all, ...rest]
  }, [baseFiltered, locale])

  const groupedCategories = useMemo(() => {
    const allCategory = availableCategories.find((category) => category.id === 'all') ?? null
    const businessCategories = availableCategories.filter((category) => (
      category.id !== 'all' && getCategoryAudience(category.id) === 'business'
    ))
    const homeCategories = availableCategories.filter((category) => (
      category.id !== 'all' && getCategoryAudience(category.id) === 'home'
    ))
    const otherCategories = availableCategories.filter((category) => (
      category.id !== 'all' && getCategoryAudience(category.id) === 'other'
    ))

    return {
      allCategory,
      businessCategories,
      homeCategories,
      otherCategories,
    }
  }, [availableCategories])

  const categoryViewTabs = useMemo(() => {
    const seenGroups = new Set<string>()
    const uniqueBase = baseFiltered.filter((product) => {
      if (seenGroups.has(product.group_id)) return false
      seenGroups.add(product.group_id)
      return true
    })

    const countByAudience = uniqueBase.reduce<Record<CategoryGroupView, number>>((acc, product) => {
      const audiences = new Set(
        (product.categories ?? []).map((categoryId) => getCategoryAudience(resolveCategoryId(categoryId))),
      )

      if (audiences.has('business')) acc.business += 1
      if (audiences.has('home')) acc.home += 1
      if (audiences.has('other')) acc.other += 1

      return acc
    }, { all: uniqueBase.length, business: 0, home: 0, other: 0 })

    return [
      { id: 'all' as const, label: locale === 'ru' ? 'All' : 'All', count: countByAudience.all },
      { id: 'business' as const, label: locale === 'ru' ? 'Business' : 'Business', count: countByAudience.business },
      { id: 'home' as const, label: locale === 'ru' ? 'Home' : 'Home', count: countByAudience.home },
      { id: 'other' as const, label: locale === 'ru' ? 'More' : 'More', count: countByAudience.other },
    ].filter((tab) => tab.count > 0)
  }, [baseFiltered, locale])

  const visibleCategories = useMemo(() => {
    const specificCategories = categoryView === 'business'
      ? groupedCategories.businessCategories
      : categoryView === 'home'
        ? groupedCategories.homeCategories
        : categoryView === 'other'
          ? groupedCategories.otherCategories
          : availableCategories.filter((category) => category.id !== 'all')

    return groupedCategories.allCategory
      ? [groupedCategories.allCategory, ...specificCategories]
      : specificCategories
  }, [availableCategories, categoryView, groupedCategories])

  const allFiltered = useMemo(() => {
    return normalizedActiveCategoryId === "all"
      ? baseFiltered
      : baseFiltered.filter((product) => (
          (product.categories ?? []).some((categoryId) => (
            resolveCategoryId(categoryId) === normalizedActiveCategoryId
          ))
        ))
  }, [normalizedActiveCategoryId, baseFiltered])

  const searched = query.trim()
    ? allFiltered.filter(p => {
        const name = p.name.toLowerCase()
        const q = query.toLowerCase().trim()
        return name.includes(q) || name.includes(normalizeQuery(q))
      })
    : allFiltered

  // Deduplicate by group_id
  const seenGroups = new Set<string>()
  const deduped = searched.filter(p => {
    if (seenGroups.has(p.group_id)) return false
    seenGroups.add(p.group_id)
    return true
  })
  const filteredProducts = [...deduped].sort((left, right) => (
    left.name.localeCompare(right.name, locale === 'ru' ? 'ru' : 'en')
  ))

  const variantsByGroup = allFiltered.reduce<Record<string, Product[]>>((acc, p) => {
    acc[p.group_id] = acc[p.group_id] ? [...acc[p.group_id], p] : [p]
    return acc
  }, {})

  const productQueryString = useMemo(() => {
    const params = new URLSearchParams(catalogQueryString)
    if (normalizedActiveCategoryId !== 'all') params.set('category', normalizedActiveCategoryId)
    else params.delete('category')
    return params.toString()
  }, [catalogQueryString, normalizedActiveCategoryId])

  const activePriceLabel = locale === 'ru'
    ? PRICE_FILTERS.find((filter) => filter.id === priceFilter)?.labelRu
    : PRICE_FILTERS.find((filter) => filter.id === priceFilter)?.labelEn
  const activeCategoryLabel = visibleCategories.find((category) => category.id === normalizedActiveCategoryId)?.label
    ?? (normalizedActiveCategoryId === 'all' ? (locale === 'ru' ? 'All categories' : 'All categories') : null)
  const activeCollectionLabel = categoryViewTabs.find((tab) => tab.id === categoryView)?.label
    ?? (locale === 'ru' ? 'All' : 'All')
  const hasActiveFilters = normalizedActiveCategoryId !== 'all' || priceFilter !== 'all' || query.trim().length > 0

  const replaceCatalogParams = (update: (params: URLSearchParams) => void) => {
    const params = new URLSearchParams(catalogQueryString)
    update(params)
    const qs = params.toString()
    const nextUrl = qs ? `${pathname}?${qs}` : pathname
    setCatalogQueryString(qs)
    window.history.replaceState(window.history.state, "", nextUrl)
  }

  const handleCategoryChange = (categoryId: string) => {
    setOpenMobileSection(null)
    const params = new URLSearchParams(catalogQueryString)
    params.delete('size')
    params.delete('category')
    const qs = params.toString()
    const nextPath = categoryId === "all" ? "/catalog/" : `/catalog/${categoryId}/`
    router.push(qs ? `${nextPath}?${qs}` : nextPath, { scroll: false })
  }

  const handleResetFilters = () => {
    setOpenMobileSection(null)
    setQuery("")

    const params = new URLSearchParams(catalogQueryString)
    params.delete('size')
    params.delete('price')
    params.delete('category')
    const qs = params.toString()

    setCatalogQueryString(qs)

    if (normalizedActiveCategoryId === 'all') {
      const nextUrl = qs ? `${pathname}?${qs}` : pathname
      window.history.replaceState(window.history.state, "", nextUrl)
      return
    }

    router.push(qs ? `/catalog/?${qs}` : '/catalog/', { scroll: false })
  }

  if (loading) return (
    <section className="relative min-h-[60vh] bg-[#050505] flex items-center justify-center">
      <span className="animate-pulse text-sm font-bold uppercase tracking-widest text-[#444]">
        {locale === 'ru' ? 'Loading...' : 'Loading...'}
      </span>
    </section>
  )

  const renderCategoryButton = (cat: { id: string; label: string; emoji: string; count: number }) => {
    const isActive = normalizedActiveCategoryId === cat.id
    const accent = locale === 'ru' ? '#FF9000' : '#ff2d95'

    return (
      <button
        key={cat.id}
        onClick={() => handleCategoryChange(cat.id)}
        className="flex shrink-0 items-center gap-1 border px-2 py-1.5 text-[10px] font-bold uppercase tracking-[0.08em] transition-all duration-200 md:shrink md:gap-2 md:px-3 md:py-2 md:text-xs md:tracking-[0.22em]"
        style={isActive ? cat.id === 'all' ? {
          borderColor: accent,
          backgroundColor: accent,
          color: locale === 'ru' ? '#000' : '#fff',
          boxShadow: locale === 'ru'
            ? '0 0 12px rgba(255,144,0,0.28)'
            : '0 0 12px rgba(255,45,149,0.28)',
        } : {
          borderColor: accent,
          backgroundColor: `${accent}12`,
          color: accent,
        } : {
          borderColor: '#1a1a2e',
          backgroundColor: '#0a0a0f',
          color: '#888899',
        }}
      >
        <span>{cat.emoji ? `${cat.emoji} ${cat.label}` : cat.label}</span>
        <span className="text-[10px] tracking-[0.12em] opacity-70">{cat.count}</span>
      </button>
    )
  }

  const renderPriceButton = (pf: typeof PRICE_FILTERS[number]) => {
    const isActive = priceFilter === pf.id
    const accent = locale === 'ru' ? '#FF9000' : '#ff2d95'
    const label = locale === 'ru' ? pf.labelRu : pf.labelEn

    return (
      <button
        key={pf.id}
        onClick={() => {
          setOpenMobileSection(null)
          replaceCatalogParams((params) => {
            params.delete('size')
            if (pf.id === 'all') params.delete('price')
            else params.set('price', pf.id)
          })
        }}
        className="border px-2 py-1.5 text-[10px] font-bold uppercase tracking-[0.08em] transition-all duration-200 md:px-3 md:py-2 md:text-[11px] md:tracking-[0.22em]"
        style={isActive ? pf.id === 'all' ? {
          borderColor: accent,
          backgroundColor: accent,
          color: locale === 'ru' ? '#000' : '#fff',
          boxShadow: locale === 'ru'
            ? '0 0 12px rgba(255,144,0,0.28)'
            : '0 0 12px rgba(255,45,149,0.28)',
        } : {
          borderColor: accent,
          backgroundColor: `${accent}12`,
          color: accent,
        } : {
          borderColor: '#1a1a2e',
          backgroundColor: '#08080d',
          color: '#888899',
        }}
      >
        {label}
      </button>
    )
  }

  return (
    <section id="catalog" className={`relative min-h-screen bg-[#050505] pb-24 ${compactTop ? 'pt-6' : 'pt-24'}`}>
      {/* Background Effects */}
      <div className="absolute inset-0">
        <div className="absolute right-0 top-0 h-[500px] w-[500px] rounded-full bg-[#bf00ff] opacity-10 blur-[200px]" />
        <div className="absolute bottom-0 left-0 h-[400px] w-[400px] rounded-full bg-[#ff2d95] opacity-10 blur-[150px]" />
      </div>

      {/* Cyber Grid */}
      <div className="cyber-grid absolute inset-0" />

      <div className="relative z-10 mx-auto max-w-7xl px-4 md:px-6">

        {/* Search + Filters */}
        <div className="mb-10 flex flex-col gap-5">
          <div className="p-0 md:border md:border-[#1a1a2e] md:bg-[#0a0a0f]/90 md:p-5 md:backdrop-blur-sm">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
                <div className="relative flex-1">
                  <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#888899]" />
                  <input
                    type="text"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder={locale === 'ru' ? 'Search products...' : 'Search products...'}
                    className="w-full border border-[#1a1a2e] bg-[#08080d] py-3 pl-12 pr-12 text-sm uppercase tracking-[0.18em] text-[#f0f0f0] placeholder:text-[#444] outline-none transition-colors"
                    onFocus={e => (e.currentTarget.style.borderColor = locale === 'ru' ? '#FF9000' : '#ff2d95')}
                    onBlur={e => (e.currentTarget.style.borderColor = '#1a1a2e')}
                  />
                  {query && (
                    <button
                      onClick={() => setQuery("")}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-[#888899] transition-colors hover:text-[#f0f0f0]"
                    >
                      <X size={18} />
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-[0.24em] text-[#888899] md:justify-end">
                  <span>{locale === 'ru' ? `${filteredProducts.length} items` : `${filteredProducts.length} items`}</span>
                  {activeCategoryLabel && normalizedActiveCategoryId !== 'all' ? <span>{activeCategoryLabel}</span> : null}
                  {activePriceLabel && priceFilter !== 'all' ? <span>{activePriceLabel}</span> : null}
                  {hasActiveFilters ? (
                    <button
                      type="button"
                      onClick={handleResetFilters}
                      className="border border-[#1a1a2e] px-3 py-2 text-[10px] text-[#f0f0f0] transition-colors hover:border-[#FF9000] hover:text-[#FF9000]"
                    >
                      {locale === 'ru' ? 'Reset' : 'Reset'}
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="md:hidden">
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => setOpenMobileSection((current) => current === 'collection' ? null : 'collection')}
                    className="flex w-full items-center justify-between border border-[#1a1a2e] px-4 py-3 text-left"
                  >
                    <span>
                      <span className="block text-[10px] font-bold uppercase tracking-[0.3em] text-[#888899]">
                        {locale === 'ru' ? 'Business / Home' : 'Business / Home'}
                      </span>
                      <span className="mt-1 block text-xs font-bold uppercase tracking-[0.18em] text-[#f0f0f0]">
                        {activeCollectionLabel}
                      </span>
                    </span>
                    <ChevronDown
                      size={18}
                      className={`text-[#888899] transition-transform ${openMobileSection === 'collection' ? 'rotate-180' : ''}`}
                    />
                  </button>
                  {openMobileSection === 'collection' ? (
                    <div className="flex flex-wrap gap-1.5 px-1 py-2">
                      {categoryViewTabs.map((tab) => {
                        const isActive = categoryView === tab.id
                        return (
                          <button
                            key={tab.id}
                            type="button"
                            onClick={() => {
                              setCategoryView(tab.id)
                              setOpenMobileSection(null)
                            }}
                            className="flex items-center gap-1.5 border px-2 py-1.5 text-[10px] font-bold uppercase tracking-[0.08em] transition-all duration-200"
                            style={isActive ? {
                              borderColor: locale === 'ru' ? '#FF9000' : '#ff2d95',
                              backgroundColor: locale === 'ru' ? 'rgba(255,144,0,0.12)' : 'rgba(255,45,149,0.12)',
                              color: locale === 'ru' ? '#FF9000' : '#ff2d95',
                            } : {
                              borderColor: '#1a1a2e',
                              color: '#888899',
                            }}
                          >
                            <span>{tab.label}</span>
                            <span className="text-[10px] tracking-[0.12em] opacity-70">{tab.count}</span>
                          </button>
                        )
                      })}
                    </div>
                  ) : null}

                  <button
                    type="button"
                    onClick={() => setOpenMobileSection((current) => current === 'categories' ? null : 'categories')}
                    className="flex w-full items-center justify-between border border-[#1a1a2e] px-4 py-3 text-left"
                  >
                    <span>
                      <span className="block text-[10px] font-bold uppercase tracking-[0.3em] text-[#888899]">
                        {locale === 'ru' ? 'Categories' : 'Categories'}
                      </span>
                      <span className="mt-1 block text-xs font-bold uppercase tracking-[0.18em] text-[#f0f0f0]">
                        {activeCategoryLabel}
                      </span>
                    </span>
                    <ChevronDown
                      size={18}
                      className={`text-[#888899] transition-transform ${openMobileSection === 'categories' ? 'rotate-180' : ''}`}
                    />
                  </button>
                  {openMobileSection === 'categories' ? (
                    <div className="flex flex-wrap gap-1.5 px-1 py-2">
                      {visibleCategories.map(renderCategoryButton)}
                    </div>
                  ) : null}

                  <button
                    type="button"
                    onClick={() => setOpenMobileSection((current) => current === 'price' ? null : 'price')}
                    className="flex w-full items-center justify-between border border-[#1a1a2e] px-4 py-3 text-left"
                  >
                    <span>
                      <span className="block text-[10px] font-bold uppercase tracking-[0.3em] text-[#888899]">
                        {locale === 'ru' ? 'Price' : 'Price'}
                      </span>
                      <span className="mt-1 block text-xs font-bold uppercase tracking-[0.18em] text-[#f0f0f0]">
                        {activePriceLabel ?? (locale === 'ru' ? 'Any price' : 'Any price')}
                      </span>
                    </span>
                    <ChevronDown
                      size={18}
                      className={`text-[#888899] transition-transform ${openMobileSection === 'price' ? 'rotate-180' : ''}`}
                    />
                  </button>
                  {openMobileSection === 'price' ? (
                    <div className="flex flex-wrap gap-1.5 px-1 py-2">
                      {PRICE_FILTERS.map(renderPriceButton)}
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="hidden md:block">
                <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.3em] text-[#888899]">
                  {locale === 'ru' ? 'Business / Home' : 'Business / Home'}
                </p>
                <div className="flex flex-wrap gap-2">
                  {categoryViewTabs.map((tab) => {
                    const isActive = categoryView === tab.id
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setCategoryView(tab.id)}
                        className="flex items-center gap-2 border px-3 py-2 text-[11px] font-bold uppercase tracking-[0.22em] transition-all duration-200"
                        style={isActive ? {
                          borderColor: locale === 'ru' ? '#FF9000' : '#ff2d95',
                          backgroundColor: locale === 'ru' ? 'rgba(255,144,0,0.12)' : 'rgba(255,45,149,0.12)',
                          color: locale === 'ru' ? '#FF9000' : '#ff2d95',
                        } : {
                          borderColor: '#1a1a2e',
                          backgroundColor: '#08080d',
                          color: '#888899',
                        }}
                      >
                        <span>{tab.label}</span>
                        <span className="text-[10px] tracking-[0.12em] opacity-70">{tab.count}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="hidden md:block">
                <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.3em] text-[#888899]">
                  {locale === 'ru' ? 'Categories' : 'Categories'}
                </p>
                <div className="flex flex-wrap gap-2">
                  {visibleCategories.map(renderCategoryButton)}
                </div>
              </div>

              <div className="hidden md:block">
                <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.3em] text-[#888899]">
                  {locale === 'ru' ? 'Price' : 'Price'}
                </p>
                <div className="flex flex-wrap gap-2">
                  {PRICE_FILTERS.map(renderPriceButton)}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* No results */}
        {filteredProducts.length === 0 && (
          <div className="py-20 text-center text-[#888899] uppercase tracking-widest">
            {locale === 'ru' ? 'No results found' : 'No results found'}
          </div>
        )}

        {/* Products Grid */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-2 sm:gap-3 md:grid-cols-3 md:gap-6 lg:grid-cols-4 xl:grid-cols-5">
          {filteredProducts.map((product, i) => (
            <ProductCard
              key={product.slug}
              product={product}
              variants={variantsByGroup[product.group_id] ?? [product]}
              locale={locale}
              queryString={productQueryString}
              position={i + 1}
            />
          ))}
        </div>

        <button
          type="button"
          aria-label={locale === 'ru' ? 'Back to top' : 'Back to top'}
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className={`fixed bottom-24 right-4 z-40 flex h-14 w-14 items-center justify-center border-2 border-[#FF9000] bg-[#FF9000] text-black shadow-[0_0_18px_rgba(255,144,0,0.45)] transition-all duration-300 hover:bg-transparent hover:text-[#FF9000] sm:bottom-6 md:bottom-8 md:right-8 ${
            showScrollTop ? 'pointer-events-auto translate-y-0 opacity-100' : 'pointer-events-none translate-y-4 opacity-0'
          }`}
        >
          <ArrowUp size={22} />
        </button>
      </div>
    </section>
  )
}
