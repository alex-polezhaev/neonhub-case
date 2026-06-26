"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"

export interface CartItem {
  id: string
  groupId: string
  slug: string
  href: string
  name: string
  locale: string
  price: number
  quantity: number
  image: string | null
  colorKey?: string | null
  colorLabel?: string | null
  sizeKey?: string | null
  sizeLabel?: string | null
}

export interface AddCartItemInput {
  groupId: string
  slug: string
  href: string
  name: string
  locale: string
  price: number
  image?: string | null
  colorKey?: string | null
  colorLabel?: string | null
  sizeKey?: string | null
  sizeLabel?: string | null
}

interface CartContextValue {
  items: CartItem[]
  itemCount: number
  totalPrice: number
  locale: string
  isOpen: boolean
  openCart: () => void
  closeCart: () => void
  addItem: (input: AddCartItemInput) => void
  removeItem: (id: string) => void
  setQuantity: (id: string, quantity: number) => void
  clearCart: () => void
}

const CART_STORAGE_KEY = "neon-hub-cart-v1"

const CartContext = createContext<CartContextValue | null>(null)

function buildCartItemId(input: AddCartItemInput): string {
  return [
    input.groupId,
    input.locale,
    input.sizeKey ?? "default-size",
    input.colorKey ?? "default-color",
  ].join("::")
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [isHydrated, setIsHydrated] = useState(false)

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(CART_STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as CartItem[]
        if (Array.isArray(parsed)) {
          setItems(parsed.filter((item) => item && typeof item.id === "string"))
        }
      }
    } catch {
      window.localStorage.removeItem(CART_STORAGE_KEY)
    } finally {
      setIsHydrated(true)
    }
  }, [])

  useEffect(() => {
    if (!isHydrated) return
    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items))
  }, [isHydrated, items])

  const addItem = useCallback((input: AddCartItemInput) => {
    if (!input.price || input.price <= 0) return

    const id = buildCartItemId(input)

    setItems((prev) => {
      const existing = prev.find((item) => item.id === id)

      if (existing) {
        return prev.map((item) =>
          item.id === id
            ? { ...item, quantity: item.quantity + 1, price: input.price, image: input.image ?? item.image }
            : item,
        )
      }

      return [
        ...prev,
        {
          id,
          groupId: input.groupId,
          slug: input.slug,
          href: input.href,
          name: input.name,
          locale: input.locale,
          price: input.price,
          quantity: 1,
          image: input.image ?? null,
          colorKey: input.colorKey ?? null,
          colorLabel: input.colorLabel ?? null,
          sizeKey: input.sizeKey ?? null,
          sizeLabel: input.sizeLabel ?? null,
        },
      ]
    })

    setIsOpen(true)
  }, [])

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id))
  }, [])

  const setQuantity = useCallback((id: string, quantity: number) => {
    setItems((prev) => {
      if (quantity <= 0) {
        return prev.filter((item) => item.id !== id)
      }

      return prev.map((item) => (item.id === id ? { ...item, quantity } : item))
    })
  }, [])

  const clearCart = useCallback(() => {
    setItems([])
  }, [])

  const openCart = useCallback(() => setIsOpen(true), [])
  const closeCart = useCallback(() => setIsOpen(false), [])

  const itemCount = useMemo(
    () => items.reduce((sum, item) => sum + item.quantity, 0),
    [items],
  )

  const totalPrice = useMemo(
    () => items.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [items],
  )

  const locale = useMemo(() => {
    const ruItem = items.find((item) => item.locale === "ru")
    return ruItem?.locale ?? items[0]?.locale ?? "ru"
  }, [items])

  const value = useMemo<CartContextValue>(
    () => ({
      items,
      itemCount,
      totalPrice,
      locale,
      isOpen,
      openCart,
      closeCart,
      addItem,
      removeItem,
      setQuantity,
      clearCart,
    }),
    [addItem, clearCart, closeCart, isOpen, itemCount, items, locale, openCart, removeItem, setQuantity, totalPrice],
  )

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart() {
  const context = useContext(CartContext)

  if (!context) {
    throw new Error("useCart must be used within CartProvider")
  }

  return context
}
