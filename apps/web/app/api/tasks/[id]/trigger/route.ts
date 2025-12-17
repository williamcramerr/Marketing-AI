import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { inngest } from '@/lib/inngest/client';

export const runtime = 'nodejs';

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * POST /api/tasks/[id]/trigger - Trigger workflow for a task
 */
export async function POST(request: NextRequest, context: RouteContext) {
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

    // Get task
    const { data: task, error: fetchError } = await supabase
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

    if (fetchError || !task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    // Verify task belongs to organization
    const orgId = (task.campaign?.product as any)?.organization_id;
    if (orgId !== membership.organization_id) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    // Only allow triggering queued tasks or retrying failed ones
    const triggerableStatuses = ['queued', 'failed'];
    if (!triggerableStatuses.includes(task.status)) {
      return NextResponse.json(
        { error: `Cannot trigger task in ${task.status} status` },
        { status: 400 }
      );
    }

    // Parse request body for optional parameters
    let body: Record<string, any> = {};
    try {
      body = await request.json();
    } catch {
      // Empty body is fine
    }

    // Update status to show it's being processed
    const statusHistory = (task.status_history as any[]) || [];
    statusHistory.push({
      status: 'queued',
      timestamp: new Date().toISOString(),
      note: body.retry ? 'Retrying task via API' : 'Triggered via API',
    });

    await supabase
      .from('tasks')
      .update({
        status: 'queued',
        status_history: statusHistory,
        retry_count: body.retry ? (task.retry_count || 0) + 1 : task.retry_count || 0,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    // Trigger Inngest workflow
    try {
      const eventId = await inngest.send({
        name: 'task/workflow.start',
        data: {
          taskId: id,
          organizationId: membership.organization_id,
          retry: body.retry || false,
        },
      });

      return NextResponse.json({
        success: true,
        message: 'Workflow triggered',
        event_id: eventId,
      });
    } catch (err: any) {
      console.error('Failed to trigger workflow:', err);
      return NextResponse.json(
        { error: 'Failed to trigger workflow', details: err.message },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('Error triggering task:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
