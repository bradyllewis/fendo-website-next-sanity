---
name: nextjs-stack-security-audit
description: Comprehensive security inspection and enhancement for Next.js applications using Supabase, OpenRouter, Vercel AI SDK, and deploying to Vercel. Checks for authentication vulnerabilities, RLS policies, API security, prompt injection, environment variables, CSRF/XSS, data exposure, CVE compliance, and provides actionable remediation steps.
license: Apache-2.0
---

# Next.js Stack Security Audit

A comprehensive security inspection tool for Next.js applications built with Supabase, OpenRouter, Vercel AI SDK, and deployed on Vercel. This skill performs systematic security audits across your entire stack and provides actionable remediation guidance based on 2025 best practices.

## Overview

This skill conducts a thorough security assessment of your modern web application stack, identifying vulnerabilities and misconfigurations that could lead to data breaches, unauthorized access, or service disruption. It combines knowledge of the latest CVEs, OWASP Top 10 (including OWASP LLM/Agentic AI categories), and platform-specific security patterns.

**When to Use This Skill:**
- Before deploying to production
- During security reviews or compliance audits
- After major stack updates or dependency changes
- When implementing new AI features or authentication flows
- To establish security baselines for new projects
- During incident response or post-mortem analysis

## Critical Security Context (2025)

### Recent High-Severity Vulnerabilities
1. **CVE-2025-29927** (Next.js Middleware Bypass) - CRITICAL
2. **CVE-2025-30218** (Next.js Edge Runtime) - LOW/MEDIUM
3. **CVE-2024-51479** (Next.js Middleware) - HIGH
4. **CVE-2024-34351** (Next.js SSRF) - HIGH
5. React Server Components authentication bypass (Dec 2025)

### Key Architectural Changes
- **Middleware is NO LONGER SAFE for authentication** (2025 guidance)
- **Data Access Layer (DAL) is now recommended pattern**
- **Zero Trust model required for Server Components**
- **Supabase API keys changed** (new publishable/secret key model)

## Audit Categories

The audit systematically checks 12 critical security domains:

### 1. Next.js Authentication & Authorization
### 2. Next.js Data Access & Server Actions
### 3. Supabase Row-Level Security (RLS)
### 4. Supabase API Key Management
### 5. OpenRouter API Security
### 6. Vercel AI SDK - OWASP LLM Top 10
### 7. Environment Variables & Secrets
### 8. Security Headers & CSP
### 9. XSS, CSRF, and Injection Prevention
### 10. Vercel Deployment Security
### 11. Dependency & CVE Scanning
### 12. Network & Rate Limiting

## Instructions

### Phase 1: Project Discovery

1. **Identify the codebase structure:**
   - Ask user for GitHub repo URL or local path
   - Use `view` tool to explore directory structure
   - Identify framework version (App Router vs Pages Router)
   - Locate key files: `middleware.ts`, `next.config.js`, data access layers

2. **Map technology usage:**
   - Verify Next.js version (check `package.json`)
   - Confirm Supabase integration (check for `@supabase/supabase-js`)
   - Identify AI SDK usage (`ai`, `@ai-sdk/*` packages)
   - Check OpenRouter configuration
   - Review Vercel deployment setup

### Phase 2: Systematic Security Inspection

For each security category, follow this pattern:
1. **Scan** - Identify potential issues
2. **Analyze** - Determine severity (CRITICAL/HIGH/MEDIUM/LOW)
3. **Document** - Record findings with file/line references
4. **Remediate** - Provide specific fix instructions

---

## Category 1: Next.js Authentication & Authorization

**CRITICAL 2025 UPDATE:** Middleware is NO LONGER the recommended authentication boundary.

### Checks to Perform

#### 1.1 Middleware Authentication (DEPRECATED PATTERN)
```bash
# Search for authentication in middleware
grep -r "middleware" --include="*.ts" --include="*.js"
```

**Look for:**
- Authentication logic in `middleware.ts`
- Session checks in middleware
- Route protection in middleware

**Finding:** If authentication is primarily in middleware:
- **Severity:** CRITICAL
- **Issue:** Middleware bypass vulnerabilities (CVE-2025-29927, CVE-2024-51479)
- **Remediation:** Migrate to Data Access Layer pattern

#### 1.2 Data Access Layer (DAL) Implementation
```bash
# Look for DAL pattern
find . -type f -name "*.ts" -path "*/data/*" -o -path "*/lib/data/*" -o -path "*/dal/*"
```

**Required Characteristics:**
- Centralized data access functions
- Authentication checks INSIDE each function
- Returns minimal DTOs (Data Transfer Objects)
- Never exposes raw database objects to components

**Finding:** If no DAL exists:
- **Severity:** HIGH
- **Issue:** No centralized authentication boundary
- **Remediation:** See "Implementing Data Access Layer" in references

