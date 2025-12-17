'use client';

import { useState } from 'react';
import { AlertTriangle, Loader2, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

interface EmergencyStopButtonProps {
  organizationId: string;
  onStopComplete?: () => void;
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
}

interface EmergencyStopResult {
  success: boolean;
  summary?: {
    campaignsPaused: number;
    tasksCancelled: number;
    sandboxModeEnabled: boolean;
  };
  error?: string;
}

export function EmergencyStopButton({
  organizationId,
  onStopComplete,
  variant = 'destructive',
  size = 'default',
  className,
}: EmergencyStopButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const { toast } = useToast();

  const handleEmergencyStop = async () => {
    if (confirmText !== 'STOP') {
      toast({
        title: 'Confirmation required',
        description: 'Please type STOP to confirm',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/emergency/stop', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          organizationId,
        }),
      });

      const result: EmergencyStopResult = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Emergency stop failed');
      }

      toast({
        title: 'Emergency Stop Activated',
        description: `Successfully paused ${result.summary?.campaignsPaused || 0} campaigns and cancelled ${result.summary?.tasksCancelled || 0} tasks. Sandbox mode enabled.`,
      });

      setIsOpen(false);
      setConfirmText('');
      onStopComplete?.();
    } catch (error) {
      console.error('Emergency stop error:', error);
      toast({
        title: 'Emergency Stop Failed',
        description: error instanceof Error ? error.message : 'An unknown error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setIsOpen(false);
    setConfirmText('');
  };

  return (
    <>
      <Button
        variant={variant}
        size={size}
        className={className}
        onClick={() => setIsOpen(true)}
      >
        <ShieldAlert className="mr-2 h-4 w-4" />
        Emergency Stop
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Emergency Stop
            </DialogTitle>
            <DialogDescription className="space-y-4 pt-4">
              <div className="rounded-md bg-destructive/10 p-4 text-sm">
                <p className="font-semibold text-destructive">Warning: This action will:</p>
                <ul className="mt-2 space-y-1 text-destructive/90">
                  <li>• Pause all active campaigns immediately</li>
                  <li>• Cancel all pending and executing tasks</li>
                  <li>• Enable sandbox mode (prevents new executions)</li>
                  <li>• Log this action in the audit trail</li>
                </ul>
              </div>

              <p className="text-sm">
                Use this in emergency situations only, such as detecting incorrect content,
                policy violations, or unexpected behavior.
              </p>

              <div className="space-y-2">
                <label htmlFor="confirm-text" className="text-sm font-medium">
                  Type <span className="font-mono font-bold">STOP</span> to confirm:
                </label>
                <input
                  id="confirm-text"
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="Type STOP"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={isLoading}
                  autoComplete="off"
                />
              </div>
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button variant="outline" onClick={handleCancel} disabled={isLoading}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleEmergencyStop}
              disabled={isLoading || confirmText !== 'STOP'}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Stopping...
                </>
              ) : (
                <>
                  <ShieldAlert className="mr-2 h-4 w-4" />
                  Execute Emergency Stop
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
