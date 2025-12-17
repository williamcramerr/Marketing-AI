-- Growth Engine: Partnership Finder
-- AI-identified partnership opportunities and outreach

-- ============================================
-- PARTNERSHIP OPPORTUNITIES
-- ============================================

CREATE TABLE partnership_opportunities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
    product_id UUID REFERENCES products(id),

    -- Company info
    company_name TEXT NOT NULL,
    company_website TEXT,
    company_domain TEXT,
    company_description TEXT,
    company_logo_url TEXT,

    -- Company details
    company_industry TEXT,
    company_size TEXT CHECK (company_size IN (
        '1-10', '11-50', '51-200', '201-500', '501-1000', '1001-5000', '5000+'
    )),
    company_location TEXT,
    company_founded_year INTEGER,

    -- Contact info
    contact_name TEXT,
    contact_title TEXT,
    contact_email TEXT,
    contact_phone TEXT,
    contact_linkedin TEXT,
    contact_twitter TEXT,

    -- Discovery source
    discovery_source TEXT NOT NULL CHECK (discovery_source IN (
        'ai_scan', 'manual', 'inbound', 'referral', 'event', 'content'
    )),
    discovery_context TEXT, -- How/where we found them
    discovered_by UUID REFERENCES auth.users(id),

    -- AI analysis
    ai_analysis JSONB DEFAULT '{}',
    -- {
    --   customer_overlap_score: 75,
    --   complementary_score: 85,
    --   partnership_potential: 80,
    --   reasoning: "...",
    --   suggested_partnership_types: ["co_marketing", "integration"],
    --   value_exchange_ideas: ["...", "..."],
    --   potential_risks: ["...", "..."],
    --   similar_successful_partnerships: ["...", "..."]
    -- }

    -- Scoring
    opportunity_score INTEGER CHECK (opportunity_score BETWEEN 0 AND 100),
    fit_score INTEGER CHECK (fit_score BETWEEN 0 AND 100),
    reach_score INTEGER CHECK (reach_score BETWEEN 0 AND 100),
    engagement_likelihood INTEGER CHECK (engagement_likelihood BETWEEN 0 AND 100),

    -- Categorization
    partnership_types TEXT[] DEFAULT '{}', -- ['affiliate', 'co_marketing', 'integration', 'reseller']
    target_audience_overlap TEXT,
    complementary_products TEXT[],

    -- Status
    status TEXT DEFAULT 'discovered' CHECK (status IN (
        'discovered', 'researching', 'qualified', 'disqualified',
        'outreach_draft', 'outreach_sent', 'in_conversation',
        'negotiating', 'active', 'declined', 'rejected', 'churned'
    )),
    status_changed_at TIMESTAMPTZ,
    status_changed_by UUID REFERENCES auth.users(id),

    -- Assignment
    assigned_to UUID REFERENCES auth.users(id),
    assigned_at TIMESTAMPTZ,

    -- Priority and tags
    priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    tags TEXT[] DEFAULT '{}',
    notes TEXT,

    -- Conversion
    converted_to_partnership_id UUID, -- Will reference partnerships table

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_partnership_opps_org ON partnership_opportunities(organization_id);
CREATE INDEX idx_partnership_opps_product ON partnership_opportunities(product_id);
CREATE INDEX idx_partnership_opps_status ON partnership_opportunities(status);
CREATE INDEX idx_partnership_opps_score ON partnership_opportunities(opportunity_score DESC);
CREATE INDEX idx_partnership_opps_priority ON partnership_opportunities(priority);
CREATE INDEX idx_partnership_opps_assigned ON partnership_opportunities(assigned_to);
CREATE INDEX idx_partnership_opps_qualified ON partnership_opportunities(organization_id, status)
    WHERE status = 'qualified';
CREATE INDEX idx_partnership_opps_domain ON partnership_opportunities(company_domain);

-- ============================================
-- PARTNERSHIP OUTREACH
-- ============================================

