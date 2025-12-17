/**
 * Example usage patterns for the Policy Engine
 *
 * These examples demonstrate how to use the policy engine in various scenarios.
 * Copy and adapt these patterns to your specific use cases.
 */

import {
  validatePolicies,
  canDraftTask,
  validateContent,
  canExecuteTask,
  formatViolationSummary,
  formatWarningSummary,
  type TaskForValidation,
  type PolicyValidationResult,
} from './index';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Example 1: Validate task before drafting content
 */
export async function example1_preDraftValidation() {
  const supabase = await createClient();

  const task: TaskForValidation = {
    id: 'task-123',
    campaign_id: 'campaign-456',
    type: 'email_single',
    title: 'Weekly Newsletter',
    scheduled_for: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
    connector_id: 'connector-789',
  };

  const result = await canDraftTask(task, 'org-123', supabase);

  if (!result.allowed) {
    console.error('Cannot draft task due to policy violations:');
    console.error(formatViolationSummary(result.violations));
    return false;
  }

  if (result.warnings.length > 0) {
    console.warn('Warnings detected:');
    console.warn(formatWarningSummary(result.warnings));
  }

  return true;
}

/**
 * Example 2: Validate drafted content
 */
export async function example2_contentValidation() {
  const supabase = await createClient();

  const task: TaskForValidation = {
    id: 'task-123',
    campaign_id: 'campaign-456',
    type: 'email_single',
    title: 'Weekly Newsletter',
    scheduled_for: new Date().toISOString(),
    draft_content: {
      subject: 'Your Weekly Update',
      body: `
        Hello!

        Check out our latest products and offers.

        Best regards,
        The Team

        Unsubscribe: https://example.com/unsubscribe
      `,
      from: 'newsletter@example.com',
    },
  };

  const result = await validateContent(task, 'org-123', supabase);

  if (!result.allowed) {
    // Handle blocking violations
    console.error('Content validation failed:', result.feedback);
    return { success: false, violations: result.violations };
  }

  return { success: true, warnings: result.warnings };
}

/**
 * Example 3: Pre-execution validation with all checks
 */
export async function example3_preExecutionValidation() {
  const supabase = await createClient();

  const task: TaskForValidation = {
    id: 'task-123',
    campaign_id: 'campaign-456',
    type: 'email_single',
    title: 'Weekly Newsletter',
    scheduled_for: new Date().toISOString(),
    connector_id: 'connector-789',
    final_content: {
      subject: 'Your Weekly Update',
      body: 'Content here...',
      from: 'newsletter@example.com',
      to: ['subscriber@example.com'],
    },
  };

  const result = await canExecuteTask(task, 'org-123', supabase);

  if (!result.allowed) {
    const blockingViolations = result.violations.filter((v) => v.severity === 'block');
    const escalationViolations = result.violations.filter((v) => v.severity === 'escalate');

    if (blockingViolations.length > 0) {
      console.error('Task blocked:', formatViolationSummary(blockingViolations));
      return { canExecute: false, requiresApproval: false };
    }

    if (escalationViolations.length > 0) {
      console.warn('Task requires approval:', formatViolationSummary(escalationViolations));
      return { canExecute: false, requiresApproval: true };
    }
  }

  return { canExecute: true, requiresApproval: false };
}

/**
 * Example 4: Using the policy engine in an API route
 */
