import { NextRequest, NextResponse } from 'next/server'
import { sendEmail, getBaseUrl } from '@/lib/email/resend'
import { buildRegistrationConfirmationEmail } from '@/lib/email/templates/registration-confirmation'

// Dev/admin-only endpoint to test email templates
// Protected by ADMIN_API_SECRET header
export async function POST(request: NextRequest) {
  const secret = request.headers.get('x-admin-secret')
  if (!secret || secret !== process.env.ADMIN_API_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { to, firstName, eventTitle, eventDate, amountPaid } = body

  if (!to) {
    return NextResponse.json({ error: 'Missing required field: to' }, { status: 400 })
  }

  const siteUrl = getBaseUrl()

  await sendEmail({
    to,
    subject: `You're registered — ${eventTitle ?? 'Test Event'}`,
    html: buildRegistrationConfirmationEmail({
      playerFirstName: firstName ?? 'Brady',
      eventTitle: eventTitle ?? 'Spin Society Open',
      eventDate: eventDate ?? 'Saturday, July 12, 2025',
      eventLocation: null,
      amountPaid: amountPaid ?? 7500,
      siteUrl,
    }),
  })

  return NextResponse.json({ sent: true, to })
}
