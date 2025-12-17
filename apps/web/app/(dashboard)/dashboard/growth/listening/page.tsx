import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import Link from 'next/link';
import {
  Ear,
  Plus,
  MessageSquare,
  Twitter,
  Globe,
  Linkedin,
  CheckCircle,
  Clock,
  X,
  Eye,
  Settings,
  TrendingUp,
  ArrowRight,
} from 'lucide-react';

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

const statusIcons: Record<string, typeof CheckCircle> = {
  new: Clock,
  reviewed: Eye,
  replied: CheckCircle,
  dismissed: X,
};

export default async function SocialListeningPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: membership } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', user!.id)
    .limit(1)
    .single();

  if (!membership) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <h1 className="mb-2 text-2xl font-bold">No Organization Found</h1>
        <p className="text-muted-foreground">Please create an organization first.</p>
      </div>
    );
  }

  // Fetch listening configs
  const { data: configs } = await supabase
    .from('social_listening_configs')
    .select('*')
    .eq('organization_id', membership.organization_id)
    .eq('active', true);

  // Fetch recent conversations
  const { data: conversations } = await supabase
    .from('social_conversations')
    .select(`
      *,
      social_listening_configs (name)
    `)
    .in('config_id', configs?.map(c => c.id) || [])
    .order('discovered_at', { ascending: false })
    .limit(50);

  // Calculate stats
  const newCount = conversations?.filter(c => c.status === 'new').length || 0;
  const highIntentCount = conversations?.filter(c => c.intent_level === 'high').length || 0;
  const repliedCount = conversations?.filter(c => c.status === 'replied').length || 0;
  const todayConversations = conversations?.filter(c => {
    const discovered = new Date(c.discovered_at);
    const today = new Date();
    return discovered.toDateString() === today.toDateString();
  }).length || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Social Listening</h1>
          <p className="text-muted-foreground">
            Monitor conversations and engage with potential customers
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link href="/dashboard/growth/listening/configs">
              <Settings className="mr-2 h-4 w-4" />
              Manage Configs
            </Link>
          </Button>
          <Button asChild>
            <Link href="/dashboard/growth/listening/configs/new">
              <Plus className="mr-2 h-4 w-4" />
              New Config
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">New Today</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{todayConversations}</div>
            <p className="text-xs text-muted-foreground">conversations discovered</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Awaiting Review</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{newCount}</div>
            <p className="text-xs text-muted-foreground">need your attention</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">High Intent</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{highIntentCount}</div>
            <p className="text-xs text-muted-foreground">hot opportunities</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Replied</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{repliedCount}</div>
            <p className="text-xs text-muted-foreground">conversations engaged</p>
          </CardContent>
        </Card>
      </div>

      {/* Conversations */}
      <Tabs defaultValue="all" className="space-y-4">
        <TabsList>
          <TabsTrigger value="all">All ({conversations?.length || 0})</TabsTrigger>
          <TabsTrigger value="new">New ({newCount})</TabsTrigger>
          <TabsTrigger value="high">High Intent ({highIntentCount})</TabsTrigger>
          <TabsTrigger value="replied">Replied ({repliedCount})</TabsTrigger>
        </TabsList>

        <TabsContent value="all">
          <ConversationsList conversations={conversations || []} />
        </TabsContent>
        <TabsContent value="new">
          <ConversationsList conversations={(conversations || []).filter(c => c.status === 'new')} />
        </TabsContent>
        <TabsContent value="high">
          <ConversationsList conversations={(conversations || []).filter(c => c.intent_level === 'high')} />
        </TabsContent>
        <TabsContent value="replied">
          <ConversationsList conversations={(conversations || []).filter(c => c.status === 'replied')} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ConversationsList({ conversations }: { conversations: any[] }) {
  if (conversations.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Ear className="mb-4 h-12 w-12 text-muted-foreground" />
          <h3 className="mb-2 text-lg font-medium">No conversations yet</h3>
          <p className="mb-4 text-sm text-muted-foreground">
            Configure social listening to start discovering opportunities
          </p>
          <Button asChild>
            <Link href="/dashboard/growth/listening/configs/new">
              <Plus className="mr-2 h-4 w-4" />
              Create Listening Config
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Conversations</CardTitle>
        <CardDescription>
          Review and respond to discovered opportunities
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Platform</TableHead>
              <TableHead className="w-[400px]">Content</TableHead>
              <TableHead>Intent</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Discovered</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {conversations.map((conversation) => {
              const Icon = platformIcons[conversation.platform] || Globe;
              const StatusIcon = statusIcons[conversation.status] || Clock;

              return (
                <TableRow key={conversation.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <span className="capitalize">{conversation.platform}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="max-w-[400px]">
                      <p className="truncate text-sm">{conversation.content}</p>
                      <p className="text-xs text-muted-foreground">@{conversation.author_username}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={intentColors[conversation.intent_level] || intentColors.low}>
                      {conversation.intent_level || 'Unknown'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">
                      {conversation.opportunity_type?.replace('_', ' ') || 'General'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <StatusIcon className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="capitalize text-sm">{conversation.status}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(conversation.discovered_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/dashboard/growth/listening/conversation/${conversation.id}`}>
                        View
                        <ArrowRight className="ml-1 h-3 w-3" />
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
