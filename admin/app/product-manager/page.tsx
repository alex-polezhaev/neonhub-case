'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { ArrowLeft, RefreshCw, Loader2, ImageIcon, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { Idea } from '@/types'

interface PmTask {
  row_number: string | number
  product?: string
  result_img?: string
  review?: string
  prompt_group?: string
  prompt?: string
  is_main?: boolean
  [key: string]: unknown
}

interface Variant {
  product: string
  color: string
  img1: string
  img2: string
  img3: string
}

async function putTask(rowNumber: string | number, patch: object) {
  await fetch('/api/submit/tasks', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ row_number: rowNumber, ...patch }),
  })
}

function buildGrouped(tasks: PmTask[]) {
  const byProduct: Record<string, Record<string, PmTask[]>> = {}
  for (const task of tasks) {
    const product = task.product || 'No product'
    const group = task.prompt_group || 'No group'
    if (!byProduct[product]) byProduct[product] = {}
    if (!byProduct[product][group]) byProduct[product][group] = []
    byProduct[product][group].push(task)
  }
  return Object.entries(byProduct)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([product, groups]) => ({
      product,
      groups: Object.entries(groups).sort(([a], [b]) => a.localeCompare(b)),
      total: Object.values(groups).reduce((s, g) => s + g.length, 0),
    }))
}

function TaskCard({ task, onToggleMain }: {
  task: PmTask
  onToggleMain: (rowNumber: string | number, current: boolean) => void
}) {
  return (
    <div className={`group rounded-lg overflow-hidden border bg-card transition-colors ${
      task.is_main ? 'border-yellow-400 ring-2 ring-yellow-300' : 'hover:border-green-400'
    }`}>
      <a href={task.result_img} target="_blank" rel="noopener noreferrer">
        <img
          src={task.result_img}
          alt={task.product || ''}
          className="w-full aspect-square object-cover group-hover:opacity-90 transition-opacity"
        />
      </a>
      <div className="p-1.5 space-y-1">
        <label className="flex items-center gap-1.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={!!task.is_main}
            onChange={() => onToggleMain(task.row_number, !!task.is_main)}
            className="w-3.5 h-3.5 accent-yellow-400"
          />
          <span className="text-xs font-medium text-muted-foreground">Main</span>
        </label>
        {task.prompt && (
          <p className="text-xs text-muted-foreground line-clamp-2">{task.prompt}</p>
        )}
      </div>
    </div>
  )
}

