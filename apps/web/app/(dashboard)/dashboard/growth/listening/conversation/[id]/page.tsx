import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ArrowLeft,
  Twitter,
  Globe,
  Linkedin,
  ExternalLink,
  User,
  Clock,
  Target,
  MessageSquare,
  Sparkles,
} from 'lucide-react';
import { ReplyComposer } from './reply-composer';
import { ConversationActions } from './conversation-actions';

const platformIcons: Record<string, typeof Twitter> = {
  twitter: Twitter,
  reddit: Globe,
  linkedin: Linkedin,
};

const intentColors: Record<string, string> = {
  high: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  low: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
};

export default async function ConversationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Fetch conversation with config and replies
  const { data: conversation, error } = await supabase
    .from('social_conversations')
    .select(`
      *,
      social_listening_configs (name, response_template),
      social_replies (*)
    `)
    .eq('id', id)
    .single();

  if (error || !conversation) {
    notFound();
  }

  // Verify user has access to this conversation
  const { data: membership } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', user!.id)
    .limit(1)
    .single();

  const { data: config } = await supabase
    .from('social_listening_configs')
    .select('organization_id')
    .eq('id', conversation.config_id)
    .single();

  if (!membership || !config || membership.organization_id !== config.organization_id) {
    notFound();
  }

  const Icon = platformIcons[conversation.platform] || Globe;
  const aiAnalysis = conversation.ai_analysis || {};
  const replies = conversation.social_replies || [];
  const latestReply = replies.sort(
    (a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )[0];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/growth/listening">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Conversations
          </Link>
        </Button>
      </div>

      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-1">
              <Icon className="h-4 w-4" />
              <span className="capitalize font-medium">{conversation.platform}</span>
            </div>
            <Badge className={intentColors[conversation.intent_level] || intentColors.low}>
              {conversation.intent_level || 'Unknown'} Intent
            </Badge>
            <Badge variant="outline" className="capitalize">
              {conversation.status}
            </Badge>
          </div>
          <h1 className="text-2xl font-bold">
            Conversation from @{conversation.author_username}
          </h1>
          <p className="text-muted-foreground">
            Found by: {conversation.social_listening_configs?.name}
          </p>
        </div>
        <ConversationActions
          conversationId={conversation.id}
          status={conversation.status}
          contentUrl={conversation.content_url}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Original Content */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  Original Content
                </CardTitle>
                {conversation.content_url && (
                  <Button variant="outline" size="sm" asChild>
                    <a
                      href={conversation.content_url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      View Original
                      <ExternalLink className="ml-2 h-3 w-3" />
                    </a>
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {conversation.parent_content && (
                <div className="rounded-lg bg-muted p-4 text-sm">
                  <p className="mb-2 text-xs font-medium text-muted-foreground">
                    In reply to:
                  </p>
                  <p className="text-muted-foreground">{conversation.parent_content}</p>
                </div>
              )}
              <p className="whitespace-pre-wrap">{conversation.content}</p>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <User className="h-4 w-4" />
                  <a
                    href={conversation.author_profile_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:underline"
                  >
                    @{conversation.author_username}
                  </a>
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  {new Date(conversation.discovered_at).toLocaleString()}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* AI Analysis */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                AI Analysis
              </CardTitle>
              <CardDescription>
                Automated analysis of this conversation
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1">
                  <p className="text-sm font-medium">Intent Score</p>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-full rounded-full bg-muted">
                      <div
                        className="h-2 rounded-full bg-green-500"
                        style={{ width: `${conversation.intent_score || 0}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium">{conversation.intent_score || 0}%</span>
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium">Relevance Score</p>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-full rounded-full bg-muted">
                      <div
                        className="h-2 rounded-full bg-blue-500"
                        style={{ width: `${conversation.relevance_score || 0}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium">{conversation.relevance_score || 0}%</span>
                  </div>
                </div>
              </div>

              {aiAnalysis.reasoning && (
                <div>
                  <p className="text-sm font-medium mb-1">Why this is an opportunity</p>
                  <p className="text-sm text-muted-foreground">{aiAnalysis.reasoning}</p>
                </div>
              )}

              {conversation.opportunity_type && (
                <div>
                  <p className="text-sm font-medium mb-1">Opportunity Type</p>
                  <Badge variant="outline" className="capitalize">
                    <Target className="mr-1 h-3 w-3" />
                    {conversation.opportunity_type.replace('_', ' ')}
                  </Badge>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Reply Composer */}
          <ReplyComposer
            conversationId={conversation.id}
            suggestedResponse={conversation.suggested_response}
            responseTemplate={conversation.social_listening_configs?.response_template}
            existingReply={latestReply}
          />
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick Stats */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Conversation Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Platform</span>
                <span className="font-medium capitalize">{conversation.platform}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Intent Level</span>
                <span className="font-medium capitalize">{conversation.intent_level || 'Unknown'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status</span>
                <span className="font-medium capitalize">{conversation.status}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Discovered</span>
                <span className="font-medium">
                  {new Date(conversation.discovered_at).toLocaleDateString()}
                </span>
              </div>
              {conversation.reviewed_at && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Reviewed</span>
                  <span className="font-medium">
                    {new Date(conversation.reviewed_at).toLocaleDateString()}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Reply History */}
          {replies.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Reply History</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {replies.map((reply: any) => (
                  <div
                    key={reply.id}
                    className="rounded-lg border p-3 text-sm"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <Badge
                        variant={reply.status === 'sent' ? 'default' : 'secondary'}
                        className="capitalize"
                      >
                        {reply.status}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(reply.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-muted-foreground line-clamp-3">
                      {reply.content}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