#### 1.3 Server Actions Security
```bash
# Find all server actions
grep -r '"use server"' --include="*.ts" --include="*.js"
```

**For each Server Action, verify:**
- [ ] Authentication check at the start of the action
- [ ] Input validation using Zod or similar
- [ ] CSRF protection (Origin/Host header check)
- [ ] Re-authorization for sensitive operations
- [ ] Returns DTOs, not raw data

**Common Vulnerability Pattern:**
```typescript
// ❌ INSECURE - No auth check, no validation
'use server'
export async function deleteUser(userId: string) {
  await db.users.delete(userId)
}
```

**Secure Pattern:**
```typescript
// ✅ SECURE
'use server'
export async function deleteUser(userId: string) {
  const session = await getSession()
  if (!session) throw new Error('Unauthorized')
  
  // Validate input
  const validated = userIdSchema.parse(userId)
  
  // Check authorization
  if (session.user.id !== validated && !session.user.isAdmin) {
    throw new Error('Forbidden')
  }
  
  await db.users.delete(validated)
  revalidatePath('/users')
}
```

#### 1.4 Session Management
```bash
# Check for session handling
grep -r "cookie" --include="*.ts" --include="*.js" | grep -i "session\|auth"
```

**Verify:**
- [ ] HTTP-only cookies for session tokens
- [ ] Secure flag enabled (HTTPS only)
- [ ] SameSite=Lax or Strict
- [ ] Appropriate maxAge/expiration
- [ ] No session data in localStorage/sessionStorage

#### 1.5 Multi-Layer Protection
**The 2025 security model requires protection at EVERY layer:**

1. **Data Access Layer** - Primary authentication boundary
2. **Server Actions** - Validate session before mutations
3. **Page Components** - Check auth for route access
4. **UI Components** - Hide sensitive UI elements
5. **API Routes** - Independent auth checks

---

## Category 2: Next.js Data Access & Server Actions

### Checks to Perform

#### 2.1 Client Component Data Exposure
```bash
# Find all client components
grep -r '"use client"' --include="*.ts" --include="*.tsx"
```

**For each client component:**
- Review props passed from Server Components
- Check for sensitive data in props (tokens, passwords, emails, IDs)
- Verify type safety prevents accidental exposure

**Common Issue:**
```typescript
// ❌ Server Component passing too much data
export default async function UserProfile({ userId }) {
  const user = await db.users.findUnique({ where: { id: userId }})
  // Passes entire user object including password hash, API keys
  return <ClientProfile user={user} />
}
```

**Fix:**
```typescript
// ✅ Create DTO with only safe fields
class PublicUserDTO {
  constructor(private user: User) {}
  get id() { return this.user.id }
  get name() { return this.user.name }
  // Explicitly expose only safe fields
}

export default async function UserProfile({ userId }) {
  const user = await db.users.findUnique({ where: { id: userId }})
  return <ClientProfile user={new PublicUserDTO(user)} />
}
```

#### 2.2 Dynamic Route Parameters
```bash
# Find dynamic routes
find . -type d -name "\[*\]"
```

**For each dynamic route:**
- [ ] Parameters are validated (not just sanitized)
- [ ] Authorization checks before data access
- [ ] No direct parameter usage in queries

**Vulnerable Pattern:**
```typescript
// app/user/[id]/page.tsx
// ❌ No validation or auth check
export default async function Page({ params }: { params: { id: string } }) {
  const user = await db.users.findUnique({ where: { id: params.id }})
  return <div>{user.email}</div>
}
```

**Secure Pattern:**
```typescript
// ✅ Validate params and check authorization
export default async function Page({ params }: { params: { id: string } }) {
  const validated = userIdSchema.parse(params.id)
  const user = await getUserById(validated) // Uses DAL with auth
  return <div>{user.name}</div>
}
```

#### 2.3 Server Component Security
```bash
# Check for database imports in component files
grep -r "from.*prisma\|from.*@supabase" app/ --include="*.tsx"
```

**Warning Signs:**
- Database client imported directly in Server Components (bypasses DAL)
- Environment variables accessed directly (`process.env.DATABASE_URL`)
- SQL queries constructed with string concatenation

**Best Practice:**
- ALL data access should go through the DAL
- DAL should be the ONLY place that imports database clients
- Use `cache()` from React to share data across request

---

## Category 3: Supabase Row-Level Security (RLS)

**CRITICAL:** RLS is your last line of defense. Even with perfect application code, RLS prevents data breaches.

### Checks to Perform

#### 3.1 RLS Enabled on All Tables
```sql
-- Connect to Supabase and run
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND rowsecurity = false;
```

