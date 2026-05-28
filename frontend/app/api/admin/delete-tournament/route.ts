import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { stripe } from '@/lib/stripe/client'
import { sendEmail, getBaseUrl } from '@/lib/email/resend'
import { buildEventCancellationEmail } from '@/lib/email/templates/event-cancellation'
import { format } from 'date-fns'

// ─── Types ────────────────────────────────────────────────────────────────────

interface DeleteTournamentRequest {
  eventSanityId: string
  eventSlug: string
  eventTitle: string
  eventDate?: string | null
  sendEmails: boolean
  processRefunds: boolean
  skipSanityDeletion?: boolean
}

export interface DeleteTournamentResult {
  success: boolean
  refundsProcessed: number
  refundsFailed: number
  sessionsCancelled: number
  emailsSent: number
  emailsFailed: number
  recordsCancelled: number
  sanityDeleted: boolean
  errors: string[]
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

async function verifyAdmin(req: NextRequest): Promise<boolean> {
  const adminSecret = process.env.ADMIN_API_SECRET
  const headerSecret = req.headers.get('x-admin-secret')

  // Allow Studio calls via shared secret
  if (adminSecret && headerSecret && headerSecret === adminSecret) {
    return true
  }

  // Fall back to Supabase session (admin panel calls)
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return false

    const adminDb = createAdminClient()
    const { data: profile } = await adminDb
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    return profile?.role === 'admin'
  } catch {
    return false
  }
}

