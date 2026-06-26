import Link from "next/link"
import { CreditCard, Package, ShieldCheck, Truck } from "lucide-react"

const cards = [
  {
    icon: CreditCard,
    title: "Payment",
    lines: [
      "Pay on delivery or by an agreed invoice for custom orders.",
      "Contact us before ordering to confirm the terms and get a quote.",
    ],
  },
  {
    icon: Package,
    title: "Production",
    lines: [
      "Ready-made designs ship after the order is confirmed.",
      "Custom signs are quoted and sent to production once the design is approved.",
    ],
  },
  {
    icon: Truck,
    title: "Delivery",
    lines: [
      "We ship nationwide across the United States.",
      "Shipping cost and time depend on the destination and sign size.",
    ],
  },
  {
    icon: ShieldCheck,
    title: "Warranty",
    lines: [
      "Neon signs come with a 2-year warranty.",
      "If you need service or advice after purchase, reach out via our contacts.",
    ],
  },
] as const

const orderSteps = [
  {
    step: "01",
    title: "Request",
    text: "You send a link to a catalog product or a description of your idea via the form, Telegram, or email.",
  },
  {
    step: "02",
    title: "Quote",
    text: "We confirm the sizes, glow color, and mounting, then calculate production and shipping costs.",
  },
  {
    step: "03",
    title: "Confirmation",
    text: "Once the details are agreed, we confirm the order and share an estimated lead time.",
  },
  {
    step: "04",
    title: "Shipping",
    text: "We carefully pack the finished sign and ship it anywhere in the United States.",
  },
] as const

const faqItems = [
  {
    question: "Can I order a sign from my own design?",
    answer: "Yes. We make custom signs from your text, logo, sketch, or reference image.",
  },
  {
    question: "How long does an order take to make?",
    answer: "It depends on the design complexity, size, and current production load. We confirm the exact timing once the order is agreed.",
  },
  {
    question: "How is the final price determined?",
    answer: "Price depends on the dimensions, number of elements, color, backing type, and delivery address, so we provide an exact quote after a short brief.",
  },
  {
    question: "Is there a warranty after purchase?",
    answer: "Yes, signs come with a 2-year warranty. If you have any questions about setup or use, you can reach us via our contacts.",
  },
] as const

export function DeliveryPaymentRU() {
  return (
    <section className="relative overflow-hidden bg-[#050505] pb-24 pt-32">
      <div className="absolute inset-0">
        <div className="absolute left-0 top-24 h-[320px] w-[320px] rounded-full bg-[#FF9000] opacity-10 blur-[140px]" />
        <div className="absolute bottom-0 right-0 h-[360px] w-[360px] rounded-full bg-white opacity-5 blur-[160px]" />
      </div>
      <div className="cyber-grid absolute inset-0" />

      <div className="relative z-10 mx-auto max-w-7xl px-4 md:px-6">
        <div className="max-w-3xl">
          <p className="text-sm font-bold uppercase tracking-[0.3em] text-[#FF9000]">
            Order terms
          </p>
          <h1 className="mt-4 font-tektur text-4xl font-bold uppercase tracking-wide text-[#f0f0f0] md:text-6xl">
            Delivery & Payment
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-7 text-[#9a9aac] md:text-lg">
            Here are the basic terms for payment, production, delivery, and warranty.
            Exact timing and cost are confirmed once the order is agreed.
          </p>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-2">
          {cards.map(({ icon: Icon, title, lines }) => (
            <article
              key={title}
              className="border-2 border-[#1a1a2e] bg-[#0a0a0f]/80 p-6 backdrop-blur-sm"
            >
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center border-2 border-[#FF9000] bg-[rgba(255,144,0,0.08)]">
                  <Icon className="h-6 w-6 text-[#FF9000]" />
                </div>
                <h2 className="font-tektur text-2xl font-bold uppercase tracking-wide text-[#f0f0f0]">
                  {title}
                </h2>
              </div>
              <div className="mt-5 space-y-3 text-sm leading-7 text-[#b7b7c9] md:text-base">
                {lines.map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </div>
            </article>
          ))}
        </div>

        <section className="mt-20">
          <div className="max-w-2xl">
            <h2 className="font-tektur text-3xl font-bold uppercase tracking-wide text-[#f0f0f0] md:text-4xl">
              How an <span className="text-[#FF9000]">order</span> works
            </h2>
            <p className="mt-4 text-base leading-7 text-[#9a9aac]">
              To avoid surprises around timing, payment, and shipping, here is our simple workflow.
            </p>
          </div>

          <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            {orderSteps.map((item) => (
              <article
                key={item.step}
                className="border-2 border-[#1a1a2e] bg-[#0a0a0f]/80 p-6 backdrop-blur-sm"
              >
                <p className="text-sm font-bold uppercase tracking-[0.3em] text-[#FF9000]">
                  {item.step}
                </p>
                <h3 className="mt-4 font-tektur text-2xl font-bold uppercase tracking-wide text-[#f0f0f0]">
                  {item.title}
                </h3>
                <p className="mt-4 text-sm leading-7 text-[#b7b7c9] md:text-base">
                  {item.text}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-20">
          <div className="max-w-2xl">
            <h2 className="font-tektur text-3xl font-bold uppercase tracking-wide text-[#f0f0f0] md:text-4xl">
              Frequently asked <span className="text-[#FF9000]">questions</span>
            </h2>
            <p className="mt-4 text-base leading-7 text-[#9a9aac]">
              Quick answers to common questions before ordering a neon sign.
            </p>
          </div>

          <div className="mt-10 grid gap-6 md:grid-cols-2">
            {faqItems.map((item) => (
              <article
                key={item.question}
                className="border-2 border-[#1a1a2e] bg-[#0a0a0f]/80 p-6 backdrop-blur-sm"
              >
                <h3 className="font-tektur text-2xl font-bold uppercase tracking-wide text-[#f0f0f0]">
                  {item.question}
                </h3>
                <p className="mt-4 text-sm leading-7 text-[#b7b7c9] md:text-base">
                  {item.answer}
                </p>
              </article>
            ))}
          </div>
        </section>

        <div className="mt-12 flex flex-wrap gap-4">
          <Link
            href="/catalog/"
            className="border-2 border-[#FF9000] bg-[#FF9000] px-6 py-3 text-sm font-bold uppercase tracking-widest text-black transition-colors hover:bg-transparent hover:text-[#FF9000]"
          >
            Go to catalog
          </Link>
          <Link
            href="/contacts/#contact-form"
            className="border-2 border-[#1a1a2e] px-6 py-3 text-sm font-bold uppercase tracking-widest text-[#f0f0f0] transition-colors hover:border-[#FF9000] hover:text-[#FF9000]"
          >
            Ask a question
          </Link>
        </div>
      </div>
    </section>
  )
}
