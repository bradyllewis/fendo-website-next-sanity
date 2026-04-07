---
name: stripe-webhooks-and-event-processing
description: Stripe webhook endpoint setup, event verification, and idempotent event processing. Use this skill whenever setting up a webhook endpoint, handling any Stripe event (payment_intent.succeeded, invoice.paid, customer.subscription.updated, etc.), building post-payment fulfillment, or syncing Stripe state to a local database. Webhooks are the backbone of subscriptions, fulfillment, and Connect — invoke this skill before building any of those features.
user-invocable: true
argument-hint: "[describe the webhook endpoint or events you need to handle]"
model: sonnet
effort: high
---

# Stripe Webhooks and Event Processing

Own all async Stripe event ingestion. In a correct Stripe integration, webhooks drive state transitions — not API polling, not synchronous redirects alone. This skill defines the full pattern from endpoint setup through idempotent event handling to database sync.

## Instructions

Analyze `$ARGUMENTS` to understand which events need to be handled and what downstream actions they trigger. Then implement the full webhook pipeline.

### Endpoint Setup and Signature Verification

Always verify the Stripe signature before processing any event. An unverified webhook endpoint is an open door for spoofed events.

```javascript
// Express example
import express from 'express';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

// CRITICAL: webhook route must use raw body, NOT parsed JSON
app.post('/webhooks/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Acknowledge receipt immediately — Stripe expects a 2xx within 30 seconds
  res.status(200).json({ received: true });

  // Process asynchronously (don't await here if processing is slow)
  await processEvent(event).catch(err => {
    console.error(`Failed to process event ${event.id}:`, err);
  });
});
```

**Next.js App Router:**
```javascript
// app/api/webhooks/stripe/route.ts
import { headers } from 'next/headers';
import Stripe from 'stripe';

export async function POST(request: Request) {
  const body = await request.text(); // raw body required
  const signature = headers().get('stripe-signature')!;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    return new Response(`Webhook error: ${err.message}`, { status: 400 });
  }

  await processEvent(event);
  return new Response(JSON.stringify({ received: true }));
}
```

### Idempotent Event Processing

Stripe may deliver the same event more than once. Every handler must be safe to run multiple times with the same event ID.

```javascript
async function processEvent(event: Stripe.Event) {
  // Deduplication: check if we've already processed this event
  const existing = await db.processedEvents.findUnique({ where: { stripeEventId: event.id } });
  if (existing) {
    console.log(`Event ${event.id} already processed, skipping`);
    return;
  }

  // Route to the right handler
  switch (event.type) {
    case 'payment_intent.succeeded':
      await handlePaymentSucceeded(event.data.object as Stripe.PaymentIntent);
      break;
    case 'invoice.paid':
      await handleInvoicePaid(event.data.object as Stripe.Invoice);
      break;
    case 'customer.subscription.updated':
      await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
      break;
    case 'customer.subscription.deleted':
      await handleSubscriptionCanceled(event.data.object as Stripe.Subscription);
      break;
    default:
      console.log(`Unhandled event type: ${event.type}`);
  }

  // Record that this event was processed
  await db.processedEvents.create({
    data: { stripeEventId: event.id, type: event.type, processedAt: new Date() }
  });
}
```

**Database schema for event deduplication:**
```sql
CREATE TABLE stripe_processed_events (
  id            SERIAL PRIMARY KEY,
  stripe_event_id VARCHAR(255) UNIQUE NOT NULL,
  event_type    VARCHAR(100) NOT NULL,
  processed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX ON stripe_processed_events (stripe_event_id);
```

### Event-to-Domain Mapping

The most important events for common integration patterns:

| Event | When it fires | What to do |
|-------|--------------|------------|
| `payment_intent.succeeded` | One-time payment completed | Fulfill order, provision access, send receipt |
| `payment_intent.payment_failed` | Payment declined | Notify user, surface retry UI |
| `invoice.paid` | Subscription renewed or invoice settled | Extend access, record payment |
| `invoice.payment_failed` | Subscription renewal failed | Start dunning, notify user |
| `invoice.payment_action_required` | 3DS authentication needed | Notify user to complete auth |
| `customer.subscription.created` | New subscription started | Provision features/access |
| `customer.subscription.updated` | Plan changed, trial ended, status changed | Sync local subscription record |
| `customer.subscription.deleted` | Subscription canceled or expired | Revoke access |
| `customer.subscription.trial_will_end` | 3 days before trial ends | Send trial conversion email |
| `checkout.session.completed` | Checkout session finished | Fulfill (check `payment_status`) |
| `charge.dispute.created` | Chargeback opened | Alert ops team, start evidence collection |

### Replay Tolerance

Design handlers so they produce the same outcome if run again with old data:

```javascript
async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  // Use upsert, not insert — safe to replay
  await db.subscriptions.upsert({
    where: { stripeSubscriptionId: subscription.id },
    update: {
      status: subscription.status,
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      updatedAt: new Date()
    },
    create: {
      stripeSubscriptionId: subscription.id,
      stripeCustomerId: subscription.customer as string,
      status: subscription.status,
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      cancelAtPeriodEnd: subscription.cancel_at_period_end
    }
  });
}
```

### Local Development with Stripe CLI

```bash
# Install Stripe CLI, then forward events to your local server
stripe listen --forward-to localhost:3000/webhooks/stripe

# The CLI outputs your local webhook secret — use it as STRIPE_WEBHOOK_SECRET in dev
# > Ready! Your webhook signing secret is whsec_...

# Trigger a specific event for testing
stripe trigger payment_intent.succeeded
stripe trigger customer.subscription.updated
```

## Output Format

For webhook setup tasks:
1. The endpoint handler with raw body parsing and signature verification
2. The event router (`switch` on `event.type`)
3. Individual handler functions for each relevant event
4. The deduplication table schema
5. Local dev setup instructions (Stripe CLI)

## Guidelines

- Never process webhook events before verifying the signature — treat unverified events as untrusted input
- Always respond 2xx immediately; move slow processing to a background queue if needed. Stripe retries on non-2xx responses.
- Use upsert patterns in handlers, not insert — the same event may arrive out of order or multiple times
- Do not rely solely on the checkout success redirect for fulfillment — the redirect can fail or be skipped. Webhooks are the authoritative fulfillment trigger.
- Log the event ID and type at the start of each handler — it makes debugging much easier
