/**
 * Test data generators for k6 load tests
 */

import { randomString, randomIntBetween } from 'k6';

/**
 * Generate a random task payload
 *
 * @param {string} campaignId - Campaign ID
 * @param {string} type - Task type
 * @returns {object} Task payload
 */
export function generateTaskPayload(campaignId, type = null) {
  const taskTypes = [
    'linkedin_post',
    'twitter_post',
    'email_campaign',
    'content_generation',
    'analytics_report',
    'competitor_analysis',
  ];

  const selectedType = type || taskTypes[randomIntBetween(0, taskTypes.length - 1)];

  return {
    campaign_id: campaignId,
    type: selectedType,
    title: `Load Test Task - ${selectedType} - ${randomString(8)}`,
    description: `Automated load test task created at ${new Date().toISOString()}`,
    scheduled_for: new Date(Date.now() + randomIntBetween(0, 86400000)).toISOString(),
    input_data: generateTaskInputData(selectedType),
    priority: randomIntBetween(1, 100),
    dry_run: randomIntBetween(0, 10) < 2, // 20% chance of dry run
    trigger_workflow: randomIntBetween(0, 10) < 7, // 70% chance of triggering workflow
  };
}

/**
 * Generate input data for specific task types
 *
 * @param {string} taskType - Type of task
 * @returns {object} Input data
 */
function generateTaskInputData(taskType) {
  const inputDataMap = {
    linkedin_post: {
      content: `Load test LinkedIn post - ${randomString(50)}`,
      tone: ['professional', 'casual', 'formal'][randomIntBetween(0, 2)],
      hashtags: ['#loadtest', '#automation', '#marketing'],
    },
    twitter_post: {
      content: `Load test tweet - ${randomString(100)}`,
      include_image: randomIntBetween(0, 1) === 1,
    },
    email_campaign: {
      subject: `Load Test Email - ${randomString(20)}`,
      template: 'default',
      recipients_count: randomIntBetween(100, 1000),
    },
    content_generation: {
      topic: `Load Test Topic - ${randomString(30)}`,
      word_count: randomIntBetween(500, 2000),
      style: ['blog', 'article', 'social'][randomIntBetween(0, 2)],
    },
    analytics_report: {
      date_range: '30d',
      metrics: ['views', 'clicks', 'conversions'],
    },
    competitor_analysis: {
      competitors: ['competitor1.com', 'competitor2.com'],
      analysis_type: 'content',
    },
  };

  return inputDataMap[taskType] || {};
}

/**
 * Generate query parameters for task listing
 *
 * @returns {string} Query string
 */
export function generateTaskListQuery() {
  const limit = [10, 20, 50, 100][randomIntBetween(0, 3)];
  const offset = randomIntBetween(0, 5) * limit;

  const params = [`limit=${limit}`, `offset=${offset}`];

  // Randomly add filters
  if (randomIntBetween(0, 10) < 3) {
    // 30% chance
    const statuses = ['queued', 'running', 'completed', 'failed'];
    params.push(`status=${statuses[randomIntBetween(0, statuses.length - 1)]}`);
  }

  if (randomIntBetween(0, 10) < 2) {
    // 20% chance
    const types = [
      'linkedin_post',
      'twitter_post',
      'email_campaign',
      'content_generation',
    ];
    params.push(`type=${types[randomIntBetween(0, types.length - 1)]}`);
  }

  return params.join('&');
}

/**
 * Generate a Stripe webhook event payload
 *
 * @param {string} eventType - Stripe event type
 * @param {string} organizationId - Organization ID
 * @returns {object} Webhook payload
 */
