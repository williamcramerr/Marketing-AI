'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import {
  pauseAllCampaigns,
  cancelAllPendingTasks,
  enableGlobalSandbox,
  requireAllApprovals,
} from '@/lib/actions/settings';

interface EmergencyAction {
  id: string;
  title: string;
  description: string;
  buttonText: string;
  confirmTitle: string;
  confirmDescription: string;
  action: () => Promise<{ success: boolean; error?: string; message?: string }>;
}

export function EmergencyControls() {
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  const emergencyActions: EmergencyAction[] = [
    {
      id: 'pause-campaigns',
      title: 'Pause All Campaigns',
      description:
        'Immediately pause all active campaigns and prevent new tasks from being queued',
      buttonText: 'Pause All',
      confirmTitle: 'Pause all campaigns?',
      confirmDescription:
        'This will immediately pause all active campaigns across your organization. You can resume them individually later.',
      action: pauseAllCampaigns,
    },
    {
      id: 'cancel-tasks',
      title: 'Cancel Pending Tasks',
      description: 'Cancel all tasks that are queued or in progress but not yet executed',
      buttonText: 'Cancel Tasks',
      confirmTitle: 'Cancel all pending tasks?',
      confirmDescription:
        'This will cancel all tasks that are queued, executing, or pending approval. This action cannot be undone.',
      action: cancelAllPendingTasks,
    },
    {
      id: 'enable-sandbox',
      title: 'Enable Global Sandbox Mode',
      description: 'Prevent all external actions across the entire organization',
      buttonText: 'Enable Sandbox',
      confirmTitle: 'Enable global sandbox mode?',
      confirmDescription:
        'This will prevent all external actions (emails, API calls, social posts) across the entire organization. You can disable it later from settings.',
      action: enableGlobalSandbox,
    },
    {
      id: 'require-approvals',
      title: 'Require Approval for All Actions',
      description: 'Force human approval for every task before execution',
      buttonText: 'Require All Approvals',
      confirmTitle: 'Require approval for all actions?',
      confirmDescription:
        'This will update all connectors to require human approval before any action is taken. You can configure individual connectors later.',
      action: requireAllApprovals,
    },
  ];

  async function handleAction(action: EmergencyAction) {
    setLoadingAction(action.id);
    try {
      const result = await action.action();

      if (result.success) {
        toast({
          title: 'Success',
          description: result.message || `${action.title} completed`,
        });
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Action failed',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'An unexpected error occurred',
        variant: 'destructive',
      });
    } finally {
      setLoadingAction(null);
    }
  }

  return (
    <Card className="border-red-200 bg-red-50/50">
      <CardHeader>
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-red-600" />
          <CardTitle className="text-red-900">Emergency Controls</CardTitle>
        </div>
        <CardDescription>Use these controls to immediately stop all AI activity</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {emergencyActions.map((action) => (
          <div key={action.id} className="rounded-lg border border-red-200 bg-white p-4">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <h4 className="font-medium text-red-900">{action.title}</h4>
                <p className="text-sm text-muted-foreground">{action.description}</p>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" disabled={loadingAction === action.id}>
                    {loadingAction === action.id ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      action.buttonText
                    )}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{action.confirmTitle}</AlertDialogTitle>
                    <AlertDialogDescription>{action.confirmDescription}</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-red-600 hover:bg-red-700"
                      onClick={() => handleAction(action)}
                    >
                      Confirm
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
