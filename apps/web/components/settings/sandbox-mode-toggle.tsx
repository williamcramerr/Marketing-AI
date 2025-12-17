'use client';

import { useState } from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { toggleSandboxMode } from '@/lib/actions/settings';

interface SandboxModeToggleProps {
  defaultEnabled: boolean;
}

export function SandboxModeToggle({ defaultEnabled }: SandboxModeToggleProps) {
  const [enabled, setEnabled] = useState(defaultEnabled);
  const [isLoading, setIsLoading] = useState(false);

  async function handleToggle(checked: boolean) {
    setIsLoading(true);
    try {
      const result = await toggleSandboxMode(checked);

      if (result.success) {
        setEnabled(checked);
        toast({
          title: checked ? 'Sandbox mode enabled' : 'Sandbox mode disabled',
          description: checked
            ? 'All external actions will be blocked'
            : 'External actions are now allowed',
        });
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Failed to update sandbox mode',
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
      setIsLoading(false);
    }
  }

  return (
    <div className="flex items-center justify-between rounded-lg border p-4">
      <div className="space-y-0.5">
        <Label htmlFor="sandbox-mode">Sandbox Mode</Label>
        <p className="text-sm text-muted-foreground">
          Prevent all external actions (emails, API calls, etc.)
        </p>
      </div>
      <Switch
        id="sandbox-mode"
        checked={enabled}
        onCheckedChange={handleToggle}
        disabled={isLoading}
      />
    </div>
  );
}
