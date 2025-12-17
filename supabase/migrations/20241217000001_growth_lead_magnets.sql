-- Growth Engine: Lead Magnets + Automated Nurture Sequences
-- Capture leads with valuable content and nurture them to conversion

-- ============================================
-- LEAD MAGNETS
-- ============================================

CREATE TABLE lead_magnets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
    product_id UUID REFERENCES products(id),

    -- Basic info
    title TEXT NOT NULL,
    slug TEXT NOT NULL,
    description TEXT,

    -- Content delivery
    magnet_type TEXT NOT NULL CHECK (magnet_type IN (
        'pdf', 'ebook', 'template', 'checklist', 'tool', 'video', 'webinar', 'course', 'other'
    )),
    file_path TEXT, -- Supabase Storage path
    file_size_bytes INTEGER,
    external_url TEXT, -- Or link to external content

    -- Landing page configuration
    landing_page_template TEXT DEFAULT 'standard' CHECK (landing_page_template IN (
        'standard', 'minimal', 'video', 'checklist', 'custom'
    )),
    landing_page_config JSONB DEFAULT '{}',
    -- {
    --   headline: "...",
    --   subheadline: "...",
    --   benefits: ["...", "..."],
    --   cta_text: "Download Now",
    --   hero_image_url: "...",
    --   testimonial: { quote, author, company },
    --   form_fields: ["email", "first_name", "company"],
    --   custom_css: "..."
    -- }

    -- Thank you page
    thank_you_config JSONB DEFAULT '{}',
    -- { headline, message, show_social_share, next_action }

    -- Nurture sequence (set after creating sequence)
    nurture_sequence_id UUID,

    -- Tracking
    view_count INTEGER DEFAULT 0,
    download_count INTEGER DEFAULT 0,
    conversion_count INTEGER DEFAULT 0,

    -- Status
    active BOOLEAN DEFAULT true,
    published_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(organization_id, slug)
);

CREATE INDEX idx_lead_magnets_org ON lead_magnets(organization_id);
CREATE INDEX idx_lead_magnets_slug ON lead_magnets(organization_id, slug);
CREATE INDEX idx_lead_magnets_product ON lead_magnets(product_id);
CREATE INDEX idx_lead_magnets_active ON lead_magnets(organization_id) WHERE active = true;

-- ============================================
-- LEADS (Captured contacts)
-- ============================================

CREATE TABLE leads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
    lead_magnet_id UUID REFERENCES lead_magnets(id),

    -- Contact info
    email TEXT NOT NULL,
    first_name TEXT,
    last_name TEXT,
    company TEXT,
    job_title TEXT,
    phone TEXT,

    -- Custom fields (from form)
    custom_fields JSONB DEFAULT '{}',

    -- Source tracking
    source TEXT DEFAULT 'lead_magnet' CHECK (source IN (
        'lead_magnet', 'website', 'import', 'manual', 'referral', 'api'
    )),
    source_detail TEXT, -- Specific magnet slug, import file name, etc.
    utm_source TEXT,
    utm_medium TEXT,
    utm_campaign TEXT,
    utm_term TEXT,
    utm_content TEXT,
    referrer_url TEXT,
    landing_page_url TEXT,

    -- Enrichment data (from Clearbit, etc.)
    enrichment_data JSONB DEFAULT '{}',
    enriched_at TIMESTAMPTZ,

    -- Lead scoring
    score INTEGER DEFAULT 0 CHECK (score BETWEEN 0 AND 100),
    score_factors JSONB DEFAULT '{}',
    -- { email_engagement: 20, page_visits: 15, company_fit: 30 }

    -- Nurture status
    nurture_sequence_id UUID,
    nurture_status TEXT DEFAULT 'active' CHECK (nurture_status IN (
        'pending', 'active', 'paused', 'completed', 'unsubscribed', 'converted', 'bounced'
    )),
    current_email_index INTEGER DEFAULT 0,
    last_email_sent_at TIMESTAMPTZ,
    next_email_scheduled_at TIMESTAMPTZ,

    -- Engagement tracking
    emails_sent INTEGER DEFAULT 0,
    emails_opened INTEGER DEFAULT 0,
    emails_clicked INTEGER DEFAULT 0,
    last_engaged_at TIMESTAMPTZ,

    -- Conversion tracking
    converted_at TIMESTAMPTZ,
    converted_to TEXT, -- customer, trial, demo, meeting
    conversion_value_cents INTEGER,
    converted_user_id UUID REFERENCES auth.users(id),

    -- Subscription status
    subscribed BOOLEAN DEFAULT true,
    unsubscribed_at TIMESTAMPTZ,
    unsubscribe_reason TEXT,

    -- IP and location (from signup)
    ip_address TEXT,
    country TEXT,
    region TEXT,
    city TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(organization_id, email)
);

