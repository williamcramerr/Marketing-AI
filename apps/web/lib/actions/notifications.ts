'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export type NotificationType =
  | 'task_created'
  | 'task_completed'
  | 'task_failed'
  | 'approval_needed'
  | 'approval_granted'
  | 'approval_rejected'
  | 'campaign_started'
  | 'campaign_completed'
  | 'usage_alert'
  | 'system';

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  is_read: boolean;
  created_at: string;
  metadata?: Record<string, unknown>;
}

export interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  metadata?: Record<string, unknown>;
}

export async function createNotification(
  input: CreateNotificationInput
): Promise<{ success: boolean; notification?: Notification; error?: string }> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('user_notifications')
    .insert({
      user_id: input.userId,
      type: input.type,
      title: input.title,
      message: input.message,
      link: input.link,
      metadata: input.metadata,
      is_read: false,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating notification:', error);
    return { success: false, error: error.message };
  }

  return { success: true, notification: data as Notification };
}

export async function markAsRead(
  notificationId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('user_notifications')
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq('id', notificationId);

  if (error) {
    console.error('Error marking notification as read:', error);
    return { success: false, error: error.message };
  }

  revalidatePath('/dashboard');
  return { success: true };
}

export async function markAllAsRead(
  userId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('user_notifications')
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('is_read', false);

  if (error) {
    console.error('Error marking all notifications as read:', error);
    return { success: false, error: error.message };
  }

  revalidatePath('/dashboard');
  return { success: true };
}

export async function deleteNotification(
  notificationId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('user_notifications')
    .delete()
    .eq('id', notificationId);

  if (error) {
    console.error('Error deleting notification:', error);
    return { success: false, error: error.message };
  }

  revalidatePath('/dashboard');
  return { success: true };
}

export async function getUnreadCount(userId: string): Promise<number> {
  const supabase = await createClient();

  const { count, error } = await supabase
    .from('user_notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_read', false);

  if (error) {
    console.error('Error getting unread count:', error);
    return 0;
  }

  return count || 0;
}

export async function getUserNotifications(
  userId: string,
  options: {
    limit?: number;
    offset?: number;
    onlyUnread?: boolean;
  } = {}
): Promise<{ notifications: Notification[]; total: number }> {
  const { limit = 20, offset = 0, onlyUnread = false } = options;
  const supabase = await createClient();

  let query = supabase
    .from('user_notifications')
    .select('*', { count: 'exact' })
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (onlyUnread) {
    query = query.eq('is_read', false);
  }

  const { data, count, error } = await query;

  if (error) {
    console.error('Error fetching notifications:', error);
    return { notifications: [], total: 0 };
  }

  return {
    notifications: (data as Notification[]) || [],
    total: count || 0,
  };
}

// Helper function to create notifications for common events
export async function notifyTaskStatusChange(
  userId: string,
  taskId: string,
  taskTitle: string,
  status: string
): Promise<void> {
  const typeMap: Record<string, NotificationType> = {
    completed: 'task_completed',
    failed: 'task_failed',
    pending_approval: 'approval_needed',
  };

  const type = typeMap[status] || 'task_created';

  const titleMap: Record<string, string> = {
    completed: 'Task Completed',
    failed: 'Task Failed',
    pending_approval: 'Approval Required',
  };

  const messageMap: Record<string, string> = {
    completed: `"${taskTitle}" has been completed successfully.`,
    failed: `"${taskTitle}" has failed. Please review and retry.`,
    pending_approval: `"${taskTitle}" is ready for your approval.`,
  };

  await createNotification({
    userId,
    type,
    title: titleMap[status] || 'Task Update',
    message: messageMap[status] || `Task "${taskTitle}" status changed to ${status}.`,
    link: `/dashboard/tasks/${taskId}`,
    metadata: { taskId, taskTitle, status },
  });
}

export async function notifyCampaignStatusChange(
  userId: string,
  campaignId: string,
  campaignName: string,
  status: string
): Promise<void> {
  const type: NotificationType = status === 'completed' ? 'campaign_completed' : 'campaign_started';

  await createNotification({
    userId,
    type,
    title: status === 'completed' ? 'Campaign Completed' : 'Campaign Started',
    message: `"${campaignName}" has ${status === 'completed' ? 'finished' : 'started'}.`,
    link: `/dashboard/campaigns/${campaignId}`,
    metadata: { campaignId, campaignName, status },
  });
}

export async function notifyApprovalDecision(
  userId: string,
  taskId: string,
  taskTitle: string,
  approved: boolean,
  reason?: string
): Promise<void> {
  await createNotification({
    userId,
    type: approved ? 'approval_granted' : 'approval_rejected',
    title: approved ? 'Content Approved' : 'Content Rejected',
    message: approved
      ? `"${taskTitle}" has been approved and will be published.`
      : `"${taskTitle}" was rejected.${reason ? ` Reason: ${reason}` : ''}`,
    link: `/dashboard/tasks/${taskId}`,
    metadata: { taskId, taskTitle, approved, reason },
  });
}
