"use client"

import Link from "next/link"
import { ArrowUpRight, Minus, Plus, ShoppingBag, Trash2, X } from "lucide-react"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { useCart } from "@/components/cart-provider"
import { directusImage } from "@/lib/utils"
import { ANALYTICS_GOALS } from "@/lib/analytics-goals"
import { ymBeginCheckout, ymGoal, ymPurchase, ymRemoveFromCart } from "@/lib/metrika"
import { vkBeginCheckout, vkGoal, vkPurchase } from "@/lib/vk-pixel"

const CONTACT_OPTIONS = [
  { id: "tg", label: "Telegram", icon: "/icons/telegram_3670070.svg" },
]

type CheckoutErrors = {
  name?: string
  phone?: string
  contact?: string
}

function formatPrice(value: number, locale: string): string {
  if (locale === "ru") {
    return `$${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Math.round(value))}`
  }

  return `$${new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value)}`
}

function getItemCountLabel(itemCount: number, locale: string): string {
  if (locale !== "ru") {
    return itemCount === 0 ? "empty" : `${itemCount} item${itemCount === 1 ? "" : "s"}`
  }

  if (itemCount === 0) return "empty"
  if (itemCount === 1) return "1 item"
  if (itemCount < 5) return `${itemCount} items`
  return `${itemCount} items`
}

