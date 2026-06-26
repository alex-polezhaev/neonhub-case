"use client"

import { useState } from "react"
import Link from "next/link"
import { Menu, X } from "lucide-react"
import { Button } from "@/components/ui/button"

export function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-[#1a1a2e] bg-[#050505]/90 backdrop-blur-xl">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 md:px-6">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-1">
          <span className="neon-text-pink font-sans text-2xl font-black uppercase tracking-wider md:text-3xl">
            NEON
          </span>
          <span className="neon-text-cyan font-sans text-2xl font-black uppercase tracking-wider md:text-3xl">
            LAB
          </span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden items-center gap-8 md:flex">
          <a
            href="/#catalog"
            className="text-sm font-bold uppercase tracking-widest text-[#888899] transition-all hover:text-[#ff2d95] hover:neon-text-pink"
          >
            Catalog
          </a>
          <a
            href="/#contacts"
            className="text-sm font-bold uppercase tracking-widest text-[#888899] transition-all hover:text-[#00f0ff] hover:neon-text-cyan"
          >
            Contact
          </a>
          <Button
            onClick={() => window.location.href = "/#contacts"}
            className="neon-glow-pink rounded-none border-2 border-[#ff2d95] bg-[#ff2d95] px-8 py-5 font-bold uppercase tracking-widest text-white transition-all hover:bg-transparent hover:text-[#ff2d95]"
          >
            Order Custom
          </Button>
        </nav>

        {/* Mobile Menu Button */}
        <button
          className="text-[#f0f0f0] md:hidden"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          aria-label="Toggle menu"
        >
          {isMenuOpen ? <X size={28} /> : <Menu size={28} />}
        </button>
      </div>

      {/* Mobile Navigation */}
      {isMenuOpen && (
        <div className="border-t border-[#1a1a2e] bg-[#050505]/95 backdrop-blur-xl md:hidden">
          <nav className="flex flex-col gap-4 p-6">
            <a
              href="/#catalog"
              className="text-sm font-bold uppercase tracking-widest text-[#888899] transition-colors hover:text-[#ff2d95]"
              onClick={() => setIsMenuOpen(false)}
            >
              Catalog
            </a>
            <a
              href="/#contacts"
              className="text-sm font-bold uppercase tracking-widest text-[#888899] transition-colors hover:text-[#00f0ff]"
              onClick={() => setIsMenuOpen(false)}
            >
              Contact
            </a>
            <Button
              onClick={() => { setIsMenuOpen(false); window.location.href = "/#contacts" }}
              className="neon-glow-pink rounded-none border-2 border-[#ff2d95] bg-[#ff2d95] py-5 font-bold uppercase tracking-widest text-white"
            >
              Order Custom
            </Button>
          </nav>
        </div>
      )}
    </header>
  )
}
