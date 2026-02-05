import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

interface Profile {
  user_id: string
  role: 'admin' | 'crew' | 'organizer'
  sm_username: string
  full_name: string | null
}

interface AuthContextType {
  user: User | null
  session: Session | null
  profile: Profile | null
  loading: boolean
  signIn: (username: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let isMounted = true
    let isInitializing = true

    async function initializeAuth() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        
        if (!isMounted) return

        setSession(session)
        setUser(session?.user ?? null)
        
        if (session?.user) {
          await fetchProfile(session.user.id)
        }
      } catch (error) {
        console.error('Auth initialization error:', error)
      } finally {
        if (isMounted) {
          setLoading(false)
          isInitializing = false
        }
      }
    }

    initializeAuth()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('[Auth] onAuthStateChange:', event, 'isInitializing:', isInitializing)
      if (!isMounted) return
      
      // Skip initial session event during initialization
      if (isInitializing && event === 'INITIAL_SESSION') return
      
      setSession(session)
      setUser(session?.user ?? null)
      
      if (session?.user) {
        await fetchProfile(session.user.id)
      } else {
        setProfile(null)
      }
      setLoading(false)
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [])

  async function fetchProfile(userId: string) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (!error && data) {
      setProfile(data as Profile)
    }
  }

  async function signIn(username: string, password: string): Promise<{ error: string | null }> {
    try {
      console.log('[Auth] Starting login for:', username)
      
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/auth-username-login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ username, password }),
      })

      const data = await response.json()
      console.log('[Auth] Login response ok:', response.ok)

      if (!response.ok) {
        console.log('[Auth] Login failed:', data.error)
        return { error: data.error || 'Innlogging feilet' }
      }

      if (data.session) {
        console.log('[Auth] Setting session...')
        
        // Set user and session directly, then let setSession trigger onAuthStateChange for profile
        setUser(data.user)
        setSession(data.session)
        
        // Fetch profile directly
        if (data.user?.id) {
          console.log('[Auth] Fetching profile for user:', data.user.id)
          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('user_id', data.user.id)
            .single()
          
          if (!profileError && profileData) {
            setProfile(profileData as Profile)
            console.log('[Auth] Profile set:', profileData)
          } else {
            console.error('[Auth] Profile fetch error:', profileError)
          }
        }
        
        // Now set the session in supabase client (don't await the state change)
        supabase.auth.setSession(data.session)
        console.log('[Auth] Login complete')
      }

      return { error: null }
    } catch (err) {
      console.error('[Auth] Login error:', err)
      return { error: 'En feil oppstod ved innlogging' }
    }
  }

  async function signOut() {
    await supabase.auth.signOut()
    setUser(null)
    setSession(null)
    setProfile(null)
  }

  return (
    <AuthContext.Provider value={{ user, session, profile, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
