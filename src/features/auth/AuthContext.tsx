/* eslint-disable react-refresh/only-export-components */
import React, { createContext } from 'react'

/**
 * AuthContext (Stub for Phase 2)
 * Will manage Supabase User sessions, login, signup, and signout.
 */
export interface AuthContextType {
  isAuthenticated: boolean
  user: { id: string; email?: string } | null
}

export const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  user: null,
})

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <AuthContext.Provider value={{ isAuthenticated: false, user: null }}>
      {children}
    </AuthContext.Provider>
  )
}
