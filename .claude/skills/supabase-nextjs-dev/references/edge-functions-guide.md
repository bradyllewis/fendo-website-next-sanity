# Supabase Edge Functions Deep Dive

Comprehensive guide to building production-ready Edge Functions with Deno 2.1 for Next.js applications.

## Table of Contents

1. [Architecture & Runtime](#architecture-and-runtime)
2. [Common Use Cases](#common-use-cases)
3. [Authentication & Authorization](#authentication-and-authorization)
4. [Database Operations](#database-operations)
5. [Third-Party Integrations](#third-party-integrations)
6. [Error Handling & Logging](#error-handling-and-logging)
7. [Testing & Debugging](#testing-and-debugging)
8. [Performance Optimization](#performance-optimization)
9. [Deployment & CI/CD](#deployment-and-cicd)

## Architecture and Runtime

### Deno 2.1 Features

Edge Functions run on Supabase Edge Runtime powered by Deno 2.1:
- TypeScript-first (no build step needed)
- Web standard APIs (fetch, Request, Response)
- NPM compatibility for most packages
- V8 isolates for fast cold starts
- Global distribution via CDN

### Basic Structure

```typescript
// supabase/functions/function-name/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

serve(async (req: Request) => {
  return new Response(
    JSON.stringify({ message: "Hello from Edge Function!" }),
    { headers: { "Content-Type": "application/json" } }
  )
})
```

### Environment Variables

Access via `Deno.env.get()`:

```typescript
const supabaseUrl = Deno.env.get('SUPABASE_URL')
const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')
const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
```

Set via CLI:
```bash
# Set secret
supabase secrets set STRIPE_SECRET_KEY=sk_test_...

# List secrets
supabase secrets list

# Unset secret
supabase secrets unset STRIPE_SECRET_KEY
```

## Common Use Cases

### 1. Webhook Handler (Stripe)

```typescript
// supabase/functions/stripe-webhook/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import Stripe from 'https://esm.sh/stripe@14.5.0?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
})

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
)

serve(async (req) => {
  const signature = req.headers.get('stripe-signature')
  const body = await req.text()

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature!,
      Deno.env.get('STRIPE_WEBHOOK_SECRET')!
    )
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message)
    return new Response(
      JSON.stringify({ error: 'Invalid signature' }),
      { status: 400 }
    )
  }

  console.log('Event type:', event.type)

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      
      // Update user subscription in database
      const { error } = await supabase
        .from('subscriptions')
        .update({
          status: 'active',
          stripe_subscription_id: session.subscription,
          subscription_ends_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        })
        .eq('user_id', session.metadata?.user_id)

      if (error) {
        console.error('Error updating subscription:', error)
        return new Response(
          JSON.stringify({ error: 'Database error' }),
          { status: 500 }
        )
      }
      break
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription
      
      await supabase
        .from('subscriptions')
        .update({ status: 'cancelled' })
        .eq('stripe_subscription_id', subscription.id)
      break
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice
      
      // Send email notification via another edge function
      await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-email`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: invoice.customer_email,
          subject: 'Payment Failed',
          template: 'payment-failed',
        }),
      })
      break
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
```

### 2. Email Service (Resend Integration)

```typescript
// supabase/functions/send-email/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')

interface EmailRequest {
  to: string
  subject: string
  html?: string
  template?: string
  variables?: Record<string, any>
}

serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    })
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization' }),
        { status: 401 }
      )
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    )

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401 }
      )
    }

    // Parse request
    const { to, subject, html, template, variables }: EmailRequest = await req.json()

    // Validate
    if (!to || !subject) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400 }
      )
    }

    // Get template if specified
    let emailHtml = html
    if (template) {
      const templates = {
        'welcome': '<h1>Welcome {{name}}!</h1><p>Thanks for joining.</p>',
        'reset-password': '<h1>Reset Password</h1><p>Click: {{resetLink}}</p>',
        'payment-failed': '<h1>Payment Failed</h1><p>Please update your card.</p>',
      }
      
      emailHtml = templates[template as keyof typeof templates]
      
      // Replace variables
      if (variables) {
        for (const [key, value] of Object.entries(variables)) {
          emailHtml = emailHtml.replace(new RegExp(`{{${key}}}`, 'g'), String(value))
        }
      }
    }

    // Send via Resend
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'noreply@yourdomain.com',
        to: [to],
        subject,
        html: emailHtml,
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      console.error('Resend error:', data)
      return new Response(
        JSON.stringify({ error: 'Failed to send email' }),
        { status: 500 }
      )
    }

    // Log email sent
    await supabase
      .from('email_logs')
      .insert({
        user_id: user.id,
        to,
        subject,
        template,
        resend_id: data.id,
      })

    return new Response(
      JSON.stringify({ success: true, id: data.id }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    )
  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    )
  }
})
```

### 3. Data Processing / ETL

```typescript
// supabase/functions/process-analytics/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  try {
    // Fetch raw events from last hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    
    const { data: events, error: fetchError } = await supabase
      .from('raw_events')
      .select('*')
      .gte('created_at', oneHourAgo)
      .is('processed', false)

    if (fetchError) throw fetchError

    console.log(`Processing ${events?.length || 0} events`)

    // Aggregate by user and event type
    const aggregated = new Map<string, any>()

    for (const event of events || []) {
      const key = `${event.user_id}-${event.event_type}`
      
      if (!aggregated.has(key)) {
        aggregated.set(key, {
          user_id: event.user_id,
          event_type: event.event_type,
          count: 0,
          total_value: 0,
        })
      }

      const agg = aggregated.get(key)
      agg.count += 1
      agg.total_value += event.value || 0
    }

    // Insert aggregated data
    const { error: insertError } = await supabase
      .from('analytics_hourly')
      .insert(Array.from(aggregated.values()))

    if (insertError) throw insertError

    // Mark events as processed
    if (events && events.length > 0) {
      const eventIds = events.map(e => e.id)
      await supabase
        .from('raw_events')
        .update({ processed: true })
        .in('id', eventIds)
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed: events?.length || 0,
        aggregated: aggregated.size,
      }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Processing error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500 }
    )
  }
})
```

### 4. Image Optimization

```typescript
// supabase/functions/optimize-image/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  const { imageUrl, width, height, quality = 80 } = await req.json()

  // Fetch original image
  const imageResponse = await fetch(imageUrl)
  const imageBlob = await imageResponse.blob()

  // Use ImageMagick via Deno FFI or external service
  // For production, use a service like Imgix, Cloudinary, or Sharp
  const optimizedImage = await optimizeImage(imageBlob, { width, height, quality })

  // Upload to Supabase Storage
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  const fileName = `optimized-${Date.now()}.jpg`
  const { data, error } = await supabase.storage
    .from('images')
    .upload(fileName, optimizedImage, {
      contentType: 'image/jpeg',
      cacheControl: '31536000', // 1 year
    })

  if (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500 }
    )
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from('images').getPublicUrl(fileName)

  return new Response(
    JSON.stringify({ url: publicUrl }),
    { headers: { 'Content-Type': 'application/json' } }
  )
})

