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
  Building2,
  Users,
  TrendingUp,
  Eye,
  DollarSign,
  Settings,
  Bell,
  ArrowRight,
  Globe,
  Clock,
} from 'lucide-react';

const fitScoreColors: Record<string, string> = {
  high: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  low: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
};

function getFitLevel(score: number | null): string {
  if (!score) return 'low';
  if (score >= 70) return 'high';
  if (score >= 40) return 'medium';
  return 'low';
}

export default async function VisitorsPage() {
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

  // Fetch tracking scripts
  const { data: scripts } = await supabase
    .from('tracking_scripts')
    .select('*')
    .eq('organization_id', membership.organization_id);

  const scriptIds = scripts?.map(s => s.id) || [];

  // Fetch visitors
  const { data: visitors } = await supabase
    .from('website_visitors')
    .select('*')
    .in('tracking_script_id', scriptIds.length > 0 ? scriptIds : ['none'])
    .order('last_seen_at', { ascending: false })
    .limit(50);

  // Calculate stats
  const totalVisitors = visitors?.length || 0;
  const highFitVisitors = visitors?.filter(v => (v.fit_score || 0) >= 70).length || 0;
  const highIntentVisitors = visitors?.filter(v => (v.intent_score || 0) >= 70).length || 0;

  const todayVisitors = visitors?.filter(v => {
    const seen = new Date(v.last_seen_at);
    const today = new Date();
    return seen.toDateString() === today.toDateString();
  }).length || 0;

  const weekVisitors = visitors?.filter(v => {
    const seen = new Date(v.last_seen_at);
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return seen >= weekAgo;
  }).length || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Website Visitors</h1>
          <p className="text-muted-foreground">
            Identify companies visiting your website and track their engagement
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link href="/dashboard/growth/visitors/alerts">
              <Bell className="mr-2 h-4 w-4" />
              Alerts
            </Link>
          </Button>
          <Button asChild>
            <Link href="/dashboard/growth/visitors/tracking">
              <Settings className="mr-2 h-4 w-4" />
              Tracking Setup
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Identified</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalVisitors}</div>
            <p className="text-xs text-muted-foreground">companies</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{todayVisitors}</div>
            <p className="text-xs text-muted-foreground">active visitors</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">This Week</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{weekVisitors}</div>
            <p className="text-xs text-muted-foreground">unique companies</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">High Fit</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{highFitVisitors}</div>
            <p className="text-xs text-muted-foreground">match your ICP</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">High Intent</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{highIntentVisitors}</div>
            <p className="text-xs text-muted-foreground">buying signals</p>
          </CardContent>
        </Card>
      </div>

      {/* Tracking Status */}
      {(!scripts || scripts.length === 0) && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Building2 className="mb-4 h-12 w-12 text-muted-foreground" />
            <h3 className="mb-2 text-lg font-medium">Set up visitor tracking</h3>
            <p className="mb-4 text-center text-sm text-muted-foreground">
              Add a tracking script to your website to start identifying company visitors
            </p>
            <Button asChild>
              <Link href="/dashboard/growth/visitors/tracking">
                <Settings className="mr-2 h-4 w-4" />
                Configure Tracking
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Visitors Table */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Visitors</CardTitle>
          <CardDescription>
            Companies that have visited your website
          </CardDescription>
        </CardHeader>
        <CardContent>
          {visitors && visitors.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company</TableHead>
                  <TableHead>Industry</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Fit Score</TableHead>
                  <TableHead>Intent Score</TableHead>
                  <TableHead>Sessions</TableHead>
                  <TableHead>Last Seen</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visitors.map((visitor) => {
                  const enrichment = visitor.enrichment_data || {};
                  const fitLevel = getFitLevel(visitor.fit_score);
                  const intentLevel = getFitLevel(visitor.intent_score);

                  return (
                    <TableRow key={visitor.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          {visitor.company_logo_url ? (
                            <img
                              src={visitor.company_logo_url}
                              alt=""
                              className="h-8 w-8 rounded"
                            />
                          ) : (
                            <div className="flex h-8 w-8 items-center justify-center rounded bg-muted">
                              <Building2 className="h-4 w-4" />
                            </div>
                          )}
                          <div>
                            <div className="font-medium">{visitor.company_name || 'Unknown'}</div>
                            {visitor.company_domain && (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Globe className="h-3 w-3" />
                                {visitor.company_domain}
                              </div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {enrichment.industry || '-'}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {enrichment.employee_count
                          ? `${enrichment.employee_count.toLocaleString()} employees`
                          : '-'}
                      </TableCell>
                      <TableCell>
                        <Badge className={fitScoreColors[fitLevel]}>
                          {visitor.fit_score || 0}%
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={fitScoreColors[intentLevel]}>
                          {visitor.intent_score || 0}%
                        </Badge>
                      </TableCell>
                      <TableCell>{visitor.total_sessions || 1}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {new Date(visitor.last_seen_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                          })}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/dashboard/growth/visitors/${visitor.id}`}>
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
          ) : scripts && scripts.length > 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Eye className="mb-4 h-12 w-12 text-muted-foreground" />
              <h3 className="mb-2 text-lg font-medium">No visitors identified yet</h3>
              <p className="text-sm text-muted-foreground">
                Visitors will appear here once your tracking script captures them
              </p>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
