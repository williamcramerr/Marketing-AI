-- Growth Engine: Referral Program Engine
-- Customer referral programs with Stripe rewards

-- ============================================
-- REFERRAL PROGRAMS
-- ============================================

CREATE TABLE referral_programs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
    product_id UUID REFERENCES products(id),

    -- Basic info
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    description TEXT,
    terms_and_conditions TEXT,

    -- Referrer rewards (person who refers)
    referrer_reward_type TEXT NOT NULL CHECK (referrer_reward_type IN (
        'credit', 'discount_percent', 'discount_fixed', 'free_month', 'cash', 'tokens', 'custom'
    )),
    referrer_reward_amount INTEGER NOT NULL, -- cents for cash/credit, percent for discount
    referrer_reward_description TEXT,
    referrer_max_rewards INTEGER, -- NULL = unlimited

    -- Referee rewards (person being referred)
    referee_reward_type TEXT NOT NULL CHECK (referee_reward_type IN (
        'credit', 'discount_percent', 'discount_fixed', 'free_month', 'extended_trial', 'custom'
    )),
    referee_reward_amount INTEGER NOT NULL,
    referee_reward_description TEXT,

    -- Qualification rules
    qualification_rules JSONB DEFAULT '{}',
    -- {
    --   require_paid_subscription: true,
    --   minimum_subscription_days: 14,
    --   minimum_spend_cents: 5000,
    --   require_verified_email: true,
    --   excluded_plans: ["free"]
    -- }

    -- Double-sided rewards
    double_sided BOOLEAN DEFAULT true, -- Both referrer and referee get rewards

    -- Timing
    reward_delay_days INTEGER DEFAULT 0, -- Days to wait before granting reward
    expiry_days INTEGER DEFAULT 90, -- How long referral link is valid

    -- Limits
    max_referrals_per_user INTEGER, -- NULL = unlimited
    max_total_referrals INTEGER, -- NULL = unlimited
    budget_cents INTEGER, -- Total budget for rewards

    -- Landing page
    landing_page_enabled BOOLEAN DEFAULT true,
    landing_page_config JSONB DEFAULT '{}',
    -- { headline, description, benefits[], hero_image_url }

    -- Stats
    total_referral_links INTEGER DEFAULT 0,
    total_clicks INTEGER DEFAULT 0,
    total_signups INTEGER DEFAULT 0,
    total_conversions INTEGER DEFAULT 0,
    total_rewards_paid_cents INTEGER DEFAULT 0,

    -- Status
    active BOOLEAN DEFAULT true,
    starts_at TIMESTAMPTZ,
    ends_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(organization_id, slug)
);

CREATE INDEX idx_referral_programs_org ON referral_programs(organization_id);
CREATE INDEX idx_referral_programs_product ON referral_programs(product_id);
CREATE INDEX idx_referral_programs_slug ON referral_programs(organization_id, slug);
CREATE INDEX idx_referral_programs_active ON referral_programs(organization_id) WHERE active = true;

-- ============================================
-- REFERRAL LINKS
-- ============================================

