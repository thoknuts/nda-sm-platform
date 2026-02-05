import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useKiosk } from '../contexts/KioskContext'
import { supabase } from '../lib/supabase'
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card'
import { Button } from '../components/ui/Button'

interface Event {
  id: string
  name: string
  event_date: string
}

export function KioskSelectPage() {
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState<string | null>(null)
  const [error, setError] = useState('')
  const { profile, signOut, session: authSession } = useAuth()
  const { setSession } = useKiosk()
  const navigate = useNavigate()

  useEffect(() => {
    fetchEvents()
  }, [profile])

  async function fetchEvents() {
    if (!profile) return

    const today = new Date().toISOString().split('T')[0]
    let query = supabase.from('events').select('id, name, event_date').gte('end_date', today)

    if (profile.role === 'crew') {
      const { data: access } = await supabase
        .from('crew_event_access')
        .select('event_id')
        .eq('crew_user_id', profile.user_id)

      if (access && access.length > 0) {
        const eventIds = access.map(a => a.event_id)
        query = query.in('id', eventIds)
      } else {
        setEvents([])
        setLoading(false)
        return
      }
    }

    const { data, error } = await query.order('event_date', { ascending: false })

    if (error) {
      setError('Kunne ikke hente eventer')
    } else {
      setEvents(data || [])
    }
    setLoading(false)
  }

  async function startKiosk(eventId: string) {
    setStarting(eventId)
    setError('')

    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/kiosk-start-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authSession?.access_token}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ event_id: eventId }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Kunne ikke starte kiosk')
        setStarting(null)
        return
      }

      setSession({
        kioskToken: data.kiosk_token,
        sessionId: data.session_id,
        eventId: data.event_id,
        eventName: data.event_name,
        expiresAt: data.expires_at,
      })

      navigate(`/kiosk/${eventId}`)
    } catch {
      setError('En feil oppstod')
      setStarting(null)
    }
  }

  return (
    <div className="min-h-screen bg-primary p-4">
      <div className="max-w-2xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div className="text-white">
            <h1 className="text-2xl font-bold">SM NDA Sign</h1>
            <p className="text-white/80">Logget inn som {profile?.sm_username}</p>
          </div>
          <div className="flex gap-2">
            {profile?.role === 'admin' && (
              <Button variant="secondary" onClick={() => navigate('/admin')}>
                Admin
              </Button>
            )}
            {profile?.role === 'organizer' && (
              <Button variant="secondary" onClick={() => navigate('/organizer')}>
                Organizer
              </Button>
            )}
            <Button variant="secondary" onClick={() => navigate('/crew/attest')}>
              Attestering
            </Button>
            <Button variant="ghost" className="text-white" onClick={async () => {
              await signOut()
              navigate('/login', { replace: true })
            }}>
              Logg ut
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Velg event for kiosk-modus</CardTitle>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
                {error}
              </div>
            )}

            {loading ? (
              <div className="text-center py-8 text-gray-500">Laster eventer...</div>
            ) : events.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                Ingen eventer tilgjengelig
              </div>
            ) : (
              <div className="space-y-3">
                {events.map(event => (
                  <div
                    key={event.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
                  >
                    <div>
                      <h3 className="font-medium">{event.name}</h3>
                      <p className="text-sm text-gray-500">
                        {new Date(event.event_date).toLocaleDateString('no-NO')}
                      </p>
                    </div>
                    <Button
                      onClick={() => startKiosk(event.id)}
                      loading={starting === event.id}
                      disabled={starting !== null}
                    >
                      Start registrering
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
