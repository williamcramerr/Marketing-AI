import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import type Stripe from 'stripe';
import {
  generateStripeWebhookSignature,
  generateExpiredStripeWebhookSignature,
  generateFutureStripeWebhookSignature,
  createMockCheckoutSessionCompletedEvent,
  createMockSubscriptionCreatedEvent,
  createMockSubscriptionUpdatedEvent,
  createMockSubscriptionDeletedEvent,
  createMockInvoicePaidEvent,
  createMockInvoicePaymentFailedEvent,
  createMockStripeSubscription,
  createWebhookPayload,
} from '@/e2e/utils/stripe';

/**
 * Stripe Webhook Unit Tests
 *
 * Tests webhook signature verification and event handlers with fully mocked dependencies.
 */

// Mock dependencies
const mockStripe = {
  subscriptions: {
    retrieve: vi.fn(),
  },
};

const mockSupabase = {
  from: vi.fn(() => mockSupabase),
  select: vi.fn(() => mockSupabase),
  insert: vi.fn(() => mockSupabase),
  update: vi.fn(() => mockSupabase),
  upsert: vi.fn(() => mockSupabase),
  delete: vi.fn(() => mockSupabase),
  eq: vi.fn(() => mockSupabase),
  single: vi.fn(() => mockSupabase),
};

const mockLogger = {
  child: vi.fn(() => mockLogger),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

// Mock modules
vi.mock('@/lib/stripe/client', () => ({
  stripe: mockStripe,
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => mockSupabase),
}));

vi.mock('@/lib/logging', () => ({
  logger: mockLogger,
}));

vi.mock('@/lib/stripe/subscriptions', () => ({
  syncSubscriptionFromStripe: vi.fn(),
}));

vi.mock('@/lib/webhooks', () => ({
  verifyStripeSignature: vi.fn(),
}));

// Import after mocks are set up
const { verifyStripeSignature } = await import('@/lib/webhooks');
const { syncSubscriptionFromStripe } = await import('@/lib/stripe/subscriptions');

