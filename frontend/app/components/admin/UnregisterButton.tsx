'use client'

import { useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { unregisterUser } from '@/app/admin/actions'
import { IconLoader, IconX } from '@/app/components/icons'

interface Props {
  registrationId: string
  eventTitle: string
}

export default function UnregisterButton({ registrationId, eventTitle }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [reason, setReason] = useState('')
  const [isPending, startTransition] = useTransition()

  function openDialog() {
    setReason('')
    dialogRef.current?.showModal()
  }

  function closeDialog() {
    if (isPending) return
    dialogRef.current?.close()
  }

  function handleConfirm() {
    startTransition(async () => {
      const result = await unregisterUser(registrationId, reason)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Registration cancelled')
        dialogRef.current?.close()
      }
    })
  }

  return (
    <>
      <button
        onClick={openDialog}
        className="text-xs font-medium text-muted hover:text-red-500 transition-colors px-2 py-1 rounded-md hover:bg-red-500/10"
      >
        Un-register
      </button>

      <dialog
        ref={dialogRef}
        onClick={(e) => { if (e.target === dialogRef.current) closeDialog() }}
        className="bg-transparent p-0 backdrop:bg-fg/20 backdrop:backdrop-blur-sm open:flex open:items-center open:justify-center w-full max-w-sm mx-auto"
      >
        <div className="card-base w-full max-w-sm p-6 space-y-4 shadow-layer">
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-fg">Cancel Registration</h2>
              <p className="text-xs text-muted mt-0.5 line-clamp-1">{eventTitle}</p>
            </div>
            <button
              onClick={closeDialog}
              disabled={isPending}
              className="text-muted hover:text-fg transition-colors shrink-0"
              aria-label="Close"
            >
              <IconX className="w-4 h-4" />
            </button>
          </div>

          <p className="text-xs text-muted leading-relaxed">
            This will set the registration status to <span className="font-mono text-fg">cancelled</span>.
            The record is preserved for audit purposes. No refund is issued automatically.
          </p>

          {/* Optional reason */}
          <div>
            <label className="label-mono text-[0.6rem] block mb-1.5">
              Reason / Note <span className="text-muted normal-case font-normal">(optional)</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Requested by member, duplicate booking…"
              rows={3}
              maxLength={500}
              disabled={isPending}
              className="w-full text-xs bg-surface border border-border rounded-lg px-3 py-2 text-fg placeholder:text-muted resize-none focus:outline-none focus:ring-1 focus:ring-fg/20 disabled:opacity-60"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              onClick={closeDialog}
              disabled={isPending}
              className="btn-ghost text-xs px-3 py-2"
            >
              Keep Registration
            </button>
            <button
              onClick={handleConfirm}
              disabled={isPending}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors disabled:opacity-60"
            >
              {isPending && <IconLoader className="w-3 h-3" />}
              Cancel Registration
            </button>
          </div>
        </div>
      </dialog>
    </>
  )
}
