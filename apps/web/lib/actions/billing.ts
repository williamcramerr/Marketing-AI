'use server';

/**
 * Billing Server Actions
 *
 * Server actions for subscription management and billing operations.
 */

import { createClient } from '@/lib/supabase/server';
import {
  getOrCreateCustomer,
  createCheckoutSession,
  createPortalSession,
  getSubscriptionInfo,
  cancelSubscription,
  resumeSubscription,
} from '@/lib/stripe/subscriptions';
import { PLANS, formatPrice } from '@/lib/stripe/client';

/**
 * Get current subscription info for the user's organization
 */
export async function getCurrentSubscription() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: 'Unauthorized' };
    }

    const { data: membership } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .limit(1)
      .single();

    if (!membership) {
      return { success: false, error: 'No organization found' };
    }

    const subscription = await getSubscriptionInfo(membership.organization_id);

    return { success: true, data: subscription };
  } catch (error) {
    console.error('Error getting subscription:', error);
    return { success: false, error: 'Failed to get subscription' };
  }
}

/**
 * Get available plans for upgrade
 */
export async function getAvailablePlans() {
  try {
    const plans = Object.values(PLANS).map((plan) => ({
      ...plan,
      formattedPriceMonthly: formatPrice(plan.priceMonthly),
      formattedPriceYearly: formatPrice(plan.priceYearly),
    }));

    return { success: true, data: plans };
  } catch (error) {
    console.error('Error getting plans:', error);
    return { success: false, error: 'Failed to get plans' };
  }
}

/**
 * Create a checkout session for subscription upgrade
 */
export async function createUpgradeCheckout(
  planSlug: 'pro' | 'enterprise',
  billingInterval: 'monthly' | 'yearly' = 'monthly'
) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: 'Unauthorized' };
    }

    const { data: membership } = await supabase
      .from('organization_members')
      .select('organization_id, role')
      .eq('user_id', user.id)
      .limit(1)
      .single();

    if (!membership) {
      return { success: false, error: 'No organization found' };
    }

    // Only owners and admins can upgrade
    if (!['owner', 'admin'].includes(membership.role)) {
      return { success: false, error: 'Insufficient permissions' };
    }

    const plan = PLANS[planSlug];
    if (!plan) {
      return { success: false, error: 'Invalid plan' };
    }

    const priceId =
      billingInterval === 'monthly'
        ? plan.stripePriceIdMonthly
        : plan.stripePriceIdYearly;

    if (!priceId) {
      return { success: false, error: 'Plan not available for purchase' };
    }

    // Get or create Stripe customer
    const customerId = await getOrCreateCustomer(
      membership.organization_id,
      user.email!,
      user.user_metadata?.full_name
    );

    // Create checkout session
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const checkoutUrl = await createCheckoutSession({
      organizationId: membership.organization_id,
      priceId,
      customerId,
      successUrl: `${baseUrl}/dashboard/settings/billing?success=true`,
      cancelUrl: `${baseUrl}/dashboard/settings/billing?canceled=true`,
      trialDays: 14, // 14-day trial
    });

    return { success: true, data: { checkoutUrl } };
  } catch (error) {
    console.error('Error creating checkout:', error);
    return { success: false, error: 'Failed to create checkout' };
  }
}

/**
 * Create a portal session for managing subscription
 */
export async function createBillingPortal() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: 'Unauthorized' };
    }

    const { data: membership } = await supabase
      .from('organization_members')
      .select('organization_id, role')
      .eq('user_id', user.id)
      .limit(1)
      .single();

    if (!membership) {
      return { success: false, error: 'No organization found' };
    }

    // Only owners and admins can manage billing
    if (!['owner', 'admin'].includes(membership.role)) {
      return { success: false, error: 'Insufficient permissions' };
    }

    // Get organization's Stripe customer ID
    const { data: org } = await supabase
      .from('organizations')
      .select('stripe_customer_id')
      .eq('id', membership.organization_id)
      .single();

    if (!org?.stripe_customer_id) {
      return { success: false, error: 'No billing account found' };
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const portalUrl = await createPortalSession(
      org.stripe_customer_id,
      `${baseUrl}/dashboard/settings/billing`
    );

    return { success: true, data: { portalUrl } };
  } catch (error) {
    console.error('Error creating portal:', error);
    return { success: false, error: 'Failed to create billing portal' };
  }
}