**Finding:** Any tables with `rowsecurity = false`:
- **Severity:** CRITICAL
- **Issue:** Bypass RLS using service role key exposes all data
- **Remediation:** Enable RLS on every table

```sql
ALTER TABLE your_table ENABLE ROW LEVEL SECURITY;
```

#### 3.2 RLS Policy Coverage
```sql
-- Check which tables lack policies
SELECT schemaname, tablename
FROM pg_tables t
WHERE schemaname = 'public'
  AND rowsecurity = true
  AND NOT EXISTS (
    SELECT 1 FROM pg_policies p 
    WHERE p.schemaname = t.schemaname 
      AND p.tablename = t.tablename
  );
```

**Finding:** Tables with RLS enabled but no policies:
- **Severity:** CRITICAL  
- **Issue:** No access allowed (or default deny), could break functionality
- **Remediation:** Add appropriate policies for SELECT, INSERT, UPDATE, DELETE

#### 3.3 Policy Correctness

**For each table, check:**

1. **SELECT Policies** - Who can read rows?
```sql
-- Example: Users can only read their own data
CREATE POLICY "Users can view own data"
  ON users FOR SELECT
  USING (auth.uid() = id);
```

2. **INSERT Policies** - Who can create rows?
```sql
-- Example: Users can only insert their own data
CREATE POLICY "Users can insert own data"
  ON users FOR INSERT
  WITH CHECK (auth.uid() = id);
```

**CRITICAL:** Always use `WITH CHECK` for INSERT/UPDATE - `USING` is not sufficient!

3. **UPDATE Policies** - Who can modify rows?
```sql
-- Both USING and WITH CHECK required
CREATE POLICY "Users can update own data"
  ON users FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);
```

4. **DELETE Policies** - Who can delete rows?

#### 3.4 Common RLS Vulnerabilities

**Check for these dangerous patterns:**

1. **Overly Permissive Policies**
```sql
-- ❌ DANGEROUS - Anyone can read everything
CREATE POLICY "Public read" ON users
  FOR SELECT USING (true);
```

2. **Missing WITH CHECK Clauses**
```sql
-- ❌ VULNERABLE - User could update to set different owner
CREATE POLICY "Update own posts" ON posts
  FOR UPDATE USING (auth.uid() = user_id);
-- Missing: WITH CHECK (auth.uid() = user_id)
```

3. **Bypass through NULL Values**
```sql
-- ❌ VULNERABLE if user_id can be NULL
CREATE POLICY "Read own" ON table
  USING (auth.uid() = user_id);
-- Add: AND user_id IS NOT NULL
```

#### 3.5 Service Role Key Usage

**Scan codebase for service role key:**
```bash
grep -r "service_role" --include="*.ts" --include="*.js" --include="*.env*"
```

**Finding:** Service role key in client-side code:
- **Severity:** CRITICAL
- **Issue:** Bypasses ALL RLS policies, full database access
- **Remediation:** 
  - Remove immediately from client code
  - Use ONLY in server-side code (Server Actions, API Routes)
  - Rotate the key if exposed
  - Use Supabase's new secret key model (sb_secret_*)

---

## Category 4: Supabase API Key Management

**2025 UPDATE:** Supabase is transitioning from anon/service_role to publishable/secret keys.

### Checks to Perform

#### 4.1 Key Inventory
```bash
# Find all Supabase keys in codebase
grep -rE "SUPABASE.*KEY|supabaseKey" --include="*.ts" --include="*.js" --include="*.env*"
```

**Categorize findings:**
- `anon` key (legacy, being deprecated Nov 2025)
- `service_role` key (legacy, being deprecated)  
- `sb_publishable_*` (new public key, OK for client)
- `sb_secret_*` (new secret key, server-side ONLY)

#### 4.2 Client-Side Key Exposure
```bash
# Check for keys in client components and public directories
grep -r "NEXT_PUBLIC.*SUPABASE" --include="*.ts" --include="*.tsx"
find public/ -type f -exec grep -l "supabase" {} \;
```

**Rules:**
- ✅ `NEXT_PUBLIC_SUPABASE_URL` - OK to expose
- ✅ `NEXT_PUBLIC_SUPABASE_ANON_KEY` - OK (protected by RLS)
- ✅ `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` - OK (new model)
- ❌ `SUPABASE_SERVICE_ROLE_KEY` - NEVER in client code
- ❌ `SUPABASE_SECRET_KEY` or `sb_secret_*` - NEVER in client code

#### 4.3 Environment Variable Configuration

**Verify `.env.local` is in `.gitignore`:**
```bash
grep "\.env\.local" .gitignore
```

**Check for committed secrets:**
```bash
git log -p | grep -i "supabase.*key\|service_role"
```

