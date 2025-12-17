'use client';

import { useState, useTransition } from 'react';
import {
  Check,
  X,
  Trash2,
  Download,
  Archive,
  Loader2,
  FileUp,
  FileDown,
  Eye,
  EyeOff,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export type BulkAction =
  | 'approve'
  | 'reject'
  | 'delete'
  | 'export'
  | 'archive'
  | 'publish'
  | 'unpublish';

interface BulkActionBarProps {
  selectedCount: number;
  onClearSelection: () => void;
  onApprove?: () => Promise<{ success: boolean; processed?: number; error?: string }>;
  onReject?: (reason?: string) => Promise<{ success: boolean; processed?: number; error?: string }>;
  onDelete?: () => Promise<{ success: boolean; processed?: number; error?: string }>;
  onExport?: () => Promise<{ success: boolean; data?: string; error?: string }>;
  onArchive?: () => Promise<{ success: boolean; processed?: number; error?: string }>;
  onPublish?: () => Promise<{ success: boolean; processed?: number; error?: string }>;
  onUnpublish?: () => Promise<{ success: boolean; processed?: number; error?: string }>;
  availableActions?: BulkAction[];
  className?: string;
}

export function BulkActionBar({
  selectedCount,
  onClearSelection,
  onApprove,
  onReject,
  onDelete,
  onExport,
  onArchive,
  onPublish,
  onUnpublish,
  availableActions = ['approve', 'reject', 'delete', 'export'],
  className,
}: BulkActionBarProps) {
  const [isPending, startTransition] = useTransition();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const { toast } = useToast();

  if (selectedCount === 0) {
    return null;
  }

  const handleAction = async (
    action: string,
    handler?: () => Promise<{ success: boolean; processed?: number; error?: string }>
  ) => {
    if (!handler) return;

    startTransition(async () => {
      const result = await handler();
      if (result.success) {
        toast({
          title: 'Success',
          description: `${action} completed. ${result.processed || selectedCount} item(s) processed.`,
        });
        onClearSelection();
      } else {
        toast({
          title: 'Error',
          description: result.error || `Failed to ${action.toLowerCase()} items.`,
          variant: 'destructive',
        });
      }
    });
  };

  const handleReject = async () => {
    if (!onReject) return;

    startTransition(async () => {
      const result = await onReject(rejectReason || undefined);
      if (result.success) {
        toast({
          title: 'Success',
          description: `Rejected ${result.processed || selectedCount} item(s).`,
        });
        onClearSelection();
        setShowRejectDialog(false);
        setRejectReason('');
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Failed to reject items.',
          variant: 'destructive',
        });
      }
    });
  };

  const handleDelete = async () => {
    if (!onDelete) return;

    startTransition(async () => {
      const result = await onDelete();
      if (result.success) {
        toast({
          title: 'Success',
          description: `Deleted ${result.processed || selectedCount} item(s).`,
        });
        onClearSelection();
        setShowDeleteDialog(false);
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Failed to delete items.',
          variant: 'destructive',
        });
      }
    });
  };

  const handleExport = async () => {
    if (!onExport) return;

    startTransition(async () => {
      const result = await onExport();
      if (result.success && result.data) {
        // Create and download CSV
        const blob = new Blob([result.data], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `export-${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        toast({
          title: 'Export Complete',
          description: 'Your data has been exported to CSV.',
        });
      } else {
        toast({
          title: 'Export Failed',
          description: result.error || 'Failed to export data.',
          variant: 'destructive',
        });
      }
    });
  };

  return (
    <>
      <div
        className={cn(
          'fixed bottom-6 left-1/2 z-50 -translate-x-1/2 transform',
          'flex items-center gap-3 rounded-lg border bg-card px-4 py-3 shadow-lg',
          'animate-in slide-in-from-bottom-4 fade-in-0',
          className
        )}
      >
        <div className="flex items-center gap-2 border-r pr-3">
          <span className="text-sm font-medium">{selectedCount} selected</span>
          <Button variant="ghost" size="sm" onClick={onClearSelection}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          {availableActions.includes('approve') && onApprove && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleAction('Approve', onApprove)}
              disabled={isPending}
            >
              {isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Check className="mr-2 h-4 w-4" />
              )}
              Approve
            </Button>
          )}

          {availableActions.includes('reject') && onReject && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowRejectDialog(true)}
              disabled={isPending}
            >
              <X className="mr-2 h-4 w-4" />
              Reject
            </Button>
          )}

          {availableActions.includes('publish') && onPublish && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleAction('Publish', onPublish)}
              disabled={isPending}
            >
              {isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Eye className="mr-2 h-4 w-4" />
              )}
              Publish
            </Button>
          )}

          {availableActions.includes('unpublish') && onUnpublish && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleAction('Unpublish', onUnpublish)}
              disabled={isPending}
            >
              {isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <EyeOff className="mr-2 h-4 w-4" />
              )}
              Unpublish
            </Button>
          )}

          {availableActions.includes('archive') && onArchive && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleAction('Archive', onArchive)}
              disabled={isPending}
            >
              {isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Archive className="mr-2 h-4 w-4" />
              )}
              Archive
            </Button>
          )}

          {availableActions.includes('export') && onExport && (
            <Button variant="outline" size="sm" onClick={handleExport} disabled={isPending}>
              {isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              Export
            </Button>
          )}

          {availableActions.includes('delete') && onDelete && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowDeleteDialog(true)}
              disabled={isPending}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
          )}
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedCount} item(s)?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the selected items.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reject Dialog with Reason */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject {selectedCount} item(s)</DialogTitle>
            <DialogDescription>
              Optionally provide a reason for rejection. This will be recorded in the system.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reject-reason">Reason (optional)</Label>
              <Textarea
                id="reject-reason"
                placeholder="Enter a reason for rejection..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleReject} disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Rejecting...
                </>
              ) : (
                'Reject'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
