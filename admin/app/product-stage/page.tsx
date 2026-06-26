'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { ArrowLeft, RefreshCw, Loader2, ImageIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface StageTask {
  row_number: string | number
  product?: string
  result_img?: string
  review?: string
  is_main?: boolean
  [key: string]: unknown
}

type ReviewFilter = 'all' | 'pending' | 'cool' | 'defect'

const REVIEW_FILTERS: { value: ReviewFilter; label: string }[] = [
  { value: 'all',     label: 'All' },
  { value: 'pending', label: 'No review' },
  { value: 'cool',    label: 'Cool' },
  { value: 'defect',  label: 'Defect' },
]

export default function ProductStagePage() {
  const [tasks, setTasks] = useState<StageTask[]>([])
  const [loading, setLoading] = useState(true)
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>('all')
  const [hideMain, setHideMain] = useState(false)

  const fetchTasks = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/submit/tasks')
      const data = await res.json()
      const arr: StageTask[] = Array.isArray(data) ? data : data.data || data.tasks || []
      setTasks(arr.filter(t => t.result_img))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchTasks() }, [fetchTasks])

  const toggleMain = useCallback((rowNumber: string | number, current: boolean) => {
    const next = !current
    setTasks(prev => prev.map(t => t.row_number === rowNumber ? { ...t, is_main: next } : t))
    fetch('/api/submit/tasks', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ row_number: rowNumber, is_main: next }),
    }).catch(() =>
      setTasks(prev => prev.map(t => t.row_number === rowNumber ? { ...t, is_main: current } : t))
    )
  }, [])

  const visibleTasks = useMemo(() => tasks.filter(t =>
    reviewFilter === 'all' ? true : reviewFilter === 'pending' ? !t.review : t.review === reviewFilter
  ), [tasks, reviewFilter])

  const grouped = useMemo(() => {
    const map: Record<string, StageTask[]> = {}
    for (const task of visibleTasks) {
      const key = task.product || 'No product'
      if (!map[key]) map[key] = []
      map[key].push(task)
    }
    const entries = Object.entries(map).sort(([a], [b]) => a.localeCompare(b))
    if (!hideMain) return entries
    return entries.filter(([, items]) => items.every(t => !t.is_main))
  }, [visibleTasks, hideMain])

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/"><ArrowLeft className="w-4 h-4 mr-2" />Menu</Link>
          </Button>
          <h1 className="text-xl font-semibold">Product Stage</h1>
          <Badge variant="secondary" className="ml-1">{visibleTasks.length} photos</Badge>
          <div className="ml-auto flex items-center gap-2">
            <div className="flex rounded-lg border overflow-hidden text-sm">
              {REVIEW_FILTERS.map(f => (
                <button
                  key={f.value}
                  onClick={() => setReviewFilter(f.value)}
                  className={`px-3 py-1.5 transition-colors ${
                    reviewFilter === f.value
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
            <button
              onClick={() => setHideMain(v => !v)}
              className={`px-3 py-1.5 rounded-lg border text-sm transition-colors ${
                hideMain ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-muted'
              }`}
            >
              No is_main
            </button>
          </div>
          <Button variant="outline" size="sm" onClick={fetchTasks} disabled={loading}>
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

        {!loading && tasks.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-20 text-muted-foreground">
            <ImageIcon className="w-10 h-10" />
            <p>No photos</p>
          </div>
        )}

        {!loading && grouped.map(([product, items]) => (
          <div key={product} className="mb-10">
            <div className="flex items-center gap-3 mb-4">
              <h2 className="text-lg font-semibold">{product}</h2>
              <Badge variant="secondary">{items.length}</Badge>
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted-foreground">
                {items.filter(t => t.is_main).length} main
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              {items.map(task => (
                <div
                  key={task.row_number}
                  className={`rounded-lg overflow-hidden border bg-card transition-all ${
                    task.is_main ? 'border-yellow-400 ring-2 ring-yellow-300' : ''
                  }`}
                >
                  <a href={task.result_img} target="_blank" rel="noopener noreferrer">
                    <img
                      src={task.result_img}
                      alt={task.product || ''}
                      className="w-full aspect-square object-cover hover:opacity-90 transition-opacity"
                    />
                  </a>
                  <div className="p-1.5">
                    <label className="flex items-center gap-1.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={!!task.is_main}
                        onChange={() => toggleMain(task.row_number, !!task.is_main)}
                        className="w-3.5 h-3.5 accent-yellow-400"
                      />
                      <span className="text-xs font-medium text-muted-foreground">Main</span>
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </main>
    </div>
  )
}
