import type { PropsWithChildren } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth'
import { useI18n } from '../../i18n/useI18n'
import styles from './AuthGuard.module.css'

function FullPageMessage({ title, description }: { title: string; description: string }) {
  return (
    <div className={styles.statePage}>
      <div className={styles.stateCard}>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
    </div>
  )
}

export function UserGuard({ children }: PropsWithChildren) {
  const { isConfigured, isLoading, isAuthenticated, isAuthorized, accessMessage, signOut } =
    useAuth()
  const { t } = useI18n()
  const location = useLocation()

  if (!isConfigured) {
    return (
      <FullPageMessage
        title={t.guard.supabaseRequired}
        description={t.guard.supabaseUserDesc}
      />
    )
  }

  if (isLoading) {
    return (
      <FullPageMessage
        title={t.guard.checkingLogin}
        description={t.guard.checkingLoginDesc}
      />
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  if (!isAuthorized) {
    return (
      <div className={styles.statePage}>
        <div className={styles.stateCard}>
          <h1>{t.guard.notAuthorized}</h1>
          <p>{accessMessage ?? t.guard.notAuthorizedDefault}</p>
          <button className={styles.actionButton} onClick={() => void signOut()} type="button">
            {t.auth.signOut}
          </button>
        </div>
      </div>
    )
  }

  return <>{children}</>
}

export function AdminGuard({ children }: PropsWithChildren) {
  const { isConfigured, isLoading, isAuthenticated, isAuthorized, isAdmin, accessMessage } =
    useAuth()
  const { t } = useI18n()
  const location = useLocation()

  if (!isConfigured) {
    return (
      <FullPageMessage
        title={t.guard.supabaseRequired}
        description={t.guard.supabaseAdminDesc}
      />
    )
  }

  if (isLoading) {
    return (
      <FullPageMessage
        title={t.guard.checkingPermission}
        description={t.guard.checkingPermissionDesc}
      />
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  if (!isAuthorized) {
    return (
      <FullPageMessage
        title={t.guard.notAuthorized}
        description={accessMessage ?? t.guard.notAuthorizedAdminDefault}
      />
    )
  }

  if (!isAdmin) {
    return (
      <FullPageMessage
        title={t.guard.adminOnly}
        description={t.guard.adminOnlyDesc}
      />
    )
  }

  return <>{children}</>
}
