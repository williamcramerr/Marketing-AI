-- Notifications & User Preferences Migration
-- Implements notification system with real-time support and user preference management

-- ============================================================================
-- NOTIFICATION TYPES (Catalog of all notification types)
-- ============================================================================
CREATE TABLE IF NOT EXISTS notification_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL CHECK (category IN (
        'task', 'campaign', 'approval', 'system', 'alert', 'billing', 'growth'
    )),
    -- Default delivery channels
    default_channels TEXT[] DEFAULT ARRAY['in_app'],
    -- Template configuration
    email_subject_template TEXT,
    email_body_template TEXT,
    in_app_template TEXT,
    -- Settings
    is_active BOOLEAN DEFAULT true,
    can_unsubscribe BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default notification types
INSERT INTO notification_types (code, name, description, category, default_channels, can_unsubscribe) VALUES
    ('task_pending_approval', 'Task Pending Approval', 'A task requires your approval', 'approval', ARRAY['in_app', 'email'], true),
    ('task_approved', 'Task Approved', 'Your task has been approved', 'task', ARRAY['in_app'], true),
    ('task_rejected', 'Task Rejected', 'Your task has been rejected', 'task', ARRAY['in_app', 'email'], true),
    ('task_completed', 'Task Completed', 'A task has completed execution', 'task', ARRAY['in_app'], true),
    ('task_failed', 'Task Failed', 'A task failed during execution', 'task', ARRAY['in_app', 'email'], true),
    ('campaign_started', 'Campaign Started', 'A campaign has started', 'campaign', ARRAY['in_app'], true),
    ('campaign_completed', 'Campaign Completed', 'A campaign has completed', 'campaign', ARRAY['in_app', 'email'], true),
    ('campaign_paused', 'Campaign Paused', 'A campaign has been paused', 'campaign', ARRAY['in_app'], true),
    ('high_intent_visitor', 'High Intent Visitor', 'A high-value visitor identified on your site', 'growth', ARRAY['in_app', 'email'], true),
    ('high_intent_conversation', 'High Intent Conversation', 'A high-intent social conversation found', 'growth', ARRAY['in_app', 'email'], true),
    ('lead_captured', 'Lead Captured', 'A new lead has been captured', 'growth', ARRAY['in_app'], true),
    ('usage_alert', 'Usage Alert', 'You are approaching your plan limits', 'billing', ARRAY['in_app', 'email'], false),
    ('invoice_ready', 'Invoice Ready', 'Your invoice is ready', 'billing', ARRAY['in_app', 'email'], false),
    ('system_maintenance', 'System Maintenance', 'Scheduled system maintenance', 'system', ARRAY['in_app', 'email'], false),
    ('security_alert', 'Security Alert', 'Important security notification', 'system', ARRAY['in_app', 'email'], false)
ON CONFLICT (code) DO NOTHING;

-- ============================================================================
-- USER NOTIFICATIONS (Sent notifications)
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    notification_type_id UUID REFERENCES notification_types(id),

    -- Content
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',

    -- Related entities (for quick linking)
    related_task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
    related_campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
    related_approval_id UUID REFERENCES approvals(id) ON DELETE SET NULL,

    -- Delivery channels used
    channels TEXT[] NOT NULL DEFAULT ARRAY['in_app'],

    -- Status
    status TEXT DEFAULT 'unread' CHECK (status IN (
        'unread', 'read', 'archived', 'deleted'
    )),
    read_at TIMESTAMPTZ,
    archived_at TIMESTAMPTZ,

    -- Priority
    priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),

    -- Action URL
    action_url TEXT,
    action_label TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '30 days'
);

-- Indexes for notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user ON user_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_org ON user_notifications(organization_id);
CREATE INDEX IF NOT EXISTS idx_notifications_status ON user_notifications(user_id, status);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON user_notifications(user_id) WHERE status = 'unread';
CREATE INDEX IF NOT EXISTS idx_notifications_created ON user_notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_priority ON user_notifications(user_id, priority) WHERE status = 'unread';
CREATE INDEX IF NOT EXISTS idx_notifications_type ON user_notifications(notification_type_id);
CREATE INDEX IF NOT EXISTS idx_notifications_task ON user_notifications(related_task_id) WHERE related_task_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_campaign ON user_notifications(related_campaign_id) WHERE related_campaign_id IS NOT NULL;

-- ============================================================================
-- NOTIFICATION QUEUE (For async delivery)
-- ============================================================================
CREATE TABLE IF NOT EXISTS notification_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    notification_id UUID NOT NULL REFERENCES user_notifications(id) ON DELETE CASCADE,
    channel TEXT NOT NULL CHECK (channel IN ('email', 'in_app', 'slack', 'webhook')),

    -- Delivery status
    status TEXT DEFAULT 'pending' CHECK (status IN (
        'pending', 'processing', 'sent', 'failed', 'bounced', 'cancelled'
    )),

    -- Retry logic
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    next_retry_at TIMESTAMPTZ,
    last_error TEXT,

    -- Delivery tracking
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    opened_at TIMESTAMPTZ,
    clicked_at TIMESTAMPTZ,

    -- External reference
    external_id TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for notification queue
