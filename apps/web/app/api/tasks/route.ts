import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { inngest } from '@/lib/inngest/client';
import {
  validateBody,
  validateQuery,
  createTaskSchema,
  listTasksQuerySchema,
  TASK_TYPES,
} from '@/lib/validation';

export const runtime = 'nodejs';

/**
 * GET /api/tasks - List tasks for the organization
 */
export async function GET(request: NextRequest) {
  try {
    // Validate query parameters
    const queryResult = validateQuery(request, listTasksQuerySchema);
    if (!queryResult.success) {
      return queryResult.response;
    }
    const { limit, offset, campaign_id, status, type } = queryResult.data;

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

    // Get campaigns for this organization
    const { data: products } = await supabase
      .from('products')
      .select('id')
      .eq('organization_id', membership.organization_id);

    const productIds = products?.map((p) => p.id) || [];

    if (productIds.length === 0) {
      return NextResponse.json({ data: [], total: 0 });
    }

    const { data: campaigns } = await supabase
      .from('campaigns')
      .select('id')
      .in('product_id', productIds);

    const campaignIds = campaigns?.map((c) => c.id) || [];

    if (campaignIds.length === 0) {
      return NextResponse.json({ data: [], total: 0 });
    }

    // Build query
    let query = supabase
      .from('tasks')
      .select(
        `
        *,
        campaign:campaigns(id, name, product:products(id, name))
      `,
        { count: 'exact' }
      )
      .in('campaign_id', campaignIds)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (campaign_id) {
      query = query.eq('campaign_id', campaign_id);
    }
    if (status) {
      query = query.eq('status', status);
    }
    if (type) {
      query = query.eq('type', type);
    }

    const { data: tasks, error, count } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      data: tasks,
      total: count || 0,
      limit,
      offset,
    });
  } catch (error: unknown) {
    console.error('Error listing tasks:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/tasks - Create a new task
 */
export async function POST(request: NextRequest) {
  try {
    // Validate request body
    const bodyResult = await validateBody(request, createTaskSchema);
    if (!bodyResult.success) {
      return bodyResult.response;
    }
    const validatedData = bodyResult.data;

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

    // Verify campaign belongs to organization
    const { data: campaign } = await supabase
      .from('campaigns')
      .select('id, product:products(organization_id)')
      .eq('id', validatedData.campaign_id)
      .single();

    const orgId = (campaign?.product as { organization_id?: string })?.organization_id;
    if (orgId !== membership.organization_id) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    // Generate idempotency key if not provided
    const idempotencyKey =
      validatedData.idempotency_key ||
      `task_${validatedData.campaign_id}_${validatedData.type}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    // Create task
    const { data: task, error: createError } = await supabase
      .from('tasks')
      .insert({
        campaign_id: validatedData.campaign_id,
        type: validatedData.type,
        title: validatedData.title,
        description: validatedData.description || null,
        scheduled_for: validatedData.scheduled_for || new Date().toISOString(),
        input_data: validatedData.input_data || {},
        idempotency_key: idempotencyKey,
        status: 'queued',
        priority: validatedData.priority || 50,
        created_by: user.id,
        connector_id: validatedData.connector_id || null,
        dry_run: validatedData.dry_run ?? false,
        status_history: [
          {
            status: 'queued',
            timestamp: new Date().toISOString(),
            note: 'Task created via API',
          },
        ],
      })
      .select()
      .single();

    if (createError) {
      // Handle duplicate idempotency key
      if (createError.code === '23505') {
        return NextResponse.json(
          { error: 'Task with this idempotency key already exists' },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: createError.message }, { status: 500 });
    }

    // Optionally trigger workflow
    if (validatedData.trigger_workflow) {
      try {
        await inngest.send({
          name: 'task/workflow.start',
          data: {
            taskId: task.id,
            organizationId: membership.organization_id,
          },
        });
      } catch (err) {
        console.error('Failed to trigger workflow:', err);
        // Don't fail the request, just note it
        return NextResponse.json({
          data: task,
          workflow_triggered: false,
          workflow_error: 'Failed to trigger workflow',
        });
      }
    }

    return NextResponse.json(
      {
        data: task,
        workflow_triggered: validatedData.trigger_workflow ?? false,
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    console.error('Error creating task:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
