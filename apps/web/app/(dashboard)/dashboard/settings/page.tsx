import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Settings as SettingsIcon, Plug, Shield, Plus, Edit, Mic, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { SandboxModeToggle } from '@/components/settings/sandbox-mode-toggle';
import { EmergencyControls } from '@/components/settings/emergency-controls';

export default async function SettingsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Get user's organizations
  const { data: memberships } = await supabase
    .from('organization_members')
    .select('organization_id, role, organizations(id, name, slug, settings)')
    .eq('user_id', user!.id);

  const organization = memberships?.[0]?.organizations;
  const userRole = memberships?.[0]?.role;

  if (!organization) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <h1 className="mb-2 text-2xl font-bold">No Organization Found</h1>
        <p className="text-muted-foreground">Please create an organization first.</p>
      </div>
    );
  }

  // Get connectors for the organization
  const { data: connectors } = await supabase
    .from('connectors')
    .select('*')
    .eq('organization_id', organization.id)
    .order('created_at', { ascending: false });

  // Get policies for the organization
  const { data: policies } = await supabase
    .from('policies')
    .select('*')
    .eq('organization_id', organization.id)
    .order('created_at', { ascending: false });

  // Parse organization settings
  const orgSettings = (organization.settings as any) || {};
  const sandboxMode = orgSettings.sandbox_mode || false;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage your organization, connectors, and policies</p>
      </div>

      {/* Organization Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <SettingsIcon className="h-5 w-5" />
            <CardTitle>Organization Settings</CardTitle>
          </div>
          <CardDescription>Configure your organization preferences</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="org-name">Organization Name</Label>
              <Input id="org-name" defaultValue={organization.name} disabled />
              <p className="text-xs text-muted-foreground">
                Contact support to change your organization name
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="org-slug">Organization Slug</Label>
              <Input id="org-slug" defaultValue={organization.slug} disabled />
              <p className="text-xs text-muted-foreground">Used in URLs and API calls</p>
            </div>

            <SandboxModeToggle defaultEnabled={sandboxMode} />
          </div>
        </CardContent>
      </Card>

      {/* Connectors */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Plug className="h-5 w-5" />
              <div>
                <CardTitle>Connectors</CardTitle>
                <CardDescription>Manage your external service integrations</CardDescription>
              </div>
            </div>
            <Link href="/dashboard/connectors/new">
              <Button size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Add Connector
              </Button>
            </Link>
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
                  <TableHead>Approval Required</TableHead>
                  <TableHead>Rate Limits</TableHead>
                  <TableHead>Last Used</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {connectors.map((connector) => (
                  <TableRow key={connector.id}>
                    <TableCell className="font-medium">{connector.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{connector.type}</Badge>
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
                        <Link href={`/dashboard/connectors/${connector.id}`}>
                          <Button variant="ghost" size="sm">
                            <Edit className="h-4 w-4" />
                          </Button>
                        </Link>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
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

      {/* Policies */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              <div>
                <CardTitle>Guardrail Policies</CardTitle>
                <CardDescription>
                  Define rules to control AI behavior and prevent mistakes
                </CardDescription>
              </div>
            </div>
            <Link href="/dashboard/policies/new">
              <Button size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Add Policy
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {policies && policies.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {policies.map((policy) => (
                  <TableRow key={policy.id}>
                    <TableCell className="font-medium">{policy.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{policy.type.replace('_', ' ')}</Badge>
                    </TableCell>
                    <TableCell>
                      {policy.severity === 'block' ? (
                        <Badge variant="destructive">Block</Badge>
                      ) : policy.severity === 'escalate' ? (
                        <Badge className="bg-orange-100 text-orange-800">Escalate</Badge>
                      ) : (
                        <Badge className="bg-yellow-100 text-yellow-800">Warn</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {policy.active ? (
                        <Badge className="bg-green-100 text-green-800">Active</Badge>
                      ) : (
                        <Badge variant="secondary">Inactive</Badge>
                      )}
                    </TableCell>
                    <TableCell className="max-w-md truncate text-sm text-muted-foreground">
                      {policy.description || 'No description'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Link href={`/dashboard/policies/${policy.id}`}>
                          <Button variant="ghost" size="sm">
                            <Edit className="h-4 w-4" />
                          </Button>
                        </Link>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex h-32 flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
              <Shield className="h-8 w-8 opacity-50" />
              <p>No policies configured</p>
              <Link href="/dashboard/policies/new">
                <Button variant="outline" size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Your First Policy
                </Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Brand Voice */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Mic className="h-5 w-5" />
              <div>
                <CardTitle>Brand Voice</CardTitle>
                <CardDescription>Configure how AI-generated content sounds and feels</CardDescription>
              </div>
            </div>
            <Link href="/dashboard/settings/brand-voice">
              <Button variant="outline" size="sm">
                Configure
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Set tone, writing style, and guidelines for your AI-generated marketing content.
            Create multiple voice profiles for different products or use cases.
          </p>
        </CardContent>
      </Card>

      {/* Emergency Controls */}
      <EmergencyControls />
    </div>
  );
}
