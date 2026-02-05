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
  signIn: (username: string, password: string) => Promise<{ error: string | null; profile: Profile | null }>
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
      if (!isMounted) return
      
      // Skip initial session event during initialization
      if (isInitializing && event === 'INITIAL_SESSION') return
      
      setSession(session)
      setUser(session?.user ?? null)
      
      // Don't fetch profile here during login - signIn handles it
      if (session?.user && event !== 'SIGNED_IN') {
        await fetchProfile(session.user.id)
      } else if (!session) {
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

  async function signIn(username: string, password: string): Promise<{ error: string | null; profile: Profile | null }> {
    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/auth-username-login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ username, password }),
      })

      const data = await response.json()

      if (!response.ok) {
        return { error: data.error || 'Innlogging feilet', profile: null }
      }

      let userProfile: Profile | null = null

      if (data.session) {
        // Set the session in supabase client FIRST so RLS policies work
        await supabase.auth.setSession(data.session)
        
        const userId = data.session.user?.id || data.user?.id
        
        setUser(data.session.user || data.user)
        setSession(data.session)
        
        // Fetch profile (now RLS will work since session is set)
        if (userId) {
          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('user_id', userId)
            .single()
          
          if (!profileError && profileData) {
            userProfile = profileData as Profile
            setProfile(userProfile)
          }
        }
      }

      return { error: null, profile: userProfile }
    } catch {
      return { error: 'En feil oppstod ved innlogging', profile: null }
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
