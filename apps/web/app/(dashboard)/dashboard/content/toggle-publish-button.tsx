'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Eye, EyeOff } from 'lucide-react';
import { togglePublishAsset } from '@/lib/actions/content-assets';
import { toast } from '@/hooks/use-toast';

interface TogglePublishButtonProps {
  assetId: string;
  published: boolean;
}

export function TogglePublishButton({ assetId, published }: TogglePublishButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleToggle() {
    setLoading(true);
    try {
      const result = await togglePublishAsset(assetId, !published);
      if (result.success) {
        toast({
          title: published ? 'Unpublished' : 'Published',
          description: published
            ? 'Content has been unpublished.'
            : 'Content has been published.',
        });
        router.refresh();
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Failed to update publish state',
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
    <Button
      variant="ghost"
      size="icon"
      className="h-8 w-8"
      onClick={handleToggle}
      disabled={loading}
      title={published ? 'Unpublish' : 'Publish'}
    >
      {published ? (
        <EyeOff className="h-4 w-4" />
      ) : (
        <Eye className="h-4 w-4" />
      )}
    </Button>
  );
}
