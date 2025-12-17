import { createClient } from '@supabase/supabase-js';

/**
 * Database fixture for seeding and cleaning test data
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Create admin client for test setup/teardown
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

export interface TestUser {
  id: string;
  email: string;
  organizationId?: string;
}

/**
 * Create a test user
 */
export async function createTestUser(
  email: string,
  password: string
): Promise<TestUser | null> {
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (authError) {
    console.error('Failed to create test user:', authError);
    return null;
  }

  return {
    id: authData.user.id,
    email: authData.user.email!,
  };
}

/**
 * Create a test organization
 */
export async function createTestOrganization(
  name: string,
  userId: string
): Promise<string | null> {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

  // Create organization
  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .insert({
      name,
      slug,
      settings: {},
    })
    .select()
    .single();

  if (orgError) {
    console.error('Failed to create test organization:', orgError);
    return null;
  }

  // Add user as owner
  const { error: memberError } = await supabase.from('organization_members').insert({
    organization_id: org.id,
    user_id: userId,
    role: 'owner',
  });

  if (memberError) {
    console.error('Failed to add user to organization:', memberError);
    return null;
  }

  return org.id;
}

/**
 * Create a test product
 */
export async function createTestProduct(
  organizationId: string,
  name: string
): Promise<string | null> {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

  const { data: product, error } = await supabase
    .from('products')
    .insert({
      organization_id: organizationId,
      name,
      slug,
      description: 'Test product for E2E tests',
      active: true,
      positioning: {},
      brand_guidelines: {},
      verified_claims: {},
    })
    .select()
    .single();

  if (error) {
    console.error('Failed to create test product:', error);
    return null;
  }

  return product.id;
}

/**
 * Create a test campaign
 */
export async function createTestCampaign(
  productId: string,
  name: string
): Promise<string | null> {
  const { data: campaign, error } = await supabase
    .from('campaigns')
    .insert({
      product_id: productId,
      name,
      goal: 'awareness',
      status: 'draft',
      channels: ['blog', 'email'],
    })
    .select()
    .single();

  if (error) {
    console.error('Failed to create test campaign:', error);
    return null;
  }

  return campaign.id;
}

/**
 * Mark onboarding as complete for a user
 */
export async function completeOnboardingForUser(userId: string): Promise<void> {
  const { error } = await supabase
    .from('onboarding_progress')
    .upsert({
      user_id: userId,
      current_step: 'complete',
      completed_steps: ['welcome', 'organization', 'product', 'connector', 'campaign'],
      completed_at: new Date().toISOString(),
      data: {},
    });

  if (error) {
    console.error('Failed to complete onboarding:', error);
  }
}

/**
 * Delete test user and all related data
 */
export async function deleteTestUser(userId: string): Promise<void> {
  // Delete user (cascade should handle related data)
  const { error } = await supabase.auth.admin.deleteUser(userId);

  if (error) {
    console.error('Failed to delete test user:', error);
  }
}

/**
 * Delete test organization
 */
export async function deleteTestOrganization(organizationId: string): Promise<void> {
  const { error } = await supabase
    .from('organizations')
    .delete()
    .eq('id', organizationId);

  if (error) {
    console.error('Failed to delete test organization:', error);
  }
}

/**
 * Seed full test data set
 */
export async function seedTestData(): Promise<{
  user: TestUser;
  organizationId: string;
  productId: string;
  campaignId: string;
} | null> {
  try {
    // Create user
    const user = await createTestUser('e2e-test@example.com', 'e2e-test-password');
    if (!user) return null;

    // Create organization
    const organizationId = await createTestOrganization('E2E Test Org', user.id);
    if (!organizationId) return null;

    // Complete onboarding
    await completeOnboardingForUser(user.id);

    // Create product
    const productId = await createTestProduct(organizationId, 'E2E Test Product');
    if (!productId) return null;

    // Create campaign
    const campaignId = await createTestCampaign(productId, 'E2E Test Campaign');
    if (!campaignId) return null;

    return {
      user,
      organizationId,
      productId,
      campaignId,
    };
  } catch (error) {
    console.error('Failed to seed test data:', error);
    return null;
  }
}

/**
 * Clean up test data
 */
export async function cleanupTestData(userId?: string, organizationId?: string): Promise<void> {
  try {
    if (organizationId) {
      await deleteTestOrganization(organizationId);
    }
    if (userId) {
      await deleteTestUser(userId);
    }
  } catch (error) {
    console.error('Failed to cleanup test data:', error);
  }
}
