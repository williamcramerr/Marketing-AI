-- Marketing Pilot AI - pg_cron Heartbeat Setup
-- This sets up the heartbeat job that runs every minute

-- Note: pg_cron and pg_net extensions should be enabled via the Supabase dashboard
-- These commands are here for reference but may need to be run manually

-- Schedule the heartbeat job
-- Replace <project-ref> and <service_role_key> with actual values in production
-- This should be done via the Supabase dashboard or a separate setup script

/*
SELECT cron.schedule(
  'marketing-pilot-heartbeat',
  '* * * * *', -- Every minute
  $$
  SELECT net.http_post(
    url := 'https://<project-ref>.supabase.co/functions/v1/heartbeat',
    headers := '{"Authorization": "Bearer <service_role_key>", "Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  )
  $$
);
*/

-- To view scheduled jobs:
-- SELECT * FROM cron.job;

-- To unschedule:
-- SELECT cron.unschedule('marketing-pilot-heartbeat');

-- Create a helper function to manually trigger heartbeat (for testing)
CREATE OR REPLACE FUNCTION trigger_heartbeat()
RETURNS void AS $$
BEGIN
  -- This is a placeholder - actual implementation would use pg_net
  RAISE NOTICE 'Heartbeat triggered at %', NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a view to see pending work
CREATE OR REPLACE VIEW pending_work AS
SELECT
  'queued_tasks' as type,
  COUNT(*) as count
FROM tasks
WHERE status = 'queued'
  AND scheduled_for <= NOW()
UNION ALL
SELECT
  'pending_approvals' as type,
  COUNT(*) as count
FROM approvals
WHERE status = 'pending'
UNION ALL
SELECT
  'active_campaigns' as type,
  COUNT(*) as count
FROM campaigns
WHERE status = 'active';

-- Grant access to the view
GRANT SELECT ON pending_work TO authenticated;
