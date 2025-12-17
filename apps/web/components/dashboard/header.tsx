'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { User } from '@supabase/supabase-js';
import { LogOut, User as UserIcon, Settings, Menu } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MobileNav } from './mobile-nav';
import { GlobalSearch } from '@/components/search/global-search';
import { NotificationBell } from './notification-bell';
import { ThemeToggle } from '@/components/common/theme-toggle';

interface Organization {
  id?: string;
  name?: string;
  slug?: string;
  role: string;
}

interface DashboardHeaderProps {
  user: User;
  organizations: Organization[];
}

export function DashboardHeader({ user, organizations }: DashboardHeaderProps) {
  const router = useRouter();
  const supabase = createClient();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <>
      <header className="flex h-16 items-center justify-between border-b bg-card px-4 md:px-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileNavOpen(true)}
            data-testid="mobile-menu-button"
            aria-label="Open navigation menu"
          >
            <Menu className="h-6 w-6" />
          </Button>
          {organizations.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Welcome! Create your first organization to get started.
            </p>
          )}
        </div>

        <div className="hidden flex-1 justify-center px-4 md:flex">
          <GlobalSearch />
        </div>

        <div className="flex items-center gap-4">
          <ThemeToggle />
          <NotificationBell userId={user.id} />
          <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
                {user.email?.charAt(0).toUpperCase()}
              </div>
              <span className="hidden text-sm md:inline">{user.email}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>My Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push('/dashboard/settings')}>
              <UserIcon className="mr-2 h-4 w-4" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push('/dashboard/settings')}>
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut}>
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
    <MobileNav
      organizations={organizations}
      open={mobileNavOpen}
      onOpenChange={setMobileNavOpen}
    />
    </>
  );
}
