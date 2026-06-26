import { NextRequest, NextResponse } from 'next/server'

const API_BASE = `${process.env.N8N_BASE_URL || 'https://n8n.example.com'}/webhook/neon/content/variants`

export async function GET() {
  try {
    const response = await fetch(API_BASE, { cache: 'no-store' })
    if (!response.ok) throw new Error(`Failed to fetch variants: ${response.status}`)
    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error fetching variants:', error)
    return NextResponse.json({ error: 'Failed to fetch variants' }, { status: 500 })
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
    if (!response.ok) throw new Error(`Failed to create variant: ${response.status}`)
    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error creating variant:', error)
    return NextResponse.json({ error: 'Failed to create variant' }, { status: 500 })
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
    if (!response.ok) throw new Error(`Failed to update variants: ${response.status}`)
    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error updating variants:', error)
    return NextResponse.json({ error: 'Failed to update variants' }, { status: 500 })
  }
}