CREATE INDEX idx_leads_org ON leads(organization_id);
CREATE INDEX idx_leads_email ON leads(organization_id, email);
CREATE INDEX idx_leads_magnet ON leads(lead_magnet_id);
CREATE INDEX idx_leads_nurture_status ON leads(nurture_status);
CREATE INDEX idx_leads_score ON leads(score DESC);
CREATE INDEX idx_leads_created ON leads(created_at DESC);
CREATE INDEX idx_leads_active_nurture ON leads(organization_id, nurture_status)
    WHERE nurture_status = 'active';
CREATE INDEX idx_leads_subscribed ON leads(organization_id) WHERE subscribed = true;

-- ============================================
-- NURTURE SEQUENCES
-- ============================================

CREATE TABLE nurture_sequences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
    product_id UUID REFERENCES products(id),
    lead_magnet_id UUID REFERENCES lead_magnets(id),

    name TEXT NOT NULL,
    description TEXT,

    -- Goal
    goal TEXT, -- "Convert to trial", "Book a demo"
    goal_action TEXT CHECK (goal_action IN ('trial', 'demo', 'purchase', 'meeting', 'other')),

    -- Timing configuration
    send_on_days TEXT[] DEFAULT '{}', -- ['monday', 'tuesday'] or empty for any day
    send_time_utc TIME DEFAULT '14:00',
    timezone TEXT DEFAULT 'UTC',

    -- Settings
    skip_weekends BOOLEAN DEFAULT true,
    pause_on_engagement BOOLEAN DEFAULT false, -- Pause if lead engages manually

    -- AI generation metadata
    ai_generated BOOLEAN DEFAULT false,
    generation_params JSONB,

    -- Stats
    total_leads_enrolled INTEGER DEFAULT 0,
    total_completed INTEGER DEFAULT 0,
    total_converted INTEGER DEFAULT 0,
    avg_open_rate NUMERIC(5, 4),
    avg_click_rate NUMERIC(5, 4),

    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_nurture_sequences_org ON nurture_sequences(organization_id);
CREATE INDEX idx_nurture_sequences_product ON nurture_sequences(product_id);
CREATE INDEX idx_nurture_sequences_magnet ON nurture_sequences(lead_magnet_id);
CREATE INDEX idx_nurture_sequences_active ON nurture_sequences(organization_id) WHERE active = true;

-- ============================================
-- NURTURE EMAILS (Emails in a sequence)
-- ============================================

CREATE TABLE nurture_emails (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sequence_id UUID REFERENCES nurture_sequences(id) ON DELETE CASCADE NOT NULL,

    -- Ordering
    sequence_order INTEGER NOT NULL,
    delay_days INTEGER NOT NULL, -- Days after previous email (or signup for first)

    -- Content
    subject TEXT NOT NULL,
    preview_text TEXT,
    from_name TEXT,
    reply_to TEXT,
    body_html TEXT NOT NULL,
    body_text TEXT, -- Plain text version

    -- Email type
    email_type TEXT DEFAULT 'value' CHECK (email_type IN (
        'welcome', 'value', 'story', 'case_study', 'objection_handler',
        'social_proof', 'urgency', 'cta', 'reminder', 'other'
    )),

    -- AI generation metadata
    ai_generated BOOLEAN DEFAULT false,
    generation_params JSONB,

    -- A/B testing
    variant_group TEXT, -- Group variants together
    variant_label TEXT, -- "A", "B"
    variant_weight INTEGER DEFAULT 100, -- Percentage weight

    -- Stats
    sends INTEGER DEFAULT 0,
    opens INTEGER DEFAULT 0,
    unique_opens INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    unique_clicks INTEGER DEFAULT 0,
    unsubscribes INTEGER DEFAULT 0,
    bounces INTEGER DEFAULT 0,

    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_nurture_emails_sequence ON nurture_emails(sequence_id);
CREATE INDEX idx_nurture_emails_order ON nurture_emails(sequence_id, sequence_order);
CREATE INDEX idx_nurture_emails_active ON nurture_emails(sequence_id) WHERE active = true;

-- ============================================
-- LEAD EVENTS (Activity tracking)
-- ============================================

CREATE TABLE lead_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE NOT NULL,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,

    event_type TEXT NOT NULL CHECK (event_type IN (
        'lead_created', 'form_submitted', 'download',
        'email_sent', 'email_opened', 'email_clicked', 'email_bounced',
        'unsubscribed', 'page_visited', 'form_view',
        'score_updated', 'nurture_started', 'nurture_completed',
        'converted', 'manual_note', 'status_changed'
    )),

    -- Related records
    nurture_email_id UUID REFERENCES nurture_emails(id),
    lead_magnet_id UUID REFERENCES lead_magnets(id),

    -- Event details
    metadata JSONB DEFAULT '{}',
    -- For email: { message_id, link_clicked, subject }
    -- For download: { magnet_slug, file_name }
    -- For page_visit: { url, title, duration_seconds }
    -- For score_update: { old_score, new_score, reason }

    -- Tracking
    ip_address TEXT,
    user_agent TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_lead_events_lead ON lead_events(lead_id);
CREATE INDEX idx_lead_events_org ON lead_events(organization_id);
CREATE INDEX idx_lead_events_type ON lead_events(event_type);
CREATE INDEX idx_lead_events_created ON lead_events(created_at DESC);
CREATE INDEX idx_lead_events_email ON lead_events(nurture_email_id) WHERE nurture_email_id IS NOT NULL;

-- ============================================
-- LEAD MAGNET METRICS (Daily aggregates)
-- ============================================

CREATE TABLE lead_magnet_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_magnet_id UUID REFERENCES lead_magnets(id) ON DELETE CASCADE NOT NULL,
    date DATE NOT NULL,

    -- Funnel metrics
    page_views INTEGER DEFAULT 0,
    form_starts INTEGER DEFAULT 0,
    submissions INTEGER DEFAULT 0,
    downloads INTEGER DEFAULT 0,

    -- Conversion rates
    view_to_submit_rate NUMERIC(5, 4),
    submit_to_download_rate NUMERIC(5, 4),

    -- Traffic sources
    sources JSONB DEFAULT '{}',
    -- { organic: 50, paid: 30, social: 20 }

    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(lead_magnet_id, date)
);

