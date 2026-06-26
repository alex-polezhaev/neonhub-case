'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Loader2, Package, RefreshCw, Search } from 'lucide-react'
import { AuthGuard } from '@/components/auth-guard'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface SizeEntry {
  size_preview: string
  tube_mm: number
  adjustment: number
  width_cm: number
  height_cm: number
  led_length_m: number
  power_w: number
  area_m2: number
  used_otsu_threshold: number
  price?: number | string
  final_price?: number | string
  retail_price?: number | string
  sale_price?: number | string
  total_price?: number | string
  [key: string]: unknown
}

interface Product {
  row_number: string | number
  title: string
  slug: string
  type: string
  categories: string
  otsu_threshold: number
  sizes_json: SizeEntry[] | string
  image?: string
  preview?: string
  approved?: boolean
  review?: string
}

interface Variant {
  row_number: string | number
  product: string
  color?: string
  img1?: string
  img2?: string
  img3?: string
}

type ReviewFilter = 'pending' | 'cool' | 'defect'

const FILTERS: { value: ReviewFilter; label: string }[] = [
  { value: 'pending', label: 'No review' },
  { value: 'cool', label: 'Cool' },
  { value: 'defect', label: 'Defect' },
]

function parseSizes(raw: SizeEntry[] | string): SizeEntry[] {
  if (Array.isArray(raw)) return raw
  try {
    return JSON.parse(raw)
  } catch {
    return []
  }
}

function getSizePrice(size: SizeEntry): number | null {
  const candidateKeys = ['price', 'final_price', 'retail_price', 'sale_price', 'total_price'] as const

  for (const key of candidateKeys) {
    const value = size[key]
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value === 'string') {
      const normalized = Number(value.replace(/\s/g, '').replace(',', '.'))
      if (Number.isFinite(normalized)) return normalized
    }
  }

  return null
}

function formatPrice(price: number) {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0,
  }).format(price)
}

