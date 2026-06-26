'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { ArrowLeft, RefreshCw, Loader2, ImageIcon, Save, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface Variant {
  row_number: string | number
  product: string
  color: string
  img1: string
  img2: string
  img3: string
}

interface VariantWithColors extends Variant {
  selectedColors: string[]
  saving: boolean
  saved: boolean
}

const COLORS: { name: string; label: string; bg: string; border: string }[] = [
  { name: 'blue',    label: 'Blue',    bg: 'bg-blue-500',   border: 'border-blue-600' },
  { name: 'yellow',  label: 'Yellow',  bg: 'bg-yellow-400', border: 'border-yellow-500' },
  { name: 'green',   label: 'Green',   bg: 'bg-green-500',  border: 'border-green-600' },
  { name: 'red',     label: 'Red',     bg: 'bg-red-500',    border: 'border-red-600' },
  { name: 'orange',  label: 'Orange',  bg: 'bg-orange-500', border: 'border-orange-600' },
  { name: 'pink',    label: 'Pink',    bg: 'bg-pink-400',   border: 'border-pink-500' },
  { name: 'neutral', label: 'Neutral', bg: 'bg-amber-50',   border: 'border-amber-200' },
  { name: 'white',   label: 'White',   bg: 'bg-white',      border: 'border-zinc-300' },
  { name: 'purple',  label: 'Purple',  bg: 'bg-purple-500', border: 'border-purple-600' },
]

function hasPhoto(v: Variant) {
  return !!v.img1 || !!v.img2 || !!v.img3
}

function photos(v: Variant) {
  return [v.img1, v.img2, v.img3].filter(Boolean)
}

export default function VariantColorsPage() {
  const [variants, setVariants] = useState<VariantWithColors[]>([])
  const [loading, setLoading] = useState(true)
  const [globalSaving, setGlobalSaving] = useState(false)

  const fetchVariants = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/variants')
      const data = await res.json()
      const arr: Variant[] = Array.isArray(data) ? data : data.data || []
      const filtered = arr.filter(v => hasPhoto(v) && !v.color)
      setVariants(filtered.map(v => ({ ...v, selectedColors: [], saving: false, saved: false })))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchVariants() }, [fetchVariants])

  function toggleColor(rowNumber: string | number, colorName: string) {
    setVariants(prev => prev.map(v => {
      if (v.row_number !== rowNumber) return v
      const has = v.selectedColors.includes(colorName)
      return {
        ...v,
        saved: false,
        selectedColors: has
          ? v.selectedColors.filter(c => c !== colorName)
          : [...v.selectedColors, colorName],
      }
    }))
  }

  async function saveVariant(rowNumber: string | number) {
    const variant = variants.find(v => v.row_number === rowNumber)
    if (!variant || variant.selectedColors.length === 0) return

    setVariants(prev => prev.map(v => v.row_number === rowNumber ? { ...v, saving: true } : v))
    try {
      await fetch('/api/variants', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ row_number: rowNumber, color: variant.selectedColors.join(',') }),
      })
      setVariants(prev => prev.map(v =>
        v.row_number === rowNumber ? { ...v, saving: false, saved: true } : v
      ))
    } catch {
      setVariants(prev => prev.map(v => v.row_number === rowNumber ? { ...v, saving: false } : v))
    }
  }

  async function saveAll() {
    const pending = variants.filter(v => v.selectedColors.length > 0 && !v.saved)
    if (pending.length === 0) return
    setGlobalSaving(true)
    await Promise.all(pending.map(v => saveVariant(v.row_number)))
    setGlobalSaving(false)
  }

  const pendingCount = variants.filter(v => v.selectedColors.length > 0 && !v.saved).length
  const savedCount = variants.filter(v => v.saved).length

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center gap-3 flex-wrap">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/"><ArrowLeft className="w-4 h-4 mr-2" />Menu</Link>
          </Button>
          <h1 className="text-xl font-semibold">Variant Colors</h1>
          <Badge variant="secondary">{variants.length} variants</Badge>
          {savedCount > 0 && (
            <Badge variant="default" className="bg-green-500">{savedCount} saved</Badge>
          )}
          <div className="ml-auto flex items-center gap-2">
            {pendingCount > 0 && (
              <Button onClick={saveAll} disabled={globalSaving} size="sm">
                {globalSaving
                  ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  : <Save className="w-4 h-4 mr-2" />}
                Save all ({pendingCount})
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={fetchVariants} disabled={loading}>
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

        {!loading && variants.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-20 text-muted-foreground">
            <ImageIcon className="w-10 h-10" />
            <p>No variants without a color</p>
          </div>
        )}

        {!loading && (
          <div className="flex flex-col gap-4">
            {variants.map(variant => (
              <div
                key={variant.row_number}
                className={`rounded-xl border bg-card p-4 transition-all ${
                  variant.saved ? 'border-green-400 bg-green-50/30' : ''
                }`}
              >
                <div className="flex items-start gap-4 flex-wrap">
                  {/* Photos */}
                  <div className="flex gap-2 shrink-0">
                    {photos(variant).map((url, i) => (
                      <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                        <img
                          src={url}
                          alt={`${variant.product} photo ${i + 1}`}
                          className="w-20 h-20 object-cover rounded-lg border hover:opacity-80 transition-opacity"
                        />
                      </a>
                    ))}
                  </div>

                  {/* Info + colors */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="font-medium text-sm">{variant.product}</span>
                      {variant.saved && (
                        <Badge className="bg-green-500 text-white text-xs py-0">
                          <Check className="w-3 h-3 mr-1" />
                          Saved: {variant.selectedColors.join(', ')}
                        </Badge>
                      )}
                    </div>

                    {/* Color picker */}
                    <div className="grid grid-cols-3 gap-1 mb-3 w-fit">
                      {COLORS.map(color => {
                        const selected = variant.selectedColors.includes(color.name)
                        return (
                          <button
                            key={color.name}
                            onClick={() => toggleColor(variant.row_number, color.name)}
                            disabled={variant.saving || variant.saved}
                            className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-medium transition-all ${
                              selected
                                ? `${color.border} ring-2 ring-offset-1 ring-current bg-muted/50`
                                : 'border-border hover:border-muted-foreground'
                            } disabled:opacity-50 disabled:cursor-not-allowed`}
                          >
                            <span
                              className={`w-4 h-4 rounded-full ${color.bg} border ${color.border} shrink-0`}
                            />
                            {color.label}
                            {selected && <Check className="w-3 h-3" />}
                          </button>
                        )
                      })}
                    </div>

                    {/* Save button */}
                    {!variant.saved && (
                      <Button
                        size="sm"
                        onClick={() => saveVariant(variant.row_number)}
                        disabled={variant.selectedColors.length === 0 || variant.saving}
                      >
                        {variant.saving
                          ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                          : <Save className="w-3.5 h-3.5 mr-1.5" />}
                        Save
                        {variant.selectedColors.length > 0 && (
                          <span className="ml-1.5 opacity-70">
                            ({variant.selectedColors.join(', ')})
                          </span>
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
