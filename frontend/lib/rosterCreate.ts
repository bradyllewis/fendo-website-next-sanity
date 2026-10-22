/**
 * Admin team creation engine: create a team from scratch, or add new players
 * to an existing team.
 *
 * Like lib/rosterMoves.ts, this is logic + database writes only, with no
 * Next.js request context and no Sanity reads. The server actions in
 * app/admin/tournaments/[id]/teams/createActions.ts resolve the event from
 * Sanity, own authentication, send emails and revalidate, then delegate here.
 * Keeping Sanity out lets a verification harness run this against a synthetic
 * event id.
 *
 * Every player is written as a `registration_slots` row, the one shape that
 * needs no user account. The roster, seat counts, pay links, Stripe webhook and
 * expiry cron all already handle slot-only members, so no other code changes
 * to recognise these teams.
 */

import { randomBytes } from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { getEventSeatCounts } from '@/sanity/lib/eventSeats'
import { getTournamentRoster, type RosterEntry } from '@/lib/tournamentRoster'
import { generateInviteCode, recalcTeamStatus } from '@/lib/rosterMoves'

// ─── Types ──────────────────────────────────────────────────────────────────

export type TeamFormat = 'duo' | 'team'

/**
 * How the new players' entry fees are settled.
 * - `paid`: confirmed now with nothing charged (paid offline, or complimentary).
 * - `payLink`: spot is held while each player pays online via their invite link.
 */
export type NewPlayerPayment = 'paid' | 'payLink'

export interface NewPlayerInput {
  firstName: string
  lastName: string
  email: string
  phone: string | null
  shirtSize: string | null
}

/** Event registration settings, resolved from Sanity by the caller. */
export interface TeamEventContext {
  eventSanityId: string
  eventSlug: string
  /** 0 for free events. */
  entryFeeCents: number
  /** Event capacity, or null when uncapped. */
  spotsTotal: number | null
}

export interface CreateTeamInput {
  teamName: string
  format: TeamFormat
  walkUpSong: string | null
  players: NewPlayerInput[]
  /** Index into `players` of the team captain. */
  captainIndex: number
  payment: NewPlayerPayment
  /** Admin acknowledged that the event will go over its capacity. */
  confirmOverCapacity: boolean
}

export interface AddPlayersInput {
  teamId: string
  players: NewPlayerInput[]
  payment: NewPlayerPayment
  confirmOverCapacity: boolean
}

export interface CreatedPlayer {
  slotId: string
  firstName: string
  email: string
  inviteToken: string
  status: 'paid' | 'invited'
  amountDueCents: number
  expiresAt: string
}

export interface TeamWriteResult {
  error?: string
  /** Set when `error` is the capacity check, so the UI can offer to confirm. */
  overCapacity?: boolean
  teamId?: string
  teamName?: string
  format?: TeamFormat
  /** The payment mode actually applied (free events always confirm). */
  payment?: NewPlayerPayment
  players: CreatedPlayer[]
}

type AdminDb = ReturnType<typeof createAdminClient>

/** Matches the self-serve checkout: teammates get 7 days to pay. */
const PAY_LINK_DAYS = 7

const TEAM_SIZE: Record<TeamFormat, number> = { duo: 2, team: 4 }

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const fail = (error: string): TeamWriteResult => ({ error, players: [] })

// ─── Validation ─────────────────────────────────────────────────────────────

/** Trims every field and lowercases the email. */
function normalizePlayers(players: NewPlayerInput[]): NewPlayerInput[] {
  return players.map((p) => ({
    firstName: p.firstName.trim(),
    lastName: p.lastName.trim(),
    email: p.email.trim().toLowerCase(),
    phone: p.phone?.trim() || null,
    shirtSize: p.shirtSize?.trim() || null,
  }))
}

/**
 * Checks the players' own fields, duplicates within the form, and duplicates
 * against everyone already active on this event's roster.
 */
function validatePlayers(roster: RosterEntry[], players: NewPlayerInput[]): string | null {
  if (players.length === 0) return 'Add at least one player'

  for (const p of players) {
    if (!p.firstName || !p.lastName) return 'Every player needs a first and last name'
    if (!EMAIL_RE.test(p.email)) {
      return `"${p.email || `${p.firstName} ${p.lastName}`}" is not a valid email address`
    }
  }

  const seen = new Set<string>()
  for (const p of players) {
    if (seen.has(p.email)) return `${p.email} is entered more than once`
    seen.add(p.email)
  }

  const taken = new Set(
    roster.flatMap((e) => e.members.map((m) => m.email.trim().toLowerCase())).filter(Boolean),
  )
  const clashes = players.filter((p) => taken.has(p.email)).map((p) => p.email)
  if (clashes.length > 0) {
    return `Already registered for this tournament: ${clashes.join(', ')}. Use Move to change their team instead.`
  }

  return null
}

