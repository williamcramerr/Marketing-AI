/**
 * Agent Learning System Tests
 */

import { describe, it, expect, vi } from 'vitest';
import {
  getOrCreateAgentState,
  recordTaskPerformance,
  processUserFeedback,
  getLearningContext,
  generateAgentInsights,
  getAgentAnalysis,
} from '../learning-system';
import type { AgentState, AgentType, PerformanceMetrics, FeedbackInput } from '../types';

// Mock Supabase client with proper chaining support
const createMockSupabaseClient = (existingState: AgentState | null = null) => {
  let storedState = existingState;
  let pendingInsertData: any = null;

  const createSelectChain = () => {
    const chain: any = {
      select: () => chain,
      eq: () => chain,
      order: () => chain,
      single: () => {
        // If we just did an insert, return that data
        if (pendingInsertData) {
          const insertedState = {
            id: 'new-agent-id',
            ...pendingInsertData,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          storedState = insertedState;
          pendingInsertData = null;
          return Promise.resolve({ data: insertedState, error: null });
        }
        return Promise.resolve({ data: storedState, error: storedState ? null : { code: 'PGRST116' } });
      },
      then: (resolve: any) => resolve({ data: storedState, error: null }),
    };
    return chain;
  };

  const createInsertChain = (data: any) => {
    pendingInsertData = data;
    const chain: any = {
      select: () => createSelectChain(),
      single: () => {
        const insertedState = {
          id: 'new-agent-id',
          ...data,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        storedState = insertedState;
        return Promise.resolve({ data: insertedState, error: null });
      },
    };
    return chain;
  };

  const createUpdateChain = (data: any) => {
    if (storedState) {
      storedState = { ...storedState, ...data };
    }
    const chain: any = {
      eq: () => chain,
      then: (resolve: any) => resolve({ data: storedState, error: null }),
    };
    return chain;
  };

  return {
    from: (table: string) => {
      if (table === 'agent_state') {
        return {
          select: () => createSelectChain(),
          insert: (data: any) => createInsertChain(data),
          update: (data: any) => createUpdateChain(data),
        };
      }
      return {
        select: () => createSelectChain(),
        insert: (data: any) => createInsertChain(data),
        update: (data: any) => createUpdateChain(data),
      };
    },
    getStoredState: () => storedState,
  };
};

// Sample agent state for testing
const createSampleAgentState = (overrides: Partial<AgentState> = {}): AgentState => ({
  id: 'agent-123',
  organization_id: 'org-123',
  agent_name: 'content_writer',
  memory: {
    organizationContext: {},
    taskLearnings: {},
    recentInteractions: [],
    successPatterns: [],
    antiPatterns: [],
  },
  last_run_at: null,
  next_run_at: null,
  learned_preferences: {
    contentStyle: {
      preferredTone: ['professional', 'friendly'],
      avoiTones: ['aggressive'],
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
  },
  performance_history: [],
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides,
});

describe('Agent Learning System', () => {
  describe('getOrCreateAgentState', () => {
    it('should return existing agent state if found', async () => {
      const existingState = createSampleAgentState();
      const supabase = createMockSupabaseClient(existingState);

      const result = await getOrCreateAgentState(supabase, 'org-123', 'content_writer');

      expect(result).toEqual(existingState);
    });

    it('should create new agent state if none exists', async () => {
      const supabase = createMockSupabaseClient(null);

      const result = await getOrCreateAgentState(supabase, 'org-123', 'email_marketer');

      expect(result.organization_id).toBe('org-123');
      expect(result.agent_name).toBe('email_marketer');
    });

    it('should initialize default memory and preferences for new agent', async () => {
      const supabase = createMockSupabaseClient(null);

      const result = await getOrCreateAgentState(supabase, 'org-123', 'social_manager');

      expect(result.memory).toBeDefined();
      expect(result.learned_preferences).toBeDefined();
      expect(result.performance_history).toEqual([]);
    });
  });

  describe('recordTaskPerformance', () => {
    it('should add performance entry to history', async () => {
      const existingState = createSampleAgentState();
      const supabase = createMockSupabaseClient(existingState);

      const metrics: PerformanceMetrics = {
        openRate: 0.25,
        clickRate: 0.05,
        approvalRate: 0.9,
      };

      await recordTaskPerformance(
        supabase,
        'org-123',
        'content_writer',
        'task-456',
        'email_single',
        metrics
      );

      // Verify state was updated
      const state = supabase.getStoredState();
      expect(state?.performance_history).toHaveLength(1);
      expect(state?.performance_history[0].taskId).toBe('task-456');
    });

    it('should update task learnings for the task type', async () => {
      const existingState = createSampleAgentState();
      const supabase = createMockSupabaseClient(existingState);

      const metrics: PerformanceMetrics = {
        openRate: 0.3,
        clickRate: 0.08,
      };

      await recordTaskPerformance(
        supabase,
        'org-123',
        'content_writer',
        'task-789',
        'social_post',
        metrics
      );

      const state = supabase.getStoredState();
      expect(state?.memory.taskLearnings['social_post']).toBeDefined();
      expect(state?.memory.taskLearnings['social_post'].totalTasks).toBe(1);
    });

    it('should add interaction summary to recent interactions', async () => {
      const existingState = createSampleAgentState();
      const supabase = createMockSupabaseClient(existingState);

      const metrics: PerformanceMetrics = {
        approvalRate: 0.85,
      };

      await recordTaskPerformance(
        supabase,
        'org-123',
        'content_writer',
        'task-101',
        'blog_post',
        metrics,
        'Blog post about AI trends'
      );

      const state = supabase.getStoredState();
      expect(state?.memory.recentInteractions).toHaveLength(1);
      expect(state?.memory.recentInteractions[0].contentSummary).toBe('Blog post about AI trends');
    });
  });

  describe('processUserFeedback', () => {
    it('should add anti-pattern for low ratings', async () => {
      const existingState = createSampleAgentState({
        memory: {
          organizationContext: {},
          taskLearnings: {},
          recentInteractions: [{
            timestamp: new Date().toISOString(),
            taskId: 'task-123',
            taskType: 'email_single',
            contentSummary: 'Test content',
            outcome: 'pending',
          }],
          successPatterns: [],
          antiPatterns: [],
        },
      });
      const supabase = createMockSupabaseClient(existingState);

      const feedback: FeedbackInput = {
        taskId: 'task-123',
        rating: 2,
        feedback: 'Too formal for our audience',
        corrections: [],
        approved: false,
      };

      await processUserFeedback(supabase, 'org-123', 'content_writer', feedback);

      const state = supabase.getStoredState();
      expect(state?.memory.antiPatterns).toHaveLength(1);
      expect(state?.memory.antiPatterns[0].description).toContain('low rating');
    });

    it('should add success pattern for high ratings', async () => {
      const existingState = createSampleAgentState({
        memory: {
          organizationContext: {},
          taskLearnings: {},
          recentInteractions: [{
            timestamp: new Date().toISOString(),
            taskId: 'task-456',
            taskType: 'social_post',
            contentSummary: 'Great engagement post',
            outcome: 'pending',
          }],
          successPatterns: [],
          antiPatterns: [],
        },
      });
      const supabase = createMockSupabaseClient(existingState);

      const feedback: FeedbackInput = {
        taskId: 'task-456',
        rating: 5,
        feedback: 'Perfect tone and messaging',
        corrections: [],
        approved: true,
      };

      await processUserFeedback(supabase, 'org-123', 'content_writer', feedback);

      const state = supabase.getStoredState();
      expect(state?.memory.successPatterns).toHaveLength(1);
      expect(state?.memory.successPatterns[0].description).toContain('high rating');
    });

    it('should learn from tone corrections', async () => {
      const existingState = createSampleAgentState();
      const supabase = createMockSupabaseClient(existingState);

      const feedback: FeedbackInput = {
        taskId: 'task-789',
        rating: 3,
        corrections: [{
          field: 'tone',
          original: 'overly-casual',
          corrected: 'professional',
        }],
        approved: true,
      };

      await processUserFeedback(supabase, 'org-123', 'content_writer', feedback);

      const state = supabase.getStoredState();
      expect(state?.learned_preferences.contentStyle.avoiTones).toContain('overly-casual');
      expect(state?.learned_preferences.contentStyle.preferredTone).toContain('professional');
    });
  });

  describe('getLearningContext', () => {
    it('should return preferences and patterns for task type', async () => {
      const existingState = createSampleAgentState({
        memory: {
          organizationContext: {},
          taskLearnings: {
            email_single: {
              taskType: 'email_single',
              totalTasks: 10,
              successfulTasks: 8,
              averagePerformanceScore: 75,
              bestPerformingApproaches: ['personalized greetings'],
              commonIssues: [],
              lastUpdated: new Date().toISOString(),
            },
          },
          recentInteractions: [],
          successPatterns: [{
            id: 'pattern-1',
            pattern: 'Personal greeting',
            description: 'Using personalized greetings improves open rates',
            taskTypes: ['email_single'],
            performanceBoost: 15,
            usageCount: 5,
            lastUsed: new Date().toISOString(),
          }],
          antiPatterns: [],
        },
      });
      const supabase = createMockSupabaseClient(existingState);

      const context = await getLearningContext(supabase, 'org-123', 'content_writer', 'email_single');

      expect(context.preferences).toBeDefined();
      expect(context.relevantPatterns).toHaveLength(1);
      expect(context.taskLearnings?.taskType).toBe('email_single');
      expect(context.contextPrompt).toContain('CONTENT STYLE PREFERENCES');
    });

    it('should filter patterns by task type', async () => {
      const existingState = createSampleAgentState({
        memory: {
          organizationContext: {},
          taskLearnings: {},
          recentInteractions: [],
          successPatterns: [
            {
              id: 'pattern-1',
              pattern: 'Email pattern',
              description: 'Good for emails',
              taskTypes: ['email_single'],
              performanceBoost: 10,
              usageCount: 3,
              lastUsed: new Date().toISOString(),
            },
            {
              id: 'pattern-2',
              pattern: 'Social pattern',
              description: 'Good for social',
              taskTypes: ['social_post'],
              performanceBoost: 12,
              usageCount: 5,
              lastUsed: new Date().toISOString(),
            },
          ],
          antiPatterns: [],
        },
      });
      const supabase = createMockSupabaseClient(existingState);

      const context = await getLearningContext(supabase, 'org-123', 'content_writer', 'social_post');

      expect(context.relevantPatterns).toHaveLength(1);
      expect(context.relevantPatterns[0].pattern).toBe('Social pattern');
    });
  });

  describe('generateAgentInsights', () => {
    it('should return empty insights when insufficient data', async () => {
      const existingState = createSampleAgentState({
        performance_history: [
          { timestamp: new Date().toISOString(), taskId: 't1', taskType: 'email', metrics: { openRate: 0.2 } },
          { timestamp: new Date().toISOString(), taskId: 't2', taskType: 'email', metrics: { openRate: 0.25 } },
        ],
      });
      const supabase = createMockSupabaseClient(existingState);

      const insights = await generateAgentInsights(supabase, 'org-123', 'content_writer');

      expect(insights).toEqual([]);
    });

    it('should generate insights with sufficient data', async () => {
      const history = [];
      // Create older entries with lower performance
      for (let i = 0; i < 20; i++) {
        history.push({
          timestamp: new Date(Date.now() - (40 - i) * 86400000).toISOString(),
          taskId: `task-old-${i}`,
          taskType: 'email_single',
          metrics: { openRate: 0.15 + Math.random() * 0.05 },
        });
      }
      // Create recent entries with higher performance
      for (let i = 0; i < 20; i++) {
        history.push({
          timestamp: new Date(Date.now() - i * 86400000).toISOString(),
          taskId: `task-recent-${i}`,
          taskType: 'email_single',
          metrics: { openRate: 0.25 + Math.random() * 0.1 },
        });
      }

      const existingState = createSampleAgentState({
        performance_history: history,
        memory: {
          organizationContext: {},
          taskLearnings: {
            email_single: {
              taskType: 'email_single',
              totalTasks: 40,
              successfulTasks: 30,
              averagePerformanceScore: 70,
              bestPerformingApproaches: [],
              commonIssues: [],
              lastUpdated: new Date().toISOString(),
            },
          },
          recentInteractions: [],
          successPatterns: [],
          antiPatterns: [],
        },
      });
      const supabase = createMockSupabaseClient(existingState);

      const insights = await generateAgentInsights(supabase, 'org-123', 'content_writer');

      expect(insights.length).toBeGreaterThan(0);
    });
  });

  describe('getAgentAnalysis', () => {
    it('should return needs_attention for insufficient data', async () => {
      const existingState = createSampleAgentState({
        performance_history: [
          { timestamp: new Date().toISOString(), taskId: 't1', taskType: 'email', metrics: { openRate: 0.2 } },
        ],
      });
      const supabase = createMockSupabaseClient(existingState);

      const analysis = await getAgentAnalysis(supabase, 'org-123', 'content_writer');

      expect(analysis.overallHealth).toBe('needs_attention');
      expect(analysis.totalTasksProcessed).toBe(1);
    });

    it('should calculate success rate correctly', async () => {
      const history = [];
      for (let i = 0; i < 20; i++) {
        history.push({
          timestamp: new Date().toISOString(),
          taskId: `task-${i}`,
          taskType: 'email_single',
          metrics: { openRate: i < 16 ? 0.25 : 0.1 }, // 16 successful (>0.15), 4 failures
        });
      }

      const existingState = createSampleAgentState({
        performance_history: history,
      });
      const supabase = createMockSupabaseClient(existingState);

      const analysis = await getAgentAnalysis(supabase, 'org-123', 'content_writer');

      expect(analysis.totalTasksProcessed).toBe(20);
      expect(analysis.successRate).toBe(80);
      expect(analysis.overallHealth).toBe('excellent');
    });

    it('should identify top performing task types', async () => {
      const existingState = createSampleAgentState({
        memory: {
          organizationContext: {},
          taskLearnings: {
            email_single: {
              taskType: 'email_single',
              totalTasks: 50,
              successfulTasks: 45,
              averagePerformanceScore: 85,
              bestPerformingApproaches: [],
              commonIssues: [],
              lastUpdated: new Date().toISOString(),
            },
            social_post: {
              taskType: 'social_post',
              totalTasks: 30,
              successfulTasks: 20,
              averagePerformanceScore: 65,
              bestPerformingApproaches: [],
              commonIssues: [],
              lastUpdated: new Date().toISOString(),
            },
            blog_post: {
              taskType: 'blog_post',
              totalTasks: 10,
              successfulTasks: 9,
              averagePerformanceScore: 90,
              bestPerformingApproaches: [],
              commonIssues: [],
              lastUpdated: new Date().toISOString(),
            },
          },
          recentInteractions: [],
          successPatterns: [],
          antiPatterns: [],
        },
        performance_history: [],
      });
      const supabase = createMockSupabaseClient(existingState);

      const analysis = await getAgentAnalysis(supabase, 'org-123', 'content_writer');

      expect(analysis.topPerformingTaskTypes).toContain('blog_post');
      expect(analysis.topPerformingTaskTypes).toContain('email_single');
    });

    it('should identify areas for improvement', async () => {
      const existingState = createSampleAgentState({
        memory: {
          organizationContext: {},
          taskLearnings: {
            email_single: {
              taskType: 'email_single',
              totalTasks: 20,
              successfulTasks: 5, // 25% success rate - needs improvement
              averagePerformanceScore: 30,
              bestPerformingApproaches: [],
              commonIssues: [],
              lastUpdated: new Date().toISOString(),
            },
          },
          recentInteractions: [],
          successPatterns: [],
          antiPatterns: [],
        },
        performance_history: [],
      });
      const supabase = createMockSupabaseClient(existingState);

      const analysis = await getAgentAnalysis(supabase, 'org-123', 'content_writer');

      expect(analysis.areasForImprovement).toHaveLength(1);
      expect(analysis.areasForImprovement[0]).toContain('email_single');
    });
  });
});
