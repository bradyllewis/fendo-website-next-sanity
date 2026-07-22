'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { refundPaymentIntent } from '@/lib/stripe/refund'
import { revalidatePath } from 'next/cache'
import { format, parseISO } from 'date-fns'
import {
  getTournamentRoster,
  isUnpaidSlotMember,
  UNPAID_SLOT_STATUSES,
  type RosterMemberSource,
} from '@/lib/tournamentRoster'
import { getEventEmailData } from '@/lib/email/eventEmailData'
import { sendEmail } from '@/lib/email/resend'
import { buildTournamentReminderEmail } from '@/lib/email/templates/tournament-reminder'
import { buildPaymentPendingReminderEmail } from '@/lib/email/templates/payment-pending-reminder'

export type AdminActionResult = { error?: string; refundError?: string }
export type ReminderResult = { error?: string; sent?: number }

// ─── Auth ─────────────────────────────────────────────────────────────────────

async function requireAdmin(): Promise<{ ok: true } | { error: string }> {
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
  return { ok: true }
}

function revalidateRoster(eventSanityId: string) {
  revalidatePath(`/admin/tournaments/${eventSanityId}/teams`)
  revalidatePath('/admin/registrations')
  revalidatePath('/admin/teams')
}

// ─── Types ──────────────────────────────────────────────────────────────────

interface MemberRef {
  sourceTable: RosterMemberSource
  sourceId: string
  linkedRegistrationId: string | null
  paymentIntentId?: string | null
}

interface MemberFields {
  firstName: string
  lastName: string
  email: string
  shirtSize: string | null
}

// ─── Team name ────────────────────────────────────────────────────────────────

export async function updateTeamName(
  eventSanityId: string,
  teamId: string,
  newName: string,
): Promise<AdminActionResult> {
  const check = await requireAdmin()
  if ('error' in check) return { error: check.error }

  const trimmed = newName.trim()
  if (!trimmed) return { error: 'Team name cannot be empty' }

  const db = createAdminClient()
  const { error: teamErr } = await db.from('teams').update({ team_name: trimmed }).eq('id', teamId)
  if (teamErr) return { error: 'Failed to update team name' }

  // Keep the denormalized snapshot on registration rows in sync.
  await db.from('event_registrations').update({ team_name: trimmed }).eq('team_id', teamId)

  revalidateRoster(eventSanityId)
  return {}
}

// ─── Member edit ──────────────────────────────────────────────────────────────

/**
 * Apply name/email/shirt-size edits to one registration row. Writes the PII
 * columns AND merges `metadata` (shirt size lives only in metadata; name/email
 * are mirrored there too so any metadata-driven views stay consistent).
 */
async function applyMemberUpdate(
  db: ReturnType<typeof createAdminClient>,
  table: RosterMemberSource,
  id: string,
  fields: MemberFields,
): Promise<string | null> {
  const { data: existing } = await db.from(table).select('metadata').eq('id', id).maybeSingle()
  const currentMeta =
    existing && typeof existing.metadata === 'object' && existing.metadata !== null
      ? (existing.metadata as Record<string, unknown>)
      : {}

  const mergedMeta: Record<string, unknown> = {
    ...currentMeta,
    name: `${fields.firstName} ${fields.lastName}`.trim(),
    email: fields.email,
    shirtSize: fields.shirtSize ?? null,
  }

  const { error } = await db
    .from(table)
    .update({
      player_first_name: fields.firstName,
      player_last_name: fields.lastName,
      player_email: fields.email,
      metadata: mergedMeta,
    })
    .eq('id', id)

  return error ? error.message : null
}

