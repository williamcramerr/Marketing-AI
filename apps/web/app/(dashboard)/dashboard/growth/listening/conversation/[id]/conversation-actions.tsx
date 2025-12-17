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
import { MoreHorizontal, Eye, X, ExternalLink, Loader2 } from 'lucide-react';
import { reviewConversation, dismissConversation } from '@/lib/actions/social-listening';

interface ConversationActionsProps {
  conversationId: string;
  status: string;
  contentUrl?: string;
}

export function ConversationActions({
  conversationId,
  status,
  contentUrl,
}: ConversationActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleMarkReviewed = async () => {
    setLoading(true);
    try {
      await reviewConversation(conversationId);
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = async () => {
    setLoading(true);
    try {
      await dismissConversation(conversationId);
      router.push('/dashboard/growth/listening');
    } finally {
      setLoading(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" disabled={loading}>
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              Actions
              <MoreHorizontal className="ml-2 h-4 w-4" />
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {contentUrl && (
          <>
            <DropdownMenuItem asChild>
              <a href={contentUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" />
                View on {status === 'twitter' ? 'Twitter' : 'Platform'}
              </a>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        {status === 'new' && (
          <DropdownMenuItem onClick={handleMarkReviewed}>
            <Eye className="mr-2 h-4 w-4" />
            Mark as Reviewed
          </DropdownMenuItem>
        )}
        {status !== 'dismissed' && (
          <DropdownMenuItem onClick={handleDismiss} className="text-destructive">
            <X className="mr-2 h-4 w-4" />
            Dismiss
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
