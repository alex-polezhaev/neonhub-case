"use client"

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void
  }
}

import { useState, useEffect, useCallback, useRef, useDeferredValue } from "react"
import { useSearchParams } from "next/navigation"
import useEmblaCarousel from "embla-carousel-react"
import Link from "next/link"
import { useCart } from "@/components/cart-provider"
import { ANALYTICS_GOALS } from "@/lib/analytics-goals"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { ArrowLeft, Zap, Shield, Truck, ChevronDown, ChevronUp, Banknote, ZoomIn, Leaf, Ruler, BadgePercent, ChevronLeft, ChevronRight, ShoppingBag } from "lucide-react"
import { ymAddToCart, ymDetail, ymGoal } from "@/lib/metrika"
import { vkAddToCart, vkGoal, vkViewProduct } from "@/lib/vk-pixel"
import { getColorConfig, directusImage, ALL_COLORS, colorLabel } from "@/lib/utils"
import { translateCategory } from "@/lib/categories"
import { OrderPopup } from "@/components/order-popup"
import { OrderPopupRU } from "@/components/ru/order-popup"
import { ProductCard } from "@/components/catalog"
import { MobileSwipeHint } from "@/components/mobile-swipe-hint"
import type { Product, ProductSize } from "@/lib/products"
import { getPrice, getSalePrice, getWidth, getHeight, getColor, getColors, getProductSizeKey } from "@/lib/products"

const DEFAULT_GALLERY_IMAGES: string[] = []

const t = {
  en: {
    back: 'Back to Catalog',
    home: 'Home',
    loading: 'Loading...',
    color: 'Color',
    listPrice: 'List Price:',
    shipping: (date: string) => <>Free shipping. Arrives by <strong>{date}</strong></>,
    energySaving: 'Energy Saving',
    energySize: (width: number | null | undefined, height: number | null | undefined) => `Size ${width ?? '?'} × ${height ?? '?'} cm`,
    energyUsagePerDay: (value: string) => `${value} per day`,
    energyUsageHint: 'At $0.12/kWh with continuous 24-hour use',
    specifications: 'Specifications',
    specs: (p: Product) => [
      { label: 'Dimensions', value: `${p.width_in ?? ''} × ${p.height_in ?? ''} × 2 in` },
      { label: 'Material', value: 'Acrylic backing and flexible neon' },
      { label: 'Power', value: '12V adapter' },
      { label: 'Cable length', value: '1.5 m' },
      { label: 'Neon color', value: colorLabel(getColor(p), 'en') },
    ],
    description: 'Description',
    descriptionText: (
      <>
        <p className="mb-4">Our lamps use modern flexible neon, which has many advantages:</p>
        <ol className="list-inside list-decimal space-y-2">
          <li>Low power consumption. 1 meter of flexible glowing cord consumes only 10W of electricity;</li>
          <li>Durable material resistant to mechanical stress. The flexible shell of LED neon is very difficult to damage. This is a beneficial difference from glass neon tubes;</li>
          <li>The flexible neon strip does not heat up or generate heat when glowing;</li>
          <li>Waterproof material is not afraid of precipitation, can be used at temperatures from -40 to +60 degrees;</li>
          <li>LED flexible neon has a long service life of 10 years or more.</li>
        </ol>
      </>
    ),
    orderNow: 'Order Now',
    addToCart: 'Add to Cart',
    price: (v: number) => `$${v}`,
    benefits: [
      { label: 'Low Energy' },
      { label: '2-Year Warranty' },
      { label: 'Free Shipping' },
    ],
    currency: 'USD',
  },
  ru: {
    back: 'Back to Catalog',
    home: 'Home',
    loading: 'Loading...',
    color: 'Color',
    listPrice: 'List Price:',
    shipping: (_date: string) => <>Pay on delivery</>,
    energySaving: 'Energy Saving',
    energySize: (width: number | null | undefined, height: number | null | undefined) => `Size ${width ?? '?'} × ${height ?? '?'} cm`,
    energyUsagePerDay: (value: string) => `${value} per day`,
    energyUsageHint: 'At $0.12/kWh with continuous 24-hour use',
    specifications: 'Specifications',
    specs: (p: Product) => [
      { label: 'Material', value: 'Acrylic backing and flexible neon' },
      { label: 'Power', value: '12V adapter' },
      { label: 'Cable length', value: '1.5 m' },
      { label: 'Neon color', value: colorLabel(getColor(p), 'en') },
    ],
    description: 'Description',
    descriptionText: (
      <>
        <p className="mb-4">Our signs use modern flexible neon, which has many advantages:</p>
        <ol className="list-inside list-decimal space-y-2">
          <li>Low power consumption. 1 meter of flexible glowing cord consumes only 10W;</li>
          <li>Durable material resistant to mechanical stress. The LED neon shell is very hard to damage;</li>
          <li>The flexible neon strip does not heat up when glowing;</li>
          <li>Waterproof material can be used at temperatures from -40 to +60 degrees;</li>
          <li>LED neon has a long service life of 10 years or more.</li>
        </ol>
      </>
    ),
    orderNow: 'Order Now',
    addToCart: 'Add to Cart',
    price: (v: number) => `$${v}`,
    benefits: [
      { label: 'Low Energy' },
      { label: '2-Year Warranty' },
      { label: 'Free Shipping' },
    ],
    currency: 'USD',
  },
}

export type ProductSizeRow = ProductSize

function fakeDiscount(groupId: string): number {
  let hash = 0
  for (let i = 0; i < groupId.length; i++) hash = (hash * 31 + groupId.charCodeAt(i)) & 0xffffffff
  return 10 + (Math.abs(hash) % 31) // 10–40%
}

function getDiscountPct(p: Product, locale: string): number | null {
  if (p.sale_percent) return p.sale_percent
  const sale = getSalePrice(p, locale)
  const list = getPrice(p, locale)
  if (sale > 0 && list > 0) return Math.round((1 - sale / list) * 100)
  return null
}

function getSizePreviewUrl(src?: string | null): string | null {
  if (!src) return null
  if (src.startsWith('/images/sizes/')) return src
  return `${src.split('?')[0]}?fit=contain&quality=75&format=webp&width=640&height=480`
}

function getGalleryImageAlt(name: string, index: number, locale: string): string {
  return locale === 'ru'
    ? `${name} - image ${index + 1}`
    : `${name} - image ${index + 1}`
}

function getSizeLabel(size?: ProductSize | null): string {
  if (!size) return ''

  const width = size.width_cm ?? '?'
  const height = size.height_cm ?? '?'
  return `${width} × ${height} cm`
}

function getSizePreviewAlt(name: string, size: ProductSize | null | undefined, locale: string): string {
  const sizeLabel = getSizeLabel(size)

  return locale === 'ru'
    ? `${name} - size preview ${sizeLabel}`
    : `${name} - size preview ${sizeLabel}`
}

function getGenericSizePreviewAlt(name: string, locale: string): string {
  return locale === 'ru'
    ? `${name} - size preview`
    : `${name} - size preview`
}

function normalizePaletteColorKey(color?: string | null): string | null {
  if (!color) return null

  const normalizedColor = color.trim().toLowerCase()

  if (normalizedColor === 'cool white') return 'white'
  if (normalizedColor === 'warm white') return 'neutral'

  return normalizedColor
}

function getResolvedColorConfig(color?: string | null) {
  return getColorConfig(normalizePaletteColorKey(color) ?? 'cyan')
}

function isHueFilterSupportedColor(color?: string | null) {
  const normalizedColor = normalizePaletteColorKey(color)
  return normalizedColor !== 'white' && normalizedColor !== 'neutral'
}

function getPreferredHueAnchorColor(colors: string[]) {
  return colors.find((colorKey) => isHueFilterSupportedColor(colorKey)) ?? colors[0] ?? null
}

function preloadImage(src: string): Promise<void> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve()
    img.onerror = () => resolve()
    img.src = src
  })
}


