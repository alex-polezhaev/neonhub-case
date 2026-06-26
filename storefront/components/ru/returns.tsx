"use client"

export function ReturnsRU() {
  return (
    <section className="relative z-10 mx-auto max-w-4xl px-4 pb-24 pt-32 md:px-6">
      <p className="text-sm font-bold uppercase tracking-[0.3em] text-[#FF9000]">
        Return policy
      </p>
      <h1 className="mt-4 font-tektur text-4xl font-bold uppercase tracking-wide text-[#f0f0f0] md:text-5xl">
        Returns & exchanges
      </h1>
      <p className="mt-6 max-w-2xl text-sm leading-7 text-[#9a9aac]">
        Last updated: May 2025
      </p>

      <div className="mt-12 space-y-10">

        {/* Do we accept returns */}
        <div className="border border-[#1a1a2e] bg-[#0b0b12]/80 p-6 md:p-8">
          <h2 className="font-tektur text-xl font-bold uppercase tracking-wide text-[#f0f0f0]">
            Do we accept returns
          </h2>
          <p className="mt-4 text-sm leading-7 text-[#9a9aac]">
            Our neon signs are made to order for each customer, so returns of a finished item for reasons unrelated to a manufacturing defect are not accepted. However, we do accept returns and offer a replacement in the following cases:
          </p>
          <ul className="mt-4 space-y-2 text-sm leading-7 text-[#9a9aac]">
            <li className="flex gap-2"><span className="text-[#FF9000]">—</span> The item arrived with a manufacturing defect</li>
            <li className="flex gap-2"><span className="text-[#FF9000]">—</span> The item was damaged in transit</li>
            <li className="flex gap-2"><span className="text-[#FF9000]">—</span> The item materially differs from the agreed design or size</li>
          </ul>
        </div>

        {/* Warranty */}
        <div className="border border-[#1a1a2e] bg-[#0b0b12]/80 p-6 md:p-8">
          <h2 className="font-tektur text-xl font-bold uppercase tracking-wide text-[#f0f0f0]">
            Warranty
          </h2>
          <p className="mt-4 text-sm leading-7 text-[#9a9aac]">
            All products are covered by a <strong className="text-[#f0f0f0]">2-year</strong> warranty from the date you receive your order. The warranty covers manufacturing defects: power supply failures, tube glow issues, and defects in mounting hardware.
          </p>
          <p className="mt-3 text-sm leading-7 text-[#9a9aac]">
            The warranty does not cover mechanical damage caused by the customer, or natural wear and tear.
          </p>
        </div>

        {/* How to start a return */}
        <div className="border border-[#1a1a2e] bg-[#0b0b12]/80 p-6 md:p-8">
          <h2 className="font-tektur text-xl font-bold uppercase tracking-wide text-[#f0f0f0]">
            How to start a return
          </h2>
          <p className="mt-4 text-sm leading-7 text-[#9a9aac]">
            To start a return or warranty claim, follow these steps:
          </p>
          <ol className="mt-4 space-y-3 text-sm leading-7 text-[#9a9aac]">
            <li className="flex gap-3">
              <span className="shrink-0 font-bold text-[#FF9000]">1.</span>
              Contact us within <strong className="text-[#f0f0f0]">14 days</strong> of receiving your order.
            </li>
            <li className="flex gap-3">
              <span className="shrink-0 font-bold text-[#FF9000]">2.</span>
              Describe the problem and attach photos of the defect or damage.
            </li>
            <li className="flex gap-3">
              <span className="shrink-0 font-bold text-[#FF9000]">3.</span>
              We'll review your request within <strong className="text-[#f0f0f0]">2 business days</strong> and propose a solution: replacement, repair, or refund.
            </li>
            <li className="flex gap-3">
              <span className="shrink-0 font-bold text-[#FF9000]">4.</span>
              If the item needs to be returned, we'll arrange a convenient shipping method.
            </li>
          </ol>
        </div>

        {/* Processing times */}
        <div className="border border-[#1a1a2e] bg-[#0b0b12]/80 p-6 md:p-8">
          <h2 className="font-tektur text-xl font-bold uppercase tracking-wide text-[#f0f0f0]">
            Processing times
          </h2>
          <div className="mt-4 space-y-3 text-sm leading-7 text-[#9a9aac]">
            <p><span className="text-[#FF9000] font-bold">Request review:</span> up to 2 business days after we receive your request and photos.</p>
            <p><span className="text-[#FF9000] font-bold">Item replacement:</span> 7-14 business days (time to manufacture a new item).</p>
            <p><span className="text-[#FF9000] font-bold">Refund</span> (if replacement isn't possible): up to 10 business days after the return is confirmed.</p>
          </div>
        </div>

        {/* Contacts */}
        <div className="border border-[#FF9000]/30 bg-[#FF9000]/5 p-6 md:p-8">
          <h2 className="font-tektur text-xl font-bold uppercase tracking-wide text-[#f0f0f0]">
            Returns contacts
          </h2>
          <p className="mt-4 text-sm leading-7 text-[#9a9aac]">
            For any return, exchange, or warranty questions, reach out in whatever way is convenient:
          </p>
          <div className="mt-4 space-y-2 text-sm text-[#9a9aac]">
            <p>
              <span className="text-[#FF9000] font-bold">Email: </span>
              <a href="mailto:hello@neonhub.example" className="text-[#f0f0f0] hover:text-[#FF9000] transition-colors">
                hello@neonhub.example
              </a>
            </p>
            <p>
              <span className="text-[#FF9000] font-bold">Phone: </span>
              <a href="tel:+15550100100" className="text-[#f0f0f0] hover:text-[#FF9000] transition-colors">
                +1 (555) 010-0100
              </a>
            </p>
            <p>
              <span className="text-[#FF9000] font-bold">Address: </span>
              <span className="text-[#f0f0f0]">United States</span>
            </p>
          </div>
          <p className="mt-6 text-xs leading-6 text-[#666688]">
            Business hours: Mon-Fri, 10:00-19:00. We aim to respond to every request within one business day.
          </p>
        </div>

      </div>
    </section>
  )
}
