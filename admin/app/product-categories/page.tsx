'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Loader2, Package, RefreshCw, RotateCcw, Save, Search } from 'lucide-react'
import { AuthGuard } from '@/components/auth-guard'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface Product {
  row_number: string | number
  title?: string
  slug?: string
  type?: string
  categories?: string
  image?: string
  preview?: string
  approved?: boolean
  [key: string]: unknown
}

interface Variant {
  row_number: string | number
  product?: string
  img1?: string
  img2?: string
  img3?: string
  [key: string]: unknown
}

const BUSINESS_CATEGORIES = [
  'tobacco',
  'vape',
  'hookah',
  'coffee',
  'cafe',
  'bakery',
  'restaurant',
  'beauty',
  'flowers',
  'beer',
  'balloons',
  'cakes',
  'grocery',
  'gym',
  'navigation',
  'other',
] as const

const HOME_CATEGORIES = [
  'game',
  'funny',
  'logo',
  'animals',
  'phrases',
  'asia',
  'music',
  'car',
  'food',
  'space',
  'movies',
  'names',
  'wedding',
  'birthday',
] as const

const KNOWN_CATEGORIES = new Set<string>([...BUSINESS_CATEGORIES, ...HOME_CATEGORIES])

function asOptionalString(value: unknown): string | undefined {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed || undefined
  }

  if (typeof value === 'number') {
    return String(value)
  }

  return undefined
}

function normalizeProduct(product: Product): Product {
  return {
    ...product,
    title: asOptionalString(product.title),
    slug: asOptionalString(product.slug),
    type: asOptionalString(product.type),
    categories: asOptionalString(product.categories),
    image: asOptionalString(product.image),
    preview: asOptionalString(product.preview),
  }
}

function normalizeCategoryValue(value: string) {
  return value.trim().toLowerCase()
}

function parseCategories(value: string | undefined) {
  const unique = new Set<string>()

  for (const item of (value || '').split(',')) {
    const normalized = normalizeCategoryValue(item)
    if (normalized) unique.add(normalized)
  }

  return Array.from(unique)
}

function formatCategories(categories: string[]) {
  return [...categories].sort((a, b) => a.localeCompare(b)).join(', ')
}

function areStringArraysEqual(left: string[], right: string[]) {
  if (left.length !== right.length) return false

  const leftSorted = [...left].sort()
  const rightSorted = [...right].sort()

  return leftSorted.every((value, index) => value === rightSorted[index])
}

function getUnknownCategories(categories: string[]) {
  return categories.filter(category => !KNOWN_CATEGORIES.has(category))
}

function normalizeVariant(variant: Variant): Variant {
  return {
    ...variant,
    product: asOptionalString(variant.product),
    img1: asOptionalString(variant.img1),
    img2: asOptionalString(variant.img2),
    img3: asOptionalString(variant.img3),
  }
}

function getVariantPhotos(variant: Variant) {
  return [variant.img1, variant.img2, variant.img3].filter(Boolean) as string[]
}