function ProductReviewContent() {
  const [products, setProducts] = useState<Product[]>([])
  const [variants, setVariants] = useState<Variant[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<ReviewFilter>('pending')
  const [pending, setPending] = useState<{ rowNumber: string | number; review: string } | null>(null)
  const [updatingRows, setUpdatingRows] = useState<Set<string>>(new Set())
  const pendingTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  async function fetchProducts() {
    setLoading(true)
    setError(null)
    try {
      const [productsRes, variantsRes] = await Promise.all([
        fetch('/api/products'),
        fetch('/api/variants'),
      ])
      if (!productsRes.ok) throw new Error(`Products HTTP ${productsRes.status}`)
      if (!variantsRes.ok) throw new Error(`Variants HTTP ${variantsRes.status}`)

      const productsData = await productsRes.json()
      const variantsData = await variantsRes.json()
      const productsArr: Product[] = Array.isArray(productsData) ? productsData : productsData.data || productsData.products || []
      const variantsArr: Variant[] = Array.isArray(variantsData) ? variantsData : variantsData.data || variantsData.variants || []

      setProducts(productsArr)
      setVariants(variantsArr)
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProducts()

    return () => {
      if (pendingTimer.current) clearTimeout(pendingTimer.current)
    }
  }, [])

  function handleReviewClick(rowNumber: string | number, review: string) {
    if (pending?.rowNumber === rowNumber && pending?.review === review) {
      if (pendingTimer.current) clearTimeout(pendingTimer.current)
      setPending(null)
      void setReview(rowNumber, review)
      return
    }

    if (pendingTimer.current) clearTimeout(pendingTimer.current)
    setPending({ rowNumber, review })
    pendingTimer.current = setTimeout(() => setPending(null), 2000)
  }

  async function setReview(rowNumber: string | number, review: string) {
    const rowKey = String(rowNumber)
    const previousReview = products.find(product => product.row_number === rowNumber)?.review

    setUpdatingRows(prev => new Set(prev).add(rowKey))
    setProducts(prev => prev.map(product => (
      product.row_number === rowNumber ? { ...product, review } : product
    )))

    try {
      const res = await fetch('/api/products', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ row_number: rowNumber, review }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
    } catch {
      setProducts(prev => prev.map(product => (
        product.row_number === rowNumber ? { ...product, review: previousReview } : product
      )))
    } finally {
      setUpdatingRows(prev => {
        const next = new Set(prev)
        next.delete(rowKey)
        return next
      })
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()

    return products
      .filter(product => parseSizes(product.sizes_json).length > 0)
      .filter(product => {
        if (filter === 'pending') return !product.review
        return product.review === filter
      })
      .filter(product => !q || (
        product.title?.toLowerCase().includes(q) ||
        product.slug?.toLowerCase().includes(q) ||
        product.type?.toLowerCase().includes(q) ||
        product.categories?.toLowerCase().includes(q)
      ))
      .sort((a, b) => (a.title || a.slug || '').localeCompare(b.title || b.slug || ''))
  }, [filter, products, search])

  const variantsByProduct = useMemo(() => {
    const map: Record<string, Variant[]> = {}
    for (const variant of variants) {
      if (!variant.product) continue
      if (!map[variant.product]) map[variant.product] = []
      map[variant.product].push(variant)
    }
    return map
  }, [variants])

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b bg-card">
        <div className="container mx-auto flex items-center gap-3 px-4 py-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/"><ArrowLeft className="mr-2 h-4 w-4" />Menu</Link>
          </Button>
          <h1 className="text-xl font-semibold">Product Review</h1>
          <Badge variant="secondary" className="ml-1">{filtered.length}</Badge>
          <div className="ml-auto flex items-center gap-2">
            <div className="flex overflow-hidden rounded-lg border text-sm">
              {FILTERS.map(item => (
                <button
                  key={item.value}
                  onClick={() => setFilter(item.value)}
                  className={`px-3 py-1.5 transition-colors ${
                    filter === item.value
                      ? item.value === 'cool'
                        ? 'bg-green-500 text-white'
                        : item.value === 'defect'
                          ? 'bg-red-500 text-white'
                          : 'bg-primary text-primary-foreground'
                      : 'hover:bg-muted'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-48 pl-8"
              />
            </div>
            <Button variant="outline" size="sm" onClick={fetchProducts} disabled={loading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        {loading && (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {error && (
          <div className="rounded-lg bg-destructive/10 p-4 text-sm text-destructive">{error}</div>
        )}

        {!loading && !error && filtered.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-20 text-muted-foreground">
            <Package className="h-10 w-10" />
            <p>No products match the selected filter</p>
          </div>
        )}

        {!loading && !error && (
          <div className="space-y-8">
            {filtered.map(product => {
              const rowKey = String(product.row_number)
              const sizes = parseSizes(product.sizes_json)
              const tube6 = sizes.filter(size => size.tube_mm === 6 && size.width_cm <= 95 && size.height_cm <= 95)
              const photo = product.image || product.preview || null
              const isUpdating = updatingRows.has(rowKey)
              const productVariants = variantsByProduct[product.slug] || variantsByProduct[product.title] || []
              const variantPhotos = productVariants.flatMap(variant =>
                [variant.img1, variant.img2, variant.img3].filter(Boolean) as string[]
              )

              return (
                <div key={rowKey} className="overflow-hidden rounded-xl border bg-card">
                  <div className="flex items-center gap-4 border-b p-4">
                    {photo && (
                      <a href={photo} target="_blank" rel="noopener noreferrer" className="shrink-0">
                        <img
                          src={photo}
                          alt={product.title}
                          className="h-16 w-16 rounded-lg border object-cover transition-opacity hover:opacity-80"
                        />
                      </a>
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-center gap-2 flex-wrap">
                        <span className="text-base font-bold">{product.title || product.slug}</span>
                        {product.review && (
                          <Badge className={product.review === 'cool' ? 'border-0 bg-green-500 text-white' : 'border-0 bg-red-500 text-white'}>
                            {product.review}
                          </Badge>
                        )}
                        {product.approved && (
                          <Badge variant="secondary">approved</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <code className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">{product.slug}</code>
                        {product.type && <Badge variant="outline" className="text-xs">{product.type}</Badge>}
                        {product.categories?.split(',').map(category => (
                          <Badge key={category.trim()} variant="secondary" className="text-xs">
                            {category.trim()}
                          </Badge>
                        ))}
                        <span className="text-xs text-muted-foreground">
                          otsu: <span className="font-mono font-medium">{product.otsu_threshold}</span>
                        </span>
                        <span className="text-xs text-muted-foreground">{sizes.length} sizes</span>
                      </div>
                    </div>

                    <div className="flex shrink-0 gap-2">
                      {(['cool', 'defect'] as const).map(reviewValue => {
                        const isGreen = reviewValue === 'cool'
                        const isArmed = pending?.rowNumber === product.row_number && pending?.review === reviewValue

                        return (
                          <button
                            key={reviewValue}
                            onClick={() => handleReviewClick(product.row_number, reviewValue)}
                            disabled={isUpdating}
                            className={`flex min-w-24 items-center justify-center rounded-lg px-4 py-2 font-bold transition-all active:scale-95 disabled:opacity-50 ${
                              isArmed
                                ? isGreen
                                  ? 'scale-95 bg-green-300 text-green-900 ring-2 ring-green-500'
                                  : 'scale-95 bg-red-300 text-red-900 ring-2 ring-red-500'
                                : isGreen
                                  ? 'bg-green-500 text-white hover:bg-green-600 active:bg-green-700'
                                  : 'bg-red-500 text-white hover:bg-red-600 active:bg-red-700'
                            }`}
                          >
                            {isUpdating
                              ? <Loader2 className="h-4 w-4 animate-spin" />
                              : isArmed
                                ? '?'
                                : reviewValue === 'cool'
                                  ? 'Cool'
                                  : 'Defect'}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {variantPhotos.length > 0 && (
                    <div className="space-y-3 border-b px-4 pb-4 pt-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Variant photos</p>
                        <Badge variant="secondary" className="text-xs">{variantPhotos.length}</Badge>
                        {productVariants.map(variant => (
                          variant.color ? (
                            <Badge key={`${rowKey}-color-${variant.row_number}`} variant="outline" className="text-xs">
                              {variant.color}
                            </Badge>
                          ) : null
                        ))}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {variantPhotos.map((url, index) => (
                          <a
                            key={`${rowKey}-variant-${index}`}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <img
                              src={url}
                              alt={`${product.title || product.slug} variant ${index + 1}`}
                              className="h-64 w-64 rounded-lg border object-cover transition-opacity hover:opacity-80"
                            />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {tube6.length > 0 && (
                    <div className="space-y-4 px-4 pb-4 pt-3">
                      <div>
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tube 6mm</p>
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                          {tube6.map((size, index) => (
                            <div key={`${rowKey}-${index}`} className="overflow-hidden rounded-lg border bg-background">
                              <a href={size.size_preview} target="_blank" rel="noopener noreferrer">
                                <img
                                  src={size.size_preview}
                                  alt={`adj ${size.adjustment}`}
                                  className="aspect-video w-full object-contain bg-muted transition-opacity hover:opacity-80"
                                />
                              </a>
                              <div className="space-y-1 p-2">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-xs font-medium">
                                    adj {size.adjustment > 0 ? `+${size.adjustment}` : size.adjustment}
                                  </span>
                                  <span className="text-xs text-muted-foreground">{size.led_length_m}m</span>
                                </div>
                                <div className="font-mono text-xs text-muted-foreground">
                                  {size.width_cm} x {size.height_cm} cm
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {size.power_w}W · {size.area_m2}m²
                                </div>
                                {(() => {
                                  const price = getSizePrice(size)
                                  return price !== null ? (
                                    <div className="pt-1 text-sm font-semibold text-foreground">
                                      {formatPrice(price)}
                                    </div>
                                  ) : null
                                })()}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}

export default function ProductReviewPage() {
  return (
    <AuthGuard>
      <ProductReviewContent />
    </AuthGuard>
  )
}
