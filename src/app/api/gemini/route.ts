import { NextRequest, NextResponse } from 'next/server'

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash'

export async function POST(request: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY

  if (!apiKey) {
    return NextResponse.json(
      { error: 'Missing Gemini API key. Set GEMINI_API_KEY in Vercel environment variables.' },
      { status: 500 }
    )
  }

  let payload: Record<string, unknown>

  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid Gemini request payload.' }, { status: 400 })
  }

  const requestedModel = typeof payload.model === 'string' && payload.model ? payload.model : GEMINI_MODEL
  const timeoutMs = typeof payload.timeoutMs === 'number' ? payload.timeoutMs : 30000
  const { model: _ignoredModel, timeoutMs: _ignoredTimeout, ...geminiPayload } = payload

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  let response: Response

  try {
    response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${requestedModel}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(geminiPayload),
      cache: 'no-store',
      signal: controller.signal
    })
  } catch (error) {
    clearTimeout(timeoutId)

    if (error instanceof Error && error.name === 'AbortError') {
      return NextResponse.json(
        { error: `Gemini request timed out after ${timeoutMs}ms.` },
        { status: 504 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to reach Gemini.' },
      { status: 502 }
    )
  }

  clearTimeout(timeoutId)

  const text = await response.text()
  const data = text ? safeParseJson(text) : {}

  if (!response.ok) {
    return NextResponse.json(
      {
        error: extractGeminiError(data, response.status),
        details: data
      },
      { status: response.status }
    )
  }

  return NextResponse.json(data)
}

function safeParseJson(text: string) {
  try {
    return JSON.parse(text)
  } catch {
    return { raw: text }
  }
}

function extractGeminiError(data: any, status: number) {
  return data?.error?.message || `Gemini request failed with status ${status}.`
}