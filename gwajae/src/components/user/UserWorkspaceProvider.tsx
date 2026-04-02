import { useCallback, useEffect, useMemo, useState, type PropsWithChildren } from 'react'
import { fetchAssignments } from '../../lib/assignments'
import { ensureDefaultSubject, fetchSubjects } from '../../lib/subjects'
import { fetchStorageUsageSummary } from '../../lib/storageUsage'
import { EMPTY_STORAGE_SUMMARY, UserWorkspaceContext, type UserWorkspaceContextValue } from './UserWorkspaceContext'

export function UserWorkspaceProvider({ children }: PropsWithChildren) {
  const [assignments, setAssignments] = useState<UserWorkspaceContextValue['assignments']>([])
  const [subjects, setSubjects] = useState<UserWorkspaceContextValue['subjects']>([])
  const [storageSummary, setStorageSummary] = useState(EMPTY_STORAGE_SUMMARY)
  const [isLoading, setIsLoading] = useState(true)
  const [dataError, setDataError] = useState<string | null>(null)
  const [storageError, setStorageError] = useState<string | null>(null)

  const loadWorkspaceData = useCallback(async () => {
    const { error: defaultError } = await ensureDefaultSubject()
    if (defaultError) {
      return {
        assignments: [] as UserWorkspaceContextValue['assignments'],
        subjects: [] as UserWorkspaceContextValue['subjects'],
        storageSummary: EMPTY_STORAGE_SUMMARY,
        dataError: defaultError.message,
        storageError: null,
      }
    }

    const [
      { data: nextSubjects, error: subjectError },
      { data: nextAssignments, error: assignmentError },
      { data: nextStorageSummary, error: nextStorageError },
    ] = await Promise.all([fetchSubjects(), fetchAssignments(), fetchStorageUsageSummary()])

    return {
      assignments: nextAssignments ?? [],
      subjects: nextSubjects ?? [],
      storageSummary: nextStorageSummary,
      dataError: subjectError?.message ?? assignmentError?.message ?? null,
      storageError: nextStorageError?.message ?? null,
    }
  }, [])

  const refreshAll = useCallback(async (showLoading = false) => {
    if (showLoading) {
      setIsLoading(true)
    }

    const nextState = await loadWorkspaceData()
    setAssignments(nextState.assignments)
    setSubjects(nextState.subjects)
    setStorageSummary(nextState.storageSummary)
    setDataError(nextState.dataError)
    setStorageError(nextState.storageError)
    setIsLoading(false)
  }, [loadWorkspaceData])

  useEffect(() => {
    let ignore = false

    async function bootstrap() {
      const nextState = await loadWorkspaceData()

      if (ignore) {
        return
      }

      setAssignments(nextState.assignments)
      setSubjects(nextState.subjects)
      setStorageSummary(nextState.storageSummary)
      setDataError(nextState.dataError)
      setStorageError(nextState.storageError)
      setIsLoading(false)
    }

    void bootstrap()

    return () => {
      ignore = true
    }
  }, [loadWorkspaceData])

  const value = useMemo<UserWorkspaceContextValue>(
    () => ({
      assignments,
      subjects,
      storageSummary,
      isLoading,
      dataError,
      storageError,
      refreshAll,
    }),
    [assignments, dataError, isLoading, refreshAll, storageError, storageSummary, subjects],
  )

  return <UserWorkspaceContext.Provider value={value}>{children}</UserWorkspaceContext.Provider>
}
