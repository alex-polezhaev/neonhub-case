import { ANALYTICS_GOALS } from "@/lib/analytics-goals"

declare global {
  interface Window {
    dataLayer: object[]
    ym?: (...args: unknown[]) => void
  }
}

export const METRIKA_ID = Number(process.env.NEXT_PUBLIC_YANDEX_METRIKA_ID) || 0
export { ANALYTICS_GOALS as YM_GOALS }

function push(obj: object) {
  if (typeof window === 'undefined') return
  window.dataLayer = window.dataLayer || []
  window.dataLayer.push(obj)
}

export function ymGoal(goal: string, params?: Record<string, unknown>) {
  if (typeof window === "undefined" || typeof window.ym !== "function") return
  window.ym(METRIKA_ID, "reachGoal", goal, params)
}

export function ymImpressions(products: Array<{ id: string; name: string; price: number; category: string; variant: string; position: number }>) {
  push({
    ecommerce: {
      currencyCode: 'USD',
      impressions: products,
    },
  })
}

export function ymClick(product: { id: string; name: string; price: number; category: string; variant: string; position: number }) {
  push({
    ecommerce: {
      currencyCode: 'USD',
      click: { products: [product] },
    },
  })
}

export function ymDetail(product: { id: string; name: string; price: number; category: string; variant: string }) {
  push({
    ecommerce: {
      currencyCode: 'USD',
      detail: { products: [product] },
    },
  })
}

export function ymAddToCart(product: { id: string; name: string; price: number; category: string; variant: string; quantity: number }) {
  push({
    ecommerce: {
      currencyCode: "USD",
      add: { products: [product] },
    },
  })
}

export function ymRemoveFromCart(product: { id: string; name: string; price: number; category: string; variant: string; quantity: number }) {
  push({
    ecommerce: {
      currencyCode: "USD",
      remove: { products: [product] },
    },
  })
}

export function ymBeginCheckout(products: Array<{ id: string; name: string; price: number; category: string; variant: string; quantity: number }>) {
  push({
    ecommerce: {
      currencyCode: "USD",
      checkout: {
        actionField: { step: 1 },
        products,
      },
    },
  })
}

export function ymPurchase(orderId: string, products: Array<{ id: string; name: string; price: number; category: string; variant: string; quantity: number }>) {
  push({
    ecommerce: {
      currencyCode: 'USD',
      purchase: {
        actionField: { id: orderId },
        products,
      },
    },
  })
}
