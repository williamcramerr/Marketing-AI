/**
 * Stripe Subscription Management
 *
 * Handles subscription creation, updates, cancellation, and queries.
 */

import { stripe, PLANS, type PlanConfig } from './client';
import { createAdminClient } from '@/lib/supabase/admin';
import Stripe from 'stripe';

export interface SubscriptionInfo {
  id: string;
  organizationId: string;
  plan: PlanConfig;
  status: string;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  cancelAt: Date | null;
  canceledAt: Date | null;
  stripeSubscriptionId: string | null;
  stripeCustomerId: string | null;
}

/**
 * Get or create a Stripe customer for an organization
 */
export async function getOrCreateCustomer(
  organizationId: string,
  email: string,
  name?: string
): Promise<string> {
  const supabase = createAdminClient();

  // Check if organization already has a Stripe customer
  const { data: org } = await supabase
    .from('organizations')
    .select('stripe_customer_id, name')
    .eq('id', organizationId)
    .single();

  if (org?.stripe_customer_id) {
    return org.stripe_customer_id;
  }

  // Create new Stripe customer
  const customer = await stripe.customers.create({
    email,
    name: name || org?.name,
    metadata: {
      organizationId,
    },
  });

  // Update organization with Stripe customer ID
  await supabase
    .from('organizations')
    .update({ stripe_customer_id: customer.id })
    .eq('id', organizationId);

  return customer.id;
}

/**
 * Create a checkout session for subscription upgrade
 */
export async function createCheckoutSession({
  organizationId,
  priceId,
  customerId,
  successUrl,
  cancelUrl,
  trialDays,
}: {
  organizationId: string;
  priceId: string;
  customerId: string;
  successUrl: string;
  cancelUrl: string;
  trialDays?: number;
}): Promise<string> {
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
    subscription_data: {
      metadata: {
        organizationId,
      },
      trial_period_days: trialDays,
    },
    metadata: {
      organizationId,
    },
    allow_promotion_codes: true,
    billing_address_collection: 'required',
  });

  return session.url!;
}

/**
 * Create a customer portal session for managing subscription
 */
export async function createPortalSession(
  customerId: string,
  returnUrl: string
): Promise<string> {
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });

  return session.url;
}

/**
 * Get subscription info for an organization
 */
export async function getSubscriptionInfo(
  organizationId: string
): Promise<SubscriptionInfo | null> {
  const supabase = createAdminClient();

  const { data: subscription } = await supabase
    .from('subscriptions')
    .select(`
      *,
      plan:subscription_plans(*)
    `)
    .eq('organization_id', organizationId)
    .single();

  if (!subscription) {
    // Return free plan info if no subscription exists
    return {
      id: '',
      organizationId,
      plan: PLANS.free,
      status: 'active',
      currentPeriodStart: null,
      currentPeriodEnd: null,
      cancelAt: null,
      canceledAt: null,
      stripeSubscriptionId: null,
      stripeCustomerId: null,
    };
  }

  const plan = subscription.plan as unknown as {
    slug: string;
    name: string;
    description: string;
    price_cents: number;
    limits: PlanConfig['limits'];
    ai_tokens_included: number;
    ai_token_overage_price_per_1k: number;
    features: string[];
  };

  return {
    id: subscription.id,
    organizationId: subscription.organization_id,
    plan: {
      slug: plan.slug as 'free' | 'pro' | 'enterprise',
      name: plan.name,
      description: plan.description,
      priceMonthly: plan.price_cents,
      priceYearly: plan.price_cents * 10, // Approximate
      limits: plan.limits,
      aiTokenOveragePricePer1k: plan.ai_token_overage_price_per_1k,
      features: plan.features || [],
    },
    status: subscription.status,
    currentPeriodStart: subscription.current_period_start
      ? new Date(subscription.current_period_start)
      : null,
    currentPeriodEnd: subscription.current_period_end
      ? new Date(subscription.current_period_end)
      : null,
    cancelAt: subscription.cancel_at ? new Date(subscription.cancel_at) : null,
    canceledAt: subscription.canceled_at
      ? new Date(subscription.canceled_at)
      : null,
    stripeSubscriptionId: subscription.stripe_subscription_id,
    stripeCustomerId: subscription.stripe_customer_id,
  };
}

