import type { Metadata } from "next"
import { Suspense } from "react"
import { DeliveryPaymentRU } from "@/components/ru/delivery-payment"
import { HeaderRU } from "@/components/ru/header"
import { FooterRU } from "@/components/ru/footer"

export const metadata: Metadata = {
  title: "Delivery and Payment | NEON HUB",
  description: "Payment, shipping, production, and warranty terms for NEON HUB neon sign orders.",
  alternates: {
    canonical: "/delivery-payment/",
  },
}

export default function DeliveryPaymentPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#050505]">
      <div className="scanlines pointer-events-none fixed inset-0 z-[100]" />
      <Suspense fallback={null}>
        <HeaderRU />
      </Suspense>
      <DeliveryPaymentRU />
      <Suspense fallback={null}>
        <FooterRU />
      </Suspense>
    </main>
  )
}
