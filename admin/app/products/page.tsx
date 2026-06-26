'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import Link from 'next/link'
import { AuthGuard } from '@/components/auth-guard'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { ArrowLeft, RefreshCw, Loader2, Package, Search, Check } from 'lucide-react'

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
}

function parseSizes(raw: SizeEntry[] | string): SizeEntry[] {
  if (Array.isArray(raw)) return raw
  try { return JSON.parse(raw) } catch { return [] }
}

function ProductsContent() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [pendingApprove, setPendingApprove] = useState<string | null>(null)
  const [approvingSlug, setApprovingSlug] = useState<string | null>(null)
  const pendingTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  async function fetchProducts() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/products')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      const arr: Product[] = Array.isArray(data) ? data : data.data || data.products || []
      setProducts(arr)
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchProducts() }, [])

  function handleApproveClick(slug: string) {
    if (pendingApprove === slug) {
      if (pendingTimer.current) clearTimeout(pendingTimer.current)
      setPendingApprove(null)
      approveProduct(slug)
    } else {
      if (pendingTimer.current) clearTimeout(pendingTimer.current)
      setPendingApprove(slug)
      pendingTimer.current = setTimeout(() => setPendingApprove(null), 2000)
    }
  }

  async function approveProduct(slug: string) {
    setApprovingSlug(slug)
    const product = products.find(p => p.slug === slug)
    try {
      await fetch('/api/products', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ row_number: product?.row_number, approved: true }),
      })
      setProducts(prev => prev.filter(p => p.slug !== slug))
    } finally {
      setApprovingSlug(null)
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return products
      .filter(p => !p.approved)
      .filter(p => !q || (
        p.title?.toLowerCase().includes(q) ||
        p.slug?.toLowerCase().includes(q) ||
        p.type?.toLowerCase().includes(q) ||
        p.categories?.toLowerCase().includes(q)
      ))
  }, [products, search])

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/"><ArrowLeft className="w-4 h-4 mr-2" />Menu</Link>
          </Button>
          <h1 className="text-xl font-semibold">Approve Products</h1>
          <Badge variant="secondary" className="ml-1">{filtered.length}</Badge>
          <div className="ml-auto flex items-center gap-2">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-8 w-48"
              />
            </div>
            <Button variant="outline" size="sm" onClick={fetchProducts} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        {loading && (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {error && (
          <div className="p-4 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>
        )}

        {!loading && !error && filtered.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-20 text-muted-foreground">
            <Package className="w-10 h-10" />
            <p>No products</p>
          </div>
        )}

        {!loading && !error && (
          <div className="space-y-8">
            {filtered.map(product => {
              const sizes = parseSizes(product.sizes_json)
              const tube6 = sizes.filter(s => s.tube_mm === 6 && s.width_cm <= 95 && s.height_cm <= 95)
              const photo = product.image || product.preview || null
              const isArmed = pendingApprove === product.slug
              const isApproving = approvingSlug === product.slug

              return (
                <div key={product.slug} className="rounded-xl border bg-card overflow-hidden">
                  {/* Product header */}
                  <div className="flex items-center gap-4 p-4 border-b">
                    {photo && (
                      <a href={photo} target="_blank" rel="noopener noreferrer" className="shrink-0">
                        <img
                          src={photo}
                          alt={product.title}
                          className="w-16 h-16 object-cover rounded-lg border hover:opacity-80 transition-opacity"
                        />
                      </a>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-bold text-base">{product.title}</span>
                        {product.approved && (
                          <Badge className="text-xs bg-green-500 text-white border-0">approved</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <code className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{product.slug}</code>
                        <Badge variant="outline" className="text-xs">{product.type}</Badge>
                        {product.categories?.split(',').map(c => (
                          <Badge key={c.trim()} variant="secondary" className="text-xs">{c.trim()}</Badge>
                        ))}
                        <span className="text-xs text-muted-foreground">
                          otsu: <span className="font-mono font-medium">{product.otsu_threshold}</span>
                        </span>
                        <span className="text-xs text-muted-foreground">{sizes.length} sizes</span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleApproveClick(product.slug)}
                      disabled={isApproving || product.approved}
                      className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg font-medium text-sm transition-all active:scale-95 disabled:opacity-50 ${
                        product.approved
                          ? 'bg-green-500 text-white cursor-default'
                          : isArmed
                          ? 'bg-green-200 ring-2 ring-green-500 scale-95 text-green-900'
                          : 'bg-muted hover:bg-green-100 hover:text-green-800 text-foreground'
                      }`}
                    >
                      {isApproving
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <Check className="w-4 h-4" />
                      }
                      {isArmed && !isApproving ? '?' : 'Approve'}
                    </button>
                  </div>

                  {/* Sizes */}
                  {sizes.length > 0 && (
                    <div className="px-4 pb-4 pt-3 space-y-4">
                      {[{ label: 'Tube 6mm', items: tube6 }]
                        .filter(g => g.items.length > 0)
                        .map(group => (
                          <div key={group.label}>
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">{group.label}</p>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                              {group.items.map((size, i) => (
                                <div key={i} className="rounded-lg border bg-background overflow-hidden">
                                  <a href={size.size_preview} target="_blank" rel="noopener noreferrer">
                                    <img
                                      src={size.size_preview}
                                      alt={`adj ${size.adjustment}`}
                                      className="w-full aspect-video object-contain bg-muted hover:opacity-80 transition-opacity"
                                    />
                                  </a>
                                  <div className="p-2 space-y-1">
                                    <div className="flex items-center justify-between">
                                      <span className="text-xs font-medium">adj {size.adjustment > 0 ? `+${size.adjustment}` : size.adjustment}</span>
                                      <span className="text-xs text-muted-foreground">{size.led_length_m}m</span>
                                    </div>
                                    <div className="text-xs text-muted-foreground font-mono">
                                      {size.width_cm} × {size.height_cm} cm
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                      {size.power_w}W · {size.area_m2}m²
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
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

export default function ProductsPage() {
  return (
    <AuthGuard>
      <ProductsContent />
    </AuthGuard>
  )
}
