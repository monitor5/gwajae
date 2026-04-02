import { createContext } from 'react'
import type { Session, User } from '@supabase/supabase-js'

export interface AuthContextValue {
  isConfigured: boolean
  isLoading: boolean
  session: Session | null
  user: User | null
  isAuthenticated: boolean
  isAuthorized: boolean
  isAdmin: boolean
  allowedUserRole: 'admin' | 'member' | null
  accessMessage: string | null
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
