import type { Metadata } from "next"
import { Suspense } from "react"
import { ContactsRU } from "@/components/ru/contacts"
import { HeaderRU } from "@/components/ru/header"
import { FooterRU } from "@/components/ru/footer"

export const metadata: Metadata = {
  title: "Contacts | NEON HUB",
  description: "NEON HUB contacts: messengers, email, address, and a request form to get a quote for your neon sign.",
  alternates: {
    canonical: "/contacts/",
  },
}

export default function ContactsPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#050505]">
      <div className="scanlines pointer-events-none fixed inset-0 z-[100]" />
      <Suspense fallback={null}>
        <HeaderRU />
      </Suspense>
      <ContactsRU showMap headingTag="h1" />
      <Suspense fallback={null}>
        <FooterRU />
      </Suspense>
    </main>
  )
}
