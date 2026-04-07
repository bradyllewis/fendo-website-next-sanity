---
name: stripe-connect-and-marketplaces
description: Stripe Connect for platforms and marketplaces — connected accounts, onboarding, payouts to third parties, platform fees, and Connect-specific webhooks. Use this skill when building a marketplace where money flows to sellers or service providers, a platform that collects fees on transactions between parties, or any multi-party payment architecture. Only invoke this skill if your app routes money to third parties — if you only take payments for your own business, use stripe-payments-and-checkout instead.
user-invocable: true
argument-hint: "[describe the platform or marketplace model and money flow]"
model: sonnet
effort: high
---

# Stripe Connect and Marketplaces

Build multi-party payment flows. Connect lets your platform collect payments from customers and route funds to connected accounts (sellers, service providers, contractors) while taking a platform fee. This skill covers account onboarding, transfer models, payouts, and Connect-specific webhooks.

## Instructions

Analyze `$ARGUMENTS` to understand the platform model. Choose the right Connect account type and transfer approach, then implement it.

### Choose the Right Connect Account Type

| Account type | When to use | Onboarding | Branding |
|-------------|-------------|-----------|---------|
| **Standard** | Connected accounts already have or want their own Stripe account; they accept Stripe ToS themselves | Stripe-hosted OAuth flow | Stripe Dashboard visible to account |
| **Express** | You want a Stripe-hosted onboarding UI but own the user relationship | Stripe-hosted onboarding UI | Your platform branding |
| **Custom** | Full control over onboarding UX; you take on compliance responsibility | You build the full UI | Your branding throughout |

**For most marketplaces and SaaS platforms: use Express.** It balances control with reduced compliance burden.

### Onboarding Connected Accounts (Express)

```javascript
// Create a connected account
const account = await stripe.accounts.create({
  type: 'express',
  country: 'US',
  email: seller.email,
  capabilities: {
    card_payments: { requested: true },
    transfers: { requested: true },
  },
  metadata: { seller_id: seller.id },
});

// Store the account ID
await db.sellers.update({
  where: { id: seller.id },
  data: { stripeAccountId: account.id },
});

// Generate onboarding link
const accountLink = await stripe.accountLinks.create({
  account: account.id,
  refresh_url: `${BASE_URL}/sellers/onboarding/retry`,
  return_url: `${BASE_URL}/sellers/onboarding/complete`,
  type: 'account_onboarding',
});

return { url: accountLink.url };
```

**Handle onboarding completion via webhook:**

```javascript
case 'account.updated': {
  const account = event.data.object as Stripe.Account;
  const isFullyOnboarded =
    account.details_submitted &&
    account.charges_enabled &&
    account.payouts_enabled;

  if (isFullyOnboarded) {
    await db.sellers.update({
      where: { stripeAccountId: account.id },
      data: { onboardingComplete: true, payoutsEnabled: true },
    });
  }
  break;
}
```

**Check if a seller can receive payments:**

```javascript
async function canSellerReceivePayments(sellerId: string): Promise<boolean> {
  const seller = await db.sellers.findUnique({ where: { id: sellerId } });
  if (!seller.stripeAccountId) return false;

  const account = await stripe.accounts.retrieve(seller.stripeAccountId);
  return account.charges_enabled && account.payouts_enabled;
}
```

### Transfer Models

**Destination Charges (most common):** Charge the customer through your platform, then transfer to the connected account minus your fee.

```javascript
// Charge the customer, route funds to seller, take a platform fee
const paymentIntent = await stripe.paymentIntents.create(
  {
    amount: 10000, // $100.00
    currency: 'usd',
    customer: customerId,
    payment_method: paymentMethodId,
    confirm: true,
    application_fee_amount: 1000, // $10 platform fee (10%)
    transfer_data: {
      destination: seller.stripeAccountId, // connected account receives $90
    },
    metadata: { order_id: order.id, seller_id: seller.id },
  },
  { idempotencyKey: `order-${order.id}-payment` }
);
```

**Separate Charges and Transfers:** Charge the customer on your platform, then transfer manually after fulfillment.

