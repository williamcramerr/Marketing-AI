# Load Testing with k6

This directory contains load tests for the Marketing Pilot AI application using [k6](https://k6.io/), a modern load testing tool.

## Overview

The load testing infrastructure includes:

- **API Tests**: Authentication, task creation/retrieval, bulk operations
- **Webhook Tests**: Stripe webhook processing with concurrent handling
- **Dashboard Tests**: User navigation, data loading, real-time updates

## Performance Targets

| Metric | Target |
|--------|--------|
| API Response Time (p95) | < 500ms |
| Webhook Processing | < 200ms |
| Dashboard Load | < 2s |
| Concurrent Users | 100+ |
| Error Rate | < 0.1% |

## Installation

### Install k6

**macOS (Homebrew):**
```bash
brew install k6
```

**Linux:**
```bash
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6
```

**Windows (Chocolatey):**
```bash
choco install k6
```

Or download from: https://k6.io/docs/getting-started/installation/

### Install via npm (already added to package.json)
```bash
npm install
```

## Directory Structure

```
load-tests/
├── k6.config.js           # Central configuration for all scenarios
├── scenarios/
│   ├── api.js            # API endpoint load tests
│   ├── webhooks.js       # Webhook processing tests
│   └── dashboard.js      # Dashboard UI load tests
├── utils/
│   ├── auth.js           # Authentication utilities
│   ├── test-data.js      # Test data generators
│   └── metrics.js        # Custom metrics and checks
└── results/              # Test results (generated)
```

## Running Tests

### Quick Start

Before running tests, ensure your application is running locally or configure the environment:

```bash
# Start your Next.js application
npm run dev

# In another terminal, run load tests
npm run test:load:smoke
```

### Available npm Scripts

```bash
# Smoke test - Quick sanity check (1 VU, 1 min)
npm run test:load:smoke

# Standard load test - Normal load (50 VU, 5 min)
npm run test:load

# Stress test - Push to limits (ramp to 200 VU)
npm run test:load:stress

# Soak test - Extended duration (50 VU, 30 min)
npm run test:load:soak

# Webhook-specific tests
npm run test:load:webhooks

# Dashboard-specific tests
npm run test:load:dashboard

# Run all tests sequentially
npm run test:load:all
```

### Running Tests Directly with k6

You can also run k6 directly for more control:

```bash
# Run API tests with specific scenario
k6 run load-tests/scenarios/api.js --env SCENARIO=smoke
k6 run load-tests/scenarios/api.js --env SCENARIO=load
k6 run load-tests/scenarios/api.js --env SCENARIO=stress
k6 run load-tests/scenarios/api.js --env SCENARIO=soak

# Run webhook tests
k6 run load-tests/scenarios/webhooks.js

# Run dashboard tests
k6 run load-tests/scenarios/dashboard.js

# Run with specific environment
k6 run load-tests/scenarios/api.js --env ENV=staging --env SCENARIO=load

# Run with custom base URL
k6 run load-tests/scenarios/api.js --env BASE_URL=http://localhost:3000
```

## Test Scenarios

### 1. Smoke Test
- **Purpose**: Quick sanity check
- **Load**: 1 virtual user
- **Duration**: 1 minute
- **Use case**: Verify tests work before larger runs

### 2. Load Test
- **Purpose**: Verify performance under normal load
- **Load**: Ramp from 0 to 100 users over 19 minutes
- **Duration**: 19 minutes
- **Use case**: Validate performance targets

### 3. Stress Test
- **Purpose**: Find breaking points
- **Load**: Ramp from 0 to 250 users
- **Duration**: 21 minutes
- **Use case**: Determine maximum capacity

### 4. Soak Test
- **Purpose**: Find memory leaks and stability issues
- **Load**: Constant 50 users
- **Duration**: 30 minutes
- **Use case**: Long-term stability testing

## Environment Configuration

Set these environment variables to customize test execution:

```bash
# Environment to test (local, staging, production)
export ENV=local

# Custom base URL
export BASE_URL=http://localhost:3000

# Scenario to run (smoke, load, stress, soak)
export SCENARIO=load

# Stripe webhook secret for webhook tests
export STRIPE_WEBHOOK_SECRET=whsec_test_secret
```

## Test Data Setup

### Creating Test Users

Before running load tests, you need to create test user accounts:

1. Create 10 test users in your database:
   - `loadtest1@example.com` through `loadtest10@example.com`
   - Password: `LoadTest123!`

2. Create test organizations and link them to users

3. Create test campaigns and products

You can use the following SQL or run a setup script:

```sql
-- Example SQL to create test users (adjust for your schema)
INSERT INTO users (email, password_hash, created_at)
VALUES
  ('loadtest1@example.com', '$hashed_password', NOW()),
  ('loadtest2@example.com', '$hashed_password', NOW()),
  -- ... etc
```

### Test Campaign IDs

The tests use pre-defined campaign IDs. Update `utils/test-data.js` if your test data uses different IDs.

## Understanding Results

### Key Metrics

- **http_req_duration**: Time from request start to end
  - **p(95)**: 95th percentile - 95% of requests were faster than this
  - **p(99)**: 99th percentile - 99% of requests were faster than this
- **http_req_failed**: Percentage of failed requests
- **http_reqs**: Total number of requests
- **vus**: Number of virtual users
- **checks**: Percentage of successful checks

### Reading Output

```
✓ status is 200
✓ response time < 500ms

checks.........................: 99.95% ✓ 19990    ✗ 10
data_received..................: 50 MB  2.5 MB/s
data_sent......................: 10 MB  500 kB/s
http_req_duration..............: avg=245ms  min=45ms  med=198ms  max=1.2s  p(90)=380ms p(95)=450ms
http_req_failed................: 0.05%  ✓ 10       ✗ 19990
http_reqs......................: 20000  1000/s
vus............................: 50     min=0      max=100
```

### Performance Validation

The tests automatically validate against performance targets:

```
=== Performance Target Validation ===
P95 < 500ms: PASS (421.45ms)
Error Rate < 0.1%: PASS (0.05%)
============================
```

## Troubleshooting

### Common Issues

1. **Connection Refused**
   - Ensure your application is running
   - Check the BASE_URL is correct
   - Verify firewall/network settings

2. **Authentication Failures**
   - Verify test users exist in database
   - Check credentials match in `utils/auth.js`
   - Ensure auth endpoints are working

3. **High Error Rates**
   - Check application logs for errors
   - Verify database connections
   - Check rate limiting settings
   - Review resource utilization (CPU, memory)

4. **Timeouts**
   - Application may be overloaded
   - Database queries may be slow
   - Check for N+1 queries
   - Review caching strategy

### Debugging

Run with verbose output:
```bash
k6 run --verbose load-tests/scenarios/api.js
```

Run with specific VUs for debugging:
```bash
k6 run --vus 1 --duration 30s load-tests/scenarios/api.js
```

## Best Practices

1. **Start Small**: Always run smoke tests first
2. **Gradual Increase**: Ramp up load gradually
3. **Monitor Resources**: Watch CPU, memory, database connections
4. **Realistic Data**: Use production-like test data
5. **Clean Up**: Remove test data after runs if needed
6. **Baseline**: Establish baseline performance before changes
7. **Regular Testing**: Run load tests regularly, not just before releases

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Load Tests

on:
  schedule:
    - cron: '0 2 * * *'  # Run daily at 2 AM
  workflow_dispatch:

jobs:
  load-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Install k6
        run: |
          sudo gpg -k
          sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
          echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
          sudo apt-get update
          sudo apt-get install k6
      - name: Run smoke test
        run: npm run test:load:smoke
        env:
          BASE_URL: ${{ secrets.STAGING_URL }}
```

## Advanced Usage

### Custom Scenarios

Create custom scenarios in `k6.config.js`:

```javascript
customScenario: {
  executor: 'ramping-vus',
  startVUs: 0,
  stages: [
    { duration: '5m', target: 100 },
    { duration: '10m', target: 100 },
    { duration: '5m', target: 0 },
  ],
},
```

### Cloud Execution

Run tests in k6 Cloud:

```bash
k6 cloud load-tests/scenarios/api.js
```

### Distributed Execution

For very large tests, use k6 operator on Kubernetes or distributed execution mode.

## Resources

- [k6 Documentation](https://k6.io/docs/)
- [k6 Best Practices](https://k6.io/docs/testing-guides/test-types/)
- [Performance Testing Guide](https://k6.io/docs/testing-guides/)

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review k6 documentation
3. Check application logs
4. Contact the development team
