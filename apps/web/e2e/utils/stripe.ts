import crypto from 'crypto';
import type Stripe from 'stripe';

/**
 * Stripe Test Utilities
 *
 * Provides utilities for testing Stripe webhooks and events.
 */

/**
 * Generate a Stripe webhook signature for testing
 *
 * This generates a valid signature that would pass Stripe's verification.
 */
export function generateStripeWebhookSignature(
  payload: string,
  secret: string,
  timestamp?: number
): string {
  const ts = timestamp || Math.floor(Date.now() / 1000);

  // Stripe signature format: timestamp.payload
  const signedPayload = `${ts}.${payload}`;

  // Compute HMAC SHA256 signature
  const signature = crypto
    .createHmac('sha256', secret)
    .update(signedPayload)
    .digest('hex');

  // Return in Stripe's format: t=timestamp,v1=signature
  return `t=${ts},v1=${signature}`;
}

/**
 * Generate an expired Stripe webhook signature for testing timestamp validation
 */
export function generateExpiredStripeWebhookSignature(
  payload: string,
  secret: string
): string {
  // Use a timestamp from 10 minutes ago (exceeds the 5-minute tolerance)
  const expiredTimestamp = Math.floor(Date.now() / 1000) - 600;
  return generateStripeWebhookSignature(payload, secret, expiredTimestamp);
}

/**
 * Generate a future Stripe webhook signature for testing timestamp validation
 */
export function generateFutureStripeWebhookSignature(
  payload: string,
  secret: string
): string {
  // Use a timestamp from 10 minutes in the future
  const futureTimestamp = Math.floor(Date.now() / 1000) + 600;
  return generateStripeWebhookSignature(payload, secret, futureTimestamp);
}

/**
 * Mock Stripe Event Builders
 */

/**
 * Create a mock checkout.session.completed event
 */
export function createMockCheckoutSessionCompletedEvent(
  organizationId: string,
  customerId = 'cus_test123',
  subscriptionId = 'sub_test123'
): Stripe.Event {
  return {
    id: `evt_test_${Date.now()}`,
    object: 'event',
    api_version: '2024-12-18.acacia',
    created: Math.floor(Date.now() / 1000),
    type: 'checkout.session.completed',
    data: {
      object: {
        id: `cs_test_${Date.now()}`,
        object: 'checkout.session',
        amount_total: 4900,
        currency: 'usd',
        customer: customerId,
        mode: 'subscription',
        payment_status: 'paid',
        status: 'complete',
        subscription: subscriptionId,
        metadata: {
          organizationId,
        },
      } as Stripe.Checkout.Session,
    },
    livemode: false,
    pending_webhooks: 1,
    request: {
      id: null,
      idempotency_key: null,
    },
  } as Stripe.Event;
}

/**
 * Create a mock customer.subscription.created event
 */
export function createMockSubscriptionCreatedEvent(
  organizationId: string,
  customerId = 'cus_test123',
  priceId = 'price_test123'
): Stripe.Event {
  const now = Math.floor(Date.now() / 1000);

  return {
    id: `evt_test_${Date.now()}`,
    object: 'event',
    api_version: '2024-12-18.acacia',
    created: now,
    type: 'customer.subscription.created',
    data: {
      object: {
        id: `sub_test_${Date.now()}`,
        object: 'subscription',
        customer: customerId,
        status: 'active',
        items: {
          object: 'list',
          data: [
            {
              id: `si_test_${Date.now()}`,
              object: 'subscription_item',
              price: {
                id: priceId,
                object: 'price',
                active: true,
                currency: 'usd',
                product: 'prod_test123',
                type: 'recurring',
                unit_amount: 4900,
                recurring: {
                  interval: 'month',
                  interval_count: 1,
                },
              } as Stripe.Price,
              quantity: 1,
            } as Stripe.SubscriptionItem,
          ],
          has_more: false,
          total_count: 1,
          url: '/v1/subscription_items',
        },
        current_period_start: now,
        current_period_end: now + 2592000, // 30 days
        metadata: {
          organizationId,
        },
      } as Stripe.Subscription,
    },
    livemode: false,
    pending_webhooks: 1,
    request: {
      id: null,
      idempotency_key: null,
    },
  } as Stripe.Event;
}

/**
 * Create a mock customer.subscription.updated event
 */
export function createMockSubscriptionUpdatedEvent(
  organizationId: string,
  subscriptionId = 'sub_test123',
  customerId = 'cus_test123',
  status: Stripe.Subscription.Status = 'active'
): Stripe.Event {
  const now = Math.floor(Date.now() / 1000);

  return {
    id: `evt_test_${Date.now()}`,
    object: 'event',
    api_version: '2024-12-18.acacia',
    created: now,
    type: 'customer.subscription.updated',
    data: {
      object: {
        id: subscriptionId,
        object: 'subscription',
        customer: customerId,
        status,
        items: {
          object: 'list',
          data: [
            {
              id: `si_test_${Date.now()}`,
              object: 'subscription_item',
              price: {
                id: 'price_test123',
                object: 'price',
                active: true,
                currency: 'usd',
                product: 'prod_test123',
                type: 'recurring',
                unit_amount: 4900,
                recurring: {
                  interval: 'month',
                  interval_count: 1,
                },
              } as Stripe.Price,
              quantity: 1,
            } as Stripe.SubscriptionItem,
          ],
          has_more: false,
          total_count: 1,
          url: '/v1/subscription_items',
        },
        current_period_start: now,
        current_period_end: now + 2592000,
        cancel_at_period_end: false,
        metadata: {
          organizationId,
        },
      } as Stripe.Subscription,
    },
    livemode: false,
    pending_webhooks: 1,
    request: {
      id: null,
      idempotency_key: null,
    },
  } as Stripe.Event;
}

