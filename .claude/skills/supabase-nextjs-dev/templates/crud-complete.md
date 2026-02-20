# Complete CRUD Template (Posts Example)

Production-ready Create, Read, Update, Delete operations with RLS, type safety, and real-time updates.

## Database Schema

```sql
-- Create posts table
CREATE TABLE posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL CHECK (char_length(title) >= 3),
  content TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view all published posts"
  ON posts FOR SELECT
  TO authenticated
  USING (status = 'published' OR (SELECT auth.uid()) = user_id);

CREATE POLICY "Users can view own drafts"
  ON posts FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- Indexes for performance
CREATE INDEX idx_posts_user_id ON posts(user_id);
CREATE INDEX idx_posts_status ON posts(status);
CREATE INDEX idx_posts_created_at ON posts(created_at DESC);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_posts_updated_at
  BEFORE UPDATE ON posts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE posts;
```

## Type Definitions

Generate types:
```bash
npx supabase gen types typescript --project-id your-project-ref > types/database.types.ts
```

Or manually create `types/posts.ts`:
```typescript
export interface Post {
  id: string
  user_id: string
  title: string
  content: string | null
  status: 'draft' | 'published' | 'archived'
  published_at: string | null
  created_at: string
  updated_at: string
}

export interface CreatePostInput {
  title: string
  content?: string
  status?: 'draft' | 'published'
}

export interface UpdatePostInput {
  title?: string
  content?: string
  status?: 'draft' | 'published' | 'archived'
}
```

## Server Actions (app/posts/actions.ts)

```typescript
'use server'

import { createClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import type { CreatePostInput, UpdatePostInput } from '@/types/posts'

// Helper to get authenticated supabase client
async function getAuthenticatedClient() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Unauthorized')
  }

  return { supabase, user }
}

export async function createPost(formData: FormData) {
  try {
    const { supabase, user } = await getAuthenticatedClient()

    const title = formData.get('title') as string
    const content = formData.get('content') as string
    const status = (formData.get('status') as 'draft' | 'published') || 'draft'

    // Validate
    if (!title || title.length < 3) {
      return { error: 'Title must be at least 3 characters' }
    }

    // Insert
    const { data, error } = await supabase
      .from('posts')
      .insert({
        user_id: user.id,
        title,
        content: content || null,
        status,
        published_at: status === 'published' ? new Date().toISOString() : null,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating post:', error)
      return { error: error.message }
    }

    revalidatePath('/posts')
    redirect(`/posts/${data.id}`)
  } catch (error) {
    console.error('Error:', error)
    return { error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

export async function updatePost(postId: string, formData: FormData) {
  try {
    const { supabase, user } = await getAuthenticatedClient()

    const title = formData.get('title') as string
    const content = formData.get('content') as string
    const status = formData.get('status') as 'draft' | 'published' | 'archived'

    // Verify ownership
    const { data: existingPost, error: fetchError } = await supabase
      .from('posts')
      .select('user_id, status')
      .eq('id', postId)
      .single()

    if (fetchError || !existingPost) {
      return { error: 'Post not found' }
    }

    if (existingPost.user_id !== user.id) {
      return { error: 'Unauthorized' }
    }

    // Prepare update
    const updates: any = {
      updated_at: new Date().toISOString(),
    }

    if (title && title.length >= 3) {
      updates.title = title
    }

    if (content !== undefined) {
      updates.content = content
    }

    if (status) {
      updates.status = status
      
      // Set published_at when first publishing
      if (status === 'published' && existingPost.status !== 'published') {
        updates.published_at = new Date().toISOString()
      }
    }

    const { error } = await supabase
      .from('posts')
      .update(updates)
      .eq('id', postId)

    if (error) {
      console.error('Error updating post:', error)
      return { error: error.message }
    }

    revalidatePath('/posts')
    revalidatePath(`/posts/${postId}`)
    
    return { success: true }
  } catch (error) {
    console.error('Error:', error)
    return { error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

export async function deletePost(postId: string) {
  try {
    const { supabase, user } = await getAuthenticatedClient()

    // Verify ownership
    const { data: existingPost } = await supabase
      .from('posts')
      .select('user_id')
      .eq('id', postId)
      .single()

    if (!existingPost || existingPost.user_id !== user.id) {
      return { error: 'Unauthorized' }
    }

    const { error } = await supabase
      .from('posts')
      .delete()
      .eq('id', postId)

    if (error) {
      console.error('Error deleting post:', error)
      return { error: error.message }
    }

    revalidatePath('/posts')
    redirect('/posts')
  } catch (error) {
    console.error('Error:', error)
    return { error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

export async function publishPost(postId: string) {
  try {
    const { supabase, user } = await getAuthenticatedClient()

    const { error } = await supabase
      .from('posts')
      .update({
        status: 'published',
        published_at: new Date().toISOString(),
      })
      .eq('id', postId)
      .eq('user_id', user.id) // Ensure ownership

    if (error) {
      return { error: error.message }
    }

    revalidatePath('/posts')
    revalidatePath(`/posts/${postId}`)
    
    return { success: true }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Unknown error' }
  }
}
```

