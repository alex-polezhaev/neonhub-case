"use client"

import { useState } from "react"
import { ANALYTICS_GOALS } from "@/lib/analytics-goals"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Mail, MapPin, Phone, Send } from "lucide-react"
import { ymGoal } from "@/lib/metrika"
import { cn } from "@/lib/utils"
import { vkGoal } from "@/lib/vk-pixel"

const CONTACT_OPTIONS = [
  { id: 'tg', label: 'Telegram', icon: '/icons/telegram_3670070.svg' },
]

type FormErrors = Partial<Record<"name" | "phone" | "message", string>>

const contactFacts = [
  {
    title: "Fast response",
    text: "We usually reply in messengers and by email within one business day.",
  },
  {
    title: "Nationwide service",
    text: "We accept orders from across the United States.",
  },
  {
    title: "Tailored quote",
    text: "We'll advise on sizes, glow color, mounting and price before the order starts.",
  },
] as const

export function ContactsRU({
  showMap = false,
  headingTag = "h2",
}: {
  showMap?: boolean
  headingTag?: "h1" | "h2"
}) {
  const [formData, setFormData] = useState({ name: "", message: "" })
  const [phoneDigits, setPhoneDigits] = useState("")
  const [contact, setContact] = useState("")
  const [errors, setErrors] = useState<FormErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)

  const getFieldClassName = (hasError?: boolean) =>
    cn(
      "rounded-none border-2 bg-[#0f0f1a] text-[#f0f0f0] placeholder:text-[#888899] focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 transition-colors focus-visible:border-[#FF9000]",
      hasError ? "border-[#ff5c5c]" : "border-[#1a1a2e]",
    )

  const getValidationErrors = ({
    nextFormData = formData,
    nextPhoneDigits = phoneDigits,
    nextContact = contact,
  }: {
    nextFormData?: typeof formData
    nextPhoneDigits?: string
    nextContact?: string
  } = {}): FormErrors => {
    const nextErrors: FormErrors = {}
    const name = nextFormData.name.trim()
    const message = nextFormData.message.trim()

    if (!nextPhoneDigits) {
      nextErrors.phone = "Enter your phone number"
    }

    if (nextPhoneDigits && nextPhoneDigits.length < 10) {
      nextErrors.phone = "Enter the full phone number"
    }

    if (name && name.length < 2) {
      nextErrors.name = "Name must be at least 2 characters"
    }

    if (message && message.length < 10) {
      nextErrors.message = "Add a few more details"
    }

    return nextErrors
  }

  const validateFields = (
    fieldNames: Array<keyof FormErrors>,
    overrides?: {
      nextFormData?: typeof formData
      nextPhoneDigits?: string
      nextContact?: string
    },
  ) => {
    const nextErrors = getValidationErrors(overrides)
    setErrors((prev) => {
      const merged = { ...prev }
      for (const fieldName of fieldNames) {
        const error = nextErrors[fieldName]
        if (error) {
          merged[fieldName] = error
        } else {
          delete merged[fieldName]
        }
      }
      return merged
    })
  }

  const formatPhone = (digits: string) => {
    if (digits.length === 0) return ""
    let result = "+1 ("
    result += digits.slice(0, 3)
    if (digits.length >= 3) result += ") " + digits.slice(3, 6)
    if (digits.length >= 6) result += "-" + digits.slice(6, 10)
    return result
  }

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, "").replace(/^1/, "").slice(0, 10)
    setPhoneDigits(digits)
    if (errors.phone) {
      validateFields(["phone"], { nextPhoneDigits: digits })
    }
  }

  const handlePhoneKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      e.preventDefault()
      const nextDigits = phoneDigits.slice(0, -1)
      setPhoneDigits(nextDigits)
      if (errors.phone) {
        validateFields(["phone"], { nextPhoneDigits: nextDigits })
      }
    }
  }

  const phone = formatPhone(phoneDigits)
  const HeadingTag = headingTag

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isSubmitting) return
    const nextErrors = getValidationErrors()
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    const payload = {
      type: 'quote_request',
      name: formData.name.trim(),
      phone,
      contact,
      message: formData.message.trim(),
      site: 'neonhub.example',
      timestamp: new Date().toISOString(),
    }

    setIsSubmitting(true)
    try {
      await fetch(process.env.NEXT_PUBLIC_ORDER_WEBHOOK_URL as string, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      setIsSubmitted(true)
      setFormData({ name: "", message: "" })
      setPhoneDigits("")
      setContact("")
      setErrors({})
      ymGoal(ANALYTICS_GOALS.submitContactForm, {
        source: "contacts_ru",
        contact_method: contact,
        has_message: Boolean(payload.message),
      })
      vkGoal(ANALYTICS_GOALS.submitContactForm, {
        source: "contacts_ru",
        contact_method: contact,
        has_message: Boolean(payload.message),
      })
    } catch (error) {
      console.error('Failed to submit form:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section id="contacts" className="relative min-h-screen overflow-hidden bg-[#050505] py-24">
      <div className="absolute inset-0">
        <div className="absolute bottom-0 left-1/4 h-[400px] w-[400px] rounded-full opacity-10 blur-[150px]"
          style={{ backgroundColor: '#FF9000' }} />
        <div className="absolute right-1/4 top-1/4 h-[300px] w-[300px] rounded-full bg-white opacity-5 blur-[120px]" />
      </div>
      <div className="cyber-grid absolute inset-0" />

      <div className="relative z-10 mx-auto max-w-7xl px-4 md:px-6">
        <div className="mb-16 text-center">
          <div className="mx-auto mb-8 w-64 h-px" style={{ background: 'linear-gradient(90deg, transparent, #FF9000, transparent)' }} />
          <HeadingTag className="font-tektur text-3xl font-bold uppercase tracking-wider text-[#f0f0f0] md:text-4xl">
            <span style={{ color: '#FF9000' }}>Get in touch</span> with us
          </HeadingTag>
          <p className="mt-4 text-lg text-[#888899]">
            {showMap
              ? "Contacts, address, company details and a quote request form for your neon sign."
              : "Message us to place an order or get a consultation"}
          </p>
        </div>

        {showMap && (
          <div className="mb-12 grid gap-4 md:grid-cols-3">
            {contactFacts.map((item) => (
              <article
                key={item.title}
                className="border-2 border-[#1a1a2e] bg-[#0a0a0f]/70 p-5 backdrop-blur-sm"
              >
                <h2 className="font-tektur text-xl font-bold uppercase tracking-wide text-[#f0f0f0]">
                  {item.title}
                </h2>
                <p className="mt-3 text-sm leading-7 text-[#9a9aac]">
                  {item.text}
                </p>
              </article>
            ))}
          </div>
        )}

        <div className="grid gap-12 lg:grid-cols-2">
          <div className="space-y-6">
            <div className="border-2 border-[#1a1a2e] bg-[#0a0a0f]/80 p-6 backdrop-blur-sm transition-all duration-300"
              style={{ ['--hover-shadow' as string]: '0 0 20px rgba(255,144,0,0.3)' }}>
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center border-2 border-white/20 bg-white/5">
                  <Mail className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="text-sm uppercase tracking-wider text-[#888899]">Email</p>
                  <a href="mailto:hello@neonhub.example" className="text-xl font-bold text-[#f0f0f0] transition-colors"
                    onMouseEnter={e => (e.currentTarget.style.color = '#FF9000')}
                    onMouseLeave={e => (e.currentTarget.style.color = '')}>
                    hello@neonhub.example
                  </a>
                </div>
              </div>
            </div>

            <div className="border-2 border-[#1a1a2e] bg-[#0a0a0f]/80 p-6 backdrop-blur-sm transition-all duration-300">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center border-2 border-white/20 bg-white/5">
                  <Phone className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="text-sm uppercase tracking-wider text-[#888899]">Phone</p>
                  <a href="tel:+15550100100" className="text-xl font-bold text-[#f0f0f0] transition-colors"
                    onMouseEnter={e => (e.currentTarget.style.color = '#FF9000')}
                    onMouseLeave={e => (e.currentTarget.style.color = '')}>
                    +1 (555) 010-0100
                  </a>
                </div>
              </div>
            </div>

            <div className="border-2 border-[#1a1a2e] bg-[#0a0a0f]/80 p-6 backdrop-blur-sm">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center border-2 border-white/20 bg-white/5">
                  <MapPin className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="text-sm uppercase tracking-wider text-[#888899]">Address</p>
                  <p className="text-xl font-bold text-[#f0f0f0]">United States</p>
                </div>
              </div>
            </div>

            <div className="border-2 border-[#1a1a2e] bg-[#0a0a0f]/80 p-6 backdrop-blur-sm">
              <div className="space-y-2">
                <p className="text-sm uppercase tracking-wider text-[#888899]">Company</p>
                <p className="text-lg font-bold text-[#f0f0f0]">NeonHub</p>
              </div>
            </div>
          </div>
          <div id="contact-form" className="border-2 border-[#1a1a2e] bg-[#0a0a0f]/80 p-8 backdrop-blur-sm">
            <h3 className="mb-8 font-tektur text-2xl font-bold uppercase tracking-wider text-[#f0f0f0]">
              Get a <span style={{ color: '#FF9000' }}>quote</span>
            </h3>
            <form onSubmit={handleSubmit} className="space-y-5">
              <Input
                placeholder="Your name"
                value={formData.name}
                onChange={(e) => {
                  const nextFormData = { ...formData, name: e.target.value }
                  setFormData(nextFormData)
                  if (errors.name) {
                    validateFields(["name"], { nextFormData })
                  }
                }}
                onBlur={() => validateFields(["name"])}
                aria-invalid={Boolean(errors.name)}
                className={cn(getFieldClassName(Boolean(errors.name)), "py-6")}
              />
              {errors.name && <p className="mt-2 text-sm text-[#ff8d8d]">{errors.name}</p>}
              <Input
                placeholder="+1 (___) ___-____"
                value={phone}
                onChange={handlePhoneChange}
                onKeyDown={handlePhoneKeyDown}
                onBlur={() => validateFields(["phone"])}
                aria-invalid={Boolean(errors.phone)}
                className={cn(getFieldClassName(Boolean(errors.phone)), "py-6")}
              />
              {errors.phone && <p className="mt-2 text-sm text-[#ff8d8d]">{errors.phone}</p>}
              <div>
                <p className="mb-2 text-xs uppercase tracking-wider text-[#888899]">Preferred contact</p>
                <div className="flex flex-wrap gap-2">
                  {CONTACT_OPTIONS.map(({ id, label, icon }) => {
                    const active = contact === id
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => {
                          const nextContact = contact === id ? "" : id
                          setContact(nextContact)
                          if (errors.phone) {
                            validateFields(["phone"], { nextContact })
                          }
                        }}
                        className="flex items-center gap-1.5 border-2 px-3 py-2 text-xs font-bold uppercase tracking-wide transition-all"
                        style={active ? {
                          borderColor: '#FF9000',
                          backgroundColor: 'rgba(255,144,0,0.15)',
                          color: '#FF9000',
                        } : {
                          borderColor: '#1a1a2e',
                          backgroundColor: 'transparent',
                          color: '#888899',
                        }}
                      >
                        {icon ? (
                          <img src={icon} alt={label} className="h-4 w-4 shrink-0" />
                        ) : (
                          <span className="text-sm shrink-0">📞</span>
                        )}
                        <span className="whitespace-nowrap">{label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
              <Textarea
                placeholder="Describe your project or ask a question..."
                rows={5}
                value={formData.message}
                onChange={(e) => {
                  const nextFormData = { ...formData, message: e.target.value }
                  setFormData(nextFormData)
                  if (errors.message) {
                    validateFields(["message"], { nextFormData })
                  }
                }}
                onBlur={() => validateFields(["message"])}
                aria-invalid={Boolean(errors.message)}
                className={cn(getFieldClassName(Boolean(errors.message)), "resize-none")}
              />
              {errors.message && <p className="mt-2 text-sm text-[#ff8d8d]">{errors.message}</p>}
              {isSubmitted ? (
                <div className="py-4 text-center text-lg font-bold" style={{ color: '#FF9000' }}>
                  Thank you! We'll get back to you shortly.
                </div>
              ) : (
                <Button
                  type="submit"
                  size="lg"
                  disabled={isSubmitting}
                  className="neon-glow-hub-orange w-full rounded-none border-2 py-7 font-bold uppercase tracking-widest text-black transition-all disabled:opacity-50"
                  style={{ borderColor: '#FF9000', backgroundColor: '#FF9000' }}
                  onMouseEnter={e => {
                    const el = e.currentTarget as HTMLButtonElement
                    el.style.backgroundColor = 'transparent'
                    el.style.color = '#FF9000'
                  }}
                  onMouseLeave={e => {
                    const el = e.currentTarget as HTMLButtonElement
                    el.style.backgroundColor = '#FF9000'
                    el.style.color = 'white'
                  }}
                >
                  <Send size={18} className="mr-2" />
                  {isSubmitting ? 'Sending...' : 'Send request'}
                </Button>
              )}
            </form>
          </div>
        </div>
      </div>
    </section>
  )
}
