import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { email } = await req.json()

  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return NextResponse.json({ error: 'Valid email required' }, { status: 400 })
  }

  const apiKey = process.env.KLAVIYO_API_KEY
  const listId = process.env.KLAVIYO_LIST_ID
  const base = process.env.KLAVIYO_API_BASE ?? 'https://a.klaviyo.com'
  const revision = process.env.KLAVIYO_API_REVISION ?? '2026-04-15'

  if (!apiKey || !listId) {
    return NextResponse.json({ error: 'Klaviyo not configured' }, { status: 500 })
  }

  const res = await fetch(`${base}/api/profile-subscription-bulk-create-jobs`, {
    method: 'POST',
    headers: {
      Authorization: `Klaviyo-API-Key ${apiKey}`,
      revision,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      data: {
        type: 'profile-subscription-bulk-create-job',
        attributes: {
          profiles: {
            data: [
              {
                type: 'profile',
                attributes: {
                  email,
                  subscriptions: {
                    email: {
                      marketing: { consent: 'SUBSCRIBED' },
                    },
                  },
                },
              },
            ],
          },
        },
        relationships: {
          list: {
            data: { type: 'list', id: listId },
          },
        },
      },
    }),
  })

  // 202 = accepted (async job), 200 = ok
  if (res.status === 202 || res.status === 200) {
    return NextResponse.json({ success: true })
  }

  const body = await res.json().catch(() => ({}))
  return NextResponse.json({ error: 'Subscription failed' }, { status: res.status })
}
