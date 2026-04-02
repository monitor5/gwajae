import { useEffect, useState } from 'react'
import type { StorageUsageSummary } from '../types'
import { bytesToMegabytes, fetchStorageUsageSummary } from '../lib/storageUsage'

const EMPTY_SUMMARY: StorageUsageSummary = {
  personalBytes: 0,
  totalBytes: 0,
  personalLimitBytes: 100 * 1024 * 1024,
  totalLimitBytes: 1024 * 1024 * 1024,
}

export function useStorageUsage() {
  const [summary, setSummary] = useState<StorageUsageSummary>(EMPTY_SUMMARY)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    let ignore = false

    async function run() {
      setIsLoading(true)
      const { data, error: fetchError } = await fetchStorageUsageSummary()

      if (ignore) {
        return
      }

      setSummary(data)
      setError(fetchError ? fetchError.message : null)
      setIsLoading(false)
    }

    void run()

    return () => {
      ignore = true
    }
  }, [refreshKey])

  return {
    summary,
    isLoading,
    error,
    personalUsedMb: bytesToMegabytes(summary.personalBytes),
    personalLimitMb: bytesToMegabytes(summary.personalLimitBytes),
    totalUsedMb: bytesToMegabytes(summary.totalBytes),
    totalLimitMb: bytesToMegabytes(summary.totalLimitBytes),
    refresh: () => setRefreshKey((current) => current + 1),
  }
}
