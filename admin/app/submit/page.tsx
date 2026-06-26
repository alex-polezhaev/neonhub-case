'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft, Send, RefreshCw, CheckSquare, Square, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface SubmitTask {
  row_number: string | number
  model?: string
  prompt?: string
  input1?: string
  input2?: string
  input3?: string
  input4?: string
  input5?: string
  input6?: string
  input7?: string
  input8?: string
  input9?: string
  input10?: string
  aspectRatio?: string
  imageSize?: string
  thinkingLevel?: string
  product?: string
  result_img?: string
  [key: string]: unknown
}

const INPUT_KEYS = ['input1','input2','input3','input4','input5','input6','input7','input8','input9','input10'] as const

export default function SubmitPage() {
  const [tasks, setTasks] = useState<SubmitTask[]>([])
  const [selected, setSelected] = useState<Set<string | number>>(new Set())
  const [selectCount, setSelectCount] = useState(50)
  const batchSize = 50
  const [model, setModel] = useState('gemini-3.1-flash-image-preview')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [progress, setProgress] = useState<{ sent: number; total: number } | null>(null)
  const [result, setResult] = useState<{ success: boolean; message: string; responses?: unknown[] } | null>(null)

  useEffect(() => {
    try {
      const saved = localStorage.getItem('submit_result')
      if (saved) setResult(JSON.parse(saved))
    } catch {}
  }, [])

  function saveResult(r: typeof result) {
    setResult(r)
    if (r) localStorage.setItem('submit_result', JSON.stringify(r))
    else localStorage.removeItem('submit_result')
  }

  async function fetchTasks() {
    setLoading(true)
    try {
      const res = await fetch('/api/submit/tasks')
      const data = await res.json()
      const arr: SubmitTask[] = Array.isArray(data) ? data : data.data || data.items || data.tasks || []
      setTasks(arr.filter(t => !t.job_id && !t.result_img))
      setSelected(new Set())
    } catch {
      saveResult({ success: false, message: 'Failed to load tasks' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchTasks() }, [])

  function toggleAll() {
    if (selected.size === tasks.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(tasks.map(t => t.row_number)))
    }
  }

  function selectN(n: number) {
    setSelected(new Set(tasks.slice(0, n).map(t => t.row_number)))
  }

  function toggleTask(id: string | number) {
    const next = new Set(selected)
    next.has(id) ? next.delete(id) : next.add(id)
    setSelected(next)
  }

  async function putTaskWithRetry(task: SubmitTask & { job_id: string }) {
    const MAX_RETRIES = 3
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 300_000)
      try {
        const res = await fetch('/api/submit/tasks', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(task),
          signal: controller.signal,
        })
        clearTimeout(timeout)
        if (res.ok) return
        if (attempt === MAX_RETRIES - 1) throw new Error(`PUT failed: HTTP ${res.status}`)
      } catch (e) {
        clearTimeout(timeout)
        if (attempt === MAX_RETRIES - 1) throw e
      }
    }
  }

  async function handleSubmit() {
    const toSend = tasks.filter(t => selected.has(t.row_number))
    if (!toSend.length) return

    const totalBatches = Math.ceil(toSend.length / batchSize)
    setSubmitting(true)
    saveResult(null)
    setProgress({ sent: 0, total: toSend.length })

    const responses: unknown[] = []
    try {
      for (let i = 0; i < toSend.length; i += batchSize) {
        const batch = toSend.slice(i, i + batchSize)
        const batchNum = Math.floor(i / batchSize) + 1

        const res = await fetch('/api/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model, rows: batch }),
        })
        const data = await res.json() as { job_id?: string; error?: string }
        responses.push(data)
        if (!res.ok) throw new Error(data.error || `Batch ${batchNum}/${totalBatches}: HTTP ${res.status}`)

        if (data.job_id) {
          for (const task of batch) {
            await putTaskWithRetry({ ...task, job_id: data.job_id })
          }
        }

        setProgress({ sent: Math.min(i + batchSize, toSend.length), total: toSend.length })
      }
      saveResult({ success: true, message: `Submitted ${toSend.length} tasks (${totalBatches} ${totalBatches === 1 ? 'batch' : 'batches'})`, responses })
      setSelected(new Set())
      fetchTasks()
    } catch (e) {
      saveResult({ success: false, message: String(e), responses })
    } finally {
      setSubmitting(false)
      setProgress(null)
    }
  }

  const images = (task: SubmitTask) =>
    INPUT_KEYS.map(k => task[k]).filter((v): v is string => !!v)

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/"><ArrowLeft className="w-4 h-4 mr-2" />Back</Link>
          </Button>
          <h1 className="text-xl font-semibold">Submit Job</h1>
          <Badge variant="secondary" className="ml-auto">{tasks.length} tasks</Badge>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-4">
        {/* Controls */}
        <Card>
          <CardContent className="pt-5">
            <div className="flex flex-wrap items-end gap-4">
              <div className="flex flex-col gap-1.5">
                <Label>Model</Label>
                <Select value={model} onValueChange={setModel}>
                  <SelectTrigger className="w-64">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gemini-3.1-flash-image-preview">gemini-3.1-flash-image-preview</SelectItem>
                    <SelectItem value="gemini-2.0-flash-exp">gemini-2.0-flash-exp</SelectItem>
                    <SelectItem value="gemini-2.0-flash">gemini-2.0-flash</SelectItem>
                  </SelectContent>
                </Select>
              </div>


