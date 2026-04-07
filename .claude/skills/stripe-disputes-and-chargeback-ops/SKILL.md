---
name: stripe-disputes-and-chargeback-ops
description: Stripe dispute lifecycle, chargeback response workflows, and evidence collection. Use this skill when a chargeback has been opened, building a process to respond to disputes, designing evidence collection at checkout time, analyzing dispute patterns to reduce future chargebacks, or setting up Smart Disputes. This skill is separate from fraud prevention — prevention happens before payment, chargeback ops happen after.
user-invocable: true
argument-hint: "[describe the dispute situation or the chargeback process you're building]"
model: sonnet
effort: medium
---

# Stripe Disputes and Chargeback Ops

Manage the dispute lifecycle — from detection through evidence submission to outcome — and build the operational workflows that reduce chargeback rates over time. This skill covers what happens after a payment is challenged, while `stripe-fraud-radar-and-risk-controls` covers prevention before it.

## Instructions

Analyze `$ARGUMENTS` to understand the dispute scenario or process need. Implement the relevant workflow.

### The Dispute Lifecycle

1. **Dispute opened** — cardholder files a chargeback with their bank; Stripe notifies you via webhook
2. **Evidence window** — typically 7–21 days (varies by card network and reason code) to submit evidence
3. **Bank review** — 60–75 days for Visa/Mastercard to decide
4. **Outcome** — dispute won (funds returned) or lost (funds permanently deducted + dispute fee)

**You cannot win by ignoring disputes.** Not responding = automatic loss.

### Webhook Detection

```javascript
case 'charge.dispute.created': {
  const dispute = event.data.object as Stripe.Dispute;
  await handleDisputeOpened(dispute);
  break;
}

case 'charge.dispute.updated': {
  const dispute = event.data.object as Stripe.Dispute;
  // status: warning_needs_response, needs_response, under_review, won, lost
  await syncDisputeStatus(dispute);
  break;
}

case 'charge.dispute.closed': {
  const dispute = event.data.object as Stripe.Dispute;
  await handleDisputeClosed(dispute); // outcome: won or lost
  break;
}

async function handleDisputeOpened(dispute: Stripe.Dispute) {
  const charge = await stripe.charges.retrieve(dispute.charge as string, {
    expand: ['payment_intent', 'customer'],
  });

  await db.disputes.create({
    data: {
      stripeDisputeId: dispute.id,
      stripeChargeId: dispute.charge as string,
      amount: dispute.amount,
      currency: dispute.currency,
      reason: dispute.reason,
      status: dispute.status,
      evidenceDueBy: new Date(dispute.evidence_details.due_by * 1000),
      customerId: (charge.customer as Stripe.Customer)?.id,
    },
  });

  // Alert immediately — evidence deadlines are strict
  await alertOpsTeam({
    disputeId: dispute.id,
    amount: dispute.amount,
    reason: dispute.reason,
    dueBy: new Date(dispute.evidence_details.due_by * 1000),
  });
}
```

### Dispute Reason Codes and Response Strategy

| Reason | What it means | Evidence that helps |
|--------|--------------|---------------------|
| `fraudulent` | Cardholder says they didn't authorize it | Device fingerprint, billing address match, prior orders, IP/location consistency |
| `product_not_received` | Customer claims non-delivery | Shipping tracking, delivery confirmation, digital delivery logs |
| `product_unacceptable` | Customer says item was defective/wrong | Customer service records, return policy, prior communication |
| `duplicate` | Customer says charged twice | Proof of single transaction, different order IDs |
| `subscription_canceled` | Customer says they canceled | Cancellation policy, evidence they didn't cancel, service logs |
| `credit_not_processed` | Refund was promised but not issued | Refund records, communication with customer |
| `unrecognized` | Customer doesn't remember the transaction | Clear billing descriptor, customer service contact info, prior usage |

### Submitting Evidence

