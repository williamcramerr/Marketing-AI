import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import {
  Rocket,
  Ear,
  Magnet,
  Building2,
  Search,
  Users,
  Handshake,
  ArrowRight,
  MessageSquare,
  UserPlus,
  TrendingUp,
} from 'lucide-react';

export default async function GrowthDashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Get user's organizations
  const { data: memberships } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', user!.id);

  const orgIds = memberships?.map((m) => m.organization_id) || [];

  // TODO: Once tables are created, fetch real stats
  // For now, show placeholder values
  const conversationsToday = 0;
  const leadsThisWeek = 0;
  const highIntentVisitors = 0;
  const keywordsTracked = 0;

  const features = [
    {
      title: 'Social Listening',
      description: 'Monitor Twitter, Reddit, and LinkedIn for opportunities to engage with potential customers',
      href: '/dashboard/growth/listening',
      icon: Ear,
      color: 'bg-blue-500/10 text-blue-500',
      stats: 'Find people asking for recommendations',
    },
    {
      title: 'Lead Magnets',
      description: 'Create downloadable content and nurture sequences to capture and convert leads',
      href: '/dashboard/growth/leads',
      icon: Magnet,
      color: 'bg-purple-500/10 text-purple-500',
      stats: 'Build your owned audience',
    },
    {
      title: 'Website Visitors',
      description: 'Identify which companies are visiting your website and track their engagement',
      href: '/dashboard/growth/visitors',
      icon: Building2,
      color: 'bg-green-500/10 text-green-500',
      stats: 'Turn anonymous traffic into leads',
    },
    {
      title: 'SEO Content',
      description: 'Research keywords, create briefs, and generate SEO-optimized content',
      href: '/dashboard/growth/seo',
      icon: Search,
      color: 'bg-orange-500/10 text-orange-500',
      stats: 'Drive organic traffic at scale',
    },
    {
      title: 'Referral Program',
      description: 'Create referral programs to turn happy customers into advocates',
      href: '/dashboard/growth/referrals',
      icon: Users,
      color: 'bg-pink-500/10 text-pink-500',
      stats: 'Grow through word-of-mouth',
    },
    {
      title: 'Partnerships',
      description: 'Discover partnership opportunities with complementary businesses',
      href: '/dashboard/growth/partnerships',
      icon: Handshake,
      color: 'bg-cyan-500/10 text-cyan-500',
      stats: 'Expand your reach through partners',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Growth Engine</h1>
          <p className="text-muted-foreground">
            Find and attract new customers with these growth tools
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Rocket className="h-8 w-8 text-primary" />
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conversations Found</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{conversationsToday}</div>
            <p className="text-xs text-muted-foreground">Today via social listening</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Leads Captured</CardTitle>
            <UserPlus className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{leadsThisWeek}</div>
            <p className="text-xs text-muted-foreground">This week from lead magnets</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">High-Intent Visitors</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{highIntentVisitors}</div>
            <p className="text-xs text-muted-foreground">Companies on your site</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Keywords Tracked</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{keywordsTracked}</div>
            <p className="text-xs text-muted-foreground">SEO rankings monitored</p>
          </CardContent>
        </Card>
      </div>

      {/* Feature Cards */}
      <div>
        <h2 className="mb-4 text-lg font-semibold">Growth Tools</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <Link key={feature.href} href={feature.href}>
                <Card className="h-full cursor-pointer transition-shadow hover:shadow-md">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className={`rounded-lg p-2 ${feature.color}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <CardTitle className="text-lg">{feature.title}</CardTitle>
                    <CardDescription>{feature.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">{feature.stats}</p>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Getting Started Section */}
      <Card>
        <CardHeader>
          <CardTitle>Getting Started</CardTitle>
          <CardDescription>
            Set up your Growth Engine to start attracting new customers
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-lg border p-4">
              <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                1
              </div>
              <h3 className="mb-1 font-medium">Configure Social Listening</h3>
              <p className="text-sm text-muted-foreground">
                Add keywords related to your product to monitor conversations
              </p>
              <Link href="/dashboard/growth/listening/configs/new">
                <Button variant="link" className="mt-2 h-auto p-0">
                  Set up listening <ArrowRight className="ml-1 h-3 w-3" />
                </Button>
              </Link>
            </div>

            <div className="rounded-lg border p-4">
              <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                2
              </div>
              <h3 className="mb-1 font-medium">Create a Lead Magnet</h3>
              <p className="text-sm text-muted-foreground">
                Offer valuable content to capture email addresses
              </p>
              <Link href="/dashboard/growth/leads/magnets/new">
                <Button variant="link" className="mt-2 h-auto p-0">
                  Create magnet <ArrowRight className="ml-1 h-3 w-3" />
                </Button>
              </Link>
            </div>

            <div className="rounded-lg border p-4">
              <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                3
              </div>
              <h3 className="mb-1 font-medium">Add Visitor Tracking</h3>
              <p className="text-sm text-muted-foreground">
                Identify companies visiting your website
              </p>
              <Link href="/dashboard/growth/visitors/tracking">
                <Button variant="link" className="mt-2 h-auto p-0">
                  Get tracking code <ArrowRight className="ml-1 h-3 w-3" />
                </Button>
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
