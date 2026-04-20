import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const code = request.nextUrl.searchParams.get('code')?.toUpperCase().trim()
  const eventSanityId = request.nextUrl.searchParams.get('eventSanityId')

  if (!code || !eventSanityId) {
    return NextResponse.json({ error: 'Missing params' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: team } = await admin
    .from('teams')
    .select('id, team_name, registration_type, max_members, invite_code, created_by')
    .eq('invite_code', code)
    .eq('event_sanity_id', eventSanityId)
    .maybeSingle()

  if (!team) {
    return NextResponse.json(
      { error: 'Team not found. Check the code and try again.' },
      { status: 404 },
    )
  }

  // Captain must have a paid registration before joiners can attach
  const { data: captainReg } = await admin
    .from('event_registrations')
    .select('id')
    .eq('team_id', team.id)
    .eq('user_id', team.created_by)
    .eq('status', 'paid')
    .maybeSingle()

  if (!captainReg) {
    return NextResponse.json(
      {
        error:
          'This team is not yet confirmed. Ask your captain to complete their registration first.',
      },
      { status: 400 },
    )
  }

  // Count current non-cancelled members
  const { count: memberCount } = await admin
    .from('event_registrations')
    .select('*', { count: 'exact', head: true })
    .eq('team_id', team.id)
    .neq('status', 'cancelled')

  if (memberCount !== null && memberCount >= team.max_members) {
    return NextResponse.json({ error: 'This team is already full.' }, { status: 400 })
  }

  // Check if requesting user is already on this team
  const { data: existingMembership } = await admin
    .from('event_registrations')
    .select('id')
    .eq('team_id', team.id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (existingMembership) {
    return NextResponse.json(
      { error: 'You are already a member of this team.' },
      { status: 409 },
    )
  }

  return NextResponse.json({
    id: team.id,
    teamName: team.team_name,
    registrationType: team.registration_type,
    maxMembers: team.max_members,
    memberCount: memberCount ?? 0,
    inviteCode: team.invite_code,
  })
}
