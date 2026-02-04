import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card'

interface EventStats {
  id: string
  name: string
  event_date: string
  end_date: string
  total_guests: number
  signed_count: number
}

function PieChart({ signed, total }: { signed: number; total: number }) {
  const percentage = total > 0 ? Math.round((signed / total) * 100) : 0
  const circumference = 2 * Math.PI * 45
  const signedDash = (signed / Math.max(total, 1)) * circumference
  const unsignedDash = circumference - signedDash

  return (
    <div className="relative w-40 h-40">
      <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
        <circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          stroke="#e5e7eb"
          strokeWidth="10"
        />
        {signed > 0 && (
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="#22c55e"
            strokeWidth="10"
            strokeDasharray={`${signedDash} ${unsignedDash}`}
            strokeLinecap="round"
          />
        )}
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-2xl font-bold text-gray-800">{percentage}%</span>
      </div>
    </div>
  )
}

export function OrganizerStatistics() {
  const [events, setEvents] = useState<EventStats[]>([])
  const [loading, setLoading] = useState(true)
  const { profile } = useAuth()

  useEffect(() => {
    fetchStatistics()
  }, [profile])

  async function fetchStatistics() {
    if (!profile) return

    const { data: eventsData } = await supabase
      .from('events')
      .select('id, name, event_date, end_date')
      .eq('created_by', profile.user_id)
      .order('event_date', { ascending: false })

    if (!eventsData) {
      setLoading(false)
      return
    }

    const statsPromises = eventsData.map(async (event) => {
      const { count: totalGuests } = await supabase
        .from('event_guests')
        .select('*', { count: 'exact', head: true })
        .eq('event_id', event.id)

      const { count: signedCount } = await supabase
        .from('nda_signatures')
        .select('*', { count: 'exact', head: true })
        .eq('event_id', event.id)

      return {
        ...event,
        total_guests: totalGuests || 0,
        signed_count: signedCount || 0,
      }
    })

    const stats = await Promise.all(statsPromises)
    setEvents(stats)
    setLoading(false)
  }

  if (loading) {
    return (
      <Card>
        <CardContent>
          <div className="text-center py-8 text-gray-500">Laster statistikk...</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Statistikk - Mine eventer</CardTitle>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <div className="text-center py-8 text-gray-500">Ingen eventer</div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {events.map(event => (
              <div
                key={event.id}
                className="border rounded-lg p-4 flex flex-col items-center"
              >
                <h3 className="font-medium text-lg mb-1">{event.name}</h3>
                <p className="text-sm text-gray-500 mb-4">
                  {new Date(event.event_date).toLocaleDateString('no-NO')}
                  {event.end_date && event.end_date !== event.event_date && (
                    <> - {new Date(event.end_date).toLocaleDateString('no-NO')}</>
                  )}
                </p>
                
                <PieChart signed={event.signed_count} total={event.total_guests} />
                
                <div className="mt-4 text-center">
                  <p className="text-sm">
                    <span className="font-medium text-green-600">{event.signed_count}</span>
                    <span className="text-gray-500"> av </span>
                    <span className="font-medium">{event.total_guests}</span>
                    <span className="text-gray-500"> har signert</span>
                  </p>
                </div>

                <div className="mt-3 flex gap-4 text-xs">
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                    <span>Signert</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded-full bg-gray-200"></div>
                    <span>Ikke signert</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
