/**
 * Agent Learning System
 *
 * Core system for learning from task performance, user feedback,
 * and metrics to continuously improve content generation.
 */

import type {
  AgentState,
  AgentType,
  AgentMemory,
  LearnedPreferences,
  PerformanceEntry,
  PerformanceMetrics,
  FeedbackInput,
  LearningInsight,
  AgentAnalysis,
  SuccessPattern,
  AntiPattern,
  InteractionSummary,
  TaskTypeLearning,
} from './types';

/**
 * Default agent memory structure
 */
function createDefaultMemory(): AgentMemory {
  return {
    organizationContext: {},
    taskLearnings: {},
    recentInteractions: [],
    successPatterns: [],
    antiPatterns: [],
  };
}

/**
 * Default learned preferences structure
 */
function createDefaultPreferences(): LearnedPreferences {
  return {
    contentStyle: {
      preferredTone: ['professional', 'friendly'],
      avoiTones: ['aggressive', 'overly-formal'],
      sentenceLength: 'medium',
      paragraphLength: 'medium',
      useEmojis: false,
      formalityLevel: 6,
    },
    messaging: {
      preferredCTAs: [],
      effectiveHooks: [],
      topPerformingSubjectLines: [],
      preferredHeadlineFormulas: [],
    },
    audiencePatterns: {},
    channelPreferences: {},
    productPreferences: {},
  };
}

/**
 * Initialize or get agent state for an organization
 */
