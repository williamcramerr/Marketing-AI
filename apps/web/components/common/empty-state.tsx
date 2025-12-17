'use client';

import { LucideIcon, Plus, FileText, Megaphone, CheckSquare, Bell, Image, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  actionHref,
  onAction,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/30 px-6 py-12 text-center">
      {Icon && (
        <div className="mb-4 rounded-full bg-muted p-3">
          <Icon className="h-6 w-6 text-muted-foreground" />
        </div>
      )}
      <h3 className="mb-2 text-lg font-semibold">{title}</h3>
      <p className="mb-6 max-w-sm text-sm text-muted-foreground">{description}</p>
      {actionLabel && (actionHref || onAction) && (
        actionHref ? (
          <Button asChild>
            <Link href={actionHref}>
              <Plus className="mr-2 h-4 w-4" />
              {actionLabel}
            </Link>
          </Button>
        ) : (
          <Button onClick={onAction}>
            <Plus className="mr-2 h-4 w-4" />
            {actionLabel}
          </Button>
        )
      )}
    </div>
  );
}

// Pre-configured empty states for common use cases
export function EmptyTasks({ onCreateCampaign }: { onCreateCampaign?: () => void }) {
  return (
    <EmptyState
      icon={CheckSquare}
      title="No tasks yet"
      description="Tasks are automatically created when you launch campaigns. Create your first campaign to get started."
      actionLabel="Create Campaign"
      actionHref="/dashboard/campaigns/new"
    />
  );
}

export function EmptyCampaigns() {
  return (
    <EmptyState
      icon={Megaphone}
      title="No campaigns yet"
      description="Campaigns help you organize and automate your marketing efforts. Create your first campaign to start reaching your audience."
      actionLabel="Create Campaign"
      actionHref="/dashboard/campaigns/new"
    />
  );
}

export function EmptyContent() {
  return (
    <EmptyState
      icon={FileText}
      title="No content yet"
      description="Your AI-generated content will appear here. Start a campaign or create content manually to populate your library."
      actionLabel="Create Content"
      actionHref="/dashboard/content/new"
    />
  );
}

export function EmptyNotifications() {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <div className="mb-4 rounded-full bg-green-100 p-3 dark:bg-green-900/30">
        <Bell className="h-6 w-6 text-green-600 dark:text-green-400" />
      </div>
      <h3 className="mb-2 text-lg font-semibold">All caught up!</h3>
      <p className="max-w-sm text-sm text-muted-foreground">
        You have no new notifications. We&apos;ll let you know when something needs your attention.
      </p>
    </div>
  );
}

export function EmptyMedia() {
  return (
    <EmptyState
      icon={Image}
      title="No media assets yet"
      description="Upload images, videos, and other files to use in your marketing content. Drag and drop files or click to upload."
      actionLabel="Upload Media"
    />
  );
}

export function EmptyProducts() {
  return (
    <EmptyState
      icon={Package}
      title="No products yet"
      description="Add products to generate targeted marketing content. Each product can have its own brand voice and marketing strategy."
      actionLabel="Add Product"
      actionHref="/dashboard/products/new"
    />
  );
}

export function EmptySearchResults({ query }: { query: string }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <div className="mb-4 rounded-full bg-muted p-3">
        <FileText className="h-6 w-6 text-muted-foreground" />
      </div>
      <h3 className="mb-2 text-lg font-semibold">No results found</h3>
      <p className="max-w-sm text-sm text-muted-foreground">
        We couldn&apos;t find anything matching &quot;{query}&quot;. Try a different search term or check your filters.
      </p>
    </div>
  );
}
