-- Media Library Enhancements Migration
-- Adds collections, tagging, usage tracking, and rich metadata for assets

-- ============================================================================
-- MEDIA COLLECTIONS (Folders/Categories)
-- ============================================================================
CREATE TABLE IF NOT EXISTS media_collections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,

    name TEXT NOT NULL,
    description TEXT,
    slug TEXT,

    -- Hierarchy
    parent_collection_id UUID REFERENCES media_collections(id) ON DELETE SET NULL,
    path TEXT[], -- Materialized path for efficient tree queries

    -- Settings
    is_shared BOOLEAN DEFAULT false,
    is_pinned BOOLEAN DEFAULT false,
    color TEXT,
    icon TEXT,

    -- Auto-organization rules
    auto_rules JSONB DEFAULT '{}',

    -- Counts (denormalized for performance)
    asset_count INTEGER DEFAULT 0,

    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_collections_org_slug ON media_collections(organization_id, slug) WHERE slug IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_collections_org ON media_collections(organization_id);
CREATE INDEX IF NOT EXISTS idx_collections_product ON media_collections(product_id) WHERE product_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_collections_parent ON media_collections(parent_collection_id);
CREATE INDEX IF NOT EXISTS idx_collections_path ON media_collections USING GIN (path);

-- ============================================================================
-- ASSET TAGS
-- ============================================================================
CREATE TABLE IF NOT EXISTS asset_tags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    description TEXT,
    color TEXT DEFAULT '#6B7280',

    -- Usage tracking
    usage_count INTEGER DEFAULT 0,

    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(organization_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_asset_tags_org ON asset_tags(organization_id);
CREATE INDEX IF NOT EXISTS idx_asset_tags_name ON asset_tags(organization_id, name);

-- ============================================================================
-- ASSET TAG MAPPINGS
-- ============================================================================
CREATE TABLE IF NOT EXISTS asset_tag_mappings (
    asset_id UUID NOT NULL REFERENCES content_assets(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES asset_tags(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (asset_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_asset_tag_mappings_asset ON asset_tag_mappings(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_tag_mappings_tag ON asset_tag_mappings(tag_id);

-- ============================================================================
-- ASSET METADATA (Rich file information)
-- ============================================================================
CREATE TABLE IF NOT EXISTS asset_metadata (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asset_id UUID NOT NULL UNIQUE REFERENCES content_assets(id) ON DELETE CASCADE,

    -- File metadata
    file_name TEXT,
    file_size_bytes BIGINT,
    mime_type TEXT,
    file_hash TEXT,
    file_extension TEXT,

    -- Image metadata
    image_width INTEGER,
    image_height INTEGER,
    image_alt_text TEXT,
    image_color_palette JSONB,
    image_format TEXT,
    image_has_transparency BOOLEAN,

    -- Video metadata
    video_duration_seconds NUMERIC,
    video_width INTEGER,
    video_height INTEGER,
    video_fps NUMERIC,
    video_codec TEXT,
    video_thumbnail_url TEXT,

    -- Audio metadata
    audio_duration_seconds NUMERIC,
    audio_bitrate INTEGER,
    audio_sample_rate INTEGER,
    audio_channels INTEGER,

    -- Document metadata
    document_page_count INTEGER,
    document_word_count INTEGER,
    document_extract TEXT,

    -- AI-generated metadata
    ai_description TEXT,
    ai_tags TEXT[],
    ai_analyzed_at TIMESTAMPTZ,

    -- EXIF/XMP data for images
    exif_data JSONB,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_asset_metadata_asset ON asset_metadata(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_metadata_mime ON asset_metadata(mime_type);
CREATE INDEX IF NOT EXISTS idx_asset_metadata_hash ON asset_metadata(file_hash) WHERE file_hash IS NOT NULL;

-- ============================================================================
-- ASSET USAGE TRACKING
-- ============================================================================
CREATE TABLE IF NOT EXISTS asset_usage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asset_id UUID NOT NULL REFERENCES content_assets(id) ON DELETE CASCADE,

    -- Where the asset is used
    used_in_task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
    used_in_campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
    used_in_asset_id UUID REFERENCES content_assets(id) ON DELETE SET NULL,

    usage_type TEXT NOT NULL CHECK (usage_type IN (
        'task_content', 'campaign_resource', 'email_attachment',
        'email_inline', 'social_media', 'blog_featured', 'blog_inline',
        'landing_page', 'reference', 'template_base', 'thumbnail'
    )),

    -- Context
    context_description TEXT,
    usage_url TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_asset_usage_asset ON asset_usage(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_usage_task ON asset_usage(used_in_task_id) WHERE used_in_task_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_asset_usage_campaign ON asset_usage(used_in_campaign_id) WHERE used_in_campaign_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_asset_usage_type ON asset_usage(usage_type);

-- ============================================================================
-- ASSET FAVORITES
-- ============================================================================
CREATE TABLE IF NOT EXISTS asset_favorites (
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    asset_id UUID NOT NULL REFERENCES content_assets(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, asset_id)
);

CREATE INDEX IF NOT EXISTS idx_asset_favorites_user ON asset_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_asset_favorites_asset ON asset_favorites(asset_id);

-- ============================================================================
-- MODIFY CONTENT_ASSETS TABLE
-- ============================================================================

-- Add collection_id column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'content_assets' AND column_name = 'collection_id'
    ) THEN
        ALTER TABLE content_assets ADD COLUMN collection_id UUID REFERENCES media_collections(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Add thumbnail_url column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'content_assets' AND column_name = 'thumbnail_url'
    ) THEN
        ALTER TABLE content_assets ADD COLUMN thumbnail_url TEXT;
    END IF;
END $$;

-- Add is_archived column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'content_assets' AND column_name = 'is_archived'
    ) THEN
        ALTER TABLE content_assets ADD COLUMN is_archived BOOLEAN DEFAULT false;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_assets_collection ON content_assets(collection_id) WHERE collection_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_assets_archived ON content_assets(product_id) WHERE is_archived = false;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE media_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_tag_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_favorites ENABLE ROW LEVEL SECURITY;

-- Media Collections
CREATE POLICY "Users can view collections in their org"
    ON media_collections FOR SELECT
    TO authenticated
    USING (
        organization_id IN (
            SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Members can manage collections"
    ON media_collections FOR ALL
    TO authenticated
    USING (
        organization_id IN (
            SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
        )
    );

-- Asset Tags
CREATE POLICY "Users can view tags in their org"
    ON asset_tags FOR SELECT
    TO authenticated
    USING (
        organization_id IN (
            SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Members can manage tags"
    ON asset_tags FOR ALL
    TO authenticated
    USING (
        organization_id IN (
            SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
        )
    );

-- Asset Tag Mappings
CREATE POLICY "Users can view tag mappings for accessible assets"
    ON asset_tag_mappings FOR SELECT
    TO authenticated
    USING (
        asset_id IN (
            SELECT ca.id FROM content_assets ca
            JOIN products p ON ca.product_id = p.id
            WHERE p.organization_id IN (
                SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
            )
        )
    );

CREATE POLICY "Members can manage tag mappings"
    ON asset_tag_mappings FOR ALL
    TO authenticated
    USING (
        asset_id IN (
            SELECT ca.id FROM content_assets ca
            JOIN products p ON ca.product_id = p.id
            WHERE p.organization_id IN (
                SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
            )
        )
    );

-- Asset Metadata
CREATE POLICY "Users can view metadata for accessible assets"
    ON asset_metadata FOR SELECT
    TO authenticated
    USING (
        asset_id IN (
            SELECT ca.id FROM content_assets ca
            JOIN products p ON ca.product_id = p.id
            WHERE p.organization_id IN (
                SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
            )
        )
    );

CREATE POLICY "Service role can manage metadata"
    ON asset_metadata FOR ALL
    TO service_role
    USING (true);

-- Asset Usage
CREATE POLICY "Users can view usage for accessible assets"
    ON asset_usage FOR SELECT
    TO authenticated
    USING (
        asset_id IN (
            SELECT ca.id FROM content_assets ca
            JOIN products p ON ca.product_id = p.id
            WHERE p.organization_id IN (
                SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
            )
        )
    );

CREATE POLICY "Service role can manage usage"
    ON asset_usage FOR ALL
    TO service_role
    USING (true);

-- Asset Favorites
CREATE POLICY "Users can view own favorites"
    ON asset_favorites FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "Users can manage own favorites"
    ON asset_favorites FOR ALL
    TO authenticated
    USING (user_id = auth.uid());

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to update collection asset count
CREATE OR REPLACE FUNCTION update_collection_asset_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' AND NEW.collection_id IS NOT NULL THEN
        UPDATE media_collections
        SET asset_count = asset_count + 1
        WHERE id = NEW.collection_id;
    ELSIF TG_OP = 'DELETE' AND OLD.collection_id IS NOT NULL THEN
        UPDATE media_collections
        SET asset_count = asset_count - 1
        WHERE id = OLD.collection_id;
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.collection_id IS DISTINCT FROM NEW.collection_id THEN
            IF OLD.collection_id IS NOT NULL THEN
                UPDATE media_collections
                SET asset_count = asset_count - 1
                WHERE id = OLD.collection_id;
            END IF;
            IF NEW.collection_id IS NOT NULL THEN
                UPDATE media_collections
                SET asset_count = asset_count + 1
                WHERE id = NEW.collection_id;
            END IF;
        END IF;
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_update_collection_asset_count ON content_assets;
CREATE TRIGGER trigger_update_collection_asset_count
    AFTER INSERT OR UPDATE OR DELETE ON content_assets
    FOR EACH ROW
    EXECUTE FUNCTION update_collection_asset_count();

-- Function to update tag usage count
CREATE OR REPLACE FUNCTION update_tag_usage_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE asset_tags
        SET usage_count = usage_count + 1
        WHERE id = NEW.tag_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE asset_tags
        SET usage_count = usage_count - 1
        WHERE id = OLD.tag_id;
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_update_tag_usage_count ON asset_tag_mappings;
CREATE TRIGGER trigger_update_tag_usage_count
    AFTER INSERT OR DELETE ON asset_tag_mappings
    FOR EACH ROW
    EXECUTE FUNCTION update_tag_usage_count();

-- Function to generate collection slug
CREATE OR REPLACE FUNCTION generate_collection_slug()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.slug IS NULL OR NEW.slug = '' THEN
        NEW.slug := LOWER(REGEXP_REPLACE(NEW.name, '[^a-zA-Z0-9]+', '-', 'g'));
        NEW.slug := TRIM(BOTH '-' FROM NEW.slug);
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_generate_collection_slug ON media_collections;
CREATE TRIGGER trigger_generate_collection_slug
    BEFORE INSERT OR UPDATE ON media_collections
    FOR EACH ROW
    EXECUTE FUNCTION generate_collection_slug();

-- Function to update collection path
CREATE OR REPLACE FUNCTION update_collection_path()
RETURNS TRIGGER AS $$
DECLARE
    parent_path TEXT[];
BEGIN
    IF NEW.parent_collection_id IS NULL THEN
        NEW.path := ARRAY[NEW.id::TEXT];
    ELSE
        SELECT path INTO parent_path
        FROM media_collections
        WHERE id = NEW.parent_collection_id;

        NEW.path := parent_path || ARRAY[NEW.id::TEXT];
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_collection_path ON media_collections;
CREATE TRIGGER trigger_update_collection_path
    BEFORE INSERT OR UPDATE OF parent_collection_id ON media_collections
    FOR EACH ROW
    EXECUTE FUNCTION update_collection_path();

-- Function to get asset with full metadata
CREATE OR REPLACE FUNCTION get_asset_with_metadata(p_asset_id UUID)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'asset', row_to_json(ca.*),
        'metadata', row_to_json(am.*),
        'tags', (
            SELECT COALESCE(jsonb_agg(jsonb_build_object(
                'id', t.id,
                'name', t.name,
                'color', t.color
            )), '[]'::jsonb)
            FROM asset_tag_mappings atm
            JOIN asset_tags t ON atm.tag_id = t.id
            WHERE atm.asset_id = p_asset_id
        ),
        'usage_count', (
            SELECT COUNT(*) FROM asset_usage WHERE asset_id = p_asset_id
        ),
        'collection', (
            SELECT row_to_json(mc.*)
            FROM media_collections mc
            WHERE mc.id = ca.collection_id
        )
    )
    INTO result
    FROM content_assets ca
    LEFT JOIN asset_metadata am ON ca.id = am.asset_id
    WHERE ca.id = p_asset_id;

    RETURN result;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE media_collections IS 'Hierarchical folders for organizing content assets';
COMMENT ON TABLE asset_tags IS 'Tags for categorizing and filtering assets';
COMMENT ON TABLE asset_tag_mappings IS 'Many-to-many relationship between assets and tags';
COMMENT ON TABLE asset_metadata IS 'Rich file metadata including dimensions, duration, and AI analysis';
COMMENT ON TABLE asset_usage IS 'Tracks where assets are used across the platform';
COMMENT ON TABLE asset_favorites IS 'User-specific asset favorites for quick access';