async function optimizeImage(
  blob: Blob,
  options: { width?: number; height?: number; quality?: number }
): Promise<Blob> {
  // Implementation depends on your optimization strategy
  // Could use external API like TinyPNG, or Deno FFI with ImageMagick
  return blob
}
```

## Authentication and Authorization

### JWT Verification

```typescript
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

async function verifyUser(req: Request) {
  const authHeader = req.headers.get('Authorization')
  
  if (!authHeader) {
    throw new Error('Missing authorization header')
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    {
      global: {
        headers: { Authorization: authHeader },
      },
    }
  )

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    throw new Error('Invalid token')
  }

  return user
}

// Usage in edge function
serve(async (req) => {
  try {
    const user = await verifyUser(req)
    
    // User is authenticated, proceed
    return new Response(
      JSON.stringify({ message: `Hello ${user.email}` }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 401 }
    )
  }
})
```

### Role-Based Access

```typescript
async function requireRole(req: Request, allowedRoles: string[]) {
  const user = await verifyUser(req)

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  const { data: userRole } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .single()

  if (!userRole || !allowedRoles.includes(userRole.role)) {
    throw new Error('Insufficient permissions')
  }

  return { user, role: userRole.role }
}

// Usage
serve(async (req) => {
  try {
    const { user, role } = await requireRole(req, ['admin', 'editor'])
    
    // User has required role
    return new Response(
      JSON.stringify({ message: `Welcome ${role}` }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 403 }
    )
  }
})
```

## Database Operations

### Batch Processing

```typescript
async function batchUpdate(records: any[]) {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  const BATCH_SIZE = 100
  const results = []

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE)
    
    const { data, error } = await supabase
      .from('table_name')
      .upsert(batch)

    if (error) {
      console.error(`Batch ${i / BATCH_SIZE + 1} failed:`, error)
      results.push({ batch: i / BATCH_SIZE + 1, error: error.message })
    } else {
      results.push({ batch: i / BATCH_SIZE + 1, success: true })
    }
  }

  return results
}
```

### Transaction Handling

```typescript
async function performTransaction() {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  // Use Postgres function for atomic operations
  const { data, error } = await supabase.rpc('transfer_funds', {
    from_account: 'acc-1',
    to_account: 'acc-2',
    amount: 100,
  })

  if (error) {
    throw new Error(`Transaction failed: ${error.message}`)
  }

  return data
}

