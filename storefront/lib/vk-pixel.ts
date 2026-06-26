import { ANALYTICS_GOALS } from "@/lib/analytics-goals"

declare global {
  interface Window {
    _tmr?: Array<Record<string, unknown>>
  }
}

export const VK_PIXEL_ID = process.env.NEXT_PUBLIC_VK_PIXEL_ID || ""
export { ANALYTICS_GOALS as VK_GOALS }

type VkGoalParams = Record<string, unknown>

type VkProductEventInput = {
  productId: string
  productName?: string
  category?: string
  variant?: string
  size?: string
  source?: string
  price?: number
  quantity?: number
}

type VkCheckoutEventInput = {
  productIds: string[]
  itemCount?: number
  totalPrice?: number
  source?: string
  contactMethod?: string
}

const VK_GOAL_NAME_MAP: Record<string, string> = {
  [ANALYTICS_GOALS.addToCart]: "addToCart",
  [ANALYTICS_GOALS.openCart]: "openCart",
  [ANALYTICS_GOALS.beginCheckout]: "beginCheckout",
  [ANALYTICS_GOALS.submitCartOrder]: "submitCartOrder",
  [ANALYTICS_GOALS.openQuickOrder]: "openQuickOrder",
  [ANALYTICS_GOALS.submitQuickOrder]: "submitQuickOrder",
  [ANALYTICS_GOALS.submitContactForm]: "submitContactForm",
}

function pushVkEvent(payload: Record<string, unknown>) {
  if (typeof window === "undefined") return
  window._tmr = window._tmr || []
  window._tmr.push(payload)
}

function normalizeVkGoal(goal: string) {
  return VK_GOAL_NAME_MAP[goal] || goal.replace(/[^a-zA-Z0-9]/g, "")
}

function compactParams(params: VkGoalParams): VkGoalParams | undefined {
  const entries = Object.entries(params).filter(([, value]) => {
    if (value == null) return false
    if (typeof value === "string") return value.trim().length > 0
    if (Array.isArray(value)) return value.length > 0
    return true
  })

  return entries.length > 0 ? Object.fromEntries(entries) : undefined
}

export function vkPageView(url?: string, referrer?: string) {
  pushVkEvent({
    id: VK_PIXEL_ID,
    type: "pageView",
    ...(url ? { url } : {}),
    ...(referrer ? { referrer } : {}),
  })
}

export function vkGoal(goal: string, params?: Record<string, unknown>, value?: number) {
  pushVkEvent({
    type: "reachGoal",
    id: VK_PIXEL_ID,
    goal: normalizeVkGoal(goal),
    ...(typeof value === "number" ? { value } : {}),
    ...(params ? { params } : {}),
  })
}

export function vkViewProduct({
  productId,
  productName,
  category,
  variant,
  size,
  source,
  price,
}: VkProductEventInput) {
  vkGoal("viewProduct", compactParams({
    product_id: productId,
    product_name: productName,
    category,
    variant,
    size,
    source,
    price,
  }), price)
}

export function vkAddToCart({
  productId,
  productName,
  category,
  variant,
  size,
  source,
  price,
  quantity,
}: VkProductEventInput) {
  vkGoal("addToCart", compactParams({
    product_id: productId,
    product_name: productName,
    category,
    variant,
    size,
    source,
    price,
    quantity,
  }), price)
}

export function vkBeginCheckout({
  productIds,
  itemCount,
  totalPrice,
  source,
}: VkCheckoutEventInput) {
  vkGoal("beginCheckout", compactParams({
    product_ids: productIds,
    item_count: itemCount,
    total_price: totalPrice,
    source,
  }), totalPrice)
}

export function vkPurchase({
  productIds,
  itemCount,
  totalPrice,
  source,
  contactMethod,
}: VkCheckoutEventInput) {
  vkGoal("purchase", compactParams({
    product_ids: productIds,
    item_count: itemCount,
    total_price: totalPrice,
    source,
    contact_method: contactMethod,
  }), totalPrice)
}
