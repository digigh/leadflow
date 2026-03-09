import { useState } from 'react'
import { Mail, Shield, RefreshCw, AlertCircle, Target, ArrowRight } from 'lucide-react'

export default function LoginPage({ onLogin, onNavigate }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async () => {
    setError('')
    setLoading(true)
    await new Promise(r => setTimeout(r, 700))

    // Credentials defined in env or hardcoded defaults
    const validEmail = import.meta.env.VITE_ADMIN_EMAIL || 'admin@leadplatform.com'
    const validPassword = import.meta.env.VITE_ADMIN_PASSWORD || 'Password123'

    if (email === validEmail && password === validPassword) {
      onLogin()
    } else {
      setError('Invalid credentials. Please check and try again.')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-[#F6F8FB] flex items-center justify-center px-4" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');`}</style>

      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-3">
            <div className="w-10 h-10 rounded-xl bg-[#2F6BFF] flex items-center justify-center shadow-lg shadow-blue-500/30">
              <Target size={20} className="text-white" />
            </div>
            <span className="text-2xl font-black text-[#2F3542]">LeadFlow</span>
          </div>
          <h1 className="text-xl font-bold text-[#2F3542]">Welcome back</h1>
          <p className="text-[#6B778C] text-sm mt-1">Sign in to your account</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl border border-[#E6EBF2] shadow-sm p-8">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-lg mb-5 text-red-600 text-sm">
              <AlertCircle size={15} />{error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-[#2F3542] mb-2">Email</label>
              <div className="relative">
                <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9AA5B1]" />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="admin@leadplatform.com"
                  className="w-full pl-9 pr-4 py-2.5 border border-[#E6EBF2] rounded-lg text-sm text-[#2F3542] focus:outline-none focus:ring-2 focus:ring-[#2F6BFF]/20 focus:border-[#2F6BFF]"
                  onKeyDown={e => e.key === 'Enter' && handleLogin()}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-[#2F3542] mb-2">Password</label>
              <div className="relative">
                <Shield size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9AA5B1]" />
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-4 py-2.5 border border-[#E6EBF2] rounded-lg text-sm text-[#2F3542] focus:outline-none focus:ring-2 focus:ring-[#2F6BFF]/20 focus:border-[#2F6BFF]"
                  onKeyDown={e => e.key === 'Enter' && handleLogin()}
                />
              </div>
            </div>

            <button
              onClick={handleLogin}
              disabled={loading}
              className="w-full py-3 bg-[#2F6BFF] text-white font-bold rounded-lg hover:bg-[#1A4FCC] transition-colors disabled:opacity-60 flex items-center justify-center gap-2 mt-1"
            >
              {loading
                ? <><RefreshCw size={15} className="animate-spin" />Signing in...</>
                : <>Sign In <ArrowRight size={15} /></>
              }
            </button>
          </div>

          <div className="mt-5 p-4 bg-[#F6F8FB] rounded-lg">
            <p className="text-xs font-bold text-[#6B778C] mb-1.5">Demo Credentials</p>
            <p className="text-xs text-[#6B778C]">Email: <span className="font-mono text-[#2F6BFF]">admin@leadplatform.com</span></p>
            <p className="text-xs text-[#6B778C]">Password: <span className="font-mono text-[#2F6BFF]">Password123</span></p>
          </div>
        </div>

        <p className="text-center mt-4 text-sm">
          <button onClick={() => onNavigate('home')} className="text-[#2F6BFF] hover:underline font-medium">← Back to home</button>
        </p>
      </div>
    </div>
  )
}