export function FloatingCartTablet() {
  const pathname = usePathname()
  const {
    items,
    itemCount,
    totalPrice,
    locale,
    isOpen,
    openCart,
    closeCart,
    removeItem,
    setQuantity,
    clearCart,
  } = useCart()
  const [showCheckout, setShowCheckout] = useState(false)
  const [name, setName] = useState("")
  const [phoneDigits, setPhoneDigits] = useState("")
  const [contact, setContact] = useState("")
  const [submitted, setSubmitted] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errors, setErrors] = useState<CheckoutErrors>({})

  useEffect(() => {
    if (!isOpen) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeCart()
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [closeCart, isOpen])

  useEffect(() => {
    if (items.length === 0 && isOpen) {
      closeCart()
    }
  }, [closeCart, isOpen, items.length])

  if (pathname?.startsWith("/print-catalog") || items.length === 0) {
    return null
  }

  const formatPhone = (digits: string) => {
    if (digits.length === 0) return ""
    let result = "+1 ("
    result += digits.slice(0, 3)
    if (digits.length >= 3) result += ") " + digits.slice(3, 6)
    if (digits.length >= 6) result += "-" + digits.slice(6, 10)
    return result
  }

  const phone = formatPhone(phoneDigits)

  const handlePhoneChange = (value: string) => {
    const digits = value.replace(/\D/g, "").replace(/^1/, "").slice(0, 10)
    setPhoneDigits(digits)
    setErrors((prev) => ({ ...prev, phone: undefined }))
  }

  const handlePhoneKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Backspace") {
      event.preventDefault()
      setPhoneDigits((prev) => prev.slice(0, -1))
    }
  }

  const handleCheckoutOpen = () => {
    ymBeginCheckout(
      items.map((item) => ({
        id: item.slug,
        name: item.name,
        price: item.price,
        category: "cart",
        variant: item.colorKey ?? "",
        quantity: item.quantity,
      })),
    )
    ymGoal(ANALYTICS_GOALS.beginCheckout, {
      item_count: itemCount,
      total_price: totalPrice,
      products: items.map((item) => item.slug),
    })
    vkBeginCheckout({
      productIds: items.map((item) => item.groupId),
      itemCount,
      totalPrice,
      source: "cart",
    })
    setShowCheckout(true)
    setSubmitted(false)
  }

  const validateCheckout = (): CheckoutErrors => {
    const nextErrors: CheckoutErrors = {}

    if (name.trim().length < 2) {
      nextErrors.name = "Enter your name"
    }

    if (phoneDigits.length !== 10) {
      nextErrors.phone = "Enter a valid phone number"
    }

    if (!contact) {
      nextErrors.contact = "Choose a contact method"
    }

    return nextErrors
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (items.length === 0 || isSubmitting) return

    const nextErrors = validateCheckout()
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }

    setIsSubmitting(true)

    try {
      await fetch(process.env.NEXT_PUBLIC_ORDER_WEBHOOK_URL as string, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "cart-order",
          name,
          phone,
          contact,
          items: items.map((item) => ({
            name: item.name,
            slug: item.slug,
            color: item.colorLabel,
            size: item.sizeLabel,
            quantity: item.quantity,
            price: item.price,
            total: item.price * item.quantity,
          })),
          totalPrice,
          site: "neonhub.example",
          timestamp: new Date().toISOString(),
        }),
      })

      ymPurchase(
        `CART-${Date.now()}`,
        items.map((item) => ({
          id: item.slug,
          name: item.name,
          price: item.price,
          category: "cart",
          variant: item.colorKey ?? "",
          quantity: item.quantity,
        })),
      )
      ymGoal(ANALYTICS_GOALS.submitCartOrder, {
        item_count: itemCount,
        total_price: totalPrice,
        contact_method: contact,
      })
      vkGoal(ANALYTICS_GOALS.submitCartOrder, {
        item_count: itemCount,
        total_price: totalPrice,
        contact_method: contact,
      }, totalPrice)
      vkPurchase({
        productIds: items.map((item) => item.groupId),
        itemCount,
        totalPrice,
        source: "cart_order",
        contactMethod: contact,
      })

      setSubmitted(true)
      setErrors({})
    } catch (error) {
      console.error("Failed to submit cart order:", error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <div
        className="pointer-events-none fixed inset-x-0 z-[70] flex justify-center px-3 print:hidden"
        style={{ bottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      >
        <button
          type="button"
          aria-label="Cart"
          onClick={() => {
            ymGoal(ANALYTICS_GOALS.openCart, {
              item_count: itemCount,
              total_price: totalPrice,
            })
            vkGoal(ANALYTICS_GOALS.openCart, {
              item_count: itemCount,
              total_price: totalPrice,
            }, totalPrice)
            openCart()
          }}
          className="group pointer-events-auto relative w-full max-w-[34rem] overflow-hidden rounded-[26px] border border-[#FF9000]/6 bg-[linear-gradient(135deg,rgba(255,144,0,0.015),rgba(18,12,7,0.14)_36%,rgba(10,10,15,0.18)_100%)] text-left text-[#f5f5f7] shadow-[0_8px_20px_rgba(0,0,0,0.1),0_0_10px_rgba(255,144,0,0.025)] backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 hover:border-[#FF9000]/30 hover:bg-[linear-gradient(135deg,rgba(255,144,0,0.11),rgba(18,12,7,0.58)_36%,rgba(10,10,15,0.62)_100%)] hover:shadow-[0_18px_44px_rgba(0,0,0,0.32),0_0_24px_rgba(255,144,0,0.14)]"
        >
          <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.9),rgba(255,144,0,0.9),transparent)]" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,168,73,0.02),transparent_32%),linear-gradient(180deg,rgba(255,255,255,0.015),rgba(255,255,255,0)_28%,rgba(0,0,0,0.02)_100%)] transition-all duration-300 group-hover:bg-[radial-gradient(circle_at_top_left,rgba(255,168,73,0.12),transparent_32%),linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0)_28%,rgba(0,0,0,0.1)_100%)]" />
          <div className="relative flex items-center gap-3 px-3 py-2.5 md:px-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] border border-[#FF9000]/6 bg-[#0a0a0f]/16 text-[#FF9000]/35 shadow-[inset_0_0_0_1px_rgba(255,144,0,0.025),0_0_6px_rgba(255,144,0,0.025)] transition-all duration-300 group-hover:border-[#FF9000]/25 group-hover:bg-[#0a0a0f]/82 group-hover:text-[#FF9000] group-hover:shadow-[inset_0_0_0_1px_rgba(255,144,0,0.12),0_0_12px_rgba(255,144,0,0.12)]">
              <ShoppingBag size={20} strokeWidth={2.2} />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 leading-none">
                <span className="text-[9px] font-black uppercase tracking-[0.3em] text-[#FF9000]/36 transition-colors duration-300 group-hover:text-[#FF9000]">
                  Cart
                </span>
                <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-[#FF9000]/12 px-2 py-0.5 text-[9px] font-black text-black/45 shadow-[0_0_4px_rgba(255,144,0,0.04)] transition-all duration-300 group-hover:bg-[#FF9000] group-hover:text-black group-hover:shadow-[0_0_10px_rgba(255,144,0,0.28)]">
                  {itemCount}
                </span>
              </div>

              <div className="mt-0.5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-base font-black uppercase tracking-[0.08em] text-white/42 transition-colors duration-300 group-hover:text-white md:text-lg">
                    {formatPrice(totalPrice, locale)}
                  </p>
                  <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-[#b8b9c4]/36 transition-colors duration-300 group-hover:text-[#b8b9c4]">
                    {getItemCountLabel(itemCount, locale)}
                  </p>
                </div>

                <div className="hidden h-8 w-px bg-white/4 transition-colors duration-300 group-hover:bg-white/10 sm:block" />

                <p className="hidden text-right text-[10px] font-bold uppercase tracking-[0.22em] text-[#d9b27f]/34 transition-colors duration-300 group-hover:text-[#d9b27f] sm:block">
                  open
                </p>
              </div>
            </div>

            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[16px] border border-[#FF9000]/8 bg-[#FF9000]/12 text-black/40 shadow-[0_0_4px_rgba(255,144,0,0.04)] transition-all duration-300 group-hover:border-[#FF9000]/30 group-hover:bg-[#FF9000] group-hover:text-black group-hover:shadow-[0_0_12px_rgba(255,144,0,0.22)]">
              <ArrowUpRight size={18} strokeWidth={2.4} />
            </div>
          </div>
        </button>
      </div>

      <div
        className={`fixed inset-0 z-[79] bg-black/55 backdrop-blur-sm transition-opacity duration-300 ${isOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"}`}
        onClick={closeCart}
      />

      <aside
        className={`fixed right-0 top-0 z-[80] flex h-full w-full max-w-md flex-col border-l border-[#FF9000]/16 bg-[#07070c]/96 shadow-[-20px_0_60px_rgba(0,0,0,0.45)] backdrop-blur-2xl transition-transform duration-300 ${isOpen ? "translate-x-0" : "translate-x-full"}`}
      >
        <div className="flex items-center justify-between border-b border-[#1a1a2e] px-5 py-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.32em] text-[#FF9000]">
              Cart
            </p>
            <p className="mt-1 text-sm text-[#8d90a6]">
              {getItemCountLabel(itemCount, locale)}
            </p>
          </div>

          <button
            type="button"
            aria-label="Close cart"
            onClick={closeCart}
            className="flex h-10 w-10 items-center justify-center border border-[#2a2c3c] text-[#a0a3b8] transition-colors hover:border-[#FF9000] hover:text-[#FF9000]"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          {items.length === 0 ? (
            <div className="flex h-full min-h-60 flex-col items-center justify-center border border-dashed border-[#232536] bg-[#0a0a0f]/75 px-6 text-center">
              <div className="flex h-14 w-14 items-center justify-center border border-[#FF9000]/18 bg-[#FF9000]/8 text-[#FF9000]/55">
                <ShoppingBag size={24} />
              </div>
              <p className="mt-5 text-sm font-bold uppercase tracking-[0.24em] text-[#f1f2f6]">
                Your cart is empty
              </p>
              <p className="mt-2 text-sm leading-6 text-[#85889d]">
                Add products from the catalog or a product page.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="border border-[#1a1a2e] bg-[#0a0a0f]/78 p-3"
                >
                  <div className="flex items-start gap-3">
                    <Link
                      href={item.href}
                      onClick={closeCart}
                      className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden border border-[#1a1a2e] bg-[#050508]"
                    >
                      {item.image ? (
                        <img
                          src={directusImage(item.image, 20, 160)}
                          alt={item.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="text-[10px] uppercase tracking-[0.24em] text-[#6d7084]">
                          NEON
                        </span>
                      )}
                    </Link>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <Link
                            href={item.href}
                            onClick={closeCart}
                            className="block truncate text-sm font-bold uppercase tracking-[0.08em] text-[#f3f4f8] transition-colors hover:text-[#FF9000]"
                          >
                            {item.name}
                          </Link>

                          <div className="mt-2 flex flex-wrap gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[#8a8ea5]">
                            {item.colorLabel ? <span>{item.colorLabel}</span> : null}
                            {item.sizeLabel ? <span>{item.sizeLabel}</span> : null}
                          </div>
                        </div>

                        <button
                          type="button"
                          aria-label="Remove from cart"
                          onClick={() => {
                            ymRemoveFromCart({
                              id: item.slug,
                              name: item.name,
                              price: item.price,
                              category: "cart",
                              variant: item.colorKey ?? "",
                              quantity: item.quantity,
                            })
                            removeItem(item.id)
                          }}
                          className="flex h-8 w-8 shrink-0 items-center justify-center border border-[#2a2c3c] text-[#8b8ea3] transition-colors hover:border-[#ff6b6b] hover:text-[#ff6b6b]"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>

                      <div className="mt-4 flex items-center justify-between gap-3">
                        <div className="flex items-center border border-[#1f2130] bg-[#0f1018]">
                          <button
                            type="button"
                            aria-label="Decrease quantity"
                            onClick={() => {
                              ymRemoveFromCart({
                                id: item.slug,
                                name: item.name,
                                price: item.price,
                                category: "cart",
                                variant: item.colorKey ?? "",
                                quantity: 1,
                              })
                              setQuantity(item.id, item.quantity - 1)
                            }}
                            className="flex h-9 w-9 items-center justify-center text-[#9b9eb3] transition-colors hover:text-[#FF9000]"
                          >
                            <Minus size={15} />
                          </button>

                          <span className="flex h-9 min-w-10 items-center justify-center border-x border-[#1f2130] px-3 text-sm font-black text-[#f0f0f0]">
                            {item.quantity}
                          </span>

                          <button
                            type="button"
                            aria-label="Increase quantity"
                            onClick={() => setQuantity(item.id, item.quantity + 1)}
                            className="flex h-9 w-9 items-center justify-center text-[#9b9eb3] transition-colors hover:text-[#FF9000]"
                          >
                            <Plus size={15} />
                          </button>
                        </div>

                        <div className="text-right">
                          <p className="text-xs uppercase tracking-[0.22em] text-[#777a8f]">
                            {formatPrice(item.price, item.locale)} each
                          </p>
                          <p className="mt-1 text-lg font-black text-[#FF9000]">
                            {formatPrice(item.price * item.quantity, item.locale)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-[#1a1a2e] px-4 py-4">
          <div className="flex items-center justify-between text-sm uppercase tracking-[0.22em] text-[#8f92a7]">
            <span>Total</span>
            <span className="text-xl font-black tracking-[0.06em] text-[#f3f4f8]">
              {formatPrice(totalPrice, locale)}
            </span>
          </div>

          <div className="mt-3 border border-[#FF9000]/16 bg-[#FF9000]/6 px-3 py-3">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#FF9000]">
              Payment
            </p>
            <p className="mt-1 text-sm leading-6 text-[#c8cad6]">
              After your order is confirmed with a manager.
            </p>
          </div>

          <div className="mt-4 flex gap-3">
            <button
              type="button"
              onClick={() => {
                for (const item of items) {
                  ymRemoveFromCart({
                    id: item.slug,
                    name: item.name,
                    price: item.price,
                    category: "cart",
                    variant: item.colorKey ?? "",
                    quantity: item.quantity,
                  })
                }
                clearCart()
              }}
              disabled={items.length === 0}
              className="flex-1 border border-[#2a2c3c] px-4 py-3 text-xs font-bold uppercase tracking-[0.22em] text-[#9ca0b6] transition-colors hover:border-[#FF9000] hover:text-[#FF9000] disabled:cursor-not-allowed disabled:opacity-35"
            >
              Clear
            </button>
            <button
              type="button"
              disabled={items.length === 0}
              onClick={handleCheckoutOpen}
              className="flex-1 border-2 border-[#FF9000] bg-[#FF9000] px-4 py-3 text-xs font-black uppercase tracking-[0.22em] text-black transition-colors hover:bg-transparent hover:text-[#FF9000] disabled:cursor-not-allowed disabled:opacity-35"
            >
              Checkout
            </button>
          </div>

          {showCheckout && items.length > 0 ? (
            <div className="mt-4 border border-[#1a1a2e] bg-[#0a0a0f] p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.28em] text-[#FF9000]">
                    Checkout
                  </p>
                  <p className="mt-1 text-sm text-[#8a8ea5]">
                    Fill out the form and we'll get back to you about your cart.
                  </p>
                </div>
                <button
                  type="button"
                  aria-label="Collapse checkout"
                  onClick={() => setShowCheckout(false)}
                  className="flex h-9 w-9 items-center justify-center border border-[#2a2c3c] text-[#9ba0b5] transition-colors hover:border-[#FF9000] hover:text-[#FF9000]"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="my-4 h-px bg-[linear-gradient(90deg,transparent,#FF9000,transparent)]" />

              {!submitted ? (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <input
                    type="text"
                    placeholder="Your name"
                    value={name}
                    onChange={(event) => {
                      setName(event.target.value)
                      setErrors((prev) => ({ ...prev, name: undefined }))
                    }}
                    className={`w-full border-2 bg-[#0f0f1a] px-4 py-3 text-sm text-[#f0f0f0] placeholder:text-[#888899] outline-none transition-colors focus:border-[#FF9000] ${errors.name ? "border-[#ff6b6b]" : "border-[#1a1a2e]"}`}
                  />
                  {errors.name ? (
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#ff8a8a]">
                      {errors.name}
                    </p>
                  ) : null}

                  <input
                    type="tel"
                    placeholder="+1 (___) ___-____"
                    value={phone}
                    onChange={(event) => handlePhoneChange(event.target.value)}
                    onKeyDown={handlePhoneKeyDown}
                    required
                    className={`w-full border-2 bg-[#0f0f1a] px-4 py-3 text-sm text-[#f0f0f0] placeholder:text-[#888899] outline-none transition-colors focus:border-[#FF9000] ${errors.phone ? "border-[#ff6b6b]" : "border-[#1a1a2e]"}`}
                  />
                  {errors.phone ? (
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#ff8a8a]">
                      {errors.phone}
                    </p>
                  ) : null}

                  <div>
                    <p className="mb-2 text-xs uppercase tracking-[0.22em] text-[#888899]">
                      Preferred contact
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {CONTACT_OPTIONS.map(({ id, label, icon }) => {
                        const active = contact === id
                        return (
                          <button
                            key={id}
                            type="button"
                            onClick={() => {
                              setContact(id)
                              setErrors((prev) => ({ ...prev, contact: undefined }))
                            }}
                            className="flex items-center gap-1.5 border-2 px-3 py-2 text-xs font-bold uppercase tracking-[0.14em] transition-all"
                            style={active ? {
                              borderColor: "#FF9000",
                              backgroundColor: "rgba(255,144,0,0.15)",
                              color: "#FF9000",
                            } : {
                              borderColor: "#1a1a2e",
                              backgroundColor: "transparent",
                              color: "#888899",
                            }}
                          >
                            <img src={icon} alt={label} className="h-4 w-4 shrink-0" />
                            <span className="whitespace-nowrap">{label}</span>
                          </button>
                        )
                      })}
                    </div>
                    {errors.contact ? (
                      <p className="mt-2 text-xs font-bold uppercase tracking-[0.18em] text-[#ff8a8a]">
                        {errors.contact}
                      </p>
                    ) : null}
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full border-2 border-[#FF9000] bg-[#FF9000] px-4 py-3 text-sm font-black uppercase tracking-[0.22em] text-black transition-colors hover:bg-transparent hover:text-[#FF9000] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isSubmitting ? "Submitting..." : "Place order"}
                  </button>
                </form>
              ) : (
                <div className="border border-[#FF9000] bg-[#FF9000]/10 px-4 py-5 text-center">
                  <p className="text-sm font-black uppercase tracking-[0.22em] text-[#FF9000]">
                    Thank you
                  </p>
                  <p className="mt-2 text-sm leading-6 text-[#f0f0f0]">
                    We've received your order and will contact you shortly.
                  </p>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </aside>
    </>
  )
}