CREATE TABLE referral_links (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    program_id UUID REFERENCES referral_programs(id) ON DELETE CASCADE NOT NULL,
    referrer_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

    -- Link identification
    code TEXT UNIQUE NOT NULL, -- Short code for URL
    custom_slug TEXT, -- Optional custom slug

    -- Referrer info (denormalized for display)
    referrer_name TEXT,
    referrer_email TEXT,

    -- Stats
    click_count INTEGER DEFAULT 0,
    unique_click_count INTEGER DEFAULT 0,
    signup_count INTEGER DEFAULT 0,
    qualified_count INTEGER DEFAULT 0,
    conversion_count INTEGER DEFAULT 0,

    -- Rewards earned
    rewards_earned_count INTEGER DEFAULT 0,
    rewards_earned_cents INTEGER DEFAULT 0,

    -- Limits (can override program defaults)
    max_uses INTEGER, -- NULL = use program default

    -- Status
    active BOOLEAN DEFAULT true,
    expires_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_referral_links_program ON referral_links(program_id);
CREATE INDEX idx_referral_links_user ON referral_links(referrer_user_id);
CREATE INDEX idx_referral_links_code ON referral_links(code);
CREATE INDEX idx_referral_links_active ON referral_links(program_id) WHERE active = true;

-- ============================================
-- REFERRALS (Individual referral tracking)
-- ============================================

CREATE TABLE referrals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    link_id UUID REFERENCES referral_links(id) ON DELETE CASCADE NOT NULL,
    program_id UUID REFERENCES referral_programs(id) ON DELETE CASCADE NOT NULL,

    -- Referred person
    referred_user_id UUID REFERENCES auth.users(id),
    referred_email TEXT,
    referred_name TEXT,

    -- Status progression
    status TEXT DEFAULT 'clicked' CHECK (status IN (
        'clicked', 'signed_up', 'qualified', 'converted', 'rewarded', 'expired', 'fraudulent'
    )),

    -- Timestamps for each stage
    clicked_at TIMESTAMPTZ DEFAULT NOW(),
    signed_up_at TIMESTAMPTZ,
    qualified_at TIMESTAMPTZ,
    converted_at TIMESTAMPTZ,
    rewarded_at TIMESTAMPTZ,

    -- Conversion details
    conversion_type TEXT, -- 'trial', 'purchase', 'upgrade'
    conversion_value_cents INTEGER,
    stripe_subscription_id TEXT,

    -- Tracking
    ip_address TEXT,
    user_agent TEXT,
    referrer_url TEXT,
    landing_page_url TEXT,
    utm_source TEXT,
    utm_medium TEXT,
    utm_campaign TEXT,

    -- Fraud detection
    fraud_score INTEGER DEFAULT 0,
    fraud_signals JSONB DEFAULT '{}',
    -- { same_ip_as_referrer, suspicious_email, rapid_signup }

    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_referrals_link ON referrals(link_id);
CREATE INDEX idx_referrals_program ON referrals(program_id);
CREATE INDEX idx_referrals_referred_user ON referrals(referred_user_id);
CREATE INDEX idx_referrals_email ON referrals(referred_email);
CREATE INDEX idx_referrals_status ON referrals(status);
CREATE INDEX idx_referrals_converted ON referrals(program_id, status) WHERE status = 'converted';

-- ============================================
-- REFERRAL REWARDS
-- ============================================

CREATE TABLE referral_rewards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    referral_id UUID REFERENCES referrals(id) ON DELETE CASCADE NOT NULL,
    program_id UUID REFERENCES referral_programs(id) ON DELETE CASCADE NOT NULL,
    recipient_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

    -- Reward details
    recipient_type TEXT NOT NULL CHECK (recipient_type IN ('referrer', 'referee')),
    reward_type TEXT NOT NULL,
    reward_amount INTEGER NOT NULL,
    reward_description TEXT,

    -- Status
    status TEXT DEFAULT 'pending' CHECK (status IN (
        'pending', 'approved', 'processing', 'fulfilled', 'failed', 'cancelled', 'clawed_back'
    )),

    -- Fulfillment
    approved_at TIMESTAMPTZ,
    approved_by UUID REFERENCES auth.users(id),
    fulfilled_at TIMESTAMPTZ,
    fulfillment_method TEXT, -- 'stripe_credit', 'stripe_coupon', 'manual', 'api'
    fulfillment_reference TEXT, -- Stripe credit ID, coupon code, etc.

    -- Stripe integration
    stripe_customer_id TEXT,
    stripe_credit_id TEXT,
    stripe_coupon_id TEXT,

    -- Cancellation
    cancelled_at TIMESTAMPTZ,
    cancelled_by UUID REFERENCES auth.users(id),
    cancellation_reason TEXT,

    -- Clawback (if referee churns)
    clawed_back_at TIMESTAMPTZ,
    clawback_reason TEXT,

    notes TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_referral_rewards_referral ON referral_rewards(referral_id);
CREATE INDEX idx_referral_rewards_program ON referral_rewards(program_id);
CREATE INDEX idx_referral_rewards_recipient ON referral_rewards(recipient_user_id);
CREATE INDEX idx_referral_rewards_status ON referral_rewards(status);
CREATE INDEX idx_referral_rewards_pending ON referral_rewards(program_id, status)
    WHERE status = 'pending';

-- ============================================
-- REFERRAL LINK CLICKS (Detailed tracking)
-- ============================================

CREATE TABLE referral_link_clicks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    link_id UUID REFERENCES referral_links(id) ON DELETE CASCADE NOT NULL,
    referral_id UUID REFERENCES referrals(id),

    -- Click details
    clicked_at TIMESTAMPTZ DEFAULT NOW(),
    ip_address TEXT,
    user_agent TEXT,
    referrer_url TEXT,

    -- Geolocation
    country TEXT,
    region TEXT,
    city TEXT,

    -- Device info
    device_type TEXT,
    browser TEXT,
    os TEXT,

    -- UTM parameters
    utm_source TEXT,
    utm_medium TEXT,
    utm_campaign TEXT,

    -- Fingerprinting (for fraud detection)
    fingerprint_hash TEXT,
    is_unique BOOLEAN DEFAULT true
);

