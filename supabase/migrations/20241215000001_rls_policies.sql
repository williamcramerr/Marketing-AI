-- Marketing Pilot AI - Row Level Security Policies

-- ============================================
-- ENABLE RLS ON ALL TABLES
-- ============================================

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE audiences ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE connectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_suppressions ENABLE ROW LEVEL SECURITY;
ALTER TABLE metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE experiments ENABLE ROW LEVEL SECURITY;
ALTER TABLE experiment_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_state ENABLE ROW LEVEL SECURITY;

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Get all organization IDs the current user belongs to
CREATE OR REPLACE FUNCTION auth.user_organizations()
RETURNS UUID[] AS $$
    SELECT COALESCE(ARRAY_AGG(organization_id), ARRAY[]::UUID[])
    FROM organization_members
    WHERE user_id = auth.uid()
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Check if user has specific role(s) in an organization
CREATE OR REPLACE FUNCTION auth.has_org_role(org_id UUID, required_roles TEXT[])
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM organization_members
        WHERE organization_id = org_id
        AND user_id = auth.uid()
        AND role = ANY(required_roles)
    )
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Get organization_id from a product_id
CREATE OR REPLACE FUNCTION get_org_from_product(p_id UUID)
RETURNS UUID AS $$
    SELECT organization_id FROM products WHERE id = p_id
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Get organization_id from a campaign_id
CREATE OR REPLACE FUNCTION get_org_from_campaign(c_id UUID)
RETURNS UUID AS $$
    SELECT p.organization_id
    FROM campaigns c
    JOIN products p ON c.product_id = p.id
    WHERE c.id = c_id
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- ============================================
-- ORGANIZATIONS
-- ============================================

CREATE POLICY "Members can view their organizations"
    ON organizations FOR SELECT
    USING (id = ANY(auth.user_organizations()));

CREATE POLICY "Owners can update their organizations"
    ON organizations FOR UPDATE
    USING (auth.has_org_role(id, ARRAY['owner']));

CREATE POLICY "Users can create organizations"
    ON organizations FOR INSERT
    WITH CHECK (true);

-- ============================================
-- ORGANIZATION MEMBERS
-- ============================================

CREATE POLICY "Members can view org members"
    ON organization_members FOR SELECT
    USING (organization_id = ANY(auth.user_organizations()));

CREATE POLICY "Owners and admins can manage members"
    ON organization_members FOR ALL
    USING (auth.has_org_role(organization_id, ARRAY['owner', 'admin']));

-- ============================================
-- PRODUCTS
-- ============================================

CREATE POLICY "Org members can view products"
    ON products FOR SELECT
    USING (organization_id = ANY(auth.user_organizations()));

CREATE POLICY "Admins can create products"
    ON products FOR INSERT
    WITH CHECK (auth.has_org_role(organization_id, ARRAY['owner', 'admin']));

CREATE POLICY "Admins can update products"
    ON products FOR UPDATE
    USING (auth.has_org_role(organization_id, ARRAY['owner', 'admin']));

CREATE POLICY "Admins can delete products"
    ON products FOR DELETE
    USING (auth.has_org_role(organization_id, ARRAY['owner', 'admin']));

-- ============================================
-- AUDIENCES
-- ============================================

CREATE POLICY "Org members can view audiences"
    ON audiences FOR SELECT
    USING (get_org_from_product(product_id) = ANY(auth.user_organizations()));

CREATE POLICY "Members can manage audiences"
    ON audiences FOR ALL
    USING (auth.has_org_role(get_org_from_product(product_id), ARRAY['owner', 'admin', 'member']));

-- ============================================
-- CAMPAIGNS
-- ============================================

CREATE POLICY "Org members can view campaigns"
    ON campaigns FOR SELECT
    USING (get_org_from_product(product_id) = ANY(auth.user_organizations()));

CREATE POLICY "Members can create campaigns"
    ON campaigns FOR INSERT
    WITH CHECK (auth.has_org_role(get_org_from_product(product_id), ARRAY['owner', 'admin', 'member']));

CREATE POLICY "Members can update campaigns"
    ON campaigns FOR UPDATE
    USING (auth.has_org_role(get_org_from_product(product_id), ARRAY['owner', 'admin', 'member']));

CREATE POLICY "Admins can delete campaigns"
    ON campaigns FOR DELETE
    USING (auth.has_org_role(get_org_from_product(product_id), ARRAY['owner', 'admin']));

-- ============================================
-- CONNECTORS
-- ============================================

CREATE POLICY "Org members can view connectors"
    ON connectors FOR SELECT
    USING (organization_id = ANY(auth.user_organizations()));

CREATE POLICY "Admins can manage connectors"
    ON connectors FOR ALL
    USING (auth.has_org_role(organization_id, ARRAY['owner', 'admin']));

-- ============================================
-- TASKS
-- ============================================

CREATE POLICY "Org members can view tasks"
    ON tasks FOR SELECT
    USING (get_org_from_campaign(campaign_id) = ANY(auth.user_organizations()));

CREATE POLICY "Members can create tasks"
    ON tasks FOR INSERT
    WITH CHECK (auth.has_org_role(get_org_from_campaign(campaign_id), ARRAY['owner', 'admin', 'member']));

CREATE POLICY "Members can update tasks"
    ON tasks FOR UPDATE
    USING (auth.has_org_role(get_org_from_campaign(campaign_id), ARRAY['owner', 'admin', 'member']));

