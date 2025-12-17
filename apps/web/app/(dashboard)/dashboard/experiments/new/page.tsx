import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ExperimentForm } from '../experiment-form';
import { createClient } from '@/lib/supabase/server';

async function getCampaigns() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  const { data: membership } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', user.id)
    .limit(1)
    .single();

  if (!membership) return [];

  const { data: products } = await supabase
    .from('products')
    .select('id')
    .eq('organization_id', membership.organization_id);

  const productIds = products?.map((p) => p.id) || [];

  if (productIds.length === 0) return [];

  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('id, name')
    .in('product_id', productIds)
    .order('name');

  return campaigns || [];
}

export default async function NewExperimentPage() {
  const campaigns = await getCampaigns();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Create Experiment</h1>
        <p className="text-muted-foreground">
          Set up a new A/B test for your marketing campaign
        </p>
      </div>

      {campaigns.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No Campaigns Available</CardTitle>
            <CardDescription>
              You need to create at least one campaign before you can create experiments.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <ExperimentForm campaigns={campaigns} />
      )}
    </div>
  );
}
