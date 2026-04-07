---
name: stripe-billing-and-subscriptions
description: Stripe recurring billing and subscription lifecycle. Use this skill whenever implementing subscriptions, free trials, plan upgrades or downgrades, usage-based billing, subscription cancellation, dunning (payment failure handling), proration, or billing intervals. This is the most important specialized Stripe skill for SaaS apps — invoke it any time recurring revenue is part of the problem.
user-invocable: true
argument-hint: "[describe the subscription model or billing scenario]"
model: sonnet
effort: high
---

# Stripe Billing and Subscriptions

Implement recurring revenue correctly. Subscriptions have a full lifecycle — creation, trials, renewals, upgrades, failures, and cancellations — and each stage has specific Stripe patterns and webhook events. This skill owns all of them.

## Instructions

Analyze `$ARGUMENTS` to understand the subscription model. Implement the relevant lifecycle stages.

### Creating a Subscription

**Via Checkout (recommended for new users):**

```javascript
const session = await stripe.checkout.sessions.create({
  mode: 'subscription',
  line_items: [{ price: 'price_monthly_pro', quantity: 1 }],
  customer: customerId,
  subscription_data: {
    trial_period_days: 14, // optional trial
    metadata: { plan: 'pro' },
  },
  success_url: `${BASE_URL}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
  cancel_url: `${BASE_URL}/pricing`,
});
```

**Via API (for existing customers with saved payment method):**

```javascript
const subscription = await stripe.subscriptions.create(
  {
    customer: customerId,
    items: [{ price: 'price_monthly_pro' }],
    default_payment_method: paymentMethodId,
    trial_period_days: 14,
    metadata: { plan: 'pro', user_id: userId },
  },
  { idempotencyKey: `sub-create-${userId}-pro` }
);
```

### Product and Price Setup

```javascript
// Create products once; create prices per billing variant
const product = await stripe.products.create({
  name: 'Pro Plan',
  metadata: { plan_key: 'pro' },
});

const monthlyPrice = await stripe.prices.create({
  product: product.id,
  unit_amount: 2900, // $29/month
  currency: 'usd',
  recurring: { interval: 'month' },
  nickname: 'Pro Monthly',
});

const annualPrice = await stripe.prices.create({
  product: product.id,
  unit_amount: 29000, // $290/year (2 months free)
  currency: 'usd',
  recurring: { interval: 'year' },
  nickname: 'Pro Annual',
});
```

### Lifecycle Webhook Events

Set up handlers for these events (see `stripe-webhooks-and-event-processing`):

```javascript
switch (event.type) {
  case 'customer.subscription.created':
    await provisionAccess(subscription); // grant features
    break;

  case 'customer.subscription.updated': {
    // Covers: plan changes, trial ended → active, payment failures → past_due
    const sub = event.data.object as Stripe.Subscription;
    await syncSubscription(sub); // upsert to your DB
    if (sub.status === 'active' && event.data.previous_attributes?.status === 'trialing') {
      await onTrialConverted(sub); // trial → paid conversion event
    }
    break;
  }

  case 'customer.subscription.deleted':
    await revokeAccess(subscription.customer); // subscription ended
    break;

  case 'customer.subscription.trial_will_end':
    await sendTrialEndingEmail(subscription); // fires 3 days before trial ends
    break;

  case 'invoice.paid':
    await recordPayment(invoice); // extend access, log receipt
    break;

  case 'invoice.payment_failed':
    await startDunning(invoice); // notify user, start retry sequence
    break;

  case 'invoice.payment_action_required':
    await notifyActionRequired(invoice); // 3DS needed
    break;
}
```

### Plan Upgrades and Downgrades

```javascript
// Upgrade immediately with prorated credit for unused time
const updatedSub = await stripe.subscriptions.update(
  subscriptionId,
  {
    items: [{
      id: subscription.items.data[0].id,
      price: 'price_annual_pro', // new price
    }],
    proration_behavior: 'create_prorations', // generate prorated invoice
  },
  { idempotencyKey: `sub-upgrade-${subscriptionId}-${newPriceId}` }
);

// Downgrade at period end (no immediate proration)
await stripe.subscriptions.update(subscriptionId, {
  items: [{ id: subscription.items.data[0].id, price: 'price_monthly_starter' }],
  proration_behavior: 'none',
  billing_cycle_anchor: 'unchanged',
});
```

### Cancellation

```javascript
// Cancel at period end (user keeps access until billing period expires)
await stripe.subscriptions.update(subscriptionId, {
  cancel_at_period_end: true,
});

// Cancel immediately (rare — only for refund+cancel scenarios)
await stripe.subscriptions.cancel(subscriptionId);

// In your DB, reflect this from the webhook (customer.subscription.updated)
// Do NOT revoke access immediately on cancel_at_period_end —
// wait for customer.subscription.deleted
```

### Free Trials

```javascript
// Trial with credit card upfront (higher conversion, prevents abuse)
const session = await stripe.checkout.sessions.create({
  mode: 'subscription',
  line_items: [{ price: 'price_pro', quantity: 1 }],
  subscription_data: { trial_period_days: 14 },
  payment_method_collection: 'always', // card required upfront
  ...
});

// Trial without credit card (lower friction, higher churn risk)
subscription_data: {
  trial_end: Math.floor(Date.now() / 1000) + 14 * 24 * 60 * 60,
}
// Set payment_method_collection: 'if_required' in Checkout
```

### Usage-Based Billing (Metered)

```javascript
// Price with metered billing
const price = await stripe.prices.create({
  product: productId,
  currency: 'usd',
  recurring: {
    interval: 'month',
    usage_type: 'metered',
    aggregate_usage: 'sum',
  },
  unit_amount: 1, // $0.01 per unit
  nickname: 'API Calls',
});

// Report usage during the billing period
await stripe.subscriptionItems.createUsageRecord(
  subscriptionItemId,
  {
    quantity: apiCallCount,
    timestamp: Math.floor(Date.now() / 1000),
    action: 'increment', // or 'set' to replace
  },
  { idempotencyKey: `usage-${subscriptionItemId}-${Date.now()}` }
);
```

### Local Database Schema

Keep a local mirror of subscription state — never query Stripe on every page load:

```sql
CREATE TABLE subscriptions (
  id                    SERIAL PRIMARY KEY,
  user_id               INTEGER NOT NULL REFERENCES users(id),
  stripe_subscription_id VARCHAR(255) UNIQUE NOT NULL,
  stripe_customer_id    VARCHAR(255) NOT NULL,
  stripe_price_id       VARCHAR(255) NOT NULL,
  status                VARCHAR(50) NOT NULL, -- active, trialing, past_due, canceled
  trial_end             TIMESTAMPTZ,
  current_period_end    TIMESTAMPTZ NOT NULL,
  cancel_at_period_end  BOOLEAN NOT NULL DEFAULT false,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

## Output Format

For subscription implementations:
1. Subscription creation endpoint with idempotency
2. Webhook handlers for all relevant lifecycle events
3. Database schema for local subscription mirror
4. Access provisioning and revocation logic

## Guidelines

- Never revoke access immediately on `cancel_at_period_end = true` — wait for `customer.subscription.deleted`
- Always sync subscription state from webhooks, not from the API response alone — the webhook is the source of truth for state changes you didn't initiate
- For trials, default to requiring a payment method upfront — it significantly reduces trial abuse and chargeback risk
- Use `proration_behavior: 'create_prorations'` for upgrades so customers get credit for unused time
- Store the Stripe subscription ID, price ID, and status in your database — avoid calling the Stripe API on every page load to check access
