import { inngest } from '../client';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  validatePolicies as validatePoliciesEngine,
  formatViolationSummary,
} from '@/lib/policies/engine';
import type { TaskForValidation, CheckType, PolicyValidationResult } from '@/lib/policies/types';

// Main task workflow - processes tasks through the state machine
export const taskWorkflow = inngest.createFunction(
  {
    id: 'task-workflow',
    retries: 3,
    onFailure: async ({ event, error }) => {
      const supabase = createAdminClient();
      // The event structure in onFailure contains the original event nested
      const failureEvent = event as unknown as {
        event: { data: { taskId: string; organizationId: string } };
      };
      const { taskId, organizationId } = failureEvent.event.data;

      await supabase
        .from('tasks')
        .update({
          status: 'failed',
          error_log: [
            {
              error: error.message,
              timestamp: new Date().toISOString(),
              step: 'workflow_failure',
            },
          ],
        })
        .eq('id', taskId);

      // Log to audit
      await supabase.from('audit_logs').insert({
        organization_id: organizationId,
        action: 'task.failed',
        actor_type: 'system',
        actor_id: 'inngest',
        resource_type: 'task',
        resource_id: taskId,
        metadata: { error: error.message },
      });
    },
  },
  { event: 'task/queued' },
  async ({ event, step }) => {
    const { taskId, organizationId } = event.data;
    const supabase = createAdminClient();

    // Step 1: Load task and related data
    const task = await step.run('load-task', async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select(
          `
          *,
          campaign:campaigns(
            *,
            product:products(
              *,
              organization_id
            ),
            audience:audiences(*)
          ),
          connector:connectors(*)
        `
        )
        .eq('id', taskId)
        .single();

      if (error) throw new Error(`Failed to load task: ${error.message}`);
      return data;
    });

    // Step 2: Pre-draft policy validation
    const preCheckResult = await step.run('validate-pre-draft', async () => {
      return validatePolicies(supabase, task, organizationId, 'pre-draft');
    });

    if (!preCheckResult.allowed) {
      await step.run('block-task', async () => {
        await supabase
          .from('tasks')
          .update({
            status: 'cancelled',
            error_log: [
              {
                type: 'policy_violation',
                violations: preCheckResult.violations,
                timestamp: new Date().toISOString(),
              },
            ],
          })
          .eq('id', taskId);
      });
      return { status: 'blocked', reason: preCheckResult.violations };
    }

    // Step 3: Update status to drafting
    await step.run('status-drafting', async () => {
      await supabase
        .from('tasks')
        .update({
          status: 'drafting',
          started_at: new Date().toISOString(),
        })
        .eq('id', taskId);
    });

    // Step 4: Generate draft content using Claude
    const draft = await step.run('generate-draft', async () => {
      return await generateContent(task);
    });

    // Step 5: Content policy validation
    const contentCheck = await step.run('validate-content', async () => {
      return validatePolicies(
        supabase,
        { ...task, draft_content: draft },
        organizationId,
        'content'
      );
    });

    if (!contentCheck.allowed) {
      // Could regenerate with feedback, for now just block
      await step.run('content-blocked', async () => {
        await supabase
          .from('tasks')
          .update({
            status: 'failed',
            draft_content: draft,
            error_log: [
              {
                type: 'content_policy_violation',
                violations: contentCheck.violations,
                feedback: contentCheck.feedback,
                timestamp: new Date().toISOString(),
              },
            ],
          })
          .eq('id', taskId);
      });
      return { status: 'content_blocked', violations: contentCheck.violations };
    }

    // Step 6: Save draft and check approval requirements
    const connector = task.connector;
    const needsApproval =
      connector?.approval_required &&
      !connector?.auto_approve_types?.includes(task.type);

    if (needsApproval) {
      // Submit for approval
      await step.run('request-approval', async () => {
        await supabase
          .from('tasks')
          .update({
            status: 'pending_approval',
            draft_content: draft,
          })
          .eq('id', taskId);

        await supabase.from('approvals').insert({
          task_id: taskId,
          status: 'pending',
          content_snapshot: draft,
          expires_at: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(), // 72h
        });
      });

      // Wait for approval event (with timeout)
      const approval = await step.waitForEvent('wait-for-approval', {
        event: 'task/approved',
        match: 'data.taskId',
        timeout: '72h',
      });

      if (!approval) {
        await step.run('expire-approval', async () => {
          await supabase
            .from('approvals')
            .update({ status: 'expired' })
            .eq('task_id', taskId)
            .eq('status', 'pending');

          await supabase
            .from('tasks')
            .update({ status: 'cancelled' })
            .eq('id', taskId);
        });
        return { status: 'expired' };
      }
    } else {
      // Auto-approve
      await step.run('auto-approve', async () => {
        await supabase
          .from('tasks')
          .update({
            status: 'approved',
            draft_content: draft,
            final_content: draft,
          })
          .eq('id', taskId);

        await supabase.from('approvals').insert({
          task_id: taskId,
          status: 'auto_approved',
          content_snapshot: draft,
          resolved_at: new Date().toISOString(),
        });
      });
    }

    // Step 7: Execute (unless dry run)
    if (task.dry_run) {
      await step.run('complete-dry-run', async () => {
        await supabase
          .from('tasks')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            execution_result: {
              dry_run: true,
              would_execute: task.type,
              content_preview: draft,
            },
          })
          .eq('id', taskId);
      });
      return { status: 'dry_run_completed', taskId };
    }

    // Step 7: Pre-execution policy check
    const preExecuteCheck = await step.run('validate-pre-execute', async () => {
      return validatePolicies(supabase, task, organizationId, 'pre-execute');
    });

    if (!preExecuteCheck.allowed) {
      await step.run('execution-blocked', async () => {
        await supabase
          .from('tasks')
          .update({
            status: 'failed',
            error_log: [
              {
                type: 'execution_policy_violation',
                violations: preExecuteCheck.violations,
                timestamp: new Date().toISOString(),
              },
            ],
          })
          .eq('id', taskId);
      });
      return { status: 'execution_blocked', violations: preExecuteCheck.violations };
    }

    // Step 8: Execute the task via connector
    const executionResult = await step.run('execute', async () => {
      await supabase
        .from('tasks')
        .update({ status: 'executing' })
        .eq('id', taskId);

      // Execute based on task type and connector
      const result = await executeTask(task, connector, task.final_content || draft);

      // Update connector last_used_at
      if (connector) {
        await supabase
          .from('connectors')
          .update({
            last_used_at: new Date().toISOString(),
            last_error: null,
          })
          .eq('id', connector.id);
      }

      await supabase
        .from('tasks')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          execution_result: result,
        })
        .eq('id', taskId);

      return result;
    });

    // Step 9: Schedule metrics collection
    await step.sleep('wait-for-metrics', '1h');

    // Step 10: Collect metrics and evaluate
    const metrics = await step.run('collect-metrics', async () => {
      return await collectTaskMetrics(task, executionResult);
    });

    await step.run('evaluate', async () => {
      // Store metrics and update status
      await supabase
        .from('tasks')
        .update({
          status: 'evaluated',
          execution_result: {
            ...executionResult,
            metrics,
          },
        })
        .eq('id', taskId);

      // Send metrics event
      await inngest.send({
        name: 'metrics/collected',
        data: {
          taskId,
          metrics,
        },
      });

      // Log completion
      await supabase.from('audit_logs').insert({
        organization_id: organizationId,
        action: 'task.evaluated',
        actor_type: 'system',
        actor_id: 'inngest',
        resource_type: 'task',
        resource_id: taskId,
        metadata: { metrics },
      });
    });

    return { status: 'completed', taskId };
  }
);

