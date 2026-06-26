import { NextRequest, NextResponse } from 'next/server'

const API_BASE =
  process.env.N8N_VIDEO_COMPILATIONS_WEBHOOK_URL ||
  `${process.env.N8N_BASE_URL || 'https://n8n.example.com'}/webhook/neon/content/video-compilations`

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    if (!body?.product || !Array.isArray(body?.clips) || body.clips.length === 0) {
      return NextResponse.json(
        { error: 'product and clips[] are required' },
        { status: 400 },
      )
    }

    const response = await fetch(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    const text = await response.text()
    let data: unknown
    try {
      data = JSON.parse(text)
    } catch {
      data = { raw: text }
    }

    if (!response.ok) {
      return NextResponse.json(
        { error: `Webhook error ${response.status}`, details: data },
        { status: response.status },
      )
    }

    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
