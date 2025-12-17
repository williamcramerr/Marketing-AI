-- Migration: Add email_metrics and suppression_list tables for Resend connector
-- Run this in your Supabase SQL editor or add to your migration files

-- Email metrics table for tracking email delivery and engagement
CREATE TABLE IF NOT EXISTS email_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id TEXT NOT NULL,
  task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  connector_id UUID REFERENCES connectors(id) ON DELETE SET NULL,
  event TEXT NOT NULL CHECK (event IN ('sent', 'delivered', 'opened', 'clicked', 'bounced', 'complained', 'delayed')),
  recipient TEXT NOT NULL,
  subject TEXT,
  status TEXT NOT NULL CHECK (status IN ('sent', 'delivered', 'bounced', 'failed')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for email_metrics
CREATE INDEX IF NOT EXISTS idx_email_metrics_message_id ON email_metrics(message_id);
CREATE INDEX IF NOT EXISTS idx_email_metrics_task_id ON email_metrics(task_id);
CREATE INDEX IF NOT EXISTS idx_email_metrics_connector_id ON email_metrics(connector_id);
CREATE INDEX IF NOT EXISTS idx_email_metrics_created_at ON email_metrics(created_at);
CREATE INDEX IF NOT EXISTS idx_email_metrics_recipient ON email_metrics(recipient);

-- Suppression list table for managing email opt-outs and bounces
CREATE TABLE IF NOT EXISTS suppression_list (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('hard_bounce', 'soft_bounce', 'spam_complaint', 'unsubscribe', 'manual')),
  source TEXT NOT NULL CHECK (source IN ('resend_webhook', 'manual', 'import', 'api')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, email)
);

-- Indexes for suppression_list
CREATE INDEX IF NOT EXISTS idx_suppression_list_email ON suppression_list(email);
CREATE INDEX IF NOT EXISTS idx_suppression_list_org_id ON suppression_list(organization_id);

-- Add RLS policies for email_metrics
ALTER TABLE email_metrics ENABLE ROW LEVEL SECURITY;

-- Allow service role to manage all email metrics
CREATE POLICY "Service role can manage email metrics"
  ON email_metrics
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Allow users to view email metrics for their organization
CREATE POLICY "Users can view their org's email metrics"
  ON email_metrics
  FOR SELECT
  TO authenticated
  USING (
    connector_id IN (
      SELECT id FROM connectors
      WHERE organization_id IN (
        SELECT organization_id FROM organization_members
        WHERE user_id = auth.uid()
      )
    )
  );

-- Add RLS policies for suppression_list
ALTER TABLE suppression_list ENABLE ROW LEVEL SECURITY;

-- Allow service role to manage all suppressions
CREATE POLICY "Service role can manage suppression list"
  ON suppression_list
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Allow users to view suppression list for their organization
CREATE POLICY "Users can view their org's suppression list"
  ON suppression_list
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

-- Allow admins to manage suppression list
CREATE POLICY "Admins can manage their org's suppression list"
  ON suppression_list
  FOR ALL
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin')
    )
  );

-- Function to check if email is suppressed
CREATE OR REPLACE FUNCTION is_email_suppressed(
  org_id UUID,
  email_address TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM suppression_list
    WHERE organization_id = org_id
    AND email = LOWER(email_address)
  );
END;
$$;

-- Function to get email metrics summary for a task
CREATE OR REPLACE FUNCTION get_task_email_metrics(task_uuid UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  metrics JSON;
BEGIN
  SELECT json_build_object(
    'sent', COUNT(*) FILTER (WHERE event = 'sent'),
    'delivered', COUNT(*) FILTER (WHERE event = 'delivered'),
    'opened', COUNT(*) FILTER (WHERE event = 'opened'),
    'clicked', COUNT(*) FILTER (WHERE event = 'clicked'),
    'bounced', COUNT(*) FILTER (WHERE event = 'bounced'),
    'complained', COUNT(*) FILTER (WHERE event = 'complained'),
    'deliveryRate', ROUND(
      (COUNT(*) FILTER (WHERE event = 'delivered')::NUMERIC /
       NULLIF(COUNT(*) FILTER (WHERE event = 'sent'), 0) * 100), 2
    ),
    'openRate', ROUND(
      (COUNT(*) FILTER (WHERE event = 'opened')::NUMERIC /
       NULLIF(COUNT(*) FILTER (WHERE event = 'delivered'), 0) * 100), 2
    ),
    'clickRate', ROUND(
      (COUNT(*) FILTER (WHERE event = 'clicked')::NUMERIC /
       NULLIF(COUNT(*) FILTER (WHERE event = 'delivered'), 0) * 100), 2
    ),
    'bounceRate', ROUND(
      (COUNT(*) FILTER (WHERE event = 'bounced')::NUMERIC /
       NULLIF(COUNT(*) FILTER (WHERE event = 'sent'), 0) * 100), 2
    )
  ) INTO metrics
  FROM email_metrics
  WHERE task_id = task_uuid;

  RETURN metrics;
END;
$$;

-- Add comments for documentation
COMMENT ON TABLE email_metrics IS 'Tracks email delivery and engagement events from email providers like Resend';
COMMENT ON TABLE suppression_list IS 'Manages email addresses that should not receive emails (bounces, complaints, unsubscribes)';
COMMENT ON FUNCTION is_email_suppressed IS 'Check if an email address is suppressed for an organization';
COMMENT ON FUNCTION get_task_email_metrics IS 'Get aggregated email metrics for a specific task';
