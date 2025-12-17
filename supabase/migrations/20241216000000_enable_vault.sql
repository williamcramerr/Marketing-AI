-- Enable Supabase Vault for credential encryption
-- This migration enables the Vault extension and adds helper functions

-- ============================================
-- ENABLE VAULT EXTENSION
-- ============================================

CREATE EXTENSION IF NOT EXISTS vault WITH SCHEMA vault;

-- ============================================
-- ADD VAULT REFERENCE COLUMN TO CONNECTORS
-- ============================================

ALTER TABLE connectors
ADD COLUMN IF NOT EXISTS credentials_vault_ids JSONB DEFAULT '{}';

COMMENT ON COLUMN connectors.credentials IS 'DEPRECATED: Use credentials_vault_ids. Legacy plain-text credentials for migration.';
COMMENT ON COLUMN connectors.credentials_vault_ids IS 'JSON mapping of credential field names to Vault secret UUIDs';

-- ============================================
-- HELPER FUNCTIONS FOR VAULT OPERATIONS
-- ============================================

-- Store a secret in Vault and return the secret ID
CREATE OR REPLACE FUNCTION store_secret(
    p_name TEXT,
    p_secret TEXT,
    p_description TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_secret_id UUID;
BEGIN
    INSERT INTO vault.secrets (name, secret, description)
    VALUES (p_name, p_secret, p_description)
    RETURNING id INTO v_secret_id;

    RETURN v_secret_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Retrieve a decrypted secret by ID
CREATE OR REPLACE FUNCTION get_secret(p_secret_id UUID)
RETURNS TEXT AS $$
DECLARE
    v_secret TEXT;
BEGIN
    SELECT decrypted_secret INTO v_secret
    FROM vault.decrypted_secrets
    WHERE id = p_secret_id;

    RETURN v_secret;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update an existing secret
CREATE OR REPLACE FUNCTION update_secret(
    p_secret_id UUID,
    p_new_secret TEXT
) RETURNS VOID AS $$
BEGIN
    UPDATE vault.secrets
    SET secret = p_new_secret, updated_at = NOW()
    WHERE id = p_secret_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Secret with ID % not found', p_secret_id;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Delete a secret from Vault
CREATE OR REPLACE FUNCTION delete_secret(p_secret_id UUID)
RETURNS VOID AS $$
BEGIN
    DELETE FROM vault.secrets WHERE id = p_secret_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Batch retrieve secrets (returns JSONB mapping ID to decrypted value)
CREATE OR REPLACE FUNCTION get_secrets_batch(p_secret_ids UUID[])
RETURNS JSONB AS $$
DECLARE
    v_result JSONB := '{}';
    v_record RECORD;
BEGIN
    FOR v_record IN
        SELECT id, decrypted_secret
        FROM vault.decrypted_secrets
        WHERE id = ANY(p_secret_ids)
    LOOP
        v_result := v_result || jsonb_build_object(v_record.id::text, v_record.decrypted_secret);
    END LOOP;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions to authenticated users (via service role)
-- These functions use SECURITY DEFINER so they run with elevated privileges

-- ============================================
-- INDEX FOR VAULT LOOKUPS
-- ============================================

CREATE INDEX IF NOT EXISTS idx_connectors_vault_ids ON connectors
USING gin (credentials_vault_ids);
