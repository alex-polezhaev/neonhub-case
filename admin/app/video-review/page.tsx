'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import Link from 'next/link'
import { ArrowLeft, RefreshCw, Loader2, VideoIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface VideoTask {
  row_number: string | number
  product?: string
  result_video?: string
  prompt_group?: string
  prompt?: string
  aspect_ratio?: string
  review?: string
  [key: string]: unknown
}

interface Variant {
  row_number: string | number
  product: string
  color: string
  img1: string
  img2: string
  img3: string
}

type ReviewFilter = 'pending' | 'cool' | 'defect'

const FILTERS: { value: ReviewFilter; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'cool',    label: 'Cool' },
  { value: 'defect',  label: 'Defect' },
]

const PRELOAD_VIDEOS_COUNT = 50
const PRELOAD_CONCURRENCY = 4
const MAX_AUTOPLAY_VIDEOS = 8

export default function VideoReviewPage() {
  const [allVideos, setAllVideos] = useState<VideoTask[]>([])
  const [variants, setVariants] = useState<Variant[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<ReviewFilter>('pending')
  const [preloadedVideoSrc, setPreloadedVideoSrc] = useState<Record<string, string>>({})
  const [visibleRows, setVisibleRows] = useState<Set<string>>(new Set())
  const [endedRows, setEndedRows] = useState<Set<string>>(new Set())

  const videos = useMemo(() => {
    return allVideos.filter(v => {
      if (!v.result_video) return false
      if (filter === 'pending') return !v.review
      return v.review === filter
    })
  }, [allVideos, filter])

  async function fetchAll() {
    setLoading(true)
    setError(null)
    try {
      const [videosRes, variantsRes] = await Promise.all([
        fetch('/api/videos'),
        fetch('/api/variants'),
      ])
      const videosData = await videosRes.json()
      const variantsData = await variantsRes.json()
      const videosArr: VideoTask[] = Array.isArray(videosData) ? videosData : videosData.data || []
      const variantsArr: Variant[] = Array.isArray(variantsData) ? variantsData : variantsData.data || []
      setAllVideos(videosArr)
      setVariants(variantsArr)
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchAll() }, [])

  const [pending, setPending] = useState<{ rowNumber: string | number; review: string } | null>(null)
  const pendingTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const preloadedVideoSrcRef = useRef<Record<string, string>>({})
  const preloadingRowsRef = useRef<Set<string>>(new Set())
  const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({})
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const observerRef = useRef<IntersectionObserver | null>(null)

  function handleReviewClick(rowNumber: string | number, review: string) {
    if (pending?.rowNumber === rowNumber && pending?.review === review) {
      if (pendingTimer.current) clearTimeout(pendingTimer.current)
      setPending(null)
      setReview(rowNumber, review)
    } else {
      if (pendingTimer.current) clearTimeout(pendingTimer.current)
      setPending({ rowNumber, review })
      pendingTimer.current = setTimeout(() => setPending(null), 2000)
    }
  }

  async function setReview(rowNumber: string | number, review: string) {
    setAllVideos(prev => prev.map(v => v.row_number === rowNumber ? { ...v, review } : v))
    try {
      await fetch('/api/videos', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ row_number: rowNumber, review }),
      })
    } catch {
      setAllVideos(prev => prev.map(v => v.row_number === rowNumber ? { ...v, review: undefined } : v))
    }
  }

  const variantsByProduct = useMemo(() => {
    const map: Record<string, Variant[]> = {}
    for (const v of variants) {
      if (!map[v.product]) map[v.product] = []
      map[v.product].push(v)
    }
    return map
  }, [variants])

  const grouped = useMemo(() => {
    const map: Record<string, VideoTask[]> = {}
    for (const v of videos) {
      const key = v.product || 'No product'
      if (!map[key]) map[key] = []
      map[key].push(v)
    }
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b))
  }, [videos])

  const videosToPreload = useMemo(() => {
    return videos
      .slice(0, PRELOAD_VIDEOS_COUNT)
      .filter(v => v.result_video)
      .map(v => ({
        rowNumber: String(v.row_number),
        src: String(v.result_video),
      }))
  }, [videos])

  const autoplayRows = useMemo(() => {
    const orderedVisibleRows = videos
      .map(v => String(v.row_number))
      .filter(rowNumber => visibleRows.has(rowNumber) && !endedRows.has(rowNumber))

    return new Set(orderedVisibleRows.slice(0, MAX_AUTOPLAY_VIDEOS))
  }, [videos, visibleRows, endedRows])

  useEffect(() => {
    let cancelled = false
    const controllers: AbortController[] = []
    let index = 0

    const queue = videosToPreload.filter(video => {
      return !preloadedVideoSrcRef.current[video.rowNumber] && !preloadingRowsRef.current.has(video.rowNumber)
    })

    if (queue.length === 0) return

    async function worker() {
      while (!cancelled) {
        const next = queue[index++]
        if (!next) return

        preloadingRowsRef.current.add(next.rowNumber)
        const controller = new AbortController()
        controllers.push(controller)

        try {
          const response = await fetch(next.src, { signal: controller.signal })
          if (!response.ok) throw new Error(`HTTP ${response.status}`)

          const blob = await response.blob()
          const blobUrl = URL.createObjectURL(blob)

          if (cancelled) {
            URL.revokeObjectURL(blobUrl)
            return
          }

          preloadedVideoSrcRef.current[next.rowNumber] = blobUrl
          setPreloadedVideoSrc(prev => {
            if (prev[next.rowNumber]) return prev
            return { ...prev, [next.rowNumber]: blobUrl }
          })
        } catch {
          // Fallback stays on the original remote URL.
        } finally {
          preloadingRowsRef.current.delete(next.rowNumber)
        }
      }
    }

    const workers = Array.from({ length: Math.min(PRELOAD_CONCURRENCY, queue.length) }, () => worker())
    void Promise.all(workers)

    return () => {
      cancelled = true
      controllers.forEach(controller => controller.abort())
    }
  }, [videosToPreload])

  useEffect(() => {
    return () => {
      if (pendingTimer.current) clearTimeout(pendingTimer.current)
      Object.values(preloadedVideoSrcRef.current).forEach(url => URL.revokeObjectURL(url))
      observerRef.current?.disconnect()
    }
  }, [])

  useEffect(() => {
    const currentRows = new Set(videos.map(v => String(v.row_number)))

    setVisibleRows(prev => {
      const next = new Set<string>()
      prev.forEach(row => {
        if (currentRows.has(row)) next.add(row)
      })
      return next.size === prev.size ? prev : next
    })
    setEndedRows(prev => {
      const next = new Set<string>()
      prev.forEach(row => {
        if (currentRows.has(row)) next.add(row)
      })
      return next.size === prev.size ? prev : next
    })

    Object.keys(videoRefs.current).forEach(row => {
      if (!currentRows.has(row)) delete videoRefs.current[row]
    })
    Object.keys(cardRefs.current).forEach(row => {
      if (!currentRows.has(row)) delete cardRefs.current[row]
    })
  }, [videos])

  useEffect(() => {
    observerRef.current?.disconnect()

    const observer = new IntersectionObserver(
      entries => {
        setVisibleRows(prev => {
          const next = new Set(prev)
          let changed = false

          for (const entry of entries) {
            const rowNumber = (entry.target as HTMLElement).dataset.rowNumber
            if (!rowNumber) continue

            const isVisible = entry.isIntersecting && entry.intersectionRatio >= 0.35
            if (isVisible && !next.has(rowNumber)) {
              next.add(rowNumber)
              changed = true
            }
            if (!isVisible && next.has(rowNumber)) {
              next.delete(rowNumber)
              changed = true
            }
          }

          return changed ? next : prev
        })
      },
      {
        threshold: [0, 0.35, 0.75],
      }
    )

    observerRef.current = observer

    videos.forEach(video => {
      const rowNumber = String(video.row_number)
      const node = cardRefs.current[rowNumber]
      if (node) observer.observe(node)
    })

    return () => observer.disconnect()
  }, [videos])

  useEffect(() => {
    setEndedRows(prev => {
      const next = new Set<string>()
      prev.forEach(row => {
        if (visibleRows.has(row)) next.add(row)
      })
      return next.size === prev.size ? prev : next
    })
  }, [visibleRows])

  useEffect(() => {
    Object.entries(videoRefs.current).forEach(([rowNumber, node]) => {
      if (!node) return

      if (autoplayRows.has(rowNumber)) {
        const playPromise = node.play()
        if (playPromise) playPromise.catch(() => {})
        return
      }

      node.pause()
    })
  }, [autoplayRows])

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/"><ArrowLeft className="w-4 h-4 mr-2" />Menu</Link>
          </Button>
          <h1 className="text-xl font-semibold">Video Review</h1>
          <Badge variant="secondary" className="ml-1">{videos.length} videos</Badge>
          <div className="ml-auto flex items-center gap-2">
            <div className="flex rounded-lg border overflow-hidden text-sm">
              {FILTERS.map(f => (
                <button
                  key={f.value}
                  onClick={() => setFilter(f.value)}
                  className={`px-3 py-1.5 transition-colors ${
                    filter === f.value
                      ? f.value === 'cool'
                        ? 'bg-green-500 text-white'
                        : f.value === 'defect'
                        ? 'bg-red-500 text-white'
                        : 'bg-primary text-primary-foreground'
                      : 'hover:bg-muted'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <Button variant="outline" size="sm" onClick={fetchAll} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        {loading && (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {error && (
          <div className="p-4 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>
        )}

        {!loading && !error && videos.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-20 text-muted-foreground">
            <VideoIcon className="w-10 h-10" />
            <p>No videos</p>
          </div>
        )}

        {!loading && grouped.map(([product, items]) => {
          const productVariants = variantsByProduct[product] || []
          const variantPhotos = productVariants.flatMap(v =>
            [v.img1, v.img2, v.img3].filter(Boolean)
          )

          return (
            <div key={product} className="mb-12">
              <div className="flex items-start gap-4 mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h2 className="text-lg font-semibold">{product}</h2>
                    <Badge variant="secondary">{items.length}</Badge>
                    <div className="flex-1 h-px bg-border" />
                  </div>
                  {variantPhotos.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {variantPhotos.map((url, i) => (
                        <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                          <img
                            src={url}
                            alt=""
                            className="w-16 h-16 object-cover rounded border hover:opacity-80 transition-opacity"
                          />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {items.map(video => (
                  <div
                    key={video.row_number}
                    data-row-number={String(video.row_number)}
                    ref={node => {
                      cardRefs.current[String(video.row_number)] = node
                    }}
                    className="group rounded-lg overflow-hidden border bg-card"
                  >
                    <video
                      ref={node => {
                        videoRefs.current[String(video.row_number)] = node
                      }}
                      src={preloadedVideoSrc[String(video.row_number)] || video.result_video}
                      onEnded={() => {
                        setEndedRows(prev => {
                          const rowNumber = String(video.row_number)
                          if (prev.has(rowNumber)) return prev
                          const next = new Set(prev)
                          next.add(rowNumber)
                          return next
                        })
                      }}
                      controls
                      muted
                      playsInline
                      preload="metadata"
                      className="w-full bg-black"
                    />
                    <div className="p-2 space-y-2">
                      <div className="flex gap-1">
                        {(['cool', 'defect'] as const).map(rev => {
                          const isGreen = rev === 'cool'
                          const isArmed = pending?.rowNumber === video.row_number && pending?.review === rev
                          return (
                            <button
                              key={rev}
                              onClick={() => handleReviewClick(video.row_number, rev)}
                              className={`flex-1 flex items-center justify-center rounded-md font-bold py-2 text-lg transition-all ${
                                isArmed
                                  ? isGreen
                                    ? 'bg-green-300 ring-2 ring-green-500 scale-95 text-green-900'
                                    : 'bg-red-300 ring-2 ring-red-500 scale-95 text-red-900'
                                  : isGreen
                                  ? 'bg-green-500 hover:bg-green-600 active:bg-green-700 text-white'
                                  : 'bg-red-500 hover:bg-red-600 active:bg-red-700 text-white'
                              }`}
                            >
                              {isArmed ? '?' : isGreen ? '✓' : '✕'}
                            </button>
                          )
                        })}
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {video.prompt_group && <Badge variant="outline" className="text-xs">{video.prompt_group as string}</Badge>}
                        {video.aspect_ratio && <Badge variant="secondary" className="text-xs">{video.aspect_ratio as string}</Badge>}
                      </div>
                      {video.prompt && (
                        <p className="text-xs text-muted-foreground line-clamp-2">{video.prompt as string}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </main>
    </div>
  )
}
