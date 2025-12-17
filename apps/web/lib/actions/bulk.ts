'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export type BulkActionResult = {
  success: boolean;
  processed: number;
  failed: number;
  errors?: string[];
};

// Bulk approve tasks
export async function bulkApproveTasks(taskIds: string[]): Promise<BulkActionResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, processed: 0, failed: taskIds.length, errors: ['Not authenticated'] };
  }

  const errors: string[] = [];
  let processed = 0;

  for (const taskId of taskIds) {
    const { error } = await supabase
      .from('tasks')
      .update({
        status: 'approved',
        approved_by: user.id,
        approved_at: new Date().toISOString(),
      })
      .eq('id', taskId)
      .eq('status', 'pending_approval');

    if (error) {
      errors.push(`Task ${taskId}: ${error.message}`);
    } else {
      processed++;
    }
  }

  revalidatePath('/dashboard/tasks');
  revalidatePath('/dashboard/approvals');

  return {
    success: errors.length === 0,
    processed,
    failed: taskIds.length - processed,
    errors: errors.length > 0 ? errors : undefined,
  };
}

// Bulk reject tasks
export async function bulkRejectTasks(
  taskIds: string[],
  reason?: string
): Promise<BulkActionResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, processed: 0, failed: taskIds.length, errors: ['Not authenticated'] };
  }

  const errors: string[] = [];
  let processed = 0;

  for (const taskId of taskIds) {
    const { error } = await supabase
      .from('tasks')
      .update({
        status: 'cancelled',
        approved_by: user.id,
        approved_at: new Date().toISOString(),
        error_log: reason ? { rejection_reason: reason } : null,
      })
      .eq('id', taskId)
      .eq('status', 'pending_approval');

    if (error) {
      errors.push(`Task ${taskId}: ${error.message}`);
    } else {
      processed++;
    }
  }

  revalidatePath('/dashboard/tasks');
  revalidatePath('/dashboard/approvals');

  return {
    success: errors.length === 0,
    processed,
    failed: taskIds.length - processed,
    errors: errors.length > 0 ? errors : undefined,
  };
}

// Bulk delete tasks
export async function bulkDeleteTasks(taskIds: string[]): Promise<BulkActionResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, processed: 0, failed: taskIds.length, errors: ['Not authenticated'] };
  }

  const errors: string[] = [];
  let processed = 0;

  for (const taskId of taskIds) {
    const { error } = await supabase.from('tasks').delete().eq('id', taskId);

    if (error) {
      errors.push(`Task ${taskId}: ${error.message}`);
    } else {
      processed++;
    }
  }

  revalidatePath('/dashboard/tasks');
  revalidatePath('/dashboard/approvals');

  return {
    success: errors.length === 0,
    processed,
    failed: taskIds.length - processed,
    errors: errors.length > 0 ? errors : undefined,
  };
}

// Bulk delete content assets
export async function bulkDeleteAssets(assetIds: string[]): Promise<BulkActionResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, processed: 0, failed: assetIds.length, errors: ['Not authenticated'] };
  }

  const errors: string[] = [];
  let processed = 0;

  for (const assetId of assetIds) {
    const { error } = await supabase.from('content_assets').delete().eq('id', assetId);

    if (error) {
      errors.push(`Asset ${assetId}: ${error.message}`);
    } else {
      processed++;
    }
  }

  revalidatePath('/dashboard/content');
  revalidatePath('/dashboard/media');

  return {
    success: errors.length === 0,
    processed,
    failed: assetIds.length - processed,
    errors: errors.length > 0 ? errors : undefined,
  };
}

// Bulk publish content assets
export async function bulkPublishAssets(assetIds: string[]): Promise<BulkActionResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, processed: 0, failed: assetIds.length, errors: ['Not authenticated'] };
  }

  const errors: string[] = [];
  let processed = 0;

  for (const assetId of assetIds) {
    const { error } = await supabase
      .from('content_assets')
      .update({
        published: true,
        published_at: new Date().toISOString(),
      })
      .eq('id', assetId);

    if (error) {
      errors.push(`Asset ${assetId}: ${error.message}`);
    } else {
      processed++;
    }
  }

  revalidatePath('/dashboard/content');

  return {
    success: errors.length === 0,
    processed,
    failed: assetIds.length - processed,
    errors: errors.length > 0 ? errors : undefined,
  };
}

