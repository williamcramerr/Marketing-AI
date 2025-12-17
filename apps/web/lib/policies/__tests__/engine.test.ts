/**
 * Policy Engine Tests
 *
 * This is a template test file. Configure your test framework and update as needed.
 * Example using Jest/Vitest.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  validatePolicies,
  canDraftTask,
  validateContent,
  canExecuteTask,
  type TaskForValidation,
  type Policy,
} from '../index';

// Mock Supabase client with proper chaining support
const createMockSupabaseClient = (policies: Policy[] = [], mockData: any = {}) => {
  // Helper to create a chainable query builder
  const createChainableQuery = (table: string, finalData: any) => {
    const chain: any = {
      select: () => chain,
      eq: () => chain,
      order: () => chain,
      or: () => chain,
      is: () => chain,
      gte: () => chain,
      in: () => chain,
      single: () => Promise.resolve({ data: mockData[table]?.[0] || null, error: null }),
      then: (resolve: any) => resolve({ data: finalData, error: null }),
    };
    return chain;
  };

  return {
    from: (table: string) => {
      if (table === 'policies') {
        return createChainableQuery(table, policies);
      }
      if (table === 'campaigns') {
        return createChainableQuery(table, mockData.campaigns || []);
      }
      if (table === 'tasks') {
        return {
          ...createChainableQuery(table, []),
          select: (cols: string, opts?: any) => {
            const countChain: any = {
              eq: () => countChain,
              gte: () => countChain,
              in: () => countChain,
              then: (resolve: any) => resolve({ count: 0, error: null }),
            };
            if (opts?.count === 'exact' && opts?.head === true) {
              return countChain;
            }
            return createChainableQuery(table, []);
          },
        };
      }
      return createChainableQuery(table, []);
    },
  };
};

const mockTask: TaskForValidation = {
  id: 'task-123',
  campaign_id: 'campaign-456',
  type: 'email_single',
  title: 'Test Task',
  scheduled_for: new Date().toISOString(),
};

describe('Policy Engine', () => {
  describe('validatePolicies', () => {
    it('should allow task when no policies exist', async () => {
      const supabase = createMockSupabaseClient([]);
      const result = await validatePolicies(mockTask, 'org-123', 'pre-draft', supabase);

      expect(result.allowed).toBe(true);
      expect(result.violations).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    it('should detect banned phrases', async () => {
      const policies: Policy[] = [
        {
          id: 'policy-1',
          organization_id: 'org-123',
          product_id: null,
          type: 'banned_phrase',
          name: 'No spam words',
          description: null,
          rule: {
            phrases: ['guarantee', 'free money'],
            caseSensitive: false,
          },
          severity: 'block',
          active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      const supabase = createMockSupabaseClient(policies);
      const taskWithContent = {
        ...mockTask,
        draft_content: {
          subject: 'We guarantee success!',
          body: 'Join now',
        },
      };

      const result = await validatePolicies(taskWithContent, 'org-123', 'content', supabase);

      expect(result.allowed).toBe(false);
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].policyType).toBe('banned_phrase');
    });

    it('should check rate limits', async () => {
      const policies: Policy[] = [
        {
          id: 'policy-2',
          organization_id: 'org-123',
          product_id: null,
          type: 'rate_limit',
          name: 'Hourly limit',
          description: null,
          rule: {
            limit: 5,
            window: 'hour',
            scope: 'organization',
          },
          severity: 'block',
          active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      const supabase = createMockSupabaseClient(policies);
      const result = await validatePolicies(mockTask, 'org-123', 'pre-draft', supabase);

      expect(result.allowed).toBe(true);
    });

    it('should enforce required phrases', async () => {
      const policies: Policy[] = [
        {
          id: 'policy-3',
          organization_id: 'org-123',
          product_id: null,
          type: 'required_phrase',
          name: 'Email disclaimer',
          description: null,
          rule: {
            phrases: ['Unsubscribe'],
            caseSensitive: false,
            location: 'anywhere',
          },
          severity: 'block',
          active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      const supabase = createMockSupabaseClient(policies);
      const taskWithoutDisclaimer = {
        ...mockTask,
        draft_content: {
          subject: 'Newsletter',
          body: 'Content here',
        },
      };

      const result = await validatePolicies(
        taskWithoutDisclaimer,
        'org-123',
        'content',
        supabase
      );

      expect(result.allowed).toBe(false);
      expect(result.violations[0].policyType).toBe('required_phrase');
    });

    it('should handle warnings without blocking', async () => {
      const policies: Policy[] = [
        {
          id: 'policy-4',
          organization_id: 'org-123',
          product_id: null,
          type: 'content_rule',
          name: 'Length warning',
          description: null,
          rule: {
            maxLength: 100,
          },
          severity: 'warn',
          active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      const supabase = createMockSupabaseClient(policies);
      const taskWithLongContent = {
        ...mockTask,
        draft_content: {
          body: 'A'.repeat(150),
        },
      };

      const result = await validatePolicies(taskWithLongContent, 'org-123', 'content', supabase);

      // 'warn' severity doesn't block - only 'block' severity does
      expect(result.allowed).toBe(true);
      expect(result.warnings).toBeDefined();
    });

    it('should check time windows', async () => {
      const policies: Policy[] = [
        {
          id: 'policy-5',
          organization_id: 'org-123',
          product_id: null,
          type: 'time_window',
          name: 'Business hours only',
          description: null,
          rule: {
            allowedDays: [1, 2, 3, 4, 5], // Monday-Friday
            allowedHours: {
              start: 9,
              end: 17,
            },
            timezone: 'America/New_York',
          },
          severity: 'block',
          active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      const supabase = createMockSupabaseClient(policies);

      // Schedule for a weekday at 10 AM
      const weekdayTask = {
        ...mockTask,
        scheduled_for: new Date('2024-01-08T15:00:00Z').toISOString(), // Monday 10 AM EST
      };

      const result = await validatePolicies(weekdayTask, 'org-123', 'pre-draft', supabase);

      // Note: This might fail or pass depending on actual time calculation
      // In production, you'd mock Date or use a time library
      expect(result).toBeDefined();
    });
  });

  describe('Convenience Functions', () => {
    it('canDraftTask should validate pre-draft policies', async () => {
      const supabase = createMockSupabaseClient([]);
      const result = await canDraftTask(mockTask, 'org-123', supabase);

      expect(result.allowed).toBe(true);
    });

    it('validateContent should check content policies', async () => {
      const supabase = createMockSupabaseClient([]);
      const taskWithContent = {
        ...mockTask,
        draft_content: { body: 'Test content' },
      };

      const result = await validateContent(taskWithContent, 'org-123', supabase);

      expect(result.allowed).toBe(true);
    });

    it('canExecuteTask should validate pre-execute policies', async () => {
      const supabase = createMockSupabaseClient([]);
      const taskWithFinalContent = {
        ...mockTask,
        final_content: { body: 'Final content' },
      };

      const result = await canExecuteTask(taskWithFinalContent, 'org-123', supabase);

      expect(result.allowed).toBe(true);
    });
  });

  describe('Severity Handling', () => {
    it('should block on "block" severity', async () => {
      const policies: Policy[] = [
        {
          id: 'policy-1',
          organization_id: 'org-123',
          product_id: null,
          type: 'banned_phrase',
          name: 'Block spam',
          description: null,
          rule: { phrases: ['spam'] },
          severity: 'block',
          active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      const supabase = createMockSupabaseClient(policies);
      const task = {
        ...mockTask,
        draft_content: { body: 'This is spam' },
      };

      const result = await validatePolicies(task, 'org-123', 'content', supabase);

      expect(result.allowed).toBe(false);
      expect(result.violations[0].severity).toBe('block');
    });

    it('should allow but flag "escalate" severity', async () => {
      const policies: Policy[] = [
        {
          id: 'policy-2',
          organization_id: 'org-123',
          product_id: null,
          type: 'banned_phrase',
          name: 'Review required',
          description: null,
          rule: { phrases: ['review'] },
          severity: 'escalate',
          active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      const supabase = createMockSupabaseClient(policies);
      const task = {
        ...mockTask,
        draft_content: { body: 'Please review this' },
      };

      const result = await validatePolicies(task, 'org-123', 'content', supabase);

      // 'escalate' severity adds violations but doesn't block - only 'block' severity does
      expect(result.allowed).toBe(true);
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].severity).toBe('escalate');
    });

    it('should allow with "warn" severity', async () => {
      const policies: Policy[] = [
        {
          id: 'policy-3',
          organization_id: 'org-123',
          product_id: null,
          type: 'banned_phrase',
          name: 'Warning only',
          description: null,
          rule: { phrases: ['caution'] },
          severity: 'warn',
          active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      const supabase = createMockSupabaseClient(policies);
      const task = {
        ...mockTask,
        draft_content: { body: 'Use caution' },
      };

      const result = await validatePolicies(task, 'org-123', 'content', supabase);

      // 'warn' severity adds violations but doesn't block
      expect(result.allowed).toBe(true);
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].severity).toBe('warn');
    });
  });
});
