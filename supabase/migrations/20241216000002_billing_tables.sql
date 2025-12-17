-- Billing Tables Migration
-- Creates tables for subscription plans, subscriptions, and AI usage tracking

-- Subscription Plans table
CREATE TABLE IF NOT EXISTS subscription_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug TEXT UNIQUE NOT NULL CHECK (slug IN ('free', 'pro', 'enterprise')),
    name TEXT NOT NULL,
    description TEXT,
    stripe_product_id TEXT,
    stripe_price_id TEXT,
    price_cents INTEGER NOT NULL DEFAULT 0,
    billing_interval TEXT NOT NULL DEFAULT 'month' CHECK (billing_interval IN ('month', 'year')),
    limits JSONB NOT NULL DEFAULT '{
        "maxProducts": 1,
        "maxCampaigns": 3,
        "maxConnectors": 2,
        "maxTasksPerMonth": 100,
        "aiTokensMonthly": 50000
    }',
    ai_tokens_included INTEGER NOT NULL DEFAULT 50000,
    ai_token_overage_price_per_1k INTEGER NOT NULL DEFAULT 0, -- Price in cents per 1000 tokens
    features JSONB DEFAULT '[]',
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default plans
INSERT INTO subscription_plans (slug, name, description, price_cents, limits, ai_tokens_included, ai_token_overage_price_per_1k, features) VALUES
(
    'free',
    'Free',
    'Get started with Marketing Pilot AI',
    0,
    '{"maxProducts": 1, "maxCampaigns": 3, "maxConnectors": 2, "maxTasksPerMonth": 100, "aiTokensMonthly": 50000}',
    50000,
    0, -- No overage allowed on free
    '["1 product", "3 campaigns", "2 connectors", "50K AI tokens/month", "Community support"]'
),
(
    'pro',
    'Pro',
    'For growing marketing teams',
    4900, -- $49/month
    '{"maxProducts": 10, "maxCampaigns": 50, "maxConnectors": 10, "maxTasksPerMonth": 1000, "aiTokensMonthly": 500000}',
    500000,
    50, -- $0.50 per 1000 tokens overage
    '["10 products", "50 campaigns", "10 connectors", "500K AI tokens/month", "Priority support", "API access", "Analytics dashboard"]'
),
(
    'enterprise',
    'Enterprise',
    'For large organizations',
    29900, -- $299/month
    '{"maxProducts": -1, "maxCampaigns": -1, "maxConnectors": -1, "maxTasksPerMonth": -1, "aiTokensMonthly": 5000000}',
    5000000,
    25, -- $0.25 per 1000 tokens overage
    '["Unlimited products", "Unlimited campaigns", "Unlimited connectors", "5M AI tokens/month", "Dedicated support", "Custom integrations", "SLA guarantee", "SSO"]'
)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    price_cents = EXCLUDED.price_cents,
    limits = EXCLUDED.limits,
    ai_tokens_included = EXCLUDED.ai_tokens_included,
    ai_token_overage_price_per_1k = EXCLUDED.ai_token_overage_price_per_1k,
    features = EXCLUDED.features,
    updated_at = NOW();

-- Subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES subscription_plans(id),
    stripe_subscription_id TEXT UNIQUE,
    stripe_customer_id TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN (
        'active', 'past_due', 'canceled', 'incomplete',
        'incomplete_expired', 'trialing', 'unpaid', 'paused'
    )),
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    cancel_at TIMESTAMPTZ,
    canceled_at TIMESTAMPTZ,
    trial_start TIMESTAMPTZ,
    trial_end TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(organization_id) -- One subscription per organization
);

-- AI Usage table (individual requests)
CREATE TABLE IF NOT EXISTS ai_usage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    model TEXT NOT NULL,
    input_tokens INTEGER NOT NULL DEFAULT 0,
    output_tokens INTEGER NOT NULL DEFAULT 0,
    total_tokens INTEGER GENERATED ALWAYS AS (input_tokens + output_tokens) STORED,
    cost_cents INTEGER NOT NULL DEFAULT 0,
    request_type TEXT, -- 'task', 'chat', 'analysis', etc.
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_ai_usage_org_created ON ai_usage(organization_id, created_at);
CREATE INDEX IF NOT EXISTS idx_ai_usage_task ON ai_usage(task_id) WHERE task_id IS NOT NULL;

