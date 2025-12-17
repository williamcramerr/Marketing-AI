'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { useSearch } from '@/hooks/use-search';
import {
  Package,
  Megaphone,
  CheckSquare,
  FileText,
  Search,
  Loader2,
  Plus,
  Settings,
  BarChart3,
  Calendar,
} from 'lucide-react';
import type { SearchResult } from '@/app/api/search/route';

const getResultIcon = (type: SearchResult['type']) => {
  switch (type) {
    case 'task':
      return CheckSquare;
    case 'campaign':
      return Megaphone;
    case 'product':
      return Package;
    case 'content_asset':
      return FileText;
    default:
      return FileText;
  }
};

const getResultTypeLabel = (type: SearchResult['type']) => {
  switch (type) {
    case 'task':
      return 'Task';
    case 'campaign':
      return 'Campaign';
    case 'product':
      return 'Product';
    case 'content_asset':
      return 'Content';
    default:
      return type;
  }
};

const quickActions = [
  { label: 'Create Campaign', href: '/dashboard/campaigns/new', icon: Plus, shortcut: 'C' },
  { label: 'Create Product', href: '/dashboard/products/new', icon: Plus, shortcut: 'P' },
  { label: 'View Analytics', href: '/dashboard/analytics', icon: BarChart3, shortcut: 'A' },
  { label: 'View Calendar', href: '/dashboard/calendar', icon: Calendar, shortcut: 'L' },
  { label: 'Settings', href: '/dashboard/settings', icon: Settings, shortcut: 'S' },
];

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { query, setQuery, results, isLoading, clearResults } = useSearch({ debounceMs: 300 });

  // Open with Cmd+K or Ctrl+K
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  // Clear results when closing
  useEffect(() => {
    if (!open) {
      clearResults();
    }
  }, [open, clearResults]);

  const handleSelect = useCallback(
    (url: string) => {
      setOpen(false);
      router.push(url);
    },
    [router]
  );

  // Group results by type
  const groupedResults = results.reduce(
    (acc, result) => {
      if (!acc[result.type]) {
        acc[result.type] = [];
      }
      acc[result.type].push(result);
      return acc;
    },
    {} as Record<SearchResult['type'], SearchResult[]>
  );

  const hasResults = results.length > 0;
  const showQuickActions = !query || query.length < 2;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex h-9 w-full items-center gap-2 rounded-md border bg-background px-3 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground md:w-64 lg:w-80"
      >
        <Search className="h-4 w-4" />
        <span className="flex-1 text-left">Search...</span>
        <kbd className="pointer-events-none hidden select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-xs font-medium text-muted-foreground opacity-100 sm:flex">
          <span className="text-xs">⌘</span>K
        </kbd>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          placeholder="Search tasks, campaigns, products..."
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          {isLoading && (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {!isLoading && !hasResults && query.length >= 2 && (
            <CommandEmpty>No results found for &quot;{query}&quot;</CommandEmpty>
          )}

          {!isLoading && showQuickActions && (
            <CommandGroup heading="Quick Actions">
              {quickActions.map((action) => {
                const Icon = action.icon;
                return (
                  <CommandItem
                    key={action.href}
                    value={action.label}
                    onSelect={() => handleSelect(action.href)}
                  >
                    <Icon className="mr-2 h-4 w-4" />
                    <span>{action.label}</span>
                    <kbd className="ml-auto pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-xs font-medium text-muted-foreground opacity-100">
                      {action.shortcut}
                    </kbd>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          )}

          {!isLoading && hasResults && (
            <>
              {Object.entries(groupedResults).map(([type, typeResults], index) => {
                const Icon = getResultIcon(type as SearchResult['type']);
                return (
                  <div key={type}>
                    {index > 0 && <CommandSeparator />}
                    <CommandGroup heading={`${getResultTypeLabel(type as SearchResult['type'])}s`}>
                      {typeResults.map((result) => (
                        <CommandItem
                          key={result.id}
                          value={`${result.title}-${result.id}`}
                          onSelect={() => handleSelect(result.url)}
                        >
                          <Icon className="mr-2 h-4 w-4" />
                          <div className="flex flex-col">
                            <span>{result.title}</span>
                            {result.description && (
                              <span className="text-xs text-muted-foreground">
                                {result.description}
                              </span>
                            )}
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </div>
                );
              })}
            </>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}
