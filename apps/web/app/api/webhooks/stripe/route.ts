/**
 * Stripe Webhook Handler
 *
 * Handles webhook events from Stripe for subscription management:
 * - checkout.session.completed
 * - customer.subscription.created
 * - customer.subscription.updated
 * - customer.subscription.deleted
 * - invoice.paid
 * - invoice.payment_failed
 */

import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe/client';
import { syncSubscriptionFromStripe } from '@/lib/stripe/subscriptions';
import { verifyStripeSignature } from '@/lib/webhooks';
import { createAdminClient } from '@/lib/supabase/admin';
import { logger } from '@/lib/logging';
import type Stripe from 'stripe';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const webhookLogger = logger.child({ source: 'stripe-webhook' });

  try {
    const body = await request.text();
    const signature = request.headers.get('stripe-signature');
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      webhookLogger.error('STRIPE_WEBHOOK_SECRET not configured');
      return NextResponse.json(
        { error: 'Webhook secret not configured' },
        { status: 500 }
      );
    }

    // Verify webhook signature
    const verification = verifyStripeSignature({
      payload: body,
      signature,
      secret: webhookSecret,
    });

    if (!verification.valid) {
      webhookLogger.error('Invalid webhook signature', { error: verification.error });
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      );
    }

    // Parse the event (already verified)
    const event = JSON.parse(body) as Stripe.Event;

    webhookLogger.info('Processing Stripe webhook', {
      eventType: event.type,
      eventId: event.id,
    });

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutCompleted(session, webhookLogger);
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        await syncSubscriptionFromStripe(subscription);
        webhookLogger.info('Subscription synced', {
          subscriptionId: subscription.id,
          status: subscription.status,
        });
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(subscription, webhookLogger);
        break;
      }

      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoicePaid(invoice, webhookLogger);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoicePaymentFailed(invoice, webhookLogger);
        break;
      }

      default:
        webhookLogger.info('Unhandled event type', { eventType: event.type });
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    webhookLogger.error('Webhook processing error', error as Error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

/**
 * Handle checkout.session.completed event
 */
async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session,
  log: ReturnType<typeof logger.child>
) {
  const supabase = createAdminClient();
  const organizationId = session.metadata?.organizationId;

  if (!organizationId) {
    log.warn('No organizationId in checkout session metadata');
    return;
  }

  // If this was a subscription checkout, the subscription webhook will handle the rest
  if (session.mode === 'subscription' && session.subscription) {
    const subscription = await stripe.subscriptions.retrieve(
      session.subscription as string
    );
    await syncSubscriptionFromStripe(subscription);
  }

  // Log the event
  await supabase.from('audit_logs').insert({
    organization_id: organizationId,
    action: 'billing.checkout_completed',
    actor_type: 'system',
    actor_id: 'stripe',
    resource_type: 'subscription',
    resource_id: session.subscription as string,
    metadata: {
      sessionId: session.id,
      customerId: session.customer,
      mode: session.mode,
    },
  });

  log.info('Checkout completed', {
    sessionId: session.id,
    organizationId,
  });
}

/**
 * Handle customer.subscription.deleted event
 */
async function handleSubscriptionDeleted(
  subscription: Stripe.Subscription,
  log: ReturnType<typeof logger.child>
) {
  const supabase = createAdminClient();
  const organizationId = subscription.metadata.organizationId;

  if (!organizationId) {
    log.warn('No organizationId in subscription metadata');
    return;
  }

  // Get free plan ID
  const { data: freePlan } = await supabase
    .from('subscription_plans')
    .select('id')
    .eq('slug', 'free')
    .single();

  // Update to free plan
  await supabase
    .from('subscriptions')
    .update({
      plan_id: freePlan?.id,
      status: 'canceled',
      canceled_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_subscription_id', subscription.id);

  // Update organization status
  await supabase
    .from('organizations')
    .update({ subscription_status: 'free' })
    .eq('id', organizationId);

  // Log the event
  await supabase.from('audit_logs').insert({
    organization_id: organizationId,
    action: 'billing.subscription_canceled',
    actor_type: 'system',
    actor_id: 'stripe',
    resource_type: 'subscription',
    resource_id: subscription.id,
    metadata: {
      canceledAt: subscription.canceled_at,
      endedAt: subscription.ended_at,
    },
  });

  log.info('Subscription deleted', {
    subscriptionId: subscription.id,
    organizationId,
  });
}

/**
 * Handle invoice.paid event
 */
async function handleInvoicePaid(
  invoice: Stripe.Invoice,
  log: ReturnType<typeof logger.child>
) {
  const supabase = createAdminClient();

  // Get organization from subscription metadata
  if (invoice.subscription) {
    const subscription = await stripe.subscriptions.retrieve(
      invoice.subscription as string
    );
    const organizationId = subscription.metadata.organizationId;

    if (organizationId) {
      // Log the payment
      await supabase.from('audit_logs').insert({
        organization_id: organizationId,
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
      });

      log.info('Invoice paid', {
        invoiceId: invoice.id,
        organizationId,
        amount: invoice.amount_paid,
      });
    }
  }
}

/**
 * Handle invoice.payment_failed event
 */
async function handleInvoicePaymentFailed(
  invoice: Stripe.Invoice,
  log: ReturnType<typeof logger.child>
) {
  const supabase = createAdminClient();

  if (invoice.subscription) {
    const subscription = await stripe.subscriptions.retrieve(
      invoice.subscription as string
    );
    const organizationId = subscription.metadata.organizationId;

    if (organizationId) {
      // Log the failed payment
      await supabase.from('audit_logs').insert({
        organization_id: organizationId,
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
      });

      log.warn('Invoice payment failed', {
        invoiceId: invoice.id,
        organizationId,
        attemptCount: invoice.attempt_count,
      });

      // TODO: Send notification email to organization admins
    }
  }
}