// Approval handler
export const taskApprovalHandler = inngest.createFunction(
  { id: 'task-approval-handler' },
  { event: 'task/approved' },
  async ({ event, step }) => {
    const { taskId, approverId } = event.data;
    const supabase = createAdminClient();

    await step.run('process-approval', async () => {
      // Update approval record
      await supabase
        .from('approvals')
        .update({
          status: 'approved',
          resolved_at: new Date().toISOString(),
          resolved_by: approverId,
        })
        .eq('task_id', taskId)
        .eq('status', 'pending');

      // Update task to approved
      const { data: task } = await supabase
        .from('tasks')
        .select('draft_content')
        .eq('id', taskId)
        .single();

      await supabase
        .from('tasks')
        .update({
          status: 'approved',
          final_content: task?.draft_content,
        })
        .eq('id', taskId);
    });

    return { status: 'approved', taskId };
  }
);

// Heartbeat function - runs every minute to check for work
export const heartbeatFunction = inngest.createFunction(
  {
    id: 'heartbeat',
    retries: 0,
  },
  { cron: '* * * * *' }, // Every minute
  async ({ step }) => {
    const supabase = createAdminClient();

    // Check for queued tasks ready to process
    const queuedTasks = await step.run('check-queued-tasks', async () => {
      const { data } = await supabase
        .from('tasks')
        .select(
          `
          id,
          campaign:campaigns(
            product:products(organization_id)
          )
        `
        )
        .eq('status', 'queued')
        .lte('scheduled_for', new Date().toISOString())
        .limit(10);

      return data || [];
    });

    // Check for expired approvals
    const expiredApprovals = await step.run('check-expired-approvals', async () => {
      const { data } = await supabase
        .from('approvals')
        .select('id, task_id')
        .eq('status', 'pending')
        .lte('expires_at', new Date().toISOString());

      return data || [];
    });

    // Process expired approvals
    if (expiredApprovals.length > 0) {
      await step.run('expire-approvals', async () => {
        for (const approval of expiredApprovals) {
          await supabase
            .from('approvals')
            .update({ status: 'expired' })
            .eq('id', approval.id);

          await supabase
            .from('tasks')
            .update({ status: 'cancelled' })
            .eq('id', approval.task_id);
        }
      });
    }

    // Trigger task workflows
    if (queuedTasks.length > 0) {
      await step.run('trigger-tasks', async () => {
        for (const task of queuedTasks) {
          // Handle nested relations that may be arrays
          const campaign = Array.isArray(task.campaign) ? task.campaign[0] : task.campaign;
          const product = campaign ? (Array.isArray(campaign.product) ? campaign.product[0] : campaign.product) : null;

          await inngest.send({
            name: 'task/queued',
            data: {
              taskId: task.id,
              organizationId: product?.organization_id || '',
            },
          });
        }
      });
    }

    return {
      tasksTriggered: queuedTasks.length,
      approvalsExpired: expiredApprovals.length,
    };
  }
);

