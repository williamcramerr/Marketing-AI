-- Search Optimization Migration
-- Adds full-text search with pg_trgm and optimized composite indexes

-- ============================================================================
-- ENABLE EXTENSIONS
-- ============================================================================

-- Enable pg_trgm for fuzzy/substring matching
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Enable unaccent for accent-insensitive search
CREATE EXTENSION IF NOT EXISTS unaccent;

-- ============================================================================
-- SEARCH CONFIGURATION
-- ============================================================================

-- Create custom text search configuration
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_ts_config WHERE cfgname = 'marketing_english'
    ) THEN
        CREATE TEXT SEARCH CONFIGURATION marketing_english (COPY = english);
    END IF;
END $$;

-- ============================================================================
-- CONTENT ASSETS SEARCH
-- ============================================================================

-- Add search vector column
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'content_assets' AND column_name = 'search_vector'
    ) THEN
        ALTER TABLE content_assets ADD COLUMN search_vector tsvector;
    END IF;
END $$;

-- Create function to update search vector
CREATE OR REPLACE FUNCTION update_content_assets_search_vector()
RETURNS TRIGGER AS $$
BEGIN
    NEW.search_vector :=
        setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(NEW.content, '')), 'B') ||
        setweight(to_tsvector('english', COALESCE(NEW.metadata::text, '')), 'C');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_content_assets_search_vector ON content_assets;
CREATE TRIGGER trigger_content_assets_search_vector
    BEFORE INSERT OR UPDATE OF title, content, metadata ON content_assets
    FOR EACH ROW
    EXECUTE FUNCTION update_content_assets_search_vector();

-- Backfill existing records
UPDATE content_assets SET search_vector =
    setweight(to_tsvector('english', COALESCE(title, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(content, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(metadata::text, '')), 'C')
WHERE search_vector IS NULL;

-- Create GIN index for full-text search
CREATE INDEX IF NOT EXISTS idx_content_assets_search ON content_assets USING GIN (search_vector);

-- Create trigram index for fuzzy title matching
CREATE INDEX IF NOT EXISTS idx_content_assets_title_trgm ON content_assets USING GIN (title gin_trgm_ops);

-- ============================================================================
-- TASKS SEARCH
-- ============================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'tasks' AND column_name = 'search_vector'
    ) THEN
        ALTER TABLE tasks ADD COLUMN search_vector tsvector;
    END IF;
END $$;

CREATE OR REPLACE FUNCTION update_tasks_search_vector()
RETURNS TRIGGER AS $$
BEGIN
    NEW.search_vector :=
        setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'B') ||
        setweight(to_tsvector('english', COALESCE(NEW.draft_content, '')), 'C');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_tasks_search_vector ON tasks;
CREATE TRIGGER trigger_tasks_search_vector
    BEFORE INSERT OR UPDATE OF title, description, draft_content ON tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_tasks_search_vector();

