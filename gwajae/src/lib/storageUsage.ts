import type { StorageUsageSummary } from '../types'
import { supabase } from './supabase'

const FALLBACK_SUMMARY: StorageUsageSummary = {
  personalBytes: 0,
  totalBytes: 0,
  personalLimitBytes: 100 * 1024 * 1024,
  totalLimitBytes: 1024 * 1024 * 1024,
}

export async function fetchStorageUsageSummary() {
  if (!supabase) {
    return { data: FALLBACK_SUMMARY, error: null }
  }

  const { data, error } = await supabase.rpc('get_storage_usage_summary')

  if (error) {
    return { data: FALLBACK_SUMMARY, error }
  }

  const row = Array.isArray(data) ? data[0] : data

  return {
    data: {
      personalBytes: Number(row?.personal_bytes ?? 0),
      totalBytes: Number(row?.total_bytes ?? 0),
      personalLimitBytes: Number(row?.personal_limit_bytes ?? FALLBACK_SUMMARY.personalLimitBytes),
      totalLimitBytes: Number(row?.total_limit_bytes ?? FALLBACK_SUMMARY.totalLimitBytes),
    } satisfies StorageUsageSummary,
    error: null,
  }
}

export function bytesToMegabytes(bytes: number) {
  return Math.round((bytes / (1024 * 1024)) * 10) / 10
}
