import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Minus,
  CheckCircle,
  XCircle,
  Lightbulb,
  AlertTriangle,
  Target,
  ThumbsUp,
  ThumbsDown,
  Clock,
} from 'lucide-react';
import {
  getAgentState,
  getAgentAnalysisAction,
  getAgentInsights,
} from '@/lib/actions/agent';
import { getAgentDisplayName, getAgentDescription } from '@/lib/utils/agent-utils';
import type { AgentType } from '@/lib/agent/types';
import { ResetAgentButton } from './reset-agent-button';

type PageProps = {
  params: Promise<{ agentName: string }>;
};

const validAgentTypes: AgentType[] = [
  'content_writer',
  'email_marketer',
  'social_manager',
  'seo_optimizer',
  'ad_manager',
  'analyst',
];

const healthColors: Record<string, string> = {
  excellent: 'bg-green-500',
  good: 'bg-blue-500',
  needs_attention: 'bg-yellow-500',
  poor: 'bg-red-500',
};

const trendIcons = {
  improving: TrendingUp,
  stable: Minus,
  declining: TrendingDown,
};

const trendColors = {
  improving: 'text-green-500',
  stable: 'text-gray-500',
  declining: 'text-red-500',
};

const insightIcons = {
  improvement: CheckCircle,
  pattern: Target,
  warning: AlertTriangle,
  recommendation: Lightbulb,
};

const insightColors = {
  improvement: 'text-green-500',
  pattern: 'text-blue-500',
  warning: 'text-yellow-500',
  recommendation: 'text-purple-500',
};

