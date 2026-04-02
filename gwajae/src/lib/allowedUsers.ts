import type { AllowedUser, Role } from '../types'
import { supabase } from './supabase'

export async function fetchAllowedUserByEmail(email: string) {
  if (!supabase) {
    return { data: null, error: null }
  }

  return supabase
    .from('allowed_users')
    .select('id,email,role,active,created_at')
    .eq('email', email.toLowerCase())
    .maybeSingle<AllowedUser>()
}

export async function fetchAllowedUsers() {
  if (!supabase) {
    return { data: [], error: null }
  }

  return supabase
    .from('allowed_users')
    .select('id,email,role,active,created_at')
    .order('created_at', { ascending: true })
}

export async function inviteAllowedUser(email: string, role: Role = 'member') {
  if (!supabase) {
    return { data: null, error: null }
  }

  return supabase
    .from('allowed_users')
    .insert({
      email: email.toLowerCase(),
      role,
      active: true,
    })
    .select('id,email,role,active,created_at')
    .single<AllowedUser>()
}

export async function updateAllowedUser(
  id: string,
  updates: Partial<Pick<AllowedUser, 'role' | 'active'>>,
) {
  if (!supabase) {
    return { data: null, error: null }
  }

  return supabase
    .from('allowed_users')
    .update(updates)
    .eq('id', id)
    .select('id,email,role,active,created_at')
    .single<AllowedUser>()
}
