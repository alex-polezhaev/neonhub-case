import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 300

const JOB_SERVER_URL =
  process.env.JOB_SERVER_URL ||
  process.env.NEXT_PUBLIC_JOB_SERVER_URL ||
  'http://job-server.example.com:3001'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 300_000)
    const response = await fetch(`${JOB_SERVER_URL}/create-job`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    clearTimeout(timeout)
    const text = await response.text()
    let data: unknown
    try { data = JSON.parse(text) } catch { data = { raw: text } }
    if (!response.ok) {
      return NextResponse.json({ error: `Server error ${response.status}: ${text}` }, { status: response.status })
    }
    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
