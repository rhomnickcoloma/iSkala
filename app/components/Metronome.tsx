'use client'

import { useState, useEffect, useCallback } from 'react'

export default function Metronome() {
  const [bpm, setBpm] = useState<number>(120)
  const [timeSignature, setTimeSignature] = useState<number>(4)
  const [currentBeat, setCurrentBeat] = useState<number>(1)
  const [isPlaying, setIsPlaying] = useState<boolean>(false)
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null)
  const [intervalId, setIntervalId] = useState<NodeJS.Timeout | null>(null)

  const playClick = useCallback((ctx: AudioContext, isAccent: boolean) => {
    const oscillator = ctx.createOscillator()
    const gainNode = ctx.createGain()
    
    oscillator.connect(gainNode)
    gainNode.connect(ctx.destination)
    
    oscillator.frequency.value = isAccent ? 1000 : 800
    oscillator.type = 'sine'
    
    const volume = isAccent ? 0.4 : 0.25
    gainNode.gain.setValueAtTime(volume, ctx.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1)
    
    oscillator.start(ctx.currentTime)
    oscillator.stop(ctx.currentTime + 0.1)
  }, [])

  const startMetronome = useCallback(() => {
    const ctx = new (window.AudioContext || (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
    setAudioContext(ctx)
    
    const interval = (60 / bpm) * 1000
    let beat = 1
    setCurrentBeat(1)
    playClick(ctx, true)
    
    const id = setInterval(() => {
      beat = beat >= timeSignature ? 1 : beat + 1
      setCurrentBeat(beat)
      playClick(ctx, beat === 1)
    }, interval)
    
    setIntervalId(id)
    setIsPlaying(true)
  }, [bpm, timeSignature, playClick])

  const stopMetronome = useCallback(() => {
    if (intervalId) {
      clearInterval(intervalId)
      setIntervalId(null)
    }
    if (audioContext) {
      audioContext.close()
      setAudioContext(null)
    }
    setIsPlaying(false)
    setCurrentBeat(1)
  }, [intervalId, audioContext])

  const toggleMetronome = () => {
    if (isPlaying) {
      stopMetronome()
    } else {
      startMetronome()
    }
  }

  const adjustBpm = (delta: number) => {
    const newBpm = Math.min(240, Math.max(40, bpm + delta))
    setBpm(newBpm)
    if (isPlaying) {
      stopMetronome()
      setTimeout(() => {
        startMetronome()
      }, 50)
    }
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalId) clearInterval(intervalId)
      if (audioContext) audioContext.close()
    }
  }, [intervalId, audioContext])

  return (
    <div className="metronome">
      <div className="time-signature">
        <span className="time-sig-label">Time</span>
        <div className="time-sig-buttons">
          {[2, 3, 4, 6].map(sig => (
            <button 
              key={sig}
              className={`time-sig-btn ${timeSignature === sig ? 'active' : ''}`}
              onClick={() => setTimeSignature(sig)}
            >
              {sig}/4
            </button>
          ))}
        </div>
      </div>

      <div className="beat-indicator">
        {Array.from({ length: timeSignature }, (_, i) => (
          <span 
            key={i} 
            className={`beat-dot ${currentBeat === i + 1 && isPlaying ? 'active' : ''} ${i === 0 ? 'accent' : ''}`}
          />
        ))}
      </div>

      <div className="metronome-display">
        <span className="bpm-value">{bpm}</span>
        <span className="bpm-label">BPM</span>
      </div>

      <div className="metronome-controls">
        <button className="bpm-btn" onClick={() => adjustBpm(-5)}>−5</button>
        <button className="bpm-btn" onClick={() => adjustBpm(-1)}>−1</button>
        <button 
          className={`play-btn ${isPlaying ? 'playing' : ''}`}
          onClick={toggleMetronome}
        >
          {isPlaying ? (
            <svg viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="4" width="4" height="16" rx="1"/>
              <rect x="14" y="4" width="4" height="16" rx="1"/>
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z"/>
            </svg>
          )}
        </button>
        <button className="bpm-btn" onClick={() => adjustBpm(1)}>+1</button>
        <button className="bpm-btn" onClick={() => adjustBpm(5)}>+5</button>
      </div>

      <div className="tempo-presets">
        <button className={`tempo-btn ${bpm === 60 ? 'active' : ''}`} onClick={() => setBpm(60)}>Slow</button>
        <button className={`tempo-btn ${bpm === 90 ? 'active' : ''}`} onClick={() => setBpm(90)}>Medium</button>
        <button className={`tempo-btn ${bpm === 120 ? 'active' : ''}`} onClick={() => setBpm(120)}>Fast</button>
        <button className={`tempo-btn ${bpm === 160 ? 'active' : ''}`} onClick={() => setBpm(160)}>Shred</button>
      </div>
    </div>
  )
}
