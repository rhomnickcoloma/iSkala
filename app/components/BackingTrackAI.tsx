'use client'

import { useEffect, useState } from 'react'
import { Icon } from './Icons'
import { generateBackingFromPrompt, type BackingSpec } from '../lib/fretpilot/backingSpec'
import { useBackingEngine } from '../lib/fretpilot/useBackingEngine'

const EXAMPLES = [
  'Fusion funk in Am D7',
  'Blues shuffle in G',
  'Jazz ii-V-I in C',
]

interface Props {
  onSpec?: (spec: BackingSpec) => void
  active?: boolean
}

export default function BackingTrackAI({ onSpec, active = true }: Props) {
  const [prompt, setPrompt] = useState('Fusion funk in Am D7')
  const [busy, setBusy] = useState(false)
  const [spec, setSpec] = useState<BackingSpec | null>(null)
  const [log, setLog] = useState<{ role: 'you' | 'ai'; text: string }[]>([])
  const engine = useBackingEngine()
  const stop = engine.stop

  useEffect(() => {
    if (!active) stop()
  }, [active, stop])

  const apply = async (next: BackingSpec) => {
    setSpec(next)
    onSpec?.(next)
    setLog(prev => [...prev, { role: 'ai', text: `${next.title} · ${next.chords.join(' – ')} · ${next.bpm} BPM. ${next.explanation}` }])
    try {
      await engine.play(next)
    } catch {
      // Web Audio may be blocked; the spec is still shown.
    }
  }

  const generate = async (text: string) => {
    const q = text.trim()
    if (!q) return
    setBusy(true)
    setLog(prev => [...prev, { role: 'you', text: q }])
    const local = generateBackingFromPrompt(q)
    await apply(local)
    try {
      const res = await fetch('/api/fretpilot/backing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: q }),
        signal: AbortSignal.timeout(6000),
      })
      const data = await res.json() as { spec?: BackingSpec; source?: string }
      if (data.source === 'llm' && data.spec?.chords?.length) {
        setSpec(data.spec)
        onSpec?.(data.spec)
        setLog(prev => {
          const next = [...prev]
          const lastAi = [...next].reverse().findIndex(m => m.role === 'ai')
          const idx = lastAi === -1 ? -1 : next.length - 1 - lastAi
          const line = { role: 'ai' as const, text: `${data.spec!.title} · ${data.spec!.chords.join(' – ')} · ${data.spec!.bpm} BPM. ${data.spec!.explanation}` }
          if (idx >= 0) next[idx] = line
          else next.push(line)
          return next
        })
        await engine.play(data.spec)
      }
    } catch {
      // Local parse already applied.
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="bt-ai">
      <p className="bt-ai-lead">
        Describe a groove. AI is on by default — we play a sampled practice loop of your chords.
      </p>
      <div className="bt-ai-examples">
        {EXAMPLES.map(ex => (
          <button key={ex} type="button" className="bt-ai-chip" onClick={() => { setPrompt(ex); void generate(ex) }}>
            {ex}
          </button>
        ))}
      </div>
      <div className="bt-ai-log" aria-live="polite">
        {log.length === 0 && <p className="bt-ai-hint">Example: “Fusion funk in Am D7”</p>}
        {log.map((m, i) => (
          <p key={`${m.role}-${i}`} className={`bt-ai-line ${m.role}`}>
            <strong>{m.role === 'you' ? 'You' : 'AI'}</strong> {m.text}
          </p>
        ))}
      </div>
      <form className="bt-ai-form" onSubmit={e => { e.preventDefault(); void generate(prompt) }}>
        <input
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          aria-label="Backing track prompt"
          placeholder="Fusion funk in Am D7"
        />
        <button type="submit" className="bt-ai-generate" disabled={busy}>
          {busy ? '…' : 'Generate'}
        </button>
      </form>
      {spec && (
        <div className="bt-ai-result">
          <div className="bt-ai-timeline">
            {spec.chords.map((c, i) => (
              <span key={`${c}-${i}`} className={`bt-ai-cell ${engine.playing && engine.chordIndex === i ? 'now' : ''}`}>{c}</span>
            ))}
          </div>
          <p className="bt-ai-meta">{spec.feel} · {spec.key} · {spec.source === 'llm' ? 'AI parsed' : 'on-device parse'}</p>
        </div>
      )}
      <button
        type="button"
        className={`cp-play-btn ${engine.playing ? 'playing' : ''}`}
        onClick={() => (engine.playing ? engine.stop() : spec ? void engine.play(spec) : void generate(prompt))}
      >
        {engine.playing ? <><Icon name="stop" size="1em" /> Stop</> : <><Icon name="play" size="1em" /> Play</>}
      </button>
      <p className="bt-ai-fine">Sampled Rhodes, bass, and drums so you can hear the progression. This is not a Suno-generated song — that needs a music model, not a browser sketch. Switch to Classic for the original chord player.</p>
    </div>
  )
}
