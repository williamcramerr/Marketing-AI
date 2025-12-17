import Link from 'next/link';
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
import { Plus, FlaskConical, Play, Pause, Trophy, ChevronRight } from 'lucide-react';
import { listExperiments } from '@/lib/actions/experiments';
import { getStatusInfo } from '@/lib/utils/experiment-utils';
import { ExperimentActions } from './experiment-actions';
import { DeleteExperimentButton } from './delete-experiment-button';

export default async function ExperimentsPage() {
  const result = await listExperiments();

  if (!result.success) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <h1 className="mb-2 text-2xl font-bold">Error Loading Experiments</h1>
        <p className="text-muted-foreground">{result.error}</p>
      </div>
    );
  }

  const experiments = result.data || [];

  // Stats
  const runningCount = experiments.filter((e) => e.status === 'running').length;
  const completedCount = experiments.filter((e) => e.status === 'completed').length;
  const draftCount = experiments.filter((e) => e.status === 'draft').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">A/B Testing</h1>
          <p className="text-muted-foreground">
            Run experiments to optimize your marketing campaigns
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/experiments/new">
            <Plus className="mr-2 h-4 w-4" />
            New Experiment
          </Link>
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Experiments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{experiments.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Running</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Play className="h-4 w-4 text-green-500" />
              <span className="text-2xl font-bold">{runningCount}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-blue-500" />
              <span className="text-2xl font-bold">{completedCount}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Draft</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{draftCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* Experiments Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Experiments</CardTitle>
          <CardDescription>
            View and manage your A/B tests
          </CardDescription>
        </CardHeader>
        <CardContent>
          {experiments.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Campaign</TableHead>
                  <TableHead>Variants</TableHead>
                  <TableHead>Metric</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Winner</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {experiments.map((experiment) => {
                  const statusInfo = getStatusInfo(experiment.status);
                  const variants = experiment.variants || [];
                  const winnerVariant = experiment.winner_variant
                    ? variants.find((v) => v.id === experiment.winner_variant)
                    : null;

                  return (
                    <TableRow key={experiment.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{experiment.name}</div>
                          {experiment.hypothesis && (
                            <div className="max-w-xs truncate text-xs text-muted-foreground">
                              {experiment.hypothesis}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{experiment.campaign?.name || '-'}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {variants.slice(0, 3).map((variant) => (
                            <Badge key={variant.id} variant="outline" className="text-xs">
                              {variant.name}
                            </Badge>
                          ))}
                          {variants.length > 3 && (
                            <Badge variant="outline" className="text-xs">
                              +{variants.length - 3}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{experiment.metric_name}</TableCell>
                      <TableCell>
                        <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                      </TableCell>
                      <TableCell>
                        {winnerVariant ? (
                          <div className="flex items-center gap-1">
                            <Trophy className="h-3 w-3 text-yellow-500" />
                            <span className="text-sm">{winnerVariant.name}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-2">
                          <ExperimentActions
                            experimentId={experiment.id}
                            status={experiment.status}
                            variants={variants}
                          />
                          <Button variant="outline" size="sm" asChild>
                            <Link href={`/dashboard/experiments/${experiment.id}`}>
                              View
                              <ChevronRight className="ml-1 h-3 w-3" />
                            </Link>
                          </Button>
                          <DeleteExperimentButton
                            experimentId={experiment.id}
                            name={experiment.name}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center justify-center py-12">
              <FlaskConical className="mb-4 h-12 w-12 text-muted-foreground" />
              <h3 className="mb-2 text-lg font-medium">No experiments yet</h3>
              <p className="mb-4 text-sm text-muted-foreground">
                Create your first A/B test to start optimizing
              </p>
              <Button asChild>
                <Link href="/dashboard/experiments/new">
                  <Plus className="mr-2 h-4 w-4" />
                  Create Experiment
                </Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
