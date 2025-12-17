'use server';

/**
 * Onboarding Server Actions
 *
 * Server actions for managing onboarding progress.
 */

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import {
  type OnboardingStepId,
  getStep,
  getNextStep,
  isOnboardingComplete,
  ONBOARDING_STEPS,
} from '@/lib/onboarding/steps';

export interface OnboardingProgress {
  currentStep: OnboardingStepId;
  completedSteps: OnboardingStepId[];
  skippedSteps: OnboardingStepId[];
  data: Record<string, unknown>;
  organizationId: string | null;
  completedAt: string | null;
}

/**
 * Get current onboarding progress for the authenticated user
 */
export async function getOnboardingProgress(): Promise<{
  success: boolean;
  data?: OnboardingProgress;
  error?: string;
}> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: 'Unauthorized' };
    }

    const { data: progress, error } = await supabase
      .from('onboarding_progress')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching onboarding progress:', error);
      return { success: false, error: 'Failed to fetch progress' };
    }

    // If no progress exists, create it
    if (!progress) {
      const { data: newProgress, error: createError } = await supabase
        .from('onboarding_progress')
        .insert({
          user_id: user.id,
          current_step: 'welcome',
          completed_steps: [],
          skipped_steps: [],
          data: { email: user.email },
        })
        .select()
        .single();

      if (createError) {
        console.error('Error creating onboarding progress:', createError);
        return { success: false, error: 'Failed to create progress' };
      }

      return {
        success: true,
        data: {
          currentStep: newProgress.current_step as OnboardingStepId,
          completedSteps: newProgress.completed_steps as OnboardingStepId[],
          skippedSteps: newProgress.skipped_steps as OnboardingStepId[],
          data: newProgress.data as Record<string, unknown>,
          organizationId: newProgress.organization_id,
          completedAt: newProgress.completed_at,
        },
      };
    }

    return {
      success: true,
      data: {
        currentStep: progress.current_step as OnboardingStepId,
        completedSteps: progress.completed_steps as OnboardingStepId[],
        skippedSteps: progress.skipped_steps as OnboardingStepId[],
        data: progress.data as Record<string, unknown>,
        organizationId: progress.organization_id,
        completedAt: progress.completed_at,
      },
    };
  } catch (error) {
    console.error('Error in getOnboardingProgress:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

/**
 * Advance to the next step in onboarding
 */
export async function advanceOnboardingStep(
  currentStepId: OnboardingStepId,
  stepData?: Record<string, unknown>
): Promise<{
  success: boolean;
  nextStep?: OnboardingStepId;
  error?: string;
}> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: 'Unauthorized' };
    }

    // Get current progress
    const { data: progress } = await supabase
      .from('onboarding_progress')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (!progress) {
      return { success: false, error: 'Onboarding progress not found' };
    }

    const completedSteps = [...(progress.completed_steps as OnboardingStepId[])];
    if (!completedSteps.includes(currentStepId)) {
      completedSteps.push(currentStepId);
    }

    const nextStep = getNextStep(currentStepId);
    const nextStepId = nextStep?.id || 'complete';

    // Merge step data
    const updatedData = {
      ...(progress.data as Record<string, unknown>),
      [currentStepId]: stepData,
    };

    // Check if onboarding is complete
    const isComplete = isOnboardingComplete(completedSteps);

    // Update progress
    const { error: updateError } = await supabase
      .from('onboarding_progress')
      .update({
        current_step: nextStepId,
        completed_steps: completedSteps,
        data: updatedData,
        completed_at: isComplete ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id);

    if (updateError) {
      console.error('Error updating onboarding progress:', updateError);
      return { success: false, error: 'Failed to update progress' };
    }

    revalidatePath('/onboarding');

    return {
      success: true,
      nextStep: nextStepId as OnboardingStepId,
    };
  } catch (error) {
    console.error('Error in advanceOnboardingStep:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

/**
 * Skip a skippable step
 */
export async function skipOnboardingStep(
  stepId: OnboardingStepId
): Promise<{
  success: boolean;
  nextStep?: OnboardingStepId;
  error?: string;
}> {
  try {
    const step = getStep(stepId);

    if (!step || !step.skippable) {
      return { success: false, error: 'This step cannot be skipped' };
    }

    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: 'Unauthorized' };
    }

    // Get current progress
    const { data: progress } = await supabase
      .from('onboarding_progress')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (!progress) {
      return { success: false, error: 'Onboarding progress not found' };
    }

    const skippedSteps = [...(progress.skipped_steps as OnboardingStepId[])];
    if (!skippedSteps.includes(stepId)) {
      skippedSteps.push(stepId);
    }

    const nextStep = getNextStep(stepId);
    const nextStepId = nextStep?.id || 'complete';

    // Update progress
    const { error: updateError } = await supabase
      .from('onboarding_progress')
      .update({
        current_step: nextStepId,
        skipped_steps: skippedSteps,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id);

    if (updateError) {
      console.error('Error skipping step:', updateError);
      return { success: false, error: 'Failed to skip step' };
    }

    revalidatePath('/onboarding');

    return {
      success: true,
      nextStep: nextStepId as OnboardingStepId,
    };
  } catch (error) {
    console.error('Error in skipOnboardingStep:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

/**
 * Update onboarding data without advancing
 */
export async function updateOnboardingData(
  data: Record<string, unknown>
): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: 'Unauthorized' };
    }

    // Get current progress
    const { data: progress } = await supabase
      .from('onboarding_progress')
      .select('data')
      .eq('user_id', user.id)
      .single();

    if (!progress) {
      return { success: false, error: 'Onboarding progress not found' };
    }

    // Merge data
    const updatedData = {
      ...(progress.data as Record<string, unknown>),
      ...data,
    };

    // Update progress
    const { error: updateError } = await supabase
      .from('onboarding_progress')
      .update({
        data: updatedData,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id);

    if (updateError) {
      console.error('Error updating onboarding data:', updateError);
      return { success: false, error: 'Failed to update data' };
    }

    return { success: true };
  } catch (error) {
    console.error('Error in updateOnboardingData:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

/**
 * Link organization to onboarding progress
 */
export async function linkOrganizationToOnboarding(
  organizationId: string
): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: 'Unauthorized' };
    }

    const { error: updateError } = await supabase
      .from('onboarding_progress')
      .update({
        organization_id: organizationId,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id);

    if (updateError) {
      console.error('Error linking organization:', updateError);
      return { success: false, error: 'Failed to link organization' };
    }

    return { success: true };
  } catch (error) {
    console.error('Error in linkOrganizationToOnboarding:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

/**
 * Check if user needs onboarding
 */
export async function checkOnboardingRequired(): Promise<{
  required: boolean;
  redirectTo?: string;
}> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { required: false };
    }

    const { data: progress } = await supabase
      .from('onboarding_progress')
      .select('completed_at, current_step')
      .eq('user_id', user.id)
      .single();

    // If onboarding is completed, no redirect needed
    if (progress?.completed_at) {
      return { required: false };
    }

    // If onboarding exists but not complete, redirect to current step
    if (progress) {
      const step = getStep(progress.current_step as OnboardingStepId);
      return {
        required: true,
        redirectTo: step?.path || '/onboarding/welcome',
      };
    }

    // No progress exists, start onboarding
    return {
      required: true,
      redirectTo: '/onboarding/welcome',
    };
  } catch (error) {
    console.error('Error checking onboarding:', error);
    return { required: false };
  }
}

/**
 * Create organization during onboarding
 */
export async function createOnboardingOrganization(
  name: string,
  slug?: string
): Promise<{
  success: boolean;
  data?: { organizationId: string };
  error?: string;
}> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: 'Unauthorized' };
    }

    // Generate slug if not provided
    const orgSlug = slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    // Check if slug is taken
    const { data: existing } = await supabase
      .from('organizations')
      .select('id')
      .eq('slug', orgSlug)
      .single();

    if (existing) {
      return { success: false, error: 'An organization with this name already exists' };
    }

    // Create organization
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .insert({
        name,
        slug: orgSlug,
        settings: {},
      })
      .select()
      .single();

    if (orgError) {
      console.error('Error creating organization:', orgError);
      return { success: false, error: 'Failed to create organization' };
    }

    // Add user as owner
    const { error: memberError } = await supabase
      .from('organization_members')
      .insert({
        organization_id: org.id,
        user_id: user.id,
        role: 'owner',
      });

    if (memberError) {
      console.error('Error adding user to organization:', memberError);
      // Rollback organization creation
      await supabase.from('organizations').delete().eq('id', org.id);
      return { success: false, error: 'Failed to add user to organization' };
    }

    // Link organization to onboarding progress
    await linkOrganizationToOnboarding(org.id);

    revalidatePath('/onboarding');

    return {
      success: true,
      data: { organizationId: org.id },
    };
  } catch (error) {
    console.error('Error in createOnboardingOrganization:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

/**
 * Create product during onboarding
 */
export async function createOnboardingProduct(
  name: string,
  description?: string,
  websiteUrl?: string
): Promise<{
  success: boolean;
  data?: { productId: string };
  error?: string;
}> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: 'Unauthorized' };
    }

    // Get organization from onboarding progress
    const { data: progress } = await supabase
      .from('onboarding_progress')
      .select('organization_id')
      .eq('user_id', user.id)
      .single();

    if (!progress?.organization_id) {
      return { success: false, error: 'Please create an organization first' };
    }

    // Generate slug
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    // Create product
    const { data: product, error: productError } = await supabase
      .from('products')
      .insert({
        organization_id: progress.organization_id,
        name,
        slug,
        description: description || null,
        website_url: websiteUrl || null,
        positioning: {},
        brand_guidelines: {},
        verified_claims: {},
        active: true,
      })
      .select()
      .single();

    if (productError) {
      console.error('Error creating product:', productError);
      if (productError.code === '23505') {
        return { success: false, error: 'A product with this name already exists' };
      }
      return { success: false, error: 'Failed to create product' };
    }

    revalidatePath('/onboarding');

    return {
      success: true,
      data: { productId: product.id },
    };
  } catch (error) {
    console.error('Error in createOnboardingProduct:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

/**
 * Create campaign during onboarding
 */
export async function createOnboardingCampaign(
  productId: string,
  name: string,
  goal: string,
  channels: string[]
): Promise<{
  success: boolean;
  data?: { campaignId: string };
  error?: string;
}> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: 'Unauthorized' };
    }

    // Create campaign
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .insert({
        product_id: productId,
        name,
        goal,
        channels,
        status: 'draft',
      })
      .select()
      .single();

    if (campaignError) {
      console.error('Error creating campaign:', campaignError);
      return { success: false, error: 'Failed to create campaign' };
    }

    revalidatePath('/onboarding');

    return {
      success: true,
      data: { campaignId: campaign.id },
    };
  } catch (error) {
    console.error('Error in createOnboardingCampaign:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

/**
 * Get first product for the current user's organization
 */
export async function getFirstProduct(): Promise<{
  success: boolean;
  data?: { id: string; name: string };
  error?: string;
}> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: 'Unauthorized' };
    }

    // Get organization from onboarding progress
    const { data: progress } = await supabase
      .from('onboarding_progress')
      .select('organization_id')
      .eq('user_id', user.id)
      .single();

    if (!progress?.organization_id) {
      return { success: false, error: 'No organization found' };
    }

    // Get first product
    const { data: product } = await supabase
      .from('products')
      .select('id, name')
      .eq('organization_id', progress.organization_id)
      .limit(1)
      .single();

    if (!product) {
      return { success: false, error: 'No product found' };
    }

    return {
      success: true,
      data: product,
    };
  } catch (error) {
    console.error('Error in getFirstProduct:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

/**
 * Complete onboarding manually (e.g., skip all remaining steps)
 */
export async function completeOnboarding(): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: 'Unauthorized' };
    }

    // Get current progress
    const { data: progress } = await supabase
      .from('onboarding_progress')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (!progress) {
      return { success: false, error: 'Onboarding progress not found' };
    }

    // Mark required steps as completed
    const requiredStepIds = ONBOARDING_STEPS
      .filter((step) => step.required)
      .map((step) => step.id);

    const { error: updateError } = await supabase
      .from('onboarding_progress')
      .update({
        current_step: 'complete',
        completed_steps: requiredStepIds,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id);

    if (updateError) {
      console.error('Error completing onboarding:', updateError);
      return { success: false, error: 'Failed to complete onboarding' };
    }

    revalidatePath('/onboarding');
    revalidatePath('/dashboard');

    return { success: true };
  } catch (error) {
    console.error('Error in completeOnboarding:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}