export async function getOrCreateAgentState(
  supabaseClient: any,
  organizationId: string,
  agentName: AgentType
): Promise<AgentState> {
  // Try to find existing agent state
  const { data: existing, error: fetchError } = await supabaseClient
    .from('agent_state')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('agent_name', agentName)
    .single();

  if (existing && !fetchError) {
    return existing as AgentState;
  }

  // Create new agent state
  const newState: Partial<AgentState> = {
    organization_id: organizationId,
    agent_name: agentName,
    memory: createDefaultMemory() as any,
    learned_preferences: createDefaultPreferences() as any,
    performance_history: [],
  };

  const { data, error } = await supabaseClient
    .from('agent_state')
    .insert(newState)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create agent state: ${error.message}`);
  }

  return data as AgentState;
}

/**
 * Record task performance and update learning
 */
export async function recordTaskPerformance(
  supabaseClient: any,
  organizationId: string,
  agentName: AgentType,
  taskId: string,
  taskType: string,
  metrics: PerformanceMetrics,
  contentSummary?: string
): Promise<void> {
  const agentState = await getOrCreateAgentState(supabaseClient, organizationId, agentName);

  // Create performance entry
  const performanceEntry: PerformanceEntry = {
    timestamp: new Date().toISOString(),
    taskId,
    taskType,
    metrics,
  };

  // Update performance history (keep last 100 entries)
  const performanceHistory = [...(agentState.performance_history || []), performanceEntry].slice(-100);

  // Update memory with interaction summary
  const memory = agentState.memory as AgentMemory;
  const outcome = calculateOutcome(metrics);

  const interactionSummary: InteractionSummary = {
    timestamp: new Date().toISOString(),
    taskId,
    taskType,
    contentSummary: contentSummary || '',
    outcome,
    performanceMetrics: metrics,
  };

  memory.recentInteractions = [...(memory.recentInteractions || []), interactionSummary].slice(-50);

  // Update task type learnings
  const taskLearning = memory.taskLearnings[taskType] || createDefaultTaskLearning(taskType);
  taskLearning.totalTasks += 1;
  if (outcome === 'success') {
    taskLearning.successfulTasks += 1;
  }
  taskLearning.averagePerformanceScore = calculateAveragePerformance(performanceHistory, taskType);
  taskLearning.lastUpdated = new Date().toISOString();
  memory.taskLearnings[taskType] = taskLearning;

  // Identify patterns from performance
  const patterns = await identifyPatterns(performanceHistory, taskType);
  if (patterns.success.length > 0) {
    memory.successPatterns = mergePatterns(memory.successPatterns || [], patterns.success).slice(-20);
  }
  if (patterns.anti.length > 0) {
    memory.antiPatterns = mergePatterns(memory.antiPatterns || [], patterns.anti).slice(-20);
  }

  // Save updated state
  await supabaseClient
    .from('agent_state')
    .update({
      memory,
      performance_history: performanceHistory,
      updated_at: new Date().toISOString(),
    })
    .eq('id', agentState.id);
}

/**
 * Process user feedback and update preferences
 */
export async function processUserFeedback(
  supabaseClient: any,
  organizationId: string,
  agentName: AgentType,
  feedback: FeedbackInput
): Promise<void> {
  const agentState = await getOrCreateAgentState(supabaseClient, organizationId, agentName);
  const memory = agentState.memory as AgentMemory;
  const preferences = agentState.learned_preferences as LearnedPreferences;

  // Find the interaction for this task
  const interaction = memory.recentInteractions?.find((i) => i.taskId === feedback.taskId);
  if (interaction) {
    interaction.userFeedback = feedback.feedback;
    interaction.outcome = feedback.approved ? 'success' : 'failure';
  }

  // Process corrections to learn from mistakes
  if (feedback.corrections && feedback.corrections.length > 0) {
    for (const correction of feedback.corrections) {
      // Learn from corrections - this could be expanded with NLP
      if (correction.field === 'tone') {
        if (!preferences.contentStyle.avoiTones.includes(correction.original)) {
          preferences.contentStyle.avoiTones.push(correction.original);
        }
        if (correction.corrected && !preferences.contentStyle.preferredTone.includes(correction.corrected)) {
          preferences.contentStyle.preferredTone.push(correction.corrected);
        }
      }
    }
  }

  // Adjust formality based on feedback patterns
  if (feedback.rating <= 2) {
    // Poor rating - potentially add to anti-patterns
    const antiPattern: AntiPattern = {
      id: `anti-${Date.now()}`,
      pattern: feedback.feedback || 'Unspecified issue',
      description: `Content received low rating (${feedback.rating}/5)`,
      reason: feedback.feedback || 'Low user satisfaction',
      taskTypes: interaction?.taskType ? [interaction.taskType] : [],
      occurrences: 1,
      lastOccurred: new Date().toISOString(),
    };
    memory.antiPatterns = [...(memory.antiPatterns || []), antiPattern].slice(-20);
  } else if (feedback.rating >= 4 && feedback.approved) {
    // Good rating - potentially add to success patterns
    const successPattern: SuccessPattern = {
      id: `success-${Date.now()}`,
      pattern: 'High user satisfaction',
      description: `Content received high rating (${feedback.rating}/5)`,
      taskTypes: interaction?.taskType ? [interaction.taskType] : [],
      performanceBoost: (feedback.rating - 3) * 10,
      usageCount: 1,
      lastUsed: new Date().toISOString(),
    };
    memory.successPatterns = [...(memory.successPatterns || []), successPattern].slice(-20);
  }

  // Save updated state
  await supabaseClient
    .from('agent_state')
    .update({
      memory,
      learned_preferences: preferences,
      updated_at: new Date().toISOString(),
    })
    .eq('id', agentState.id);
}

/**
 * Get learning context for content generation
 */
export async function getLearningContext(
  supabaseClient: any,
  organizationId: string,
  agentName: AgentType,
  taskType: string,
  productId?: string,
  audienceId?: string
): Promise<{
  preferences: LearnedPreferences;
  relevantPatterns: SuccessPattern[];
  antiPatterns: AntiPattern[];
  taskLearnings: TaskTypeLearning | null;
  contextPrompt: string;
}> {
  const agentState = await getOrCreateAgentState(supabaseClient, organizationId, agentName);
  const memory = agentState.memory as AgentMemory;
  const preferences = agentState.learned_preferences as LearnedPreferences;

  // Get relevant success patterns
  const relevantPatterns = (memory.successPatterns || []).filter(
    (p) => p.taskTypes.length === 0 || p.taskTypes.includes(taskType)
  );

  // Get relevant anti-patterns
  const relevantAntiPatterns = (memory.antiPatterns || []).filter(
    (p) => p.taskTypes.length === 0 || p.taskTypes.includes(taskType)
  );

  // Get task-specific learnings
  const taskLearnings = memory.taskLearnings?.[taskType] || null;

  // Build context prompt for AI
  const contextPrompt = buildContextPrompt(
    preferences,
    relevantPatterns,
    relevantAntiPatterns,
    taskLearnings,
    productId ? preferences.productPreferences[productId] : undefined,
    audienceId ? preferences.audiencePatterns[audienceId] : undefined
  );

  return {
    preferences,
    relevantPatterns,
    antiPatterns: relevantAntiPatterns,
    taskLearnings,
    contextPrompt,
  };
}

/**
 * Generate insights from agent performance
 */
export async function generateAgentInsights(
  supabaseClient: any,
  organizationId: string,
  agentName: AgentType
): Promise<LearningInsight[]> {
  const agentState = await getOrCreateAgentState(supabaseClient, organizationId, agentName);
  const performanceHistory = agentState.performance_history || [];

  const insights: LearningInsight[] = [];

  // Only analyze if we have enough data
  if (performanceHistory.length < 10) {
    return insights;
  }

  // Split into recent and older data
  const recentEntries = performanceHistory.slice(-20);
  const olderEntries = performanceHistory.slice(-40, -20);

  // Analyze open rate trends (for email tasks)
  const recentOpenRates = recentEntries
    .filter((e) => e.metrics.openRate !== undefined)
    .map((e) => e.metrics.openRate!);
  const olderOpenRates = olderEntries
    .filter((e) => e.metrics.openRate !== undefined)
    .map((e) => e.metrics.openRate!);

  if (recentOpenRates.length > 3 && olderOpenRates.length > 3) {
    const recentAvg = average(recentOpenRates);
    const olderAvg = average(olderOpenRates);
    const improvement = ((recentAvg - olderAvg) / olderAvg) * 100;

    if (Math.abs(improvement) > 5) {
      insights.push({
        id: `insight-open-rate-${Date.now()}`,
        type: improvement > 0 ? 'improvement' : 'warning',
        title: `Email Open Rate ${improvement > 0 ? 'Improving' : 'Declining'}`,
        description: improvement > 0
          ? `Your email open rates have improved by ${improvement.toFixed(1)}% over recent tasks.`
          : `Your email open rates have declined by ${Math.abs(improvement).toFixed(1)}%. Consider reviewing subject line strategies.`,
        evidence: [
          {
            metric: 'Open Rate',
            before: olderAvg * 100,
            after: recentAvg * 100,
            improvement,
          },
        ],
        actionable: improvement < 0,
        suggestedAction: improvement < 0
          ? 'Try A/B testing different subject line formulas and personalizing content more.'
          : undefined,
        confidence: Math.min(recentOpenRates.length / 10, 1),
        generatedAt: new Date().toISOString(),
      });
    }
  }

  // Analyze click rate trends
  const recentClickRates = recentEntries
    .filter((e) => e.metrics.clickRate !== undefined)
    .map((e) => e.metrics.clickRate!);
  const olderClickRates = olderEntries
    .filter((e) => e.metrics.clickRate !== undefined)
    .map((e) => e.metrics.clickRate!);

  if (recentClickRates.length > 3 && olderClickRates.length > 3) {
    const recentAvg = average(recentClickRates);
    const olderAvg = average(olderClickRates);
    const improvement = ((recentAvg - olderAvg) / olderAvg) * 100;

    if (Math.abs(improvement) > 5) {
      insights.push({
        id: `insight-click-rate-${Date.now()}`,
        type: improvement > 0 ? 'improvement' : 'warning',
        title: `Click Rate ${improvement > 0 ? 'Improving' : 'Declining'}`,
        description: improvement > 0
          ? `Click rates have improved by ${improvement.toFixed(1)}% - your CTAs are becoming more effective.`
          : `Click rates have dropped by ${Math.abs(improvement).toFixed(1)}%. Consider revisiting your call-to-action strategies.`,
        evidence: [
          {
            metric: 'Click Rate',
            before: olderAvg * 100,
            after: recentAvg * 100,
            improvement,
          },
        ],
        actionable: improvement < 0,
        suggestedAction: improvement < 0
          ? 'Review your CTA placement, button text, and value propositions in your content.'
          : undefined,
        confidence: Math.min(recentClickRates.length / 10, 1),
        generatedAt: new Date().toISOString(),
      });
    }
  }

  // Identify top performing task types
  const memory = agentState.memory as AgentMemory;
  const taskLearnings = Object.values(memory.taskLearnings || {});

  const topPerformers = taskLearnings
    .filter((t) => t.totalTasks >= 5)
    .sort((a, b) => b.averagePerformanceScore - a.averagePerformanceScore)
    .slice(0, 3);

  if (topPerformers.length > 0) {
    insights.push({
      id: `insight-top-performers-${Date.now()}`,
      type: 'pattern',
      title: 'Top Performing Content Types',
      description: `Your best performing content types are: ${topPerformers.map((t) => t.taskType).join(', ')}. Consider focusing more on these.`,
      evidence: topPerformers.map((t) => ({
        metric: t.taskType,
        before: 0,
        after: t.averagePerformanceScore,
        improvement: t.averagePerformanceScore,
      })),
      actionable: true,
      suggestedAction: `Increase the proportion of ${topPerformers[0]?.taskType} tasks in your campaigns.`,
      confidence: 0.8,
      generatedAt: new Date().toISOString(),
    });
  }

  return insights;
}

/**
 * Get comprehensive agent analysis
 */
export async function getAgentAnalysis(
  supabaseClient: any,
  organizationId: string,
  agentName: AgentType
): Promise<AgentAnalysis> {
  const agentState = await getOrCreateAgentState(supabaseClient, organizationId, agentName);
  const performanceHistory = agentState.performance_history || [];
  const memory = agentState.memory as AgentMemory;

  // Calculate overall metrics
  const totalTasks = performanceHistory.length;
  const successfulTasks = performanceHistory.filter(
    (e) =>
      (e.metrics.openRate && e.metrics.openRate > 0.15) ||
      (e.metrics.clickRate && e.metrics.clickRate > 0.02) ||
      (e.metrics.approvalRate && e.metrics.approvalRate > 0.8)
  ).length;

  const successRate = totalTasks > 0 ? (successfulTasks / totalTasks) * 100 : 0;

  // Calculate average performance score
  const taskLearnings = Object.values(memory.taskLearnings || {});
  const avgPerformance =
    taskLearnings.length > 0
      ? taskLearnings.reduce((sum, t) => sum + t.averagePerformanceScore, 0) / taskLearnings.length
      : 0;

  // Determine overall health
  let overallHealth: AgentAnalysis['overallHealth'] = 'good';
  if (totalTasks < 10) {
    overallHealth = 'needs_attention'; // Not enough data
  } else if (successRate >= 80) {
    overallHealth = 'excellent';
  } else if (successRate >= 60) {
    overallHealth = 'good';
  } else if (successRate >= 40) {
    overallHealth = 'needs_attention';
  } else {
    overallHealth = 'poor';
  }

  // Get top performing task types
  const topPerformingTaskTypes = taskLearnings
    .sort((a, b) => b.averagePerformanceScore - a.averagePerformanceScore)
    .slice(0, 3)
    .map((t) => t.taskType);

  // Identify areas for improvement
  const areasForImprovement: string[] = [];
  const lowPerformers = taskLearnings.filter((t) => t.successfulTasks / t.totalTasks < 0.5);
  for (const lp of lowPerformers) {
    areasForImprovement.push(`${lp.taskType} content (${((lp.successfulTasks / lp.totalTasks) * 100).toFixed(0)}% success rate)`);
  }

  // Generate insights
  const recentInsights = await generateAgentInsights(supabaseClient, organizationId, agentName);

  // Calculate trends
  const trends = calculateTrends(performanceHistory);

  return {
    overallHealth,
    totalTasksProcessed: totalTasks,
    successRate,
    averagePerformanceScore: avgPerformance,
    topPerformingTaskTypes,
    areasForImprovement,
    recentInsights,
    trends,
  };
}

// Helper functions

function calculateOutcome(metrics: PerformanceMetrics): 'success' | 'failure' | 'pending' {
  if (metrics.approvalRate !== undefined && metrics.approvalRate >= 0.8) return 'success';
  if (metrics.openRate !== undefined && metrics.openRate > 0.2) return 'success';
  if (metrics.clickRate !== undefined && metrics.clickRate > 0.03) return 'success';
  if (metrics.conversionRate !== undefined && metrics.conversionRate > 0.01) return 'success';
  if (metrics.revisionCount !== undefined && metrics.revisionCount > 2) return 'failure';
  return 'pending';
}

function createDefaultTaskLearning(taskType: string): TaskTypeLearning {
  return {
    taskType,
    totalTasks: 0,
    successfulTasks: 0,
    averagePerformanceScore: 0,
    bestPerformingApproaches: [],
    commonIssues: [],
    lastUpdated: new Date().toISOString(),
  };
}

function calculateAveragePerformance(history: PerformanceEntry[], taskType: string): number {
  const typeEntries = history.filter((e) => e.taskType === taskType);
  if (typeEntries.length === 0) return 0;

  let total = 0;
  let count = 0;

  for (const entry of typeEntries) {
    const m = entry.metrics;
    if (m.openRate !== undefined) {
      total += m.openRate * 100;
      count++;
    }
    if (m.clickRate !== undefined) {
      total += m.clickRate * 200; // Weight click rate higher
      count++;
    }
    if (m.conversionRate !== undefined) {
      total += m.conversionRate * 300; // Weight conversion rate highest
      count++;
    }
    if (m.approvalRate !== undefined) {
      total += m.approvalRate * 100;
      count++;
    }
  }

  return count > 0 ? total / count : 0;
}

async function identifyPatterns(
  history: PerformanceEntry[],
  taskType: string
): Promise<{ success: SuccessPattern[]; anti: AntiPattern[] }> {
  // This is a simplified pattern detection
  // In production, you'd use more sophisticated ML techniques

  const successPatterns: SuccessPattern[] = [];
  const antiPatterns: AntiPattern[] = [];

  const typeEntries = history.filter((e) => e.taskType === taskType);
  const recent = typeEntries.slice(-10);

  const avgOpenRate = average(recent.map((e) => e.metrics.openRate).filter(Boolean) as number[]);
  const avgClickRate = average(recent.map((e) => e.metrics.clickRate).filter(Boolean) as number[]);

  // High performers
  const highPerformers = recent.filter(
    (e) =>
      (e.metrics.openRate && e.metrics.openRate > avgOpenRate * 1.2) ||
      (e.metrics.clickRate && e.metrics.clickRate > avgClickRate * 1.2)
  );

  if (highPerformers.length >= 3) {
    successPatterns.push({
      id: `pattern-${Date.now()}`,
      pattern: `High performing ${taskType} content`,
      description: `Recent ${taskType} tasks showing above-average engagement`,
      taskTypes: [taskType],
      performanceBoost: 15,
      usageCount: highPerformers.length,
      lastUsed: new Date().toISOString(),
    });
  }

  return { success: successPatterns, anti: antiPatterns };
}

function mergePatterns<T extends { id: string; pattern: string }>(existing: T[], newPatterns: T[]): T[] {
  const merged = [...existing];
  for (const newPattern of newPatterns) {
    const existingIndex = merged.findIndex((p) => p.pattern === newPattern.pattern);
    if (existingIndex >= 0) {
      merged[existingIndex] = newPattern; // Update existing
    } else {
      merged.push(newPattern);
    }
  }
  return merged;
}

function buildContextPrompt(
  preferences: LearnedPreferences,
  successPatterns: SuccessPattern[],
  antiPatterns: AntiPattern[],
  taskLearnings: TaskTypeLearning | null,
  productPrefs?: LearnedPreferences['productPreferences'][string],
  audiencePrefs?: LearnedPreferences['audiencePatterns'][string]
): string {
  const parts: string[] = [];

  // Style preferences
  parts.push(`CONTENT STYLE PREFERENCES:
- Preferred tones: ${preferences.contentStyle.preferredTone.join(', ')}
- Avoid these tones: ${preferences.contentStyle.avoiTones.join(', ')}
- Formality level: ${preferences.contentStyle.formalityLevel}/10
- Use emojis: ${preferences.contentStyle.useEmojis ? 'Yes' : 'No'}`);

  // Effective messaging
  if (preferences.messaging.effectiveHooks.length > 0) {
    parts.push(`\nEFFECTIVE HOOKS:\n${preferences.messaging.effectiveHooks.slice(0, 5).join('\n')}`);
  }

  if (preferences.messaging.preferredCTAs.length > 0) {
    parts.push(`\nPREFERRED CTAs:\n${preferences.messaging.preferredCTAs.slice(0, 5).join('\n')}`);
  }

  // Success patterns
  if (successPatterns.length > 0) {
    parts.push(`\nSUCCESSFUL PATTERNS TO FOLLOW:\n${successPatterns.slice(0, 5).map((p) => `- ${p.description}`).join('\n')}`);
  }

  // Anti-patterns
  if (antiPatterns.length > 0) {
    parts.push(`\nPATTERNS TO AVOID:\n${antiPatterns.slice(0, 5).map((p) => `- ${p.description}: ${p.reason}`).join('\n')}`);
  }

  // Product-specific preferences
  if (productPrefs) {
    if (productPrefs.effectiveValueProps.length > 0) {
      parts.push(`\nEFFECTIVE VALUE PROPOSITIONS:\n${productPrefs.effectiveValueProps.slice(0, 3).join('\n')}`);
    }
  }

  // Audience-specific preferences
  if (audiencePrefs) {
    if (audiencePrefs.effectiveAngles.length > 0) {
      parts.push(`\nEFFECTIVE MESSAGING ANGLES FOR THIS AUDIENCE:\n${audiencePrefs.effectiveAngles.slice(0, 3).join('\n')}`);
    }
  }

  // Task-specific learnings
  if (taskLearnings) {
    parts.push(`\nTASK TYPE LEARNINGS:
- Tasks completed: ${taskLearnings.totalTasks}
- Success rate: ${((taskLearnings.successfulTasks / taskLearnings.totalTasks) * 100).toFixed(0)}%
${taskLearnings.bestPerformingApproaches.length > 0 ? `- Best approaches: ${taskLearnings.bestPerformingApproaches.join(', ')}` : ''}
${taskLearnings.commonIssues.length > 0 ? `- Common issues to avoid: ${taskLearnings.commonIssues.join(', ')}` : ''}`);
  }

  return parts.join('\n\n');
}

function calculateTrends(history: PerformanceEntry[]): AgentAnalysis['trends'] {
  const trends: AgentAnalysis['trends'] = [];

  if (history.length < 20) return trends;

  const recent = history.slice(-10);
  const older = history.slice(-20, -10);

  // Open rate trend
  const recentOpenRates = recent.map((e) => e.metrics.openRate).filter(Boolean) as number[];
  const olderOpenRates = older.map((e) => e.metrics.openRate).filter(Boolean) as number[];

  if (recentOpenRates.length > 3 && olderOpenRates.length > 3) {
    const change = ((average(recentOpenRates) - average(olderOpenRates)) / average(olderOpenRates)) * 100;
    trends.push({
      metric: 'Open Rate',
      trend: change > 5 ? 'improving' : change < -5 ? 'declining' : 'stable',
      change,
      period: 'Last 10 tasks vs previous 10',
    });
  }

  // Click rate trend
  const recentClickRates = recent.map((e) => e.metrics.clickRate).filter(Boolean) as number[];
  const olderClickRates = older.map((e) => e.metrics.clickRate).filter(Boolean) as number[];

  if (recentClickRates.length > 3 && olderClickRates.length > 3) {
    const change = ((average(recentClickRates) - average(olderClickRates)) / average(olderClickRates)) * 100;
    trends.push({
      metric: 'Click Rate',
      trend: change > 5 ? 'improving' : change < -5 ? 'declining' : 'stable',
      change,
      period: 'Last 10 tasks vs previous 10',
    });
  }

  return trends;
}

function average(numbers: number[]): number {
  if (numbers.length === 0) return 0;
  return numbers.reduce((a, b) => a + b, 0) / numbers.length;
}
