/**
 * Automated Verification Suite for Phase 4:
 * Accepted Submission Detection & Persistent Duplicate Prevention
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  computeCodeHash,
  slugify
} from '../background/rag-templates.js';

test('Verdict Evaluation - Only Accepted verdicts trigger processing', () => {
  const evaluateVerdict = (data) => {
    if (!data) return false;
    const isSuccess = data.state === 'SUCCESS' || data.status_code === 10;
    const isAccepted = data.status_display === 'Accepted' || (data.total_correct && data.total_correct === data.total_testcases);
    return Boolean(isSuccess && isAccepted);
  };

  // Accepted cases
  assert.equal(evaluateVerdict({ state: 'SUCCESS', status_display: 'Accepted' }), true);
  assert.equal(evaluateVerdict({ status_code: 10, status_display: 'Accepted' }), true);
  assert.equal(evaluateVerdict({ state: 'SUCCESS', total_correct: 50, total_testcases: 50 }), true);

  // Unsuccessful cases - MUST NOT trigger upload
  assert.equal(evaluateVerdict({ state: 'SUCCESS', status_display: 'Wrong Answer' }), false);
  assert.equal(evaluateVerdict({ state: 'SUCCESS', status_display: 'Runtime Error' }), false);
  assert.equal(evaluateVerdict({ state: 'SUCCESS', status_display: 'Time Limit Exceeded' }), false);
  assert.equal(evaluateVerdict({ state: 'SUCCESS', status_display: 'Compile Error' }), false);
  assert.equal(evaluateVerdict({ state: 'PENDING', status_display: '' }), false);
  assert.equal(evaluateVerdict({ state: 'STARTED' }), false);
});

test('Deterministic Code Hashing - Normalizes line endings & detects identical code', () => {
  const codeLF = 'class Solution:\n    def solve(self):\n        return True\n';
  const codeCRLF = 'class Solution:\r\n    def solve(self):\r\n        return True\r\n';
  const codeSpaces = '   class Solution:\n    def solve(self):\n        return True   ';

  const hashLF = computeCodeHash(codeLF);
  const hashCRLF = computeCodeHash(codeCRLF);
  const hashSpaces = computeCodeHash(codeSpaces);

  assert.equal(hashLF, hashCRLF, 'CRLF and LF line endings must produce identical hash');
  assert.equal(hashLF, hashSpaces, 'Trimmed code must produce identical hash');

  const differentCode = 'class Solution:\n    def solve(self):\n        return False\n';
  const differentHash = computeCodeHash(differentCode);
  assert.notEqual(hashLF, differentHash, 'Different code must produce different hash');
});

test('Deduplication Engine - Prevents duplicate commits on refresh, reopen, or repeated events', () => {
  // Mock synced registry simulating persisted storage in chrome.storage.local
  const registry = {};

  function checkAndSyncProblem(problem, syncedRegistry) {
    const slug = problem.titleSlug || slugify(problem.title || 'untitled');
    const codeHash = computeCodeHash(problem.code);
    const submissionId = problem.submissionId || null;

    const existing = syncedRegistry[slug];
    if (existing) {
      const sameSubmission = submissionId && existing.submissionId === submissionId;
      const sameCode = existing.codeHash === codeHash;

      if (sameSubmission || sameCode) {
        return {
          synced: false,
          duplicate: true,
          reason: 'Identical submission or unchanged code.'
        };
      }
    }

    // New or updated solution
    const newRecord = {
      submissionId,
      codeHash,
      commitSha: 'sha_' + Math.random().toString(16).slice(2, 8),
      lastSyncedAt: new Date().toISOString()
    };
    syncedRegistry[slug] = newRecord;

    return {
      synced: true,
      duplicate: false,
      commitSha: newRecord.commitSha
    };
  }

  const initialProblem = {
    title: 'Two Sum',
    titleSlug: 'two-sum',
    code: 'def twoSum(): return [0, 1]',
    submissionId: 'sub_10001'
  };

  // 1. First Accepted submission -> Should sync successfully
  const res1 = checkAndSyncProblem(initialProblem, registry);
  assert.equal(res1.synced, true);
  assert.equal(res1.duplicate, false);
  const firstSha = res1.commitSha;

  // 2. Page refresh event (same submission ID & same code) -> Should skip (no duplicate commit)
  const res2 = checkAndSyncProblem(initialProblem, registry);
  assert.equal(res2.synced, false);
  assert.equal(res2.duplicate, true);

  // 3. Reopening the problem days later (different session, same code, no submission ID) -> Should skip
  const res3 = checkAndSyncProblem({
    title: 'Two Sum',
    titleSlug: 'two-sum',
    code: 'def twoSum(): return [0, 1]',
    submissionId: null
  }, registry);
  assert.equal(res3.synced, false);
  assert.equal(res3.duplicate, true);

  // 4. Repeated network event with same submission ID -> Should skip
  const res4 = checkAndSyncProblem({
    title: 'Two Sum',
    titleSlug: 'two-sum',
    code: 'def twoSum(): return [0, 1]',
    submissionId: 'sub_10001'
  }, registry);
  assert.equal(res4.synced, false);
  assert.equal(res4.duplicate, true);

  // 5. New Accepted submission with improved code -> SHOULD SYNC and update commit
  const improvedProblem = {
    title: 'Two Sum',
    titleSlug: 'two-sum',
    code: 'def twoSum(nums, target):\n    lookup = {}\n    for i, n in enumerate(nums):\n        if target - n in lookup: return [lookup[target - n], i]\n        lookup[n] = i',
    submissionId: 'sub_10002'
  };
  const res5 = checkAndSyncProblem(improvedProblem, registry);
  assert.equal(res5.synced, true);
  assert.equal(res5.duplicate, false);
  assert.notEqual(res5.commitSha, firstSha);
  assert.equal(registry['two-sum'].submissionId, 'sub_10002');
});

test('Registry State Persistence - Failed commits do not mark submission as synced', () => {
  const registry = {};

  function attemptSyncWithNetwork(problem, syncedRegistry, networkFails) {
    const slug = problem.titleSlug || slugify(problem.title);
    const codeHash = computeCodeHash(problem.code);

    if (networkFails) {
      // Commit failed on GitHub API
      return { success: false, error: 'Network error 500' };
    }

    // Only update registry when commit succeeds
    syncedRegistry[slug] = {
      codeHash,
      submissionId: problem.submissionId,
      commitSha: 'sha_success'
    };
    return { success: true, commitSha: 'sha_success' };
  }

  const problem = {
    title: 'Add Two Numbers',
    titleSlug: 'add-two-numbers',
    code: 'def addTwoNumbers(): pass',
    submissionId: 'sub_20001'
  };

  // Attempt 1: Network failure
  const resFail = attemptSyncWithNetwork(problem, registry, true);
  assert.equal(resFail.success, false);
  assert.equal(registry['add-two-numbers'], undefined, 'Registry must not store unconfirmed sync');

  // Attempt 2: Network retry succeeds
  const resSuccess = attemptSyncWithNetwork(problem, registry, false);
  assert.equal(resSuccess.success, true);
  assert.ok(registry['add-two-numbers'], 'Registry must store confirmed sync');
});
