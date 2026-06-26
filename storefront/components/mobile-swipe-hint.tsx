"use client"

import { ChevronLeft, ChevronRight } from "lucide-react"

type MobileSwipeHintProps = {
  className?: string
  onPrev: () => void
  onNext: () => void
  showPrev?: boolean
  showNext?: boolean
}

export function MobileSwipeHint({
  className = "",
  onPrev,
  onNext,
  showPrev = true,
  showNext = true,
}: MobileSwipeHintProps) {
  if (!showPrev && !showNext) return null

  return (
    <div
      className={`pointer-events-none md:hidden ${className}`}
      aria-hidden="true"
    >
      {showPrev ? (
        <button
          type="button"
          onClick={onPrev}
          className="pointer-events-auto absolute left-0 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center border-2 border-[#FF9000] bg-[#0a0a0f] text-[#FF9000] shadow-[0_0_12px_rgba(255,144,0,0.3)] transition-colors active:bg-[#FF9000] active:text-black"
        >
          <ChevronLeft size={18} />
        </button>
      ) : null}
      {showNext ? (
        <button
          type="button"
          onClick={onNext}
          className="pointer-events-auto absolute right-0 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center border-2 border-[#FF9000] bg-[#0a0a0f] text-[#FF9000] shadow-[0_0_12px_rgba(255,144,0,0.3)] transition-colors active:bg-[#FF9000] active:text-black"
        >
          <ChevronRight size={18} />
        </button>
      ) : null}
    </div>
  )
}
