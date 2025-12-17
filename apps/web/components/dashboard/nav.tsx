'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Package,
  Megaphone,
  CheckSquare,
  Calendar,
  BarChart3,
  Settings,
  Plug,
  Shield,
  History,
  Bot,
  FileText,
  FlaskConical,
  Rocket,
  Ear,
  Magnet,
  Building2,
  Search,
  Users,
  Handshake,
  Image,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface Organization {
  id?: string;
  name?: string;
  slug?: string;
  role: string;
}

interface DashboardNavProps {
  organizations: Organization[];
}

const navItems = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard, description: 'Your dashboard command center' },
  { href: '/dashboard/products', label: 'Products', icon: Package, description: 'Manage your products and offerings' },
  { href: '/dashboard/campaigns', label: 'Campaigns', icon: Megaphone, description: 'Create and manage marketing campaigns' },
  { href: '/dashboard/tasks', label: 'Tasks', icon: CheckSquare, description: 'View and manage your tasks' },
  { href: '/dashboard/approvals', label: 'Approvals', icon: CheckSquare, description: 'Review content awaiting approval' },
  { href: '/dashboard/calendar', label: 'Calendar', icon: Calendar, description: 'Schedule and view marketing events' },
  { href: '/dashboard/content', label: 'Content', icon: FileText, description: 'Manage your marketing content' },
  { href: '/dashboard/media', label: 'Media', icon: Image, description: 'Upload and organize media assets' },
  { href: '/dashboard/experiments', label: 'A/B Testing', icon: FlaskConical, description: 'Run experiments to optimize results' },
  { href: '/dashboard/agents', label: 'AI Agents', icon: Bot, description: 'Automate tasks with AI agents' },
  { href: '/dashboard/analytics', label: 'Analytics', icon: BarChart3, description: 'Track performance metrics' },
  { href: '/dashboard/connectors', label: 'Connectors', icon: Plug, description: 'Connect your marketing tools' },
  { href: '/dashboard/policies', label: 'Policies', icon: Shield, description: 'Set guardrails and compliance rules' },
  { href: '/dashboard/audit-log', label: 'Audit Log', icon: History, description: 'View activity and change history' },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings, description: 'Configure your account settings' },
];

const growthItems = [
  { href: '/dashboard/growth', label: 'Growth Overview', icon: Rocket, description: 'Monitor growth metrics and initiatives' },
  { href: '/dashboard/growth/listening', label: 'Social Listening', icon: Ear, description: 'Track brand mentions and conversations' },
  { href: '/dashboard/growth/leads', label: 'Lead Magnets', icon: Magnet, description: 'Create and manage lead capture assets' },
  { href: '/dashboard/growth/visitors', label: 'Visitors', icon: Building2, description: 'Identify and track website visitors' },
  { href: '/dashboard/growth/seo', label: 'SEO Content', icon: Search, description: 'Optimize content for search engines' },
  { href: '/dashboard/growth/referrals', label: 'Referrals', icon: Users, description: 'Manage referral programs' },
  { href: '/dashboard/growth/partnerships', label: 'Partnerships', icon: Handshake, description: 'Track partner relationships' },
];

export function DashboardNav({ organizations }: DashboardNavProps) {
  const pathname = usePathname();

  return (
    <aside className="hidden w-64 flex-shrink-0 border-r bg-card md:block">
      <div className="flex h-16 items-center border-b px-6">
        <Link href="/dashboard" className="flex items-center gap-2">
          <span className="text-lg font-bold">Marketing Pilot</span>
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto p-4">
        <div className="space-y-1">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== '/dashboard' && pathname.startsWith(item.href));
            const Icon = item.icon;

            return (
              <Tooltip key={item.href}>
                <TooltipTrigger asChild>
                  <Link
                    href={item.href}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right">
                  {item.description}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>

        <div className="mt-6">
          <p className="mb-2 px-3 text-xs font-semibold uppercase text-muted-foreground">
            Growth Engine
          </p>
          <div className="space-y-1">
            {growthItems.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== '/dashboard/growth' && pathname.startsWith(item.href));
              const Icon = item.icon;

              return (
                <Tooltip key={item.href}>
                  <TooltipTrigger asChild>
                    <Link
                      href={item.href}
                      className={cn(
                        'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                        isActive
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    {item.description}
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        </div>
      </nav>

      {organizations.length > 0 && (
        <div className="border-t p-4">
          <p className="mb-2 px-3 text-xs font-semibold uppercase text-muted-foreground">
            Organizations
          </p>
          {organizations.map((org) => (
            <div
              key={org.id}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground"
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
    </aside>
  );
}
