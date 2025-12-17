/**
 * Dashboard Load Tests
 *
 * Tests for dashboard user interface including:
 * - User navigation through dashboard
 * - Loading organization data
 * - Campaign and product views
 * - Real-time updates simulation
 *
 * Performance targets:
 * - Dashboard Load < 2s (p95)
 * - Support 100+ concurrent users
 * - Error Rate < 0.1%
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { SharedArray } from 'k6/data';
import { randomIntBetween, randomItem } from 'k6/utils';
import { Trend } from 'k6/metrics';
import {
  authenticateUser,
  getAuthParams,
  getTestCredentials,
} from '../utils/auth.js';
import {
  generateDashboardFilters,
  getThinkTime,
} from '../utils/test-data.js';
import { getEnvironmentConfig } from '../k6.config.js';

// Get environment configuration
const ENV_NAME = __ENV.ENV || 'local';
const envConfig = getEnvironmentConfig(ENV_NAME);
const BASE_URL = __ENV.BASE_URL || envConfig.baseUrl;

// Custom metrics for dashboard testing
const dashboardLoadTime = new Trend('dashboard_load_time', true);
const dashboardInteractiveTime = new Trend('dashboard_interactive_time', true);
const dashboardApiTime = new Trend('dashboard_api_time', true);
const pageNavigationTime = new Trend('page_navigation_time', true);

// k6 options for dashboard load testing
export const options = {
  scenarios: {
    // Average user load
    average_load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 20 },   // Ramp up to 20 users
        { duration: '5m', target: 50 },   // Ramp up to 50 users
        { duration: '5m', target: 50 },   // Stay at 50 users
        { duration: '3m', target: 100 },  // Ramp up to 100 users
        { duration: '5m', target: 100 },  // Stay at 100 users
        { duration: '2m', target: 0 },    // Ramp down
      ],
      gracefulRampDown: '30s',
      tags: { scenario: 'average_load' },
    },
    // Peak hours load
    peak_load: {
      executor: 'constant-vus',
      vus: 150,
      duration: '10m',
      startTime: '22m', // Start after average load scenario
      gracefulStop: '1m',
      tags: { scenario: 'peak_load' },
    },
  },
  thresholds: {
    // Dashboard load time should be under 2s for 95% of requests
    http_req_duration: ['p(95)<2000', 'p(99)<3000'],
    // Error rate should be less than 0.1%
    http_req_failed: ['rate<0.001'],
    // Success rate should be greater than 99%
    checks: ['rate>0.99'],
    // Custom thresholds
    dashboard_load_time: ['p(95)<2000'],
    dashboard_interactive_time: ['p(95)<2000'],
    page_navigation_time: ['p(95)<1000'],
  },
};

// Test user credentials
const testUsers = new SharedArray('users', function () {
  const users = [];
  for (let i = 0; i < 10; i++) {
    users.push(getTestCredentials(i));
  }
  return users;
});

// Dashboard pages to test
const dashboardPages = [
  '/dashboard',
  '/dashboard/campaigns',
  '/dashboard/products',
  '/dashboard/tasks',
  '/dashboard/analytics',
  '/dashboard/connectors',
  '/dashboard/settings',
];

/**
 * Setup function
 */
export function setup() {
  console.log('Starting Dashboard load test');
  console.log(`Base URL: ${BASE_URL}`);

  return {
    baseUrl: BASE_URL,
  };
}

/**
 * Main test function - simulates a user session
 */
export default function (data) {
  const baseUrl = data.baseUrl;

  // Select a random test user
  const userIndex = randomIntBetween(0, testUsers.length - 1);
  const credentials = testUsers[userIndex];

  // Authenticate user
  let session;
  group('Authentication', function () {
    session = authenticateUser(baseUrl, credentials);
    if (!session) {
      console.error('Authentication failed');
      return;
    }
  });

  if (!session) {
    return;
  }

  // User think time after login
  sleep(getThinkTime(1, 3));

  // Main dashboard journey
  group('Dashboard Journey', function () {
    // Load main dashboard
    loadDashboardHome(baseUrl, session);
    sleep(getThinkTime(2, 5));

    // Navigate through different pages
    const pageCount = randomIntBetween(2, 5);
    for (let i = 0; i < pageCount; i++) {
      const page = randomItem(dashboardPages);
      navigateToDashboardPage(baseUrl, session, page);
      sleep(getThinkTime(2, 5));
    }

    // View campaign details (50% of users)
    if (randomIntBetween(0, 100) < 50) {
      viewCampaignDetails(baseUrl, session);
      sleep(getThinkTime(3, 6));
    }

    // View analytics (30% of users)
    if (randomIntBetween(0, 100) < 30) {
      viewAnalytics(baseUrl, session);
      sleep(getThinkTime(3, 7));
    }

    // Check tasks (70% of users)
    if (randomIntBetween(0, 100) < 70) {
      viewTasksList(baseUrl, session);
      sleep(getThinkTime(2, 4));
    }
  });

  // User session duration
  sleep(getThinkTime(5, 10));
}

