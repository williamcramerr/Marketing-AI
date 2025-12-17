'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Power, Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { toggleConnector } from '@/lib/actions/connectors';

interface ToggleConnectorButtonProps {
  connectorId: string;
  active: boolean;
}

export function ToggleConnectorButton({ connectorId, active }: ToggleConnectorButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  async function handleToggle() {
    setIsLoading(true);
    try {
      const result = await toggleConnector(connectorId, !active);

      if (result.success) {
        toast({
          title: active ? 'Connector deactivated' : 'Connector activated',
          description: active
            ? 'The connector is now inactive'
            : 'The connector is now active',
        });
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Failed to toggle connector',
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
    <Button
      variant="ghost"
      size="sm"
      onClick={handleToggle}
      disabled={isLoading}
      title={active ? 'Deactivate connector' : 'Activate connector'}
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Power className={`h-4 w-4 ${active ? 'text-green-600' : 'text-muted-foreground'}`} />
      )}
    </Button>
  );
}
