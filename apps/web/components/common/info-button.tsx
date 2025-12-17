'use client';

import * as React from 'react';
import { Info, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export interface InfoButtonProps {
  title: string;
  description: string;
  learnMoreUrl?: string;
  side?: 'top' | 'right' | 'bottom' | 'left';
  className?: string;
}

export function InfoButton({
  title,
  description,
  learnMoreUrl,
  side = 'top',
  className,
}: InfoButtonProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            'h-5 w-5 rounded-full p-0 text-muted-foreground hover:text-foreground',
            className
          )}
        >
          <Info className="h-3.5 w-3.5" />
          <span className="sr-only">More information about {title}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent side={side} className="w-64">
        <div className="space-y-2">
          <h4 className="font-medium leading-none">{title}</h4>
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
      </PopoverContent>
    </Popover>
  );
}
