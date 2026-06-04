export async function subscribeEmailToList(email: string): Promise<void> {
  const apiKey = process.env.KLAVIYO_API_KEY
  const listId = process.env.KLAVIYO_LIST_ID

  if (!apiKey || !listId) return

  const base = process.env.KLAVIYO_API_BASE ?? 'https://a.klaviyo.com'
  const revision = process.env.KLAVIYO_API_REVISION ?? '2026-04-15'

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
                    email: { marketing: { consent: 'SUBSCRIBED' } },
                  },
                },
              },
            ],
          },
        },
        relationships: {
          list: { data: { type: 'list', id: listId } },
        },
      },
    }),
  })

  if (res.status !== 202 && res.status !== 200) {
    throw new Error(`Klaviyo subscription failed: ${res.status}`)
  }
}