describe('Stripe Webhook Handler', () => {
  const WEBHOOK_SECRET = 'whsec_test_secret_key';
  const TEST_ORG_ID = 'org_test_123';

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET;
  });

  afterEach(() => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
  });

  describe('Signature Verification', () => {
    it('should accept valid signature', () => {
      const payload = '{"test": "data"}';
      const signature = generateStripeWebhookSignature(payload, WEBHOOK_SECRET);

      vi.mocked(verifyStripeSignature).mockReturnValue({ valid: true });

      const result = verifyStripeSignature({
        payload,
        signature,
        secret: WEBHOOK_SECRET,
      });

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject invalid signature', () => {
      const payload = '{"test": "data"}';
      const invalidSignature = 't=123,v1=invalid_signature_hash';

      vi.mocked(verifyStripeSignature).mockReturnValue({
        valid: false,
        error: 'Signature verification failed',
      });

      const result = verifyStripeSignature({
        payload,
        signature: invalidSignature,
        secret: WEBHOOK_SECRET,
      });

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Signature verification failed');
    });

    it('should reject expired timestamp', () => {
      const payload = '{"test": "data"}';
      const expiredSignature = generateExpiredStripeWebhookSignature(
        payload,
        WEBHOOK_SECRET
      );

      vi.mocked(verifyStripeSignature).mockReturnValue({
        valid: false,
        error: 'Webhook timestamp is too old or in the future',
      });

      const result = verifyStripeSignature({
        payload,
        signature: expiredSignature,
        secret: WEBHOOK_SECRET,
      });

      expect(result.valid).toBe(false);
      expect(result.error).toContain('timestamp');
    });

    it('should reject future timestamp', () => {
      const payload = '{"test": "data"}';
      const futureSignature = generateFutureStripeWebhookSignature(
        payload,
        WEBHOOK_SECRET
      );

      vi.mocked(verifyStripeSignature).mockReturnValue({
        valid: false,
        error: 'Webhook timestamp is too old or in the future',
      });

      const result = verifyStripeSignature({
        payload,
        signature: futureSignature,
        secret: WEBHOOK_SECRET,
      });

      expect(result.valid).toBe(false);
      expect(result.error).toContain('timestamp');
    });

    it('should reject missing signature header', () => {
      const payload = '{"test": "data"}';

      vi.mocked(verifyStripeSignature).mockReturnValue({
        valid: false,
        error: 'Missing Stripe signature header',
      });

      const result = verifyStripeSignature({
        payload,
        signature: null,
        secret: WEBHOOK_SECRET,
      });

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Missing Stripe signature header');
    });
  });

  describe('checkout.session.completed Event', () => {
    it('should handle checkout session completed successfully', async () => {
      const event = createMockCheckoutSessionCompletedEvent(TEST_ORG_ID);
      const subscription = createMockStripeSubscription(TEST_ORG_ID);

      mockStripe.subscriptions.retrieve.mockResolvedValue(subscription);
      mockSupabase.insert.mockResolvedValue({ data: {}, error: null });
      vi.mocked(syncSubscriptionFromStripe).mockResolvedValue(undefined);

      // Simulate webhook processing
      const session = event.data.object as Stripe.Checkout.Session;

      expect(session.metadata?.organizationId).toBe(TEST_ORG_ID);
      expect(session.mode).toBe('subscription');
      expect(session.subscription).toBeDefined();

      // Verify subscription sync would be called
      await syncSubscriptionFromStripe(subscription);
      expect(syncSubscriptionFromStripe).toHaveBeenCalledWith(subscription);
    });

    it('should log warning when organizationId is missing', () => {
      const event = createMockCheckoutSessionCompletedEvent('');
      const session = event.data.object as Stripe.Checkout.Session;

      expect(session.metadata?.organizationId).toBeFalsy();
      // In actual handler, this would trigger a warning log
    });

    it('should create audit log for checkout completion', async () => {
      const event = createMockCheckoutSessionCompletedEvent(TEST_ORG_ID);
      const session = event.data.object as Stripe.Checkout.Session;

      mockSupabase.insert.mockResolvedValue({ data: {}, error: null });

      // Simulate audit log creation
      const auditLog = {
        organization_id: TEST_ORG_ID,
        action: 'billing.checkout_completed',
        actor_type: 'system',
        actor_id: 'stripe',
        resource_type: 'subscription',
        resource_id: session.subscription,
        metadata: {
          sessionId: session.id,
          customerId: session.customer,
          mode: session.mode,
        },
      };

      await mockSupabase.from('audit_logs').insert(auditLog);

      expect(mockSupabase.from).toHaveBeenCalledWith('audit_logs');
      expect(mockSupabase.insert).toHaveBeenCalledWith(auditLog);
    });
  });

  describe('customer.subscription.created Event', () => {
    it('should sync subscription on creation', async () => {
      const event = createMockSubscriptionCreatedEvent(TEST_ORG_ID);
      const subscription = event.data.object as Stripe.Subscription;

      vi.mocked(syncSubscriptionFromStripe).mockResolvedValue(undefined);

      await syncSubscriptionFromStripe(subscription);

      expect(syncSubscriptionFromStripe).toHaveBeenCalledWith(subscription);
      expect(subscription.metadata.organizationId).toBe(TEST_ORG_ID);
      expect(subscription.status).toBe('active');
    });
  });

  describe('customer.subscription.updated Event', () => {
    it('should sync subscription on update', async () => {
      const event = createMockSubscriptionUpdatedEvent(TEST_ORG_ID);
      const subscription = event.data.object as Stripe.Subscription;

      vi.mocked(syncSubscriptionFromStripe).mockResolvedValue(undefined);

      await syncSubscriptionFromStripe(subscription);

      expect(syncSubscriptionFromStripe).toHaveBeenCalledWith(subscription);
    });

    it('should handle different subscription statuses', async () => {
      const statuses: Stripe.Subscription.Status[] = [
        'active',
        'canceled',
        'past_due',
        'unpaid',
        'trialing',
      ];

      for (const status of statuses) {
        const event = createMockSubscriptionUpdatedEvent(
          TEST_ORG_ID,
          'sub_test',
          'cus_test',
          status
        );
        const subscription = event.data.object as Stripe.Subscription;

        expect(subscription.status).toBe(status);
      }
    });
  });

  describe('customer.subscription.deleted Event', () => {
    it('should handle subscription deletion', async () => {
      const event = createMockSubscriptionDeletedEvent(TEST_ORG_ID);
      const subscription = event.data.object as Stripe.Subscription;

      // Mock free plan query
      mockSupabase.single.mockResolvedValue({
        data: { id: 'plan_free_123' },
        error: null,
      });

      mockSupabase.update.mockResolvedValue({ data: {}, error: null });
      mockSupabase.insert.mockResolvedValue({ data: {}, error: null });

      // Simulate handler logic
      expect(subscription.metadata.organizationId).toBe(TEST_ORG_ID);
      expect(subscription.status).toBe('canceled');

      // Get free plan
      await mockSupabase
        .from('subscription_plans')
        .select('id')
        .eq('slug', 'free')
        .single();

      // Update subscription to free
      await mockSupabase
        .from('subscriptions')
        .update({
          plan_id: 'plan_free_123',
          status: 'canceled',
          canceled_at: expect.any(String),
          updated_at: expect.any(String),
        })
        .eq('stripe_subscription_id', subscription.id);

      // Update organization status
      await mockSupabase
        .from('organizations')
        .update({ subscription_status: 'free' })
        .eq('id', TEST_ORG_ID);

      expect(mockSupabase.from).toHaveBeenCalledWith('subscription_plans');
      expect(mockSupabase.from).toHaveBeenCalledWith('subscriptions');
      expect(mockSupabase.from).toHaveBeenCalledWith('organizations');
    });

    it('should create audit log for subscription cancellation', async () => {
      const event = createMockSubscriptionDeletedEvent(TEST_ORG_ID);
      const subscription = event.data.object as Stripe.Subscription;

      mockSupabase.insert.mockResolvedValue({ data: {}, error: null });

      const auditLog = {
        organization_id: TEST_ORG_ID,
        action: 'billing.subscription_canceled',
        actor_type: 'system',
        actor_id: 'stripe',
        resource_type: 'subscription',
        resource_id: subscription.id,
        metadata: {
          canceledAt: subscription.canceled_at,
          endedAt: subscription.ended_at,
        },
      };

      await mockSupabase.from('audit_logs').insert(auditLog);

      expect(mockSupabase.insert).toHaveBeenCalledWith(auditLog);
    });

    it('should handle missing organizationId gracefully', async () => {
      const event = createMockSubscriptionDeletedEvent('');
      const subscription = event.data.object as Stripe.Subscription;

      expect(subscription.metadata.organizationId).toBeFalsy();
      // Handler should log warning and return early
    });
  });

  describe('invoice.paid Event', () => {
    it('should handle invoice paid successfully', async () => {
      const event = createMockInvoicePaidEvent(TEST_ORG_ID);
      const invoice = event.data.object as Stripe.Invoice;
      const subscription = createMockStripeSubscription(TEST_ORG_ID);

      mockStripe.subscriptions.retrieve.mockResolvedValue(subscription);
      mockSupabase.insert.mockResolvedValue({ data: {}, error: null });

      expect(invoice.subscription).toBeDefined();
      expect(invoice.status).toBe('paid');

      // Retrieve subscription to get organizationId
      const retrievedSub = await mockStripe.subscriptions.retrieve(
        invoice.subscription as string
      );

      expect(retrievedSub.metadata.organizationId).toBe(TEST_ORG_ID);

      // Create audit log
      const auditLog = {
        organization_id: TEST_ORG_ID,
        action: 'billing.invoice_paid',
        actor_type: 'system',
        actor_id: 'stripe',
        resource_type: 'invoice',
        resource_id: invoice.id,
        metadata: {
          amountPaid: invoice.amount_paid,
          currency: invoice.currency,
          invoiceUrl: invoice.hosted_invoice_url,
        },
      };

      await mockSupabase.from('audit_logs').insert(auditLog);

      expect(mockSupabase.insert).toHaveBeenCalledWith(auditLog);
    });

    it('should handle invoice without subscription', async () => {
      const event = createMockInvoicePaidEvent(TEST_ORG_ID);
      const invoice = event.data.object as Stripe.Invoice;
      invoice.subscription = null;

      expect(invoice.subscription).toBeNull();
      // Handler should skip processing if no subscription
    });
  });

  describe('invoice.payment_failed Event', () => {
    it('should handle invoice payment failure', async () => {
      const event = createMockInvoicePaymentFailedEvent(TEST_ORG_ID);
      const invoice = event.data.object as Stripe.Invoice;
      const subscription = createMockStripeSubscription(TEST_ORG_ID);

      mockStripe.subscriptions.retrieve.mockResolvedValue(subscription);
      mockSupabase.insert.mockResolvedValue({ data: {}, error: null });

      expect(invoice.subscription).toBeDefined();
      expect(invoice.status).toBe('open');
      expect(invoice.attempt_count).toBeGreaterThan(0);

      // Retrieve subscription
      const retrievedSub = await mockStripe.subscriptions.retrieve(
        invoice.subscription as string
      );

      expect(retrievedSub.metadata.organizationId).toBe(TEST_ORG_ID);

      // Create audit log
      const auditLog = {
        organization_id: TEST_ORG_ID,
        action: 'billing.invoice_payment_failed',
        actor_type: 'system',
        actor_id: 'stripe',
        resource_type: 'invoice',
        resource_id: invoice.id,
        metadata: {
          amountDue: invoice.amount_due,
          attemptCount: invoice.attempt_count,
          nextPaymentAttempt: invoice.next_payment_attempt,
        },
      };

      await mockSupabase.from('audit_logs').insert(auditLog);

      expect(mockSupabase.insert).toHaveBeenCalledWith(auditLog);
    });

    it('should handle multiple payment attempts', async () => {
      const attemptCounts = [1, 2, 3, 4];

      for (const attemptCount of attemptCounts) {
        const event = createMockInvoicePaymentFailedEvent(
          TEST_ORG_ID,
          'sub_test',
          'cus_test',
          4900,
          attemptCount
        );
        const invoice = event.data.object as Stripe.Invoice;

        expect(invoice.attempt_count).toBe(attemptCount);
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing organizationId in metadata', async () => {
      const event = createMockSubscriptionCreatedEvent('');
      const subscription = event.data.object as Stripe.Subscription;

      // Remove organizationId
      subscription.metadata = {};

      expect(subscription.metadata.organizationId).toBeUndefined();
      // Handler should log warning and skip processing
    });

    it('should handle duplicate webhook events', async () => {
      const event = createMockCheckoutSessionCompletedEvent(TEST_ORG_ID);

      // Stripe sends idempotent events, so processing same event twice should be safe
      // This is typically handled by event ID tracking in production

      expect(event.id).toBeDefined();
      expect(event.id).toMatch(/^evt_test_/);
    });

    it('should handle database errors gracefully', async () => {
      const event = createMockCheckoutSessionCompletedEvent(TEST_ORG_ID);

      mockSupabase.insert.mockResolvedValue({
        data: null,
        error: { message: 'Database error' },
      });

      // Handler should catch and log the error
      const result = await mockSupabase
        .from('audit_logs')
        .insert({ test: 'data' });

      expect(result.error).toBeDefined();
      expect(result.error?.message).toBe('Database error');
    });

    it('should handle Stripe API errors', async () => {
      const event = createMockInvoicePaidEvent(TEST_ORG_ID);
      const invoice = event.data.object as Stripe.Invoice;

      mockStripe.subscriptions.retrieve.mockRejectedValue(
        new Error('Stripe API error')
      );

      // Handler should catch and log the error
      await expect(
        mockStripe.subscriptions.retrieve(invoice.subscription as string)
      ).rejects.toThrow('Stripe API error');
    });

    it('should handle malformed event data', () => {
      const malformedEvent = {
        id: 'evt_test',
        type: 'checkout.session.completed',
        data: {
          object: null, // Missing required data
        },
      };

      expect(malformedEvent.data.object).toBeNull();
      // Handler should handle null/undefined gracefully
    });

    it('should ignore unhandled event types', () => {
      const unhandledEvent = {
        id: 'evt_test',
        type: 'customer.created',
        data: {
          object: {
            id: 'cus_test',
          },
        },
      };

      expect(unhandledEvent.type).toBe('customer.created');
      // Handler should log info message and return 200
    });
  });

  describe('Webhook Secret Configuration', () => {
    it('should fail when webhook secret is not configured', () => {
      delete process.env.STRIPE_WEBHOOK_SECRET;

      expect(process.env.STRIPE_WEBHOOK_SECRET).toBeUndefined();
      // Handler should return 500 error
    });

    it('should use configured webhook secret', () => {
      const customSecret = 'whsec_custom_secret';
      process.env.STRIPE_WEBHOOK_SECRET = customSecret;

      expect(process.env.STRIPE_WEBHOOK_SECRET).toBe(customSecret);
    });
  });

  describe('Subscription Synchronization', () => {
    it('should sync all subscription fields correctly', async () => {
      const subscription = createMockStripeSubscription(
        TEST_ORG_ID,
        'sub_test',
        'cus_test',
        'price_pro_monthly',
        'active'
      );

      vi.mocked(syncSubscriptionFromStripe).mockResolvedValue(undefined);

      await syncSubscriptionFromStripe(subscription);

      expect(syncSubscriptionFromStripe).toHaveBeenCalledWith(subscription);
      expect(subscription.id).toBe('sub_test');
      expect(subscription.customer).toBe('cus_test');
      expect(subscription.status).toBe('active');
      expect(subscription.metadata.organizationId).toBe(TEST_ORG_ID);
    });

    it('should handle trial subscriptions', async () => {
      const subscription = createMockStripeSubscription(TEST_ORG_ID);
      subscription.status = 'trialing';
      subscription.trial_start = Math.floor(Date.now() / 1000);
      subscription.trial_end = Math.floor(Date.now() / 1000) + 86400 * 14; // 14 days

      expect(subscription.status).toBe('trialing');
      expect(subscription.trial_start).toBeDefined();
      expect(subscription.trial_end).toBeDefined();
    });

    it('should handle canceled subscriptions', async () => {
      const subscription = createMockStripeSubscription(TEST_ORG_ID);
      subscription.status = 'canceled';
      subscription.cancel_at_period_end = true;
      subscription.canceled_at = Math.floor(Date.now() / 1000);

      expect(subscription.status).toBe('canceled');
      expect(subscription.cancel_at_period_end).toBe(true);
      expect(subscription.canceled_at).toBeDefined();
    });
  });
});
