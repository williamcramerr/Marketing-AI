/**
 * Authentication utilities for k6 load tests
 */

import http from 'k6/http';
import { check } from 'k6';

/**
 * Create a test user session
 * This simulates the authentication flow
 *
 * @param {string} baseUrl - Base URL of the application
 * @param {object} credentials - User credentials {email, password}
 * @returns {object} Session data including cookies and user info
 */
export function authenticateUser(baseUrl, credentials) {
  const loginUrl = `${baseUrl}/api/auth/login`;

  const payload = JSON.stringify({
    email: credentials.email,
    password: credentials.password,
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
  };

  const response = http.post(loginUrl, payload, params);

  const success = check(response, {
    'login successful': (r) => r.status === 200,
    'received auth token': (r) => r.json('access_token') !== undefined,
  });

  if (!success) {
    console.error(`Authentication failed: ${response.status} ${response.body}`);
    return null;
  }

  const body = response.json();
  const cookies = response.cookies;

  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token,
    user: body.user,
    cookies: cookies,
    organizationId: body.user?.organization_id,
  };
}

/**
 * Get authentication headers for authenticated requests
 *
 * @param {object} session - Session data from authenticateUser
 * @returns {object} Headers object
 */
export function getAuthHeaders(session) {
  if (!session || !session.accessToken) {
    return {};
  }

  return {
    'Authorization': `Bearer ${session.accessToken}`,
    'Content-Type': 'application/json',
  };
}

/**
 * Get authentication params including cookies
 *
 * @param {object} session - Session data from authenticateUser
 * @returns {object} k6 params object
 */
export function getAuthParams(session) {
  const headers = getAuthHeaders(session);

  return {
    headers,
    cookies: session?.cookies || {},
  };
}

/**
 * Validate session is still active
 *
 * @param {string} baseUrl - Base URL of the application
 * @param {object} session - Session data
 * @returns {boolean} True if session is valid
 */
export function validateSession(baseUrl, session) {
  const validateUrl = `${baseUrl}/api/auth/session`;
  const params = getAuthParams(session);

  const response = http.get(validateUrl, params);

  return check(response, {
    'session valid': (r) => r.status === 200,
    'user data present': (r) => r.json('user') !== undefined,
  });
}

/**
 * Create test credentials for load testing
 * In a real scenario, you would have pre-created test accounts
 *
 * @param {number} index - User index for unique credentials
 * @returns {object} Credentials object
 */
export function getTestCredentials(index = 0) {
  const testUsers = [
    { email: 'loadtest1@example.com', password: 'LoadTest123!' },
    { email: 'loadtest2@example.com', password: 'LoadTest123!' },
    { email: 'loadtest3@example.com', password: 'LoadTest123!' },
    { email: 'loadtest4@example.com', password: 'LoadTest123!' },
    { email: 'loadtest5@example.com', password: 'LoadTest123!' },
    { email: 'loadtest6@example.com', password: 'LoadTest123!' },
    { email: 'loadtest7@example.com', password: 'LoadTest123!' },
    { email: 'loadtest8@example.com', password: 'LoadTest123!' },
    { email: 'loadtest9@example.com', password: 'LoadTest123!' },
    { email: 'loadtest10@example.com', password: 'LoadTest123!' },
  ];

  return testUsers[index % testUsers.length];
}

/**
 * Refresh an expired access token
 *
 * @param {string} baseUrl - Base URL of the application
 * @param {object} session - Session data with refresh token
 * @returns {object} Updated session data
 */
export function refreshAccessToken(baseUrl, session) {
  if (!session || !session.refreshToken) {
    console.error('No refresh token available');
    return null;
  }

  const refreshUrl = `${baseUrl}/api/auth/refresh`;

  const payload = JSON.stringify({
    refresh_token: session.refreshToken,
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
  };

  const response = http.post(refreshUrl, payload, params);

  const success = check(response, {
    'token refresh successful': (r) => r.status === 200,
    'received new access token': (r) => r.json('access_token') !== undefined,
  });

  if (!success) {
    console.error(`Token refresh failed: ${response.status}`);
    return null;
  }

  const body = response.json();

  return {
    ...session,
    accessToken: body.access_token,
    refreshToken: body.refresh_token || session.refreshToken,
  };
}