// Bulk unpublish content assets
export async function bulkUnpublishAssets(assetIds: string[]): Promise<BulkActionResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, processed: 0, failed: assetIds.length, errors: ['Not authenticated'] };
  }

  const errors: string[] = [];
  let processed = 0;

  for (const assetId of assetIds) {
    const { error } = await supabase
      .from('content_assets')
      .update({
        published: false,
      })
      .eq('id', assetId);

    if (error) {
      errors.push(`Asset ${assetId}: ${error.message}`);
    } else {
      processed++;
    }
  }

  revalidatePath('/dashboard/content');

  return {
    success: errors.length === 0,
    processed,
    failed: assetIds.length - processed,
    errors: errors.length > 0 ? errors : undefined,
  };
}

// Bulk archive campaigns
export async function bulkArchiveCampaigns(campaignIds: string[]): Promise<BulkActionResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, processed: 0, failed: campaignIds.length, errors: ['Not authenticated'] };
  }

  const errors: string[] = [];
  let processed = 0;

  for (const campaignId of campaignIds) {
    const { error } = await supabase
      .from('campaigns')
      .update({ status: 'cancelled' })
      .eq('id', campaignId);

    if (error) {
      errors.push(`Campaign ${campaignId}: ${error.message}`);
    } else {
      processed++;
    }
  }

  revalidatePath('/dashboard/campaigns');

  return {
    success: errors.length === 0,
    processed,
    failed: campaignIds.length - processed,
    errors: errors.length > 0 ? errors : undefined,
  };
}

// Export tasks to CSV
export async function exportTasksToCSV(taskIds: string[]): Promise<{
  success: boolean;
  data?: string;
  error?: string;
}> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Not authenticated' };
  }

  const { data: tasks, error } = await supabase
    .from('tasks')
    .select(`
      id,
      title,
      description,
      type,
      status,
      priority,
      created_at,
      updated_at,
      scheduled_for,
      campaigns (name)
    `)
    .in('id', taskIds);

  if (error) {
    return { success: false, error: error.message };
  }

  // Generate CSV
  const headers = [
    'ID',
    'Title',
    'Description',
    'Type',
    'Status',
    'Priority',
    'Campaign',
    'Created At',
    'Updated At',
    'Scheduled For',
  ];

  const rows = tasks.map((task) => {
    const campaign = Array.isArray(task.campaigns) ? task.campaigns[0] : task.campaigns;
    return [
      task.id,
      `"${(task.title || '').replace(/"/g, '""')}"`,
      `"${(task.description || '').replace(/"/g, '""')}"`,
      task.type,
      task.status,
      task.priority,
      campaign?.name || '',
      task.created_at,
      task.updated_at,
      task.scheduled_for || '',
    ];
  });

  const csv = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');

  return { success: true, data: csv };
}

// Export content assets to CSV
export async function exportAssetsToCSV(assetIds: string[]): Promise<{
  success: boolean;
  data?: string;
  error?: string;
}> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Not authenticated' };
  }

  const { data: assets, error } = await supabase
    .from('content_assets')
    .select(`
      id,
      title,
      type,
      published,
      version,
      created_at,
      updated_at,
      products (name)
    `)
    .in('id', assetIds);

  if (error) {
    return { success: false, error: error.message };
  }

  // Generate CSV
  const headers = [
    'ID',
    'Title',
    'Type',
    'Published',
    'Version',
    'Product',
    'Created At',
    'Updated At',
  ];

  const rows = assets.map((asset) => {
    const product = Array.isArray(asset.products) ? asset.products[0] : asset.products;
    return [
      asset.id,
      `"${(asset.title || '').replace(/"/g, '""')}"`,
      asset.type,
      asset.published ? 'Yes' : 'No',
      asset.version,
      product?.name || '',
      asset.created_at,
      asset.updated_at,
    ];
  });

  const csv = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');

  return { success: true, data: csv };
}