CREATE TABLE partnership_outreach (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    opportunity_id UUID REFERENCES partnership_opportunities(id) ON DELETE CASCADE NOT NULL,

    -- Sequence tracking
    sequence_number INTEGER DEFAULT 1,
    outreach_type TEXT NOT NULL CHECK (outreach_type IN (
        'initial', 'follow_up', 'breakup', 'reconnect', 'response'
    )),

    -- Channel
    channel TEXT NOT NULL CHECK (channel IN ('email', 'linkedin', 'twitter', 'phone', 'other')),

    -- Content
    subject TEXT,
    body TEXT NOT NULL,
    personalization_used JSONB DEFAULT '{}',
    -- { company_mention, recent_news, mutual_connection, shared_interest }

    -- AI generation
    ai_generated BOOLEAN DEFAULT false,
    generation_params JSONB DEFAULT '{}',
    edited_from_ai BOOLEAN DEFAULT false,

    -- Status
    status TEXT DEFAULT 'draft' CHECK (status IN (
        'draft', 'scheduled', 'sent', 'delivered', 'opened', 'clicked', 'replied', 'bounced', 'failed'
    )),

    -- Scheduling
    scheduled_for TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,

    -- Delivery tracking
    message_id TEXT, -- From email provider
    delivered_at TIMESTAMPTZ,
    opened_at TIMESTAMPTZ,
    open_count INTEGER DEFAULT 0,
    clicked_at TIMESTAMPTZ,
    click_count INTEGER DEFAULT 0,

    -- Response
    replied_at TIMESTAMPTZ,
    reply_sentiment TEXT CHECK (reply_sentiment IN ('positive', 'neutral', 'negative')),
    reply_content TEXT,

    -- Errors
    error_message TEXT,
    bounce_type TEXT,

    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_partnership_outreach_opportunity ON partnership_outreach(opportunity_id);
CREATE INDEX idx_partnership_outreach_status ON partnership_outreach(status);
CREATE INDEX idx_partnership_outreach_scheduled ON partnership_outreach(scheduled_for)
    WHERE status = 'scheduled';
CREATE INDEX idx_partnership_outreach_sent ON partnership_outreach(sent_at DESC);

-- ============================================
-- PARTNERSHIPS (Active partnerships)
-- ============================================

CREATE TABLE partnerships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
    opportunity_id UUID REFERENCES partnership_opportunities(id),
    product_id UUID REFERENCES products(id),

    -- Partner info
    partner_name TEXT NOT NULL,
    partner_website TEXT,
    partner_domain TEXT,
    partner_logo_url TEXT,
    partner_description TEXT,

    -- Primary contact
    contact_name TEXT,
    contact_email TEXT,
    contact_phone TEXT,

    -- Partnership details
    partnership_type TEXT NOT NULL CHECK (partnership_type IN (
        'affiliate', 'co_marketing', 'integration', 'reseller', 'referral', 'technology', 'strategic'
    )),
    partnership_tier TEXT DEFAULT 'standard' CHECK (partnership_tier IN (
        'basic', 'standard', 'premium', 'strategic'
    )),

    -- Agreement details
    agreement_start_date DATE,
    agreement_end_date DATE,
    auto_renew BOOLEAN DEFAULT true,
    agreement_document_url TEXT,

    -- Commission/revenue share (for affiliate/reseller)
    commission_type TEXT CHECK (commission_type IN ('percent', 'fixed', 'tiered')),
    commission_rate INTEGER, -- Percent or cents
    commission_structure JSONB DEFAULT '{}',
    -- { tiers: [{ min_referrals: 0, rate: 20 }, { min_referrals: 10, rate: 25 }] }

    -- Integration details (for technology partnerships)
    integration_type TEXT,
    integration_status TEXT CHECK (integration_status IN (
        'planned', 'in_development', 'testing', 'live', 'deprecated'
    )),
    integration_docs_url TEXT,

    -- Co-marketing details
    co_marketing_activities JSONB DEFAULT '[]',
    -- [{ type: "webinar", title: "...", date: "...", status: "completed" }]

    -- Performance tracking
    total_referrals INTEGER DEFAULT 0,
    total_conversions INTEGER DEFAULT 0,
    total_revenue_cents INTEGER DEFAULT 0,
    total_commission_paid_cents INTEGER DEFAULT 0,

    -- Health metrics
    last_activity_at TIMESTAMPTZ,
    health_score INTEGER CHECK (health_score BETWEEN 0 AND 100),
    health_factors JSONB DEFAULT '{}',

    -- Status
    status TEXT DEFAULT 'active' CHECK (status IN (
        'pending', 'onboarding', 'active', 'paused', 'at_risk', 'churned', 'terminated'
    )),
    status_reason TEXT,

    -- Notes and internal tracking
    notes TEXT,
    tags TEXT[] DEFAULT '{}',

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_partnerships_org ON partnerships(organization_id);
CREATE INDEX idx_partnerships_opportunity ON partnerships(opportunity_id);
CREATE INDEX idx_partnerships_product ON partnerships(product_id);
CREATE INDEX idx_partnerships_type ON partnerships(partnership_type);
CREATE INDEX idx_partnerships_status ON partnerships(status);
CREATE INDEX idx_partnerships_active ON partnerships(organization_id, status) WHERE status = 'active';
CREATE INDEX idx_partnerships_domain ON partnerships(partner_domain);

-- Update the opportunity with converted partnership reference
ALTER TABLE partnership_opportunities
    ADD CONSTRAINT fk_converted_partnership
    FOREIGN KEY (converted_to_partnership_id) REFERENCES partnerships(id);

-- ============================================
-- PARTNERSHIP ACTIVITIES
-- ============================================

CREATE TABLE partnership_activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    partnership_id UUID REFERENCES partnerships(id) ON DELETE CASCADE NOT NULL,

    -- Activity details
    activity_type TEXT NOT NULL CHECK (activity_type IN (
        'referral', 'conversion', 'commission_paid', 'co_marketing',
        'meeting', 'review', 'renewal', 'issue', 'note', 'status_change'
    )),
    title TEXT NOT NULL,
    description TEXT,

    -- Related data
    metadata JSONB DEFAULT '{}',
    -- For referral: { referred_company, referred_email }
    -- For conversion: { revenue_cents, product }
    -- For commission: { amount_cents, period }
    -- For co_marketing: { activity_type, title, url }

    -- Attribution
    attributed_value_cents INTEGER,

    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_partnership_activities_partnership ON partnership_activities(partnership_id);
CREATE INDEX idx_partnership_activities_type ON partnership_activities(activity_type);
CREATE INDEX idx_partnership_activities_created ON partnership_activities(created_at DESC);

-- ============================================
-- PARTNERSHIP REFERRALS (Track individual referrals from partners)
-- ============================================

CREATE TABLE partnership_referrals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    partnership_id UUID REFERENCES partnerships(id) ON DELETE CASCADE NOT NULL,

    -- Referred entity
    referred_company TEXT,
    referred_contact_name TEXT,
    referred_contact_email TEXT,
    referred_website TEXT,

    -- Status
    status TEXT DEFAULT 'submitted' CHECK (status IN (
        'submitted', 'contacted', 'qualified', 'opportunity', 'won', 'lost', 'disqualified'
    )),
    status_changed_at TIMESTAMPTZ,

    -- Opportunity tracking
    deal_value_cents INTEGER,
    deal_stage TEXT,
    expected_close_date DATE,

    -- Conversion
    converted_at TIMESTAMPTZ,
    revenue_cents INTEGER,

    -- Commission
    commission_rate INTEGER,
    commission_amount_cents INTEGER,
    commission_status TEXT DEFAULT 'pending' CHECK (commission_status IN (
        'pending', 'approved', 'paid', 'disputed', 'cancelled'
    )),
    commission_paid_at TIMESTAMPTZ,

    notes TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_partnership_referrals_partnership ON partnership_referrals(partnership_id);
CREATE INDEX idx_partnership_referrals_status ON partnership_referrals(status);
CREATE INDEX idx_partnership_referrals_commission ON partnership_referrals(commission_status);

-- ============================================
-- PARTNERSHIP DISCOVERY SCANS (AI discovery batches)
-- ============================================

CREATE TABLE partnership_discovery_scans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
    product_id UUID REFERENCES products(id),

    -- Scan parameters
    scan_type TEXT NOT NULL CHECK (scan_type IN (
        'competitors_partners', 'complementary_products', 'industry_leaders',
        'content_collaborators', 'integration_opportunities', 'custom'
    )),
    search_parameters JSONB NOT NULL,
    -- { industries: [], company_sizes: [], keywords: [], exclude_domains: [] }

    -- Results
    status TEXT DEFAULT 'pending' CHECK (status IN (
        'pending', 'running', 'completed', 'failed'
    )),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,

    -- Stats
    companies_scanned INTEGER DEFAULT 0,
    opportunities_found INTEGER DEFAULT 0,
    opportunities_qualified INTEGER DEFAULT 0,

    error_message TEXT,

    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_discovery_scans_org ON partnership_discovery_scans(organization_id);
CREATE INDEX idx_discovery_scans_status ON partnership_discovery_scans(status);

-- ============================================
-- PARTNERSHIP METRICS (Daily aggregates)
-- ============================================

CREATE TABLE partnership_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
    date DATE NOT NULL,

    -- Pipeline metrics
    opportunities_discovered INTEGER DEFAULT 0,
    opportunities_qualified INTEGER DEFAULT 0,
    outreach_sent INTEGER DEFAULT 0,
    responses_received INTEGER DEFAULT 0,
    partnerships_started INTEGER DEFAULT 0,

    -- Active partnership metrics
    active_partnerships INTEGER DEFAULT 0,
    partnerships_at_risk INTEGER DEFAULT 0,

    -- Performance metrics
    referrals_received INTEGER DEFAULT 0,
    conversions INTEGER DEFAULT 0,
    revenue_cents INTEGER DEFAULT 0,
    commission_paid_cents INTEGER DEFAULT 0,

    -- By partnership type
    metrics_by_type JSONB DEFAULT '{}',
    -- { affiliate: { referrals: 10, revenue: 5000 }, co_marketing: { ... } }

    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(organization_id, date)
);

