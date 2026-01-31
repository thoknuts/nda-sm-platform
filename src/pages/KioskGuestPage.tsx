import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useKiosk } from '../contexts/KioskContext'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { Card, CardContent } from '../components/ui/Card'
import { Input } from '../components/ui/Input'
import { Button } from '../components/ui/Button'
import { Checkbox } from '../components/ui/Checkbox'
import { SignatureCanvas } from '../components/SignatureCanvas'
import { PhoneInput } from '../components/ui/PhoneInput'

type Step = 'language' | 'nda' | 'lookup_username' | 'lookup_phone' | 'form' | 'signature' | 'success'

interface EventData {
  id: string
  name: string
  nda_text_no: string
  nda_text_en: string
}

interface AppConfig {
  privacy_text_no: string
  privacy_text_en: string
  privacy_version: number
  background_color: string
  logo_url: string | null
}

interface GuestFormData {
  sm_username: string
  phone: string
  first_name: string
  last_name: string
  email: string
  location: string
}

const translations = {
  no: {
    welcome: 'Velkommen',
    selectLanguage: 'Velg språk',
    norwegian: 'Norsk',
    english: 'English',
    next: 'Neste',
    back: 'Tilbake',
    ndaTitle: 'Taushetserklæring',
    readConfirm: 'Jeg har lest og forstått innholdet',
    privacyAccept: 'Jeg aksepterer personvernerklæringen',
    continue: 'Fortsett',
    enterDetails: 'Skriv inn dine opplysninger',
    smUsername: 'SpicyMatch brukernavn',
    smUsernameHint: 'Skriv inn ditt SpicyMatch brukernavn for å sjekke om du er på gjestelisten',
    smUsernamePlaceholder: 'ditt.brukernavn',
    phone: 'Mobilnummer',
    phoneHelp: 'Format: landskode + nummer (f.eks. 4746427042)',
    lookup: 'Søk',
    firstName: 'Fornavn',
    lastName: 'Etternavn',
    email: 'E-post',
    location: 'Sted',
    signBelow: 'Signer nedenfor',
    success: 'Signert!',
    waitingVerification: 'Venter på ID-kontroll',
    newGuest: 'Ny gjest',
  },
  en: {
    welcome: 'Welcome',
    selectLanguage: 'Select language',
    norwegian: 'Norsk',
    english: 'English',
    next: 'Next',
    back: 'Back',
    ndaTitle: 'Non-Disclosure Agreement',
    readConfirm: 'I have read and understood the content',
    privacyAccept: 'I accept the privacy policy',
    continue: 'Continue',
    enterDetails: 'Enter your details',
    smUsername: 'SpicyMatch username',
    smUsernameHint: 'Enter your SpicyMatch username to check if you are on the guest list',
    smUsernamePlaceholder: 'your.username',
    phone: 'Mobile number',
    phoneHelp: 'Format: country code + number (e.g. 4746427042)',
    lookup: 'Search',
    firstName: 'First name',
    lastName: 'Last name',
    email: 'Email',
    location: 'Location',
    signBelow: 'Sign below',
    success: 'Signed!',
    waitingVerification: 'Waiting for ID verification',
    newGuest: 'New guest',
  },
}