function ProductCategoriesContent() {
  const [products, setProducts] = useState<Product[]>([])
  const [variants, setVariants] = useState<Variant[]>([])
  const [drafts, setDrafts] = useState<Record<string, string[]>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [savingRows, setSavingRows] = useState<Set<string>>(new Set())

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
      const rawProducts: Product[] = Array.isArray(productsData) ? productsData : productsData.data || productsData.products || []
      const rawVariants: Variant[] = Array.isArray(variantsData) ? variantsData : variantsData.data || variantsData.variants || []
      const normalizedProducts = rawProducts.map(normalizeProduct)
      const normalizedVariants = rawVariants.map(normalizeVariant)
      const nextDrafts: Record<string, string[]> = {}

      normalizedProducts.forEach(product => {
        nextDrafts[String(product.row_number)] = parseCategories(product.categories)
      })

      setProducts(normalizedProducts)
      setVariants(normalizedVariants)
      setDrafts(nextDrafts)
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProducts()
  }, [])

  function toggleCategory(rowKey: string, category: string) {
    setDrafts(prev => {
      const current = prev[rowKey] || []
      const next = current.includes(category)
        ? current.filter(item => item !== category)
        : [...current, category]

      return { ...prev, [rowKey]: next }
    })
  }

  function resetDraft(rowKey: string, originalCategories: string | undefined) {
    setDrafts(prev => ({
      ...prev,
      [rowKey]: parseCategories(originalCategories),
    }))
  }

  async function saveProduct(rowKey: string) {
    const product = products.find(item => String(item.row_number) === rowKey)
    if (!product) return

    const nextCategories = drafts[rowKey] || []
    setSavingRows(prev => new Set(prev).add(rowKey))

    try {
      const res = await fetch('/api/products', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          row_number: product.row_number,
          categories: formatCategories(nextCategories),
        }),
      })

      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      setProducts(prev => prev.map(item => (
        String(item.row_number) === rowKey
          ? { ...item, categories: formatCategories(nextCategories) }
          : item
      )))
    } catch (e) {
      setError(String(e))
    } finally {
      setSavingRows(prev => {
        const next = new Set(prev)
        next.delete(rowKey)
        return next
      })
    }
  }

  const firstPhotoByProduct = useMemo(() => {
    const map: Record<string, string> = {}

    for (const variant of variants) {
      if (!variant.product || map[variant.product]) continue
      const firstPhoto = getVariantPhotos(variant)[0]
      if (firstPhoto) map[variant.product] = firstPhoto
    }

    return map
  }, [variants])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()

    return products
      .filter(product => !q || (
        product.title?.toLowerCase().includes(q) ||
        product.slug?.toLowerCase().includes(q) ||
        product.type?.toLowerCase().includes(q) ||
        product.categories?.toLowerCase().includes(q)
      ))
      .sort((left, right) => {
        const leftOriginalKey = formatCategories(parseCategories(left.categories))
        const rightOriginalKey = formatCategories(parseCategories(right.categories))
        const categoryCompare = leftOriginalKey.localeCompare(rightOriginalKey)
        if (categoryCompare !== 0) return categoryCompare

        const leftDraft = drafts[String(left.row_number)] || []
        const rightDraft = drafts[String(right.row_number)] || []
        const leftDirty = !areStringArraysEqual(leftDraft, parseCategories(left.categories))
        const rightDirty = !areStringArraysEqual(rightDraft, parseCategories(right.categories))
        if (leftDirty !== rightDirty) return leftDirty ? -1 : 1

        const leftEmpty = leftDraft.length === 0
        const rightEmpty = rightDraft.length === 0
        if (leftEmpty !== rightEmpty) return leftEmpty ? -1 : 1

        return (left.title || left.slug || '').localeCompare(right.title || right.slug || '')
      })
  }, [drafts, products, search])

  const changedCount = useMemo(() => {
    return products.reduce((count, product) => {
      const rowKey = String(product.row_number)
      const draft = drafts[rowKey] || []
      return count + (areStringArraysEqual(draft, parseCategories(product.categories)) ? 0 : 1)
    }, 0)
  }, [drafts, products])

  const emptyCount = useMemo(() => {
    return products.reduce((count, product) => {
      const draft = drafts[String(product.row_number)] || []
      return count + (draft.length === 0 ? 1 : 0)
    }, 0)
  }, [drafts, products])

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b bg-card">
        <div className="container mx-auto flex items-center gap-3 px-4 py-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/"><ArrowLeft className="mr-2 h-4 w-4" />Menu</Link>
          </Button>
          <h1 className="text-xl font-semibold">Product Categories</h1>
          <Badge variant="secondary">{filtered.length}</Badge>
          <Badge variant={changedCount > 0 ? 'default' : 'secondary'}>{changedCount} changed</Badge>
          <Badge variant={emptyCount > 0 ? 'destructive' : 'secondary'}>{emptyCount} empty</Badge>
          <div className="ml-auto flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search products..."
                value={search}
                onChange={event => setSearch(event.target.value)}
                className="w-56 pl-8"
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
            <p>No products</p>
          </div>
        )}

        {!loading && !error && (
          <div className="space-y-5">
            {filtered.map(product => {
              const rowKey = String(product.row_number)
              const draft = drafts[rowKey] || []
              const original = parseCategories(product.categories)
              const dirty = !areStringArraysEqual(draft, original)
              const unknownDraftCategories = getUnknownCategories(draft)
              const photo = firstPhotoByProduct[product.slug || ''] || firstPhotoByProduct[product.title || ''] || product.image || product.preview || null
              const isSaving = savingRows.has(rowKey)

              return (
                <section
                  key={rowKey}
                  className={`rounded-xl border bg-card p-4 ${dirty ? 'border-primary/50 shadow-sm' : ''}`}
                >
                  <div className="flex items-start gap-4">
                    {photo && (
                      <a href={photo} target="_blank" rel="noopener noreferrer" className="shrink-0">
                        <img
                          src={photo}
                          alt={product.title || product.slug || 'product'}
                          className="h-20 w-20 rounded-lg border object-cover hover:opacity-80 transition-opacity"
                        />
                      </a>
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="mb-2 flex items-center gap-2 flex-wrap">
                        <span className="text-base font-semibold">{product.title || product.slug}</span>
                        {dirty && <Badge>changed</Badge>}
                        {draft.length === 0 && <Badge variant="destructive">no categories</Badge>}
                        {product.type && <Badge variant="outline">{product.type}</Badge>}
                        {product.approved && <Badge variant="secondary">approved</Badge>}
                      </div>

                      <div className="mb-3 flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
                        {product.slug && <code className="rounded bg-muted px-1.5 py-0.5">{product.slug}</code>}
                        <span>row {rowKey}</span>
                      </div>

                      <div className="mb-3 space-y-2">
                        <div>
                          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Current categories</p>
                          <div className="flex flex-wrap gap-1.5">
                            {original.length > 0 ? original.map(category => (
                              <Badge key={category} variant="secondary" className="text-xs">{category}</Badge>
                            )) : (
                              <span className="text-sm text-muted-foreground">Empty</span>
                            )}
                          </div>
                        </div>

                        <div>
                          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Will be saved</p>
                          <div className="flex flex-wrap gap-1.5">
                            {draft.length > 0 ? draft.map(category => (
                              <Badge key={category} variant="default" className="text-xs">{category}</Badge>
                            )) : (
                              <span className="text-sm text-muted-foreground">Empty</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div>
                          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">For business</p>
                          <div className="flex flex-wrap gap-1.5">
                            {BUSINESS_CATEGORIES.map(category => {
                              const selected = draft.includes(category)
                              return (
                                <Button
                                  key={category}
                                  type="button"
                                  variant={selected ? 'default' : 'outline'}
                                  size="sm"
                                  className="h-8 text-xs"
                                  onClick={() => toggleCategory(rowKey, category)}
                                >
                                  {category}
                                </Button>
                              )
                            })}
                          </div>
                        </div>

                        <div>
                          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">For home</p>
                          <div className="flex flex-wrap gap-1.5">
                            {HOME_CATEGORIES.map(category => {
                              const selected = draft.includes(category)
                              return (
                                <Button
                                  key={category}
                                  type="button"
                                  variant={selected ? 'default' : 'outline'}
                                  size="sm"
                                  className="h-8 text-xs"
                                  onClick={() => toggleCategory(rowKey, category)}
                                >
                                  {category}
                                </Button>
                              )
                            })}
                          </div>
                        </div>

                        {unknownDraftCategories.length > 0 && (
                          <div>
                            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Unknown current categories</p>
                            <div className="flex flex-wrap gap-1.5">
                              {unknownDraftCategories.map(category => (
                                <Button
                                  key={category}
                                  type="button"
                                  variant="secondary"
                                  size="sm"
                                  className="h-8 text-xs"
                                  onClick={() => toggleCategory(rowKey, category)}
                                >
                                  {category}
                                </Button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-col gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={!dirty || isSaving}
                        onClick={() => resetDraft(rowKey, product.categories)}
                      >
                        <RotateCcw className="mr-2 h-4 w-4" />
                        Reset
                      </Button>
                      <Button
                        size="sm"
                        disabled={!dirty || isSaving}
                        onClick={() => saveProduct(rowKey)}
                      >
                        {isSaving ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Save className="mr-2 h-4 w-4" />
                        )}
                        Save
                      </Button>
                    </div>
                  </div>
                </section>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}

export default function ProductCategoriesPage() {
  return (
    <AuthGuard>
      <ProductCategoriesContent />
    </AuthGuard>
  )
}
