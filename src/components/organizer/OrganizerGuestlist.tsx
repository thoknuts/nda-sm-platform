import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { PhoneInput } from '../ui/PhoneInput'

interface Event {
  id: string
  name: string
}

interface EventGuest {
  id: string
  sm_username: string
  first_name: string | null
  last_name: string | null
  phone: string | null
  email: string | null
  status: string
  guest_status: string | null
}

export function OrganizerGuestlist() {
  const [events, setEvents] = useState<Event[]>([])
  const [selectedEvent, setSelectedEvent] = useState<string>('')
  const [guests, setGuests] = useState<EventGuest[]>([])
  const [loading, setLoading] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [csvImport, setCsvImport] = useState('')
  const [importResult, setImportResult] = useState<{ ok: number; failed: number; errors: string[] } | null>(null)
  const [formData, setFormData] = useState({
    sm_username: '',
    first_name: '',
    last_name: '',
    phone: '',
    email: '',
    guest_status: 'Par',
  })
  const { profile } = useAuth()

  useEffect(() => {
    fetchEvents()
  }, [profile])

  useEffect(() => {
    if (selectedEvent) {
      fetchGuests()
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
  }

  async function fetchGuests() {
    setLoading(true)
    const { data } = await supabase
      .from('event_guests')
      .select('*')
      .eq('event_id', selectedEvent)
      .order('sm_username')

    setGuests((data as EventGuest[]) || [])
    setLoading(false)
  }

  async function handleAddGuest(e: React.FormEvent) {
    e.preventDefault()

    const normalized = formData.sm_username.trim().toLowerCase()

    await supabase.from('event_guests').insert({
      event_id: selectedEvent,
      sm_username: normalized,
      first_name: formData.first_name || null,
      last_name: formData.last_name || null,
      phone: formData.phone.replace(/\D/g, '') || null,
      email: formData.email || null,
      guest_status: formData.guest_status || 'Par',
      status: 'invited',
    })

    setFormData({ sm_username: '', first_name: '', last_name: '', phone: '', email: '', guest_status: 'Par' })
    setShowAddForm(false)
    fetchGuests()
  }

  async function handleDeleteGuest(guestId: string, smUsername: string) {
    if (!confirm(`Er du sikker på at du vil slette ${smUsername} fra gjestelisten?`)) {
      return
    }

    await supabase.from('event_guests').delete().eq('id', guestId)
    fetchGuests()
  }

  async function handleCsvImport() {
    const lines = csvImport.trim().split('\n')
    let ok = 0
    let failed = 0
    const errors: string[] = []

    // Detect separator and column mapping from header
    const headerLine = lines[0]?.trim() || ''
    const separator = headerLine.includes(';') ? ';' : ','
    const headerParts = headerLine.split(separator).map(p => p.trim().toLowerCase())
    
    // Check if this is the standardized SpicyMatch CSV format
    const isStandardFormat = headerParts.includes('nick') && headerParts.includes('name') && headerParts.includes('surname')
    
    // Find column indices for standard format
    const nickIndex = headerParts.indexOf('nick')
    const nameIndex = headerParts.indexOf('name')
    const surnameIndex = headerParts.indexOf('surname')
    const categoryIndex = headerParts.indexOf('category')
    
    // For simple format: sm_username,first_name,last_name,phone,email
    const isSimpleFormat = headerParts.includes('sm_username') || headerLine.startsWith('sm_username')

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue
      
      // Skip header line
      if (i === 0 && (isStandardFormat || isSimpleFormat || line.toLowerCase().includes('nick') || line.toLowerCase().includes('sm_username'))) {
        continue
      }

      const parts = line.split(separator).map(p => p.trim())
      
      let sm_username: string
      let first_name: string | null = null
      let last_name: string | null = null
      let phone: string | null = null
      let email: string | null = null
      let guest_type: string | null = null

      if (isStandardFormat && nickIndex !== -1) {
        // Standard SpicyMatch CSV format: Date;Status;Nick;Category;Name;Surname;...
        sm_username = parts[nickIndex] || ''
        first_name = parts[nameIndex] || null
        last_name = parts[surnameIndex] || null
        if (categoryIndex !== -1) {
          const cat = (parts[categoryIndex] || '').toLowerCase().trim()
          if (cat.includes('couple') || cat.includes('par')) guest_type = 'par'
          else if (cat.includes('single') && cat.includes('male') || cat.includes('single') && cat.includes('mann')) guest_type = 'single_mann'
          else if (cat.includes('single') && cat.includes('female') || cat.includes('single') && cat.includes('kvinne')) guest_type = 'single_kvinne'
          else if (cat.includes('vip')) guest_type = 'vip'
        }
      } else {
        // Simple format: sm_username,first_name,last_name,phone,email,guest_type
        const guestTypePart = parts[5]?.trim().toLowerCase() || null
        ;[sm_username, first_name, last_name, phone, email] = parts as [string, string | null, string | null, string | null, string | null]
        if (guestTypePart === 'par' || guestTypePart === 'single_mann' || guestTypePart === 'single_kvinne' || guestTypePart === 'vip') {
          guest_type = guestTypePart
        }
      }

      if (!sm_username) {
        errors.push(`Linje ${i + 1}: Mangler brukernavn`)
        failed++
        continue
      }

      const normalized = sm_username.toLowerCase()
      if (!/^[a-z&][a-z0-9._&-]{2,31}$/.test(normalized)) {
        errors.push(`Linje ${i + 1}: Ugyldig brukernavn "${sm_username}"`)
        failed++
        continue
      }

      const { error } = await supabase.from('event_guests').insert({
        event_id: selectedEvent,
        sm_username: normalized,
        first_name: first_name || null,
        last_name: last_name || null,
        phone: phone?.replace(/\D/g, '') || null,
        email: email || null,
        status: 'invited',
        ...(guest_type ? { guest_type } : {}),
      })

      if (error) {
        errors.push(`Linje ${i + 1}: ${error.message}`)
        failed++
      } else {
        ok++
      }
    }

    setImportResult({ ok, failed, errors })
    setCsvImport('')
    fetchGuests()
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Velg event</CardTitle>
        </CardHeader>
        <CardContent>
          <select
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            value={selectedEvent}
            onChange={(e) => setSelectedEvent(e.target.value)}
          >
            <option value="">-- Velg event --</option>
            {events.map(event => (
              <option key={event.id} value={event.id}>{event.name}</option>
            ))}
          </select>
        </CardContent>
      </Card>

      {selectedEvent && (
        <>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Gjesteliste ({guests.length})</CardTitle>
              <Button onClick={() => setShowAddForm(true)}>+ Legg til gjest</Button>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8 text-gray-500">Laster...</div>
              ) : guests.length === 0 ? (
                <div className="text-center py-8 text-gray-500">Ingen gjester</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2">Brukernavn</th>
                        <th className="text-left py-2">Navn</th>
                        <th className="text-left py-2">Mobil</th>
                        <th className="text-left py-2">E-post</th>
                        <th className="text-left py-2">Gjestestatus</th>
                        <th className="text-left py-2">Signeringsstatus</th>
                        <th className="text-left py-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {guests.map(guest => (
                        <tr key={guest.id} className="border-b hover:bg-gray-50">
                          <td className="py-2 font-mono">{guest.sm_username}</td>
                          <td className="py-2">{guest.first_name} {guest.last_name}</td>
                          <td className="py-2">{guest.phone || '-'}</td>
                          <td className="py-2">{guest.email || '-'}</td>
                          <td className="py-2">
                            <span className={`px-2 py-1 rounded text-xs ${
                              guest.guest_status === 'VIP' ? 'bg-purple-100 text-purple-800' :
                              guest.guest_status === 'Par' ? 'bg-pink-100 text-pink-800' :
                              guest.guest_status === 'Single mann' ? 'bg-blue-100 text-blue-800' :
                              guest.guest_status === 'Single kvinne' ? 'bg-rose-100 text-rose-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {guest.guest_status || 'Par'}
                            </span>
                          </td>
                          <td className="py-2">
                            <span className={`px-2 py-1 rounded text-xs ${
                              guest.status === 'verified' ? 'bg-green-100 text-green-800' :
                              guest.status === 'signed_pending_verification' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {guest.status}
                            </span>
                          </td>
                          <td className="py-2">
                            <button
                              onClick={() => handleDeleteGuest(guest.id, guest.sm_username)}
                              className="text-red-600 hover:text-red-800 text-sm"
                              title="Slett gjest"
                            >
                              Slett
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

          <Card>
            <CardHeader>
              <CardTitle>CSV Import</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 mb-2">
                Format: sm_username,first_name,last_name,phone,email (én per linje)
                <br />
                <a 
                  href="/eksempel-gjesteliste.csv" 
                  download 
                  className="text-primary hover:underline"
                >
                  Last ned eksempel CSV-mal
                </a>
              </p>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Last opp CSV-fil fra datamaskin
                </label>
                <input
                  type="file"
                  accept=".csv,.txt"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) {
                      const reader = new FileReader()
                      reader.onload = (event) => {
                        const text = event.target?.result as string
                        setCsvImport(text)
                      }
                      reader.readAsText(file)
                    }
                  }}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-primary file:text-white hover:file:bg-primary/90 cursor-pointer"
                />
              </div>

              <label className="block text-sm font-medium text-gray-700 mb-2">
                Eller lim inn CSV-data
              </label>
              <textarea
                className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm"
                rows={5}
                placeholder="ola.nordmann,Ola,Nordmann,4746427042,ola@example.com"
                value={csvImport}
                onChange={(e) => setCsvImport(e.target.value)}
              />
              <Button onClick={handleCsvImport} className="mt-2" disabled={!csvImport.trim()}>
                Importer
              </Button>

              {importResult && (
                <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                  <p className="font-medium">
                    Importert: {importResult.ok} OK, {importResult.failed} feilet
                  </p>
                  {importResult.errors.length > 0 && (
                    <ul className="mt-2 text-sm text-red-600">
                      {importResult.errors.slice(0, 10).map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                      {importResult.errors.length > 10 && (
                        <li>...og {importResult.errors.length - 10} flere feil</li>
                      )}
                    </ul>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {showAddForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Legg til gjest</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAddGuest} className="space-y-4">
                <Input
                  label="Brukernavn"
                  value={formData.sm_username}
                  onChange={(e) => setFormData(prev => ({ ...prev, sm_username: e.target.value.toLowerCase() }))}
                  required
                />
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Fornavn"
                    value={formData.first_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, first_name: e.target.value }))}
                  />
                  <Input
                    label="Etternavn"
                    value={formData.last_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, last_name: e.target.value }))}
                  />
                </div>
                <PhoneInput
                  label="Mobil"
                  value={formData.phone}
                  onChange={(fullNumber) => setFormData(prev => ({ ...prev, phone: fullNumber }))}
                  language="no"
                />
                <Input
                  label="E-post"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                />
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Gjestestatus</label>
                  <select
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    value={formData.guest_status}
                    onChange={(e) => setFormData(prev => ({ ...prev, guest_status: e.target.value }))}
                  >
                    <option value="Par">Par</option>
                    <option value="Single mann">Single mann</option>
                    <option value="Single kvinne">Single kvinne</option>
                    <option value="VIP">VIP</option>
                  </select>
                </div>
                <div className="flex gap-3">
                  <Button type="button" variant="secondary" onClick={() => setShowAddForm(false)}>
                    Avbryt
                  </Button>
                  <Button type="submit">Legg til</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
