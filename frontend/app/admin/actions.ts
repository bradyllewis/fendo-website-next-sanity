'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { recalcTeamStatus } from '@/lib/rosterMoves'

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

/** Matches the slot behind a registration row, through either link direction. */
function linkedSlotFilter(registrationId: string, slotId: string | null): string {
  return slotId
    ? `id.eq.${slotId},event_registration_id.eq.${registrationId}`
    : `event_registration_id.eq.${registrationId}`
}

/**
 * Finishes cancelling a registration row. A team player's seat comes from their
 * `registration_slots` row, so cancelling only the ledger row would leave them
 * active on the roster while this page shows them as cancelled.
 */
async function releaseCancelledPlayer(
  adminDb: ReturnType<typeof createAdminClient>,
  registrationId: string,
): Promise<string | null> {
  const { data: reg } = await adminDb
    .from('event_registrations')
    .select('event_sanity_id, team_id, registration_slot_id')
    .eq('id', registrationId)
    .single()
  if (!reg) return 'Registration not found'

  const { error } = await adminDb
    .from('registration_slots')
    .update({ status: 'cancelled' })
    .or(linkedSlotFilter(registrationId, reg.registration_slot_id))
    .not('status', 'in', '("cancelled","expired")')
  if (error) return 'Failed to release their team spot'

  if (reg.team_id) await recalcTeamStatus(adminDb, reg.team_id)

  revalidatePath(`/admin/tournaments/${reg.event_sanity_id}/teams`)
  revalidatePath('/admin/teams')
  return null
}

export async function updateRegistrationStatus(
  registrationId: string,
  status: 'pending' | 'paid' | 'cancelled' | 'refunded' | 'waitlisted',
): Promise<AdminActionResult> {
  const check = await requireAdmin()
  if ('error' in check) return { error: check.error }

  const adminDb = createAdminClient()
  const cancelling = status === 'cancelled' || status === 'refunded'

  // A mirror row can't bring a released slot back: the player would show as
  // registered here while missing from the roster and seat count.
  if (!cancelling) {
    const { data: reg } = await adminDb
      .from('event_registrations')
      .select('registration_slot_id')
      .eq('id', registrationId)
      .single()
    const { data: slots } = await adminDb
      .from('registration_slots')
      .select('status')
      .or(linkedSlotFilter(registrationId, reg?.registration_slot_id ?? null))
    if (slots?.some((s) => s.status === 'cancelled' || s.status === 'expired')) {
      return { error: 'Their team spot was released. Add them again from the tournament roster.' }
    }
  }

  const { error } = await adminDb
    .from('event_registrations')
    .update({ status })
    .eq('id', registrationId)

  if (error) return { error: 'Failed to update status' }

  if (cancelling) {
    const releaseError = await releaseCancelledPlayer(adminDb, registrationId)
    if (releaseError) return { error: releaseError }
  }

  revalidatePath('/admin/registrations')
  return {}
}

// ─── Sponsorship management ───────────────────────────────────────────────────

export async function updateSponsorshipStatus(
  sponsorshipId: string,
  status: string,
): Promise<AdminActionResult> {
  const check = await requireAdmin()
  if ('error' in check) return { error: check.error }

  const validStatuses = ['pending', 'paid', 'invoiced', 'cancelled', 'refunded']
  if (!validStatuses.includes(status)) return { error: 'Invalid status' }

  const adminDb = createAdminClient()
  const { error } = await adminDb
    .from('sponsor_registrations')
    .update({ status })
    .eq('id', sponsorshipId)

  if (error) return { error: 'Failed to update status' }

  revalidatePath('/admin/sponsorships')
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

export async function unregisterUser(
  registrationId: string,
  reason?: string,
): Promise<AdminActionResult> {
  const check = await requireAdmin()
  if ('error' in check) return { error: check.error }

  const adminDb = createAdminClient()

  // Verify the registration exists and isn't already cancelled/refunded
  const { data: reg } = await adminDb
    .from('event_registrations')
    .select('id, status, user_id')
    .eq('id', registrationId)
    .single()

  if (!reg) return { error: 'Registration not found' }
  if (reg.status === 'cancelled' || reg.status === 'refunded') {
    return { error: 'Registration is already cancelled or refunded' }
  }

  const trimmedReason = reason?.trim().slice(0, 500) || null
  const { error } = await adminDb
    .from('event_registrations')
    .update({ status: 'cancelled', notes: trimmedReason })
    .eq('id', registrationId)

  if (error) return { error: 'Failed to cancel registration' }

  const releaseError = await releaseCancelledPlayer(adminDb, registrationId)
  if (releaseError) return { error: releaseError }

  revalidatePath('/admin/registrations')
  revalidatePath(`/admin/users/${reg.user_id}`)
  return {}
}
