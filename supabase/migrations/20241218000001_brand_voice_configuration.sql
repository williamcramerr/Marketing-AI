-- Brand Voice Configuration Migration
-- Enables AI content generation to follow brand-specific tone and style guidelines

-- ============================================================================
-- BRAND VOICE PROFILES
-- ============================================================================
CREATE TABLE IF NOT EXISTS brand_voice_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    name TEXT NOT NULL,
    description TEXT,
    is_default BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,

    -- Voice characteristics
    tone JSONB NOT NULL DEFAULT '{
        "personality": ["professional"],
        "formality": "semi-formal",
        "humor": "minimal",
        "confidence_level": "high",
        "empathy_level": "medium"
    }',

    -- Writing style guidelines
    writing_style JSONB NOT NULL DEFAULT '{
        "sentence_length": "medium",
        "paragraph_length": "medium",
        "vocabulary_level": "intermediate",
        "use_contractions": true,
        "use_active_voice": true,
        "avoid_jargon": false,
        "use_oxford_comma": true,
        "preferred_terms": {},
        "prohibited_terms": []
    }',

    -- Visual brand elements (for reference)
    visual_brand JSONB DEFAULT '{
        "primary_color": null,
        "secondary_colors": [],
        "brand_fonts": [],
        "logo_url": null,
        "imagery_style": null
    }',

    -- Example content for AI training
    example_content JSONB DEFAULT '[]',

    -- AI prompt additions (custom instructions)
    custom_instructions TEXT,

    -- Version tracking
    version INTEGER DEFAULT 1,

    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_brand_voice_product ON brand_voice_profiles(product_id);
CREATE INDEX IF NOT EXISTS idx_brand_voice_org ON brand_voice_profiles(organization_id);
CREATE INDEX IF NOT EXISTS idx_brand_voice_active ON brand_voice_profiles(product_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_brand_voice_default ON brand_voice_profiles(product_id) WHERE is_default = true;

-- ============================================================================
-- BRAND VOICE HISTORY (Version Control)
-- ============================================================================
CREATE TABLE IF NOT EXISTS brand_voice_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    brand_voice_id UUID NOT NULL REFERENCES brand_voice_profiles(id) ON DELETE CASCADE,

    version INTEGER NOT NULL,
    tone JSONB,
    writing_style JSONB,
    visual_brand JSONB,
    example_content JSONB,
    custom_instructions TEXT,

    changed_by UUID REFERENCES auth.users(id),
    change_description TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(brand_voice_id, version)
);

CREATE INDEX IF NOT EXISTS idx_brand_voice_history_profile ON brand_voice_history(brand_voice_id);
CREATE INDEX IF NOT EXISTS idx_brand_voice_history_version ON brand_voice_history(brand_voice_id, version DESC);

