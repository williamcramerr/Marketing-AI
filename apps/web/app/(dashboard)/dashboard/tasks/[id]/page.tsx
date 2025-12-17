import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  FileText,
  Globe,
  Mail,
  MessageSquare,
  Search,
  Megaphone,
  Lightbulb,
  BarChart,
  Clock,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Calendar,
  User,
  History,
  FileCode,
  Play,
  RefreshCw,
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
  { variant: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | 'info'; label: string; icon: React.ComponentType<{ className?: string }> }
> = {
  queued: { variant: 'outline', label: 'Queued', icon: Clock },
  drafting: { variant: 'info', label: 'Drafting', icon: FileCode },
  drafted: { variant: 'secondary', label: 'Drafted', icon: FileText },
  pending_approval: { variant: 'warning', label: 'Pending Approval', icon: AlertCircle },
  approved: { variant: 'success', label: 'Approved', icon: CheckCircle2 },
  executing: { variant: 'info', label: 'Executing', icon: Play },
  completed: { variant: 'success', label: 'Completed', icon: CheckCircle2 },
  failed: { variant: 'destructive', label: 'Failed', icon: XCircle },
  cancelled: { variant: 'outline', label: 'Cancelled', icon: XCircle },
  evaluated: { variant: 'secondary', label: 'Evaluated', icon: BarChart },
};