/**
 * Cancel a subscription
 */
export async function cancelSubscription(
  stripeSubscriptionId: string,
  immediately = false
): Promise<void> {
  if (immediately) {
    await stripe.subscriptions.cancel(stripeSubscriptionId);
  } else {
    await stripe.subscriptions.update(stripeSubscriptionId, {
      cancel_at_period_end: true,
    });
  }
}

/**
 * Resume a canceled subscription
 */
export async function resumeSubscription(
  stripeSubscriptionId: string
): Promise<void> {
  await stripe.subscriptions.update(stripeSubscriptionId, {
    cancel_at_period_end: false,
  });
}

/**
 * Update subscription from Stripe webhook
 */
export async function syncSubscriptionFromStripe(
  stripeSubscription: Stripe.Subscription
): Promise<void> {
  const supabase = createAdminClient();
  const organizationId = stripeSubscription.metadata.organizationId;

  if (!organizationId) {
    console.error('No organizationId in subscription metadata');
    return;
  }

  // Get the price to determine the plan
  const priceId = stripeSubscription.items.data[0]?.price.id;
  let planSlug = 'free';

  // Match price ID to plan
  for (const [slug, plan] of Object.entries(PLANS)) {
    if (
      plan.stripePriceIdMonthly === priceId ||
      plan.stripePriceIdYearly === priceId
    ) {
      planSlug = slug;
      break;
    }
  }

  // Get plan ID from database
  const { data: plan } = await supabase
    .from('subscription_plans')
    .select('id')
    .eq('slug', planSlug)
    .single();

  if (!plan) {
    console.error(`Plan not found for slug: ${planSlug}`);
    return;
  }

  // Upsert subscription
  await supabase.from('subscriptions').upsert(
    {
      organization_id: organizationId,
      plan_id: plan.id,
      stripe_subscription_id: stripeSubscription.id,
      stripe_customer_id:
        typeof stripeSubscription.customer === 'string'
          ? stripeSubscription.customer
          : stripeSubscription.customer.id,
      status: stripeSubscription.status,
      current_period_start: new Date(
        stripeSubscription.current_period_start * 1000
      ).toISOString(),
      current_period_end: new Date(
        stripeSubscription.current_period_end * 1000
      ).toISOString(),
      cancel_at: stripeSubscription.cancel_at
        ? new Date(stripeSubscription.cancel_at * 1000).toISOString()
        : null,
      canceled_at: stripeSubscription.canceled_at
        ? new Date(stripeSubscription.canceled_at * 1000).toISOString()
        : null,
      trial_start: stripeSubscription.trial_start
        ? new Date(stripeSubscription.trial_start * 1000).toISOString()
        : null,
      trial_end: stripeSubscription.trial_end
        ? new Date(stripeSubscription.trial_end * 1000).toISOString()
        : null,
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: 'organization_id',
    }
  );

  // Update organization subscription status
  await supabase
    .from('organizations')
    .update({
      subscription_status: stripeSubscription.status === 'active' ? planSlug : 'free',
    })
    .eq('id', organizationId);
}

/**
 * Check if organization has access to a feature based on plan limits
 */
export async function checkPlanLimit(
  organizationId: string,
  limitType: keyof PlanConfig['limits'],
  currentCount: number
): Promise<{ allowed: boolean; limit: number; current: number }> {
  const subscriptionInfo = await getSubscriptionInfo(organizationId);
  const limit = subscriptionInfo?.plan.limits[limitType] ?? 0;

  return {
    allowed: limit === -1 || currentCount < limit,
    limit,
    current: currentCount,
  };
}
