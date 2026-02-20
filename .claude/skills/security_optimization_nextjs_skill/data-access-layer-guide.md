# Implementing a Data Access Layer (DAL) - 2025 Best Practice

## Why Data Access Layer?

As of 2025, **middleware is no longer recommended for authentication** in Next.js applications due to multiple bypass vulnerabilities (CVE-2025-29927, CVE-2024-51479). The recommended pattern is a **Data Access Layer** that centralizes all data access and provides a single authentication boundary.

## Benefits of DAL

1. **Single Authentication Boundary** - All data access goes through authenticated functions
2. **Reduced Attack Surface** - Easier to audit and secure one layer than scattered checks
3. **Performance** - Can share an in-memory cache across the request
4. **Type Safety** - Central location for DTOs prevents data leaks
5. **Testing** - Easier to mock and test security boundaries
6. **Team Clarity** - Clear pattern for all developers to follow

## DAL Architecture

```
┌─────────────────────────────────────────┐
│         User Interface Layer            │
│  (Server Components, Client Components) │
└─────────────────┬───────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────┐
│       Data Access Layer (DAL)           │
│  ✓ Authentication checks                │
│  ✓ Authorization logic                  │
│  ✓ Data validation                      │
│  ✓ Returns DTOs (safe data objects)     │
└─────────────────┬───────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────┐
│         Database / External APIs        │
│        (Supabase, PostgreSQL, etc)      │
└─────────────────────────────────────────┘
```

## File Structure

```
src/
├── lib/
│   ├── dal/
│   │   ├── index.ts           # Public DAL exports
│   │   ├── user.ts            # User data access
│   │   ├── post.ts            # Post data access
│   │   ├── auth.ts            # Authentication helpers
│   │   └── dto.ts             # Data Transfer Objects
│   ├── db.ts                  # Database client (Supabase/Prisma)
│   └── auth.ts                # Session management
├── app/
│   ├── (routes)/
│   └── actions/               # Server Actions (use DAL)
```

## Step-by-Step Implementation

### Step 1: Create Authentication Helpers

```typescript
// lib/dal/auth.ts
import { cookies } from 'next/headers'
import { cache } from 'react'
import { createServerClient } from '@supabase/ssr'

// Use React cache to share across the request
export const getSession = cache(async () => {
  const cookieStore = cookies()
  
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
      },
    }
  )
  
  const { data: { session } } = await supabase.auth.getSession()
  return session
})

// Helper to get current user ID
export const getCurrentUserId = cache(async () => {
  const session = await getSession()
  if (!session) return null
  return session.user.id
})

// Helper to require authentication (throws if not authenticated)
export const requireAuth = cache(async () => {
  const session = await getSession()
  if (!session) {
    throw new Error('Unauthorized: Authentication required')
  }
  return session
})
```

### Step 2: Create Data Transfer Objects (DTOs)

```typescript
// lib/dal/dto.ts

/**
 * DTOs ensure only safe data is exposed to components.
 * Never return raw database objects to the UI.
 */

// User DTO - Expose only safe fields
export class PublicUserDTO {
  readonly id: string
  readonly name: string
  readonly avatar: string | null
  readonly createdAt: Date
  
  constructor(user: any) {
    this.id = user.id
    this.name = user.name
    this.avatar = user.avatar
    this.createdAt = user.created_at
    // Explicitly exclude: email, password_hash, api_keys, etc.
  }
}

// Current User DTO - Can include more fields for the logged-in user
export class CurrentUserDTO extends PublicUserDTO {
  readonly email: string
  readonly emailVerified: boolean
  
  constructor(user: any) {
    super(user)
    this.email = user.email
    this.emailVerified = user.email_verified
    // Still exclude: password_hash, api_keys, etc.
  }
}

// Post DTO
export class PostDTO {
  readonly id: string
  readonly title: string
  readonly content: string
  readonly authorId: string
  readonly createdAt: Date
  readonly updatedAt: Date
  
  constructor(post: any) {
    this.id = post.id
    this.title = post.title
    this.content = post.content
    this.authorId = post.author_id
    this.createdAt = post.created_at
    this.updatedAt = post.updated_at
  }
}
```

