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
  Magnet,
  Mail,
  UserPlus,
  Users,
  TrendingUp,
  Download,
  ArrowRight,
  MailOpen,
  CheckCircle,
  XCircle,
} from 'lucide-react';

const statusColors: Record<string, string> = {
  active: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  completed: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  unsubscribed: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
  converted: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
};

export default async function LeadsPage() {
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

  // Fetch leads with lead magnet info
  const { data: leads } = await supabase
    .from('leads')
    .select(`
      *,
      lead_magnets (id, title)
    `)
    .eq('organization_id', membership.organization_id)
    .order('created_at', { ascending: false })
    .limit(100);

  // Fetch lead magnets count
  const { count: magnetCount } = await supabase
    .from('lead_magnets')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', membership.organization_id);

  // Fetch nurture sequences count
  const { count: sequenceCount } = await supabase
    .from('nurture_sequences')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', membership.organization_id);

  // Calculate stats
  const totalLeads = leads?.length || 0;
  const activeLeads = leads?.filter(l => l.nurture_status === 'active').length || 0;
  const convertedLeads = leads?.filter(l => l.nurture_status === 'converted').length || 0;
  const subscribedLeads = leads?.filter(l => l.subscribed).length || 0;

  const thisWeekLeads = leads?.filter(l => {
    const created = new Date(l.created_at);
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return created >= weekAgo;
  }).length || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Lead Magnets & Nurture</h1>
          <p className="text-muted-foreground">
            Capture leads and nurture them through automated email sequences
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link href="/dashboard/growth/leads/sequences">
              <Mail className="mr-2 h-4 w-4" />
              Sequences ({sequenceCount || 0})
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/dashboard/growth/leads/magnets">
              <Magnet className="mr-2 h-4 w-4" />
              Magnets ({magnetCount || 0})
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Leads</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalLeads}</div>
            <p className="text-xs text-muted-foreground">all time</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">This Week</CardTitle>
            <UserPlus className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{thisWeekLeads}</div>
            <p className="text-xs text-muted-foreground">new leads</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Nurture</CardTitle>
            <MailOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeLeads}</div>
            <p className="text-xs text-muted-foreground">active sequences</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Converted</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{convertedLeads}</div>
            <p className="text-xs text-muted-foreground">
              {totalLeads > 0 ? ((convertedLeads / totalLeads) * 100).toFixed(1) : 0}% rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Subscribed</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{subscribedLeads}</div>
            <p className="text-xs text-muted-foreground">
              {totalLeads > 0 ? ((subscribedLeads / totalLeads) * 100).toFixed(1) : 0}% opted-in
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-2">
        <Link href="/dashboard/growth/leads/magnets/new">
          <Card className="cursor-pointer transition-shadow hover:shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Magnet className="h-5 w-5 text-purple-500" />
                Create Lead Magnet
              </CardTitle>
              <CardDescription>
                Offer a free guide, template, or tool to capture email addresses
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/dashboard/growth/leads/sequences/new">
          <Card className="cursor-pointer transition-shadow hover:shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5 text-blue-500" />
                Create Nurture Sequence
              </CardTitle>
              <CardDescription>
                Set up automated email sequences to engage and convert leads
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>
      </div>

      {/* Leads Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Recent Leads</CardTitle>
              <CardDescription>
                View and manage captured leads
              </CardDescription>
            </div>
            <Button variant="outline" size="sm">
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {leads && leads.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Nurture Status</TableHead>
                  <TableHead>Subscribed</TableHead>
                  <TableHead>Captured</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leads.map((lead) => (
                  <TableRow key={lead.id}>
                    <TableCell className="font-medium">{lead.email}</TableCell>
                    <TableCell>
                      {lead.first_name || lead.last_name
                        ? `${lead.first_name || ''} ${lead.last_name || ''}`.trim()
                        : '-'}
                    </TableCell>
                    <TableCell>
                      {lead.lead_magnets ? (
                        <Badge variant="outline">{lead.lead_magnets.title}</Badge>
                      ) : (
                        <span className="text-muted-foreground">{lead.source || 'Direct'}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge className={statusColors[lead.nurture_status] || statusColors.active}>
                        {lead.nurture_status || 'Active'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {lead.subscribed ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-gray-400" />
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(lead.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/dashboard/growth/leads/${lead.id}`}>
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
            <div className="flex flex-col items-center justify-center py-12">
              <Users className="mb-4 h-12 w-12 text-muted-foreground" />
              <h3 className="mb-2 text-lg font-medium">No leads yet</h3>
              <p className="mb-4 text-sm text-muted-foreground">
                Create a lead magnet to start capturing leads
              </p>
              <Button asChild>
                <Link href="/dashboard/growth/leads/magnets/new">
                  <Magnet className="mr-2 h-4 w-4" />
                  Create Lead Magnet
                </Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
