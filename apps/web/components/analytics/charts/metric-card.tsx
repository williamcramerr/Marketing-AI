'use client';

import { ArrowDown, ArrowUp, Minus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface MetricCardProps {
  title: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon?: React.ReactNode;
  description?: string;
  trend?: 'up' | 'down' | 'neutral';
  className?: string;
}

export function MetricCard({
  title,
  value,
  change,
  changeLabel = 'vs last period',
  icon,
  description,
  trend,
  className,
}: MetricCardProps) {
  const determinedTrend = trend || (change !== undefined ? (change > 0 ? 'up' : change < 0 ? 'down' : 'neutral') : undefined);

  const TrendIcon = determinedTrend === 'up' ? ArrowUp : determinedTrend === 'down' ? ArrowDown : Minus;

  const trendColor =
    determinedTrend === 'up'
      ? 'text-green-600'
      : determinedTrend === 'down'
        ? 'text-red-600'
        : 'text-muted-foreground';

  return (
    <Card className={cn(className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon && <div className="h-4 w-4 text-muted-foreground">{icon}</div>}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {(change !== undefined || description) && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            {change !== undefined && (
              <>
                <TrendIcon className={cn('h-3 w-3', trendColor)} />
                <span className={trendColor}>
                  {change > 0 ? '+' : ''}
                  {change.toFixed(1)}%
                </span>
                <span>{changeLabel}</span>
              </>
            )}
            {description && !change && <span>{description}</span>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface MetricCardSkeletonProps {
  className?: string;
}

export function MetricCardSkeleton({ className }: MetricCardSkeletonProps) {
  return (
    <Card className={cn(className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="h-4 w-24 animate-pulse rounded bg-muted" />
        <div className="h-4 w-4 animate-pulse rounded bg-muted" />
      </CardHeader>
      <CardContent>
        <div className="h-8 w-20 animate-pulse rounded bg-muted" />
        <div className="mt-2 h-3 w-32 animate-pulse rounded bg-muted" />
      </CardContent>
    </Card>
  );
}
