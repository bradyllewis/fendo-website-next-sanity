'use client'

import { useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { IconPlus } from '@/app/components/icons'
import TeamFormModal, { type TeamFormEvent } from '@/app/components/admin/roster/TeamFormModal'

/**
 * Roster page header button for creating a team. `autoOpen` comes from the
 * `?create=1` deep link used by the Tournaments and Teams admin pages.
 */
export default function CreateTeamButton({
  eventSanityId,
  event,
  autoOpen,
}: {
  eventSanityId: string
  event: TeamFormEvent
  autoOpen: boolean
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [open, setOpen] = useState(autoOpen)

  // Drop `?create=1` so a reload doesn't reopen the form.
  const close = () => {
    setOpen(false)
    if (autoOpen) router.replace(pathname, { scroll: false })
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 btn-primary text-xs px-3 py-2"
      >
        <IconPlus className="w-3.5 h-3.5" />
        Create team
      </button>
      {open && (
        <TeamFormModal
          eventSanityId={eventSanityId}
          event={event}
          onClose={close}
          onDone={() => {
            close()
            router.refresh()
          }}
        />
      )}
    </>
  )
}