CREATE INDEX idx_referral_clicks_link ON referral_link_clicks(link_id);
CREATE INDEX idx_referral_clicks_referral ON referral_link_clicks(referral_id);
CREATE INDEX idx_referral_clicks_date ON referral_link_clicks(clicked_at DESC);

-- ============================================
-- CUSTOMER HAPPINESS SIGNALS (For AI referral prompts)
-- ============================================

CREATE TABLE customer_happiness_signals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

    -- Happiness indicators
    happiness_score INTEGER CHECK (happiness_score BETWEEN 0 AND 100),

    -- Individual signals
    signals JSONB DEFAULT '{}',
    -- {
    --   nps_score: 9,
    --   nps_date: "2024-01-15",
    --   feature_adoption_rate: 0.75,
    --   engagement_trend: "increasing",
    --   support_tickets_last_30d: 0,
    --   recent_wins: ["completed_onboarding", "first_campaign_success"],
    --   time_since_last_complaint_days: 90,
    --   subscription_tenure_days: 180,
    --   plan_tier: "pro"
    -- }

    -- Referral readiness assessment
    referral_readiness TEXT CHECK (referral_readiness IN (
        'not_ready', 'warming_up', 'ready', 'ideal', 'already_referred'
    )),
    readiness_factors JSONB DEFAULT '{}',
    recommended_action TEXT,
    recommended_prompt TEXT,

    -- Last referral activity
    last_referral_ask_at TIMESTAMPTZ,
    last_referral_made_at TIMESTAMPTZ,
    total_referrals_made INTEGER DEFAULT 0,

    last_calculated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(organization_id, user_id)
);

CREATE INDEX idx_happiness_signals_org ON customer_happiness_signals(organization_id);
CREATE INDEX idx_happiness_signals_user ON customer_happiness_signals(user_id);
CREATE INDEX idx_happiness_signals_readiness ON customer_happiness_signals(referral_readiness);
CREATE INDEX idx_happiness_signals_ideal ON customer_happiness_signals(organization_id, referral_readiness)
    WHERE referral_readiness = 'ideal';

-- ============================================
-- REFERRAL METRICS (Daily aggregates)
-- ============================================

CREATE TABLE referral_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    program_id UUID REFERENCES referral_programs(id) ON DELETE CASCADE NOT NULL,
    date DATE NOT NULL,

    -- Click metrics
    total_clicks INTEGER DEFAULT 0,
    unique_clicks INTEGER DEFAULT 0,

    -- Conversion funnel
    signups INTEGER DEFAULT 0,
    qualified INTEGER DEFAULT 0,
    converted INTEGER DEFAULT 0,

    -- Conversion rates
    click_to_signup_rate NUMERIC(5, 4),
    signup_to_qualified_rate NUMERIC(5, 4),
    qualified_to_converted_rate NUMERIC(5, 4),

    -- Rewards
    rewards_pending INTEGER DEFAULT 0,
    rewards_fulfilled INTEGER DEFAULT 0,
    rewards_value_cents INTEGER DEFAULT 0,

    -- Revenue
    attributed_revenue_cents INTEGER DEFAULT 0,
    roi_percentage NUMERIC(8, 2),

    -- Top performers
    top_referrers JSONB DEFAULT '[]',
    -- [{ user_id, name, referrals, conversions }]

    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(program_id, date)
);

