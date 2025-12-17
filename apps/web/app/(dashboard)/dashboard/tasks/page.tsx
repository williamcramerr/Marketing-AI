import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import {
  FileText,
  Globe,
  Mail,
  MessageSquare,
  Search,
  TrendingUp,
  Megaphone,
  Lightbulb,
  BarChart,
  Clock,
  Filter,
} from 'lucide-react';
import type { Tables } from '@/lib/supabase/types';

type Task = Tables<'tasks'>;

// Map task types to icons
const taskTypeIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  blog_post: FileText,
  landing_page: Globe,
  email_single: Mail,
  email_sequence: Mail,
  social_post: MessageSquare,
  seo_optimization: Search,
  ad_campaign: Megaphone,
  research: Lightbulb,
  analysis: BarChart,
};

// Map task statuses to badge variants and colors
const statusConfig: Record<
  string,
  { variant: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | 'info'; label: string }
> = {
  queued: { variant: 'outline', label: 'Queued' },
  drafting: { variant: 'info', label: 'Drafting' },
  drafted: { variant: 'secondary', label: 'Drafted' },
  pending_approval: { variant: 'warning', label: 'Pending Approval' },
  approved: { variant: 'success', label: 'Approved' },
  executing: { variant: 'info', label: 'Executing' },
  completed: { variant: 'success', label: 'Completed' },
  failed: { variant: 'destructive', label: 'Failed' },
  cancelled: { variant: 'outline', label: 'Cancelled' },
  evaluated: { variant: 'secondary', label: 'Evaluated' },
};

interface TasksPageProps {
  searchParams: Promise<{ status?: string; type?: string; priority?: string }>;
}

export default async function TasksPage({ searchParams }: TasksPageProps) {
  const supabase = await createClient();
  const params = await searchParams;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  // Get user's organizations
  const { data: memberships } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', user.id);

  const orgIds = memberships?.map((m) => m.organization_id) || [];

  // Build query with filters
  let query = supabase
    .from('tasks')
    .select(
      `
      *,
      campaigns (
        id,
        name,
        products (
          id,
          name
        )
      )
    `
    )
    .order('created_at', { ascending: false });

  // Apply filters if provided
  if (params.status) {
    query = query.eq('status', params.status);
  }

  if (params.type) {
    query = query.eq('type', params.type);
  }

  if (params.priority) {
    query = query.eq('priority', parseInt(params.priority));
  }

  const { data: tasks } = await query;

  // Get status counts for filter badges
  const { data: statusCounts } = await supabase.from('tasks').select('status');

  const counts = statusCounts?.reduce(
    (acc, task) => {
      acc[task.status] = (acc[task.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  // Get unique task types for filter
  const uniqueTypes = Array.from(new Set(tasks?.map((t) => t.type) || []));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Tasks</h1>
          <p className="text-muted-foreground">Monitor and manage all marketing automation tasks</p>
        </div>
      </div>

      {/* Status Filter Badges */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Filter className="h-5 w-5" />
            Filter by Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Link href="/dashboard/tasks">
              <Button variant={!params.status ? 'default' : 'outline'} size="sm">
                All Tasks
                {counts && (
                  <Badge variant="secondary" className="ml-2">
                    {Object.values(counts).reduce((a, b) => a + b, 0)}
                  </Badge>
                )}
              </Button>
            </Link>
            {Object.entries(statusConfig).map(([status, config]) => {
              const count = counts?.[status] || 0;
              if (count === 0 && status !== params.status) return null;
              return (
                <Link key={status} href={`/dashboard/tasks?status=${status}`}>
                  <Button variant={params.status === status ? 'default' : 'outline'} size="sm">
                    {config.label}
                    {count > 0 && (
                      <Badge variant="secondary" className="ml-2">
                        {count}
                      </Badge>
                    )}
                  </Button>
                </Link>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Type Filter */}
      {uniqueTypes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Filter by Type</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <Link href={`/dashboard/tasks${params.status ? `?status=${params.status}` : ''}`}>
                <Button variant={!params.type ? 'default' : 'outline'} size="sm">
                  All Types
                </Button>
              </Link>
              {uniqueTypes.map((type) => (
                <Link
                  key={type}
                  href={`/dashboard/tasks?${params.status ? `status=${params.status}&` : ''}type=${type}`}
                >
                  <Button variant={params.type === type ? 'default' : 'outline'} size="sm">
                    {type.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                  </Button>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tasks List */}
      <div className="space-y-4">
        {tasks && tasks.length > 0 ? (
          tasks.map((task) => {
            const IconComponent = taskTypeIcons[task.type] || FileText;
            const status = statusConfig[task.status] || statusConfig.queued;

            return (
              <Link key={task.id} href={`/dashboard/tasks/${task.id}`}>
                <Card className="transition-all hover:shadow-md">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-4 flex-1">
                        <div className="mt-1 rounded-lg bg-muted p-2">
                          <IconComponent className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div className="flex-1 space-y-2">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <h3 className="font-semibold text-lg">{task.title}</h3>
                              {task.description && (
                                <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                                  {task.description}
                                </p>
                              )}
                            </div>
                            <Badge variant={status.variant}>{status.label}</Badge>
                          </div>

                          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <IconComponent className="h-4 w-4" />
                              <span className="capitalize">{task.type.replace('_', ' ')}</span>
                            </div>

                            {task.campaigns && (
                              <div className="flex items-center gap-1">
                                <Megaphone className="h-4 w-4" />
                                <span>{task.campaigns.name}</span>
                              </div>
                            )}

                            {task.campaigns?.products && (
                              <div className="flex items-center gap-1">
                                <span className="text-xs">Product: {task.campaigns.products.name}</span>
                              </div>
                            )}

                            <div className="flex items-center gap-1">
                              <Clock className="h-4 w-4" />
                              <span>{new Date(task.created_at).toLocaleDateString()}</span>
                            </div>

                            {task.priority > 5 && (
                              <Badge variant="warning" className="text-xs">
                                High Priority
                              </Badge>
                            )}

                            {task.retry_count > 0 && (
                              <Badge variant="outline" className="text-xs">
                                Retry {task.retry_count}/{task.max_retries}
                              </Badge>
                            )}
                          </div>

                          {/* Show error if failed */}
                          {task.status === 'failed' && task.error_log && (
                            <div className="mt-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                              <p className="font-medium">Error:</p>
                              <p className="mt-1 line-clamp-2">
                                {typeof task.error_log === 'object'
                                  ? JSON.stringify(task.error_log)
                                  : String(task.error_log)}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No tasks found</h3>
              <p className="text-sm text-muted-foreground text-center">
                {params.status || params.type
                  ? 'Try adjusting your filters to see more tasks'
                  : 'Tasks will appear here when campaigns are created and activated'}
              </p>
              {(params.status || params.type) && (
                <Link href="/dashboard/tasks" className="mt-4">
                  <Button variant="outline">Clear Filters</Button>
                </Link>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
