import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import RoleToggle from '@/app/components/admin/RoleToggle'
import UserAvatar from '@/app/components/auth/UserAvatar'
import { RegistrationStatusBadge } from '@/app/components/account/RegistrationsList'
import { IconCalendar, IconArrow, IconUser, IconMail, IconShield } from '@/app/components/icons'
import type { Profile, EventRegistration } from '@/lib/supabase/types'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = createAdminClient()
  const { data } = await db.from('profiles').select('full_name, email').eq('id', id).single()
  return { title: data?.full_name || data?.email || 'User Detail' }
}

export default async function AdminUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  // Get current admin's user id for self-check
  const supabase = await createClient()
  const { data: { user: currentUser } } = await supabase.auth.getUser()
  if (!currentUser) redirect('/auth/sign-in')

  const db = createAdminClient()

  const [{ data: profile }, { data: registrations }] = await Promise.all([
    db.from('profiles').select('*').eq('id', id).single(),
    db.from('event_registrations')
      .select('*')
      .eq('user_id', id)
      .order('created_at', { ascending: false }),
  ])

  if (!profile) notFound()

  const isSelf = currentUser.id === id

  return (
    <div className="p-6 lg:p-8 space-y-8">
      {/* Back */}
      <Link
        href="/admin/users"
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg transition-colors"
      >
        <IconArrow className="w-4 h-4 rotate-180" />
        All Members
      </Link>

      {/* Header */}
      <div className="flex items-start gap-5 flex-wrap">
        <UserAvatar
          avatarUrl={profile.avatar_url}
          fullName={profile.full_name}
          size="lg"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="display-md">
              {profile.display_name || profile.full_name || 'Unnamed Member'}
            </h1>
            {(profile as Profile).role === 'admin' && (
              <span className="flex items-center gap-1 text-[0.65rem] font-mono font-medium px-2 py-0.5 rounded-md bg-fg text-bg border border-fg/20">
                <IconShield className="w-3 h-3" />
                Admin
              </span>
            )}
          </div>
          {profile.display_name && profile.full_name && (
            <p className="text-muted text-sm mt-0.5">{profile.full_name}</p>
          )}
          <p className="text-xs font-mono text-muted mt-1">
            Member since {format(parseISO(profile.created_at), 'MMMM d, yyyy')}
          </p>
        </div>
      </div>

      {/* Two-column detail */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Profile info */}
        <div className="card-base p-5 space-y-4">
          <h2 className="label-mono text-[0.65rem]">Profile</h2>

          <div className="flex items-center gap-3 text-sm">
            <IconMail className="w-4 h-4 text-muted shrink-0" />
            <span className="text-fg">{profile.email}</span>
          </div>

          {profile.handicap != null && (
            <div className="flex items-center gap-3 text-sm">
              <IconUser className="w-4 h-4 text-muted shrink-0" />
              <span className="text-fg">Handicap {profile.handicap}</span>
            </div>
          )}

          {profile.home_course && (
            <div className="flex items-center gap-3 text-sm">
              <IconCalendar className="w-4 h-4 text-muted shrink-0" />
              <span className="text-fg">{profile.home_course}</span>
            </div>
          )}

          {profile.bio && (
            <div className="pt-2 border-t border-border">
              <p className="text-xs font-mono text-muted mb-1">Bio</p>
              <p className="text-sm text-fg leading-relaxed">{profile.bio}</p>
            </div>
          )}

          <div className="pt-2 border-t border-border">
            <p className="text-xs font-mono text-muted mb-0.5">User ID</p>
            <p className="text-xs font-mono text-muted break-all">{profile.id}</p>
          </div>

          {profile.stripe_customer_id && (
            <div>
              <p className="text-xs font-mono text-muted mb-0.5">Stripe Customer</p>
              <p className="text-xs font-mono text-muted">{profile.stripe_customer_id}</p>
            </div>
          )}
        </div>

        {/* Role management */}
        <div className="card-base p-5 space-y-4">
          <h2 className="label-mono text-[0.65rem]">Role & Permissions</h2>
          <p className="text-sm text-muted leading-relaxed">
            Admins have full access to the admin panel. Members have standard site access only.
          </p>
          <RoleToggle
            userId={profile.id}
            currentRole={(profile as Profile).role}
            isSelf={isSelf}
          />
        </div>
      </div>

      {/* Registrations */}
      <div>
        <h2 className="label-mono text-[0.65rem] mb-4">
          Event Registrations ({(registrations ?? []).length})
        </h2>

        {(registrations ?? []).length === 0 ? (
          <div className="card-base p-8 text-center">
            <p className="text-sm text-muted">No event registrations.</p>
          </div>
        ) : (
          <div className="card-base overflow-hidden">
            <div className="divide-y divide-border">
              {(registrations as EventRegistration[]).map((reg) => (
                <div
                  key={reg.id}
                  className="flex items-center justify-between gap-4 px-5 py-4"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <p className="text-sm font-medium text-fg">{reg.event_title}</p>
                      <RegistrationStatusBadge status={reg.status} />
                    </div>
                    {reg.event_date && (
                      <p className="flex items-center gap-1.5 text-xs font-mono text-muted">
                        <IconCalendar className="w-3.5 h-3.5" />
                        {format(parseISO(reg.event_date), 'MMMM d, yyyy')}
                      </p>
                    )}
                    {reg.amount_paid != null && (
                      <p className="text-xs font-mono text-muted">
                        ${(reg.amount_paid / 100).toFixed(2)} {reg.currency.toUpperCase()}
                      </p>
                    )}
                  </div>
                  <Link
                    href={`/compete/${reg.event_slug}`}
                    className="btn-ghost text-xs px-3 py-2 shrink-0"
                  >
                    View Event
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
