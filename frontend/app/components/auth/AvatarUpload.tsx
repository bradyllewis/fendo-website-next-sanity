'use client'

import { useRef, useState } from 'react'
import { toast } from 'sonner'
import UserAvatar from './UserAvatar'
import { IconCamera, IconLoader } from '@/app/components/icons'
import { uploadAvatar } from '@/app/auth/actions'
import { useAuth } from './useAuth'

export default function AvatarUpload({
  avatarUrl,
  fullName,
}: {
  avatarUrl?: string | null
  fullName?: string | null
}) {
  const [uploading, setUploading] = useState(false)
  const [previewUrl, setPreviewUrl] = useState(avatarUrl)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { refreshProfile } = useAuth()

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image must be under 2MB')
      return
    }

    setUploading(true)
    const formData = new FormData()
    formData.append('avatar', file)

    const result = await uploadAvatar(formData)

    if (result.error) {
      toast.error(result.error)
    } else {
      setPreviewUrl(result.avatarUrl ?? previewUrl)
      toast.success('Avatar updated')
      await refreshProfile()
    }

    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className="flex items-center gap-5">
      <div className="relative">
        <UserAvatar
          avatarUrl={previewUrl}
          fullName={fullName}
          size="lg"
        />
        {uploading && (
          <div className="absolute inset-0 rounded-full bg-fg/40 flex items-center justify-center">
            <IconLoader className="w-5 h-5 text-bg" />
          </div>
        )}
      </div>
      <div>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="btn-outline text-sm flex items-center gap-2"
        >
          <IconCamera className="w-4 h-4" />
          {uploading ? 'Uploading...' : 'Change Photo'}
        </button>
        <p className="text-xs text-muted-2 mt-1.5">JPG, PNG or WebP. Max 2MB.</p>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
        aria-label="Upload avatar"
      />
    </div>
  )
}
