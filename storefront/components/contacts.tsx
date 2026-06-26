"use client"

import { useState } from "react"
import { ANALYTICS_GOALS } from "@/lib/analytics-goals"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Mail, MapPin, Send } from "lucide-react"
import { ymGoal } from "@/lib/metrika"
import { vkGoal } from "@/lib/vk-pixel"

export function Contacts() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    message: "",
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isSubmitting || !formData.email) return
    
    setIsSubmitting(true)
    
    try {
      await fetch(process.env.NEXT_PUBLIC_ORDER_WEBHOOK_URL as string, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'quote_request',
          name: formData.name,
          email: formData.email,
          message: formData.message,
          companyEmail: 'hello@neonhub.example',
          companyAddress: 'New Hampshire, USA',
          timestamp: new Date().toISOString(),
        }),
      })
      
      setIsSubmitted(true)
      setFormData({ name: "", email: "", message: "" })
      ymGoal(ANALYTICS_GOALS.submitContactForm, {
        source: "contacts_en",
        has_message: Boolean(formData.message.trim()),
      })
      vkGoal(ANALYTICS_GOALS.submitContactForm, {
        source: "contacts_en",
        has_message: Boolean(formData.message.trim()),
      })
    } catch (error) {
      console.error('Failed to submit form:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section id="contacts" className="relative min-h-screen overflow-hidden bg-[#050505] py-24">
      {/* Background Effects */}
      <div className="absolute inset-0">
        <div className="absolute bottom-0 left-1/4 h-[400px] w-[400px] rounded-full bg-[#ff2d95] opacity-10 blur-[150px]" />
        <div className="absolute right-1/4 top-1/4 h-[300px] w-[300px] rounded-full bg-[#00f0ff] opacity-10 blur-[120px]" />
      </div>
      
      {/* Cyber Grid */}
      <div className="cyber-grid absolute inset-0" />

      <div className="relative z-10 mx-auto max-w-7xl px-4 md:px-6">
        {/* Section Header with Brand */}
        <div className="mb-16 text-center">
          <h2 className="neon-flicker mb-4 font-sans text-4xl font-black uppercase tracking-wider sm:text-6xl md:text-7xl lg:text-8xl">
            <span className="neon-text-pink">NEON</span>
            <span className="neon-text-cyan ml-2 sm:ml-4">LAB</span>
          </h2>
          <div className="neon-line mx-auto mt-6 w-64" />
          <h3 className="mt-8 font-sans text-3xl font-bold uppercase tracking-wider text-[#f0f0f0] md:text-4xl">
            <span className="text-[#00f0ff]">CONTACT</span> US
          </h3>
          <p className="mt-4 text-lg text-[#888899]">
            Get in touch for orders or consultation
          </p>
        </div>

        <div className="grid gap-12 lg:grid-cols-2">
          {/* Contact Info */}
          <div className="space-y-6">
            {/* Contact Cards */}
            <div className="card-glow-cyan group border-2 border-[#1a1a2e] bg-[#0a0a0f]/80 p-6 backdrop-blur-sm transition-all duration-300">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center border-2 border-[#00f0ff] bg-[#00f0ff]/10">
                  <Mail className="h-6 w-6 text-[#00f0ff]" />
                </div>
                <div>
                  <p className="text-sm uppercase tracking-wider text-[#888899]">Email</p>
                  <a href="mailto:hello@neonhub.example" className="text-xl font-bold text-[#f0f0f0] transition-colors hover:text-[#00f0ff]">
                    hello@neonhub.example
                  </a>
                </div>
              </div>
            </div>

            <div className="card-glow-pink group border-2 border-[#1a1a2e] bg-[#0a0a0f]/80 p-6 backdrop-blur-sm transition-all duration-300">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center border-2 border-[#ff2d95] bg-[#ff2d95]/10">
                  <MapPin className="h-6 w-6 text-[#ff2d95]" />
                </div>
                <div>
                  <p className="text-sm uppercase tracking-wider text-[#888899]">Address</p>
                  <p className="text-xl font-bold text-[#f0f0f0]">
                    New Hampshire, USA
                  </p>
                </div>
              </div>
            </div>

          </div>

          {/* Contact Form */}
          <div className="border-2 border-[#1a1a2e] bg-[#0a0a0f]/80 p-8 backdrop-blur-sm">
            <h3 className="mb-8 font-sans text-2xl font-bold uppercase tracking-wider text-[#f0f0f0]">
              Get a <span className="text-[#ff2d95]">Quote</span>
            </h3>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <Input
                  placeholder="Your name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="rounded-none border-2 border-[#1a1a2e] bg-[#0f0f1a] py-6 text-[#f0f0f0] placeholder:text-[#888899] focus:border-[#ff2d95] focus:ring-0"
                />
              </div>
              <div>
                <Input
                  type="email"
                  placeholder="Email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="rounded-none border-2 border-[#1a1a2e] bg-[#0f0f1a] py-6 text-[#f0f0f0] placeholder:text-[#888899] focus:border-[#00f0ff] focus:ring-0"
                />
              </div>
              <div>
                <Textarea
                  placeholder="Describe your project or ask a question..."
                  rows={5}
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  className="resize-none rounded-none border-2 border-[#1a1a2e] bg-[#0f0f1a] text-[#f0f0f0] placeholder:text-[#888899] focus:border-[#00f0ff] focus:ring-0"
                />
              </div>
              {isSubmitted ? (
                <div className="py-4 text-center text-lg font-bold text-[#00f0ff]">
                  Thank you! We&apos;ll contact you soon.
                </div>
              ) : (
                <Button 
                  type="submit"
                  size="lg"
                  disabled={isSubmitting}
                  className="neon-glow-pink w-full rounded-none border-2 border-[#ff2d95] bg-[#ff2d95] py-7 font-bold uppercase tracking-widest text-white transition-all hover:bg-transparent hover:text-[#ff2d95] disabled:opacity-50"
                >
                  <Send size={18} className="mr-2" />
                  {isSubmitting ? 'Sending...' : 'Send Request'}
                </Button>
              )}
            </form>
          </div>
        </div>
      </div>
    </section>
  )
}
