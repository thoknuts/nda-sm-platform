import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Checkbox } from '../components/ui/Checkbox'
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
  } | null
  events: {
    id: string
    name: string
  } | null
}

export function CrewAttestPage() {
  const [activeTab, setActiveTab] = useState<Tab>('attest')
  const [signatures, setSignatures] = useState<PendingSignature[]>([])
  const [loading, setLoading] = useState(true)
  const [verifying, setVerifying] = useState<string | null>(null)
  const [error, setError] = useState('')
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    fetchPendingSignatures()
    const interval = setInterval(fetchPendingSignatures, 10000)
    return () => clearInterval(interval)
  }, [profile])

  async function fetchPendingSignatures() {
    if (!profile) return

    let query = supabase
      .from('nda_signatures')
      .select(`
        id,
        signed_at,
        language,
        guests:guest_id (first_name, last_name, sm_username),
        events:event_id (id, name)
      `)
      .is('verified_at', null)
      .order('signed_at', { ascending: true })

    if (profile.role === 'crew') {
      const { data: access } = await supabase
        .from('crew_event_access')
        .select('event_id')
        .eq('crew_user_id', profile.user_id)

      if (access && access.length > 0) {
        const eventIds = access.map((a: { event_id: string }) => a.event_id)
        query = query.in('event_id', eventIds)
      } else {
        setSignatures([])
        setLoading(false)
        return
      }
    } else if (profile.role === 'organizer') {
      // Organizer can only see signatures from events they created
      const { data: events } = await supabase
        .from('events')
        .select('id')
        .eq('created_by', profile.user_id)

      if (events && events.length > 0) {
        const eventIds = events.map((e: { id: string }) => e.id)
        query = query.in('event_id', eventIds)
      } else {
        setSignatures([])
        setLoading(false)
        return
      }
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching signatures:', error)
    } else {
      setSignatures((data as unknown as PendingSignature[]) || [])
    }
    setLoading(false)
  }

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
    setVerifying(null)
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'attest', label: 'Attestering' },
    { id: 'statistics', label: 'Statistikk' },
  ]

  return (
    <div className="min-h-screen bg-primary p-4">
      <div className="max-w-4xl mx-auto">
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
            <Button variant="ghost" className="text-white" onClick={signOut}>
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
        <Card>
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
                        disabled={verifying !== null}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        )}
      </div>
    </div>
  )
}