### Step 3: Create DAL Functions

```typescript
// lib/dal/user.ts
import { cache } from 'react'
import { supabase } from '@/lib/db'
import { getCurrentUserId, requireAuth } from './auth'
import { PublicUserDTO, CurrentUserDTO } from './dto'

/**
 * Get current user's full profile
 * Authentication: Required
 * Returns: CurrentUserDTO with email and settings
 */
export const getCurrentUser = cache(async (): Promise<CurrentUserDTO | null> => {
  const userId = await getCurrentUserId()
  if (!userId) return null
  
  const { data: user, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single()
  
  if (error || !user) return null
  
  // Return DTO - only safe fields exposed
  return new CurrentUserDTO(user)
})

/**
 * Get public profile of any user
 * Authentication: Not required (public data)
 * Returns: PublicUserDTO with limited fields
 */
export const getUserById = cache(async (userId: string): Promise<PublicUserDTO | null> => {
  // No auth check - this is public data
  // But RLS policies still apply in Supabase
  
  const { data: user, error } = await supabase
    .from('users')
    .select('id, name, avatar, created_at')
    .eq('id', userId)
    .single()
  
  if (error || !user) return null
  
  return new PublicUserDTO(user)
})

/**
 * Update current user's profile
 * Authentication: Required
 * Authorization: Can only update own profile
 */
export const updateUserProfile = async (data: {
  name?: string
  avatar?: string
}): Promise<CurrentUserDTO> => {
  // 1. Authenticate
  const session = await requireAuth()
  
  // 2. Validate input
  if (data.name && data.name.length < 2) {
    throw new Error('Name must be at least 2 characters')
  }
  
  // 3. Update in database
  const { data: user, error } = await supabase
    .from('users')
    .update({
      name: data.name,
      avatar: data.avatar,
      updated_at: new Date().toISOString(),
    })
    .eq('id', session.user.id)
    .select()
    .single()
  
  if (error || !user) {
    throw new Error('Failed to update profile')
  }
  
  // 4. Return DTO
  return new CurrentUserDTO(user)
}
```

```typescript
// lib/dal/post.ts
import { cache } from 'react'
import { supabase } from '@/lib/db'
import { getCurrentUserId, requireAuth } from './auth'
import { PostDTO } from './dto'

/**
 * Get all public posts
 * Authentication: Not required
 */
export const getPosts = cache(async (): Promise<PostDTO[]> => {
  const { data: posts, error } = await supabase
    .from('posts')
    .select('*')
    .eq('published', true)
    .order('created_at', { ascending: false })
  
  if (error || !posts) return []
  
  return posts.map(post => new PostDTO(post))
})

/**
 * Get post by ID
 * Authentication: Not required for public posts
 * Authorization: RLS handles unpublished posts
 */
export const getPostById = cache(async (postId: string): Promise<PostDTO | null> => {
  const { data: post, error } = await supabase
    .from('posts')
    .select('*')
    .eq('id', postId)
    .single()
  
  if (error || !post) return null
  
  return new PostDTO(post)
})

/**
 * Create a new post
 * Authentication: Required
 * Authorization: User must be authenticated
 */
export const createPost = async (data: {
  title: string
  content: string
}): Promise<PostDTO> => {
  // 1. Authenticate
  const session = await requireAuth()
  
  // 2. Validate input
  if (!data.title || data.title.length < 3) {
    throw new Error('Title must be at least 3 characters')
  }
  if (!data.content || data.content.length < 10) {
    throw new Error('Content must be at least 10 characters')
  }
  
  // 3. Create in database
  const { data: post, error } = await supabase
    .from('posts')
    .insert({
      title: data.title,
      content: data.content,
      author_id: session.user.id,
      published: false,
    })
    .select()
    .single()
  
  if (error || !post) {
    throw new Error('Failed to create post')
  }
  
  // 4. Return DTO
  return new PostDTO(post)
}

/**
 * Update a post
 * Authentication: Required
 * Authorization: User must own the post
 */
export const updatePost = async (
  postId: string,
  data: { title?: string; content?: string }
): Promise<PostDTO> => {
  // 1. Authenticate
  const session = await requireAuth()
  
  // 2. Check authorization - user must own the post
  const existingPost = await getPostById(postId)
  if (!existingPost) {
    throw new Error('Post not found')
  }
  
  if (existingPost.authorId !== session.user.id) {
    throw new Error('Forbidden: You can only edit your own posts')
  }
  
  // 3. Validate input
  if (data.title && data.title.length < 3) {
    throw new Error('Title must be at least 3 characters')
  }
  
  // 4. Update in database
  const { data: post, error } = await supabase
    .from('posts')
    .update({
      ...data,
      updated_at: new Date().toISOString(),
    })
    .eq('id', postId)
    .select()
    .single()
  
  if (error || !post) {
    throw new Error('Failed to update post')
  }
  
  // 5. Return DTO
  return new PostDTO(post)
}

/**
 * Delete a post
 * Authentication: Required
 * Authorization: User must own the post
 */
export const deletePost = async (postId: string): Promise<void> => {
  // 1. Authenticate
  const session = await requireAuth()
  
  // 2. Check authorization
  const existingPost = await getPostById(postId)
  if (!existingPost) {
    throw new Error('Post not found')
  }
  
  if (existingPost.authorId !== session.user.id) {
    throw new Error('Forbidden: You can only delete your own posts')
  }
  
  // 3. Delete
  const { error } = await supabase
    .from('posts')
    .delete()
    .eq('id', postId)
  
  if (error) {
    throw new Error('Failed to delete post')
  }
}
```

