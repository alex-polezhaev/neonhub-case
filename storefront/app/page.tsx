import type { Metadata } from "next"
import { Suspense } from "react"
import { HeaderRU } from "@/components/ru/header"
import { CategoryShowcaseRU } from "@/components/ru/category-showcase"
import { ContactsRU } from "@/components/ru/contacts"
import { FooterRU } from "@/components/ru/footer"
import { getBusinessInfo } from "@/lib/business"
import { getCommonSeoKeywords } from "@/lib/keywords.server"
import { getRUProducts } from "@/lib/products.server"

const homeKeywords = getCommonSeoKeywords(18)

export const metadata: Metadata = {
  title: "NeonHub — Custom Neon Signs and Ready-Made Designs",
  description: "Custom neon signs and LED neon made to order. Catalog of ready-made designs, individual production, fast shipping, and manufacturer contacts.",
  keywords: homeKeywords,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "NeonHub — Custom Neon Signs and Ready-Made Designs",
    description: "Custom neon signs and LED neon made to order. Catalog of ready-made designs, individual production, and fast shipping.",
    type: "website",
    url: "/",
  },
}

export default function Home() {
  const products = getRUProducts()
  const business = getBusinessInfo()
  const organizationJsonLd = {
    "@context": "https://schema.org",
    "@type": "Store",
    name: business.name,
    legalName: business.legalName,
    url: `${business.siteUrl}/`,
    image: business.faviconUrl,
    telephone: business.phone,
    email: business.email,
    address: business.address,
    sameAs: business.sameAs,
    areaServed: {
      "@type": "Country",
      name: "United States",
    },
  }
  const websiteJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: business.name,
    url: `${business.siteUrl}/`,
    inLanguage: "en-US",
    keywords: homeKeywords.join(", "),
    publisher: {
      "@type": "Organization",
      name: business.name,
      url: `${business.siteUrl}/`,
    },
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#050505]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(websiteJsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(organizationJsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <div className="scanlines pointer-events-none fixed inset-0 z-[100]" />
      <Suspense fallback={null}>
        <HeaderRU />
      </Suspense>
      <Suspense fallback={<div className="min-h-screen bg-[#050505]" />}>
        <CategoryShowcaseRU products={products} />
      </Suspense>
      <ContactsRU />
      <Suspense fallback={null}>
        <FooterRU />
      </Suspense>
    </main>
  )
}
