'use server';

import { createClient } from '@/lib/supabase/server';

export type DateRange = {
  from: string;
  to: string;
};

export type OverviewMetrics = {
  emailsSent: number;
  emailsDelivered: number;
  emailsOpened: number;
  emailsClicked: number;
  emailsBounced: number;
  conversions: number;
  openRate: number;
  clickRate: number;
  conversionRate: number;
};

export type CampaignMetrics = {
  campaignId: string;
  campaignName: string;
  emailsSent: number;
  emailsOpened: number;
  emailsClicked: number;
  conversions: number;
  openRate: number;
  clickRate: number;
  conversionRate: number;
};

export type TaskMetrics = {
  taskId: string;
  taskTitle: string;
  emailsSent: number;
  emailsDelivered: number;
  emailsOpened: number;
  emailsClicked: number;
  emailsBounced: number;
};

export type MetricOverTime = {
  date: string;
  emailsSent: number;
  emailsOpened: number;
  emailsClicked: number;
  conversions: number;
};

export async function getOverviewMetrics(
  organizationId: string,
  dateRange?: DateRange
): Promise<OverviewMetrics> {
  const supabase = await createClient();

  let query = supabase
    .from('metrics')
    .select('metric_name, metric_value')
    .eq('organization_id', organizationId)
    .in('metric_name', [
      'email_sent',
      'email_delivered',
      'email_opened',
      'email_clicked',
      'email_bounced',
      'conversions',
    ]);

  if (dateRange) {
    query = query.gte('recorded_at', dateRange.from).lte('recorded_at', dateRange.to);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching overview metrics:', error);
    throw error;
  }

  const metrics = {
    emailsSent: 0,
    emailsDelivered: 0,
    emailsOpened: 0,
    emailsClicked: 0,
    emailsBounced: 0,
    conversions: 0,
    openRate: 0,
    clickRate: 0,
    conversionRate: 0,
  };

  if (data) {
    data.forEach((row) => {
      switch (row.metric_name) {
        case 'email_sent':
          metrics.emailsSent += row.metric_value;
          break;
        case 'email_delivered':
          metrics.emailsDelivered += row.metric_value;
          break;
        case 'email_opened':
          metrics.emailsOpened += row.metric_value;
          break;
        case 'email_clicked':
          metrics.emailsClicked += row.metric_value;
          break;
        case 'email_bounced':
          metrics.emailsBounced += row.metric_value;
          break;
        case 'conversions':
          metrics.conversions += row.metric_value;
          break;
      }
    });

    // Calculate rates
    if (metrics.emailsDelivered > 0) {
      metrics.openRate = (metrics.emailsOpened / metrics.emailsDelivered) * 100;
      metrics.clickRate = (metrics.emailsClicked / metrics.emailsDelivered) * 100;
    }
    if (metrics.emailsSent > 0) {
      metrics.conversionRate = (metrics.conversions / metrics.emailsSent) * 100;
    }
  }

  return metrics;
}

export async function getCampaignMetrics(
  organizationId: string,
  dateRange?: DateRange
): Promise<CampaignMetrics[]> {
  const supabase = await createClient();

  // Get all campaigns for the organization
  const { data: campaigns, error: campaignsError } = await supabase
    .from('campaigns')
    .select('id, name, product_id')
    .eq('product_id', organizationId)
    .order('created_at', { ascending: false });

  if (campaignsError) {
    console.error('Error fetching campaigns:', campaignsError);
    throw campaignsError;
  }

  if (!campaigns || campaigns.length === 0) {
    return [];
  }

  const campaignIds = campaigns.map((c) => c.id);

  let metricsQuery = supabase
    .from('metrics')
    .select('campaign_id, metric_name, metric_value')
    .in('campaign_id', campaignIds)
    .in('metric_name', ['email_sent', 'email_opened', 'email_clicked', 'conversions']);

  if (dateRange) {
    metricsQuery = metricsQuery
      .gte('recorded_at', dateRange.from)
      .lte('recorded_at', dateRange.to);
  }

  const { data: metricsData, error: metricsError } = await metricsQuery;

  if (metricsError) {
    console.error('Error fetching campaign metrics:', metricsError);
    throw metricsError;
  }

  // Aggregate metrics by campaign
  const campaignMetricsMap = new Map<
    string,
    {
      name: string;
      emailsSent: number;
      emailsOpened: number;
      emailsClicked: number;
      conversions: number;
    }
  >();

  campaigns.forEach((campaign) => {
    campaignMetricsMap.set(campaign.id, {
      name: campaign.name,
      emailsSent: 0,
      emailsOpened: 0,
      emailsClicked: 0,
      conversions: 0,
    });
  });

  metricsData?.forEach((row) => {
    if (!row.campaign_id) return;

    const campaign = campaignMetricsMap.get(row.campaign_id);
    if (!campaign) return;

    switch (row.metric_name) {
      case 'email_sent':
        campaign.emailsSent += row.metric_value;
        break;
      case 'email_opened':
        campaign.emailsOpened += row.metric_value;
        break;
      case 'email_clicked':
        campaign.emailsClicked += row.metric_value;
        break;
      case 'conversions':
        campaign.conversions += row.metric_value;
        break;
    }
  });

  // Convert to array and calculate rates
  const result: CampaignMetrics[] = [];
  campaignMetricsMap.forEach((metrics, campaignId) => {
    const openRate = metrics.emailsSent > 0 ? (metrics.emailsOpened / metrics.emailsSent) * 100 : 0;
    const clickRate =
      metrics.emailsSent > 0 ? (metrics.emailsClicked / metrics.emailsSent) * 100 : 0;
    const conversionRate =
      metrics.emailsSent > 0 ? (metrics.conversions / metrics.emailsSent) * 100 : 0;

    result.push({
      campaignId,
      campaignName: metrics.name,
      emailsSent: metrics.emailsSent,
      emailsOpened: metrics.emailsOpened,
      emailsClicked: metrics.emailsClicked,
      conversions: metrics.conversions,
      openRate,
      clickRate,
      conversionRate,
    });
  });

  return result.sort((a, b) => b.emailsSent - a.emailsSent);
}

