import { createClient } from '@/lib/supabase/server';
import { startOfMonth, endOfMonth, subMonths, addMonths, format } from 'date-fns';
import { getEventsByDateRange } from '@/lib/actions/calendar';
import { MarketingCalendar } from '@/components/calendar/marketing-calendar';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Plus } from 'lucide-react';

export default async function CalendarPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Get user's organizations
  const { data: memberships } = await supabase
    .from('organization_members')
    .select('organization_id, organizations(id, name)')
    .eq('user_id', user!.id);

  const organizationId = memberships?.[0]?.organization_id;

  if (!organizationId) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <h1 className="mb-2 text-2xl font-bold">No Organization Found</h1>
        <p className="text-muted-foreground">Please create an organization first.</p>
      </div>
    );
  }

  // Get events for current month and surrounding months
  const today = new Date();
  const startDate = format(startOfMonth(subMonths(today, 1)), 'yyyy-MM-dd');
  const endDate = format(endOfMonth(addMonths(today, 2)), 'yyyy-MM-dd');

  const events = await getEventsByDateRange(organizationId, startDate, endDate);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Marketing Calendar</h1>
          <p className="text-muted-foreground">
            View and manage your scheduled content and campaigns
          </p>
        </div>
        <Link href="/dashboard/campaigns/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Campaign
          </Button>
        </Link>
      </div>

      <MarketingCalendar events={events} />
    </div>
  );
}
