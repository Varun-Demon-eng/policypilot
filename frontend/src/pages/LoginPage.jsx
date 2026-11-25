import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const C = {
  primary: '#1E3A8A',
  accent:  '#0D9488',
  bg:      '#F8FAFC',
  card:    '#FFFFFF',
  text:    '#0F172A',
  muted:   '#64748B',
}

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const user = await login(email, password)
      if (user.role === 'admin') {
        navigate('/admin', { replace: true })
      } else {
        navigate('/chat', { replace: true })
      }
    } catch (err) {
      const msg = err?.response?.data?.detail || 'Invalid email or password. Please try again.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: C.bg }}>
      <div className="w-full max-w-md">
        <div className="rounded-2xl shadow-xl overflow-hidden"
          style={{ backgroundColor: C.card, border: `1px solid #E2E8F0` }}>

          {/* Header */}
          <div className="px-8 py-8 text-center" style={{ backgroundColor: C.primary }}>
            <div className="inline-flex items-center justify-center w-14 h-14 bg-white/15 rounded-2xl mb-4">
              <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">PolicyPilot</h1>
            <p className="text-white/70 text-sm mt-1">Sign in to your account</p>
          </div>

          {/* Form */}
          <div className="px-8 py-8">
            {error && (
              <div className="mb-4 flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                <svg className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: C.text }}>
                  Email address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  placeholder="you@company.com"
                  className="w-full px-4 py-2.5 rounded-lg text-sm focus:outline-none transition-shadow"
                  style={{ border: `1.5px solid #CBD5E1`, color: C.text, backgroundColor: C.bg }}
                  onFocus={e => { e.target.style.borderColor = C.primary; e.target.style.boxShadow = `0 0 0 3px ${C.primary}18` }}
                  onBlur={e => { e.target.style.borderColor = '#CBD5E1'; e.target.style.boxShadow = 'none' }}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: C.text }}>
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="w-full px-4 py-2.5 rounded-lg text-sm focus:outline-none transition-shadow"
                  style={{ border: `1.5px solid #CBD5E1`, color: C.text, backgroundColor: C.bg }}
                  onFocus={e => { e.target.style.borderColor = C.primary; e.target.style.boxShadow = `0 0 0 3px ${C.primary}18` }}
                  onBlur={e => { e.target.style.borderColor = '#CBD5E1'; e.target.style.boxShadow = 'none' }}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 text-white font-semibold rounded-lg text-sm transition-opacity focus:outline-none disabled:opacity-60"
                style={{ backgroundColor: C.primary }}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    Signing in...
                  </span>
                ) : (
                  'Sign in'
                )}
              </button>
            </form>

            <p className="mt-6 text-center text-xs" style={{ color: C.muted }}>
              Contact your HR administrator for account access.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