function ProductList({ grouped, onToggleMain }: {
  grouped: ReturnType<typeof buildGrouped>
  onToggleMain: (rowNumber: string | number, current: boolean) => void
}) {
  if (grouped.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-20 text-muted-foreground">
        <ImageIcon className="w-10 h-10" />
        <p>No products</p>
      </div>
    )
  }
  return (
    <>
      {grouped.map(({ product, groups, total }) => (
        <div key={product} className="mb-12">
          <div className="flex items-center gap-3 mb-5">
            <h2 className="text-xl font-bold">{product}</h2>
            <Badge variant="secondary">{total} photos</Badge>
            <div className="flex-1 h-px bg-border" />
          </div>
          <div className="space-y-6">
            {groups.map(([groupName, items]) => (
              <div key={groupName}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    {groupName}
                  </span>
                  <Badge variant="outline" className="text-xs">{items.length}</Badge>
                  <div className="flex-1 h-px bg-border/50" />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                  {items.map(task => (
                    <TaskCard key={task.row_number} task={task} onToggleMain={onToggleMain} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </>
  )
}

// ── New Variant tab ────────────────────────────────────────────────────────────

interface VariantProductState {
  product: string
  tasks: PmTask[]
  selected: string[] // ordered list of result_img URLs
  saving: boolean
  saved: boolean
}

function VariantProductCard({
  state,
  onToggle,
  onSelectAll,
  onSave,
}: {
  state: VariantProductState
  onToggle: (product: string, url: string) => void
  onSelectAll: (product: string) => void
  onSave: (product: string) => void
}) {
  const { product, tasks, selected, saving, saved } = state
  const allSelected = tasks.length > 0 && tasks.every(t => selected.includes(t.result_img!))

  return (
    <div className={`mb-12 rounded-xl border p-5 bg-card transition-all ${saved ? 'border-green-400 bg-green-50/20' : ''}`}>
      <div className="flex items-center gap-3 mb-4">
        <h2 className="text-xl font-bold">{product}</h2>
        <Badge variant="secondary">{tasks.length} photos</Badge>
        {selected.length > 0 && (
          <Badge variant="outline">{selected.length} selected</Badge>
        )}
        <div className="flex-1 h-px bg-border" />
        {saved ? (
          <Badge className="bg-green-500 text-white">Created</Badge>
        ) : (
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onSelectAll(product)}
              disabled={saving}
            >
              {allSelected ? 'Deselect all' : 'Select all'}
            </Button>
            <Button
              size="sm"
              onClick={() => onSave(product)}
              disabled={selected.length === 0 || saving}
            >
              {saving
                ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                : <Send className="w-3.5 h-3.5 mr-1.5" />}
              Create variant
            </Button>
          </>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
        {tasks.map(task => {
          const url = task.result_img!
          const idx = selected.indexOf(url)
          const isSelected = idx !== -1

          return (
            <div
              key={task.row_number}
              onClick={() => !saved && onToggle(product, url)}
              className={`relative rounded-lg overflow-hidden border-2 bg-card cursor-pointer transition-all select-none ${
                isSelected
                  ? 'border-orange-500 ring-2 ring-orange-400'
                  : task.is_main
                  ? 'border-yellow-400 ring-2 ring-yellow-300'
                  : 'border-transparent hover:border-muted-foreground'
              } ${saved ? 'pointer-events-none' : ''}`}
            >
              <img
                src={url}
                alt={product}
                className="w-full aspect-square object-cover"
              />
              {task.is_main && !isSelected && (
                <div className="absolute top-1.5 left-1.5 w-5 h-5 rounded-full bg-yellow-400 border-2 border-yellow-500" />
              )}
              {isSelected && (
                <div className="absolute top-1 left-1 min-w-[28px] h-7 px-1.5 rounded-full bg-orange-500 text-white text-sm font-black flex items-center justify-center shadow-lg ring-2 ring-white">
                  {idx + 1}
                </div>
              )}
              <div className={`absolute top-1.5 right-1.5 w-4 h-4 rounded border-2 transition-all ${
                isSelected ? 'bg-orange-500 border-orange-500' : 'bg-white/70 border-white'
              }`} />
            </div>
          )
        })}
      </div>
    </div>
  )
}

function VariantTab({ tasks, variants }: { tasks: PmTask[]; variants: Variant[] }) {
  const variantProducts = useMemo(() => new Set(variants.map(v => v.product)), [variants])

  const eligibleProducts = useMemo(() => {
    const byProduct: Record<string, PmTask[]> = {}
    for (const t of tasks) {
      if (!t.product || !t.result_img) continue
      if (!byProduct[t.product]) byProduct[t.product] = []
      byProduct[t.product].push(t)
    }

    return Object.entries(byProduct)
      .filter(([product, pts]) => {
        if (variantProducts.has(product)) return false
        const mainCount = pts.filter(t => t.is_main).length
        const interiorCount = pts.filter(t => t.prompt_group?.toLowerCase() === 'interior').length
        return mainCount >= 1 && interiorCount >= 2
      })
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([product, pts]) => ({
        product,
        tasks: pts.filter(t => t.prompt_group?.toLowerCase() !== 'idea' || t.is_main),
      }))
  }, [tasks, variantProducts])

  const [states, setStates] = useState<Record<string, VariantProductState>>({})

  useEffect(() => {
    setStates(prev => {
      const next: Record<string, VariantProductState> = {}
      for (const { product, tasks: pts } of eligibleProducts) {
        next[product] = prev[product] ?? { product, tasks: pts, selected: [], saving: false, saved: false }
        next[product].tasks = pts
      }
      return next
    })
  }, [eligibleProducts])

  function togglePhoto(product: string, url: string) {
    setStates(prev => {
      const s = prev[product]
      if (!s) return prev
      const idx = s.selected.indexOf(url)
      const selected = idx === -1
        ? [...s.selected, url].slice(0, 10)
        : s.selected.filter(u => u !== url)
      return { ...prev, [product]: { ...s, selected } }
    })
  }

  function selectAll(product: string) {
    setStates(prev => {
      const s = prev[product]
      if (!s) return prev
      const allUrls = s.tasks.map(t => t.result_img!).filter(Boolean)
      const allSelected = allUrls.every(u => s.selected.includes(u))
      return {
        ...prev,
        [product]: { ...s, selected: allSelected ? [] : allUrls.slice(0, 10) },
      }
    })
  }

  async function saveVariant(product: string) {
    const s = states[product]
    if (!s || s.selected.length === 0) return
    setStates(prev => ({ ...prev, [product]: { ...prev[product], saving: true } }))
    const body: Record<string, string> = { product }
    s.selected.forEach((url, i) => { body[`img${i + 1}`] = url })
    try {
      await fetch('/api/variants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      setStates(prev => ({ ...prev, [product]: { ...prev[product], saving: false, saved: true } }))
    } catch {
      setStates(prev => ({ ...prev, [product]: { ...prev[product], saving: false } }))
    }
  }

  if (eligibleProducts.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-20 text-muted-foreground">
        <ImageIcon className="w-10 h-10" />
        <p>No products without a variant</p>
      </div>
    )
  }

  return (
    <>
      {eligibleProducts.map(({ product }) => {
        const s = states[product]
        if (!s) return null
        return (
          <VariantProductCard
            key={product}
            state={s}
            onToggle={togglePhoto}
            onSelectAll={selectAll}
            onSave={saveVariant}
          />
        )
      })}
    </>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function ProductManagerPage() {
  const [tasks, setTasks] = useState<PmTask[]>([])
  const [ideas, setIdeas] = useState<Idea[]>([])
  const [variants, setVariants] = useState<Variant[]>([])
  const [loading, setLoading] = useState(true)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const [tasksRes, ideasRes, variantsRes] = await Promise.all([
        fetch('/api/submit/tasks'),
        fetch('/api/ideas'),
        fetch('/api/variants'),
      ])
      const tasksData = await tasksRes.json()
      const ideasData = await ideasRes.json()
      const variantsData = await variantsRes.json()
      const tasksArr: PmTask[] = Array.isArray(tasksData) ? tasksData : tasksData.data || tasksData.tasks || []
      const ideasArr: Idea[] = Array.isArray(ideasData) ? ideasData : ideasData.data || ideasData.ideas || []
      const variantsArr: Variant[] = Array.isArray(variantsData) ? variantsData : variantsData.data || []
      setTasks(tasksArr.filter(t => t.result_img && t.review === 'cool'))
      setIdeas(ideasArr)
      setVariants(variantsArr)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const handleToggleMain = useCallback((rowNumber: string | number, current: boolean) => {
    const next = !current
    setTasks(prev => prev.map(t => t.row_number === rowNumber ? { ...t, is_main: next } : t))
    putTask(rowNumber, { is_main: next }).catch(() =>
      setTasks(prev => prev.map(t => t.row_number === rowNumber ? { ...t, is_main: current } : t))
    )
  }, [])

  const allGrouped = useMemo(() => buildGrouped(tasks), [tasks])

  const needsInteriorGrouped = useMemo(() => {
    const ideaProducts = new Set(ideas.map(i => i.product).filter(Boolean))
    const interiorCountByProduct: Record<string, number> = {}
    for (const t of tasks) {
      if (t.product && ideaProducts.has(t.product) && t.prompt_group?.toLowerCase() === 'interior') {
        interiorCountByProduct[t.product] = (interiorCountByProduct[t.product] || 0) + 1
      }
    }
    const underThreshold = new Set(
      [...ideaProducts].filter(p => (interiorCountByProduct[p] ?? 0) < 2)
    )
    const filtered = tasks.filter(t =>
      t.product && underThreshold.has(t.product) && t.is_main
    )
    return buildGrouped(filtered)
  }, [tasks, ideas])

  const needsMainGrouped = useMemo(() => {
    const ideaProducts = new Set(ideas.map(i => i.product).filter(Boolean))
    const mainProducts = new Set(tasks.filter(t => t.is_main).map(t => t.product).filter(Boolean))
    const filtered = tasks.filter(t =>
      t.product &&
      ideaProducts.has(t.product) &&
      !mainProducts.has(t.product) &&
      t.prompt_group?.toLowerCase() === 'idea'
    )
    return buildGrouped(filtered)
  }, [tasks, ideas])

  const variantNeededCount = useMemo(() => {
    const variantProducts = new Set(variants.map(v => v.product))
    const byProduct: Record<string, PmTask[]> = {}
    for (const t of tasks) {
      if (!t.product || !t.result_img) continue
      if (!byProduct[t.product]) byProduct[t.product] = []
      byProduct[t.product].push(t)
    }
    return Object.entries(byProduct).filter(([product, pts]) => {
      if (variantProducts.has(product)) return false
      return pts.filter(t => t.is_main).length >= 1 && pts.filter(t => t.prompt_group?.toLowerCase() === 'interior').length >= 2
    }).length
  }, [tasks, variants])

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/"><ArrowLeft className="w-4 h-4 mr-2" />Menu</Link>
          </Button>
          <h1 className="text-xl font-semibold">Product Manager</h1>
          <Button variant="outline" size="sm" onClick={fetchAll} disabled={loading} className="ml-auto">
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        {loading && (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {!loading && (
          <Tabs defaultValue="needs-main">
            <TabsList className="mb-6">
              <TabsTrigger value="needs-main">
                Needs main
                <Badge variant="secondary" className="ml-2">{needsMainGrouped.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="needs-interior">
                Needs interior
                <Badge variant="secondary" className="ml-2">{needsInteriorGrouped.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="needs-variant">
                Needs variant
                <Badge variant="secondary" className="ml-2">{variantNeededCount}</Badge>
              </TabsTrigger>
              <TabsTrigger value="all">
                All products
                <Badge variant="secondary" className="ml-2">{allGrouped.length}</Badge>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="needs-main">
              <ProductList grouped={needsMainGrouped} onToggleMain={handleToggleMain} />
            </TabsContent>

            <TabsContent value="needs-interior">
              <ProductList grouped={needsInteriorGrouped} onToggleMain={handleToggleMain} />
            </TabsContent>

            <TabsContent value="needs-variant">
              <VariantTab tasks={tasks} variants={variants} />
            </TabsContent>

            <TabsContent value="all">
              <ProductList grouped={allGrouped} onToggleMain={handleToggleMain} />
            </TabsContent>
          </Tabs>
        )}
      </main>
    </div>
  )
}
