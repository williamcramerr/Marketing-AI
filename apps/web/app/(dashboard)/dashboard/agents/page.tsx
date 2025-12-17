import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import {
  Bot,
  PenTool,
  Mail,
  Share2,
  Search,
  Target,
  TrendingUp,
  ChevronRight,
  Activity,
  Brain,
  Lightbulb,
} from 'lucide-react';
import { getAllAgentStates } from '@/lib/actions/agent';
import { getAgentDisplayName, getAgentDescription } from '@/lib/utils/agent-utils';
import type { AgentType, AgentState } from '@/lib/agent/types';
import { TipCard } from '@/components/common/tip-card';

const agentIcons: Record<AgentType, typeof Bot> = {
  content_writer: PenTool,
  email_marketer: Mail,
  social_manager: Share2,
  seo_optimizer: Search,
  ad_manager: Target,
  analyst: TrendingUp,
};

const healthColors: Record<string, string> = {
  excellent: 'bg-green-500',
  good: 'bg-blue-500',
  needs_attention: 'bg-yellow-500',
  poor: 'bg-red-500',
};

const healthBadgeVariants: Record<string, 'success' | 'info' | 'warning' | 'destructive'> = {
  excellent: 'success',
  good: 'info',
  needs_attention: 'warning',
  poor: 'destructive',
};

function calculateHealth(agent: AgentState): string {
  const history = agent.performance_history || [];
  if (history.length === 0) return 'good';

  const recentHistory = history.slice(-10);
  const avgScore =
    recentHistory.reduce((sum, entry) => {
      const metrics = entry.metrics || {};
      const scores = Object.values(metrics).filter((v): v is number => typeof v === 'number');
      return sum + (scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0.5);
    }, 0) / recentHistory.length;

  if (avgScore >= 0.8) return 'excellent';
  if (avgScore >= 0.6) return 'good';
  if (avgScore >= 0.4) return 'needs_attention';
  return 'poor';
}

function calculateSuccessRate(agent: AgentState): number {
  const interactions = agent.memory?.recentInteractions || [];
  if (interactions.length === 0) return 0;

  const successful = interactions.filter((i) => i.outcome === 'success').length;
  return Math.round((successful / interactions.length) * 100);
}

function getHealthScore(agent: AgentState): number {
  const health = calculateHealth(agent);
  const scores: Record<string, number> = {
    excellent: 95,
    good: 75,
    needs_attention: 50,
    poor: 25,
  };
  return scores[health] || 50;
}

export default async function AgentsPage() {
  const result = await getAllAgentStates();

  if (!result.success) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <h1 className="mb-2 text-2xl font-bold">Error Loading Agents</h1>
        <p className="text-muted-foreground">{result.error}</p>
      </div>
    );
  }

  const agents = result.data || [];

  // Calculate overall stats
  const totalTasks = agents.reduce(
    (sum, agent) => sum + (agent.performance_history?.length || 0),
    0
  );
  const avgSuccessRate =
    agents.length > 0
      ? agents.reduce((sum, agent) => sum + calculateSuccessRate(agent), 0) / agents.length
      : 0;
  const totalPatterns = agents.reduce(
    (sum, agent) =>
      sum + (agent.memory?.successPatterns?.length || 0) + (agent.memory?.antiPatterns?.length || 0),
    0
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">AI Agents</h1>
          <p className="text-muted-foreground">
            Monitor and manage your autonomous marketing agents
          </p>
        </div>
      </div>

      <TipCard
        id="ai-agents-intro"
        title="Meet Your AI Marketing Team"
        description="AI agents can automate repetitive marketing tasks for you. Each agent specializes in a specific area like content writing, email marketing, or SEO optimization."
        variant="info"
      />

      {/* Overview Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tasks Processed</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalTasks.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Across all agents</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Success Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgSuccessRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">Based on recent interactions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Patterns Learned</CardTitle>
            <Brain className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalPatterns}</div>
            <p className="text-xs text-muted-foreground">Success and anti-patterns</p>
          </CardContent>
        </Card>
      </div>

      {/* Agent Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {agents.map((agent) => {
          const Icon = agentIcons[agent.agent_name] || Bot;
          const health = calculateHealth(agent);
          const healthScore = getHealthScore(agent);
          const successRate = calculateSuccessRate(agent);
          const taskCount = agent.performance_history?.length || 0;
          const patternsCount =
            (agent.memory?.successPatterns?.length || 0) +
            (agent.memory?.antiPatterns?.length || 0);

          return (
            <Card key={agent.id} className="relative overflow-hidden">
              <div className={`absolute left-0 top-0 h-1 w-full ${healthColors[health]}`} />
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-base">
                        {getAgentDisplayName(agent.agent_name)}
                      </CardTitle>
                      <Badge variant={healthBadgeVariants[health]} className="mt-1 capitalize">
                        {health.replace('_', ' ')}
                      </Badge>
                    </div>
                  </div>
                </div>
                <CardDescription className="mt-2">
                  {getAgentDescription(agent.agent_name)}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Health Score */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Health Score</span>
                    <span className="font-medium">{healthScore}%</span>
                  </div>
                  <Progress
                    value={healthScore}
                    className="h-2"
                    indicatorClassName={healthColors[health]}
                  />
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-lg font-semibold">{taskCount}</div>
                    <div className="text-xs text-muted-foreground">Tasks</div>
                  </div>
                  <div>
                    <div className="text-lg font-semibold">{successRate}%</div>
                    <div className="text-xs text-muted-foreground">Success</div>
                  </div>
                  <div>
                    <div className="text-lg font-semibold">{patternsCount}</div>
                    <div className="text-xs text-muted-foreground">Patterns</div>
                  </div>
                </div>

                {/* Recent Activity */}
                {agent.last_run_at && (
                  <div className="text-xs text-muted-foreground">
                    Last active:{' '}
                    {new Date(agent.last_run_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                )}

                {/* View Details Button */}
                <Button variant="outline" className="w-full" asChild>
                  <Link href={`/dashboard/agents/${agent.agent_name}`}>
                    View Details
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Learning Insights Summary */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-yellow-500" />
            <CardTitle>How the Learning System Works</CardTitle>
          </div>
          <CardDescription>
            Your AI agents continuously learn from performance data and user feedback
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-3">
            <div className="space-y-2">
              <h4 className="font-medium">Performance Tracking</h4>
              <p className="text-sm text-muted-foreground">
                Each task is tracked with metrics like engagement rates, conversions, and user
                approval. Agents learn which approaches work best for your audience.
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium">Pattern Recognition</h4>
              <p className="text-sm text-muted-foreground">
                The system identifies successful patterns (what works) and anti-patterns (what to
                avoid) based on historical performance data.
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium">Adaptive Learning</h4>
              <p className="text-sm text-muted-foreground">
                User feedback and corrections are incorporated into the learning model, allowing
                agents to adapt to your brand voice and preferences.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
