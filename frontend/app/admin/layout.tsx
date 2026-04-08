import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import AdminSidebar from '@/app/components/admin/AdminSidebar'

export const metadata = {
  title: {
    template: '%s | Admin — Fendo Golf',
    default: 'Admin — Fendo Golf',
  },
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/sign-in?next=/admin')
  }

  // Verify admin role via service role (bypasses RLS, authoritative)
  const adminDb = createAdminClient()
  const { data: profile } = await adminDb
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    redirect('/')
  }

  return (
    <div className="flex min-h-[calc(100vh-5rem)]">
      <AdminSidebar />
      <div className="flex-1 min-w-0">
        {children}
      </div>
    </div>
  )
}
