-- Growth Engine: Website Visitor Identification
-- Identify companies visiting user's website using Clearbit Reveal

-- ============================================
-- TRACKING SCRIPTS
-- ============================================

CREATE TABLE tracking_scripts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    domain TEXT NOT NULL, -- Domain where script is installed
    script_key TEXT UNIQUE NOT NULL, -- Public key for the tracking script

    -- Provider configuration
    provider TEXT DEFAULT 'clearbit' CHECK (provider IN ('clearbit', 'rb2b', 'custom')),
    provider_config JSONB DEFAULT '{}',
    -- { api_key_vault_id: "...", options: { ... } }

    -- Settings
    track_anonymous BOOLEAN DEFAULT true,
    track_identified BOOLEAN DEFAULT true,
    excluded_ips TEXT[] DEFAULT '{}',
    excluded_paths TEXT[] DEFAULT '{}',

    -- Credentials (stored in Vault)
    credentials_vault_ids JSONB DEFAULT '{}',

    active BOOLEAN DEFAULT true,
    last_seen_at TIMESTAMPTZ,

    -- Stats
    total_sessions INTEGER DEFAULT 0,
    total_companies_identified INTEGER DEFAULT 0,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tracking_scripts_org ON tracking_scripts(organization_id);
CREATE INDEX idx_tracking_scripts_key ON tracking_scripts(script_key);
CREATE INDEX idx_tracking_scripts_domain ON tracking_scripts(domain);
CREATE INDEX idx_tracking_scripts_active ON tracking_scripts(organization_id) WHERE active = true;

-- ============================================
-- WEBSITE VISITORS (Company-level)
-- ============================================

CREATE TABLE website_visitors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
    tracking_script_id UUID REFERENCES tracking_scripts(id) ON DELETE CASCADE NOT NULL,

    -- Company identification
    company_domain TEXT,
    company_name TEXT,
    company_logo_url TEXT,

    -- Clearbit enrichment data
    enrichment_data JSONB DEFAULT '{}',
    -- {
    --   industry: "Software",
    --   sub_industry: "SaaS",
    --   employee_count: 150,
    --   employee_range: "101-250",
    --   revenue_range: "$10M-$50M",
    --   founded_year: 2015,
    --   location: { city, state, country },
    --   tech_stack: ["React", "Node.js", "AWS"],
    --   linkedin_url: "...",
    --   twitter_handle: "...",
    --   description: "..."
    -- }
    enriched_at TIMESTAMPTZ,
    enrichment_source TEXT, -- clearbit, rb2b, manual

    -- Scoring
    fit_score INTEGER CHECK (fit_score BETWEEN 0 AND 100), -- ICP match
    intent_score INTEGER CHECK (intent_score BETWEEN 0 AND 100), -- Engagement level
    combined_score INTEGER CHECK (combined_score BETWEEN 0 AND 100),
    score_factors JSONB DEFAULT '{}',
    -- { company_size: 30, industry_match: 25, pages_visited: 20, recency: 15 }

    -- Engagement tracking
    first_seen_at TIMESTAMPTZ DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ DEFAULT NOW(),
    total_sessions INTEGER DEFAULT 1,
    total_pageviews INTEGER DEFAULT 0,
    total_time_seconds INTEGER DEFAULT 0,

    -- Key page visits (flags)
    visited_pricing BOOLEAN DEFAULT false,
    visited_demo BOOLEAN DEFAULT false,
    visited_case_studies BOOLEAN DEFAULT false,
    visited_docs BOOLEAN DEFAULT false,
    visited_blog BOOLEAN DEFAULT false,
    visited_careers BOOLEAN DEFAULT false,

    -- Most viewed pages
    top_pages JSONB DEFAULT '[]',
    -- [{ url, title, views, last_viewed }]

    -- Status
    status TEXT DEFAULT 'new' CHECK (status IN (
        'new', 'hot', 'warm', 'cold', 'contacted', 'qualified', 'converted', 'dismissed'
    )),
    status_changed_at TIMESTAMPTZ,
    status_changed_by UUID REFERENCES auth.users(id),

    -- Notes and tags
    notes TEXT,
    tags TEXT[] DEFAULT '{}',

    -- Conversion
    converted_at TIMESTAMPTZ,
    converted_lead_id UUID, -- Reference to leads table if converted

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(organization_id, company_domain)
);

