import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'

interface Event {
  id: string
  name: string
  event_date: string
  nda_text_no: string
  nda_text_en: string
  created_at: string
}

export function AdminEvents() {
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingEvent, setEditingEvent] = useState<Event | null>(null)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    event_date: '',
    nda_text_no: '',
    nda_text_en: '',
  })

  useEffect(() => {
    fetchEvents()
  }, [])

  async function fetchEvents() {
    const { data } = await supabase
      .from('events')
      .select('*')
      .order('event_date', { ascending: false })

    setEvents((data as Event[]) || [])
    setLoading(false)
  }

  function openNewForm() {
    setEditingEvent(null)
    setFormData({ name: '', event_date: '', nda_text_no: '', nda_text_en: '' })
    setShowForm(true)
  }

  function openEditForm(event: Event) {
    setEditingEvent(event)
    setFormData({
      name: event.name,
      event_date: event.event_date,
      nda_text_no: event.nda_text_no,
      nda_text_en: event.nda_text_en,
    })
    setShowForm(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)

    if (editingEvent) {
      await supabase
        .from('events')
        .update(formData)
        .eq('id', editingEvent.id)
    } else {
      await supabase.from('events').insert(formData)
    }

    setSaving(false)
    setShowForm(false)
    fetchEvents()
  }

  if (showForm) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{editingEvent ? 'Rediger event' : 'Nytt event'}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Navn"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              required
            />
            <Input
              label="Dato"
              type="date"
              value={formData.event_date}
              onChange={(e) => setFormData(prev => ({ ...prev, event_date: e.target.value }))}
              required
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                NDA-tekst (Norsk) *
              </label>
              <textarea
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
                rows={6}
                value={formData.nda_text_no}
                onChange={(e) => setFormData(prev => ({ ...prev, nda_text_no: e.target.value }))}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                NDA-tekst (English) *
              </label>
              <textarea
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
                rows={6}
                value={formData.nda_text_en}
                onChange={(e) => setFormData(prev => ({ ...prev, nda_text_en: e.target.value }))}
                required
              />
            </div>
            <div className="flex gap-3">
              <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>
                Avbryt
              </Button>
              <Button type="submit" loading={saving}>
                {editingEvent ? 'Lagre endringer' : 'Opprett event'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Eventer</CardTitle>
        <Button onClick={openNewForm}>+ Nytt event</Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-8 text-gray-500">Laster...</div>
        ) : events.length === 0 ? (
          <div className="text-center py-8 text-gray-500">Ingen eventer</div>
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
                <Button variant="secondary" onClick={() => openEditForm(event)}>
                  Rediger
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
