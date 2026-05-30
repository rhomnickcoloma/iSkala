'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { InstrumentConfig, INSTRUMENTS, DEFAULT_INSTRUMENT_ID, getInstrument } from '../lib/instruments'

interface InstrumentContextType {
  instrument: InstrumentConfig
  setInstrumentId: (id: string) => void
  showSelector: boolean
  setShowSelector: (show: boolean) => void
  initialized: boolean
}

const InstrumentContext = createContext<InstrumentContextType>({
  instrument: INSTRUMENTS[DEFAULT_INSTRUMENT_ID],
  setInstrumentId: () => {},
  showSelector: false,
  setShowSelector: () => {},
  initialized: false,
})

function getCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'))
  return match ? decodeURIComponent(match[2]) : undefined
}

function setCookie(name: string, value: string, days: number = 365) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString()
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`
}

export function InstrumentProvider({ children }: { children: ReactNode }) {
  const [instrumentId, setInstrumentIdState] = useState<string>(DEFAULT_INSTRUMENT_ID)
  const [showSelector, setShowSelector] = useState(false)
  const [initialized, setInitialized] = useState(false)

  useEffect(() => {
    const saved = getCookie('fretwiki_instrument')
    if (saved && INSTRUMENTS[saved]) {
      setInstrumentIdState(saved)
    } else {
      setShowSelector(true)
    }
    setInitialized(true)
  }, [])

  const setInstrumentId = (id: string) => {
    setInstrumentIdState(id)
    setCookie('fretwiki_instrument', id)
    setShowSelector(false)
  }

  const instrument = getInstrument(instrumentId)

  return (
    <InstrumentContext.Provider value={{ instrument, setInstrumentId, showSelector, setShowSelector, initialized }}>
      {children}
    </InstrumentContext.Provider>
  )
}

export function useInstrument() {
  return useContext(InstrumentContext)
}
