'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import Link from 'next/link'
import { ArrowLeft, ChevronDown, ChevronUp, Download, RefreshCw, Loader2, VideoIcon } from 'lucide-react'
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
  input1?: string
  [key: string]: unknown
}

interface NanoTask {
  row_number: string | number
  product?: string
  result_img?: string
  prompt_group?: string
  prompt?: string
  [key: string]: unknown
}

interface VideoGroup {
  taskPromptGroup: string
  taskPrompt: string
  input1: string
  taskRowNumber: string | number | null
  videos: VideoTask[]
}

interface ProductGroup {
  product: string
  groups: VideoGroup[]
}

interface Product {
  row_number: string | number
  title?: string
  slug?: string
  categories?: string
  [key: string]: unknown
}

type ReviewFilter = 'all' | 'cool' | 'defect'

const MAX_AUTOPLAY_VIDEOS = 6

const REVIEW_FILTERS: { value: ReviewFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'cool', label: 'Cool' },
  { value: 'defect', label: 'Defect' },
]

const BUSINESS_CATEGORIES = [
  'tobacco',
  'vape',
  'hookah',
  'coffee',
  'cafe',
  'bakery',
  'restaurant',
  'beauty',
  'flowers',
  'beer',
  'balloons',
  'cakes',
  'grocery',
  'gym',
  'navigation',
  'other',
] as const

const HOME_CATEGORIES = [
  'game',
  'funny',
  'logo',
  'animals',
  'phrases',
  'asia',
  'music',
  'car',
  'food',
  'space',
  'movies',
  'names',
  'wedding',
  'birthday',
] as const

function asOptionalString(value: unknown): string | undefined {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed || undefined
  }

  if (typeof value === 'number') {
    return String(value)
  }

  return undefined
}

function normalizeVideoTask(task: VideoTask): VideoTask {
  return {
    ...task,
    product: asOptionalString(task.product),
    result_video: asOptionalString(task.result_video),
    prompt_group: asOptionalString(task.prompt_group),
    prompt: asOptionalString(task.prompt),
    aspect_ratio: asOptionalString(task.aspect_ratio),
    review: asOptionalString(task.review),
    input1: asOptionalString(task.input1),
  }
}

function normalizeNanoTask(task: NanoTask): NanoTask {
  return {
    ...task,
    product: asOptionalString(task.product),
    result_img: asOptionalString(task.result_img),
    prompt_group: asOptionalString(task.prompt_group),
    prompt: asOptionalString(task.prompt),
  }
}

function normalizeProduct(product: Product): Product {
  return {
    ...product,
    title: asOptionalString(product.title),
    slug: asOptionalString(product.slug),
    categories: asOptionalString(product.categories),
  }
}

function normalizeCategoryValue(value: string) {
  return value.trim().toLowerCase()
}

function getVideoPromptGroup(video: VideoTask, taskByResultImg: Map<string, NanoTask>) {
  const input1 = video.input1 || ''
  const task = input1 ? taskByResultImg.get(input1) : undefined
  return task?.prompt_group || video.prompt_group || 'No group'
}

function getVideoAspectRatio(value: string | undefined) {
  if (value === '16:9') return '16 / 9'
  if (value === '1:1') return '1 / 1'
  return '9 / 16'
}

function areStringArraysEqual(left: string[], right: string[]) {
  if (left.length !== right.length) return false

  const leftSorted = [...left].sort()
  const rightSorted = [...right].sort()

  return leftSorted.every((value, index) => value === rightSorted[index])
}

