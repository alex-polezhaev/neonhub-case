import { NextRequest, NextResponse } from 'next/server'

const API_BASE = `${process.env.N8N_BASE_URL || 'https://n8n.example.com'}/webhook/neon/content/products`

export async function GET() {
  try {
    const response = await fetch(API_BASE, { cache: 'no-store' })
    if (!response.ok) throw new Error(`n8n error ${response.status}`)
    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
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
    if (!response.ok) throw new Error(`n8n error ${response.status}`)
    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