function SizeTablePopup({
  sizes, selectedIdx, onSelect, onClose, cc, isRu, sizePreview, productName, otherSizeEnabled, onToggleOtherSize,
}: {
  sizes: ProductSizeRow[]
  selectedIdx: number
  onSelect: (idx: number) => void
  onClose: () => void
  cc: ReturnType<typeof getColorConfig>
  isRu: boolean
  sizePreview?: string | null
  productName: string
  otherSizeEnabled: boolean
  onToggleOtherSize: (next: boolean) => void
}) {
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null)
  const [hoverSrc, setHoverSrc] = useState<string | null>(null)
  const [hoverPos, setHoverPos] = useState({ x: 0, y: 0 })

  const n = (v: number | null | undefined, suffix: string) =>
    v != null ? `${v} ${suffix}` : '—'

  const priceStr = (size: ProductSizeRow) => {
    const price = isRu ? size.price_rub : size.price_usd
    return isRu
      ? (price != null && price > 0 ? `$${price.toLocaleString('en-US')}` : '—')
      : (price != null && price > 0 ? `$${price}` : '—')
  }

  const previewUrl = getSizePreviewUrl(sizePreview)

  const hasPreview  = sizes.some(s => getSizePreviewUrl(s.size_preview))
  const hasTube     = sizes.some(s => s.tube_mm != null)
  const hasHeight   = sizes.some(s => s.height_cm != null)
  const hasPower    = sizes.some(s => s.power_w != null)

  type Col = { key: string; label: string; render: (s: ProductSizeRow, isActive: boolean) => React.ReactNode; thClass?: string; tdClass?: string }
  const columns: Col[] = [
    ...(hasPreview ? [{
      key: 'preview', label: '',
      thClass: 'w-24',
      render: (size: ProductSizeRow) => {
        const thumb = getSizePreviewUrl(size.size_preview)
        if (!thumb) return <span className="text-[#444] text-xs">—</span>
        return (
          <div
            className="group relative flex h-14 w-20 cursor-zoom-in items-center justify-center overflow-hidden border border-[#1a1a2e] bg-[#0f0f1a]"
            onMouseEnter={e => { setHoverSrc(thumb); setHoverPos({ x: (e as React.MouseEvent).clientX, y: (e as React.MouseEvent).clientY }) }}
            onMouseMove={e => setHoverPos({ x: (e as React.MouseEvent).clientX, y: (e as React.MouseEvent).clientY })}
            onMouseLeave={() => setHoverSrc(null)}
          >
            <img
              src={thumb} alt={getSizePreviewAlt(productName, size, isRu ? 'ru' : 'en')} className="w-full h-full object-contain"
              onError={e => { (e.currentTarget.parentElement as HTMLElement).style.display = 'none' }}
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black/10 transition-colors duration-150 group-hover:bg-black/30">
              <ZoomIn size={16} className="text-[#FF9000] transition-opacity duration-150 group-hover:text-[#FFB347]" />
            </div>
          </div>
        )
      },
    }] : []),
    ...(hasTube ? [{
      key: 'tube', label: isRu ? 'Line thickness' : 'Line thickness',
      render: (size: ProductSizeRow) => <span className="whitespace-nowrap text-[#f0f0f0]">{n(size.tube_mm, 'mm')}</span>,
    }] : []),
    {
      key: 'width', label: isRu ? 'Width' : 'Width',
      render: (size: ProductSizeRow, isActive: boolean) => (
        <span className="whitespace-nowrap font-bold" style={{ color: isActive ? cc.hex : '#f0f0f0' }}>{n(size.width_cm, 'cm')}</span>
      ),
    },
    ...(hasHeight ? [{
      key: 'height', label: isRu ? 'Height' : 'Height',
      render: (size: ProductSizeRow) => <span className="whitespace-nowrap text-[#f0f0f0]">{n(size.height_cm, 'cm')}</span>,
    }] : []),
    ...(hasPower ? [{
      key: 'power', label: isRu ? 'Power' : 'Power',
      render: (size: ProductSizeRow) => <span className="whitespace-nowrap text-[#888899]">{n(size.power_w, 'W')}</span>,
    }] : []),
    {
      key: 'price', label: isRu ? 'Price' : 'Price',
      render: (size: ProductSizeRow, isActive: boolean) => (
        <span className="whitespace-nowrap font-black" style={{ color: isActive ? cc.hex : '#FF9000' }}>{priceStr(size)}</span>
      ),
    },
  ]

  return (
    <>
      <div className="fixed inset-0 z-[200] flex items-end justify-center sm:items-center" onClick={onClose}>
        <div className="absolute inset-0 bg-[#050505]/80 backdrop-blur-md" />
        <div
          className="relative w-full sm:max-w-3xl sm:mx-4 border-t-2 sm:border-2 bg-[#0a0a0f] flex flex-col"
          style={{ maxHeight: '92vh', borderColor: cc.borderRgba, boxShadow: `0 0 40px ${cc.shadowRgba}` }}
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-[#1a1a2e] flex-shrink-0">
            <div className="flex min-w-0 items-center gap-4">
              <p className="text-xs uppercase tracking-widest text-[#888899]">
                {isRu ? 'Select size' : 'Select size'}
              </p>
              {isRu && (
                <button
                  type="button"
                  onClick={() => {
                    const next = !otherSizeEnabled
                    onToggleOtherSize(next)
                    if (next) onClose()
                  }}
                  className="flex items-center gap-2 text-left"
                  aria-pressed={otherSizeEnabled}
                >
                  <span className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-[#f0f0f0]">
                    <Ruler size={14} style={{ color: '#FF9000' }} />
                    Make a custom size
                  </span>
                  <span
                    className="relative h-6 w-11 flex-shrink-0 rounded-full transition-colors duration-200"
                    style={{ backgroundColor: otherSizeEnabled ? '#FF9000' : '#1a1a2e' }}
                  >
                    <span
                      className="absolute left-1 top-1 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200"
                      style={{ transform: otherSizeEnabled ? 'translateX(18px)' : 'translateX(0)' }}
                    />
                  </span>
                </button>
              )}
            </div>
            <button onClick={onClose} className="text-[#888899] hover:text-[#f0f0f0] transition-colors p-2 -mr-2 flex-shrink-0">
              <span style={{ fontSize: 20, lineHeight: 1 }}>✕</span>
            </button>
          </div>

          {/* Preview image */}
          {previewUrl && (
            <div
              className="flex-shrink-0 border-b border-[#1a1a2e] bg-[#0a0a0f] flex items-center justify-center cursor-zoom-in group relative"
              style={{ height: 180 }}
              onClick={() => setLightboxOpen(true)}
            >
              <img
                src={previewUrl} alt={getGenericSizePreviewAlt(productName, isRu ? 'ru' : 'en')} className="max-h-full max-w-full object-contain p-3"
                onError={e => { (e.currentTarget.parentElement as HTMLElement).style.display = 'none' }}
              />
              <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/30 transition-all duration-150">
                <ZoomIn size={28} className="text-white opacity-0 group-hover:opacity-100 transition-opacity duration-150 drop-shadow" />
              </div>
            </div>
          )}

          {/* Mobile: cards */}
          <div className="sm:hidden overflow-y-auto flex-1 divide-y divide-[#1a1a2e]">
            {sizes.map((size, idx) => {
              const isActive = selectedIdx === idx
              const thumb = getSizePreviewUrl(size.size_preview)
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => { onSelect(idx); onClose() }}
                  className="w-full text-left px-4 py-3 transition-colors active:bg-[#111120]"
                  style={isActive ? { backgroundColor: cc.shadowRgba } : {}}
                >
                  <div className="flex items-center gap-3">
                    {hasPreview && thumb && (
                      <div
                        className="w-16 h-12 flex-shrink-0 border border-[#1a1a2e] bg-[#0f0f1a] overflow-hidden flex items-center justify-center relative"
                        onClick={e => { e.stopPropagation(); setLightboxSrc(thumb) }}
                      >
                        <img
                          src={thumb} alt={getSizePreviewAlt(productName, size, isRu ? 'ru' : 'en')} className="w-full h-full object-contain"
                          onError={e => { (e.currentTarget.parentElement as HTMLElement).style.display = 'none' }}
                        />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/20"><ZoomIn size={16} className="text-[#FF9000]" /></div>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold" style={{ color: isActive ? cc.hex : '#f0f0f0' }}>
                          {n(size.width_cm, 'cm')} × {n(size.height_cm, 'cm')}
                        </span>
                        {hasTube && size.tube_mm != null && (
                          <span className="text-[11px] px-1.5 py-0.5 border border-[#1a1a2e] text-[#888899]">line thickness {size.tube_mm} mm</span>
                        )}
                        {isActive && (
                          <span className="text-[11px] px-1.5 py-0.5 font-bold" style={{ color: cc.hex, border: `1px solid ${cc.hex}` }}>✓</span>
                        )}
                      </div>
                      {hasPower && size.power_w != null && (
                        <div className="mt-0.5 text-xs text-[#888899]">{isRu ? 'Power' : 'Power'}: {size.power_w} W</div>
                      )}
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <span className="text-sm font-black" style={{ color: isActive ? cc.hex : '#FF9000' }}>{priceStr(size)}</span>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>

          {/* Desktop: table */}
          <div className="hidden sm:block overflow-auto flex-1">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-[#1a1a2e] sticky top-0 bg-[#0a0a0f]">
                  {columns.map(col => (
                    <th key={col.key} className={`px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-[#888899] whitespace-nowrap ${col.thClass ?? ''}`}>
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sizes.map((size, idx) => {
                  const isActive = selectedIdx === idx
                  return (
                    <tr
                      key={idx}
                      onClick={() => { onSelect(idx); onClose() }}
                      className="border-b border-[#1a1a2e] cursor-pointer transition-colors hover:bg-[#111120]"
                      style={isActive ? { backgroundColor: cc.shadowRgba } : {}}
                    >
                      {columns.map(col => (
                        <td key={col.key} className={`px-4 py-${col.key === 'preview' ? '2' : '3'} ${col.tdClass ?? ''}`}>
                          {col.render(size, isActive)}
                        </td>
                      ))}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Hover zoom — desktop only */}
      {hoverSrc && (() => {
        const src = hoverSrc
        const MARGIN = 16
        const W = 300
        const H = 220
        const left = hoverPos.x + MARGIN + W > window.innerWidth ? hoverPos.x - W - MARGIN : hoverPos.x + MARGIN
        const top = Math.min(hoverPos.y - H / 2, window.innerHeight - H - MARGIN)
        return (
          <div
            className="fixed z-[310] pointer-events-none border border-[#333] bg-[#0a0a0f] shadow-2xl"
            style={{ left, top, width: W, height: H }}
          >
            <img src={src} alt={getGenericSizePreviewAlt(productName, isRu ? 'ru' : 'en')} className="w-full h-full object-contain p-2" />
          </div>
        )
      })()}

      {/* Lightbox — header preview */}
      {lightboxOpen && previewUrl && (
        <div
          className="fixed inset-0 z-[300] flex items-center justify-center bg-black/95"
          onClick={() => setLightboxOpen(false)}
        >
          <button
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-white hover:bg-white/20 transition-colors"
            style={{ border: '1px solid rgba(255,255,255,0.2)' }}
            onClick={() => setLightboxOpen(false)}
          >
            <span style={{ fontSize: 20, lineHeight: 1 }}>✕</span>
          </button>
          <img
            src={previewUrl}
            alt={getGenericSizePreviewAlt(productName, isRu ? 'ru' : 'en')}
            className="max-w-[90vw] max-h-[85vh] object-contain"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}

      {/* Lightbox — row thumbnail (mobile) */}
      {lightboxSrc && (
        <div
          className="fixed inset-0 z-[300] flex items-center justify-center bg-black/95"
          onClick={() => setLightboxSrc(null)}
        >
          <button
            className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full bg-black/60 text-white"
            style={{ border: '1px solid rgba(255,255,255,0.2)' }}
            onClick={() => setLightboxSrc(null)}
          >
            <span style={{ fontSize: 22, lineHeight: 1 }}>✕</span>
          </button>
          <img
            src={lightboxSrc}
            alt={getGenericSizePreviewAlt(productName, isRu ? 'ru' : 'en')}
            className="max-w-[92vw] max-h-[85vh] object-contain"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}
    </>
  )
}

function getDeliveryDate(locale: string) {
  const date = new Date()
  date.setDate(date.getDate() + 7)
  return locale === 'ru'
    ? date.toLocaleDateString('en-US', { day: 'numeric', month: 'long' })
    : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatDailyEnergyUsage(powerW: number, locale: string): string {
  const dailyKwh = (powerW * 24) / 1000
  const dailyCostUsd = Math.round(dailyKwh * 0.12 * 100) / 100
  const formattedCost = Number.isInteger(dailyCostUsd) ? String(dailyCostUsd) : dailyCostUsd.toFixed(2).replace(/\.?0+$/, '')
  return locale === 'ru'
    ? `$${formattedCost}`
    : `$${formattedCost}`
}

function rgbToHsl(r: number, g: number, b: number) {
  const nr = r / 255
  const ng = g / 255
  const nb = b / 255
  const max = Math.max(nr, ng, nb)
  const min = Math.min(nr, ng, nb)
  let h = 0
  let s = 0
  const l = (max + min) / 2

  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)

    switch (max) {
      case nr:
        h = (ng - nb) / d + (ng < nb ? 6 : 0)
        break
      case ng:
        h = (nb - nr) / d + 2
        break
      default:
        h = (nr - ng) / d + 4
        break
    }

    h /= 6
  }

  return { h, s, l }
}

function hueToRgb(p: number, q: number, t: number) {
  let next = t

  if (next < 0) next += 1
  if (next > 1) next -= 1
  if (next < 1 / 6) return p + (q - p) * 6 * next
  if (next < 1 / 2) return q
  if (next < 2 / 3) return p + (q - p) * (2 / 3 - next) * 6

  return p
}

function hslToRgb(h: number, s: number, l: number) {
  if (s === 0) {
    const gray = Math.round(l * 255)
    return { r: gray, g: gray, b: gray }
  }

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q

  return {
    r: Math.round(hueToRgb(p, q, h + 1 / 3) * 255),
    g: Math.round(hueToRgb(p, q, h) * 255),
    b: Math.round(hueToRgb(p, q, h - 1 / 3) * 255),
  }
}

function hexToHueDegrees(hex: string): number | null {
  const normalized = hex.replace('#', '')
  if (normalized.length !== 6) return null

  const r = parseInt(normalized.slice(0, 2), 16)
  const g = parseInt(normalized.slice(2, 4), 16)
  const b = parseInt(normalized.slice(4, 6), 16)

  if ([r, g, b].some((value) => Number.isNaN(value))) return null

  const { h, s } = rgbToHsl(r, g, b)
  if (s === 0) return null

  return Math.round(h * 360)
}

function getShortestHueDelta(fromDeg: number, toDeg: number) {
  return ((((toDeg - fromDeg) % 360) + 540) % 360) - 180
}

function shiftHexHue(hex: string, deltaDeg: number): string {
  const normalized = hex.replace('#', '')
  if (normalized.length !== 6) return hex

  const r = parseInt(normalized.slice(0, 2), 16)
  const g = parseInt(normalized.slice(2, 4), 16)
  const b = parseInt(normalized.slice(4, 6), 16)

  if ([r, g, b].some((value) => Number.isNaN(value))) return hex

  const { h, s, l } = rgbToHsl(r, g, b)
  const shiftedHue = (h + deltaDeg / 360 + 1) % 1
  const shifted = hslToRgb(shiftedHue, s, l)

  return `#${[shifted.r, shifted.g, shifted.b].map((value) => value.toString(16).padStart(2, '0')).join('')}`
}

function getSwatchBackground(colors: string[]) {
  if (colors.length <= 1) return colors[0] ?? '#00f0ff'
  const segment = 100 / colors.length
  const stops = colors.map((color, index) => {
    const start = (segment * index).toFixed(2)
    const end = (segment * (index + 1)).toFixed(2)
    return `${color} ${start}% ${end}%`
  }).join(', ')
  return `linear-gradient(135deg, ${stops})`
}

function snapHueShift(value: number) {
  return Math.max(-180, Math.min(180, Math.round(value / 20) * 20))
}

function getNearestPaletteColorKey(hex: string) {
  const normalized = hex.replace('#', '')
  if (normalized.length !== 6) return 'cyan'

  const r = parseInt(normalized.slice(0, 2), 16)
  const g = parseInt(normalized.slice(2, 4), 16)
  const b = parseInt(normalized.slice(4, 6), 16)

  if ([r, g, b].some((value) => Number.isNaN(value))) return 'cyan'

  const { h, s, l } = rgbToHsl(r, g, b)
  if (s < 0.08) return l > 0.88 ? 'white' : 'neutral'

  const hueDeg = Math.round(h * 360)
  let bestKey = 'cyan'
  let bestDistance = Number.POSITIVE_INFINITY

  for (const colorKey of ALL_COLORS) {
    if (colorKey === 'white' || colorKey === 'neutral') continue
    const paletteHue = hexToHueDegrees(getColorConfig(colorKey).hex)
    if (paletteHue == null) continue

    const distance = Math.abs(getShortestHueDelta(hueDeg, paletteHue))
    if (distance < bestDistance) {
      bestDistance = distance
      bestKey = colorKey
    }
  }

  return bestKey
}

function HueShiftImage({
  src,
  alt,
  hueShift,
  className,
  style,
  onLoad,
}: {
  src: string
  alt: string
  hueShift: number
  className?: string
  style?: React.CSSProperties
  onLoad?: () => void
}) {
  const deferredHueShift = useDeferredValue(hueShift)
  const [displaySrc, setDisplaySrc] = useState(src)
  const objectUrlRef = useRef<string | null>(null)
  const imageRef = useRef<HTMLImageElement | null>(null)

  useEffect(() => {
    setDisplaySrc(src)
  }, [src])

  useEffect(() => {
    if (imageRef.current?.complete) {
      onLoad?.()
    }
  }, [displaySrc, onLoad])

  useEffect(() => {
    let cancelled = false

    const revokeObjectUrl = () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current)
        objectUrlRef.current = null
      }
    }

    if (!src || deferredHueShift === 0) {
      revokeObjectUrl()
      setDisplaySrc(src)
      return () => revokeObjectUrl()
    }

    const image = new Image()
    image.crossOrigin = "anonymous"
    image.decoding = "async"

    image.onload = () => {
      try {
        const maxDimension = 1200
        const naturalWidth = image.naturalWidth || image.width
        const naturalHeight = image.naturalHeight || image.height

        if (!naturalWidth || !naturalHeight) {
          setDisplaySrc(src)
          return
        }

        const scale = Math.min(1, maxDimension / Math.max(naturalWidth, naturalHeight))
        const width = Math.max(1, Math.round(naturalWidth * scale))
        const height = Math.max(1, Math.round(naturalHeight * scale))
        const canvas = document.createElement("canvas")
        const ctx = canvas.getContext("2d", { willReadFrequently: true })

        if (!ctx) {
          setDisplaySrc(src)
          return
        }

        canvas.width = width
        canvas.height = height
        ctx.drawImage(image, 0, 0, width, height)

        const imageData = ctx.getImageData(0, 0, width, height)
        const shift = deferredHueShift / 360

        for (let i = 0; i < imageData.data.length; i += 4) {
          const alpha = imageData.data[i + 3]
          if (alpha === 0) continue

          const { h, s, l } = rgbToHsl(imageData.data[i], imageData.data[i + 1], imageData.data[i + 2])
          const nextHue = (h + shift + 1) % 1
          const { r, g, b } = hslToRgb(nextHue, s, l)

          imageData.data[i] = r
          imageData.data[i + 1] = g
          imageData.data[i + 2] = b
        }

        ctx.putImageData(imageData, 0, 0)

        canvas.toBlob((blob) => {
          if (cancelled || !blob) return

          revokeObjectUrl()
          const objectUrl = URL.createObjectURL(blob)
          objectUrlRef.current = objectUrl
          setDisplaySrc(objectUrl)
        }, "image/webp", 0.9)
      } catch {
        setDisplaySrc(src)
      }
    }

    image.onerror = () => {
      if (!cancelled) setDisplaySrc(src)
    }

    image.src = src

    return () => {
      cancelled = true
      revokeObjectUrl()
    }
  }, [src, deferredHueShift])

  return <img ref={imageRef} src={displaySrc} alt={alt} className={className} style={style} onLoad={onLoad} />
}

function HueShiftOverlay({
  isRu,
  draftImageHueShift,
  imageHueShift,
  selectedColorLabel,
  onDraftChange,
  onCommit,
  onReset,
  className = "",
}: {
  isRu: boolean
  draftImageHueShift: number
  imageHueShift: number
  selectedColorLabel: string | null
  onDraftChange: (value: number) => void
  onCommit: (value: number) => void
  onReset: () => void
  className?: string
}) {
  const stepHue = (delta: number) => {
    const nextValue = snapHueShift(draftImageHueShift + delta)
    onDraftChange(nextValue)
    onCommit(nextValue)
  }

  return (
    <div
      className={`absolute inset-x-3 bottom-3 z-20 border border-[#2a2a3f] bg-[#0a0a0f]/72 px-2.5 py-1.5 backdrop-blur-md ${className}`}
      onClick={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      onTouchEnd={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <p className="text-[10px] uppercase tracking-widest text-[#888899]">{isRu ? 'Color filter' : 'Color filter'}</p>
          <p className="text-[11px] text-[#f0f0f0]">
            {selectedColorLabel
              ? (isRu ? `Selected filter: ${selectedColorLabel}` : `Selected filter: ${selectedColorLabel}`)
              : draftImageHueShift === 0
              ? (isRu ? 'Original photo color' : 'Original photo color')
              : `${draftImageHueShift > 0 ? '+' : ''}${draftImageHueShift}°`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            if (draftImageHueShift === 0 && imageHueShift === 0) return
            onReset()
          }}
          className="border border-[#1a1a2e] px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-widest text-[#888899] transition-colors hover:border-[#FF9000] hover:text-[#FF9000]"
        >
          {isRu ? 'Reset' : 'Reset'}
        </button>
      </div>
      <div className="mt-1.5 flex items-center gap-2">
        <button
          type="button"
          onClick={() => stepHue(-20)}
          className="flex h-6 w-6 flex-shrink-0 items-center justify-center border border-[#1a1a2e] text-[#888899] transition-colors hover:border-[#FF9000] hover:text-[#FF9000]"
          aria-label={isRu ? 'Shift left' : 'Shift left'}
        >
          <ChevronLeft size={14} />
        </button>
        <div className="relative flex-1">
        <div
          className="pointer-events-none absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full border border-[#3a3a4f] bg-[#161621]/55"
          style={{
            boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.03), inset 0 1px 6px rgba(0,0,0,0.45)',
            backgroundImage: 'repeating-linear-gradient(90deg, transparent 0 calc(5.555% - 1px), rgba(255,255,255,0.14) calc(5.555% - 1px) 5.555%)',
          }}
        />
      <input
        type="range"
        min={-180}
        max={180}
        step={20}
        value={draftImageHueShift}
        onChange={(e) => {
          const nextValue = snapHueShift(Number(e.target.value))
          onDraftChange(nextValue)
          onCommit(nextValue)
        }}
        className="relative z-10 h-3 w-full cursor-pointer appearance-none bg-transparent px-0 opacity-80 accent-[#FF9000]"
      />
        </div>
        <button
          type="button"
          onClick={() => stepHue(20)}
          className="flex h-6 w-6 flex-shrink-0 items-center justify-center border border-[#1a1a2e] text-[#888899] transition-colors hover:border-[#FF9000] hover:text-[#FF9000]"
          aria-label={isRu ? 'Shift right' : 'Shift right'}
        >
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  )
}

function MobileGallery({
  images, name, locale, color, discount, onImageClick, cardGlowClass, hueShift,
  draftImageHueShift, imageHueShift, selectedColorLabel, onHueDraftChange, onHueCommit, onHueReset,
}: {
  images: string[]; name: string; locale: string; color: string; discount: number | null;
  onImageClick: (i: number) => void; cardGlowClass: string; hueShift: number;
  draftImageHueShift: number
  imageHueShift: number
  selectedColorLabel: string | null
  onHueDraftChange: (value: number) => void
  onHueCommit: (value: number) => void
  onHueReset: () => void
}) {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: false })
  const [current, setCurrent] = useState(0)
  const touchStartX = useRef<number>(0)
  const isSwiping = useRef<boolean>(false)

  const handleSelect = useCallback(() => {
    if (!emblaApi) return
    setCurrent(emblaApi.selectedScrollSnap())
  }, [emblaApi])

  useEffect(() => {
    if (!emblaApi) return
    emblaApi.on('select', handleSelect)
    return () => { emblaApi.off('select', handleSelect) }
  }, [emblaApi, handleSelect])

  return (
    <div className={`md:hidden relative border-2 border-[#1a1a2e] bg-[#0a0a0f]/80 ${cardGlowClass}`}>
      {images.length > 1 ? (
        <MobileSwipeHint
          className="absolute inset-y-0 left-3 right-3 z-20"
          onPrev={() => emblaApi?.scrollPrev()}
          onNext={() => emblaApi?.scrollNext()}
          showPrev={current > 0}
          showNext={current < images.length - 1}
        />
      ) : null}
      <div className="overflow-hidden" ref={emblaRef}>
        <div className="flex">
          {images.map((img, i) => (
            <div
              key={i}
              className="relative aspect-square flex-[0_0_100%] cursor-zoom-in"
              onTouchStart={e => { touchStartX.current = e.touches[0].clientX; isSwiping.current = false }}
              onTouchMove={e => { if (Math.abs(e.touches[0].clientX - touchStartX.current) > 8) isSwiping.current = true }}
              onClick={() => { if (!isSwiping.current) onImageClick(i) }}
            >
              {i === current ? (
                <HueShiftImage
                  src={directusImage(img, 50)}
                  alt={getGalleryImageAlt(name, i, locale)}
                  hueShift={hueShift}
                  className="h-full w-full object-cover"
                />
              ) : (
                <img
                  src={directusImage(img, 50)}
                  alt={getGalleryImageAlt(name, i, locale)}
                  className="h-full w-full object-cover"
                />
              )}
            </div>
          ))}
        </div>
      </div>
      {/* Discount badge */}
      {discount && (
        <div className="absolute left-4 top-4 bg-[#FF9000] px-3 py-1 text-sm font-bold uppercase tracking-wider text-black z-10">
          -{discount}%
        </div>
      )}
      {/* Dots */}
      {images.length > 1 && (
        <div className="absolute bottom-28 left-0 right-0 flex justify-center gap-1.5 z-10">
          {images.map((_, i) => (
            <button
              key={i}
              onClick={() => emblaApi?.scrollTo(i)}
              className="h-1.5 rounded-full transition-all"
              style={{ width: i === current ? '20px' : '6px', backgroundColor: i === current ? color : 'rgba(255,255,255,0.3)' }}
            />
          ))}
        </div>
      )}
      <HueShiftOverlay
        isRu={locale === 'ru'}
        draftImageHueShift={draftImageHueShift}
        imageHueShift={imageHueShift}
        selectedColorLabel={selectedColorLabel}
        onDraftChange={onHueDraftChange}
        onCommit={onHueCommit}
        onReset={onHueReset}
      />
    </div>
  )
}

function Lightbox({ images, index, name, locale, accentColor, onClose, onChange, hueShift }: {
  images: string[]; index: number; name: string; locale: string; accentColor: string;
  onClose: () => void; onChange: (i: number) => void; hueShift: number;
}) {
  const touchStartX = useRef<number | null>(null)

  const prev = () => onChange((index - 1 + images.length) % images.length)
  const next = () => onChange((index + 1) % images.length)

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
  }
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return
    const dx = e.changedTouches[0].clientX - touchStartX.current
    if (Math.abs(dx) > 50) dx < 0 ? next() : prev()
    touchStartX.current = null
  }

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center bg-black/97"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onClick={onClose}
    >
      {/* Close */}
      <button
        className="absolute right-3 top-3 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-black/60 text-white transition-colors hover:bg-white/20"
        onClick={e => { e.stopPropagation(); onClose() }}
        style={{ border: '1px solid rgba(255,255,255,0.2)' }}
      >
        <span style={{ fontSize: 22, lineHeight: 1 }}>✕</span>
      </button>

      {/* Prev */}
      {images.length > 1 && (
        <button
          className="absolute left-3 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white transition-colors hover:bg-white/20"
          style={{ border: '1px solid rgba(255,255,255,0.2)' }}
          onClick={e => { e.stopPropagation(); prev() }}
        >
          <span style={{ fontSize: 28, lineHeight: 1 }}>‹</span>
        </button>
      )}

      {/* Image */}
      <div
        className="relative"
        style={{ width: '92vw', height: '85vh' }}
        onClick={e => e.stopPropagation()}
      >
        <HueShiftImage
          key={`${images[index]}-${hueShift}`}
          src={directusImage(images[index], 50)}
          alt={getGalleryImageAlt(name, index, locale)}
          hueShift={hueShift}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain' }}
        />
      </div>

      {/* Next */}
      {images.length > 1 && (
        <button
          className="absolute right-3 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white transition-colors hover:bg-white/20"
          style={{ border: '1px solid rgba(255,255,255,0.2)' }}
          onClick={e => { e.stopPropagation(); next() }}
        >
          <span style={{ fontSize: 28, lineHeight: 1 }}>›</span>
        </button>
      )}

      {/* Dots */}
      {images.length > 1 && (
        <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2">
          {images.map((_, i) => (
            <button
              key={i}
              onClick={e => { e.stopPropagation(); onChange(i) }}
              className="h-2 w-2 rounded-full transition-all"
              style={{ backgroundColor: i === index ? accentColor : '#555', width: i === index ? 20 : 8 }}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function ProductView({
  initialProduct,
  variants,
  relatedProducts = [],
  relatedCategoryId = null,
  locale = 'en',
}: {
  initialProduct: Product
  variants: Product[]
  relatedProducts?: Product[]
  relatedCategoryId?: string | null
  locale?: string
}) {
  const [product, setProduct] = useState(initialProduct)
  const [isDescriptionOpen, setIsDescriptionOpen] = useState(false)
  const [selectedImage, setSelectedImage] = useState(0)
  const [sizePreviewBroken, setSizePreviewBroken] = useState(false)

  useEffect(() => {
    const sizes = (product.sizes_json ?? []) as Array<{ price_rub?: number | null; price_usd?: number | null }>
    const priceField = locale === 'ru' ? 'price_rub' : 'price_usd'
    const minPrice = sizes.reduce((min, s) => {
      const p = s[priceField] ?? 0
      return p > 0 && p < min ? p : min
    }, Infinity)
    const detailPrice = minPrice === Infinity ? 0 : minPrice
    ymDetail({ id: product.slug, name: product.name, price: detailPrice, category: product.categories[0] ?? '', variant: getColor(product) })
    vkViewProduct({
      productId: product.group_id,
      productName: product.name,
      category: product.categories[0] ?? "product",
      variant: getColor(product),
      source: "product_page",
      price: detailPrice,
    })
  }, [locale, product.categories, product.group_id, product.name, product.slug, product.sizes_json])

  useEffect(() => {
    const onScroll = () => {
      if (window.innerWidth < 768) return
      setShowBongoCat(window.scrollY > 500)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const [showPopup, setShowPopup] = useState(false)
  const [showSizePopup, setShowSizePopup] = useState(false)
  const [isPreparingSizePopup, setIsPreparingSizePopup] = useState(false)
  const [cheaperEnabled, setCheaperEnabled] = useState(false)
  const [cheaperPrice, setCheaperPrice] = useState("")
  const [otherSizeEnabled, setOtherSizeEnabled] = useState(false)
  const [otherSizeWidth, setOtherSizeWidth] = useState("")
  const [otherSizeHeight, setOtherSizeHeight] = useState("")
  const [followProportions, setFollowProportions] = useState(true)
  const [otherSizeLastEdited, setOtherSizeLastEdited] = useState<'width' | 'height'>('width')
  const [customColor, setCustomColor] = useState<string | null>(null)
  const [isImageLoading, setIsImageLoading] = useState(true)
  const [isHueLoading, setIsHueLoading] = useState(false)
  const [imageHueShift, setImageHueShift] = useState(0)
  const [draftImageHueShift, setDraftImageHueShift] = useState(0)
  const [lightbox, setLightbox] = useState<number | null>(null)
  const [specsOpen, setSpecsOpen] = useState<boolean>(false)
  const [showBongoCat, setShowBongoCat] = useState(false)
  const orderButtonRef = useRef<HTMLDivElement>(null)
  const { addItem } = useCart()
  const [relatedScrollProgress, setRelatedScrollProgress] = useState(0)
  const [relatedCanScrollLeft, setRelatedCanScrollLeft] = useState(false)
  const [relatedCanScrollRight, setRelatedCanScrollRight] = useState(true)
  const relatedScrollRef = useRef<HTMLDivElement>(null)

  const searchParams = useSearchParams()
  const requestedSizeKey = searchParams.get("size")
  const requestedCategoryId = searchParams.get("category")
  const backParams = new URLSearchParams(searchParams.toString())
  backParams.delete('size')
  backParams.delete('category')
  const backBasePath = requestedCategoryId ? `/catalog/${requestedCategoryId}/` : '/catalog/'
  const backUrl = `${backBasePath}${backParams.toString() ? `?${backParams.toString()}` : ''}`
  const cc = getResolvedColorConfig(getColor(product))
  const tr = locale === 'ru' ? t.ru : t.en
  const deliveryDate = getDeliveryDate(locale)
  const isRu = locale === 'ru'
  const anchorProductColor = getColor(initialProduct)
  const anchorProductColors = getColors(initialProduct)
  const anchorProductGradientHexes = anchorProductColors.map((colorKey) => getResolvedColorConfig(colorKey).hex)
  const anchorProductColorHue = anchorProductColor ? hexToHueDegrees(getResolvedColorConfig(anchorProductColor).hex) : null
  const canAutoAdaptMissingColors = variants.length <= 1
  const canApplyHueFilterToCustomColor = isHueFilterSupportedColor(customColor) && isHueFilterSupportedColor(anchorProductColor)
  const customColorHue = customColor && canApplyHueFilterToCustomColor ? hexToHueDegrees(getResolvedColorConfig(customColor).hex) : null
  const customColorHueShift = customColorHue != null && anchorProductColorHue != null
    ? snapHueShift(getShortestHueDelta(anchorProductColorHue, customColorHue))
    : null
  const selectedHueFilterColors = (() => {
    if (!customColor || !canApplyHueFilterToCustomColor || !canAutoAdaptMissingColors) return []

    if (anchorProductGradientHexes.length > 1 && anchorProductColorHue != null) {
      const targetHue = hexToHueDegrees(getResolvedColorConfig(customColor).hex)
      if (targetHue != null) {
        const shiftedColors = [...new Set(
          anchorProductGradientHexes
            .map((hex) => shiftHexHue(hex, getShortestHueDelta(anchorProductColorHue, targetHue)))
            .map((hex) => getNearestPaletteColorKey(hex))
        )]

        if (shiftedColors.length > 0) return shiftedColors
      }
    }

    return [customColor]
  })()
  const selectedHueFilterLabel = selectedHueFilterColors.length > 0
    ? selectedHueFilterColors.map((colorKey) => colorLabel(colorKey, locale)).join(' / ')
    : null

  const productSizes: ProductSizeRow[] = [...((product.sizes_json ?? []) as ProductSizeRow[])].sort(
    (a, b) => ((isRu ? a.price_rub : a.price_usd) ?? 0) - ((isRu ? b.price_rub : b.price_usd) ?? 0)
  )

  const [selectedSizeKey, setSelectedSizeKey] = useState<string>(requestedSizeKey ?? "")

  useEffect(() => {
    if (requestedSizeKey) setSelectedSizeKey(requestedSizeKey)
  }, [requestedSizeKey])

  useEffect(() => {
    setImageHueShift(0)
    setDraftImageHueShift(0)
    setIsHueLoading(false)
  }, [product.slug])

  const selectedSizeIdx = productSizes.findIndex(size => getProductSizeKey(size) === selectedSizeKey)
  const resolvedSelectedSizeIdx = selectedSizeIdx >= 0 ? selectedSizeIdx : 0
  const selectedSize = productSizes[resolvedSelectedSizeIdx] ?? null
  const selectedSizePreviewUrl = getSizePreviewUrl(selectedSize?.size_preview)
  const galleryImages = [
    ...product.images,
    ...DEFAULT_GALLERY_IMAGES.filter((image) => !product.images.includes(image)),
  ]
  const sizeDimensions = productSizes.filter(size => (
    size.width_cm != null &&
    size.height_cm != null &&
    size.width_cm > 0 &&
    size.height_cm > 0
  ))
  const averageWidth = sizeDimensions.length > 0
    ? sizeDimensions.reduce((sum, size) => sum + (size.width_cm ?? 0), 0) / sizeDimensions.length
    : null
  const averageHeight = sizeDimensions.length > 0
    ? sizeDimensions.reduce((sum, size) => sum + (size.height_cm ?? 0), 0) / sizeDimensions.length
    : null
  const averageRatio = sizeDimensions.length > 0
    ? sizeDimensions.reduce((sum, size) => sum + ((size.width_cm ?? 0) / (size.height_cm ?? 1)), 0) / sizeDimensions.length
    : null
  const fallbackRatio = product.width_cm && product.height_cm && product.width_cm > 0 && product.height_cm > 0
    ? product.width_cm / product.height_cm
    : null
  const proportionRatio = averageRatio ?? fallbackRatio
  const referenceWidth = selectedSize?.width_cm && selectedSize.width_cm > 0
    ? selectedSize.width_cm
    : averageWidth ?? product.width_cm ?? null
  const proportionWidth = referenceWidth
  const proportionHeight = referenceWidth && proportionRatio ? referenceWidth / proportionRatio : (averageHeight ?? product.height_cm ?? null)
  const otherSizeValue = otherSizeEnabled && (otherSizeWidth || otherSizeHeight)
    ? `${otherSizeWidth || '?'} × ${otherSizeHeight || '?'} cm`
    : ""

  const formatDimension = (value: number) => `${Math.max(1, Math.round(value))}`

  const handleOtherSizeToggle = (next: boolean) => {
    setOtherSizeEnabled(next)
    if (next && !otherSizeWidth && !otherSizeHeight && proportionWidth && proportionHeight) {
      setOtherSizeWidth(formatDimension(proportionWidth))
      setOtherSizeHeight(formatDimension(proportionHeight))
      setOtherSizeLastEdited('width')
    }
  }

  const syncProportions = (
    source: 'width' | 'height',
    nextWidth: string,
    nextHeight: string,
  ) => {
    if (!proportionRatio) return

    if (source === 'width' && nextWidth === "") return
    if (source === 'height' && nextHeight === "") return

    const widthValue = Number(nextWidth)
    const heightValue = Number(nextHeight)
    const hasWidth = nextWidth !== "" && Number.isFinite(widthValue) && widthValue > 0
    const hasHeight = nextHeight !== "" && Number.isFinite(heightValue) && heightValue > 0

    if (!hasWidth && !hasHeight) {
      return
    }

    if ((source === 'width' && hasWidth) || !hasHeight) {
      setOtherSizeHeight(formatDimension(widthValue / proportionRatio))
      return
    }

    if (hasHeight) {
      setOtherSizeWidth(formatDimension(heightValue * proportionRatio))
    }
  }

  const handleFollowProportionsToggle = (next: boolean) => {
    setFollowProportions(next)
    if (!next) return

    syncProportions(otherSizeLastEdited, otherSizeWidth, otherSizeHeight)
  }

  const handleOtherSizeWidthChange = (value: string) => {
    setOtherSizeWidth(value)
    setOtherSizeLastEdited('width')
    if (followProportions) {
      syncProportions('width', value, otherSizeHeight)
    }
  }

  const handleOtherSizeHeightChange = (value: string) => {
    setOtherSizeHeight(value)
    setOtherSizeLastEdited('height')
    if (followProportions) {
      syncProportions('height', otherSizeWidth, value)
    }
  }

  const openSizePopup = useCallback(async () => {
    if (isPreparingSizePopup) return

    const urls = [
      getSizePreviewUrl(product.size_preview),
      ...productSizes.map(size => getSizePreviewUrl(size.size_preview)),
    ].filter((url): url is string => Boolean(url))

    if (urls.length === 0) {
      setShowSizePopup(true)
      return
    }

    setIsPreparingSizePopup(true)
    await Promise.allSettled([...new Set(urls)].map(preloadImage))
    setIsPreparingSizePopup(false)
    setShowSizePopup(true)
  }, [isPreparingSizePopup, product.size_preview, productSizes])

  // Pricing: if size has own price, use it; otherwise use price_per_10cm
  const pricePerUnit: number | null = isRu
    ? (product.price_per_10cm
        ?? (product.sale_price_rub && product.width_cm && product.width_cm > 0
            ? product.sale_price_rub / (product.width_cm / 10)
            : null))
    : (product.price_per_in_usd
        ?? (product.sale_price_usd && product.width_in && product.width_in > 0
            ? product.sale_price_usd / product.width_in
            : null))

  const selectedWidth = selectedSize?.width_cm ?? 0

  const dynamicPrice = selectedSize
    ? (isRu
        ? (selectedSize.price_rub ?? (pricePerUnit && selectedWidth ? Math.round((selectedWidth / 10) * pricePerUnit) : null))
        : (selectedSize.price_usd ?? (pricePerUnit && selectedWidth ? Math.round(selectedWidth * pricePerUnit * 100) / 100 : null)))
    : null
  const dailyEnergyUsage = selectedSize?.power_w != null && selectedSize.power_w > 0
    ? formatDailyEnergyUsage(selectedSize.power_w, locale)
    : null

  const displayPrice = dynamicPrice ?? getSalePrice(product, locale)
  const displayListPrice = (dynamicPrice || pricePerUnit) ? null : getPrice(product, locale)
  const needsCustomQuote = isRu && otherSizeEnabled
  const cartButtonDisabled = (productSizes.length > 0 && !selectedSize) || needsCustomQuote || !displayPrice || displayPrice <= 0
  const cartSizeKey = selectedSize ? getProductSizeKey(selectedSize) : null
  const cartSizeLabel = selectedSize?.width_cm
    ? `${selectedSize.width_cm} × ${selectedSize.height_cm ?? "?"} cm`
    : null
  const cartColorKey = customColor ?? getColor(product) ?? null
  const cartColorLabel = cartColorKey ? colorLabel(cartColorKey, locale) : null
  const cartHref = `/product/${product.group_id}${cartSizeKey ? `?size=${encodeURIComponent(cartSizeKey)}` : ""}`

  const commitImageHueShift = useCallback((nextHueShift: number) => {
    if (nextHueShift === imageHueShift) return
    setIsImageLoading(true)
    setIsHueLoading(true)
    setImageHueShift(nextHueShift)
  }, [imageHueShift])

  const resetImageHueShift = useCallback(() => {
    setDraftImageHueShift(0)
    commitImageHueShift(0)
  }, [commitImageHueShift])

  const resetToStandardColor = useCallback(() => {
    setCustomColor(null)
    setSelectedImage(0)
    setDraftImageHueShift(0)
    setImageHueShift(0)
    setIsHueLoading(false)

    if (initialProduct.slug !== product.slug) {
      setIsImageLoading(true)
      setProduct(initialProduct)
    }
  }, [initialProduct, product.slug])

  const getApproximateHueShiftForColor = useCallback((colorKey: string | null) => {
    if (!colorKey || anchorProductColorHue == null) return null
    const targetHue = hexToHueDegrees(getResolvedColorConfig(colorKey).hex)
    if (targetHue == null) return null
    return snapHueShift(getShortestHueDelta(anchorProductColorHue, targetHue))
  }, [anchorProductColorHue])

  const variantByColor = new Map<string, typeof product>()
  variants.forEach((variant) => {
    const colorKey = getColor(variant)
    if (colorKey) variantByColor.set(colorKey, variant)
  })
  const existingColors = new Set(variantByColor.keys())
  const hasCustomColorPhoto = customColor ? existingColors.has(customColor) : false

  useEffect(() => {
    if (!canAutoAdaptMissingColors || !customColor || hasCustomColorPhoto || customColorHueShift == null) return

    setDraftImageHueShift(customColorHueShift)
    commitImageHueShift(customColorHueShift)
  }, [canAutoAdaptMissingColors, commitImageHueShift, customColor, customColorHueShift, hasCustomColorPhoto])

  const activateExistingColorVariant = useCallback((variant: typeof product) => {
    setCustomColor(null)
    setSelectedImage(0)
    setDraftImageHueShift(0)
    setImageHueShift(0)
    setIsHueLoading(false)

    if (variant.slug !== product.slug) {
      setIsImageLoading(true)
      setProduct(variant)
    }
  }, [product.slug])

  const findNearestExistingVariantByHueShift = useCallback((targetHueShift: number) => {
    let closestVariant: typeof product | null = null
    let closestDistance = Number.POSITIVE_INFINITY

    for (const variant of variantByColor.values()) {
      const variantHueShift = getApproximateHueShiftForColor(getColor(variant))
      if (variantHueShift == null) continue

      const distance = Math.abs(targetHueShift - variantHueShift)
      if (distance < closestDistance) {
        closestDistance = distance
        closestVariant = variant
      }
    }

    return closestVariant
  }, [getApproximateHueShiftForColor, variantByColor])

  const handleHueDraftChange = useCallback((value: number) => {
    setDraftImageHueShift(value)
  }, [])

  const handleHueCommit = useCallback((value: number) => {
    const shouldSwitchToExistingColor =
      canAutoAdaptMissingColors &&
      customColor != null &&
      !hasCustomColorPhoto &&
      customColorHueShift != null &&
      value !== customColorHueShift

    if (shouldSwitchToExistingColor) {
      const nearestVariant = findNearestExistingVariantByHueShift(value)
      if (nearestVariant) {
        activateExistingColorVariant(nearestVariant)
        return
      }
    }

    commitImageHueShift(value)
  }, [
    activateExistingColorVariant,
    canAutoAdaptMissingColors,
    commitImageHueShift,
    customColor,
    customColorHueShift,
    findNearestExistingVariantByHueShift,
    hasCustomColorPhoto,
  ])

  const specifications = tr.specs(product)
  const relatedVariantsByGroup = relatedProducts.reduce<Record<string, Product[]>>((acc, item) => {
    acc[item.group_id] = acc[item.group_id] ? [...acc[item.group_id], item] : [item]
    return acc
  }, {})
  const seenRelatedGroups = new Set<string>()
  const relatedProductCards = relatedProducts.filter((item) => {
    if (item.group_id === product.group_id || seenRelatedGroups.has(item.group_id)) {
      return false
    }

    seenRelatedGroups.add(item.group_id)
    return true
  }).slice(0, 12)
  const relatedCategoryLabel = relatedCategoryId ? translateCategory(relatedCategoryId, locale) : null
  const breadcrumbCategoryId = requestedCategoryId ?? relatedCategoryId
  const breadcrumbCategoryLabel = breadcrumbCategoryId ? translateCategory(breadcrumbCategoryId, locale) : null
  const breadcrumbCategoryHref = breadcrumbCategoryId ? `/catalog/${breadcrumbCategoryId}/` : '/catalog/'

  return (
    <section className="relative min-h-screen py-24">
      <div className="absolute inset-0">
        <div className="absolute left-1/4 top-1/4 h-[500px] w-[500px] rounded-full opacity-15 blur-[200px]"
          style={{ backgroundColor: cc.hex }} />
      </div>
      <div className="cyber-grid absolute inset-0" />

      <div className="relative z-10 mx-auto max-w-7xl px-4 md:px-6">
        <Link href={backUrl} className={`group mb-12 inline-flex items-center gap-2 text-[#888899] transition-colors ${locale === 'ru' ? 'hover:text-[#FF9000]' : 'hover:text-[#00f0ff]'}`}>
          <ArrowLeft size={20} className="transition-transform group-hover:-translate-x-1" />
          <span className="uppercase tracking-wider">{tr.back}</span>
        </Link>

        <div className="grid gap-12 lg:grid-cols-2">
          {/* Product Display */}
          <div className="flex flex-col gap-4">
            {galleryImages.length > 0 ? (<>

              {/* Mobile: Embla swipe carousel */}
              <MobileGallery
                images={galleryImages}
                name={product.name}
                locale={locale}
                color={cc.hex}
                discount={getDiscountPct(product, locale)}
                onImageClick={(i) => setLightbox(i)}
                cardGlowClass={cc.cardGlowClass}
                hueShift={imageHueShift}
                draftImageHueShift={draftImageHueShift}
                imageHueShift={imageHueShift}
                selectedColorLabel={selectedHueFilterLabel}
                onHueDraftChange={handleHueDraftChange}
                onHueCommit={handleHueCommit}
                onHueReset={resetToStandardColor}
              />

              {/* Desktop: main image + thumbnails */}
              <div className="hidden flex-col gap-4 md:flex">
                <div
                  onClick={() => setLightbox(selectedImage)}
                  className={`relative aspect-square border-2 border-[#1a1a2e] bg-[#0a0a0f]/80 cursor-zoom-in ${cc.cardGlowClass}`}
                >
                  {(isImageLoading || isHueLoading) && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                      {isHueLoading ? (
                        <>
                          <Spinner className="size-5 text-[#FF9000]" />
                          <span className="text-sm font-bold uppercase tracking-widest text-[#f0f0f0]">
                            {isRu ? 'Updating color' : 'Updating color'}
                          </span>
                        </>
                      ) : (
                        <span className="animate-pulse text-sm font-bold uppercase tracking-widest" style={{ color: cc.hex + '99' }}>
                          {tr.loading}
                        </span>
                      )}
                    </div>
                  )}
                  <HueShiftImage
                    key={`${product.slug}-${selectedImage}-${imageHueShift}`}
                    src={directusImage(galleryImages[selectedImage], 50)}
                    alt={getGalleryImageAlt(product.name, selectedImage, locale)}
                    hueShift={imageHueShift}
                    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: isImageLoading ? 0 : 1, transition: 'opacity 0.4s' }}
                    onLoad={() => {
                      setIsImageLoading(false)
                      setIsHueLoading(false)
                    }}
                  />
                  {getDiscountPct(product, locale) && (
                    <div className="absolute left-4 top-4 bg-[#FF9000] px-3 py-1 text-sm font-bold uppercase tracking-wider text-black">
                      -{getDiscountPct(product, locale)}%
                    </div>
                  )}
                  <HueShiftOverlay
                    isRu={isRu}
                    draftImageHueShift={draftImageHueShift}
                    imageHueShift={imageHueShift}
                    selectedColorLabel={selectedHueFilterLabel}
                    onDraftChange={handleHueDraftChange}
                    onCommit={handleHueCommit}
                    onReset={resetToStandardColor}
                    className="hidden md:block"
                  />
                </div>

                {galleryImages.length > 1 && (
                  <div className="flex gap-3">
                    {galleryImages.map((img, index) => (
                      <button key={index}
                        onClick={() => { setSelectedImage(index); setIsImageLoading(true) }}
                        className="relative aspect-square w-20 border-2 transition-all border-[#1a1a2e] hover:border-[#888899]"
                        style={index === selectedImage ? { borderColor: cc.hex } : {}}
                      >
                        <img src={directusImage(img, 50)} alt={getGalleryImageAlt(product.name, index, locale)} loading="lazy" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                      </button>
                    ))}
                  </div>
                )}
              </div>

            </>) : (
              <div className="relative aspect-square border-2 border-[#1a1a2e] bg-[#0a0a0f]/80 flex items-center justify-center p-8">
                <span className={`${locale === 'ru' ? 'font-tektur' : 'font-sans'} text-5xl font-black uppercase tracking-wider md:text-6xl lg:text-7xl neon-flicker ${cc.textClass}`}>
                  {product.name}
                </span>
              </div>
            )}

          </div>

          {/* Product Info */}
          <div className="flex flex-col">
            <Breadcrumb className="mb-4">
              <BreadcrumbList className="gap-2 text-xs uppercase tracking-widest text-[#888899]">
                <BreadcrumbItem>
                  <BreadcrumbLink asChild className="text-[#888899] hover:text-[#f0f0f0]">
                    <Link href="/catalog/">{locale === 'ru' ? 'Catalog' : tr.home}</Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="text-[#555566]" />
                {breadcrumbCategoryLabel && (
                  <>
                    <BreadcrumbItem>
                      <BreadcrumbLink asChild className="text-[#888899] hover:text-[#f0f0f0]">
                        <Link href={breadcrumbCategoryHref}>{breadcrumbCategoryLabel}</Link>
                      </BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator className="text-[#555566]" />
                  </>
                )}
                <BreadcrumbItem>
                  <BreadcrumbPage className="max-w-full truncate text-[#f0f0f0]">
                    {product.name}
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
            <div className="mb-2 text-sm uppercase tracking-widest text-[#888899]">{product.categories.map(c => translateCategory(c, locale)).join(' · ')}</div>
            <h1 className={`${locale === 'ru' ? 'font-tektur' : 'font-sans'} text-4xl font-black uppercase tracking-wider text-[#f0f0f0] md:text-5xl`}>{product.name}</h1>

            {/* Color Selection — available variants + custom wish */}
            {(() => {
              const activeColor = customColor ?? getColor(product)
              const selectableColorOptions = canAutoAdaptMissingColors
                ? ALL_COLORS
                : ALL_COLORS.filter((colorKey) => existingColors.has(colorKey))
              const labelColors = (() => {
                if (customColor) {
                  return [customColor]
                }

                if (!customColor && Array.isArray(product.color) && product.color.length > 1) {
                  return [...new Set(product.color)]
                }

                return activeColor ? [activeColor] : []
              })()
              const labelColor = labelColors.length > 0
                ? labelColors.map((colorKey) => colorLabel(colorKey, locale)).join(' / ')
                : '—'
              const allHavePhoto = selectableColorOptions.every(c => {
                const v = existingColors.has(c) ? variantByColor.get(c) ?? null : null
                return v && (v.images?.length ?? 0) > 0
              })
              return (
                <div className="mt-6">
                  <p className="mb-3 text-xs uppercase tracking-widest text-[#888899]">
                    {tr.color}: <span className="text-[#f0f0f0]">{labelColor}</span>
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {selectableColorOptions.map(c => {
                      const cfg = getColorConfig(c)
                      const targetHue = hexToHueDegrees(cfg.hex)
                      const hasVariant = existingColors.has(c)
                      const variant = hasVariant ? variantByColor.get(c) ?? null : null
                      const isActive = hasVariant
                        ? customColor === null && variant?.slug === product.slug
                        : customColor === c
                      const swatchHexes = variant
                        ? getColors(variant).map((colorKey) => getResolvedColorConfig(colorKey).hex)
                        : (
                          canAutoAdaptMissingColors &&
                          anchorProductGradientHexes.length > 1 &&
                          anchorProductColorHue != null &&
                          targetHue != null
                            ? anchorProductGradientHexes.map((hex) => shiftHexHue(hex, getShortestHueDelta(anchorProductColorHue, targetHue)))
                            : [cfg.hex]
                        )
                      const hasPhoto = hasVariant && (variant?.images?.length ?? 0) > 0
                      return (
                        <div key={c} className="relative flex flex-col items-center gap-1">
                          <span className={`h-1.5 w-1.5 rounded-full bg-[#FF9000] ${!allHavePhoto && hasPhoto ? '' : 'invisible'}`} />
                          <button
                            type="button"
                            onClick={() => {
                              if (hasVariant) {
                                const v = variant!
                                activateExistingColorVariant(v)
                              } else {
                                const nextCustomColor = isActive ? null : c
                                setCustomColor(nextCustomColor)
                                if (nextCustomColor === null) {
                                  resetImageHueShift()
                                }
                              }
                            }}
                            title={colorLabel(c, locale)}
                            className="flex h-9 w-9 items-center justify-center rounded-full border-2 transition-all duration-200"
                            style={{
                              borderColor: isActive ? '#fff' : 'transparent',
                              boxShadow: isActive ? `0 0 8px ${cfg.hex}, 0 0 16px ${cfg.hex}` : 'none',
                              transform: isActive ? 'scale(1.15)' : 'scale(1)',
                            }}
                          >
                            <span className="h-5 w-5 rounded-full" style={{ background: getSwatchBackground(swatchHexes) }} />
                          </button>
                        </div>
                      )
                    })}
                  </div>
                  {canAutoAdaptMissingColors && customColor && !existingColors.has(customColor) && canApplyHueFilterToCustomColor && (
                    <div className="mt-3">
                      <p className="text-sm text-[#888899]">
                        {isRu
                          ? "Sorry, we haven't made a photo of this color yet."
                          : "Sorry, we haven't made a photo of this color yet."}
                      </p>
                      <p className="mt-2 text-sm text-[#888899]">
                        {isRu
                          ? 'Applied a color filter as a compromise.'
                          : 'Applied a color filter as a compromise.'}
                      </p>
                    </div>
                  )}
                </div>
              )
            })()}

            <div className="mt-6 flex flex-col gap-4">
              {/* Size Selection */}
              {productSizes.length > 0 && !otherSizeEnabled && (
                <div>
                  <p className="mb-3 text-xs uppercase tracking-widest text-[#888899]">
                    {isRu ? 'Size' : 'Size'}
                  </p>

                  {/* Selected size card */}
                  {selectedSize ? (
                    <div className="border border-[#1a1a2e] bg-[#0a0a0f]">
                      <div className="flex items-center justify-between px-4 py-3 gap-3">
                        <div className="flex items-center gap-3">
                          {selectedSizePreviewUrl && !sizePreviewBroken && (
                            <div className="group relative hidden md:block">
                              <div className="flex h-11 w-11 items-center justify-center overflow-hidden border border-[#1a1a2e] bg-[#050508]">
                                <img
                                  src={selectedSizePreviewUrl}
                                  alt={getSizePreviewAlt(product.name, selectedSize, locale)}
                                  className="h-full w-full object-contain p-1"
                                  onError={() => setSizePreviewBroken(true)}
                                />
                              </div>
                              <div className="pointer-events-none absolute left-0 top-full z-10 mt-2 hidden w-80 overflow-hidden border border-[#1a1a2e] bg-[#050508] p-2 shadow-2xl group-hover:block">
                                <img
                                  src={selectedSizePreviewUrl}
                                  alt={getSizePreviewAlt(product.name, selectedSize, locale)}
                                  className="h-56 w-full object-contain"
                                />
                              </div>
                            </div>
                          )}
                          <div>
                            <span className="text-base font-black" style={{ color: '#FF9000' }}>
                              {selectedSize.width_cm} × {selectedSize.height_cm ?? '?'} cm
                            </span>
                            {selectedSize.tube_mm != null && (
                              <span className="ml-2 text-xs text-[#888899]">line thickness {selectedSize.tube_mm} mm</span>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => void openSizePopup()}
                          disabled={isPreparingSizePopup}
                          className="flex-shrink-0 text-xs font-bold uppercase tracking-widest border px-3 py-1.5 transition-colors"
                          style={{ borderColor: '#FF9000', color: '#FF9000' }}
                        >
                          {isPreparingSizePopup ? tr.loading : (isRu ? 'Select size' : 'Select size')}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => void openSizePopup()}
                      disabled={isPreparingSizePopup}
                      className="w-full border-2 px-5 py-4 text-sm font-bold uppercase tracking-widest transition-all duration-200"
                      style={{ borderColor: '#1a1a2e', color: '#888899' }}
                    >
                      {isPreparingSizePopup ? tr.loading : (isRu ? 'Select size' : 'Select size')}
                    </button>
                  )}
                </div>
              )}

              {isRu && (
                <div className="border border-[#1a1a2e] bg-[#0a0a0f] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <Ruler size={20} className="flex-shrink-0 mt-0.5" style={{ color: '#FF9000' }} />
                      <div>
                        <p className="text-sm font-bold uppercase tracking-wider text-[#f0f0f0]">Make a custom size</p>
                        <p className="mt-0.5 text-xs text-[#888899]">We'll make it to your specs</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleOtherSizeToggle(!otherSizeEnabled)}
                      className="relative flex-shrink-0 h-8 w-14 rounded-full overflow-hidden transition-colors duration-200"
                      style={{ backgroundColor: otherSizeEnabled ? '#FF9000' : '#1a1a2e', boxShadow: otherSizeEnabled ? '0 0 10px rgba(255,144,0,0.5)' : 'none' }}
                      aria-pressed={otherSizeEnabled}
                    >
                      <span
                        className="absolute top-1 left-1 h-6 w-6 rounded-full bg-white shadow transition-transform duration-200"
                        style={{ transform: otherSizeEnabled ? 'translateX(22px)' : 'translateX(0)' }}
                      />
                    </button>
                  </div>
                  <div
                    className="overflow-hidden transition-all duration-300 ease-in-out"
                    style={{ maxHeight: otherSizeEnabled ? '260px' : '0', opacity: otherSizeEnabled ? 1 : 0 }}
                  >
                    <div className="mt-3 border-t border-[#1a1a2e] pt-3">
                      <p className="mb-2 text-xs uppercase tracking-wider text-[#888899]">Enter the size you need in cm</p>
                      <div className="grid grid-cols-2 gap-3">
                        <label className="block">
                          <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-[#888899]">Width</span>
                          <input
                            type="number"
                            min={1}
                            step={1}
                            inputMode="numeric"
                            placeholder={proportionWidth ? formatDimension(proportionWidth) : '60'}
                            value={otherSizeWidth}
                            onChange={e => handleOtherSizeWidthChange(e.target.value)}
                            className="w-full bg-[#0f0f1a] border border-[#1a1a2e] px-3 py-2 text-sm text-[#f0f0f0] placeholder:text-[#888899] outline-none focus:border-[#FF9000] transition-colors"
                          />
                        </label>
                        <label className="block">
                          <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-[#888899]">Height</span>
                          <input
                            type="number"
                            min={1}
                            step={1}
                            inputMode="numeric"
                            placeholder={proportionHeight ? formatDimension(proportionHeight) : '40'}
                            value={otherSizeHeight}
                            onChange={e => handleOtherSizeHeightChange(e.target.value)}
                            className="w-full bg-[#0f0f1a] border border-[#1a1a2e] px-3 py-2 text-sm text-[#f0f0f0] placeholder:text-[#888899] outline-none focus:border-[#FF9000] transition-colors"
                          />
                        </label>
                      </div>
                      <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <p className="text-xs text-[#888899]">
                          {proportionRatio
                            ? `Average ratio: ${proportionRatio.toFixed(2)} : 1`
                            : 'The ratio will be taken from available sizes'}
                        </p>
                        <button
                          type="button"
                          onClick={() => handleFollowProportionsToggle(!followProportions)}
                          disabled={!proportionRatio}
                          className="flex items-center gap-2 text-left disabled:cursor-not-allowed disabled:opacity-40"
                          aria-pressed={followProportions}
                        >
                          <span className="text-[11px] font-bold uppercase tracking-widest text-[#f0f0f0]">
                            Follow proportions
                          </span>
                          <span
                            className="relative h-6 w-11 flex-shrink-0 rounded-full transition-colors duration-200"
                            style={{ backgroundColor: followProportions ? '#FF9000' : '#1a1a2e' }}
                          >
                            <span
                              className="absolute left-1 top-1 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200"
                              style={{ transform: followProportions ? 'translateX(18px)' : 'translateX(0)' }}
                            />
                          </span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <p className="mb-3 text-xs uppercase tracking-widest text-[#888899]">
                  {isRu ? 'Pricing' : 'Pricing'}
                </p>
                <div className="border border-[#1a1a2e] bg-[#0a0a0f] p-4 md:p-5">
                  <div className="flex items-start justify-between gap-4">
                    <span className="text-4xl font-black" style={{ color: cc.hex }}>
                      {needsCustomQuote
                        ? 'Custom quote'
                        : pricePerUnit
                          ? (dynamicPrice ? tr.price(dynamicPrice) : '—')
                          : tr.price(displayPrice)}
                    </span>
                    {!needsCustomQuote && displayListPrice !== null && (
                      <div className="flex flex-col text-right">
                        <span className="text-xs text-[#888899]">{tr.listPrice}</span>
                        <span className="text-lg text-[#888899] line-through">{tr.price(displayListPrice)}</span>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 flex items-center gap-2 border-t border-[#1a1a2e] pt-4 text-sm" style={{ color: cc.hex }}>
                    {locale === 'ru' ? <Banknote size={18} /> : <Truck size={18} />}
                    <span>{tr.shipping(deliveryDate)}</span>
                  </div>
                </div>

                {isRu && (
                  <div className="mt-3 border border-[#1a1a2e] bg-[#0a0a0f] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <BadgePercent size={20} className="flex-shrink-0 mt-0.5" style={{ color: '#FF9000' }} />
                        <div>
                          <p className="text-sm font-bold uppercase tracking-wider text-[#f0f0f0]">Make it cheaper</p>
                          <p className="mt-0.5 text-xs text-[#888899]">We'll try to simplify the lines to fit your budget</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setCheaperEnabled(v => !v)}
                        className="relative flex-shrink-0 h-8 w-14 rounded-full overflow-hidden transition-colors duration-200"
                        style={{ backgroundColor: cheaperEnabled ? '#FF9000' : '#1a1a2e', boxShadow: cheaperEnabled ? '0 0 10px rgba(255,144,0,0.5)' : 'none' }}
                        aria-pressed={cheaperEnabled}
                      >
                        <span
                          className="absolute top-1 left-1 h-6 w-6 rounded-full bg-white shadow transition-transform duration-200"
                          style={{ transform: cheaperEnabled ? 'translateX(22px)' : 'translateX(0)' }}
                        />
                      </button>
                    </div>
                    <div
                      className="overflow-hidden transition-all duration-300 ease-in-out"
                      style={{ maxHeight: cheaperEnabled ? '120px' : '0', opacity: cheaperEnabled ? 1 : 0 }}
                    >
                      <div className="mt-3 border-t border-[#1a1a2e] pt-3">
                        <p className="mb-2 text-xs uppercase tracking-wider text-[#888899]">Target price</p>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min={0}
                            placeholder="Enter an amount"
                            value={cheaperPrice}
                            onChange={e => setCheaperPrice(e.target.value)}
                            className="w-full bg-[#0f0f1a] border border-[#1a1a2e] px-3 py-2 text-sm text-[#f0f0f0] placeholder:text-[#888899] outline-none focus:border-[#FF9000] transition-colors"
                          />
                          <span className="text-sm font-bold text-[#FF9000] flex-shrink-0">$</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {dailyEnergyUsage && (
                  <div className="mt-3 border border-[#1f5c3b] bg-[#0d1f16] p-4" style={{ boxShadow: '0 0 18px rgba(34,197,94,0.12)' }}>
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center border border-[#2f8f57] bg-[#123222] text-[#5ee58a]">
                        <Leaf size={18} />
                      </div>
                      <div>
                        <p className="text-xs font-bold uppercase tracking-widest text-[#5ee58a]">
                          {tr.energySaving}
                        </p>
                        <p className="mt-1 text-xs text-[#8cc9a3]">
                          {tr.energySize(selectedSize?.width_cm, selectedSize?.height_cm)}
                        </p>
                        <p className="mt-1 text-base font-black text-[#d9ffe6]">
                          {tr.energyUsagePerDay(dailyEnergyUsage)}
                        </p>
                        <p className="mt-1 text-xs text-[#8cc9a3]">
                          {tr.energyUsageHint}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Specifications */}
            <div className="mt-6 border-t-2 border-[#1a1a2e] pt-6">
              <button
                onClick={() => setSpecsOpen(o => !o)}
                className="flex w-full items-center justify-between text-sm font-bold uppercase tracking-widest text-[#f0f0f0]"
              >
                <span>{tr.specifications}</span>
                {specsOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
              </button>
              {specsOpen && (
                <div className="mt-4 grid gap-3">
                  {locale !== 'ru' && (
                    <div className="flex justify-between border-b border-[#1a1a2e] pb-3">
                      <span className="text-[#888899]">Dimensions</span>
                      <span className="text-[#f0f0f0]">{product.width_in ?? ''} × {product.height_in ?? ''} × 2 in</span>
                    </div>
                  )}
                  {specifications.map((spec) => (
                    <div key={spec.label} className="flex justify-between border-b border-[#1a1a2e] pb-3">
                      <span className="text-[#888899]">{spec.label}</span>
                      <span className="text-[#f0f0f0]">{spec.value}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Description */}
            <div className="mt-6 border-t-2 border-[#1a1a2e] pt-6">
              <button
                onClick={() => setIsDescriptionOpen(!isDescriptionOpen)}
                className="flex w-full items-center justify-between text-sm font-bold uppercase tracking-widest text-[#f0f0f0]"
              >
                <span>{tr.description}</span>
                {isDescriptionOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
              </button>
              {isDescriptionOpen && (
                <div className="mt-4 text-sm leading-relaxed text-[#888899]">{tr.descriptionText}</div>
              )}
            </div>

            {/* Order Button */}
            <div ref={orderButtonRef} className="relative mt-8">
              <img
                src="/imaginarystory-bongo-cat.gif"
                alt="bongo cat"
                className="absolute -top-14 left-1/2 z-10 h-14 w-auto -translate-x-1/2 cursor-pointer transition-opacity duration-500 md:left-1/4"
                style={{ opacity: showBongoCat ? 1 : 0, transform: 'translateX(-50%) rotate(-15deg) translateY(12px)' }}
                onClick={() => setShowBongoCat(false)}
              />
              <div className="flex flex-col gap-3 md:flex-row">
                <Button
                  size="lg"
                  disabled={productSizes.length > 0 && !selectedSize}
                  onClick={() => {
                    if (typeof window !== 'undefined' && window.fbq) {
                      window.fbq('track', 'InitiateCheckout', {
                        value: getSalePrice(product, locale),
                        currency: tr.currency,
                        content_name: product.name,
                        content_type: 'product',
                      })
                    }
                    ymGoal(ANALYTICS_GOALS.openQuickOrder, {
                      source: "product_page",
                      product_id: product.slug,
                      product_name: product.name,
                      category: product.categories[0] ?? "product",
                      variant: cartColorKey ?? "",
                      size: cartSizeLabel ?? "",
                      price: displayPrice,
                    })
                    vkGoal(ANALYTICS_GOALS.openQuickOrder, {
                      source: "product_page",
                      product_id: product.group_id,
                      product_name: product.name,
                      category: product.categories[0] ?? "product",
                      variant: cartColorKey ?? "",
                      size: cartSizeLabel ?? "",
                      price: displayPrice,
                    }, displayPrice)
                    setShowPopup(true)
                  }}
                  className="w-full rounded-none border-2 py-7 text-lg font-bold uppercase tracking-widest text-[#050505] hover:bg-transparent neon-flicker-slow disabled:opacity-40 disabled:cursor-not-allowed disabled:animate-none md:flex-1"
                  style={{ borderColor: cc.hex, backgroundColor: cc.hex, boxShadow: cc.glowShadow }}
                  onMouseEnter={e => { const el = e.currentTarget as HTMLButtonElement; if (!el.disabled) { el.style.backgroundColor = 'transparent'; el.style.color = cc.hex } }}
                  onMouseLeave={e => { const el = e.currentTarget as HTMLButtonElement; el.style.backgroundColor = cc.hex; el.style.color = '#050505' }}
                >
                  {tr.orderNow}
                </Button>

                <Button
                  size="lg"
                  type="button"
                  disabled={cartButtonDisabled}
                  onClick={() => {
                    ymAddToCart({
                      id: product.slug,
                      name: product.name,
                      price: displayPrice,
                      category: product.categories[0] ?? "product",
                      variant: cartColorKey ?? "",
                      quantity: 1,
                    })
                    ymGoal(ANALYTICS_GOALS.addToCart, {
                      source: "product_page",
                      product_id: product.slug,
                      product_name: product.name,
                      category: product.categories[0] ?? "product",
                      variant: cartColorKey ?? "",
                      size: cartSizeLabel ?? "",
                      price: displayPrice,
                    })
                    vkAddToCart({
                      source: "product_page",
                      productId: product.group_id,
                      productName: product.name,
                      category: product.categories[0] ?? "product",
                      variant: cartColorKey ?? "",
                      size: cartSizeLabel ?? "",
                      price: displayPrice,
                      quantity: 1,
                    })
                    addItem({
                      groupId: product.group_id,
                      slug: product.slug,
                      href: cartHref,
                      name: product.name,
                      locale,
                      price: displayPrice,
                      image: product.images[selectedImage] ?? product.images[0] ?? null,
                      colorKey: cartColorKey,
                      colorLabel: cartColorLabel,
                      sizeKey: cartSizeKey,
                      sizeLabel: cartSizeLabel,
                    })
                  }}
                  className="w-full rounded-none border-2 border-[#FF9000] bg-[#FF9000] py-7 text-lg font-bold uppercase tracking-widest text-[#050505] shadow-[0_0_16px_rgba(255,144,0,0.3)] transition-colors hover:bg-transparent hover:text-[#FF9000] disabled:opacity-40 disabled:cursor-not-allowed md:flex-1"
                >
                  <ShoppingBag size={20} className="mr-2" />
                  {tr.addToCart}
                </Button>
              </div>
            </div>


          </div>
        </div>

        {relatedProductCards.length > 0 && relatedCategoryId && (
          <div className="mt-16 border-t-2 border-[#1a1a2e] pt-10">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="font-tektur text-2xl font-bold uppercase tracking-wide text-[#f0f0f0] md:text-3xl">
                  {locale === 'ru' ? 'More in this category' : 'More in this category'}
                </h2>
                {relatedCategoryLabel && (
                  <p className="mt-2 text-sm leading-7 text-[#9a9aac]">
                    {locale === 'ru'
                      ? `Similar models from the ${relatedCategoryLabel.toLowerCase()} category.`
                      : `More products from ${relatedCategoryLabel}.`}
                  </p>
                )}
              </div>
              <Link
                href={`/catalog/${relatedCategoryId}/`}
                className="inline-flex items-center gap-2 self-start border border-[#FF9000] px-4 py-2 text-xs font-bold uppercase tracking-widest text-[#FF9000] transition-colors hover:bg-[#FF9000] hover:text-black"
              >
                {locale === 'ru' ? 'View category' : 'View category'}
              </Link>
            </div>

            <div className="relative mt-6">
              {relatedProductCards.length > 2 ? (
                <MobileSwipeHint
                  className="absolute inset-y-0 left-0 right-0 z-20"
                  onPrev={() => {
                    const el = relatedScrollRef.current
                    if (!el) return
                    const card = el.querySelector('div') as HTMLElement | null
                    el.scrollBy({ left: -(card?.offsetWidth ?? 240) * 2, behavior: 'smooth' })
                  }}
                  onNext={() => {
                    const el = relatedScrollRef.current
                    if (!el) return
                    const card = el.querySelector('div') as HTMLElement | null
                    el.scrollBy({ left: (card?.offsetWidth ?? 240) * 2, behavior: 'smooth' })
                  }}
                  showPrev={relatedCanScrollLeft}
                  showNext={relatedCanScrollRight}
                />
              ) : null}
              {relatedCanScrollLeft && (
                <button
                  type="button"
                  onClick={() => {
                    const el = relatedScrollRef.current
                    if (!el) return
                    const card = el.querySelector('div') as HTMLElement | null
                    el.scrollBy({ left: -(card?.offsetWidth ?? 240) * 2, behavior: 'smooth' })
                  }}
                  className="absolute -left-3 top-1/2 z-10 -translate-y-1/2 flex h-9 w-9 items-center justify-center border-2 border-[#FF9000] bg-[#0a0a0f] text-[#FF9000] shadow-[0_0_12px_rgba(255,144,0,0.3)] transition-opacity hover:bg-[#FF9000] hover:text-black md:-left-5"
                >
                  <ChevronLeft size={18} />
                </button>
              )}

              <div
                ref={relatedScrollRef}
                onScroll={() => {
                  const el = relatedScrollRef.current
                  if (!el) return
                  const scrollable = el.scrollWidth - el.clientWidth
                  setRelatedCanScrollLeft(el.scrollLeft > 4)
                  setRelatedCanScrollRight(el.scrollLeft < scrollable - 4)
                  setRelatedScrollProgress(scrollable > 0 ? el.scrollLeft / scrollable : 0)
                }}
                className="flex gap-3 overflow-x-auto pb-2 pt-12 md:gap-6 md:pt-0"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' } as React.CSSProperties}
              >
                {relatedProductCards.map((relatedProduct) => (
                  <div
                    key={relatedProduct.group_id}
                    className="w-[calc(50%-0.375rem)] shrink-0 md:w-[calc(33.333%-1rem)] lg:w-[calc(25%-1.125rem)] xl:w-[calc(20%-1.2rem)]"
                  >
                    <ProductCard
                      product={relatedProduct}
                      variants={relatedVariantsByGroup[relatedProduct.group_id] ?? [relatedProduct]}
                      locale={locale}
                      queryString={relatedCategoryId ? `category=${relatedCategoryId}` : ''}
                    />
                  </div>
                ))}
              </div>

              {relatedCanScrollRight && (
                <button
                  type="button"
                  onClick={() => {
                    const el = relatedScrollRef.current
                    if (!el) return
                    const card = el.querySelector('div') as HTMLElement | null
                    el.scrollBy({ left: (card?.offsetWidth ?? 240) * 2, behavior: 'smooth' })
                  }}
                  className="absolute -right-3 top-1/2 z-10 -translate-y-1/2 flex h-9 w-9 items-center justify-center border-2 border-[#FF9000] bg-[#0a0a0f] text-[#FF9000] shadow-[0_0_12px_rgba(255,144,0,0.3)] transition-opacity hover:bg-[#FF9000] hover:text-black md:-right-5"
                >
                  <ChevronRight size={18} />
                </button>
              )}
            </div>

            <div className="mt-4 flex justify-center gap-1.5">
              {relatedProductCards.map((_, i) => {
                const active = Math.round(relatedScrollProgress * (relatedProductCards.length - 1)) === i
                return (
                  <span
                    key={i}
                    className="h-1 rounded-full transition-all duration-300"
                    style={{
                      width: active ? 24 : 6,
                      backgroundColor: active ? '#FF9000' : '#1a1a2e',
                    }}
                  />
                )
              })}
            </div>
          </div>
        )}
      </div>

      {showSizePopup && (
        <SizeTablePopup
          sizes={productSizes}
          selectedIdx={resolvedSelectedSizeIdx}
          onSelect={idx => { setSelectedSizeKey(getProductSizeKey(productSizes[idx])); setSizePreviewBroken(false) }}
          onClose={() => setShowSizePopup(false)}
          cc={cc}
          isRu={isRu}
          sizePreview={product.size_preview}
          productName={product.name}
          otherSizeEnabled={otherSizeEnabled}
          onToggleOtherSize={handleOtherSizeToggle}
        />
      )}

      {showPopup && locale === 'ru'
        ? <OrderPopupRU
            product={{ ...product, images: galleryImages }}
            selectedSize={!otherSizeEnabled && selectedSize && selectedWidth > 0 ? {
              label: `${selectedSize.width_cm ?? ''} × ${selectedSize.height_cm ?? ''} cm`,
              width: selectedWidth,
              price: displayPrice,
              tubeMm: selectedSize.tube_mm,
            } : undefined}
            cheaperEnabled={cheaperEnabled}
            cheaperPrice={cheaperPrice}
            otherSizeEnabled={otherSizeEnabled}
            otherSizeValue={otherSizeValue}
            customColor={customColor ?? undefined}
            onClose={() => setShowPopup(false)}
          />
        : showPopup && <OrderPopup product={product} onClose={() => setShowPopup(false)} />
      }

      {lightbox !== null && (
        <Lightbox
          images={galleryImages}
          index={lightbox}
          name={product.name}
          locale={locale}
          accentColor={cc.hex}
          hueShift={imageHueShift}
          onClose={() => setLightbox(null)}
          onChange={setLightbox}
        />
      )}
    </section>
  )
}