// ─── CORS (required for Studio cross-origin fetch) ────────────────────────────

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-admin-secret',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders })
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  const isAdmin = await verifyAdmin(req)
  if (!isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers: corsHeaders })
  }

  let body: DeleteTournamentRequest
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400, headers: corsHeaders })
  }

  const {
    eventSanityId,
    eventSlug,
    eventTitle,
    eventDate,
    sendEmails,
    processRefunds,
    skipSanityDeletion = false,
  } = body

  if (!eventSanityId || !eventTitle) {
    return NextResponse.json(
      { error: 'eventSanityId and eventTitle are required' },
      { status: 400, headers: corsHeaders },
    )
  }

  const db = createAdminClient()
  const results: DeleteTournamentResult = {
    success: false,
    refundsProcessed: 0,
    refundsFailed: 0,
    sessionsCancelled: 0,
    emailsSent: 0,
    emailsFailed: 0,
    recordsCancelled: 0,
    sanityDeleted: false,
    errors: [],
  }

  try {
    // ─── Step 1: Gather all affected records ──────────────────────────────────
    // Must happen before any mutations so we have the full picture.

    const [
      { data: paidRegistrations },
      { data: pendingRegistrations },
      { data: paidSlots },
      { data: openSlots },
      { data: paidSponsors },
      { data: pendingSponsors },
      { data: invoicedSponsors },
    ] = await Promise.all([
      db
        .from('event_registrations')
        .select('id, user_id, stripe_payment_intent_id, amount_paid')
        .eq('event_sanity_id', eventSanityId)
        .eq('status', 'paid')
        .not('stripe_payment_intent_id', 'is', null),

      db
        .from('event_registrations')
        .select('id, stripe_checkout_session_id')
        .eq('event_sanity_id', eventSanityId)
        .eq('status', 'pending')
        .not('stripe_checkout_session_id', 'is', null),

      db
        .from('registration_slots')
        .select('id, stripe_payment_intent_id, player_email, player_first_name, amount_due')
        .eq('event_sanity_id', eventSanityId)
        .eq('status', 'paid')
        .not('stripe_payment_intent_id', 'is', null),

      db
        .from('registration_slots')
        .select('id, stripe_checkout_session_id, status')
        .eq('event_sanity_id', eventSanityId)
        .in('status', ['invited', 'payment_started', 'captain_pending'])
        .not('stripe_checkout_session_id', 'is', null),

      db
        .from('sponsor_registrations')
        .select('id, stripe_payment_intent_id, email, primary_contact, amount_paid')
        .eq('event_sanity_id', eventSanityId)
        .eq('status', 'paid')
        .not('stripe_payment_intent_id', 'is', null),

      db
        .from('sponsor_registrations')
        .select('id, stripe_checkout_session_id')
        .eq('event_sanity_id', eventSanityId)
        .eq('status', 'pending')
        .not('stripe_checkout_session_id', 'is', null),

      // Invoiced sponsors: no Stripe session, just mark cancelled
      db
        .from('sponsor_registrations')
        .select('id, email, primary_contact')
        .eq('event_sanity_id', eventSanityId)
        .eq('status', 'invoiced'),
    ])

    // ─── Step 2: Resolve user emails for paid registrations ───────────────────

    type EmailRecipient = { email: string; name: string; refundAmount: number | null }
    const registrantEmails: EmailRecipient[] = []

    if ((paidRegistrations?.length ?? 0) > 0) {
      const userIds = paidRegistrations!.map((r) => r.user_id)
      const { data: profiles } = await db
        .from('profiles')
        .select('id, email, full_name')
        .in('id', userIds)

      const profileMap = new Map(profiles?.map((p) => [p.id, p]) ?? [])
      for (const reg of paidRegistrations!) {
        const profile = profileMap.get(reg.user_id)
        if (profile?.email) {
          registrantEmails.push({
            email: profile.email,
            name: profile.full_name || 'Member',
            refundAmount: processRefunds ? (reg.amount_paid ?? 0) : null,
          })
        }
      }
    }

    const slotEmails: EmailRecipient[] = (paidSlots ?? []).map((s) => ({
      email: s.player_email,
      name: s.player_first_name || 'Member',
      refundAmount: processRefunds ? (s.amount_due ?? 0) : null,
    }))

    const sponsorEmails: EmailRecipient[] = [
      ...(paidSponsors ?? []).map((s) => ({
        email: s.email,
        name: s.primary_contact || 'Sponsor',
        refundAmount: processRefunds ? (s.amount_paid ?? 0) : null,
      })),
      ...(invoicedSponsors ?? []).map((s) => ({
        email: s.email,
        name: s.primary_contact || 'Sponsor',
        refundAmount: null, // Invoiced — no Stripe charge to refund
      })),
    ]

    // ─── Step 3: Stripe refunds ───────────────────────────────────────────────
    // Only process refunds for confirmed paid records. Idempotent: catch
    // charge_already_refunded and count as success.

    if (processRefunds) {
      const refundTargets = [
        ...(paidRegistrations ?? []).map((r) => r.stripe_payment_intent_id!),
        ...(paidSlots ?? []).map((s) => s.stripe_payment_intent_id!),
        ...(paidSponsors ?? []).map((s) => s.stripe_payment_intent_id!),
      ]

      for (const paymentIntentId of refundTargets) {
        try {
          await stripe.refunds.create({ payment_intent: paymentIntentId })
          results.refundsProcessed++
        } catch (err: unknown) {
          const stripeErr = err as { code?: string; message?: string }
          if (stripeErr.code === 'charge_already_refunded') {
            results.refundsProcessed++ // Already refunded — count as success
          } else {
            results.refundsFailed++
            results.errors.push(
              `Refund failed for PI ${paymentIntentId}: ${stripeErr.message ?? 'unknown error'}`,
            )
          }
        }
      }
    }

    // ─── Step 4: Expire open checkout sessions ────────────────────────────────
    // Cancel pending/open Stripe sessions so no one can complete a payment
    // for a cancelled event.

    const openSessionIds = [
      ...(pendingRegistrations ?? [])
        .map((r) => r.stripe_checkout_session_id)
        .filter(Boolean) as string[],
      ...(openSlots ?? [])
        .map((s) => s.stripe_checkout_session_id)
        .filter(Boolean) as string[],
      ...(pendingSponsors ?? [])
        .map((s) => s.stripe_checkout_session_id)
        .filter(Boolean) as string[],
    ]

    for (const sessionId of openSessionIds) {
      try {
        await stripe.checkout.sessions.expire(sessionId)
        results.sessionsCancelled++
      } catch (err: unknown) {
        const stripeErr = err as { message?: string }
        // Sessions may already be expired/completed — not a critical failure
        if (
          !stripeErr.message?.includes('expired') &&
          !stripeErr.message?.includes('complete') &&
          !stripeErr.message?.includes('No such checkout.session')
        ) {
          results.errors.push(
            `Session expire failed (${sessionId}): ${stripeErr.message ?? 'unknown'}`,
          )
        }
      }
    }

    // ─── Step 5: Soft-cancel all Supabase records ─────────────────────────────
    // Preserves records for audit. Use 'refunded' status when refunds were
    // processed so the admin UI reflects the correct terminal state.

    const regFinalStatus = processRefunds ? 'refunded' : 'cancelled'
    const sponsorFinalStatus = processRefunds ? 'refunded' : 'cancelled'

    const [regUpdate, slotUpdate, teamUpdate, sponsorUpdate] = await Promise.all([
      db
        .from('event_registrations')
        .update({ status: regFinalStatus })
        .eq('event_sanity_id', eventSanityId)
        .neq('status', 'cancelled')
        .neq('status', 'refunded'),

      db
        .from('registration_slots')
        .update({ status: 'cancelled' })
        .eq('event_sanity_id', eventSanityId)
        .neq('status', 'cancelled')
        .neq('status', 'expired'),

      db
        .from('teams')
        .update({ team_status: 'cancelled' })
        .eq('event_sanity_id', eventSanityId)
        .neq('team_status', 'cancelled')
        .neq('team_status', 'expired'),

      db
        .from('sponsor_registrations')
        .update({ status: sponsorFinalStatus })
        .eq('event_sanity_id', eventSanityId)
        .neq('status', 'cancelled')
        .neq('status', 'refunded'),
    ])

    if (regUpdate.error) results.errors.push(`event_registrations update: ${regUpdate.error.message}`)
    if (slotUpdate.error) results.errors.push(`registration_slots update: ${slotUpdate.error.message}`)
    if (teamUpdate.error) results.errors.push(`teams update: ${teamUpdate.error.message}`)
    if (sponsorUpdate.error) results.errors.push(`sponsor_registrations update: ${sponsorUpdate.error.message}`)

    results.recordsCancelled =
      (paidRegistrations?.length ?? 0) +
      (pendingRegistrations?.length ?? 0) +
      (paidSlots?.length ?? 0) +
      (openSlots?.length ?? 0) +
      (paidSponsors?.length ?? 0) +
      (pendingSponsors?.length ?? 0) +
      (invoicedSponsors?.length ?? 0)

    // ─── Step 6: Send cancellation emails ────────────────────────────────────
    // Deduplicate by email address before sending. CTA points to /account
    // where users can see their updated registration status.

    if (sendEmails) {
      const siteUrl = getBaseUrl()
      const formattedDate = eventDate
        ? format(new Date(eventDate), 'EEEE, MMMM d, yyyy')
        : ''

      // Build deduped map: first occurrence wins (preserves refund amount)
      const emailMap = new Map<string, { name: string; refundAmount: number | null }>()
      for (const recipient of [...registrantEmails, ...slotEmails, ...sponsorEmails]) {
        if (recipient.email && !emailMap.has(recipient.email.toLowerCase())) {
          emailMap.set(recipient.email.toLowerCase(), {
            name: recipient.name,
            refundAmount: recipient.refundAmount,
          })
        }
      }

      for (const [email, { name, refundAmount }] of emailMap) {
        try {
          const html = buildEventCancellationEmail({
            recipientName: name,
            eventTitle,
            eventDate: formattedDate,
            eventLocation: eventSlug ? null : null, // Location not passed through; omit gracefully
            refundInfo: refundAmount && refundAmount > 0 ? { amountRefunded: refundAmount } : null,
            siteUrl,
          })

          await sendEmail({
            to: email,
            subject: `Event Cancelled: ${eventTitle}`,
            html,
          })

          results.emailsSent++
        } catch (err: unknown) {
          const e = err as { message?: string }
          results.emailsFailed++
          results.errors.push(`Email failed for ${email}: ${e.message ?? 'unknown'}`)
        }
      }
    }

    // ─── Step 7: Delete Sanity document ──────────────────────────────────────
    // Requires SANITY_API_WRITE_TOKEN with editor permissions. If not set,
    // the rest of the cleanup still succeeds — admin must delete in Studio.

    if (!skipSanityDeletion) {
      const writeToken = process.env.SANITY_API_WRITE_TOKEN
      const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID
      const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET ?? 'production'

      if (!writeToken) {
        results.errors.push(
          'SANITY_API_WRITE_TOKEN not configured — Sanity document was NOT deleted. ' +
            'All Supabase records and Stripe operations completed successfully. ' +
            'Please delete the event manually in Sanity Studio.',
        )
      } else {
        try {
          const mutations = {
            mutations: [
              { delete: { id: eventSanityId } },
              { delete: { id: `drafts.${eventSanityId}` } },
            ],
          }

          const sanityRes = await fetch(
            `https://${projectId}.api.sanity.io/v2021-06-07/data/mutate/${dataset}`,
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${writeToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(mutations),
            },
          )

          if (!sanityRes.ok) {
            const errText = await sanityRes.text()
            results.errors.push(`Sanity deletion failed (${sanityRes.status}): ${errText}`)
          } else {
            results.sanityDeleted = true
          }
        } catch (err: unknown) {
          const e = err as { message?: string }
          results.errors.push(`Sanity deletion error: ${e.message ?? 'unknown'}`)
        }
      }
    }

    results.success = true
    return NextResponse.json(results, { headers: corsHeaders })
  } catch (err: unknown) {
    const e = err as { message?: string }
    console.error('[delete-tournament] Unhandled error:', e)
    return NextResponse.json(
      { ...results, success: false, error: 'Internal server error', details: e.message },
      { status: 500, headers: corsHeaders },
    )
  }
}
