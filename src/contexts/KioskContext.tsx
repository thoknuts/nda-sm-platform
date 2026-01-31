import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'

interface KioskSession {
  kioskToken: string
  sessionId: string
  eventId: string
  eventName: string
  expiresAt: string
}

interface KioskContextType {
  session: KioskSession | null
  isLocked: boolean
  language: 'no' | 'en'
  setSession: (session: KioskSession | null) => void
  setIsLocked: (locked: boolean) => void
  setLanguage: (lang: 'no' | 'en') => void
  clearSession: () => void
}

const KioskContext = createContext<KioskContextType | undefined>(undefined)

const KIOSK_STORAGE_KEY = 'sm_nda_kiosk_session'

export function KioskProvider({ children }: { children: ReactNode }) {
  const [session, setSessionState] = useState<KioskSession | null>(null)
  const [isLocked, setIsLocked] = useState(false)
  const [language, setLanguage] = useState<'no' | 'en'>('no')

  useEffect(() => {
    const stored = localStorage.getItem(KIOSK_STORAGE_KEY)
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as KioskSession
        if (new Date(parsed.expiresAt) > new Date()) {
          setSessionState(parsed)
        } else {
          localStorage.removeItem(KIOSK_STORAGE_KEY)
        }
      } catch {
        localStorage.removeItem(KIOSK_STORAGE_KEY)
      }
    }
  }, [])

  function setSession(newSession: KioskSession | null) {
    setSessionState(newSession)
    if (newSession) {
      localStorage.setItem(KIOSK_STORAGE_KEY, JSON.stringify(newSession))
    } else {
      localStorage.removeItem(KIOSK_STORAGE_KEY)
    }
  }

  function clearSession() {
    setSessionState(null)
    localStorage.removeItem(KIOSK_STORAGE_KEY)
    setIsLocked(false)
    setLanguage('no')
  }

  return (
    <KioskContext.Provider value={{
      session,
      isLocked,
      language,
      setSession,
      setIsLocked,
      setLanguage,
      clearSession,
    }}>
      {children}
    </KioskContext.Provider>
  )
}

export function useKiosk() {
  const context = useContext(KioskContext)
  if (context === undefined) {
    throw new Error('useKiosk must be used within a KioskProvider')
  }
  return context
}
