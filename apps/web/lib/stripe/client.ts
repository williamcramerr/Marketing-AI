/**
 * Stripe Client Configuration
 *
 * Initializes and exports the Stripe client for server-side usage.
 */

import Stripe from 'stripe';

let _stripe: Stripe | null = null;

function getStripeClient(): Stripe {
  if (!_stripe) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY is not defined');
    }
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2025-11-17.clover',
      typescript: true,
    });
  }
  return _stripe;
}

export const stripe = new Proxy({} as Stripe, {
  get(_, prop) {
    return getStripeClient()[prop as keyof Stripe];
  },
});

/**
 * Plan configuration with Stripe price IDs
 */
export interface PlanConfig {
  slug: 'free' | 'pro' | 'enterprise';
  name: string;
  description: string;
  priceMonthly: number; // in cents
  priceYearly: number; // in cents
  stripePriceIdMonthly?: string;
  stripePriceIdYearly?: string;
  limits: {
    maxProducts: number;
    maxCampaigns: number;
    maxConnectors: number;
    maxTasksPerMonth: number;
    aiTokensMonthly: number;
  };
  aiTokenOveragePricePer1k: number; // in cents
  features: string[];
}

export const PLANS: Record<string, PlanConfig> = {
  free: {
    slug: 'free',
    name: 'Free',
    description: 'Get started with Marketing Pilot AI',
    priceMonthly: 0,
    priceYearly: 0,
    limits: {
      maxProducts: 1,
      maxCampaigns: 3,
      maxConnectors: 2,
      maxTasksPerMonth: 100,
      aiTokensMonthly: 50000,
    },
    aiTokenOveragePricePer1k: 0, // No overage on free
    features: [
      '1 product',
      '3 campaigns',
      '2 connectors',
      '50K AI tokens/month',
      'Community support',
    ],
  },
  pro: {
    slug: 'pro',
    name: 'Pro',
    description: 'For growing marketing teams',
    priceMonthly: 4900,
    priceYearly: 47000, // ~20% discount
    stripePriceIdMonthly: process.env.STRIPE_PRO_MONTHLY_PRICE_ID,
    stripePriceIdYearly: process.env.STRIPE_PRO_YEARLY_PRICE_ID,
    limits: {
      maxProducts: 10,
      maxCampaigns: 50,
      maxConnectors: 10,
      maxTasksPerMonth: 1000,
      aiTokensMonthly: 500000,
    },
    aiTokenOveragePricePer1k: 50, // $0.50 per 1k tokens
    features: [
      '10 products',
      '50 campaigns',
      '10 connectors',
      '500K AI tokens/month',
      'Priority support',
      'API access',
      'Analytics dashboard',
    ],
  },
  enterprise: {
    slug: 'enterprise',
    name: 'Enterprise',
    description: 'For large organizations',
    priceMonthly: 29900,
    priceYearly: 287000, // ~20% discount
    stripePriceIdMonthly: process.env.STRIPE_ENTERPRISE_MONTHLY_PRICE_ID,
    stripePriceIdYearly: process.env.STRIPE_ENTERPRISE_YEARLY_PRICE_ID,
    limits: {
      maxProducts: -1, // unlimited
      maxCampaigns: -1,
      maxConnectors: -1,
      maxTasksPerMonth: -1,
      aiTokensMonthly: 5000000,
    },
    aiTokenOveragePricePer1k: 25, // $0.25 per 1k tokens
    features: [
      'Unlimited products',
      'Unlimited campaigns',
      'Unlimited connectors',
      '5M AI tokens/month',
      'Dedicated support',
      'Custom integrations',
      'SLA guarantee',
      'SSO',
    ],
  },
};

/**
 * Get plan by slug
 */
export function getPlan(slug: string): PlanConfig | undefined {
  return PLANS[slug];
}

/**
 * Get all available plans
 */
export function getAllPlans(): PlanConfig[] {
  return Object.values(PLANS);
}

/**
 * Check if a limit is unlimited (-1)
 */
export function isUnlimited(limit: number): boolean {
  return limit === -1;
}

/**
 * Format price for display
 */
export function formatPrice(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100);
}
