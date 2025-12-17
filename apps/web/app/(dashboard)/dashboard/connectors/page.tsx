import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Plug, Plus, Mail, Twitter, Linkedin, Ghost, FileText, Target, Edit } from 'lucide-react';
import Link from 'next/link';
import { ToggleConnectorButton } from './toggle-connector-button';
import { DeleteConnectorButton } from './delete-connector-button';
import { TipCard } from '@/components/common/tip-card';

const connectorTypeIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  resend: Mail,
  twitter: Twitter,
  linkedin: Linkedin,
  ghost: Ghost,
  wordpress: FileText,
  google_ads: Target,
  meta_ads: Target,
};

const connectorTypeLabels: Record<string, string> = {
  resend: 'Resend Email',
  twitter: 'Twitter/X',
  linkedin: 'LinkedIn',
  ghost: 'Ghost CMS',
  wordpress: 'WordPress',
  google_ads: 'Google Ads',
  meta_ads: 'Meta Ads',
};

export default async function ConnectorsPage() {
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

  const { data: connectors } = await supabase
    .from('connectors')
    .select('*')
    .eq('organization_id', membership.organization_id)
    .order('created_at', { ascending: false });

  // Group connectors by type
  const connectorsByType = (connectors || []).reduce(
    (acc, connector) => {
      const type = connector.type;
      if (!acc[type]) acc[type] = [];
      acc[type].push(connector);
      return acc;
    },
    {} as Record<string, typeof connectors>
  );

  const activeConnectors = connectors?.filter((c) => c.active).length || 0;
  const totalConnectors = connectors?.length || 0;
  const requireApproval = connectors?.filter((c) => c.approval_required).length || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Connectors</h1>
          <p className="text-muted-foreground">
            Manage integrations with external services and platforms
          </p>
        </div>
        <Link href="/dashboard/connectors/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Add Connector
          </Button>
        </Link>
      </div>

      <TipCard
        id="connectors-intro"
        title="Connect Your Marketing Tools"
        description="Connect your email providers, social media accounts, and other marketing tools to automate your workflows and sync data automatically."
        variant="info"
      />

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Connectors
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalConnectors}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{activeConnectors}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Require Approval
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{requireApproval}</div>
          </CardContent>
        </Card>
      </div>

      {/* Connectors List */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Plug className="h-5 w-5" />
            <div>
              <CardTitle>All Connectors</CardTitle>
              <CardDescription>Configure integrations for publishing and distribution</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {connectors && connectors.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Approval</TableHead>
                  <TableHead>Rate Limits</TableHead>
                  <TableHead>Last Used</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {connectors.map((connector) => {
                  const Icon = connectorTypeIcons[connector.type] || Plug;
                  const typeLabel = connectorTypeLabels[connector.type] || connector.type;

                  return (
                    <TableRow key={connector.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4 text-muted-foreground" />
                          {connector.name}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{typeLabel}</Badge>
                      </TableCell>
                      <TableCell>
                        {connector.active ? (
                          <Badge className="bg-green-100 text-green-800">Active</Badge>
                        ) : (
                          <Badge variant="secondary">Inactive</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {connector.approval_required ? (
                          <Badge variant="outline">Required</Badge>
                        ) : (
                          <span className="text-sm text-muted-foreground">Not required</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {connector.rate_limit_per_hour
                          ? `${connector.rate_limit_per_hour}/hr`
                          : connector.rate_limit_per_day
                            ? `${connector.rate_limit_per_day}/day`
                            : 'None'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {connector.last_used_at
                          ? new Date(connector.last_used_at).toLocaleDateString()
                          : 'Never'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <ToggleConnectorButton
                            connectorId={connector.id}
                            active={connector.active}
                          />
                          <Link href={`/dashboard/connectors/${connector.id}`}>
                            <Button variant="ghost" size="sm">
                              <Edit className="h-4 w-4" />
                            </Button>
                          </Link>
                          <DeleteConnectorButton
                            connectorId={connector.id}
                            connectorName={connector.name}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="flex h-32 flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
              <Plug className="h-8 w-8 opacity-50" />
              <p>No connectors configured</p>
              <Link href="/dashboard/connectors/new">
                <Button variant="outline" size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Your First Connector
                </Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
