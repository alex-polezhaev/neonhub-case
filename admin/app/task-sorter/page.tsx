'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import Link from 'next/link'
import { ArrowLeft, RefreshCw, Loader2, ImageIcon, RotateCcw, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { Idea } from '@/types'

interface SorterTask {
  row_number: string | number
  product?: string
  result_img?: string
  prompt?: string
  prompt_group?: string
  model?: string
  aspectRatio?: string
  [key: string]: unknown
}

const INPUT_KEYS = ['input1','input2','input3','input4','input5','input6','input7','input8','input9','input10'] as const

type ReviewFilter = 'pending' | 'cool' | 'defect'

const FILTERS: { value: ReviewFilter; label: string }[] = [
  { value: 'pending', label: 'No review' },
  { value: 'cool',    label: 'Cool' },
  { value: 'defect',  label: 'Defect' },
]

type PromptGroupTab = 'all' | 'jewelry'

export default function TaskSorterPage() {
  const [allTasks, setAllTasks] = useState<SorterTask[]>([])
  const [ideas, setIdeas] = useState<Idea[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<ReviewFilter>('pending')
  const [promptGroupTab, setPromptGroupTab] = useState<PromptGroupTab>('all')

  const tasks = useMemo(() => {
    return allTasks.filter(t => {
      if (!t.result_img) return false
      if (promptGroupTab === 'jewelry' && t.prompt_group?.toLowerCase() !== 'jewelry') return false
      if (filter === 'pending') return !t.review
      return t.review === filter
    })
  }, [allTasks, filter, promptGroupTab])

  async function fetchAll() {
    setLoading(true)
    setError(null)
    try {
      const [tasksRes, ideasRes] = await Promise.all([
        fetch('/api/submit/tasks'),
        fetch('/api/ideas'),
      ])
      const tasksData = await tasksRes.json()
      const ideasData = await ideasRes.json()

      const tasksArr: SorterTask[] = Array.isArray(tasksData) ? tasksData : tasksData.data || tasksData.tasks || []
      const ideasArr: Idea[] = Array.isArray(ideasData) ? ideasData : ideasData.data || ideasData.ideas || []

      setAllTasks(tasksArr.filter(t => !t.used))
      setIdeas(ideasArr)
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchAll() }, [])

  function handleRepeat(task: SorterTask) {
    const { row_number, result_img, review, used, is_main, job_id, ...rest } = task as SorterTask & { used?: unknown; is_main?: unknown; job_id?: unknown }
    void row_number; void result_img; void review; void used; void is_main; void job_id
    setAllTasks(prev => prev.map(t => t.row_number === task.row_number ? { ...t, review: 'defect' } : t))
    void fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([rest]),
    })
    void fetch('/api/submit/tasks', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ row_number: task.row_number, review: 'defect' }),
    })
  }

  const [confirmRepeat, setConfirmRepeat] = useState<SorterTask | null>(null)
  const [promptEdit, setPromptEdit] = useState<{ task: SorterTask; prompt: string } | null>(null)

  function handleEditRepeatOpen(task: SorterTask) {
    setPromptEdit({ task, prompt: (task.prompt as string) || '' })
  }

  function handleEditRepeatSubmit() {
    if (!promptEdit) return
    const task = { ...promptEdit.task, prompt: promptEdit.prompt }
    setPromptEdit(null)
    handleRepeat(task)
  }

  function handleRepeatClick(task: SorterTask) {
    setConfirmRepeat(task)
  }

  function confirmRepeatSubmit() {
    if (!confirmRepeat) return
    const task = confirmRepeat
    setConfirmRepeat(null)
    handleRepeat(task)
  }

  const [pending, setPending] = useState<{ rowNumber: string | number; review: string } | null>(null)
  const pendingTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

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
    setAllTasks(prev => prev.map(t => t.row_number === rowNumber ? { ...t, review } : t))
    try {
      await fetch('/api/submit/tasks', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ row_number: rowNumber, review }),
      })
    } catch {
      setAllTasks(prev => prev.map(t => t.row_number === rowNumber ? { ...t, review: undefined } : t))
    }
  }

  const ideasByProduct = useMemo(() => {
    const map: Record<string, Idea> = {}
    for (const idea of ideas) {
      if (idea.product && !map[idea.product]) map[idea.product] = idea
    }
    return map
  }, [ideas])

  const grouped = useMemo(() => {
    const map: Record<string, SorterTask[]> = {}
    for (const task of tasks) {
      const key = task.product || 'No product'
      if (!map[key]) map[key] = []
      map[key].push(task)
    }
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b))
  }, [tasks])

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/"><ArrowLeft className="w-4 h-4 mr-2" />Menu</Link>
          </Button>
          <h1 className="text-xl font-semibold">Photo Review</h1>
          <div className="flex rounded-lg border overflow-hidden text-sm">
            {(['all', 'jewelry'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setPromptGroupTab(tab)}
                className={`px-3 py-1.5 transition-colors ${promptGroupTab === tab ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
              >
                {tab === 'all' ? 'All' : 'Jewelry'}
              </button>
            ))}
          </div>
          <Badge variant="secondary" className="ml-1">{tasks.length} results</Badge>
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

        {!loading && !error && tasks.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-20 text-muted-foreground">
            <ImageIcon className="w-10 h-10" />
            <p>No tasks with a result</p>
          </div>
        )}

        {!loading && grouped.map(([product, items]) => {
          const idea = ideasByProduct[product]
          const inputs = idea ? INPUT_KEYS.map(k => idea[k]).filter(Boolean) : []

          return (
            <div key={product} className="mb-12">
              {/* Product header */}
              <div className="flex items-start gap-4 mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h2 className="text-lg font-semibold">{product}</h2>
                    <Badge variant="secondary">{items.length}</Badge>
                    <div className="flex-1 h-px bg-border" />
                  </div>
                  {inputs.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {inputs.map((url, i) => (
                        <a key={i} href={url as string} target="_blank" rel="noopener noreferrer">
                          <img
                            src={url as string}
                            alt=""
                            className="w-16 h-16 object-cover rounded border hover:opacity-80 transition-opacity"
                          />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Results grid */}
              <div className={`grid gap-3 ${promptGroupTab === 'jewelry' ? 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4' : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6'}`}>
                {items.map(task => (
                  <div key={task.row_number} className="group rounded-lg overflow-hidden border bg-card">
                    <a href={task.result_img as string} target="_blank" rel="noopener noreferrer">
                      <img
                        src={task.result_img as string}
                        alt={task.product || ''}
                        className="w-full aspect-square object-cover group-hover:opacity-90 transition-opacity"
                      />
                    </a>
                    <div className="p-2 space-y-2">
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleRepeatClick(task)}
                          title="Repeat"
                          className="flex items-center justify-center rounded-md py-2 px-3 active:scale-95 transition-all bg-yellow-400 hover:bg-yellow-500 text-yellow-900"
                        >
                          <RotateCcw className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleEditRepeatOpen(task)}
                          title="Repeat with prompt editing"
                          className="flex items-center justify-center rounded-md py-2 px-3 active:scale-95 transition-all bg-blue-500 hover:bg-blue-600 text-white"
                        >
                          <Pencil className="w-5 h-5" />
                        </button>
                        {(['cool', 'defect'] as const).map(rev => {
                          const isGreen = rev === 'cool'
                          const isArmed = pending?.rowNumber === task.row_number && pending?.review === rev
                          return (
                            <button
                              key={rev}
                              onClick={() => handleReviewClick(task.row_number, rev)}
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
                        {task.prompt_group && <Badge variant="outline" className="text-xs">{task.prompt_group as string}</Badge>}
                        {task.aspectRatio && <Badge variant="secondary" className="text-xs">{task.aspectRatio as string}</Badge>}
                        {task.imageSize && <Badge variant="secondary" className="text-xs">{task.imageSize as string}</Badge>}
                        {task.thinkingLevel && <Badge variant="secondary" className="text-xs">{task.thinkingLevel as string}</Badge>}
                      </div>
                      {task.prompt && (
                        <p className="text-xs text-muted-foreground line-clamp-2">{task.prompt as string}</p>
                      )}
                      {(() => {
                        const imgs = INPUT_KEYS.map(k => task[k] as string).filter(Boolean)
                        return imgs.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {imgs.map((url, i) => (
                              <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                                <img src={url} alt="" className="w-8 h-8 object-cover rounded border hover:opacity-80 transition-opacity" />
                              </a>
                            ))}
                          </div>
                        ) : null
                      })()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </main>

      {confirmRepeat && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card rounded-xl shadow-xl w-full max-w-sm mx-4 p-5 space-y-4">
            <h2 className="text-base font-semibold">Repeat task?</h2>
            {confirmRepeat.prompt && (
              <p className="text-sm text-muted-foreground line-clamp-3">{confirmRepeat.prompt as string}</p>
            )}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmRepeat(null)}
                className="rounded-md px-4 py-2 text-sm border hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmRepeatSubmit}
                className="rounded-md px-4 py-2 text-sm bg-yellow-400 hover:bg-yellow-500 text-yellow-900 font-medium transition-colors"
              >
                Repeat
              </button>
            </div>
          </div>
        </div>
      )}

      {promptEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card rounded-xl shadow-xl w-full max-w-lg mx-4 p-5 space-y-4">
            <h2 className="text-base font-semibold">Edit prompt</h2>
            <textarea
              className="w-full rounded-md border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={6}
              value={promptEdit.prompt}
              onChange={e => setPromptEdit(prev => prev ? { ...prev, prompt: e.target.value } : null)}
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setPromptEdit(null)}
                className="rounded-md px-4 py-2 text-sm border hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleEditRepeatSubmit}
                className="rounded-md px-4 py-2 text-sm bg-blue-500 hover:bg-blue-600 text-white transition-colors"
              >
                Submit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
