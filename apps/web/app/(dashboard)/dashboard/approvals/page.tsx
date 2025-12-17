import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ApprovalsListClient } from './approvals-list-client';

interface ApprovalsPageProps {
  searchParams: Promise<{ status?: string }>;
}

export default async function ApprovalsPage({ searchParams }: ApprovalsPageProps) {
  const supabase = await createClient();
  const params = await searchParams;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  // Build query with filters
  let query = supabase
    .from('approvals')
    .select(
      `
      *,
      tasks (
        id,
        title,
        description,
        type,
        priority,
        draft_content,
        final_content,
        campaigns (
          id,
          name,
          products (
            id,
            name
          )
        )
      )
    `
    )
    .order('requested_at', { ascending: false });

  // Apply status filter - default to pending
  const statusFilter = params.status || 'pending';
  query = query.eq('status', statusFilter);

  const { data: approvals } = await query;

  // Get status counts
  const { data: allApprovals } = await supabase.from('approvals').select('status');

  const statusCounts = allApprovals?.reduce(
    (acc, approval) => {
      acc[approval.status] = (acc[approval.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Approvals</h1>
          <p className="text-muted-foreground">Review and approve AI-generated marketing content</p>
        </div>
      </div>

      {/* Status Filter */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filter by Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Link href="/dashboard/approvals?status=pending">
              <Button variant={statusFilter === 'pending' ? 'default' : 'outline'} size="sm">
                Pending
                {statusCounts?.pending ? (
                  <Badge variant="secondary" className="ml-2">
                    {statusCounts.pending}
                  </Badge>
                ) : null}
              </Button>
            </Link>
            <Link href="/dashboard/approvals?status=approved">
              <Button variant={statusFilter === 'approved' ? 'default' : 'outline'} size="sm">
                Approved
                {statusCounts?.approved ? (
                  <Badge variant="secondary" className="ml-2">
                    {statusCounts.approved}
                  </Badge>
                ) : null}
              </Button>
            </Link>
            <Link href="/dashboard/approvals?status=rejected">
              <Button variant={statusFilter === 'rejected' ? 'default' : 'outline'} size="sm">
                Rejected
                {statusCounts?.rejected ? (
                  <Badge variant="secondary" className="ml-2">
                    {statusCounts.rejected}
                  </Badge>
                ) : null}
              </Button>
            </Link>
            <Link href="/dashboard/approvals?status=auto_approved">
              <Button variant={statusFilter === 'auto_approved' ? 'default' : 'outline'} size="sm">
                Auto-Approved
                {statusCounts?.auto_approved ? (
                  <Badge variant="secondary" className="ml-2">
                    {statusCounts.auto_approved}
                  </Badge>
                ) : null}
              </Button>
            </Link>
            <Link href="/dashboard/approvals?status=expired">
              <Button variant={statusFilter === 'expired' ? 'default' : 'outline'} size="sm">
                Expired
                {statusCounts?.expired ? (
                  <Badge variant="secondary" className="ml-2">
                    {statusCounts.expired}
                  </Badge>
                ) : null}
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Approvals List with Bulk Actions */}
      <ApprovalsListClient approvals={approvals || []} statusFilter={statusFilter} />
    </div>
  );
}
