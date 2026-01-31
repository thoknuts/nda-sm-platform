import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card'
import { Input } from '../components/ui/Input'
import { Button } from '../components/ui/Button'

export function ResetPasswordPage() {
  const [identifier, setIdentifier] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/auth-request-password-reset`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ identifier }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'En feil oppstod')
        setLoading(false)
        return
      }

      setSubmitted(true)
    } catch {
      setError('En feil oppstod')
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-primary flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent>
            <div className="text-primary text-5xl mb-4">✉️</div>
            <h2 className="text-xl font-bold mb-2">Sjekk e-posten din</h2>
            <p className="text-gray-600 mb-4">
              Hvis kontoen finnes, vil du motta en e-post med instruksjoner for å tilbakestille passordet.
            </p>
            <Link to="/login" className="text-primary hover:underline">
              Tilbake til innlogging
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-primary flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center">Tilbakestill passord</CardTitle>
          <p className="text-center text-gray-600 mt-2">
            Skriv inn brukernavn eller e-post
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
              label="Brukernavn eller e-post"
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              required
              placeholder="brukernavn eller din@epost.no"
            />

            <Button type="submit" loading={loading} className="w-full">
              Send tilbakestillingslenke
            </Button>
          </form>

          <div className="mt-6 text-center">
            <Link to="/login" className="text-sm text-primary hover:underline">
              Tilbake til innlogging
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