export async function updateMember(
  eventSanityId: string,
  member: MemberRef,
  fields: MemberFields,
): Promise<AdminActionResult> {
  const check = await requireAdmin()
  if ('error' in check) return { error: check.error }

  if (!fields.firstName.trim() || !fields.lastName.trim()) {
    return { error: 'First and last name are required' }
  }
  if (!fields.email.trim()) return { error: 'Email is required' }

  const normalized: MemberFields = {
    firstName: fields.firstName.trim(),
    lastName: fields.lastName.trim(),
    email: fields.email.trim().toLowerCase(),
    shirtSize: fields.shirtSize?.trim() || null,
  }

  const db = createAdminClient()
  const err = await applyMemberUpdate(db, member.sourceTable, member.sourceId, normalized)
  if (err) return { error: 'Failed to update member' }

  // Keep the mirrored ledger row in sync for individual-pay slot members.
  if (member.sourceTable === 'registration_slots' && member.linkedRegistrationId) {
    await applyMemberUpdate(db, 'event_registrations', member.linkedRegistrationId, normalized)
  }

  revalidateRoster(eventSanityId)
  return {}
}

// ─── Cancellation ─────────────────────────────────────────────────────────────

export async function cancelMember(
  eventSanityId: string,
  member: MemberRef,
  refund: boolean,
): Promise<AdminActionResult> {
  const check = await requireAdmin()
  if ('error' in check) return { error: check.error }

  const db = createAdminClient()
  const result: AdminActionResult = {}

  if (refund && member.paymentIntentId) {
    const r = await refundPaymentIntent(member.paymentIntentId)
    if (!r.ok) result.refundError = r.error
  }

  const refunded = refund && !!member.paymentIntentId && !result.refundError

  if (member.sourceTable === 'registration_slots') {
    const { error } = await db
      .from('registration_slots')
      .update({ status: 'cancelled' })
      .eq('id', member.sourceId)
    if (error) return { ...result, error: 'Failed to cancel member' }

    if (member.linkedRegistrationId) {
      await db
        .from('event_registrations')
        .update({ status: refunded ? 'refunded' : 'cancelled' })
        .eq('id', member.linkedRegistrationId)
    }
  } else {
    const { error } = await db
      .from('event_registrations')
      .update({ status: refunded ? 'refunded' : 'cancelled' })
      .eq('id', member.sourceId)
    if (error) return { ...result, error: 'Failed to cancel member' }
  }

  revalidateRoster(eventSanityId)
  return result
}

export async function cancelTeam(
  eventSanityId: string,
  teamId: string,
  refund: boolean,
): Promise<AdminActionResult> {
  const check = await requireAdmin()
  if ('error' in check) return { error: check.error }

  const db = createAdminClient()
  const result: AdminActionResult = {}

  const [slotsRes, regsRes] = await Promise.all([
    db
      .from('registration_slots')
      .select('id, stripe_payment_intent_id')
      .eq('team_id', teamId)
      .not('status', 'in', '("cancelled","expired")'),
    db
      .from('event_registrations')
      .select('id, stripe_payment_intent_id')
      .eq('team_id', teamId)
      .not('status', 'in', '("cancelled","refunded")'),
  ])

  const slots = slotsRes.data ?? []
  const regs = regsRes.data ?? []

  let refundFailures = 0
  if (refund) {
    const intents = new Set<string>()
    for (const s of slots) if (s.stripe_payment_intent_id) intents.add(s.stripe_payment_intent_id)
    for (const r of regs) if (r.stripe_payment_intent_id) intents.add(r.stripe_payment_intent_id)
    for (const pi of intents) {
      const res = await refundPaymentIntent(pi)
      if (!res.ok) refundFailures++
    }
    if (refundFailures > 0) result.refundError = `${refundFailures} refund(s) failed`
  }

  const regStatus = refund && refundFailures === 0 ? 'refunded' : 'cancelled'

  const [slotUpdate, regUpdate, teamUpdate] = await Promise.all([
    db
      .from('registration_slots')
      .update({ status: 'cancelled' })
      .eq('team_id', teamId)
      .not('status', 'in', '("cancelled","expired")'),
    db
      .from('event_registrations')
      .update({ status: regStatus })
      .eq('team_id', teamId)
      .not('status', 'in', '("cancelled","refunded")'),
    db.from('teams').update({ team_status: 'cancelled' }).eq('id', teamId),
  ])

  if (slotUpdate.error || regUpdate.error || teamUpdate.error) {
    return { ...result, error: 'Failed to cancel team' }
  }

  revalidateRoster(eventSanityId)
  return result
}

