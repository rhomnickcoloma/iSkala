'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { Icon } from '../Icons'
import LiveFretboard from './LiveFretboard'
import { analyzePhrase } from '../../lib/fretpilot/analyze'
import { attemptSummary, buildRuleCoach } from '../../lib/fretpilot/coach'
import { generateBackingFromPrompt } from '../../lib/fretpilot/backingSpec'
import type { BackingSpec } from '../../lib/fretpilot/backingSpec'
import { loadSessions, saveSession } from '../../lib/fretpilot/session'
import {
  chordTonePcs,
  GUITAR_TUNINGS,
  midiToNote,
  nameToPc,
  parseProgression,
  timingSpreadMs,
} from '../../lib/fretpilot/theory'
import { useBackingEngine } from '../../lib/fretpilot/useBackingEngine'
import { useGuitarInput } from '../../lib/fretpilot/useGuitarInput'
import type {
  AttemptRecord,
  CoachingFeedback,
  DetectedNote,
  Difficulty,
  PhraseAnalysis,
  PracticeExercise,
  SessionRecord,
} from '../../lib/fretpilot/types'

function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

export default function FretPilotApp() {
  const [difficulty, setDifficulty] = useState<Difficulty>('beginner')
  const [tuningId, setTuningId] = useState('standard')
  const [a4, setA4] = useState(440)
  const [chordInput, setChordInput] = useState('G Em C D')
  const [userKey, setUserKey] = useState('G')
  const [tempo, setTempo] = useState(90)
  const [phrase, setPhrase] = useState<DetectedNote[]>([])
  const [analysis, setAnalysis] = useState<PhraseAnalysis | null>(null)
  const [coaching, setCoaching] = useState<CoachingFeedback | null>(null)
  const [exercise, setExercise] = useState<PracticeExercise | null>(null)
  const [coachSource, setCoachSource] = useState<'rules' | 'llm'>('rules')
  const [llmConfigured, setLlmConfigured] = useState(false)
  const [coachBusy, setCoachBusy] = useState(false)
  const [coachError, setCoachError] = useState<string | null>(null)
  const [attempts, setAttempts] = useState<AttemptRecord[]>([])
  const [history, setHistory] = useState<SessionRecord[]>([])
  const [backingName, setBackingName] = useState<string | null>(null)
  const [backingUrl, setBackingUrl] = useState<string | null>(null)
  const [backingPlaying, setBackingPlaying] = useState(false)
  const [backingProgress, setBackingProgress] = useState(0)
  const [chatPrompt, setChatPrompt] = useState('Fusion funk in Am D7')
  const [chatLog, setChatLog] = useState<{ role: 'you' | 'coach'; text: string }[]>([])
  const [chatBusy, setChatBusy] = useState(false)
  const [generatedSpec, setGeneratedSpec] = useState<BackingSpec | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const backing = useBackingEngine()

  const tuning = GUITAR_TUNINGS.find(t => t.id === tuningId) ?? GUITAR_TUNINGS[0]
  const chords = useMemo(() => parseProgression(chordInput), [chordInput])
  const rootPc = nameToPc(userKey) ?? (chords[0]?.rootPc ?? null)
  const tonePcs = useMemo(() => (chords[0] ? chordTonePcs(chords[0]) : []), [chords])

  const addNote = useCallback((note: DetectedNote) => {
    setPhrase(prev => {
      const last = prev[prev.length - 1]
      if (last && last.midi === note.midi && note.startedAt - (last.endedAt ?? last.startedAt) < 400) {
        return [...prev.slice(0, -1), { ...last, endedAt: note.endedAt, confidence: Math.max(last.confidence, note.confidence) }]
      }
      return [...prev, { ...note, estimated: false }].slice(-48)
    })
  }, [])

  const input = useGuitarInput({ a4, onConfirmedNote: addNote })

  useEffect(() => {
    setHistory(loadSessions())
    fetch('/api/fretpilot/coach')
      .then(r => r.json())
      .then((d: { configured?: boolean }) => setLlmConfigured(!!d.configured))
      .catch(() => setLlmConfigured(false))
  }, [])

  useEffect(() => () => {
    if (backingUrl) URL.revokeObjectURL(backingUrl)
  }, [backingUrl])

  const tapFret = (midi: number) => {
    const n = midiToNote(midi)
    addNote({
      id: newId(),
      midi,
      name: n.name,
      octave: n.octave,
      hz: null,
      cents: 0,
      confidence: 1,
      quality: 'strong',
      startedAt: performance.now(),
      endedAt: performance.now(),
      source: 'manual',
      estimated: false,
    })
  }

  const removeNote = (id: string) => setPhrase(prev => prev.filter(n => n.id !== id))

  const metricsFromPhrase = (notes: DetectedNote[], ratio: number) => ({
    noteNames: [...new Set(notes.map(n => n.name))],
    chordToneRatio: ratio,
    noteCount: notes.length,
    timingSpreadMs: timingSpreadMs(notes.map(n => n.startedAt)),
  })

  const runAnalysis = async () => {
    if (input.listening) input.stop()
    setCoachError(null)
    const next = analyzePhrase({
      notes: phrase,
      chordInput,
      userKey,
      userTempo: tempo || null,
    })
    const { coaching: rules, exercise: ex } = buildRuleCoach(next, phrase, difficulty)
    setAnalysis(next)
    setCoaching(rules)
    setExercise(ex)
    setCoachSource('rules')

    const attempt: AttemptRecord = {
      id: newId(),
      at: Date.now(),
      ...metricsFromPhrase(phrase, next.chordToneRatio),
      summary: attemptSummary(metricsFromPhrase(phrase, next.chordToneRatio), attempts[0] ?? null),
    }
    setAttempts(prev => [attempt, ...prev].slice(0, 12))

    const record: SessionRecord = {
      id: newId(),
      at: Date.now(),
      chords: chords.map(c => c.symbol),
      key: userKey,
      difficulty,
      notes: next.uniqueNames,
      coaching: rules,
      exerciseTitle: ex.title,
      source: 'rules',
    }
    setHistory(saveSession(record))

    if (!llmConfigured) return
    setCoachBusy(true)
    try {
      const res = await fetch('/api/fretpilot/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ analysis: next, difficulty, exercise: ex }),
      })
      const data = await res.json() as { coaching?: CoachingFeedback; source?: string; error?: string }
      if (res.ok && data.coaching && data.source === 'llm') {
        setCoaching(data.coaching)
        setCoachSource('llm')
      } else if (!res.ok && data.error) {
        setCoachError(data.error)
      }
    } catch {
      setCoachError('AI coach unreachable — showing the on-device theory coach.')
    } finally {
      setCoachBusy(false)
    }
  }

  const tryAgain = async () => {
    setPhrase([])
    setAnalysis(null)
    await input.start()
  }

  const onBackingFile = (file: File | null) => {
    backing.stop()
    if (backingUrl) URL.revokeObjectURL(backingUrl)
    setBackingPlaying(false)
    setBackingProgress(0)
    if (!file) {
      setBackingName(null)
      setBackingUrl(null)
      return
    }
    setBackingName(file.name)
    setBackingUrl(URL.createObjectURL(file))
  }

  const toggleBacking = async () => {
    const el = audioRef.current
    if (!el) return
    if (el.paused) {
      backing.stop()
      await el.play()
      setBackingPlaying(true)
    } else {
      el.pause()
      setBackingPlaying(false)
    }
  }

  const applyBackingSpec = (spec: BackingSpec) => {
    setGeneratedSpec(spec)
    setChordInput(spec.chords.join(' '))
    setUserKey(spec.key)
    setTempo(spec.bpm)
    setChatLog(prev => [...prev, { role: 'coach', text: `${spec.title} · ${spec.chords.join(' – ')} · ${spec.bpm} BPM. ${spec.explanation}` }])
  }

  const generateFromChat = async () => {
    const prompt = chatPrompt.trim()
    if (!prompt) return
    setChatBusy(true)
    setChatLog(prev => [...prev, { role: 'you', text: prompt }])
    const local = generateBackingFromPrompt(prompt)
    applyBackingSpec(local)
    audioRef.current?.pause()
    setBackingPlaying(false)
    await backing.play(local)
    try {
      const res = await fetch('/api/fretpilot/backing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
        signal: AbortSignal.timeout(6000),
      })
      const data = await res.json() as { spec?: BackingSpec; source?: string }
      if (data.source === 'llm' && data.spec?.chords?.length) {
        setGeneratedSpec(data.spec)
        setChordInput(data.spec.chords.join(' '))
        setUserKey(data.spec.key)
        setTempo(data.spec.bpm)
        setChatLog(prev => {
          const next = [...prev]
          const last = [...next].reverse().findIndex(m => m.role === 'coach')
          const idx = last === -1 ? -1 : next.length - 1 - last
          const line = { role: 'coach' as const, text: `${data.spec!.title} · ${data.spec!.chords.join(' – ')} · ${data.spec!.bpm} BPM. ${data.spec!.explanation}` }
          if (idx >= 0) next[idx] = line
          else next.push(line)
          return next
        })
        await backing.play(data.spec)
      }
    } catch {
      // Local parse already applied.
    } finally {
      setChatBusy(false)
    }
  }

  const playGenerated = async () => {
    const spec = generatedSpec ?? generateBackingFromPrompt(chatPrompt || `${chordInput} in ${userKey}`)
    if (!generatedSpec) applyBackingSpec(spec)
    audioRef.current?.pause()
    setBackingPlaying(false)
    await backing.play(spec)
  }

  const liveNote = input.live ? `${input.live.name}${input.live.octave}` : '—'
  const silence = input.listening && !input.live && input.level < 0.08
  const chordCount = Math.max(chords.length, 1)

  return (
    <div className="fp-app">
      <header className="fp-header">
        <div className="fp-brand">
          <img src="/logo.png" alt="" className="fp-logo" />
          <div>
            <p className="fp-kicker">NIXX Music</p>
            <h1>FretPilot AI</h1>
            <p className="fp-sub">Listen → Understand → Teach → Try again</p>
          </div>
        </div>
        <div className="fp-header-actions">
          <label className="fp-field">
            <span>Difficulty</span>
            <select value={difficulty} onChange={e => setDifficulty(e.target.value as Difficulty)}>
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
          </label>
          <Link href="/" className="fp-link">FretWiki scales</Link>
        </div>
      </header>

      <section className="fp-listen-bar" aria-label="Listening controls">
        <button
          className={`fp-btn fp-btn-listen ${input.listening ? 'stop' : ''}`}
          onClick={() => (input.listening ? input.stop() : input.start())}
        >
          <Icon name={input.listening ? 'stop' : 'mic'} size={22} />
          {input.listening ? 'Stop' : 'Listen'}
        </button>
        <button className="fp-btn fp-btn-analyze" onClick={runAnalysis} disabled={coachBusy}>
          <Icon name="brain" size={20} />
          Analyze
        </button>
        <button className="fp-btn" onClick={tryAgain}>
          <Icon name="repeat" size={20} />
          Try Again
        </button>
        <button className="fp-btn ghost" onClick={() => { setPhrase([]); setAnalysis(null); setCoaching(null) }}>
          Clear phrase
        </button>
        <div className="fp-meter" title="Input level">
          <div className="fp-meter-fill" style={{ width: `${Math.round(input.level * 100)}%` }} />
        </div>
        <div className={`fp-status ${input.listening ? 'live' : ''}`}>
          {input.permission === 'denied' && 'Microphone blocked'}
          {input.error && input.permission !== 'denied' && input.error}
          {!input.error && input.listening && (silence ? 'Listening — play a single note' : 'Listening')}
          {!input.error && !input.listening && 'Mic off · audio stays in the browser'}
        </div>
      </section>

      {input.error && (
        <p className="fp-banner warn">{input.error}</p>
      )}

      <div className="fp-grid">
        <section className="fp-card">
          <h2>Live pitch</h2>
          <p className="fp-pitch">{liveNote}</p>
          <dl className="fp-stats">
            <div><dt>Hz</dt><dd>{input.live ? input.live.hz.toFixed(1) : '—'}</dd></div>
            <div><dt>Cents</dt><dd>{input.live ? `${input.live.cents > 0 ? '+' : ''}${input.live.cents}` : '—'}</dd></div>
            <div><dt>Confidence</dt><dd>{input.live ? `${Math.round(input.live.confidence * 100)}%` : '—'}</dd></div>
            <div><dt>Signal</dt><dd>{input.live?.quality ?? (input.listening ? 'silent' : 'off')}</dd></div>
          </dl>
          <p className="fp-fine">Monophonic estimate only — chords will not be identified from the mic.</p>
          <div className="fp-inline-fields">
            <label className="fp-field">
              <span>Tuning</span>
              <select value={tuningId} onChange={e => setTuningId(e.target.value)}>
                {GUITAR_TUNINGS.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </label>
            <label className="fp-field">
              <span>A4 ({a4} Hz)</span>
              <input type="range" min={430} max={450} value={a4} onChange={e => setA4(Number(e.target.value))} />
            </label>
          </div>
        </section>

        <section className="fp-card">
          <h2>Musical context</h2>
          <label className="fp-field">
            <span>Chord progression</span>
            <input value={chordInput} onChange={e => setChordInput(e.target.value)} placeholder="G Em C D" />
          </label>
          <div className="fp-inline-fields">
            <label className="fp-field">
              <span>Intended key</span>
              <input value={userKey} onChange={e => setUserKey(e.target.value)} placeholder="G" />
            </label>
            <label className="fp-field">
              <span>Tempo BPM</span>
              <input type="number" min={40} max={200} value={tempo} onChange={e => setTempo(Number(e.target.value) || 0)} />
            </label>
          </div>
          <div className="fp-timeline" aria-label="Chord timeline">
            {chords.length === 0 && <span className="fp-fine">Enter chords to see a timeline.</span>}
            {chords.map((c, i) => (
              <div
                key={`${c.symbol}-${i}`}
                className={`fp-timeline-cell ${(backing.playing && backing.chordIndex === i) || (backingPlaying && Math.floor(backingProgress * chordCount) === i) ? 'now' : ''}`}
              >
                {c.symbol}
              </div>
            ))}
          </div>

          <div className="fp-chat">
            <p className="fp-field-label">Ask for a backing example</p>
            <div className="fp-chat-log" aria-live="polite">
              {chatLog.length === 0 && (
                <p className="fp-fine">Try “Fusion funk in Am D7” — we build a synthesized loop from the prompt.</p>
              )}
              {chatLog.map((m, i) => (
                <p key={`${m.role}-${i}`} className={`fp-chat-line ${m.role}`}>
                  <strong>{m.role === 'you' ? 'You' : 'FretPilot'}</strong> {m.text}
                </p>
              ))}
            </div>
            <form
              className="fp-chat-form"
              onSubmit={e => { e.preventDefault(); void generateFromChat() }}
            >
              <input
                value={chatPrompt}
                onChange={e => setChatPrompt(e.target.value)}
                placeholder="Fusion funk in Am D7"
                aria-label="Backing track prompt"
              />
              <button type="submit" className="fp-btn" disabled={chatBusy}>
                {chatBusy ? '…' : 'Generate'}
              </button>
            </form>
            <div className="fp-backing">
              <button className="fp-btn fp-btn-listen" type="button" onClick={() => (backing.playing ? backing.stop() : void playGenerated())}>
                <Icon name={backing.playing ? 'stop' : 'play'} size={16} />
                {backing.playing ? 'Stop loop' : 'Play loop'}
              </button>
            </div>
          </div>

          <div className="fp-backing">
            <input
              type="file"
              accept="audio/*"
              aria-label="Upload backing track"
              onChange={e => onBackingFile(e.target.files?.[0] ?? null)}
            />
            {backingUrl && (
              <>
                <audio
                  ref={audioRef}
                  src={backingUrl}
                  onTimeUpdate={e => {
                    const el = e.currentTarget
                    setBackingProgress(el.duration ? el.currentTime / el.duration : 0)
                  }}
                  onEnded={() => { setBackingPlaying(false); setBackingProgress(0) }}
                />
                <button className="fp-btn ghost" onClick={toggleBacking}>
                  <Icon name={backingPlaying ? 'pause' : 'play'} size={16} />
                  {backingPlaying ? 'Pause' : 'Play'} file
                </button>
                <button className="fp-btn ghost" onClick={() => { const el = audioRef.current; if (el) { el.currentTime = 0; void el.play(); setBackingPlaying(true) } }}>
                  Restart
                </button>
                <span className="fp-fine">{backingName}</span>
              </>
            )}
          </div>
          <p className="fp-fine">Generated loops are synthesized in this browser (drums, bass, stabs). They are not uploaded studio tracks, and they stay separate from the guitar mic.</p>
        </section>
      </div>

      <section className="fp-card fp-board-card">
        <h2>Fretboard</h2>
        <LiveFretboard
          tuningMidi={tuning.midi}
          stringNames={tuning.names}
          live={input.live}
          phrase={phrase}
          chordTonePcs={tonePcs}
          rootPc={rootPc}
          onTap={tapFret}
        />
        <div className="fp-history-notes">
          {phrase.length === 0 && <span className="fp-fine">Note history is empty.</span>}
          {phrase.map(n => (
            <button key={n.id} className={`fp-chip ${n.source}`} onClick={() => removeNote(n.id)} title="Remove">
              {n.name}{n.octave}
              {n.source === 'mic' && n.confidence < 0.6 ? '?' : ''}
            </button>
          ))}
        </div>
      </section>

      <div className="fp-grid fp-grid-bottom">
        <section className="fp-card">
          <h2>Understand</h2>
          {!analysis && <p className="fp-fine">Analyze a phrase to see notes, likely key, and honest uncertainty.</p>}
          {analysis && (
            <>
              <p><strong>Notes:</strong> {analysis.uniqueNames.join(', ') || 'none'}</p>
              <p><strong>Key:</strong> {analysis.key ? `${analysis.key.label} (${analysis.key.source}, ${Math.round(analysis.key.confidence * 100)}%)` : 'unknown'}</p>
              <p><strong>Tempo:</strong> {analysis.tempo.note}</p>
              {analysis.modes[0] && (
                <p>
                  <strong>Possible modes:</strong>{' '}
                  {analysis.modes.slice(0, 3).map(m => `${m.root} ${m.name}${m.uncertain ? '?' : ''}`).join(' · ')}
                </p>
              )}
              {analysis.chordSummaries.length > 0 && (
                <ul className="fp-list">
                  {analysis.chordSummaries.map(c => (
                    <li key={c.symbol}>
                      <strong>{c.symbol}</strong> tones {c.chordTones.join(' ')} · played {c.playedTones.join(' ') || '—'}
                      {c.tensions.length ? ` · color/outside ${c.tensions.join(' ')}` : ''}
                    </li>
                  ))}
                </ul>
              )}
              {analysis.notes.length > 0 && (
                <ul className="fp-list">
                  {analysis.notes.map(n => (
                    <li key={n.note}>{n.note}: {n.label}{n.stable ? ' (stable)' : ' (tension / outside)'}</li>
                  ))}
                </ul>
              )}
              {analysis.uncertainties.length > 0 && (
                <div className="fp-uncertain">
                  {analysis.uncertainties.map(u => <p key={u}>{u}</p>)}
                </div>
              )}
            </>
          )}
        </section>

        <section className="fp-card fp-coach">
          <h2>Coach</h2>
          <p className="fp-fine">
            {coachSource === 'llm'
              ? 'AI coach is using structured analysis only — raw audio is not uploaded.'
              : llmConfigured
                ? 'On-device theory coach (AI can replace this after Analyze).'
                : 'On-device theory coach. Add OPENAI_API_KEY on the server for optional LLM coaching.'}
          </p>
          {coachBusy && <p className="fp-fine">Asking the AI coach…</p>}
          {coachError && <p className="fp-banner warn">{coachError}</p>}
          {!coaching && <p>Press Analyze after you play or tap a phrase.</p>}
          {coaching && (
            <ol className="fp-coach-steps">
              <li><strong>What you played.</strong> {coaching.played}</li>
              <li><strong>What it means.</strong> {coaching.meaning}</li>
              <li><strong>What worked.</strong> {coaching.worked}</li>
              <li><strong>One improvement.</strong> {coaching.improve}</li>
              <li><strong>Try this.</strong> {coaching.exercise}</li>
              <li><strong>Listen for.</strong> {coaching.listenFor}</li>
            </ol>
          )}
        </section>
      </div>

      {exercise && (
        <section className="fp-card">
          <h2>Exercise · {exercise.title}</h2>
          <p><strong>Goal:</strong> {exercise.goal}</p>
          <p><strong>Do this:</strong> {exercise.instructions}</p>
          <p><strong>Context:</strong> {exercise.context}{exercise.tempoBpm ? ` · ~${exercise.tempoBpm} BPM` : ''}</p>
          <p><strong>Listen for:</strong> {exercise.listenFor}</p>
          <p><strong>How to tell:</strong> {exercise.evaluate}</p>
          <button className="fp-btn fp-btn-listen" onClick={tryAgain}>
            <Icon name="repeat" size={18} /> Try Again
          </button>
        </section>
      )}

      <section className="fp-card">
        <h2>Attempts</h2>
        {attempts.length === 0 && <p className="fp-fine">Analyze at least once to start a comparison loop.</p>}
        <ul className="fp-list">
          {attempts.map((a, i) => (
            <li key={a.id}>
              <strong>{i === 0 ? 'Latest' : `Take ${attempts.length - i}`}</strong>
              {' '}{a.noteNames.join(', ') || 'no notes'} · {Math.round(a.chordToneRatio * 100)}% chord tones
              <div className="fp-fine">{a.summary}</div>
            </li>
          ))}
        </ul>
      </section>

      <section className="fp-card">
        <h2>Session history</h2>
        {history.length === 0 && <p className="fp-fine">Saved on this device only.</p>}
        <ul className="fp-list">
          {history.map(s => (
            <li key={s.id}>
              {new Date(s.at).toLocaleString()} · {s.chords.join('–') || 'no chords'} · {s.exerciseTitle} · {s.source === 'llm' ? 'AI' : 'theory'} coach
            </li>
          ))}
        </ul>
      </section>

      <footer className="fp-footer">
        <Link href="/">FretWiki</Link>
        <Link href="/about">About</Link>
        <Link href="/terms">Terms</Link>
        <span>Pitch stays in the browser. Optional AI sees notes and chords, never the recording.</span>
      </footer>
    </div>
  )
}
