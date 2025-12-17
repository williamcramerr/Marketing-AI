'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

/**
 * Approve a task
 */
export async function approveTask(approvalId: string, taskId: string) {
  try {
    const supabase = await createClient();

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: 'Unauthorized' };
    }

    // Update approval status
    const { error: approvalError } = await supabase
      .from('approvals')
      .update({
        status: 'approved',
        resolved_at: new Date().toISOString(),
        resolved_by: user.id,
      })
      .eq('id', approvalId)
      .eq('status', 'pending'); // Only update if still pending

    if (approvalError) {
      console.error('Error updating approval:', approvalError);
      return { success: false, error: 'Failed to update approval status' };
    }

    // Get the task to copy draft_content to final_content
    const { data: task, error: taskFetchError } = await supabase
      .from('tasks')
      .select('draft_content, status_history')
      .eq('id', taskId)
      .single();

    if (taskFetchError || !task) {
      console.error('Error fetching task:', taskFetchError);
      return { success: false, error: 'Failed to fetch task' };
    }

    // Update task status and copy draft to final content
    const statusHistory = (task.status_history as any[]) || [];
    statusHistory.push({
      status: 'approved',
      timestamp: new Date().toISOString(),
      note: 'Approved by user',
    });

    const { error: taskError } = await supabase
      .from('tasks')
      .update({
        status: 'approved',
        final_content: task.draft_content,
        status_history: statusHistory,
        updated_at: new Date().toISOString(),
      })
      .eq('id', taskId);

    if (taskError) {
      console.error('Error updating task:', taskError);
      return { success: false, error: 'Failed to update task status' };
    }

    // Revalidate relevant paths
    revalidatePath('/dashboard/approvals');
    revalidatePath('/dashboard/tasks');
    revalidatePath(`/dashboard/tasks/${taskId}`);

    return { success: true };
  } catch (error) {
    console.error('Error approving task:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

/**
 * Reject a task
 */
export async function rejectTask(approvalId: string, taskId: string, notes?: string) {
  try {
    const supabase = await createClient();

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: 'Unauthorized' };
    }

    // Update approval status
    const { error: approvalError } = await supabase
      .from('approvals')
      .update({
        status: 'rejected',
        resolved_at: new Date().toISOString(),
        resolved_by: user.id,
        resolution_notes: notes || null,
      })
      .eq('id', approvalId)
      .eq('status', 'pending'); // Only update if still pending

    if (approvalError) {
      console.error('Error updating approval:', approvalError);
      return { success: false, error: 'Failed to update approval status' };
    }

    // Get the task to update status history
    const { data: task, error: taskFetchError } = await supabase
      .from('tasks')
      .select('status_history')
      .eq('id', taskId)
      .single();

    if (taskFetchError || !task) {
      console.error('Error fetching task:', taskFetchError);
      return { success: false, error: 'Failed to fetch task' };
    }

    // Update task status - send back to drafting or mark as failed depending on retry count
    const statusHistory = (task.status_history as any[]) || [];
    statusHistory.push({
      status: 'cancelled',
      timestamp: new Date().toISOString(),
      note: notes ? `Rejected: ${notes}` : 'Rejected by user',
    });

    const { error: taskError } = await supabase
      .from('tasks')
      .update({
        status: 'cancelled',
        status_history: statusHistory,
        updated_at: new Date().toISOString(),
      })
      .eq('id', taskId);

    if (taskError) {
      console.error('Error updating task:', taskError);
      return { success: false, error: 'Failed to update task status' };
    }

    // Revalidate relevant paths
    revalidatePath('/dashboard/approvals');
    revalidatePath('/dashboard/tasks');
    revalidatePath(`/dashboard/tasks/${taskId}`);

    return { success: true };
  } catch (error) {
    console.error('Error rejecting task:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

/**
 * Retry a failed task
 */
export async function retryTask(taskId: string) {
  try {
    const supabase = await createClient();

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: 'Unauthorized' };
    }

    // Get the task
    const { data: task, error: taskFetchError } = await supabase
      .from('tasks')
      .select('retry_count, max_retries, status_history')
      .eq('id', taskId)
      .single();

    if (taskFetchError || !task) {
      console.error('Error fetching task:', taskFetchError);
      return { success: false, error: 'Failed to fetch task' };
    }

    // Check if we can retry
    if (task.retry_count >= task.max_retries) {
      return { success: false, error: 'Maximum retries exceeded' };
    }

    // Update task status
    const statusHistory = (task.status_history as any[]) || [];
    statusHistory.push({
      status: 'queued',
      timestamp: new Date().toISOString(),
      note: 'Retrying task',
    });

    const { error: taskError } = await supabase
      .from('tasks')
      .update({
        status: 'queued',
        retry_count: task.retry_count + 1,
        status_history: statusHistory,
        updated_at: new Date().toISOString(),
      })
      .eq('id', taskId);

    if (taskError) {
      console.error('Error updating task:', taskError);
      return { success: false, error: 'Failed to retry task' };
    }

    // Revalidate relevant paths
    revalidatePath('/dashboard/tasks');
    revalidatePath(`/dashboard/tasks/${taskId}`);

    return { success: true };
  } catch (error) {
    console.error('Error retrying task:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

/**
 * Cancel a task
 */
export async function cancelTask(taskId: string, reason?: string) {
  try {
    const supabase = await createClient();

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: 'Unauthorized' };
    }

    // Get the task
    const { data: task, error: taskFetchError } = await supabase
      .from('tasks')
      .select('status_history')
      .eq('id', taskId)
      .single();

    if (taskFetchError || !task) {
      console.error('Error fetching task:', taskFetchError);
      return { success: false, error: 'Failed to fetch task' };
    }

    // Update task status
    const statusHistory = (task.status_history as any[]) || [];
    statusHistory.push({
      status: 'cancelled',
      timestamp: new Date().toISOString(),
      note: reason || 'Cancelled by user',
    });

    const { error: taskError } = await supabase
      .from('tasks')
      .update({
        status: 'cancelled',
        status_history: statusHistory,
        updated_at: new Date().toISOString(),
      })
      .eq('id', taskId);

    if (taskError) {
      console.error('Error updating task:', taskError);
      return { success: false, error: 'Failed to cancel task' };
    }

    // If there's a pending approval, mark it as expired
    const { error: approvalError } = await supabase
      .from('approvals')
      .update({
        status: 'expired',
        resolved_at: new Date().toISOString(),
        resolved_by: user.id,
        resolution_notes: reason ? `Task cancelled: ${reason}` : 'Task cancelled',
      })
      .eq('task_id', taskId)
      .eq('status', 'pending');

    if (approvalError) {
      console.error('Error updating approval:', approvalError);
      // Don't fail the entire operation if approval update fails
    }

    // Revalidate relevant paths
    revalidatePath('/dashboard/tasks');
    revalidatePath(`/dashboard/tasks/${taskId}`);
    revalidatePath('/dashboard/approvals');

    return { success: true };
  } catch (error) {
    console.error('Error cancelling task:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

/**
 * Get task details with all related data
 */
export async function getTaskDetails(taskId: string) {
  try {
    const supabase = await createClient();

    const { data: task, error } = await supabase
      .from('tasks')
      .select(
        `
        *,
        campaigns (
          id,
          name,
          status,
          products (
            id,
            name,
            organization_id
          )
        ),
        connectors (
          id,
          name,
          type
        )
      `
      )
      .eq('id', taskId)
      .single();

    if (error) {
      console.error('Error fetching task:', error);
      return { success: false, error: 'Failed to fetch task' };
    }

    return { success: true, data: task };
  } catch (error) {
    console.error('Error fetching task details:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

/**
 * Get approval details
 */
export async function getApprovalDetails(approvalId: string) {
  try {
    const supabase = await createClient();

    const { data: approval, error } = await supabase
      .from('approvals')
      .select(
        `
        *,
        tasks (
          id,
          title,
          description,
          type,
          priority,
          draft_content,
          final_content,
          campaigns (
            id,
            name,
            products (
              id,
              name
            )
          )
        )
      `
      )
      .eq('id', approvalId)
      .single();

    if (error) {
      console.error('Error fetching approval:', error);
      return { success: false, error: 'Failed to fetch approval' };
    }

    return { success: true, data: approval };
  } catch (error) {
    console.error('Error fetching approval details:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}
