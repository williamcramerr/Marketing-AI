import { getCampaigns } from '@/lib/actions/campaigns';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { Plus, Calendar, Target, DollarSign } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { EmptyCampaigns } from '@/components/common/empty-state';
import { TipCard } from '@/components/common/tip-card';

export default async function CampaignsPage() {
  const campaigns = await getCampaigns();

  const getStatusBadgeVariant = (
    status: string
  ): 'draft' | 'planned' | 'active' | 'paused' | 'completed' | 'cancelled' => {
    return status as any;
  };

  const formatCurrency = (cents: number | null) => {
    if (!cents) return '--';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Campaigns</h1>
          <p className="text-muted-foreground">Manage your marketing campaigns</p>
        </div>
        <Link href="/dashboard/campaigns/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Campaign
          </Button>
        </Link>
      </div>

      <TipCard
        id="campaigns-intro"
        title="Organize Your Marketing Efforts"
        description="Create campaigns to organize your marketing efforts by goal. Each campaign can include multiple channels and AI-powered tasks that work together to achieve your objectives."
        variant="info"
      />

      {campaigns && campaigns.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {campaigns.map((campaign) => (
            <Link key={campaign.id} href={`/dashboard/campaigns/${campaign.id}`}>
              <Card className="h-full cursor-pointer transition-shadow hover:shadow-md">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="line-clamp-1">{campaign.name}</CardTitle>
                      <CardDescription className="line-clamp-1">
                        {campaign.products?.name}
                      </CardDescription>
                    </div>
                    <Badge variant={getStatusBadgeVariant(campaign.status)}>
                      {campaign.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {campaign.description && (
                      <p className="line-clamp-2 text-sm text-muted-foreground">
                        {campaign.description}
                      </p>
                    )}

                    <div className="space-y-2">
                      <div className="flex items-center text-sm">
                        <Target className="mr-2 h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">Goal:</span>
                        <span className="ml-1 text-muted-foreground">{campaign.goal}</span>
                      </div>

                      {campaign.start_date && (
                        <div className="flex items-center text-sm">
                          <Calendar className="mr-2 h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">Start:</span>
                          <span className="ml-1 text-muted-foreground">
                            {formatDate(campaign.start_date)}
                          </span>
                        </div>
                      )}

                      {campaign.budget_cents && (
                        <div className="flex items-center text-sm">
                          <DollarSign className="mr-2 h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">Budget:</span>
                          <span className="ml-1 text-muted-foreground">
                            {formatCurrency(campaign.budget_cents)}
                          </span>
                        </div>
                      )}
                    </div>

                    {campaign.channels && campaign.channels.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {campaign.channels.map((channel: string) => (
                          <Badge key={channel} variant="outline" className="text-xs">
                            {channel}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyCampaigns />
      )}
    </div>
  );
}