/**
 * Load dashboard home page
 */
function loadDashboardHome(baseUrl, session) {
  const startTime = Date.now();

  group('Dashboard Home', function () {
    const params = getAuthParams(session);

    // Load main dashboard page
    const dashboardResponse = http.get(`${baseUrl}/dashboard`, params);

    check(dashboardResponse, {
      'dashboard page loaded': (r) => r.status === 200,
      'page load under 2s': (r) => r.timings.duration < 2000,
    });

    const pageLoadTime = Date.now() - startTime;
    dashboardLoadTime.add(pageLoadTime);

    // Load dashboard data API endpoints
    const apiStartTime = Date.now();

    const responses = http.batch([
      ['GET', `${baseUrl}/api/dashboard/overview`, null, params],
      ['GET', `${baseUrl}/api/dashboard/stats`, null, params],
      ['GET', `${baseUrl}/api/tasks?limit=10`, null, params],
      ['GET', `${baseUrl}/api/campaigns?limit=5`, null, params],
    ]);

    const apiTime = Date.now() - apiStartTime;
    dashboardApiTime.add(apiTime);

    // Check all API responses
    responses.forEach((response, index) => {
      check(response, {
        [`API ${index} - status 200`]: (r) => r.status === 200,
        [`API ${index} - under 500ms`]: (r) => r.timings.duration < 500,
      });
    });

    const totalTime = Date.now() - startTime;
    dashboardInteractiveTime.add(totalTime);
  });
}

/**
 * Navigate to a dashboard page
 */
function navigateToDashboardPage(baseUrl, session, page) {
  const startTime = Date.now();
  const params = getAuthParams(session);

  const response = http.get(`${baseUrl}${page}`, params);

  check(response, {
    'page loaded successfully': (r) => r.status === 200,
    'navigation under 1s': (r) => r.timings.duration < 1000,
  });

  const navigationTime = Date.now() - startTime;
  pageNavigationTime.add(navigationTime);

  return response;
}

/**
 * View campaign details
 */
function viewCampaignDetails(baseUrl, session) {
  group('Campaign Details', function () {
    const params = getAuthParams(session);

    // Get list of campaigns
    const campaignsResponse = http.get(`${baseUrl}/api/campaigns?limit=20`, params);

    if (campaignsResponse.status === 200) {
      const campaigns = campaignsResponse.json('data');

      if (campaigns && campaigns.length > 0) {
        // Select a random campaign
        const campaign = randomItem(campaigns);
        const campaignId = campaign.id;

        // Navigate to campaign page
        navigateToDashboardPage(baseUrl, session, `/dashboard/campaigns/${campaignId}`);

        sleep(1);

        // Load campaign data
        const responses = http.batch([
          ['GET', `${baseUrl}/api/campaigns/${campaignId}`, null, params],
          ['GET', `${baseUrl}/api/tasks?campaign_id=${campaignId}&limit=20`, null, params],
          ['GET', `${baseUrl}/api/analytics/campaign/${campaignId}`, null, params],
        ]);

        responses.forEach((response, index) => {
          check(response, {
            [`Campaign API ${index} - success`]: (r) => r.status === 200 || r.status === 404,
          });
        });
      }
    }
  });
}

/**
 * View analytics dashboard
 */
function viewAnalytics(baseUrl, session) {
  group('Analytics Dashboard', function () {
    const params = getAuthParams(session);
    const filters = generateDashboardFilters();

    // Navigate to analytics page
    navigateToDashboardPage(baseUrl, session, '/dashboard/analytics');

    sleep(1);

    // Load analytics data
    const responses = http.batch([
      ['GET', `${baseUrl}/api/analytics/overview?${filters}`, null, params],
      ['GET', `${baseUrl}/api/analytics/performance?${filters}`, null, params],
      ['GET', `${baseUrl}/api/analytics/trends?${filters}`, null, params],
      ['GET', `${baseUrl}/api/analytics/campaigns?${filters}`, null, params],
    ]);

    check(responses[0], {
      'analytics overview loaded': (r) => r.status === 200 || r.status === 404,
      'analytics under 2s': (r) => r.timings.duration < 2000,
    });
  });
}