export function generateStripeWebhookPayload(eventType, organizationId) {
  const baseEvent = {
    id: `evt_${randomString(24)}`,
    object: 'event',
    api_version: '2023-10-16',
    created: Math.floor(Date.now() / 1000),
    type: eventType,
    livemode: false,
  };

  const dataMap = {
    'checkout.session.completed': {
      object: 'checkout.session',
      id: `cs_${randomString(24)}`,
      customer: `cus_${randomString(14)}`,
      subscription: `sub_${randomString(14)}`,
      metadata: { organizationId },
      mode: 'subscription',
      payment_status: 'paid',
      status: 'complete',
    },
    'customer.subscription.created': generateSubscriptionData(organizationId),
    'customer.subscription.updated': generateSubscriptionData(organizationId),
    'customer.subscription.deleted': generateSubscriptionData(organizationId, 'canceled'),
    'invoice.paid': {
      object: 'invoice',
      id: `in_${randomString(24)}`,
      customer: `cus_${randomString(14)}`,
      subscription: `sub_${randomString(14)}`,
      amount_paid: randomIntBetween(1000, 10000),
      currency: 'usd',
      status: 'paid',
    },
    'invoice.payment_failed': {
      object: 'invoice',
      id: `in_${randomString(24)}`,
      customer: `cus_${randomString(14)}`,
      subscription: `sub_${randomString(14)}`,
      amount_due: randomIntBetween(1000, 10000),
      currency: 'usd',
      status: 'open',
      attempt_count: randomIntBetween(1, 4),
    },
  };

  return {
    ...baseEvent,
    data: {
      object: dataMap[eventType] || {},
    },
  };
}

/**
 * Generate subscription data for webhook
 *
 * @param {string} organizationId - Organization ID
 * @param {string} status - Subscription status
 * @returns {object} Subscription data
 */
function generateSubscriptionData(organizationId, status = 'active') {
  return {
    object: 'subscription',
    id: `sub_${randomString(14)}`,
    customer: `cus_${randomString(14)}`,
    status: status,
    metadata: { organizationId },
    items: {
      data: [
        {
          id: `si_${randomString(14)}`,
          price: {
            id: `price_${randomString(14)}`,
            product: `prod_${randomString(14)}`,
            unit_amount: randomIntBetween(1000, 10000),
            currency: 'usd',
          },
        },
      ],
    },
    current_period_start: Math.floor(Date.now() / 1000),
    current_period_end: Math.floor((Date.now() + 30 * 86400000) / 1000),
  };
}

/**
 * Generate a Stripe webhook signature
 * Note: For actual testing, you need to implement the signing algorithm
 * or use a pre-computed signature for test environments
 *
 * @param {string} payload - Webhook payload as string
 * @param {string} secret - Webhook secret
 * @returns {string} Signature header value
 */
export function generateStripeSignature(payload, secret) {
  // In a real implementation, this would use HMAC SHA256
  // For load testing, you might want to use a test mode webhook
  // that accepts a fixed signature or no signature validation
  const timestamp = Math.floor(Date.now() / 1000);
  return `t=${timestamp},v1=test_signature_${randomString(64)}`;
}

/**
 * Get test campaign IDs
 * In practice, these should be pre-populated test data
 *
 * @param {number} count - Number of campaign IDs to return
 * @returns {Array<string>} Array of campaign IDs
 */
export function getTestCampaignIds(count = 10) {
  const campaigns = [];
  for (let i = 0; i < count; i++) {
    campaigns.push(`00000000-0000-0000-0000-${String(i).padStart(12, '0')}`);
  }
  return campaigns;
}

/**
 * Get test organization IDs
 *
 * @param {number} count - Number of organization IDs to return
 * @returns {Array<string>} Array of organization IDs
 */
export function getTestOrganizationIds(count = 5) {
  const orgs = [];
  for (let i = 0; i < count; i++) {
    orgs.push(`org-test-${String(i).padStart(3, '0')}`);
  }
  return orgs;
}

/**
 * Generate dashboard filter parameters
 *
 * @returns {string} Query string for dashboard filters
 */
export function generateDashboardFilters() {
  const dateRanges = ['7d', '30d', '90d', '1y'];
  const metrics = ['all', 'campaigns', 'tasks', 'analytics'];

  const params = [
    `date_range=${dateRanges[randomIntBetween(0, dateRanges.length - 1)]}`,
    `view=${metrics[randomIntBetween(0, metrics.length - 1)]}`,
  ];

  return params.join('&');
}

/**
 * Generate realistic user think time (time between actions)
 *
 * @param {number} min - Minimum seconds
 * @param {number} max - Maximum seconds
 * @returns {number} Think time in seconds
 */
export function getThinkTime(min = 1, max = 5) {
  return randomIntBetween(min, max);
}
