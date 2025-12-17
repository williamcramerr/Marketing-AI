/**
 * Webhook Load Tests
 *
 * Tests for webhook endpoints including:
 * - Stripe webhook processing
 * - Concurrent webhook handling
 * - High-volume event processing
 *
 * Performance targets:
 * - Webhook Processing < 200ms (p95)
 * - Error Rate < 0.01%
 * - Handle 50+ requests per second
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';
import { randomIntBetween, randomItem } from 'k6/utils';
import { Rate, Counter } from 'k6/metrics';
import {
  generateStripeWebhookPayload,
  generateStripeSignature,
  getTestOrganizationIds,
} from '../utils/test-data.js';
import { getEnvironmentConfig } from '../k6.config.js';

// Get environment configuration
const ENV_NAME = __ENV.ENV || 'local';
const envConfig = getEnvironmentConfig(ENV_NAME);
const BASE_URL = __ENV.BASE_URL || envConfig.baseUrl;

// Webhook secret for signing (should match test environment)
const WEBHOOK_SECRET = __ENV.STRIPE_WEBHOOK_SECRET || 'whsec_test_secret';

// Custom metrics for webhook testing
const webhookProcessingTime = new Rate('webhook_processing_time_under_200ms');
const webhookErrors = new Counter('webhook_errors');
const webhookSuccess = new Counter('webhook_success');
const eventTypeCounter = new Counter('webhook_event_types');

// k6 options for webhook load testing
export const options = {
  scenarios: {
    // Constant rate scenario - sustained load
    constant_rate: {
      executor: 'constant-arrival-rate',
      rate: 50, // 50 requests per second
      timeUnit: '1s',
      duration: '5m',
      preAllocatedVUs: 10,
      maxVUs: 50,
      tags: { scenario: 'constant_rate' },
    },
    // Ramping rate scenario - gradual increase
    ramping_rate: {
      executor: 'ramping-arrival-rate',
      startRate: 10,
      timeUnit: '1s',
      preAllocatedVUs: 10,
      maxVUs: 100,
      stages: [
        { duration: '2m', target: 20 },  // Ramp up to 20 RPS
        { duration: '3m', target: 50 },  // Ramp up to 50 RPS
        { duration: '3m', target: 80 },  // Ramp up to 80 RPS
        { duration: '2m', target: 100 }, // Push to 100 RPS
        { duration: '2m', target: 50 },  // Ramp down to 50 RPS
        { duration: '1m', target: 0 },   // Ramp down to 0
      ],
      startTime: '5m', // Start after constant rate scenario
      tags: { scenario: 'ramping_rate' },
    },
  },
  thresholds: {
    // Webhook processing time should be under 200ms for 95% of requests
    http_req_duration: ['p(95)<200', 'p(99)<400'],
    // Error rate should be less than 0.01%
    http_req_failed: ['rate<0.0001'],
    // Success rate should be greater than 99.99%
    checks: ['rate>0.9999'],
    // Custom threshold for webhook processing time
    webhook_processing_time_under_200ms: ['rate>0.95'],
  },
};

// Stripe event types to test
const stripeEventTypes = new SharedArray('eventTypes', function () {
  return [
    'checkout.session.completed',
    'customer.subscription.created',
    'customer.subscription.updated',
    'customer.subscription.deleted',
    'invoice.paid',
    'invoice.payment_failed',
  ];
});

// Test organization IDs
const organizationIds = new SharedArray('organizations', function () {
  return getTestOrganizationIds(10);
});

/**
 * Setup function
 */
export function setup() {
  console.log('Starting Webhook load test');
  console.log(`Base URL: ${BASE_URL}`);
  console.log('Testing Stripe webhook endpoint');

  return {
    baseUrl: BASE_URL,
    webhookUrl: `${BASE_URL}/api/webhooks/stripe`,
  };
}

/**
 * Main test function
 */
export default function (data) {
  const webhookUrl = data.webhookUrl;

  // Select random event type and organization
  const eventType = randomItem(stripeEventTypes);
  const organizationId = randomItem(organizationIds);

  // Generate webhook payload
  const payload = generateStripeWebhookPayload(eventType, organizationId);
  const payloadString = JSON.stringify(payload);

  // Generate Stripe signature
  const signature = generateStripeSignature(payloadString, WEBHOOK_SECRET);

  // Send webhook request
  const response = sendWebhook(webhookUrl, payloadString, signature, eventType);

  // Small delay to simulate realistic webhook delivery
  sleep(0.1);
}

/**
 * Send a webhook request to the endpoint
 */
function sendWebhook(url, payload, signature, eventType) {
  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Stripe-Signature': signature,
      'User-Agent': 'Stripe/1.0 (+https://stripe.com/docs/webhooks)',
    },
    tags: {
      event_type: eventType,
    },
  };

  const startTime = Date.now();
  const response = http.post(url, payload, params);
  const duration = Date.now() - startTime;

  // Track processing time
  if (duration < 200) {
    webhookProcessingTime.add(1);
  } else {
    webhookProcessingTime.add(0);
  }

  // Check response
  const checkResult = check(response, {
    'status is 200': (r) => r.status === 200,
    'has received field': (r) => {
      try {
        return r.json('received') === true;
      } catch (e) {
        return false;
      }
    },
    'response time under 200ms': (r) => r.timings.duration < 200,
    'response time under 400ms': (r) => r.timings.duration < 400,
  });

  // Record metrics
  if (checkResult) {
    webhookSuccess.add(1);
  } else {
    webhookErrors.add(1);
    console.error(
      `Webhook failed: ${eventType} - Status: ${response.status}, Duration: ${duration}ms`
    );
  }

  eventTypeCounter.add(1, { event_type: eventType });

  return response;
}

