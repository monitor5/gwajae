import type { PropsWithChildren } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { AuthContext, type AuthContextValue } from './AuthContext'
import type { AllowedUser } from '../types'
import { fetchAllowedUserByEmail } from '../lib/allowedUsers'
import { isSupabaseConfigured, supabase } from '../lib/supabase'

function getAdminEmails() {
  return (import.meta.env.VITE_ADMIN_EMAILS ?? '')
    .split(',')
    .map((email: string) => email.trim().toLowerCase())
    .filter(Boolean)
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<AuthContextValue['session']>(null)
  const [isLoading, setIsLoading] = useState(isSupabaseConfigured)
  const [allowedUser, setAllowedUser] = useState<AllowedUser | null>(null)
  const [accessMessage, setAccessMessage] = useState<string | null>(null)
  const adminEmails = useMemo(() => getAdminEmails(), [])

  useEffect(() => {
    if (!supabase) {
      return
    }

    let isMounted = true

    const syncAccess = async (nextSession: AuthContextValue['session']) => {
      if (!isMounted) {
        return
      }

      setSession(nextSession)

      const email = nextSession?.user.email?.toLowerCase() ?? ''
      if (!email) {
        setAllowedUser(null)
        setAccessMessage(null)
        setIsLoading(false)
        return
      }

      if (adminEmails.includes(email)) {
        setAllowedUser({
          id: 'bootstrap-admin',
          email,
          role: 'admin',
          active: true,
        })
        setAccessMessage(null)
        setIsLoading(false)
        return
      }

      const { data, error } = await fetchAllowedUserByEmail(email)

      if (!isMounted) {
        return
      }

      if (error) {
        setAllowedUser(null)
        setAccessMessage(
          error.code === '42P01'
            ? 'SQL Editor에서 최신 supabase/setup.sql을 실행해서 allowed_users 테이블을 먼저 만들어 주세요.'
            : error.message,
        )
        setIsLoading(false)
        return
      }

      if (!data) {
        setAllowedUser(null)
        setAccessMessage('이 이메일은 아직 허용 사용자 목록에 없습니다.')
        setIsLoading(false)
        return
      }

      if (!data.active) {
        setAllowedUser(data)
        setAccessMessage('이 계정은 관리자에 의해 비활성화되었습니다.')
        setIsLoading(false)
        return
      }

      setAllowedUser(data)
      setAccessMessage(null)
      setIsLoading(false)
    }

    void supabase.auth.getSession().then(({ data }) => {
      if (isMounted) {
        void syncAccess(data.session)
      }
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setIsLoading(true)
      void syncAccess(nextSession)
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [adminEmails])

  const value = useMemo<AuthContextValue>(() => {
    const email = session?.user.email?.toLowerCase() ?? ''
    const isBootstrapAdmin = adminEmails.includes(email)
    const isAuthorized = Boolean(session?.user) && (isBootstrapAdmin || Boolean(allowedUser?.active))
    const role = isBootstrapAdmin ? 'admin' : allowedUser?.role ?? null

    return {
      isConfigured: isSupabaseConfigured,
      isLoading,
      session,
      user: session?.user ?? null,
      isAuthenticated: Boolean(session?.user),
      isAuthorized,
      isAdmin: role === 'admin',
      allowedUserRole: role,
      accessMessage,
      signInWithGoogle: async () => {
        if (!supabase) {
          return
        }

        await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: window.location.origin,
          },
        })
      },
      signOut: async () => {
        if (!supabase) {
          return
        }

        await supabase.auth.signOut()
      },
    }
  }, [accessMessage, adminEmails, allowedUser?.active, allowedUser?.role, isLoading, session])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
