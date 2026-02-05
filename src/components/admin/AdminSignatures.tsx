import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'

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
    id: string
    name: string
  }
}

interface Event {
  id: string
  name: string
}

export function AdminSignatures() {
  const [signatures, setSignatures] = useState<Signature[]>([])
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedEvent, setSelectedEvent] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState('')
  const [generatingPdf, setGeneratingPdf] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  useEffect(() => {
    fetchEvents()
    fetchSignatures()
  }, [])

  useEffect(() => {
    fetchSignatures()
  }, [selectedEvent])

  async function fetchEvents() {
    const { data } = await supabase
      .from('events')
      .select('id, name')
      .order('event_date', { ascending: false })

    setEvents((data as Event[]) || [])
  }

  async function fetchSignatures() {
    setLoading(true)

    let query = supabase
      .from('nda_signatures')
      .select(`
        id,
        signed_at,
        verified_at,
        language,
        pdf_storage_path,
        guests:guest_id (first_name, last_name, sm_username, phone),
        events:event_id (id, name)
      `)
      .order('signed_at', { ascending: false })
      .limit(100)

    if (selectedEvent) {
      query = query.eq('event_id', selectedEvent)
    }

    const { data } = await query

    setSignatures((data as unknown as Signature[]) || [])
    setLoading(false)
  }

  async function handleGeneratePdf(signatureId: string) {
    setGeneratingPdf(signatureId)

    try {
      // Get fresh session to ensure valid JWT
      const { data: { session: freshSession } } = await supabase.auth.getSession()
      
      if (!freshSession?.access_token) {
        alert('Du må være logget inn for å generere PDF')
        return
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-nda-pdf`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${freshSession.access_token}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ signature_id: signatureId }),
      })

      const data = await response.json()

      if (!response.ok) {
        alert(`Feil ved PDF-generering: ${data.error || 'Ukjent feil'}${data.details ? '\n\nDetaljer: ' + data.details : ''}`)
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

  async function handleDeleteSignature(signatureId: string, guestName: string) {
    if (!confirm(`Er du sikker på at du vil slette NDA-signeringen for ${guestName}? Dette kan ikke angres.`)) {
      return
    }

    setDeleting(signatureId)

    try {
      const { error } = await supabase
        .from('nda_signatures')
        .delete()
        .eq('id', signatureId)

      if (error) {
        alert('Kunne ikke slette signering: ' + error.message)
      } else {
        fetchSignatures()
      }
    } catch (err) {
      alert('En feil oppstod ved sletting')
    } finally {
      setDeleting(null)
    }
  }

  async function handleExportCsv() {
    const rows = [
      ['SpicyMatch brukernavn', 'Fornavn', 'Etternavn', 'Mobil', 'Event', 'Signert', 'Verifisert', 'Språk'].join(','),
      ...filteredSignatures.map(sig => [
        sig.guests.sm_username,
        sig.guests.first_name,
        sig.guests.last_name,
        sig.guests.phone,
        sig.events.name,
        new Date(sig.signed_at).toISOString(),
        sig.verified_at ? new Date(sig.verified_at).toISOString() : '',
        sig.language,
      ].join(','))
    ].join('\n')

    const blob = new Blob([rows], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `signeringer-${selectedEvent || 'alle'}-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const filteredSignatures = signatures.filter(sig => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (
      sig.guests.sm_username?.toLowerCase().includes(q) ||
      sig.guests.first_name?.toLowerCase().includes(q) ||
      sig.guests.last_name?.toLowerCase().includes(q) ||
      sig.guests.phone?.includes(q)
    )
  })

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-4">
        <CardTitle>Signeringer ({filteredSignatures.length})</CardTitle>
        <Button variant="secondary" onClick={handleExportCsv}>
          Eksporter CSV
        </Button>
      </CardHeader>
      <CardContent>
        <div className="flex gap-4 mb-4 flex-wrap">
          <select
            className="px-3 py-2 border border-gray-300 rounded-lg"
            value={selectedEvent}
            onChange={(e) => setSelectedEvent(e.target.value)}
          >
            <option value="">Alle eventer</option>
            {events.map(event => (
              <option key={event.id} value={event.id}>{event.name}</option>
            ))}
          </select>
          <Input
            placeholder="Søk navn, mobil, brukernavn..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-64"
          />
        </div>

        {loading ? (
          <div className="text-center py-8 text-gray-500">Laster...</div>
        ) : filteredSignatures.length === 0 ? (
          <div className="text-center py-8 text-gray-500">Ingen signeringer funnet</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Navn</th>
                  <th className="text-left py-2">SpicyMatch brukernavn</th>
                  <th className="text-left py-2">Mobil</th>
                  <th className="text-left py-2">Event</th>
                  <th className="text-left py-2">Signert</th>
                  <th className="text-left py-2">Status</th>
                  <th className="text-left py-2">PDF</th>
                  <th className="text-left py-2"></th>
                </tr>
              </thead>
              <tbody>
                {filteredSignatures.map(sig => (
                  <tr key={sig.id} className="border-b hover:bg-gray-50">
                    <td className="py-2">{sig.guests.first_name} {sig.guests.last_name}</td>
                    <td className="py-2 font-mono">@{sig.guests.sm_username}</td>
                    <td className="py-2">{sig.guests.phone}</td>
                    <td className="py-2">{sig.events.name}</td>
                    <td className="py-2">{new Date(sig.signed_at).toLocaleString('no-NO')}</td>
                    <td className="py-2">
                      <span className={`px-2 py-1 rounded text-xs ${
                        sig.verified_at ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {sig.verified_at ? 'Verifisert' : 'Venter'}
                      </span>
                    </td>
                    <td className="py-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleGeneratePdf(sig.id)}
                        loading={generatingPdf === sig.id}
                      >
                        {sig.pdf_storage_path ? 'Åpne' : 'Generer'}
                      </Button>
                    </td>
                    <td className="py-2">
                      <button
                        onClick={() => handleDeleteSignature(sig.id, `${sig.guests.first_name} ${sig.guests.last_name}`)}
                        disabled={deleting === sig.id}
                        className="text-red-600 hover:text-red-800 text-sm disabled:opacity-50"
                        title="Slett signering"
                      >
                        {deleting === sig.id ? 'Sletter...' : 'Slett'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
