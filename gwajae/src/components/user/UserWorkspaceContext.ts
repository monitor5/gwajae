import { createContext } from 'react'
import type { Assignment, StorageUsageSummary, Subject } from '../../types'

export const EMPTY_STORAGE_SUMMARY: StorageUsageSummary = {
  personalBytes: 0,
  totalBytes: 0,
  personalLimitBytes: 100 * 1024 * 1024,
  totalLimitBytes: 1024 * 1024 * 1024,
}

export interface UserWorkspaceContextValue {
  assignments: Assignment[]
  subjects: Subject[]
  storageSummary: StorageUsageSummary
  isLoading: boolean
  dataError: string | null
  storageError: string | null
  refreshAll: (showLoading?: boolean) => Promise<void>
}

export const UserWorkspaceContext = createContext<UserWorkspaceContextValue | null>(null)
