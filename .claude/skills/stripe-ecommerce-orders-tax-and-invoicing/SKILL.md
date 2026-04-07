---
name: stripe-ecommerce-orders-tax-and-invoicing
description: Stripe commerce back-office — cart and order mapping, post-payment fulfillment, Stripe Tax setup, invoice generation, refunds, and B2B invoicing. Use this skill when building a product catalog with a cart, collecting and remitting tax, issuing invoices to customers, processing refunds or credits, or handling B2B billing with net terms. Invoke this skill when payment alone isn't enough — you need order records, tax compliance, or formal invoicing.
user-invocable: true
argument-hint: "[describe the commerce flow, tax need, or invoicing scenario]"
model: sonnet
effort: high
---

# Stripe Ecommerce, Orders, Tax, and Invoicing

Handle the commerce back office: map your app's cart and order data to Stripe, automate tax collection and filing, generate invoices, and process refunds cleanly. This skill covers the operations layer that sits between "payment succeeded" and "order is complete."

## Instructions

Analyze `$ARGUMENTS` to identify the commerce scenario. Implement the relevant parts.

### Cart/Order to Stripe Mapping

Maintain a two-way link between your app's orders and Stripe's payment objects:

```javascript
// When creating an order in your DB:
const order = await db.orders.create({
  data: {
    userId,
    items: cartItems,
    subtotal: calculateSubtotal(cartItems),
    status: 'pending',
  },
});

// Create the Checkout Session with order context in metadata
const session = await stripe.checkout.sessions.create(
  {
    mode: 'payment',
    customer: customerId,
    line_items: cartItems.map(item => ({
      price_data: {
        currency: 'usd',
        unit_amount: item.priceInCents,
        product_data: {
          name: item.name,
          description: item.description,
          metadata: { product_id: item.id },
        },
      },
      quantity: item.quantity,
    })),
    metadata: { order_id: order.id },
    success_url: `${BASE_URL}/orders/${order.id}/confirmed?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${BASE_URL}/cart`,
  },
  { idempotencyKey: `checkout-order-${order.id}` }
);

// Store the session ID on the order for later retrieval
await db.orders.update({
  where: { id: order.id },
  data: { stripeSessionId: session.id },
});
```

### Post-Payment Fulfillment via Webhook

```javascript
case 'checkout.session.completed': {
  const session = event.data.object as Stripe.Checkout.Session;
  const orderId = session.metadata?.order_id;
  if (!orderId) break;

  if (session.payment_status === 'paid') {
    await fulfillOrder(orderId, session);
  } else if (session.payment_status === 'unpaid') {
    // e.g., bank transfer initiated but not settled
    await markOrderAwaitingPayment(orderId);
  }
  break;
}

async function fulfillOrder(orderId: string, session: Stripe.Checkout.Session) {
  await db.orders.update({
    where: { id: orderId },
    data: {
      status: 'paid',
      stripePaymentIntentId: session.payment_intent as string,
      paidAt: new Date(),
    },
  });

  // Trigger fulfillment actions: send receipt, dispatch shipping, provision digital goods
  await sendOrderConfirmation(orderId);
  await dispatchFulfillment(orderId);
}
```

### Stripe Tax

Stripe Tax automatically calculates, collects, and generates tax reports. Enable it on Checkout Sessions with one field:

```javascript
const session = await stripe.checkout.sessions.create({
  mode: 'payment',
  automatic_tax: { enabled: true }, // that's it
  customer: customerId,             // customer needs address for tax calculation
  // OR collect address in-session:
  customer_update: { address: 'auto', name: 'auto' },
  line_items: [...],
  ...
});
```

**For PaymentIntents with manual UI, use Stripe Tax via Calculation:**

