'use client'

import { useActionState } from 'react'
import { toast } from 'sonner'
import { useEffect } from 'react'
import FormInput from './FormInput'
import SubmitButton from './SubmitButton'
import AvatarUpload from './AvatarUpload'
import { updateProfile } from '@/app/auth/actions'
import { useAuth } from './useAuth'
import type { Profile } from '@/lib/supabase/types'

export default function ProfileForm({ profile }: { profile: Profile }) {
  const { refreshProfile } = useAuth()

  const [state, formAction] = useActionState(
    async (_prev: { error?: string; success?: boolean } | null, formData: FormData) => {
      const result = await updateProfile(formData)
      return result ?? null
    },
    null
  )

  useEffect(() => {
    if (state?.success) {
      toast.success('Profile updated')
      refreshProfile()
    }
    if (state?.error) {
      toast.error(state.error)
    }
  }, [state, refreshProfile])

  return (
    <div className="space-y-8">
      {/* Avatar section */}
      <div>
        <h2 className="text-lg font-semibold text-fg mb-4">Photo</h2>
        <AvatarUpload avatarUrl={profile.avatar_url} fullName={profile.full_name} />
      </div>

      {/* Divider */}
      <div className="border-t border-border" />

      {/* Profile form */}
      <form action={formAction} className="space-y-5">
        <h2 className="text-lg font-semibold text-fg">Details</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <FormInput
            id="full_name"
            name="full_name"
            label="Full Name"
            defaultValue={profile.full_name ?? ''}
            autoComplete="name"
          />
          <FormInput
            id="display_name"
            name="display_name"
            label="Display Name"
            placeholder="How you want to be known"
            defaultValue={profile.display_name ?? ''}
          />
        </div>

        <FormInput
          id="email"
          name="email_display"
          type="email"
          label="Email"
          defaultValue={profile.email}
          readOnly
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <FormInput
            id="handicap"
            name="handicap"
            type="number"
            label="Handicap Index"
            placeholder="e.g. 12.4"
            defaultValue={profile.handicap?.toString() ?? ''}
          />
          <FormInput
            id="home_course"
            name="home_course"
            label="Home Course"
            placeholder="Your home course"
            defaultValue={profile.home_course ?? ''}
          />
        </div>

        <div>
          <label htmlFor="bio" className="block text-sm font-medium text-fg mb-1.5">
            Bio
          </label>
          <textarea
            id="bio"
            name="bio"
            rows={3}
            placeholder="A little about you and your game..."
            defaultValue={profile.bio ?? ''}
            className="w-full bg-bg border border-border rounded-xl px-4 py-3 text-sm transition-colors
              placeholder:text-muted-2 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent resize-none"
          />
        </div>

        <div className="pt-2">
          <SubmitButton className="w-auto">Save Changes</SubmitButton>
        </div>
      </form>
    </div>
  )
}
