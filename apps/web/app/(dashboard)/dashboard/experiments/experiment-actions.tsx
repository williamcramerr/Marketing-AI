'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MoreVertical, Play, Pause, Trophy } from 'lucide-react';
import {
  startExperiment,
  pauseExperiment,
  completeExperiment,
  type ExperimentStatus,
  type ExperimentVariant,
} from '@/lib/actions/experiments';
import { toast } from '@/hooks/use-toast';

interface ExperimentActionsProps {
  experimentId: string;
  status: ExperimentStatus;
  variants: ExperimentVariant[];
}

export function ExperimentActions({ experimentId, status, variants }: ExperimentActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false);
  const [selectedWinner, setSelectedWinner] = useState<string>('');

  async function handleStart() {
    setLoading(true);
    try {
      const result = await startExperiment(experimentId);
      if (result.success) {
        toast({
          title: 'Experiment Started',
          description: 'The experiment is now running.',
        });
        router.refresh();
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Failed to start experiment',
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

  async function handlePause() {
    setLoading(true);
    try {
      const result = await pauseExperiment(experimentId);
      if (result.success) {
        toast({
          title: 'Experiment Paused',
          description: 'The experiment has been paused.',
        });
        router.refresh();
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Failed to pause experiment',
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

  async function handleComplete() {
    if (!selectedWinner) {
      toast({
        title: 'Select a Winner',
        description: 'Please select a winning variant.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const result = await completeExperiment(experimentId, selectedWinner);
      if (result.success) {
        toast({
          title: 'Experiment Completed',
          description: 'A winner has been declared.',
        });
        setCompleteDialogOpen(false);
        router.refresh();
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Failed to complete experiment',
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

  if (status === 'completed' || status === 'cancelled') {
    return null;
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8" disabled={loading}>
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {(status === 'draft' || status === 'paused') && (
            <DropdownMenuItem onClick={handleStart}>
              <Play className="mr-2 h-4 w-4" />
              Start Experiment
            </DropdownMenuItem>
          )}
          {status === 'running' && (
            <>
              <DropdownMenuItem onClick={handlePause}>
                <Pause className="mr-2 h-4 w-4" />
                Pause Experiment
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}
          {(status === 'running' || status === 'paused') && (
            <DropdownMenuItem onClick={() => setCompleteDialogOpen(true)}>
              <Trophy className="mr-2 h-4 w-4" />
              Complete & Declare Winner
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={completeDialogOpen} onOpenChange={setCompleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Complete Experiment</DialogTitle>
            <DialogDescription>
              Select the winning variant to complete this experiment. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Winning Variant</Label>
              <Select value={selectedWinner} onValueChange={setSelectedWinner}>
                <SelectTrigger>
                  <SelectValue placeholder="Select winner" />
                </SelectTrigger>
                <SelectContent>
                  {variants.map((variant) => (
                    <SelectItem key={variant.id} value={variant.id}>
                      {variant.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCompleteDialogOpen(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button onClick={handleComplete} disabled={loading || !selectedWinner}>
              {loading ? 'Completing...' : 'Declare Winner'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
