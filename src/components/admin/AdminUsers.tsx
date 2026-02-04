import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import type { UserRole } from '../../types/database'

interface UserProfile {
  user_id: string
  sm_username: string
  full_name: string | null
  role: UserRole
  created_at: string
}

export function AdminUsers() {
  const [users, setUsers] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    fetchUsers()
  }, [])

  async function fetchUsers() {
    setLoading(true)
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .in('role', ['admin', 'crew', 'organizer'])
      .order('created_at', { ascending: false })

    if (error) {
      setError('Kunne ikke hente brukere')
    } else {
      setUsers((data as UserProfile[]) || [])
    }
    setLoading(false)
  }

  async function handleUpdateRole(userId: string, newRole: UserRole) {
    setSaving(true)
    setError('')
    setSuccess('')

    const { error } = await supabase
      .from('profiles')
      .update({ role: newRole })
      .eq('user_id', userId)

    if (error) {
      setError('Kunne ikke oppdatere rolle')
    } else {
      setSuccess('Rolle oppdatert')
      setEditingUser(null)
      fetchUsers()
    }
    setSaving(false)
  }

  async function handleDeleteUser(userId: string) {
    if (!confirm('Er du sikker på at du vil slette denne brukeren? Dette kan ikke angres.')) {
      return
    }

    setDeleting(userId)
    setError('')
    setSuccess('')

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setError('Du må være logget inn')
        setDeleting(null)
        return
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-delete-user`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ userId }),
        }
      )

      const result = await response.json()

      if (!response.ok) {
        setError(result.error || 'Kunne ikke slette bruker')
      } else {
        setSuccess('Bruker slettet')
        fetchUsers()
      }
    } catch (err) {
      setError('Kunne ikke slette bruker. Prøv igjen eller kontakt systemadministrator.')
    }
    setDeleting(null)
  }

  const filteredUsers = users.filter(user => {
    const search = searchTerm.toLowerCase()
    return (
      user.sm_username.toLowerCase().includes(search) ||
      (user.full_name?.toLowerCase().includes(search) ?? false)
    )
  })

  const getRoleBadgeColor = (role: UserRole) => {
    switch (role) {
      case 'admin':
        return 'bg-red-100 text-red-800'
      case 'organizer':
        return 'bg-purple-100 text-purple-800'
      case 'crew':
        return 'bg-blue-100 text-blue-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getRoleLabel = (role: UserRole) => {
    switch (role) {
      case 'organizer':
        return 'Organizer'
      case 'crew':
        return 'Crew'
      case 'admin':
        return 'Admin'
      default:
        return role
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
          {success}
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Brukere ({filteredUsers.length})</CardTitle>
            <Input
              type="text"
              placeholder="Søk etter brukernavn eller navn..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-64"
            />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-gray-500 text-center py-8">Laster...</p>
          ) : filteredUsers.length === 0 ? (
            <p className="text-gray-500 text-center py-8">
              {searchTerm ? 'Ingen brukere funnet' : 'Ingen brukere med roller'}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Brukernavn</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Navn</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Rolle</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Opprettet</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-600">Handlinger</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map(user => (
                    <tr key={user.user_id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <span className="font-medium">@{user.sm_username}</span>
                      </td>
                      <td className="py-3 px-4">
                        {user.full_name || <span className="text-gray-400">-</span>}
                      </td>
                      <td className="py-3 px-4">
                        {editingUser?.user_id === user.user_id ? (
                          <select
                            value={editingUser.role}
                            onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value as UserRole })}
                            className="border rounded px-2 py-1 text-sm"
                          >
                            <option value="crew">Crew</option>
                            <option value="organizer">Organizer</option>
                            <option value="admin">Admin</option>
                          </select>
                        ) : (
                          <span className={`text-xs px-2 py-1 rounded ${getRoleBadgeColor(user.role)}`}>
                            {getRoleLabel(user.role)}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-500">
                        {new Date(user.created_at).toLocaleDateString('no-NO')}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {editingUser?.user_id === user.user_id ? (
                            <>
                              <Button
                                size="sm"
                                variant="primary"
                                onClick={() => handleUpdateRole(user.user_id, editingUser.role)}
                                loading={saving}
                              >
                                Lagre
                              </Button>
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => setEditingUser(null)}
                                disabled={saving}
                              >
                                Avbryt
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => setEditingUser(user)}
                              >
                                Rediger
                              </Button>
                              <Button
                                size="sm"
                                variant="danger"
                                onClick={() => handleDeleteUser(user.user_id)}
                                loading={deleting === user.user_id}
                              >
                                Slett
                              </Button>
                            </>
                          )}
                        </div>
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
