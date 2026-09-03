'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import {
  runMovePlayers,
  runSetTeamCaptain,
  type MemberRef,
  type MoveDestination,
  type MoveOptions,
  type MoveResult,
} from '@/lib/rosterMoves'

export type { MemberRef, MoveDestination, MoveOptions, MoveResult }

// ─── Auth ───────────────────────────────────────────────────────────────────

async function requireAdmin(): Promise<{ ok: true; email: string } | { error: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthenticated' }

  const adminDb = createAdminClient()
  const { data: profile } = await adminDb
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') return { error: 'Forbidden' }
  return { ok: true, email: user.email ?? 'unknown admin' }
}

function revalidateRoster(eventSanityId: string) {
  revalidatePath(`/admin/tournaments/${eventSanityId}/teams`)
  revalidatePath('/admin/registrations')
  revalidatePath('/admin/teams')
}

// ─── Actions ────────────────────────────────────────────────────────────────

/**
 * Moves players to another team, a new team, or a solo entry.
 * Authentication and cache revalidation live here; the move logic itself is in
 * `lib/rosterMoves.ts`.
 */
export async function movePlayers(
  eventSanityId: string,
  members: MemberRef[],
  destination: MoveDestination,
  options: MoveOptions,
): Promise<MoveResult> {
  const check = await requireAdmin()
  if ('error' in check) return { error: check.error, moved: 0, failed: [], notes: [] }

  const result = await runMovePlayers(
    createAdminClient(),
    check.email,
    eventSanityId,
    members,
    destination,
    options,
  )

  if (!result.error) revalidateRoster(eventSanityId)
  return result
}

/** Reassigns a team's captain without moving anyone. */
export async function setTeamCaptain(
  eventSanityId: string,
  teamId: string,
  member: MemberRef,
): Promise<{ error?: string }> {
  const check = await requireAdmin()
  if ('error' in check) return { error: check.error }

  const result = await runSetTeamCaptain(createAdminClient(), eventSanityId, teamId, member)

  if (!result.error) revalidateRoster(eventSanityId)
  return result
}