## Posts List Page (app/posts/page.tsx)

```typescript
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { redirect } from 'next/navigation'

export const revalidate = 0 // Disable caching for this page

export default async function PostsPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Fetch user's posts
  const { data: posts, error } = await supabase
    .from('posts')
    .select('id, title, status, created_at, updated_at')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching posts:', error)
  }

  return (
    <div className="min-h-screen p-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">My Posts</h1>
          <Link
            href="/posts/new"
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
          >
            New Post
          </Link>
        </div>

        <div className="mt-8 space-y-4">
          {posts && posts.length > 0 ? (
            posts.map((post) => (
              <Link
                key={post.id}
                href={`/posts/${post.id}`}
                className="block rounded-lg border border-gray-200 p-6 hover:border-gray-300"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-xl font-semibold">{post.title}</h2>
                    <p className="mt-1 text-sm text-gray-500">
                      {post.status} · Updated{' '}
                      {new Date(post.updated_at).toLocaleDateString()}
                    </p>
                  </div>
                  <span
                    className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                      post.status === 'published'
                        ? 'bg-green-100 text-green-800'
                        : post.status === 'draft'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {post.status}
                  </span>
                </div>
              </Link>
            ))
          ) : (
            <p className="text-center text-gray-500">No posts yet</p>
          )}
        </div>
      </div>
    </div>
  )
}
```

## Create Post Page (app/posts/new/page.tsx)

```typescript
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { createPost } from '../actions'

export default async function NewPostPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <div className="min-h-screen p-8">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-3xl font-bold">Create New Post</h1>

        <form action={createPost} className="mt-8 space-y-6">
          <div>
            <label htmlFor="title" className="block text-sm font-medium">
              Title
            </label>
            <input
              type="text"
              name="title"
              id="title"
              required
              minLength={3}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
            />
          </div>

          <div>
            <label htmlFor="content" className="block text-sm font-medium">
              Content
            </label>
            <textarea
              name="content"
              id="content"
              rows={10}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
            />
          </div>

          <div>
            <label htmlFor="status" className="block text-sm font-medium">
              Status
            </label>
            <select
              name="status"
              id="status"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
            >
              <option value="draft">Draft</option>
              <option value="published">Published</option>
            </select>
          </div>

          <div className="flex gap-4">
            <button
              type="submit"
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
            >
              Create Post
            </button>
            <a
              href="/posts"
              className="rounded-md border border-gray-300 px-4 py-2 text-sm font-semibold hover:bg-gray-50"
            >
              Cancel
            </a>
          </div>
        </form>
      </div>
    </div>
  )
}
```

## View/Edit Post Page (app/posts/[id]/page.tsx)

