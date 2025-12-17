'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Pause, Play, Loader2 } from 'lucide-react';
import { toggleListeningConfig } from '@/lib/actions/social-listening';

interface ToggleConfigButtonProps {
  configId: string;
  active: boolean;
}

export function ToggleConfigButton({ configId, active }: ToggleConfigButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleToggle = async () => {
    setLoading(true);
    try {
      await toggleListeningConfig(configId, !active);
    } catch (error) {
      console.error('Failed to toggle config:', error);
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
      title={active ? 'Pause monitoring' : 'Resume monitoring'}
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
