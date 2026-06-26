"use client"

import { useState } from "react"
import { X } from "lucide-react"
import { ANALYTICS_GOALS } from "@/lib/analytics-goals"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ymGoal, ymPurchase } from "@/lib/metrika"
import { getColorConfig, colorLabel } from "@/lib/utils"
import { vkGoal, vkPurchase } from "@/lib/vk-pixel"

interface OrderPopupRUProps {
  product: {
    group_id?: string
    name: string
    color: string | string[]
    sale_price_rub: number | null
    price_rub: number | null
    width_cm: number | null
    height_cm: number | null
    images?: string[]
  }
  selectedSize?: {
    label: string
    width: number
    price: number
    tubeMm?: number | null
  }
  cheaperEnabled?: boolean
  cheaperPrice?: string
  otherSizeEnabled?: boolean
  otherSizeValue?: string
  customColor?: string
  onClose: () => void
}

const CONTACT_OPTIONS = [
  { id: 'tg', label: 'Telegram', icon: '/icons/telegram_3670070.svg' },
]

export function OrderPopupRU({ product, selectedSize, cheaperEnabled, cheaperPrice, otherSizeEnabled, otherSizeValue, customColor, onClose }: OrderPopupRUProps) {
  const [name, setName] = useState("")
  const [phoneDigits, setPhoneDigits] = useState("")
  const [contact, setContact] = useState("")
  const [submitted, setSubmitted] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const colorStr = Array.isArray(product.color) ? (product.color[0] ?? '') : product.color
  const cc = getColorConfig(colorStr)

  const displayPrice = selectedSize?.price ?? product.sale_price_rub ?? 0
  const displayWidth = selectedSize?.width ?? product.width_cm
  const displaySizeLabel = selectedSize?.label
  const displayTubeMm = selectedSize?.tubeMm ?? null
  const displayPriceLabel = otherSizeEnabled ? 'Custom quote' : `$${displayPrice}`

  const formatPhone = (digits: string) => {
    if (digits.length === 0) return ''
    let result = '+1 ('
    result += digits.slice(0, 3)
    if (digits.length >= 3) result += ') ' + digits.slice(3, 6)
    if (digits.length >= 6) result += '-' + digits.slice(6, 10)
    return result
  }

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, '').replace(/^1/, '').slice(0, 10)
    setPhoneDigits(digits)
  }

  const handlePhoneKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      e.preventDefault()
      setPhoneDigits(prev => prev.slice(0, -1))
    }
  }

  const phone = formatPhone(phoneDigits)


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!phoneDigits || isSubmitting) return
    setIsSubmitting(true)
    try {
      await fetch(process.env.NEXT_PUBLIC_ORDER_WEBHOOK_URL as string, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'order',
          name,
          phone,
          contact,
          product: { name: product.name, color: product.color, price: displayPrice, size: displaySizeLabel, width: displayWidth, tubeMm: displayTubeMm },
          customColor: customColor || undefined,
          cheaper: cheaperEnabled ? { enabled: true, targetPrice: cheaperPrice || null } : undefined,
          otherSize: otherSizeEnabled ? { enabled: true, size: otherSizeValue || null } : undefined,
          site: 'neonhub.example',
          timestamp: new Date().toISOString(),
        }),
      })
      ymPurchase(`ORDER-${Date.now()}`, [{ id: product.name, name: product.name, price: displayPrice, category: 'neon', variant: colorStr, quantity: 1 }])
      ymGoal(ANALYTICS_GOALS.submitQuickOrder, {
        product_name: product.name,
        price: displayPrice,
        contact_method: contact,
        has_other_size: Boolean(otherSizeEnabled),
        has_custom_color: Boolean(customColor),
        has_cheaper_request: Boolean(cheaperEnabled),
      })
      vkGoal(ANALYTICS_GOALS.submitQuickOrder, {
        product_id: product.group_id ?? "",
        product_name: product.name,
        price: displayPrice,
        contact_method: contact,
        has_other_size: Boolean(otherSizeEnabled),
        has_custom_color: Boolean(customColor),
        has_cheaper_request: Boolean(cheaperEnabled),
      }, displayPrice)
      vkPurchase({
        productIds: product.group_id ? [product.group_id] : [],
        itemCount: 1,
        totalPrice: displayPrice,
        source: "quick_order_ru",
        contactMethod: contact,
      })
      setSubmitted(true)
    } catch (error) {
      console.error('Failed to submit order:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-[#050505]/80 backdrop-blur-md" />

      <div
        className="relative w-full max-w-md border-2 bg-[#0a0a0f] p-8"
        style={{ borderColor: cc.borderRgba, boxShadow: `0 0 40px ${cc.shadowRgba}` }}
        onClick={e => e.stopPropagation()}
      >
        {/* Close */}
        <button onClick={onClose} className="absolute right-4 top-4 text-[#888899] transition-colors hover:text-[#f0f0f0]">
          <X size={20} />
        </button>

        {/* Header */}
        <p className="text-xs uppercase tracking-widest text-[#888899]">Checkout</p>

        {/* Product preview */}
        <div className="mt-4 flex gap-4">
          {product.images && product.images.length > 0 && (
            <div className="relative h-20 w-20 flex-shrink-0 overflow-hidden border border-[#1a1a2e]">
              <img src={product.images[0]} alt={product.name} className="h-full w-full object-cover" />
            </div>
          )}
          <div>
            <h2 className={`font-tektur text-xl font-black uppercase tracking-wider ${cc.textClass}`}>
              {product.name}
            </h2>
            <p className="mt-1 text-sm text-[#888899]">
              {colorLabel(customColor || colorStr, 'en')}
              {displaySizeLabel && <span className="ml-2 font-bold text-[#FF9000]">{displaySizeLabel}</span>}
              {displayTubeMm != null && <span className="ml-1">· line thickness {displayTubeMm} mm</span>}
            </p>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black" style={{ color: cc.hex }}>{displayPriceLabel}</span>
            </div>
          </div>
        </div>

        {cheaperEnabled && (
          <div className="mt-3 flex items-center gap-2 rounded-none border border-[#FF9000] bg-[#FF9000]/10 px-3 py-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#FF9000]">Make it cheaper</span>
            {cheaperPrice && <span className="text-xs text-[#f0f0f0]">— up to ${cheaperPrice}</span>}
          </div>
        )}
        {otherSizeEnabled && (
          <div className="mt-2 flex items-center gap-2 rounded-none border border-[#FF9000] bg-[#FF9000]/10 px-3 py-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#FF9000]">Custom size</span>
            {otherSizeValue && <span className="text-xs text-[#f0f0f0]">— {otherSizeValue}</span>}
          </div>
        )}

        {/* Divider */}
        <div className="my-6 h-px w-full" style={{ background: `linear-gradient(90deg, transparent, ${cc.hex}, transparent)` }} />

        {/* Form */}
        {!submitted ? (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input
              placeholder="Your name"
              value={name}
              onChange={e => setName(e.target.value)}
              className="rounded-none border-2 border-[#1a1a2e] bg-[#0f0f1a] py-6 text-[#f0f0f0] placeholder:text-[#888899] focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 transition-colors"
              onFocus={e => (e.currentTarget.style.borderColor = '#FF9000')}
              onBlur={e => (e.currentTarget.style.borderColor = '#1a1a2e')}
            />
            <Input
              placeholder="+1 (___) ___-____"
              value={phone}
              onChange={handlePhoneChange}
              onKeyDown={handlePhoneKeyDown}
              required
              className="rounded-none border-2 border-[#1a1a2e] bg-[#0f0f1a] py-6 text-[#f0f0f0] placeholder:text-[#888899] focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 transition-colors"
              onFocus={e => (e.currentTarget.style.borderColor = '#FF9000')}
              onBlur={e => (e.currentTarget.style.borderColor = '#1a1a2e')}
            />

            {/* Contact preference */}
            <div>
              <p className="mb-2 text-xs uppercase tracking-wider text-[#888899]">Preferred contact</p>
              <div className="flex flex-wrap gap-2">
                {CONTACT_OPTIONS.map(({ id, label, icon }) => {
                  const active = contact === id
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setContact(id)}
                      className="flex items-center gap-1.5 border-2 px-3 py-2 text-xs font-bold uppercase tracking-wide transition-all"
                      style={active ? {
                        borderColor: '#FF9000',
                        backgroundColor: 'rgba(255,144,0,0.15)',
                        color: '#FF9000',
                      } : {
                        borderColor: '#1a1a2e',
                        backgroundColor: 'transparent',
                        color: '#888899',
                      }}
                    >
                      {icon
                        ? <img src={icon} alt={label} className="h-4 w-4 shrink-0" />
                        : <span className="text-sm shrink-0">📞</span>
                      }
                      <span className="whitespace-nowrap">{label}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-none border-2 py-6 font-bold uppercase tracking-wider text-black transition-all disabled:opacity-50"
              style={{ borderColor: '#FF9000', backgroundColor: '#FF9000', boxShadow: '0 0 15px rgba(255,144,0,0.5)' }}
            >
              {isSubmitting ? 'Sending...' : 'Place order'}
            </Button>
          </form>
        ) : (
          <div className="border-2 py-6 text-center font-tektur font-bold uppercase tracking-widest" style={{ borderColor: cc.hex, color: cc.hex }}>
            ✓ Thank you! We'll get back to you shortly.
          </div>
        )}
      </div>
    </div>
  )
}
