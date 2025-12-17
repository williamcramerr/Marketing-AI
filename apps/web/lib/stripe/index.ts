/**
 * Stripe Module
 *
 * Stripe billing integration for subscription management.
 */

export { stripe, PLANS, getPlan, getAllPlans, isUnlimited, formatPrice } from './client';
export type { PlanConfig } from './client';

export {
  getOrCreateCustomer,
  createCheckoutSession,
  createPortalSession,
  getSubscriptionInfo,
  cancelSubscription,
  resumeSubscription,
  syncSubscriptionFromStripe,
  checkPlanLimit,
} from './subscriptions';
export type { SubscriptionInfo } from './subscriptions';
