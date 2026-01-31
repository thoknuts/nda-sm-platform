import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'

interface CrewMember {
  user_id: string
  sm_username: string
  full_name: string | null
  role: string
}

interface CrewInvite {
  id: string
  email: string
  expires_at: string
  used_at: string | null
  revoked_at: string | null
}

interface Event {
  id: string
  name: string
}

interface CrewAccess {
  id: string
  event_id: string
  events: { name: string }
}

export function AdminCrew() {
  const [crew, setCrew] = useState<CrewMember[]>([])
  const [invites, setInvites] = useState<CrewInvite[]>([])
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [inviteEmail, setInviteEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [selectedCrew, setSelectedCrew] = useState<string | null>(null)
  const [crewAccess, setCrewAccess] = useState<CrewAccess[]>([])

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    const [crewRes, invitesRes, eventsRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('role', 'crew'),
      supabase.from('crew_invites').select('*').order('created_at', { ascending: false }),
      supabase.from('events').select('id, name').order('event_date', { ascending: false }),
    ])

    setCrew((crewRes.data as CrewMember[]) || [])
    setInvites((invitesRes.data as CrewInvite[]) || [])
    setEvents((eventsRes.data as Event[]) || [])
    setLoading(false)
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    setSending(true)

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

    const { data: { user } } = await supabase.auth.getUser()

    await supabase.from('crew_invites').insert({
      email: inviteEmail.toLowerCase(),
      created_by: user?.id,
      expires_at: expiresAt,
    })

    setInviteEmail('')
    setSending(false)
    fetchData()
  }

  async function handleRevoke(inviteId: string) {
    await supabase
      .from('crew_invites')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', inviteId)

    fetchData()
  }

  async function fetchCrewAccess(userId: string) {
    setSelectedCrew(userId)
    const { data } = await supabase
      .from('crew_event_access')
      .select('id, event_id, events:event_id (name)')
      .eq('crew_user_id', userId)

    setCrewAccess((data as unknown as CrewAccess[]) || [])
  }

  async function toggleEventAccess(eventId: string) {
    if (!selectedCrew) return

    const existing = crewAccess.find(a => a.event_id === eventId)

    if (existing) {
      await supabase.from('crew_event_access').delete().eq('id', existing.id)
    } else {
      await supabase.from('crew_event_access').insert({
        event_id: eventId,
        crew_user_id: selectedCrew,
      })
    }

    fetchCrewAccess(selectedCrew)
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Inviter Crew</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleInvite} className="flex gap-2">
              <Input
                type="email"
                placeholder="epost@example.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                required
                className="flex-1"
              />
              <Button type="submit" loading={sending}>
                Send invitasjon
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Invitasjoner</CardTitle>
          </CardHeader>
          <CardContent>
            {invites.length === 0 ? (
              <p className="text-gray-500 text-center py-4">Ingen invitasjoner</p>
            ) : (
              <div className="space-y-2">
                {invites.map(invite => (
                  <div key={invite.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">{invite.email}</p>
                      <p className="text-xs text-gray-500">
                        Utløper: {new Date(invite.expires_at).toLocaleDateString('no-NO')}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {invite.used_at ? (
                        <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">Brukt</span>
                      ) : invite.revoked_at ? (
                        <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded">Revokert</span>
                      ) : new Date(invite.expires_at) < new Date() ? (
                        <span className="text-xs bg-gray-100 text-gray-800 px-2 py-1 rounded">Utløpt</span>
                      ) : (
                        <Button size="sm" variant="danger" onClick={() => handleRevoke(invite.id)}>
                          Revoke
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Crew-medlemmer ({crew.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-gray-500 text-center py-4">Laster...</p>
            ) : crew.length === 0 ? (
              <p className="text-gray-500 text-center py-4">Ingen crew</p>
            ) : (
              <div className="space-y-2">
                {crew.map(member => (
                  <div
                    key={member.user_id}
                    className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                      selectedCrew === member.user_id ? 'border-primary bg-primary/5' : 'hover:bg-gray-50'
                    }`}
                    onClick={() => fetchCrewAccess(member.user_id)}
                  >
                    <p className="font-medium">{member.full_name || member.sm_username}</p>
                    <p className="text-sm text-gray-500">@{member.sm_username}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {selectedCrew && (
          <Card>
            <CardHeader>
              <CardTitle>Event-tilgang</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {events.map(event => {
                  const hasAccess = crewAccess.some(a => a.event_id === event.id)
                  return (
                    <div
                      key={event.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <span>{event.name}</span>
                      <Button
                        size="sm"
                        variant={hasAccess ? 'danger' : 'primary'}
                        onClick={() => toggleEventAccess(event.id)}
                      >
                        {hasAccess ? 'Fjern tilgang' : 'Gi tilgang'}
                      </Button>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
