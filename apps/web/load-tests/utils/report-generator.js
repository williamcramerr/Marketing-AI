/**
 * Report Generator for k6 Load Test Results
 *
 * Generates HTML reports from k6 JSON output
 * Usage: node load-tests/utils/report-generator.js <json-file>
 */

import fs from 'fs';
import path from 'path';

/**
 * Generate HTML report from k6 JSON results
 */
function generateHTMLReport(jsonData, outputPath) {
  const metrics = jsonData.metrics;
  const timestamp = new Date().toISOString();

  // Extract key metrics
  const totalRequests = metrics.http_reqs?.values?.count || 0;
  const failedRequests = metrics.http_req_failed?.values?.passes || 0;
  const errorRate = metrics.http_req_failed?.values?.rate || 0;
  const duration = metrics.http_req_duration?.values || {};
  const vus = metrics.vus?.values || {};

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>k6 Load Test Report - ${timestamp}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background: #f5f5f5;
      padding: 20px;
      color: #333;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
      background: white;
      padding: 30px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    h1 {
      color: #2c3e50;
      margin-bottom: 10px;
    }
    .timestamp {
      color: #7f8c8d;
      margin-bottom: 30px;
    }
    .summary {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }
    .metric-card {
      background: #f8f9fa;
      padding: 20px;
      border-radius: 6px;
      border-left: 4px solid #3498db;
    }
    .metric-card.success {
      border-left-color: #27ae60;
    }
    .metric-card.warning {
      border-left-color: #f39c12;
    }
    .metric-card.error {
      border-left-color: #e74c3c;
    }
    .metric-label {
      font-size: 14px;
      color: #7f8c8d;
      margin-bottom: 5px;
    }
    .metric-value {
      font-size: 32px;
      font-weight: bold;
      color: #2c3e50;
    }
    .metric-unit {
      font-size: 16px;
      color: #7f8c8d;
      margin-left: 5px;
    }
    .section {
      margin-bottom: 30px;
    }
    .section-title {
      font-size: 20px;
      color: #2c3e50;
      margin-bottom: 15px;
      padding-bottom: 10px;
      border-bottom: 2px solid #ecf0f1;
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    th, td {
      padding: 12px;
      text-align: left;
      border-bottom: 1px solid #ecf0f1;
    }
    th {
      background: #f8f9fa;
      font-weight: 600;
      color: #2c3e50;
    }
    tr:hover {
      background: #f8f9fa;
    }
    .status-pass {
      color: #27ae60;
      font-weight: bold;
    }
    .status-fail {
      color: #e74c3c;
      font-weight: bold;
    }
    .chart-container {
      margin: 20px 0;
      padding: 20px;
      background: #f8f9fa;
      border-radius: 6px;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Load Test Report</h1>
    <div class="timestamp">Generated: ${timestamp}</div>

    <div class="summary">
      <div class="metric-card">
        <div class="metric-label">Total Requests</div>
        <div class="metric-value">${totalRequests.toLocaleString()}</div>
      </div>
      <div class="metric-card ${errorRate < 0.001 ? 'success' : 'error'}">
        <div class="metric-label">Failed Requests</div>
        <div class="metric-value">${failedRequests}</div>
      </div>
      <div class="metric-card ${errorRate < 0.001 ? 'success' : 'error'}">
        <div class="metric-label">Error Rate</div>
        <div class="metric-value">${(errorRate * 100).toFixed(2)}<span class="metric-unit">%</span></div>
      </div>
      <div class="metric-card ${duration['p(95)'] < 500 ? 'success' : 'warning'}">
        <div class="metric-label">Response Time (p95)</div>
        <div class="metric-value">${duration['p(95)']?.toFixed(2) || 'N/A'}<span class="metric-unit">ms</span></div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Max Virtual Users</div>
        <div class="metric-value">${vus.max || 0}</div>
      </div>
    </div>

    <div class="section">
      <h2 class="section-title">Performance Metrics</h2>
      <table>
        <thead>
          <tr>
            <th>Metric</th>
            <th>Min</th>
            <th>Avg</th>
            <th>Med</th>
            <th>p90</th>
            <th>p95</th>
            <th>p99</th>
            <th>Max</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>Request Duration</strong></td>
            <td>${duration.min?.toFixed(2) || 'N/A'} ms</td>
            <td>${duration.avg?.toFixed(2) || 'N/A'} ms</td>
            <td>${duration.med?.toFixed(2) || 'N/A'} ms</td>
            <td>${duration['p(90)']?.toFixed(2) || 'N/A'} ms</td>
            <td>${duration['p(95)']?.toFixed(2) || 'N/A'} ms</td>
            <td>${duration['p(99)']?.toFixed(2) || 'N/A'} ms</td>
            <td>${duration.max?.toFixed(2) || 'N/A'} ms</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="section">
      <h2 class="section-title">Performance Target Validation</h2>
      <table>
        <thead>
          <tr>
            <th>Target</th>
            <th>Threshold</th>
            <th>Actual</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>API Response Time (p95)</td>
            <td>&lt; 500ms</td>
            <td>${duration['p(95)']?.toFixed(2) || 'N/A'} ms</td>
            <td class="${duration['p(95)'] < 500 ? 'status-pass' : 'status-fail'}">
              ${duration['p(95)'] < 500 ? 'PASS' : 'FAIL'}
            </td>
          </tr>
          <tr>
            <td>Error Rate</td>
            <td>&lt; 0.1%</td>
            <td>${(errorRate * 100).toFixed(4)}%</td>
            <td class="${errorRate < 0.001 ? 'status-pass' : 'status-fail'}">
              ${errorRate < 0.001 ? 'PASS' : 'FAIL'}
            </td>
          </tr>
          <tr>
            <td>Concurrent Users</td>
            <td>100+</td>
            <td>${vus.max || 0}</td>
            <td class="${vus.max >= 100 ? 'status-pass' : 'status-fail'}">
              ${vus.max >= 100 ? 'PASS' : 'FAIL'}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="section">
      <h2 class="section-title">Custom Metrics</h2>
      <table>
        <thead>
          <tr>
            <th>Metric</th>
            <th>Count / Rate</th>
            <th>Average</th>
          </tr>
        </thead>
        <tbody>
          ${generateCustomMetricsRows(metrics)}
        </tbody>
      </table>
    </div>

    <div class="section">
      <h2 class="section-title">All Metrics</h2>
      <div class="chart-container">
        <pre>${JSON.stringify(metrics, null, 2)}</pre>
      </div>
    </div>
  </div>
</body>
</html>
`;

  fs.writeFileSync(outputPath, html);
  console.log(`HTML report generated: ${outputPath}`);
}

/**
 * Generate custom metrics rows
 */
function generateCustomMetricsRows(metrics) {
  const customMetrics = [
    'tasks_created',
    'workflows_triggered',
    'webhook_success',
    'webhook_errors',
    'api_list_tasks_duration',
    'api_create_task_duration',
    'dashboard_load_time',
  ];

  let rows = '';

  for (const metricName of customMetrics) {
    const metric = metrics[metricName];
    if (metric) {
      const count = metric.values?.count || 0;
      const rate = metric.values?.rate || 0;
      const avg = metric.values?.avg || 0;

      rows += `
        <tr>
          <td><strong>${metricName.replace(/_/g, ' ')}</strong></td>
          <td>${count > 0 ? count : (rate * 100).toFixed(2) + '%'}</td>
          <td>${avg > 0 ? avg.toFixed(2) + ' ms' : 'N/A'}</td>
        </tr>
      `;
    }
  }

  return rows || '<tr><td colspan="3">No custom metrics available</td></tr>';
}

/**
 * Main function
 */
function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('Usage: node report-generator.js <json-file>');
    console.error('Example: node report-generator.js results/api-summary.json');
    process.exit(1);
  }

  const jsonFile = args[0];

  if (!fs.existsSync(jsonFile)) {
    console.error(`File not found: ${jsonFile}`);
    process.exit(1);
  }

  try {
    const jsonData = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));
    const outputPath = jsonFile.replace('.json', '.html');

    generateHTMLReport(jsonData, outputPath);
    console.log('Report generation complete!');
  } catch (error) {
    console.error('Error generating report:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { generateHTMLReport };
