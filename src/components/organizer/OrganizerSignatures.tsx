import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card'
import { Button } from '../ui/Button'

interface Event {
  id: string
  name: string
}

interface Signature {
  id: string
  signed_at: string
  verified_at: string | null
  language: string
  pdf_storage_path: string | null
  guests: {
    first_name: string
    last_name: string
    sm_username: string
    phone: string
  }
  events: {
    name: string
  }
}

export function OrganizerSignatures() {
  const [events, setEvents] = useState<Event[]>([])
  const [selectedEvent, setSelectedEvent] = useState<string>('')
  const [signatures, setSignatures] = useState<Signature[]>([])
  const [loading, setLoading] = useState(true)
  const { profile } = useAuth()

  useEffect(() => {
    fetchEvents()
  }, [profile])

  useEffect(() => {
    if (selectedEvent) {
      fetchSignatures()
    }
  }, [selectedEvent])

  async function fetchEvents() {
    if (!profile) return
    
    const { data } = await supabase
      .from('events')
      .select('id, name')
      .eq('created_by', profile.user_id)
      .order('event_date', { ascending: false })

    setEvents((data as Event[]) || [])
    if (data && data.length > 0) {
      setSelectedEvent(data[0].id)
    }
    setLoading(false)
  }

  async function fetchSignatures() {
    setLoading(true)
    const { data } = await supabase
      .from('nda_signatures')
      .select(`
        id,
        signed_at,
        verified_at,
        language,
        pdf_storage_path,
        guests:guest_id (first_name, last_name, sm_username, phone),
        events:event_id (name)
      `)
      .eq('event_id', selectedEvent)
      .order('signed_at', { ascending: false })

    setSignatures((data as unknown as Signature[]) || [])
    setLoading(false)
  }

  const [generatingPdf, setGeneratingPdf] = useState<string | null>(null)

  async function handleGeneratePdf(signatureId: string) {
    setGeneratingPdf(signatureId)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session?.access_token) {
        alert('Du må være logget inn for å generere PDF')
        return
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-nda-pdf`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ signature_id: signatureId }),
      })

      const data = await response.json()

      if (!response.ok) {
        alert(`Feil ved PDF-generering: ${data.error || 'Ukjent feil'}`)
        return
      }

      if (data.url) {
        window.open(data.url, '_blank')
      } else {
        alert('Ingen PDF-URL mottatt fra server')
      }
    } catch (error) {
      console.error('Error generating PDF:', error)
      alert('Nettverksfeil ved PDF-generering')
    } finally {
      setGeneratingPdf(null)
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Signeringer</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Velg event
            </label>
            <select
              value={selectedEvent}
              onChange={(e) => setSelectedEvent(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              {events.map(event => (
                <option key={event.id} value={event.id}>{event.name}</option>
              ))}
            </select>
          </div>

          {loading ? (
            <p className="text-gray-500 text-center py-4">Laster...</p>
          ) : signatures.length === 0 ? (
            <p className="text-gray-500 text-center py-4">Ingen signeringer</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Navn</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Brukernavn</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Telefon</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Signert</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Status</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-600">Handlinger</th>
                  </tr>
                </thead>
                <tbody>
                  {signatures.map(sig => (
                    <tr key={sig.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4">
                        {sig.guests?.first_name} {sig.guests?.last_name}
                      </td>
                      <td className="py-3 px-4 text-gray-500">
                        @{sig.guests?.sm_username}
                      </td>
                      <td className="py-3 px-4 text-gray-500">
                        {sig.guests?.phone || '-'}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-500">
                        {new Date(sig.signed_at).toLocaleString('no-NO')}
                      </td>
                      <td className="py-3 px-4">
                        {sig.verified_at ? (
                          <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                            Verifisert
                          </span>
                        ) : (
                          <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                            Venter på ID-kontroll
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Button 
                          size="sm" 
                          variant="secondary" 
                          onClick={() => handleGeneratePdf(sig.id)}
                          disabled={generatingPdf === sig.id}
                        >
                          {generatingPdf === sig.id ? 'Genererer...' : 'Last ned PDF'}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