CREATE INDEX idx_visitors_org ON website_visitors(organization_id);
CREATE INDEX idx_visitors_script ON website_visitors(tracking_script_id);
CREATE INDEX idx_visitors_domain ON website_visitors(company_domain);
CREATE INDEX idx_visitors_last_seen ON website_visitors(last_seen_at DESC);
CREATE INDEX idx_visitors_fit_score ON website_visitors(fit_score DESC);
CREATE INDEX idx_visitors_intent_score ON website_visitors(intent_score DESC);
CREATE INDEX idx_visitors_combined_score ON website_visitors(combined_score DESC);
CREATE INDEX idx_visitors_status ON website_visitors(status);
CREATE INDEX idx_visitors_hot ON website_visitors(organization_id, status) WHERE status = 'hot';
CREATE INDEX idx_visitors_pricing ON website_visitors(organization_id) WHERE visited_pricing = true;

-- ============================================
-- VISITOR SESSIONS
-- ============================================

CREATE TABLE visitor_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    visitor_id UUID REFERENCES website_visitors(id) ON DELETE CASCADE NOT NULL,
    tracking_script_id UUID REFERENCES tracking_scripts(id) ON DELETE CASCADE NOT NULL,

    -- Session identification
    session_id TEXT NOT NULL, -- Client-generated session ID

    -- Visitor info (from request)
    ip_address TEXT,
    user_agent TEXT,
    referrer TEXT,

    -- Pages visited in this session
    pages_visited JSONB DEFAULT '[]',
    -- [{ url, title, timestamp, duration_seconds, scroll_depth }]

    -- Key page flags (denormalized for quick filtering)
    visited_pricing BOOLEAN DEFAULT false,
    visited_demo BOOLEAN DEFAULT false,
    visited_case_studies BOOLEAN DEFAULT false,
    visited_docs BOOLEAN DEFAULT false,

    -- Session timing
    started_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    duration_seconds INTEGER,
    pageview_count INTEGER DEFAULT 0,

    -- Location (from IP)
    country TEXT,
    region TEXT,
    city TEXT,

    -- Device info
    device_type TEXT, -- desktop, mobile, tablet
    browser TEXT,
    os TEXT,

    -- UTM parameters
    utm_source TEXT,
    utm_medium TEXT,
    utm_campaign TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sessions_visitor ON visitor_sessions(visitor_id);
CREATE INDEX idx_sessions_script ON visitor_sessions(tracking_script_id);
CREATE INDEX idx_sessions_started ON visitor_sessions(started_at DESC);
CREATE INDEX idx_sessions_pricing ON visitor_sessions(visitor_id) WHERE visited_pricing = true;

-- ============================================
-- VISITOR ALERTS
-- ============================================

CREATE TABLE visitor_alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,

    -- Alert conditions (all must match)
    conditions JSONB NOT NULL,
    -- {
    --   employee_count: { min: 100 },
    --   industry: ["SaaS", "Technology"],
    --   visited_pricing: true,
    --   fit_score: { min: 70 },
    --   session_count: { min: 2 }
    -- }

    -- Alert delivery
    notification_channels TEXT[] DEFAULT '{}', -- ['email', 'slack']
    notification_config JSONB DEFAULT '{}',
    -- {
    --   email_to: ["sales@example.com"],
    --   slack_channel: "#leads",
    --   slack_webhook_url: "..."
    -- }

    -- Rate limiting
    cooldown_hours INTEGER DEFAULT 24, -- Don't re-alert for same company within X hours
    max_alerts_per_day INTEGER DEFAULT 50,

    -- Stats
    total_alerts_sent INTEGER DEFAULT 0,
    last_alert_at TIMESTAMPTZ,

    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_alerts_org ON visitor_alerts(organization_id);
CREATE INDEX idx_alerts_active ON visitor_alerts(organization_id) WHERE active = true;

-- ============================================
-- VISITOR ALERT HISTORY
-- ============================================

CREATE TABLE visitor_alert_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    alert_id UUID REFERENCES visitor_alerts(id) ON DELETE CASCADE NOT NULL,
    visitor_id UUID REFERENCES website_visitors(id) ON DELETE CASCADE NOT NULL,
    session_id UUID REFERENCES visitor_sessions(id),

    -- Alert details
    matched_conditions JSONB, -- Which conditions triggered
    visitor_snapshot JSONB, -- Visitor data at time of alert

    -- Delivery status
    channels_sent TEXT[],
    delivery_status JSONB DEFAULT '{}',
    -- { email: "sent", slack: "failed" }

    -- Response tracking
    viewed_at TIMESTAMPTZ,
    action_taken TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_alert_history_alert ON visitor_alert_history(alert_id);
CREATE INDEX idx_alert_history_visitor ON visitor_alert_history(visitor_id);
CREATE INDEX idx_alert_history_created ON visitor_alert_history(created_at DESC);