/**
 * View tasks list
 */
function viewTasksList(baseUrl, session) {
  group('Tasks List', function () {
    const params = getAuthParams(session);

    // Navigate to tasks page
    navigateToDashboardPage(baseUrl, session, '/dashboard/tasks');

    sleep(1);

    // Load tasks with different filters
    const filters = [
      'status=queued&limit=20',
      'status=running&limit=20',
      'status=completed&limit=20&offset=0',
    ];

    filters.forEach((filter) => {
      const response = http.get(`${baseUrl}/api/tasks?${filter}`, params);

      check(response, {
        'tasks loaded': (r) => r.status === 200,
        'tasks under 500ms': (r) => r.timings.duration < 500,
      });

      sleep(0.5);
    });

    // View a task detail (30% chance)
    if (randomIntBetween(0, 100) < 30) {
      const tasksResponse = http.get(`${baseUrl}/api/tasks?limit=10`, params);

      if (tasksResponse.status === 200) {
        const tasks = tasksResponse.json('data');

        if (tasks && tasks.length > 0) {
          const task = randomItem(tasks);
          const taskDetailResponse = http.get(
            `${baseUrl}/api/tasks/${task.id}`,
            params
          );

          check(taskDetailResponse, {
            'task detail loaded': (r) => r.status === 200,
          });
        }
      }
    }
  });
}

/**
 * Test dashboard with concurrent data refreshes
 */
export function testConcurrentRefresh(data) {
  const baseUrl = data.baseUrl;
  const credentials = testUsers[0];
  const session = authenticateUser(baseUrl, credentials);

  if (!session) {
    return;
  }

  const params = getAuthParams(session);

  // Simulate multiple users refreshing dashboard simultaneously
  for (let i = 0; i < 5; i++) {
    const responses = http.batch([
      ['GET', `${baseUrl}/api/dashboard/overview`, null, params],
      ['GET', `${baseUrl}/api/dashboard/stats`, null, params],
      ['GET', `${baseUrl}/api/tasks?limit=20`, null, params],
      ['GET', `${baseUrl}/api/campaigns?limit=20`, null, params],
      ['GET', `${baseUrl}/api/products?limit=20`, null, params],
    ]);

    check(responses[0], {
      'concurrent refresh successful': (r) => r.status === 200,
    });

    sleep(2);
  }
}

/**
 * Test dashboard search functionality
 */
export function testDashboardSearch(data) {
  const baseUrl = data.baseUrl;
  const credentials = testUsers[0];
  const session = authenticateUser(baseUrl, credentials);

  if (!session) {
    return;
  }

  const params = getAuthParams(session);
  const searchTerms = ['campaign', 'task', 'product', 'test', 'automation'];

  searchTerms.forEach((term) => {
    const response = http.get(
      `${baseUrl}/api/search?q=${encodeURIComponent(term)}`,
      params
    );

    check(response, {
      [`search for "${term}" successful`]: (r) => r.status === 200 || r.status === 404,
      'search under 500ms': (r) => r.timings.duration < 500,
    });

    sleep(1);
  });
}

/**
 * Teardown function
 */
export function teardown(data) {
  console.log('Dashboard load test completed');
}

/**
 * Handle summary
 */
export function handleSummary(data) {
  console.log('=== Dashboard Load Test Summary ===');
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

  if (data.metrics.dashboard_load_time) {
    console.log(
      `Dashboard Load Time (p95): ${data.metrics.dashboard_load_time.values['p(95)'].toFixed(2)}ms`
    );
  }
  if (data.metrics.dashboard_interactive_time) {
    console.log(
      `Time to Interactive (p95): ${data.metrics.dashboard_interactive_time.values['p(95)'].toFixed(2)}ms`
    );
  }

  // Check if performance targets were met
  const p95 = data.metrics.http_req_duration.values['p(95)'];
  const errorRate = data.metrics.http_req_failed.values.rate || 0;

  console.log('\n=== Performance Target Validation ===');
  console.log(`P95 < 2000ms: ${p95 < 2000 ? 'PASS' : 'FAIL'} (${p95.toFixed(2)}ms)`);
  console.log(
    `Error Rate < 0.1%: ${errorRate < 0.001 ? 'PASS' : 'FAIL'} (${(errorRate * 100).toFixed(2)}%)`
  );
  console.log('============================');

  return {
    'stdout': JSON.stringify(data, null, 2),
    'load-tests/results/dashboard-summary.json': JSON.stringify(data, null, 2),
  };
}
