import { getCampaign, getCampaignTasks, updateCampaignStatus } from '@/lib/actions/campaigns';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { ArrowLeft, Play, Pause, CheckCircle, Calendar, Target, DollarSign } from 'lucide-react';
import { formatDate, formatDateTime } from '@/lib/utils';

interface CampaignDetailPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function CampaignDetailPage({ params }: CampaignDetailPageProps) {
  const { id } = await params;
  const campaign = await getCampaign(id);
  const tasks = await getCampaignTasks(id);

  const getStatusBadgeVariant = (
    status: string
  ): 'draft' | 'planned' | 'active' | 'paused' | 'completed' | 'cancelled' => {
    return status as any;
  };

  const getTaskStatusBadge = (status: string) => {
    const statusMap: Record<string, { variant: any; label: string }> = {
      queued: { variant: 'secondary', label: 'Queued' },
      drafting: { variant: 'info', label: 'Drafting' },
      drafted: { variant: 'info', label: 'Drafted' },
      pending_approval: { variant: 'warning', label: 'Pending Approval' },
      approved: { variant: 'success', label: 'Approved' },
      executing: { variant: 'info', label: 'Executing' },
      completed: { variant: 'success', label: 'Completed' },
      failed: { variant: 'destructive', label: 'Failed' },
      cancelled: { variant: 'cancelled', label: 'Cancelled' },
      evaluated: { variant: 'completed', label: 'Evaluated' },
    };
    return statusMap[status] || { variant: 'secondary', label: status };
  };

  const formatCurrency = (cents: number | null) => {
    if (!cents) return '--';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100);
  };

  const canStart = campaign.status === 'draft' || campaign.status === 'planned';
  const canPause = campaign.status === 'active';
  const canComplete = campaign.status === 'active' || campaign.status === 'paused';

  async function handleStartCampaign() {
    'use server';
    await updateCampaignStatus(id, 'active');
  }

  async function handlePauseCampaign() {
    'use server';
    await updateCampaignStatus(id, 'paused');
  }

  async function handleCompleteCampaign() {
    'use server';
    await updateCampaignStatus(id, 'completed');
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/campaigns">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">{campaign.name}</h1>
            <Badge variant={getStatusBadgeVariant(campaign.status)}>{campaign.status}</Badge>
          </div>
          <p className="text-muted-foreground">{campaign.products?.name}</p>
        </div>
        <div className="flex gap-2">
          {canStart && (
            <form action={handleStartCampaign}>
              <Button type="submit" variant="default">
                <Play className="mr-2 h-4 w-4" />
                Start Campaign
              </Button>
            </form>
          )}
          {canPause && (
            <form action={handlePauseCampaign}>
              <Button type="submit" variant="outline">
                <Pause className="mr-2 h-4 w-4" />
                Pause
              </Button>
            </form>
          )}
          {canComplete && (
            <form action={handleCompleteCampaign}>
              <Button type="submit" variant="outline">
                <CheckCircle className="mr-2 h-4 w-4" />
                Complete
              </Button>
            </form>
          )}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Campaign Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {campaign.description && (
              <div>
                <p className="text-sm font-medium">Description</p>
                <p className="text-sm text-muted-foreground">{campaign.description}</p>
              </div>
            )}

            <div className="flex items-center">
              <Target className="mr-2 h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Goal</p>
                <p className="text-sm text-muted-foreground">{campaign.goal}</p>
              </div>
            </div>

            {campaign.goal_metric && (
              <div>
                <p className="text-sm font-medium">Goal Metric</p>
                <p className="text-sm text-muted-foreground">
                  {campaign.goal_metric}
                  {campaign.goal_target && ` (Target: ${campaign.goal_target.toLocaleString()})`}
                </p>
              </div>
            )}

            {campaign.audiences && (
              <div>
                <p className="text-sm font-medium">Target Audience</p>
                <p className="text-sm text-muted-foreground">{campaign.audiences.name}</p>
              </div>
            )}

            {campaign.channels && campaign.channels.length > 0 && (
              <div>
                <p className="mb-2 text-sm font-medium">Channels</p>
                <div className="flex flex-wrap gap-2">
                  {campaign.channels.map((channel: string) => (
                    <Badge key={channel} variant="outline">
                      {channel}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {(campaign.start_date || campaign.end_date) && (
              <div className="space-y-2">
                {campaign.start_date && (
                  <div className="flex items-center">
                    <Calendar className="mr-2 h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Start Date</p>
                      <p className="text-sm text-muted-foreground">
                        {formatDate(campaign.start_date)}
                      </p>
                    </div>
                  </div>
                )}

                {campaign.end_date && (
                  <div className="flex items-center">
                    <Calendar className="mr-2 h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">End Date</p>
                      <p className="text-sm text-muted-foreground">
                        {formatDate(campaign.end_date)}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {campaign.budget_cents && (
              <div className="flex items-center">
                <DollarSign className="mr-2 h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Budget</p>
                  <p className="text-sm text-muted-foreground">
                    {formatCurrency(campaign.budget_cents)}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Campaign Metrics</CardTitle>
            <CardDescription>Performance overview</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="rounded-lg border p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Total Tasks</p>
                  <p className="text-2xl font-bold">{tasks?.length || 0}</p>
                </div>
              </div>

              <div className="rounded-lg border p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Completed</p>
                  <p className="text-2xl font-bold">
                    {tasks?.filter((t) => t.status === 'completed').length || 0}
                  </p>
                </div>
              </div>

              <div className="rounded-lg border p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">In Progress</p>
                  <p className="text-2xl font-bold">
                    {tasks?.filter((t) =>
                      ['queued', 'drafting', 'executing'].includes(t.status)
                    ).length || 0}
                  </p>
                </div>
              </div>

              <div className="rounded-lg border p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Pending Approval</p>
                  <p className="text-2xl font-bold">
                    {tasks?.filter((t) => t.status === 'pending_approval').length || 0}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tasks</CardTitle>
          <CardDescription>All tasks associated with this campaign</CardDescription>
        </CardHeader>
        <CardContent>
          {tasks && tasks.length > 0 ? (
            <div className="space-y-3">
              {tasks.map((task) => {
                const taskStatus = getTaskStatusBadge(task.status);
                return (
                  <div
                    key={task.id}
                    className="flex items-center justify-between rounded-lg border p-4"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <h4 className="font-medium">{task.title}</h4>
                        <Badge variant={taskStatus.variant}>{taskStatus.label}</Badge>
                      </div>
                      {task.description && (
                        <p className="mt-1 text-sm text-muted-foreground">{task.description}</p>
                      )}
                      <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="capitalize">{task.type.replace('_', ' ')}</span>
                        {task.scheduled_for && (
                          <span>Scheduled: {formatDateTime(task.scheduled_for)}</span>
                        )}
                        {task.completed_at && (
                          <span>Completed: {formatDateTime(task.completed_at)}</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-8 text-center">
              <p className="text-muted-foreground">
                No tasks yet. Tasks will be generated when the campaign starts.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