**Finding:** Secrets in Git history:
- **Severity:** CRITICAL
- **Remediation:**
  1. Rotate ALL exposed keys immediately
  2. Use `git filter-branch` or BFG Repo-Cleaner to remove from history
  3. Force push to overwrite remote history (coordinate with team)

#### 4.4 Key Rotation Strategy

**Ask the user:**
- When were Supabase keys last rotated?
- Is there a documented rotation process?
- Are old keys disabled after rotation?

**Recommendation:** Rotate keys every 90 days or immediately after:
- Team member departure
- Suspected exposure
- Security incident
- Migration to new key model

---

## Category 5: OpenRouter API Security

### Checks to Perform

#### 5.1 API Key Storage
```bash
# Find OpenRouter API keys
grep -rE "OPENROUTER.*KEY|openrouter.*key" --include="*.env*" --include="*.ts" --include="*.js"
```

**Verify:**
- [ ] Keys stored in environment variables, not hardcoded
- [ ] Server-side only (no NEXT_PUBLIC_ prefix)
- [ ] Not committed to Git
- [ ] Properly configured in Vercel dashboard for all environments

#### 5.2 Zero Data Retention (ZDR) Configuration

**Check if ZDR is enabled:**
- Review OpenRouter API calls for ZDR parameters
- Verify routing to ZDR-compliant providers

```typescript
// ✅ RECOMMENDED - Enable ZDR
const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
    'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL,
    'X-Title': 'Your App Name',
  },
  body: JSON.stringify({
    model: 'anthropic/claude-3-opus',
    messages: messages,
    // Enable Zero Data Retention
    provider: {
      data_collection: 'deny',
      allow_fallbacks: false,
    }
  })
})
```

#### 5.3 Request/Response Logging

**Scan for logging of sensitive data:**
```bash
grep -r "console.log\|logger" --include="*.ts" --include="*.js" | grep -i "openrouter\|messages\|prompt"
```

**Finding:** Logging full API requests/responses:
- **Severity:** MEDIUM
- **Issue:** Sensitive user data in logs
- **Remediation:** Log only metadata (timestamp, model, token count, latency)

#### 5.4 Rate Limiting & Cost Controls

**Verify protections against "denial of wallet":**
- Check for rate limiting on AI endpoints
- Maximum request size limits
- User-level usage tracking
- Budget alerts configured in OpenRouter dashboard

**Recommended:**
```typescript
// Implement server-side rate limiting
import { Ratelimit } from '@upstash/ratelimit'

const ratelimit = new Ratelimit({
  redis: redis,
  limiter: Ratelimit.slidingWindow(10, '1 m'), // 10 requests per minute
})

export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown'
  const { success } = await ratelimit.limit(ip)
  
  if (!success) {
    return new Response('Rate limit exceeded', { status: 429 })
  }
  // ... proceed with OpenRouter call
}
```

---

## Category 6: Vercel AI SDK - OWASP LLM Top 10

**CRITICAL 2025 UPDATE:** AI agents are high-risk attack surfaces requiring specialized security.

### Checks to Perform

#### 6.1 Prompt Injection Prevention (OWASP LLM01)

**Scan for unvalidated user input in prompts:**
```bash
# Find AI SDK usage
grep -rE "generateText|streamText|generateObject" --include="*.ts" --include="*.tsx"
```

**For each AI call, verify:**
- [ ] User input is NOT directly concatenated into system prompt
- [ ] Input validation/sanitization before LLM call
- [ ] System prompt is separate from user input
- [ ] No user control over system instructions

**Vulnerable Pattern:**
```typescript
// ❌ CRITICAL VULNERABILITY - Prompt Injection
await generateText({
  model: openai('gpt-4'),
  prompt: userMessage, // Direct user input!
})
```

**Secure Pattern:**
```typescript
// ✅ SECURE - Separated system/user messages
import { z } from 'zod'

const userInputSchema = z.string().max(1000).regex(/^[a-zA-Z0-9\s.,!?-]+$/)

await generateText({
  model: openai('gpt-4'),
  messages: [
    { role: 'system', content: SYSTEM_PROMPT }, // Constant, not user-controlled
    { role: 'user', content: userInputSchema.parse(userMessage) } // Validated
  ],
})
```

#### 6.2 Tool Security (OWASP ASI02 - Tool Abuse)

**Find all AI tools:**
```bash
grep -rE "tool\(" --include="*.ts" --include="*.tsx"
```

**For each tool, verify:**
- [ ] Input validation using Zod schema
- [ ] Authentication check inside tool execute function
- [ ] Authorization check (user can perform this action?)
- [ ] Confirmation required for destructive operations
- [ ] Audit logging of tool invocations

**Vulnerable Pattern:**
```typescript
// ❌ CRITICAL - No validation, no auth, destructive
const deleteUser = tool({
  description: 'Delete a user account',
  parameters: z.object({
    userId: z.string(),
  }),
  execute: async ({ userId }) => {
    await db.users.delete({ where: { id: userId }}) // DANGEROUS!
  }
})
```

