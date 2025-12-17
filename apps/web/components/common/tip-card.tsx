'use client';

import * as React from 'react';
import { Lightbulb, X, ExternalLink, CheckCircle, AlertTriangle } from 'lucide-react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Button } from '@/components/ui/button';
import { useDismissedTips } from '@/hooks/use-dismissed-tips';
import { cn } from '@/lib/utils';

const tipCardVariants = cva(
  'relative flex gap-3 rounded-lg border p-4',
  {
    variants: {
      variant: {
        info: 'border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950',
        success: 'border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950',
        warning: 'border-yellow-200 bg-yellow-50 dark:border-yellow-900 dark:bg-yellow-950',
      },
    },
    defaultVariants: {
      variant: 'info',
    },
  }
);

const iconVariants = {
  info: 'text-blue-600 dark:text-blue-400',
  success: 'text-green-600 dark:text-green-400',
  warning: 'text-yellow-600 dark:text-yellow-400',
};

const IconMap = {
  info: Lightbulb,
  success: CheckCircle,
  warning: AlertTriangle,
};

export interface TipCardProps extends VariantProps<typeof tipCardVariants> {
  id: string;
  title: string;
  description: string;
  learnMoreUrl?: string;
  className?: string;
}

export function TipCard({
  id,
  title,
  description,
  variant = 'info',
  learnMoreUrl,
  className,
}: TipCardProps) {
  const { isTipDismissed, dismissTip, isLoaded } = useDismissedTips();

  // Don't render until localStorage is checked (prevents flash)
  if (!isLoaded || isTipDismissed(id)) {
    return null;
  }

  const Icon = IconMap[variant || 'info'];

  return (
    <div className={cn(tipCardVariants({ variant }), className)}>
      <Icon className={cn('h-5 w-5 flex-shrink-0 mt-0.5', iconVariants[variant || 'info'])} />
      <div className="flex-1 space-y-1">
        <div className="flex items-start justify-between gap-2">
          <h4 className="font-medium leading-none">{title}</h4>
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 -mr-2 -mt-1 rounded-full p-0 opacity-60 hover:opacity-100"
            onClick={() => dismissTip(id)}
          >
            <X className="h-3.5 w-3.5" />
            <span className="sr-only">Dismiss tip</span>
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">{description}</p>
        {learnMoreUrl && (
          <a
            href={learnMoreUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
          >
            Learn more
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
    </div>
  );
}
