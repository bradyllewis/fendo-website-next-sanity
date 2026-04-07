---
name: stripe-payments-and-checkout
description: Stripe one-time payment flows — Checkout Sessions, PaymentIntents, SetupIntents, hosted vs embedded checkout decisions. Use this skill whenever implementing a buy button, a payment form, a one-time charge, saving a card for later, or choosing between Stripe Checkout and a custom payment form. This is the default starting point for any "charge a customer" task.
user-invocable: true
argument-hint: "[describe the payment flow you're building]"
model: sonnet
effort: high
---

# Stripe Payments and Checkout

Implement one-time payment flows correctly. The two main paths are Stripe Checkout (hosted or embedded) and PaymentIntents with a custom UI. This skill helps you pick the right approach and implement it end-to-end.

## Instructions

Analyze `$ARGUMENTS` to understand the payment flow context. Pick the right approach, then implement it.

### Checkout vs. PaymentIntents: How to Decide

| Use Stripe Checkout if... | Use PaymentIntents if... |
|--------------------------|--------------------------|
| You want to move fast | You need full UI control |
| You need 3DS, tax, discounts, multiple payment methods without extra work | You're building an in-app purchase flow |
| Compliance (PCI, accessibility) matters and you want Stripe to own it | You have an existing checkout UI to integrate with |
| You're building a simple store or SaaS pricing page | You need custom logic between payment steps |

**Default recommendation:** Use Stripe Checkout unless you have a specific reason not to. It handles 3D Secure, Apple/Google Pay, saved cards, address collection, tax, and coupon codes automatically.

### Stripe Checkout (Hosted)

```javascript
// Server: create a Checkout Session
const session = await stripe.checkout.sessions.create({
  mode: 'payment',
  line_items: [
    {
      price: 'price_xxx', // Price ID from your Stripe dashboard or API
      quantity: 1,
    },
  ],
  customer: customerId, // optional but strongly recommended
  customer_email: user.email, // if no Customer yet
  success_url: `${process.env.BASE_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
  cancel_url: `${process.env.BASE_URL}/checkout/cancel`,
  metadata: {
    order_id: order.id, // link back to your app's data
  },
});

// Redirect the client
return { url: session.url };
```

```javascript
// Client: redirect to Checkout
const { url } = await fetch('/api/checkout', { method: 'POST' }).then(r => r.json());
window.location.href = url;
```

```javascript
// Webhook handler: fulfill after payment (do NOT rely on success_url alone)
case 'checkout.session.completed': {
  const session = event.data.object as Stripe.Checkout.Session;
  if (session.payment_status === 'paid') {
    await fulfillOrder(session.metadata.order_id);
  }
  break;
}
```

### Stripe Checkout (Embedded)

For keeping users on your domain while still using Stripe's UI:

```javascript
// Server: create session with ui_mode: 'embedded'
const session = await stripe.checkout.sessions.create({
  mode: 'payment',
  ui_mode: 'embedded',
  line_items: [{ price: 'price_xxx', quantity: 1 }],
  return_url: `${process.env.BASE_URL}/checkout/complete?session_id={CHECKOUT_SESSION_ID}`,
});
return { clientSecret: session.client_secret };
```

```jsx
// Client: embed the Checkout component
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from '@stripe/react-stripe-js';

function CheckoutPage() {
  const fetchClientSecret = async () => {
    const { clientSecret } = await fetch('/api/checkout', { method: 'POST' }).then(r => r.json());
    return clientSecret;
  };

  return (
    <EmbeddedCheckoutProvider stripe={stripePromise} options={{ fetchClientSecret }}>
      <EmbeddedCheckout />
    </EmbeddedCheckoutProvider>
  );
}
```

### PaymentIntents (Custom UI)

For full control over the payment form:

```javascript
// Server: create a PaymentIntent
const paymentIntent = await stripe.paymentIntents.create(
  {
    amount: 2000, // in cents
    currency: 'usd',
    customer: customerId,
    automatic_payment_methods: { enabled: true }, // lets Stripe show the right payment methods
    metadata: { order_id: order.id },
  },
  { idempotencyKey: `order-${order.id}-pi` }
);

return { clientSecret: paymentIntent.client_secret };
```

```jsx
// Client: render the Payment Element
import { PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';

function PaymentForm() {
  const stripe = useStripe();
  const elements = useElements();

  const handleSubmit = async (e) => {
    e.preventDefault();
    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/payment/complete`,
      },
    });
    if (error) setErrorMessage(error.message);
  };

  return (
    <form onSubmit={handleSubmit}>
      <PaymentElement />
      <button type="submit">Pay</button>
    </form>
  );
}
```

### SetupIntents: Save Card Without Charging

Use when you want to save a payment method for future use (subscriptions, one-click reorder):

```javascript
// Server: create a SetupIntent
const setupIntent = await stripe.setupIntents.create({
  customer: customerId,
  automatic_payment_methods: { enabled: true },
});
return { clientSecret: setupIntent.client_secret };

// After setup completes, the PaymentMethod is attached to the Customer
// Use it for future payments:
const paymentIntent = await stripe.paymentIntents.create({
  amount: 2000,
  currency: 'usd',
  customer: customerId,
  payment_method: 'pm_xxx', // the saved PaymentMethod ID
  confirm: true,
  off_session: true, // for charges initiated without the customer present
});
```

### Success Confirmation Page

Always retrieve the session/intent server-side to confirm status — don't trust URL parameters alone:

```javascript
// On the success page, verify the payment before showing "thank you"
const session = await stripe.checkout.sessions.retrieve(sessionId);
if (session.payment_status !== 'paid') {
  // Show pending state or redirect to retry
}
```

## Output Format

For each payment flow:
1. Server-side session/intent creation endpoint with idempotency key
2. Client-side component or redirect code
3. Webhook handler for fulfillment
4. Success page verification

## Guidelines

- Always use idempotency keys on PaymentIntent and CheckoutSession creation (apply `stripe-idempotency-and-retries` patterns)
- Always handle fulfillment via webhook, not just the success redirect — the redirect is unreliable
- Use `automatic_payment_methods: { enabled: true }` to let Stripe show the optimal payment methods for each customer's region
- Attach a Customer to every PaymentIntent/CheckoutSession to enable saved cards, receipts, and dispute evidence
- For amounts, Stripe uses the smallest currency unit (cents for USD) — always convert before sending
