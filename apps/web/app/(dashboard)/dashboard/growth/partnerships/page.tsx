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
  Handshake,
  Search,
  Plus,
  ArrowRight,
  Building2,
  Globe,
  Mail,
  CheckCircle,
  Clock,
  Sparkles,
  Users,
  DollarSign,
} from 'lucide-react';

const statusColors: Record<string, string> = {
  discovered: 'bg-gray-100 text-gray-800',
  researching: 'bg-blue-100 text-blue-800',
  qualified: 'bg-yellow-100 text-yellow-800',
  outreach_draft: 'bg-purple-100 text-purple-800',
  outreach_sent: 'bg-indigo-100 text-indigo-800',
  in_conversation: 'bg-cyan-100 text-cyan-800',
  negotiating: 'bg-orange-100 text-orange-800',
  active: 'bg-green-100 text-green-800',
  declined: 'bg-red-100 text-red-800',
  rejected: 'bg-red-100 text-red-800',
};

const partnershipTypeLabels: Record<string, string> = {
  affiliate: 'Affiliate',
  co_marketing: 'Co-Marketing',
  integration: 'Integration',
  reseller: 'Reseller',
};

export default async function PartnershipsPage() {
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

  // Fetch partnership opportunities
  const { data: opportunities } = await supabase
    .from('partnership_opportunities')
    .select('*')
    .eq('organization_id', membership.organization_id)
    .order('opportunity_score', { ascending: false })
    .limit(50);

  // Fetch active partnerships
  const { data: partnerships } = await supabase
    .from('partnerships')
    .select('*')
    .eq('organization_id', membership.organization_id)
    .eq('active', true)
    .order('created_at', { ascending: false });

  // Calculate stats
  const totalOpportunities = opportunities?.length || 0;
  const qualifiedOpportunities = opportunities?.filter(o =>
    ['qualified', 'outreach_draft', 'outreach_sent', 'in_conversation', 'negotiating'].includes(o.status)
  ).length || 0;
  const activePartnerships = partnerships?.length || 0;
  const totalReferrals = partnerships?.reduce((sum, p) => sum + (p.total_referrals || 0), 0) || 0;
  const totalRevenue = partnerships?.reduce((sum, p) => sum + (p.total_revenue_cents || 0), 0) || 0;

  // Group opportunities by status for pipeline view
  const pipelineStages = [
    { status: 'discovered', label: 'Discovered' },
    { status: 'researching', label: 'Researching' },
    { status: 'qualified', label: 'Qualified' },
    { status: 'outreach_sent', label: 'Outreach Sent' },
    { status: 'in_conversation', label: 'In Conversation' },
    { status: 'negotiating', label: 'Negotiating' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Partnership Finder</h1>
          <p className="text-muted-foreground">
            Discover and manage partnership opportunities
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link href="/dashboard/growth/partnerships/discover">
              <Sparkles className="mr-2 h-4 w-4" />
              AI Discover
            </Link>
          </Button>
          <Button asChild>
            <Link href="/dashboard/growth/partnerships/new">
              <Plus className="mr-2 h-4 w-4" />
              Add Manually
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Opportunities</CardTitle>
            <Search className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalOpportunities}</div>
            <p className="text-xs text-muted-foreground">in pipeline</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Qualified</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{qualifiedOpportunities}</div>
            <p className="text-xs text-muted-foreground">ready for outreach</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Partners</CardTitle>
            <Handshake className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{activePartnerships}</div>
            <p className="text-xs text-muted-foreground">partnerships</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Referrals</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalReferrals}</div>
            <p className="text-xs text-muted-foreground">from partners</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${(totalRevenue / 100).toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">from partnerships</p>
          </CardContent>
        </Card>
      </div>

      {/* Pipeline Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Partnership Pipeline</CardTitle>
          <CardDescription>
            Track opportunities through your partnership process
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {pipelineStages.map((stage) => {
              const count = opportunities?.filter(o => o.status === stage.status).length || 0;
              return (
                <div
                  key={stage.status}
                  className="flex min-w-[120px] flex-col items-center rounded-lg border p-3"
                >
                  <span className="text-2xl font-bold">{count}</span>
                  <span className="text-xs text-muted-foreground text-center">{stage.label}</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Active Partnerships */}
      {partnerships && partnerships.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Handshake className="h-5 w-5" />
                <div>
                  <CardTitle>Active Partnerships</CardTitle>
                  <CardDescription>
                    Your current active partnership agreements
                  </CardDescription>
                </div>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link href="/dashboard/growth/partnerships/active">
                  View All
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {partnerships.slice(0, 3).map((partnership) => (
                <div
                  key={partnership.id}
                  className="flex items-center justify-between rounded-lg border p-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded bg-muted">
                      <Building2 className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-medium">{partnership.partner_name}</p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Badge variant="outline">
                          {partnershipTypeLabels[partnership.partnership_type] || partnership.partnership_type}
                        </Badge>
                        {partnership.commission_rate && (
                          <span>
                            {partnership.commission_type === 'percent'
                              ? `${partnership.commission_rate}%`
                              : `$${partnership.commission_rate / 100}`} commission
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{partnership.total_referrals || 0} referrals</p>
                    <p className="text-sm text-muted-foreground">
                      ${((partnership.total_revenue_cents || 0) / 100).toLocaleString()} revenue
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Opportunities List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              <div>
                <CardTitle>Partnership Opportunities</CardTitle>
                <CardDescription>
                  Companies that could be great partners
                </CardDescription>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {opportunities && opportunities.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company</TableHead>
                  <TableHead>Industry</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {opportunities.slice(0, 10).map((opportunity) => (
                  <TableRow key={opportunity.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded bg-muted">
                          <Building2 className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="font-medium">{opportunity.company_name}</div>
                          {opportunity.company_website && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Globe className="h-3 w-3" />
                              {opportunity.company_website.replace(/^https?:\/\//, '')}
                            </div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {opportunity.company_industry || '-'}
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={
                          (opportunity.opportunity_score || 0) >= 70
                            ? 'bg-green-100 text-green-800'
                            : (opportunity.opportunity_score || 0) >= 40
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-gray-100 text-gray-800'
                        }
                      >
                        {opportunity.opportunity_score || 0}%
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {opportunity.discovery_source === 'ai_scan' ? (
                          <><Sparkles className="mr-1 h-3 w-3" />AI</>
                        ) : (
                          opportunity.discovery_source || 'Manual'
                        )}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={statusColors[opportunity.status] || statusColors.discovered}>
                        {opportunity.status.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/dashboard/growth/partnerships/${opportunity.id}`}>
                          View
                          <ArrowRight className="ml-1 h-3 w-3" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex h-32 flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
              <Handshake className="h-8 w-8 opacity-50" />
              <p>No partnership opportunities yet</p>
              <div className="flex gap-2">
                <Button asChild size="sm" variant="outline">
                  <Link href="/dashboard/growth/partnerships/discover">
                    <Sparkles className="mr-2 h-4 w-4" />
                    AI Discover
                  </Link>
                </Button>
                <Button asChild size="sm">
                  <Link href="/dashboard/growth/partnerships/new">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Manually
                  </Link>
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
