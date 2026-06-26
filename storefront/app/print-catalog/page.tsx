import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { PrintCatalogBuilder } from "@/components/print-catalog-builder"
import {
  getPrintCatalogContactLinks,
  getPrintCatalogProducts,
  isPrintCatalogEnabled,
} from "@/lib/print-catalog"

export const metadata: Metadata = {
  title: "Print Catalog Builder | NEON HUB",
  description: "Dev-only editor for print catalog pages.",
  robots: {
    index: false,
    follow: false,
  },
}

export default function PrintCatalogPage() {
  if (!isPrintCatalogEnabled()) {
    notFound()
  }

  const products = getPrintCatalogProducts()
  const contactLinks = getPrintCatalogContactLinks()

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#050505]">
      <div className="scanlines pointer-events-none fixed inset-0 z-[1]" />
      <PrintCatalogBuilder
        initialProducts={products}
        contactLinks={contactLinks}
      />
    </main>
  )
}