// ─── Reminder emails ────────────────────────────────────────────────────────
//
// Recipients are always re-derived server-side from `getTournamentRoster`, the
// same deduped grouping used everywhere else — never a client-passed email list.
// `sendEmail` is fire-and-forget (it logs Resend errors and returns void), so
// `sent` reflects how many messages were dispatched, not verified delivery.

/**
 * Send an "upcoming tournament" reminder to every active member of a team, or
 * to a single solo registrant. Deduplicates recipients by email address.
 */
export async function sendTournamentReminder(
  eventSanityId: string,
  target: { teamId: string } | { soloSourceId: string },
): Promise<ReminderResult> {
  const check = await requireAdmin()
  if ('error' in check) return { error: check.error }

  const roster = await getTournamentRoster(eventSanityId)
  const entry =
    'teamId' in target
      ? roster.find((e) => e.kind === 'team' && e.teamId === target.teamId)
      : roster.find((e) => e.kind === 'solo' && e.members[0]?.sourceId === target.soloSourceId)

  if (!entry) return { error: 'Registration not found' }

  // Dedup recipients by lowercased email (first occurrence keeps its first name).
  const recipients = new Map<string, string>()
  for (const m of entry.members) {
    const email = m.email?.trim().toLowerCase()
    if (email && !recipients.has(email)) recipients.set(email, m.firstName)
  }
  if (recipients.size === 0) return { error: 'No valid email addresses to send to' }

  const event = await getEventEmailData(eventSanityId)

  let sent = 0
  for (const [email, firstName] of recipients) {
    await sendEmail({
      to: email,
      subject: `Reminder: ${event.title} is coming up`,
      html: buildTournamentReminderEmail({
        playerFirstName: firstName,
        eventTitle: event.title,
        eventDate: event.dateLong,
        eventLocation: event.location,
        siteUrl: event.siteUrl,
      }),
    })
    sent++
  }

  return { sent }
}

/**
 * Send a "payment still pending" reminder to a team's unpaid slot members.
 * Scoped to unpaid `registration_slots` — the only members with a per-member
 * pay link. Re-verifies unpaid status and a usable invite token server-side.
 */
export async function sendPaymentReminders(
  eventSanityId: string,
  teamId: string,
): Promise<ReminderResult> {
  const check = await requireAdmin()
  if ('error' in check) return { error: check.error }

  const roster = await getTournamentRoster(eventSanityId)
  const entry = roster.find((e) => e.kind === 'team' && e.teamId === teamId)
  if (!entry) return { error: 'Team not found' }

  const unpaidSlotIds = entry.members.filter(isUnpaidSlotMember).map((m) => m.sourceId)
  if (unpaidSlotIds.length === 0) return { error: 'No unpaid members to remind' }

  const db = createAdminClient()
  const { data: slots } = await db
    .from('registration_slots')
    .select('id, player_first_name, player_email, amount_due, invite_token, expires_at, status')
    .in('id', unpaidSlotIds)

  const event = await getEventEmailData(eventSanityId)

  let sent = 0
  for (const s of slots ?? []) {
    if (!s.invite_token || !s.player_email) continue
    if (!(UNPAID_SLOT_STATUSES as readonly string[]).includes(s.status)) continue

    const expiresAt = s.expires_at ? format(parseISO(s.expires_at), 'MMMM d, yyyy') : null

    await sendEmail({
      to: s.player_email,
      subject: `Payment reminder: your spot for ${event.title}`,
      html: buildPaymentPendingReminderEmail({
        playerFirstName: s.player_first_name ?? '',
        teamName: entry.teamName,
        eventTitle: event.title,
        eventDate: event.dateLong,
        amountDue: s.amount_due ?? 0,
        expiresAt,
        payUrl: `${event.siteUrl}/compete/invite/${s.invite_token}`,
        siteUrl: event.siteUrl,
      }),
    })
    sent++
  }

  if (sent === 0) return { error: 'No unpaid members with a valid payment link' }
  return { sent }
}
