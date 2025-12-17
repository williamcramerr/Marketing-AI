import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, Trophy, Users, Target, Clock } from 'lucide-react';
import { getExperiment } from '@/lib/actions/experiments';
import { getStatusInfo } from '@/lib/utils/experiment-utils';
import { ExperimentForm } from '../experiment-form';
import { createClient } from '@/lib/supabase/server';

type PageProps = {
  params: Promise<{ id: string }>;
};

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

export default async function ExperimentDetailPage({ params }: PageProps) {
  const { id } = await params;
  const [experimentResult, campaigns] = await Promise.all([
    getExperiment(id),
    getCampaigns(),
  ]);

  if (!experimentResult.success || !experimentResult.data) {
    notFound();
  }

  const experiment = experimentResult.data;
  const statusInfo = getStatusInfo(experiment.status);
  const variants = experiment.variants || [];
  const results = experiment.results;
  const winnerVariant = experiment.winner_variant
    ? variants.find((v) => v.id === experiment.winner_variant)
    : null;

  // If completed or running with results, show results view
  const showResults = experiment.status === 'completed' || experiment.status === 'running';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/dashboard/experiments">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold">{experiment.name}</h1>
              <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
            </div>
            {experiment.hypothesis && (
              <p className="text-muted-foreground">{experiment.hypothesis}</p>
            )}
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Campaign</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-medium">{experiment.campaign?.name}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Metric</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium capitalize">
                {experiment.metric_name.replace('_', ' ')}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Variants</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{variants.length}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              {experiment.status === 'completed' ? 'Duration' : 'Started'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">
                {experiment.started_at
                  ? new Date(experiment.started_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })
                  : 'Not started'}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Winner Banner */}
      {winnerVariant && (
        <Card className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950">
          <CardContent className="flex items-center gap-4 pt-6">
            <Trophy className="h-8 w-8 text-yellow-500" />
            <div>
              <h3 className="font-semibold">Winner: {winnerVariant.name}</h3>
              <p className="text-sm text-muted-foreground">
                This variant has been declared the winner of this experiment.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results View */}
      {showResults && results && (
        <Card>
          <CardHeader>
            <CardTitle>Results</CardTitle>
            <CardDescription>
              Performance data for each variant
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {variants.map((variant) => {
              const variantResults = results.variants?.[variant.id];
              const isWinner = experiment.winner_variant === variant.id;

              return (
                <div
                  key={variant.id}
                  className={`rounded-lg border p-4 ${isWinner ? 'border-yellow-500 bg-yellow-50/50 dark:bg-yellow-950/50' : ''}`}
                >
                  <div className="mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium">{variant.name}</h4>
                      {isWinner && <Trophy className="h-4 w-4 text-yellow-500" />}
                    </div>
                    <Badge variant="outline">{variant.weight}% traffic</Badge>
                  </div>

                  {variantResults ? (
                    <div className="grid gap-4 md:grid-cols-4">
                      <div>
                        <div className="text-sm text-muted-foreground">Impressions</div>
                        <div className="text-xl font-semibold">
                          {variantResults.impressions.toLocaleString()}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Conversions</div>
                        <div className="text-xl font-semibold">
                          {variantResults.conversions.toLocaleString()}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Conversion Rate</div>
                        <div className="text-xl font-semibold">
                          {(variantResults.conversionRate * 100).toFixed(2)}%
                        </div>
                      </div>
                      {variantResults.confidence !== undefined && (
                        <div>
                          <div className="text-sm text-muted-foreground">Confidence</div>
                          <div className="text-xl font-semibold">
                            {(variantResults.confidence * 100).toFixed(1)}%
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground">
                      No results yet
                    </div>
                  )}
                </div>
              );
            })}

            {results.statisticalSignificance !== undefined && (
              <div className="flex items-center gap-2 text-sm">
                <div
                  className={`h-2 w-2 rounded-full ${results.statisticalSignificance ? 'bg-green-500' : 'bg-yellow-500'}`}
                />
                <span>
                  {results.statisticalSignificance
                    ? 'Results are statistically significant'
                    : 'Results are not yet statistically significant'}
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Variant Configuration (for draft/paused) */}
      {(experiment.status === 'draft' || experiment.status === 'paused') && (
        <Card>
          <CardHeader>
            <CardTitle>Variant Configuration</CardTitle>
            <CardDescription>
              Traffic distribution across variants
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {variants.map((variant) => (
              <div key={variant.id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{variant.name}</span>
                  <span className="text-sm text-muted-foreground">{variant.weight}%</span>
                </div>
                <Progress value={variant.weight} className="h-2" />
                {variant.description && (
                  <p className="text-xs text-muted-foreground">{variant.description}</p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Edit Form (only for draft) */}
      {experiment.status === 'draft' && (
        <>
          <div className="border-t pt-6">
            <h2 className="mb-4 text-xl font-semibold">Edit Experiment</h2>
          </div>
          <ExperimentForm experiment={experiment} campaigns={campaigns} />
        </>
      )}
    </div>
  );
}