-- AI Usage Monthly Aggregates table
CREATE TABLE IF NOT EXISTS ai_usage_monthly (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    total_tokens INTEGER NOT NULL DEFAULT 0,
    total_cost_cents INTEGER NOT NULL DEFAULT 0,
    tokens_included INTEGER NOT NULL DEFAULT 0,
    tokens_overage INTEGER NOT NULL DEFAULT 0,
    overage_cost_cents INTEGER NOT NULL DEFAULT 0,
    request_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(organization_id, period_start)
);

-- Function to update monthly aggregates
CREATE OR REPLACE FUNCTION update_ai_usage_monthly()
RETURNS TRIGGER AS $$
DECLARE
    v_period_start DATE;
    v_period_end DATE;
    v_tokens_included INTEGER;
BEGIN
    -- Calculate period (month)
    v_period_start := DATE_TRUNC('month', NEW.created_at)::DATE;
    v_period_end := (DATE_TRUNC('month', NEW.created_at) + INTERVAL '1 month' - INTERVAL '1 day')::DATE;

    -- Get tokens included from subscription plan
    SELECT COALESCE(sp.ai_tokens_included, 50000) INTO v_tokens_included
    FROM subscriptions s
    JOIN subscription_plans sp ON s.plan_id = sp.id
    WHERE s.organization_id = NEW.organization_id
    LIMIT 1;

    IF v_tokens_included IS NULL THEN
        v_tokens_included := 50000; -- Default free tier
    END IF;

    -- Upsert monthly aggregate
    INSERT INTO ai_usage_monthly (
        organization_id,
        period_start,
        period_end,
        total_tokens,
        total_cost_cents,
        tokens_included,
        request_count
    ) VALUES (
        NEW.organization_id,
        v_period_start,
        v_period_end,
        NEW.total_tokens,
        NEW.cost_cents,
        v_tokens_included,
        1
    )
    ON CONFLICT (organization_id, period_start) DO UPDATE SET
        total_tokens = ai_usage_monthly.total_tokens + NEW.total_tokens,
        total_cost_cents = ai_usage_monthly.total_cost_cents + NEW.cost_cents,
        tokens_overage = GREATEST(0, ai_usage_monthly.total_tokens + NEW.total_tokens - ai_usage_monthly.tokens_included),
        request_count = ai_usage_monthly.request_count + 1,
        updated_at = NOW();

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-update monthly aggregates
DROP TRIGGER IF EXISTS trigger_ai_usage_monthly ON ai_usage;
CREATE TRIGGER trigger_ai_usage_monthly
    AFTER INSERT ON ai_usage
    FOR EACH ROW
    EXECUTE FUNCTION update_ai_usage_monthly();

-- RLS Policies

-- Subscription Plans: Anyone can read, only service role can modify
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active plans"
    ON subscription_plans FOR SELECT
    USING (active = true);

-- Subscriptions: Organization members can view their subscription
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Organization members can view their subscription"
    ON subscriptions FOR SELECT
    TO authenticated
    USING (
        organization_id IN (
            SELECT organization_id FROM organization_members
            WHERE user_id = auth.uid()
        )
    );

-- AI Usage: Organization members can view their usage
ALTER TABLE ai_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Organization members can view their AI usage"
    ON ai_usage FOR SELECT
    TO authenticated
    USING (
        organization_id IN (
            SELECT organization_id FROM organization_members
            WHERE user_id = auth.uid()
        )
    );

-- AI Usage Monthly: Organization members can view their monthly usage
ALTER TABLE ai_usage_monthly ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Organization members can view their monthly usage"
    ON ai_usage_monthly FOR SELECT
    TO authenticated
    USING (
        organization_id IN (
            SELECT organization_id FROM organization_members
            WHERE user_id = auth.uid()
        )
    );

-- Add subscription_id to organizations for quick access
ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'free';
