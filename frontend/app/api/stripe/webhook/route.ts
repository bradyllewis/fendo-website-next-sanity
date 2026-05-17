import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe/client'
import { createAdminClient } from '@/lib/supabase/admin'
import type Stripe from 'stripe'
import { sendEmail, getBaseUrl } from '@/lib/email/resend'
import { buildSlotConfirmationEmail } from '@/lib/email/templates/slot-confirmation'
import { buildTeamCompleteEmail } from '@/lib/email/templates/team-complete'
import { format, parseISO } from 'date-fns'

// Stripe requires the raw request body for signature verification
export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const body = await request.text()
  const signature = request.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 })
  }

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!,
    )
  } catch (err) {
    console.error('[webhook] Signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 400 })
  }

  const supabase = createAdminClient()

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session

        if (session.payment_status !== 'paid') break

        const meta = session.metadata as Record<string, string>

        // ── Sponsor checkout ───────────────────────────────────────────────────
        if (meta.type === 'sponsor') {
          const { data: existingSponsor } = await supabase
            .from('sponsor_registrations')
            .select('id, status')
            .eq('stripe_checkout_session_id', session.id)
            .maybeSingle()

          if (existingSponsor?.status === 'paid') {
            console.log(`[webhook] Sponsor session ${session.id} already paid — skipping`)
            break
          }

          const { data: updatedSponsor, error: sponsorUpdateError } = await supabase
            .from('sponsor_registrations')
            .update({
              status: 'paid',
              stripe_payment_intent_id: (session.payment_intent as string) ?? null,
              amount_paid: session.amount_total,
              currency: session.currency ?? 'usd',
            })
            .eq('stripe_checkout_session_id', session.id)
            .eq('status', 'pending')
            .select('id')

          if (sponsorUpdateError) {
            console.error('[webhook] Failed to update sponsor registration:', sponsorUpdateError)
            return NextResponse.json({ error: 'Failed to update sponsor registration' }, { status: 500 })
          }

          if (!updatedSponsor?.length) {
            console.warn(`[webhook] No pending sponsor row for session ${session.id} — skipping fallback insert`)
          } else {
            console.log(`[webhook] Confirmed paid sponsor registration / event ${meta.eventSlug}`)
          }
          break
        }

        // ── Slot payment (individual team self-pay) ────────────────────────────
        if (meta.type === 'slot') {
          const { registrationSlotId, teamId, userId, eventSanityId, eventSlug, teamName, inviteCode } = meta

          // Idempotency via registration_payments.stripe_event_id UNIQUE constraint
          const { data: existingPayment } = await supabase
            .from('registration_payments')
            .select('id')
            .eq('stripe_event_id', event.id)
            .maybeSingle()

          if (existingPayment) {
            console.log(`[webhook] Slot payment event ${event.id} already processed — skipping`)
            break
          }

          // Also guard against double-processing the slot itself
          const { data: slotCheck } = await supabase
            .from('registration_slots')
            .select('id, status, player_first_name, player_last_name, player_email, amount_due, team_id, event_slug, is_captain')
            .eq('id', registrationSlotId)
            .maybeSingle()

          if (!slotCheck) {
            console.error(`[webhook] Slot ${registrationSlotId} not found`)
            break
          }

          if (slotCheck.status === 'paid' || slotCheck.status === 'claimed') {
            console.log(`[webhook] Slot ${registrationSlotId} already paid — skipping`)
            break
          }

          // Mark slot as paid
          const { error: slotUpdateError } = await supabase
            .from('registration_slots')
            .update({
              status: 'paid',
              paid_at: new Date().toISOString(),
              stripe_checkout_session_id: session.id,
              stripe_payment_intent_id: (session.payment_intent as string) ?? null,
              stripe_customer_id: (session.customer as string) ?? null,
            })
            .eq('id', registrationSlotId)

          if (slotUpdateError) {
            console.error('[webhook] Failed to mark slot paid:', slotUpdateError)
            return NextResponse.json({ error: 'Failed to update slot' }, { status: 500 })
          }

          // Insert audit record (idempotent via unique stripe_event_id)
          await supabase
            .from('registration_payments')
            .insert({
              registration_slot_id: registrationSlotId,
              team_id: slotCheck.team_id,
              event_sanity_id: eventSanityId,
              stripe_event_id: event.id,
              stripe_checkout_session_id: session.id,
              stripe_payment_intent_id: (session.payment_intent as string) ?? null,
              stripe_customer_id: (session.customer as string) ?? null,
              amount: session.amount_total ?? slotCheck.amount_due,
              currency: session.currency ?? 'usd',
              status: 'succeeded',
              paid_at: new Date().toISOString(),
            })

          // Mirror to event_registrations for authenticated users (captain or claimed player)
          const mirrorUserId = userId ?? null
          if (mirrorUserId) {
            const { data: existingEventReg } = await supabase
              .from('event_registrations')
              .select('id, status')
              .eq('stripe_checkout_session_id', session.id)
              .maybeSingle()

            if (existingEventReg?.status === 'paid') {
              // Already handled (e.g., inline fulfillment on success page)
            } else if (existingEventReg) {
              await supabase
                .from('event_registrations')
                .update({
                  status: 'paid',
                  stripe_payment_intent_id: (session.payment_intent as string) ?? null,
                  amount_paid: session.amount_total,
                  currency: session.currency ?? 'usd',
                })
                .eq('id', existingEventReg.id)
            } else {
              const { data: insertedReg } = await supabase
                .from('event_registrations')
                .insert({
                  user_id: mirrorUserId,
                  event_sanity_id: eventSanityId,
                  event_slug: eventSlug,
                  event_title: meta.eventTitle ?? eventSlug,
                  event_date: meta.eventDate || null,
                  stripe_checkout_session_id: session.id,
                  stripe_payment_intent_id: (session.payment_intent as string) ?? null,
                  amount_paid: session.amount_total,
                  currency: session.currency ?? 'usd',
                  status: 'paid',
                  registration_type: slotCheck.is_captain ? 'duo' : 'team',
                  team_name: teamName ?? null,
                  team_id: slotCheck.team_id,
                  metadata: {
                    isTeamCaptain: slotCheck.is_captain,
                    paymentMode: 'individual',
                    inviteCode: inviteCode ?? null,
                    registrationSlotId,
                  },
                })
                .select('id')
                .maybeSingle()

              if (insertedReg) {
                // Link slot to event_registration
                await supabase
                  .from('registration_slots')
                  .update({ event_registration_id: insertedReg.id })
                  .eq('id', registrationSlotId)
              }
            }
          }

          // Recalculate team status
          const { data: allTeamSlots } = await supabase
            .from('registration_slots')
            .select('status')
            .eq('team_id', slotCheck.team_id)

          if (allTeamSlots) {
            const paid = allTeamSlots.filter((s) => s.status === 'paid' || s.status === 'claimed').length
            const total = allTeamSlots.length
            const active = allTeamSlots.filter((s) =>
              !['paid', 'claimed', 'expired', 'cancelled'].includes(s.status)
            ).length

            let newTeamStatus: string
            if (paid === total) {
              newTeamStatus = 'complete'
            } else if (paid > 0) {
              newTeamStatus = 'partially_paid'
            } else {
              newTeamStatus = active > 0 ? 'pending' : 'expired'
            }

            await supabase
              .from('teams')
              .update({ team_status: newTeamStatus })
              .eq('id', slotCheck.team_id)

            // Send confirmation email to the player who just paid
            const siteUrl = getBaseUrl()

            // Fetch team + event info for email
            const { data: teamData } = await supabase
              .from('teams')
              .select('team_name, registration_type, event_slug')
              .eq('id', slotCheck.team_id)
              .maybeSingle()

            const eventDate = meta.eventDate ? format(parseISO(meta.eventDate), 'EEEE, MMMM d, yyyy') : ''
            const claimUrl = `${siteUrl}/compete/invite/${
              // We need the token from the slot — re-fetch just the token
              (await supabase.from('registration_slots').select('invite_token').eq('id', registrationSlotId).maybeSingle())?.data?.invite_token ?? ''
            }/success`

            await sendEmail({
              to: slotCheck.player_email,
              subject: `You're registered — ${meta.eventTitle ?? eventSlug}`,
              html: buildSlotConfirmationEmail({
                playerFirstName: slotCheck.player_first_name,
                eventTitle: meta.eventTitle ?? eventSlug,
                eventDate,
                eventLocation: null,
                amountPaid: session.amount_total ?? slotCheck.amount_due,
                teamName: teamData?.team_name ?? teamName ?? '',
                captainName: '',
                claimUrl: slotCheck.is_captain ? `${siteUrl}/account` : claimUrl,
                siteUrl,
              }),
            }).catch((err) => console.error('[webhook] Confirmation email error:', err))

            // If all slots are now paid → send team-complete email to captain
            if (newTeamStatus === 'complete') {
              const { data: allSlotsWithDetails } = await supabase
                .from('registration_slots')
                .select('player_first_name, player_last_name, player_email, invited_by_user_id, is_captain')
                .eq('team_id', slotCheck.team_id)

              if (allSlotsWithDetails) {
                const captainSlot = allSlotsWithDetails.find((s) => s.is_captain)
                if (captainSlot?.invited_by_user_id) {
                  const { data: captainProfile } = await supabase
                    .from('profiles')
                    .select('full_name, email')
                    .eq('id', captainSlot.invited_by_user_id)
                    .maybeSingle()

                  if (captainProfile?.email) {
                    const captainFirstName = (captainProfile.full_name ?? 'Captain').split(' ')[0]
                    await sendEmail({
                      to: captainProfile.email,
                      subject: `Your team is complete — ${teamData?.team_name ?? ''}`,
                      html: buildTeamCompleteEmail({
                        captainFirstName,
                        teamName: teamData?.team_name ?? '',
                        eventTitle: meta.eventTitle ?? eventSlug,
                        eventDate,
                        eventLocation: null,
                        slots: allSlotsWithDetails.map((s) => ({
                          firstName: s.player_first_name,
                          lastName: s.player_last_name,
                          email: s.player_email,
                        })),
                        siteUrl,
                      }),
                    }).catch((err) => console.error('[webhook] Team-complete email error:', err))
                  }
                }
              }
            }
          }

          console.log(`[webhook] Confirmed paid slot ${registrationSlotId} / event ${eventSlug}`)
          break
        }

        // ── Standard player registration checkout ───────────────────────────
        const { userId, eventSanityId, eventSlug, eventTitle, eventDate } = meta

        const { data: existing } = await supabase
          .from('event_registrations')
          .select('id, status')
          .eq('stripe_checkout_session_id', session.id)
          .maybeSingle()

        if (existing?.status === 'paid') {
          console.log(`[webhook] Session ${session.id} already paid — skipping`)
          break
        }

        const { data: updatedRows, error: updateError } = await supabase
          .from('event_registrations')
          .update({
            status: 'paid',
            stripe_payment_intent_id: (session.payment_intent as string) ?? null,
            amount_paid: session.amount_total,
            currency: session.currency ?? 'usd',
          })
          .eq('stripe_checkout_session_id', session.id)
          .eq('status', 'pending')
          .select('id')
        const updatedCount = updatedRows?.length ?? 0

        if (updateError) {
          console.error('[webhook] Failed to update pending registration:', updateError)
          return NextResponse.json({ error: 'Failed to update registration' }, { status: 500 })
        }

        if ((updatedCount ?? 0) === 0) {
          console.warn(`[webhook] No pending row found for session ${session.id} — inserting directly`)
          const { error: insertError } = await supabase
            .from('event_registrations')
            .insert({
              user_id: userId,
              event_sanity_id: eventSanityId,
              event_slug: eventSlug,
              event_title: eventTitle,
              event_date: eventDate || null,
              stripe_checkout_session_id: session.id,
              stripe_payment_intent_id: (session.payment_intent as string) ?? null,
              amount_paid: session.amount_total,
              currency: session.currency ?? 'usd',
              status: 'paid',
            })

          if (insertError) {
            console.error('[webhook] Failed to insert registration:', insertError)
            return NextResponse.json({ error: 'Failed to create registration' }, { status: 500 })
          }
        }

        console.log(`[webhook] Confirmed paid registration for user ${userId} / event ${eventSlug}`)
        break
      }

      case 'checkout.session.expired': {
        const session = event.data.object as Stripe.Checkout.Session
        const meta = session.metadata as Record<string, string>

        if (meta?.type === 'sponsor') {
          await supabase
            .from('sponsor_registrations')
            .update({ status: 'cancelled' })
            .eq('stripe_checkout_session_id', session.id)
            .eq('status', 'pending')
        } else if (meta?.type === 'slot') {
          // Stripe session expired — reset slot back to 'invited' so the player can try again
          await supabase
            .from('registration_slots')
            .update({ status: 'invited', stripe_checkout_session_id: null })
            .eq('stripe_checkout_session_id', session.id)
            .in('status', ['payment_started', 'captain_pending'])
        } else {
          await supabase
            .from('event_registrations')
            .update({ status: 'cancelled' })
            .eq('stripe_checkout_session_id', session.id)
            .eq('status', 'pending')
        }

        break
      }

      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge

        if (charge.payment_intent) {
          await supabase
            .from('event_registrations')
            .update({ status: 'refunded' })
            .eq('stripe_payment_intent_id', charge.payment_intent as string)

          await supabase
            .from('sponsor_registrations')
            .update({ status: 'refunded' })
            .eq('stripe_payment_intent_id', charge.payment_intent as string)

          await supabase
            .from('registration_slots')
            .update({ status: 'cancelled' })
            .eq('stripe_payment_intent_id', charge.payment_intent as string)
        }

        break
      }

      default:
        break
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('[webhook] Handler error:', error)
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 })
  }
}
