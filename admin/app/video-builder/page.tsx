'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Clapperboard,
  Film,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Scissors,
  Search,
  Trash2,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

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
  product: string
  [key: string]: unknown
}

interface ClipRangeState {
  start: number
  end: number
  duration: number
  currentTime: number
}

interface BuilderClip {
  id: string
  product: string
  sourceRowNumber: string
  sourceUrl: string
  promptGroup?: string
  prompt?: string
  aspectRatio?: string
  review?: string
  start: number
  end: number
  duration: number
  reversed: boolean
}

interface BuilderState {
  product: string
  title: string
  notes: string
  clips: BuilderClip[]
}

type ReviewFilter = 'all' | 'cool' | 'pending' | 'defect'

const REVIEW_FILTERS: { value: ReviewFilter; label: string }[] = [
  { value: 'cool', label: 'Cool' },
  { value: 'pending', label: 'Pending' },
  { value: 'defect', label: 'Defect' },
  { value: 'all', label: 'All' },
]

const PLAYBACK_SPEEDS = [1, 1.5, 2] as const

function formatSeconds(value: number) {
  if (!Number.isFinite(value)) return '0.0'
  return value.toFixed(1)
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function extractVariantImages(variant: Variant) {
  return Object.entries(variant)
    .filter(([key, value]) => /^img\d+$/i.test(key) && typeof value === 'string' && value)
    .map(([, value]) => value as string)
}

export default function VideoBuilderPage() {
  const [videos, setVideos] = useState<VideoTask[]>([])
  const [variants, setVariants] = useState<Variant[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>('cool')
  const [query, setQuery] = useState('')
  const [clipRanges, setClipRanges] = useState<Record<string, ClipRangeState>>({})
  const [builder, setBuilder] = useState<BuilderState>({ product: '', title: '', notes: '', clips: [] })
  const [saving, setSaving] = useState(false)
  const [saveResult, setSaveResult] = useState<{ success: boolean; message: string } | null>(null)
  const [previewIndex, setPreviewIndex] = useState(0)
  const [previewPlaying, setPreviewPlaying] = useState(false)
  const [playbackRate, setPlaybackRate] = useState<(typeof PLAYBACK_SPEEDS)[number]>(1)

  const sourceVideoRefs = useRef<Record<string, HTMLVideoElement | null>>({})
  const previewVideoRef = useRef<HTMLVideoElement | null>(null)
  const reversePreviewFrameRef = useRef<number | null>(null)
  const reversePreviewLastTsRef = useRef<number | null>(null)

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

      const nextVideos: VideoTask[] = Array.isArray(videosData) ? videosData : videosData.data || videosData.videos || []
      const nextVariants: Variant[] = Array.isArray(variantsData) ? variantsData : variantsData.data || []

      setVideos(nextVideos.filter(video => !!video.result_video))
      setVariants(nextVariants)
    } catch (fetchError) {
      setError(String(fetchError))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAll()
  }, [])

  useEffect(() => {
    if (builder.clips.length === 0) {
      setPreviewIndex(0)
      setPreviewPlaying(false)
      return
    }

    if (previewIndex > builder.clips.length - 1) {
      setPreviewIndex(builder.clips.length - 1)
    }
  }, [builder.clips, previewIndex])

  const filteredVideos = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    return videos.filter(video => {
      const matchesReview =
        reviewFilter === 'all'
          ? true
          : reviewFilter === 'pending'
            ? !video.review
            : video.review === reviewFilter

      if (!matchesReview) return false
      if (!normalizedQuery) return true

      const haystack = `${video.product || ''} ${video.prompt_group || ''} ${video.prompt || ''}`.toLowerCase()
      return haystack.includes(normalizedQuery)
    })
  }, [query, reviewFilter, videos])

  const variantsByProduct = useMemo(() => {
    const map: Record<string, string[]> = {}

    for (const variant of variants) {
      const product = typeof variant.product === 'string' ? variant.product : ''
      if (!product) continue
      if (!map[product]) map[product] = []
      map[product].push(...extractVariantImages(variant))
    }

    return map
  }, [variants])

  const grouped = useMemo(() => {
    const map: Record<string, VideoTask[]> = {}

    for (const video of filteredVideos) {
      const product = video.product || 'No product'
      if (!map[product]) map[product] = []
      map[product].push(video)
    }

    return Object.entries(map)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([product, items]) => ({
        product,
        items,
        photos: variantsByProduct[product] || [],
      }))
  }, [filteredVideos, variantsByProduct])

  const totalDuration = useMemo(
    () => builder.clips.reduce((sum, clip) => sum + clip.duration, 0),
    [builder.clips],
  )

  const activePreviewClip = builder.clips[previewIndex] || null

  function setClipDuration(rowNumber: string, duration: number) {
    setClipRanges(prev => {
      const current = prev[rowNumber]
      const safeDuration = Math.max(duration, 0.1)
      const start = clamp(current?.start ?? 0, 0, Math.max(safeDuration - 0.1, 0))
      const end = clamp(current?.end ?? safeDuration, start + 0.1, safeDuration)

      return {
        ...prev,
        [rowNumber]: {
          start,
          end,
          duration: safeDuration,
          currentTime: current?.currentTime ?? 0,
        },
      }
    })
  }

  function updateCurrentTime(rowNumber: string, currentTime: number) {
    setClipRanges(prev => {
      const current = prev[rowNumber]
      if (!current) return prev

      return {
        ...prev,
        [rowNumber]: {
          ...current,
          currentTime,
        },
      }
    })
  }

  function updateRange(rowNumber: string, field: 'start' | 'end', rawValue: string) {
    const nextValue = Number(rawValue)

    setClipRanges(prev => {
      const current = prev[rowNumber]
      if (!current || !Number.isFinite(nextValue)) return prev

      if (field === 'start') {
        const start = clamp(nextValue, 0, Math.max(current.end - 0.1, 0))
        return {
          ...prev,
          [rowNumber]: {
            ...current,
            start,
          },
        }
      }

      const end = clamp(nextValue, current.start + 0.1, current.duration)
      return {
        ...prev,
        [rowNumber]: {
          ...current,
          end,
        },
      }
    })
  }

  function applyCurrentTime(rowNumber: string, field: 'start' | 'end') {
    const current = clipRanges[rowNumber]
    if (!current) return

    if (field === 'start') {
      updateRange(rowNumber, 'start', String(current.currentTime))
      return
    }

    updateRange(rowNumber, 'end', String(current.currentTime))
  }

  function clearBuilder() {
    setBuilder({ product: '', title: '', notes: '', clips: [] })
    setPreviewIndex(0)
    setPreviewPlaying(false)
    setSaveResult(null)
  }

  function addClip(video: VideoTask) {
    if (!video.result_video || !video.product) return

    const rowNumber = String(video.row_number)
    const range = clipRanges[rowNumber]
    if (!range) return

    const duration = Number((range.end - range.start).toFixed(2))
    if (duration <= 0) return

    setBuilder(prev => {
      const product = prev.product || video.product || ''
      if (prev.product && prev.product !== video.product) return prev

      const nextClip: BuilderClip = {
        id: `${rowNumber}-${Date.now()}-${prev.clips.length}`,
        product: video.product || '',
        sourceRowNumber: rowNumber,
        sourceUrl: video.result_video || '',
        promptGroup: video.prompt_group,
        prompt: video.prompt,
        aspectRatio: video.aspect_ratio,
        review: video.review,
        start: Number(range.start.toFixed(2)),
        end: Number(range.end.toFixed(2)),
        duration,
        reversed: false,
      }

      return {
        product,
        title: prev.title || `${product} montage`,
        notes: prev.notes,
        clips: [...prev.clips, nextClip],
      }
    })

    setSaveResult(null)
  }

  function removeClip(id: string) {
    setBuilder(prev => {
      const clips = prev.clips.filter(clip => clip.id !== id)
      if (clips.length === 0) return { product: '', title: '', notes: '', clips: [] }
      return { ...prev, clips }
    })
    setSaveResult(null)
  }

  function moveClip(index: number, direction: -1 | 1) {
    setBuilder(prev => {
      const nextIndex = index + direction
      if (nextIndex < 0 || nextIndex >= prev.clips.length) return prev

      const clips = [...prev.clips]
      const [moved] = clips.splice(index, 1)
      clips.splice(nextIndex, 0, moved)

      return { ...prev, clips }
    })

    setPreviewIndex(current => {
      if (current === index) return current + direction
      if (current === index + direction) return index
      return current
    })
    setSaveResult(null)
  }

  function toggleClipReverse(id: string) {
    setBuilder(prev => {
      return {
        ...prev,
        clips: prev.clips.map(clip =>
          clip.id === id
            ? {
                ...clip,
                reversed: !clip.reversed,
              }
            : clip,
        ),
      }
    })
    setSaveResult(null)
  }

  function stopReversePreview() {
    if (reversePreviewFrameRef.current !== null) {
      cancelAnimationFrame(reversePreviewFrameRef.current)
      reversePreviewFrameRef.current = null
    }
    reversePreviewLastTsRef.current = null
  }

  function syncPreviewToClip(clip: BuilderClip | null, autoplay: boolean) {
    const node = previewVideoRef.current
    if (!node || !clip) return

    stopReversePreview()

    const sameSource = node.currentSrc === clip.sourceUrl || node.src === clip.sourceUrl
    if (!sameSource) {
      node.src = clip.sourceUrl
      node.load()
    }

    const seekToStart = () => {
      if (clip.reversed) {
        node.pause()
        node.currentTime = clip.end

        if (!autoplay) return

        const runReverseFrame = (timestamp: number) => {
          const previousTimestamp = reversePreviewLastTsRef.current ?? timestamp
          const deltaSeconds = (timestamp - previousTimestamp) / 1000
          reversePreviewLastTsRef.current = timestamp

          const nextTime = Math.max(clip.start, node.currentTime - deltaSeconds * playbackRate)
          node.currentTime = nextTime

          if (nextTime <= clip.start + 0.04) {
            stopReversePreview()
            if (previewIndex < builder.clips.length - 1) {
              setPreviewIndex(prev => prev + 1)
            } else {
              setPreviewPlaying(false)
              setPreviewIndex(0)
            }
            return
          }

          reversePreviewFrameRef.current = requestAnimationFrame(runReverseFrame)
        }

        reversePreviewFrameRef.current = requestAnimationFrame(runReverseFrame)
      } else {
        node.currentTime = clip.start
        if (autoplay) {
          const playPromise = node.play()
          if (playPromise) playPromise.catch(() => {})
        } else {
          node.pause()
        }
      }
    }

    if (sameSource && node.readyState >= 1) {
      seekToStart()
      return
    }

    const handleLoadedMetadata = () => {
      seekToStart()
      node.removeEventListener('loadedmetadata', handleLoadedMetadata)
    }

    node.addEventListener('loadedmetadata', handleLoadedMetadata)
  }

  useEffect(() => {
    if (!activePreviewClip) return
    syncPreviewToClip(activePreviewClip, previewPlaying)

    return () => {
      stopReversePreview()
    }
  }, [activePreviewClip, previewPlaying, playbackRate, previewIndex, builder.clips.length])

  useEffect(() => {
    Object.values(sourceVideoRefs.current).forEach(node => {
      if (node) node.playbackRate = playbackRate
    })

    if (previewVideoRef.current) {
      previewVideoRef.current.playbackRate = playbackRate
    }
  }, [playbackRate])

  function togglePreviewPlayback() {
    if (!activePreviewClip) return
    setPreviewPlaying(prev => !prev)
  }

  function handlePreviewTimeUpdate() {
    const node = previewVideoRef.current
    const clip = activePreviewClip
    if (!node || !clip) return
    if (clip.reversed) return

    if (node.currentTime < clip.start) {
      node.currentTime = clip.start
      return
    }

    if (node.currentTime < clip.end - 0.04) return

    if (previewIndex < builder.clips.length - 1) {
      setPreviewIndex(prev => prev + 1)
      return
    }

    setPreviewPlaying(false)
    setPreviewIndex(0)
  }

  async function saveCompilation() {
    if (!builder.product || builder.clips.length === 0) return

    setSaving(true)
    setSaveResult(null)

    try {
      const response = await fetch('/api/video-compilations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product: builder.product,
          title: builder.title.trim() || `${builder.product} montage`,
          notes: builder.notes.trim(),
          total_duration_seconds: Number(totalDuration.toFixed(2)),
          clip_count: builder.clips.length,
          source_video_count: new Set(builder.clips.map(clip => clip.sourceRowNumber)).size,
          clips: builder.clips.map((clip, index) => ({
            order: index + 1,
            source_row_number: clip.sourceRowNumber,
            source_url: clip.sourceUrl,
            start_seconds: clip.start,
            end_seconds: clip.end,
            duration_seconds: clip.duration,
            reverse: clip.reversed,
            prompt_group: clip.promptGroup || '',
            prompt: clip.prompt || '',
            aspect_ratio: clip.aspectRatio || '',
            review: clip.review || '',
          })),
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data?.error || `HTTP ${response.status}`)
      }

      clearBuilder()
      setSaveResult({ success: true, message: 'Compilation sent to the sheet' })
    } catch (saveError) {
      setSaveResult({ success: false, message: String(saveError) })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/"><ArrowLeft className="w-4 h-4 mr-2" />Menu</Link>
          </Button>
          <h1 className="text-xl font-semibold">Video Builder</h1>
          <Badge variant="secondary">{filteredVideos.length} videos</Badge>
          <Badge variant="outline">{grouped.length} products</Badge>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={fetchAll} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
          <section className="space-y-6">
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={query}
                      onChange={event => setQuery(event.target.value)}
                      placeholder="Search by product, group or prompt"
                      className="pl-9"
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {REVIEW_FILTERS.map(filter => (
                      <button
                        key={filter.value}
                        onClick={() => setReviewFilter(filter.value)}
                        className={`px-3 py-2 rounded-lg border text-sm transition-colors ${
                          reviewFilter === filter.value
                            ? filter.value === 'cool'
                              ? 'bg-green-500 text-white border-green-500'
                              : filter.value === 'defect'
                                ? 'bg-red-500 text-white border-red-500'
                                : 'bg-primary text-primary-foreground border-primary'
                            : 'hover:bg-muted'
                        }`}
                      >
                        {filter.label}
                      </button>
                    ))}
                  </div>
                </div>
                <p className="mt-3 text-sm text-muted-foreground">
                  You can only add clips from a single product to the builder at a time. The trimmed selection is saved as a sequence of segments, ready for the sheet and further assembly.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {PLAYBACK_SPEEDS.map(speed => (
                    <Button
                      key={speed}
                      type="button"
                      size="sm"
                      variant={playbackRate === speed ? 'default' : 'outline'}
                      onClick={() => setPlaybackRate(speed)}
                    >
                      {speed.toFixed(1)}x
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {loading && (
              <div className="flex justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            )}

            {error && (
              <div className="p-4 rounded-lg bg-destructive/10 text-destructive text-sm">
                {error}
              </div>
            )}

            {!loading && !error && grouped.length === 0 && (
              <div className="flex flex-col items-center gap-2 py-20 text-muted-foreground">
                <Film className="w-10 h-10" />
                <p>No videos match the current filter</p>
              </div>
            )}

            {!loading && grouped.map(group => (
              <Card key={group.product}>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div>
                      <CardTitle>{group.product}</CardTitle>
                      <CardDescription>
                        {group.items.length} videos
                        {builder.product === group.product ? ' • selected in the builder' : ''}
                      </CardDescription>
                    </div>
                    <div className="ml-auto flex items-center gap-2">
                      {builder.product && builder.product !== group.product && (
                        <Badge variant="outline">Unavailable until you clear the build</Badge>
                      )}
                      {!builder.product && (
                        <Badge variant="secondary">You can add clips</Badge>
                      )}
                    </div>
                  </div>
                  {group.photos.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-2">
                      {group.photos.slice(0, 10).map((url, index) => (
                        <a key={`${url}-${index}`} href={url} target="_blank" rel="noopener noreferrer">
                          <img
                            src={url}
                            alt=""
                            className="w-14 h-14 object-cover rounded-lg border hover:opacity-80 transition-opacity"
                          />
                        </a>
                      ))}
                    </div>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                    {group.items.map(video => {
                      const rowNumber = String(video.row_number)
                      const range = clipRanges[rowNumber]
                      const clipCount = builder.clips.filter(clip => clip.sourceRowNumber === rowNumber).length
                      const productLocked = !!builder.product && builder.product !== video.product

                      return (
                        <div key={rowNumber} className="rounded-xl border bg-card overflow-hidden">
                          <video
                            ref={node => {
                              sourceVideoRefs.current[rowNumber] = node
                              if (node) node.playbackRate = playbackRate
                            }}
                            src={video.result_video}
                            controls
                            preload="metadata"
                            onLoadedMetadata={event => {
                              setClipDuration(rowNumber, event.currentTarget.duration)
                            }}
                            onTimeUpdate={event => {
                              updateCurrentTime(rowNumber, event.currentTarget.currentTime)
                            }}
                            className="w-full bg-black"
                          />
                          <div className="p-3 space-y-3">
                            <div className="flex flex-wrap gap-1">
                              {video.review && <Badge variant="secondary">{video.review}</Badge>}
                              {video.prompt_group && <Badge variant="outline">{video.prompt_group}</Badge>}
                              {video.aspect_ratio && <Badge variant="secondary">{video.aspect_ratio}</Badge>}
                              {clipCount > 0 && <Badge>{clipCount} in build</Badge>}
                            </div>

                            {video.prompt && (
                              <p className="text-sm text-muted-foreground line-clamp-3">{video.prompt}</p>
                            )}

                            {range ? (
                              <div className="space-y-3">
                                <div className="grid grid-cols-2 gap-3">
                                  <div className="space-y-1">
                                    <label className="text-xs font-medium text-muted-foreground">Start, sec</label>
                                    <Input
                                      type="number"
                                      min="0"
                                      max={String(Math.max(range.end - 0.1, 0))}
                                      step="0.1"
                                      value={formatSeconds(range.start)}
                                      onChange={event => updateRange(rowNumber, 'start', event.target.value)}
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <label className="text-xs font-medium text-muted-foreground">End, sec</label>
                                    <Input
                                      type="number"
                                      min={String(range.start + 0.1)}
                                      max={String(range.duration)}
                                      step="0.1"
                                      value={formatSeconds(range.end)}
                                      onChange={event => updateRange(rowNumber, 'end', event.target.value)}
                                    />
                                  </div>
                                </div>

                                <div className="space-y-2">
                                  <input
                                    type="range"
                                    min="0"
                                    max={String(range.duration)}
                                    step="0.1"
                                    value={range.start}
                                    onChange={event => updateRange(rowNumber, 'start', event.target.value)}
                                    className="w-full"
                                  />
                                  <input
                                    type="range"
                                    min="0"
                                    max={String(range.duration)}
                                    step="0.1"
                                    value={range.end}
                                    onChange={event => updateRange(rowNumber, 'end', event.target.value)}
                                    className="w-full"
                                  />
                                </div>

                                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                                  <span>Current: {formatSeconds(range.currentTime)} s</span>
                                  <span>Duration: {formatSeconds(range.duration)} s</span>
                                  <span>Clip: {formatSeconds(range.end - range.start)} s</span>
                                </div>

                                <div className="flex flex-wrap gap-2">
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => applyCurrentTime(rowNumber, 'start')}
                                  >
                                    Start = current
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => applyCurrentTime(rowNumber, 'end')}
                                  >
                                    End = current
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    onClick={() => addClip(video)}
                                    disabled={productLocked || range.end - range.start <= 0}
                                  >
                                    <Plus className="w-4 h-4 mr-2" />
                                    Add clip
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <div className="text-sm text-muted-foreground flex items-center gap-2">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Reading video duration
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            ))}
          </section>

          <aside className="xl:sticky xl:top-[88px] self-start">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Scissors className="w-5 h-5 text-primary" />
                  <CardTitle>Builder</CardTitle>
                </div>
                <CardDescription>
                  {builder.product
                    ? `Build for product ${builder.product}`
                    : 'Add clips from any product to start'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Compilation title</label>
                  <Input
                    value={builder.title}
                    onChange={event => setBuilder(prev => ({ ...prev, title: event.target.value }))}
                    placeholder="For example, Hero montage"
                    disabled={!builder.product}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Comment</label>
                  <Textarea
                    value={builder.notes}
                    onChange={event => setBuilder(prev => ({ ...prev, notes: event.target.value }))}
                    placeholder="What to do during the final editing stage"
                    disabled={!builder.product}
                    rows={4}
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-lg border p-3">
                    <div className="text-xs text-muted-foreground">Clips</div>
                    <div className="text-xl font-semibold">{builder.clips.length}</div>
                  </div>
                  <div className="rounded-lg border p-3">
                    <div className="text-xs text-muted-foreground">Source videos</div>
                    <div className="text-xl font-semibold">
                      {new Set(builder.clips.map(clip => clip.sourceRowNumber)).size}
                    </div>
                  </div>
                  <div className="rounded-lg border p-3">
                    <div className="text-xs text-muted-foreground">Runtime</div>
                    <div className="text-xl font-semibold">{formatSeconds(totalDuration)} s</div>
                  </div>
                </div>

                <div className="rounded-xl border bg-muted/30 p-3 space-y-3">
                  <div className="flex items-center gap-2">
                    <Clapperboard className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Sequence preview</span>
                  </div>

                  {activePreviewClip ? (
                    <>
                      <video
                        ref={previewVideoRef}
                        controls
                        preload="metadata"
                        onTimeUpdate={handlePreviewTimeUpdate}
                        onLoadedMetadata={event => {
                          event.currentTarget.playbackRate = playbackRate
                        }}
                        className="w-full bg-black rounded-lg"
                      />
                      <div className="flex items-center gap-2">
                        <Button type="button" size="sm" onClick={togglePreviewPlayback}>
                          {previewPlaying ? 'Pause' : 'Play'}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setPreviewPlaying(false)
                            setPreviewIndex(0)
                          }}
                        >
                          From start
                        </Button>
                        <Badge variant="outline">
                          Clip {previewIndex + 1} / {builder.clips.length}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Now: {activePreviewClip.promptGroup || 'No group'} •{' '}
                        {formatSeconds(activePreviewClip.start)}-{formatSeconds(activePreviewClip.end)} sec
                        {activePreviewClip.reversed ? ' • reverse' : ''}
                      </p>
                      <div className="grid grid-cols-3 gap-2">
                        {builder.clips.map((clip, index) => (
                          <button
                            key={clip.id}
                            type="button"
                            onClick={() => {
                              setPreviewPlaying(false)
                              setPreviewIndex(index)
                            }}
                            className={`rounded-lg overflow-hidden border text-left transition-colors ${
                              index === previewIndex
                                ? 'border-primary ring-2 ring-primary/30'
                                : 'hover:border-muted-foreground'
                            }`}
                          >
                            <video
                              src={clip.sourceUrl}
                              muted
                              playsInline
                              preload="metadata"
                              onLoadedMetadata={event => {
                                const element = event.currentTarget
                                element.currentTime = clip.reversed ? clip.end : clip.start
                              }}
                              className="w-full bg-black"
                            />
                            <div className="p-2">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-xs font-medium">#{index + 1}</span>
                                {clip.reversed && <Badge variant="outline" className="text-[10px]">Reverse</Badge>}
                              </div>
                              <p className="text-[11px] text-muted-foreground mt-1">
                                {formatSeconds(clip.start)}-{formatSeconds(clip.end)} s
                              </p>
                            </div>
                          </button>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground text-center">
                      Add at least one clip to preview the edit
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  {builder.clips.length === 0 && (
                    <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground text-center">
                      Queue is empty
                    </div>
                  )}

                  {builder.clips.map((clip, index) => (
                    <div
                      key={clip.id}
                      className={`rounded-xl border p-3 transition-colors ${
                        index === previewIndex ? 'border-primary bg-primary/5' : 'bg-card'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <button
                          type="button"
                          className="mt-0.5 w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-semibold"
                          onClick={() => {
                            setPreviewIndex(index)
                            setPreviewPlaying(false)
                          }}
                        >
                          {index + 1}
                        </button>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap gap-1 mb-2">
                            {clip.promptGroup && <Badge variant="outline">{clip.promptGroup}</Badge>}
                            {clip.aspectRatio && <Badge variant="secondary">{clip.aspectRatio}</Badge>}
                            <Badge variant="secondary">{formatSeconds(clip.duration)} s</Badge>
                            {clip.reversed && <Badge variant="outline">Reverse</Badge>}
                          </div>
                          <p className="text-sm font-medium">
                            {formatSeconds(clip.start)} - {formatSeconds(clip.end)} sec
                          </p>
                          {clip.prompt && (
                            <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{clip.prompt}</p>
                          )}
                          <label className="mt-2 inline-flex items-center gap-2 rounded-md border px-2 py-1 cursor-pointer">
                            <Checkbox
                              checked={clip.reversed}
                              onCheckedChange={() => toggleClipReverse(clip.id)}
                            />
                            <span className="text-xs font-medium">Reverse</span>
                          </label>
                        </div>
                        <div className="flex flex-col gap-1">
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            onClick={() => moveClip(index, -1)}
                            disabled={index === 0}
                          >
                            <ChevronUp className="w-4 h-4" />
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            onClick={() => moveClip(index, 1)}
                            disabled={index === builder.clips.length - 1}
                          >
                            <ChevronDown className="w-4 h-4" />
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            onClick={() => removeClip(clip.id)}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {saveResult && (
                  <div
                    className={`rounded-lg px-3 py-2 text-sm ${
                      saveResult.success
                        ? 'bg-green-500/10 text-green-700'
                        : 'bg-destructive/10 text-destructive'
                    }`}
                  >
                    {saveResult.message}
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={clearBuilder}
                    disabled={builder.clips.length === 0 || saving}
                  >
                    Clear
                  </Button>
                  <Button
                    type="button"
                    className="flex-1"
                    onClick={saveCompilation}
                    disabled={builder.clips.length === 0 || saving}
                  >
                    {saving ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4 mr-2" />
                    )}
                    Send to sheet
                  </Button>
                </div>
              </CardContent>
            </Card>
          </aside>
        </div>
      </main>
    </div>
  )
}
