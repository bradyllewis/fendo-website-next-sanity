import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isShirtSize } from '@/lib/shirt-sizes'

type Params = { params: Promise<{ token: string }> }

export async function PATCH(request: NextRequest, { params }: Params) {
  const { token } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { shirtSize?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!isShirtSize(body.shirtSize)) {
    return NextResponse.json({ error: 'Invalid shirt size' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: slot, error } = await admin
    .from('registration_slots')
    .select('id, invited_by_user_id, status, event_registration_id, metadata')
    .eq('invite_token', token)
    .maybeSingle()

  if (error || !slot) {
    return NextResponse.json({ error: 'Slot not found' }, { status: 404 })
  }

  // Only the captain who created the invite can update shirt size
  if (slot.invited_by_user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (slot.status === 'cancelled' || slot.status === 'expired') {
    return NextResponse.json({ error: 'Slot is cancelled or expired' }, { status: 410 })
  }

  const existingMetadata = (slot.metadata as Record<string, unknown> | null) ?? {}
  const nextSlotMetadata = { ...existingMetadata, shirtSize: body.shirtSize }

  const { error: slotUpdateError } = await admin
    .from('registration_slots')
    .update({ metadata: nextSlotMetadata })
    .eq('id', slot.id)

  if (slotUpdateError) {
    console.error('[shirt-size] Failed to update slot metadata:', slotUpdateError)
    return NextResponse.json({ error: 'Failed to update shirt size' }, { status: 500 })
  }

  // Mirror to the linked event_registrations row, if one exists
  if (slot.event_registration_id) {
    const { data: reg } = await admin
      .from('event_registrations')
      .select('metadata')
      .eq('id', slot.event_registration_id)
      .maybeSingle()

    if (reg) {
      const regMetadata = (reg.metadata as Record<string, unknown> | null) ?? {}
      await admin
        .from('event_registrations')
        .update({ metadata: { ...regMetadata, shirtSize: body.shirtSize } })
        .eq('id', slot.event_registration_id)
    }
  }

  return NextResponse.json({ success: true, shirtSize: body.shirtSize })
}
