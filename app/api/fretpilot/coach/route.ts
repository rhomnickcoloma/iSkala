import { NextResponse } from 'next/server'
import type { CoachingFeedback, Difficulty, PhraseAnalysis, PracticeExercise } from '../../../lib/fretpilot/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function configured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY)
}

export async function GET() {
  return NextResponse.json({ configured: configured() })
}

function isFeedback(value: unknown): value is CoachingFeedback {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return ['played', 'meaning', 'worked', 'improve', 'exercise', 'listenFor']
    .every(k => typeof v[k] === 'string' && String(v[k]).trim().length > 0)
}

export async function POST(req: Request) {
  const key = process.env.OPENAI_API_KEY
  if (!key) {
    return NextResponse.json(
      { source: 'unavailable', error: 'No OPENAI_API_KEY configured. Using the on-device coach.' },
      { status: 503 },
    )
  }

  let body: { analysis?: PhraseAnalysis; difficulty?: Difficulty; exercise?: PracticeExercise }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!body.analysis || !Array.isArray(body.analysis.uniqueNames)) {
    return NextResponse.json({ error: 'Structured analysis is required.' }, { status: 400 })
  }

  const system = `You are FretPilot, a guitar coach. You only talk about the structured analysis you are given. Never invent notes, chords, MIDI, or tempos that are not in the JSON. If the analysis is uncertain, say so. Modes are not just rotations of a parent major scale: explain them from the tonal center and characteristic interval, and mention the parent collection only to contrast. Write six short paragraphs matching keys played, meaning, worked, improve, exercise, listenFor. Practical, specific, no hype.`

  const payload = {
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    temperature: 0.4,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: system },
      {
        role: 'user',
        content: JSON.stringify({
          analysis: body.analysis,
          difficulty: body.difficulty ?? 'beginner',
          suggestedExercise: body.exercise ?? null,
          format: {
            played: 'what they played',
            meaning: 'what it means musically',
            worked: 'what worked and why',
            improve: 'one improvement',
            exercise: 'specific next exercise',
            listenFor: 'what to listen for',
          },
        }),
      },
    ],
  }

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      return NextResponse.json(
        { source: 'unavailable', error: 'AI provider rejected the request. Showing the on-device coach.' },
        { status: 502 },
      )
    }
    const data = await res.json() as { choices?: { message?: { content?: string } }[] }
    const raw = data.choices?.[0]?.message?.content
    if (!raw) {
      return NextResponse.json({ source: 'unavailable', error: 'Empty AI response.' }, { status: 502 })
    }
    const parsed = JSON.parse(raw) as unknown
    if (!isFeedback(parsed)) {
      return NextResponse.json({ source: 'unavailable', error: 'AI response was malformed.' }, { status: 502 })
    }
    return NextResponse.json({ source: 'llm', coaching: parsed })
  } catch {
    return NextResponse.json(
      { source: 'unavailable', error: 'AI coach failed. Showing the on-device coach.' },
      { status: 502 },
    )
  }
}