/* Postgres function:
CREATE OR REPLACE FUNCTION transfer_funds(
  from_account TEXT,
  to_account TEXT,
  amount NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  result JSONB;
BEGIN
  -- Deduct from sender
  UPDATE accounts SET balance = balance - amount WHERE id = from_account;
  
  -- Add to receiver
  UPDATE accounts SET balance = balance + amount WHERE id = to_account;
  
  -- Log transaction
  INSERT INTO transactions (from_account, to_account, amount)
  VALUES (from_account, to_account, amount)
  RETURNING jsonb_build_object('transaction_id', id) INTO result;
  
  RETURN result;
END;
$$;
*/
```

## Error Handling and Logging

### Structured Error Responses

```typescript
class APIError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code?: string
  ) {
    super(message)
    this.name = 'APIError'
  }
}

function errorResponse(error: Error | APIError) {
  const statusCode = error instanceof APIError ? error.statusCode : 500
  const code = error instanceof APIError ? error.code : 'INTERNAL_ERROR'

  return new Response(
    JSON.stringify({
      error: {
        message: error.message,
        code,
      },
    }),
    {
      status: statusCode,
      headers: { 'Content-Type': 'application/json' },
    }
  )
}

// Usage
serve(async (req) => {
  try {
    const { email } = await req.json()

    if (!email) {
      throw new APIError('Email is required', 400, 'MISSING_EMAIL')
    }

    // Process...
    
    return new Response(JSON.stringify({ success: true }))
  } catch (error) {
    console.error('Function error:', error)
    return errorResponse(error)
  }
})
```

### Logging to External Service

```typescript
async function logToDatadog(level: string, message: string, meta?: any) {
  const DATADOG_API_KEY = Deno.env.get('DATADOG_API_KEY')
  const DATADOG_APP_KEY = Deno.env.get('DATADOG_APP_KEY')

  await fetch('https://http-intake.logs.datadoghq.com/v1/input', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'DD-API-KEY': DATADOG_API_KEY!,
    },
    body: JSON.stringify({
      ddsource: 'supabase-edge-function',
      ddtags: 'env:production,service:my-app',
      hostname: 'edge-function',
      message,
      level,
      ...meta,
    }),
  })
}

