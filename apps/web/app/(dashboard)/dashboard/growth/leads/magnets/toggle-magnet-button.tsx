'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Pause, Play, Loader2 } from 'lucide-react';
import { updateLeadMagnet } from '@/lib/actions/lead-magnets';

interface ToggleMagnetButtonProps {
  magnetId: string;
  active: boolean;
}

export function ToggleMagnetButton({ magnetId, active }: ToggleMagnetButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleToggle = async () => {
    setLoading(true);
    try {
      await updateLeadMagnet(magnetId, { active: !active });
    } catch (error) {
      console.error('Failed to toggle magnet:', error);
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
      title={active ? 'Deactivate' : 'Activate'}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : active ? (
        <Pause className="h-4 w-4" />
      ) : (
        <Play className="h-4 w-4" />
      )}
    </Button>
  );
}
