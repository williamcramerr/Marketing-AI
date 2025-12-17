-- Growth Engine: SEO Content Engine
-- Keyword research, content briefs, and rank tracking with SerpApi

-- ============================================
-- KEYWORD RESEARCH
-- ============================================

CREATE TABLE keyword_research (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,

    -- Keyword data
    keyword TEXT NOT NULL,
    search_volume INTEGER,
    keyword_difficulty INTEGER CHECK (keyword_difficulty BETWEEN 0 AND 100),
    cpc_cents INTEGER,
    competition_level TEXT CHECK (competition_level IN ('low', 'medium', 'high')),

    -- Intent classification
    intent TEXT CHECK (intent IN (
        'informational', 'navigational', 'commercial', 'transactional'
    )),
    intent_score INTEGER CHECK (intent_score BETWEEN 0 AND 100),

    -- Source and analysis
    source TEXT NOT NULL CHECK (source IN ('serpapi', 'manual', 'ai_suggested', 'import')),
    source_data JSONB DEFAULT '{}',
    -- { query_date, raw_response, confidence }

    -- Related keywords
    related_keywords TEXT[] DEFAULT '{}',
    parent_keyword_id UUID REFERENCES keyword_research(id),

    -- SERP features
    serp_features TEXT[] DEFAULT '{}', -- ['featured_snippet', 'people_also_ask', 'local_pack']

    -- Status and prioritization
    status TEXT DEFAULT 'discovered' CHECK (status IN (
        'discovered', 'analyzing', 'selected', 'brief_created', 'content_created', 'published', 'archived'
    )),
    priority INTEGER DEFAULT 50 CHECK (priority BETWEEN 0 AND 100),
    priority_factors JSONB DEFAULT '{}',
    -- { volume_score, difficulty_score, intent_score, business_relevance }

    -- Assignment
    assigned_to UUID REFERENCES auth.users(id),
    assigned_at TIMESTAMPTZ,

    -- Tags and organization
    tags TEXT[] DEFAULT '{}',
    topic_cluster TEXT,

    last_updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(organization_id, keyword)
);

CREATE INDEX idx_keyword_research_org ON keyword_research(organization_id);
CREATE INDEX idx_keyword_research_product ON keyword_research(product_id);
CREATE INDEX idx_keyword_research_status ON keyword_research(status);
CREATE INDEX idx_keyword_research_priority ON keyword_research(priority DESC);
CREATE INDEX idx_keyword_research_volume ON keyword_research(search_volume DESC);
CREATE INDEX idx_keyword_research_difficulty ON keyword_research(keyword_difficulty);
CREATE INDEX idx_keyword_research_intent ON keyword_research(intent);
CREATE INDEX idx_keyword_research_cluster ON keyword_research(topic_cluster);
CREATE INDEX idx_keyword_research_selected ON keyword_research(organization_id, status)
    WHERE status = 'selected';

-- ============================================
-- SERP ANALYSIS (Top results analysis)
-- ============================================