/** Blocks a write that would take the event over capacity unless confirmed. */
async function checkCapacity(
  ctx: TeamEventContext,
  adding: number,
  confirmed: boolean,
): Promise<string | null> {
  if (ctx.spotsTotal == null || confirmed) return null
  const seatMap = await getEventSeatCounts([ctx.eventSanityId])
  const filled = seatMap.get(ctx.eventSanityId) ?? 0
  if (filled + adding <= ctx.spotsTotal) return null
  const open = Math.max(0, ctx.spotsTotal - filled)
  return `This tournament has ${open} open spot${open === 1 ? '' : 's'} and you are adding ${adding}. Confirm to go over capacity.`
}

// ─── Slot writes ────────────────────────────────────────────────────────────

/** auth user id for each email that belongs to an existing account. */
async function resolveAccountIds(db: AdminDb, emails: string[]): Promise<Map<string, string>> {
  const { data } = await db.from('profiles').select('id, email').in('email', emails)
  const byEmail = new Map<string, string>()
  for (const p of data ?? []) {
    if (p.email) byEmail.set(String(p.email).toLowerCase(), p.id)
  }
  return byEmail
}

/**
 * Inserts one slot per player. Players with an existing account are linked to
 * it (`app_user_id`) so the captain can manage the team from My Teams.
 */
async function insertPlayerSlots(
  db: AdminDb,
  args: {
    ctx: TeamEventContext
    teamId: string
    teamName: string
    players: NewPlayerInput[]
    captainIndex: number | null
    captainUserId: string | null
    accountIds: Map<string, string>
    payment: NewPlayerPayment
    adminEmail: string
    action: 'created_team' | 'added_to_team'
  },
): Promise<{ error: string } | { players: CreatedPlayer[] }> {
  const now = new Date()
  const expiresAt = new Date(now.getTime() + PAY_LINK_DAYS * 24 * 60 * 60 * 1000).toISOString()
  const isPaid = args.payment === 'paid'

  const rows = args.players.map((p, i) => ({
    team_id: args.teamId,
    event_sanity_id: args.ctx.eventSanityId,
    event_slug: args.ctx.eventSlug,
    is_captain: i === args.captainIndex,
    player_first_name: p.firstName,
    player_last_name: p.lastName,
    player_email: p.email,
    player_phone: p.phone,
    app_user_id: args.accountIds.get(p.email) ?? null,
    invited_by_user_id: args.captainUserId,
    invite_token: randomBytes(32).toString('hex'),
    status: isPaid ? 'paid' : 'invited',
    // Nothing was charged through the site for an admin-confirmed spot.
    amount_due: isPaid ? 0 : args.ctx.entryFeeCents,
    currency: 'usd',
    paid_at: isPaid ? now.toISOString() : null,
    expires_at: expiresAt,
    metadata: {
      shirtSize: p.shirtSize,
      adminHistory: [
        {
          at: now.toISOString(),
          action: args.action,
          from: null,
          to: args.teamName,
          by: args.adminEmail,
          payment: isPaid ? 'confirmed_by_admin' : 'pay_link',
        },
      ],
    },
  }))

  const { data, error } = await db
    .from('registration_slots')
    .insert(rows)
    .select('id, player_first_name, player_email, invite_token, status, amount_due, expires_at')

  if (error || !data) return { error: error?.message ?? 'Failed to add players' }

  return {
    players: data.map((s) => ({
      slotId: s.id,
      firstName: s.player_first_name,
      email: s.player_email,
      inviteToken: s.invite_token,
      status: s.status,
      amountDueCents: s.amount_due,
      expiresAt: s.expires_at,
    })),
  }
}

// ─── createTeam ─────────────────────────────────────────────────────────────

