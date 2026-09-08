'use client'

/**
 * app/admin/page.tsx — Admin Login Page
 *
 * Part 2.8 update:
 *  - Added two-factor authentication step — after email+password verification,
 *    if 2FA is enabled for the admin, a 6-digit code input appears.
 *
 * Part 2.9 update:
 *  - Added recovery code input option during 2FA step
 *  - Recovery codes can be entered instead of TOTP code
 *  - Format validation for recovery codes (XXXX-XXXX-XX)
 *
 * Mobile fix (Part E):
 *  - Changed min-h-screen to admin-viewport-height for dynamic viewport support
 *  - Added safe-area padding for mobile
 *  - Improved responsive spacing for mobile
 */

import { useSearchParams, useRouter } from 'next/navigation'
import { useState, useRef, useEffect, type FormEvent, Suspense } from 'react'
import { Eye, EyeOff, Loader2, ShieldCheck, AlertTriangle, Palette, Smartphone, KeyRound } from 'lucide-react'
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
  
  // Part 2.9 — Recovery code mode toggle
  const [useRecoveryMode, setUseRecoveryMode] = useState(false)

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
    if (useRecoveryMode) {
      // Part 2.9 — Recovery code format: XXXX-XXXX-XX
      if (!twoFactorCode || !/^[A-Za-z0-9]{4}-[A-Za-z0-9]{4}-[A-Za-z0-9]{2}$/.test(twoFactorCode)) {
        setTwoFactorError('Enter a valid recovery code (format: XXXX-XXXX-XX).')
        return false
      }
    } else {
      // TOTP code format: 6 digits
      if (!twoFactorCode || !/^\d{6}$/.test(twoFactorCode)) {
        setTwoFactorError('Enter the 6-digit code from your authenticator app.')
        return false
      }
    }
    return true
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setTwoFactorError(null)

    if (twoFactorStep) {
      // Step 2: Verify 2FA code or recovery code
      if (!validateTwoFactor()) return
      setLoading(true)
      try {
        const res = await fetch('/api/admin/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email.trim(), password, twoFactorCode: twoFactorCode.trim() }),
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
        setUseRecoveryMode(false)
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
    setUseRecoveryMode(false)
  }

  function handleToggleMode() {
    setUseRecoveryMode(v => !v)
    setTwoFactorCode('')
    setTwoFactorError(null)
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
    <div data-theme={theme} className="admin-viewport-height bg-background text-foreground overflow-y-auto">
      <div className="relative flex min-h-full items-center justify-center px-4 py-8 sm:py-16 overflow-hidden">

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
        <div className="absolute top-3 right-3 sm:top-4 sm:right-4 z-20">
          <div className="relative">
            <button
              onClick={() => setShowThemePicker(v => !v)}
              className="flex items-center gap-2 rounded-xl border px-2.5 sm:px-3 py-2 text-xs font-medium transition-all duration-200"
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
          className="relative z-10 w-full max-w-md rounded-2xl border p-5 sm:p-8 shadow-2xl"
          style={{
            background: 'color-mix(in oklch, var(--card) 95%, transparent)',
            borderColor: 'var(--border)',
            backdropFilter: 'blur(12px)',
          }}
        >
          {/* Header */}
          <div className="mb-6 sm:mb-8 flex flex-col items-center gap-3 text-center">
            <div
              className="flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-2xl overflow-hidden"
              style={{ background: 'color-mix(in oklch, var(--primary) 15%, transparent)' }}
            >
              {twoFactorStep ? (
                useRecoveryMode ? (
                  <KeyRound className="h-6 w-6 sm:h-7 sm:w-7" style={{ color: 'var(--primary)' }} />
                ) : (
                  <Smartphone className="h-6 w-6 sm:h-7 sm:w-7" style={{ color: 'var(--primary)' }} />
                )
              ) : (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src="/icon.ico" alt="Logo" className="h-8 w-8 sm:h-9 sm:w-9 object-contain" />
              )}
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-semibold tracking-tight">
                {twoFactorStep ? (
                  useRecoveryMode ? 'Recovery Code' : 'Two-Factor Authentication'
                ) : 'Admin Access'}
              </h1>
              <p className="mt-1 text-xs sm:text-sm" style={{ color: 'var(--muted-foreground)' }}>
                {twoFactorStep
                  ? useRecoveryMode
                    ? 'Enter a recovery code to sign in'
                    : 'Enter the 6-digit code from your authenticator app'
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
          <form onSubmit={handleSubmit} noValidate className="space-y-4 sm:space-y-5">
            {twoFactorStep ? (
              /* ─── Step 2: 2FA code or recovery code input ─── */
              <div className="space-y-4 sm:space-y-5">
                <div className="space-y-1.5">
                  <label htmlFor="admin-2fa-code" className="block text-sm font-medium">
                    {useRecoveryMode ? 'Recovery code' : 'Authentication code'}
                  </label>
                  <input
                    id="admin-2fa-code"
                    type="text"
                    inputMode={useRecoveryMode ? 'text' : 'numeric'}
                    autoComplete={useRecoveryMode ? 'off' : 'one-time-code'}
                    autoFocus
                    maxLength={useRecoveryMode ? 12 : 6}
                    value={twoFactorCode}
                    onChange={e => {
                      if (useRecoveryMode) {
                        // Allow recovery code format: XXXX-XXXX-XX
                        const value = e.target.value.toUpperCase()
                        const cleaned = value.replace(/[^A-Z0-9]/g, '')
                        let formatted = cleaned
                        if (cleaned.length > 4) formatted = `${cleaned.slice(0, 4)}-${cleaned.slice(4)}`
                        if (cleaned.length > 8) formatted = `${cleaned.slice(0, 4)}-${cleaned.slice(4, 8)}-${cleaned.slice(8, 10)}`
                        setTwoFactorCode(formatted)
                      } else {
                        setTwoFactorCode(e.target.value.replace(/\D/g, ''))
                      }
                      setTwoFactorError(null)
                    }}
                    placeholder={useRecoveryMode ? 'XXXX-XXXX-XX' : '000000'}
                    className="w-full text-center font-mono"
                    style={{
                      ...inputStyle,
                      fontSize: useRecoveryMode ? '1rem' : '1.5rem',
                      letterSpacing: useRecoveryMode ? '0.15em' : '0.5em',
                      textAlign: 'center',
                    }}
                    aria-invalid={!!twoFactorError}
                    disabled={loading}
                  />
                  <p className="text-xs text-center" style={{ color: 'var(--muted-foreground)' }}>
                    {useRecoveryMode
                      ? <>Enter a recovery code for <strong>{email.trim()}</strong>. Each code can only be used once.</>
                      : <>Open your authenticator app and enter the 6-digit code for <strong>{email.trim()}</strong></>
                    }
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={loading || twoFactorCode.length === 0}
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

                {/* Part 2.9 — Toggle between TOTP and recovery code */}
                <button
                  type="button"
                  onClick={handleToggleMode}
                  disabled={loading}
                  className="w-full text-center text-sm font-medium transition-colors"
                  style={{ color: 'var(--muted-foreground)' }}
                >
                  {useRecoveryMode
                    ? '← Use authenticator app instead'
                    : 'Lost access to your authenticator? Use a recovery code'}
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

          <p className="mt-5 sm:mt-6 text-center text-xs" style={{ color: 'var(--muted-foreground)' }}>
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