'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { format, parseISO } from 'date-fns'
import { client } from '@/sanity/lib/client'
import { eventRegistrationByIdQuery } from '@/sanity/lib/queries'
import { getEventEmailData } from '@/lib/email/eventEmailData'
import { sendEmail } from '@/lib/email/resend'
import { buildInviteEmail } from '@/lib/email/templates/invite'
import { buildTeamNotificationEmail } from '@/lib/email/templates/team-notification'
import {
  runAddPlayersToTeam,
  runCreateTeam,
  type AddPlayersInput,
  type CreateTeamInput,
  type TeamEventContext,
  type TeamWriteResult,
  type UnpaidSpot,
} from '@/lib/rosterCreate'

// Never re-export types from this file (`export type { … }`): the 'use server'
// transform emits every export-list name as a runtime reference, so a type-only
// name becomes an undefined identifier and every action on the page throws a
// ReferenceError. Import types from '@/lib/rosterCreate' instead.

export type TeamActionResult = {
  error?: string
  /** The error is the capacity check; resubmitting with confirmation will pass it. */
  overCapacity?: boolean
  /** Unpaid spots that need confirming; resubmitting with them will replace them. */
  unpaidSpots?: UnpaidSpot[]
  teamName?: string
  emailed?: number
}

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
  revalidatePath('/admin/tournaments')
  revalidatePath('/admin/registrations')
  revalidatePath('/admin/teams')
}

// ─── Event ──────────────────────────────────────────────────────────────────

/**
 * Resolves the event's live registration settings from Sanity and refuses
 * events a team cannot be added to. Events without in-app registration take
 * "spots filled" from a manual Sanity field, so a team added here would never
 * be counted against their capacity.
 */
async function resolveEvent(eventSanityId: string): Promise<TeamEventContext | { error: string }> {
  const event = await client
    .withConfig({ useCdn: false })
    .fetch(eventRegistrationByIdQuery, { id: eventSanityId })

  if (!event?.slug) return { error: 'Tournament not found' }
  if (!event.requiresRegistration) {
    return {
      error:
        'This tournament does not use on-site registration. Turn on "Requires Registration" in Sanity first.',
    }
  }
  if (event.status === 'cancelled') return { error: 'This tournament is cancelled' }

  return {
    eventSanityId,
    eventSlug: event.slug,
    entryFeeCents: event.entryFee ? Math.round(event.entryFee * 100) : 0,
    spotsTotal: event.spotsTotal ?? null,
  }
}

// ─── Emails ─────────────────────────────────────────────────────────────────

/**
 * Emails each new player: a confirmation when their spot is already settled,
 * or their personal payment link when they still owe the entry fee.
 * `sendEmail` logs failures and never throws, so the count is messages
 * dispatched, not verified delivery.
 */
async function emailNewPlayers(eventSanityId: string, result: TeamWriteResult): Promise<number> {
  const event = await getEventEmailData(eventSanityId)
  const teamType = result.format === 'duo' ? 'Duo' : 'Foursome'
  const db = createAdminClient()

  let sent = 0
  for (const p of result.players) {
    if (p.status === 'paid') {
      await sendEmail({
        to: p.email,
        subject: `You've been registered for ${event.title} — Fendo Golf`,
        html: buildTeamNotificationEmail({
          playerFirstName: p.firstName,
          captainName: null,
          eventTitle: event.title,
          eventDate: event.dateLong ?? '',
          eventLocation: event.location,
          teamName: result.teamName ?? '',
          teamType,
          siteUrl: event.siteUrl,
        }),
      })
    } else {
      await sendEmail({
        to: p.email,
        subject: `Your spot for ${event.title} is reserved — complete your payment`,
        html: buildInviteEmail({
          playerFirstName: p.firstName,
          captainName: null,
          teamName: result.teamName,
          eventTitle: event.title,
          eventDate: event.dateLong ?? '',
          eventLocation: event.location,
          teamType,
          amountDue: p.amountDueCents,
          expiresAt: format(parseISO(p.expiresAt), 'MMMM d, yyyy'),
          inviteUrl: `${event.siteUrl}/compete/invite/${p.inviteToken}`,
        }),
      })
      await db
        .from('registration_slots')
        .update({ email_sent_at: new Date().toISOString() })
        .eq('id', p.slotId)
    }
    sent++
  }
  return sent
}

// ─── Actions ────────────────────────────────────────────────────────────────

/** Creates a team from scratch on this tournament. */
export async function createTeam(
  eventSanityId: string,
  input: CreateTeamInput,
  notify: boolean,
): Promise<TeamActionResult> {
  const check = await requireAdmin()
  if ('error' in check) return { error: check.error }

  const ctx = await resolveEvent(eventSanityId)
  if ('error' in ctx) return { error: ctx.error }

  const result = await runCreateTeam(createAdminClient(), check.email, ctx, input)
  if (result.error) {
    return { error: result.error, overCapacity: result.overCapacity, unpaidSpots: result.unpaidSpots }
  }

  revalidateRoster(eventSanityId)
  const emailed = notify ? await emailNewPlayers(eventSanityId, result) : 0
  return { teamName: result.teamName, emailed }
}

/** Adds new players to an existing team on this tournament. */
export async function addPlayersToTeam(
  eventSanityId: string,
  input: AddPlayersInput,
  notify: boolean,
): Promise<TeamActionResult> {
  const check = await requireAdmin()
  if ('error' in check) return { error: check.error }

  const ctx = await resolveEvent(eventSanityId)
  if ('error' in ctx) return { error: ctx.error }

  const result = await runAddPlayersToTeam(createAdminClient(), check.email, ctx, input)
  if (result.error) {
    return { error: result.error, overCapacity: result.overCapacity, unpaidSpots: result.unpaidSpots }
  }

  revalidateRoster(eventSanityId)
  const emailed = notify ? await emailNewPlayers(eventSanityId, result) : 0
  return { teamName: result.teamName, emailed }
}