// Emergency stop handler
export const emergencyStopHandler = inngest.createFunction(
  { id: 'emergency-stop' },
  { event: 'emergency/stop' },
  async ({ event, step }) => {
    const { organizationId, triggeredBy } = event.data;
    const supabase = createAdminClient();

    await step.run('execute-emergency-stop', async () => {
      // Get all products for this org
      const { data: products } = await supabase
        .from('products')
        .select('id')
        .eq('organization_id', organizationId);

      const productIds = products?.map((p) => p.id) || [];

      // Pause all active campaigns
      await supabase
        .from('campaigns')
        .update({ status: 'paused' })
        .in('product_id', productIds)
        .in('status', ['active', 'planned']);

      // Cancel all pending tasks
      const { data: campaigns } = await supabase
        .from('campaigns')
        .select('id')
        .in('product_id', productIds);

      const campaignIds = campaigns?.map((c) => c.id) || [];

      await supabase
        .from('tasks')
        .update({
          status: 'cancelled',
          error_log: [
            {
              type: 'emergency_stop',
              triggered_by: triggeredBy,
              timestamp: new Date().toISOString(),
            },
          ],
        })
        .in('campaign_id', campaignIds)
        .in('status', [
          'queued',
          'drafting',
          'drafted',
          'pending_approval',
          'approved',
          'executing',
        ]);

      // Enable sandbox mode
      await supabase
        .from('organizations')
        .update({
          settings: { sandbox_mode: true },
        })
        .eq('id', organizationId);

      // Audit log
      await supabase.from('audit_logs').insert({
        organization_id: organizationId,
        action: 'emergency_stop',
        actor_type: 'user',
        actor_id: triggeredBy,
        metadata: {
          campaigns_paused: campaignIds.length,
          timestamp: new Date().toISOString(),
        },
      });
    });

    return { status: 'stopped', organizationId };
  }
);

// Helper functions

interface PolicyCheckResult {
  allowed: boolean;
  violations: Array<{ policyId: string; message: string }>;
  feedback?: string;
}

/**
 * Wrapper function to use the policy engine for validation
 * Maps the task data to TaskForValidation format
 */
async function validatePolicies(
  supabase: ReturnType<typeof createAdminClient>,
  task: any,
  organizationId: string,
  checkType: 'pre-draft' | 'content' | 'pre-execute'
): Promise<PolicyCheckResult> {
  // Map task to TaskForValidation format
  const taskForValidation: TaskForValidation = {
    id: task.id,
    campaign_id: task.campaign_id,
    type: task.type,
    title: task.title,
    description: task.description,
    scheduled_for: task.scheduled_for || new Date().toISOString(),
    connector_id: task.connector_id,
    input_data: task.input_data,
    draft_content: task.draft_content,
    final_content: task.final_content,
  };

  // Use the proper policy engine
  const result: PolicyValidationResult = await validatePoliciesEngine(
    taskForValidation,
    organizationId,
    checkType as CheckType,
    supabase
  );

  // Map the result to the expected format
  const violations = result.violations.map((v) => ({
    policyId: v.policyId,
    message: v.message,
  }));

  return {
    allowed: result.allowed,
    violations,
    feedback: result.feedback,
  };
}

