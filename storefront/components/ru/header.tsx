"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Menu, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { RU_SITE_NAV_ITEMS } from "@/components/ru/site-nav"

export function HeaderRU() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [animated, setAnimated] = useState(false)
  const searchParams = useSearchParams()
  const homeHref = `/${searchParams.toString() ? `?${searchParams.toString()}` : ''}`

  useEffect(() => { setAnimated(true) }, [])

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-[#1a1a2e] bg-[#050505]/90 backdrop-blur-xl">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 md:px-6">
        {/* Logo — NEON white + HUB orange */}
        <Link href={homeHref} className="flex items-center gap-2 relative">
          <img src="/neonhub-logo.webp" alt="NeonHub logo" width={36} height={36} className="h-9 w-9 rounded-md" style={{ boxShadow: '0 0 10px rgba(255,144,0,0.55)' }} />
          <span
            className="neon-text-hub-white font-sans text-2xl font-black uppercase tracking-wider md:text-3xl"
            style={{
              animation: animated ? 'neonSlideIn 0.5s cubic-bezier(0.22, 1, 0.36, 1) 0.3s both' : 'none',
              opacity: animated ? undefined : 0,
              zIndex: 1,
            }}
          >
            NEON
          </span>
          <span
            className="font-sans text-2xl font-black uppercase tracking-wider text-[#050505] md:text-3xl ml-1"
            style={{
              backgroundColor: '#FF9000',
              borderRadius: '6px',
              paddingLeft: '10px',
              paddingRight: '10px',
              paddingTop: '2px',
              paddingBottom: '4px',
              boxShadow: '0 0 8px #FF9000, 0 0 20px #FF9000, 0 0 40px rgba(255,144,0,0.6)',
              zIndex: 2,
              animation: animated ? 'hubBounceIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both' : 'none',
              opacity: animated ? undefined : 0,
              display: 'inline-block',
            }}
          >
            HUB
          </span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden items-center gap-8 md:flex">
          {RU_SITE_NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-sm font-bold uppercase tracking-widest text-[#888899] transition-colors hover:text-[#FF9000]"
            >
              {item.label}
            </Link>
          ))}
          <Button
            asChild
            className="neon-glow-hub-orange rounded-none border-2 px-8 py-5 font-bold uppercase tracking-widest text-black transition-all"
            style={{ borderColor: '#FF9000', backgroundColor: '#FF9000' }}
          >
            <Link href="/contacts/#contact-form">Custom order</Link>
          </Button>
        </nav>

        {/* Mobile Menu Button */}
        <button
          className="text-[#f0f0f0] md:hidden"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          aria-label="Menu"
        >
          {isMenuOpen ? <X size={28} /> : <Menu size={28} />}
        </button>
      </div>

      {/* Mobile Navigation */}
      {isMenuOpen && (
        <div className="border-t border-[#1a1a2e] bg-[#050505]/95 backdrop-blur-xl md:hidden">
          <nav className="flex flex-col gap-4 p-6">
            {RU_SITE_NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-sm font-bold uppercase tracking-widest text-[#888899]"
                onClick={() => setIsMenuOpen(false)}
              >
                {item.label}
              </Link>
            ))}
            <Button
              asChild
              className="neon-glow-hub-orange rounded-none border-2 py-5 font-bold uppercase tracking-widest text-black"
              style={{ borderColor: '#FF9000', backgroundColor: '#FF9000' }}
            >
              <Link href="/contacts/#contact-form" onClick={() => setIsMenuOpen(false)}>
                Custom order
              </Link>
            </Button>
          </nav>
        </div>
      )}
    </header>
  )
}
