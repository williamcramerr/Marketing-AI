'use client';

import { LineChart } from '@/components/analytics/charts/line-chart';
import type { MetricOverTime } from '@/lib/actions/analytics';

interface PerformanceChartProps {
  data: MetricOverTime[];
}

export function PerformanceChart({ data }: PerformanceChartProps) {
  const chartData = data.map((metric) => ({
    date: new Date(metric.date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    }),
    sent: metric.emailsSent,
    opened: metric.emailsOpened,
    clicked: metric.emailsClicked,
    conversions: metric.conversions,
  }));

  return (
    <LineChart
      data={chartData}
      lines={[
        { dataKey: 'sent', name: 'Sent', color: 'hsl(221.2 83.2% 53.3%)' },
        { dataKey: 'opened', name: 'Opened', color: 'hsl(142.1 76.2% 36.3%)' },
        { dataKey: 'clicked', name: 'Clicked', color: 'hsl(262.1 83.3% 57.8%)' },
        { dataKey: 'conversions', name: 'Conversions', color: 'hsl(24.6 95% 53.1%)' },
      ]}
      height={350}
    />
  );
}