CREATE INDEX idx_partnership_metrics_org ON partnership_metrics(organization_id);
CREATE INDEX idx_partnership_metrics_date ON partnership_metrics(date DESC);

-- ============================================
-- RLS POLICIES
-- ============================================

ALTER TABLE partnership_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE partnership_outreach ENABLE ROW LEVEL SECURITY;
ALTER TABLE partnerships ENABLE ROW LEVEL SECURITY;
ALTER TABLE partnership_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE partnership_referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE partnership_discovery_scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE partnership_metrics ENABLE ROW LEVEL SECURITY;

-- Partnership Opportunities
CREATE POLICY "Org members can view partnership opportunities"
    ON partnership_opportunities FOR SELECT
    USING (organization_id = ANY(auth.user_organizations()));

CREATE POLICY "Members can manage partnership opportunities"
    ON partnership_opportunities FOR ALL
    USING (auth.has_org_role(organization_id, ARRAY['owner', 'admin', 'member']));

-- Partnership Outreach
CREATE POLICY "Org members can view partnership outreach"
    ON partnership_outreach FOR SELECT
    USING (opportunity_id IN (
        SELECT id FROM partnership_opportunities WHERE organization_id = ANY(auth.user_organizations())
    ));

CREATE POLICY "Members can manage partnership outreach"
    ON partnership_outreach FOR ALL
    USING (opportunity_id IN (
        SELECT id FROM partnership_opportunities
        WHERE auth.has_org_role(organization_id, ARRAY['owner', 'admin', 'member'])
    ));

