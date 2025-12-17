import type {
  Policy,
  PolicyValidationResult,
  PolicyViolation,
  PolicyWarning,
  TaskForValidation,
  CheckType,
  ValidationContext,
  PolicyChecker,
} from './types';
import {
  checkRateLimit,
  checkBannedPhrases,
  checkRequiredPhrases,
  checkClaimLock,
  checkDomainAllowlist,
  checkSuppression,
  checkTimeWindow,
  checkBudgetLimit,
  checkContentRule,
} from './checkers';

/**
 * Map policy types to their checker functions
 */
const POLICY_CHECKERS: Record<string, PolicyChecker> = {
  rate_limit: checkRateLimit,
  banned_phrase: checkBannedPhrases,
  required_phrase: checkRequiredPhrases,
  claim_lock: checkClaimLock,
  domain_allowlist: checkDomainAllowlist,
  suppression: checkSuppression,
  time_window: checkTimeWindow,
  budget_limit: checkBudgetLimit,
  content_rule: checkContentRule,
};

/**
 * Determine which policies should be checked for a given check type
 */
function shouldCheckPolicy(policy: Policy, checkType: CheckType): boolean {
  // Define which policy types apply to which check stages
  const policyTypeStages: Record<string, CheckType[]> = {
    rate_limit: ['pre-draft', 'pre-execute'],
    banned_phrase: ['content', 'pre-execute'],
    required_phrase: ['content', 'pre-execute'],
    claim_lock: ['content', 'pre-execute'],
    domain_allowlist: ['content', 'pre-execute'],
    suppression: ['pre-execute'],
    time_window: ['pre-draft', 'pre-execute'],
    budget_limit: ['pre-draft', 'pre-execute'],
    content_rule: ['content', 'pre-execute'],
  };

  const stages = policyTypeStages[policy.type];
  return stages ? stages.includes(checkType) : false;
}

/**
 * Load active policies for an organization
 */
async function loadPolicies(
  organizationId: string,
  productId: string | undefined,
  supabaseClient: any
): Promise<Policy[]> {
  let query = supabaseClient
    .from('policies')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('active', true)
    .order('severity', { ascending: false }); // Check 'block' policies first

  // Get both organization-level and product-level policies
  if (productId) {
    query = query.or(`product_id.is.null,product_id.eq.${productId}`);
  } else {
    query = query.is('product_id', null);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error loading policies:', error);
    throw new Error(`Failed to load policies: ${error.message}`);
  }

  return data || [];
}

/**
 * Main policy validation engine
 *
 * @param task - The task to validate
 * @param organizationId - Organization ID for policy lookup
 * @param checkType - Stage of validation: 'pre-draft' | 'content' | 'pre-execute'
 * @param supabaseClient - Supabase client instance (admin or server)
 * @returns Validation result with violations, warnings, and feedback
 */
