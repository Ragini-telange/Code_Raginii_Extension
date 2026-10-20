/**
 * Automated Verification Suite for Phase 2:
 * GitHub Authentication & Repository Selection
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  utf8ToBase64,
  base64ToUtf8,
  validateGitHubToken,
  fetchUserRepositories,
  verifyRepository,
  createGitHubRepository
} from '../background/github-api.js';

test('UTF-8 Base64 Encoding & Decoding', () => {
  const original = 'Hello World! 🚀 Code_Raginii äöü';
  const encoded = utf8ToBase64(original);
  const decoded = base64ToUtf8(encoded);
  assert.equal(decoded, original, 'Decoded string should match original UTF-8 string');
});

test('Token Validation - Rejects empty or invalid token format', async () => {
  const resultEmpty = await validateGitHubToken('');
  assert.equal(resultEmpty.valid, false);
  assert.match(resultEmpty.error, /cannot be empty/i);

  const resultNull = await validateGitHubToken(null);
  assert.equal(resultNull.valid, false);
});

test('Token Validation - Successful authentication with classic token (mocked)', async () => {
  const mockFetch = async (url, options) => {
    assert.match(url, /\/user$/);
    assert.equal(options.headers['Authorization'], 'Bearer ghp_testtoken1234567890');
    return {
      ok: true,
      status: 200,
      headers: new Headers({
        'content-type': 'application/json',
        'x-oauth-scopes': 'repo, read:user'
      }),
      json: async () => ({
        id: 12345,
        login: 'testuser',
        name: 'Test User',
        avatar_url: 'https://avatars.githubusercontent.com/u/12345',
        html_url: 'https://github.com/testuser',
        public_repos: 10,
        total_private_repos: 5
      })
    };
  };

  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockFetch;

  try {
    const res = await validateGitHubToken('ghp_testtoken1234567890');
    assert.equal(res.valid, true);
    assert.equal(res.user.login, 'testuser');
    assert.equal(res.user.name, 'Test User');
    assert.deepEqual(res.scopes, ['repo', 'read:user']);
    assert.equal(res.hasRepoScope, true);
    assert.equal(res.isFineGrained, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Token Validation - Handles 401 Unauthorized', async () => {
  const mockFetch = async () => ({
    ok: false,
    status: 401,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => ({ message: 'Bad credentials' })
  });

  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockFetch;

  try {
    const res = await validateGitHubToken('ghp_expired_token');
    assert.equal(res.valid, false);
    assert.match(res.error, /Invalid token or credentials expired/i);
    assert.equal(res.status, 401);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Fetch User Repositories - Correctly parses list & permissions', async () => {
  const mockFetch = async (url) => {
    assert.match(url, /\/user\/repos/);
    return {
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => [
        {
          id: 101,
          name: 'Code_Raginii_Extension',
          full_name: 'testuser/Code_Raginii_Extension',
          owner: { login: 'testuser' },
          private: false,
          default_branch: 'main',
          html_url: 'https://github.com/testuser/Code_Raginii_Extension',
          description: 'LeetCode solutions sync',
          permissions: { push: true, pull: true, admin: true }
        },
        {
          id: 102,
          name: 'other-repo',
          full_name: 'org/other-repo',
          owner: { login: 'org' },
          private: true,
          default_branch: 'master',
          html_url: 'https://github.com/org/other-repo',
          description: 'Other project',
          permissions: { push: false, pull: true }
        }
      ]
    };
  };

  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockFetch;

  try {
    const res = await fetchUserRepositories('token123');
    assert.equal(res.success, true);
    assert.equal(res.repos.length, 2);
    assert.equal(res.repos[0].name, 'Code_Raginii_Extension');
    assert.equal(res.repos[0].canPush, true);
    assert.equal(res.repos[0].defaultBranch, 'main');
    assert.equal(res.repos[1].private, true);
    assert.equal(res.repos[1].canPush, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Verify Repository - Verifies existing repo & write access', async () => {
  const mockFetch = async (url) => {
    assert.match(url, /\/repos\/testuser\/Code_Raginii_Extension$/);
    return {
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({
        id: 101,
        name: 'Code_Raginii_Extension',
        full_name: 'testuser/Code_Raginii_Extension',
        default_branch: 'main',
        html_url: 'https://github.com/testuser/Code_Raginii_Extension',
        private: false,
        permissions: { push: true }
      })
    };
  };

  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockFetch;

  try {
    const res = await verifyRepository('token123', 'testuser', 'Code_Raginii_Extension');
    assert.equal(res.exists, true);
    assert.equal(res.canPush, true);
    assert.equal(res.defaultBranch, 'main');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Verify Repository - Handles 404 Not Found', async () => {
  const mockFetch = async () => ({
    ok: false,
    status: 404,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => ({ message: 'Not Found' })
  });

  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockFetch;

  try {
    const res = await verifyRepository('token123', 'testuser', 'non-existent-repo');
    assert.equal(res.exists, false);
    assert.equal(res.canPush, false);
    assert.match(res.error, /not found/i);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Create GitHub Repository - Issues POST with auto_init & default name', async () => {
  const mockFetch = async (url, options) => {
    assert.match(url, /\/user\/repos$/);
    assert.equal(options.method, 'POST');
    const body = JSON.parse(options.body);
    assert.equal(body.name, 'Code_Raginii_Extension');
    assert.equal(body.auto_init, true);
    assert.equal(body.private, false);

    return {
      ok: true,
      status: 201,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({
        id: 202,
        name: 'Code_Raginii_Extension',
        full_name: 'testuser/Code_Raginii_Extension',
        default_branch: 'main',
        html_url: 'https://github.com/testuser/Code_Raginii_Extension',
        private: false
      })
    };
  };

  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockFetch;

  try {
    const res = await createGitHubRepository('token123', 'Code_Raginii_Extension', false);
    assert.equal(res.success, true);
    assert.equal(res.repo.name, 'Code_Raginii_Extension');
    assert.equal(res.repo.defaultBranch, 'main');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
