'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { ArrowLeft, RefreshCw, Loader2, Clock, Layers } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface SubmitTask {
  row_number: string | number
  job_id?: string
  result_img?: string
  product?: string
  prompt?: string
  prompt_group?: string
  [key: string]: unknown
}

interface JobGroup {
  job_id: string
  startedAt: number
  tasks: SubmitTask[]
  products: string[]
  groups: string[]
}

function parseJobTime(job_id: string): number {
  const ms = parseInt(job_id.replace('job_', ''), 10)
  return isNaN(ms) ? 0 : ms
}

function useNow(intervalMs = 10_000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}

function elapsed(startedAt: number, now: number): string {
  const diffMs = now - startedAt
  if (diffMs < 0) return 'just now'
  const totalSec = Math.floor(diffMs / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  if (h > 0) return `${h}h ${m}m ago`
  if (m > 0) return `${m}m ${s}s ago`
  return `${s}s ago`
}

export default function JobsPage() {
  const [jobs, setJobs] = useState<JobGroup[]>([])
  const [loading, setLoading] = useState(true)
  const now = useNow()

  const fetchJobs = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/submit/tasks')
      const data = await res.json()
      const arr: SubmitTask[] = Array.isArray(data) ? data : data.data || data.items || data.tasks || []

      const inProgress = arr.filter(t => t.job_id && !t.result_img)
      const map = new Map<string, SubmitTask[]>()
      for (const t of inProgress) {
        const id = t.job_id!
        if (!map.has(id)) map.set(id, [])
        map.get(id)!.push(t)
      }

      const grouped: JobGroup[] = Array.from(map.entries()).map(([job_id, tasks]) => ({
        job_id,
        startedAt: parseJobTime(job_id),
        tasks,
        products: [...new Set(tasks.map(t => t.product).filter(Boolean) as string[])],
        groups: [...new Set(tasks.map(t => t.prompt_group).filter(Boolean) as string[])],
      }))

      grouped.sort((a, b) => b.startedAt - a.startedAt)
      setJobs(grouped)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchJobs() }, [fetchJobs])

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/"><ArrowLeft className="w-4 h-4 mr-2" />Back</Link>
          </Button>
          <h1 className="text-xl font-semibold">Jobs in progress</h1>
          <Badge variant="secondary" className="ml-auto">{jobs.length} jobs</Badge>
          <Button variant="outline" size="sm" onClick={fetchJobs} disabled={loading}>
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

        {!loading && jobs.length === 0 && (
          <div className="text-center py-20 text-muted-foreground">
            No active jobs
          </div>
        )}

        {!loading && jobs.length > 0 && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {jobs.map(job => (
              <Card key={job.job_id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-sm font-mono break-all">{job.job_id}</CardTitle>
                    <Badge variant="secondary" className="shrink-0">{job.tasks.length} tasks</Badge>
                  </div>
                  <CardDescription className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    {job.startedAt > 0 ? elapsed(job.startedAt, now) : '—'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {job.products.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {job.products.map(p => (
                        <Badge key={p} variant="outline" className="text-xs">{p}</Badge>
                      ))}
                    </div>
                  )}
                  {job.groups.length > 0 && (
                    <div className="flex flex-wrap gap-1 items-center">
                      <Layers className="w-3.5 h-3.5 text-muted-foreground" />
                      {job.groups.map(g => (
                        <Badge key={g} variant="secondary" className="text-xs">{g}</Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
