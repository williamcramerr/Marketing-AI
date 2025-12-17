'use client';

import { Button } from '@/components/ui/button';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { approveTask, rejectTask } from '@/lib/actions/tasks';
import { useTransition, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

interface ApprovalActionsProps {
  approvalId: string;
  taskId: string;
}

export function ApprovalActions({ approvalId, taskId }: ApprovalActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectNotes, setRejectNotes] = useState('');

  const handleApprove = () => {
    startTransition(async () => {
      const result = await approveTask(approvalId, taskId);
      if (result.success) {
        router.refresh();
      } else {
        alert(result.error || 'Failed to approve task');
      }
    });
  };

  const handleReject = () => {
    startTransition(async () => {
      const result = await rejectTask(approvalId, taskId, rejectNotes);
      if (result.success) {
        setShowRejectDialog(false);
        setRejectNotes('');
        router.refresh();
      } else {
        alert(result.error || 'Failed to reject task');
      }
    });
  };

  return (
    <>
      <Button
        onClick={handleApprove}
        disabled={isPending}
        variant="default"
        className="bg-green-600 hover:bg-green-700"
      >
        {isPending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Processing...
          </>
        ) : (
          <>
            <CheckCircle2 className="mr-2 h-4 w-4" />
            Approve
          </>
        )}
      </Button>

      <Button
        onClick={() => setShowRejectDialog(true)}
        disabled={isPending}
        variant="destructive"
      >
        <XCircle className="mr-2 h-4 w-4" />
        Reject
      </Button>

      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Task</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting this task. This will help improve future AI-generated content.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="reject-notes">Rejection Notes (Optional)</Label>
              <Input
                id="reject-notes"
                placeholder="e.g., Tone is too formal, missing key messaging points..."
                value={rejectNotes}
                onChange={(e) => setRejectNotes(e.target.value)}
                disabled={isPending}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowRejectDialog(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={isPending}
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Rejecting...
                </>
              ) : (
                'Confirm Rejection'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
