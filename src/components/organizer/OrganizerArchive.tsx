import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card'
import { Button } from '../ui/Button'

interface ArchivedEvent {
  id: string
  name: string
  event_date: string
  end_date: string
  created_at: string
  signature_count?: number
}

export function OrganizerArchive() {
  const [events, setEvents] = useState<ArchivedEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null)
  const { profile } = useAuth()

  useEffect(() => {
    fetchArchivedEvents()
  }, [profile])

  async function fetchArchivedEvents() {
    if (!profile) return
    
    const today = new Date().toISOString().split('T')[0]
    
    const { data: eventsData } = await supabase
      .from('events')
      .select('id, name, event_date, end_date, created_at')
      .eq('created_by', profile.user_id)
      .lt('end_date', today)
      .order('end_date', { ascending: false })

    if (eventsData) {
      const eventsWithCounts = await Promise.all(
        eventsData.map(async (event) => {
          const { count } = await supabase
            .from('nda_signatures')
            .select('*', { count: 'exact', head: true })
            .eq('event_id', event.id)
          
          return {
            ...event,
            signature_count: count || 0
          }
        })
      )
      setEvents(eventsWithCounts)
    }
    
    setLoading(false)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Arkiv - Mine eventer</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-8 text-gray-500">Laster...</div>
        ) : events.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            Ingen arkiverte eventer
          </div>
        ) : (
          <div className="space-y-3">
            {events.map(event => (
              <div
                key={event.id}
                className="border rounded-lg overflow-hidden"
              >
                <div 
                  className="flex items-center justify-between p-4 hover:bg-gray-50 cursor-pointer"
                  onClick={() => setExpandedEvent(expandedEvent === event.id ? null : event.id)}
                >
                  <div>
                    <h3 className="font-medium">{event.name}</h3>
                    <p className="text-sm text-gray-500">
                      {new Date(event.event_date).toLocaleDateString('no-NO')} - {new Date(event.end_date).toLocaleDateString('no-NO')}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-gray-500">
                      {event.signature_count} signaturer
                    </span>
                    <Button variant="secondary" size="sm">
                      {expandedEvent === event.id ? '▲' : '▼'}
                    </Button>
                  </div>
                </div>
                
                {expandedEvent === event.id && (
                  <div className="border-t bg-gray-50 p-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">Opprettet:</span>
                        <span className="ml-2">{new Date(event.created_at).toLocaleDateString('no-NO')}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Antall signaturer:</span>
                        <span className="ml-2 font-medium">{event.signature_count}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
