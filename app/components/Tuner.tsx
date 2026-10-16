'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useInstrument } from '../context/InstrumentContext'
import { Icon } from './Icons'
import { autoCorrelate, getClosestNote } from '../lib/pitch'

interface TunerProps {
  onClose: () => void
}

export default function Tuner({ onClose }: TunerProps) {
  const { instrument } = useInstrument()
  const INSTRUMENT_STRINGS = instrument.tunerStrings

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
  const bufferRef = useRef<Float32Array<ArrayBuffer> | null>(null)

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
      const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
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
  const matchingString = INSTRUMENT_STRINGS.find(s => 
    detectedNote && s.note === detectedNote
  )

  return (
    <div className="comparison-overlay">
      <div className="tuner-modal">
        <div className="comparison-header">
          <h1><Icon name={instrument.icon} size="0.9em" className="inline-icon" />{instrument.name} Tuner</h1>
          <button className="close-btn" onClick={onClose} aria-label="Close"><Icon name="x" size={18} /></button>
        </div>

        <div className="tuner-content">
          {/* Microphone Permission Status */}
          {hasPermission === false && (
            <div className="tuner-permission-denied">
              <p><Icon name="alert" size="1em" className="inline-icon" />Microphone access denied</p>
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
                  <Icon name="mic" size="1.1em" className="mic-icon listening" />
                  <span>Stop Listening</span>
                </>
              ) : (
                <>
                  <Icon name="mic" size="1.1em" className="mic-icon" />
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
                        <Icon name="audio-waveform" size="1em" className="waiting-icon" />
                        <span>Play a note...</span>
                      </>
                    ) : (
                      <>
                        <Icon name={instrument.icon} size="1em" className="waiting-icon" />
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
            <h4>{instrument.name} Standard Tuning</h4>
            <div className="strings-grid">
              {INSTRUMENT_STRINGS.map((string) => {
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
            <p><Icon name="lightbulb" size="1em" className="inline-icon" /><strong>Tips:</strong> Play one string at a time. Let the note ring clearly. Position your device close to the guitar for best results.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