async function executeTask(
  task: any,
  connector: any,
  content: any
): Promise<Record<string, unknown>> {
  // Check rate limits before execution
  if (connector?.rate_limit_per_hour || connector?.rate_limit_per_day) {
    const supabase = createAdminClient();
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    if (connector.rate_limit_per_hour) {
      const { count } = await supabase
        .from('tasks')
        .select('*', { count: 'exact', head: true })
        .eq('connector_id', connector.id)
        .eq('status', 'completed')
        .gte('completed_at', hourAgo);

      if ((count || 0) >= connector.rate_limit_per_hour) {
        throw new Error(
          `Rate limit exceeded: ${connector.rate_limit_per_hour} tasks per hour`
        );
      }
    }

    if (connector.rate_limit_per_day) {
      const { count } = await supabase
        .from('tasks')
        .select('*', { count: 'exact', head: true })
        .eq('connector_id', connector.id)
        .eq('status', 'completed')
        .gte('completed_at', dayAgo);

      if ((count || 0) >= connector.rate_limit_per_day) {
        throw new Error(`Rate limit exceeded: ${connector.rate_limit_per_day} tasks per day`);
      }
    }
  }

  // Execute based on task type and connector
  // This is where you would integrate with actual APIs (Resend, Ghost, Twitter, etc.)

  try {
    switch (task.type) {
      case 'email_single':
      case 'email_sequence':
        return await executeEmailTask(task, connector, content);

      case 'blog_post':
      case 'landing_page':
        return await executeCMSTask(task, connector, content);

      case 'social_post':
        return await executeSocialTask(task, connector, content);

      case 'ad_campaign':
        return await executeAdTask(task, connector, content);

      default:
        return {
          type: task.type,
          status: 'completed',
          timestamp: new Date().toISOString(),
        };
    }
  } catch (error) {
    // Update connector with error
    if (connector) {
      const supabase = createAdminClient();
      await supabase
        .from('connectors')
        .update({
          last_error: error instanceof Error ? error.message : 'Unknown error',
        })
        .eq('id', connector.id);
    }
    throw error;
  }
}

// Connector-specific execution functions
async function executeEmailTask(
  task: any,
  connector: any,
  content: any
): Promise<Record<string, unknown>> {
  // Example integration with Resend or similar email service
  // const resend = new Resend(connector.credentials.api_key);
  // const result = await resend.emails.send({ ... });

  return {
    type: 'email',
    connector: connector?.type || 'email',
    status: 'sent',
    message_id: `mock-email-${Date.now()}`,
    subject: content.subject,
    recipients: content.recipients?.length || 0,
    timestamp: new Date().toISOString(),
  };
}

async function executeCMSTask(
  task: any,
  connector: any,
  content: any
): Promise<Record<string, unknown>> {
  // Example integration with Ghost, WordPress, or similar CMS
  // const cms = new CMSClient(connector.credentials);
  // const result = await cms.posts.create({ ... });

  return {
    type: 'cms',
    connector: connector?.type || 'cms',
    status: 'published',
    url: `https://example.com/blog/${task.id}`,
    title: content.title,
    timestamp: new Date().toISOString(),
  };
}

async function executeSocialTask(
  task: any,
  connector: any,
  content: any
): Promise<Record<string, unknown>> {
  // Example integration with Twitter, LinkedIn, etc.
  // const social = new SocialClient(connector.credentials);
  // const result = await social.post.create({ ... });

  return {
    type: 'social',
    connector: connector?.type || 'social',
    status: 'posted',
    post_id: `mock-post-${Date.now()}`,
    platform: connector?.config?.platform || 'unknown',
    content_length: content.text?.length || 0,
    timestamp: new Date().toISOString(),
  };
}

