import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card'
import { Input } from '../components/ui/Input'
import { Button } from '../components/ui/Button'

export function RegisterCrewPage() {
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    sm_username: '',
    password: '',
    confirmPassword: '',
  })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  function suggestUsername(fullName: string): string {
    const parts = fullName.toLowerCase().trim().split(/\s+/)
    if (parts.length >= 2) {
      const first = parts[0].replace(/[^a-z]/g, '')
      const last = parts[parts.length - 1].replace(/[^a-z]/g, '')
      return `${first}.${last}`
    }
    return parts[0]?.replace(/[^a-z]/g, '') || ''
  }

  function handleNameChange(value: string) {
    setFormData(prev => ({
      ...prev,
      full_name: value,
      sm_username: prev.sm_username || suggestUsername(value),
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (formData.password !== formData.confirmPassword) {
      setError('Passordene stemmer ikke overens')
      return
    }

    if (formData.password.length < 8) {
      setError('Passord må være minst 8 tegn')
      return
    }

    setLoading(true)

    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/auth-register-crew`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          full_name: formData.full_name,
          sm_username: formData.sm_username,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Registrering feilet')
        setLoading(false)
        return
      }

      setSuccess(true)
      setTimeout(() => navigate('/login'), 3000)
    } catch {
      setError('En feil oppstod ved registrering')
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-primary flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent>
            <div className="text-green-600 text-5xl mb-4">✓</div>
            <h2 className="text-xl font-bold mb-2">Registrering fullført!</h2>
            <p className="text-gray-600">Du blir sendt til innlogging...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-primary flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center">Registrer som Crew</CardTitle>
          <p className="text-center text-gray-600 mt-2">
            Du trenger en invitasjon for å registrere deg
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            <Input
              label="Fullt navn"
              type="text"
              value={formData.full_name}
              onChange={(e) => handleNameChange(e.target.value)}
              required
              placeholder="Ola Nordmann"
            />

            <Input
              label="E-post"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
              required
              placeholder="din@epost.no"
              helpText="Må matche e-posten i invitasjonen"
            />

            <Input
              label="Brukernavn"
              type="text"
              value={formData.sm_username}
              onChange={(e) => setFormData(prev => ({ ...prev, sm_username: e.target.value.toLowerCase() }))}
              required
              placeholder="ola.nordmann"
              helpText="3-32 tegn, kun a-z, 0-9, punktum, bindestrek, underscore, &"
            />

            <Input
              label="Passord"
              type="password"
              value={formData.password}
              onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
              required
              autoComplete="new-password"
              helpText="Minst 8 tegn"
            />

            <Input
              label="Bekreft passord"
              type="password"
              value={formData.confirmPassword}
              onChange={(e) => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))}
              required
              autoComplete="new-password"
            />

            <Button type="submit" loading={loading} className="w-full">
              Registrer
            </Button>
          </form>

          <div className="mt-6 text-center">
            <Link to="/login" className="text-sm text-primary hover:underline">
              Har du allerede en konto? Logg inn
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
