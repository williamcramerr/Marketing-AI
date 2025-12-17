/**
 * API Load Tests
 *
 * Tests for API endpoints including:
 * - Authentication flow
 * - Task creation and retrieval
 * - Task triggering
 * - Bulk operations
 *
 * Performance targets:
 * - API Response Time (p95) < 500ms
 * - Error Rate < 0.1%
 * - Support 100+ concurrent users
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';
import { randomIntBetween } from 'k6/utils';
import { buildOptions, getEnvironmentConfig } from '../k6.config.js';
import {
  authenticateUser,
  getAuthParams,
  getTestCredentials,
  validateSession,
} from '../utils/auth.js';
import {
  generateTaskPayload,
  generateTaskListQuery,
  getTestCampaignIds,
  getThinkTime,
} from '../utils/test-data.js';
import { metrics, checks, recordApiMetric, recordSuccess, recordFailure } from '../utils/metrics.js';

// Get scenario from environment variable (default to 'load')
const SCENARIO = __ENV.SCENARIO || 'load';
const ENV_NAME = __ENV.ENV || 'local';

// Build k6 options based on scenario
export const options = buildOptions(SCENARIO, 'api', ENV_NAME);

// Get base URL from environment config
const envConfig = getEnvironmentConfig(ENV_NAME);
const BASE_URL = __ENV.BASE_URL || envConfig.baseUrl;

// Pre-generate test campaign IDs
const testCampaignIds = new SharedArray('campaigns', function () {
  return getTestCampaignIds(20);
});

// Test user credentials
const testUsers = new SharedArray('users', function () {
  const users = [];
  for (let i = 0; i < 10; i++) {
    users.push(getTestCredentials(i));
  }
  return users;
});

/**
 * Setup function - runs once per VU at the start
 */
export function setup() {
  console.log(`Starting API load test - Scenario: ${SCENARIO}, Environment: ${ENV_NAME}`);
  console.log(`Base URL: ${BASE_URL}`);

  // Verify API is accessible
  const healthCheck = http.get(`${BASE_URL}/api/health`);
  if (healthCheck.status !== 200) {
    console.error('API health check failed. Tests may not run correctly.');
  }

  return {
    baseUrl: BASE_URL,
    scenario: SCENARIO,
  };
}

/**
 * Main test function - runs for each VU iteration
 */
export default function (data) {
  const baseUrl = data.baseUrl;

  // Select a random test user
  const userIndex = randomIntBetween(0, testUsers.length - 1);
  const credentials = testUsers[userIndex];

  // Step 1: Authenticate
  const session = testAuthentication(baseUrl, credentials);
  if (!session) {
    recordFailure('authenticationFailed', 'Failed to authenticate');
    return;
  }

  sleep(getThinkTime(0.5, 2));

  // Step 2: Validate session
  testSessionValidation(baseUrl, session);

  sleep(getThinkTime(0.5, 1));

  // Step 3: List tasks (multiple times with different parameters)
  const listIterations = randomIntBetween(1, 3);
  for (let i = 0; i < listIterations; i++) {
    testListTasks(baseUrl, session);
    sleep(getThinkTime(0.5, 2));
  }

  // Step 4: Create new tasks (20% of users create tasks)
  if (randomIntBetween(0, 100) < 20) {
    const taskCount = randomIntBetween(1, 3);
    for (let i = 0; i < taskCount; i++) {
      const task = testCreateTask(baseUrl, session);
      if (task) {
        sleep(getThinkTime(0.5, 1));

        // Step 5: Get the created task details (50% chance)
        if (randomIntBetween(0, 100) < 50) {
          testGetTask(baseUrl, session, task.id);
          sleep(getThinkTime(0.5, 1));
        }

        // Step 6: Trigger the task (30% chance)
        if (randomIntBetween(0, 100) < 30) {
          testTriggerTask(baseUrl, session, task.id);
          sleep(getThinkTime(0.5, 1));
        }
      }
    }
  }

  // Step 7: Bulk operations (10% of users)
  if (randomIntBetween(0, 100) < 10) {
    testBulkOperations(baseUrl, session);
    sleep(getThinkTime(1, 2));
  }

  // Think time between iterations
  sleep(getThinkTime(2, 5));
}

/**
 * Test authentication flow
 */
function testAuthentication(baseUrl, credentials) {
  const startTime = Date.now();

  const session = authenticateUser(baseUrl, credentials);

  const duration = Date.now() - startTime;
  metrics.authLoginDuration.add(duration);

  if (session) {
    recordSuccess('authenticationSuccess');
    return session;
  }

  recordFailure('authenticationFailed', 'Authentication returned null');
  return null;
}

/**
 * Test session validation
 */
function testSessionValidation(baseUrl, session) {
  const startTime = Date.now();

  const isValid = validateSession(baseUrl, session);

  const duration = Date.now() - startTime;
  metrics.authValidateDuration.add(duration);

  if (!isValid) {
    recordFailure('sessionValidationFailed', 'Session validation failed');
  }

  return isValid;
}

