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
  Magnet,
  FileText,
  Video,
  CheckSquare,
  Wrench,
  Globe,
  Edit,
  ExternalLink,
  Eye,
  Download,
  ArrowLeft,
} from 'lucide-react';
import { ToggleMagnetButton } from './toggle-magnet-button';
import { DeleteMagnetButton } from './delete-magnet-button';

const magnetTypeIcons: Record<string, typeof FileText> = {
  pdf: FileText,
  template: FileText,
  tool: Wrench,
  video: Video,
  checklist: CheckSquare,
};

const magnetTypeLabels: Record<string, string> = {
  pdf: 'PDF Guide',
  template: 'Template',
  tool: 'Free Tool',
  video: 'Video Course',
  checklist: 'Checklist',
};

export default async function LeadMagnetsPage() {
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

  // Fetch lead magnets with stats
  const { data: magnets } = await supabase
    .from('lead_magnets')
    .select('*')
    .eq('organization_id', membership.organization_id)
    .order('created_at', { ascending: false });

  // Calculate totals
  const totalViews = magnets?.reduce((sum, m) => sum + (m.view_count || 0), 0) || 0;
  const totalDownloads = magnets?.reduce((sum, m) => sum + (m.download_count || 0), 0) || 0;
  const totalConversions = magnets?.reduce((sum, m) => sum + (m.conversion_count || 0), 0) || 0;
  const activeMagnets = magnets?.filter(m => m.active).length || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/growth/leads">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Leads
          </Link>
        </Button>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Lead Magnets</h1>
          <p className="text-muted-foreground">
            Create valuable content to capture email addresses
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/growth/leads/magnets/new">
            <Plus className="mr-2 h-4 w-4" />
            New Lead Magnet
          </Link>
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Magnets
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{magnets?.length || 0}</div>
            <p className="text-xs text-muted-foreground">{activeMagnets} active</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Views
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalViews.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">landing page visits</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Downloads
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalDownloads.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {totalViews > 0 ? ((totalDownloads / totalViews) * 100).toFixed(1) : 0}% conversion
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Conversions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{totalConversions}</div>
            <p className="text-xs text-muted-foreground">leads to customers</p>
          </CardContent>
        </Card>
      </div>

      {/* Magnets List */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Magnet className="h-5 w-5" />
            <div>
              <CardTitle>All Lead Magnets</CardTitle>
              <CardDescription>
                Manage your lead capture content and landing pages
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {magnets && magnets.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Views</TableHead>
                  <TableHead>Downloads</TableHead>
                  <TableHead>Conversion</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {magnets.map((magnet) => {
                  const Icon = magnetTypeIcons[magnet.magnet_type] || FileText;
                  const conversionRate = magnet.view_count > 0
                    ? ((magnet.download_count / magnet.view_count) * 100).toFixed(1)
                    : '0';

                  return (
                    <TableRow key={magnet.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded bg-muted">
                            <Icon className="h-4 w-4" />
                          </div>
                          <div>
                            <div className="font-medium">{magnet.title}</div>
                            <div className="text-xs text-muted-foreground">/{magnet.slug}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {magnetTypeLabels[magnet.magnet_type] || magnet.magnet_type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                          {magnet.view_count?.toLocaleString() || 0}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Download className="h-3.5 w-3.5 text-muted-foreground" />
                          {magnet.download_count?.toLocaleString() || 0}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-medium">{conversionRate}%</span>
                      </TableCell>
                      <TableCell>
                        {magnet.active ? (
                          <Badge className="bg-green-100 text-green-800">Active</Badge>
                        ) : (
                          <Badge variant="secondary">Inactive</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="sm" asChild>
                            <a href={`/lp/${magnet.slug}`} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </Button>
                          <ToggleMagnetButton magnetId={magnet.id} active={magnet.active} />
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={`/dashboard/growth/leads/magnets/${magnet.id}`}>
                              <Edit className="h-4 w-4" />
                            </Link>
                          </Button>
                          <DeleteMagnetButton magnetId={magnet.id} title={magnet.title} />
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="flex h-32 flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
              <Magnet className="h-8 w-8 opacity-50" />
              <p>No lead magnets yet</p>
              <Button asChild size="sm">
                <Link href="/dashboard/growth/leads/magnets/new">
                  <Plus className="mr-2 h-4 w-4" />
                  Create Your First Lead Magnet
                </Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
