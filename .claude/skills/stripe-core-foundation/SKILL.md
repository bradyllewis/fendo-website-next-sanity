---
name: stripe-core-foundation
description: Stripe domain model and integration baseline. Use this skill whenever the user is setting up Stripe for the first time, working with Customers, Products, Prices, or PaymentMethods, making decisions about what Stripe objects to use and why, establishing environment separation (test vs live), or defining metadata and naming conventions. This is the shared foundation every other Stripe skill depends on — invoke it early and often.
user-invocable: true
argument-hint: "[describe the integration context or specific object/decision]"
model: sonnet
effort: high
---

# Stripe Core Foundation

Establish the canonical Stripe object model and integration architecture. Everything else in a Stripe integration — subscriptions, checkout, webhooks, fraud — depends on getting this layer right.

## Instructions

Analyze `$ARGUMENTS` to understand the integration context (app type, stack, what they're building). Then cover the relevant parts of this foundation.

### The Core Object Model

Teach and apply the right Stripe objects for the context:

**Customer** (`cus_*`)
- Create a Stripe Customer for every authenticated user who will pay or be billed
- Store the Stripe Customer ID in your app database — it is the identity anchor for all future interactions
- Never create duplicate Customers for the same user; look up by email or metadata before creating

**Product** (`prod_*`)
- Represents what you sell (e.g., "Pro Plan", "One-Time Report", "API Credits")
- Products are stable — create once, reference many times
- Use `metadata` to map Products to internal feature IDs or entitlement keys

**Price** (`price_*`)
- Represents how you charge for a Product (amount, currency, billing interval)
- One Product can have many Prices (monthly, annual, per-seat, metered)
- Never hardcode price amounts in code — always reference a Price ID

**PaymentMethod** (`pm_*`)
- Represents saved payment credentials (card, bank, wallet)
- Attach to a Customer to enable reuse across sessions and subscriptions
- Use SetupIntent to collect and save a PaymentMethod without charging immediately

**PaymentIntent** (`pi_*`)
- The object that drives a single payment attempt
- Use for custom checkout flows where you control the UI
- Confirm on the server after client-side payment method collection

**CheckoutSession** (`cs_*`)
- Stripe-hosted or embedded payment page
- Handles PaymentIntents or Subscriptions depending on `mode`
- Preferred for speed and built-in compliance (3DS, tax, etc.)

### Environment Separation

```javascript
// Always resolve the key from environment — never hardcode
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
// STRIPE_SECRET_KEY=sk_test_... in development
// STRIPE_SECRET_KEY=sk_live_... in production

// Webhook secret is also environment-specific
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
```

Use separate Stripe accounts or at minimum separate webhook endpoints per environment. Test mode keys (`sk_test_*`, `pk_test_*`) and live mode keys (`sk_live_*`, `pk_live_*`) must never be mixed in the same request.

### Metadata Strategy

Use `metadata` to create a two-way link between Stripe objects and your app:

```javascript
// When creating a Customer
await stripe.customers.create({
  email: user.email,
  metadata: {
    user_id: user.id,          // your app's user ID
    account_id: user.accountId // org/account if multi-tenant
  }
});

// When creating a Product
await stripe.products.create({
  name: 'Pro Plan',
  metadata: {
    plan_key: 'pro',           // internal feature flag / entitlement key
    tier: '2'
  }
});
```

Always index both directions: store `stripe_customer_id` in your users table, and store `user_id` in Stripe's customer metadata.

### Resource Naming Conventions

| Object | Name pattern | Example |
|--------|-------------|---------|
| Products | Human-readable, match your pricing page | `"Pro Plan"`, `"Starter"` |
| Prices | Describe the billing interval | `"Pro Monthly"`, `"Pro Annual"` |
| Customers | Use the user's real name/email | set `name` and `email` |
| Webhook endpoints | Describe what environment/purpose | `"Production - All events"` |

### Decision Guide: Which Object to Use

| Goal | Use |
|------|-----|
| Charge a card once (custom UI) | PaymentIntent |
| Charge a card once (hosted page) | CheckoutSession (mode: payment) |
| Start a subscription | CheckoutSession (mode: subscription) or Subscription object directly |
| Save card for later | SetupIntent |
| Let user manage their own billing | Customer Portal |
| Issue an invoice manually | Invoice |

## Output Format

For setup tasks, produce:
1. The object creation code with correct fields and metadata
2. The database schema fields to store on your side (`stripe_customer_id`, etc.)
3. Any environment variable setup required

For decision questions, produce a clear recommendation with the reasoning — don't just list options, pick the right one for the user's context.

## Guidelines

- Always create a Customer before attaching payment methods or creating subscriptions — floating PaymentIntents without a Customer make reconciliation painful
- Price IDs should be stored in environment config or a database, not hardcoded — pricing changes shouldn't require code deploys
- If the user is using a framework (Next.js, Rails, Django, etc.), tailor the code to that stack's conventions
