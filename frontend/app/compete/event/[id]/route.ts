import { NextRequest, NextResponse } from 'next/server'
import { client } from '@/sanity/lib/client'
import { eventSlugByIdQuery } from '@/sanity/lib/queries'

type Params = { params: Promise<{ id: string }> }

// Resolves a stable Sanity event _id to its CURRENT slug and redirects to the
// public event page. Internal links (admin tables, account pages, emails) point
// here by event_sanity_id so they never break when an event's slug is edited.
export async function GET(request: NextRequest, { params }: Params) {
  const { id } = await params

  // useCdn: false so the redirect reflects a slug edit immediately, not CDN-lagged
  const event = await client
    .withConfig({ useCdn: false })
    .fetch(eventSlugByIdQuery, { id })

  if (!event?.slug) {
    return NextResponse.redirect(new URL('/compete', request.url))
  }

  return NextResponse.redirect(new URL(`/compete/${event.slug}`, request.url))
}