export default async function AgentDetailPage({ params }: PageProps) {
  const { agentName } = await params;

  if (!validAgentTypes.includes(agentName as AgentType)) {
    notFound();
  }

  const [stateResult, analysisResult, insightsResult] = await Promise.all([
    getAgentState(agentName as AgentType),
    getAgentAnalysisAction(agentName as AgentType),
    getAgentInsights(agentName as AgentType),
  ]);

  if (!stateResult.success || !stateResult.data) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <h1 className="mb-2 text-2xl font-bold">Error Loading Agent</h1>
        <p className="text-muted-foreground">{stateResult.error}</p>
      </div>
    );
  }

  const agent = stateResult.data;
  const analysis = analysisResult.data;
  const insights = insightsResult.data || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/dashboard/agents">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{getAgentDisplayName(agentName as AgentType)}</h1>
            <p className="text-muted-foreground">
              {getAgentDescription(agentName as AgentType)}
            </p>
          </div>
        </div>
        <ResetAgentButton agentName={agentName as AgentType} />
      </div>

      {/* Health Overview */}
      {analysis && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Overall Health</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <div
                  className={`h-3 w-3 rounded-full ${healthColors[analysis.overallHealth]}`}
                />
                <span className="text-lg font-semibold capitalize">
                  {analysis.overallHealth.replace('_', ' ')}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Tasks Processed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analysis.totalTasksProcessed}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analysis.successRate.toFixed(1)}%</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Avg Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {(analysis.averagePerformanceScore * 100).toFixed(1)}%
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Trends */}
      {analysis && analysis.trends.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Performance Trends</CardTitle>
            <CardDescription>How key metrics have changed over time</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {analysis.trends.map((trend) => {
                const TrendIcon = trendIcons[trend.trend];
                return (
                  <div key={trend.metric} className="flex items-center gap-3 rounded-lg border p-3">
                    <TrendIcon className={`h-5 w-5 ${trendColors[trend.trend]}`} />
                    <div>
                      <div className="text-sm font-medium capitalize">
                        {trend.metric.replace('_', ' ')}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-sm ${trendColors[trend.trend]}`}>
                          {trend.change > 0 ? '+' : ''}
                          {(trend.change * 100).toFixed(1)}%
                        </span>
                        <span className="text-xs text-muted-foreground">{trend.period}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Insights */}
      {insights.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Learning Insights</CardTitle>
            <CardDescription>
              AI-generated insights based on performance patterns
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {insights.map((insight) => {
              const InsightIcon = insightIcons[insight.type];
              return (
                <div key={insight.id} className="rounded-lg border p-4">
                  <div className="flex items-start gap-3">
                    <InsightIcon className={`mt-0.5 h-5 w-5 ${insightColors[insight.type]}`} />
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium">{insight.title}</h4>
                        <Badge variant="outline" className="capitalize">
                          {insight.type}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{insight.description}</p>
                      {insight.evidence.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {insight.evidence.map((ev, i) => (
                            <Badge key={i} variant="secondary">
                              {ev.metric}: {(ev.improvement * 100).toFixed(1)}% improvement
                            </Badge>
                          ))}
                        </div>
                      )}
                      {insight.suggestedAction && (
                        <div className="mt-2 rounded-md bg-primary/5 p-2 text-sm">
                          <span className="font-medium">Suggested Action:</span>{' '}
                          {insight.suggestedAction}
                        </div>
                      )}
                      <div className="text-xs text-muted-foreground">
                        Confidence: {(insight.confidence * 100).toFixed(0)}%
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Success Patterns */}
      {agent.memory?.successPatterns && agent.memory.successPatterns.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <ThumbsUp className="h-5 w-5 text-green-500" />
              <CardTitle>Success Patterns</CardTitle>
            </div>
            <CardDescription>Patterns that have proven effective</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pattern</TableHead>
                  <TableHead>Task Types</TableHead>
                  <TableHead className="text-right">Performance Boost</TableHead>
                  <TableHead className="text-right">Usage Count</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {agent.memory.successPatterns.map((pattern) => (
                  <TableRow key={pattern.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{pattern.pattern}</div>
                        <div className="text-sm text-muted-foreground">{pattern.description}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {pattern.taskTypes.map((type) => (
                          <Badge key={type} variant="outline" className="text-xs">
                            {type}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-green-600">
                      +{(pattern.performanceBoost * 100).toFixed(0)}%
                    </TableCell>
                    <TableCell className="text-right">{pattern.usageCount}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Anti-Patterns */}
      {agent.memory?.antiPatterns && agent.memory.antiPatterns.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <ThumbsDown className="h-5 w-5 text-red-500" />
              <CardTitle>Anti-Patterns</CardTitle>
            </div>
            <CardDescription>Patterns to avoid based on past performance</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pattern</TableHead>
                  <TableHead>Reason to Avoid</TableHead>
                  <TableHead>Task Types</TableHead>
                  <TableHead className="text-right">Occurrences</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {agent.memory.antiPatterns.map((pattern) => (
                  <TableRow key={pattern.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{pattern.pattern}</div>
                        <div className="text-sm text-muted-foreground">{pattern.description}</div>
                      </div>
                    </TableCell>
                    <TableCell className="text-red-600">{pattern.reason}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {pattern.taskTypes.map((type) => (
                          <Badge key={type} variant="outline" className="text-xs">
                            {type}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{pattern.occurrences}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Learned Preferences */}
      {agent.learned_preferences && (
        <Card>
          <CardHeader>
            <CardTitle>Learned Preferences</CardTitle>
            <CardDescription>
              Content style and messaging preferences learned from your feedback
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Content Style */}
            {agent.learned_preferences.contentStyle && (
              <div className="space-y-3">
                <h4 className="font-medium">Content Style</h4>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  {agent.learned_preferences.contentStyle.preferredTone?.length > 0 && (
                    <div>
                      <div className="text-sm text-muted-foreground">Preferred Tone</div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {agent.learned_preferences.contentStyle.preferredTone.map((tone) => (
                          <Badge key={tone} variant="secondary">
                            {tone}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {agent.learned_preferences.contentStyle.formalityLevel !== undefined && (
                    <div>
                      <div className="text-sm text-muted-foreground">Formality Level</div>
                      <div className="mt-2 flex items-center gap-2">
                        <Progress
                          value={agent.learned_preferences.contentStyle.formalityLevel * 10}
                          className="h-2"
                        />
                        <span className="text-sm">
                          {agent.learned_preferences.contentStyle.formalityLevel}/10
                        </span>
                      </div>
                    </div>
                  )}
                  {agent.learned_preferences.contentStyle.sentenceLength && (
                    <div>
                      <div className="text-sm text-muted-foreground">Sentence Length</div>
                      <div className="mt-1 capitalize">
                        {agent.learned_preferences.contentStyle.sentenceLength}
                      </div>
                    </div>
                  )}
                  {agent.learned_preferences.contentStyle.useEmojis !== undefined && (
                    <div>
                      <div className="text-sm text-muted-foreground">Use Emojis</div>
                      <div className="mt-1">
                        {agent.learned_preferences.contentStyle.useEmojis ? 'Yes' : 'No'}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Messaging Preferences */}
            {agent.learned_preferences.messaging && (
              <div className="space-y-3">
                <h4 className="font-medium">Messaging</h4>
                <div className="grid gap-4 md:grid-cols-2">
                  {agent.learned_preferences.messaging.effectiveHooks?.length > 0 && (
                    <div>
                      <div className="text-sm text-muted-foreground">Effective Hooks</div>
                      <ul className="mt-1 list-inside list-disc text-sm">
                        {agent.learned_preferences.messaging.effectiveHooks
                          .slice(0, 5)
                          .map((hook, i) => (
                            <li key={i}>{hook}</li>
                          ))}
                      </ul>
                    </div>
                  )}
                  {agent.learned_preferences.messaging.preferredCTAs?.length > 0 && (
                    <div>
                      <div className="text-sm text-muted-foreground">Preferred CTAs</div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {agent.learned_preferences.messaging.preferredCTAs.map((cta) => (
                          <Badge key={cta} variant="outline">
                            {cta}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Recent Interactions */}
      {agent.memory?.recentInteractions && agent.memory.recentInteractions.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              <CardTitle>Recent Interactions</CardTitle>
            </div>
            <CardDescription>Last 10 tasks processed by this agent</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Task Type</TableHead>
                  <TableHead>Summary</TableHead>
                  <TableHead>Outcome</TableHead>
                  <TableHead>Feedback</TableHead>
                  <TableHead className="text-right">Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {agent.memory.recentInteractions.slice(0, 10).map((interaction) => (
                  <TableRow key={interaction.taskId}>
                    <TableCell className="capitalize">
                      {interaction.taskType.replace('_', ' ')}
                    </TableCell>
                    <TableCell className="max-w-xs truncate">
                      {interaction.contentSummary}
                    </TableCell>
                    <TableCell>
                      {interaction.outcome === 'success' ? (
                        <Badge variant="success">Success</Badge>
                      ) : interaction.outcome === 'failure' ? (
                        <Badge variant="destructive">Failed</Badge>
                      ) : (
                        <Badge variant="warning">Pending</Badge>
                      )}
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                      {interaction.userFeedback || '-'}
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {new Date(interaction.timestamp).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Areas for Improvement */}
      {analysis && analysis.areasForImprovement.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Areas for Improvement</CardTitle>
            <CardDescription>
              Focus areas identified based on performance analysis
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {analysis.areasForImprovement.map((area, i) => (
                <li key={i} className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 text-yellow-500" />
                  <span>{area}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
