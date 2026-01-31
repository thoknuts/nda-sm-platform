import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card'
import { Button } from '../ui/Button'
import { Checkbox } from '../ui/Checkbox'

interface AppConfig {
  id: number
  privacy_text_no: string
  privacy_text_en: string
  privacy_version: number
  auto_lock_enabled: boolean
  auto_lock_minutes: number
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
  })

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
        privacy_version: (config?.privacy_version || 0) + 1,
      })
      .eq('id', 1)

    setSaving(false)
    fetchConfig()
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