<Button variant="outline" onClick={fetchTasks} disabled={loading}>
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>

              <Button variant="outline" onClick={toggleAll} disabled={loading || !tasks.length}>
                {selected.size === tasks.length && tasks.length > 0
                  ? <><Square className="w-4 h-4 mr-2" />Deselect all</>
                  : <><CheckSquare className="w-4 h-4 mr-2" />Select all ({tasks.length})</>
                }
              </Button>

              <div className="flex items-center gap-1.5">
                <Input
                  type="number"
                  min={1}
                  max={tasks.length || 1}
                  value={selectCount}
                  onChange={e => setSelectCount(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-20 h-9"
                />
                <Button variant="outline" onClick={() => selectN(selectCount)} disabled={loading || !tasks.length}>
                  <CheckSquare className="w-4 h-4 mr-2" />
                  Select
                </Button>
              </div>

              <Button
                size="lg"
                onClick={handleSubmit}
                disabled={selected.size === 0 || submitting}
                className="ml-auto"
              >
                {submitting
                  ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  : <Send className="w-4 h-4 mr-2" />
                }
                {submitting && progress
                  ? `Batch ${Math.floor(progress.sent / batchSize) + 1} / ${Math.ceil(progress.total / batchSize)}`
                  : `Submit ${selected.size}`
                }
              </Button>
            </div>

            {submitting && (
              <p className="mt-4 text-sm font-semibold text-red-500 animate-pulse">
                ⚠️ WARNING — DO NOT CLOSE THIS PAGE UNTIL IT FINISHES
              </p>
            )}

            {submitting && progress && (
              <div className="mt-2 space-y-1">
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Tasks submitted</span>
                  <span>{progress.sent} / {progress.total}</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-300"
                    style={{ width: `${(progress.sent / progress.total) * 100}%` }}
                  />
                </div>
              </div>
            )}

            {result && (
              <div className={`mt-4 rounded-lg overflow-hidden border ${result.success ? 'border-green-500/30' : 'border-destructive/30'}`}>
                <div className={`px-3 py-2 text-sm font-medium ${result.success ? 'bg-green-500/10 text-green-700 dark:text-green-400' : 'bg-destructive/10 text-destructive'}`}>
                  {result.message}
                </div>
                {result.responses && result.responses.length > 0 && (
                  <pre className="p-3 text-xs bg-muted overflow-x-auto whitespace-pre-wrap break-all">
                    {JSON.stringify(result.responses.length === 1 ? result.responses[0] : result.responses, null, 2)}
                  </pre>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Task list */}
        <Card>
          <CardHeader>
            <CardTitle>Tasks</CardTitle>
            <CardDescription>Selected {selected.size} of {tasks.length}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 max-h-[600px] overflow-y-auto">
            {loading && (
              <div className="flex justify-center py-10">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            )}
            {!loading && tasks.length === 0 && (
              <p className="text-sm text-muted-foreground py-4 text-center">No tasks</p>
            )}
            {!loading && tasks.map((task) => (
              <div
                key={task.row_number}
                className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                  selected.has(task.row_number)
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50'
                }`}
                onClick={() => toggleTask(task.row_number)}
              >
                <div className="flex items-start gap-3">
                  <Checkbox
                    checked={selected.has(task.row_number)}
                    onCheckedChange={() => toggleTask(task.row_number)}
                  />
                  <div className="flex gap-3 flex-1 min-w-0">
                    {/* Images */}
                    {images(task).length > 0 && (
                      <div className="flex flex-wrap gap-1.5 flex-shrink-0">
                        {images(task).map((url, i) => (
                          <img key={i} src={url} alt="" className="w-14 h-14 object-cover rounded border" />
                        ))}
                      </div>
                    )}
                    {/* Info */}
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs text-muted-foreground">#{task.row_number}</span>
                        {task.product && <span className="font-medium text-sm truncate">{task.product}</span>}
                        {task.model && <Badge variant="outline" className="text-xs">{task.model}</Badge>}
                        {task.aspectRatio && <Badge variant="secondary" className="text-xs">{task.aspectRatio}</Badge>}
                        {task.imageSize && <Badge variant="secondary" className="text-xs">{task.imageSize}</Badge>}
                        {task.thinkingLevel && <Badge variant="secondary" className="text-xs">thinking: {task.thinkingLevel}</Badge>}
                      </div>
                      {task.prompt && (
                        <p className="text-sm text-muted-foreground line-clamp-2">{task.prompt}</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