CREATE INDEX idx_referral_metrics_program ON referral_metrics(program_id);
CREATE INDEX idx_referral_metrics_date ON referral_metrics(date DESC);

-- ============================================
-- RLS POLICIES
-- ============================================

ALTER TABLE referral_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_link_clicks ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_happiness_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_metrics ENABLE ROW LEVEL SECURITY;

-- Referral Programs
CREATE POLICY "Org members can view referral programs"
    ON referral_programs FOR SELECT
    USING (organization_id = ANY(auth.user_organizations()));

CREATE POLICY "Admins can manage referral programs"
    ON referral_programs FOR ALL
    USING (auth.has_org_role(organization_id, ARRAY['owner', 'admin']));

-- Referral Links
CREATE POLICY "Users can view own referral links"
    ON referral_links FOR SELECT
    USING (referrer_user_id = auth.uid());

CREATE POLICY "Admins can view all referral links"
    ON referral_links FOR SELECT
    USING (program_id IN (
        SELECT id FROM referral_programs WHERE organization_id = ANY(auth.user_organizations())
    ));

CREATE POLICY "Users can create own referral links"
    ON referral_links FOR INSERT
    WITH CHECK (referrer_user_id = auth.uid());

-- Referrals
CREATE POLICY "Referrers can view their referrals"
    ON referrals FOR SELECT
    USING (link_id IN (
        SELECT id FROM referral_links WHERE referrer_user_id = auth.uid()
    ));

CREATE POLICY "Admins can view all referrals"
    ON referrals FOR SELECT
    USING (program_id IN (
        SELECT id FROM referral_programs WHERE organization_id = ANY(auth.user_organizations())
    ));

-- Referral Rewards
CREATE POLICY "Recipients can view own rewards"
    ON referral_rewards FOR SELECT
    USING (recipient_user_id = auth.uid());

CREATE POLICY "Admins can manage rewards"
    ON referral_rewards FOR ALL
    USING (program_id IN (
        SELECT id FROM referral_programs
        WHERE auth.has_org_role(organization_id, ARRAY['owner', 'admin'])
    ));

-- Referral Link Clicks
CREATE POLICY "Referrers can view clicks on their links"
    ON referral_link_clicks FOR SELECT
    USING (link_id IN (
        SELECT id FROM referral_links WHERE referrer_user_id = auth.uid()
    ));

-- Customer Happiness Signals
CREATE POLICY "Users can view own happiness signals"
    ON customer_happiness_signals FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Admins can view org happiness signals"
    ON customer_happiness_signals FOR SELECT
    USING (organization_id = ANY(auth.user_organizations()));

-- Referral Metrics
CREATE POLICY "Org members can view referral metrics"
    ON referral_metrics FOR SELECT
    USING (program_id IN (
        SELECT id FROM referral_programs WHERE organization_id = ANY(auth.user_organizations())
    ));

-- ============================================
-- TRIGGERS
-- ============================================

CREATE TRIGGER update_referral_programs_updated_at
    BEFORE UPDATE ON referral_programs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_referral_links_updated_at
    BEFORE UPDATE ON referral_links
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_referrals_updated_at
    BEFORE UPDATE ON referrals
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_referral_rewards_updated_at
    BEFORE UPDATE ON referral_rewards
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_customer_happiness_signals_updated_at
    BEFORE UPDATE ON customer_happiness_signals
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- HELPER FUNCTION: Generate referral code
-- ============================================

CREATE OR REPLACE FUNCTION generate_referral_code()
RETURNS TEXT AS $$
BEGIN
    RETURN upper(substr(encode(gen_random_bytes(4), 'hex'), 1, 8));
END;
$$ LANGUAGE plpgsql;
