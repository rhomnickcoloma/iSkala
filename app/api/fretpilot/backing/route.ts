import { NextResponse } from 'next/server'
import { generateBackingFromPrompt, isBackingSpec, type BackingSpec } from '../../../lib/fretpilot/backingSpec'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  let prompt = ''
  try {
    const body = await req.json() as { prompt?: string }
    prompt = String(body.prompt ?? '').trim()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  if (!prompt) {
    return NextResponse.json({ error: 'Prompt required' }, { status: 400 })
  }

  const fallback = generateBackingFromPrompt(prompt)
  const key = process.env.OPENAI_API_KEY
  if (!key) {
    return NextResponse.json({ source: 'rules', spec: fallback })
  }

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        temperature: 0.3,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: 'Turn a guitarist backing-track request into a short practice loop spec. Use only these styles: funk, fusion, jazz, blues, rock, pop, reggae. If they say fusion funk and chords like Am D7, keep those chords (a Dorian vamp). Return JSON: title, style, bpm, chords (array of symbols), key, barsPerChord (1 or 2), feel, explanation. Do not claim this is a recorded studio track. Keep 2-6 chords. BPM 70-160.',
          },
          { role: 'user', content: prompt },
        ],
      }),
    })
    if (!res.ok) return NextResponse.json({ source: 'rules', spec: fallback })
    const data = await res.json() as { choices?: { message?: { content?: string } }[] }
    const parsed = JSON.parse(data.choices?.[0]?.message?.content || '{}') as Partial<BackingSpec>
    const spec = {
      ...fallback,
      ...parsed,
      chords: Array.isArray(parsed.chords) && parsed.chords.length ? parsed.chords : fallback.chords,
      bpm: typeof parsed.bpm === 'number' ? parsed.bpm : fallback.bpm,
      barsPerChord: parsed.barsPerChord === 2 ? 2 : parsed.barsPerChord === 1 ? 1 : fallback.barsPerChord,
      source: 'llm' as const,
    }
    if (!isBackingSpec(spec)) return NextResponse.json({ source: 'rules', spec: fallback })
    return NextResponse.json({ source: 'llm', spec })
  } catch {
    return NextResponse.json({ source: 'rules', spec: fallback })
  }
}