CREATE POLICY "Admins can delete tasks"
    ON tasks FOR DELETE
    USING (auth.has_org_role(get_org_from_campaign(campaign_id), ARRAY['owner', 'admin']));

-- ============================================
-- CONTENT ASSETS
-- ============================================

CREATE POLICY "Org members can view content assets"
    ON content_assets FOR SELECT
    USING (get_org_from_product(product_id) = ANY(auth.user_organizations()));

CREATE POLICY "Members can manage content assets"
    ON content_assets FOR ALL
    USING (auth.has_org_role(get_org_from_product(product_id), ARRAY['owner', 'admin', 'member']));

-- ============================================
-- APPROVALS
-- ============================================

CREATE POLICY "Org members can view approvals"
    ON approvals FOR SELECT
    USING (
        get_org_from_campaign(
            (SELECT campaign_id FROM tasks WHERE id = task_id)
        ) = ANY(auth.user_organizations())
    );

CREATE POLICY "Members can manage approvals"
    ON approvals FOR ALL
    USING (
        auth.has_org_role(
            get_org_from_campaign(
                (SELECT campaign_id FROM tasks WHERE id = task_id)
            ),
            ARRAY['owner', 'admin', 'member']
        )
    );

-- ============================================
-- POLICIES (GUARDRAILS)
-- ============================================

CREATE POLICY "Org members can view policies"
    ON policies FOR SELECT
    USING (organization_id = ANY(auth.user_organizations()));

CREATE POLICY "Admins can manage policies"
    ON policies FOR ALL
    USING (auth.has_org_role(organization_id, ARRAY['owner', 'admin']));

-- ============================================
-- EMAIL SUPPRESSIONS
-- ============================================

CREATE POLICY "Org members can view suppressions"
    ON email_suppressions FOR SELECT
    USING (organization_id = ANY(auth.user_organizations()));

CREATE POLICY "Members can manage suppressions"
    ON email_suppressions FOR ALL
    USING (auth.has_org_role(organization_id, ARRAY['owner', 'admin', 'member']));

-- ============================================
-- METRICS
-- ============================================

CREATE POLICY "Org members can view metrics"
    ON metrics FOR SELECT
    USING (
        product_id IS NOT NULL AND get_org_from_product(product_id) = ANY(auth.user_organizations())
        OR campaign_id IS NOT NULL AND get_org_from_campaign(campaign_id) = ANY(auth.user_organizations())
    );

-- Metrics are inserted by service role (agents), not by users directly
-- No INSERT policy for regular users

-- ============================================
-- EXPERIMENTS
-- ============================================

CREATE POLICY "Org members can view experiments"
    ON experiments FOR SELECT
    USING (get_org_from_campaign(campaign_id) = ANY(auth.user_organizations()));

CREATE POLICY "Members can manage experiments"
    ON experiments FOR ALL
    USING (auth.has_org_role(get_org_from_campaign(campaign_id), ARRAY['owner', 'admin', 'member']));

-- ============================================
-- EXPERIMENT ASSIGNMENTS
-- ============================================

CREATE POLICY "Org members can view assignments"
    ON experiment_assignments FOR SELECT
    USING (
        get_org_from_campaign(
            (SELECT campaign_id FROM experiments WHERE id = experiment_id)
        ) = ANY(auth.user_organizations())
    );

-- Assignments are inserted by service role (agents), not by users directly

-- ============================================
-- AUDIT LOGS
-- ============================================

CREATE POLICY "Org members can view audit logs"
    ON audit_logs FOR SELECT
    USING (organization_id = ANY(auth.user_organizations()));

-- Audit logs are insert-only by service role
-- No INSERT/UPDATE/DELETE policies for regular users

-- ============================================
-- AGENT STATE
-- ============================================

CREATE POLICY "Org members can view agent state"
    ON agent_state FOR SELECT
    USING (organization_id = ANY(auth.user_organizations()));

-- Agent state is managed by service role (agents), not by users directly

-- ============================================
-- STORAGE POLICIES (for Supabase Storage)
-- ============================================

-- Create storage bucket for content assets
INSERT INTO storage.buckets (id, name, public)
VALUES ('content-assets', 'content-assets', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policy: org members can read their org's files
CREATE POLICY "Org members can read content assets"
    ON storage.objects FOR SELECT
    USING (
        bucket_id = 'content-assets'
        AND (storage.foldername(name))[1]::UUID = ANY(auth.user_organizations())
    );

-- Storage policy: members can upload to their org's folder
CREATE POLICY "Members can upload content assets"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'content-assets'
        AND auth.has_org_role((storage.foldername(name))[1]::UUID, ARRAY['owner', 'admin', 'member'])
    );

-- Storage policy: members can update their org's files
CREATE POLICY "Members can update content assets"
    ON storage.objects FOR UPDATE
    USING (
        bucket_id = 'content-assets'
        AND auth.has_org_role((storage.foldername(name))[1]::UUID, ARRAY['owner', 'admin', 'member'])
    );

-- Storage policy: admins can delete files
CREATE POLICY "Admins can delete content assets"
    ON storage.objects FOR DELETE
    USING (
        bucket_id = 'content-assets'
        AND auth.has_org_role((storage.foldername(name))[1]::UUID, ARRAY['owner', 'admin'])
    );
