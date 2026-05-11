import { NextRequest, NextResponse } from 'next/server'

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash'
const GEMINI_CACHE_TTL_MS = 90_000
const GEMINI_MAX_RETRIES = 2
const GEMINI_RETRY_BASE_DELAY_MS = 120

const geminiResponseCache = new Map<string, { expiresAt: number; data: unknown }>()
const geminiInflightRequests = new Map<string, Promise<unknown>>()

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
  const stream = payload.stream === true
  const bypassCache = payload.bypassCache === true
  const { model: _ignoredModel, timeoutMs: _ignoredTimeout, stream: _ignoredStream, bypassCache: _ignoredBypassCache, ...geminiPayload } = payload
  const normalizedPayload = normalizeGeminiPayload(geminiPayload)

  if (stream) {
    return handleGeminiStream({
      apiKey,
      requestedModel,
      payload: normalizedPayload,
      timeoutMs
    })
  }

  const cacheKey = stableStringify({ model: requestedModel, payload: normalizedPayload })
  const cached = bypassCache ? null : geminiResponseCache.get(cacheKey)

  if (!bypassCache && cached && cached.expiresAt > Date.now()) {
    return NextResponse.json(cached.data)
  }

  const inflight = bypassCache ? null : geminiInflightRequests.get(cacheKey)
  if (inflight) {
    const data = await inflight
    return NextResponse.json(data)
  }

  const requestPromise = fetchGeminiWithRetry({
    apiKey,
    requestedModel,
    payload: normalizedPayload,
    timeoutMs
  })

  if (!bypassCache) {
    geminiInflightRequests.set(cacheKey, requestPromise)
  }

  try {
    const data = await requestPromise
    if (!bypassCache) {
      geminiResponseCache.set(cacheKey, {
        expiresAt: Date.now() + GEMINI_CACHE_TTL_MS,
        data
      })
    }
    return NextResponse.json(data)
  } catch (error) {
    if (error instanceof GeminiHttpError) {
      return NextResponse.json(
        {
          error: extractGeminiError(error.data, error.status),
          details: error.data
        },
        { status: error.status }
      )
    }

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
  } finally {
    if (!bypassCache) {
      geminiInflightRequests.delete(cacheKey)
    }
  }
}

class GeminiHttpError extends Error {
  status: number
  data: unknown

  constructor(status: number, data: unknown) {
    super(`Gemini request failed with status ${status}.`)
    this.status = status
    this.data = data
  }
}

async function fetchGeminiWithRetry({
  apiKey,
  requestedModel,
  payload,
  timeoutMs
}: {
  apiKey: string
  requestedModel: string
  payload: unknown
  timeoutMs: number
}) {
  let lastError: unknown = null

  for (let attempt = 0; attempt <= GEMINI_MAX_RETRIES; attempt += 1) {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${requestedModel}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        cache: 'no-store',
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      const text = await response.text()
      const data = text ? safeParseJson(text) : {}

      if (!response.ok) {
        if (attempt < GEMINI_MAX_RETRIES && isRetryableStatus(response.status)) {
          await sleep(GEMINI_RETRY_BASE_DELAY_MS * (attempt + 1))
          continue
        }

        throw new GeminiHttpError(response.status, data)
      }

      return data
    } catch (error) {
      clearTimeout(timeoutId)
      lastError = error

      if (error instanceof GeminiHttpError) {
        throw error
      }

      if (attempt === GEMINI_MAX_RETRIES) {
        throw error
      }

      await sleep(GEMINI_RETRY_BASE_DELAY_MS * (attempt + 1))
    }
  }

  throw lastError
}

function normalizeGeminiPayload(value: unknown): unknown {
  if (typeof value === 'string') return compactPromptText(value)
  if (Array.isArray(value)) return value.map(normalizeGeminiPayload)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entryValue]) => entryValue !== undefined)
        .map(([key, entryValue]) => [key, normalizeGeminiPayload(entryValue)])
    )
  }

  return value
}

function compactPromptText(value: string) {
  return value
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`

  const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right))
  return `{${entries.map(([key, entryValue]) => `${JSON.stringify(key)}:${stableStringify(entryValue)}`).join(',')}}`
}

function isRetryableStatus(status: number) {
  return status === 408 || status === 429 || status >= 500
}

function sleep(delayMs: number) {
  return new Promise((resolve) => setTimeout(resolve, delayMs))
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

async function handleGeminiStream({
  apiKey,
  requestedModel,
  payload,
  timeoutMs
}: {
  apiKey: string
  requestedModel: string
  payload: unknown
  timeoutMs: number
}) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${requestedModel}:streamGenerateContent?alt=sse&key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      cache: 'no-store',
      signal: controller.signal
    })

    if (!response.ok) {
      clearTimeout(timeoutId)
      const text = await response.text()
      const data = text ? safeParseJson(text) : {}
      return NextResponse.json(
        {
          error: extractGeminiError(data, response.status),
          details: data
        },
        { status: response.status }
      )
    }

    if (!response.body) {
      clearTimeout(timeoutId)
      return NextResponse.json({ error: 'Gemini stream was unavailable.' }, { status: 502 })
    }

    const reader = response.body.getReader()
    const stream = new ReadableStream<Uint8Array>({
      async start(streamController) {
        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            if (value) streamController.enqueue(value)
          }
          streamController.close()
        } catch (error) {
          streamController.error(error)
        } finally {
          clearTimeout(timeoutId)
          try {
            reader.releaseLock()
          } catch {}
        }
      },
      cancel() {
        clearTimeout(timeoutId)
        controller.abort()
        try {
          reader.releaseLock()
        } catch {}
      }
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no'
      }
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
}