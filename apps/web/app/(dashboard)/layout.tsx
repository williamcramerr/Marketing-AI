import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { DashboardNav } from '@/components/dashboard/nav';
import { DashboardHeader } from '@/components/dashboard/header';

// Force dynamic rendering for all dashboard pages
// These pages use cookies for authentication and can't be statically generated
export const dynamic = 'force-dynamic';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Get user's organizations
  const { data: memberships } = await supabase
    .from('organization_members')
    .select('organization_id, role, organizations(id, name, slug)')
    .eq('user_id', user.id);

  const organizations = memberships?.map((m) => {
    const org = Array.isArray(m.organizations) ? m.organizations[0] : m.organizations;
    return {
      id: org?.id,
      name: org?.name,
      slug: org?.slug,
      role: m.role,
    };
  }).filter(Boolean) || [];

  return (
    <div className="flex min-h-screen">
      <DashboardNav organizations={organizations} />
      <div className="flex flex-1 flex-col">
        <DashboardHeader user={user} organizations={organizations} />
        <main className="flex-1 overflow-y-auto bg-muted/30 p-6">{children}</main>
      </div>
    </div>
  );
}