UPDATE tasks SET search_vector =
    setweight(to_tsvector('english', COALESCE(title, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(description, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(draft_content, '')), 'C')
WHERE search_vector IS NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_search ON tasks USING GIN (search_vector);
CREATE INDEX IF NOT EXISTS idx_tasks_title_trgm ON tasks USING GIN (title gin_trgm_ops);

-- ============================================================================
-- CAMPAIGNS SEARCH
-- ============================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'campaigns' AND column_name = 'search_vector'
    ) THEN
        ALTER TABLE campaigns ADD COLUMN search_vector tsvector;
    END IF;
END $$;

CREATE OR REPLACE FUNCTION update_campaigns_search_vector()
RETURNS TRIGGER AS $$
BEGIN
    NEW.search_vector :=
        setweight(to_tsvector('english', COALESCE(NEW.name, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'B') ||
        setweight(to_tsvector('english', COALESCE(NEW.goal, '')), 'C');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_campaigns_search_vector ON campaigns;
CREATE TRIGGER trigger_campaigns_search_vector
    BEFORE INSERT OR UPDATE OF name, description, goal ON campaigns
    FOR EACH ROW
    EXECUTE FUNCTION update_campaigns_search_vector();

UPDATE campaigns SET search_vector =
    setweight(to_tsvector('english', COALESCE(name, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(description, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(goal, '')), 'C')
WHERE search_vector IS NULL;

CREATE INDEX IF NOT EXISTS idx_campaigns_search ON campaigns USING GIN (search_vector);
CREATE INDEX IF NOT EXISTS idx_campaigns_name_trgm ON campaigns USING GIN (name gin_trgm_ops);

-- ============================================================================
-- PRODUCTS SEARCH
-- ============================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'products' AND column_name = 'search_vector'
    ) THEN
        ALTER TABLE products ADD COLUMN search_vector tsvector;
    END IF;
END $$;

CREATE OR REPLACE FUNCTION update_products_search_vector()
RETURNS TRIGGER AS $$
BEGIN
    NEW.search_vector :=
        setweight(to_tsvector('english', COALESCE(NEW.name, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'B') ||
        setweight(to_tsvector('english', COALESCE(NEW.tagline, '')), 'B');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_products_search_vector ON products;
CREATE TRIGGER trigger_products_search_vector
    BEFORE INSERT OR UPDATE OF name, description, tagline ON products
    FOR EACH ROW
    EXECUTE FUNCTION update_products_search_vector();

UPDATE products SET search_vector =
    setweight(to_tsvector('english', COALESCE(name, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(description, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(tagline, '')), 'B')
WHERE search_vector IS NULL;

CREATE INDEX IF NOT EXISTS idx_products_search ON products USING GIN (search_vector);
CREATE INDEX IF NOT EXISTS idx_products_name_trgm ON products USING GIN (name gin_trgm_ops);

-- ============================================================================
-- SOCIAL CONVERSATIONS SEARCH
-- ============================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'social_conversations' AND column_name = 'search_vector'
    ) THEN
        ALTER TABLE social_conversations ADD COLUMN search_vector tsvector;
    END IF;
END $$;

CREATE OR REPLACE FUNCTION update_social_conversations_search_vector()
RETURNS TRIGGER AS $$
BEGIN
    NEW.search_vector :=
        setweight(to_tsvector('english', COALESCE(NEW.content, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(NEW.author_username, '')), 'B') ||
        setweight(to_tsvector('english', COALESCE(NEW.author_display_name, '')), 'B');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_social_conversations_search_vector ON social_conversations;
CREATE TRIGGER trigger_social_conversations_search_vector
    BEFORE INSERT OR UPDATE OF content, author_username, author_display_name ON social_conversations
    FOR EACH ROW
    EXECUTE FUNCTION update_social_conversations_search_vector();

UPDATE social_conversations SET search_vector =
    setweight(to_tsvector('english', COALESCE(content, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(author_username, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(author_display_name, '')), 'B')
WHERE search_vector IS NULL;

CREATE INDEX IF NOT EXISTS idx_social_conversations_search ON social_conversations USING GIN (search_vector);
CREATE INDEX IF NOT EXISTS idx_social_conversations_content_trgm ON social_conversations USING GIN (content gin_trgm_ops);

-- ============================================================================
-- LEADS SEARCH
-- ============================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'leads' AND column_name = 'search_vector'
    ) THEN
        ALTER TABLE leads ADD COLUMN search_vector tsvector;
    END IF;
END $$;

CREATE OR REPLACE FUNCTION update_leads_search_vector()
RETURNS TRIGGER AS $$
BEGIN
    NEW.search_vector :=
        setweight(to_tsvector('english', COALESCE(NEW.email, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(NEW.first_name, '')), 'B') ||
        setweight(to_tsvector('english', COALESCE(NEW.last_name, '')), 'B') ||
        setweight(to_tsvector('english', COALESCE(NEW.company, '')), 'B');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_leads_search_vector ON leads;
CREATE TRIGGER trigger_leads_search_vector
    BEFORE INSERT OR UPDATE OF email, first_name, last_name, company ON leads
    FOR EACH ROW
    EXECUTE FUNCTION update_leads_search_vector();

UPDATE leads SET search_vector =
    setweight(to_tsvector('english', COALESCE(email, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(first_name, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(last_name, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(company, '')), 'B')
WHERE search_vector IS NULL;

CREATE INDEX IF NOT EXISTS idx_leads_search ON leads USING GIN (search_vector);
CREATE INDEX IF NOT EXISTS idx_leads_email_trgm ON leads USING GIN (email gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_leads_company_trgm ON leads USING GIN (company gin_trgm_ops);

-- ============================================================================
-- PARTNERSHIP OPPORTUNITIES SEARCH
-- ============================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'partnership_opportunities' AND column_name = 'search_vector'
    ) THEN
        ALTER TABLE partnership_opportunities ADD COLUMN search_vector tsvector;
    END IF;
END $$;

CREATE OR REPLACE FUNCTION update_partnerships_search_vector()
RETURNS TRIGGER AS $$
BEGIN
    NEW.search_vector :=
        setweight(to_tsvector('english', COALESCE(NEW.company_name, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(NEW.company_description, '')), 'B') ||
        setweight(to_tsvector('english', COALESCE(NEW.contact_name, '')), 'B');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_partnerships_search_vector ON partnership_opportunities;
CREATE TRIGGER trigger_partnerships_search_vector
    BEFORE INSERT OR UPDATE OF company_name, company_description, contact_name ON partnership_opportunities
    FOR EACH ROW
    EXECUTE FUNCTION update_partnerships_search_vector();

UPDATE partnership_opportunities SET search_vector =
    setweight(to_tsvector('english', COALESCE(company_name, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(company_description, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(contact_name, '')), 'B')
WHERE search_vector IS NULL;

CREATE INDEX IF NOT EXISTS idx_partnerships_search ON partnership_opportunities USING GIN (search_vector);
CREATE INDEX IF NOT EXISTS idx_partnerships_company_trgm ON partnership_opportunities USING GIN (company_name gin_trgm_ops);

-- ============================================================================
-- COMPOSITE INDEXES FOR COMMON QUERIES
-- ============================================================================

-- Tasks: Filter by campaign, status, and order by date
CREATE INDEX IF NOT EXISTS idx_tasks_campaign_status_created
    ON tasks(campaign_id, status, created_at DESC);

-- Tasks: Filter by status for dashboard counts
CREATE INDEX IF NOT EXISTS idx_tasks_status_created
    ON tasks(status, created_at DESC);

-- Campaigns: Filter by product and status
CREATE INDEX IF NOT EXISTS idx_campaigns_product_status
    ON campaigns(product_id, status);

-- Campaigns: Active campaigns for product
CREATE INDEX IF NOT EXISTS idx_campaigns_active
    ON campaigns(product_id, status)
    WHERE status IN ('active', 'planned');

-- Content assets: Filter by product, type, and published status
CREATE INDEX IF NOT EXISTS idx_content_assets_product_type_published
    ON content_assets(product_id, type, published);

-- Content assets: Published assets only
CREATE INDEX IF NOT EXISTS idx_content_assets_published
    ON content_assets(product_id, published_at DESC)
    WHERE published = true;

-- Approvals: Pending approvals for user
CREATE INDEX IF NOT EXISTS idx_approvals_pending_created
    ON approvals(status, created_at DESC)
    WHERE status = 'pending';

-- Social conversations: By config and status
CREATE INDEX IF NOT EXISTS idx_social_conversations_config_status
    ON social_conversations(config_id, status, discovered_at DESC);

-- Social conversations: High intent only
CREATE INDEX IF NOT EXISTS idx_social_conversations_high_intent
    ON social_conversations(config_id, discovered_at DESC)
    WHERE intent_score = 'high';

-- Leads: By organization and status
CREATE INDEX IF NOT EXISTS idx_leads_org_status
    ON leads(organization_id, nurture_status);

-- Leads: High score leads
CREATE INDEX IF NOT EXISTS idx_leads_high_score
    ON leads(organization_id, score DESC)
    WHERE score >= 80;

-- Metrics: By task and date
CREATE INDEX IF NOT EXISTS idx_metrics_task_date
    ON metrics(task_id, recorded_at DESC)
    WHERE task_id IS NOT NULL;

-- Metrics: By campaign and date
CREATE INDEX IF NOT EXISTS idx_metrics_campaign_date
    ON metrics(campaign_id, recorded_at DESC)
    WHERE campaign_id IS NOT NULL;

-- ============================================================================
-- UNIFIED SEARCH FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION global_search(
    p_query TEXT,
    p_organization_id UUID,
    p_types TEXT[] DEFAULT ARRAY['campaigns', 'tasks', 'content', 'leads'],
    p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
    result_type TEXT,
    id UUID,
    title TEXT,
    description TEXT,
    status TEXT,
    url TEXT,
    rank REAL,
    metadata JSONB
) AS $$
DECLARE
    search_query tsquery;
BEGIN
    -- Parse the search query
    search_query := plainto_tsquery('english', p_query);

    RETURN QUERY

    -- Search campaigns
    SELECT
        'campaign'::TEXT as result_type,
        c.id,
        c.name as title,
        c.description,
        c.status::TEXT,
        '/dashboard/campaigns/' || c.id as url,
        ts_rank(c.search_vector, search_query) as rank,
        jsonb_build_object(
            'product_id', c.product_id,
            'start_date', c.start_date,
            'end_date', c.end_date
        ) as metadata
    FROM campaigns c
    JOIN products p ON c.product_id = p.id
    WHERE 'campaigns' = ANY(p_types)
    AND p.organization_id = p_organization_id
    AND (
        c.search_vector @@ search_query
        OR c.name ILIKE '%' || p_query || '%'
    )

    UNION ALL

    -- Search tasks
    SELECT
        'task'::TEXT as result_type,
        t.id,
        t.title,
        t.description,
        t.status::TEXT,
        '/dashboard/tasks/' || t.id as url,
        ts_rank(t.search_vector, search_query) as rank,
        jsonb_build_object(
            'type', t.type,
            'campaign_id', t.campaign_id
        ) as metadata
    FROM tasks t
    JOIN campaigns c ON t.campaign_id = c.id
    JOIN products p ON c.product_id = p.id
    WHERE 'tasks' = ANY(p_types)
    AND p.organization_id = p_organization_id
    AND (
        t.search_vector @@ search_query
        OR t.title ILIKE '%' || p_query || '%'
    )

    UNION ALL

    -- Search content assets
    SELECT
        'content'::TEXT as result_type,
        ca.id,
        ca.title,
        LEFT(ca.content, 200) as description,
        CASE WHEN ca.published THEN 'published' ELSE 'draft' END as status,
        '/dashboard/content/' || ca.id as url,
        ts_rank(ca.search_vector, search_query) as rank,
        jsonb_build_object(
            'type', ca.type,
            'product_id', ca.product_id
        ) as metadata
    FROM content_assets ca
    JOIN products p ON ca.product_id = p.id
    WHERE 'content' = ANY(p_types)
    AND p.organization_id = p_organization_id
    AND (
        ca.search_vector @@ search_query
        OR ca.title ILIKE '%' || p_query || '%'
    )

    UNION ALL

    -- Search leads
    SELECT
        'lead'::TEXT as result_type,
        l.id,
        COALESCE(l.first_name || ' ' || l.last_name, l.email) as title,
        l.company as description,
        l.nurture_status::TEXT as status,
        '/dashboard/growth/leads/' || l.id as url,
        ts_rank(l.search_vector, search_query) as rank,
        jsonb_build_object(
            'email', l.email,
            'score', l.score
        ) as metadata
    FROM leads l
    WHERE 'leads' = ANY(p_types)
    AND l.organization_id = p_organization_id
    AND (
        l.search_vector @@ search_query
        OR l.email ILIKE '%' || p_query || '%'
        OR l.company ILIKE '%' || p_query || '%'
    )

    ORDER BY rank DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ============================================================================
-- SEARCH SUGGESTIONS FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION search_suggestions(
    p_query TEXT,
    p_organization_id UUID,
    p_limit INTEGER DEFAULT 5
)
RETURNS TABLE (
    suggestion TEXT,
    source_type TEXT,
    count BIGINT
) AS $$
BEGIN
    RETURN QUERY

    -- Campaign names
    SELECT DISTINCT
        c.name as suggestion,
        'campaign'::TEXT as source_type,
        COUNT(*) OVER (PARTITION BY c.name) as count
    FROM campaigns c
    JOIN products p ON c.product_id = p.id
    WHERE p.organization_id = p_organization_id
    AND c.name ILIKE '%' || p_query || '%'

    UNION ALL

    -- Product names
    SELECT DISTINCT
        p.name as suggestion,
        'product'::TEXT as source_type,
        COUNT(*) OVER (PARTITION BY p.name) as count
    FROM products p
    WHERE p.organization_id = p_organization_id
    AND p.name ILIKE '%' || p_query || '%'

    UNION ALL

    -- Content asset titles
    SELECT DISTINCT
        ca.title as suggestion,
        'content'::TEXT as source_type,
        COUNT(*) OVER (PARTITION BY ca.title) as count
    FROM content_assets ca
    JOIN products p ON ca.product_id = p.id
    WHERE p.organization_id = p_organization_id
    AND ca.title ILIKE '%' || p_query || '%'

    ORDER BY count DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON FUNCTION global_search IS 'Unified search across campaigns, tasks, content, and leads';
COMMENT ON FUNCTION search_suggestions IS 'Returns autocomplete suggestions based on partial query';