export async function runCreateTeam(
  db: AdminDb,
  adminEmail: string,
  ctx: TeamEventContext,
  input: CreateTeamInput,
): Promise<TeamWriteResult> {
  const teamName = input.teamName.trim()
  if (!teamName) return fail('Team name is required')

  const size = TEAM_SIZE[input.format]
  if (!size) return fail('Choose a team format')

  const players = normalizePlayers(input.players)
  if (players.length > size) {
    return fail(`A ${input.format === 'duo' ? 'duo' : 'foursome'} has room for ${size} players`)
  }
  if (!players[input.captainIndex]) return fail('Choose which player is the captain')

  const invalid = validatePlayers(await getTournamentRoster(ctx.eventSanityId), players)
  if (invalid) return fail(invalid)

  const overCapacity = await checkCapacity(ctx, players.length, input.confirmOverCapacity)
  if (overCapacity) return { ...fail(overCapacity), overCapacity: true }

  // Free events have nothing to collect, so players are always confirmed.
  const payment: NewPlayerPayment = ctx.entryFeeCents > 0 ? input.payment : 'paid'

  const accountIds = await resolveAccountIds(
    db,
    players.map((p) => p.email),
  )
  const captainUserId = accountIds.get(players[input.captainIndex].email) ?? null

  let team: { id: string; team_name: string } | null = null
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data, error } = await db
      .from('teams')
      .insert({
        event_sanity_id: ctx.eventSanityId,
        event_slug: ctx.eventSlug,
        team_name: teamName,
        invite_code: generateInviteCode(),
        created_by: captainUserId,
        registration_type: input.format,
        max_members: size,
        walk_up_song: input.walkUpSong?.trim() || null,
        // Pay-link teams behave like self-serve individual-pay teams (the
        // captain tracks payments in My Teams). Confirmed teams are paid in
        // full up front, like a captain-pays-all registration.
        payment_mode: payment === 'payLink' ? 'individual' : 'captain_pays_all',
        team_status: 'pending',
        expires_at: null,
      })
      .select('id, team_name')
      .single()

    if (!error && data) {
      team = data
      break
    }
    if (error && error.code !== '23505') return fail('Failed to create the team')
  }
  if (!team) return fail('Could not generate a unique invite code')

  const inserted = await insertPlayerSlots(db, {
    ctx,
    teamId: team.id,
    teamName: team.team_name,
    players,
    captainIndex: input.captainIndex,
    captainUserId,
    accountIds,
    payment,
    adminEmail,
    action: 'created_team',
  })

  if ('error' in inserted) {
    // No players means no team: remove it so no empty shell is left behind.
    await db.from('teams').delete().eq('id', team.id)
    return fail('Failed to add the players, so the team was not created')
  }

  await recalcTeamStatus(db, team.id)

  return {
    teamId: team.id,
    teamName: team.team_name,
    format: input.format,
    payment,
    players: inserted.players,
  }
}

// ─── addPlayersToTeam ───────────────────────────────────────────────────────

export async function runAddPlayersToTeam(
  db: AdminDb,
  adminEmail: string,
  ctx: TeamEventContext,
  input: AddPlayersInput,
): Promise<TeamWriteResult> {
  const { data: team } = await db
    .from('teams')
    .select('id, event_sanity_id, team_name, registration_type, max_members, team_status')
    .eq('id', input.teamId)
    .maybeSingle()

  if (!team) return fail('Team not found')
  if (team.event_sanity_id !== ctx.eventSanityId) {
    return fail('That team belongs to a different tournament')
  }
  if (team.team_status === 'cancelled' || team.team_status === 'expired') {
    return fail('That team is cancelled or expired')
  }

  const players = normalizePlayers(input.players)

  const roster = await getTournamentRoster(ctx.eventSanityId)
  const current = roster.find((e) => e.teamId === team.id)?.members ?? []
  const open = team.max_members - current.length
  if (players.length > open) {
    return fail(
      open <= 0
        ? `${team.team_name} is already full`
        : `${team.team_name} has room for ${open} more player${open === 1 ? '' : 's'}`,
    )
  }

  const invalid = validatePlayers(roster, players)
  if (invalid) return fail(invalid)

  const overCapacity = await checkCapacity(ctx, players.length, input.confirmOverCapacity)
  if (overCapacity) return { ...fail(overCapacity), overCapacity: true }

  const payment: NewPlayerPayment = ctx.entryFeeCents > 0 ? input.payment : 'paid'

  // New players report to the team's current captain, like their teammates.
  const captain = current.find((m) => m.isCaptain)
  let captainUserId: string | null = null
  if (captain?.sourceTable === 'registration_slots') {
    const { data } = await db
      .from('registration_slots')
      .select('app_user_id')
      .eq('id', captain.sourceId)
      .maybeSingle()
    captainUserId = data?.app_user_id ?? null
  } else if (captain) {
    const { data } = await db
      .from('event_registrations')
      .select('user_id')
      .eq('id', captain.sourceId)
      .maybeSingle()
    captainUserId = data?.user_id ?? null
  }

  const inserted = await insertPlayerSlots(db, {
    ctx,
    teamId: team.id,
    teamName: team.team_name,
    players,
    captainIndex: null,
    captainUserId,
    accountIds: await resolveAccountIds(
      db,
      players.map((p) => p.email),
    ),
    payment,
    adminEmail,
    action: 'added_to_team',
  })
  if ('error' in inserted) return fail('Failed to add the players')

  await recalcTeamStatus(db, team.id)

  return {
    teamId: team.id,
    teamName: team.team_name,
    format: team.registration_type === 'duo' ? 'duo' : 'team',
    payment,
    players: inserted.players,
  }
}
