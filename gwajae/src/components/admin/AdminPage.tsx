import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth'
import { useI18n } from '../../i18n/useI18n'
import { useStorageUsage } from '../../hooks/useStorageUsage'
import { fetchAllowedUsers, inviteAllowedUser, updateAllowedUser } from '../../lib/allowedUsers'
import type { AllowedUser } from '../../types'
import { TopTabs } from '../common/TopTabs'
import styles from './AdminPage.module.css'

function ProjectStorageCard({
  usedMb,
  totalMb,
  labels,
}: {
  usedMb: number
  totalMb: number
  labels: { projectStorage: string; totalUploadUsage: string; storageUsed: string }
}) {
  const percentage = totalMb > 0 ? Math.min(100, Math.round((usedMb / totalMb) * 100)) : 0

  return (
    <section className={styles.storageCard}>
      <div>
        <p className={styles.storageLabel}>{labels.projectStorage}</p>
        <h2 className={styles.storageTitle}>{labels.totalUploadUsage}</h2>
      </div>
      <div className={styles.storageMeta}>
        <div className={styles.storageTrack} aria-hidden="true">
          <div className={styles.storageFill} style={{ width: `${percentage}%` }} />
        </div>
        <p className={styles.storageText}>
          {labels.storageUsed
            .replace('{used}', String(usedMb))
            .replace('{total}', String(totalMb / 1024))}
        </p>
      </div>
    </section>
  )
}

export function AdminPage() {
  const { user, signOut } = useAuth()
  const { t } = useI18n()
  const { totalUsedMb, totalLimitMb, error: storageError } = useStorageUsage()
  const [allowedUsers, setAllowedUsers] = useState<AllowedUser[]>([])
  const [inviteEmail, setInviteEmail] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const currentEmail = user?.email?.toLowerCase() ?? ''

  const adminTabs = [{ label: t.tabs.admin, to: '/admin' }]

  async function loadAllowedUsers(options?: { keepLoadingState?: boolean }) {
    if (!options?.keepLoadingState) {
      setIsLoading(true)
    }
    setError(null)

    const { data, error: queryError } = await fetchAllowedUsers()

    if (queryError) {
      setError(queryError.message)
      setAllowedUsers([])
      setIsLoading(false)
      return
    }

    setAllowedUsers(data ?? [])
    setIsLoading(false)
  }

  useEffect(() => {
    queueMicrotask(() => {
      void loadAllowedUsers({ keepLoadingState: true })
    })
  }, [])

  async function handleInvite() {
    const normalizedEmail = inviteEmail.trim().toLowerCase()

    if (!normalizedEmail) {
      setError(t.admin.inviteRequired)
      return
    }

    const alreadyExists = allowedUsers.some((entry) => entry.email === normalizedEmail)
    if (alreadyExists) {
      setError(t.admin.alreadyExists)
      return
    }

    setIsSaving(true)
    setError(null)

    const { error: inviteError } = await inviteAllowedUser(normalizedEmail, 'member')

    if (inviteError) {
      setError(inviteError.message)
      setIsSaving(false)
      return
    }

    setInviteEmail('')
    setIsSaving(false)
    await loadAllowedUsers()
  }

  async function toggleRole(entry: AllowedUser) {
    if (entry.email === currentEmail) {
      setError(t.admin.cannotChangeOwnRole)
      return
    }

    setIsSaving(true)
    setError(null)

    const nextRole = entry.role === 'admin' ? 'member' : 'admin'
    const { error: updateError } = await updateAllowedUser(entry.id, { role: nextRole })

    if (updateError) {
      setError(updateError.message)
      setIsSaving(false)
      return
    }

    setIsSaving(false)
    await loadAllowedUsers()
  }

  async function toggleActive(entry: AllowedUser) {
    if (entry.email === currentEmail) {
      setError(t.admin.cannotDeactivateSelf)
      return
    }

    setIsSaving(true)
    setError(null)

    const { error: updateError } = await updateAllowedUser(entry.id, {
      active: !entry.active,
    })

    if (updateError) {
      setError(updateError.message)
      setIsSaving(false)
      return
    }

    setIsSaving(false)
    await loadAllowedUsers()
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <TopTabs items={adminTabs} />
          <div className={styles.headerActions}>
            <Link className={styles.appLinkButton} to="/">
              {t.auth.normalView}
            </Link>
            <button className={styles.signOutButton} type="button" onClick={() => void signOut()}>
              {t.auth.signOut}
            </button>
          </div>
        </div>
      </header>

      <main className={styles.main}>
        <ProjectStorageCard usedMb={totalUsedMb} totalMb={totalLimitMb} labels={t.admin} />

        <section className={styles.panel}>
          <div className={styles.toolbar}>
            <div>
              <h1 className={styles.title}>{t.admin.userManagement}</h1>
              <p className={styles.subtitle}>{user?.email ?? t.admin.adminAccount}</p>
            </div>
            <div className={styles.inviteRow}>
              <input
                className={styles.input}
                type="email"
                placeholder={t.admin.invitePlaceholder}
                aria-label={t.admin.inviteLabel}
                value={inviteEmail}
                onChange={(event) => setInviteEmail(event.target.value)}
              />
              <button
                className={styles.inviteButton}
                type="button"
                onClick={() => void handleInvite()}
                disabled={isSaving}
              >
                {t.admin.addUser}
              </button>
            </div>
          </div>

          {error ? <p className={styles.errorText}>{error}</p> : null}
          {storageError ? (
            <p className={styles.helperText}>{t.admin.storageNote}</p>
          ) : null}
          {isLoading ? <p className={styles.helperText}>{t.admin.loading}</p> : null}

          {!isLoading ? (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>{t.admin.email}</th>
                  <th>{t.admin.role}</th>
                  <th>{t.admin.status}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {allowedUsers.map((entry) => (
                  <tr key={entry.id}>
                    <td>{entry.email}</td>
                    <td>
                      <button
                        className={
                          entry.role === 'admin' ? styles.adminBadgeButton : styles.memberBadgeButton
                        }
                        type="button"
                        onClick={() => void toggleRole(entry)}
                        disabled={isSaving || entry.email === currentEmail}
                      >
                        {entry.role === 'admin' ? t.admin.admin : t.admin.member}
                      </button>
                    </td>
                    <td>
                      <button
                        className={entry.active ? styles.statusButtonActive : styles.statusButtonInactive}
                        type="button"
                        onClick={() => void toggleActive(entry)}
                        disabled={isSaving || entry.email === currentEmail}
                      >
                        <span className={styles.statusDot} />
                        {entry.active ? t.admin.active : t.admin.inactive}
                      </button>
                    </td>
                    <td>
                      <button
                        className={styles.editButton}
                        type="button"
                        onClick={() => void toggleRole(entry)}
                        disabled={isSaving || entry.email === currentEmail}
                      >
                        {entry.role === 'admin' ? t.admin.changeToMember : t.admin.changeToAdmin}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </section>
      </main>
    </div>
  )
}
