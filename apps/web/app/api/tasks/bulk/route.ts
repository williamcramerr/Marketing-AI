import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { inngest } from '@/lib/inngest/client';

export const runtime = 'nodejs';

// Task types enum
const VALID_TASK_TYPES = [
  'blog_post',
  'landing_page',
  'email_single',
  'email_sequence',
  'social_post',
  'seo_optimization',
  'ad_campaign',
  'research',
  'analysis',
];

interface BulkTaskInput {
  campaign_id: string;
  type: string;
  title: string;
  description?: string;
  scheduled_for?: string;
  input_data?: Record<string, any>;
  priority?: number;
  connector_id?: string;
  dry_run?: boolean;
}

/**
 * POST /api/tasks/bulk - Create multiple tasks at once
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get organization
    const { data: membership } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .limit(1)
      .single();

    if (!membership) {
      return NextResponse.json({ error: 'No organization found' }, { status: 404 });
    }

    const body = await request.json();
    const { tasks: taskInputs, trigger_workflows } = body as {
      tasks: BulkTaskInput[];
      trigger_workflows?: boolean;
    };

    if (!taskInputs || !Array.isArray(taskInputs)) {
      return NextResponse.json({ error: 'tasks array is required' }, { status: 400 });
    }

    if (taskInputs.length === 0) {
      return NextResponse.json({ error: 'tasks array cannot be empty' }, { status: 400 });
    }

    if (taskInputs.length > 50) {
      return NextResponse.json({ error: 'Maximum 50 tasks per request' }, { status: 400 });
    }

    // Validate all tasks
    const errors: { index: number; error: string }[] = [];
    const validTasks: BulkTaskInput[] = [];

    for (let i = 0; i < taskInputs.length; i++) {
      const task = taskInputs[i];

      if (!task.campaign_id) {
        errors.push({ index: i, error: 'campaign_id is required' });
        continue;
      }
      if (!task.type || !VALID_TASK_TYPES.includes(task.type)) {
        errors.push({
          index: i,
          error: `Invalid task type. Must be one of: ${VALID_TASK_TYPES.join(', ')}`,
        });
        continue;
      }
      if (!task.title) {
        errors.push({ index: i, error: 'title is required' });
        continue;
      }

      validTasks.push(task);
    }

    if (errors.length > 0 && validTasks.length === 0) {
      return NextResponse.json({ error: 'All tasks failed validation', errors }, { status: 400 });
    }

    // Verify all campaigns belong to organization
    const campaignIds = [...new Set(validTasks.map((t) => t.campaign_id))];

    const { data: campaigns } = await supabase
      .from('campaigns')
      .select('id, product:products(organization_id)')
      .in('id', campaignIds);

    const validCampaignIds = new Set(
      campaigns
        ?.filter((c) => (c.product as any)?.organization_id === membership.organization_id)
        .map((c) => c.id) || []
    );

    // Filter out tasks with invalid campaigns
    const tasksToCreate = validTasks.filter((task) => {
      if (!validCampaignIds.has(task.campaign_id)) {
        errors.push({ index: taskInputs.indexOf(task), error: 'Campaign not found' });
        return false;
      }
      return true;
    });

    if (tasksToCreate.length === 0) {
      return NextResponse.json(
        { error: 'No valid tasks to create', errors },
        { status: 400 }
      );
    }

    // Create all tasks
    const now = new Date().toISOString();
    const tasksData = tasksToCreate.map((task, index) => ({
      campaign_id: task.campaign_id,
      type: task.type,
      title: task.title,
      description: task.description || null,
      scheduled_for: task.scheduled_for || now,
      input_data: task.input_data || {},
      idempotency_key: `bulk_${now}_${index}_${Math.random().toString(36).substring(2, 9)}`,
      status: 'queued',
      priority: task.priority || 50,
      created_by: user.id,
      connector_id: task.connector_id || null,
      dry_run: task.dry_run ?? false,
      status_history: [
        {
          status: 'queued',
          timestamp: now,
          note: 'Task created via bulk API',
        },
      ],
    }));

    const { data: createdTasks, error: createError } = await supabase
      .from('tasks')
      .insert(tasksData)
      .select();

    if (createError) {
      return NextResponse.json({ error: createError.message }, { status: 500 });
    }

    // Trigger workflows if requested
    let workflowResults: { taskId: string; triggered: boolean; error?: string }[] = [];

    if (trigger_workflows && createdTasks) {
      workflowResults = await Promise.all(
        createdTasks.map(async (task) => {
          try {
            await inngest.send({
              name: 'task/workflow.start',
              data: {
                taskId: task.id,
                organizationId: membership.organization_id,
              },
            });
            return { taskId: task.id, triggered: true };
          } catch (err: any) {
            return { taskId: task.id, triggered: false, error: err.message };
          }
        })
      );
    }

    return NextResponse.json(
      {
        data: createdTasks,
        created_count: createdTasks?.length || 0,
        errors: errors.length > 0 ? errors : undefined,
        workflows: trigger_workflows ? workflowResults : undefined,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Error creating bulk tasks:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
