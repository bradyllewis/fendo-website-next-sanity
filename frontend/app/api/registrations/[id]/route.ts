import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  if (!id) {
    return NextResponse.json({ error: 'Missing registration id' }, { status: 400 })
  }

  // Authenticate user via session cookie
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Fetch the registration to verify ownership and eligibility
  const { data: reg } = await supabase
    .from('event_registrations')
    .select('id, user_id, status, amount_paid, stripe_payment_intent_id')
    .eq('id', id)
    .maybeSingle()

  if (!reg) {
    return NextResponse.json({ error: 'Registration not found' }, { status: 404 })
  }

  if (reg.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (reg.status !== 'paid') {
    return NextResponse.json(
      { error: 'Registration is not in a cancellable state' },
      { status: 400 },
    )
  }

  // Only allow cancellation of free (non-Stripe) registrations
  if (reg.stripe_payment_intent_id || (reg.amount_paid !== null && reg.amount_paid > 0)) {
    return NextResponse.json(
      { error: 'Paid registrations cannot be self-cancelled. Please contact support.' },
      { status: 400 },
    )
  }

  // Delete via admin client to bypass RLS
  const admin = createAdminClient()
  const { error: deleteError } = await admin
    .from('event_registrations')
    .delete()
    .eq('id', id)

  if (deleteError) {
    console.error('[registrations/delete] Delete failed:', deleteError)
    return NextResponse.json({ error: 'Failed to cancel registration' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
