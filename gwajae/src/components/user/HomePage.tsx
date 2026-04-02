import type { CSSProperties } from 'react'
import { useMemo, useState } from 'react'
import { useAuth } from '../../auth/useAuth'
import { useI18n } from '../../i18n/useI18n'
import { toggleAssignmentFlags } from '../../lib/assignments'
import type { Assignment } from '../../types'
import { PinIcon } from '../common/ActionIcons'
import { useUserWorkspace } from './useUserWorkspace'
import styles from './HomePage.module.css'

function bytesToMegabytes(bytes: number) {
  return Math.round((bytes / (1024 * 1024)) * 10) / 10
}

function getDdayLabel(dueDate: string) {
  const today = new Date()
  const due = new Date(dueDate)

  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const dueStart = new Date(due.getFullYear(), due.getMonth(), due.getDate())
  const diffDays = Math.round((dueStart.getTime() - todayStart.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays === 0) {
    return 'D-day'
  }

  if (diffDays > 0) {
    return `D-${diffDays}`
  }

  return `D+${Math.abs(diffDays)}`
}

function UsageCard({
  title,
  used,
  total,
  circular = false,
  inUseLabel,
  usageText,
  delay = 0,
}: {
  title: string
  used: number
  total: number
  circular?: boolean
  inUseLabel: string
  usageText: string
  delay?: number
}) {
  const percentage = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0

  return (
    <section
      className={styles.card}
      style={{ animationDelay: `${delay}ms` } as CSSProperties}
    >
      <h2 className={styles.cardTitle}>{title}</h2>
      {circular ? (
        <div
          className={styles.progressRing}
          style={{ '--progress-angle': `${percentage * 3.6}deg` } as CSSProperties}
        >
          <div className={styles.progressInner}>
            <strong>{percentage}%</strong>
            <span>{inUseLabel}</span>
          </div>
        </div>
      ) : (
        <div className={styles.barTrack}>
          <div className={styles.barFill} style={{ width: `${percentage}%` }} aria-hidden="true" />
        </div>
      )}
      <p className={styles.usageLabel}>{usageText}</p>
    </section>
  )
}

function formatDueDetail(dueDate: string, locale: string) {
  return new Intl.DateTimeFormat(locale === 'ko' ? 'ko-KR' : 'en-US', {
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(dueDate))
}

function sortAssignments(assignments: Assignment[]) {
  return [...assignments].sort((left, right) => {
    if (left.isFavorite !== right.isFavorite) {
      return Number(right.isFavorite) - Number(left.isFavorite)
    }

    return new Date(left.dueDate).getTime() - new Date(right.dueDate).getTime()
  })
}

function SubmittedToggle({
  assignment,
  disabled,
  onToggle,
  t,
}: {
  assignment: Assignment
  disabled: boolean
  onToggle: (assignment: Assignment) => Promise<void>
  t: { markUnsubmitted: string; markSubmitted: string }
}) {
  return (
    <button
      type="button"
      className={styles.statusButton}
      onClick={() => void onToggle(assignment)}
      disabled={disabled}
      aria-label={assignment.submitted ? t.markUnsubmitted : t.markSubmitted}
    >
      <span
        className={
          assignment.submitted ? `${styles.statusCircle} ${styles.statusDone}` : styles.statusCircle
        }
      >
        {assignment.submitted ? '✓' : ''}
      </span>
    </button>
  )
}

function DeadlineRow({
  assignment,
  disabled,
  onToggleSubmitted,
  locale,
  t,
  index,
}: {
  assignment: Assignment
  disabled: boolean
  onToggleSubmitted: (assignment: Assignment) => Promise<void>
  locale: string
  t: { markUnsubmitted: string; markSubmitted: string; deadline: string }
  index: number
}) {
  const deadlineText = t.deadline.replace('{date}', formatDueDetail(assignment.dueDate, locale))

  return (
    <li className={styles.assignmentRow} style={{ animationDelay: `${200 + index * 80}ms` } as CSSProperties}>
      <div className={styles.subjectCell}>
        <span
          className={styles.subjectPill}
          style={{ backgroundColor: assignment.subjectColor ?? '#d7dee7' }}
        >
          {assignment.subjectName ?? '—'}
        </span>
      </div>

      <div className={styles.contentCell}>
        <p className={styles.assignmentName}>{assignment.title}</p>
        <p className={styles.assignmentDetail}>{deadlineText}</p>
      </div>

      <div className={styles.ddayCell}>
        <span className={styles.ddayBadge}>{getDdayLabel(assignment.dueDate)}</span>
      </div>

      <div className={styles.actionCell}>
        <SubmittedToggle assignment={assignment} disabled={disabled} onToggle={onToggleSubmitted} t={t} />
      </div>
    </li>
  )
}

function FavoriteRow({
  assignment,
  locale,
  deadlineTemplate,
  pinnedLabel,
  index,
}: {
  assignment: Assignment
  locale: string
  deadlineTemplate: string
  pinnedLabel: string
  index: number
}) {
  const deadlineText = deadlineTemplate.replace('{date}', formatDueDetail(assignment.dueDate, locale))

  return (
    <li className={styles.assignmentRow} style={{ animationDelay: `${200 + index * 80}ms` } as CSSProperties}>
      <div className={styles.subjectCell}>
        <span
          className={styles.subjectPill}
          style={{ backgroundColor: assignment.subjectColor ?? '#d7dee7' }}
        >
          {assignment.subjectName ?? '—'}
        </span>
      </div>

      <div className={styles.contentCell}>
        <p className={styles.assignmentName}>{assignment.title}</p>
        <p className={styles.assignmentDetail}>{deadlineText}</p>
      </div>

      <div className={styles.ddayCell}>
        <span className={styles.ddayBadge}>{getDdayLabel(assignment.dueDate)}</span>
      </div>

      <div className={styles.actionCell}>
        <span className={`${styles.pinBadge} ${styles.pinBadgeActive}`} aria-label={pinnedLabel}>
          <PinIcon />
        </span>
      </div>
    </li>
  )
}

export function HomePage() {
  const { isAdmin } = useAuth()
  const { t, locale } = useI18n()
  const { assignments, storageSummary, isLoading, dataError, storageError, refreshAll } =
    useUserWorkspace()
  const [isSaving, setIsSaving] = useState(false)

  const sortedAssignments = useMemo(() => sortAssignments(assignments), [assignments])
  const favoriteAssignments = useMemo(
    () => sortedAssignments.filter((assignment) => assignment.isFavorite).slice(0, 4),
    [sortedAssignments],
  )
  const upcomingAssignments = useMemo(() => sortedAssignments.slice(0, 3), [sortedAssignments])

  async function handleToggleSubmitted(assignment: Assignment) {
    setIsSaving(true)
    const { error } = await toggleAssignmentFlags(assignment.id, {
      submitted: !assignment.submitted,
    })
    setIsSaving(false)

    if (!error) {
      await refreshAll()
    }
  }

  const personalMbUsed = bytesToMegabytes(storageSummary.personalBytes)
  const personalMbTotal = bytesToMegabytes(storageSummary.personalLimitBytes)
  const totalMbUsed = bytesToMegabytes(storageSummary.totalBytes)
  const totalGbTotal = Math.round(storageSummary.totalLimitBytes / (1024 * 1024 * 1024))

  return (
    <div className={styles.grid}>
      <div className={styles.leftColumn}>
        <UsageCard
          title={t.home.personalStorage}
          used={storageSummary.personalBytes}
          total={storageSummary.personalLimitBytes}
          circular
          inUseLabel={t.home.inUse}
          usageText={t.home.mbUsed
            .replace('{used}', String(personalMbUsed))
            .replace('{total}', String(personalMbTotal))}
          delay={0}
        />
        {isAdmin ? (
          <UsageCard
            title={t.home.totalStorage}
            used={storageSummary.totalBytes}
            total={storageSummary.totalLimitBytes}
            inUseLabel={t.home.inUse}
            usageText={t.home.gbUsed
              .replace('{used}', String(totalMbUsed))
              .replace('{total}', String(totalGbTotal))}
            delay={100}
          />
        ) : null}
        {storageError ? (
          <p className={styles.helperText}>{t.home.storageNote}</p>
        ) : null}
      </div>

      <section className={`${styles.panel} ${styles.tallPanel}`}>
        <div className={styles.panelHeader}>
          <h1 className={styles.panelTitle}>{t.home.upcomingDeadlines}</h1>
          <div className={styles.panelColumns} aria-hidden="true">
            <span>{t.home.subject}</span>
            <span>{t.home.content}</span>
            <span>{t.home.dDay}</span>
            <span>{t.home.submit}</span>
          </div>
        </div>

        {isLoading ? <p className={styles.helperText}>{t.home.loading}</p> : null}
        {dataError ? <p className={styles.helperText}>{dataError}</p> : null}
        {!isLoading && !dataError ? (
          <ul className={styles.list}>
            {upcomingAssignments.length > 0 ? (
              upcomingAssignments.map((assignment, index) => (
                <DeadlineRow
                  key={assignment.id}
                  assignment={assignment}
                  disabled={isSaving}
                  onToggleSubmitted={handleToggleSubmitted}
                  locale={locale}
                  t={t.home}
                  index={index}
                />
              ))
            ) : (
              <li className={styles.emptyRow}>
                <p className={styles.assignmentDetail}>{t.home.noAssignments}</p>
              </li>
            )}
          </ul>
        ) : null}
      </section>

      <section className={`${styles.panel} ${styles.bottomPanel}`}>
        <div className={styles.panelHeader}>
          <h1 className={styles.panelTitle}>{t.home.pinnedAssignments}</h1>
          <div className={styles.panelColumns} aria-hidden="true">
            <span>{t.home.subject}</span>
            <span>{t.home.content}</span>
            <span>{t.home.dDay}</span>
            <span>{t.home.pinned}</span>
          </div>
        </div>

        {!isLoading && !dataError ? (
          <ul className={styles.list}>
            {favoriteAssignments.length > 0 ? (
              favoriteAssignments.map((assignment, index) => (
                <FavoriteRow
                  key={assignment.id}
                  assignment={assignment}
                  locale={locale}
                  deadlineTemplate={t.home.deadline}
                  pinnedLabel={t.home.pinnedLabel}
                  index={index}
                />
              ))
            ) : (
              <li className={styles.emptyRow}>
                <p className={styles.assignmentDetail}>{t.home.noPinned}</p>
              </li>
            )}
          </ul>
        ) : null}
      </section>
    </div>
  )
}
