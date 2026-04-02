import type { Subject } from '../types'
import { supabase } from './supabase'

function normalizeSubject(row: Record<string, unknown>): Subject {
  return {
    id: String(row.id),
    name: String(row.name),
    color: String(row.color),
    isDefault: Boolean(row.is_default),
  }
}

async function getCurrentUserId() {
  if (!supabase) {
    return null
  }

  const { data } = await supabase.auth.getUser()
  return data.user?.id ?? null
}

export async function fetchSubjects() {
  if (!supabase) {
    return { data: [] as Subject[], error: null }
  }

  const { data, error } = await supabase
    .from('subjects')
    .select('id,name,color,is_default')
    .order('is_default', { ascending: false })
    .order('name', { ascending: true })

  if (error) {
    return { data: [] as Subject[], error }
  }

  return {
    data: (data ?? []).map((row) => normalizeSubject(row)),
    error: null,
  }
}

export async function ensureDefaultSubject() {
  if (!supabase) {
    return { data: null as Subject | null, error: null }
  }

  const userId = await getCurrentUserId()
  if (!userId) {
    return { data: null as Subject | null, error: null }
  }

  const { data: existing, error: existingError } = await supabase
    .from('subjects')
    .select('id,name,color,is_default')
    .eq('is_default', true)
    .limit(1)
    .maybeSingle()

  if (existingError) {
    return { data: null as Subject | null, error: existingError }
  }

  if (existing) {
    return { data: normalizeSubject(existing), error: null }
  }

  const { data, error } = await supabase
    .from('subjects')
    .insert({
      owner_user_id: userId,
      name: '미지정',
      color: '#d7dee7',
      is_default: true,
    })
    .select('id,name,color,is_default')
    .single()

  if (error) {
    return { data: null as Subject | null, error }
  }

  return { data: normalizeSubject(data), error: null }
}

export async function createSubject(name: string, color: string) {
  if (!supabase) {
    return { data: null as Subject | null, error: null }
  }

  const userId = await getCurrentUserId()
  if (!userId) {
    return {
      data: null as Subject | null,
      error: new Error('과목을 만들려면 먼저 로그인해 주세요.'),
    }
  }

  const trimmed = name.trim()
  if (!trimmed) {
    return {
      data: null as Subject | null,
      error: new Error('과목명은 비워둘 수 없습니다.'),
    }
  }

  const { data, error } = await supabase
    .from('subjects')
    .insert({
      owner_user_id: userId,
      name: trimmed,
      color,
      is_default: false,
    })
    .select('id,name,color,is_default')
    .single()

  if (error) {
    return { data: null as Subject | null, error }
  }

  return { data: normalizeSubject(data), error: null }
}