```typescript
import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import { updatePost, deletePost, publishPost } from '../actions'

export default async function PostPage({ params }: { params: { id: string } }) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: post, error } = await supabase
    .from('posts')
    .select('*')
    .eq('id', params.id)
    .single()

  if (error || !post) {
    notFound()
  }

  const isOwner = post.user_id === user.id

  if (!isOwner && post.status !== 'published') {
    notFound()
  }

  return (
    <div className="min-h-screen p-8">
      <div className="mx-auto max-w-2xl">
        {isOwner ? (
          <>
            <h1 className="text-3xl font-bold">Edit Post</h1>
            <form action={updatePost.bind(null, post.id)} className="mt-8 space-y-6">
              <div>
                <label htmlFor="title" className="block text-sm font-medium">
                  Title
                </label>
                <input
                  type="text"
                  name="title"
                  id="title"
                  defaultValue={post.title}
                  required
                  minLength={3}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                />
              </div>

              <div>
                <label htmlFor="content" className="block text-sm font-medium">
                  Content
                </label>
                <textarea
                  name="content"
                  id="content"
                  rows={10}
                  defaultValue={post.content || ''}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                />
              </div>

              <div>
                <label htmlFor="status" className="block text-sm font-medium">
                  Status
                </label>
                <select
                  name="status"
                  id="status"
                  defaultValue={post.status}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                >
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                  <option value="archived">Archived</option>
                </select>
              </div>

              <div className="flex gap-4">
                <button
                  type="submit"
                  className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
                >
                  Save Changes
                </button>
                
                {post.status === 'draft' && (
                  <button
                    formAction={publishPost.bind(null, post.id)}
                    className="rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-500"
                  >
                    Publish
                  </button>
                )}

                <button
                  formAction={deletePost.bind(null, post.id)}
                  className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500"
                >
                  Delete
                </button>
              </div>
            </form>
          </>
        ) : (
          <>
            <h1 className="text-3xl font-bold">{post.title}</h1>
            <p className="mt-2 text-sm text-gray-500">
              Published {new Date(post.published_at!).toLocaleDateString()}
            </p>
            <div className="prose mt-8 max-w-none">
              {post.content || <p className="text-gray-500">No content</p>}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
```

## Real-Time Component (components/RealtimePosts.tsx)

```typescript
'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { RealtimeChannel } from '@supabase/supabase-js'
import type { Post } from '@/types/posts'

export function RealtimePosts({ initialPosts }: { initialPosts: Post[] }) {
  const [posts, setPosts] = useState<Post[]>(initialPosts)
  const supabase = createClient()

  useEffect(() => {
    const channel: RealtimeChannel = supabase
      .channel('posts_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'posts',
          filter: 'status=eq.published',
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setPosts((prev) => [payload.new as Post, ...prev])
          } else if (payload.eventType === 'UPDATE') {
            setPosts((prev) =>
              prev.map((post) =>
                post.id === payload.new.id ? (payload.new as Post) : post
              )
            )
          } else if (payload.eventType === 'DELETE') {
            setPosts((prev) => prev.filter((post) => post.id !== payload.old.id))
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase])

  return (
    <div className="space-y-4">
      {posts.map((post) => (
        <div key={post.id} className="rounded-lg border p-4">
          <h3 className="font-semibold">{post.title}</h3>
          <p className="mt-2 text-sm text-gray-600">{post.content}</p>
        </div>
      ))}
    </div>
  )
}
```

## Features Included

- Full CRUD operations
- RLS for security
- Type safety
- Server Actions for mutations
- Real-time updates
- Form validation
- Status management (draft/published/archived)
- Ownership verification
- Optimistic updates (via revalidatePath)

## Next Steps

1. Add pagination
2. Implement search/filtering
3. Add tags/categories
4. Rich text editor
5. Image uploads
6. Comments system
7. Like/favorite functionality
8. Share functionality