### Step 4: Create Public DAL Interface

```typescript
// lib/dal/index.ts

/**
 * Public Data Access Layer
 * 
 * This is the ONLY interface your application should use for data access.
 * Import from here, never directly from individual files.
 */

// Authentication
export { getSession, getCurrentUserId, requireAuth } from './auth'

// Users
export { getCurrentUser, getUserById, updateUserProfile } from './user'

// Posts
export { 
  getPosts, 
  getPostById, 
  createPost, 
  updatePost, 
  deletePost 
} from './post'

// DTOs (for type checking)
export type { PublicUserDTO, CurrentUserDTO } from './dto'
export type { PostDTO } from './dto'
```

### Step 5: Use DAL in Server Components

```typescript
// app/profile/page.tsx
import { getCurrentUser } from '@/lib/dal'
import { redirect } from 'next/navigation'

export default async function ProfilePage() {
  // Get current user through DAL
  const user = await getCurrentUser()
  
  // Handle unauthenticated
  if (!user) {
    redirect('/login')
  }
  
  // user is CurrentUserDTO - type-safe, only safe fields
  return (
    <div>
      <h1>{user.name}</h1>
      <p>{user.email}</p>
      {/* Cannot access user.password_hash - doesn't exist on DTO */}
    </div>
  )
}
```

### Step 6: Use DAL in Server Actions

```typescript
// app/actions/post.ts
'use server'

import { createPost, updatePost, deletePost } from '@/lib/dal'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const createPostSchema = z.object({
  title: z.string().min(3).max(200),
  content: z.string().min(10).max(10000),
})

export async function createPostAction(formData: FormData) {
  // 1. Validate input
  const validated = createPostSchema.parse({
    title: formData.get('title'),
    content: formData.get('content'),
  })
  
  // 2. Call DAL function (handles auth automatically)
  try {
    const post = await createPost(validated)
    
    // 3. Revalidate
    revalidatePath('/posts')
    
    return { success: true, post }
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }
  }
}

const updatePostSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(3).max(200).optional(),
  content: z.string().min(10).max(10000).optional(),
})

export async function updatePostAction(formData: FormData) {
  const validated = updatePostSchema.parse({
    id: formData.get('id'),
    title: formData.get('title'),
    content: formData.get('content'),
  })
  
  try {
    const { id, ...data } = validated
    const post = await updatePost(id, data)
    
    revalidatePath(`/posts/${id}`)
    
    return { success: true, post }
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }
  }
}
```

## Security Checklist

When implementing a DAL, ensure:

