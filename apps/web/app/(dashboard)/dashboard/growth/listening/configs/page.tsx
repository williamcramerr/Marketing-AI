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
import Link from 'next/link';
import {
  Plus,
  Settings,
  Twitter,
  Globe,
  Linkedin,
  Edit,
  ArrowLeft,
  Zap,
} from 'lucide-react';
import { ToggleConfigButton } from './toggle-config-button';
import { DeleteConfigButton } from './delete-config-button';

const platformIcons: Record<string, typeof Twitter> = {
  twitter: Twitter,
  reddit: Globe,
  linkedin: Linkedin,
};

export default async function ListeningConfigsPage() {
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

  // Fetch all configs with stats
  const { data: configs } = await supabase
    .from('social_listening_configs')
    .select('*')
    .eq('organization_id', membership.organization_id)
    .order('created_at', { ascending: false });

  // Get conversation counts for each config
  const configsWithStats = await Promise.all(
    (configs || []).map(async (config) => {
      const { count } = await supabase
        .from('social_conversations')
        .select('*', { count: 'exact', head: true })
        .eq('config_id', config.id);

      return { ...config, conversationCount: count || 0 };
    })
  );

  const activeConfigs = configs?.filter(c => c.active).length || 0;
  const totalConfigs = configs?.length || 0;
  const autoRespondConfigs = configs?.filter(c => c.auto_respond).length || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/growth/listening">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Listening
          </Link>
        </Button>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Listening Configurations</h1>
          <p className="text-muted-foreground">
            Manage your keyword monitoring and platform settings
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/growth/listening/configs/new">
            <Plus className="mr-2 h-4 w-4" />
            New Config
          </Link>
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Configs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalConfigs}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{activeConfigs}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Auto-Respond Enabled
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{autoRespondConfigs}</div>
          </CardContent>
        </Card>
      </div>

      {/* Configs List */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            <div>
              <CardTitle>All Configurations</CardTitle>
              <CardDescription>
                Each config monitors specific keywords across platforms
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {configsWithStats.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Platforms</TableHead>
                  <TableHead>Keywords</TableHead>
                  <TableHead>Intent</TableHead>
                  <TableHead>Auto-Respond</TableHead>
                  <TableHead>Conversations</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {configsWithStats.map((config) => (
                  <TableRow key={config.id}>
                    <TableCell className="font-medium">{config.name}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {config.platforms?.map((platform: string) => {
                          const Icon = platformIcons[platform] || Globe;
                          return (
                            <div
                              key={platform}
                              className="flex h-6 w-6 items-center justify-center rounded bg-muted"
                              title={platform}
                            >
                              <Icon className="h-3.5 w-3.5" />
                            </div>
                          );
                        })}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {config.keywords?.slice(0, 3).map((keyword: string) => (
                          <Badge key={keyword} variant="outline" className="text-xs">
                            {keyword}
                          </Badge>
                        ))}
                        {config.keywords?.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{config.keywords.length - 3}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="capitalize">
                        {config.intent_threshold || 'medium'}+
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {config.auto_respond ? (
                        <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                          <Zap className="mr-1 h-3 w-3" />
                          On
                        </Badge>
                      ) : (
                        <span className="text-sm text-muted-foreground">Off</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">{config.conversationCount}</span>
                    </TableCell>
                    <TableCell>
                      {config.active ? (
                        <Badge className="bg-green-100 text-green-800">Active</Badge>
                      ) : (
                        <Badge variant="secondary">Paused</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <ToggleConfigButton configId={config.id} active={config.active} />
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/dashboard/growth/listening/configs/${config.id}`}>
                            <Edit className="h-4 w-4" />
                          </Link>
                        </Button>
                        <DeleteConfigButton configId={config.id} name={config.name} />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex h-32 flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
              <Settings className="h-8 w-8 opacity-50" />
              <p>No listening configurations yet</p>
              <Button asChild size="sm">
                <Link href="/dashboard/growth/listening/configs/new">
                  <Plus className="mr-2 h-4 w-4" />
                  Create Your First Config
                </Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
