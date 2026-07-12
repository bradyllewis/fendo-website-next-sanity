import { client } from './client'
import { eventInfoByIdsQuery } from './queries'

export interface CurrentEventInfo {
  title: string
  startDate: string | null
  timezone: string | null
}

/**
 * Resolves event_sanity_id → current Sanity title and start date.
 *
 * Stored `event_title` and `event_date` on registration/sponsor rows are
 * point-in-time snapshots that go stale when an event is renamed or rescheduled.
 * Use this to override them for display, falling back to the stored snapshot when
 * an event no longer exists in Sanity (no map entry for that id).
 */
export async function getCurrentEventInfo(
  ids: (string | null | undefined)[],
): Promise<Map<string, CurrentEventInfo>> {
  const unique = [...new Set(ids.filter((id): id is string => !!id))]
  if (unique.length === 0) return new Map()

  const rows = await client.fetch(eventInfoByIdsQuery, { ids: unique })
  return new Map(
    (rows ?? [])
      .filter((r) => !!r.title)
      .map((r) => [r._id, { title: r.title, startDate: r.startDate ?? null, timezone: r.timezone ?? null }]),
  )
}
