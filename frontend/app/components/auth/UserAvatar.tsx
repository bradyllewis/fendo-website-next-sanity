import Image from 'next/image'

const SIZES = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-16 h-16 text-lg',
} as const

export default function UserAvatar({
  avatarUrl,
  fullName,
  size = 'md',
  className = '',
}: {
  avatarUrl?: string | null
  fullName?: string | null
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  const sizeClass = SIZES[size]
  const initials = getInitials(fullName)

  if (avatarUrl) {
    return (
      <div className={`${sizeClass} rounded-full overflow-hidden shrink-0 ${className}`}>
        <Image
          src={avatarUrl}
          alt={fullName || 'User avatar'}
          width={64}
          height={64}
          className="w-full h-full object-cover"
        />
      </div>
    )
  }

  return (
    <div
      className={`${sizeClass} rounded-full bg-green text-bg font-semibold flex items-center justify-center shrink-0 ${className}`}
      aria-hidden="true"
    >
      {initials}
    </div>
  )
}

function getInitials(name?: string | null): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0][0].toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}
