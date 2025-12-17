import type { Tables, Enums } from '@/lib/supabase/types';

// Policy types from database
export type Policy = Tables<'policies'>;
export type PolicyType = Enums<'policy_type'>;
export type PolicySeverity = 'warn' | 'block' | 'escalate';

// Check types for validation stages
export type CheckType = 'pre-draft' | 'content' | 'pre-execute';

// Policy violation and warning structures
export interface PolicyViolation {
  policyId: string;
  policyName: string;
  policyType: PolicyType;
  severity: PolicySeverity;
  message: string;
  details?: Record<string, unknown>;
  timestamp: string;
}

export interface PolicyWarning {
  policyId: string;
  policyName: string;
  policyType: PolicyType;
  message: string;
  details?: Record<string, unknown>;
  timestamp: string;
}

// Validation result
export interface PolicyValidationResult {
  allowed: boolean;
  violations: PolicyViolation[];
  warnings: PolicyWarning[];
  feedback?: string;
}

// Rule type definitions for each policy type
export interface RateLimitRule {
  limit: number;
  window: 'hour' | 'day' | 'week' | 'month';
  scope?: 'connector' | 'campaign' | 'product' | 'organization';
  taskTypes?: string[];
}

export interface BannedPhraseRule {
  phrases: string[];
  caseSensitive?: boolean;
  wholeWord?: boolean;
  regex?: boolean;
}

export interface RequiredPhraseRule {
  phrases: string[];
  atLeastOne?: boolean;
  caseSensitive?: boolean;
  location?: 'anywhere' | 'footer' | 'header';
}

export interface ClaimLockRule {
  requireVerified: boolean;
  allowedClaims?: string[];
  blockedClaims?: string[];
}

export interface DomainAllowlistRule {
  allowedDomains: string[];
  blockAll?: boolean;
}

export interface SuppressionRule {
  suppressionListId?: string;
  checkGlobalList: boolean;
  checkProductList: boolean;
}

export interface TimeWindowRule {
  allowedDays: number[]; // 0-6, Sunday-Saturday
  allowedHours: {
    start: number; // 0-23
    end: number; // 0-23
  };
  timezone: string;
}

export interface BudgetLimitRule {
  maxSpendCents: number;
  window: 'day' | 'week' | 'month' | 'campaign' | 'lifetime';
  scope: 'campaign' | 'product' | 'organization';
}

export interface ContentRule {
  maxLength?: number;
  minLength?: number;
  requiredElements?: string[];
  forbiddenElements?: string[];
  styleGuidelines?: Record<string, unknown>;
}

// Union type for all rule types
export type PolicyRule =
  | RateLimitRule
  | BannedPhraseRule
  | RequiredPhraseRule
  | ClaimLockRule
  | DomainAllowlistRule
  | SuppressionRule
  | TimeWindowRule
  | BudgetLimitRule
  | ContentRule;

// Task interface for validation
export interface TaskForValidation {
  id: string;
  campaign_id: string;
  type: string;
  title: string;
  description?: string | null;
  scheduled_for: string;
  connector_id?: string | null;
  input_data?: Record<string, unknown>;
  draft_content?: Record<string, unknown> | null;
  final_content?: Record<string, unknown> | null;
}

// Checker function type
export type PolicyChecker = (
  policy: Policy,
  task: TaskForValidation,
  context: ValidationContext
) => Promise<PolicyCheckResult>;

// Validation context
export interface ValidationContext {
  organizationId: string;
  productId?: string;
  checkType: CheckType;
  supabaseClient: any; // Supabase client instance
  timestamp: Date;
}

// Individual check result
export interface PolicyCheckResult {
  passed: boolean;
  violation?: PolicyViolation;
  warning?: PolicyWarning;
}