CREATE INDEX idx_lead_magnet_metrics_magnet ON lead_magnet_metrics(lead_magnet_id);
CREATE INDEX idx_lead_magnet_metrics_date ON lead_magnet_metrics(date DESC);

-- ============================================
-- ADD FOREIGN KEY FOR CIRCULAR REFERENCE
-- ============================================

ALTER TABLE lead_magnets
    ADD CONSTRAINT fk_lead_magnets_nurture_sequence
    FOREIGN KEY (nurture_sequence_id) REFERENCES nurture_sequences(id);

ALTER TABLE leads
    ADD CONSTRAINT fk_leads_nurture_sequence
    FOREIGN KEY (nurture_sequence_id) REFERENCES nurture_sequences(id);

-- ============================================
-- RLS POLICIES
-- ============================================

ALTER TABLE lead_magnets ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE nurture_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE nurture_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_magnet_metrics ENABLE ROW LEVEL SECURITY;

-- Lead Magnets
CREATE POLICY "Org members can view lead magnets"
    ON lead_magnets FOR SELECT
    USING (organization_id = ANY(auth.user_organizations()));

CREATE POLICY "Members can manage lead magnets"
    ON lead_magnets FOR ALL
    USING (auth.has_org_role(organization_id, ARRAY['owner', 'admin', 'member']));

-- Leads
CREATE POLICY "Org members can view leads"
    ON leads FOR SELECT
    USING (organization_id = ANY(auth.user_organizations()));

CREATE POLICY "Members can manage leads"
    ON leads FOR ALL
    USING (auth.has_org_role(organization_id, ARRAY['owner', 'admin', 'member']));

-- Nurture Sequences
CREATE POLICY "Org members can view nurture sequences"
    ON nurture_sequences FOR SELECT
    USING (organization_id = ANY(auth.user_organizations()));

CREATE POLICY "Members can manage nurture sequences"
    ON nurture_sequences FOR ALL
    USING (auth.has_org_role(organization_id, ARRAY['owner', 'admin', 'member']));

-- Nurture Emails
CREATE POLICY "Org members can view nurture emails"
    ON nurture_emails FOR SELECT
    USING (sequence_id IN (
        SELECT id FROM nurture_sequences WHERE organization_id = ANY(auth.user_organizations())
    ));

CREATE POLICY "Members can manage nurture emails"
    ON nurture_emails FOR ALL
    USING (sequence_id IN (
        SELECT id FROM nurture_sequences
        WHERE auth.has_org_role(organization_id, ARRAY['owner', 'admin', 'member'])
    ));

-- Lead Events
CREATE POLICY "Org members can view lead events"
    ON lead_events FOR SELECT
    USING (organization_id = ANY(auth.user_organizations()));

-- Lead Magnet Metrics
CREATE POLICY "Org members can view lead magnet metrics"
    ON lead_magnet_metrics FOR SELECT
    USING (lead_magnet_id IN (
        SELECT id FROM lead_magnets WHERE organization_id = ANY(auth.user_organizations())
    ));

-- ============================================
-- TRIGGERS
-- ============================================

CREATE TRIGGER update_lead_magnets_updated_at
    BEFORE UPDATE ON lead_magnets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_leads_updated_at
    BEFORE UPDATE ON leads
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_nurture_sequences_updated_at
    BEFORE UPDATE ON nurture_sequences
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_nurture_emails_updated_at
    BEFORE UPDATE ON nurture_emails
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
