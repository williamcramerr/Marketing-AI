'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Loader2, Send, Sparkles, RotateCcw, CheckCircle } from 'lucide-react';
import { createReply, approveReply, regenerateResponse } from '@/lib/actions/social-listening';

interface ReplyComposerProps {
  conversationId: string;
  suggestedResponse?: string;
  responseTemplate?: string;
  existingReply?: {
    id: string;
    content: string;
    status: string;
    ai_generated: boolean;
  };
}

export function ReplyComposer({
  conversationId,
  suggestedResponse,
  responseTemplate,
  existingReply,
}: ReplyComposerProps) {
  const [content, setContent] = useState(existingReply?.content || suggestedResponse || '');
  const [loading, setLoading] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [status, setStatus] = useState<'idle' | 'saved' | 'approved' | 'error'>('idle');
  const [replyId, setReplyId] = useState<string | null>(existingReply?.id || null);

  const handleSaveDraft = async () => {
    setLoading(true);
    try {
      const result = await createReply({
        conversationId,
        content,
        status: 'draft',
      });

      if (result.success && result.data) {
        setReplyId(result.data.id);
        setStatus('saved');
        setTimeout(() => setStatus('idle'), 2000);
      }
    } catch (error) {
      setStatus('error');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!replyId) {
      // Save first if no reply exists
      const result = await createReply({
        conversationId,
        content,
        status: 'approved',
      });
      if (result.success) {
        setStatus('approved');
      }
      return;
    }

    setLoading(true);
    try {
      const result = await approveReply(replyId);
      if (result.success) {
        setStatus('approved');
      }
    } catch (error) {
      setStatus('error');
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerate = async () => {
    setRegenerating(true);
    try {
      const result = await regenerateResponse(conversationId);
      if (result.success && result.data?.suggestedResponse) {
        setContent(result.data.suggestedResponse);
      }
    } catch (error) {
      console.error('Failed to regenerate:', error);
    } finally {
      setRegenerating(false);
    }
  };

  const isApproved = existingReply?.status === 'approved' || existingReply?.status === 'sent';

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Send className="h-5 w-5" />
              Compose Reply
            </CardTitle>
            <CardDescription>
              Review and customize the AI-generated response
            </CardDescription>
          </div>
          {existingReply?.ai_generated && (
            <Badge variant="outline">
              <Sparkles className="mr-1 h-3 w-3" />
              AI Generated
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {responseTemplate && (
          <div className="rounded-lg bg-muted p-3 text-sm">
            <p className="font-medium mb-1">Response Guidelines:</p>
            <p className="text-muted-foreground">{responseTemplate}</p>
          </div>
        )}

        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Write your reply..."
          rows={6}
          disabled={isApproved}
          className={isApproved ? 'opacity-60' : ''}
        />

        {status === 'saved' && (
          <div className="flex items-center gap-2 text-sm text-green-600">
            <CheckCircle className="h-4 w-4" />
            Draft saved
          </div>
        )}

        {status === 'approved' && (
          <div className="flex items-center gap-2 text-sm text-green-600">
            <CheckCircle className="h-4 w-4" />
            Reply approved and queued for sending
          </div>
        )}

        {status === 'error' && (
          <div className="text-sm text-destructive">
            Something went wrong. Please try again.
          </div>
        )}

        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            onClick={handleRegenerate}
            disabled={regenerating || isApproved}
          >
            {regenerating ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RotateCcw className="mr-2 h-4 w-4" />
            )}
            Regenerate
          </Button>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleSaveDraft}
              disabled={loading || !content.trim() || isApproved}
            >
              Save Draft
            </Button>
            <Button
              onClick={handleApprove}
              disabled={loading || !content.trim() || isApproved}
            >
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle className="mr-2 h-4 w-4" />
              )}
              {isApproved ? 'Approved' : 'Approve & Send'}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
