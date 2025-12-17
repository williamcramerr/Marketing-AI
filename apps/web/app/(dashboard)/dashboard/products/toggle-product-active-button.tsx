'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Power, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toggleProductActive } from '@/lib/actions/products';
import { useToast } from '@/hooks/use-toast';

interface ToggleProductActiveButtonProps {
  productId: string;
  currentActive: boolean;
}

export function ToggleProductActiveButton({
  productId,
  currentActive,
}: ToggleProductActiveButtonProps) {
  const [isToggling, setIsToggling] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  async function handleToggle() {
    setIsToggling(true);
    const result = await toggleProductActive(productId, !currentActive);

    if (result.success) {
      toast({
        title: 'Product updated',
        description: `Product is now ${!currentActive ? 'active' : 'inactive'}.`,
      });
      router.refresh();
    } else {
      toast({
        title: 'Error',
        description: result.error || 'Failed to update product',
        variant: 'destructive',
      });
    }

    setIsToggling(false);
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleToggle}
      disabled={isToggling}
      title={currentActive ? 'Deactivate product' : 'Activate product'}
    >
      {isToggling ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Power className={`h-4 w-4 ${currentActive ? 'text-green-600' : 'text-gray-400'}`} />
      )}
    </Button>
  );
}
