import React, { useState, useEffect } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import {
  Flame,
  Mail,
  Lock,
  User as UserIcon,
  AlertCircle,
  CheckCircle2,
  Loader2,
  ShieldCheck,
  ArrowRight,
  KeyRound,
} from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { useAuth } from './useAuth'
import { supabase } from '@/lib/supabase'

export type AuthMode = 'login' | 'signup' | 'forgot' | 'update-password'

interface AuthPageProps {
  defaultMode?: AuthMode
}

export const AuthPage: React.FC<AuthPageProps> = ({ defaultMode = 'login' }) => {
  const [mode, setMode] = useState<AuthMode>(() => {
    if (
      typeof window !== 'undefined' &&
      (window.location.hash.includes('type=recovery') ||
        window.location.search.includes('type=recovery') ||
        window.location.pathname.includes('update-password'))
    ) {
      return 'update-password'
    }
    return defaultMode
  })
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [displayName, setDisplayName] = useState('')

  // Validation & feedback state
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [generalError, setGeneralError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [signupSuccessEmail, setSignupSuccessEmail] = useState<string | null>(null)
  const [forgotSuccess, setForgotSuccess] = useState(false)
  const [updateSuccess, setUpdateSuccess] = useState(false)

  const { signIn, signUp, isAuthenticated, isLoading: isAuthLoading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  // Track the route location state to redirect back after login
  const fromLocation = (location.state as { from?: { pathname?: string; search?: string } })?.from
  const redirectPath = fromLocation?.pathname ? `${fromLocation.pathname}${fromLocation.search || ''}` : '/'

  // Redirect if already authenticated, unless the user is actively updating password
  useEffect(() => {
    if (!isAuthLoading && isAuthenticated && mode !== 'update-password') {
      navigate(redirectPath, { replace: true })
    }
  }, [isAuthenticated, isAuthLoading, navigate, redirectPath, mode])

  // Subscribe to auth state changes for password recovery events
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setMode('update-password')
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const validate = (): boolean => {
    const errs: Record<string, string> = {}
    setGeneralError(null)

    const trimmedEmail = email.trim()
    if (!trimmedEmail) {
      errs.email = 'Email address is required'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      errs.email = 'Please enter a valid email address'
    }

    if (!password) {
      errs.password = 'Password is required'
    } else if (password.length < 6) {
      errs.password = 'Password must be at least 6 characters'
    }

    if (mode === 'signup') {
      if (!displayName.trim()) {
        errs.displayName = 'Athlete name is required'
      }
      if (password !== confirmPassword) {
        errs.confirmPassword = 'Passwords do not match'
      }
    }

    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    setIsSubmitting(true)
    setGeneralError(null)

    try {
      if (mode === 'login') {
        const { error } = await signIn(email.trim(), password)
        if (error) {
          setGeneralError(error.message || 'Failed to sign in. Please check your credentials.')
        } else {
          navigate(redirectPath, { replace: true })
        }
      } else {
        const { data, error } = await signUp(email.trim(), password, displayName.trim())
        if (error) {
          setGeneralError(error.message || 'Failed to create account. Please try again.')
        } else if (data?.needsEmailConfirmation) {
          setSignupSuccessEmail(email.trim())
        } else {
          // Auto-signed in
          navigate(redirectPath, { replace: true })
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred.'
      setGeneralError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setGeneralError(null)
    setErrors({})

    const trimmedEmail = email.trim()
    if (!trimmedEmail) {
      setErrors({ email: 'Email address is required' })
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setErrors({ email: 'Please enter a valid email address' })
      return
    }

    setIsSubmitting(true)
    try {
      const baseUrl = import.meta.env.BASE_URL.endsWith('/')
        ? import.meta.env.BASE_URL
        : `${import.meta.env.BASE_URL}/`
      const redirectTo = `${window.location.origin}${baseUrl}update-password`

      const { error } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
        redirectTo,
      })

      if (error) {
        const msg = error.message.toLowerCase()
        if (msg.includes('rate') || msg.includes('limit')) {
          setGeneralError('Too many requests. Please wait a few moments before trying again.')
          return
        }
        // Do not reveal whether account exists to protect user privacy
        console.warn('[FORM Auth] Password recovery request processed:', error.message)
      }

      setForgotSuccess(true)
    } catch (err: unknown) {
      console.warn('[FORM Auth] Password recovery request caught exception:', err)
      setForgotSuccess(true)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setGeneralError(null)
    setErrors({})

    const errs: Record<string, string> = {}
    if (!password) {
      errs.password = 'New password is required'
    } else if (password.length < 6) {
      errs.password = 'Password must be at least 6 characters'
    }
    if (password !== confirmPassword) {
      errs.confirmPassword = 'Passwords do not match'
    }

    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      return
    }

    setIsSubmitting(true)
    try {
      const { error } = await supabase.auth.updateUser({
        password: password,
      })

      if (error) {
        setGeneralError(error.message || 'Failed to update password. Please try again.')
      } else {
        setUpdateSuccess(true)
      }
    } catch (err: unknown) {
      setGeneralError(err instanceof Error ? err.message : 'An unexpected error occurred.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const switchMode = (newMode: AuthMode) => {
    setMode(newMode)
    setGeneralError(null)
    setErrors({})
    setSignupSuccessEmail(null)
    setForgotSuccess(false)
    setUpdateSuccess(false)
    setPassword('')
    setConfirmPassword('')
    if (newMode === 'login') {
      navigate('/login', { replace: true, state: location.state })
    } else if (newMode === 'signup') {
      navigate('/signup', { replace: true, state: location.state })
    } else if (newMode === 'update-password') {
      navigate('/update-password', { replace: true, state: location.state })
    }
  }

  return (
    <div className="min-h-screen flex flex-col justify-between bg-[var(--color-bg)] text-[var(--color-text-primary)] transition-colors">
      {/* Top Header Bar */}
      <header className="w-full max-w-7xl mx-auto px-6 py-6 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="w-9 h-9 rounded-xl bg-[var(--color-accent)] flex items-center justify-center text-white font-bold text-base shadow-sm group-hover:scale-105 transition-transform">
            <Flame className="w-5 h-5 fill-current" />
          </div>
          <div>
            <span className="font-extrabold tracking-wider text-lg text-[var(--color-text-primary)] block">
              FORM
            </span>
            <span className="block text-[9px] uppercase tracking-widest text-[var(--color-text-muted)] font-semibold -mt-1">
              Precision Athletics
            </span>
          </div>
        </Link>

        <div className="flex items-center gap-2">
          <ThemeToggle />
        </div>
      </header>

      {/* Main Form Center */}
      <main className="w-full max-w-md mx-auto px-6 py-8 flex-1 flex flex-col justify-center">
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl shadow-xl shadow-black/5 dark:shadow-black/40 p-6 sm:p-8 backdrop-blur-md">
          {/* Header Description */}
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold tracking-tight text-[var(--color-text-primary)]">
              {mode === 'login' && 'Athlete Access'}
              {mode === 'signup' && 'Create Athlete Profile'}
              {mode === 'forgot' && 'Reset Password'}
              {mode === 'update-password' && 'Create New Password'}
            </h1>
            <p className="text-xs sm:text-sm text-[var(--color-text-secondary)] mt-1.5">
              {mode === 'login' && 'Sign in to access your workouts, nutrition, and metrics.'}
              {mode === 'signup' && 'Join FORM to begin your precision fitness & nutrition protocol.'}
              {mode === 'forgot' && 'Enter your email to receive a secure recovery link.'}
              {mode === 'update-password' && 'Enter and confirm your new password below.'}
            </p>
          </div>

          {/* Mode Switcher Tabs (Login / Signup) */}
          {(mode === 'login' || mode === 'signup') && (
            <div className="grid grid-cols-2 p-1 bg-[var(--color-surface-hover)] rounded-xl mb-6 border border-[var(--color-border)]">
              <button
                type="button"
                onClick={() => switchMode('login')}
                className={`py-2 text-xs font-semibold rounded-lg transition-all ${
                  mode === 'login'
                    ? 'bg-[var(--color-surface)] text-[var(--color-text-primary)] shadow-xs'
                    : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => switchMode('signup')}
                className={`py-2 text-xs font-semibold rounded-lg transition-all ${
                  mode === 'signup'
                    ? 'bg-[var(--color-surface)] text-[var(--color-text-primary)] shadow-xs'
                    : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                }`}
              >
                Sign Up
              </button>
            </div>
          )}

          {/* Email Confirmation Notice (if required after signup) */}
          {signupSuccessEmail ? (
            <div className="space-y-5 py-3 text-center">
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-[var(--color-accent)] flex items-center justify-center mx-auto border border-emerald-500/20">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div className="space-y-2">
                <h2 className="text-base font-bold text-[var(--color-text-primary)]">
                  Verification Email Sent
                </h2>
                <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                  We've dispatched a confirmation link to{' '}
                  <span className="font-semibold text-[var(--color-text-primary)]">{signupSuccessEmail}</span>.
                  Please confirm your email address to activate your FORM profile.
                </p>
              </div>
              <Button
                variant="primary"
                className="w-full"
                onClick={() => switchMode('login')}
              >
                Return to Sign In
              </Button>
            </div>
          ) : mode === 'forgot' ? (
            /* Forgot Password Flow */
            forgotSuccess ? (
              <div className="space-y-5 py-3 text-center">
                <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-[var(--color-accent)] flex items-center justify-center mx-auto border border-emerald-500/20">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-base font-bold text-[var(--color-text-primary)]">
                    Password Reset Link Sent
                  </h2>
                  <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                    If an athlete account exists for{' '}
                    <span className="font-semibold text-[var(--color-text-primary)]">{email.trim()}</span>,
                    we have dispatched a secure recovery link. Please check your inbox and spam folder.
                  </p>
                </div>
                <Button
                  variant="primary"
                  className="w-full"
                  onClick={() => switchMode('login')}
                >
                  Return to Sign In
                </Button>
              </div>
            ) : (
              <form onSubmit={handleForgotPassword} className="space-y-4">
                {generalError && (
                  <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs flex items-start gap-2.5 animate-in fade-in">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <div className="flex-1 font-medium leading-relaxed">{generalError}</div>
                  </div>
                )}

                <Input
                  id="forgotEmail"
                  type="email"
                  label="Account Email Address"
                  placeholder="athlete@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  leftIcon={<Mail className="w-4 h-4" />}
                  error={errors.email}
                  disabled={isSubmitting}
                  autoComplete="email"
                />

                <div className="pt-2">
                  <Button
                    type="submit"
                    variant="primary"
                    className="w-full font-semibold shadow-md py-2.5"
                    disabled={isSubmitting}
                    icon={
                      isSubmitting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <ArrowRight className="w-4 h-4" />
                      )
                    }
                  >
                    {isSubmitting ? 'Sending Link...' : 'Send Reset Link'}
                  </Button>
                </div>

                <div className="text-center pt-2">
                  <p className="text-xs text-[var(--color-text-muted)]">
                    Remember your password?{' '}
                    <button
                      type="button"
                      onClick={() => switchMode('login')}
                      className="text-[var(--color-accent)] font-semibold hover:underline cursor-pointer"
                    >
                      Return to Sign In
                    </button>
                  </p>
                </div>
              </form>
            )
          ) : mode === 'update-password' ? (
            /* Update Password Flow */
            updateSuccess ? (
              <div className="space-y-5 py-3 text-center">
                <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-[var(--color-accent)] flex items-center justify-center mx-auto border border-emerald-500/20">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-base font-bold text-[var(--color-text-primary)]">
                    Password Updated Successfully
                  </h2>
                  <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                    Your new credentials are now active. You may proceed directly to your FORM dashboard.
                  </p>
                </div>
                <Button
                  variant="primary"
                  className="w-full"
                  onClick={() => navigate('/', { replace: true })}
                >
                  Continue to Dashboard
                </Button>
              </div>
            ) : (
              <form onSubmit={handleUpdatePassword} className="space-y-4">
                {generalError && (
                  <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs flex items-start gap-2.5 animate-in fade-in">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <div className="flex-1 font-medium leading-relaxed">{generalError}</div>
                  </div>
                )}

                <Input
                  id="newPassword"
                  type="password"
                  label="New Password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  leftIcon={<Lock className="w-4 h-4" />}
                  showPasswordToggle
                  error={errors.password}
                  helperText="Minimum 6 characters"
                  disabled={isSubmitting}
                  autoComplete="new-password"
                />

                <Input
                  id="confirmNewPassword"
                  type="password"
                  label="Confirm New Password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  leftIcon={<Lock className="w-4 h-4" />}
                  showPasswordToggle
                  error={errors.confirmPassword}
                  disabled={isSubmitting}
                  autoComplete="new-password"
                />

                <div className="pt-2">
                  <Button
                    type="submit"
                    variant="primary"
                    className="w-full font-semibold shadow-md py-2.5"
                    disabled={isSubmitting}
                    icon={
                      isSubmitting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <KeyRound className="w-4 h-4" />
                      )
                    }
                  >
                    {isSubmitting ? 'Updating Password...' : 'Save New Password'}
                  </Button>
                </div>

                <div className="text-center pt-2">
                  <button
                    type="button"
                    onClick={() => switchMode('login')}
                    className="text-xs text-[var(--color-accent)] font-semibold hover:underline cursor-pointer"
                  >
                    Return to Sign In
                  </button>
                </div>
              </form>
            )
          ) : (
            /* Login & Signup Form */
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* General Error Banner */}
              {generalError && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs flex items-start gap-2.5 animate-in fade-in">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div className="flex-1 font-medium leading-relaxed">{generalError}</div>
                </div>
              )}

              {/* Display Name (Sign Up only) */}
              {mode === 'signup' && (
                <Input
                  id="displayName"
                  label="Athlete Name"
                  placeholder="e.g. Alex Sterling"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  leftIcon={<UserIcon className="w-4 h-4" />}
                  error={errors.displayName}
                  disabled={isSubmitting}
                  autoComplete="name"
                />
              )}

              {/* Email Address */}
              <Input
                id="email"
                type="email"
                label="Email Address"
                placeholder="athlete@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                leftIcon={<Mail className="w-4 h-4" />}
                error={errors.email}
                disabled={isSubmitting}
                autoComplete="email"
              />

              {/* Password */}
              <div className="space-y-1">
                <Input
                  id="password"
                  type="password"
                  label="Password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  leftIcon={<Lock className="w-4 h-4" />}
                  showPasswordToggle
                  error={errors.password}
                  helperText={mode === 'signup' ? 'Minimum 6 characters' : undefined}
                  disabled={isSubmitting}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                />
                {mode === 'login' && (
                  <div className="flex justify-end pt-1">
                    <button
                      type="button"
                      onClick={() => switchMode('forgot')}
                      className="text-xs text-[var(--color-accent)] hover:underline font-semibold cursor-pointer"
                    >
                      Forgot password?
                    </button>
                  </div>
                )}
              </div>

              {/* Confirm Password (Sign Up only) */}
              {mode === 'signup' && (
                <Input
                  id="confirmPassword"
                  type="password"
                  label="Confirm Password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  leftIcon={<Lock className="w-4 h-4" />}
                  showPasswordToggle
                  error={errors.confirmPassword}
                  disabled={isSubmitting}
                  autoComplete="new-password"
                />
              )}

              {/* Submit Button */}
              <div className="pt-2">
                <Button
                  type="submit"
                  variant="primary"
                  className="w-full font-semibold shadow-md py-2.5"
                  disabled={isSubmitting}
                  icon={
                    isSubmitting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <ArrowRight className="w-4 h-4" />
                    )
                  }
                >
                  {isSubmitting
                    ? mode === 'login'
                      ? 'Authenticating...'
                      : 'Creating Profile...'
                    : mode === 'login'
                    ? 'Sign In to Dashboard'
                    : 'Create Account'}
                </Button>
              </div>

              {/* Mode Toggle Footer */}
              <div className="text-center pt-2">
                <p className="text-xs text-[var(--color-text-muted)]">
                  {mode === 'login' ? (
                    <>
                      Don't have an athlete account?{' '}
                      <button
                        type="button"
                        onClick={() => switchMode('signup')}
                        className="text-[var(--color-accent)] font-semibold hover:underline cursor-pointer"
                      >
                        Create one
                      </button>
                    </>
                  ) : (
                    <>
                      Already have an account?{' '}
                      <button
                        type="button"
                        onClick={() => switchMode('login')}
                        className="text-[var(--color-accent)] font-semibold hover:underline cursor-pointer"
                      >
                        Sign in
                      </button>
                    </>
                  )}
                </p>
              </div>
            </form>
          )}
        </div>

        {/* Security / Privacy Badge */}
        <div className="flex items-center justify-center gap-1.5 mt-6 text-[11px] text-[var(--color-text-muted)]">
          <ShieldCheck className="w-3.5 h-3.5 text-[var(--color-accent)]" />
          <span>Encrypted Supabase Auth & Row Level Security</span>
        </div>
      </main>

      {/* Subtle Footer */}
      <footer className="w-full py-4 text-center text-[11px] text-[var(--color-text-muted)]">
        &copy; {new Date().getFullYear()} FORM Precision Athletics. All rights reserved.
      </footer>
    </div>
  )
}

export const LoginPage: React.FC = () => <AuthPage defaultMode="login" />
export const SignUpPage: React.FC = () => <AuthPage defaultMode="signup" />
export const ForgotPasswordPage: React.FC = () => <AuthPage defaultMode="forgot" />
export const UpdatePasswordPage: React.FC = () => <AuthPage defaultMode="update-password" />
