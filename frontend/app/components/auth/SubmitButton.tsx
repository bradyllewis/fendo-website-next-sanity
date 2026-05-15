'use client'

import { useFormStatus } from 'react-dom'
import { IconLoader } from '@/app/components/icons'

export default function SubmitButton({
  children,
  className = '',
  pending: pendingProp,
}: {
  children: React.ReactNode
  className?: string
  pending?: boolean
}) {
  const { pending: formPending } = useFormStatus()
  const pending = pendingProp ?? formPending

  return (
    <button
      type="submit"
      disabled={pending}
      className={`btn-accent w-full justify-center ${pending ? 'opacity-70 cursor-not-allowed' : ''} ${className}`}
    >
      {pending ? (
        <span className="flex items-center gap-2">
          <IconLoader className="w-4 h-4" />
          <span>Please wait...</span>
        </span>
      ) : (
        children
      )}
    </button>
  )
}
