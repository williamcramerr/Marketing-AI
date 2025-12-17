-- Marketing Pilot AI - Initial Schema
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_cron";
CREATE EXTENSION IF NOT EXISTS "pg_net";

-- ============================================
-- ORGANIZATIONS & USERS
-- ============================================

CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    settings JSONB DEFAULT '{"sandbox_mode": true}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE organization_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(organization_id, user_id)
);

CREATE INDEX idx_org_members_user ON organization_members(user_id);
CREATE INDEX idx_org_members_org ON organization_members(organization_id);

-- ============================================
-- PRODUCTS (What we're marketing)
-- ============================================

CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    description TEXT,
    website_url TEXT,
    positioning JSONB DEFAULT '{}', -- value props, differentiators, tone
    brand_guidelines JSONB DEFAULT '{}', -- colors, voice, dos/donts
    verified_claims JSONB DEFAULT '[]', -- locked claims that are approved
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(organization_id, slug)
);

CREATE INDEX idx_products_org ON products(organization_id);
CREATE INDEX idx_products_active ON products(organization_id) WHERE active = true;

-- ============================================
-- AUDIENCES (Who we're targeting)
-- ============================================

CREATE TABLE audiences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID REFERENCES products(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    icp_attributes JSONB DEFAULT '{}', -- ideal customer profile
    pain_points JSONB DEFAULT '[]',
    messaging_angles JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audiences_product ON audiences(product_id);

-- ============================================
-- CAMPAIGNS (Strategic initiatives)
-- ============================================

CREATE TYPE campaign_status AS ENUM (
    'draft', 'planned', 'active', 'paused', 'completed', 'cancelled'
);

CREATE TABLE campaigns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID REFERENCES products(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    goal TEXT NOT NULL, -- e.g., "Generate 50 qualified leads"
    goal_metric TEXT, -- e.g., "qualified_leads"
    goal_target NUMERIC,
    status campaign_status DEFAULT 'draft',
    audience_id UUID REFERENCES audiences(id),
    channels TEXT[] DEFAULT '{}', -- ['email', 'blog', 'social']
    start_date DATE,
    end_date DATE,
    budget_cents INTEGER,
    ai_strategy JSONB, -- AI-generated strategy document
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_campaigns_product ON campaigns(product_id);
CREATE INDEX idx_campaigns_status ON campaigns(status);
CREATE INDEX idx_campaigns_active ON campaigns(product_id, status) WHERE status = 'active';

-- ============================================
-- CONNECTORS (Channel integrations)
-- ============================================

CREATE TYPE connector_type AS ENUM (
    'email_resend', 'email_postmark', 'email_sendgrid',
    'social_twitter', 'social_linkedin', 'social_facebook',
    'cms_ghost', 'cms_webflow', 'cms_wordpress',
    'ads_google', 'ads_facebook',
    'analytics_posthog', 'analytics_ga4'
);

CREATE TABLE connectors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
    type connector_type NOT NULL,
    name TEXT NOT NULL,
    credentials JSONB DEFAULT '{}', -- API keys, tokens (encrypted at rest)
    config JSONB DEFAULT '{}', -- rate limits, defaults, etc.
    approval_required BOOLEAN DEFAULT true,
    auto_approve_types TEXT[] DEFAULT '{}',
    rate_limit_per_hour INTEGER,
    rate_limit_per_day INTEGER,
    active BOOLEAN DEFAULT true,
    last_used_at TIMESTAMPTZ,
    last_error TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_connectors_org ON connectors(organization_id);
CREATE INDEX idx_connectors_type ON connectors(type);
CREATE INDEX idx_connectors_active ON connectors(organization_id) WHERE active = true;

-- ============================================
-- TASKS (Atomic work units)
-- ============================================

CREATE TYPE task_status AS ENUM (
    'queued',           -- Waiting to be picked up
    'drafting',         -- AI is generating content
    'drafted',          -- Content ready for review
    'pending_approval', -- Waiting for human approval
    'approved',         -- Approved, waiting to execute
    'executing',        -- Currently being executed
    'completed',        -- Successfully completed
    'failed',           -- Failed (will retry or escalate)
    'cancelled',        -- Manually cancelled
    'evaluated'         -- Post-execution analysis done
);

CREATE TYPE task_type AS ENUM (
    'blog_post',
    'landing_page',
    'email_single',
    'email_sequence',
    'social_post',
    'seo_optimization',
    'ad_campaign',
    'research',
    'analysis'
);

CREATE TABLE tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE NOT NULL,
    parent_task_id UUID REFERENCES tasks(id), -- for subtasks

    -- Task definition
    type task_type NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    priority INTEGER DEFAULT 50 CHECK (priority BETWEEN 1 AND 100),

    -- State machine
    status task_status DEFAULT 'queued',
    status_history JSONB DEFAULT '[]', -- [{status, timestamp, reason}]

    -- Execution details
    assigned_agent TEXT, -- 'content_writer', 'seo_optimizer', etc.
    connector_id UUID REFERENCES connectors(id),
    scheduled_for TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,

    -- Content & results
    input_data JSONB DEFAULT '{}', -- parameters for the task
    draft_content JSONB, -- AI-generated draft
    final_content JSONB, -- Approved/edited content
    execution_result JSONB, -- Result after execution

    -- Safety & tracking
    idempotency_key TEXT UNIQUE,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    error_log JSONB DEFAULT '[]',
    dry_run BOOLEAN DEFAULT false,

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_tasks_campaign ON tasks(campaign_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_scheduled ON tasks(scheduled_for) WHERE status IN ('queued', 'approved');
CREATE INDEX idx_tasks_type ON tasks(type);
CREATE INDEX idx_tasks_idempotency ON tasks(idempotency_key);
CREATE INDEX idx_tasks_pending ON tasks(status) WHERE status = 'pending_approval';

-- ============================================
-- CONTENT ASSETS (Generated content)
-- ============================================

CREATE TYPE asset_type AS ENUM (
    'blog_post', 'landing_page', 'email_template',
    'social_post', 'image', 'document'
);

CREATE TABLE content_assets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID REFERENCES tasks(id),
    product_id UUID REFERENCES products(id) ON DELETE CASCADE NOT NULL,
    type asset_type NOT NULL,
    title TEXT NOT NULL,
    content TEXT, -- Main content (markdown/HTML)
    metadata JSONB DEFAULT '{}', -- SEO meta, open graph, etc.
    version INTEGER DEFAULT 1,
    parent_asset_id UUID REFERENCES content_assets(id),
    storage_path TEXT, -- Supabase storage path if file
    external_url TEXT, -- Published URL if applicable
    published BOOLEAN DEFAULT false,
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_assets_product ON content_assets(product_id);
CREATE INDEX idx_assets_task ON content_assets(task_id);
CREATE INDEX idx_assets_published ON content_assets(product_id) WHERE published = true;

-- ============================================
-- APPROVALS (Human oversight)
-- ============================================

CREATE TYPE approval_status AS ENUM (
    'pending', 'approved', 'rejected', 'auto_approved', 'expired'
);

CREATE TABLE approvals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID REFERENCES tasks(id) ON DELETE CASCADE NOT NULL,
    status approval_status DEFAULT 'pending',
    requested_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES auth.users(id),
    resolution_notes TEXT,
    content_snapshot JSONB, -- Snapshot of content at review time
    changes_requested JSONB -- If rejected with feedback
);

CREATE INDEX idx_approvals_task ON approvals(task_id);
CREATE INDEX idx_approvals_pending ON approvals(status, expires_at) WHERE status = 'pending';

-- ============================================
-- POLICIES & GUARDRAILS
-- ============================================

CREATE TYPE policy_type AS ENUM (
    'rate_limit',      -- Limits on actions per time period
    'banned_phrase',   -- Words/phrases that must not appear
    'required_phrase', -- Disclaimers that must appear
    'claim_lock',      -- Claims that can only be made if verified
    'domain_allowlist',-- Only email to these domains
    'suppression',     -- Email suppression list
    'time_window',     -- Only operate during certain hours
    'budget_limit',    -- Spending caps
    'content_rule'     -- General content rules
);

CREATE TABLE policies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
    product_id UUID REFERENCES products(id), -- NULL = org-wide
    type policy_type NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    rule JSONB NOT NULL,
    severity TEXT DEFAULT 'block' CHECK (severity IN ('warn', 'block', 'escalate')),
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_policies_org ON policies(organization_id);
CREATE INDEX idx_policies_product ON policies(product_id);
CREATE INDEX idx_policies_type ON policies(type);
CREATE INDEX idx_policies_active ON policies(organization_id) WHERE active = true;

-- Suppression list (separate for performance)
CREATE TABLE email_suppressions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
    email TEXT NOT NULL,
    reason TEXT, -- 'unsubscribed', 'bounced', 'complained', 'manual'
    source TEXT, -- Where suppression came from
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(organization_id, email)
);

CREATE INDEX idx_suppressions_lookup ON email_suppressions(organization_id, email);

-- ============================================
-- METRICS & ANALYTICS
-- ============================================

CREATE TABLE metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID REFERENCES tasks(id),
    campaign_id UUID REFERENCES campaigns(id),
    product_id UUID REFERENCES products(id),
    metric_name TEXT NOT NULL,
    metric_value NUMERIC NOT NULL,
    dimensions JSONB DEFAULT '{}',
    recorded_at TIMESTAMPTZ DEFAULT NOW(),
    period_start TIMESTAMPTZ,
    period_end TIMESTAMPTZ
);

CREATE INDEX idx_metrics_task ON metrics(task_id);
CREATE INDEX idx_metrics_campaign ON metrics(campaign_id);
CREATE INDEX idx_metrics_time ON metrics(recorded_at DESC);
CREATE INDEX idx_metrics_name_time ON metrics(metric_name, recorded_at DESC);
CREATE INDEX idx_metrics_product_time ON metrics(product_id, recorded_at DESC);

-- ============================================
-- EXPERIMENTS (A/B Tests)
-- ============================================

CREATE TYPE experiment_status AS ENUM (
    'draft', 'running', 'paused', 'completed', 'cancelled'
);

CREATE TABLE experiments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    hypothesis TEXT,
    variants JSONB NOT NULL,
    metric_name TEXT NOT NULL,
    min_sample_size INTEGER DEFAULT 100,
    confidence_level NUMERIC DEFAULT 0.95,
    status experiment_status DEFAULT 'draft',
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    results JSONB,
    winner_variant TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_experiments_campaign ON experiments(campaign_id);
CREATE INDEX idx_experiments_status ON experiments(status);

CREATE TABLE experiment_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    experiment_id UUID REFERENCES experiments(id) ON DELETE CASCADE NOT NULL,
    identity_type TEXT NOT NULL,
    identity_value TEXT NOT NULL,
    variant_id TEXT NOT NULL,
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(experiment_id, identity_type, identity_value)
);

