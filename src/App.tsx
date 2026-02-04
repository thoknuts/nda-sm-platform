import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { KioskProvider } from './contexts/KioskContext'
import { DynamicFavicon } from './components/DynamicFavicon'
import { LoginPage } from './pages/LoginPage'
import { RegisterCrewPage } from './pages/RegisterCrewPage'
import { ResetPasswordPage } from './pages/ResetPasswordPage'
import { UpdatePasswordPage } from './pages/UpdatePasswordPage'
import { KioskSelectPage } from './pages/KioskSelectPage'
import { KioskGuestPage } from './pages/KioskGuestPage'
import { CrewAttestPage } from './pages/CrewAttestPage'
import { AdminPage } from './pages/AdminPage'
import { OrganizerPage } from './pages/OrganizerPage'
import type { ReactNode } from 'react'

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-primary flex items-center justify-center">
        <div className="text-white text-xl">Laster...</div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

function AdminRoute({ children }: { children: ReactNode }) {
  const { profile, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-primary flex items-center justify-center">
        <div className="text-white text-xl">Laster...</div>
      </div>
    )
  }

  if (profile?.role !== 'admin') {
    return <Navigate to="/kiosk" replace />
  }

  return <>{children}</>
}

function OrganizerRoute({ children }: { children: ReactNode }) {
  const { profile, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-primary flex items-center justify-center">
        <div className="text-white text-xl">Laster...</div>
      </div>
    )
  }

  if (profile?.role !== 'organizer') {
    return <Navigate to="/kiosk" replace />
  }

  return <>{children}</>
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <KioskProvider>
          <DynamicFavicon />
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register/crew" element={<RegisterCrewPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/update-password" element={<UpdatePasswordPage />} />
            
            <Route path="/kiosk" element={
              <ProtectedRoute>
                <KioskSelectPage />
              </ProtectedRoute>
            } />
            
            <Route path="/kiosk/:eventId" element={
              <ProtectedRoute>
                <KioskGuestPage />
              </ProtectedRoute>
            } />
            
            <Route path="/crew/attest" element={
              <ProtectedRoute>
                <CrewAttestPage />
              </ProtectedRoute>
            } />
            
            <Route path="/admin" element={
              <ProtectedRoute>
                <AdminRoute>
                  <AdminPage />
                </AdminRoute>
              </ProtectedRoute>
            } />
            
            <Route path="/organizer" element={
              <ProtectedRoute>
                <OrganizerRoute>
                  <OrganizerPage />
                </OrganizerRoute>
              </ProtectedRoute>
            } />
            
            <Route path="/" element={<Navigate to="/login" replace />} />
          </Routes>
        </KioskProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
