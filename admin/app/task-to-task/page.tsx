'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { AuthGuard } from '@/components/auth-guard'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { FieldGroup, Field, FieldLabel } from '@/components/ui/field'
import {
  ArrowLeft,
  FileText,
  Send,
  CheckSquare,
  Square,
  Loader2,
  Calculator,
  ImageIcon,
} from 'lucide-react'
import type { PromptTemplate } from '@/types'

const INPUT_KEYS = ['input1','input2','input3','input4','input5','input6','input7','input8','input9','input10'] as const

interface SourceTask {
  row_number: string | number
  product?: string
  result_img?: string
  review?: string
  prompt_group?: string
  is_main?: boolean
  used?: unknown
  [key: string]: unknown
}

type ReviewFilter = 'all' | 'pending' | 'cool' | 'defect'

const REVIEW_FILTERS: { value: ReviewFilter; label: string }[] = [
  { value: 'all',     label: 'All' },
  { value: 'pending', label: 'No review' },
  { value: 'cool',    label: 'Cool' },
  { value: 'defect',  label: 'Defect' },
]

function TaskToTaskContent() {
  const [sourceTasks, setSourceTasks] = useState<SourceTask[]>([])
  const [allTasksRaw, setAllTasksRaw] = useState<SourceTask[]>([])
  const [prompts, setPrompts] = useState<PromptTemplate[]>([])
  const [selectedTasks, setSelectedTasks] = useState<Set<string | number>>(new Set())
  const [selectedPrompts, setSelectedPrompts] = useState<Set<string>>(new Set())
  const [promptOverrides, setPromptOverrides] = useState<Map<string, {
    prompt: string; thinkingLevel: string; imageSize: string; aspectRatio: string
  }>>(new Map())
  const [duplicates, setDuplicates] = useState(1)
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>('cool')
  const [randomizePrompts, setRandomizePrompts] = useState(false)
  const [randomPromptCount, setRandomPromptCount] = useState(3)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)

  useEffect(() => {
    async function fetchData() {
      try {
        const [tasksRes, promptsRes] = await Promise.all([
          fetch('/api/submit/tasks'),
          fetch('/api/prompts'),
        ])
        const tasksData = await tasksRes.json()
        const promptsData = await promptsRes.json()

        const tasksArr: SourceTask[] = Array.isArray(tasksData) ? tasksData : tasksData.data || tasksData.tasks || []
        const promptsRaw = Array.isArray(promptsData) ? promptsData : promptsData.data || promptsData.prompts || []
        const promptsArray = promptsRaw.map((p: PromptTemplate & { row_number?: string | number }) => ({
          ...p,
          id: String(p.row_number ?? p.id),
        }))

        setAllTasksRaw(tasksArr)
        setSourceTasks(tasksArr.filter(t => t.result_img))
        setPrompts(promptsArray)
      } catch (error) {
        console.error('Error fetching data:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const visibleTasks = useMemo(() => {
    return sourceTasks.filter(t => {
const reviewOk = reviewFilter === 'all'
        ? true
        : reviewFilter === 'pending'
        ? !t.review
        : t.review === reviewFilter
      return reviewOk
    })
  }, [sourceTasks, reviewFilter])

  // products that have a person task that is cool OR in progress (no result_img)
  const productsWithPersonCoolOrInProgress = useMemo(() => {
    const set = new Set<string>()
    for (const t of allTasksRaw) {
      if (t.prompt_group?.toLowerCase() === 'person') {
        if (t.review === 'cool' || !t.result_img) {
          set.add(t.product || '')
        }
      }
    }
    return set
  }, [allTasksRaw])

  // is_main idea+cool tasks for products that still need a person task
  const needsPersonTasks = useMemo(() =>
    sourceTasks.filter(t =>
      t.is_main &&
      t.prompt_group?.toLowerCase() === 'idea' &&
      t.review === 'cool' &&
      !productsWithPersonCoolOrInProgress.has(t.product || '')
    )
  , [sourceTasks, productsWithPersonCoolOrInProgress])

  const selectAllNeedsPerson = useCallback(() => {
    if (needsPersonTasks.every(t => selectedTasks.has(t.row_number))) {
      setSelectedTasks(new Set())
    } else {
      setSelectedTasks(new Set(needsPersonTasks.map(t => t.row_number)))
    }
  }, [needsPersonTasks, selectedTasks])

  // cool interior count per product
  const interiorByProduct = useMemo(() => {
    const map: Record<string, SourceTask[]> = {}
    for (const t of sourceTasks) {
      if (t.review === 'cool' && t.prompt_group?.toLowerCase() === 'interior') {
        if (!map[t.product || '']) map[t.product || ''] = []
        map[t.product || ''].push(t)
      }
    }
    return map
  }, [sourceTasks])

  // products that still have tasks without result or review
  const pendingProducts = useMemo(() => {
    const set = new Set<string>()
    for (const t of allTasksRaw) {
      if (!t.result_img || !t.review) set.add(t.product || '')
    }
    return set
  }, [allTasksRaw])

  // is_main tasks where product has <2 cool interior tasks and no pending tasks
  const needsInteriorTasks = useMemo(() =>
    sourceTasks.filter(t =>
      t.is_main &&
      (interiorByProduct[t.product || '']?.length ?? 0) < 2 &&
      !pendingProducts.has(t.product || '')
    )
  , [sourceTasks, interiorByProduct, pendingProducts])

  const selectAllNeedsInterior = useCallback(() => {
    if (needsInteriorTasks.every(t => selectedTasks.has(t.row_number))) {
      setSelectedTasks(new Set())
    } else {
      setSelectedTasks(new Set(needsInteriorTasks.map(t => t.row_number)))
    }
  }, [needsInteriorTasks, selectedTasks])

  const groupedPrompts = useMemo(() => {
    const groups: Record<string, PromptTemplate[]> = {}
    prompts.forEach(prompt => {
      const groupName = prompt.group || 'Ungrouped'
      if (!groups[groupName]) groups[groupName] = []
      groups[groupName].push(prompt)
    })
    return groups
  }, [prompts])

  const effectivePromptCount = randomizePrompts
    ? Math.min(randomPromptCount, selectedPrompts.size)
    : selectedPrompts.size

  const totalTasks = useMemo(
    () => selectedTasks.size * effectivePromptCount * duplicates,
    [selectedTasks.size, effectivePromptCount, duplicates]
  )

  const toggleTask = (id: string | number) => {
    const next = new Set(selectedTasks)
    next.has(id) ? next.delete(id) : next.add(id)
    setSelectedTasks(next)
  }

  const initOverride = (p: PromptTemplate) => ({
    prompt: p.prompt,
    thinkingLevel: p.thinkingLevel ?? '',
    imageSize: p.imageSize ?? '',
    aspectRatio: p.aspectRatio ?? '',
  })

  const setPromptOverrideField = (id: string, field: 'prompt' | 'thinkingLevel' | 'imageSize' | 'aspectRatio', value: string) => {
    setPromptOverrides(prev => {
      const next = new Map(prev)
      const cur = next.get(id)
      if (cur) next.set(id, { ...cur, [field]: value })
      return next
    })
  }

  const togglePrompt = (id: string, prompt?: PromptTemplate) => {
    const next = new Set(selectedPrompts)
    if (next.has(id)) {
      next.delete(id)
    } else {
      next.add(id)
      if (prompt && !promptOverrides.has(id)) {
        setPromptOverrides(prev => new Map(prev).set(id, initOverride(prompt)))
      }
    }
    setSelectedPrompts(next)
  }

  const selectAllTasks = () => {
    if (selectedTasks.size === visibleTasks.length) {
      setSelectedTasks(new Set())
    } else {
      setSelectedTasks(new Set(visibleTasks.map(t => t.row_number)))
    }
  }

  const selectAllPrompts = () => {
    if (selectedPrompts.size === prompts.length) {
      setSelectedPrompts(new Set())
    } else {
      setSelectedPrompts(new Set(prompts.map(p => p.id)))
      setPromptOverrides(prev => {
        const next = new Map(prev)
        prompts.forEach(p => { if (!next.has(p.id)) next.set(p.id, initOverride(p)) })
        return next
      })
    }
  }

  const toggleGroup = (groupName: string) => {
    const groupPrompts = groupedPrompts[groupName] || []
    const groupIds = groupPrompts.map(p => p.id)
    const allSelected = groupIds.every(id => selectedPrompts.has(id))
    const next = new Set(selectedPrompts)
    if (allSelected) {
      groupIds.forEach(id => next.delete(id))
    } else {
      groupIds.forEach(id => next.add(id))
      setPromptOverrides(prev => {
        const map = new Map(prev)
        groupPrompts.forEach(p => { if (!map.has(p.id)) map.set(p.id, initOverride(p)) })
        return map
      })
    }
    setSelectedPrompts(next)
  }

  const isGroupSelected = (groupName: string): 'all' | 'some' | 'none' => {
    const groupIds = (groupedPrompts[groupName] || []).map(p => p.id)
    const count = groupIds.filter(id => selectedPrompts.has(id)).length
    if (count === 0) return 'none'
    if (count === groupIds.length) return 'all'
    return 'some'
  }

  const handleSubmit = async () => {
    if (totalTasks === 0) return
    setSubmitting(true)
    setResult(null)

    const selectedTasksArray = sourceTasks.filter(t => selectedTasks.has(t.row_number))
    const allSelectedPrompts = prompts.filter(p => selectedPrompts.has(p.id))
    const selectedPromptsArray = randomizePrompts && randomPromptCount < allSelectedPrompts.length
      ? allSelectedPrompts.sort(() => Math.random() - 0.5).slice(0, randomPromptCount)
      : allSelectedPrompts

    const payload: object[] = []
    for (const task of selectedTasksArray) {
      for (const prompt of selectedPromptsArray) {
        for (let d = 0; d < duplicates; d++) {
          const chain = [
            ...INPUT_KEYS.map(k => prompt[k as keyof PromptTemplate] as string).filter(Boolean),
            task.result_img!,
          ]
          const inputs = Object.fromEntries(INPUT_KEYS.map((k, i) => [k, chain[i] ?? '']))
          const ov = promptOverrides.get(prompt.id)
          payload.push({
            prompt: ov?.prompt ?? prompt.prompt,
            product: task.product,
            ...inputs,
            aspectRatio: ov?.aspectRatio ?? prompt.aspectRatio,
            imageSize: ov?.imageSize ?? prompt.imageSize,
            thinkingLevel: ov?.thinkingLevel ?? prompt.thinkingLevel,
            prompt_group: prompt.group,
          })
        }
      }
    }

    const BATCH_SIZE = 500
    try {
      setProgress({ done: 0, total: payload.length })
      for (let i = 0; i < payload.length; i += BATCH_SIZE) {
        const batch = payload.slice(i, i + BATCH_SIZE)
        const response = await fetch('/api/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(batch),
        })
        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || `HTTP ${response.status}`)
        }
        setProgress({ done: Math.min(i + BATCH_SIZE, payload.length), total: payload.length })
      }

      setSelectedTasks(new Set())
      setSelectedPrompts(new Set())
      setDuplicates(1)
      setResult({ success: true, message: `Created ${payload.length} tasks` })
    } catch (error) {
      setResult({ success: false, message: String(error) })
    } finally {
      setSubmitting(false)
      setProgress(null)
    }
  }

  const promptsPanel = (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-500" />
            <CardTitle>Prompts</CardTitle>
            <Badge variant="secondary">{prompts.length}</Badge>
          </div>
          <Button variant="outline" size="sm" onClick={selectAllPrompts}>
            {selectedPrompts.size === prompts.length
              ? <><Square className="w-4 h-4 mr-2" />Deselect all</>
              : <><CheckSquare className="w-4 h-4 mr-2" />Select all</>
            }
          </Button>
        </div>
        <CardDescription>Select prompts to apply to tasks</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 max-h-[500px] overflow-y-auto">
        {Object.entries(groupedPrompts).map(([groupName, groupPrompts]) => {
          const groupState = isGroupSelected(groupName)
          return (
            <div key={groupName} className="space-y-2">
              <div
                className="flex items-center gap-2 sticky top-0 bg-card py-2 z-[1] cursor-pointer hover:bg-muted/50 rounded-md px-2 -mx-2 transition-colors"
                onClick={() => toggleGroup(groupName)}
              >
                <Checkbox
                  checked={groupState === 'all'}
                  ref={(el) => {
                    if (el) (el as HTMLButtonElement & { indeterminate: boolean }).indeterminate = groupState === 'some'
                  }}
                  onCheckedChange={() => toggleGroup(groupName)}
                  onClick={e => e.stopPropagation()}
                />
                <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{groupName}</span>
                <Badge variant="secondary" className="text-xs">
                  {groupPrompts.filter(p => selectedPrompts.has(p.id)).length}/{groupPrompts.length}
                </Badge>
                <Separator className="flex-1" />
              </div>
              <div className="space-y-2 pl-2 border-l-2 border-muted">
                {groupPrompts.map((prompt, idx) => {
                  const isSelected = selectedPrompts.has(prompt.id)
                  return (
                    <div
                      key={prompt.id ?? `${groupName}-${idx}`}
                      className={`p-4 rounded-lg border transition-colors ${
                        isSelected ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 cursor-pointer'
                      }`}
                      onClick={() => !isSelected && togglePrompt(prompt.id, prompt)}
                    >
                      <div className="flex items-start gap-3">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => togglePrompt(prompt.id, prompt)}
                          onClick={e => e.stopPropagation()}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="font-medium">{prompt.name}</span>
                            <Badge variant="outline" className="text-xs">{prompt.model}</Badge>
                          </div>
                          {isSelected ? (
                            <div className="space-y-2 mb-2" onClick={e => e.stopPropagation()}>
                              <Textarea
                                value={promptOverrides.get(prompt.id)?.prompt ?? prompt.prompt}
                                onChange={e => setPromptOverrideField(prompt.id, 'prompt', e.target.value)}
                                className="text-sm min-h-[80px]"
                              />
                              <div className="grid grid-cols-3 gap-2">
                                <div>
                                  <p className="text-xs text-muted-foreground mb-1">thinking</p>
                                  <Input value={promptOverrides.get(prompt.id)?.thinkingLevel ?? ''} onChange={e => setPromptOverrideField(prompt.id, 'thinkingLevel', e.target.value)} placeholder="HIGH" className="text-xs h-8" />
                                </div>
                                <div>
                                  <p className="text-xs text-muted-foreground mb-1">size</p>
                                  <Input value={promptOverrides.get(prompt.id)?.imageSize ?? ''} onChange={e => setPromptOverrideField(prompt.id, 'imageSize', e.target.value)} placeholder="2K" className="text-xs h-8" />
                                </div>
                                <div>
                                  <p className="text-xs text-muted-foreground mb-1">ratio</p>
                                  <Input value={promptOverrides.get(prompt.id)?.aspectRatio ?? ''} onChange={e => setPromptOverrideField(prompt.id, 'aspectRatio', e.target.value)} placeholder="9:16" className="text-xs h-8" />
                                </div>
                              </div>
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground line-clamp-2 mb-2">{prompt.prompt}</p>
                          )}
                          {!isSelected && (
                            <div className="flex flex-wrap gap-1">
                              {prompt.thinkingLevel && <Badge variant="secondary" className="text-xs">thinking: {prompt.thinkingLevel}</Badge>}
                              {prompt.imageSize && <Badge variant="secondary" className="text-xs">size: {prompt.imageSize}</Badge>}
                              {prompt.aspectRatio && <Badge variant="secondary" className="text-xs">ratio: {prompt.aspectRatio}</Badge>}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )

  const controlsPanel = (
    <Card className="mt-6">
      <CardContent className="pt-6">
        <div className="flex flex-col md:flex-row items-start md:items-end gap-6">
          <FieldGroup className="flex-1 w-full md:w-auto">
            <Field>
              <FieldLabel>Number of duplicates</FieldLabel>
              <div className="flex items-center gap-2">
                <Input type="number" min={1} max={100} value={duplicates} onChange={e => setDuplicates(Math.max(1, parseInt(e.target.value) || 1))} className="w-20" />
                <div className="flex gap-1">
                  {[3, 5, 10, 15, 20].map(n => (
                    <Button key={n} variant={duplicates === n ? 'default' : 'outline'} size="sm" onClick={() => setDuplicates(n)}>{n}</Button>
                  ))}
                </div>
              </div>
            </Field>
          </FieldGroup>
          <div className="flex flex-col gap-2 shrink-0">
            <div
              className="flex items-center gap-2 cursor-pointer select-none"
              onClick={() => setRandomizePrompts(v => !v)}
            >
              <Checkbox checked={randomizePrompts} onCheckedChange={v => setRandomizePrompts(!!v)} onClick={e => e.stopPropagation()} />
              <span className="text-sm">Randomize prompts</span>
            </div>
            {randomizePrompts && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Take</span>
                <Input
                  type="number" min={1} max={selectedPrompts.size || 1}
                  value={randomPromptCount}
                  onChange={e => setRandomPromptCount(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-16 h-8 text-sm"
                />
                <span className="text-xs text-muted-foreground">of {selectedPrompts.size}</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3 p-4 bg-muted rounded-lg shrink-0">
            <Calculator className="w-4 h-4 text-muted-foreground shrink-0" />
            <div className="text-sm flex flex-col gap-0.5">
              <span className="font-mono text-xs text-muted-foreground">
                {selectedTasks.size} × {effectivePromptCount}{randomizePrompts && selectedPrompts.size > effectivePromptCount ? ` (random of ${selectedPrompts.size})` : ''} × {duplicates}
              </span>
              <span className="font-bold text-lg leading-none">{totalTasks} tasks</span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Button size="lg" onClick={handleSubmit} disabled={totalTasks === 0 || submitting}>
              {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
              {submitting && progress ? `${progress.done} / ${progress.total}` : `Create ${totalTasks} tasks`}
            </Button>
          </div>
        </div>
        {submitting && progress && (
          <>
            <Separator className="my-4" />
            <div className="space-y-1">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Creating tasks...</span>
                <span>{progress.done} / {progress.total}</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary transition-all duration-200" style={{ width: `${(progress.done / progress.total) * 100}%` }} />
              </div>
            </div>
          </>
        )}
        {result && (
          <>
            <Separator className="my-4" />
            <div className={`p-4 rounded-lg ${result.success ? 'bg-green-500/10 text-green-700 dark:text-green-400' : 'bg-destructive/10 text-destructive'}`}>
              {result.message}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/"><ArrowLeft className="w-4 h-4 mr-2" />Menu</Link>
          </Button>
          <h1 className="text-xl font-semibold">Task to Task</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <Tabs defaultValue="needs-interior">
          <TabsList className="mb-6">
            <TabsTrigger value="needs-interior">
              Needs interior
              <Badge variant="secondary" className="ml-2">{needsInteriorTasks.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="needs-person">
              Needs person
              <Badge variant="secondary" className="ml-2">{needsPersonTasks.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="all">All tasks</TabsTrigger>
          </TabsList>

          <TabsContent value="needs-interior">
            <div className="grid lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ImageIcon className="w-5 h-5 text-orange-500" />
                      <CardTitle>Needs interior</CardTitle>
                      <Badge variant="secondary">{needsInteriorTasks.length}</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={selectAllNeedsInterior}>
                        {needsInteriorTasks.length > 0 && needsInteriorTasks.every(t => selectedTasks.has(t.row_number))
                          ? <><Square className="w-4 h-4 mr-2" />Deselect all</>
                          : <><CheckSquare className="w-4 h-4 mr-2" />Select all</>
                        }
                      </Button>
                    </div>
                  </div>
                  <CardDescription>is_main tasks with fewer than 2 cool interior photos</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 max-h-[600px] overflow-y-auto">
                  {needsInteriorTasks.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-6">No tasks</p>
                  )}
                  {needsInteriorTasks.map(task => {
                    const interiorPhotos = interiorByProduct[task.product || ''] ?? []
                    return (
                      <div
                        key={task.row_number}
                        className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                          selectedTasks.has(task.row_number)
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-primary/50'
                        }`}
                        onClick={() => toggleTask(task.row_number)}
                      >
                        <div className="flex items-center gap-3">
                          <Checkbox
                            checked={selectedTasks.has(task.row_number)}
                            onCheckedChange={() => toggleTask(task.row_number)}
                          />
                          {task.result_img && (
                            <img
                              src={task.result_img as string}
                              alt=""
                              className="w-14 h-14 object-cover rounded border flex-shrink-0"
                              onClick={e => e.stopPropagation()}
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium truncate">{task.product}</span>
                              <Badge variant="outline" className="text-xs border-yellow-400 text-yellow-600">main</Badge>
                            </div>
                            {interiorPhotos.length > 0 ? (
                              <div className="flex gap-1 items-center">
                                <span className="text-xs text-muted-foreground">{interiorPhotos.length}/2 interior:</span>
                                {interiorPhotos.map(p => (
                                  <a key={p.row_number} href={p.result_img} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}>
                                    <img src={p.result_img} alt="" className="w-8 h-8 object-cover rounded border hover:opacity-80" />
                                  </a>
                                ))}
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">0/2 interior</span>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </CardContent>
              </Card>
              {promptsPanel}
            </div>
            {controlsPanel}
          </TabsContent>

          <TabsContent value="needs-person">
            <div className="grid lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ImageIcon className="w-5 h-5 text-purple-500" />
                      <CardTitle>Needs person</CardTitle>
                      <Badge variant="secondary">{needsPersonTasks.length}</Badge>
                    </div>
                    <Button variant="outline" size="sm" onClick={selectAllNeedsPerson}>
                      {needsPersonTasks.length > 0 && needsPersonTasks.every(t => selectedTasks.has(t.row_number))
                        ? <><Square className="w-4 h-4 mr-2" />Deselect all</>
                        : <><CheckSquare className="w-4 h-4 mr-2" />Select all</>
                      }
                    </Button>
                  </div>
                  <CardDescription>is_main idea cool tasks that have no cool or in-progress person task</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 max-h-[600px] overflow-y-auto">
                  {needsPersonTasks.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-6">No tasks</p>
                  )}
                  {needsPersonTasks.map(task => (
                    <div
                      key={task.row_number}
                      className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedTasks.has(task.row_number)
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50'
                      }`}
                      onClick={() => toggleTask(task.row_number)}
                    >
                      <div className="flex items-center gap-3">
                        <Checkbox
                          checked={selectedTasks.has(task.row_number)}
                          onCheckedChange={() => toggleTask(task.row_number)}
                        />
                        {task.result_img && (
                          <img
                            src={task.result_img as string}
                            alt=""
                            className="w-14 h-14 object-cover rounded border flex-shrink-0"
                            onClick={e => e.stopPropagation()}
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium truncate">{task.product}</span>
                            <span className="text-xs text-muted-foreground">#{task.row_number}</span>
                            <Badge variant="outline" className="text-xs border-green-500 text-green-600">cool</Badge>
                            <Badge variant="outline" className="text-xs border-blue-400 text-blue-600">{task.prompt_group}</Badge>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
              {promptsPanel}
            </div>
            {controlsPanel}
          </TabsContent>

          <TabsContent value="all">
            <div className="grid lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ImageIcon className="w-5 h-5 text-orange-500" />
                      <CardTitle>Tasks</CardTitle>
                      <Badge variant="secondary">{visibleTasks.length}</Badge>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap justify-end">
                      <div className="flex rounded-md border overflow-hidden text-xs">
                        {REVIEW_FILTERS.map(f => (
                          <button
                            key={f.value}
                            onClick={() => setReviewFilter(f.value)}
                            className={`px-2 py-1 transition-colors ${
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
                      <Button variant="outline" size="sm" onClick={selectAllTasks}>
                        {selectedTasks.size === visibleTasks.length && visibleTasks.length > 0
                          ? <><Square className="w-4 h-4 mr-2" />Deselect all</>
                          : <><CheckSquare className="w-4 h-4 mr-2" />Select all</>
                        }
                      </Button>
                    </div>
                  </div>
                  <CardDescription>Select tasks as the image source</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 max-h-[500px] overflow-y-auto">
                  {visibleTasks.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-6">No tasks</p>
                  )}
                  {visibleTasks.map(task => (
                    <div
                      key={task.row_number}
                      className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedTasks.has(task.row_number)
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50'
                      }`}
                      onClick={() => toggleTask(task.row_number)}
                    >
                      <div className="flex items-center gap-3">
                        <Checkbox
                          checked={selectedTasks.has(task.row_number)}
                          onCheckedChange={() => toggleTask(task.row_number)}
                        />
                        {task.result_img && (
                          <img
                            src={task.result_img as string}
                            alt=""
                            className="w-14 h-14 object-cover rounded border flex-shrink-0"
                            onClick={e => e.stopPropagation()}
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium truncate">{task.product}</span>
                            <span className="text-xs text-muted-foreground">#{task.row_number}</span>
                            {task.review && (
                              <Badge
                                variant="outline"
                                className={`text-xs ${task.review === 'cool' ? 'border-green-500 text-green-600' : 'border-red-500 text-red-600'}`}
                              >
                                {task.review}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {promptsPanel}
            </div>
            {controlsPanel}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}

export default function TaskToTaskPage() {
  return (
    <AuthGuard>
      <TaskToTaskContent />
    </AuthGuard>
  )
}
