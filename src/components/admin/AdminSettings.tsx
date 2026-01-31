import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card'
import { Button } from '../ui/Button'
import { Checkbox } from '../ui/Checkbox'
import { Input } from '../ui/Input'

interface AppConfig {
  id: number
  privacy_text_no: string
  privacy_text_en: string
  privacy_version: number
  auto_lock_enabled: boolean
  auto_lock_minutes: number
  background_color: string
  logo_url: string | null
}

export function AdminSettings() {
  const [config, setConfig] = useState<AppConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    privacy_text_no: '',
    privacy_text_en: '',
    auto_lock_enabled: true,
    auto_lock_minutes: 5,
    background_color: '#581c87',
    logo_url: null as string | null,
  })
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetchConfig()
  }, [])

  async function fetchConfig() {
    const { data } = await supabase
      .from('app_config')
      .select('*')
      .eq('id', 1)
      .single()

    if (data) {
      const cfg = data as AppConfig
      setConfig(cfg)
      setFormData({
        privacy_text_no: cfg.privacy_text_no,
        privacy_text_en: cfg.privacy_text_en,
        auto_lock_enabled: cfg.auto_lock_enabled,
        auto_lock_minutes: cfg.auto_lock_minutes,
        background_color: cfg.background_color || '#581c87',
        logo_url: cfg.logo_url,
      })
    }
    setLoading(false)
  }

  async function handleSave() {
    setSaving(true)

    await supabase
      .from('app_config')
      .update({
        privacy_text_no: formData.privacy_text_no,
        privacy_text_en: formData.privacy_text_en,
        auto_lock_enabled: formData.auto_lock_enabled,
        auto_lock_minutes: formData.auto_lock_minutes,
        background_color: formData.background_color,
        logo_url: formData.logo_url,
        privacy_version: (config?.privacy_version || 0) + 1,
      })
      .eq('id', 1)

    setSaving(false)
    fetchConfig()
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingLogo(true)

    const fileExt = file.name.split('.').pop()
    const fileName = `logo-${Date.now()}.${fileExt}`

    // Delete old logo if exists
    if (formData.logo_url) {
      const oldPath = formData.logo_url.split('/').pop()
      if (oldPath) {
        await supabase.storage.from('logos').remove([oldPath])
      }
    }

    const { error } = await supabase.storage
      .from('logos')
      .upload(fileName, file, { upsert: true })

    if (!error) {
      const { data: urlData } = supabase.storage
        .from('logos')
        .getPublicUrl(fileName)

      setFormData(prev => ({ ...prev, logo_url: urlData.publicUrl }))
    }

    setUploadingLogo(false)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  async function handleDeleteLogo() {
    if (!formData.logo_url) return

    const fileName = formData.logo_url.split('/').pop()
    if (fileName) {
      await supabase.storage.from('logos').remove([fileName])
    }

    setFormData(prev => ({ ...prev, logo_url: null }))
  }

  if (loading) {
    return (
      <Card>
        <CardContent>
          <div className="text-center py-8 text-gray-500">Laster...</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Personverntekst</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600 mb-4">
            Gjeldende versjon: {config?.privacy_version || 1}
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Norsk
              </label>
              <textarea
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
                rows={4}
                value={formData.privacy_text_no}
                onChange={(e) => setFormData(prev => ({ ...prev, privacy_text_no: e.target.value }))}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                English
              </label>
              <textarea
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
                rows={4}
                value={formData.privacy_text_en}
                onChange={(e) => setFormData(prev => ({ ...prev, privacy_text_en: e.target.value }))}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Utseende</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Bakgrunnsfarge (hex)
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={formData.background_color}
                  onChange={(e) => setFormData(prev => ({ ...prev, background_color: e.target.value }))}
                  className="w-12 h-10 rounded border border-gray-300 cursor-pointer"
                />
                <Input
                  value={formData.background_color}
                  onChange={(e) => setFormData(prev => ({ ...prev, background_color: e.target.value }))}
                  placeholder="#581c87"
                  className="w-32"
                />
                <div 
                  className="w-20 h-10 rounded border"
                  style={{ backgroundColor: formData.background_color }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">Standard: #581c87 (lilla)</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Logo
              </label>
              {formData.logo_url ? (
                <div className="space-y-3">
                  <div 
                    className="p-4 rounded-lg inline-block"
                    style={{ backgroundColor: formData.background_color }}
                  >
                    <img 
                      src={formData.logo_url} 
                      alt="Logo" 
                      className="max-h-24 max-w-xs object-contain"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      variant="secondary" 
                      onClick={() => fileInputRef.current?.click()}
                    >
                      Bytt logo
                    </Button>
                    <Button 
                      variant="secondary" 
                      onClick={handleDeleteLogo}
                      className="text-red-600 hover:text-red-700"
                    >
                      Slett logo
                    </Button>
                  </div>
                </div>
              ) : (
                <div>
                  <Button 
                    variant="secondary" 
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingLogo}
                  >
                    {uploadingLogo ? 'Laster opp...' : 'Last opp logo'}
                  </Button>
                  <p className="text-xs text-gray-500 mt-1">Anbefalt: PNG eller SVG med transparent bakgrunn</p>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleLogoUpload}
                className="hidden"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Kiosk-innstillinger</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Checkbox
              label="Automatisk låsing ved inaktivitet"
              checked={formData.auto_lock_enabled}
              onChange={(e) => setFormData(prev => ({ ...prev, auto_lock_enabled: e.target.checked }))}
            />

            {formData.auto_lock_enabled && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Minutter før automatisk låsing
                </label>
                <input
                  type="number"
                  min={1}
                  max={30}
                  className="w-24 px-3 py-2 border border-gray-300 rounded-lg"
                  value={formData.auto_lock_minutes}
                  onChange={(e) => setFormData(prev => ({ ...prev, auto_lock_minutes: parseInt(e.target.value) || 5 }))}
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} loading={saving}>
          Lagre innstillinger
        </Button>
      </div>
    </div>
  )
}