export async function validatePolicies(
  task: TaskForValidation,
  organizationId: string,
  checkType: CheckType,
  supabaseClient: any
): Promise<PolicyValidationResult> {
  const violations: PolicyViolation[] = [];
  const warnings: PolicyWarning[] = [];
  const timestamp = new Date();

  // Get product ID from task's campaign
  let productId: string | undefined;
  try {
    const { data: campaign } = await supabaseClient
      .from('campaigns')
      .select('product_id')
      .eq('id', task.campaign_id)
      .single();

    productId = campaign?.product_id;
  } catch (error) {
    console.error('Error fetching campaign for task:', error);
  }

  // Load applicable policies
  const policies = await loadPolicies(organizationId, productId, supabaseClient);

  // Filter policies for this check type
  const applicablePolicies = policies.filter((policy) => shouldCheckPolicy(policy, checkType));

  if (applicablePolicies.length === 0) {
    return {
      allowed: true,
      violations: [],
      warnings: [],
    };
  }

  // Create validation context
  const context: ValidationContext = {
    organizationId,
    productId,
    checkType,
    supabaseClient,
    timestamp,
  };

  // Run all applicable policy checks
  const checkPromises = applicablePolicies.map(async (policy) => {
    const checker = POLICY_CHECKERS[policy.type];

    if (!checker) {
      console.warn(`No checker found for policy type: ${policy.type}`);
      return null;
    }

    try {
      const result = await checker(policy, task, context);
      return { policy, result };
    } catch (error) {
      console.error(`Error checking policy ${policy.id} (${policy.name}):`, error);
      // Fail open - don't block on policy check errors
      return null;
    }
  });

  const checkResults = await Promise.all(checkPromises);

  // Process results
  let hasBlockingViolation = false;
  let hasEscalationViolation = false;

  for (const checkResult of checkResults) {
    if (!checkResult) continue;

    const { policy, result } = checkResult;

    if (!result.passed && result.violation) {
      violations.push(result.violation);

      if (policy.severity === 'block') {
        hasBlockingViolation = true;
      } else if (policy.severity === 'escalate') {
        hasEscalationViolation = true;
      }
    }

    if (result.warning) {
      warnings.push(result.warning);
    }
  }

  // Determine if allowed
  const allowed = !hasBlockingViolation;

  // Generate feedback message
  let feedback: string | undefined;
  if (violations.length > 0) {
    const blockingCount = violations.filter((v) => v.severity === 'block').length;
    const escalateCount = violations.filter((v) => v.severity === 'escalate').length;
    const warnCount = violations.filter((v) => v.severity === 'warn').length;

    const parts: string[] = [];
    if (blockingCount > 0) {
      parts.push(`${blockingCount} blocking violation(s)`);
    }
    if (escalateCount > 0) {
      parts.push(`${escalateCount} requiring escalation`);
    }
    if (warnCount > 0) {
      parts.push(`${warnCount} warning(s)`);
    }

    feedback = `Policy validation found ${parts.join(', ')}. ${
      hasBlockingViolation ? 'Task cannot proceed.' : hasEscalationViolation ? 'Manual approval required.' : 'Review recommended.'
    }`;
  } else if (warnings.length > 0) {
    feedback = `${warnings.length} policy warning(s) detected. Review recommended.`;
  }

  return {
    allowed,
    violations,
    warnings,
    feedback,
  };
}

/**
 * Convenience function to check if a task can proceed at the pre-draft stage
 */
export async function canDraftTask(
  task: TaskForValidation,
  organizationId: string,
  supabaseClient: any
): Promise<PolicyValidationResult> {
  return validatePolicies(task, organizationId, 'pre-draft', supabaseClient);
}

/**
 * Convenience function to validate drafted content
 */
export async function validateContent(
  task: TaskForValidation,
  organizationId: string,
  supabaseClient: any
): Promise<PolicyValidationResult> {
  return validatePolicies(task, organizationId, 'content', supabaseClient);
}

/**
 * Convenience function to check if a task can be executed
 */
export async function canExecuteTask(
  task: TaskForValidation,
  organizationId: string,
  supabaseClient: any
): Promise<PolicyValidationResult> {
  return validatePolicies(task, organizationId, 'pre-execute', supabaseClient);
}

/**
 * Get human-readable summary of policy violations
 */
export function formatViolationSummary(violations: PolicyViolation[]): string {
  if (violations.length === 0) {
    return 'No policy violations detected.';
  }

  const grouped = violations.reduce((acc, violation) => {
    if (!acc[violation.severity]) {
      acc[violation.severity] = [];
    }
    acc[violation.severity].push(violation);
    return acc;
  }, {} as Record<string, PolicyViolation[]>);

  const lines: string[] = ['Policy Violations:'];

  if (grouped.block) {
    lines.push('\nBLOCKING:');
    grouped.block.forEach((v) => {
      lines.push(`  - ${v.policyName}: ${v.message}`);
    });
  }

  if (grouped.escalate) {
    lines.push('\nESCALATION REQUIRED:');
    grouped.escalate.forEach((v) => {
      lines.push(`  - ${v.policyName}: ${v.message}`);
    });
  }

  if (grouped.warn) {
    lines.push('\nWARNINGS:');
    grouped.warn.forEach((v) => {
      lines.push(`  - ${v.policyName}: ${v.message}`);
    });
  }

  return lines.join('\n');
}

/**
 * Get human-readable summary of policy warnings
 */
export function formatWarningSummary(warnings: PolicyWarning[]): string {
  if (warnings.length === 0) {
    return 'No policy warnings.';
  }

  const lines: string[] = ['Policy Warnings:'];
  warnings.forEach((w) => {
    lines.push(`  - ${w.policyName}: ${w.message}`);
  });

  return lines.join('\n');
}
