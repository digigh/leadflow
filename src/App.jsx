import { useState, useEffect } from 'react'
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import Dashboard from './pages/Dashboard'
import InactivityGuard from './components/InactivityGuard'

const SESSION_KEY = 'lf_session'
const INACTIVITY_MS = 10 * 60 * 1000 // 10 minutes

export default function App() {
  // Restore session from sessionStorage on mount
  const [page, setPage] = useState(() => {
    return sessionStorage.getItem(SESSION_KEY) === 'authed' ? 'dashboard' : 'home'
  })
  const [authed, setAuthed] = useState(() => {
    return sessionStorage.getItem(SESSION_KEY) === 'authed'
  })

  const handleLogin = () => {
    sessionStorage.setItem(SESSION_KEY, 'authed')
    setAuthed(true)
    setPage('dashboard')
  }

  const handleLogout = (reason) => {
    sessionStorage.removeItem(SESSION_KEY)
    setAuthed(false)
    setPage(reason === 'inactivity' ? 'login' : 'home')
  }

  if (page === 'home') return <HomePage onNavigate={setPage} />
  if (page === 'login') return <LoginPage onLogin={handleLogin} onNavigate={setPage} />
  if (page === 'dashboard' && authed) return (
    <InactivityGuard timeoutMs={INACTIVITY_MS} onLogout={() => handleLogout('inactivity')}>
      <Dashboard onLogout={() => handleLogout('manual')} />
    </InactivityGuard>
  )

  // Fallback
  return <LoginPage onLogin={handleLogin} onNavigate={setPage} />
}
