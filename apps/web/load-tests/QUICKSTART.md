# Load Testing Quick Start Guide

Get started with load testing in 5 minutes!

## Prerequisites

- Node.js 18+ installed
- k6 installed (see installation below)
- Your Next.js app running locally or on a test server

## Step 1: Install k6

### macOS
```bash
brew install k6
```

### Linux
```bash
curl https://github.com/grafana/k6/releases/download/v0.48.0/k6-v0.48.0-linux-amd64.tar.gz -L | tar xvz --strip-components 1
sudo mv k6 /usr/local/bin/
```

### Windows
```bash
choco install k6
```

Or download from: https://k6.io/docs/get-started/installation/

## Step 2: Setup Test Data

You need test users and data before running load tests. Choose one option:

### Option A: Manual Setup (Quick)
1. Create a test user in your app:
   - Email: `loadtest1@example.com`
   - Password: `LoadTest123!`

2. Create a test organization and link the user to it

3. Create a few test campaigns and products

### Option B: Automated Setup (Recommended)
```bash
# Copy environment file
cp load-tests/.env.example load-tests/.env

# Edit .env with your Supabase credentials
# Then run:
node load-tests/setup-test-data.js
```

## Step 3: Run Your First Test

### Start Your App
```bash
npm run dev
```

### Run Smoke Test (in another terminal)
```bash
npm run test:load:smoke
```

This will run a quick 1-minute test with 1 user to verify everything works.

## Step 4: Run Full Load Test

Once smoke test passes:

```bash
npm run test:load
```

This runs a 19-minute test ramping up to 100 concurrent users.

## Understanding Results

Look for these key metrics in the output:

```
✓ status is 200
✓ response time < 500ms

checks.........................: 99.95% ✓ 19990    ✗ 10
http_req_duration..............: avg=245ms  p(95)=450ms
http_req_failed................: 0.05%
```

**Good Results:**
- ✓ checks > 99%
- ✓ http_req_duration p(95) < 500ms
- ✓ http_req_failed < 0.1%

**Bad Results:**
- ✗ Many failed checks
- ✗ High response times
- ✗ Error rate > 1%

## Next Steps

### Run Different Test Types

```bash
# API endpoints
npm run test:load                # Standard load test
npm run test:load:stress         # Stress test (up to 200 VU)

# Webhooks
npm run test:load:webhooks       # Stripe webhook tests

# Dashboard
npm run test:load:dashboard      # UI navigation tests
```

### Test Against Different Environments

```bash
# Test against staging
k6 run load-tests/scenarios/api.js \
  --env ENV=staging \
  --env SCENARIO=smoke

# Test against custom URL
k6 run load-tests/scenarios/api.js \
  --env BASE_URL=https://your-app.com \
  --env SCENARIO=load
```

### Generate HTML Reports

After running a test:

```bash
# The test saves results to load-tests/results/
node load-tests/utils/report-generator.js load-tests/results/api-summary.json
```

This creates an HTML report you can open in your browser.

## Troubleshooting

### "Connection refused" error
- Make sure your app is running: `npm run dev`
- Check the URL is correct (default: http://localhost:3000)

### "Authentication failed" error
- Verify test users exist in database
- Check credentials in `load-tests/utils/auth.js`
- Run setup script: `node load-tests/setup-test-data.js`

### High response times
- Check your database connections
- Look for slow queries in logs
- Monitor CPU/memory usage
- Check for N+1 query problems

### Tests timeout
- Your app might be overloaded
- Reduce virtual users (VUs)
- Check database performance
- Review error logs

## Common Commands Cheat Sheet

```bash
# Quick smoke test
npm run test:load:smoke

# Standard load test
npm run test:load

# All tests
npm run test:load:all

# Custom test with k6
k6 run load-tests/scenarios/api.js --env SCENARIO=smoke --vus 1 --duration 30s

# Setup test data
node load-tests/setup-test-data.js

# Cleanup test data
node load-tests/setup-test-data.js cleanup

# Generate report
node load-tests/utils/report-generator.js load-tests/results/api-summary.json
```

## Performance Targets Reference

| Metric | Target | Test Command |
|--------|--------|--------------|
| API p95 | < 500ms | `npm run test:load` |
| Webhook p95 | < 200ms | `npm run test:load:webhooks` |
| Dashboard p95 | < 2s | `npm run test:load:dashboard` |
| Error Rate | < 0.1% | All tests |
| Concurrent Users | 100+ | `npm run test:load` |

## What's Next?

1. Read the full [README.md](./README.md) for detailed documentation
2. Customize scenarios in `k6.config.js`
3. Add your own test scenarios
4. Integrate with CI/CD
5. Set up monitoring dashboards

## Getting Help

- Check [README.md](./README.md) for detailed docs
- Visit [k6 Documentation](https://k6.io/docs/)
- Review test files in `scenarios/` directory
- Check application logs for errors

## Example Output

Here's what a successful test looks like:

```
     ✓ status is 200
     ✓ response time < 500ms
     ✓ has data field

     checks.........................: 99.95% ✓ 19990      ✗ 10
     data_received..................: 50 MB  2.5 MB/s
     data_sent......................: 10 MB  500 kB/s
     http_req_duration..............: avg=245ms min=45ms med=198ms max=1.2s p(90)=380ms p(95)=450ms
     http_req_failed................: 0.05%  ✓ 10         ✗ 19990
     http_reqs......................: 20000  1000/s
     vus............................: 50     min=0        max=100

=== Performance Target Validation ===
P95 < 500ms: PASS (450.23ms)
Error Rate < 0.1%: PASS (0.05%)
============================
```

Happy load testing!
