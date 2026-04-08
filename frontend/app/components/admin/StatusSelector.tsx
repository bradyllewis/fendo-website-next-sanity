'use client'

import { useState, useTransition, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { toast } from 'sonner'
import { updateRegistrationStatus } from '@/app/admin/actions'
import { IconLoader, IconChevronDown } from '@/app/components/icons'
import type { EventRegistrationStatus } from '@/lib/supabase/types'

const STATUS_OPTIONS: { value: EventRegistrationStatus; label: string }[] = [
  { value: 'paid',       label: 'Registered' },
  { value: 'pending',    label: 'Pending'    },
  { value: 'waitlisted', label: 'Waitlisted' },
  { value: 'cancelled',  label: 'Cancelled'  },
  { value: 'refunded',   label: 'Refunded'   },
]

const STATUS_STYLES: Record<EventRegistrationStatus, string> = {
  paid:       'text-green bg-green/10 border-green/20',
  pending:    'text-fg bg-mustard/20 border-mustard/30',
  waitlisted: 'text-fg bg-mustard/20 border-mustard/30',
  cancelled:  'text-muted bg-surface border-border',
  refunded:   'text-muted bg-surface border-border',
}

interface StatusSelectorProps {
  registrationId: string
  currentStatus: EventRegistrationStatus
}

export default function StatusSelector({ registrationId, currentStatus }: StatusSelectorProps) {
  const [status, setStatus] = useState<EventRegistrationStatus>(currentStatus)
  const [open, setOpen] = useState(false)
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({})
  const [isPending, startTransition] = useTransition()
  const buttonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open || !buttonRef.current) return
    const rect = buttonRef.current.getBoundingClientRect()
    setDropdownStyle({
      position: 'fixed',
      top: rect.bottom + 4,
      left: rect.left,
      zIndex: 9999,
    })
  }, [open])

  function handleSelect(newStatus: EventRegistrationStatus) {
    if (newStatus === status) { setOpen(false); return }
    setOpen(false)
    startTransition(async () => {
      const result = await updateRegistrationStatus(registrationId, newStatus)
      if (result.error) {
        toast.error(result.error)
      } else {
        setStatus(newStatus)
        toast.success('Status updated')
      }
    })
  }

  const label = STATUS_OPTIONS.find((o) => o.value === status)?.label ?? status

  const dropdown = open ? (
    <>
      <div
        className="fixed inset-0"
        style={{ zIndex: 9998 }}
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />
      <div
        className="w-36 card-base shadow-layer overflow-hidden py-1"
        style={dropdownStyle}
      >
        {STATUS_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => handleSelect(opt.value)}
            className={`
              w-full text-left px-3 py-2 text-xs font-medium transition-colors duration-100
              ${opt.value === status
                ? 'text-fg bg-surface'
                : 'text-muted hover:text-fg hover:bg-surface'
              }
            `}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </>
  ) : null

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={() => setOpen((prev) => !prev)}
        disabled={isPending}
        className={`
          inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[0.65rem] font-mono font-medium tracking-wide border
          transition-all duration-150 hover:opacity-80
          ${STATUS_STYLES[status]}
        `}
      >
        {isPending ? <IconLoader className="w-3 h-3" /> : null}
        {label}
        <IconChevronDown className="w-3 h-3 opacity-60" />
      </button>

      {typeof document !== 'undefined' && dropdown
        ? createPortal(dropdown, document.body)
        : null}
    </div>
  )
}
