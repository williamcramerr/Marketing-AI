'use client';

import { useState } from 'react';
import Link from 'next/link';
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
  Calendar,
  Eye,
  AlertCircle,
  Check,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { BulkActionBar } from '@/components/common/bulk-action-bar';
import { ApprovalActions } from './approval-actions';
import {
  bulkApproveTasks,
  bulkRejectTasks,
  exportTasksToCSV,
} from '@/lib/actions/bulk';

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

interface Approval {
  id: string;
  status: string;
  requested_at: string;
  expires_at: string | null;
  resolution_notes: string | null;
  content_snapshot: Record<string, unknown> | null;
  tasks: {
    id: string;
    title: string;
    description: string | null;
    type: string;
    priority: number;
    draft_content: Record<string, unknown> | null;
    campaigns: {
      id: string;
      name: string;
      products: {
        id: string;
        name: string;
      } | null;
    } | null;
  } | null;
}

interface ApprovalsListClientProps {
  approvals: Approval[];
  statusFilter: string;
}

export function ApprovalsListClient({ approvals, statusFilter }: ApprovalsListClientProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const pendingApprovals = approvals.filter(
    (a) => a.status === 'pending' && (!a.expires_at || new Date(a.expires_at) > new Date())
  );

  const toggleSelection = (taskId: string) => {
    setSelectedIds((prev) =>
      prev.includes(taskId) ? prev.filter((id) => id !== taskId) : [...prev, taskId]
    );
  };

  const toggleSelectAll = () => {
    const pendingTaskIds = pendingApprovals.map((a) => a.tasks?.id).filter(Boolean) as string[];
    if (selectedIds.length === pendingTaskIds.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(pendingTaskIds);
    }
  };

  const clearSelection = () => setSelectedIds([]);

  const handleBulkApprove = async () => {
    return bulkApproveTasks(selectedIds);
  };

  const handleBulkReject = async (reason?: string) => {
    return bulkRejectTasks(selectedIds, reason);
  };

  const handleExport = async () => {
    return exportTasksToCSV(selectedIds);
  };

  if (!approvals || approvals.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No approvals found</h3>
          <p className="text-sm text-muted-foreground text-center">
            {statusFilter === 'pending'
              ? 'No pending approvals at the moment. Check back later when tasks require review.'
              : `No ${statusFilter} approvals to display.`}
          </p>
          {statusFilter !== 'pending' && (
            <Link href="/dashboard/approvals?status=pending" className="mt-4">
              <Button variant="outline">View Pending Approvals</Button>
            </Link>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      {/* Select All for Pending */}
      {statusFilter === 'pending' && pendingApprovals.length > 0 && (
        <div className="flex items-center gap-4 rounded-lg border bg-muted/50 p-3">
          <Checkbox
            checked={selectedIds.length === pendingApprovals.length && pendingApprovals.length > 0}
            onCheckedChange={toggleSelectAll}
          />
          <span className="text-sm">
            {selectedIds.length > 0
              ? `${selectedIds.length} of ${pendingApprovals.length} selected`
              : `Select all ${pendingApprovals.length} pending approvals`}
          </span>
        </div>
      )}

      <div className="space-y-4">
        {approvals.map((approval) => {
          const task = approval.tasks;
          if (!task) return null;

          const IconComponent = taskTypeIcons[task.type] || FileText;
          const isPending = approval.status === 'pending';
          const isExpired = approval.expires_at && new Date(approval.expires_at) < new Date();
          const isSelected = selectedIds.includes(task.id);
          const canSelect = isPending && !isExpired;

          const contentToShow = approval.content_snapshot || task.draft_content;

          return (
            <Card
              key={approval.id}
              className={`${isPending ? 'border-l-4 border-l-yellow-500' : ''} ${isSelected ? 'ring-2 ring-primary' : ''}`}
            >
              <CardContent className="p-6">
                <div className="space-y-4">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4 flex-1">
                      {canSelect && (
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleSelection(task.id)}
                          className="mt-1"
                        />
                      )}
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
                          <Badge
                            variant={
                              approval.status === 'approved'
                                ? 'success'
                                : approval.status === 'rejected'
                                  ? 'destructive'
                                  : approval.status === 'expired'
                                    ? 'outline'
                                    : approval.status === 'auto_approved'
                                      ? 'info'
                                      : 'warning'
                            }
                          >
                            {approval.status === 'auto_approved'
                              ? 'Auto-Approved'
                              : approval.status.charAt(0).toUpperCase() + approval.status.slice(1)}
                          </Badge>
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
                            <Calendar className="h-4 w-4" />
                            <span>Requested {new Date(approval.requested_at).toLocaleDateString()}</span>
                          </div>

                          {task.priority > 5 && (
                            <Badge variant="warning" className="text-xs">
                              High Priority
                            </Badge>
                          )}

                          {isExpired && isPending && (
                            <Badge variant="destructive" className="text-xs">
                              Expired
                            </Badge>
                          )}
                        </div>

                        {approval.expires_at && isPending && !isExpired && (
                          <div className="rounded-md bg-yellow-50 dark:bg-yellow-950 p-3 text-sm text-yellow-800 dark:text-yellow-200">
                            <p className="font-medium flex items-center gap-2">
                              <Clock className="h-4 w-4" />
                              Expires {new Date(approval.expires_at).toLocaleString()}
                            </p>
                          </div>
                        )}

                        {approval.resolution_notes && (
                          <div className="rounded-md bg-muted p-3 text-sm">
                            <p className="font-medium mb-1">Resolution Notes:</p>
                            <p className="text-muted-foreground">{approval.resolution_notes}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Content Preview */}
                  {contentToShow && (
                    <div className="rounded-md border bg-muted/50 p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-medium">Content Preview</h4>
                        <Link href={`/dashboard/tasks/${task.id}`}>
                          <Button variant="ghost" size="sm">
                            <Eye className="h-4 w-4 mr-1" />
                            View Full Task
                          </Button>
                        </Link>
                      </div>
                      <div className="rounded-md bg-background p-3">
                        <pre className="text-xs whitespace-pre-wrap overflow-auto max-h-64">
                          {JSON.stringify(contentToShow, null, 2)}
                        </pre>
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  {isPending && !isExpired && (
                    <div className="flex items-center gap-2 pt-2">
                      <ApprovalActions approvalId={approval.id} taskId={task.id} />
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Bulk Action Bar */}
      <BulkActionBar
        selectedCount={selectedIds.length}
        onClearSelection={clearSelection}
        onApprove={handleBulkApprove}
        onReject={handleBulkReject}
        onExport={handleExport}
        availableActions={['approve', 'reject', 'export']}
      />
    </>
  );
}