/**
 * Test listing tasks
 */
function testListTasks(baseUrl, session) {
  const query = generateTaskListQuery();
  const url = `${baseUrl}/api/tasks?${query}`;
  const params = getAuthParams(session);

  const startTime = Date.now();
  const response = http.get(url, params);
  const duration = Date.now() - startTime;

  metrics.apiListTasksDuration.add(duration);

  const checkResult = check(response, {
    ...checks.hasValidApiResponse(response),
    ...checks.hasValidPagination(response),
  });

  if (!checkResult) {
    recordFailure('listTasksFailed', `Status: ${response.status}, Body: ${response.body}`);
  }

  return response.json();
}

/**
 * Test creating a task
 */
function testCreateTask(baseUrl, session) {
  const campaignId = testCampaignIds[randomIntBetween(0, testCampaignIds.length - 1)];
  const payload = generateTaskPayload(campaignId);

  const url = `${baseUrl}/api/tasks`;
  const params = getAuthParams(session);

  const startTime = Date.now();
  const response = http.post(url, JSON.stringify(payload), params);
  const duration = Date.now() - startTime;

  metrics.apiCreateTaskDuration.add(duration);

  const checkResult = check(response, checks.isCreated(response));

  if (checkResult) {
    metrics.tasksCreated.add(1);

    const body = response.json();
    if (body.workflow_triggered) {
      metrics.workflowsTriggered.add(1);
    }

    return body.data;
  } else {
    metrics.tasksFailed.add(1);
    recordFailure(
      'createTaskFailed',
      `Status: ${response.status}, Body: ${response.body.substring(0, 200)}`
    );
    return null;
  }
}

/**
 * Test getting a specific task
 */
function testGetTask(baseUrl, session, taskId) {
  const url = `${baseUrl}/api/tasks/${taskId}`;
  const params = getAuthParams(session);

  const startTime = Date.now();
  const response = http.get(url, params);
  const duration = Date.now() - startTime;

  metrics.apiGetTaskDuration.add(duration);

  const checkResult = check(response, {
    ...checks.isOK(response),
    'has task data': (r) => r.json('data.id') === taskId,
  });

  if (!checkResult) {
    recordFailure('getTaskFailed', `Status: ${response.status}`);
  }

  return response.json();
}

/**
 * Test triggering a task
 */
function testTriggerTask(baseUrl, session, taskId) {
  const url = `${baseUrl}/api/tasks/${taskId}/trigger`;
  const params = getAuthParams(session);

  const startTime = Date.now();
  const response = http.post(url, null, params);
  const duration = Date.now() - startTime;

  metrics.apiTriggerTaskDuration.add(duration);

  const checkResult = check(response, checks.isSuccessful(response));

  if (checkResult) {
    metrics.workflowsTriggered.add(1);
  } else {
    recordFailure('triggerTaskFailed', `Status: ${response.status}`);
  }

  return response.json();
}

/**
 * Test bulk operations
 */
function testBulkOperations(baseUrl, session) {
  const campaignId = testCampaignIds[randomIntBetween(0, testCampaignIds.length - 1)];

  // Create multiple tasks in bulk
  const tasks = [];
  for (let i = 0; i < 5; i++) {
    tasks.push(generateTaskPayload(campaignId));
  }

  const url = `${baseUrl}/api/tasks/bulk`;
  const params = getAuthParams(session);
  const payload = JSON.stringify({ tasks });

  const response = http.post(url, payload, params);

  const checkResult = check(response, checks.isSuccessful(response));

  if (checkResult) {
    const body = response.json();
    const created = body.created || 0;
    metrics.tasksCreated.add(created);
  } else {
    recordFailure('bulkOperationFailed', `Status: ${response.status}`);
  }

  return response.json();
}

/**
 * Teardown function - runs once at the end
 */
export function teardown(data) {
  console.log(`API load test completed - Scenario: ${data.scenario}`);
}

/**
 * Handle summary data
 */
export function handleSummary(data) {
  console.log('=== API Load Test Summary ===');
  console.log(`Scenario: ${SCENARIO}`);
  console.log(`Environment: ${ENV_NAME}`);
  console.log(`Total Requests: ${data.metrics.http_reqs.values.count}`);
  console.log(`Failed Requests: ${data.metrics.http_req_failed.values.passes || 0}`);
  console.log(
    `Request Duration (p95): ${data.metrics.http_req_duration.values['p(95)'].toFixed(2)}ms`
  );
  console.log(
    `Request Duration (p99): ${data.metrics.http_req_duration.values['p(99)'].toFixed(2)}ms`
  );

  if (data.metrics.tasks_created) {
    console.log(`Tasks Created: ${data.metrics.tasks_created.values.count}`);
  }
  if (data.metrics.workflows_triggered) {
    console.log(`Workflows Triggered: ${data.metrics.workflows_triggered.values.count}`);
  }

  console.log('============================');

  return {
    'stdout': JSON.stringify(data, null, 2),
    'load-tests/results/api-summary.json': JSON.stringify(data, null, 2),
  };
}