CREATE TABLE serp_analysis (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    keyword_id UUID REFERENCES keyword_research(id) ON DELETE CASCADE NOT NULL,

    -- Analysis metadata
    analyzed_at TIMESTAMPTZ DEFAULT NOW(),
    search_location TEXT DEFAULT 'United States',
    search_device TEXT DEFAULT 'desktop',

    -- Top results
    top_results JSONB NOT NULL,
    -- [{ position, url, title, description, domain, word_count, headings, content_type }]

    -- Aggregated insights
    avg_word_count INTEGER,
    avg_heading_count INTEGER,
    common_topics TEXT[],
    common_questions TEXT[],
    content_gaps TEXT[],

    -- Featured snippets
    featured_snippet JSONB,
    -- { type, content, source_url }

    -- People Also Ask
    people_also_ask JSONB DEFAULT '[]',
    -- [{ question, snippet, url }]

    -- Related searches
    related_searches TEXT[] DEFAULT '{}',

    -- AI analysis
    ai_insights JSONB DEFAULT '{}',
    -- { content_recommendations, unique_angles, estimated_difficulty }

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_serp_analysis_keyword ON serp_analysis(keyword_id);
CREATE INDEX idx_serp_analysis_date ON serp_analysis(analyzed_at DESC);

-- ============================================
-- CONTENT BRIEFS
-- ============================================

CREATE TABLE seo_content_briefs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
    product_id UUID REFERENCES products(id),
    keyword_id UUID REFERENCES keyword_research(id),

    -- Basic info
    title TEXT NOT NULL,
    slug TEXT,
    content_type TEXT DEFAULT 'blog_post' CHECK (content_type IN (
        'blog_post', 'landing_page', 'pillar_page', 'comparison', 'how_to', 'listicle', 'guide'
    )),

    -- Target keywords
    target_keyword TEXT NOT NULL,
    secondary_keywords TEXT[] DEFAULT '{}',
    lsi_keywords TEXT[] DEFAULT '{}',

    -- Content specifications
    suggested_word_count INTEGER,
    suggested_reading_time INTEGER, -- minutes
    target_audience TEXT,
    content_goal TEXT,

    -- Structure
    suggested_title TEXT,
    suggested_headings JSONB DEFAULT '[]',
    -- [{ level: "h2", text: "...", subsections: [{ level: "h3", text: "..." }] }]
    outline JSONB DEFAULT '[]',
    -- [{ heading, key_points: [], word_count_target }]

    -- SEO elements
    meta_title_suggestion TEXT,
    meta_description_suggestion TEXT,
    url_slug_suggestion TEXT,

    -- Content guidance
    questions_to_answer TEXT[] DEFAULT '{}',
    points_to_cover TEXT[] DEFAULT '{}',
    examples_to_include TEXT[] DEFAULT '{}',
    internal_links_suggested TEXT[] DEFAULT '{}',
    external_sources TEXT[] DEFAULT '{}',

    -- Competitive analysis
    serp_analysis_id UUID REFERENCES serp_analysis(id),
    competitor_gaps TEXT[] DEFAULT '{}',
    unique_angle TEXT,

    -- AI generation
    ai_generated BOOLEAN DEFAULT false,
    generation_params JSONB DEFAULT '{}',

    -- Status and workflow
    status TEXT DEFAULT 'draft' CHECK (status IN (
        'draft', 'review', 'approved', 'generating', 'content_created', 'published'
    )),
    approved_at TIMESTAMPTZ,
    approved_by UUID REFERENCES auth.users(id),

    -- Assignment
    assigned_to UUID REFERENCES auth.users(id),
    due_date DATE,

    -- Linked content
    content_asset_id UUID, -- Will reference content_assets table

    notes TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_seo_briefs_org ON seo_content_briefs(organization_id);
CREATE INDEX idx_seo_briefs_product ON seo_content_briefs(product_id);
CREATE INDEX idx_seo_briefs_keyword ON seo_content_briefs(keyword_id);
CREATE INDEX idx_seo_briefs_status ON seo_content_briefs(status);
CREATE INDEX idx_seo_briefs_assigned ON seo_content_briefs(assigned_to);
CREATE INDEX idx_seo_briefs_approved ON seo_content_briefs(organization_id, status)
    WHERE status = 'approved';

-- ============================================
-- RANK TRACKING
-- ============================================

CREATE TABLE seo_rankings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
    keyword_id UUID REFERENCES keyword_research(id),
    content_brief_id UUID REFERENCES seo_content_briefs(id),

    -- What we're tracking
    tracked_url TEXT NOT NULL,
    tracked_keyword TEXT NOT NULL,

    -- Current position
    current_position INTEGER, -- 1-100, NULL if not ranking
    previous_position INTEGER,
    position_change INTEGER, -- Positive = improved, negative = dropped

    -- Best performance
    best_position INTEGER,
    best_position_date DATE,

    -- Position history (last 90 days)
    position_history JSONB DEFAULT '[]',
    -- [{ date, position, url }]

    -- SERP features
    has_featured_snippet BOOLEAN DEFAULT false,
    has_knowledge_panel BOOLEAN DEFAULT false,
    has_local_pack BOOLEAN DEFAULT false,

    -- Competitor tracking
    competitor_positions JSONB DEFAULT '{}',
    -- { "competitor.com": 3, "other.com": 5 }

    -- Settings
    check_frequency TEXT DEFAULT 'daily' CHECK (check_frequency IN ('daily', 'weekly')),
    search_location TEXT DEFAULT 'United States',
    search_device TEXT DEFAULT 'desktop',

    active BOOLEAN DEFAULT true,
    last_checked_at TIMESTAMPTZ,
    next_check_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_seo_rankings_org ON seo_rankings(organization_id);
CREATE INDEX idx_seo_rankings_keyword ON seo_rankings(keyword_id);
CREATE INDEX idx_seo_rankings_brief ON seo_rankings(content_brief_id);
CREATE INDEX idx_seo_rankings_position ON seo_rankings(current_position);
CREATE INDEX idx_seo_rankings_active ON seo_rankings(organization_id) WHERE active = true;
CREATE INDEX idx_seo_rankings_next_check ON seo_rankings(next_check_at) WHERE active = true;

-- ============================================
-- SEO METRICS (Daily aggregates)
-- ============================================

CREATE TABLE seo_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
    date DATE NOT NULL,

    -- Keyword stats
    total_keywords INTEGER DEFAULT 0,
    keywords_ranking_top_3 INTEGER DEFAULT 0,
    keywords_ranking_top_10 INTEGER DEFAULT 0,
    keywords_ranking_top_100 INTEGER DEFAULT 0,
    keywords_not_ranking INTEGER DEFAULT 0,

    -- Position changes
    positions_improved INTEGER DEFAULT 0,
    positions_declined INTEGER DEFAULT 0,
    positions_unchanged INTEGER DEFAULT 0,
    avg_position_change NUMERIC(5, 2),

    -- Content stats
    briefs_created INTEGER DEFAULT 0,
    content_published INTEGER DEFAULT 0,

    -- Estimated traffic
    estimated_organic_traffic INTEGER,
    estimated_traffic_value_cents INTEGER,

    -- Top movers
    top_gainers JSONB DEFAULT '[]',
    -- [{ keyword, old_position, new_position, change }]
    top_losers JSONB DEFAULT '[]',

    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(organization_id, date)
);

