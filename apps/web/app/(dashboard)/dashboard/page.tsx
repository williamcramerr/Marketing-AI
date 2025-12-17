import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Plus, Megaphone, CheckSquare, AlertCircle, TrendingUp, BarChart3 } from 'lucide-react';
import { CreateOrganizationDialog } from '@/components/dashboard/create-organization-dialog';
import { getOverviewMetrics } from '@/lib/actions/analytics';
import { InfoButton } from '@/components/common/info-button';
import { TipCard } from '@/components/common/tip-card';

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Get user's organizations
  const { data: memberships } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', user!.id);

  const orgIds = memberships?.map((m) => m.organization_id) || [];

  if (orgIds.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <h1 className="mb-2 text-2xl font-bold">Welcome to Marketing Pilot AI</h1>
        <p className="mb-8 text-muted-foreground">
          Create your first organization to get started
        </p>
        <CreateOrganizationDialog />
      </div>
    );
  }

  // Get the first organization ID for metrics
  const firstOrgId = orgIds[0];

  // Get stats
  const [
    { count: campaignCount },
    { count: activeTaskCount },
    { count: pendingApprovalCount },
    overviewMetrics,
  ] = await Promise.all([
    supabase
      .from('campaigns')
      .select('*', { count: 'exact', head: true })
      .in('status', ['active', 'planned']),
    supabase
      .from('tasks')
      .select('*', { count: 'exact', head: true })
      .in('status', ['queued', 'drafting', 'executing']),
    supabase
      .from('approvals')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending'),
    getOverviewMetrics(firstOrgId).catch(() => null),
  ]);

  // Get recent tasks
  const { data: recentTasks } = await supabase
    .from('tasks')
    .select('id, title, status, type, created_at')
    .order('created_at', { ascending: false })
    .limit(5);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">
            Overview of your marketing automation
          </p>
        </div>
        <Link href="/dashboard/campaigns/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Campaign
          </Button>
        </Link>
      </div>

      <TipCard
        id="dashboard-welcome"
        title="Welcome to Marketing Pilot AI!"
        description="This is your command center. Track campaigns, tasks, and approvals at a glance. Get started by connecting your first marketing channel or creating a campaign."
        variant="info"
      />

      <TipCard
        id="search-shortcut"
        title="Quick Search"
        description="Press Cmd+K (or Ctrl+K on Windows) to quickly search for campaigns, products, tasks, and content from anywhere in the app."
        variant="info"
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="flex items-center gap-1">
              <CardTitle className="text-sm font-medium">Active Campaigns</CardTitle>
              <InfoButton
                title="Active Campaigns"
                description="The number of campaigns currently running or scheduled to run. This includes campaigns in 'active' or 'planned' status."
              />
            </div>
            <Megaphone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{campaignCount || 0}</div>
            <p className="text-xs text-muted-foreground">Currently running</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="flex items-center gap-1">
              <CardTitle className="text-sm font-medium">Tasks in Progress</CardTitle>
              <InfoButton
                title="Tasks in Progress"
                description="Tasks you're currently working on. This includes tasks that are queued, drafting, or executing."
              />
            </div>
            <CheckSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeTaskCount || 0}</div>
            <p className="text-xs text-muted-foreground">Being processed</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="flex items-center gap-1">
              <CardTitle className="text-sm font-medium">Pending Approvals</CardTitle>
              <InfoButton
                title="Pending Approvals"
                description="Content awaiting your review. AI-generated content may need your approval before being published."
              />
            </div>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingApprovalCount || 0}</div>
            <p className="text-xs text-muted-foreground">
              <Link href="/dashboard/approvals" className="text-primary hover:underline">
                Review now
              </Link>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="flex items-center gap-1">
              <CardTitle className="text-sm font-medium">Open Rate</CardTitle>
              <InfoButton
                title="Open Rate"
                description="The percentage of recipients who opened your emails. A higher open rate indicates effective subject lines and sender reputation."
              />
            </div>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {overviewMetrics ? `${overviewMetrics.openRate.toFixed(1)}%` : '--'}
            </div>
            <p className="text-xs text-muted-foreground">
              <Link href="/dashboard/analytics" className="text-primary hover:underline">
                View analytics
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent Tasks</CardTitle>
            <CardDescription>Latest activity from your campaigns</CardDescription>
          </CardHeader>
          <CardContent>
            {recentTasks && recentTasks.length > 0 ? (
              <div className="space-y-4">
                {recentTasks.map((task) => (
                  <div key={task.id} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{task.title}</p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {task.type.replace('_', ' ')}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-2 py-1 text-xs ${
                        task.status === 'completed'
                          ? 'bg-green-100 text-green-800'
                          : task.status === 'failed'
                            ? 'bg-red-100 text-red-800'
                            : task.status === 'pending_approval'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {task.status.replace('_', ' ')}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No tasks yet. Create a campaign to get started.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common tasks to get you started</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link href="/dashboard/products/new" className="block">
              <Button variant="outline" className="w-full justify-start">
                <Plus className="mr-2 h-4 w-4" />
                Add a Product
              </Button>
            </Link>
            <Link href="/dashboard/connectors" className="block">
              <Button variant="outline" className="w-full justify-start">
                <Plus className="mr-2 h-4 w-4" />
                Connect Email Provider
              </Button>
            </Link>
            <Link href="/dashboard/policies" className="block">
              <Button variant="outline" className="w-full justify-start">
                <Plus className="mr-2 h-4 w-4" />
                Set Up Guardrails
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