/**
 * Cancel the current subscription
 */
export async function cancelCurrentSubscription(immediately = false) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: 'Unauthorized' };
    }

    const { data: membership } = await supabase
      .from('organization_members')
      .select('organization_id, role')
      .eq('user_id', user.id)
      .limit(1)
      .single();

    if (!membership) {
      return { success: false, error: 'No organization found' };
    }

    // Only owners can cancel
    if (membership.role !== 'owner') {
      return { success: false, error: 'Only organization owner can cancel subscription' };
    }

    const subscription = await getSubscriptionInfo(membership.organization_id);

    if (!subscription?.stripeSubscriptionId) {
      return { success: false, error: 'No active subscription found' };
    }

    await cancelSubscription(subscription.stripeSubscriptionId, immediately);

    // Log the action
    await supabase.from('audit_logs').insert({
      organization_id: membership.organization_id,
      user_id: user.id,
      action: 'billing.subscription_canceled',
      resource_type: 'subscription',
      resource_id: subscription.stripeSubscriptionId,
      metadata: {
        immediately,
        planSlug: subscription.plan.slug,
      },
    });

    return { success: true };
  } catch (error) {
    console.error('Error canceling subscription:', error);
    return { success: false, error: 'Failed to cancel subscription' };
  }
}

/**
 * Resume a canceled subscription
 */
export async function resumeCurrentSubscription() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: 'Unauthorized' };
    }

    const { data: membership } = await supabase
      .from('organization_members')
      .select('organization_id, role')
      .eq('user_id', user.id)
      .limit(1)
      .single();

    if (!membership) {
      return { success: false, error: 'No organization found' };
    }

    // Only owners and admins can resume
    if (!['owner', 'admin'].includes(membership.role)) {
      return { success: false, error: 'Insufficient permissions' };
    }

    const subscription = await getSubscriptionInfo(membership.organization_id);

    if (!subscription?.stripeSubscriptionId) {
      return { success: false, error: 'No subscription found' };
    }

    await resumeSubscription(subscription.stripeSubscriptionId);

    return { success: true };
  } catch (error) {
    console.error('Error resuming subscription:', error);
    return { success: false, error: 'Failed to resume subscription' };
  }
}

/**
 * Get usage statistics for the current billing period
 */
export async function getUsageStats() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: 'Unauthorized' };
    }

    const { data: membership } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .limit(1)
      .single();

    if (!membership) {
      return { success: false, error: 'No organization found' };
    }

    // Get current month's usage
    const periodStart = new Date();
    periodStart.setDate(1);
    periodStart.setHours(0, 0, 0, 0);

    const { data: monthlyUsage } = await supabase
      .from('ai_usage_monthly')
      .select('*')
      .eq('organization_id', membership.organization_id)
      .gte('period_start', periodStart.toISOString().split('T')[0])
      .limit(1)
      .single();

    const subscription = await getSubscriptionInfo(membership.organization_id);

    return {
      success: true,
      data: {
        tokensUsed: monthlyUsage?.total_tokens || 0,
        tokensIncluded: subscription?.plan.limits.aiTokensMonthly || 50000,
        tokensOverage: monthlyUsage?.tokens_overage || 0,
        overageCost: monthlyUsage?.overage_cost_cents || 0,
        requestCount: monthlyUsage?.request_count || 0,
        periodStart: periodStart.toISOString(),
        periodEnd: new Date(
          periodStart.getFullYear(),
          periodStart.getMonth() + 1,
          0
        ).toISOString(),
      },
    };
  } catch (error) {
    console.error('Error getting usage stats:', error);
    return { success: false, error: 'Failed to get usage stats' };
  }
}