-- Partnerships
CREATE POLICY "Org members can view partnerships"
    ON partnerships FOR SELECT
    USING (organization_id = ANY(auth.user_organizations()));

CREATE POLICY "Admins can manage partnerships"
    ON partnerships FOR ALL
    USING (auth.has_org_role(organization_id, ARRAY['owner', 'admin']));

-- Partnership Activities
CREATE POLICY "Org members can view partnership activities"
    ON partnership_activities FOR SELECT
    USING (partnership_id IN (
        SELECT id FROM partnerships WHERE organization_id = ANY(auth.user_organizations())
    ));

CREATE POLICY "Members can create partnership activities"
    ON partnership_activities FOR INSERT
    WITH CHECK (partnership_id IN (
        SELECT id FROM partnerships
        WHERE auth.has_org_role(organization_id, ARRAY['owner', 'admin', 'member'])
    ));

-- Partnership Referrals
CREATE POLICY "Org members can view partnership referrals"
    ON partnership_referrals FOR SELECT
    USING (partnership_id IN (
        SELECT id FROM partnerships WHERE organization_id = ANY(auth.user_organizations())
    ));

CREATE POLICY "Members can manage partnership referrals"
    ON partnership_referrals FOR ALL
    USING (partnership_id IN (
        SELECT id FROM partnerships
        WHERE auth.has_org_role(organization_id, ARRAY['owner', 'admin', 'member'])
    ));

-- Partnership Discovery Scans
CREATE POLICY "Org members can view discovery scans"
    ON partnership_discovery_scans FOR SELECT
    USING (organization_id = ANY(auth.user_organizations()));

CREATE POLICY "Members can create discovery scans"
    ON partnership_discovery_scans FOR INSERT
    WITH CHECK (auth.has_org_role(organization_id, ARRAY['owner', 'admin', 'member']));

-- Partnership Metrics
CREATE POLICY "Org members can view partnership metrics"
    ON partnership_metrics FOR SELECT
    USING (organization_id = ANY(auth.user_organizations()));

-- ============================================
-- TRIGGERS
-- ============================================

CREATE TRIGGER update_partnership_opportunities_updated_at
    BEFORE UPDATE ON partnership_opportunities
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_partnership_outreach_updated_at
    BEFORE UPDATE ON partnership_outreach
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_partnerships_updated_at
    BEFORE UPDATE ON partnerships
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_partnership_referrals_updated_at
    BEFORE UPDATE ON partnership_referrals
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
