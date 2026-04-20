# Pending Tasks

Items not yet delivered. Context and research notes included to accelerate future sessions.

---

## 1. Klaviyo — Newsletter Signup Integration (COMPLETED)

**What:** Connect the existing newsletter signup form to Klaviyo for email list management.

**Context:**
- Klaviyo MCP server is available in this project (`mcp__claude_ai_Klaviyo__authenticate`)
- Need to locate the existing newsletter signup component/form (likely on homepage or footer)
- Will need `KLAVIYO_API_KEY` and a list ID added to env vars
- Typical approach: server action or API route that calls Klaviyo's `POST /v3/profile-subscription-bulk-create-jobs` endpoint with the subscriber's email

**Steps to implement:**
1. Locate existing newsletter signup component
2. Create server action or API route at `/api/klaviyo/subscribe`
3. Add `KLAVIYO_API_KEY` and `KLAVIYO_LIST_ID` to `.env.local` and Vercel env vars
4. Wire the form to the new endpoint

---

## 2. Sponsorship Registration — Supabase Table + UI (COMPLETED)

**What:** Full sponsor registration flow linked to Sanity event records. This is a separate flow from player registration.

**Context from `tournament_details.md`:**

### Sponsor form fields:

**Sponsor Info**
- Company Name
- Primary Contact name
- Email / Phone

**Sponsorship Level**
- Level selection (Presenting, Gold, Silver, etc. — levels need to be defined per event or globally)
- Benefits auto-display based on selected level

**Player Allocation**
- Some levels include player spots — form to register those players (assign teams or individuals)

**Payment**
- Pay now (Card / ACH via Stripe)
- Pay later (Invoice / Check — creates a record with `payment_method: 'invoice'` status)

**Activation & Assets**
- Logo upload (file upload to Supabase Storage)
- Marketing material requests (text field)
- On-site activation notes / special requests (textarea)

**Internal Tags (hidden, admin-only)**
- Event ID (auto-populated)
- City / Market
- Sponsor source
- Influencer / Athlete flagging
- First time vs. returning sponsor
- High-value attendee flagging

### Database design notes:
- New table: `sponsor_registrations` (separate from `event_registrations`)
- Columns: `id`, `event_sanity_id`, `event_slug`, `company_name`, `primary_contact`, `email`, `phone`, `sponsorship_level`, `payment_method` (`stripe` | `invoice`), `stripe_checkout_session_id`, `amount_paid`, `status` (`pending` | `paid` | `invoiced` | `cancelled`), `logo_url`, `activation_notes`, `marketing_requests`, `metadata` JSONB (for internal tags + player allocation), `created_at`, `updated_at`
- Supabase Storage bucket: `sponsor-assets` for logo uploads
- Admin page: `/admin/sponsorships` (similar pattern to `/admin/registrations`)

### Sanity changes needed:
- Add sponsorship levels to the `event` schema (array of objects: level name, price, benefits list, included player spots)
- OR manage globally in a separate `sponsorshipTiers` document type

### Routes to create:
- `/compete/[slug]/sponsor` — sponsor registration page (multi-step, similar pattern to `/compete/[slug]/register`)
- `/api/stripe/sponsor-checkout` — Stripe checkout for sponsor payments
- `/compete/[slug]/sponsor-success` — post-payment confirmation
- `/admin/sponsorships` — admin view

---

## 3. Team Join-via-Code (Registration Enhancement) (COMPLETED)

**What:** Allow players to join an existing team's registration using an invite link or team code, rather than having one person enter all teammate info.

**Context:**
- Currently deferred: the registering user enters all teammate names/emails at registration time
- This feature would let each player self-register under a shared team

**Design notes:**
- Need a `teams` table: `id`, `event_sanity_id`, `team_name`, `invite_code` (short unique code), `created_by` (user_id), `max_members`, `created_at`
- `event_registrations` gets a `team_id` FK to link individual registrations to a team
- Team creation happens during registration (step 3 "Team Details" currently)
- "Join existing team" on step 1 (Type) → enter invite code → skip to player info

**Complexity:** Medium — requires invite code generation, team membership validation, and ensuring the team doesn't exceed its max size.

---

## 4. Add-On Pricing (Registration Enhancement) (COMPLETED)

**What:** Add actual pricing to the optional add-ons in the registration flow (currently captured as free checkboxes, with pricing "confirmed separately").

**Context:**
- Add-ons are currently: Longest Putt Contest, Closest to the Pin, Mulligans Pack (5), VIP Lounge Access, Post-Round Hospitality Upgrade
- Prices are not yet configured anywhere

**Options:**
- **A (Simpler - RECOMMENDED):** Add an `addOns` array to the Sanity `event` schema where each add-on has a name, description, and price. Registration form reads these dynamically and adds line items to the Stripe checkout session.
- **B (Hardcoded):** Define fixed prices in code and add them as additional Stripe line items.

**Recommended:** Option A — configure per-event in Sanity Studio so the Fendo team can manage pricing without a code deploy.

**Sanity schema addition needed for Option A:**
```ts
defineField({
  name: 'addOns',
  title: 'Add-Ons',
  type: 'array',
  of: [{
    type: 'object',
    fields: [
      defineField({ name: 'id', type: 'string' }),       // e.g. 'longestPutt'
      defineField({ name: 'label', type: 'string' }),    // display name
      defineField({ name: 'price', type: 'number' }),    // USD
      defineField({ name: 'description', type: 'text' }),
    ]
  }]
})
```

---

## 5. Custom Email Branding (Auth / Transactional) (NOT STARTED)

**What:** Replace Supabase default email sender with branded Fendo emails.

**Status:** Manual Supabase dashboard steps were completed (Site URL + template update). Full custom SMTP not yet configured.

**To complete:**
1. Sign up for Resend (free tier: 3,000 emails/month) at resend.com
2. Add and verify your sending domain (e.g. `mail.fendogolf.com`)
3. In Supabase Dashboard → **Project Settings → Auth → SMTP Settings**: enter Resend SMTP credentials
   - Host: `smtp.resend.com`, Port: `465`, User: `resend`, Password: your Resend API key
4. Update the "Confirm signup" and "Reset password" email templates in Supabase with Fendo branding

---

## Notes on Current State

- **Registration form** (`/compete/[slug]/register`) is live with: type selection, player info, teammates, team details, add-ons (checkbox only), and review → Stripe checkout
- **DB migration** `20260420000000_registration_details.sql` adds `registration_type` and `team_name` columns — already applied
- **Admin panel** (`/admin/registrations`) shows `registration_type` and `team_name` per row