```javascript
// Step 1: Charge the customer (no transfer_data)
const paymentIntent = await stripe.paymentIntents.create({
  amount: 10000,
  currency: 'usd',
  customer: customerId,
  ...
});

// Step 2: After fulfillment, transfer to the seller
const transfer = await stripe.transfers.create(
  {
    amount: 9000, // $90 after $10 fee
    currency: 'usd',
    destination: seller.stripeAccountId,
    transfer_group: `order-${order.id}`, // group related transfers
    metadata: { order_id: order.id },
  },
  { idempotencyKey: `transfer-order-${order.id}` }
);
```

Use separate charges + transfers when:
- You need to transfer after the fact (e.g., after service completion)
- One payment should split across multiple sellers
- You need a delay between charge and payout

### Payouts to Connected Accounts

Connected accounts receive automatic payouts on their Stripe account's payout schedule by default. To control payout timing:

```javascript
// Set manual payouts for a connected account (you control when they get paid)
await stripe.accounts.update(seller.stripeAccountId, {
  settings: {
    payouts: {
      schedule: { interval: 'manual' },
    },
  },
});

// Trigger a payout manually
const payout = await stripe.payouts.create(
  {
    amount: 50000, // $500
    currency: 'usd',
  },
  {
    stripeAccount: seller.stripeAccountId, // act on behalf of connected account
  }
);
```

### Connect-Specific Webhooks

Connect webhooks fire on your platform account but include a `account` field identifying the connected account:

```javascript
// Configure webhook endpoint with 'connect: true' in the Stripe Dashboard
// or via API — this receives events for all connected accounts

case 'account.updated': // onboarding state changed
case 'payment_intent.succeeded': // payment succeeded on connected account
case 'payout.failed': // payout to seller failed
case 'account.application.deauthorized': // seller disconnected your app (Standard only)

// Access the connected account ID
const connectedAccountId = event.account; // e.g., 'acct_xxx'
```

**Handling payout failures:**

```javascript
case 'payout.failed': {
  const payout = event.data.object as Stripe.Payout;
  const connectedAccountId = event.account;

  await db.sellers.update({
    where: { stripeAccountId: connectedAccountId },
    data: { lastPayoutStatus: 'failed', lastPayoutError: payout.failure_message },
  });

  await alertSellerPayoutFailed(connectedAccountId, payout.failure_message);
  break;
}
```

### Acting on Behalf of a Connected Account

For Express and Custom accounts, make API calls on behalf of connected accounts using the `stripeAccount` option:

```javascript
// Retrieve a charge that happened on a connected account
const charge = await stripe.charges.retrieve(
  chargeId,
  { stripeAccount: seller.stripeAccountId }
);

// Create a refund on a connected account's behalf
const refund = await stripe.refunds.create(
  { charge: chargeId },
  { stripeAccount: seller.stripeAccountId }
);
```

### Platform Fee Strategy

| Fee model | How to implement |
|-----------|-----------------|
| Percentage fee | `application_fee_amount = Math.round(amount * 0.10)` |
| Flat fee | `application_fee_amount = 50` (50 cents) |
| Tiered fee | Calculate based on seller volume from your DB |
| Fee on renewals | Add `application_fee_percent` to the Subscription object |

For subscription-based platforms:

```javascript
const subscription = await stripe.subscriptions.create({
  customer: customerId,
  items: [{ price: priceId }],
  application_fee_percent: 10, // platform takes 10% of each renewal
  transfer_data: { destination: seller.stripeAccountId },
});
```

## Output Format

For account onboarding:
1. Account creation + metadata
2. Account link generation endpoint
3. Onboarding webhook handler

For payment flows:
1. PaymentIntent creation with `transfer_data` or `application_fee_amount`
2. Transfer creation (for separate charges + transfers model)

For Connect webhooks:
1. Event handlers for `account.updated`, `payout.failed`
2. How to extract `event.account` and route to the right seller

## Guidelines

- For Express accounts, do not try to replicate the onboarding UI — let Stripe host it. The compliance burden of Custom onboarding is significant.
- Always check `charges_enabled` and `payouts_enabled` before routing payments to a connected account — onboarding may be incomplete
- Use `transfer_group` to link related transfers (e.g., one order split across multiple sellers) for reconciliation
- Platform fees (`application_fee_amount`) are taken from the connected account's portion, not added on top — factor this into how you present pricing
- Store `stripeAccountId` on your seller/provider records immediately at account creation — you'll need it for every subsequent API call
