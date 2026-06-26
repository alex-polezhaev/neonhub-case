import { NextRequest, NextResponse } from 'next/server'

const API_BASE = `${process.env.N8N_BASE_URL || 'https://n8n.example.com'}/webhook`

export async function GET() {
  try {
    const response = await fetch(`${API_BASE}/neon/content/ideas`, {
      cache: 'no-store'
    })
    
    if (!response.ok) {
      throw new Error(`Failed to fetch ideas: ${response.status}`)
    }
    
    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error fetching ideas:', error)
    return NextResponse.json(
      { error: 'Failed to fetch ideas' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { row_number } = body
    
    const response = await fetch(`${API_BASE}/neon/content/ideas`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ row_number })
    })
    
    if (!response.ok) {
      throw new Error(`Failed to update idea: ${response.status}`)
    }
    
    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error updating idea:', error)
    return NextResponse.json(
      { error: 'Failed to update idea' },
      { status: 500 }
    )
  }
}
