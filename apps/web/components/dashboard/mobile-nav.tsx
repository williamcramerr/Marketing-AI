'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Package,
  Megaphone,
  CheckSquare,
  BarChart3,
  Settings,
  Plug,
  Shield,
  History,
  Bot,
  FileText,
  FlaskConical,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

interface Organization {
  id?: string;
  name?: string;
  slug?: string;
  role: string;
}

interface MobileNavProps {
  organizations: Organization[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const navItems = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/dashboard/products', label: 'Products', icon: Package },
  { href: '/dashboard/campaigns', label: 'Campaigns', icon: Megaphone },
  { href: '/dashboard/tasks', label: 'Tasks', icon: CheckSquare },
  { href: '/dashboard/approvals', label: 'Approvals', icon: CheckSquare },
  { href: '/dashboard/content', label: 'Content', icon: FileText },
  { href: '/dashboard/experiments', label: 'A/B Testing', icon: FlaskConical },
  { href: '/dashboard/agents', label: 'AI Agents', icon: Bot },
  { href: '/dashboard/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/dashboard/connectors', label: 'Connectors', icon: Plug },
  { href: '/dashboard/policies', label: 'Policies', icon: Shield },
  { href: '/dashboard/audit-log', label: 'Audit Log', icon: History },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings },
];

export function MobileNav({ organizations, open, onOpenChange }: MobileNavProps) {
  const pathname = usePathname();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-[280px] p-0">
        <SheetHeader className="border-b p-6">
          <SheetTitle className="text-left">
            <Link
              href="/dashboard"
              className="flex items-center gap-2"
              onClick={() => onOpenChange(false)}
            >
              <span className="text-lg font-bold">Marketing Pilot</span>
            </Link>
          </SheetTitle>
        </SheetHeader>

        <nav className="space-y-1 p-4">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== '/dashboard' && pathname.startsWith(item.href));
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => onOpenChange(false)}
                className={cn(
                  'flex min-h-[44px] items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {organizations.length > 0 && (
          <div className="border-t p-4">
            <p className="mb-2 px-3 text-xs font-semibold uppercase text-muted-foreground">
              Organizations
            </p>
            {organizations.map((org) => (
              <div
                key={org.id}
                className="flex min-h-[44px] items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground"
              >
                <div className="flex h-6 w-6 items-center justify-center rounded bg-primary/10 text-xs font-medium text-primary">
                  {org.name?.charAt(0).toUpperCase()}
                </div>
                <span className="truncate">{org.name}</span>
                <span className="ml-auto text-xs capitalize">{org.role}</span>
              </div>
            ))}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