-- ============================================
-- VISITOR METRICS (Daily aggregates)
-- ============================================

CREATE TABLE visitor_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tracking_script_id UUID REFERENCES tracking_scripts(id) ON DELETE CASCADE NOT NULL,
    date DATE NOT NULL,

    -- Session metrics
    total_sessions INTEGER DEFAULT 0,
    unique_companies INTEGER DEFAULT 0,
    new_companies INTEGER DEFAULT 0,
    returning_companies INTEGER DEFAULT 0,

    -- Identification rates
    identified_sessions INTEGER DEFAULT 0,
    unidentified_sessions INTEGER DEFAULT 0,
    identification_rate NUMERIC(5, 4),

    -- Page engagement
    avg_session_duration_seconds INTEGER,
    avg_pageviews_per_session NUMERIC(5, 2),
    pricing_page_visits INTEGER DEFAULT 0,
    demo_page_visits INTEGER DEFAULT 0,

    -- Company quality
    high_fit_visitors INTEGER DEFAULT 0, -- fit_score >= 70
    high_intent_visitors INTEGER DEFAULT 0, -- intent_score >= 70

    -- Alerts
    alerts_triggered INTEGER DEFAULT 0,

    -- Industry breakdown
    industry_breakdown JSONB DEFAULT '{}',
    -- { "SaaS": 15, "E-commerce": 10, ... }

    -- Company size breakdown
    company_size_breakdown JSONB DEFAULT '{}',
    -- { "1-10": 5, "11-50": 10, "51-200": 8, ... }

    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(tracking_script_id, date)
);

CREATE INDEX idx_visitor_metrics_script ON visitor_metrics(tracking_script_id);
CREATE INDEX idx_visitor_metrics_date ON visitor_metrics(date DESC);

-- ============================================
-- RLS POLICIES
-- ============================================

ALTER TABLE tracking_scripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE website_visitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE visitor_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE visitor_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE visitor_alert_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE visitor_metrics ENABLE ROW LEVEL SECURITY;

-- Tracking Scripts
CREATE POLICY "Org members can view tracking scripts"
    ON tracking_scripts FOR SELECT
    USING (organization_id = ANY(auth.user_organizations()));

CREATE POLICY "Admins can manage tracking scripts"
    ON tracking_scripts FOR ALL
    USING (auth.has_org_role(organization_id, ARRAY['owner', 'admin']));

-- Website Visitors
CREATE POLICY "Org members can view visitors"
    ON website_visitors FOR SELECT
    USING (organization_id = ANY(auth.user_organizations()));

CREATE POLICY "Members can manage visitors"
    ON website_visitors FOR ALL
    USING (auth.has_org_role(organization_id, ARRAY['owner', 'admin', 'member']));

-- Visitor Sessions
CREATE POLICY "Org members can view sessions"
    ON visitor_sessions FOR SELECT
    USING (tracking_script_id IN (
        SELECT id FROM tracking_scripts WHERE organization_id = ANY(auth.user_organizations())
    ));

-- Visitor Alerts
CREATE POLICY "Org members can view visitor alerts"
    ON visitor_alerts FOR SELECT
    USING (organization_id = ANY(auth.user_organizations()));

CREATE POLICY "Admins can manage visitor alerts"
    ON visitor_alerts FOR ALL
    USING (auth.has_org_role(organization_id, ARRAY['owner', 'admin']));

-- Alert History
CREATE POLICY "Org members can view alert history"
    ON visitor_alert_history FOR SELECT
    USING (alert_id IN (
        SELECT id FROM visitor_alerts WHERE organization_id = ANY(auth.user_organizations())
    ));

-- Visitor Metrics
CREATE POLICY "Org members can view visitor metrics"
    ON visitor_metrics FOR SELECT
    USING (tracking_script_id IN (
        SELECT id FROM tracking_scripts WHERE organization_id = ANY(auth.user_organizations())
    ));

-- ============================================
-- TRIGGERS
-- ============================================

CREATE TRIGGER update_tracking_scripts_updated_at
    BEFORE UPDATE ON tracking_scripts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_website_visitors_updated_at
    BEFORE UPDATE ON website_visitors
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_visitor_alerts_updated_at
    BEFORE UPDATE ON visitor_alerts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- HELPER FUNCTION: Generate tracking script key
-- ============================================

CREATE OR REPLACE FUNCTION generate_tracking_script_key()
RETURNS TEXT AS $$
BEGIN
    RETURN 'mpv_' || encode(gen_random_bytes(16), 'hex');
END;
$$ LANGUAGE plpgsql;
