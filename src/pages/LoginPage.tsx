import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card'
import { Input } from '../components/ui/Input'
import { Button } from '../components/ui/Button'

export function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { signIn, profile } = useAuth()
  const navigate = useNavigate()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { error, profile: userProfile } = await signIn(username, password)

    if (error) {
      setError(error)
      setLoading(false)
    } else {
      setLoading(false)
      // Navigate based on role
      const role = userProfile?.role || profile?.role
      console.log('[Login] Login successful, role:', role)
      if (role === 'admin') {
        navigate('/admin', { replace: true })
      } else if (role === 'organizer') {
        navigate('/organizer', { replace: true })
      } else {
        navigate('/kiosk', { replace: true })
      }
    }
  }

  return (
    <div className="min-h-screen bg-primary flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center">SM NDA Sign</CardTitle>
          <p className="text-center text-gray-600 mt-2">Logg inn for å fortsette</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            <Input
              label="Brukernavn"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoComplete="username"
              placeholder="ditt.brukernavn"
            />

            <Input
              label="Passord"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />

            <Button type="submit" loading={loading} className="w-full">
              Logg inn
            </Button>
          </form>

          <div className="mt-6 text-center space-y-2">
            <Link
              to="/reset-password"
              className="text-sm text-primary hover:underline block"
            >
              Glemt passord?
            </Link>
            <Link
              to="/register/crew"
              className="text-sm text-gray-600 hover:underline block"
            >
              Har du en invitasjon? Registrer deg her
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