**Secure Pattern:**
```typescript
// ✅ SECURE
const deleteUser = tool({
  description: 'Delete a user account',
  parameters: z.object({
    userId: z.string().uuid(),
  }),
  execute: async ({ userId }) => {
    // 1. Authenticate
    const session = await getSession()
    if (!session) throw new Error('Unauthorized')
    
    // 2. Authorize
    if (session.user.id !== userId && !session.user.isAdmin) {
      throw new Error('Forbidden')
    }
    
    // 3. Validate input again
    const validatedId = z.string().uuid().parse(userId)
    
    // 4. Require confirmation for destructive ops
    if (!confirmed) {
      return { 
        requiresConfirmation: true,
        message: 'This will permanently delete the account. Confirm?' 
      }
    }
    
    // 5. Audit log
    await auditLog.create({
      action: 'user.delete',
      userId: session.user.id,
      targetUserId: validatedId,
    })
    
    // 6. Execute
    await db.users.delete({ where: { id: validatedId }})
    
    return { success: true }
  }
})
```

#### 6.3 Install eslint-plugin-vercel-ai-security

**Check if installed:**
```bash
grep "eslint-plugin-vercel-ai-security" package.json
```

**If not installed:**
- **Severity:** HIGH
- **Remediation:**

```bash
npm install --save-dev eslint-plugin-vercel-ai-security
```

```javascript
// eslint.config.js
import vercelAISecurity from 'eslint-plugin-vercel-ai-security'

export default [
  vercelAISecurity.configs.recommended, // Or .strict for maximum security
]
```

Run: `npx eslint 'src/**/*.ts' --max-warnings 0`

This plugin covers **100% of OWASP LLM Top 10 2025**.

#### 6.4 Output Validation

**Check for unvalidated LLM outputs used in:**
- Database queries
- System commands
- HTML rendering (XSS risk)
- File operations

**Secure Pattern:**
```typescript
const result = await generateObject({
  model: openai('gpt-4'),
  schema: z.object({
    name: z.string().max(100),
    age: z.number().int().min(0).max(150),
  }),
  prompt: userInput,
})

// result.object is now type-safe and validated
await db.users.create({ data: result.object })
```

---

## Category 7: Environment Variables & Secrets

### Checks to Perform

#### 7.1 Git Security
```bash
# Check .gitignore
cat .gitignore | grep -E "\.env|\.env\.local|\.env\.*"

# Scan for committed secrets
git log --all -p | grep -E "API.*KEY|SECRET|PASSWORD|TOKEN" | head -20
```

**Required in `.gitignore`:**
```
.env
.env.local
.env*.local
.vercel
```

#### 7.2 Naming Conventions

**Verify proper prefixes:**
- `NEXT_PUBLIC_*` - Client-side exposed (use sparingly!)
- No prefix - Server-side only
- Never: `CLIENT_*`, `PUBLIC_*` (ambiguous)

**Scan for violations:**
```bash
# Find potentially misnamed variables
grep -rE "NEXT_PUBLIC.*SECRET|NEXT_PUBLIC.*KEY|NEXT_PUBLIC.*PASSWORD" .env* 
```

**Finding:** Secrets with NEXT_PUBLIC_ prefix:
- **Severity:** CRITICAL
- **Issue:** Secret exposed to all clients
- **Remediation:** 
  1. Rotate the secret immediately
  2. Remove NEXT_PUBLIC_ prefix
  3. Move logic using secret to server-side

#### 7.3 Vercel Environment Configuration

**Verify all required variables are set in Vercel dashboard:**

1. Log into Vercel Dashboard
2. Navigate to Project > Settings > Environment Variables
3. Check that ALL secrets are configured for:
   - Production
   - Preview
   - Development (if needed)

**Common missing variables:**
- `SUPABASE_SERVICE_ROLE_KEY` (or `SUPABASE_SECRET_KEY`)
- `OPENROUTER_API_KEY`
- `DATABASE_URL`
- `NEXTAUTH_SECRET`

#### 7.4 Sensitive Environment Variables Feature

**Check if using Vercel's Sensitive Environment Variables:**
- These cannot be decrypted once created (write-only)
- Recommended for production secrets
- Enable in Vercel Dashboard > Settings > Environment Variables

**Verify:**
```bash
# Check Vercel configuration
vercel env ls
```

#### 7.5 Environment Variable Size Limits

**Vercel Limits:**
- Total: 64KB per deployment
- Edge Functions/Middleware: 5KB per variable

**Check total size:**
```bash
# Get approximate size
cat .env.local | wc -c
```