CREATE INDEX idx_seo_metrics_org ON seo_metrics(organization_id);
CREATE INDEX idx_seo_metrics_date ON seo_metrics(date DESC);

-- ============================================
-- TOPIC CLUSTERS
-- ============================================

CREATE TABLE topic_clusters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
    product_id UUID REFERENCES products(id),

    name TEXT NOT NULL,
    description TEXT,

    -- Pillar content
    pillar_keyword_id UUID REFERENCES keyword_research(id),
    pillar_content_url TEXT,
    pillar_brief_id UUID REFERENCES seo_content_briefs(id),

    -- Cluster stats
    total_keywords INTEGER DEFAULT 0,
    total_content_pieces INTEGER DEFAULT 0,
    avg_ranking_position NUMERIC(5, 2),

    -- Internal linking
    linking_strategy JSONB DEFAULT '{}',
    -- { hub_and_spoke: true, cross_links: [...] }

    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_topic_clusters_org ON topic_clusters(organization_id);
CREATE INDEX idx_topic_clusters_product ON topic_clusters(product_id);

-- ============================================
-- RLS POLICIES
-- ============================================

ALTER TABLE keyword_research ENABLE ROW LEVEL SECURITY;
ALTER TABLE serp_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE seo_content_briefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE seo_rankings ENABLE ROW LEVEL SECURITY;
ALTER TABLE seo_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE topic_clusters ENABLE ROW LEVEL SECURITY;

-- Keyword Research
CREATE POLICY "Org members can view keyword research"
    ON keyword_research FOR SELECT
    USING (organization_id = ANY(auth.user_organizations()));

CREATE POLICY "Members can manage keyword research"
    ON keyword_research FOR ALL
    USING (auth.has_org_role(organization_id, ARRAY['owner', 'admin', 'member']));

-- SERP Analysis
CREATE POLICY "Org members can view serp analysis"
    ON serp_analysis FOR SELECT
    USING (keyword_id IN (
        SELECT id FROM keyword_research WHERE organization_id = ANY(auth.user_organizations())
    ));

-- Content Briefs
CREATE POLICY "Org members can view content briefs"
    ON seo_content_briefs FOR SELECT
    USING (organization_id = ANY(auth.user_organizations()));

CREATE POLICY "Members can manage content briefs"
    ON seo_content_briefs FOR ALL
    USING (auth.has_org_role(organization_id, ARRAY['owner', 'admin', 'member']));

-- Rankings
CREATE POLICY "Org members can view rankings"
    ON seo_rankings FOR SELECT
    USING (organization_id = ANY(auth.user_organizations()));

CREATE POLICY "Members can manage rankings"
    ON seo_rankings FOR ALL
    USING (auth.has_org_role(organization_id, ARRAY['owner', 'admin', 'member']));

-- SEO Metrics
CREATE POLICY "Org members can view seo metrics"
    ON seo_metrics FOR SELECT
    USING (organization_id = ANY(auth.user_organizations()));

-- Topic Clusters
CREATE POLICY "Org members can view topic clusters"
    ON topic_clusters FOR SELECT
    USING (organization_id = ANY(auth.user_organizations()));

CREATE POLICY "Members can manage topic clusters"
    ON topic_clusters FOR ALL
    USING (auth.has_org_role(organization_id, ARRAY['owner', 'admin', 'member']));

-- ============================================
-- TRIGGERS
-- ============================================

CREATE TRIGGER update_keyword_research_updated_at
    BEFORE UPDATE ON keyword_research
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_seo_content_briefs_updated_at
    BEFORE UPDATE ON seo_content_briefs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_seo_rankings_updated_at
    BEFORE UPDATE ON seo_rankings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_topic_clusters_updated_at
    BEFORE UPDATE ON topic_clusters
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
