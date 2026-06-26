"use client"

import { Button } from "@/components/ui/button"
import { ArrowDown, Zap } from "lucide-react"

export function Hero() {
  return (
    <section className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#050505]">
      {/* Animated Background Gradients */}
      <div className="absolute inset-0">
        <div className="absolute left-1/4 top-1/4 h-96 w-96 rounded-full bg-[#ff2d95] opacity-20 blur-[150px]" />
        <div className="absolute bottom-1/4 right-1/4 h-96 w-96 rounded-full bg-[#00f0ff] opacity-20 blur-[150px]" />
        <div className="absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#bf00ff] opacity-10 blur-[100px]" />
      </div>

      {/* Cyber Grid */}
      <div className="cyber-grid absolute inset-0" />
      
      {/* Scanlines */}
      <div className="scanlines absolute inset-0" />

      {/* Content */}
      <div className="relative z-10 mx-auto max-w-6xl px-4 pt-20 text-center">
        {/* Badge */}
        <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-[#ff2d95]/30 bg-[#ff2d95]/10 px-4 py-2">
          <Zap className="h-4 w-4 text-[#ff2d95]" />
          <span className="text-sm font-medium text-[#ff2d95]">Premium Quality Neon</span>
        </div>

        {/* Main Title */}
        <h1 className="mb-2 font-sans text-6xl font-black uppercase tracking-wider md:text-8xl lg:text-9xl">
          <span className="neon-text-pink block">NEON</span>
          <span className="neon-text-cyan block">LAB</span>
        </h1>

        {/* Neon Line Divider */}
        <div className="neon-line mx-auto my-8 w-64" />

        {/* Subtitle */}
        <p className="mx-auto mb-10 max-w-xl text-lg text-[#888899] md:text-xl">
          Premium neon signs for business and home.
          <br />
          <span className="text-[#00f0ff]">Creating light</span> that makes an impression.
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Button 
            size="lg"
            className="neon-glow-pink group relative overflow-hidden border-0 bg-[#ff2d95] px-10 py-7 text-lg font-bold uppercase tracking-wider text-white transition-all duration-300 hover:bg-[#ff2d95] hover:scale-105"
            onClick={() => document.getElementById('catalog')?.scrollIntoView({ behavior: 'smooth' })}
          >
            <span className="relative z-10">Catalog</span>
          </Button>
          <Button 
            size="lg"
            variant="outline"
            className="neon-border-cyan border-2 bg-transparent px-10 py-7 text-lg font-bold uppercase tracking-wider text-[#00f0ff] transition-all duration-300 hover:bg-[#00f0ff]/10 hover:scale-105"
          >
            Order Now
          </Button>
        </div>

        {/* Stats */}
        <div className="mt-20 grid grid-cols-2 gap-8 md:grid-cols-4">
          {[
            { value: "500+", label: "Projects", color: "pink" },
            { value: "12", label: "Years", color: "cyan" },
            { value: "98%", label: "Satisfied", color: "pink" },
            { value: "24/7", label: "Support", color: "cyan" },
          ].map((stat, index) => (
            <div key={index} className="group text-center">
              <div className={`font-sans text-4xl font-black md:text-5xl ${
                stat.color === "pink" ? "neon-text-pink" : "neon-text-cyan"
              } transition-all duration-300 group-hover:scale-110`}>
                {stat.value}
              </div>
              <div className="mt-2 text-sm uppercase tracking-wider text-[#888899]">
                {stat.label}
              </div>
            </div>
          ))}
        </div>

        {/* Scroll Indicator */}
        <div className="mt-20">
          <button 
            onClick={() => document.getElementById('catalog')?.scrollIntoView({ behavior: 'smooth' })}
            className="group flex flex-col items-center gap-2 text-[#888899] transition-colors hover:text-[#00f0ff]"
          >
            <span className="text-xs uppercase tracking-widest">Scroll</span>
            <ArrowDown className="h-5 w-5 animate-bounce" />
          </button>
        </div>
      </div>

      {/* Bottom Gradient */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#050505] to-transparent" />
    </section>
  )
}
