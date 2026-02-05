import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card'
import { Input } from '../components/ui/Input'
import { Button } from '../components/ui/Button'

export function UpdatePasswordPage() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [hasValidToken, setHasValidToken] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    async function handleRecoveryToken() {
      // Check URL hash for tokens (Supabase sends them in hash fragment)
      const hashParams = new URLSearchParams(window.location.hash.substring(1))
      const accessToken = hashParams.get('access_token')
      const refreshToken = hashParams.get('refresh_token')
      const type = hashParams.get('type')

      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        })
        
        if (!error) {
          setHasValidToken(true)
          // Clear the hash from URL for cleaner look
          window.history.replaceState(null, '', window.location.pathname)
        } else {
          setError('Ugyldig eller utløpt lenke. Vennligst be om ny tilbakestilling.')
        }
      } else if (type === 'recovery') {
        // Supabase might handle this differently in some versions
        const { data: { session } } = await supabase.auth.getSession()
        if (session) {
          setHasValidToken(true)
        } else {
          setError('Ugyldig eller utløpt lenke. Vennligst be om ny tilbakestilling.')
        }
      } else {
        // Check if user already has a valid session from recovery
        const { data: { session } } = await supabase.auth.getSession()
        if (session) {
          setHasValidToken(true)
        } else {
          setError('Ingen gyldig tilbakestillingslenke funnet.')
        }
      }
      setLoading(false)
    }

    handleRecoveryToken()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError('Passordene stemmer ikke overens')
      return
    }

    if (password.length < 8) {
      setError('Passord må være minst 8 tegn')
      return
    }

    setLoading(true)

    const { error: updateError } = await supabase.auth.updateUser({
      password: password,
    })

    if (updateError) {
      setError(updateError.message)
      setLoading(false)
      return
    }

    setSuccess(true)
    setTimeout(() => navigate('/login'), 3000)
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-primary flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent>
            <p className="text-gray-600">Verifiserer lenke...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Success state
  if (success) {
    return (
      <div className="min-h-screen bg-primary flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent>
            <div className="text-green-600 text-5xl mb-4">✓</div>
            <h2 className="text-xl font-bold mb-2">Passord oppdatert!</h2>
            <p className="text-gray-600">Du blir sendt til innlogging...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Invalid token state
  if (!hasValidToken) {
    return (
      <div className="min-h-screen bg-primary flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-center">Ugyldig lenke</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-gray-600">
              {error || 'Tilbakestillingslenken er ugyldig eller har utløpt.'}
            </p>
            <Link
              to="/reset-password"
              className="inline-block text-primary hover:underline"
            >
              Be om ny tilbakestillingslenke
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Form state
  return (
    <div className="min-h-screen bg-primary flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center">Sett nytt passord</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            <Input
              label="Nytt passord"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="new-password"
              helpText="Minst 8 tegn"
            />

            <Input
              label="Bekreft passord"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              autoComplete="new-password"
            />

            <Button type="submit" className="w-full">
              Oppdater passord
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
