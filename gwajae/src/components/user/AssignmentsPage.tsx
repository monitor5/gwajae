import { useMemo, useState } from 'react'
import { useI18n } from '../../i18n/useI18n'
import {
  createAssignmentWithAssets,
  deleteAssignment,
  toggleAssignmentFlags,
  updateAssignmentWithAssets,
} from '../../lib/assignments'
import { createSubject } from '../../lib/subjects'
import type { Assignment } from '../../types'
import { EditIcon, PinIcon } from '../common/ActionIcons'
import { NewAssignmentModal } from './NewAssignmentModal'
import { useUserWorkspace } from './useUserWorkspace'
import styles from './AssignmentsPage.module.css'

const pastelOptions = [
  '#f3afc9',
  '#a9dfe4',
  '#f5d295',
  '#ddc0f3',
  '#d7dee7',
  '#c7ebd6',
  '#f7cdb8',
  '#d0daf5',
]

function formatDueDate(isoDate: string, locale: string) {
  return new Intl.DateTimeFormat(locale === 'ko' ? 'ko-KR' : 'en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(isoDate))
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
  onToggle,
  disabled,
  labels,
}: {
  assignment: Assignment
  onToggle: (assignment: Assignment) => Promise<void>
  disabled: boolean
  labels: { markUnsubmitted: string; markSubmitted: string }
}) {
  return (
    <button
      type="button"
      className={styles.statusButton}
      onClick={() => void onToggle(assignment)}
      disabled={disabled}
      aria-label={assignment.submitted ? labels.markUnsubmitted : labels.markSubmitted}
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

interface NewSubjectModalProps {
  onClose: () => void
  onCreate: (name: string, color: string) => Promise<void>
  isSaving: boolean
}

function NewSubjectModal({ onClose, onCreate, isSaving }: NewSubjectModalProps) {
  const { t } = useI18n()
  const [name, setName] = useState('')
  const [color, setColor] = useState(pastelOptions[0])
  const [error, setError] = useState<string | null>(null)

  async function handleCreate() {
    const trimmed = name.trim()
    if (!trimmed) {
      setError(t.newSubject.nameRequired)
      return
    }

    setError(null)
    await onCreate(trimmed, color)
    setName('')
  }

  return (
    <div className={styles.overlay} role="presentation" onClick={onClose}>
      <section
        className={styles.subjectModal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-subject-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className={styles.subjectModalHeader}>
          <h2 id="new-subject-title" className={styles.subjectModalTitle}>
            {t.newSubject.title}
          </h2>
          <button className={styles.closeButton} onClick={onClose} aria-label={t.newSubject.closeModal}>
            ×
          </button>
        </header>

        <label className={styles.subjectField}>
          <span>{t.newSubject.name}</span>
          <input
            type="text"
            placeholder={t.newSubject.namePlaceholder}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>

        <div className={styles.subjectField}>
          <span>{t.newSubject.color}</span>
          <div className={styles.colorGrid}>
            {pastelOptions.map((option) => (
              <button
                key={option}
                type="button"
                className={
                  option === color
                    ? `${styles.colorSwatch} ${styles.colorSwatchActive}`
                    : styles.colorSwatch
                }
                style={{ backgroundColor: option }}
                onClick={() => setColor(option)}
                aria-label={t.newSubject.colorSelect.replace('{color}', option)}
              />
            ))}
          </div>
        </div>

        {error ? <p className={styles.errorText}>{error}</p> : null}

        <button
          className={styles.createSubjectButton}
          type="button"
          onClick={() => void handleCreate()}
          disabled={isSaving}
        >
          {t.newSubject.addButton}
        </button>
      </section>
    </div>
  )
}

export function AssignmentsPage() {
  const { t, locale } = useI18n()
  const { assignments, subjects, storageSummary, isLoading, dataError, refreshAll } =
    useUserWorkspace()
  const [isAssignmentModalOpen, setIsAssignmentModalOpen] = useState(false)
  const [isSubjectModalOpen, setIsSubjectModalOpen] = useState(false)
  const [editingAssignment, setEditingAssignment] = useState<Assignment | null>(null)
  const [subjectFilter, setSubjectFilter] = useState('all')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const sortedAssignments = useMemo(() => sortAssignments(assignments), [assignments])
  const filteredAssignments = useMemo(() => {
    if (subjectFilter === 'all') {
      return sortedAssignments
    }

    return sortedAssignments.filter((assignment) => assignment.subjectId === subjectFilter)
  }, [sortedAssignments, subjectFilter])

  async function handleCreateSubject(name: string, color: string) {
    setIsSaving(true)
    setError(null)

    const { data, error: createError } = await createSubject(name, color)
    if (createError) {
      setError(createError.message)
      setIsSaving(false)
      return
    }

    if (data) {
      setSubjectFilter(data.id)
    }

    setIsSaving(false)
    setIsSubjectModalOpen(false)
    await refreshAll()
  }

  async function handleToggleSubmitted(assignment: Assignment) {
    setIsSaving(true)
    setError(null)

    const { error: updateError } = await toggleAssignmentFlags(assignment.id, {
      submitted: !assignment.submitted,
    })

    if (updateError) {
      setError(updateError.message)
      setIsSaving(false)
      return
    }

    setIsSaving(false)
    await refreshAll()
  }

  async function handleToggleFavorite(assignment: Assignment) {
    setIsSaving(true)
    setError(null)

    const { error: updateError } = await toggleAssignmentFlags(assignment.id, {
      isFavorite: !assignment.isFavorite,
    })

    if (updateError) {
      setError(updateError.message)
      setIsSaving(false)
      return
    }

    setIsSaving(false)
    await refreshAll()
  }

  async function handleDeleteAssignment(assignment: Assignment) {
    setIsSaving(true)
    setError(null)

    const { error: deleteError } = await deleteAssignment(assignment.id)
    if (deleteError) {
      setError(deleteError.message)
      setIsSaving(false)
      return
    }

    setIsSaving(false)
    await refreshAll()
  }

  async function handleSavedAssignment() {
    await refreshAll()
  }

  function openCreateModal() {
    setEditingAssignment(null)
    setIsAssignmentModalOpen(true)
  }

  function openEditModal(assignment: Assignment) {
    setEditingAssignment(assignment)
    setIsAssignmentModalOpen(true)
  }

  return (
    <>
      <section className={styles.library}>
        <div className={styles.toolbar}>
          <h1 className={styles.title}>{t.assignments.library}</h1>
          <div className={styles.actions}>
            <label className={styles.selectShell}>
              <span className={styles.visuallyHidden}>{t.assignments.subjectFilter}</span>
              <select
                value={subjectFilter}
                onChange={(event) => setSubjectFilter(event.target.value)}
              >
                <option value="all">{t.assignments.allSubjects}</option>
                {subjects.map((subject) => (
                  <option key={subject.id} value={subject.id}>
                    {subject.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              className={styles.ghostButton}
              type="button"
              onClick={() => setIsSubjectModalOpen(true)}
            >
              {t.assignments.addSubject}
            </button>
            <button className={styles.primaryButton} type="button" onClick={openCreateModal}>
              {t.assignments.addAssignment}
            </button>
          </div>
        </div>

        {error ? <p className={styles.errorText}>{error}</p> : null}
        {dataError ? <p className={styles.errorText}>{dataError}</p> : null}
        {isLoading ? <p className={styles.helperText}>{t.assignments.loading}</p> : null}

        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <colgroup>
              <col className={styles.colPin} />
              <col className={styles.colSubject} />
              <col className={styles.colTitle} />
              <col className={styles.colDueDate} />
              <col className={styles.colSubmitted} />
              <col className={styles.colLink} />
              <col className={styles.colFiles} />
              <col className={styles.colEdit} />
              <col className={styles.colDelete} />
            </colgroup>
            <thead>
              <tr>
                <th>{t.assignments.pin}</th>
                <th>{t.assignments.subject}</th>
                <th>{t.assignments.title}</th>
                <th>{t.assignments.dueDate}</th>
                <th>{t.assignments.submitted}</th>
                <th>{t.assignments.link}</th>
                <th>{t.assignments.files}</th>
                <th>{t.assignments.edit}</th>
                <th aria-label={t.assignments.delete} />
              </tr>
            </thead>
            <tbody>
              {!isLoading && filteredAssignments.length === 0 ? (
                <tr>
                  <td className={styles.emptyState} colSpan={9}>
                    {t.assignments.noAssignments}
                  </td>
                </tr>
              ) : null}

              {filteredAssignments.map((assignment) => (
                <tr key={assignment.id}>
                  <td>
                    <button
                      type="button"
                      className={
                        assignment.isFavorite ? styles.favoriteActive : styles.favoriteMuted
                      }
                      onClick={() => void handleToggleFavorite(assignment)}
                      disabled={isSaving}
                      aria-label={assignment.isFavorite ? t.assignments.unpin : t.assignments.pinToTop}
                    >
                      <PinIcon className={styles.pinIcon} />
                    </button>
                  </td>
                  <td>
                    <span
                      className={styles.subjectPill}
                      style={{ backgroundColor: assignment.subjectColor ?? '#d7dee7' }}
                    >
                      {assignment.subjectName ?? '—'}
                    </span>
                  </td>
                  <td className={styles.titleCell}>{assignment.title}</td>
                  <td className={styles.dateCell}>{formatDueDate(assignment.dueDate, locale)}</td>
                  <td>
                    <SubmittedToggle
                      assignment={assignment}
                      onToggle={handleToggleSubmitted}
                      disabled={isSaving}
                      labels={t.assignments}
                    />
                  </td>
                  <td>
                    {assignment.externalLink ? (
                      <a
                        className={styles.linkAnchor}
                        href={assignment.externalLink}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {t.assignments.hasLink}
                      </a>
                    ) : (
                      <span className={styles.helperInline}>{t.assignments.noLink}</span>
                    )}
                  </td>
                  <td className={styles.filesCell}>
                    {t.assignments.fileCount.replace('{count}', String(assignment.attachmentCount))}
                  </td>
                  <td>
                    <button
                      type="button"
                      className={styles.editButton}
                      onClick={() => openEditModal(assignment)}
                      disabled={isSaving}
                      aria-label={t.assignments.editAssignment}
                    >
                      <EditIcon className={styles.editIcon} />
                    </button>
                  </td>
                  <td>
                    <button
                      type="button"
                      className={styles.deleteButton}
                      onClick={() => void handleDeleteAssignment(assignment)}
                      disabled={isSaving}
                      aria-label={t.assignments.deleteAssignment}
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {isAssignmentModalOpen ? (
        <NewAssignmentModal
          key={editingAssignment?.id ?? 'new-assignment'}
          assignment={editingAssignment}
          onClose={() => {
            setEditingAssignment(null)
            setIsAssignmentModalOpen(false)
          }}
          onSaved={handleSavedAssignment}
          subjects={subjects}
          remainingBytes={Math.max(
            0,
            storageSummary.personalLimitBytes - storageSummary.personalBytes,
          )}
          createAssignment={createAssignmentWithAssets}
          updateAssignment={updateAssignmentWithAssets}
        />
      ) : null}

      {isSubjectModalOpen ? (
        <NewSubjectModal
          onClose={() => setIsSubjectModalOpen(false)}
          onCreate={handleCreateSubject}
          isSaving={isSaving}
        />
      ) : null}
    </>
  )
}