async function executeAdTask(
  task: any,
  connector: any,
  content: any
): Promise<Record<string, unknown>> {
  // Example integration with Google Ads, Facebook Ads, etc.
  // const ads = new AdsClient(connector.credentials);
  // const result = await ads.campaigns.create({ ... });

  return {
    type: 'ad',
    connector: connector?.type || 'ads',
    status: 'created',
    campaign_id: `mock-campaign-${Date.now()}`,
    platform: connector?.config?.platform || 'unknown',
    timestamp: new Date().toISOString(),
  };
}

// Content generation function
async function generateContent(task: any): Promise<Record<string, unknown>> {
  // This would integrate with Claude API for content generation
  // For now, we'll use a structured template based on task type

  const campaign = task.campaign;
  const product = campaign?.product;
  const audience = campaign?.audience;

  // Build context for content generation
  const context = {
    product: {
      name: product?.name,
      description: product?.description,
      positioning: product?.positioning,
      verified_claims: product?.verified_claims,
    },
    audience: {
      name: audience?.name,
      icp_attributes: audience?.icp_attributes,
      pain_points: audience?.pain_points,
      messaging_angles: audience?.messaging_angles,
    },
    campaign: {
      goal: campaign?.goal,
      channels: campaign?.channels,
    },
    task: {
      type: task.type,
      title: task.title,
      description: task.description,
      input_data: task.input_data,
    },
  };

  // Here you would call Claude API:
  // const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  // const response = await anthropic.messages.create({ ... });

  // For now, return a structured template
  switch (task.type) {
    case 'email_single':
    case 'email_sequence':
      return {
        subject: `${task.title}`,
        preview_text: `Learn more about ${product?.name}`,
        body_html: `<p>AI-generated email content for ${product?.name}</p>`,
        body_text: `AI-generated email content for ${product?.name}`,
        metadata: {
          generated_at: new Date().toISOString(),
          model: 'claude-sonnet-4-20250514',
          context,
        },
      };

    case 'blog_post':
      return {
        title: task.title,
        slug: task.title.toLowerCase().replace(/\s+/g, '-'),
        excerpt: `AI-generated blog post about ${product?.name}`,
        body: `# ${task.title}\n\nAI-generated content for ${product?.name}...`,
        seo_title: task.title,
        seo_description: `Learn about ${product?.name}`,
        metadata: {
          generated_at: new Date().toISOString(),
          model: 'claude-sonnet-4-20250514',
          context,
        },
      };

    case 'social_post':
      return {
        text: `Check out ${product?.name}! ${task.title}`,
        hashtags: ['marketing', 'automation'],
        media_urls: [],
        metadata: {
          generated_at: new Date().toISOString(),
          model: 'claude-sonnet-4-20250514',
          context,
        },
      };

    case 'landing_page':
      return {
        title: task.title,
        headline: `Discover ${product?.name}`,
        subheadline: product?.description || 'AI-powered solution',
        sections: [
          { type: 'hero', content: 'Hero section content' },
          { type: 'features', content: 'Features section content' },
          { type: 'cta', content: 'Call to action' },
        ],
        metadata: {
          generated_at: new Date().toISOString(),
          model: 'claude-sonnet-4-20250514',
          context,
        },
      };

    default:
      return {
        title: task.title,
        content: `AI-generated content for ${task.type}`,
        metadata: {
          generated_at: new Date().toISOString(),
          model: 'claude-sonnet-4-20250514',
          context,
        },
      };
  }
}

// Metrics collection function
async function collectTaskMetrics(
  task: any,
  executionResult: Record<string, unknown>
): Promise<Record<string, number>> {
  // This would integrate with analytics platforms to collect real metrics
  // For now, return mock metrics based on task type

  const baseMetrics = {
    completed_at: Date.now(),
    execution_time_ms: 1000,
  };

  switch (task.type) {
    case 'email_single':
    case 'email_sequence':
      return {
        ...baseMetrics,
        emails_sent: 1,
        emails_delivered: 0, // Would be updated by webhook
        emails_opened: 0,
        emails_clicked: 0,
        bounce_rate: 0,
      };

    case 'blog_post':
      return {
        ...baseMetrics,
        views: 0,
        unique_visitors: 0,
        avg_time_on_page: 0,
        bounce_rate: 0,
      };

    case 'social_post':
      return {
        ...baseMetrics,
        impressions: 0,
        engagements: 0,
        likes: 0,
        shares: 0,
        comments: 0,
      };

    case 'ad_campaign':
      return {
        ...baseMetrics,
        impressions: 0,
        clicks: 0,
        conversions: 0,
        cost_cents: 0,
        ctr: 0,
      };

    default:
      return baseMetrics;
  }
}
