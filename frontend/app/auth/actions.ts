'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { subscribeEmailToList } from '@/lib/klaviyo'

export async function signUp(formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const fullName = formData.get('full_name') as string

  // Create user via admin client with email auto-confirmed (bypasses Supabase mailer)
  const adminClient = createAdminClient()
  const { error: createError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  })

  if (createError) {
    // Supabase sets code 'email_exists' when the address is already registered.
    // Match on the code only — a bare 422 also covers other validation failures.
    if (createError.code === 'email_exists') {
      return {
        error: 'An account with this email already exists.',
        code: 'email_exists' as const,
      }
    }
    return { error: createError.message }
  }

  subscribeEmailToList(email).catch(() => {})

  return { success: true }
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/')
}

export async function forgotPassword(formData: FormData) {
  const email = formData.get('email') as string

  const adminClient = createAdminClient()
  const { data, error } = await adminClient.auth.admin.generateLink({
    type: 'recovery',
    email,
  })

  // Only send if the user exists — silently skip otherwise to prevent enumeration
  if (!error && data?.properties?.hashed_token) {
    // Link to our own /auth/confirm route rather than Supabase's action_link: that
    // endpoint returns the session in a URL fragment, which a server route can never read.
    const resetLink = `${getBaseUrl()}/auth/confirm?token_hash=${encodeURIComponent(
      data.properties.hashed_token
    )}&type=recovery&next=${encodeURIComponent('/auth/reset-password')}`

    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: process.env.RESEND_FROM_EMAIL,
          to: [email],
          subject: 'Reset your Fendo Golf password',
          html: `
          <p>Hi,</p>
          <p>We received a request to reset the password for your Fendo Golf account.</p>
          <p><a href="${resetLink}">Click here to reset your password</a></p>
          <p>This link expires in 1 hour. If you didn't request this, you can safely ignore this email.</p>
        `,
        }),
      })
      if (!res.ok) {
        console.error('[forgotPassword] Resend failed', res.status, await res.text())
      }
    } catch (err) {
      console.error('[forgotPassword] Resend request threw', err)
    }
  }

  // Always redirect — never reveal whether the address is registered
  redirect('/auth/check-email')
}

export async function resetPassword(formData: FormData) {
  const supabase = await createClient()

  const password = formData.get('password') as string

  const { error } = await supabase.auth.updateUser({ password })

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/', 'layout')
  redirect('/account')
}

export async function updateProfile(formData: FormData) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  const updates = {
    full_name: formData.get('full_name') as string,
    display_name: formData.get('display_name') as string,
    handicap: formData.get('handicap') ? parseFloat(formData.get('handicap') as string) : null,
    home_course: formData.get('home_course') as string,
    bio: formData.get('bio') as string,
  }

  const { error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', user.id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/account')
  return { success: true }
}

export async function uploadAvatar(formData: FormData) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  const file = formData.get('avatar') as File
  if (!file || file.size === 0) {
    return { error: 'No file provided' }
  }

  if (file.size > 2 * 1024 * 1024) {
    return { error: 'File must be under 2MB' }
  }

  const ext = file.name.split('.').pop()
  const filePath = `${user.id}/avatar.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(filePath, file, { upsert: true })

  if (uploadError) {
    return { error: uploadError.message }
  }

  const { data: urlData } = supabase.storage
    .from('avatars')
    .getPublicUrl(filePath)

  const { error: updateError } = await supabase
    .from('profiles')
    .update({ avatar_url: urlData.publicUrl })
    .eq('id', user.id)

  if (updateError) {
    return { error: updateError.message }
  }

  revalidatePath('/account')
  return { success: true, avatarUrl: urlData.publicUrl }
}

function getBaseUrl() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return 'http://localhost:3000'
}
