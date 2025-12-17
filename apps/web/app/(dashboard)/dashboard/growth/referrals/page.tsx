import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import Link from 'next/link';
import {
  Users,
  Gift,
  DollarSign,
  TrendingUp,
  Plus,
  ArrowRight,
  Share2,
  CheckCircle,
  Clock,
  Link as LinkIcon,
} from 'lucide-react';

const statusColors: Record<string, string> = {
  clicked: 'bg-gray-100 text-gray-800',
  signed_up: 'bg-blue-100 text-blue-800',
  qualified: 'bg-yellow-100 text-yellow-800',
  converted: 'bg-green-100 text-green-800',
  rewarded: 'bg-purple-100 text-purple-800',
};

export default async function ReferralsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: membership } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', user!.id)
    .limit(1)
    .single();

  if (!membership) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <h1 className="mb-2 text-2xl font-bold">No Organization Found</h1>
        <p className="text-muted-foreground">Please create an organization first.</p>
      </div>
    );
  }

  // Fetch referral programs
  const { data: programs } = await supabase
    .from('referral_programs')
    .select('*')
    .eq('organization_id', membership.organization_id)
    .order('created_at', { ascending: false });

  // Fetch referral links
  const { data: links } = await supabase
    .from('referral_links')
    .select(`
      *,
      referral_programs (name)
    `)
    .in('program_id', programs?.map(p => p.id) || ['none'])
    .order('created_at', { ascending: false })
    .limit(20);

  // Fetch recent referrals
  const { data: referrals } = await supabase
    .from('referrals')
    .select(`
      *,
      referral_links (code, referrer_user_id)
    `)
    .in('link_id', links?.map(l => l.id) || ['none'])
    .order('created_at', { ascending: false })
    .limit(20);

  // Calculate stats
  const totalReferrals = programs?.reduce((sum, p) => sum + (p.total_referrals || 0), 0) || 0;
  const totalConversions = programs?.reduce((sum, p) => sum + (p.total_conversions || 0), 0) || 0;
  const activePrograms = programs?.filter(p => p.active).length || 0;
  const conversionRate = totalReferrals > 0 ? ((totalConversions / totalReferrals) * 100).toFixed(1) : 0;

  const getRewardDisplay = (type: string, amount: number) => {
    switch (type) {
      case 'credit':
        return `$${(amount / 100).toFixed(0)} credit`;
      case 'discount_percent':
        return `${amount}% off`;
      case 'discount_fixed':
        return `$${(amount / 100).toFixed(0)} off`;
      case 'free_month':
        return `${amount} free month${amount > 1 ? 's' : ''}`;
      default:
        return `${amount} ${type}`;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Referral Programs</h1>
          <p className="text-muted-foreground">
            Turn happy customers into advocates with referral rewards
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/growth/referrals/new">
            <Plus className="mr-2 h-4 w-4" />
            New Program
          </Link>
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Referrals</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalReferrals}</div>
            <p className="text-xs text-muted-foreground">all time</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conversions</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{totalConversions}</div>
            <p className="text-xs text-muted-foreground">{conversionRate}% rate</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Programs</CardTitle>
            <Gift className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activePrograms}</div>
            <p className="text-xs text-muted-foreground">of {programs?.length || 0} total</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Links</CardTitle>
            <LinkIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{links?.filter(l => l.active).length || 0}</div>
            <p className="text-xs text-muted-foreground">referral links</p>
          </CardContent>
        </Card>
      </div>

      {/* Programs List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Gift className="h-5 w-5" />
              <div>
                <CardTitle>Referral Programs</CardTitle>
                <CardDescription>
                  Configure rewards for referrers and new customers
                </CardDescription>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {programs && programs.length > 0 ? (
            <div className="space-y-4">
              {programs.map((program) => (
                <div
                  key={program.id}
                  className="flex items-center justify-between rounded-lg border p-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium">{program.name}</h3>
                      {program.active ? (
                        <Badge className="bg-green-100 text-green-800">Active</Badge>
                      ) : (
                        <Badge variant="secondary">Inactive</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {program.description || 'No description'}
                    </p>
                    <div className="flex gap-4 text-sm">
                      <span>
                        Referrer: {getRewardDisplay(program.referrer_reward_type, program.referrer_reward_amount)}
                      </span>
                      <span>
                        Referee: {getRewardDisplay(program.referee_reward_type, program.referee_reward_amount)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-2xl font-bold">{program.total_conversions || 0}</p>
                      <p className="text-xs text-muted-foreground">
                        of {program.total_referrals || 0} referrals
                      </p>
                    </div>
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/dashboard/growth/referrals/${program.id}`}>
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex h-32 flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
              <Gift className="h-8 w-8 opacity-50" />
              <p>No referral programs yet</p>
              <Button asChild size="sm">
                <Link href="/dashboard/growth/referrals/new">
                  <Plus className="mr-2 h-4 w-4" />
                  Create Your First Program
                </Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Referrals */}
      {referrals && referrals.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Referrals</CardTitle>
            <CardDescription>
              Track the status of recent referral signups
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Referral Code</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Clicked</TableHead>
                  <TableHead>Signed Up</TableHead>
                  <TableHead>Converted</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {referrals.map((referral) => (
                  <TableRow key={referral.id}>
                    <TableCell className="font-medium">
                      {referral.referral_links?.code || '-'}
                    </TableCell>
                    <TableCell>{referral.referred_email || '-'}</TableCell>
                    <TableCell>
                      <Badge className={statusColors[referral.status] || statusColors.clicked}>
                        {referral.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(referral.clicked_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {referral.signed_up_at
                        ? new Date(referral.signed_up_at).toLocaleDateString()
                        : '-'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {referral.converted_at
                        ? new Date(referral.converted_at).toLocaleDateString()
                        : '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* My Referral Links (for current user) */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Your Referral Links</CardTitle>
              <CardDescription>
                Share these links to earn rewards
              </CardDescription>
            </div>
            <Button variant="outline" asChild>
              <Link href="/dashboard/growth/referrals/my-referrals">
                <Share2 className="mr-2 h-4 w-4" />
                View My Referrals
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {links && links.filter(l => l.referrer_user_id === user?.id).length > 0 ? (
            <div className="space-y-2">
              {links.filter(l => l.referrer_user_id === user?.id).slice(0, 3).map((link) => (
                <div
                  key={link.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div>
                    <p className="font-medium">{link.referral_programs?.name}</p>
                    <code className="text-sm text-muted-foreground">
                      {process.env.NEXT_PUBLIC_APP_URL}/ref/{link.code}
                    </code>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-sm text-muted-foreground">
                      {link.click_count} clicks · {link.conversion_count} conversions
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              You don&apos;t have any referral links yet. Join an active program to get started.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