export function KioskGuestPage() {
  const { eventId } = useParams<{ eventId: string }>()
  const navigate = useNavigate()
  const { session, language, setLanguage, isLocked, setIsLocked, clearSession } = useKiosk()
  const { session: authSession } = useAuth()

  const [step, setStep] = useState<Step>('language')
  const [event, setEvent] = useState<EventData | null>(null)
  const [appConfig, setAppConfig] = useState<AppConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const [readConfirmed, setReadConfirmed] = useState(false)
  const [privacyAccepted, setPrivacyAccepted] = useState(false)

  const [formData, setFormData] = useState<GuestFormData>({
    sm_username: '',
    phone: '',
    first_name: '',
    last_name: '',
    email: '',
    location: '',
  })
  const [smUsernameLocked, setSmUsernameLocked] = useState(false)
  const [lookupLoading, setLookupLoading] = useState(false)
  const [lookupError, setLookupError] = useState('')

  const [lockHoldProgress, setLockHoldProgress] = useState(0)
  const [exitHoldProgress, setExitHoldProgress] = useState(0)
  const [showLockModal, setShowLockModal] = useState(false)
  const [showExitModal, setShowExitModal] = useState(false)
  const [unlockPassword, setUnlockPassword] = useState('')
  const [unlockError, setUnlockError] = useState('')

  const t = translations[language]

  useEffect(() => {
    if (!session || session.eventId !== eventId) {
      navigate('/kiosk')
      return
    }
    fetchEventData()
  }, [session, eventId])

  async function fetchEventData() {
    const [eventRes, configRes] = await Promise.all([
      supabase.from('events').select('*').eq('id', eventId).single(),
      supabase.from('app_config').select('*').eq('id', 1).single(),
    ])

    if (eventRes.error || !eventRes.data) {
      setError('Kunne ikke hente event-data')
    } else {
      setEvent(eventRes.data as EventData)
    }

    if (configRes.data) {
      setAppConfig(configRes.data as AppConfig)
    }

    setLoading(false)
  }

  async function handleVerifyUsername() {
    if (!formData.sm_username) {
      setLookupError('Fyll inn SpicyMatch brukernavn')
      return
    }

    setLookupLoading(true)
    setLookupError('')

    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/guest-lookup-and-prefill`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-kiosk-token': session!.kioskToken,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          sm_username: formData.sm_username,
          event_id: eventId,
          step: 'verify_username',
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setLookupError(data.error || 'SpicyMatch brukernavn ikke på gjestelisten')
        setLookupLoading(false)
        return
      }

      setFormData(prev => ({ ...prev, sm_username: data.sm_username }))
      setSmUsernameLocked(true)
      setStep('lookup_phone')
    } catch {
      setLookupError('En feil oppstod')
    } finally {
      setLookupLoading(false)
    }
  }

  async function handleLookupPhone() {
    if (!formData.phone) {
      setLookupError('Fyll inn mobilnummer')
      return
    }

    setLookupLoading(true)
    setLookupError('')

    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/guest-lookup-and-prefill`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-kiosk-token': session!.kioskToken,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          sm_username: formData.sm_username,
          phone: formData.phone,
          event_id: eventId,
          step: 'lookup_phone',
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setLookupError(data.error || 'Feil ved oppslag')
        setLookupLoading(false)
        return
      }

      setFormData({
        sm_username: data.sm_username,
        phone: data.phone,
        first_name: data.first_name || '',
        last_name: data.last_name || '',
        email: data.email || '',
        location: data.location || '',
      })
      setStep('form')
    } catch {
      setLookupError('En feil oppstod')
    } finally {
      setLookupLoading(false)
    }
  }

  async function handleSignature(signatureBase64: string) {
    setSubmitting(true)
    setError('')

    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/guest-submit-signature`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-kiosk-token': session!.kioskToken,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          event_id: eventId,
          sm_username: formData.sm_username,
          phone: formData.phone,
          first_name: formData.first_name,
          last_name: formData.last_name,
          email: formData.email,
          location: formData.location,
          language,
          read_confirmed: readConfirmed,
          privacy_accepted: privacyAccepted,
          signature_png_base64: signatureBase64,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Kunne ikke lagre signatur')
        setSubmitting(false)
        return
      }

      setStep('success')
    } catch {
      setError('En feil oppstod')
    } finally {
      setSubmitting(false)
    }
  }

  function resetForNewGuest() {
    setStep('language')
    setReadConfirmed(false)
    setPrivacyAccepted(false)
    setFormData({
      sm_username: '',
      phone: '',
      first_name: '',
      last_name: '',
      email: '',
      location: '',
    })
    setSmUsernameLocked(false)
    setError('')
    setLookupError('')
  }

  function handleLockHold(isHolding: boolean) {
    if (isHolding) {
      const interval = setInterval(() => {
        setLockHoldProgress(prev => {
          if (prev >= 100) {
            clearInterval(interval)
            setShowLockModal(true)
            return 0
          }
          return prev + 5
        })
      }, 75) // 1.5 seconds total
      return () => clearInterval(interval)
    } else {
      setLockHoldProgress(0)
    }
  }

  function handleExitHold(isHolding: boolean) {
    if (isHolding) {
      const interval = setInterval(() => {
        setExitHoldProgress(prev => {
          if (prev >= 100) {
            clearInterval(interval)
            setShowExitModal(true)
            return 0
          }
          return prev + 3.33
        })
      }, 83) // 2.5 seconds total
      return () => clearInterval(interval)
    } else {
      setExitHoldProgress(0)
    }
  }

  async function handleUnlock() {
    // For simplicity, verify against the user's password via re-auth
    // In production, you'd use PIN stored in profile
    setUnlockError('')
    
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: authSession?.user?.email || '',
        password: unlockPassword,
      })

      if (error) {
        setUnlockError('Feil passord')
        return
      }

      setIsLocked(false)
      setUnlockPassword('')
    } catch {
      setUnlockError('En feil oppstod')
    }
  }

  async function handleExit() {
    // Verify password first
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: authSession?.user?.email || '',
        password: unlockPassword,
      })

      if (error) {
        setUnlockError('Feil passord')
        return
      }

      // Revoke session server-side would be ideal, but for now just clear locally
      clearSession()
      navigate('/kiosk')
    } catch {
      setUnlockError('En feil oppstod')
    }
  }

  const backgroundColor = appConfig?.background_color || '#581c87'

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor }}>
        <div className="text-white text-xl">Laster...</div>
      </div>
    )
  }

  if (isLocked) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor }}>
        <Card className="w-full max-w-md text-center">
          <CardContent>
            <div className="text-6xl mb-4">🔒</div>
            <h2 className="text-2xl font-bold mb-4">Kiosk er låst</h2>
            <Input
              type="password"
              placeholder="Skriv inn passord"
              value={unlockPassword}
              onChange={(e) => setUnlockPassword(e.target.value)}
              error={unlockError}
            />
            <Button onClick={handleUnlock} className="w-full mt-4">
              Lås opp
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-4 relative" style={{ backgroundColor }}>
      {/* Logo */}
      {appConfig?.logo_url && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40">
          <img 
            src={appConfig.logo_url} 
            alt="Logo" 
            className="max-h-16 max-w-xs object-contain"
          />
        </div>
      )}

      {/* Crew controls - top right corner */}
      <div className="absolute top-4 right-4 flex gap-2 items-center z-50">
        <div className="text-white/60 text-xs mr-2">Kiosk: ON</div>
        
        {/* Lock button */}
        <button
          className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white relative"
          onMouseDown={() => handleLockHold(true)}
          onMouseUp={() => handleLockHold(false)}
          onMouseLeave={() => handleLockHold(false)}
          onTouchStart={() => handleLockHold(true)}
          onTouchEnd={() => handleLockHold(false)}
        >
          🔒
          {lockHoldProgress > 0 && (
            <svg className="absolute inset-0 w-full h-full -rotate-90">
              <circle
                cx="20"
                cy="20"
                r="18"
                fill="none"
                stroke="white"
                strokeWidth="2"
                strokeDasharray={`${lockHoldProgress * 1.13} 113`}
              />
            </svg>
          )}
        </button>

        {/* Exit button */}
        <button
          className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/60 text-sm relative"
          onMouseDown={() => handleExitHold(true)}
          onMouseUp={() => handleExitHold(false)}
          onMouseLeave={() => handleExitHold(false)}
          onTouchStart={() => handleExitHold(true)}
          onTouchEnd={() => handleExitHold(false)}
        >
          ⏻
          {exitHoldProgress > 0 && (
            <svg className="absolute inset-0 w-full h-full -rotate-90">
              <circle
                cx="16"
                cy="16"
                r="14"
                fill="none"
                stroke="white"
                strokeWidth="2"
                strokeDasharray={`${exitHoldProgress * 0.88} 88`}
              />
            </svg>
          )}
        </button>
      </div>

      {/* Lock Modal */}
      {showLockModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-sm">
            <CardContent>
              <h3 className="text-lg font-bold mb-4">Lås kiosk?</h3>
              <div className="flex gap-3">
                <Button variant="secondary" onClick={() => setShowLockModal(false)} className="flex-1">
                  Avbryt
                </Button>
                <Button onClick={() => { setIsLocked(true); setShowLockModal(false); }} className="flex-1">
                  Lås nå
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Exit Modal */}
      {showExitModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-sm">
            <CardContent>
              <h3 className="text-lg font-bold mb-4">Avslutt kiosk?</h3>
              <Input
                type="password"
                placeholder="Bekreft med passord"
                value={unlockPassword}
                onChange={(e) => setUnlockPassword(e.target.value)}
                error={unlockError}
              />
              <div className="flex gap-3 mt-4">
                <Button variant="secondary" onClick={() => { setShowExitModal(false); setUnlockPassword(''); }} className="flex-1">
                  Avbryt
                </Button>
                <Button variant="danger" onClick={handleExit} className="flex-1">
                  Avslutt
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="max-w-2xl mx-auto pt-16">
        {/* Language Selection */}
        {step === 'language' && (
          <Card className="text-center">
            <CardContent>
              <h1 className="text-3xl font-bold mb-2">{t.welcome}</h1>
              <p className="text-gray-600 mb-8">{event?.name}</p>
              <p className="text-lg mb-6">{t.selectLanguage}</p>
              <div className="flex gap-4 justify-center">
                <Button
                  size="lg"
                  variant={language === 'no' ? 'primary' : 'secondary'}
                  onClick={() => { setLanguage('no'); setStep('nda'); }}
                  className="min-w-32"
                >
                  {t.norwegian}
                </Button>
                <Button
                  size="lg"
                  variant={language === 'en' ? 'primary' : 'secondary'}
                  onClick={() => { setLanguage('en'); setStep('nda'); }}
                  className="min-w-32"
                >
                  {t.english}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* NDA Text */}
        {step === 'nda' && event && appConfig && (
          <Card>
            <CardContent>
              <h2 className="text-2xl font-bold mb-4">{t.ndaTitle}</h2>
              <div className="bg-gray-50 p-4 rounded-lg mb-6 max-h-64 overflow-y-auto">
                <p className="whitespace-pre-wrap text-sm">
                  {language === 'no' ? event.nda_text_no : event.nda_text_en}
                </p>
              </div>

              <div className="space-y-4 mb-6">
                <Checkbox
                  label={t.readConfirm}
                  checked={readConfirmed}
                  onChange={(e) => setReadConfirmed(e.target.checked)}
                  required
                />
                <Checkbox
                  label={t.privacyAccept}
                  checked={privacyAccepted}
                  onChange={(e) => setPrivacyAccepted(e.target.checked)}
                  required
                />
              </div>

              <div className="flex gap-3">
                <Button variant="secondary" onClick={() => setStep('language')}>
                  {t.back}
                </Button>
                <Button
                  onClick={() => setStep('lookup_username')}
                  disabled={!readConfirmed || !privacyAccepted}
                  className="flex-1"
                >
                  {t.continue}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Lookup Username - Step 1 */}
        {step === 'lookup_username' && (
          <Card>
            <CardContent>
              <h2 className="text-2xl font-bold mb-4">{t.smUsername}</h2>
              <p className="text-gray-600 mb-4">{t.smUsernameHint}</p>

              {lookupError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
                  {lookupError}
                </div>
              )}

              <div className="space-y-4">
                <Input
                  label={t.smUsername}
                  value={formData.sm_username}
                  onChange={(e) => setFormData(prev => ({ ...prev, sm_username: e.target.value.toLowerCase() }))}
                  required
                  placeholder={t.smUsernamePlaceholder}
                />
              </div>

              <div className="flex gap-3 mt-6">
                <Button variant="secondary" onClick={() => setStep('nda')}>
                  {t.back}
                </Button>
                <Button onClick={handleVerifyUsername} loading={lookupLoading} className="flex-1">
                  {t.next}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Lookup Phone - Step 2 */}
        {step === 'lookup_phone' && (
          <Card>
            <CardContent>
              <h2 className="text-2xl font-bold mb-4">{t.phone}</h2>
              <p className="text-gray-600 mb-4">
                <span className="font-mono bg-gray-100 px-2 py-1 rounded">{formData.sm_username}</span> er på gjestelisten ✓
              </p>

              {lookupError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
                  {lookupError}
                </div>
              )}

              <div className="space-y-4">
                <PhoneInput
                  label={t.phone}
                  value={formData.phone}
                  onChange={(fullNumber) => setFormData(prev => ({ ...prev, phone: fullNumber }))}
                  language={language}
                  required
                />
              </div>

              <div className="flex gap-3 mt-6">
                <Button variant="secondary" onClick={() => { setStep('lookup_username'); setLookupError(''); }}>
                  {t.back}
                </Button>
                <Button onClick={handleLookupPhone} loading={lookupLoading} className="flex-1">
                  {t.next}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Form */}
        {step === 'form' && (
          <Card>
            <CardContent>
              <h2 className="text-2xl font-bold mb-4">{t.enterDetails}</h2>

              <div className="space-y-4">
                <Input
                  label={t.smUsername}
                  value={formData.sm_username}
                  onChange={(e) => setFormData(prev => ({ ...prev, sm_username: e.target.value.toLowerCase() }))}
                  disabled={smUsernameLocked}
                  required
                />
                <PhoneInput
                  label={t.phone}
                  value={formData.phone}
                  onChange={(fullNumber) => setFormData(prev => ({ ...prev, phone: fullNumber }))}
                  language={language}
                  required
                />
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label={t.firstName}
                    value={formData.first_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, first_name: e.target.value }))}
                    required
                  />
                  <Input
                    label={t.lastName}
                    value={formData.last_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, last_name: e.target.value }))}
                    required
                  />
                </div>
                <Input
                  label={t.email}
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                />
                <Input
                  label={t.location}
                  value={formData.location}
                  onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                />
              </div>

              <div className="flex gap-3 mt-6">
                <Button variant="secondary" onClick={() => setStep('lookup_phone')}>
                  {t.back}
                </Button>
                <Button
                  onClick={() => setStep('signature')}
                  disabled={!formData.first_name || !formData.last_name}
                  className="flex-1"
                >
                  {t.continue}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Signature */}
        {step === 'signature' && (
          <Card>
            <CardContent>
              <h2 className="text-2xl font-bold mb-4">{t.signBelow}</h2>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
                  {error}
                </div>
              )}

              {submitting ? (
                <div className="text-center py-8">
                  <div className="animate-spin w-12 h-12 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
                  <p>Lagrer signatur...</p>
                </div>
              ) : (
                <>
                  <SignatureCanvas
                    onSave={handleSignature}
                    onClear={() => {}}
                    language={language}
                  />
                  <Button variant="secondary" onClick={() => setStep('form')} className="mt-4">
                    {t.back}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* Success */}
        {step === 'success' && (
          <Card className="text-center">
            <CardContent>
              <div className="text-green-600 text-6xl mb-4">✓</div>
              <h2 className="text-3xl font-bold mb-2">{t.success}</h2>
              <p className="text-gray-600 mb-8">{t.waitingVerification}</p>
              <Button onClick={resetForNewGuest} size="lg">
                {t.newGuest}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