export async function example4_apiRouteIntegration(taskId: string, organizationId: string) {
  const supabase = await createClient();

  // Fetch task from database
  const { data: task, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('id', taskId)
    .single();

  if (error || !task) {
    throw new Error('Task not found');
  }

  // Validate content
  const result = await validateContent(task, organizationId, supabase);

  // Return formatted response
  return {
    success: result.allowed,
    violations: result.violations,
    warnings: result.warnings,
    feedback: result.feedback,
    summary: {
      blocking: result.violations.filter((v) => v.severity === 'block').length,
      escalation: result.violations.filter((v) => v.severity === 'escalate').length,
      warnings: result.warnings.length,
    },
  };
}

/**
 * Example 5: Complete task workflow with policy checks
 */
export async function example5_fullTaskWorkflow(taskId: string, organizationId: string) {
  const supabase = createAdminClient(); // Use admin client for background jobs

  // 1. Fetch task
  const { data: task, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('id', taskId)
    .single();

  if (error || !task) {
    throw new Error('Task not found');
  }

  // 2. Pre-draft validation
  const preDraftResult = await canDraftTask(task, organizationId, supabase);
  if (!preDraftResult.allowed) {
    await supabase
      .from('tasks')
      .update({
        status: 'failed',
        error_log: {
          stage: 'pre-draft',
          violations: preDraftResult.violations,
        },
      })
      .eq('id', taskId);

    return { success: false, stage: 'pre-draft', result: preDraftResult };
  }

  // 3. Draft content (AI generation would happen here)
  await supabase
    .from('tasks')
    .update({ status: 'drafting' })
    .eq('id', taskId);

  // Simulate content generation
  const draftedTask = {
    ...task,
    draft_content: {
      subject: 'Example Subject',
      body: 'Example body with required disclaimers. Unsubscribe here.',
    },
  };

  // 4. Content validation
  const contentResult = await validateContent(draftedTask, organizationId, supabase);

  if (!contentResult.allowed) {
    const hasBlockingViolations = contentResult.violations.some((v) => v.severity === 'block');

    if (hasBlockingViolations) {
      await supabase
        .from('tasks')
        .update({
          status: 'failed',
          error_log: {
            stage: 'content-validation',
            violations: contentResult.violations,
          },
        })
        .eq('id', taskId);

      return { success: false, stage: 'content-validation', result: contentResult };
    }

    // If only escalation violations, request approval
    const hasEscalationViolations = contentResult.violations.some((v) => v.severity === 'escalate');
    if (hasEscalationViolations) {
      await supabase
        .from('tasks')
        .update({ status: 'pending_approval' })
        .eq('id', taskId);

      await supabase.from('approvals').insert({
        task_id: taskId,
        status: 'pending',
        content_snapshot: draftedTask.draft_content,
      });

      return { success: false, stage: 'awaiting-approval', result: contentResult };
    }
  }

  // 5. Save draft and move to pre-execute
  await supabase
    .from('tasks')
    .update({
      status: 'drafted',
      draft_content: draftedTask.draft_content,
      final_content: draftedTask.draft_content, // Finalize content
    })
    .eq('id', taskId);

  // 6. Pre-execution validation
  const preExecuteResult = await canExecuteTask(
    { ...draftedTask, final_content: draftedTask.draft_content },
    organizationId,
    supabase
  );

  if (!preExecuteResult.allowed) {
    await supabase
      .from('tasks')
      .update({
        status: 'failed',
        error_log: {
          stage: 'pre-execute',
          violations: preExecuteResult.violations,
        },
      })
      .eq('id', taskId);

    return { success: false, stage: 'pre-execute', result: preExecuteResult };
  }

  // 7. Execute task
  await supabase
    .from('tasks')
    .update({ status: 'executing' })
    .eq('id', taskId);

  // Execution logic here...

  return {
    success: true,
    stage: 'executing',
    warnings: [
      ...preDraftResult.warnings,
      ...contentResult.warnings,
      ...preExecuteResult.warnings,
    ],
  };
}

/**
 * Example 6: Handling policy violations in a UI component
 */
export async function example6_uiIntegration(taskId: string, organizationId: string) {
  const supabase = await createClient();

  // Fetch task
  const { data: task } = await supabase
    .from('tasks')
    .select('*')
    .eq('id', taskId)
    .single();

  if (!task) {
    return { error: 'Task not found' };
  }

  // Validate
  const result = await validateContent(task, organizationId, supabase);

  // Format for UI display
  return {
    canProceed: result.allowed,
    feedback: result.feedback,
    violations: result.violations.map((v) => ({
      id: v.policyId,
      title: v.policyName,
      message: v.message,
      severity: v.severity,
      type: v.policyType,
    })),
    warnings: result.warnings.map((w) => ({
      id: w.policyId,
      title: w.policyName,
      message: w.message,
      type: w.policyType,
    })),
    summary: {
      totalViolations: result.violations.length,
      blockingCount: result.violations.filter((v) => v.severity === 'block').length,
      escalationCount: result.violations.filter((v) => v.severity === 'escalate').length,
      warningCount: result.warnings.length,
    },
  };
}

/**
 * Example 7: Custom check type validation
 */
export async function example7_customCheckType(task: TaskForValidation, organizationId: string) {
  const supabase = await createClient();

  // Run all three check types and aggregate results
  const [preDraft, content, preExecute] = await Promise.all([
    validatePolicies(task, organizationId, 'pre-draft', supabase),
    validatePolicies(task, organizationId, 'content', supabase),
    validatePolicies(task, organizationId, 'pre-execute', supabase),
  ]);

  // Aggregate all violations and warnings
  const allViolations = [...preDraft.violations, ...content.violations, ...preExecute.violations];
  const allWarnings = [...preDraft.warnings, ...content.warnings, ...preExecute.warnings];

  // Check if any stage blocks execution
  const canProceed = preDraft.allowed && content.allowed && preExecute.allowed;

  return {
    canProceed,
    stages: {
      preDraft: { allowed: preDraft.allowed, violations: preDraft.violations.length },
      content: { allowed: content.allowed, violations: content.violations.length },
      preExecute: { allowed: preExecute.allowed, violations: preExecute.violations.length },
    },
    violations: allViolations,
    warnings: allWarnings,
    summary: formatViolationSummary(allViolations),
  };
}
