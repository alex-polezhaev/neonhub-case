"use client"

import { Button } from "@/components/ui/button"
import { ArrowDown, Zap } from "lucide-react"

export function HeroRU() {
  return (
    <section className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#050505]">
      {/* Background */}
      <div className="absolute inset-0">
        <div className="absolute left-1/4 top-1/4 h-96 w-96 rounded-full opacity-20 blur-[150px]"
          style={{ backgroundColor: '#FF9000' }} />
        <div className="absolute bottom-1/4 right-1/4 h-96 w-96 rounded-full bg-white opacity-5 blur-[150px]" />
        <div className="absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-10 blur-[100px]"
          style={{ backgroundColor: '#FF6600' }} />
      </div>

      <div className="cyber-grid absolute inset-0" />
      <div className="scanlines absolute inset-0" />

      <div className="relative z-10 mx-auto max-w-6xl px-4 pt-20 text-center">
        {/* Badge */}
        <div className="mb-8 inline-flex items-center gap-2 rounded-full border px-4 py-2"
          style={{ borderColor: 'rgba(255,144,0,0.3)', backgroundColor: 'rgba(255,144,0,0.1)' }}>
          <Zap className="h-4 w-4" style={{ color: '#FF9000' }} />
          <span className="text-sm font-medium" style={{ color: '#FF9000' }}>Premium neon signs</span>
        </div>

        {/* Main Title */}
        <h1 className="mb-2 font-tektur text-6xl font-black uppercase tracking-wider md:text-8xl lg:text-9xl">
          <span className="block text-white" style={{ textShadow: '0 0 20px rgba(255,255,255,0.8), 0 0 40px rgba(255,255,255,0.4)' }}>
            NEON
          </span>
          <span className="block" style={{ color: '#FF9000', textShadow: '0 0 20px rgba(255,144,0,0.9), 0 0 50px rgba(255,144,0,0.5)' }}>
            HUB
          </span>
        </h1>

        <div className="neon-line mx-auto my-8 w-64" style={{ backgroundColor: '#FF9000', boxShadow: '0 0 10px #FF9000' }} />

        <p className="mx-auto mb-10 max-w-xl text-lg text-[#888899] md:text-xl">
          Neon signs for business and home.
          <br />
          <span style={{ color: '#FF9000' }}>Light</span> that you'll remember.
        </p>

        {/* CTA */}
        <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Button
            size="lg"
            className="neon-glow-hub-orange group relative overflow-hidden border-0 px-10 py-7 text-lg font-bold uppercase tracking-wider text-black transition-all duration-300 hover:scale-105"
            style={{ backgroundColor: '#FF9000' }}
            onClick={() => document.getElementById('catalog')?.scrollIntoView({ behavior: 'smooth' })}
          >
            Catalog
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="border-2 bg-transparent px-10 py-7 text-lg font-bold uppercase tracking-wider text-white transition-all duration-300 hover:scale-105"
            style={{ borderColor: 'white', boxShadow: '0 0 5px #fff, 0 0 15px #fff, 0 0 30px rgba(255,255,255,0.4)' }}
            onClick={() => document.getElementById('contacts')?.scrollIntoView({ behavior: 'smooth' })}
          >
            Order now
          </Button>
        </div>

        {/* Stats */}
        <div className="mt-20 grid grid-cols-2 gap-8 md:grid-cols-4">
          {[
            { value: "500+", label: "Projects", orange: true },
            { value: "12", label: "Years", orange: false },
            { value: "98%", label: "Satisfied", orange: true },
            { value: "24/7", label: "Support", orange: false },
          ].map((stat, index) => (
            <div key={index} className="group text-center">
              <div className="font-tektur text-4xl font-black md:text-5xl transition-all duration-300 group-hover:scale-110"
                style={{ color: stat.orange ? '#FF9000' : 'white', textShadow: stat.orange ? '0 0 15px rgba(255,144,0,0.8)' : '0 0 15px rgba(255,255,255,0.6)' }}>
                {stat.value}
              </div>
              <div className="mt-2 text-sm uppercase tracking-wider text-[#888899]">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Scroll */}
        <div className="mt-20">
          <button
            onClick={() => document.getElementById('catalog')?.scrollIntoView({ behavior: 'smooth' })}
            className="group flex flex-col items-center gap-2 text-[#888899] transition-colors hover:text-white"
          >
            <span className="text-xs uppercase tracking-widest">Scroll</span>
            <ArrowDown className="h-5 w-5 animate-bounce" />
          </button>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#050505] to-transparent" />
    </section>
  )
}
