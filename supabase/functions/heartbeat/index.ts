// Supabase Edge Function: Heartbeat
// This function is triggered by pg_cron every minute
// It checks for work and triggers Inngest workflows

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const inngestEventUrl = Deno.env.get('INNGEST_EVENT_URL');
    const inngestEventKey = Deno.env.get('INNGEST_EVENT_KEY');

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Check for queued tasks ready to process
    const { data: queuedTasks } = await supabase
      .from('tasks')
      .select(`
        id,
        campaign:campaigns(
          product:products(organization_id)
        )
      `)
      .eq('status', 'queued')
      .lte('scheduled_for', new Date().toISOString())
      .limit(10);

    // 2. Check for scheduled campaigns to start
    const { data: scheduledCampaigns } = await supabase
      .from('campaigns')
      .select(`
        id,
        product:products(organization_id)
      `)
      .eq('status', 'planned')
      .lte('start_date', new Date().toISOString());

    // 3. Check for expired approvals
    const { data: expiredApprovals } = await supabase
      .from('approvals')
      .select('id, task_id')
      .eq('status', 'pending')
      .lte('expires_at', new Date().toISOString());

    // 4. Handle expired approvals directly
    for (const approval of expiredApprovals || []) {
      await supabase
        .from('approvals')
        .update({ status: 'expired' })
        .eq('id', approval.id);

      await supabase
        .from('tasks')
        .update({ status: 'cancelled' })
        .eq('id', approval.task_id);
    }

    // 5. Update scheduled campaigns to active
    for (const campaign of scheduledCampaigns || []) {
      await supabase
        .from('campaigns')
        .update({ status: 'active' })
        .eq('id', campaign.id);
    }

    // 6. Trigger Inngest events for queued tasks
    const events = [];

    for (const task of queuedTasks || []) {
      events.push({
        name: 'task/queued',
        data: {
          taskId: task.id,
          organizationId: task.campaign?.product?.organization_id || '',
        },
      });
    }

    // Send events to Inngest if configured
    if (events.length > 0 && inngestEventUrl && inngestEventKey) {
      await fetch(inngestEventUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${inngestEventKey}`,
        },
        body: JSON.stringify(events),
      });
    }

    // Log heartbeat
    console.log(`Heartbeat: ${events.length} tasks, ${expiredApprovals?.length || 0} expired approvals`);

    return new Response(
      JSON.stringify({
        success: true,
        tasksTriggered: events.length,
        campaignsActivated: scheduledCampaigns?.length || 0,
        expiredApprovals: expiredApprovals?.length || 0,
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Heartbeat error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
