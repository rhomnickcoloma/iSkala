'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { usePathname, useRouter } from 'next/navigation'
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

const COOKIE = 'fretwiki_instrument'

function getCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'))
  return match ? decodeURIComponent(match[2]) : undefined
}

function setCookie(name: string, value: string, days: number = 365) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString()
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`
}

// Lives in the root layout so the site header can switch instruments on every page.
// On `/` and `/<instrument>` the URL is the source of truth; elsewhere the choice is made in place.
export function InstrumentProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const routeId = INSTRUMENTS[pathname.slice(1)] ? pathname.slice(1) : null
  const [savedId, setSavedId] = useState<string>(DEFAULT_INSTRUMENT_ID)
  const [showSelector, setShowSelector] = useState(false)
  const [initialized, setInitialized] = useState(false)

  useEffect(() => {
    const saved = getCookie(COOKIE)
    if (saved && INSTRUMENTS[saved]) setSavedId(saved)
    setInitialized(true)
  }, [])

  useEffect(() => {
    if (routeId) {
      setSavedId(routeId)
      setCookie(COOKIE, routeId)
      return
    }
    if (pathname !== '/') return
    const saved = getCookie(COOKIE)
    if (saved && INSTRUMENTS[saved]) router.replace(`/${saved}`)
    else setShowSelector(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, routeId])

  const setInstrumentId = (id: string) => {
    setSavedId(id)
    setCookie(COOKIE, id)
    setShowSelector(false)
    if (routeId || pathname === '/') router.push(`/${id}`)
  }

  const instrument = getInstrument(routeId ?? savedId)

  return (
    <InstrumentContext.Provider value={{ instrument, setInstrumentId, showSelector, setShowSelector, initialized }}>
      {children}
    </InstrumentContext.Provider>
  )
}

export function useInstrument() {
  return useContext(InstrumentContext)
}
