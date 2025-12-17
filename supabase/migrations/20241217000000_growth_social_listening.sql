-- Growth Engine: Social Listening & Helpful Replies
-- Monitor Twitter, Reddit, LinkedIn for opportunities

-- ============================================
-- SOCIAL LISTENING CONFIGURATIONS
-- ============================================

CREATE TABLE social_listening_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    platforms TEXT[] NOT NULL, -- ['twitter', 'reddit', 'linkedin']
    keywords TEXT[] NOT NULL,
    negative_keywords TEXT[] DEFAULT '{}',
    subreddits TEXT[] DEFAULT '{}', -- Specific subreddits to monitor
    intent_threshold TEXT DEFAULT 'medium' CHECK (intent_threshold IN ('low', 'medium', 'high')),
    auto_respond BOOLEAN DEFAULT false,
    response_template TEXT,
    active BOOLEAN DEFAULT true,
    last_scan_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_social_configs_org ON social_listening_configs(organization_id);
CREATE INDEX idx_social_configs_active ON social_listening_configs(organization_id) WHERE active = true;
CREATE INDEX idx_social_configs_product ON social_listening_configs(product_id);

-- ============================================
-- SOCIAL CONVERSATIONS (Discovered Opportunities)
-- ============================================

CREATE TABLE social_conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    config_id UUID REFERENCES social_listening_configs(id) ON DELETE CASCADE NOT NULL,
    platform TEXT NOT NULL CHECK (platform IN ('twitter', 'reddit', 'linkedin')),
    external_id TEXT NOT NULL, -- Platform-specific ID
    external_url TEXT,

    -- Author info
    author_username TEXT,
    author_display_name TEXT,
    author_profile_url TEXT,
    author_followers INTEGER,

    -- Content
    content TEXT NOT NULL,
    content_url TEXT,
    parent_content TEXT, -- Context (original post if this is a reply/comment)
    parent_external_id TEXT,

    -- Platform-specific metadata
    platform_metadata JSONB DEFAULT '{}',
    -- Twitter: { retweet_count, like_count, reply_count }
    -- Reddit: { subreddit, score, num_comments, is_self }
    -- LinkedIn: { share_count, like_count }

    -- AI Analysis
    intent_score INTEGER CHECK (intent_score BETWEEN 0 AND 100),
    intent_level TEXT CHECK (intent_level IN ('low', 'medium', 'high')),
    opportunity_type TEXT CHECK (opportunity_type IN (
        'recommendation_request', -- "What's a good tool for..."
        'problem_statement',      -- "I'm struggling with..."
        'question',               -- General question
        'comparison',             -- "X vs Y"
        'complaint',              -- Unhappy with competitor
        'praise',                 -- Positive mention
        'other'
    )),
    relevance_score INTEGER CHECK (relevance_score BETWEEN 0 AND 100),
    ai_analysis JSONB DEFAULT '{}',
    -- { reasoning, keywords_matched, sentiment, topics }
    suggested_response TEXT,
    response_approach TEXT CHECK (response_approach IN (
        'helpful_info', 'share_experience', 'ask_question', 'direct_recommend', 'skip'
    )),

    -- Status
    status TEXT DEFAULT 'new' CHECK (status IN (
        'new', 'reviewing', 'replied', 'dismissed', 'converted', 'expired'
    )),
    reviewed_at TIMESTAMPTZ,
    reviewed_by UUID REFERENCES auth.users(id),
    dismiss_reason TEXT,

    discovered_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ, -- Conversations can become stale
    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(config_id, platform, external_id)
);

CREATE INDEX idx_social_conversations_config ON social_conversations(config_id);
CREATE INDEX idx_social_conversations_status ON social_conversations(status);
CREATE INDEX idx_social_conversations_intent ON social_conversations(intent_level);
CREATE INDEX idx_social_conversations_platform ON social_conversations(platform);
CREATE INDEX idx_social_conversations_discovered ON social_conversations(discovered_at DESC);
CREATE INDEX idx_social_conversations_new ON social_conversations(config_id, status)
    WHERE status = 'new';

-- ============================================
-- SOCIAL REPLIES (Our Responses)
-- ============================================

