'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { ArrowLeft, RefreshCw, Loader2, ImageIcon, Video, Check, FileText, CheckSquare, Square, Calculator, Send, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import type { PromptTemplate } from '@/types'

interface Variant {
  row_number: string | number
  product: string
  color: string
  img1: string
  img2: string
  img3: string
}

interface Photo {
  key: string
  product: string
  url: string
}

interface ProductState {
  loading: boolean
  done: boolean
  error: string | null
}

export default function ProductsToVideoPage() {
  const [photos, setPhotos] = useState<Photo[]>([])
  const [prompts, setPrompts] = useState<PromptTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPrompts, setSelectedPrompts] = useState<Set<string>>(new Set())
  const [duplicates, setDuplicates] = useState(1)
  const [selectedPhotos, setSelectedPhotos] = useState<Set<string>>(new Set())
  const [productStates, setProductStates] = useState<Record<string, ProductState>>({})
  const [globalState, setGlobalState] = useState<{ loading: boolean; done: boolean; error: string | null }>({ loading: false, done: false, error: null })
  const [productsWithVideos, setProductsWithVideos] = useState<Set<string>>(new Set())
  const [hideWithVideos, setHideWithVideos] = useState(false)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const [variantsRes, promptsRes, videosRes] = await Promise.all([
        fetch('/api/variants'),
        fetch('/api/prompts'),
        fetch('/api/videos'),
      ])
      const variantsData = await variantsRes.json()
      const promptsData = await promptsRes.json()
      const videosData = await videosRes.json()
      const variantsArr: Variant[] = Array.isArray(variantsData) ? variantsData : variantsData.data || []
      const promptsRaw = Array.isArray(promptsData) ? promptsData : promptsData.data || promptsData.prompts || []
      const promptsArr: PromptTemplate[] = promptsRaw.map((p: PromptTemplate & { row_number?: string | number }) => ({
        ...p,
        id: String(p.row_number ?? p.id),
      }))
      const flatPhotos: Photo[] = []
      for (const v of variantsArr) {
        ;[v.img1, v.img2, v.img3].forEach((url, i) => {
          if (url) flatPhotos.push({ key: `${v.row_number}-${i}`, product: v.product, url })
        })
      }
      const videosArr: Array<Record<string, unknown>> = Array.isArray(videosData) ? videosData : videosData.data || videosData.videos || []
      const withVideos = new Set(
        videosArr
          .filter(v => typeof v.product === 'string' && v.product)
          .map(v => v.product as string)
      )

      setPhotos(flatPhotos)
      setPrompts(promptsArr)
      setProductsWithVideos(withVideos)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAll() }, [])

  const grouped = useMemo(() => {
    const byProduct: Record<string, Photo[]> = {}
    for (const p of photos) {
      if (!byProduct[p.product]) byProduct[p.product] = []
      byProduct[p.product].push(p)
    }
    return Object.entries(byProduct)
      .sort(([a], [b]) => a.localeCompare(b))
      .filter(([product]) => !hideWithVideos || !productsWithVideos.has(product))
  }, [photos, hideWithVideos, productsWithVideos])

  const groupedPrompts = useMemo(() => {
    const groups: Record<string, PromptTemplate[]> = {}
    prompts.forEach(p => {
      const g = p.group || 'No group'
      if (!groups[g]) groups[g] = []
      groups[g].push(p)
    })
    return groups
  }, [prompts])

  const togglePrompt = (id: string) => {
    setSelectedPrompts(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleGroup = (groupName: string) => {
    const ids = (groupedPrompts[groupName] || []).map(p => p.id)
    const allSelected = ids.every(id => selectedPrompts.has(id))
    setSelectedPrompts(prev => {
      const next = new Set(prev)
      allSelected ? ids.forEach(id => next.delete(id)) : ids.forEach(id => next.add(id))
      return next
    })
  }

  const selectAllPrompts = () => {
    if (selectedPrompts.size === prompts.length) {
      setSelectedPrompts(new Set())
    } else {
      setSelectedPrompts(new Set(prompts.map(p => p.id)))
    }
  }

  const isGroupSelected = (groupName: string): 'all' | 'some' | 'none' => {
    const ids = (groupedPrompts[groupName] || []).map(p => p.id)
    const count = ids.filter(id => selectedPrompts.has(id)).length
    if (count === 0) return 'none'
    if (count === ids.length) return 'all'
    return 'some'
  }

  function togglePhoto(key: string) {
    setSelectedPhotos(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  function toggleAllPhotos(product: string, items: Photo[]) {
    const keys = items.map(p => p.key)
    const allSelected = keys.every(k => selectedPhotos.has(k))
    setSelectedPhotos(prev => {
      const next = new Set(prev)
      allSelected ? keys.forEach(k => next.delete(k)) : keys.forEach(k => next.add(k))
      return next
    })
  }

  function buildTasks(photosList: Photo[]) {
    const selectedPromptsArr = prompts.filter(p => selectedPrompts.has(p.id))
    const tasks = []
    for (const photo of photosList) {
      for (const prompt of selectedPromptsArr) {
        for (let d = 0; d < duplicates; d++) {
          tasks.push({
            product: photo.product,
            prompt_group: prompt.group,
            prompt: prompt.prompt,
            input1: photo.url,
            autoPrompt: (prompt as Record<string, unknown>).autoPrompt,
            aspect_ratio: prompt.aspectRatio,
            videoResolution: (prompt as Record<string, unknown>).videoResolution,
          })
        }
      }
    }
    return tasks
  }

  async function sendTasks(tasks: object[]) {
    const res = await fetch('/api/videos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tasks),
    })
    if (!res.ok) throw new Error(`${res.status}`)
  }

  async function createVideosForProduct(product: string, items: Photo[]) {
    const toSend = items.filter(p => selectedPhotos.has(p.key))
    if (toSend.length === 0 || selectedPrompts.size === 0) return
    setProductStates(prev => ({ ...prev, [product]: { loading: true, done: false, error: null } }))
    try {
      await sendTasks(buildTasks(toSend))
      setProductStates(prev => ({ ...prev, [product]: { loading: false, done: true, error: null } }))
    } catch (e) {
      setProductStates(prev => ({ ...prev, [product]: { loading: false, done: false, error: String(e) } }))
    }
  }

  async function sendAll() {
    const allSelected = photos.filter(p => selectedPhotos.has(p.key))
    if (allSelected.length === 0 || selectedPrompts.size === 0) return
    setGlobalState({ loading: true, done: false, error: null })
    const products = [...new Set(allSelected.map(p => p.product))]
    products.forEach(product =>
      setProductStates(prev => ({ ...prev, [product]: { loading: true, done: false, error: null } }))
    )
    try {
      await sendTasks(buildTasks(allSelected))
      setGlobalState({ loading: false, done: true, error: null })
      products.forEach(product =>
        setProductStates(prev => ({ ...prev, [product]: { loading: false, done: true, error: null } }))
      )
    } catch (e) {
      const err = String(e)
      setGlobalState({ loading: false, done: false, error: err })
      products.forEach(product =>
        setProductStates(prev => ({ ...prev, [product]: { loading: false, done: false, error: err } }))
      )
    }
  }

  const totalPhotos = photos.length
  const doneCount = Object.values(productStates).filter(s => s.done).length
  const videoCount = selectedPrompts.size * duplicates
  const totalSelected = photos.filter(p => selectedPhotos.has(p.key)).length
  const totalTasks = totalSelected * videoCount

  const promptsPanel = (
    <Card className="lg:sticky lg:top-[73px] self-start">
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
        <CardDescription>Select prompts to generate videos</CardDescription>
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
                      className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                        isSelected ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                      }`}
                      onClick={() => togglePrompt(prompt.id)}
                    >
                      <div className="flex items-start gap-3">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => togglePrompt(prompt.id)}
                          onClick={e => e.stopPropagation()}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-sm">{prompt.name}</span>
                            {prompt.aspectRatio && <Badge variant="outline" className="text-xs">{prompt.aspectRatio}</Badge>}
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-2">{prompt.prompt}</p>
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

      <div className="px-6 pb-4 pt-2 border-t mt-2 space-y-4">
        <div className="flex items-center gap-3 mt-3">
          <div className="flex-1">
            <p className="text-xs text-muted-foreground mb-1.5">Duplicates</p>
            <div className="flex items-center gap-2">
              <Input
                type="number" min={1} max={20}
                value={duplicates}
                onChange={e => setDuplicates(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-16 h-8 text-sm"
              />
              <div className="flex gap-1">
                {[1, 2, 3, 5].map(n => (
                  <Button key={n} variant={duplicates === n ? 'default' : 'outline'} size="sm" className="h-8 px-2 text-xs" onClick={() => setDuplicates(n)}>{n}</Button>
                ))}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 p-2 bg-muted rounded-lg shrink-0">
            <Calculator className="w-3.5 h-3.5 text-muted-foreground" />
            <div className="text-xs">
              <div className="text-muted-foreground font-mono">{selectedPrompts.size} × {duplicates}</div>
              <div className="font-bold">{videoCount} videos/photo</div>
            </div>
          </div>
        </div>

        <div className="border-t pt-4">
          {globalState.error && (
            <p className="text-xs text-red-500 mb-2">{globalState.error}</p>
          )}
          <Button
            className="w-full"
            size="lg"
            onClick={sendAll}
            disabled={totalSelected === 0 || selectedPrompts.size === 0 || globalState.loading}
          >
            {globalState.loading
              ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              : globalState.done
              ? <Check className="w-4 h-4 mr-2" />
              : <Send className="w-4 h-4 mr-2" />}
            {globalState.done
              ? 'Sent!'
              : totalTasks > 0
              ? `Send all (${totalTasks} tasks)`
              : 'Send all'}
          </Button>
        </div>
      </div>
    </Card>
  )

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center gap-3 flex-wrap">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/"><ArrowLeft className="w-4 h-4 mr-2" />Menu</Link>
          </Button>
          <h1 className="text-xl font-semibold">Products to Video</h1>
          <Badge variant="secondary">{totalPhotos} photos</Badge>
          {doneCount > 0 && <Badge className="bg-green-500 text-white">{doneCount} products sent</Badge>}
          <div className="ml-auto flex items-center gap-2">
            <Button
              variant={hideWithVideos ? 'default' : 'outline'}
              size="sm"
              onClick={() => setHideWithVideos(v => !v)}
            >
              <EyeOff className="w-4 h-4 mr-2" />
              Hide with video
              {productsWithVideos.size > 0 && (
                <Badge variant={hideWithVideos ? 'secondary' : 'outline'} className="ml-2 text-xs">{productsWithVideos.size}</Badge>
              )}
            </Button>
            <Button variant="outline" size="sm" onClick={() => { setSelectedPhotos(new Set()); setProductStates({}); fetchAll() }} disabled={loading}>
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

        {!loading && (
          <div className="grid lg:grid-cols-[320px_1fr] gap-6 items-start">
            {promptsPanel}

            <div>
              {grouped.length === 0 && (
                <div className="flex flex-col items-center gap-2 py-20 text-muted-foreground">
                  <ImageIcon className="w-10 h-10" />
                  <p>No photos</p>
                </div>
              )}

              {grouped.map(([product, items]) => {
                const state = productStates[product]
                const isDone = state?.done
                const isProductLoading = state?.loading
                const selectedInProduct = items.filter(p => selectedPhotos.has(p.key)).length
                const allSelected = items.length > 0 && selectedInProduct === items.length

                return (
                  <div key={product} className={`mb-10 rounded-xl border p-4 transition-all ${isDone ? 'border-green-400 bg-green-50/20' : 'border-transparent'}`}>
                    <div className="flex items-center gap-3 mb-4 flex-wrap">
                      <h2 className="text-lg font-semibold">{product}</h2>
                      <Badge variant="secondary">{items.length} photos</Badge>
                      {selectedInProduct > 0 && (
                        <Badge variant="outline">{selectedInProduct} selected</Badge>
                      )}
                      <div className="flex-1 h-px bg-border hidden sm:block" />
                      {isDone ? (
                        <Badge className="bg-green-500 text-white"><Check className="w-3 h-3 mr-1" />Sent</Badge>
                      ) : (
                        <div className="flex items-center gap-2 ml-auto sm:ml-0">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => toggleAllPhotos(product, items)}
                            disabled={isProductLoading}
                          >
                            {allSelected ? <><Square className="w-3.5 h-3.5 mr-1.5" />Deselect all</> : <><CheckSquare className="w-3.5 h-3.5 mr-1.5" />Select all</>}
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => createVideosForProduct(product, items)}
                            disabled={selectedInProduct === 0 || selectedPrompts.size === 0 || isProductLoading}
                          >
                            {isProductLoading
                              ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                              : <Send className="w-3.5 h-3.5 mr-1.5" />}
                            Create video
                            {selectedInProduct > 0 && videoCount > 0 && (
                              <span className="ml-1.5 opacity-70">×{selectedInProduct * videoCount}</span>
                            )}
                          </Button>
                        </div>
                      )}
                    </div>

                    {state?.error && (
                      <p className="text-xs text-red-500 mb-3">{state.error}</p>
                    )}

                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
                      {items.map(photo => {
                        const isSelected = selectedPhotos.has(photo.key)
                        return (
                          <div
                            key={photo.key}
                            onClick={() => !isProductLoading && !isDone && togglePhoto(photo.key)}
                            className={`relative rounded-lg overflow-hidden border-2 cursor-pointer select-none transition-all ${
                              isSelected
                                ? 'border-primary ring-2 ring-primary'
                                : 'border-transparent hover:border-muted-foreground'
                            } ${isDone || isProductLoading ? 'pointer-events-none' : ''}`}
                          >
                            <img
                              src={photo.url}
                              alt={photo.product}
                              className="w-full aspect-square object-cover"
                            />
                            {isSelected && (
                              <div className="absolute top-1.5 left-1.5 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg ring-2 ring-white">
                                <Check className="w-3.5 h-3.5" />
                              </div>
                            )}
                            {isDone && (
                              <div className="absolute inset-0 bg-green-500/20 flex items-center justify-center">
                                <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center shadow">
                                  <Video className="w-4 h-4 text-white" />
                                </div>
                              </div>
                            )}
                            <div className={`absolute top-1.5 right-1.5 w-4 h-4 rounded border-2 transition-all ${
                              isSelected ? 'bg-primary border-primary' : 'bg-white/70 border-white'
                            }`} />
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