interface TaskDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function TaskDetailPage({ params }: TaskDetailPageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  // Fetch task with related data
  const { data: task, error } = await supabase
    .from('tasks')
    .select(
      `
      *,
      campaigns (
        id,
        name,
        status,
        products (
          id,
          name,
          organization_id
        )
      ),
      connectors (
        id,
        name,
        type
      )
    `
    )
    .eq('id', id)
    .single();

  if (error || !task) {
    notFound();
  }

  // Fetch approval if task is in pending_approval status
  const { data: approval } = await supabase
    .from('approvals')
    .select('*')
    .eq('task_id', id)
    .order('requested_at', { ascending: false })
    .limit(1)
    .single();

  const IconComponent = taskTypeIcons[task.type] || FileText;
  const status = statusConfig[task.status] || statusConfig.queued;
  const StatusIcon = status.icon;

  // Parse status history
  const statusHistory = (task.status_history as any[]) || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard/tasks">
          <Button variant="outline" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-muted p-2">
              <IconComponent className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">{task.title}</h1>
              <p className="text-sm text-muted-foreground">
                {task.campaigns?.name} • {task.campaigns?.products?.name}
              </p>
            </div>
          </div>
        </div>
        <Badge variant={status.variant} className="flex items-center gap-1">
          <StatusIcon className="h-3 w-3" />
          {status.label}
        </Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Task Details */}
          <Card>
            <CardHeader>
              <CardTitle>Task Details</CardTitle>
              <CardDescription>Overview of this marketing automation task</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {task.description && (
                <div>
                  <h3 className="text-sm font-medium mb-2">Description</h3>
                  <p className="text-sm text-muted-foreground">{task.description}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="text-sm font-medium mb-1">Type</h3>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <IconComponent className="h-4 w-4" />
                    <span className="capitalize">{task.type.replace('_', ' ')}</span>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium mb-1">Priority</h3>
                  <Badge variant={task.priority > 5 ? 'warning' : 'outline'}>
                    {task.priority > 7 ? 'High' : task.priority > 4 ? 'Medium' : 'Low'} ({task.priority})
                  </Badge>
                </div>

                <div>
                  <h3 className="text-sm font-medium mb-1">Created</h3>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span>{new Date(task.created_at).toLocaleString()}</span>
                  </div>
                </div>

                {task.scheduled_for && (
                  <div>
                    <h3 className="text-sm font-medium mb-1">Scheduled For</h3>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      <span>{new Date(task.scheduled_for).toLocaleString()}</span>
                    </div>
                  </div>
                )}

                {task.started_at && (
                  <div>
                    <h3 className="text-sm font-medium mb-1">Started</h3>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Play className="h-4 w-4" />
                      <span>{new Date(task.started_at).toLocaleString()}</span>
                    </div>
                  </div>
                )}

                {task.completed_at && (
                  <div>
                    <h3 className="text-sm font-medium mb-1">Completed</h3>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <CheckCircle2 className="h-4 w-4" />
                      <span>{new Date(task.completed_at).toLocaleString()}</span>
                    </div>
                  </div>
                )}

                {task.connectors && (
                  <div>
                    <h3 className="text-sm font-medium mb-1">Connector</h3>
                    <p className="text-sm text-muted-foreground">
                      {task.connectors.name} ({task.connectors.type})
                    </p>
                  </div>
                )}

                {task.retry_count > 0 && (
                  <div>
                    <h3 className="text-sm font-medium mb-1">Retries</h3>
                    <div className="flex items-center gap-2">
                      <RefreshCw className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">
                        {task.retry_count} / {task.max_retries}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {task.dry_run && (
                <div className="rounded-md bg-blue-50 dark:bg-blue-950 p-3 text-sm text-blue-800 dark:text-blue-200">
                  <p className="font-medium">Dry Run Mode</p>
                  <p className="mt-1">This task will not be executed - preview only</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Draft Content */}
          {task.draft_content && (
            <Card>
              <CardHeader>
                <CardTitle>Draft Content</CardTitle>
                <CardDescription>AI-generated content awaiting review</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-md bg-muted p-4">
                  <pre className="text-sm whitespace-pre-wrap overflow-auto max-h-96">
                    {JSON.stringify(task.draft_content, null, 2)}
                  </pre>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Final Content */}
          {task.final_content && (
            <Card>
              <CardHeader>
                <CardTitle>Final Content</CardTitle>
                <CardDescription>Approved content ready for execution</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-md bg-muted p-4">
                  <pre className="text-sm whitespace-pre-wrap overflow-auto max-h-96">
                    {JSON.stringify(task.final_content, null, 2)}
                  </pre>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Execution Result */}
          {task.execution_result && (
            <Card>
              <CardHeader>
                <CardTitle>Execution Result</CardTitle>
                <CardDescription>Output from task execution</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-md bg-muted p-4">
                  <pre className="text-sm whitespace-pre-wrap overflow-auto max-h-96">
                    {JSON.stringify(task.execution_result, null, 2)}
                  </pre>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Error Log */}
          {task.error_log && Object.keys(task.error_log as object).length > 0 && (
            <Card className="border-destructive">
              <CardHeader>
                <CardTitle className="text-destructive">Error Log</CardTitle>
                <CardDescription>Details of errors encountered during task execution</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-md bg-destructive/10 p-4">
                  <pre className="text-sm whitespace-pre-wrap overflow-auto max-h-96 text-destructive">
                    {JSON.stringify(task.error_log, null, 2)}
                  </pre>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Approval Details */}
          {approval && (
            <Card>
              <CardHeader>
                <CardTitle>Approval Information</CardTitle>
                <CardDescription>Current approval request details</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h3 className="text-sm font-medium mb-1">Status</h3>
                    <Badge
                      variant={
                        approval.status === 'approved'
                          ? 'success'
                          : approval.status === 'rejected'
                            ? 'destructive'
                            : approval.status === 'expired'
                              ? 'outline'
                              : 'warning'
                      }
                    >
                      {approval.status.replace('_', ' ').toUpperCase()}
                    </Badge>
                  </div>

                  <div>
                    <h3 className="text-sm font-medium mb-1">Requested</h3>
                    <p className="text-sm text-muted-foreground">
                      {new Date(approval.requested_at).toLocaleString()}
                    </p>
                  </div>

                  {approval.expires_at && (
                    <div>
                      <h3 className="text-sm font-medium mb-1">Expires</h3>
                      <p className="text-sm text-muted-foreground">
                        {new Date(approval.expires_at).toLocaleString()}
                      </p>
                    </div>
                  )}

                  {approval.resolved_at && (
                    <div>
                      <h3 className="text-sm font-medium mb-1">Resolved</h3>
                      <p className="text-sm text-muted-foreground">
                        {new Date(approval.resolved_at).toLocaleString()}
                      </p>
                    </div>
                  )}
                </div>

                {approval.resolution_notes && (
                  <div>
                    <h3 className="text-sm font-medium mb-2">Resolution Notes</h3>
                    <p className="text-sm text-muted-foreground">{approval.resolution_notes}</p>
                  </div>
                )}

                {approval.status === 'pending' && (
                  <div className="pt-4">
                    <Link href="/dashboard/approvals">
                      <Button>Review in Approvals</Button>
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Campaign Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Campaign</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <h3 className="text-sm font-medium mb-1">Name</h3>
                <Link href={`/dashboard/campaigns/${task.campaigns?.id}`}>
                  <p className="text-sm text-primary hover:underline">{task.campaigns?.name}</p>
                </Link>
              </div>
              <div>
                <h3 className="text-sm font-medium mb-1">Product</h3>
                <p className="text-sm text-muted-foreground">{task.campaigns?.products?.name}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium mb-1">Campaign Status</h3>
                <Badge variant="outline" className="capitalize">
                  {task.campaigns?.status}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Status History */}
          {statusHistory.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <History className="h-5 w-5" />
                  Status History
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {statusHistory.map((entry: any, index: number) => {
                    const entryStatus = statusConfig[entry.status] || statusConfig.queued;
                    const EntryIcon = entryStatus.icon;
                    return (
                      <div key={index} className="flex items-start gap-3">
                        <div className="mt-1">
                          <EntryIcon className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <Badge variant={entryStatus.variant} className="text-xs">
                              {entryStatus.label}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {entry.timestamp ? new Date(entry.timestamp).toLocaleString() : 'Unknown time'}
                          </p>
                          {entry.note && <p className="text-xs text-muted-foreground">{entry.note}</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Input Data */}
          {task.input_data && Object.keys(task.input_data as object).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Input Data</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded-md bg-muted p-3">
                  <pre className="text-xs whitespace-pre-wrap overflow-auto max-h-64">
                    {JSON.stringify(task.input_data, null, 2)}
                  </pre>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