/**
 * Test concurrent webhook processing
 * This is run separately to test burst scenarios
 */
export function testConcurrentBurst(data) {
  const webhookUrl = data.webhookUrl;
  const batchSize = 20;
  const requests = [];

  // Prepare batch of webhook requests
  for (let i = 0; i < batchSize; i++) {
    const eventType = randomItem(stripeEventTypes);
    const organizationId = randomItem(organizationIds);
    const payload = generateStripeWebhookPayload(eventType, organizationId);
    const payloadString = JSON.stringify(payload);
    const signature = generateStripeSignature(payloadString, WEBHOOK_SECRET);

    requests.push({
      method: 'POST',
      url: webhookUrl,
      body: payloadString,
      params: {
        headers: {
          'Content-Type': 'application/json',
          'Stripe-Signature': signature,
        },
      },
    });
  }

  // Send all requests concurrently
  const responses = http.batch(requests);

  // Check all responses
  responses.forEach((response, index) => {
    const checkResult = check(response, {
      'status is 200': (r) => r.status === 200,
      'response time under 200ms': (r) => r.timings.duration < 200,
    });

    if (checkResult) {
      webhookSuccess.add(1);
    } else {
      webhookErrors.add(1);
    }
  });

  sleep(1);
}

/**
 * Test webhook with various payload sizes
 */
export function testPayloadSizes(data) {
  const webhookUrl = data.webhookUrl;
  const eventType = 'customer.subscription.updated';
  const organizationId = randomItem(organizationIds);

  // Generate base payload
  let payload = generateStripeWebhookPayload(eventType, organizationId);

  // Add varying amounts of metadata to test different payload sizes
  const metadataSizes = ['small', 'medium', 'large', 'xlarge'];

  metadataSizes.forEach((size) => {
    // Add metadata based on size
    const metadataSize = {
      small: 100,
      medium: 1000,
      large: 5000,
      xlarge: 10000,
    }[size];

    payload.data.object.metadata = {
      ...payload.data.object.metadata,
      load_test_data: 'x'.repeat(metadataSize),
      size_category: size,
    };

    const payloadString = JSON.stringify(payload);
    const signature = generateStripeSignature(payloadString, WEBHOOK_SECRET);

    const response = http.post(webhookUrl, payloadString, {
      headers: {
        'Content-Type': 'application/json',
        'Stripe-Signature': signature,
      },
      tags: {
        payload_size: size,
      },
    });

    check(response, {
      [`${size} payload - status 200`]: (r) => r.status === 200,
      [`${size} payload - under 200ms`]: (r) => r.timings.duration < 200,
    });

    sleep(0.5);
  });
}

/**
 * Test webhook retry behavior
 */
export function testRetryBehavior(data) {
  const webhookUrl = data.webhookUrl;
  const eventType = 'invoice.paid';
  const organizationId = randomItem(organizationIds);

  // Send same event multiple times to test idempotency
  const payload = generateStripeWebhookPayload(eventType, organizationId);
  const payloadString = JSON.stringify(payload);
  const signature = generateStripeSignature(payloadString, WEBHOOK_SECRET);

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Stripe-Signature': signature,
    },
  };

  // Send the same webhook 3 times
  for (let i = 0; i < 3; i++) {
    const response = http.post(webhookUrl, payloadString, params);

    check(response, {
      'idempotent request succeeds': (r) => r.status === 200,
    });

    sleep(0.2);
  }
}

/**
 * Teardown function
 */
export function teardown(data) {
  console.log('Webhook load test completed');
}

/**
 * Handle summary
 */
export function handleSummary(data) {
  console.log('=== Webhook Load Test Summary ===');
  console.log(`Total Requests: ${data.metrics.http_reqs.values.count}`);
  console.log(
    `Failed Requests: ${data.metrics.http_req_failed.values.passes || 0}`
  );
  console.log(
    `Request Duration (p95): ${data.metrics.http_req_duration.values['p(95)'].toFixed(2)}ms`
  );
  console.log(
    `Request Duration (p99): ${data.metrics.http_req_duration.values['p(99)'].toFixed(2)}ms`
  );
  console.log(
    `Success Rate: ${((1 - (data.metrics.http_req_failed.values.rate || 0)) * 100).toFixed(2)}%`
  );

  if (data.metrics.webhook_success) {
    console.log(`Successful Webhooks: ${data.metrics.webhook_success.values.count}`);
  }
  if (data.metrics.webhook_errors) {
    console.log(`Failed Webhooks: ${data.metrics.webhook_errors.values.count}`);
  }

  // Check if performance targets were met
  const p95 = data.metrics.http_req_duration.values['p(95)'];
  const errorRate = data.metrics.http_req_failed.values.rate || 0;

  console.log('\n=== Performance Target Validation ===');
  console.log(`P95 < 200ms: ${p95 < 200 ? 'PASS' : 'FAIL'} (${p95.toFixed(2)}ms)`);
  console.log(
    `Error Rate < 0.01%: ${errorRate < 0.0001 ? 'PASS' : 'FAIL'} (${(errorRate * 100).toFixed(4)}%)`
  );
  console.log('============================');

  return {
    'stdout': JSON.stringify(data, null, 2),
    'load-tests/results/webhook-summary.json': JSON.stringify(data, null, 2),
  };
}