- [ ] All database imports are ONLY in DAL files
- [ ] All environment variables are ONLY accessed in DAL
- [ ] Authentication is checked in EVERY DAL function that accesses user data
- [ ] Authorization is verified (user can access THIS specific data)
- [ ] Input validation happens in DAL or Server Actions
- [ ] Only DTOs are returned, never raw database objects
- [ ] DTOs use classes or types to prevent accidental field exposure
- [ ] `cache()` is used for functions called multiple times per request
- [ ] Error messages don't leak sensitive information
- [ ] Server Components and Server Actions ONLY import from `lib/dal`

## Anti-Patterns to Avoid

### ❌ DON'T: Import database directly in components

```typescript
// app/posts/page.tsx
import { supabase } from '@/lib/db' // ❌ BAD!

export default async function Page() {
  const { data } = await supabase.from('posts').select('*')
  return <div>...</div>
}
```

### ✅ DO: Use DAL

```typescript
// app/posts/page.tsx
import { getPosts } from '@/lib/dal' // ✅ GOOD!

export default async function Page() {
  const posts = await getPosts()
  return <div>...</div>
}
```

### ❌ DON'T: Return raw database objects

```typescript
export async function getUser(id: string) {
  const user = await db.users.findUnique({ where: { id }})
  return user // ❌ Exposes password_hash, api_keys, etc.
}
```

### ✅ DO: Return DTOs

```typescript
export async function getUser(id: string) {
  const user = await db.users.findUnique({ where: { id }})
  if (!user) return null
  return new PublicUserDTO(user) // ✅ Only safe fields
}
```

### ❌ DON'T: Skip authentication checks

```typescript
export async function deleteUser(id: string) {
  await db.users.delete({ where: { id }}) // ❌ No auth!
}
```

### ✅ DO: Always authenticate and authorize

```typescript
export async function deleteUser(id: string) {
  const session = await requireAuth()
  
  // Check authorization
  if (session.user.id !== id && !session.user.isAdmin) {
    throw new Error('Forbidden')
  }
  
  await db.users.delete({ where: { id }})
}
```

## Testing Your DAL

```typescript
// __tests__/dal/user.test.ts
import { getCurrentUser, updateUserProfile } from '@/lib/dal'
import { mockSession } from '@/test-utils'

describe('User DAL', () => {
  it('returns null when not authenticated', async () => {
    mockSession(null)
    const user = await getCurrentUser()
    expect(user).toBeNull()
  })
  
  it('returns current user when authenticated', async () => {
    mockSession({ user: { id: '123', email: 'test@example.com' }})
    const user = await getCurrentUser()
    expect(user).toBeTruthy()
    expect(user?.id).toBe('123')
  })
  
  it('prevents updating another user\'s profile', async () => {
    mockSession({ user: { id: '123' }})
    
    await expect(
      updateUserProfile('456', { name: 'Hacker' })
    ).rejects.toThrow('Forbidden')
  })
})
```

## Migration Strategy

If you have an existing codebase without a DAL:

### Phase 1: Create DAL Infrastructure
1. Create `lib/dal/` directory
2. Implement authentication helpers
3. Create DTO classes for your main entities

### Phase 2: Migrate Critical Paths First
1. Start with user authentication flows
2. Migrate payment/billing logic
3. Migrate admin functionality

### Phase 3: Gradual Component Migration
1. Migrate one component at a time
2. Run both old and new code paths with feature flags
3. Monitor for errors
4. Remove old code after verification

### Phase 4: Deprecate Old Patterns
1. Add linting rules to prevent direct DB access in components
2. Remove database client exports from shared modules
3. Update documentation and examples

## Additional Resources

- [Next.js Data Security Guide](https://nextjs.org/docs/app/guides/data-security)
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [Supabase Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)

## Summary

The Data Access Layer pattern is the **2025 standard** for Next.js application security. By centralizing data access, authentication, and authorization in a single layer, you:

1. Reduce attack surface
2. Make security audits easier
3. Prevent accidental data leaks
4. Improve code maintainability
5. Enable better testing

**Remember:** The DAL is your **primary security boundary**. Every other layer (middleware, route handlers, UI) is secondary defense. Get the DAL right, and your application is secure by default.
