"use client"

import { useEffect, useRef } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import { vkPageView } from "@/lib/vk-pixel"

export function VkPageviewTracker() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const previousUrlRef = useRef<string | null>(null)
  const search = searchParams.toString()

  useEffect(() => {
    if (typeof window === "undefined") return

    const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`

    if (previousUrlRef.current === null) {
      previousUrlRef.current = currentUrl
      return
    }

    vkPageView(currentUrl, previousUrlRef.current)
    previousUrlRef.current = currentUrl
  }, [pathname, search])

  return null
}