```javascript
// Calculate tax before showing the total
const calculation = await stripe.tax.calculations.create({
  currency: 'usd',
  line_items: cartItems.map(item => ({
    amount: item.priceInCents * item.quantity,
    reference: item.id,
    tax_behavior: 'exclusive', // or 'inclusive'
    tax_code: 'txcd_10000000', // general physical goods; use specific codes for SaaS/digital
  })),
  customer_details: {
    address: {
      line1: customer.address,
      city: customer.city,
      state: customer.state,
      postal_code: customer.postalCode,
      country: customer.country,
    },
    address_source: 'shipping',
  },
  expand: ['line_items.data.tax_breakdown'],
});

// Display tax_amount_exclusive + amount_total to the user
const taxAmount = calculation.tax_amount_exclusive;
const total = calculation.amount_total;
```

**Tax codes for common product types:**

| Product type | Tax code |
|-------------|----------|
| General physical goods | `txcd_10000000` |
| SaaS / software subscription | `txcd_10103001` |
| Digital download | `txcd_10402000` |
| Professional services | `txcd_20030000` |
| Books / printed matter | `txcd_10101000` |

### Invoice Generation

For B2B billing or formal receipts outside of subscriptions:

```javascript
// Create and immediately send an invoice
const invoice = await stripe.invoices.create({
  customer: customerId,
  collection_method: 'send_invoice', // or 'charge_automatically'
  days_until_due: 30, // net-30
  metadata: { order_id: order.id },
  auto_advance: false, // don't finalize automatically
});

// Add line items
await stripe.invoiceItems.create({
  customer: customerId,
  invoice: invoice.id,
  amount: 500000, // $5,000.00
  currency: 'usd',
  description: 'Professional services — March 2025',
});

// Finalize and send
await stripe.invoices.finalizeInvoice(invoice.id);
await stripe.invoices.sendInvoice(invoice.id);
```

**For subscription-generated invoices**, Stripe creates them automatically — you don't need to create them manually. Just handle `invoice.paid` and `invoice.payment_failed` webhooks.

### Refunds and Credits

```javascript
// Full refund
const refund = await stripe.refunds.create(
  {
    payment_intent: paymentIntentId,
    reason: 'requested_by_customer', // or 'duplicate', 'fraudulent'
    metadata: { order_id: order.id, refund_reason: 'customer_request' },
  },
  { idempotencyKey: `refund-order-${order.id}` }
);

// Partial refund
const partialRefund = await stripe.refunds.create(
  {
    payment_intent: paymentIntentId,
    amount: 1000, // $10.00 partial refund
  },
  { idempotencyKey: `partial-refund-order-${order.id}-${amount}` }
);

// Issue a credit note against an invoice (subscription context)
const creditNote = await stripe.creditNotes.create({
  invoice: invoiceId,
  lines: [{ type: 'invoice_line_item', invoice_line_item: lineItemId, quantity: 1 }],
  memo: 'Goodwill credit for service disruption',
});
```

**Listen for refund events:**

```javascript
case 'charge.refunded': {
  const charge = event.data.object as Stripe.Charge;
  await updateOrderStatus(charge.metadata.order_id, 'refunded');
  await notifyCustomerRefundIssued(charge);
  break;
}
```

## Output Format

For commerce flows:
1. Order creation + Checkout Session creation (linked via metadata)
2. Fulfillment webhook handler
3. Order status update logic

For tax:
1. `automatic_tax` configuration in Checkout
2. Or: Tax Calculation call with relevant tax codes

For invoicing:
1. Invoice + InvoiceItem creation
2. Finalize and send steps

For refunds:
1. Refund creation with idempotency
2. Webhook handler for `charge.refunded`

## Guidelines

- Always fulfill via webhook (`checkout.session.completed`), not the success redirect — the redirect is not a reliable fulfillment signal
- For Stripe Tax, enable it on Checkout Sessions when possible — it handles nexus tracking and report generation automatically
- Match your tax codes to the actual product type — incorrect tax codes are a compliance risk
- Include `order_id` in PaymentIntent and Checkout Session metadata — it is the critical link for reconciliation, refunds, and dispute evidence
- For B2B invoicing, set `days_until_due` and `collection_method: 'send_invoice'`; don't auto-charge B2B customers without explicit agreement