```javascript
async function submitDisputeEvidence(disputeId: string) {
  // Gather evidence from your app's data
  const dispute = await db.disputes.findUnique({ where: { stripeDisputeId: disputeId } });
  const order = await db.orders.findFirst({ where: { stripeChargeId: dispute.stripeChargeId } });
  const customer = await db.users.findFirst({ where: { id: order.userId } });

  await stripe.disputes.update(disputeId, {
    evidence: {
      // Core fields — fill in what you have
      customer_name: customer.name,
      customer_email: customer.email,
      billing_address: formatAddress(customer.billingAddress),

      // Order context
      product_description: summarizeOrder(order),
      service_date: order.createdAt.toISOString().split('T')[0],

      // Proof of delivery / access
      shipping_tracking_number: order.trackingNumber,
      shipping_carrier: order.shippingCarrier,
      // For digital goods: use customer_communication or uncategorized_text
      // to paste access logs, download records, or API call history

      // Customer communication (past 6 months)
      customer_communication: order.supportTranscript,

      // Refund / cancellation policy
      refund_policy: 'https://yourapp.com/refund-policy',
      refund_policy_disclosure: 'Customer agreed to our refund policy at checkout (checkbox required)',

      // Summary for the bank
      uncategorized_text: buildDisputeSummary(dispute, order, customer),

      submit: true, // finalize and submit immediately
    },
  });
}

function buildDisputeSummary(dispute, order, customer) {
  return `
Order ${order.id} was placed on ${order.createdAt.toDateString()} by ${customer.email}.
The customer has used our service [X] times since account creation on ${customer.createdAt.toDateString()}.
Payment was authorized with billing address matching our records.
[Describe any additional context relevant to the dispute reason]
  `.trim();
}
```

### Smart Disputes

For eligible disputes, Stripe's Smart Disputes automatically compiles and submits evidence on your behalf. Enable it in the Stripe Dashboard under **Radar > Smart Disputes**.

Smart Disputes works best when:
- You have rich metadata on your PaymentIntents (customer IDs, order IDs, delivery info)
- Your Stripe Customer objects have email and address populated
- You have a clear billing descriptor set on your Stripe account

### Collect Evidence at Checkout Time

The best time to gather dispute evidence is when the payment happens — not after a chargeback arrives:

```javascript
// At checkout, log and store:
await db.checkoutAuditLog.create({
  data: {
    orderId: order.id,
    customerId: user.id,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
    stripeSessionId, // from Stripe.js
    billingAddressProvided: true,
    termsAcceptedAt: new Date(), // timestamp of TOS acceptance
    refundPolicyAcceptedAt: new Date(),
  },
});
```

This gives you concrete evidence for the most common dispute reasons.

### Feedback Loop into Radar

After each dispute, analyze the pattern and update your Radar rules:

- Fraudulent dispute from a country you don't normally see? Add a **review** rule for that country
- Card testing followed by dispute? Tighten velocity rules
- Subscription cancellation disputes? Add clearer cancellation UX and email confirmations

Dispute data is your most direct signal about fraud patterns that Radar missed.

### Billing Descriptor

A confusing billing descriptor is the single biggest driver of `unrecognized` disputes. Set it clearly:

```javascript
// Update your account's default statement descriptor
// Do this in the Stripe Dashboard: Settings > Business Settings > Public business name

// Or per-payment:
const paymentIntent = await stripe.paymentIntents.create({
  amount,
  currency: 'usd',
  statement_descriptor_suffix: 'YourApp', // appended to your account name
});
```

Rules:
- Max 22 characters total (account name + suffix)
- No `<>` characters or special symbols
- Must be recognizable to the cardholder — use your app name, not a legal entity name

## Output Format

For dispute detection:
1. Webhook handlers for dispute events
2. Dispute DB schema with evidence deadline tracking
3. Ops alert logic

For evidence submission:
1. Evidence gathering function (pulling from your order/customer DB)
2. `stripe.disputes.update` call with all available fields
3. Summary narrative template

For prevention:
1. Checkout audit log schema
2. Billing descriptor setup
3. Radar rule recommendations based on dispute patterns

## Guidelines

- Respond to every dispute — even ones you'll likely lose. Non-response is guaranteed loss plus a strike toward your account's dispute rate threshold (> 1% can trigger account review)
- Submit evidence at least 2 days before the deadline — don't wait until the last day
- `fraudulent` is the most common reason code but often means "I don't recognize this" — a clear billing descriptor prevents many of them
- Keep support communication records for at least 18 months — they are often the most compelling evidence for product/service disputes
- A dispute rate above 0.75% triggers Mastercard's monitoring program; above 1% triggers Visa's. Keep a running dispute rate metric in your ops dashboard.
