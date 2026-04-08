'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { updateUserRole } from '@/app/admin/actions'
import { IconShield, IconUser, IconLoader } from '@/app/components/icons'

interface RoleToggleProps {
  userId: string
  currentRole: 'user' | 'admin'
  isSelf: boolean
}

export default function RoleToggle({ userId, currentRole, isSelf }: RoleToggleProps) {
  const [role, setRole] = useState(currentRole)
  const [isPending, startTransition] = useTransition()
  const [showConfirm, setShowConfirm] = useState(false)
  const [pendingRole, setPendingRole] = useState<'user' | 'admin' | null>(null)

  function handleChange(newRole: 'user' | 'admin') {
    if (newRole === role) return
    setPendingRole(newRole)
    setShowConfirm(true)
  }

  function confirm() {
    if (!pendingRole) return
    setShowConfirm(false)
    startTransition(async () => {
      const result = await updateUserRole(userId, pendingRole)
      if (result.error) {
        toast.error(result.error)
      } else {
        setRole(pendingRole)
        toast.success(`Role updated to ${pendingRole}`)
      }
      setPendingRole(null)
    })
  }

  function cancel() {
    setShowConfirm(false)
    setPendingRole(null)
  }

  if (isSelf) {
    return (
      <div className="text-xs text-muted font-mono py-1">
        Cannot change your own role
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Role selector */}
      <div className="flex gap-2">
        {(['user', 'admin'] as const).map((r) => (
          <button
            key={r}
            onClick={() => handleChange(r)}
            disabled={isPending}
            className={`
              flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all duration-150
              ${role === r
                ? r === 'admin'
                  ? 'bg-fg text-bg border-fg shadow-sm'
                  : 'bg-surface text-fg border-border shadow-sm'
                : 'text-muted border-border hover:text-fg hover:bg-surface'
              }
            `}
          >
            {isPending && pendingRole === r ? (
              <IconLoader className="w-3.5 h-3.5" />
            ) : r === 'admin' ? (
              <IconShield className="w-3.5 h-3.5" />
            ) : (
              <IconUser className="w-3.5 h-3.5" />
            )}
            {r.charAt(0).toUpperCase() + r.slice(1)}
          </button>
        ))}
      </div>

      {/* Confirm prompt */}
      {showConfirm && (
        <div className="card-base p-4 flex flex-col gap-3 border-accent/30 bg-accent/5">
          <p className="text-sm text-fg">
            Set role to <strong>{pendingRole}</strong>? This changes their site permissions.
          </p>
          <div className="flex gap-2">
            <button
              onClick={confirm}
              className="btn-primary text-xs px-3 py-1.5"
            >
              Confirm
            </button>
            <button
              onClick={cancel}
              className="btn-ghost text-xs px-3 py-1.5"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
