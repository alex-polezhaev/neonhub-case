"use client"
import Link from "next/link"
import { RU_SITE_NAV_ITEMS } from "@/components/ru/site-nav"

export function FooterRU() {
  return (
    <footer className="border-t border-[#1a1a2e] bg-[#050505] py-10">
      <div className="mx-auto max-w-7xl px-4 md:px-6">
        <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
          <div className="flex items-center gap-2">
            <img src="/neonhub-logo.webp" alt="NeonHub logo" width={28} height={28} className="h-7 w-7 rounded-md" style={{ boxShadow: '0 0 8px rgba(255,144,0,0.5)' }} />
            <span className="neon-text-hub-white font-sans text-xl font-black uppercase tracking-wider">
              NEON
            </span>
            <span className="hub-badge font-sans text-xl font-black uppercase tracking-wider text-[#050505] px-2 py-0.5 ml-1"
              style={{ backgroundColor: '#FF9000', borderRadius: '5px', boxShadow: '0 0 8px #FF9000, 0 0 20px #FF9000, 0 0 40px rgba(255,144,0,0.6)' }}>
              HUB
            </span>
          </div>

          <nav className="flex flex-wrap items-center justify-center gap-4 text-xs font-bold uppercase tracking-widest text-[#888899]">
            {RU_SITE_NAV_ITEMS.map((item) => (
              <Link key={item.href} href={item.href} className="transition-colors hover:text-[#f0f0f0]">
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Copyright */}
          <p className="text-sm text-[#888899]">
            &copy; {new Date().getFullYear()} NEON HUB. No rights reserved yet.
          </p>
        </div>

      </div>
    </footer>
  )
}
