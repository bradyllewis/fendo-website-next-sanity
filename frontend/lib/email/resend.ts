interface SendEmailParams {
  to: string | string[]
  subject: string
  html: string
  replyTo?: string
}

export async function sendEmail({ to, subject, html, replyTo }: SendEmailParams): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  const fromEmail = process.env.RESEND_FROM_EMAIL ?? 'noreply@fendogolf.com'

  if (!apiKey) {
    console.error('[email] RESEND_API_KEY is not set — skipping send')
    return
  }

  const body: Record<string, unknown> = {
    from: fromEmail,
    to: Array.isArray(to) ? to : [to],
    subject,
    html,
  }
  if (replyTo) body.reply_to = replyTo

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const text = await res.text()
      console.error(`[email] Resend error ${res.status}: ${text}`)
    }
  } catch (err) {
    console.error('[email] Failed to send via Resend:', err)
  }
}

export function getBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return 'http://localhost:3000'
}
