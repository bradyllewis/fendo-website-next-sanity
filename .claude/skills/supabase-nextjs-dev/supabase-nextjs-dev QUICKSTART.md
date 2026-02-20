# Supabase Next.js Developer Skill - Quick Start Guide

## What You've Got

A comprehensive, production-ready Claude skill for building full-stack applications with Next.js and Supabase. This skill was created with the latest best practices as of January 2026.

## Installation (30 seconds)

1. **Extract the ZIP file** you just downloaded
2. **Place the `supabase-nextjs-dev` folder** in your Claude skills directory
3. **That's it!** Claude will automatically detect and use this skill

## First Steps

### Test the Skill

Try these prompts to see the skill in action:

**Basic Auth Setup:**
```
"Set up Supabase authentication in my Next.js 14 app with cookie-based sessions"
```

**Database Design:**
```
"Create a tasks table with user ownership, status field, and RLS policies"
```

**Real-Time Features:**
```
"Build a real-time chat component using Supabase Realtime"
```

### What Makes This Skill Special

1. **Latest Best Practices** - Cookie-based auth with @supabase/ssr (January 2026 standard)
2. **Performance-Optimized RLS** - Uses SELECT wrapping and security definer functions
3. **Hybrid Approach** - RLS for reads, Server Actions for writes (best of both worlds)
4. **Complete Examples** - Ready-to-use templates for auth, CRUD, Edge Functions
5. **Production-Ready** - Includes error handling, type safety, security best practices

## Skill Contents

```
supabase-nextjs-dev/
├── SKILL.md                           # Main skill (Claude reads this)
├── README.md                          # User documentation
├── references/
│   ├── advanced-rls-patterns.md      # Complex authorization scenarios
│   └── edge-functions-guide.md       # Comprehensive Edge Functions guide
└── templates/
    ├── auth-complete.md              # Full auth implementation
    └── crud-complete.md              # Complete CRUD example
```

## Common Use Cases

### 1. Starting a New Project

```
"I'm building a SaaS app with Next.js and Supabase. Help me set up:
- Authentication with email/password
- User profiles table
- Organizations and teams (multi-tenant)
- Proper RLS policies"
```

### 2. Debugging RLS Issues

```
"My RLS policy isn't working. Users can't see their posts. Here's my setup:
[paste your schema and policies]"
```

### 3. Building Features

```
"Create a collaborative document editor where:
- Users can create and share documents
- Real-time updates show who's editing
- Permissions: view, edit, admin
- Uses Supabase Realtime"
```

### 4. Performance Optimization

```
"This query is slow with RLS enabled:
[paste your query]
Help me optimize it with indexes and security definer functions"
```

### 5. Edge Functions

```
"Build a Stripe webhook handler that:
- Verifies the webhook signature
- Updates user subscriptions in the database
- Sends confirmation emails
- Handles failed payments"
```

## Example Session

**You:** "Help me set up authentication"

**Claude (using skill):** 
1. Provides complete file structure
2. Shows cookie-based auth setup with @supabase/ssr
3. Includes middleware for token refresh
4. Gives you login/signup pages
5. Demonstrates protected routes
6. Explains security implications

**You:** "Now add a posts table"

**Claude (using skill):**
1. Creates optimized schema with indexes
2. Sets up RLS policies (reads via RLS, writes via Server Actions)
3. Provides type-safe CRUD operations
4. Shows both Server Components and Client Components patterns
5. Includes real-time subscriptions option

## Pro Tips

1. **Be Specific:** Instead of "help with auth", try "set up email/password auth with protected dashboard route"

2. **Mention Your Stack:** Even though the skill knows Next.js + Supabase, mentioning it helps trigger activation

3. **Ask for Complete Examples:** Claude will provide full, working code with this skill

4. **Request Best Practices:** Ask "what's the production-ready way to..." for optimal patterns

5. **Debugging:** Share your code and Claude will identify issues using skill knowledge

## Key Concepts This Skill Covers

### Authentication (2025 Standard)
- Cookie-based sessions (not localStorage!)
- @supabase/ssr package
- Server Components compatible
- Automatic token refresh

### Row Level Security
- When to use RLS vs Server Actions
- Performance optimization techniques
- Complex multi-tenant patterns
- Security definer functions

### Database Design
- Type safety with generated types
- Migration workflows
- Index optimization
- Trigger patterns

### Edge Functions
- Deno 2.1 runtime
- Webhook handling
- Third-party integrations
- Error handling & logging

### Real-Time
- WebSocket subscriptions
- Optimistic updates
- Conflict resolution
- Presence tracking

## Troubleshooting

**Skill not activating?**
- Mention "Supabase" or "Next.js" in your prompt
- Be specific about what you're building
- Try: "Using the Supabase Next.js skill, help me..."

**Getting outdated patterns?**
- This skill uses January 2026 best practices
- If you see localStorage for auth or Pages Router examples, mention "use App Router and @supabase/ssr"

**Need more detail?**
- Ask Claude to reference the advanced patterns or Edge Functions guide
- Request specific sections: "Show me the multi-tenant RLS pattern"

## What's Different from Generic Advice

**Old Way (Pre-2025):**
- localStorage for tokens
- Client-side auth everywhere
- RLS for everything
- Pages Router patterns

**This Skill (2025+):**
- Cookie-based sessions (@supabase/ssr)
- Server Components + Server Actions
- Hybrid: RLS for reads, Server Actions for writes
- App Router patterns
- Performance-optimized RLS

## Resources Referenced

This skill synthesizes knowledge from:
- Supabase official documentation (January 2026)
- Next.js 14+ App Router docs
- Production deployment experiences
- RLS performance optimization research
- Deno 2.1 Edge Runtime documentation

## Support

For issues or questions:
1. Ask Claude directly - it can explain any part of the skill
2. Check the README.md in the skill folder
3. Review the reference files for deep dives
4. Look at the templates for complete examples

## Next Steps

1. **Try it out** - Run one of the example prompts above
2. **Build something** - Use it for your actual project
3. **Explore references** - Check the advanced patterns when needed
4. **Iterate** - Ask Claude to refine and optimize as you build

---

**You're all set! Start building amazing full-stack apps with Supabase and Next.js.**

*Remember: This skill represents cutting-edge best practices as of January 2026. The patterns here are production-tested and performance-optimized.*