export default function VideoByProductPage() {
  const [videos, setVideos] = useState<VideoTask[]>([])
  const [tasks, setTasks] = useState<NanoTask[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>('cool')
  const [draftReviewFilter, setDraftReviewFilter] = useState<ReviewFilter>('cool')
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [draftSelectedCategories, setDraftSelectedCategories] = useState<string[]>([])
  const [selectedPromptGroups, setSelectedPromptGroups] = useState<string[]>([])
  const [draftSelectedPromptGroups, setDraftSelectedPromptGroups] = useState<string[]>([])
  const [filtersExpanded, setFiltersExpanded] = useState(false)
  const [visibleRows, setVisibleRows] = useState<Set<string>>(new Set())
  const [endedRows, setEndedRows] = useState<Set<string>>(new Set())

  const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({})
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const observerRef = useRef<IntersectionObserver | null>(null)

  async function fetchAll() {
    setLoading(true)
    setError(null)
    try {
      const [videosRes, tasksRes, productsRes] = await Promise.all([
        fetch('/api/videos'),
        fetch('/api/submit/tasks'),
        fetch('/api/products'),
      ])
      const videosData = await videosRes.json()
      const tasksData = await tasksRes.json()
      const productsData = await productsRes.json()
      const videosArr: VideoTask[] = Array.isArray(videosData) ? videosData : videosData.data || []
      const tasksArr: NanoTask[] = Array.isArray(tasksData) ? tasksData : tasksData.data || []
      const productsArr: Product[] = Array.isArray(productsData) ? productsData : productsData.data || productsData.products || []
      setVideos(videosArr.map(normalizeVideoTask))
      setTasks(tasksArr.map(normalizeNanoTask))
      setProducts(productsArr.map(normalizeProduct))
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchAll() }, [])

  // Build lookup: result_img → task
  const taskByResultImg = useMemo(() => {
    const map = new Map<string, NanoTask>()
    for (const t of tasks) {
      if (t.result_img) map.set(t.result_img, t)
    }
    return map
  }, [tasks])

  const productCategoriesByKey = useMemo(() => {
    const map = new Map<string, string[]>()

    for (const product of products) {
      const categories = (product.categories || '')
        .split(',')
        .map(category => normalizeCategoryValue(category))
        .filter(Boolean)

      if (categories.length === 0) continue

      if (product.slug) map.set(product.slug, categories)
      if (product.title) map.set(product.title, categories)
    }

    return map
  }, [products])

  const availableCategories = useMemo(() => {
    const unique = new Set<string>()

    for (const product of products) {
      for (const category of (product.categories || '').split(',')) {
        const normalized = normalizeCategoryValue(category)
        if (normalized) unique.add(normalized)
      }
    }

    return unique
  }, [products])

  const videosMatchingDraftReview = useMemo(() => {
    return videos.filter(v => {
      if (!v.result_video) return false
      if (draftReviewFilter === 'all') return true
      return v.review === draftReviewFilter
    })
  }, [draftReviewFilter, videos])

  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>()

    for (const video of videosMatchingDraftReview) {
      const categories = productCategoriesByKey.get(video.product || '')
      if (!categories) continue

      for (const category of categories) {
        counts.set(category, (counts.get(category) || 0) + 1)
      }
    }

    return counts
  }, [productCategoriesByKey, videosMatchingDraftReview])

  const videosMatchingDraftCategories = useMemo(() => {
    return videosMatchingDraftReview.filter(video => {
      if (draftSelectedCategories.length === 0) return true
      const categories = productCategoriesByKey.get(video.product || '')
      return categories?.some(category => draftSelectedCategories.includes(category)) ?? false
    })
  }, [draftSelectedCategories, productCategoriesByKey, videosMatchingDraftReview])

  const promptGroupCounts = useMemo(() => {
    const counts = new Map<string, number>()

    for (const video of videosMatchingDraftCategories) {
      const promptGroup = getVideoPromptGroup(video, taskByResultImg)
      counts.set(promptGroup, (counts.get(promptGroup) || 0) + 1)
    }

    return counts
  }, [taskByResultImg, videosMatchingDraftCategories])

  const availablePromptGroups = useMemo(() => {
    const groups = new Set<string>()

    for (const video of videosMatchingDraftCategories) {
      groups.add(getVideoPromptGroup(video, taskByResultImg))
    }

    return Array.from(groups).sort((a, b) => a.localeCompare(b))
  }, [taskByResultImg, videosMatchingDraftCategories])

  const videosMatchingReview = useMemo(() => {
    return videos.filter(v => {
      if (!v.result_video) return false
      if (reviewFilter === 'all') return true
      return v.review === reviewFilter
    })
  }, [reviewFilter, videos])

  const videosMatchingCategories = useMemo(() => {
    return videosMatchingReview.filter(video => {
      if (selectedCategories.length === 0) return true
      const categories = productCategoriesByKey.get(video.product || '')
      return categories?.some(category => selectedCategories.includes(category)) ?? false
    })
  }, [productCategoriesByKey, selectedCategories, videosMatchingReview])

  // Group videos: product → prompt_group → prompt → input1
  const productGroups = useMemo((): ProductGroup[] => {
    const promptGroupFiltered = videosMatchingCategories.filter(video => {
      if (selectedPromptGroups.length === 0) return true
      const promptGroup = getVideoPromptGroup(video, taskByResultImg)
      return selectedPromptGroups.includes(promptGroup)
    })

    // Build intermediate structure
    const byProduct = new Map<string, Map<string, Map<string, Map<string, VideoTask[]>>>>()

    for (const video of promptGroupFiltered) {
      const product = video.product || 'No product'
      const input1 = video.input1 || ''
      const task = input1 ? taskByResultImg.get(input1) : undefined
      const promptGroup = getVideoPromptGroup(video, taskByResultImg)
      const prompt = task?.prompt || video.prompt || 'No prompt'

      if (!byProduct.has(product)) byProduct.set(product, new Map())
      const byPG = byProduct.get(product)!
      if (!byPG.has(promptGroup)) byPG.set(promptGroup, new Map())
      const byPrompt = byPG.get(promptGroup)!
      if (!byPrompt.has(prompt)) byPrompt.set(prompt, new Map())
      const byInput1 = byPrompt.get(prompt)!
      if (!byInput1.has(input1)) byInput1.set(input1, [])
      byInput1.get(input1)!.push(video)
    }

    const result: ProductGroup[] = []

    for (const [product, byPG] of byProduct) {
      const groups: VideoGroup[] = []

      for (const [taskPromptGroup, byPrompt] of byPG) {
        for (const [taskPrompt, byInput1] of byPrompt) {
          for (const [input1, vids] of byInput1) {
            const task = input1 ? taskByResultImg.get(input1) : undefined
            groups.push({
              taskPromptGroup,
              taskPrompt,
              input1,
              taskRowNumber: task?.row_number ?? null,
              videos: vids,
            })
          }
        }
      }

      result.push({ product, groups })
    }

    return result.sort((a, b) => a.product.localeCompare(b.product))
  }, [selectedPromptGroups, taskByResultImg, videosMatchingCategories])

  const allDisplayedVideos = useMemo(
    () => productGroups.flatMap(pg => pg.groups.flatMap(g => g.videos)),
    [productGroups]
  )

  const autoplayRows = useMemo(() => {
    const ordered = allDisplayedVideos
      .map(v => String(v.row_number))
      .filter(r => visibleRows.has(r) && !endedRows.has(r))
    return new Set(ordered.slice(0, MAX_AUTOPLAY_VIDEOS))
  }, [allDisplayedVideos, visibleRows, endedRows])

  useEffect(() => {
    observerRef.current?.disconnect()
    const observer = new IntersectionObserver(
      entries => {
        setVisibleRows(prev => {
          const next = new Set(prev)
          let changed = false
          for (const entry of entries) {
            const row = (entry.target as HTMLElement).dataset.rowNumber
            if (!row) continue
            const visible = entry.isIntersecting && entry.intersectionRatio >= 0.35
            if (visible && !next.has(row)) { next.add(row); changed = true }
            if (!visible && next.has(row)) { next.delete(row); changed = true }
          }
          return changed ? next : prev
        })
      },
      { threshold: [0, 0.35, 0.75] }
    )
    observerRef.current = observer
    allDisplayedVideos.forEach(v => {
      const node = cardRefs.current[String(v.row_number)]
      if (node) observer.observe(node)
    })
    return () => observer.disconnect()
  }, [allDisplayedVideos])

  useEffect(() => {
    setEndedRows(prev => {
      const next = new Set<string>()
      prev.forEach(r => { if (visibleRows.has(r)) next.add(r) })
      return next.size === prev.size ? prev : next
    })
  }, [visibleRows])

  useEffect(() => {
    Object.entries(videoRefs.current).forEach(([row, node]) => {
      if (!node) return
      if (autoplayRows.has(row)) {
        node.play().catch(() => {})
      } else {
        node.pause()
      }
    })
  }, [autoplayRows])

  function handleDownload(video: VideoTask) {
    if (!video.result_video) return

    try {
      const url = new URL(video.result_video)
      url.searchParams.set('download', '')
      window.open(url.toString(), '_blank', 'noopener,noreferrer')
    } catch {
      const separator = video.result_video.includes('?') ? '&' : '?'
      window.open(`${video.result_video}${separator}download`, '_blank', 'noopener,noreferrer')
    }
  }

  function toggleCategory(category: string) {
    setDraftSelectedCategories(prev => (
      prev.includes(category)
        ? prev.filter(item => item !== category)
        : [...prev, category]
    ))
  }

  function togglePromptGroup(promptGroup: string) {
    setDraftSelectedPromptGroups(prev => (
      prev.includes(promptGroup)
        ? prev.filter(item => item !== promptGroup)
        : [...prev, promptGroup]
    ))
  }

  function applyFilters() {
    setReviewFilter(draftReviewFilter)
    setSelectedCategories(draftSelectedCategories)
    setSelectedPromptGroups(draftSelectedPromptGroups)
  }

  const totalVideos = allDisplayedVideos.length
  const activeFilterCount = selectedCategories.length + selectedPromptGroups.length
  const draftFilterCount = draftSelectedCategories.length + draftSelectedPromptGroups.length
  const hasPendingFilterChanges =
    draftReviewFilter !== reviewFilter ||
    !areStringArraysEqual(draftSelectedCategories, selectedCategories) ||
    !areStringArraysEqual(draftSelectedPromptGroups, selectedPromptGroups)
  const selectedCategoryPreview = selectedCategories.slice(0, 6)
  const selectedPromptGroupPreview = selectedPromptGroups.slice(0, 4)

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/"><ArrowLeft className="w-4 h-4 mr-2" />Menu</Link>
            </Button>
            <h1 className="text-lg font-semibold">Videos by product</h1>
            <Badge variant="secondary">{totalVideos} videos</Badge>
            <div className="flex items-center gap-2 flex-wrap">
              {REVIEW_FILTERS.map(filterOption => (
                <Button
                  key={filterOption.value}
                  variant={draftReviewFilter === filterOption.value ? 'default' : 'outline'}
                  size="sm"
                  className="h-8 px-2.5"
                  onClick={() => setDraftReviewFilter(filterOption.value)}
                >
                  {filterOption.label}
                </Button>
              ))}
            </div>
            <Button
              variant={hasPendingFilterChanges ? 'default' : 'outline'}
              size="sm"
              className="h-8 px-2.5"
              disabled={!hasPendingFilterChanges}
              onClick={applyFilters}
            >
              Search
            </Button>
            <Button
              variant={filtersExpanded ? 'default' : 'outline'}
              size="sm"
              className="h-8 px-2.5"
              onClick={() => setFiltersExpanded(prev => !prev)}
            >
              {filtersExpanded ? <ChevronUp className="w-4 h-4 mr-1" /> : <ChevronDown className="w-4 h-4 mr-1" />}
              Filters
              {draftFilterCount > 0 && <span className="ml-1 text-[10px] opacity-80">{draftFilterCount}</span>}
            </Button>
            <div className="ml-auto flex items-center gap-2">
              {draftSelectedCategories.length > 0 && (
                <Button variant="ghost" size="sm" onClick={() => setDraftSelectedCategories([])}>
                  Reset categories
                </Button>
              )}
              {draftSelectedPromptGroups.length > 0 && (
                <Button variant="ghost" size="sm" onClick={() => setDraftSelectedPromptGroups([])}>
                  Reset groups
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={fetchAll} disabled={loading}>
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>

          {!filtersExpanded && activeFilterCount > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              {selectedCategoryPreview.map(category => (
                <Badge key={category} variant="secondary" className="h-5 px-1.5 text-[10px]">
                  {category}
                </Badge>
              ))}
              {selectedCategories.length > selectedCategoryPreview.length && (
                <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                  +{selectedCategories.length - selectedCategoryPreview.length} categories
                </Badge>
              )}
              {selectedPromptGroupPreview.map(promptGroup => (
                <Badge key={promptGroup} variant="outline" className="h-5 px-1.5 text-[10px] max-w-[180px] truncate">
                  {promptGroup}
                </Badge>
              ))}
              {selectedPromptGroups.length > selectedPromptGroupPreview.length && (
                <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                  +{selectedPromptGroups.length - selectedPromptGroupPreview.length} groups
                </Badge>
              )}
              {reviewFilter !== 'cool' && (
                <Badge variant="default" className="h-5 px-1.5 text-[10px]">
                  {reviewFilter}
                </Badge>
              )}
            </div>
          )}

          {filtersExpanded && (
            <div className="rounded-xl border bg-background/70 p-2.5 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Categories</span>
                <Badge variant={draftSelectedCategories.length > 0 ? 'default' : 'secondary'}>
                  {draftSelectedCategories.length > 0 ? `${draftSelectedCategories.length} selected` : 'All'}
                </Badge>
              </div>

              <div className="space-y-1.5">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">For business</div>
                <div className="flex flex-wrap gap-1.5">
                  {BUSINESS_CATEGORIES.map(category => {
                    const count = categoryCounts.get(category) || 0
                    const selected = draftSelectedCategories.includes(category)
                    return (
                      <Button
                        key={category}
                        variant={selected ? 'default' : 'outline'}
                        size="sm"
                        className="h-7 px-2 text-[11px]"
                        disabled={!selected && count === 0 && !availableCategories.has(category)}
                        onClick={() => toggleCategory(category)}
                      >
                        {category}
                        <span className="ml-1 text-[9px] opacity-70">{count}</span>
                      </Button>
                    )
                  })}
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">For home</div>
                <div className="flex flex-wrap gap-1.5">
                  {HOME_CATEGORIES.map(category => {
                    const count = categoryCounts.get(category) || 0
                    const selected = draftSelectedCategories.includes(category)
                    return (
                      <Button
                        key={category}
                        variant={selected ? 'default' : 'outline'}
                        size="sm"
                        className="h-7 px-2 text-[11px]"
                        disabled={!selected && count === 0 && !availableCategories.has(category)}
                        onClick={() => toggleCategory(category)}
                      >
                        {category}
                        <span className="ml-1 text-[9px] opacity-70">{count}</span>
                      </Button>
                    )
                  })}
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Nanobanana Prompt Group</div>
                  <Badge variant={draftSelectedPromptGroups.length > 0 ? 'default' : 'secondary'}>
                    {draftSelectedPromptGroups.length > 0 ? `${draftSelectedPromptGroups.length} selected` : 'All'}
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
                  {availablePromptGroups.map(promptGroup => {
                    const count = promptGroupCounts.get(promptGroup) || 0
                    const selected = draftSelectedPromptGroups.includes(promptGroup)
                    return (
                      <Button
                        key={promptGroup}
                        variant={selected ? 'default' : 'outline'}
                        size="sm"
                        className="h-7 px-2 text-[11px]"
                        disabled={!selected && count === 0}
                        onClick={() => togglePromptGroup(promptGroup)}
                      >
                        <span className="max-w-[160px] truncate">{promptGroup}</span>
                        <span className="ml-1 text-[9px] opacity-70">{count}</span>
                      </Button>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </header>

      <main className="container mx-auto px-4 py-3">
        {loading && (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {error && (
          <div className="p-4 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>
        )}

        {!loading && !error && productGroups.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-20 text-muted-foreground">
            <VideoIcon className="w-10 h-10" />
            <p>No videos</p>
          </div>
        )}

        {!loading && productGroups.map(({ product, groups }) => {
          const productVideoCount = groups.reduce((acc, g) => acc + g.videos.length, 0)

          return (
            <section key={product} className="mb-5">
              {/* Product header */}
              <div className="flex items-center gap-2 mb-3">
                <h2 className="text-base font-bold leading-none">{product}</h2>
                <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                  {productVideoCount} videos
                </Badge>
                <div className="flex-1 h-px bg-border" />
              </div>

              <div className="flex flex-wrap gap-2 items-start">
                {groups.map(group => (
                  <div
                    key={`${group.taskPromptGroup}-${group.taskPrompt}-${group.input1 || String(group.taskRowNumber ?? '__missing-input__')}`}
                    className="w-full lg:w-auto lg:max-w-[720px] rounded-md border bg-card/40 p-1.5"
                  >
                    <div className="flex items-center gap-1 mb-1.5 min-w-0">
                      <Badge variant="outline" className="h-4 shrink-0 text-[8px] px-1 py-0">
                        {group.taskPromptGroup}
                      </Badge>
                      <p className="text-[8px] text-muted-foreground italic line-clamp-1 min-w-0">
                        {group.taskPrompt}
                      </p>
                    </div>

                    <div className="flex gap-1.5 items-start">
                      {group.input1 && (
                        <a href={group.input1} target="_blank" rel="noopener noreferrer" className="shrink-0">
                          <img
                            src={group.input1}
                            alt="source"
                            className="w-12 h-12 object-cover rounded-md border hover:opacity-80 transition-opacity"
                          />
                        </a>
                      )}

                      <div className="grid gap-1.5 [grid-template-columns:repeat(auto-fit,minmax(132px,132px))] max-w-full">
                        {group.videos.map(video => {
                          const rowKey = String(video.row_number)
                          return (
                            <div
                              key={rowKey}
                              data-row-number={rowKey}
                              ref={node => { cardRefs.current[rowKey] = node }}
                              className="w-[132px] rounded-md overflow-hidden border bg-card shrink-0"
                            >
                              <video
                                ref={node => { videoRefs.current[rowKey] = node }}
                                src={video.result_video}
                                onEnded={() => setEndedRows(prev => {
                                  if (prev.has(rowKey)) return prev
                                  const next = new Set(prev)
                                  next.add(rowKey)
                                  return next
                                })}
                                controls
                                muted
                                playsInline
                                preload="metadata"
                                className="block w-full bg-black object-cover"
                                style={{ aspectRatio: getVideoAspectRatio(video.aspect_ratio) }}
                              />
                              <div className="p-1 space-y-1">
                                <div className="flex flex-wrap gap-1">
                                  {video.aspect_ratio && (
                                    <Badge variant="secondary" className="h-4 text-[8px] px-1 py-0">{video.aspect_ratio as string}</Badge>
                                  )}
                                  {video.review && (
                                    <Badge
                                      className={`h-4 text-[8px] px-1 py-0 ${video.review === 'cool' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}
                                    >
                                      {video.review as string}
                                    </Badge>
                                  )}
                                </div>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-5.5 w-full text-[9px]"
                                  onClick={() => handleDownload(video)}
                                >
                                  <Download className="w-3 h-3 mr-1" />
                                  Download
                                </Button>
                                {video.prompt && (
                                  <p className="text-[8px] text-muted-foreground line-clamp-1">{video.prompt as string}</p>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )
        })}
      </main>
    </div>
  )
}
