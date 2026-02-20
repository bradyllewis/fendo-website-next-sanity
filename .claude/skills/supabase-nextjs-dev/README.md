# Supabase Next.js Developer Skill

A production-ready Claude skill for building full-stack applications with Next.js App Router and Supabase.

## What This Skill Does

This skill transforms Claude into an expert Supabase + Next.js developer, providing:

- **Complete authentication patterns** using cookie-based sessions (@supabase/ssr)
- **Optimized Row Level Security (RLS)** strategies for security and performance
- **Database schema design** with migrations and type safety
- **Edge Functions** with Deno 2.1 for serverless logic
- **Real-time subscriptions** for live updates
- **File storage** integration patterns
- **Production deployment** best practices
- **Performance optimization** techniques

## Installation

1. **Download the skill** (you should have a `supabase-nextjs-dev.zip` file)

2. **Extract the files** to your Claude skills directory

3. **Enable the skill** in Claude settings (if using Claude Desktop)

## When Claude Uses This Skill

Claude automatically activates this skill when you:

- Mention "Supabase" or "Next.js" in your query
- Ask about authentication, database setup, or backend integration
- Need help with RLS policies, queries, or schema design
- Want to implement real-time features or file storage
- Request guidance on deployment or optimization
- Reference terms like "full-stack", "BaaS", "PostgreSQL", "SSR"

## Example Prompts

### Getting Started

```
"Help me set up Supabase authentication in my Next.js 14 app"

"Create a complete auth setup with login, signup, and protected routes"

"Show me the file structure for Next.js + Supabase integration"
```

### Database & RLS

```
"Create a posts table with user ownership and RLS policies"

"How do I optimize this slow RLS query for team-based access?"

"Design a multi-tenant database schema with proper RLS"

"What's the best way to handle mutations - RLS or Server Actions?"
```

### Advanced Features

```
"Build an Edge Function to handle Stripe webhooks"

"Set up real-time subscriptions for a chat application"

"Create a file upload component with Supabase Storage"

"Help me debug why my RLS policy isn't working"
```

### Performance & Production

```
"How can I improve query performance with RLS enabled?"

"What's the production deployment checklist for Supabase?"

"Set up database migrations with the Supabase CLI"

"Add caching to my Next.js app with Supabase data"
```

## What You'll Get

### Complete Code Examples

Claude provides working, production-ready code with:
- All necessary imports
- TypeScript types
- Error handling
- Security best practices
- Performance considerations

### Architecture Guidance

- Client vs Server Components usage
- When to use RLS vs Server Actions
- Database schema design patterns
- Authentication flow recommendations

### Production Best Practices

- Security hardening
- Performance optimization
- Deployment strategies
- Testing approaches
- Error handling patterns

## Skill Contents

```
supabase-nextjs-dev/
├── SKILL.md                           # Core skill instructions
├── references/
│   ├── advanced-rls-patterns.md      # Complex RLS scenarios
│   └── edge-functions-guide.md       # Comprehensive Edge Functions guide
└── README.md                          # This file
```

## Key Features

### 1. Authentication (2025 Best Practices)

- Cookie-based auth with `@supabase/ssr`
- Server Components and Server Actions support
- Automatic token refresh via middleware
- Protected route patterns
- OAuth integration

### 2. Row Level Security

- Performance-optimized policies
- Multi-tenant patterns
- Hierarchical access control
- Time-based access
- Security definer functions

### 3. Database Operations

- Type-safe queries with generated types
- Server Actions for mutations
- Real-time subscriptions
- Batch processing
- Transaction handling

### 4. Edge Functions

- Webhook handlers (Stripe, GitHub, etc.)
- Email services
- Image optimization
- ETL/data processing
- Third-party integrations

### 5. File Storage

- Upload/download patterns
- Storage policies
- CDN optimization
- Public/private buckets

## Technology Stack Covered

- **Next.js 14+** with App Router
- **Supabase** (Auth, Database, Storage, Edge Functions, Realtime)
- **TypeScript** for type safety
- **PostgreSQL** with Row Level Security
- **Deno 2.1** for Edge Functions
- **React Server Components**

## Learning Path

1. **Start with basics**: Authentication setup and simple queries
2. **Add complexity**: RLS policies and protected routes
3. **Go advanced**: Edge Functions, real-time features
4. **Optimize**: Performance tuning, caching, production deployment

## Common Tasks

### Create New Table with RLS

```typescript
"Create a 'tasks' table with:
- User ownership
- Status field (todo, in_progress, done)
- RLS so users only see their own tasks
- TypeScript types
- CRUD operations in Next.js"
```

### Set Up Authentication

```typescript
"Set up complete Supabase auth with:
- Cookie-based sessions
- Login/signup forms
- Protected dashboard route
- Sign out functionality
- Middleware for token refresh"
```

### Build Real-Time Feature

```typescript
"Create a real-time collaborative todo list where:
- Multiple users can see updates instantly
- Uses Supabase Realtime
- Shows who's online
- Handles conflicts gracefully"
```

## Troubleshooting

If Claude doesn't seem to be using the skill:

1. Make sure you mention "Supabase" or "Next.js" in your query
2. Be specific about what you're trying to build
3. If needed, explicitly ask: "Use the Supabase Next.js skill"

## Best Practices Claude Will Recommend

### Security
- Always enable RLS on user-facing tables
- Never expose service role key on client
- Use prepared statements (automatic with Supabase)
- Validate all user input in Server Actions
- Enable email confirmation for signups

### Performance
- Index columns used in RLS policies
- Wrap auth functions in SELECT to cache
- Use Server Actions for mutations (bypass RLS)
- Implement pagination for large datasets
- Use Next.js caching strategies

### Code Quality
- Generate TypeScript types from database
- Use Server Components for data fetching
- Handle errors gracefully
- Write tests for critical paths
- Document complex RLS policies

## Version Compatibility

This skill is updated for:
- **Next.js**: 14+ (App Router)
- **Supabase**: Latest (January 2026)
- **@supabase/ssr**: 0.5+
- **Deno**: 2.1 (Edge Functions)
- **TypeScript**: 5+

## Additional Resources

- [Supabase Documentation](https://supabase.com/docs)
- [Next.js Documentation](https://nextjs.org/docs)
- [@supabase/ssr Guide](https://supabase.com/docs/guides/auth/server-side)
- [RLS Performance](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Edge Functions](https://supabase.com/docs/guides/functions)

## Feedback & Updates

This skill represents best practices as of January 2026. If you encounter outdated patterns or have suggestions for improvements, you can:

1. Provide feedback to Claude during your session
2. Ask Claude to search for the latest documentation
3. Request updates based on new Supabase/Next.js features

## License

Apache-2.0

## Author

Created by Claude with research into the latest Supabase and Next.js best practices (January 2026).

---

**Happy building! This skill will help you create production-ready, secure, and performant full-stack applications with Supabase and Next.js.**