export async function getTaskMetrics(taskId: string): Promise<TaskMetrics | null> {
  const supabase = await createClient();

  const [{ data: task }, { data: metrics }] = await Promise.all([
    supabase.from('tasks').select('id, title').eq('id', taskId).single(),
    supabase
      .from('metrics')
      .select('metric_name, metric_value')
      .eq('task_id', taskId)
      .in('metric_name', [
        'email_sent',
        'email_delivered',
        'email_opened',
        'email_clicked',
        'email_bounced',
      ]),
  ]);

  if (!task) {
    return null;
  }

  const taskMetrics: TaskMetrics = {
    taskId: task.id,
    taskTitle: task.title,
    emailsSent: 0,
    emailsDelivered: 0,
    emailsOpened: 0,
    emailsClicked: 0,
    emailsBounced: 0,
  };

  metrics?.forEach((row) => {
    switch (row.metric_name) {
      case 'email_sent':
        taskMetrics.emailsSent += row.metric_value;
        break;
      case 'email_delivered':
        taskMetrics.emailsDelivered += row.metric_value;
        break;
      case 'email_opened':
        taskMetrics.emailsOpened += row.metric_value;
        break;
      case 'email_clicked':
        taskMetrics.emailsClicked += row.metric_value;
        break;
      case 'email_bounced':
        taskMetrics.emailsBounced += row.metric_value;
        break;
    }
  });

  return taskMetrics;
}

export async function getMetricsOverTime(
  organizationId: string,
  dateRange?: DateRange
): Promise<MetricOverTime[]> {
  const supabase = await createClient();

  let query = supabase
    .from('metrics')
    .select('recorded_at, metric_name, metric_value')
    .eq('organization_id', organizationId)
    .in('metric_name', ['email_sent', 'email_opened', 'email_clicked', 'conversions'])
    .order('recorded_at', { ascending: true });

  if (dateRange) {
    query = query.gte('recorded_at', dateRange.from).lte('recorded_at', dateRange.to);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching metrics over time:', error);
    throw error;
  }

  // Group by date
  const metricsMap = new Map<
    string,
    {
      emailsSent: number;
      emailsOpened: number;
      emailsClicked: number;
      conversions: number;
    }
  >();

  data?.forEach((row) => {
    const date = row.recorded_at.split('T')[0]; // Get just the date part
    if (!metricsMap.has(date)) {
      metricsMap.set(date, {
        emailsSent: 0,
        emailsOpened: 0,
        emailsClicked: 0,
        conversions: 0,
      });
    }

    const dayMetrics = metricsMap.get(date)!;
    switch (row.metric_name) {
      case 'email_sent':
        dayMetrics.emailsSent += row.metric_value;
        break;
      case 'email_opened':
        dayMetrics.emailsOpened += row.metric_value;
        break;
      case 'email_clicked':
        dayMetrics.emailsClicked += row.metric_value;
        break;
      case 'conversions':
        dayMetrics.conversions += row.metric_value;
        break;
    }
  });

  // Convert to array
  const result: MetricOverTime[] = [];
  metricsMap.forEach((metrics, date) => {
    result.push({
      date,
      ...metrics,
    });
  });

  return result.sort((a, b) => a.date.localeCompare(b.date));
}