**Finding:** Approaching limits:
- **Severity:** MEDIUM
- **Remediation:** Use external secret management (Vercel KV, Upstash, AWS Secrets Manager)

---

## Category 8: Security Headers & CSP

### Checks to Perform

#### 8.1 next.config.js Security Headers

**Check for headers configuration:**
```bash
cat next.config.js | grep -A 50 "headers()"
```

**Required Headers:**
```javascript
// next.config.js
module.exports = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY', // Prevents clickjacking
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff', // Prevents MIME sniffing
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block', // Legacy XSS protection
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
        ],
      },
    ]
  },
}
```

#### 8.2 Content Security Policy (CSP)

**Check for CSP header:**
```bash
grep -A 10 "Content-Security-Policy" next.config.js
```

**Recommended CSP (adjust based on your needs):**
```javascript
{
  key: 'Content-Security-Policy',
  value: [
    "default-src 'self'",
    "script-src 'self' 'unsafe-eval' 'unsafe-inline'", // Adjust as needed
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "connect-src 'self' https://api.openrouter.ai https://*.supabase.co",
    "frame-ancestors 'none'",
  ].join('; '),
}
```

**Finding:** No CSP configured:
- **Severity:** HIGH
- **Issue:** No protection against XSS, data exfiltration
- **Remediation:** Implement CSP, start permissive and tighten

**Alternative:** Use Nosecone library for CSP as code:
```bash
npm install @nosecone/next
```

---

## Category 9: XSS, CSRF, and Injection Prevention

### Checks to Perform

#### 9.1 Cross-Site Scripting (XSS)

**Search for dangerous patterns:**
```bash
# Find dangerouslySetInnerHTML
grep -r "dangerouslySetInnerHTML" --include="*.tsx" --include="*.jsx"

# Find direct innerHTML manipulation
grep -r "\.innerHTML" --include="*.tsx" --include="*.ts"
```

**Finding:** Usage of `dangerouslySetInnerHTML`:
- **Severity:** HIGH (if user input) / MEDIUM (if sanitized)
- **Remediation:** 
  - Avoid if possible
  - If necessary, use DOMPurify:
    ```typescript
    import DOMPurify from 'isomorphic-dompurify'
    
    <div dangerouslySetInnerHTML={{ 
      __html: DOMPurify.sanitize(userContent) 
    }} />
    ```

#### 9.2 SQL Injection

**Check for string concatenation in queries:**
```bash
# Prisma (should be safe by default)
grep -r "db\..*\.findMany\|db\..*\.findUnique" --include="*.ts"

# Raw SQL (HIGH RISK)
grep -r "\$executeRaw\|\$queryRaw" --include="*.ts"
```

**Vulnerable Pattern:**
```typescript
// ❌ SQL INJECTION VULNERABILITY
const users = await prisma.$queryRaw`
  SELECT * FROM users WHERE name = '${userName}'
`
```

**Secure Pattern:**
```typescript
// ✅ SAFE - Parameterized query
const users = await prisma.$queryRaw`
  SELECT * FROM users WHERE name = ${userName}
`
// Or use Prisma's type-safe API
const users = await prisma.users.findMany({
  where: { name: userName }
})
```

#### 9.3 CSRF Protection

**Verify Server Actions CSRF protection:**
- Next.js Server Actions automatically check Origin vs Host headers
- Ensure you're NOT disabling this protection

**Check for custom fetch to Server Actions:**
```bash
grep -r "fetch.*action" --include="*.ts" --include="*.tsx"
```

**For API Routes, verify CSRF tokens:**
```typescript
// API Routes need manual CSRF protection
import { createCsrfProtect } from '@edge-csrf/nextjs'

const csrfProtect = createCsrfProtect({
  cookie: {
    secure: process.env.NODE_ENV === 'production',
  },
})

export async function POST(req: Request) {
  const csrfError = await csrfProtect(req)
  if (csrfError) {
    return new Response('Invalid CSRF token', { status: 403 })
  }
  // ... handle request
}
```

---

## Category 10: Vercel Deployment Security

### Checks to Perform

#### 10.1 Deployment Protection

**Verify Deployment Protection is enabled:**
1. Vercel Dashboard > Project > Settings > Deployment Protection
2. Options:
   - **Standard Protection** (password for previews)
   - **Vercel Authentication** (requires Vercel account)
   - **Spend Management** (block unauthorized previews)

**Recommended:** Enable at minimum for Preview deployments

#### 10.2 Vercel Firewall Configuration

**If on Pro/Enterprise plan:**
1. Check Vercel Dashboard > Firewall
2. Verify rules for:
   - Rate limiting on AI endpoints
   - DDoS protection
   - Bot protection
   - Geographic restrictions (if needed)

