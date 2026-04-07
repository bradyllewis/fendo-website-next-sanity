---
name: stripe-customer-portal-and-entitlements
description: Stripe Customer Portal and Entitlements API for self-service billing UX and feature provisioning. Use this skill when building the "manage subscription" or "billing settings" page, letting users cancel or upgrade themselves, implementing feature gating based on subscription plan, or provisioning and revoking app features when subscription state changes. This skill bridges payment state to product access — a key layer for any SaaS.
user-invocable: true
argument-hint: "[describe the self-service billing feature or entitlement scenario]"
model: sonnet
effort: medium
---

# Stripe Customer Portal and Entitlements

Turn Stripe billing state into product access state. The Customer Portal gives users a hosted self-service interface for managing their subscription. Entitlements map your Stripe products to internal features, so your app always knows what a user can and can't do based on what they've paid for.

## Instructions

Analyze `$ARGUMENTS` to understand the portal or entitlement need. Implement the relevant parts.

### Customer Portal Setup

The Customer Portal is a Stripe-hosted page where users can update payment methods, view invoices, and manage (or cancel) their subscription. You configure it once in the Stripe Dashboard or via API, then redirect users there on demand.

**Configure the portal (do this once via API or Dashboard):**

```javascript
const configuration = await stripe.billingPortal.configurations.create({
  business_profile: {
    headline: 'Manage your subscription',
    privacy_policy_url: 'https://yourapp.com/privacy',
    terms_of_service_url: 'https://yourapp.com/terms',
  },
  features: {
    payment_method_update: { enabled: true },
    invoice_history: { enabled: true },
    subscription_cancel: { enabled: true },
    subscription_update: {
      enabled: true,
      default_allowed_updates: ['price', 'quantity'],
      proration_behavior: 'create_prorations',
      products: [
        {
          product: 'prod_xxx',
          prices: ['price_monthly', 'price_annual'], // plans users can switch between
        },
      ],
    },
  },
});
// Store configuration.id — reference it when creating portal sessions
```

**Create a portal session on demand (per request):**

```javascript
// POST /api/billing/portal
async function createPortalSession(req, res) {
  const user = req.user;

  const session = await stripe.billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: `${process.env.BASE_URL}/dashboard`,
    // configuration: 'bpc_xxx', // optional: pin to a specific config
  });

  return res.json({ url: session.url });
}
```

```javascript
// Client: redirect to portal
const { url } = await fetch('/api/billing/portal', { method: 'POST' }).then(r => r.json());
window.location.href = url;
```

**Webhook sync after portal actions:**

When a user changes their plan or cancels through the portal, Stripe fires the same subscription events as API changes. Your existing webhook handlers cover this automatically — no portal-specific handlers needed.

Key events to handle (from `stripe-webhooks-and-event-processing`):
- `customer.subscription.updated` — plan change, cancel_at_period_end set
- `customer.subscription.deleted` — subscription ended
- `payment_method.attached` — new payment method added

### Entitlements API

Entitlements let you define what features each Stripe product unlocks, and get a real-time answer to "what can this customer do right now?"

**Define features (once, in Stripe Dashboard or API):**

```javascript
// Create a feature
const feature = await stripe.entitlements.features.create({
  name: 'Advanced Analytics',
  lookup_key: 'advanced_analytics', // stable key you use in your app
});

// Attach the feature to a product (not a price — features are per product)
await stripe.products.update('prod_pro', {
  features: [{ entitlement_feature: feature.id }],
});
```

**Check entitlements at runtime:**

```javascript
// Get all active features for a customer
const entitlements = await stripe.entitlements.activeEntitlements.list({
  customer: customerId,
});

const featureKeys = entitlements.data.map(e => e.lookup_key);
// e.g., ['advanced_analytics', 'api_access', 'team_members']

// Check a specific feature
const hasAnalytics = featureKeys.includes('advanced_analytics');
```

**Recommended: cache entitlements locally**

Calling the Entitlements API on every request is slow. Cache the result and invalidate on subscription webhooks:

```javascript
// Cache entitlements in Redis or your DB
async function getUserFeatures(userId: string): Promise<string[]> {
  const cached = await redis.get(`features:${userId}`);
  if (cached) return JSON.parse(cached);

  const user = await db.users.findUnique({ where: { id: userId } });
  const entitlements = await stripe.entitlements.activeEntitlements.list({
    customer: user.stripeCustomerId,
  });

  const features = entitlements.data.map(e => e.lookup_key);
  await redis.setex(`features:${userId}`, 300, JSON.stringify(features)); // 5 min cache
  return features;
}

// Invalidate cache on subscription change webhook
async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const customer = await stripe.customers.retrieve(subscription.customer as string);
  const userId = customer.metadata?.user_id;
  if (userId) {
    await redis.del(`features:${userId}`);
  }
  // ... rest of sync logic
}
```

**Access gate pattern:**

```javascript
// Middleware or utility
async function requireFeature(userId: string, featureKey: string) {
  const features = await getUserFeatures(userId);
  if (!features.includes(featureKey)) {
    throw new ForbiddenError(`Feature '${featureKey}' not available on current plan`);
  }
}

// In a route handler
app.get('/api/analytics/advanced', async (req, res) => {
  await requireFeature(req.user.id, 'advanced_analytics');
  // ... handle request
});
```

### Provisioning and De-provisioning Access

For apps that don't use the Entitlements API, manage access directly from subscription webhooks:

```javascript
// When subscription becomes active
async function provisionAccess(subscription: Stripe.Subscription) {
  const planKey = subscription.metadata.plan; // e.g., 'pro', 'starter'
  const customerId = subscription.customer as string;
  const user = await db.users.findFirst({ where: { stripeCustomerId: customerId } });

  await db.users.update({
    where: { id: user.id },
    data: {
      plan: planKey,
      planStatus: 'active',
      accessUntil: new Date(subscription.current_period_end * 1000),
    },
  });
}

// When subscription is deleted
async function revokeAccess(customerId: string) {
  const user = await db.users.findFirst({ where: { stripeCustomerId: customerId } });
  await db.users.update({
    where: { id: user.id },
    data: { plan: 'free', planStatus: 'canceled', accessUntil: null },
  });
}
```

## Output Format

For portal tasks:
1. Portal configuration (one-time setup)
2. Portal session endpoint
3. Client-side redirect

For entitlement tasks:
1. Feature definitions and product attachment
2. Entitlement check utility with caching
3. Cache invalidation in webhook handlers
4. Access gate middleware or utility

## Guidelines

- The Customer Portal handles plan management UX automatically — don't build a custom subscription management UI unless you have specific requirements it can't meet
- Entitlements are product-level, not price-level — one product can have many prices (monthly/annual) and they all unlock the same features
- Always invalidate entitlement caches when subscription state changes; stale access state is a product bug
- For high-traffic apps, maintain a `user_features` table in your own DB rather than querying Stripe on every request
