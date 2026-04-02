import { Outlet } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth'
import { useI18n } from '../../i18n/useI18n'
import { TopTabs } from '../common/TopTabs'
import { UserWorkspaceProvider } from './UserWorkspaceProvider'
import styles from './UserShell.module.css'

export function UserShell() {
  const { user, isAdmin, signOut } = useAuth()
  const { t } = useI18n()

  const userTabs = [
    { label: t.tabs.home, to: '/' },
    { label: t.tabs.assignments, to: '/assignments' },
  ]

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <TopTabs items={userTabs} />
          <div className={styles.accountRow}>
            <span className={styles.accountEmail}>{user?.email}</span>
            {isAdmin ? (
              <a className={styles.adminLink} href="/admin">
                {t.auth.adminSpace}
              </a>
            ) : null}
            <button className={styles.signOutButton} type="button" onClick={() => void signOut()}>
              {t.auth.signOut}
            </button>
          </div>
        </div>
      </header>
      <main className={styles.main}>
        <UserWorkspaceProvider>
          <Outlet />
        </UserWorkspaceProvider>
      </main>
    </div>
  )
}
