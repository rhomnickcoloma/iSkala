'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

interface TunerProps {
  onClose: () => void
}

// Standard guitar tuning frequencies (Hz)
const GUITAR_STRINGS = [
  { note: 'E2', frequency: 82.41, string: 6 },
  { note: 'A2', frequency: 110.00, string: 5 },
  { note: 'D3', frequency: 146.83, string: 4 },
  { note: 'G3', frequency: 196.00, string: 3 },
  { note: 'B3', frequency: 246.94, string: 2 },
  { note: 'E4', frequency: 329.63, string: 1 },
]

// All chromatic notes with frequencies for detection
const NOTE_FREQUENCIES: { note: string; frequency: number }[] = []

// Generate all notes from C1 to C7
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
for (let octave = 1; octave <= 6; octave++) {
  for (let i = 0; i < NOTE_NAMES.length; i++) {
    const noteIndex = (octave - 1) * 12 + i - 9 // A4 = 440Hz is index 0
    const frequency = 440 * Math.pow(2, noteIndex / 12)
    NOTE_FREQUENCIES.push({
      note: `${NOTE_NAMES[i]}${octave}`,
      frequency: frequency
    })
  }
}

// Find closest note to a frequency
function getClosestNote(frequency: number): { note: string; targetFreq: number; cents: number } {
  let closestNote = NOTE_FREQUENCIES[0]
  let minDiff = Math.abs(frequency - closestNote.frequency)
  
  for (const noteData of NOTE_FREQUENCIES) {
    const diff = Math.abs(frequency - noteData.frequency)
    if (diff < minDiff) {
      minDiff = diff
      closestNote = noteData
    }
  }
  
  // Calculate cents (100 cents = 1 semitone)
  const cents = 1200 * Math.log2(frequency / closestNote.frequency)
  
  return {
    note: closestNote.note,
    targetFreq: closestNote.frequency,
    cents: Math.round(cents)
  }
}

// Autocorrelation pitch detection
function autoCorrelate(buffer: Float32Array, sampleRate: number): number {
  const SIZE = buffer.length
  const MAX_SAMPLES = Math.floor(SIZE / 2)
  let bestOffset = -1
  let bestCorrelation = 0
  let rms = 0
  let foundGoodCorrelation = false
  
  // Calculate RMS (volume level)
  for (let i = 0; i < SIZE; i++) {
    const val = buffer[i]
    rms += val * val
  }
  rms = Math.sqrt(rms / SIZE)
  
  // Not enough signal
  if (rms < 0.01) return -1
  
  let lastCorrelation = 1
  
  for (let offset = 0; offset < MAX_SAMPLES; offset++) {
    let correlation = 0
    
    for (let i = 0; i < MAX_SAMPLES; i++) {
      correlation += Math.abs(buffer[i] - buffer[i + offset])
    }
    
    correlation = 1 - correlation / MAX_SAMPLES
    
    if (correlation > 0.9 && correlation > lastCorrelation) {
      foundGoodCorrelation = true
      if (correlation > bestCorrelation) {
        bestCorrelation = correlation
        bestOffset = offset
      }
    } else if (foundGoodCorrelation) {
      // We've found a good correlation, then a bad one, so we're done
      const shift = (buffer[bestOffset - 1] - buffer[bestOffset + 1]) / buffer[bestOffset]
      return sampleRate / (bestOffset + 8 * shift)
    }
    
    lastCorrelation = correlation
  }
  
  if (bestCorrelation > 0.01) {
    return sampleRate / bestOffset
  }
  
  return -1
}

