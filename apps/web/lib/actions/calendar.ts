'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export type CalendarEvent = {
  id: string;
  title: string;
  type: 'task' | 'campaign';
  status: string;
  scheduledAt: string;
  campaignId?: string;
  campaignName?: string;
  productId?: string;
  productName?: string;
  contentType?: string;
};

export type CalendarEventsByDate = {
  [date: string]: CalendarEvent[];
};

export async function getCalendarEvents(
  organizationId: string,
  startDate: string,
  endDate: string
): Promise<CalendarEvent[]> {
  const supabase = await createClient();

  // Get tasks with scheduled dates
  const { data: tasks, error: tasksError } = await supabase
    .from('tasks')
    .select(`
      id,
      title,
      status,
      type,
      scheduled_for,
      campaign_id,
      campaigns!inner(
        id,
        name,
        product_id,
        products(id, name)
      )
    `)
    .gte('scheduled_for', startDate)
    .lte('scheduled_for', endDate)
    .not('scheduled_for', 'is', null)
    .order('scheduled_for', { ascending: true });

  if (tasksError) {
    console.error('Error fetching calendar tasks:', tasksError);
    throw tasksError;
  }

  // Get campaigns with start dates
  const { data: campaigns, error: campaignsError } = await supabase
    .from('campaigns')
    .select(`
      id,
      name,
      status,
      start_date,
      end_date,
      product_id,
      products(id, name)
    `)
    .or(`start_date.gte.${startDate},end_date.lte.${endDate}`)
    .order('start_date', { ascending: true });

  if (campaignsError) {
    console.error('Error fetching calendar campaigns:', campaignsError);
    throw campaignsError;
  }

  const events: CalendarEvent[] = [];

  // Map tasks to events
  if (tasks) {
    tasks.forEach((task) => {
      const campaignsData = task.campaigns;
      const campaignRaw = Array.isArray(campaignsData) ? campaignsData[0] : campaignsData;
      const campaign = campaignRaw as { id: string; name: string; product_id: string; products: { id: string; name: string }[] | { id: string; name: string } | null } | null;
      const productData = campaign?.products;
      const product = Array.isArray(productData) ? productData[0] : productData;
      events.push({
        id: task.id,
        title: task.title,
        type: 'task',
        status: task.status,
        scheduledAt: task.scheduled_for!,
        contentType: task.type,
        campaignId: campaign?.id,
        campaignName: campaign?.name,
        productId: product?.id,
        productName: product?.name,
      });
    });
  }

  // Map campaigns to events (start date)
  if (campaigns) {
    campaigns.forEach((campaign) => {
      const productData = campaign.products;
      const product = (Array.isArray(productData) ? productData[0] : productData) as { id: string; name: string } | null;
      if (campaign.start_date) {
        events.push({
          id: `campaign-start-${campaign.id}`,
          title: `${campaign.name} (Start)`,
          type: 'campaign',
          status: campaign.status,
          scheduledAt: campaign.start_date,
          campaignId: campaign.id,
          campaignName: campaign.name,
          productId: product?.id,
          productName: product?.name,
        });
      }
      if (campaign.end_date && campaign.end_date !== campaign.start_date) {
        events.push({
          id: `campaign-end-${campaign.id}`,
          title: `${campaign.name} (End)`,
          type: 'campaign',
          status: campaign.status,
          scheduledAt: campaign.end_date,
          campaignId: campaign.id,
          campaignName: campaign.name,
          productId: product?.id,
          productName: product?.name,
        });
      }
    });
  }

  return events.sort((a, b) =>
    new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
  );
}

export async function rescheduleTask(
  taskId: string,
  newDate: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('tasks')
    .update({ scheduled_for: newDate, updated_at: new Date().toISOString() })
    .eq('id', taskId);

  if (error) {
    console.error('Error rescheduling task:', error);
    return { success: false, error: error.message };
  }

  revalidatePath('/dashboard/calendar');
  return { success: true };
}

export async function getEventsByDateRange(
  organizationId: string,
  startDate: string,
  endDate: string
): Promise<CalendarEventsByDate> {
  const events = await getCalendarEvents(organizationId, startDate, endDate);

  const eventsByDate: CalendarEventsByDate = {};

  events.forEach((event) => {
    const date = event.scheduledAt.split('T')[0];
    if (!eventsByDate[date]) {
      eventsByDate[date] = [];
    }
    eventsByDate[date].push(event);
  });

  return eventsByDate;
}