**Recommended Firewall Rules:**
```
Rule 1: Rate limit /api/chat - 10 requests/minute per IP
Rule 2: Block known bad bots
Rule 3: Challenge mode for suspicious traffic
```

#### 10.3 Production Domain Security

**Verify custom domain uses HTTPS:**
```bash
curl -I https://yourdomain.com | grep -i "strict-transport-security"
```

**Should return:** `strict-transport-security: max-age=...`

**Check SSL/TLS certificate:**
- Vercel provides automatic SSL certificates
- Verify no certificate errors in browser
- Check certificate expiration

#### 10.4 Preview Deployment Security

**Risks of preview deployments:**
- Can expose work-in-progress code
- May have different environment variables
- Accessible via predictable URLs

**Verify:**
- [ ] Sensitive environment variables NOT set for Preview
- [ ] Deployment Protection enabled for Preview
- [ ] Preview deployments cleaned up after merge

#### 10.5 Build Security

**Check for secrets in build logs:**
1. Vercel Dashboard > Deployments > [Select Deployment] > Build Logs
2. Search for: "KEY", "SECRET", "PASSWORD", "TOKEN"

**Finding:** Secrets in build logs:
- **Severity:** HIGH
- **Issue:** Secrets exposed to anyone with dashboard access
- **Remediation:**
  - Remove `console.log` or debug statements exposing secrets
  - Use Vercel's Sensitive Environment Variables feature

---

## Category 11: Dependency & CVE Scanning

### Checks to Perform

#### 11.1 Outdated Dependencies

**Run npm audit:**
```bash
npm audit --production
```

**Review output for:**
- Critical vulnerabilities
- High vulnerabilities
- Outdated major versions

**Check Next.js version:**
```bash
grep '"next"' package.json
```

**Required:** Must be on a patched version addressing:
- CVE-2025-29927 (Next.js ≥ 14.2.19 or ≥ 15.1.4)
- CVE-2025-30218 (patched in latest versions)
- CVE-2024-51479 (Next.js ≥ 14.2.10)

#### 11.2 Lock File Integrity

**Verify `package-lock.json` is committed:**
```bash
git ls-files | grep "package-lock.json"
```

**Finding:** No lock file committed:
- **Severity:** MEDIUM
- **Issue:** Inconsistent dependencies across environments
- **Remediation:** Commit `package-lock.json` to Git

#### 11.3 Dependency Scanning Automation

**Recommended Tools:**
- **Dependabot** (GitHub) - Automated PR for updates
- **Snyk** - Vulnerability scanning
- **npm audit** - Built-in scanning
- **Socket** - Supply chain security

**Setup Dependabot:**
```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 10
```

#### 11.4 Supply Chain Security

**Check for suspicious packages:**
```bash
# List all dependencies
npm list --all

# Check for typosquatting or suspicious names
npm list | grep -E "^[├└]─" | awk '{print $2}' | sort
```

**Red Flags:**
- Packages with very few downloads
- Recently published packages (< 6 months)
- Packages with obfuscated code
- Unexpected network requests

---

## Category 12: Network & Rate Limiting

### Checks to Perform

#### 12.1 API Route Rate Limiting

**Check for rate limiting on API routes:**
```bash
grep -r "ratelimit\|RateLimit" --include="*.ts" app/api/
```

**Finding:** No rate limiting:
- **Severity:** HIGH
- **Issue:** Vulnerable to brute force, DoS, abuse
- **Remediation:** Implement rate limiting

**Recommended Implementation:**
```typescript
// lib/rate-limit.ts
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

export const authRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, '1 m'), // 5 attempts per minute
  prefix: 'ratelimit:auth',
})

export const apiRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, '1 m'),
  prefix: 'ratelimit:api',
})
```

#### 12.2 Authentication Endpoint Protection

**Verify rate limiting on auth endpoints:**
```bash
find app/api -name "*auth*" -o -name "*login*" -o -name "*register*"
```

**Each auth endpoint should:**
- Limit to 5 attempts per minute per IP
- Implement exponential backoff after failures
- Log failed attempts for monitoring

#### 12.3 AI Endpoint Rate Limiting

**Critical for cost control - verify rate limits on AI routes:**
```bash
find app/api -name "*chat*" -o -name "*ai*" -o -name "*generate*"
```

**Recommended limits:**
- 10 requests/minute for free users
- 60 requests/minute for paid users
- Maximum request size: 10KB
- Maximum response tokens: 4000

#### 12.4 Vercel WAF Rate Limiting

**If using Vercel WAF (Pro/Enterprise):**
1. Navigate to Vercel Dashboard > Firewall
2. Create custom rules:
   - Rate limit /api/chat route
   - Rate limit authentication endpoints
   - Block suspicious user agents

**Template:**
```
If: Request path = /api/chat
Then: Rate limit 10 requests per 1 minute
Action: Return 429 Too Many Requests
```