export default function Tuner({ onClose }: TunerProps) {
  const [isListening, setIsListening] = useState(false)
  const [hasPermission, setHasPermission] = useState<boolean | null>(null)
  const [detectedFrequency, setDetectedFrequency] = useState<number | null>(null)
  const [detectedNote, setDetectedNote] = useState<string | null>(null)
  const [cents, setCents] = useState<number>(0)
  const [volume, setVolume] = useState<number>(0)
  
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const bufferRef = useRef<Float32Array | null>(null)

  const startListening = useCallback(async () => {
    try {
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        } 
      })
      
      mediaStreamRef.current = stream
      setHasPermission(true)
      
      // Create audio context
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      audioContextRef.current = audioContext
      
      // Create analyser node
      const analyser = audioContext.createAnalyser()
      analyser.fftSize = 4096
      analyser.smoothingTimeConstant = 0.8
      analyserRef.current = analyser
      
      // Connect microphone to analyser
      const source = audioContext.createMediaStreamSource(stream)
      source.connect(analyser)
      
      // Create buffer for time domain data
      bufferRef.current = new Float32Array(analyser.fftSize)
      
      setIsListening(true)
      
      // Start pitch detection loop
      const detectPitch = () => {
        if (!analyserRef.current || !bufferRef.current) return
        
        analyserRef.current.getFloatTimeDomainData(bufferRef.current)
        
        // Calculate volume
        let sum = 0
        for (let i = 0; i < bufferRef.current.length; i++) {
          sum += bufferRef.current[i] * bufferRef.current[i]
        }
        const rms = Math.sqrt(sum / bufferRef.current.length)
        setVolume(Math.min(rms * 5, 1)) // Normalize to 0-1
        
        // Detect pitch
        const frequency = autoCorrelate(bufferRef.current, audioContext.sampleRate)
        
        if (frequency > 0 && frequency < 1000) {
          setDetectedFrequency(Math.round(frequency * 10) / 10)
          const noteInfo = getClosestNote(frequency)
          setDetectedNote(noteInfo.note)
          setCents(noteInfo.cents)
        } else {
          // No clear pitch detected
          if (rms < 0.01) {
            setDetectedFrequency(null)
            setDetectedNote(null)
            setCents(0)
          }
        }
        
        animationFrameRef.current = requestAnimationFrame(detectPitch)
      }
      
      detectPitch()
      
    } catch (error) {
      console.error('Microphone access denied:', error)
      setHasPermission(false)
    }
  }, [])

  const stopListening = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }
    
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop())
      mediaStreamRef.current = null
    }
    
    if (audioContextRef.current) {
      audioContextRef.current.close()
      audioContextRef.current = null
    }
    
    setIsListening(false)
    setDetectedFrequency(null)
    setDetectedNote(null)
    setCents(0)
    setVolume(0)
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopListening()
    }
  }, [stopListening])

  // Get tuning status color and text
  const getTuningStatus = (): { color: string; status: string } => {
    if (cents === 0) return { color: '#2ecc71', status: 'In Tune!' }
    if (Math.abs(cents) <= 5) return { color: '#2ecc71', status: 'In Tune!' }
    if (Math.abs(cents) <= 10) return { color: '#f1c40f', status: cents > 0 ? 'Slightly Sharp' : 'Slightly Flat' }
    if (Math.abs(cents) <= 25) return { color: '#e67e22', status: cents > 0 ? 'Sharp' : 'Flat' }
    return { color: '#e74c3c', status: cents > 0 ? 'Too Sharp' : 'Too Flat' }
  }

  const tuningStatus = getTuningStatus()

  // Check if detected note matches a guitar string
  const matchingString = GUITAR_STRINGS.find(s => 
    detectedNote && s.note === detectedNote
  )

  return (
    <div className="comparison-overlay">
      <div className="tuner-modal">
        <div className="comparison-header">
          <h2>🎸 Guitar Tuner</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="tuner-content">
          {/* Microphone Permission Status */}
          {hasPermission === false && (
            <div className="tuner-permission-denied">
              <p>⚠️ Microphone access denied</p>
              <p className="small">Please allow microphone access in your browser settings to use the tuner.</p>
            </div>
          )}

          {/* Start/Stop Button */}
          <div className="tuner-controls">
            <button 
              className={`tuner-toggle-btn ${isListening ? 'active' : ''}`}
              onClick={isListening ? stopListening : startListening}
            >
              {isListening ? (
                <>
                  <span className="mic-icon listening">🎙️</span>
                  <span>Stop Listening</span>
                </>
              ) : (
                <>
                  <span className="mic-icon">🎤</span>
                  <span>Start Tuning</span>
                </>
              )}
            </button>
          </div>

          {/* Main Tuner Display */}
          <div className={`tuner-display ${isListening ? 'active' : ''}`}>
            {/* Volume Indicator */}
            <div className="volume-indicator">
              <div className="volume-bar" style={{ height: `${volume * 100}%` }} />
              <span className="volume-label">Vol</span>
            </div>

            {/* Note and Meter Container */}
            <div className="tuner-main">
              {/* Note Display */}
              <div className="note-display">
                {detectedNote ? (
                  <>
                    <div className="detected-note" style={{ color: tuningStatus.color }}>
                      {detectedNote.replace(/\d/g, '')}
                      <span className="octave">{detectedNote.match(/\d/)?.[0]}</span>
                    </div>
                    <div className="detected-frequency">
                      {detectedFrequency} Hz
                    </div>
                    <div className="tuning-status" style={{ color: tuningStatus.color }}>
                      {tuningStatus.status}
                    </div>
                    {matchingString && (
                      <div className="string-match">
                        String {matchingString.string}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="no-signal">
                    {isListening ? (
                      <>
                        <span className="waiting-icon">〰️</span>
                        <span>Play a note...</span>
                      </>
                    ) : (
                      <>
                        <span className="waiting-icon">🎸</span>
                        <span>Click to start</span>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Cents Meter */}
              <div className="cents-meter">
                <div className="cents-scale">
                  <span className="cents-mark flat">♭</span>
                  <div className="cents-track">
                    <div className="cents-markers">
                      {[-50, -25, 0, 25, 50].map(mark => (
                        <div key={mark} className="cents-marker" style={{ left: `${(mark + 50)}%` }}>
                          <span className="marker-line" />
                          {mark === 0 && <span className="marker-label">|</span>}
                        </div>
                      ))}
                    </div>
                    <div 
                      className="cents-needle"
                      style={{ 
                        left: `${Math.max(0, Math.min(100, (cents + 50)))}%`,
                        backgroundColor: tuningStatus.color,
                        opacity: detectedNote ? 1 : 0.3
                      }}
                    />
                  </div>
                  <span className="cents-mark sharp">♯</span>
                </div>
                {detectedNote && (
                  <div className="cents-value">
                    {cents > 0 ? '+' : ''}{cents} cents
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Guitar String Reference */}
          <div className="string-reference">
            <h4>Standard Tuning Reference</h4>
            <div className="strings-grid">
              {GUITAR_STRINGS.map((string) => {
                const isActive = matchingString?.string === string.string && Math.abs(cents) <= 10
                return (
                  <div 
                    key={string.string} 
                    className={`string-item ${isActive ? 'active' : ''}`}
                  >
                    <div className="string-number">{string.string}</div>
                    <div className="string-note">{string.note.replace(/\d/g, '')}</div>
                    <div className="string-freq">{string.frequency.toFixed(1)} Hz</div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Tips */}
          <div className="tuner-tips">
            <p>💡 <strong>Tips:</strong> Play one string at a time. Let the note ring clearly. Position your device close to the guitar for best results.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
