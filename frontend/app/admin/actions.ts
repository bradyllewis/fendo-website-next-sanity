'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

type AdminActionResult = { error?: string }

// ─── Auth helper ─────────────────────────────────────────────────────────────

async function requireAdmin(): Promise<{ userId: string } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthenticated' }

  const adminDb = createAdminClient()
  const { data: profile } = await adminDb
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') return { error: 'Forbidden' }
  return { userId: user.id }
}

// ─── User management ─────────────────────────────────────────────────────────

export async function updateUserRole(
  targetUserId: string,
  role: 'user' | 'admin',
): Promise<AdminActionResult> {
  const check = await requireAdmin()
  if ('error' in check) return { error: check.error }

  const adminDb = createAdminClient()
  const { error } = await adminDb
    .from('profiles')
    .update({ role })
    .eq('id', targetUserId)

  if (error) return { error: 'Failed to update role' }

  revalidatePath('/admin/users')
  revalidatePath(`/admin/users/${targetUserId}`)
  return {}
}

// ─── Registration management ──────────────────────────────────────────────────

export async function updateRegistrationStatus(
  registrationId: string,
  status: 'pending' | 'paid' | 'cancelled' | 'refunded' | 'waitlisted',
): Promise<AdminActionResult> {
  const check = await requireAdmin()
  if ('error' in check) return { error: check.error }

  const adminDb = createAdminClient()
  const { error } = await adminDb
    .from('event_registrations')
    .update({ status })
    .eq('id', registrationId)

  if (error) return { error: 'Failed to update status' }

  revalidatePath('/admin/registrations')
  return {}
}

export async function addRegistrationNote(
  registrationId: string,
  note: string,
): Promise<AdminActionResult> {
  const check = await requireAdmin()
  if ('error' in check) return { error: check.error }

  const trimmed = note.trim().slice(0, 500)
  const adminDb = createAdminClient()
  const { error } = await adminDb
    .from('event_registrations')
    .update({ notes: trimmed || null })
    .eq('id', registrationId)

  if (error) return { error: 'Failed to save note' }

  revalidatePath('/admin/registrations')
  return {}
}