---

## Output Format

After completing all checks, Claude should provide:

### 1. Executive Summary
- Total issues found
- Breakdown by severity (CRITICAL / HIGH / MEDIUM / LOW)
- Overall security posture rating (1-10)
- Top 3 most urgent fixes

### 2. Detailed Findings Report

For each finding, include:
```markdown
### [SEVERITY] Category: Issue Title

**File/Location:** `path/to/file.ts:line`

**Description:** 
Clear explanation of the vulnerability

**Impact:**
What could happen if exploited

**Evidence:**
```code
// Show the vulnerable code
```

**Remediation:**
```code
// Show the secure code
```

**References:**
- Link to CVE or OWASP article
- Link to documentation
```

### 3. Prioritized Action Plan

Group fixes by priority:
1. **Immediate (Deploy Blocker)** - Fix before production
2. **Urgent (This Sprint)** - Fix within 1 week  
3. **Important (Next Sprint)** - Fix within 1 month
4. **Recommended (Backlog)** - Enhance when possible

### 4. Compliance Checklist

- [ ] OWASP Top 10 compliance
- [ ] OWASP LLM Top 10 compliance (for AI features)
- [ ] Next.js security best practices (2025)
- [ ] Supabase security best practices
- [ ] All CVEs addressed
- [ ] Security headers configured
- [ ] RLS enabled on all tables
- [ ] Secrets properly managed
- [ ] Rate limiting implemented

---

## Security Baseline Recommendations

For new projects, recommend this security baseline:

### Initial Setup Checklist

1. **Authentication**
   - [ ] Implement Data Access Layer pattern
   - [ ] Remove authentication from middleware
   - [ ] Add auth checks to all Server Actions
   - [ ] Configure HTTP-only, Secure, SameSite cookies

2. **Supabase**
   - [ ] Enable RLS on all tables
   - [ ] Create appropriate policies for each table
   - [ ] Never use service_role key in client code
   - [ ] Migrate to new publishable/secret key model

3. **Environment Variables**
   - [ ] Add `.env*.local` to `.gitignore`
   - [ ] Configure all secrets in Vercel dashboard
   - [ ] Use Sensitive Environment Variables feature
   - [ ] Verify no `NEXT_PUBLIC_` prefix on secrets

4. **Security Headers**
   - [ ] Configure all recommended headers in `next.config.js`
   - [ ] Implement Content Security Policy
   - [ ] Test CSP with browser developer tools

5. **AI Security** (if using AI features)
   - [ ] Install `eslint-plugin-vercel-ai-security`
   - [ ] Validate all user inputs before LLM calls
   - [ ] Add auth/validation to all tool functions
   - [ ] Enable OpenRouter ZDR
   - [ ] Implement rate limiting on AI endpoints

6. **Dependencies**
   - [ ] Update to latest patched Next.js version
   - [ ] Commit `package-lock.json`
   - [ ] Setup Dependabot
   - [ ] Run `npm audit` in CI/CD

7. **Deployment**
   - [ ] Enable Deployment Protection
   - [ ] Configure Vercel Firewall (if available)
   - [ ] Verify HTTPS on custom domain
   - [ ] Clean up old preview deployments

---

## Continuous Security

### Recommended Practices

1. **Regular Audits**
   - Run this security audit monthly
   - After any major dependency updates
   - Before production releases
   - After security incidents

2. **Monitoring**
   - Enable Vercel Analytics for anomaly detection
   - Monitor error rates and unusual patterns
   - Set up alerts for failed auth attempts
   - Track AI usage and costs

3. **Incident Response**
   - Document security incident process
   - Have key rotation procedures ready
   - Maintain audit logs for forensics
   - Test backup/restore procedures

4. **Team Training**
   - Share this security audit with team
   - Review OWASP Top 10 quarterly
   - Conduct security code reviews
   - Stay updated on CVEs affecting your stack

---

## Important Reminders

1. **Never apologize for security findings** - You are providing a valuable service
2. **Be specific and actionable** - Generic advice doesn't help developers
3. **Provide code examples** - Show both vulnerable and secure patterns
4. **Link to authoritative sources** - OWASP, official docs, CVE databases
5. **Acknowledge uncertainty** - If you're not sure, say so and recommend expert review
6. **Respect the user's context** - Not all findings may apply to their use case
7. **Be encouraging** - Security is hard; celebrate what they're doing right

---

## Final Output Guidelines

- Deliver findings in clear Markdown format
- Use tables for summary data
- Provide clickable file links when possible
- Include severity badges (🔴 CRITICAL, 🟠 HIGH, 🟡 MEDIUM, 🟢 LOW)
- End with next steps and offer to help with remediation
- Offer to create GitHub issues for each finding
- Suggest timeline for fixes based on severity
