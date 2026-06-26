import { NextResponse } from 'next/server'

const API_BASE = `${process.env.N8N_BASE_URL || 'https://n8n.example.com'}/webhook`

export async function POST(request: Request) {
  try {
    const tasks = await request.json()
    
    const response = await fetch(`${API_BASE}/neon/content/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(tasks)
    })
    
    const text = await response.text()
    let data: unknown
    try { data = JSON.parse(text) } catch { data = { raw: text } }

    if (!response.ok) {
      console.error('n8n error:', response.status, text)
      return NextResponse.json(
        { error: `n8n error ${response.status}: ${text}` },
        { status: response.status }
      )
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error creating tasks:', error)
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    )
  }
}
