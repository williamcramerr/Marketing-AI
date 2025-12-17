import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * GET /api/tasks/[id] - Get task details
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
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

    // Get task with related data
    const { data: task, error } = await supabase
      .from('tasks')
      .select(
        `
        *,
        campaign:campaigns(
          id,
          name,
          product:products(id, name, organization_id)
        ),
        approval:approvals(
          id,
          status,
          requested_at,
          resolved_at,
          resolved_by,
          resolution_notes
        ),
        connector:connectors(id, name, type)
      `
      )
      .eq('id', id)
      .single();

    if (error) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    // Verify task belongs to organization
    const orgId = (task.campaign?.product as any)?.organization_id;
    if (orgId !== membership.organization_id) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    return NextResponse.json({ data: task });
  } catch (error: any) {
    console.error('Error getting task:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PATCH /api/tasks/[id] - Update task
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
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

    // Get existing task
    const { data: existingTask, error: fetchError } = await supabase
      .from('tasks')
      .select(
        `
        *,
        campaign:campaigns(
          product:products(organization_id)
        )
      `
      )
      .eq('id', id)
      .single();

    if (fetchError || !existingTask) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    // Verify task belongs to organization
    const orgId = (existingTask.campaign?.product as any)?.organization_id;
    if (orgId !== membership.organization_id) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    // Only allow updates to certain statuses
    const allowedStatuses = ['queued', 'drafted', 'pending_approval'];
    if (!allowedStatuses.includes(existingTask.status)) {
      return NextResponse.json(
        { error: `Cannot update task in ${existingTask.status} status` },
        { status: 400 }
      );
    }

    const body = await request.json();
    const allowedFields = ['title', 'description', 'scheduled_for', 'input_data', 'priority'];

    const updates: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field];
      }
    }

    const { data: task, error: updateError } = await supabase
      .from('tasks')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ data: task });
  } catch (error: any) {
    console.error('Error updating task:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/tasks/[id] - Cancel/delete task
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
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

    // Get existing task
    const { data: existingTask, error: fetchError } = await supabase
      .from('tasks')
      .select(
        `
        *,
        campaign:campaigns(
          product:products(organization_id)
        )
      `
      )
      .eq('id', id)
      .single();

    if (fetchError || !existingTask) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    // Verify task belongs to organization
    const orgId = (existingTask.campaign?.product as any)?.organization_id;
    if (orgId !== membership.organization_id) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    // Don't allow deletion of executing tasks
    if (existingTask.status === 'executing') {
      return NextResponse.json({ error: 'Cannot delete executing task' }, { status: 400 });
    }

    // Mark as cancelled instead of deleting
    const statusHistory = (existingTask.status_history as any[]) || [];
    statusHistory.push({
      status: 'cancelled',
      timestamp: new Date().toISOString(),
      note: 'Cancelled via API',
    });

    const { error: updateError } = await supabase
      .from('tasks')
      .update({
        status: 'cancelled',
        status_history: statusHistory,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Task cancelled' });
  } catch (error: any) {
    console.error('Error cancelling task:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
