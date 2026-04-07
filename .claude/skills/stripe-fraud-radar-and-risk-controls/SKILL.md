---
name: stripe-fraud-radar-and-risk-controls
description: Stripe Radar fraud prevention, risk rules, and abuse controls. Use this skill when setting up fraud rules in Radar, deciding what to block vs. review vs. allow, managing false positives, designing a manual review queue, or building a payment acceptance policy. Invoke this skill whenever payment fraud, card testing, abuse, or risk scoring is part of the problem — even if the user hasn't explicitly asked about "fraud."
user-invocable: true
argument-hint: "[describe the fraud risk or payment acceptance scenario]"
model: sonnet
effort: medium
---

# Stripe Fraud, Radar, and Risk Controls

Design a fraud prevention posture using Stripe Radar. The goal is to block genuine fraud without over-declining good customers. This skill covers rule design, risk metadata, manual review workflows, and the feedback loop back into your rules over time.

## Instructions

Analyze `$ARGUMENTS` to understand the business context and fraud risk. Then design the right Radar configuration.

### How Radar Works

Radar evaluates every payment in real time using Stripe's ML model and your custom rules. Each payment gets a risk score (highest/elevated/normal/not_assessed). Your rules run on top of that score to decide: **allow**, **block**, or **review**.

- **Allow**: Accept the payment (can override a block rule for known-good customers)
- **Block**: Decline before charge attempt — the customer sees a generic decline
- **Review**: Charge succeeds, but the payment lands in a manual review queue — you can then capture or refund

### Risk Metadata: Feed Radar Better Signals

The more context you give Radar about the customer and transaction, the better its ML model performs. Send metadata on every PaymentIntent or Checkout Session:

```javascript
const paymentIntent = await stripe.paymentIntents.create({
  amount,
  currency: 'usd',
  customer: customerId,
  payment_method: paymentMethodId,
  // Ship risk-relevant context to Radar
  metadata: {
    user_id: user.id,
    user_email: user.email,
    account_age_days: daysSinceSignup.toString(),
    order_count: user.orderCount.toString(),     // first-time vs. repeat buyer
    product_type: 'digital',                     // physical/digital/subscription
    billing_country: user.countryCode,
  },
});
```

Also use the `radar_options` field to send a session ID from Stripe.js (enables device fingerprinting):

```javascript
// Client: get Stripe session ID
const { error, paymentMethod } = await stripe.createPaymentMethod({ ... });
const stripeSessionId = await stripe.createRadarSession(); // requires Radar for Fraud Teams

// Server: pass session to PaymentIntent
radar_options: { session: stripeSessionId }
```

### Radar Rules

Rules use a simple expression language. Navigate to **Radar > Rules** in the Stripe Dashboard to add these.

**Block high-risk card testing patterns:**
```
# Block if more than 3 failed charges from the same card in 24 hours
:charge_count_for_card_1_day > 3

# Block if email domain is a known disposable email provider
:email_domain: in ('mailinator.com', 'guerrillamail.com', 'tempmail.com')

# Block if billing country doesn't match IP country (high mismatch = fraud signal)
# (Available in Radar for Fraud Teams)
:ip_country != :card_country
```

**Review instead of blocking (for borderline cases):**
```
# Review elevated-risk payments from new users with large amounts
:risk_level: = 'elevated' and :amount_in_usd > 200 and :customer_account_age_in_days < 7

# Review first-time orders above a threshold
:customer_order_count = 0 and :amount_in_usd > 500
```

**Allow known-good customers to bypass elevated blocks:**
```
# Allow VIP customers (use a Radar List)
:email: in @trusted_customers
```

### Radar Lists

Lists let you maintain dynamic allow/block/review sets without redeploying rules:

```javascript
// Add to a block list (e.g., known fraudsters)
await stripe.radar.valueListItems.create({
  value_list: 'rsl_xxx', // get ID from Dashboard or API
  value: 'fraudster@example.com',
});

// Add to an allow list (e.g., verified enterprise customers)
await stripe.radar.valueListItems.create({
  value_list: 'rsl_yyy',
  value: 'trusted@bigcorp.com',
});
```

Common lists to maintain:
- **Blocked emails** — known fraudsters
- **Blocked IPs** — card testing sources
- **Trusted customers** — VIPs that bypass elevated-risk blocks
- **High-risk countries** — for review-only (not outright block unless required)

### Manual Review Queue

For payments in review, you must capture or refund within **7 days** or they auto-refund.

```javascript
// Webhook: payment is in review
case 'radar.early_fraud_warning.created': {
  const warning = event.data.object;
  await alertOpsTeam(warning.payment_intent, warning.fraud_type);
  break;
}

case 'payment_intent.amount_capturable_updated': {
  // PaymentIntent is in review (authorized but not captured)
  const pi = event.data.object as Stripe.PaymentIntent;
  if (pi.review) {
    await db.reviewQueue.create({
      data: {
        paymentIntentId: pi.id,
        amount: pi.amount,
        customerId: pi.customer as string,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });
    await alertOpsTeam(pi.id);
  }
  break;
}
```

```javascript
// Ops decision: approve (capture) or reject (refund)
async function approvePayment(paymentIntentId: string) {
  await stripe.paymentIntents.capture(paymentIntentId);
}

async function rejectPayment(paymentIntentId: string, reason: string) {
  await stripe.paymentIntents.cancel(paymentIntentId, {
    cancellation_reason: 'fraudulent',
  });
}
```

### False Positive Management

Over-blocking hurts revenue. Track your decline rates:

- **Acceptable block rate**: < 1% of legitimate-looking payments
- **Review queue SLA**: under 2 hours — delayed reviews mean auto-refunds and angry customers
- If a legitimate customer is blocked, add them to a trusted list and refine the rule
- Review rules monthly — fraud patterns change, and outdated rules create false positives

### Rule Design Principles

1. **Start with review, not block** — you can always escalate to block after observing the pattern
2. **Use amounts as a signal, not a wall** — large orders aren't fraud; large orders from brand-new accounts are
3. **Combine signals** — account age + order count + amount + risk score is more precise than any single signal
4. **Maintain a feedback loop** — when a chargeback comes in, look at whether a Radar rule could have caught it

## Output Format

For rule design tasks:
1. Radar rule expressions with comments explaining the logic
2. List of Radar Lists to create and what goes in them
3. Risk metadata fields to add to PaymentIntents

For review queue tasks:
1. Webhook handlers for review events
2. Review queue DB schema
3. Approve/reject API endpoints

## Guidelines

- Never block purely on country — it creates discriminatory outcomes and misses most fraud (fraudsters use VPNs)
- Card testing — many small $0 or $1 charges in rapid succession — is the most common abuse pattern; the `:charge_count_for_card_*` rules are essential
- Radar rules run before the payment attempt, not after — a block rule prevents the charge; a review rule lets the charge succeed but holds the funds
- For elevated-risk businesses (crypto, firearms, pharmaceuticals), Radar for Fraud Teams provides additional signals including device fingerprinting and IP velocity
