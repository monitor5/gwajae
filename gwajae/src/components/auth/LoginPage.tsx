import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth'
import { useI18n } from '../../i18n/useI18n'
import styles from './LoginPage.module.css'

export function LoginPage() {
  const {
    isConfigured,
    isAuthenticated,
    isAuthorized,
    isAdmin,
    signInWithGoogle,
    signOut,
    user,
    accessMessage,
  } = useAuth()
  const { t } = useI18n()
  const navigate = useNavigate()
  const location = useLocation()

  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname

  useEffect(() => {
    if (!isAuthenticated || !isAuthorized) {
      return
    }

    const target = from ?? (isAdmin ? '/admin' : '/')
    void navigate(target, { replace: true })
  }, [from, isAdmin, isAuthenticated, isAuthorized, navigate])

  return (
    <div className={styles.page}>
      <section className={styles.card}>
        <span className={styles.badge}>{t.login.badge}</span>
        <h1 className={styles.title}>{t.login.title}</h1>
        <p className={styles.description}>{t.login.description}</p>

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.primaryButton}
            onClick={() => void signInWithGoogle()}
            disabled={!isConfigured}
          >
            {t.auth.loginWithGoogle}
          </button>
          {user ? (
            <button type="button" className={styles.secondaryButton} onClick={() => void signOut()}>
              {t.auth.signOut}
            </button>
          ) : null}
        </div>

        <div className={styles.infoBox}>
          <strong>{t.login.setupTitle}</strong>
          <p>{t.login.setupDescription}</p>
        </div>

        {isAuthenticated && !isAuthorized ? (
          <div className={styles.warningBox}>
            <strong>{t.login.unauthorizedTitle}</strong>
            <p>{accessMessage ?? t.login.unauthorizedDefault}</p>
          </div>
        ) : null}
      </section>
    </div>
  )
}
