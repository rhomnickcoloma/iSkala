'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { useRouter } from 'next/navigation'
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

interface ProviderProps {
  children: ReactNode
  initialInstrument?: string
  skipRouting?: boolean
}

export function InstrumentProvider({ children, initialInstrument, skipRouting }: ProviderProps) {
  const router = useRouter()
  const [instrumentId, setInstrumentIdState] = useState<string>(
    initialInstrument && INSTRUMENTS[initialInstrument] ? initialInstrument : DEFAULT_INSTRUMENT_ID
  )
  const [showSelector, setShowSelector] = useState(false)
  const [initialized, setInitialized] = useState(false)

  useEffect(() => {
    if (initialInstrument && INSTRUMENTS[initialInstrument]) {
      setInstrumentIdState(initialInstrument)
      setCookie('fretwiki_instrument', initialInstrument)
      setInitialized(true)
      return
    }

    const saved = getCookie('fretwiki_instrument')
    if (saved && INSTRUMENTS[saved]) {
      setInstrumentIdState(saved)
      if (!skipRouting) {
        router.replace(`/${saved}`)
      }
    } else if (!skipRouting) {
      setShowSelector(true)
    }
    setInitialized(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const setInstrumentId = (id: string) => {
    setInstrumentIdState(id)
    setCookie('fretwiki_instrument', id)
    setShowSelector(false)
    if (!skipRouting) {
      router.push(`/${id}`)
    }
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