// Usage
serve(async (req) => {
  try {
    const user = await verifyUser(req)
    
    await logToDatadog('info', 'User action', {
      user_id: user.id,
      action: 'create_post',
    })

    // ... rest of function
  } catch (error) {
    await logToDatadog('error', error.message, {
      stack: error.stack,
    })
    
    return errorResponse(error)
  }
})
```

## Testing and Debugging

### Local Testing

```bash
# Start local Supabase
supabase start

# Serve function locally with hot reload
supabase functions serve function-name --no-verify-jwt

# Make request
curl -i --location --request POST 'http://localhost:54321/functions/v1/function-name' \
  --header 'Authorization: Bearer YOUR_ANON_KEY' \
  --header 'Content-Type: application/json' \
  --data '{"key":"value"}'
```

### Unit Tests with Deno

```typescript
// supabase/functions/my-function/test.ts
import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts"

Deno.test("validates email format", () => {
  const isValidEmail = (email: string) => /^[^@]+@[^@]+\.[^@]+$/.test(email)
  
  assertEquals(isValidEmail('test@example.com'), true)
  assertEquals(isValidEmail('invalid-email'), false)
})

// Run tests
// deno test supabase/functions/my-function/test.ts
```

### Integration Testing

```typescript
// tests/edge-functions.test.ts
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

describe('Edge Functions', () => {
  it('should send email', async () => {
    const { data, error } = await supabase.functions.invoke('send-email', {
      body: {
        to: 'test@example.com',
        subject: 'Test',
        template: 'welcome',
      },
    })

    expect(error).toBeNull()
    expect(data.success).toBe(true)
  })
})
```

## Performance Optimization

### Caching Responses

```typescript
const cache = new Map<string, { data: any; expires: number }>()

function getCached(key: string) {
  const cached = cache.get(key)
  if (cached && cached.expires > Date.now()) {
    return cached.data
  }
  cache.delete(key)
  return null
}

function setCache(key: string, data: any, ttlSeconds: number = 60) {
  cache.set(key, {
    data,
    expires: Date.now() + ttlSeconds * 1000,
  })
}

serve(async (req) => {
  const url = new URL(req.url)
  const cacheKey = url.pathname

  // Check cache
  const cached = getCached(cacheKey)
  if (cached) {
    return new Response(JSON.stringify(cached), {
      headers: {
        'Content-Type': 'application/json',
        'X-Cache': 'HIT',
      },
    })
  }

  // Fetch data
  const data = await fetchData()
  
  // Store in cache
  setCache(cacheKey, data, 300) // 5 minutes

  return new Response(JSON.stringify(data), {
    headers: {
      'Content-Type': 'application/json',
      'X-Cache': 'MISS',
    },
  })
})
```

### Parallel Requests

```typescript
async function fetchMultipleResources() {
  const [users, posts, comments] = await Promise.all([
    supabase.from('users').select('*'),
    supabase.from('posts').select('*'),
    supabase.from('comments').select('*'),
  ])

  return { users: users.data, posts: posts.data, comments: comments.data }
}
```

## Deployment and CI/CD

### GitHub Actions

```yaml
# .github/workflows/deploy-edge-functions.yml
name: Deploy Edge Functions

on:
  push:
    branches: [main]
    paths:
      - 'supabase/functions/**'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - uses: supabase/setup-cli@v1
        with:
          version: latest

      - name: Deploy functions
        run: |
          supabase functions deploy send-email --project-ref ${{ secrets.SUPABASE_PROJECT_REF }}
          supabase functions deploy stripe-webhook --project-ref ${{ secrets.SUPABASE_PROJECT_REF }} --no-verify-jwt
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}

      - name: Set secrets
        run: |
          supabase secrets set STRIPE_SECRET_KEY=${{ secrets.STRIPE_SECRET_KEY }} --project-ref ${{ secrets.SUPABASE_PROJECT_REF }}
          supabase secrets set RESEND_API_KEY=${{ secrets.RESEND_API_KEY }} --project-ref ${{ secrets.SUPABASE_PROJECT_REF }}
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
```

This reference should be used when users need help building Edge Functions, handling webhooks, or implementing serverless logic.