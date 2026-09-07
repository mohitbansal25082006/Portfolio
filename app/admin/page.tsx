'use client'

/**
 * app/admin/page.tsx — Admin Login Page
 *
 * Part 2.8 update:
 *  - Added two-factor authentication step — after email+password verification,
 *    if 2FA is enabled for the admin, a 6-digit code input appears.
 *
 * Earlier fixes retained:
 *  1. Input text now uses var(--foreground) + var(--muted-foreground) for
 *     placeholder — fully readable across every theme (not primary-foreground
 *     which is near-black on dark themes).
 *  2. Theme switcher integrated — reads from localStorage, applies data-theme
 *     on the wrapper div, and renders theme swatches in the footer.
 */

import { useSearchParams, useRouter } from 'next/navigation'
import { useState, useRef, useEffect, type FormEvent, Suspense } from 'react'
import { Eye, EyeOff, Loader2, ShieldCheck, AlertTriangle, Palette, Smartphone } from 'lucide-react'
import { themes } from '@/lib/content'

// ─── Theme switcher hook (localStorage-persisted) ─────────────────────────────

function useAdminTheme() {
  const [theme, setThemeState] = useState<string>('midnight')

  useEffect(() => {
    const saved = localStorage.getItem('admin-theme') ?? 'midnight'
    setThemeState(saved)
  }, [])

  const setTheme = (id: string) => {
    setThemeState(id)
    localStorage.setItem('admin-theme', id)
  }

  return { theme, setTheme }
}

// ─── Inner form ───────────────────────────────────────────────────────────────

function AdminLoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirect') ?? '/admin/dashboard'
  const { theme, setTheme } = useAdminTheme()

  const emailRef = useRef<HTMLInputElement>(null)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({})
  const [showThemePicker, setShowThemePicker] = useState(false)

  // Part 2.8 — Two-factor authentication state
  const [twoFactorStep, setTwoFactorStep] = useState(false)
  const [twoFactorCode, setTwoFactorCode] = useState('')
  const [twoFactorError, setTwoFactorError] = useState<string | null>(null)

  function validate(): boolean {
    const errs: typeof fieldErrors = {}
    if (!email.trim()) errs.email = 'Email is required.'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      errs.email = 'Enter a valid email address.'
    if (!password) errs.password = 'Password is required.'
    setFieldErrors(errs)
    return Object.keys(errs).length === 0
  }

  function validateTwoFactor(): boolean {
    if (!twoFactorCode || !/^\d{6}$/.test(twoFactorCode)) {
      setTwoFactorError('Enter the 6-digit code from your authenticator app.')
      return false
    }
    return true
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setTwoFactorError(null)

    if (twoFactorStep) {
      // Step 2: Verify 2FA code
      if (!validateTwoFactor()) return
      setLoading(true)
      try {
        const res = await fetch('/api/admin/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email.trim(), password, twoFactorCode }),
        })

        const data = await res.json()
        if (!res.ok) {
          setTwoFactorError(data?.error ?? 'Invalid code. Please try again.')
          setLoading(false)
          return
        }

        if (data.twoFactorRequired) {
          setTwoFactorError('Invalid code. Please try again.')
          setLoading(false)
          return
        }

        router.replace(redirectTo)
      } catch {
        setTwoFactorError('Network error. Please check your connection.')
        setLoading(false)
      }
      return
    }

    // Step 1: Verify email + password
    if (!validate()) return

    setLoading(true)
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data?.error ?? 'Login failed. Please try again.')
        setLoading(false)
        return
      }

      // Part 2.8 — Check if 2FA is required
      if (data.twoFactorRequired) {
        setTwoFactorStep(true)
        setLoading(false)
        // Focus the code input after render
        setTimeout(() => {
          const codeInput = document.getElementById('admin-2fa-code')
          if (codeInput) codeInput.focus()
        }, 100)
        return
      }

      router.replace(redirectTo)
    } catch {
      setError('Network error. Please check your connection.')
      setLoading(false)
    }
  }

  function handleBackToPassword() {
    setTwoFactorStep(false)
    setTwoFactorCode('')
    setTwoFactorError(null)
    setPassword('')
  }

  // Input style — uses foreground + muted vars (readable on all themes)
  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: 'color-mix(in oklch, var(--background) 60%, transparent)',
    border: '1px solid color-mix(in oklch, var(--foreground) 20%, transparent)',
    borderRadius: '0.75rem',
    padding: '0.85rem 1rem',
    fontSize: 16,
    color: 'var(--foreground)',
    outline: 'none',
    backdropFilter: 'blur(4px)',
    transition: 'all 250ms ease',
  }

  return (
    <div data-theme={theme} className="min-h-screen bg-background text-foreground">
      <div className="relative flex min-h-screen items-center justify-center px-4 py-16 overflow-hidden">

        {/* Aurora blobs */}
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="aurora aurora-1" style={{ opacity: 0.1 }} />
          <div className="aurora aurora-2" style={{ opacity: 0.08 }} />
        </div>

        {/* Grid texture */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: `
              linear-gradient(color-mix(in oklch, var(--primary) 6%, transparent) 1px, transparent 1px),
              linear-gradient(90deg, color-mix(in oklch, var(--primary) 6%, transparent) 1px, transparent 1px)
            `,
            backgroundSize: '48px 48px',
            maskImage: 'radial-gradient(ellipse at center, black 0%, transparent 70%)',
            WebkitMaskImage: 'radial-gradient(ellipse at center, black 0%, transparent 70%)',
          }}
        />

        {/* Theme picker button (top-right) */}
        <div className="absolute top-4 right-4 z-20">
          <div className="relative">
            <button
              onClick={() => setShowThemePicker(v => !v)}
              className="flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium transition-all duration-200"
              style={{
                background: 'color-mix(in oklch, var(--card) 90%, transparent)',
                borderColor: 'var(--border)',
                color: 'var(--muted-foreground)',
                backdropFilter: 'blur(8px)',
              }}
              aria-label="Change theme"
            >
              <Palette className="h-3.5 w-3.5" />
              <span className="hidden sm:inline capitalize">{theme}</span>
            </button>

            {showThemePicker && (
              <div
                className="absolute right-0 top-10 z-50 min-w-[140px] rounded-xl border p-2 shadow-2xl"
                style={{
                  background: 'var(--card)',
                  borderColor: 'var(--border)',
                  backdropFilter: 'blur(12px)',
                }}
              >
                {themes.map(t => (
                  <button
                    key={t.id}
                    onClick={() => { setTheme(t.id); setShowThemePicker(false) }}
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium transition-all duration-150"
                    style={{
                      background: t.id === theme ? 'color-mix(in oklch, var(--primary) 15%, transparent)' : 'transparent',
                      color: t.id === theme ? 'var(--primary)' : 'var(--muted-foreground)',
                    }}
                  >
                    <span
                      className="h-3 w-3 shrink-0 rounded-full border"
                      style={{
                        background: t.swatch,
                        borderColor: t.id === theme ? 'var(--primary)' : 'transparent',
                      }}
                    />
                    {t.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Login card */}
        <div
          className="relative z-10 w-full max-w-md rounded-2xl border p-8 shadow-2xl"
          style={{
            background: 'color-mix(in oklch, var(--card) 95%, transparent)',
            borderColor: 'var(--border)',
            backdropFilter: 'blur(12px)',
          }}
        >
          {/* Header */}
          <div className="mb-8 flex flex-col items-center gap-3 text-center">
            <div
              className="flex h-14 w-14 items-center justify-center rounded-2xl overflow-hidden"
              style={{ background: 'color-mix(in oklch, var(--primary) 15%, transparent)' }}
            >
              {twoFactorStep ? (
                <Smartphone className="h-7 w-7" style={{ color: 'var(--primary)' }} />
              ) : (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src="/icon.ico" alt="Logo" className="h-9 w-9 object-contain" />
              )}
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight">
                {twoFactorStep ? 'Two-Factor Authentication' : 'Admin Access'}
              </h1>
              <p className="mt-1 text-sm" style={{ color: 'var(--muted-foreground)' }}>
                {twoFactorStep
                  ? 'Enter the 6-digit code from your authenticator app'
                  : 'Sign in to manage your portfolio'}
              </p>
            </div>
          </div>

          {/* Error banner (step 1) */}
          {!twoFactorStep && error && (
            <div
              className="mb-5 flex items-start gap-3 rounded-xl border px-4 py-3 text-sm"
              style={{
                background: 'color-mix(in oklch, var(--destructive) 12%, transparent)',
                borderColor: 'color-mix(in oklch, var(--destructive) 30%, transparent)',
                color: 'var(--destructive)',
              }}
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Error banner (2FA step) */}
          {twoFactorStep && twoFactorError && (
            <div
              className="mb-5 flex items-start gap-3 rounded-xl border px-4 py-3 text-sm"
              style={{
                background: 'color-mix(in oklch, var(--destructive) 12%, transparent)',
                borderColor: 'color-mix(in oklch, var(--destructive) 30%, transparent)',
                color: 'var(--destructive)',
              }}
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{twoFactorError}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} noValidate className="space-y-5">
            {twoFactorStep ? (
              /* ─── Step 2: 2FA code input ─── */
              <div className="space-y-5">
                <div className="space-y-1.5">
                  <label htmlFor="admin-2fa-code" className="block text-sm font-medium">
                    Authentication code
                  </label>
                  <input
                    id="admin-2fa-code"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    autoFocus
                    maxLength={6}
                    value={twoFactorCode}
                    onChange={e => {
                      setTwoFactorCode(e.target.value.replace(/\D/g, ''))
                      setTwoFactorError(null)
                    }}
                    placeholder="000000"
                    className="w-full text-center text-2xl font-mono tracking-[0.5em]"
                    style={{
                      ...inputStyle,
                      letterSpacing: '0.5em',
                      textAlign: 'center',
                    }}
                    aria-invalid={!!twoFactorError}
                    disabled={loading}
                  />
                  <p className="text-xs text-center" style={{ color: 'var(--muted-foreground)' }}>
                    Open your authenticator app and enter the 6-digit code for <strong>{email.trim()}</strong>
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={loading || twoFactorCode.length !== 6}
                  className="mt-2 w-full overflow-hidden rounded-xl px-6 py-3 text-sm font-semibold transition-all duration-200 disabled:opacity-60"
                  style={{
                    background: 'var(--primary)',
                    color: 'var(--primary-foreground)',
                  }}
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Verifying…
                    </span>
                  ) : (
                    'Verify & Sign in'
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleBackToPassword}
                  disabled={loading}
                  className="w-full text-center text-sm font-medium transition-colors"
                  style={{ color: 'var(--muted-foreground)' }}
                >
                  ← Back to password
                </button>
              </div>
            ) : (
              /* ─── Step 1: Email + password ─── */
              <>
                {/* Email */}
                <div className="space-y-1.5">
                  <label htmlFor="admin-email" className="block text-sm font-medium">
                    Email address
                  </label>
                  <input
                    ref={emailRef}
                    id="admin-email"
                    type="email"
                    autoComplete="email"
                    autoFocus
                    value={email}
                    onChange={e => {
                      setEmail(e.target.value)
                      setFieldErrors(fe => ({ ...fe, email: undefined }))
                    }}
                    placeholder="admin@example.com"
                    style={{
                      ...inputStyle,
                      ...(fieldErrors.email
                        ? {
                            borderColor: 'var(--destructive)',
                            boxShadow: '0 0 0 3px color-mix(in oklch, var(--destructive) 15%, transparent)',
                          }
                        : {}),
                    }}
                    aria-invalid={!!fieldErrors.email}
                    disabled={loading}
                  />
                  {fieldErrors.email && (
                    <p className="text-xs" style={{ color: 'var(--destructive)' }}>
                      {fieldErrors.email}
                    </p>
                  )}
                </div>

                {/* Password */}
                <div className="space-y-1.5">
                  <label htmlFor="admin-password" className="block text-sm font-medium">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      id="admin-password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      value={password}
                      onChange={e => {
                        setPassword(e.target.value)
                        setFieldErrors(fe => ({ ...fe, password: undefined }))
                      }}
                      placeholder="••••••••"
                      style={{
                        ...inputStyle,
                        paddingRight: '3rem',
                        ...(fieldErrors.password
                          ? {
                              borderColor: 'var(--destructive)',
                              boxShadow: '0 0 0 3px color-mix(in oklch, var(--destructive) 15%, transparent)',
                            }
                          : {}),
                      }}
                      aria-invalid={!!fieldErrors.password}
                      disabled={loading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 transition-opacity hover:opacity-80"
                      style={{ color: 'var(--muted-foreground)' }}
                      tabIndex={-1}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {fieldErrors.password && (
                    <p className="text-xs" style={{ color: 'var(--destructive)' }}>
                      {fieldErrors.password}
                    </p>
                  )}
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={loading}
                  className="mt-2 w-full overflow-hidden rounded-xl px-6 py-3 text-sm font-semibold transition-all duration-200 disabled:opacity-60"
                  style={{
                    background: 'var(--primary)',
                    color: 'var(--primary-foreground)',
                  }}
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Signing in…
                    </span>
                  ) : (
                    'Sign in'
                  )}
                </button>
              </>
            )}
          </form>

          <p className="mt-6 text-center text-xs" style={{ color: 'var(--muted-foreground)' }}>
            Access is restricted to authorised administrators only.
          </p>
        </div>
      </div>
    </div>
  )
}

export default function AdminLoginPage() {
  return (
    <Suspense>
      <AdminLoginForm />
    </Suspense>
  )
}