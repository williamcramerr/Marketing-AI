-- Onboarding Progress Migration
-- Tracks user progress through the onboarding flow

CREATE TABLE IF NOT EXISTS onboarding_progress (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    current_step TEXT NOT NULL DEFAULT 'welcome',
    completed_steps JSONB NOT NULL DEFAULT '[]',
    skipped_steps JSONB NOT NULL DEFAULT '[]',
    data JSONB NOT NULL DEFAULT '{}',
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Create index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_onboarding_user ON onboarding_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_org ON onboarding_progress(organization_id) WHERE organization_id IS NOT NULL;

-- RLS Policies
ALTER TABLE onboarding_progress ENABLE ROW LEVEL SECURITY;

-- Users can view and update their own onboarding progress
CREATE POLICY "Users can view own onboarding progress"
    ON onboarding_progress FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "Users can update own onboarding progress"
    ON onboarding_progress FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "Users can insert own onboarding progress"
    ON onboarding_progress FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());

-- Function to automatically create onboarding progress for new users
CREATE OR REPLACE FUNCTION create_onboarding_progress()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO onboarding_progress (user_id, current_step, data)
    VALUES (
        NEW.id,
        'welcome',
        jsonb_build_object(
            'email', NEW.email,
            'created_at', NOW()
        )
    )
    ON CONFLICT (user_id) DO NOTHING;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create onboarding progress when a new user is created
DROP TRIGGER IF EXISTS trigger_create_onboarding ON auth.users;
CREATE TRIGGER trigger_create_onboarding
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION create_onboarding_progress();