CREATE INDEX IF NOT EXISTS idx_notification_queue_status ON notification_queue(status);
CREATE INDEX IF NOT EXISTS idx_notification_queue_pending ON notification_queue(status, next_retry_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_notification_queue_notification ON notification_queue(notification_id);

-- ============================================================================
-- USER PREFERENCES
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- Notification preferences
    notification_settings JSONB DEFAULT '{
        "email": {
            "enabled": true,
            "task_approvals": true,
            "campaign_updates": true,
            "system_alerts": true,
            "growth_alerts": true,
            "billing_alerts": true,
            "weekly_digest": true,
            "marketing_emails": false
        },
        "in_app": {
            "enabled": true,
            "show_badges": true,
            "sound": false,
            "desktop_notifications": false
        },
        "quiet_hours": {
            "enabled": false,
            "start": "22:00",
            "end": "08:00",
            "timezone": "UTC"
        },
        "unsubscribed_types": []
    }',

    -- UI preferences
    ui_preferences JSONB DEFAULT '{
        "theme": "system",
        "timezone": "UTC",
        "date_format": "MM/DD/YYYY",
        "time_format": "12h",
        "language": "en",
        "items_per_page": 25,
        "sidebar_collapsed": false,
        "compact_mode": false
    }',

    -- Dashboard preferences
    dashboard_preferences JSONB DEFAULT '{
        "default_date_range": "30d",
        "favorite_campaigns": [],
        "pinned_metrics": [],
        "widget_layout": []
    }',

    -- Feature flags (for beta features)
    feature_flags JSONB DEFAULT '{}',

    -- Keyboard shortcuts enabled
    keyboard_shortcuts_enabled BOOLEAN DEFAULT true,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(user_id, organization_id)
);

-- Indexes for user preferences
CREATE INDEX IF NOT EXISTS idx_user_preferences_user ON user_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_user_preferences_org ON user_preferences(organization_id);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

-- Notification Types (public read)
ALTER TABLE notification_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view notification types"
    ON notification_types FOR SELECT
    TO authenticated
    USING (true);

-- User Notifications
ALTER TABLE user_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications"
    ON user_notifications FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "Users can update own notifications"
    ON user_notifications FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "Service role can insert notifications"
    ON user_notifications FOR INSERT
    TO service_role
    WITH CHECK (true);

CREATE POLICY "Service role can manage all notifications"
    ON user_notifications FOR ALL
    TO service_role
    USING (true);

-- Notification Queue
ALTER TABLE notification_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage notification queue"
    ON notification_queue FOR ALL
    TO service_role
    USING (true);

-- User Preferences
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own preferences"
    ON user_preferences FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "Users can update own preferences"
    ON user_preferences FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "Users can insert own preferences"
    ON user_preferences FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to create default preferences for new organization members
CREATE OR REPLACE FUNCTION create_user_preferences()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO user_preferences (user_id, organization_id)
    VALUES (NEW.user_id, NEW.organization_id)
    ON CONFLICT (user_id, organization_id) DO NOTHING;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create preferences when user joins organization
DROP TRIGGER IF EXISTS trigger_create_user_preferences ON organization_members;
CREATE TRIGGER trigger_create_user_preferences
    AFTER INSERT ON organization_members
    FOR EACH ROW
    EXECUTE FUNCTION create_user_preferences();

-- Function to get unread notification count
CREATE OR REPLACE FUNCTION get_unread_notification_count(p_user_id UUID)
RETURNS INTEGER AS $$
    SELECT COUNT(*)::INTEGER
    FROM user_notifications
    WHERE user_id = p_user_id
    AND status = 'unread'
    AND (expires_at IS NULL OR expires_at > NOW());
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Function to mark all notifications as read
CREATE OR REPLACE FUNCTION mark_all_notifications_read(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
    updated_count INTEGER;
BEGIN
    UPDATE user_notifications
    SET status = 'read', read_at = NOW()
    WHERE user_id = p_user_id
    AND status = 'unread';

    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RETURN updated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clean up expired notifications
CREATE OR REPLACE FUNCTION cleanup_expired_notifications()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM user_notifications
    WHERE expires_at < NOW()
    AND status != 'deleted';

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- REALTIME SUBSCRIPTION
-- ============================================================================

-- Enable realtime for notifications table
ALTER PUBLICATION supabase_realtime ADD TABLE user_notifications;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE notification_types IS 'Catalog of all notification types in the system';
COMMENT ON TABLE user_notifications IS 'User-facing notifications with status tracking';
COMMENT ON TABLE notification_queue IS 'Queue for async notification delivery (email, webhooks, etc.)';
COMMENT ON TABLE user_preferences IS 'User preferences for notifications, UI, and features';
