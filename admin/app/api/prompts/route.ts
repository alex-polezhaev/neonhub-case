import { NextResponse } from 'next/server'

const API_BASE = `${process.env.N8N_BASE_URL || 'https://n8n.example.com'}/webhook`

export async function GET() {
  try {
    const response = await fetch(`${API_BASE}/neon/content/prompts`, {
      cache: 'no-store'
    })
    
    if (!response.ok) {
      throw new Error(`Failed to fetch prompts: ${response.status}`)
    }
    
    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error fetching prompts:', error)
    return NextResponse.json(
      { error: 'Failed to fetch prompts' },
      { status: 500 }
    )
  }
}
