import { client } from './client'
import { eventTitlesByIdsQuery } from './queries'

/**
 * Resolves event_sanity_id → current Sanity title.
 *
 * Stored `event_title` on registration/sponsor rows is a point-in-time snapshot
 * that goes stale when an event is renamed. Use this to override it for display,
 * falling back to the stored snapshot when an event no longer exists in Sanity.
 */
export async function getCurrentEventTitles(
  ids: (string | null | undefined)[],
): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter((id): id is string => !!id))]
  if (unique.length === 0) return new Map()

  const rows = await client.fetch(eventTitlesByIdsQuery, { ids: unique })
  return new Map(
    (rows ?? [])
      .filter((r): r is { _id: string; title: string } => !!r.title)
      .map((r) => [r._id, r.title]),
  )
}
