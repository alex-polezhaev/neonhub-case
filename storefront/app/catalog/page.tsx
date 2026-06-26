import type { Metadata } from "next"
import { Suspense } from "react"
import { Catalog } from "@/components/catalog"
import { HeaderRU } from "@/components/ru/header"
import { FooterRU } from "@/components/ru/footer"
import { getCommonSeoKeywords } from "@/lib/keywords.server"
import { getCatalogProductGroupCount } from "@/lib/products.server"

export const metadata: Metadata = {
  title: "Neon Signs Catalog | NEON HUB",
  description: "Catalog of ready-made NEON HUB neon signs. Business signage, home and decor, bar and events, custom logos, and quotes with fast shipping.",
  keywords: getCommonSeoKeywords(16),
  alternates: {
    canonical: "/catalog/",
  },
  openGraph: {
    title: "Neon Signs Catalog | NEON HUB",
    description: "Catalog of ready-made NEON HUB neon signs for business, home, photo zones, and interiors with fast shipping.",
    type: "website",
    url: "/catalog/",
  },
}

export default function CatalogPage() {
  const totalProducts = getCatalogProductGroupCount("en")

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#050505]">
      <div className="scanlines pointer-events-none fixed inset-0 z-[100]" />
      <Suspense fallback={null}>
        <HeaderRU />
      </Suspense>
      <div className="relative z-10 mx-auto max-w-7xl px-4 pb-4 pt-32 md:px-6">
        <h1 className="font-tektur text-4xl font-bold uppercase tracking-wide text-[#f0f0f0] md:text-6xl">
          Catalog <span className="text-[#FF9000]">NEON HUB</span>
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-[#9a9aac] md:text-lg">
          Ready-made neon sign designs for home, business, events, cafes, and interiors.
        </p>
        <p className="mt-4 text-sm font-bold uppercase tracking-[0.24em] text-[#FF9000] md:text-base">
          Total models: {totalProducts}
        </p>
      </div>
      <Catalog locale="en" activeCategoryId="all" compactTop />
      <Suspense fallback={null}>
        <FooterRU />
      </Suspense>
    </main>
  )
}