/**
 * Create a mock customer.subscription.deleted event
 */
export function createMockSubscriptionDeletedEvent(
  organizationId: string,
  subscriptionId = 'sub_test123',
  customerId = 'cus_test123'
): Stripe.Event {
  const now = Math.floor(Date.now() / 1000);

  return {
    id: `evt_test_${Date.now()}`,
    object: 'event',
    api_version: '2024-12-18.acacia',
    created: now,
    type: 'customer.subscription.deleted',
    data: {
      object: {
        id: subscriptionId,
        object: 'subscription',
        customer: customerId,
        status: 'canceled',
        items: {
          object: 'list',
          data: [
            {
              id: `si_test_${Date.now()}`,
              object: 'subscription_item',
              price: {
                id: 'price_test123',
                object: 'price',
                active: true,
                currency: 'usd',
                product: 'prod_test123',
                type: 'recurring',
                unit_amount: 4900,
                recurring: {
                  interval: 'month',
                  interval_count: 1,
                },
              } as Stripe.Price,
              quantity: 1,
            } as Stripe.SubscriptionItem,
          ],
          has_more: false,
          total_count: 1,
          url: '/v1/subscription_items',
        },
        current_period_start: now - 2592000,
        current_period_end: now,
        canceled_at: now,
        ended_at: now,
        metadata: {
          organizationId,
        },
      } as Stripe.Subscription,
    },
    livemode: false,
    pending_webhooks: 1,
    request: {
      id: null,
      idempotency_key: null,
    },
  } as Stripe.Event;
}

/**
 * Create a mock invoice.paid event
 */
export function createMockInvoicePaidEvent(
  organizationId: string,
  subscriptionId = 'sub_test123',
  customerId = 'cus_test123',
  amountPaid = 4900
): Stripe.Event {
  const now = Math.floor(Date.now() / 1000);

  return {
    id: `evt_test_${Date.now()}`,
    object: 'event',
    api_version: '2024-12-18.acacia',
    created: now,
    type: 'invoice.paid',
    data: {
      object: {
        id: `in_test_${Date.now()}`,
        object: 'invoice',
        customer: customerId,
        subscription: subscriptionId,
        amount_paid: amountPaid,
        amount_due: amountPaid,
        currency: 'usd',
        status: 'paid',
        hosted_invoice_url: `https://invoice.stripe.com/i/test_${Date.now()}`,
        attempt_count: 1,
        next_payment_attempt: null,
        metadata: {},
      } as Stripe.Invoice,
    },
    livemode: false,
    pending_webhooks: 1,
    request: {
      id: null,
      idempotency_key: null,
    },
  } as Stripe.Event;
}

/**
 * Create a mock invoice.payment_failed event
 */
export function createMockInvoicePaymentFailedEvent(
  organizationId: string,
  subscriptionId = 'sub_test123',
  customerId = 'cus_test123',
  amountDue = 4900,
  attemptCount = 1
): Stripe.Event {
  const now = Math.floor(Date.now() / 1000);

  return {
    id: `evt_test_${Date.now()}`,
    object: 'event',
    api_version: '2024-12-18.acacia',
    created: now,
    type: 'invoice.payment_failed',
    data: {
      object: {
        id: `in_test_${Date.now()}`,
        object: 'invoice',
        customer: customerId,
        subscription: subscriptionId,
        amount_paid: 0,
        amount_due: amountDue,
        currency: 'usd',
        status: 'open',
        hosted_invoice_url: `https://invoice.stripe.com/i/test_${Date.now()}`,
        attempt_count: attemptCount,
        next_payment_attempt: now + 86400, // 24 hours from now
        metadata: {},
      } as Stripe.Invoice,
    },
    livemode: false,
    pending_webhooks: 1,
    request: {
      id: null,
      idempotency_key: null,
    },
  } as Stripe.Event;
}

/**
 * Create a mock Stripe subscription object for retrieving in tests
 */
export function createMockStripeSubscription(
  organizationId: string,
  subscriptionId = 'sub_test123',
  customerId = 'cus_test123',
  priceId = 'price_test123',
  status: Stripe.Subscription.Status = 'active'
): Stripe.Subscription {
  const now = Math.floor(Date.now() / 1000);

  return {
    id: subscriptionId,
    object: 'subscription',
    customer: customerId,
    status,
    items: {
      object: 'list',
      data: [
        {
          id: `si_test_${Date.now()}`,
          object: 'subscription_item',
          price: {
            id: priceId,
            object: 'price',
            active: true,
            currency: 'usd',
            product: 'prod_test123',
            type: 'recurring',
            unit_amount: 4900,
            recurring: {
              interval: 'month',
              interval_count: 1,
            },
          } as Stripe.Price,
          quantity: 1,
        } as Stripe.SubscriptionItem,
      ],
      has_more: false,
      total_count: 1,
      url: '/v1/subscription_items',
    },
    current_period_start: now,
    current_period_end: now + 2592000,
    cancel_at: null,
    cancel_at_period_end: false,
    canceled_at: null,
    ended_at: null,
    trial_start: null,
    trial_end: null,
    metadata: {
      organizationId,
    },
  } as Stripe.Subscription;
}

/**
 * Create webhook payload string from event
 */
export function createWebhookPayload(event: Stripe.Event): string {
  return JSON.stringify(event);
}