CREATE INDEX idx_assignments_experiment ON experiment_assignments(experiment_id);

-- ============================================
-- AUDIT LOG (Everything logged)
-- ============================================

CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
    action TEXT NOT NULL,
    actor_type TEXT NOT NULL,
    actor_id TEXT,
    resource_type TEXT,
    resource_id UUID,
    old_values JSONB,
    new_values JSONB,
    metadata JSONB DEFAULT '{}',
    reversible BOOLEAN DEFAULT false,
    reversed_at TIMESTAMPTZ,
    reversed_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_org ON audit_logs(organization_id);
CREATE INDEX idx_audit_action ON audit_logs(action);
CREATE INDEX idx_audit_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_time ON audit_logs(created_at DESC);

-- ============================================
-- AGENT STATE (For long-running agent context)
-- ============================================

CREATE TABLE agent_state (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
    agent_name TEXT NOT NULL,
    memory JSONB DEFAULT '{}',
    last_run_at TIMESTAMPTZ,
    next_run_at TIMESTAMPTZ,
    learned_preferences JSONB DEFAULT '{}',
    performance_history JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(organization_id, agent_name)
);

CREATE INDEX idx_agent_state_org ON agent_state(organization_id);
CREATE INDEX idx_agent_state_next_run ON agent_state(next_run_at) WHERE next_run_at IS NOT NULL;

-- ============================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON organizations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_audiences_updated_at BEFORE UPDATE ON audiences
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_campaigns_updated_at BEFORE UPDATE ON campaigns
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_connectors_updated_at BEFORE UPDATE ON connectors
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON tasks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_content_assets_updated_at BEFORE UPDATE ON content_assets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_policies_updated_at BEFORE UPDATE ON policies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_experiments_updated_at BEFORE UPDATE ON experiments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_agent_state_updated_at BEFORE UPDATE ON agent_state
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- TASK STATUS HISTORY TRIGGER
-- ============================================

CREATE OR REPLACE FUNCTION update_task_status_history()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        NEW.status_history = NEW.status_history || jsonb_build_object(
            'status', NEW.status,
            'previous_status', OLD.status,
            'timestamp', NOW(),
            'reason', COALESCE(current_setting('app.status_change_reason', true), NULL)
        );
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_task_status_history BEFORE UPDATE ON tasks
    FOR EACH ROW EXECUTE FUNCTION update_task_status_history();
