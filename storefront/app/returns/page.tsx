import type { Metadata } from "next"
import { Suspense } from "react"
import { HeaderRU } from "@/components/ru/header"
import { FooterRU } from "@/components/ru/footer"
import { ReturnsRU } from "@/components/ru/returns"

export const metadata: Metadata = {
  title: "Returns and Exchange | NEON HUB",
  description: "NEON HUB returns and exchange policy: return terms, 2-year warranty, processing times, and contact information.",
  alternates: {
    canonical: "/returns/",
  },
}

export default function ReturnsPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#050505]">
      <div className="scanlines pointer-events-none fixed inset-0 z-[100]" />
      <Suspense fallback={null}>
        <HeaderRU />
      </Suspense>
      <ReturnsRU />
      <Suspense fallback={null}>
        <FooterRU />
      </Suspense>
    </main>
  )
}
