/**
 * k6 Load Testing Configuration
 *
 * Centralized configuration for different load testing scenarios:
 * - smoke: Quick sanity check with minimal load
 * - load: Standard load test to verify performance targets
 * - stress: Push system to its limits
 * - soak: Extended duration test to find memory leaks
 */

export const config = {
  // Performance thresholds based on requirements
  thresholds: {
    api: {
      // API Response Time (p95) < 500ms
      http_req_duration: ['p(95)<500', 'p(99)<1000'],
      // Error Rate < 0.1%
      http_req_failed: ['rate<0.001'],
      // Success rate should be > 99%
      checks: ['rate>0.99'],
    },
    webhooks: {
      // Webhook Processing < 200ms
      http_req_duration: ['p(95)<200', 'p(99)<400'],
      // Stricter error rate for webhooks
      http_req_failed: ['rate<0.0001'],
      checks: ['rate>0.999'],
    },
    dashboard: {
      // Dashboard Load < 2s
      http_req_duration: ['p(95)<2000', 'p(99)<3000'],
      http_req_failed: ['rate<0.001'],
      checks: ['rate>0.99'],
    },
  },

  // Test scenarios
  scenarios: {
    smoke: {
      executor: 'constant-vus',
      vus: 1,
      duration: '1m',
      tags: { test_type: 'smoke' },
    },
    load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 10 },  // Ramp up to 10 users
        { duration: '5m', target: 50 },  // Ramp up to 50 users
        { duration: '5m', target: 50 },  // Stay at 50 users
        { duration: '2m', target: 100 }, // Ramp up to 100 users
        { duration: '3m', target: 100 }, // Stay at 100 users
        { duration: '2m', target: 0 },   // Ramp down
      ],
      gracefulRampDown: '30s',
      tags: { test_type: 'load' },
    },
    stress: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 50 },   // Ramp up to 50 users
        { duration: '2m', target: 100 },  // Ramp up to 100 users
        { duration: '2m', target: 150 },  // Ramp up to 150 users
        { duration: '2m', target: 200 },  // Ramp up to 200 users
        { duration: '5m', target: 200 },  // Stay at 200 users
        { duration: '2m', target: 250 },  // Push to 250 users
        { duration: '3m', target: 250 },  // Stay at peak
        { duration: '3m', target: 0 },    // Ramp down
      ],
      gracefulRampDown: '1m',
      tags: { test_type: 'stress' },
    },
    soak: {
      executor: 'constant-vus',
      vus: 50,
      duration: '30m',
      gracefulStop: '1m',
      tags: { test_type: 'soak' },
    },
  },

  // Environment-specific settings
  environments: {
    local: {
      baseUrl: 'http://localhost:3000',
      wsUrl: 'ws://localhost:3000',
    },
    staging: {
      baseUrl: 'https://staging.marketingpilot.ai',
      wsUrl: 'wss://staging.marketingpilot.ai',
    },
    production: {
      baseUrl: 'https://app.marketingpilot.ai',
      wsUrl: 'wss://app.marketingpilot.ai',
    },
  },

  // Rate limiting configuration
  rateLimit: {
    api: 100,       // requests per second
    webhooks: 50,   // requests per second
    dashboard: 20,  // requests per second
  },

  // Test data configuration
  testData: {
    // Number of test organizations to use
    organizations: 5,
    // Number of campaigns per organization
    campaignsPerOrg: 10,
    // Number of products per organization
    productsPerOrg: 5,
    // Number of tasks to create during tests
    tasksToCreate: 100,
  },
};

/**
 * Get configuration for a specific scenario
 */
export function getScenarioConfig(scenarioName) {
  const scenario = config.scenarios[scenarioName];
  if (!scenario) {
    throw new Error(`Unknown scenario: ${scenarioName}`);
  }
  return scenario;
}

/**
 * Get environment configuration
 */
export function getEnvironmentConfig(envName = 'local') {
  const env = config.environments[envName];
  if (!env) {
    throw new Error(`Unknown environment: ${envName}`);
  }
  return env;
}

/**
 * Get thresholds for a specific test type
 */
export function getThresholds(testType = 'api') {
  const thresholds = config.thresholds[testType];
  if (!thresholds) {
    throw new Error(`Unknown test type: ${testType}`);
  }
  return thresholds;
}

/**
 * Build k6 options object for a scenario
 */
export function buildOptions(scenarioName, testType = 'api', envName = 'local') {
  const scenario = getScenarioConfig(scenarioName);
  const thresholds = getThresholds(testType);
  const env = getEnvironmentConfig(envName);

  return {
    scenarios: {
      [scenarioName]: scenario,
    },
    thresholds,
    env: {
      BASE_URL: env.baseUrl,
      WS_URL: env.wsUrl,
    },
    summaryTrendStats: ['min', 'med', 'avg', 'p(90)', 'p(95)', 'p(99)', 'max'],
    summaryTimeUnit: 'ms',
  };
}
