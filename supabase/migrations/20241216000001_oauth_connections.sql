-- OAuth Connections Schema
-- Stores OAuth connections for social/ad platform integrations

-- ============================================
-- OAUTH CONNECTIONS TABLE
-- ============================================

CREATE TABLE oauth_connections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

    -- Provider info
    provider TEXT NOT NULL CHECK (provider IN ('google', 'linkedin', 'meta', 'twitter')),
    provider_account_id TEXT NOT NULL,
    provider_account_name TEXT,
    provider_account_email TEXT,

    -- Token storage (Vault references)
    access_token_secret_id UUID,
    refresh_token_secret_id UUID,
    token_expires_at TIMESTAMPTZ,

    -- OAuth metadata
    scopes TEXT[],
    metadata JSONB DEFAULT '{}',

    -- Status
    active BOOLEAN DEFAULT true,
    last_used_at TIMESTAMPTZ,
    last_error TEXT,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Constraints
    UNIQUE(organization_id, provider, provider_account_id)
);

-- Indexes
CREATE INDEX idx_oauth_connections_org ON oauth_connections(organization_id);
CREATE INDEX idx_oauth_connections_user ON oauth_connections(user_id);
CREATE INDEX idx_oauth_connections_provider ON oauth_connections(provider);
CREATE INDEX idx_oauth_connections_active ON oauth_connections(organization_id) WHERE active = true;

-- Updated at trigger
CREATE TRIGGER update_oauth_connections_updated_at
    BEFORE UPDATE ON oauth_connections
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- OAUTH STATES TABLE (CSRF protection)
-- ============================================

CREATE TABLE oauth_states (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    state TEXT UNIQUE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
    provider TEXT NOT NULL CHECK (provider IN ('google', 'linkedin', 'meta', 'twitter')),
    redirect_uri TEXT NOT NULL,
    code_verifier TEXT, -- For PKCE
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '10 minutes'
);

-- Index for state lookup
CREATE INDEX idx_oauth_states_state ON oauth_states(state);
CREATE INDEX idx_oauth_states_expires ON oauth_states(expires_at);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE oauth_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE oauth_states ENABLE ROW LEVEL SECURITY;

-- OAuth Connections: Users can view connections in their organization
CREATE POLICY "Users can view org oauth connections"
    ON oauth_connections
    FOR SELECT
    USING (
        organization_id IN (
            SELECT organization_id
            FROM organization_members
            WHERE user_id = auth.uid()
        )
    );

-- OAuth Connections: Admins/owners can manage connections
CREATE POLICY "Admins can manage oauth connections"
    ON oauth_connections
    FOR ALL
    USING (
        organization_id IN (
            SELECT organization_id
            FROM organization_members
            WHERE user_id = auth.uid()
            AND role IN ('owner', 'admin')
        )
    );

-- OAuth States: Users can only manage their own states
CREATE POLICY "Users can manage own oauth states"
    ON oauth_states
    FOR ALL
    USING (user_id = auth.uid());

-- ============================================
-- CLEANUP FUNCTION FOR EXPIRED STATES
-- ============================================

CREATE OR REPLACE FUNCTION cleanup_expired_oauth_states()
RETURNS void AS $$
BEGIN
    DELETE FROM oauth_states WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Schedule cleanup every hour (requires pg_cron)
-- SELECT cron.schedule('cleanup-oauth-states', '0 * * * *', 'SELECT cleanup_expired_oauth_states()');
