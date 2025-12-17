import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Mail, MousePointerClick, TrendingUp, Users } from 'lucide-react';
import { DateRangeSelector } from '@/components/analytics/date-range-selector';
import { MetricCard } from '@/components/analytics/charts/metric-card';
import { PerformanceChart } from './performance-chart';
import {
  getOverviewMetrics,
  getCampaignMetrics,
  getMetricsOverTime,
  type DateRange,
} from '@/lib/actions/analytics';

type PageProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function AnalyticsPage({ searchParams }: PageProps) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Get user's organizations
  const { data: memberships } = await supabase
    .from('organization_members')
    .select('organization_id, organizations(id, name)')
    .eq('user_id', user!.id);

  const organizationId = memberships?.[0]?.organization_id;

  if (!organizationId) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <h1 className="mb-2 text-2xl font-bold">No Organization Found</h1>
        <p className="text-muted-foreground">Please create an organization first.</p>
      </div>
    );
  }

  // Get date range from search params or default to last 30 days
  const params = await searchParams;
  const dateRangeParam = params.range as string | undefined;
  const campaignFilter = params.campaign as string | undefined;

  let dateRange: DateRange | undefined;
  if (dateRangeParam === '7d') {
    const to = new Date();
    const from = new Date(to);
    from.setDate(from.getDate() - 7);
    dateRange = { from: from.toISOString(), to: to.toISOString() };
  } else if (dateRangeParam === '30d' || !dateRangeParam) {
    const to = new Date();
    const from = new Date(to);
    from.setDate(from.getDate() - 30);
    dateRange = { from: from.toISOString(), to: to.toISOString() };
  } else if (dateRangeParam === '90d') {
    const to = new Date();
    const from = new Date(to);
    from.setDate(from.getDate() - 90);
    dateRange = { from: from.toISOString(), to: to.toISOString() };
  }

  // Fetch analytics data
  const [overviewMetrics, campaignMetrics, metricsOverTime] = await Promise.all([
    getOverviewMetrics(organizationId, dateRange),
    getCampaignMetrics(organizationId, dateRange),
    getMetricsOverTime(organizationId, dateRange),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Analytics</h1>
          <p className="text-muted-foreground">Track your campaign performance and metrics</p>
        </div>
        <DateRangeSelector />
      </div>

      {/* Overview Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Emails Sent"
          value={overviewMetrics.emailsSent.toLocaleString()}
          icon={<Mail className="h-4 w-4" />}
          description={`${overviewMetrics.emailsDelivered.toLocaleString()} delivered`}
        />
        <MetricCard
          title="Open Rate"
          value={`${overviewMetrics.openRate.toFixed(1)}%`}
          icon={<Users className="h-4 w-4" />}
          description={`${overviewMetrics.emailsOpened.toLocaleString()} opens`}
        />
        <MetricCard
          title="Click Rate"
          value={`${overviewMetrics.clickRate.toFixed(1)}%`}
          icon={<MousePointerClick className="h-4 w-4" />}
          description={`${overviewMetrics.emailsClicked.toLocaleString()} clicks`}
        />
        <MetricCard
          title="Conversions"
          value={overviewMetrics.conversions.toLocaleString()}
          icon={<TrendingUp className="h-4 w-4" />}
          description={`${overviewMetrics.conversionRate.toFixed(1)}% conversion rate`}
        />
      </div>

      {/* Metrics Over Time Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Performance Over Time</CardTitle>
          <CardDescription>Daily metrics for the selected period</CardDescription>
        </CardHeader>
        <CardContent>
          {metricsOverTime.length > 0 ? (
            <PerformanceChart data={metricsOverTime} />
          ) : (
            <div className="flex h-[350px] items-center justify-center text-sm text-muted-foreground">
              No data available for the selected period
            </div>
          )}
        </CardContent>
      </Card>

      {/* Campaign Performance Table */}
      <Card>
        <CardHeader>
          <CardTitle>Campaign Performance</CardTitle>
          <CardDescription>Metrics breakdown by campaign</CardDescription>
        </CardHeader>
        <CardContent>
          {campaignMetrics.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Campaign</TableHead>
                  <TableHead className="text-right">Sent</TableHead>
                  <TableHead className="text-right">Opened</TableHead>
                  <TableHead className="text-right">Clicked</TableHead>
                  <TableHead className="text-right">Conversions</TableHead>
                  <TableHead className="text-right">Open Rate</TableHead>
                  <TableHead className="text-right">Click Rate</TableHead>
                  <TableHead className="text-right">Conv. Rate</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaignMetrics.map((campaign) => (
                  <TableRow key={campaign.campaignId}>
                    <TableCell className="font-medium">{campaign.campaignName}</TableCell>
                    <TableCell className="text-right">
                      {campaign.emailsSent.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      {campaign.emailsOpened.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      {campaign.emailsClicked.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      {campaign.conversions.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">{campaign.openRate.toFixed(1)}%</TableCell>
                    <TableCell className="text-right">{campaign.clickRate.toFixed(1)}%</TableCell>
                    <TableCell className="text-right">
                      {campaign.conversionRate.toFixed(1)}%
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
              No campaign data available
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
