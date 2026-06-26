"use client"

import { useState, useEffect } from "react"
import { X, Mail, Zap } from "lucide-react"
import { ANALYTICS_GOALS } from "@/lib/analytics-goals"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ymGoal } from "@/lib/metrika"
import { getColorConfig } from "@/lib/utils"
import { vkGoal, vkPurchase } from "@/lib/vk-pixel"

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void
  }
}

interface OrderPopupProps {
  product: {
    group_id?: string
    name: string
    color: string | string[]
    sale_price_usd: number | null
    price_usd: number | null
    width_in: number | null
    height_in: number | null
  }
  onClose: () => void
}

const LAUNCH_DATE = new Date("2026-04-09T00:00:00")

function useCountdown(target: Date) {
  const calc = () => {
    const diff = Math.max(0, target.getTime() - Date.now())
    return {
      days:    Math.floor(diff / 86400000),
      hours:   Math.floor((diff % 86400000) / 3600000),
      minutes: Math.floor((diff % 3600000) / 60000),
      seconds: Math.floor((diff % 60000) / 1000),
    }
  }
  const [time, setTime] = useState(calc)
  useEffect(() => {
    const id = setInterval(() => setTime(calc()), 1000)
    return () => clearInterval(id)
  }, [])
  return time
}

export function OrderPopup({ product, onClose }: OrderPopupProps) {
  const colorStr = Array.isArray(product.color) ? (product.color[0] ?? '') : product.color
  const cc = getColorConfig(colorStr)
  const { days, hours, minutes, seconds } = useCountdown(LAUNCH_DATE)
  const [email, setEmail] = useState("")
  const [submitted, setSubmitted] = useState(false)
  const salePrice = product.sale_price_usd ?? 0
  const price = product.price_usd ?? 0
  const discount = Math.round((1 - salePrice / (price || 1)) * 100)

  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || isSubmitting) return
    
    setIsSubmitting(true)
    
    try {
      await fetch(process.env.NEXT_PUBLIC_ORDER_WEBHOOK_URL as string, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          product: {
            name: product.name,
            color: product.color,
            salePrice: salePrice,
            price: price,
            width: product.width_in,
            height: product.height_in,
          },
          timestamp: new Date().toISOString(),
        }),
      })
      
      // Track Purchase conversion
      if (typeof window !== 'undefined' && window.fbq) {
        window.fbq('track', 'Purchase', {
          value: salePrice,
          currency: 'USD',
          content_name: product.name,
          content_type: 'product',
        })
      }
      ymGoal(ANALYTICS_GOALS.submitQuickOrder, {
        source: "product_popup_en",
        product_name: product.name,
        price: salePrice,
      })
      vkGoal(ANALYTICS_GOALS.submitQuickOrder, {
        source: "product_popup_en",
        product_id: product.group_id ?? "",
        product_name: product.name,
        price: salePrice,
      }, salePrice)
      vkPurchase({
        productIds: product.group_id ? [product.group_id] : [],
        itemCount: 1,
        totalPrice: salePrice,
        source: "quick_order_en",
      })
      
      setSubmitted(true)
    } catch (error) {
      console.error('Failed to submit order:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-[#050505]/80 backdrop-blur-md" />

      {/* Modal */}
      <div
        className="relative w-full max-w-md border-2 bg-[#0a0a0f] p-8"
        style={{ borderColor: cc.borderRgba, boxShadow: `0 0 40px ${cc.shadowRgba}` }}
        onClick={e => e.stopPropagation()}
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-[#888899] transition-colors hover:text-[#f0f0f0]"
        >
          <X size={20} />
        </button>

        {/* Product info */}
        <div className="mb-6">
          <p className="text-xs uppercase tracking-widest text-[#888899]">Your order</p>
          <h2 className={`mt-1 font-sans text-2xl font-black uppercase tracking-wider ${cc.textClass}`}>
            {product.name}
          </h2>
          <div className="mt-2 flex items-center gap-3 text-sm text-[#888899]">
            <span>Color: <span className="text-[#f0f0f0]">{colorStr.charAt(0).toUpperCase() + colorStr.slice(1)}</span></span>
            <span>·</span>
            <span>{product.width_in}×{product.height_in} in</span>
          </div>
          <div className="mt-3 flex items-baseline gap-3">
            <span className="text-3xl font-black" style={{ color: cc.hex }}>
              ${salePrice}
            </span>
            <span className="text-sm text-[#888899] line-through">${price}</span>
            <span className="bg-[#ff2d95] px-2 py-0.5 text-xs font-bold text-white">-{discount}%</span>
          </div>
        </div>

        {/* Divider */}
        <div className="neon-line mb-6" />

        {/* Launch message */}
        <div className="mb-6 text-center">
          <div className="flex items-center justify-center gap-2 mb-1">
            <Zap size={16} style={{ color: cc.hex }} />
            <p className="text-xs font-bold uppercase tracking-widest" style={{ color: cc.hex }}>
              Launching next week
            </p>
            <Zap size={16} style={{ color: cc.hex }} />
          </div>
          <p className="text-sm text-[#888899]">
            We're almost ready. Leave your email and be the first to order.
          </p>
        </div>

        {/* Countdown */}
        <div className="mb-6 grid grid-cols-4 gap-2 text-center">
          {[
            { label: "Days",    value: days },
            { label: "Hours",   value: hours },
            { label: "Min",     value: minutes },
            { label: "Sec",     value: seconds },
          ].map(({ label, value }) => (
            <div key={label} className="border border-[#1a1a2e] bg-[#050505] py-3">
              <div className="font-sans text-2xl font-black" style={{ color: cc.hex }}>
                {String(value).padStart(2, "0")}
              </div>
              <div className="text-xs uppercase tracking-wider text-[#888899]">{label}</div>
            </div>
          ))}
        </div>

        {/* Email form */}
        {!submitted ? (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <Input
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="rounded-none border-2 border-[#1a1a2e] bg-[#0f0f1a] py-6 text-[#f0f0f0] placeholder:text-[#888899] focus:ring-0"
              style={{ borderColor: email ? cc.borderRgba : undefined }}
            />
            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-none border-2 py-6 font-bold uppercase tracking-wider transition-all disabled:opacity-50"
              style={{
                borderColor: cc.hex,
                backgroundColor: cc.hex,
                color: '#050505',
                boxShadow: cc.glowShadow,
              }}
            >
              <Mail size={20} className="mr-2" />
              {isSubmitting ? 'Sending...' : 'Notify Me'}
            </Button>
          </form>
        ) : (
          <div
            className="border py-4 text-center text-sm font-bold uppercase tracking-widest"
            style={{ borderColor: cc.borderRgba, color: cc.hex }}
          >
            ✓ We'll notify you at launch!
          </div>
        )}
      </div>
    </div>
  )
}
