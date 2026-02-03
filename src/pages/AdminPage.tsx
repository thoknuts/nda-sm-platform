import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Button } from '../components/ui/Button'
import { AdminEvents } from '../components/admin/AdminEvents'
import { AdminGuestlist } from '../components/admin/AdminGuestlist'
import { AdminCrew } from '../components/admin/AdminCrew'
import { AdminSignatures } from '../components/admin/AdminSignatures'
import { AdminSettings } from '../components/admin/AdminSettings'
import { AdminUsers } from '../components/admin/AdminUsers'
import { AdminArchive } from '../components/admin/AdminArchive'
import { AdminStatistics } from '../components/admin/AdminStatistics'

type Tab = 'events' | 'guestlist' | 'crew' | 'users' | 'signatures' | 'statistics' | 'archive' | 'settings'

export function AdminPage() {
  const [activeTab, setActiveTab] = useState<Tab>('events')
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()

  if (profile?.role !== 'admin') {
    return (
      <div className="min-h-screen bg-primary flex items-center justify-center">
        <div className="text-white text-xl">Ingen tilgang</div>
      </div>
    )
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'events', label: 'Eventer' },
    { id: 'guestlist', label: 'Gjestelister' },
    { id: 'crew', label: 'Crew' },
    { id: 'users', label: 'Brukere' },
    { id: 'signatures', label: 'Signeringer' },
    { id: 'statistics', label: 'Statistikk' },
    { id: 'archive', label: 'Arkiv' },
    { id: 'settings', label: 'Innstillinger' },
  ]

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-primary text-white p-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">SM NDA Sign - Admin</h1>
            <p className="text-white/80">Logget inn som {profile?.sm_username}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => navigate('/kiosk')}>
              Kiosk
            </Button>
            <Button variant="secondary" onClick={() => navigate('/crew/attest')}>
              Attestering
            </Button>
            <Button variant="ghost" className="text-white" onClick={signOut}>
              Logg ut
            </Button>
          </div>
        </div>
      </header>

      <nav className="bg-white border-b">
        <div className="max-w-7xl mx-auto">
          <div className="flex gap-1 p-2">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'bg-primary text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto p-4">
        {activeTab === 'events' && <AdminEvents />}
        {activeTab === 'guestlist' && <AdminGuestlist />}
        {activeTab === 'crew' && <AdminCrew />}
        {activeTab === 'users' && <AdminUsers />}
        {activeTab === 'signatures' && <AdminSignatures />}
        {activeTab === 'statistics' && <AdminStatistics />}
        {activeTab === 'archive' && <AdminArchive />}
        {activeTab === 'settings' && <AdminSettings />}
      </main>
    </div>
  )
}
