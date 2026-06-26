'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { AuthGuard } from '@/components/auth-guard'
import { logout } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { FieldGroup, Field, FieldLabel } from '@/components/ui/field'
import { 
  LogOut,
  ArrowLeft,
  Lightbulb,
  FileText,
  Send,
  CheckSquare,
  Square,
  Loader2,
  Calculator
} from 'lucide-react'
import type { Idea, PromptTemplate, Task } from '@/types'

function resolvePrompt(template: string, idea: Idea): string {
  let resolved = template
  Object.keys(idea).forEach(key => {
    if (key.startsWith('var-')) {
      const tag = key.slice(4)
      resolved = resolved.replace(new RegExp(`\\{\\{${tag}\\}\\}`, 'g'), idea[key as `var-${string}`] || '')
    }
  })
  return resolved
}

function IdeaToTaskContent() {
  const [ideas, setIdeas] = useState<Idea[]>([])
  const [prompts, setPrompts] = useState<PromptTemplate[]>([])
  const [selectedIdeas, setSelectedIdeas] = useState<Set<number>>(new Set())
  const [selectedPrompts, setSelectedPrompts] = useState<Set<string>>(new Set())
  const [hideUsed, setHideUsed] = useState(true)
  const [search, setSearch] = useState('')
  const [duplicates, setDuplicates] = useState(1)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)
  const [productTasks, setProductTasks] = useState<string[]>([])
  const [usedProducts, setUsedProducts] = useState<Set<string>>(new Set())
  const searchParams = useSearchParams()
  const productFilter = searchParams.get('product')

  useEffect(() => {
    async function fetchData() {
      try {
        const [ideasRes, promptsRes, tasksRes] = await Promise.all([
          fetch('/api/ideas'),
          fetch('/api/prompts'),
          fetch('/api/submit/tasks'),
        ])
        const ideasData = await ideasRes.json()
        const promptsData = await promptsRes.json()
        const tasksData = await tasksRes.json()

        let ideasArray = Array.isArray(ideasData)
          ? ideasData
          : ideasData.data || ideasData.items || ideasData.ideas || []
        if (productFilter) {
          ideasArray = ideasArray.filter((i: Idea) => i.product === productFilter)
        }
        const promptsRaw = Array.isArray(promptsData)
          ? promptsData
          : promptsData.data || promptsData.items || promptsData.prompts || []
        const promptsArray = promptsRaw.map((p: PromptTemplate & { row_number?: string | number }) => ({
          ...p,
          id: String(p.row_number ?? p.id),
        }))

        const tasksArr = Array.isArray(tasksData) ? tasksData : tasksData.data || tasksData.tasks || []
        const used = new Set<string>(
          tasksArr
            .filter((t: { product?: string; prompt_group?: string }) => t.prompt_group === 'idea' && t.product)
            .map((t: { product: string }) => t.product)
        )
        setUsedProducts(used)
        if (productFilter) {
          const imgs = tasksArr
            .filter((t: { product?: string; result_img?: string }) => t.product === productFilter && t.result_img)
            .map((t: { result_img: string }) => t.result_img)
          setProductTasks(imgs)
        }

        setIdeas(ideasArray)
        setPrompts(promptsArray)
      } catch (error) {
        console.error('Error fetching data:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const visibleIdeas = useMemo(() => {
    let list = hideUsed ? ideas.filter(i => !usedProducts.has(i.product || '')) : ideas
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(i => {
        const varValues = Object.entries(i)
          .filter(([k]) => k.startsWith('var-'))
          .map(([, v]) => String(v).toLowerCase())
        return (
          i.product?.toLowerCase().includes(q) ||
          varValues.some(v => v.includes(q))
        )
      })
    }
    return list
  }, [ideas, hideUsed, search, usedProducts])

  const totalTasks = useMemo(() => {
    return selectedIdeas.size * selectedPrompts.size * duplicates
  }, [selectedIdeas.size, selectedPrompts.size, duplicates])

  const groupedPrompts = useMemo(() => {
    const groups: Record<string, PromptTemplate[]> = {}
    prompts.forEach(prompt => {
      const groupName = prompt.group || 'Ungrouped'
      if (!groups[groupName]) {
        groups[groupName] = []
      }
      groups[groupName].push(prompt)
    })
    return groups
  }, [prompts])

  const toggleIdea = (rowNumber: number) => {
    const newSet = new Set(selectedIdeas)
    if (newSet.has(rowNumber)) {
      newSet.delete(rowNumber)
    } else {
      newSet.add(rowNumber)
    }
    setSelectedIdeas(newSet)
  }

  const togglePrompt = (id: string) => {
    const newSet = new Set(selectedPrompts)
    if (newSet.has(id)) {
      newSet.delete(id)
    } else {
      newSet.add(id)
    }
    setSelectedPrompts(newSet)
  }

  const selectAllIdeas = () => {
    if (selectedIdeas.size === visibleIdeas.length) {
      setSelectedIdeas(new Set())
    } else {
      setSelectedIdeas(new Set(visibleIdeas.map(i => i.row_number)))
    }
  }

  const selectAllPrompts = () => {
    if (selectedPrompts.size === prompts.length) {
      setSelectedPrompts(new Set())
    } else {
      setSelectedPrompts(new Set(prompts.map(p => p.id)))
    }
  }

  const toggleGroup = (groupName: string) => {
    const groupPrompts = groupedPrompts[groupName] || []
    const groupIds = groupPrompts.map(p => p.id)
    const allSelected = groupIds.every(id => selectedPrompts.has(id))
    
    const newSet = new Set(selectedPrompts)
    if (allSelected) {
      groupIds.forEach(id => newSet.delete(id))
    } else {
      groupIds.forEach(id => newSet.add(id))
    }
    setSelectedPrompts(newSet)
  }

  const isGroupSelected = (groupName: string): 'all' | 'some' | 'none' => {
    const groupPrompts = groupedPrompts[groupName] || []
    const groupIds = groupPrompts.map(p => p.id)
    const selectedCount = groupIds.filter(id => selectedPrompts.has(id)).length
    if (selectedCount === 0) return 'none'
    if (selectedCount === groupIds.length) return 'all'
    return 'some'
  }

  const handleSubmit = async () => {
    if (totalTasks === 0) return

    setSubmitting(true)
    setResult(null)

    const tasks: Task[] = []
    const selectedIdeasArray = ideas.filter(i => selectedIdeas.has(i.row_number))
    const selectedPromptsArray = prompts.filter(p => selectedPrompts.has(p.id))

    for (const idea of selectedIdeasArray) {
      for (const prompt of selectedPromptsArray) {
        for (let d = 0; d < duplicates; d++) {
          tasks.push({
            ideaRowNumber: idea.row_number,
            promptId: prompt.id,
            duplicateIndex: d,
            idea,
            prompt,
            resolvedPrompt: resolvePrompt(prompt.prompt, idea)
          })
        }
      }
    }

    try {
      const inputKeys = ['input1','input2','input3','input4','input5','input6','input7','input8','input9','input10'] as const
      const payload = tasks.map(t => {
        const chain = [
          ...inputKeys.map(k => t.prompt[k]).filter(Boolean),
          ...inputKeys.map(k => t.idea[k]).filter(Boolean),
        ]
        const inputs = Object.fromEntries(inputKeys.map((k, i) => [k, chain[i]]))
        return {
          ideaRowNumber: t.ideaRowNumber,
          data: {
            prompt: t.resolvedPrompt,
            product: t.idea.product,
            ...inputs,
            aspectRatio: t.prompt.aspectRatio,
            imageSize: t.prompt.imageSize,
            thinkingLevel: t.prompt.thinkingLevel,
            prompt_group: t.prompt.group,
          }
        }
      })

      const taskData = payload.map(p => p.data)
      const BATCH_SIZE = 500
      setProgress({ done: 0, total: taskData.length })

      for (let i = 0; i < taskData.length; i += BATCH_SIZE) {
        const batch = taskData.slice(i, i + BATCH_SIZE)
        const response = await fetch('/api/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(batch),
        })
        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || `HTTP ${response.status}`)
        }
        setProgress({ done: Math.min(i + BATCH_SIZE, taskData.length), total: taskData.length })
      }

      const uniqueIdeas = [...new Set(payload.map(p => p.ideaRowNumber))]
      await Promise.all(uniqueIdeas.map(async (rowNumber) => {
        await fetch('/api/ideas', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ row_number: rowNumber })
        })
        setIdeas(prev => prev.map(idea =>
          idea.row_number === rowNumber ? { ...idea, used: 'true' } : idea
        ))
      }))

      setSelectedIdeas(new Set())
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

  const handleLogout = () => {
    logout()
    window.location.reload()
  }

  const getVarColumns = (idea: Idea): string[] => {
    return Object.keys(idea).filter(key => key.startsWith('var-'))
  }

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
          <h1 className="text-xl font-semibold">Idea to Task</h1>
          {productFilter && <Badge variant="secondary">{productFilter}</Badge>}
          <Button variant="ghost" size="sm" onClick={handleLogout} className="ml-auto">
            <LogOut className="w-4 h-4 mr-2" />
            Log out
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        {productFilter && productTasks.length > 0 && (
          <div className="mb-6">
            <p className="text-sm text-muted-foreground mb-2">Existing results for "{productFilter}"</p>
            <div className="flex flex-wrap gap-2">
              {productTasks.map((url, i) => (
                <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                  <img src={url} alt="" className="w-20 h-20 object-cover rounded border hover:opacity-80 transition-opacity" />
                </a>
              ))}
            </div>
          </div>
        )}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Ideas Section */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Lightbulb className="w-5 h-5 text-yellow-500" />
                  <CardTitle>Ideas</CardTitle>
                  <Badge variant="secondary">{visibleIdeas.length}</Badge>
                </div>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none">
                    <Switch checked={hideUsed} onCheckedChange={setHideUsed} />
                    Hide used
                  </label>
                  <Button variant="outline" size="sm" onClick={selectAllIdeas}>
                    {selectedIdeas.size === visibleIdeas.length && visibleIdeas.length > 0 ? (
                      <><Square className="w-4 h-4 mr-2" />Deselect all</>
                    ) : (
                      <><CheckSquare className="w-4 h-4 mr-2" />Select all</>
                    )}
                  </Button>
                </div>
              </div>
              <CardDescription>Select ideas to create tasks</CardDescription>
              <Input
                placeholder="Search by product or variables..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="mt-1"
              />
            </CardHeader>
            <CardContent className="space-y-3 max-h-[500px] overflow-y-auto">
              {visibleIdeas.map((idea) => (
                <div
                  key={idea.row_number}
                  className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                    selectedIdeas.has(idea.row_number)
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                  }`}
                  onClick={() => toggleIdea(idea.row_number)}
                >
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={selectedIdeas.has(idea.row_number)}
                      onCheckedChange={() => toggleIdea(idea.row_number)}
                    />
                    <div className="flex flex-wrap gap-2 flex-shrink-0">
                      {(['input1','input2','input3','input4','input5','input6','input7','input8','input9','input10'] as const)
                        .filter((k) => idea[k])
                        .map((k) => (
                          <img
                            key={k}
                            src={idea[k]}
                            alt={k}
                            className="w-16 h-16 object-cover rounded border"
                          />
                        ))}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium truncate">{idea.product}</span>
                        {usedProducts.has(idea.product || '') && <Badge variant="outline" className="text-xs">Used</Badge>}
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {getVarColumns(idea).map((varKey) => (
                          <Badge key={varKey} variant="secondary" className="text-xs">
                            {varKey}: {idea[varKey as `var-${string}`]}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Prompts Section */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-blue-500" />
                  <CardTitle>Prompts</CardTitle>
                  <Badge variant="secondary">{prompts.length}</Badge>
                </div>
                <Button variant="outline" size="sm" onClick={selectAllPrompts}>
                  {selectedPrompts.size === prompts.length ? (
                    <><Square className="w-4 h-4 mr-2" />Deselect all</>
                  ) : (
                    <><CheckSquare className="w-4 h-4 mr-2" />Select all</>
                  )}
                </Button>
              </div>
              <CardDescription>Select prompts to apply to ideas</CardDescription>
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
                        if (el) {
                          (el as HTMLButtonElement & { indeterminate: boolean }).indeterminate = groupState === 'some'
                        }
                      }}
                      onCheckedChange={() => toggleGroup(groupName)}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                      {groupName}
                    </span>
                    <Badge variant="secondary" className="text-xs">
                      {groupPrompts.filter(p => selectedPrompts.has(p.id)).length}/{groupPrompts.length}
                    </Badge>
                    <Separator className="flex-1" />
                  </div>
                  <div className="space-y-2 pl-2 border-l-2 border-muted">
                    {groupPrompts.map((prompt, promptIdx) => (
                      <div
                        key={prompt.id ?? `${groupName}-${promptIdx}`}
                        className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                          selectedPrompts.has(prompt.id)
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-primary/50'
                        }`}
                        onClick={() => togglePrompt(prompt.id)}
                      >
                        <div className="flex items-start gap-3">
                          <Checkbox 
                            checked={selectedPrompts.has(prompt.id)} 
                            onCheckedChange={() => togglePrompt(prompt.id)}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium">{prompt.name}</span>
                              <Badge variant="outline" className="text-xs">{prompt.model}</Badge>
                            </div>
                            <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                              {prompt.prompt}
                            </p>
                            <div className="flex flex-wrap gap-1">
                              {prompt.thinkingLevel && (
                                <Badge variant="secondary" className="text-xs">
                                  thinking: {prompt.thinkingLevel}
                                </Badge>
                              )}
                              {prompt.imageSize && (
                                <Badge variant="secondary" className="text-xs">
                                  size: {prompt.imageSize}
                                </Badge>
                              )}
                              {prompt.aspectRatio && (
                                <Badge variant="secondary" className="text-xs">
                                  ratio: {prompt.aspectRatio}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )})}
            </CardContent>
          </Card>
        </div>

        {/* Controls Section */}
        <Card className="mt-6">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row items-start md:items-end gap-6">
              <FieldGroup className="flex-1 w-full md:w-auto">
                <Field>
                  <FieldLabel>Number of duplicates</FieldLabel>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={1}
                      max={100}
                      value={duplicates}
                      onChange={(e) => setDuplicates(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-20"
                    />
                    <div className="flex gap-1">
                      {[3, 5, 10, 15, 20].map(n => (
                        <Button
                          key={n}
                          variant={duplicates === n ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setDuplicates(n)}
                        >
                          {n}
                        </Button>
                      ))}
                    </div>
                  </div>
                </Field>
              </FieldGroup>

              <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
                <Calculator className="w-5 h-5 text-muted-foreground" />
                <div className="text-sm">
                  <span className="text-muted-foreground">Formula: </span>
                  <span className="font-mono">
                    {selectedIdeas.size} ideas × {selectedPrompts.size} prompts × {duplicates} dup.
                  </span>
                  <span className="mx-2">=</span>
                  <span className="font-bold text-lg">{totalTasks} tasks</span>
                </div>
              </div>

              <div className="flex flex-col items-end gap-1">
                <Button
                  size="lg"
                  onClick={handleSubmit}
                  disabled={totalTasks === 0 || submitting}
                >
                  {submitting ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4 mr-2" />
                  )}
                  {submitting && progress
                    ? `${progress.done} / ${progress.total}`
                    : `Create ${totalTasks} tasks`}
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
                    <div
                      className="h-full bg-primary transition-all duration-200"
                      style={{ width: `${(progress.done / progress.total) * 100}%` }}
                    />
                  </div>
                </div>
              </>
            )}

            {result && (
              <>
                <Separator className="my-4" />
                <div className={`p-4 rounded-lg ${
                  result.success 
                    ? 'bg-green-500/10 text-green-700 dark:text-green-400' 
                    : 'bg-destructive/10 text-destructive'
                }`}>
                  {result.message}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Preview Section */}
        {totalTasks > 0 && totalTasks <= 10 && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-base">Task preview</CardTitle>
              <CardDescription>How the created tasks will look</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 max-h-[400px] overflow-y-auto">
              {ideas
                .filter(i => selectedIdeas.has(i.row_number))
                .flatMap(idea =>
                  prompts
                    .filter(p => selectedPrompts.has(p.id))
                    .flatMap(prompt =>
                      Array.from({ length: duplicates }, (_, d) => (
                        <div key={`${idea.row_number}-${prompt.id}-${d}`} className="p-3 bg-muted rounded-lg">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge>{idea.product}</Badge>
                            <Badge variant="outline">{prompt.name}</Badge>
                            {duplicates > 1 && <Badge variant="secondary">#{d + 1}</Badge>}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {resolvePrompt(prompt.prompt, idea)}
                          </p>
                        </div>
                      ))
                    )
                )}
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  )
}

export default function IdeaToTaskPage() {
  return (
    <AuthGuard>
      <IdeaToTaskContent />
    </AuthGuard>
  )
}
