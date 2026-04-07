---
name: stripe-idempotency-and-retries
description: Stripe idempotency keys and retry safety for all POST requests. Use this skill whenever writing any Stripe API call that creates or modifies a billable object (charges, payment intents, subscriptions, invoices, payouts), implementing retry logic after network failures, or preventing duplicate payments. This skill should be applied to every write-heavy Stripe code path — treat it as mandatory, not optional.
user-invocable: true
argument-hint: "[describe the Stripe write operation you're implementing]"
model: sonnet
effort: medium
---

# Stripe Idempotency and Retries

Prevent duplicate financial side effects. Every Stripe POST request that creates money movement or a billable object must use an idempotency key. This is not a nice-to-have — a missing idempotency key on a retry can double-charge a customer.

## Instructions

Apply these patterns to `$ARGUMENTS` — the specific Stripe write operation being implemented.

### What Idempotency Keys Do

Stripe caches the result of a POST request for 24 hours keyed by your `Idempotency-Key` header. If you retry the same request with the same key within that window, Stripe returns the cached response instead of executing the operation again. This means a network timeout followed by a retry will never create two charges if you use the same key.

### Key Generation Strategy

The key must be unique per *business action*, not per HTTP request. The right mental model: "if I retry this action, I want the same outcome, not a second one."

```javascript
// Pattern 1: UUID per action (generate once, store before the API call)
import { randomUUID } from 'crypto';

const idempotencyKey = randomUUID(); // generate BEFORE calling Stripe
// Store this key with the pending operation so retries reuse it
await db.pendingPayments.create({ idempotencyKey, userId, amount });
const paymentIntent = await stripe.paymentIntents.create(
  { amount, currency: 'usd', customer: customerId },
  { idempotencyKey }
);

// Pattern 2: Deterministic key from business context (no storage needed)
// Use when the combination of inputs uniquely identifies the action
const idempotencyKey = `order-${orderId}-payment`;
const paymentIntent = await stripe.paymentIntents.create(
  { amount, currency: 'usd', customer: customerId },
  { idempotencyKey }
);

// Pattern 3: For webhook-triggered actions, use the event ID
// Stripe event IDs are stable and unique — perfect idempotency key
const idempotencyKey = `evt-${event.id}-fulfill`;
```

**Deterministic keys are preferred** when the business context is stable — they survive process restarts and don't require a database lookup. Use UUID-based keys when the same action can legitimately happen multiple times (e.g., a customer can buy the same product twice — use order ID + attempt number).

### Retry Semantics

```javascript
async function stripeWithRetry(fn, { maxAttempts = 3, baseDelay = 500 } = {}) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      // Always retry on network errors — the idempotency key protects against duplicates
      const isRetryable =
        err.type === 'StripeConnectionError' ||
        err.type === 'StripeAPIError' ||
        err.statusCode === 429 || // rate limit
        err.statusCode >= 500;    // Stripe server error

      if (!isRetryable || attempt === maxAttempts) throw err;

      // Exponential backoff with jitter
      const delay = baseDelay * Math.pow(2, attempt - 1) + Math.random() * 100;
      await new Promise(r => setTimeout(r, delay));
    }
  }
}

// Usage — the idempotency key is generated OUTSIDE the retry loop
const idempotencyKey = `order-${orderId}-payment`;
const paymentIntent = await stripeWithRetry(
  () => stripe.paymentIntents.create(
    { amount, currency: 'usd', customer: customerId },
    { idempotencyKey }
  )
);
```

### What to Retry vs. What Not To

| Error type | Retry? | Why |
|------------|--------|-----|
| `StripeConnectionError` | Yes | Network issue, Stripe may not have received the request |
| `StripeAPIError` (5xx) | Yes | Transient Stripe server issue |
| Rate limit (429) | Yes | Back off and retry |
| `StripeCardError` | No | Card was declined — retrying won't help |
| `StripeInvalidRequestError` | No | Bad parameters — retrying will fail the same way |
| `StripeAuthenticationError` | No | Wrong API key — fix the config |

### Deduplication for Webhook-Driven Writes

When a webhook triggers a Stripe write (e.g., invoice paid → create payout), use the event ID as part of the idempotency key:

```javascript
// In your webhook handler
async function handleInvoicePaid(event) {
  const invoice = event.data.object;

  // Idempotency key derived from the event — safe to retry the webhook
  const key = `invoice-${invoice.id}-payout`;

  await stripe.transfers.create(
    { amount: invoice.amount_paid, currency: 'usd', destination: accountId },
    { idempotencyKey: key }
  );
}
```

### "Same Business Action" Rule

The most common mistake: generating a new idempotency key on every retry.

```javascript
// WRONG — new key on every call means no deduplication protection
async function chargeCustomer() {
  const key = randomUUID(); // inside the function = new key on every retry
  return stripe.paymentIntents.create({ ... }, { idempotencyKey: key });
}

// RIGHT — key is stable across retries
const key = `order-${orderId}-charge`; // or: generate once and persist
async function chargeCustomer() {
  return stripe.paymentIntents.create({ ... }, { idempotencyKey: key });
}
```

## Output Format

For each Stripe write operation in the user's code:
1. Show where the idempotency key should be generated and what strategy to use
2. Wrap the call with retry logic if the operation is in a background job or server action
3. Flag any existing code that creates keys inside retry loops

## Guidelines

- Keys do not need to be globally unique across all users — they are scoped to your Stripe account and expire after 24 hours. A per-action key like `order-{id}-payment` is sufficient.
- If a Stripe POST request does not use an idempotency key, flag it as a risk. The only POST requests that can safely omit keys are those that are inherently idempotent by business logic (rare).
- For operations in background job queues, store the idempotency key in the job payload at enqueue time, not inside the job handler.
