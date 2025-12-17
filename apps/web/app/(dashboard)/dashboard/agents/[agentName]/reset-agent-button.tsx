'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { RotateCcw } from 'lucide-react';
import { resetAgentState } from '@/lib/actions/agent';
import type { AgentType } from '@/lib/agent/types';
import { toast } from '@/hooks/use-toast';

interface ResetAgentButtonProps {
  agentName: AgentType;
}

export function ResetAgentButton({ agentName }: ResetAgentButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleReset() {
    setLoading(true);
    try {
      const result = await resetAgentState(agentName);
      if (result.success) {
        toast({
          title: 'Agent Reset',
          description: 'The agent has been reset to its initial state.',
        });
        setOpen(false);
        router.refresh();
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Failed to reset agent',
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
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <RotateCcw className="mr-2 h-4 w-4" />
          Reset Agent
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reset Agent State</DialogTitle>
          <DialogDescription>
            This will reset all learned preferences, patterns, and performance history for this
            agent. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleReset} disabled={loading}>
            {loading ? 'Resetting...' : 'Reset Agent'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