CREATE TABLE social_replies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID REFERENCES social_conversations(id) ON DELETE CASCADE NOT NULL,
    connector_id UUID REFERENCES connectors(id), -- Twitter/Reddit/LinkedIn connector

    -- Content
    content TEXT NOT NULL,
    ai_generated BOOLEAN DEFAULT true,
    edited_content TEXT, -- If user edited the AI suggestion

    -- Approval workflow
    status TEXT DEFAULT 'draft' CHECK (status IN (
        'draft', 'pending_approval', 'approved', 'scheduled', 'sent', 'failed'
    )),
    approved_at TIMESTAMPTZ,
    approved_by UUID REFERENCES auth.users(id),
    rejection_reason TEXT,

    -- Execution
    scheduled_for TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    external_reply_id TEXT, -- ID on the platform
    external_reply_url TEXT,

    -- Error tracking
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,

    -- Engagement metrics (fetched later)
    engagement_data JSONB DEFAULT '{}',
    -- { likes, replies, retweets, impressions }
    last_engagement_fetch_at TIMESTAMPTZ,

    -- Conversion tracking
    conversion_tracked BOOLEAN DEFAULT false,
    converted_at TIMESTAMPTZ,
    conversion_type TEXT, -- signup, demo, purchase
    conversion_value_cents INTEGER,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_social_replies_conversation ON social_replies(conversation_id);
CREATE INDEX idx_social_replies_status ON social_replies(status);
CREATE INDEX idx_social_replies_scheduled ON social_replies(scheduled_for)
    WHERE status = 'scheduled';
CREATE INDEX idx_social_replies_sent ON social_replies(sent_at DESC)
    WHERE status = 'sent';

-- ============================================
-- SOCIAL LISTENING METRICS (Aggregated stats)
-- ============================================

CREATE TABLE social_listening_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    config_id UUID REFERENCES social_listening_configs(id) ON DELETE CASCADE NOT NULL,
    date DATE NOT NULL,

    -- Discovery metrics
    conversations_found INTEGER DEFAULT 0,
    high_intent_found INTEGER DEFAULT 0,
    medium_intent_found INTEGER DEFAULT 0,
    low_intent_found INTEGER DEFAULT 0,

    -- Response metrics
    replies_drafted INTEGER DEFAULT 0,
    replies_approved INTEGER DEFAULT 0,
    replies_sent INTEGER DEFAULT 0,
    replies_failed INTEGER DEFAULT 0,

    -- Engagement metrics
    total_engagement INTEGER DEFAULT 0, -- Sum of likes, replies, etc.
    avg_engagement_rate NUMERIC(5, 4),

    -- Conversion metrics
    conversions INTEGER DEFAULT 0,
    conversion_value_cents INTEGER DEFAULT 0,

    -- Platform breakdown
    platform_breakdown JSONB DEFAULT '{}',
    -- { twitter: { found: 10, replied: 5 }, reddit: { ... } }

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(config_id, date)
);

CREATE INDEX idx_social_metrics_config ON social_listening_metrics(config_id);
CREATE INDEX idx_social_metrics_date ON social_listening_metrics(date DESC);

-- ============================================
-- RLS POLICIES
-- ============================================

ALTER TABLE social_listening_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_listening_metrics ENABLE ROW LEVEL SECURITY;

-- Configs: Org members can view, admins can manage
CREATE POLICY "Org members can view listening configs"
    ON social_listening_configs FOR SELECT
    USING (organization_id = ANY(auth.user_organizations()));

CREATE POLICY "Admins can manage listening configs"
    ON social_listening_configs FOR ALL
    USING (auth.has_org_role(organization_id, ARRAY['owner', 'admin']));

-- Conversations: Org members can view/update via config
CREATE POLICY "Org members can view conversations"
    ON social_conversations FOR SELECT
    USING (config_id IN (
        SELECT id FROM social_listening_configs WHERE organization_id = ANY(auth.user_organizations())
    ));

CREATE POLICY "Members can update conversations"
    ON social_conversations FOR UPDATE
    USING (config_id IN (
        SELECT id FROM social_listening_configs
        WHERE organization_id = ANY(auth.user_organizations())
    ));

-- Replies: Org members can view, members+ can manage
CREATE POLICY "Org members can view replies"
    ON social_replies FOR SELECT
    USING (conversation_id IN (
        SELECT c.id FROM social_conversations c
        JOIN social_listening_configs cfg ON c.config_id = cfg.id
        WHERE cfg.organization_id = ANY(auth.user_organizations())
    ));

CREATE POLICY "Members can manage replies"
    ON social_replies FOR ALL
    USING (conversation_id IN (
        SELECT c.id FROM social_conversations c
        JOIN social_listening_configs cfg ON c.config_id = cfg.id
        WHERE auth.has_org_role(cfg.organization_id, ARRAY['owner', 'admin', 'member'])
    ));

-- Metrics: Org members can view
CREATE POLICY "Org members can view listening metrics"
    ON social_listening_metrics FOR SELECT
    USING (config_id IN (
        SELECT id FROM social_listening_configs WHERE organization_id = ANY(auth.user_organizations())
    ));

-- ============================================
-- TRIGGERS
-- ============================================

CREATE TRIGGER update_social_listening_configs_updated_at
    BEFORE UPDATE ON social_listening_configs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_social_replies_updated_at
    BEFORE UPDATE ON social_replies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_social_listening_metrics_updated_at
    BEFORE UPDATE ON social_listening_metrics
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