-- ============================================================================
-- BRAND GUIDELINES (DOs and DON'Ts)
-- ============================================================================
CREATE TABLE IF NOT EXISTS brand_guidelines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    brand_voice_id UUID NOT NULL REFERENCES brand_voice_profiles(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    category TEXT NOT NULL CHECK (category IN (
        'tone', 'messaging', 'terminology', 'visual', 'seo', 'compliance', 'social', 'email'
    )),

    guideline_type TEXT NOT NULL CHECK (guideline_type IN ('do', 'dont', 'note', 'example')),

    title TEXT NOT NULL,
    description TEXT NOT NULL,

    -- Examples
    good_examples TEXT[] DEFAULT '{}',
    bad_examples TEXT[] DEFAULT '{}',

    -- Enforcement
    is_mandatory BOOLEAN DEFAULT true,
    enforcement_level TEXT DEFAULT 'warn' CHECK (enforcement_level IN ('info', 'warn', 'block')),
    auto_fix_suggestion TEXT,

    -- Ordering
    sort_order INTEGER DEFAULT 0,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_brand_guidelines_profile ON brand_guidelines(brand_voice_id);
CREATE INDEX IF NOT EXISTS idx_brand_guidelines_category ON brand_guidelines(category);
CREATE INDEX IF NOT EXISTS idx_brand_guidelines_type ON brand_guidelines(guideline_type);
CREATE INDEX IF NOT EXISTS idx_brand_guidelines_enforcement ON brand_guidelines(enforcement_level) WHERE is_mandatory = true;

-- ============================================================================
-- BRAND VOICE APPLICATIONS (Usage Tracking)
-- ============================================================================
CREATE TABLE IF NOT EXISTS brand_voice_applications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    brand_voice_id UUID NOT NULL REFERENCES brand_voice_profiles(id),
    task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
    content_asset_id UUID REFERENCES content_assets(id) ON DELETE SET NULL,

    -- Content type that was generated
    content_type TEXT,

    -- Analysis results
    compliance_score INTEGER CHECK (compliance_score BETWEEN 0 AND 100),
    issues_found JSONB DEFAULT '[]',
    suggestions JSONB DEFAULT '[]',

    -- AI model used
    model_used TEXT,
    prompt_tokens INTEGER,
    completion_tokens INTEGER,

    applied_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_brand_voice_apps_profile ON brand_voice_applications(brand_voice_id);
CREATE INDEX IF NOT EXISTS idx_brand_voice_apps_task ON brand_voice_applications(task_id) WHERE task_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_brand_voice_apps_asset ON brand_voice_applications(content_asset_id) WHERE content_asset_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_brand_voice_apps_date ON brand_voice_applications(applied_at DESC);
CREATE INDEX IF NOT EXISTS idx_brand_voice_apps_score ON brand_voice_applications(compliance_score);

-- ============================================================================
-- TONE PRESETS (Pre-defined tone configurations)
-- ============================================================================
CREATE TABLE IF NOT EXISTS tone_presets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    tone JSONB NOT NULL,
    writing_style JSONB NOT NULL,
    is_system BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default tone presets
INSERT INTO tone_presets (name, description, tone, writing_style, is_system) VALUES
(
    'Professional',
    'Formal, authoritative tone suitable for B2B communications',
    '{"personality": ["professional", "authoritative", "trustworthy"], "formality": "formal", "humor": "none", "confidence_level": "high", "empathy_level": "medium"}',
    '{"sentence_length": "medium", "paragraph_length": "medium", "vocabulary_level": "advanced", "use_contractions": false, "use_active_voice": true, "avoid_jargon": false, "use_oxford_comma": true, "preferred_terms": {}, "prohibited_terms": ["guys", "stuff", "things"]}',
    true
),
(
    'Friendly',
    'Warm, approachable tone for consumer brands',
    '{"personality": ["friendly", "approachable", "helpful"], "formality": "casual", "humor": "light", "confidence_level": "medium", "empathy_level": "high"}',
    '{"sentence_length": "short", "paragraph_length": "short", "vocabulary_level": "simple", "use_contractions": true, "use_active_voice": true, "avoid_jargon": true, "use_oxford_comma": true, "preferred_terms": {"you": "you", "we": "we"}, "prohibited_terms": ["pursuant to", "heretofore"]}',
    true
),
(
    'Technical',
    'Precise, detailed tone for developer audiences',
    '{"personality": ["precise", "knowledgeable", "helpful"], "formality": "semi-formal", "humor": "minimal", "confidence_level": "high", "empathy_level": "low"}',
    '{"sentence_length": "varied", "paragraph_length": "medium", "vocabulary_level": "technical", "use_contractions": true, "use_active_voice": true, "avoid_jargon": false, "use_oxford_comma": true, "preferred_terms": {}, "prohibited_terms": []}',
    true
),
(
    'Playful',
    'Fun, energetic tone for lifestyle brands',
    '{"personality": ["playful", "energetic", "creative"], "formality": "casual", "humor": "frequent", "confidence_level": "medium", "empathy_level": "high"}',
    '{"sentence_length": "short", "paragraph_length": "short", "vocabulary_level": "simple", "use_contractions": true, "use_active_voice": true, "avoid_jargon": true, "use_oxford_comma": false, "preferred_terms": {}, "prohibited_terms": ["boring", "standard", "regular"]}',
    true
),
(
    'Luxury',
    'Sophisticated, exclusive tone for premium brands',
    '{"personality": ["sophisticated", "exclusive", "refined"], "formality": "formal", "humor": "none", "confidence_level": "high", "empathy_level": "medium"}',
    '{"sentence_length": "medium", "paragraph_length": "medium", "vocabulary_level": "elevated", "use_contractions": false, "use_active_voice": true, "avoid_jargon": true, "use_oxford_comma": true, "preferred_terms": {"buy": "acquire", "cheap": "accessible"}, "prohibited_terms": ["cheap", "discount", "bargain", "deal"]}',
    true
)
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE brand_voice_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE brand_voice_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE brand_guidelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE brand_voice_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE tone_presets ENABLE ROW LEVEL SECURITY;

-- Brand Voice Profiles
CREATE POLICY "Users can view brand voice in their org"
    ON brand_voice_profiles FOR SELECT
    TO authenticated
    USING (
        organization_id IN (
            SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Admins can manage brand voice"
    ON brand_voice_profiles FOR ALL
    TO authenticated
    USING (
        organization_id IN (
            SELECT organization_id FROM organization_members
            WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
        )
    );

-- Brand Voice History
CREATE POLICY "Users can view brand voice history in their org"
    ON brand_voice_history FOR SELECT
    TO authenticated
    USING (
        brand_voice_id IN (
            SELECT id FROM brand_voice_profiles WHERE organization_id IN (
                SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
            )
        )
    );

CREATE POLICY "Service role can manage brand voice history"
    ON brand_voice_history FOR ALL
    TO service_role
    USING (true);

-- Brand Guidelines
CREATE POLICY "Users can view guidelines in their org"
    ON brand_guidelines FOR SELECT
    TO authenticated
    USING (
        organization_id IN (
            SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Admins can manage guidelines"
    ON brand_guidelines FOR ALL
    TO authenticated
    USING (
        organization_id IN (
            SELECT organization_id FROM organization_members
            WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
        )
    );

-- Brand Voice Applications
CREATE POLICY "Users can view applications in their org"
    ON brand_voice_applications FOR SELECT
    TO authenticated
    USING (
        brand_voice_id IN (
            SELECT id FROM brand_voice_profiles WHERE organization_id IN (
                SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
            )
        )
    );

CREATE POLICY "Service role can manage applications"
    ON brand_voice_applications FOR ALL
    TO service_role
    USING (true);

-- Tone Presets (public read)
CREATE POLICY "Anyone can view tone presets"
    ON tone_presets FOR SELECT
    TO authenticated
    USING (true);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to save brand voice history before update
CREATE OR REPLACE FUNCTION save_brand_voice_history()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.tone IS DISTINCT FROM NEW.tone
       OR OLD.writing_style IS DISTINCT FROM NEW.writing_style
       OR OLD.visual_brand IS DISTINCT FROM NEW.visual_brand
       OR OLD.example_content IS DISTINCT FROM NEW.example_content
       OR OLD.custom_instructions IS DISTINCT FROM NEW.custom_instructions
    THEN
        INSERT INTO brand_voice_history (
            brand_voice_id,
            version,
            tone,
            writing_style,
            visual_brand,
            example_content,
            custom_instructions,
            changed_by
        ) VALUES (
            OLD.id,
            OLD.version,
            OLD.tone,
            OLD.writing_style,
            OLD.visual_brand,
            OLD.example_content,
            OLD.custom_instructions,
            auth.uid()
        );

        NEW.version := OLD.version + 1;
        NEW.updated_at := NOW();
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_save_brand_voice_history ON brand_voice_profiles;
CREATE TRIGGER trigger_save_brand_voice_history
    BEFORE UPDATE ON brand_voice_profiles
    FOR EACH ROW
    EXECUTE FUNCTION save_brand_voice_history();

-- Function to ensure only one default brand voice per product
CREATE OR REPLACE FUNCTION ensure_single_default_brand_voice()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_default = true THEN
        UPDATE brand_voice_profiles
        SET is_default = false
        WHERE product_id = NEW.product_id
        AND id != NEW.id
        AND is_default = true;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_ensure_single_default_brand_voice ON brand_voice_profiles;
CREATE TRIGGER trigger_ensure_single_default_brand_voice
    AFTER INSERT OR UPDATE ON brand_voice_profiles
    FOR EACH ROW
    EXECUTE FUNCTION ensure_single_default_brand_voice();

-- Function to get brand voice for a product
CREATE OR REPLACE FUNCTION get_product_brand_voice(p_product_id UUID)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'id', bvp.id,
        'name', bvp.name,
        'tone', bvp.tone,
        'writing_style', bvp.writing_style,
        'visual_brand', bvp.visual_brand,
        'custom_instructions', bvp.custom_instructions,
        'guidelines', (
            SELECT COALESCE(jsonb_agg(
                jsonb_build_object(
                    'category', bg.category,
                    'type', bg.guideline_type,
                    'title', bg.title,
                    'description', bg.description,
                    'good_examples', bg.good_examples,
                    'bad_examples', bg.bad_examples,
                    'enforcement_level', bg.enforcement_level
                ) ORDER BY bg.sort_order
            ), '[]'::jsonb)
            FROM brand_guidelines bg
            WHERE bg.brand_voice_id = bvp.id AND bg.is_mandatory = true
        )
    )
    INTO result
    FROM brand_voice_profiles bvp
    WHERE bvp.product_id = p_product_id
    AND bvp.is_active = true
    AND bvp.is_default = true
    LIMIT 1;

    RETURN result;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE brand_voice_profiles IS 'Brand voice configurations for AI content generation';
COMMENT ON TABLE brand_voice_history IS 'Version history for brand voice changes';
COMMENT ON TABLE brand_guidelines IS 'DOs and DONTs rules for brand voice enforcement';
COMMENT ON TABLE brand_voice_applications IS 'Tracking of brand voice usage in content generation';
COMMENT ON TABLE tone_presets IS 'Pre-defined tone configurations for quick setup';
