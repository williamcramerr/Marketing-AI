/**
 * Agent Learning System Type Definitions
 *
 * Types for managing agent state, learning from performance,
 * and improving content generation over time.
 */

export interface AgentState {
  id: string;
  organization_id: string;
  agent_name: AgentType;
  memory: AgentMemory;
  last_run_at: string | null;
  next_run_at: string | null;
  learned_preferences: LearnedPreferences;
  performance_history: PerformanceEntry[];
  created_at: string;
  updated_at: string;
}

export type AgentType =
  | 'content_writer'
  | 'email_marketer'
  | 'social_manager'
  | 'seo_optimizer'
  | 'ad_manager'
  | 'analyst';

export interface AgentMemory {
  // Long-term context
  organizationContext: {
    brandVoice?: string;
    industryContext?: string;
    competitorInsights?: string[];
    keyThemes?: string[];
  };

  // Task-specific learnings
  taskLearnings: {
    [taskType: string]: TaskTypeLearning;
  };

  // Recent interactions for context
  recentInteractions: InteractionSummary[];

  // Successful patterns
  successPatterns: SuccessPattern[];

  // Content that performed poorly (to avoid)
  antiPatterns: AntiPattern[];
}

export interface TaskTypeLearning {
  taskType: string;
  totalTasks: number;
  successfulTasks: number;
  averagePerformanceScore: number;
  bestPerformingApproaches: string[];
  commonIssues: string[];
  lastUpdated: string;
}

export interface InteractionSummary {
  timestamp: string;
  taskId: string;
  taskType: string;
  contentSummary: string;
  outcome: 'success' | 'failure' | 'pending';
  performanceMetrics?: PerformanceMetrics;
  userFeedback?: string;
}

export interface SuccessPattern {
  id: string;
  pattern: string;
  description: string;
  taskTypes: string[];
  performanceBoost: number;
  usageCount: number;
  lastUsed: string;
}

export interface AntiPattern {
  id: string;
  pattern: string;
  description: string;
  reason: string;
  taskTypes: string[];
  occurrences: number;
  lastOccurred: string;
}

export interface LearnedPreferences {
  // Content style preferences
  contentStyle: {
    preferredTone: string[];
    avoiTones: string[];
    sentenceLength: 'short' | 'medium' | 'long';
    paragraphLength: 'short' | 'medium' | 'long';
    useEmojis: boolean;
    formalityLevel: number; // 1-10
  };

  // Messaging preferences
  messaging: {
    preferredCTAs: string[];
    effectiveHooks: string[];
    topPerformingSubjectLines: string[];
    preferredHeadlineFormulas: string[];
  };

  // Audience engagement patterns
  audiencePatterns: {
    [audienceId: string]: {
      bestPerformingContent: string[];
      effectiveAngles: string[];
      optimalSendTimes?: string[];
    };
  };

  // Channel-specific preferences
  channelPreferences: {
    [channel: string]: {
      optimalContentLength?: number;
      bestPostingTimes?: string[];
      effectiveFormats?: string[];
      hashtags?: string[];
    };
  };

  // Product-specific learnings
  productPreferences: {
    [productId: string]: {
      effectiveValueProps: string[];
      bestFeatureHighlights: string[];
      successfulPositioning: string[];
    };
  };
}

export interface PerformanceEntry {
  timestamp: string;
  taskId: string;
  taskType: string;
  metrics: PerformanceMetrics;
  contentId?: string;
  campaignId?: string;
}

export interface PerformanceMetrics {
  // Index signature for Record<string, number> compatibility
  [key: string]: number | undefined;

  // Engagement metrics
  openRate?: number;
  clickRate?: number;
  conversionRate?: number;
  engagementRate?: number;

  // Content quality metrics
  readabilityScore?: number;
  sentimentScore?: number;
  brandAlignmentScore?: number;

  // Performance metrics
  impressions?: number;
  clicks?: number;
  conversions?: number;
  revenue?: number;

  // Feedback metrics
  approvalRate?: number;
  revisionCount?: number;
  userSatisfactionScore?: number;
}

export interface LearningInsight {
  id: string;
  type: 'improvement' | 'pattern' | 'warning' | 'recommendation';
  title: string;
  description: string;
  evidence: {
    metric: string;
    before: number;
    after: number;
    improvement: number;
  }[];
  actionable: boolean;
  suggestedAction?: string;
  confidence: number;
  generatedAt: string;
}

export interface AgentAnalysis {
  overallHealth: 'excellent' | 'good' | 'needs_attention' | 'poor';
  totalTasksProcessed: number;
  successRate: number;
  averagePerformanceScore: number;
  topPerformingTaskTypes: string[];
  areasForImprovement: string[];
  recentInsights: LearningInsight[];
  trends: {
    metric: string;
    trend: 'improving' | 'stable' | 'declining';
    change: number;
    period: string;
  }[];
}

export interface FeedbackInput {
  taskId: string;
  rating: 1 | 2 | 3 | 4 | 5;
  feedback?: string;
  corrections?: {
    field: string;
    original: string;
    corrected: string;
  }[];
  approved: boolean;
}
