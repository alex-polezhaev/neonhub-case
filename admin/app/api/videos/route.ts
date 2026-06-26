import { NextRequest, NextResponse } from 'next/server'

const API_BASE = `${process.env.N8N_BASE_URL || 'https://n8n.example.com'}/webhook/neon/content/videos`
const VIDEO_PROXY_PREFIX = `${process.env.N8N_BASE_URL || 'https://n8n.example.com'}/webhook/proxy-directus-video-webhook/proxy/directus/video/`
const VIDEO_ASSET_PREFIX = `${process.env.NEXT_PUBLIC_DIRECTUS_URL || 'https://directus.example.com'}/assets/`

function replaceVideoUrl(url: unknown) {
  if (typeof url !== 'string') return url
  if (!url.startsWith(VIDEO_PROXY_PREFIX)) return url
  return `${VIDEO_ASSET_PREFIX}${url.slice(VIDEO_PROXY_PREFIX.length)}`
}

function normalizeVideoRecord(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value
  const record = value as Record<string, unknown>
  if (!('result_video' in record)) return value
  return {
    ...record,
    result_video: replaceVideoUrl(record.result_video),
  }
}

function normalizeVideosResponse(payload: unknown): unknown {
  if (Array.isArray(payload)) {
    return payload.map(normalizeVideoRecord)
  }

  if (!payload || typeof payload !== 'object') {
    return payload
  }

  const record = payload as Record<string, unknown>
  const normalized = { ...record }

  if (Array.isArray(record.data)) normalized.data = record.data.map(normalizeVideoRecord)
  if (Array.isArray(record.items)) normalized.items = record.items.map(normalizeVideoRecord)
  if (Array.isArray(record.videos)) normalized.videos = record.videos.map(normalizeVideoRecord)

  return normalizeVideoRecord(normalized)
}

export async function GET() {
  try {
    const response = await fetch(API_BASE, { cache: 'no-store' })
    if (!response.ok) throw new Error(`Failed to fetch videos: ${response.status}`)
    const data = await response.json()
    return NextResponse.json(normalizeVideosResponse(data))
  } catch (error) {
    console.error('Error fetching videos:', error)
    return NextResponse.json({ error: 'Failed to fetch videos' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const response = await fetch(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!response.ok) throw new Error(`Failed to create video: ${response.status}`)
    const data = await response.json()
    return NextResponse.json(normalizeVideosResponse(data))
  } catch (error) {
    console.error('Error creating video:', error)
    return NextResponse.json({ error: 'Failed to create video' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const response = await fetch(API_BASE, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!response.ok) throw new Error(`Failed to update video: ${response.status}`)
    const data = await response.json()
    return NextResponse.json(normalizeVideosResponse(data))
  } catch (error) {
    console.error('Error updating video:', error)
    return NextResponse.json({ error: 'Failed to update video' }, { status: 500 })
  }
}
