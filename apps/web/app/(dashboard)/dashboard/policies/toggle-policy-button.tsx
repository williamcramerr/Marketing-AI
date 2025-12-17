'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { togglePolicyActive } from '@/lib/actions/policies';
import { Power, PowerOff } from 'lucide-react';

interface TogglePolicyButtonProps {
  policyId: string;
  currentActive: boolean;
}

export function TogglePolicyButton({ policyId, currentActive }: TogglePolicyButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleToggle = async () => {
    setLoading(true);
    try {
      await togglePolicyActive(policyId, !currentActive);
    } catch (error) {
      console.error('Error toggling policy:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleToggle}
      disabled={loading}
      title={currentActive ? 'Disable policy' : 'Enable policy'}
    >
      {currentActive ? (
        <PowerOff className="h-4 w-4 text-muted-foreground" />
      ) : (
        <Power className="h-4 w-4 text-green-600" />
      )}
    </Button>
  );
}
