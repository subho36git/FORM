/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useEffect, useState, useCallback } from 'react'
import type { User, Session, AuthError } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { UserProfile } from '@/types'

export interface SignUpResult {
  user: User | null
  session: Session | null
  needsEmailConfirmation: boolean
}

export interface AuthContextType {
  user: User | null
  session: Session | null
  profile: UserProfile | null
  isAuthenticated: boolean
  isLoading: boolean
  signUp: (email: string, password: string, displayName?: string) => Promise<{ data: SignUpResult | null; error: AuthError | null }>
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>
  signOut: () => Promise<{ error: Error | null }>
  refreshProfile: () => Promise<void>
  updateProfile: (updates: Partial<UserProfile>) => Promise<{ error: Error | null }>
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(true)

  // Fetch the user's profile from public.profiles using their authenticated user ID
  const fetchProfile = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle()

      if (error) {
        console.error('[FORM Auth] Error fetching profile:', error.message)
        return null
      }

      if (data) {
        setProfile(data as UserProfile)
        return data as UserProfile
      }
      return null
    } catch (err) {
      console.error('[FORM Auth] Unexpected profile fetch error:', err)
      return null
    }
  }, [])

  // Initialize and listen to Supabase authentication state
  useEffect(() => {
    let isMounted = true

    // 1. Check active session on initial application load
    const initializeAuth = async () => {
      try {
        const { data: { session: initialSession }, error } = await supabase.auth.getSession()

        if (error) {
          console.error('[FORM Auth] Initial session error:', error.message)
        }

        if (isMounted) {
          setSession(initialSession)
          setUser(initialSession?.user ?? null)

          if (initialSession?.user) {
            await fetchProfile(initialSession.user.id)
          }
        }
      } catch (err) {
        console.error('[FORM Auth] Auth initialization failure:', err)
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    initializeAuth()

    // 2. Subscribe to auth state transitions (SIGN_IN, SIGN_OUT, TOKEN_REFRESHED)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        if (!isMounted) return

        setSession(currentSession)
        setUser(currentSession?.user ?? null)

        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
          if (currentSession?.user) {
            // Attempt to fetch profile; retry once after 500ms if initial trigger is still creating it
            const prof = await fetchProfile(currentSession.user.id)
            if (!prof) {
              setTimeout(() => {
                if (isMounted) fetchProfile(currentSession.user.id)
              }, 500)
            }
          }
        } else if (event === 'SIGNED_OUT') {
          setProfile(null)
        }

        setIsLoading(false)
      }
    )

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [fetchProfile])

  // Email and password sign-up
  const signUp = async (email: string, password: string, displayName?: string) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            display_name: displayName?.trim() || 'Athlete',
            full_name: displayName?.trim() || 'Athlete',
          },
        },
      })

      if (error) {
        return { data: null, error }
      }

      const needsEmailConfirmation = Boolean(data.user && !data.session)

      return {
        data: {
          user: data.user,
          session: data.session,
          needsEmailConfirmation,
        },
        error: null,
      }
    } catch (err) {
      return { data: null, error: err as AuthError }
    }
  }

  // Email and password sign-in
  const signIn = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        return { error }
      }

      if (data.user) {
        await fetchProfile(data.user.id)
      }

      return { error: null }
    } catch (err) {
      return { error: err as AuthError }
    }
  }

  // Sign out
  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut()
      setUser(null)
      setSession(null)
      setProfile(null)
      return { error }
    } catch (err) {
      return { error: err as Error }
    }
  }

  // Refresh profile data on demand (e.g. after editing profile)
  const refreshProfile = async () => {
    if (user?.id) {
      await fetchProfile(user.id)
    }
  }

  // Update profile data in public.profiles and refresh state
  const updateProfile = async (updates: Partial<UserProfile>) => {
    if (!user?.id) {
      return { error: new Error('User is not authenticated') }
    }

    try {
      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id)

      if (error) {
        console.error('[FORM Auth] Error updating profile:', error.message)
        return { error: new Error(error.message) }
      }

      // Optimistically merge updates into state for instantaneous responsiveness
      setProfile((prev) => (prev ? { ...prev, ...updates } : (updates as UserProfile)))

      await fetchProfile(user.id)
      return { error: null }
    } catch (err) {
      console.error('[FORM Auth] Unexpected profile update failure:', err)
      return { error: err as Error }
    }
  }

  const value: AuthContextType = {
    user,
    session,
    profile,
    isAuthenticated: Boolean(user),
    isLoading,
    signUp,
    signIn,
    signOut,
    refreshProfile,
    updateProfile,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
