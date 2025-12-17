/**
 * Custom metrics and checks for k6 load tests
 */

import { Trend, Counter, Rate } from 'k6/metrics';

// Custom metrics for detailed analysis
export const metrics = {
  // API endpoint metrics
  apiListTasksDuration: new Trend('api_list_tasks_duration', true),
  apiCreateTaskDuration: new Trend('api_create_task_duration', true),
  apiGetTaskDuration: new Trend('api_get_task_duration', true),
  apiTriggerTaskDuration: new Trend('api_trigger_task_duration', true),

  // Webhook metrics
  webhookProcessingDuration: new Trend('webhook_processing_duration', true),
  webhookSuccessRate: new Rate('webhook_success_rate'),
  webhookErrors: new Counter('webhook_errors'),

  // Dashboard metrics
  dashboardLoadDuration: new Trend('dashboard_load_duration', true),
  dashboardInteractiveDuration: new Trend('dashboard_interactive_duration', true),

  // Authentication metrics
  authLoginDuration: new Trend('auth_login_duration', true),
  authValidateDuration: new Trend('auth_validate_duration', true),

  // Database operation indicators
  databaseErrors: new Counter('database_errors'),

  // Business metrics
  tasksCreated: new Counter('tasks_created'),
  tasksFailed: new Counter('tasks_failed'),
  workflowsTriggered: new Counter('workflows_triggered'),
};

/**
 * Standard checks for API responses
 */
export const checks = {
  /**
   * Check if response is successful (2xx status)
   */
  isSuccessful: (response) => {
    return {
      'status is 2xx': response.status >= 200 && response.status < 300,
    };
  },

  /**
   * Check if response is OK (200 status)
   */
  isOK: (response) => {
    return {
      'status is 200': response.status === 200,
    };
  },

  /**
   * Check if resource was created (201 status)
   */
  isCreated: (response) => {
    return {
      'status is 201': response.status === 201,
      'has data field': response.json('data') !== undefined,
    };
  },

  /**
   * Check API response structure
   */
  hasValidApiResponse: (response) => {
    return {
      'status is 200': response.status === 200,
      'has data field': response.json('data') !== undefined,
      'response time < 500ms': response.timings.duration < 500,
    };
  },

  /**
   * Check webhook response
   */
  hasValidWebhookResponse: (response) => {
    return {
      'status is 200': response.status === 200,
      'has received field': response.json('received') === true,
      'response time < 200ms': response.timings.duration < 200,
    };
  },

  /**
   * Check dashboard response
   */
  hasValidDashboardResponse: (response) => {
    return {
      'status is 200': response.status === 200,
      'response time < 2000ms': response.timings.duration < 2000,
      'has content': response.body && response.body.length > 0,
    };
  },

  /**
   * Check authentication response
   */
  hasValidAuthResponse: (response) => {
    return {
      'status is 200': response.status === 200,
      'has access token': response.json('access_token') !== undefined,
      'has user data': response.json('user') !== undefined,
    };
  },

  /**
   * Check pagination response
   */
  hasValidPagination: (response) => {
    return {
      'has data array': Array.isArray(response.json('data')),
      'has total count': response.json('total') !== undefined,
      'has limit': response.json('limit') !== undefined,
      'has offset': response.json('offset') !== undefined,
    };
  },

  /**
   * Check error response
   */
  hasErrorResponse: (response, expectedStatus) => {
    return {
      [`status is ${expectedStatus}`]: response.status === expectedStatus,
      'has error message': response.json('error') !== undefined,
    };
  },
};

/**
 * Record custom metric for API call
 */
export function recordApiMetric(metricName, duration) {
  if (metrics[metricName]) {
    metrics[metricName].add(duration);
  }
}

/**
 * Record successful operation
 */
export function recordSuccess(counterName) {
  if (metrics[counterName]) {
    metrics[counterName].add(1);
  }
}

/**
 * Record failed operation
 */
export function recordFailure(counterName, error) {
  if (metrics[counterName]) {
    metrics[counterName].add(1);
  }
  console.error(`${counterName}: ${error}`);
}

/**
 * Generate summary statistics
 */
export function generateSummary(data) {
  const summary = {
    'Total Requests': data.http_reqs?.values?.count || 0,
    'Failed Requests': data.http_req_failed?.values?.passes || 0,
    'Request Duration (p95)': `${(data.http_req_duration?.values?.['p(95)'] || 0).toFixed(2)}ms`,
    'Request Duration (p99)': `${(data.http_req_duration?.values?.['p(99)'] || 0).toFixed(2)}ms`,
  };

  // Add custom metrics
  if (data.tasks_created) {
    summary['Tasks Created'] = data.tasks_created.values.count;
  }
  if (data.workflows_triggered) {
    summary['Workflows Triggered'] = data.workflows_triggered.values.count;
  }
  if (data.webhook_processing_duration) {
    summary['Webhook Processing (p95)'] =
      `${(data.webhook_processing_duration.values['p(95)'] || 0).toFixed(2)}ms`;
  }

  return summary;
}

/**
 * Validate performance targets
 */
export function validatePerformanceTargets(data) {
  const results = {
    passed: true,
    failures: [],
  };

  // Check API p95 < 500ms
  const apiP95 = data.http_req_duration?.values?.['p(95)'];
  if (apiP95 && apiP95 > 500) {
    results.passed = false;
    results.failures.push(`API p95 (${apiP95.toFixed(2)}ms) exceeded 500ms target`);
  }

  // Check error rate < 0.1%
  const errorRate = data.http_req_failed?.values?.rate;
  if (errorRate && errorRate > 0.001) {
    results.passed = false;
    results.failures.push(
      `Error rate (${(errorRate * 100).toFixed(2)}%) exceeded 0.1% target`
    );
  }

  // Check webhook processing < 200ms if available
  const webhookP95 = data.webhook_processing_duration?.values?.['p(95)'];
  if (webhookP95 && webhookP95 > 200) {
    results.passed = false;
    results.failures.push(
      `Webhook p95 (${webhookP95.toFixed(2)}ms) exceeded 200ms target`
    );
  }

  return results;
}
