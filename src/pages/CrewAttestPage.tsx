import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Checkbox } from '../components/ui/Checkbox'
import { Input } from '../components/ui/Input'
import { AdminStatistics } from '../components/admin/AdminStatistics'

type Tab = 'attest' | 'statistics'

interface PendingSignature {
  id: string
  signed_at: string
  language: string
  guests: {
    first_name: string
    last_name: string
    sm_username: string
    phone: string | null
  } | null
  events: {
    id: string
    name: string
  } | null
}

type GuestType = 'par' | 'single_mann' | 'single_kvinne' | 'vip'

interface EventGuest {
  sm_username: string
  first_name: string | null
  last_name: string | null
  status: 'invited' | 'signed_pending_verification' | 'verified'
  guest_type: GuestType | null
  guest_status: string | null
}

interface Event {
  id: string
  name: string
  event_date: string
}

export function CrewAttestPage() {
  const [activeTab, setActiveTab] = useState<Tab>('attest')
  const [events, setEvents] = useState<Event[]>([])
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null)
  const [signatures, setSignatures] = useState<PendingSignature[]>([])
  const [guests, setGuests] = useState<EventGuest[]>([])
  const [guestFilter, setGuestFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [verifying, setVerifying] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [error, setError] = useState('')
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    fetchEvents()
  }, [profile])

  useEffect(() => {
    if (selectedEvent) {
      fetchPendingSignatures()
      fetchEventGuests()
      const interval = setInterval(() => {
        fetchPendingSignatures()
        fetchEventGuests()
      }, 10000)
      return () => clearInterval(interval)
    } else {
      setSignatures([])
      setGuests([])
    }
  }, [selectedEvent, profile])

  async function fetchEvents() {
    if (!profile) return

    let query = supabase
      .from('events')
      .select('id, name, event_date')
      .order('event_date', { ascending: false })

    if (profile.role === 'crew') {
      const { data: access } = await supabase
        .from('crew_event_access')
        .select('event_id')
        .eq('crew_user_id', profile.user_id)

      if (access && access.length > 0) {
        const eventIds = access.map((a: { event_id: string }) => a.event_id)
        query = query.in('id', eventIds)
      } else {
        setEvents([])
        setLoading(false)
        return
      }
    } else if (profile.role === 'organizer') {
      query = query.eq('created_by', profile.user_id)
    }
    // Admin sees all events

    const { data, error } = await query

    if (!error && data) {
      setEvents(data as Event[])
      // Auto-select first event if only one
      if (data.length === 1) {
        setSelectedEvent(data[0].id)
      }
    }
    setLoading(false)
  }

  async function fetchPendingSignatures() {
    if (!profile || !selectedEvent) return

    const { data, error } = await supabase
      .from('nda_signatures')
      .select(`
        id,
        signed_at,
        language,
        guests:guest_id (first_name, last_name, sm_username, phone),
        events:event_id (id, name)
      `)
      .eq('event_id', selectedEvent)
      .is('verified_at', null)
      .order('signed_at', { ascending: true })

    if (error) {
      console.error('Error fetching signatures:', error)
    } else {
      setSignatures((data as unknown as PendingSignature[]) || [])
    }
  }

  async function fetchEventGuests() {
    if (!profile || !selectedEvent) return

    const { data, error } = await supabase
      .from('event_guests')
      .select('sm_username, first_name, last_name, status, guest_type, guest_status')
      .eq('event_id', selectedEvent)
      .order('sm_username', { ascending: true })

    if (!error && data) {
      setGuests(data as EventGuest[])
    }
  }

  const filteredGuests = guests.filter(g =>
    g.sm_username.toLowerCase().includes(guestFilter.toLowerCase())
  )

  async function handleVerify(signatureId: string) {
    setVerifying(signatureId)
    setError('')

    const { error: updateError, count } = await supabase
      .from('nda_signatures')
      .update({
        verified_at: new Date().toISOString(),
        verified_by: profile?.user_id,
      })
      .eq('id', signatureId)
      .is('verified_at', null)

    if (updateError) {
      setError('Kunne ikke verifisere signatur')
      setVerifying(null)
      return
    }

    if (count === 0) {
      setError('Signaturen ble allerede verifisert av noen andre')
      await fetchPendingSignatures()
      setVerifying(null)
      return
    }

    // Update event_guests status
    const sig = signatures.find(s => s.id === signatureId)
    if (sig && sig.events && sig.guests) {
      await supabase
        .from('event_guests')
        .update({ status: 'verified' })
        .eq('event_id', sig.events.id)
        .eq('sm_username', sig.guests.sm_username)
    }

    await fetchPendingSignatures()
    await fetchEventGuests()
    setVerifying(null)
  }

  async function handleDeleteSignature(signatureId: string) {
    if (!confirm('Er du sikker på at du vil slette denne signaturen?')) return

    setDeleting(signatureId)
    setError('')

    // Reset event_guests status back to 'invited'
    const sig = signatures.find(s => s.id === signatureId)
    if (sig && sig.events && sig.guests) {
      await supabase
        .from('event_guests')
        .update({ status: 'invited' })
        .eq('event_id', sig.events.id)
        .eq('sm_username', sig.guests.sm_username)
    }

    const { error: deleteError } = await supabase
      .from('nda_signatures')
      .delete()
      .eq('id', signatureId)

    if (deleteError) {
      setError('Kunne ikke slette signaturen')
      setDeleting(null)
      return
    }

    await fetchPendingSignatures()
    await fetchEventGuests()
    setDeleting(null)
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'attest', label: 'Attestering' },
    { id: 'statistics', label: 'Statistikk' },
  ]

  return (
    <div className="min-h-screen bg-primary p-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div className="text-white">
            <h1 className="text-2xl font-bold">Crew Dashboard</h1>
            <p className="text-white/80">Logget inn som {profile?.sm_username}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => navigate('/kiosk')}>
              Kiosk
            </Button>
            {profile?.role === 'organizer' && (
              <Button variant="secondary" onClick={() => navigate('/organizer')}>
                Organizer
              </Button>
            )}
            {profile?.role === 'admin' && (
              <Button variant="secondary" onClick={() => navigate('/admin')}>
                Admin
              </Button>
            )}
            <Button variant="ghost" className="text-white" onClick={async () => {
              await signOut()
              navigate('/login', { replace: true })
            }}>
              Logg ut
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-4">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-white text-primary'
                  : 'bg-white/20 text-white hover:bg-white/30'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'statistics' && <AdminStatistics />}

        {activeTab === 'attest' && (
          <>
            {/* Event-velger */}
            <Card className="mb-4">
              <CardContent className="py-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Velg arrangement
                </label>
                {loading ? (
                  <div className="text-gray-500">Laster arrangementer...</div>
                ) : events.length === 0 ? (
                  <div className="text-gray-500">Ingen arrangementer tilgjengelig</div>
                ) : (
                  <select
                    value={selectedEvent || ''}
                    onChange={(e) => setSelectedEvent(e.target.value || null)}
                    className="w-full md:w-auto min-w-[300px] px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  >
                    <option value="">-- Velg arrangement --</option>
                    {events.map(event => (
                      <option key={event.id} value={event.id}>
                        {event.name} ({new Date(event.event_date).toLocaleDateString('no-NO')})
                      </option>
                    ))}
                  </select>
                )}
              </CardContent>
            </Card>

            {!selectedEvent ? (
              <Card>
                <CardContent className="py-8 text-center text-gray-500">
                  Velg et arrangement for å se gjesteliste og attestering
                </CardContent>
              </Card>
            ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Gjesteliste - venstre side */}
              <Card className="lg:col-span-1">
                <CardHeader>
                  <CardTitle>Gjesteliste ({guests.length})</CardTitle>
                </CardHeader>
              <CardContent>
                <Input
                  placeholder="Søk på brukernavn..."
                  value={guestFilter}
                  onChange={(e) => setGuestFilter(e.target.value)}
                  className="mb-3"
                />
                <div className="space-y-1 max-h-[60vh] overflow-y-auto">
                  {filteredGuests.length === 0 ? (
                    <div className="text-center py-4 text-gray-500 text-sm">
                      {guestFilter ? 'Ingen treff' : 'Ingen gjester'}
                    </div>
                  ) : (
                    filteredGuests.map((guest, idx) => (
                      <div
                        key={`${guest.sm_username}-${idx}`}
                        className={`p-2 rounded-lg text-sm ${
                          guest.status === 'verified'
                            ? 'bg-green-100 border border-green-300'
                            : guest.status === 'signed_pending_verification'
                            ? 'bg-yellow-50 border border-yellow-200'
                            : 'bg-gray-50 border border-gray-200'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="font-medium text-gray-900">
                            @{guest.sm_username}
                          </div>
                          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                            guest.guest_status === 'VIP' ? 'bg-purple-100 text-purple-700' :
                            guest.guest_status === 'Par' ? 'bg-pink-100 text-pink-700' :
                            guest.guest_status === 'Single mann' ? 'bg-blue-100 text-blue-700' :
                            guest.guest_status === 'Single kvinne' ? 'bg-rose-100 text-rose-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {guest.guest_status || 'Par'}
                          </span>
                        </div>
                        <div className="text-gray-600 text-xs">
                          {guest.first_name || ''} {guest.last_name || ''}
                        </div>
                        <div className="text-xs mt-1">
                          {guest.status === 'verified' && (
                            <span className="text-green-700">✓ Verifisert</span>
                          )}
                          {guest.status === 'signed_pending_verification' && (
                            <span className="text-yellow-700">⏳ Venter på ID-kontroll</span>
                          )}
                          {guest.status === 'invited' && (
                            <span className="text-gray-500">Ikke signert</span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Attestering - høyre side */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Venter på ID-kontroll ({signatures.length})</CardTitle>
              </CardHeader>
              <CardContent>
                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
                    {error}
                  </div>
                )}

                {loading ? (
                  <div className="text-center py-8 text-gray-500">Laster...</div>
                ) : signatures.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    Ingen signaturer venter på verifisering
                  </div>
                ) : (
                  <div className="space-y-3">
                    {signatures.map(sig => (
                      <div
                        key={sig.id}
                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <span className="font-medium">
                              {sig.guests?.first_name ?? 'Ukjent'} {sig.guests?.last_name ?? ''}
                            </span>
                            <span className="text-sm text-gray-500">
                              @{sig.guests?.sm_username ?? 'ukjent'}
                            </span>
                            {sig.guests?.phone && (
                              <span className="text-sm text-gray-600">
                                📞 {sig.guests.phone}
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-gray-500 mt-1">
                            {sig.events?.name ?? 'Ukjent event'} • Signert {new Date(sig.signed_at).toLocaleString('no-NO')}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Checkbox
                            label="ID kontrollert"
                            checked={verifying === sig.id}
                            onChange={() => handleVerify(sig.id)}
                            disabled={verifying !== null || deleting !== null}
                          />
                          <Button
                            variant="secondary"
                            onClick={() => handleDeleteSignature(sig.id)}
                            disabled={verifying !== null || deleting !== null}
                            className="!bg-red-100 !text-red-700 hover:!bg-red-200 !border-red-300 !px-3 !py-1 !text-sm"
                          >
                            {deleting === sig.id ? 'Sletter...' : 'Slett'}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
