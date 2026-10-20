/**
 * Automated Verification Suite for Phase 3:
 * Solution Formatting, Multi-Language Support, Bundle Creation & Root README Maintenance
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getLanguageConfig,
  slugify,
  computeCodeHash,
  resolveProblemDirectory,
  resolveCommitMessage,
  formatSolutionCode,
  generateProblemReadme,
  buildRootReadme,
  buildProblemSyncBundle
} from '../background/rag-templates.js';

test('Language Config - Supports C++, Python, Java, JavaScript, TypeScript, C, and SQL', () => {
  const cases = [
    { key: 'python', ext: 'py', comment: '# ' },
    { key: 'python3', ext: 'py', comment: '# ' },
    { key: 'cpp', ext: 'cpp', comment: '// ' },
    { key: 'c++', ext: 'cpp', comment: '// ' },
    { key: 'java', ext: 'java', comment: '// ' },
    { key: 'javascript', ext: 'js', comment: '// ' },
    { key: 'typescript', ext: 'ts', comment: '// ' },
    { key: 'c', ext: 'c', comment: '// ' },
    { key: 'sql', ext: 'sql', comment: '-- ' }
  ];

  for (const c of cases) {
    const config = getLanguageConfig(c.key);
    assert.equal(config.ext, c.ext, `Extension for ${c.key} should be ${c.ext}`);
    assert.equal(config.commentPrefix, c.comment, `Comment prefix for ${c.key} should be ${c.comment}`);
  }
});

test('Problem Directory Resolution - Formats leetcode-solutions/{Difficulty}/{id4}{titleSlug}', () => {
  const p1 = {
    id: 1,
    title: 'Two Sum',
    titleSlug: 'two-sum',
    difficulty: 'Easy'
  };
  const dir1 = resolveProblemDirectory(null, p1);
  assert.equal(dir1, 'leetcode-solutions/Easy/0001-two-sum');

  const p2 = {
    id: 15,
    title: '3Sum',
    titleSlug: '3sum',
    difficulty: 'Medium'
  };
  const dir2 = resolveProblemDirectory(null, p2);
  assert.equal(dir2, 'leetcode-solutions/Medium/0015-3sum');

  const pFallback = {
    title: 'Custom Mystery Problem',
    difficulty: 'Hard'
  };
  const dirFallback = resolveProblemDirectory(null, pFallback);
  assert.equal(dirFallback, 'leetcode-solutions/Hard/custom-mystery-problem');
});

test('Format Solution Code - Correct comment prefix and header structure per language', () => {
  // 1. Python
  const pyCode = 'def twoSum(nums, target):\n    return []';
  const pyFormatted = formatSolutionCode(pyCode, {
    id: 1,
    title: 'Two Sum',
    difficulty: 'Easy',
    language: 'python3',
    runtime: '42 ms'
  });
  assert.match(pyFormatted, /^# ==========================================================================/);
  assert.match(pyFormatted, /# Problem: 1\. Two Sum \(Easy\)/);
  assert.match(pyFormatted, /# Language: Python3/);
  assert.match(pyFormatted, /# Synced by Code_Raginii/);
  assert.match(pyFormatted, /def twoSum/);

  // 2. C++
  const cppCode = 'class Solution {\npublic:\n    vector<int> twoSum() {}\n};';
  const cppFormatted = formatSolutionCode(cppCode, {
    id: 1,
    title: 'Two Sum',
    difficulty: 'Easy',
    language: 'cpp'
  });
  assert.match(cppFormatted, /^\/\/ ==========================================================================/);
  assert.match(cppFormatted, /\/\/ Language: C\+\+/);

  // 3. SQL
  const sqlCode = 'SELECT name FROM Customers WHERE referee_id != 2;';
  const sqlFormatted = formatSolutionCode(sqlCode, {
    id: 584,
    title: 'Find Customer Referee',
    difficulty: 'Easy',
    language: 'sql'
  });
  assert.match(sqlFormatted, /^-- ==========================================================================/);
  assert.match(sqlFormatted, /-- Language: SQL/);
});

test('Generate Problem Readme - Clean markdown without RAG tags', () => {
  const p = {
    id: 1,
    title: 'Two Sum',
    difficulty: 'Easy',
    language: 'python3',
    runtime: '45 ms',
    memory: '17 MB'
  };
  const readme = generateProblemReadme(p);
  assert.match(readme, /^# 1\. Two Sum/);
  assert.match(readme, /- \*\*Difficulty\*\*: `Easy`/);
  assert.match(readme, /- \*\*Language\*\*: `Python3`/);
  assert.match(readme, /\[Python3 Solution\]\(\.\/solution\.py\)/);
  assert.doesNotMatch(readme, /RAG_METADATA/);
  assert.doesNotMatch(readme, /Vector_Ready/);
});

test('Root README Maintenance - Calculates unique counts & table without duplicate rows', () => {
  const registry = {
    'two-sum': {
      id: 1,
      title: 'Two Sum',
      titleSlug: 'two-sum',
      difficulty: 'Easy',
      language: 'Python3',
      solutionPath: 'leetcode-solutions/Easy/0001-two-sum/solution.py',
      url: 'https://leetcode.com/problems/two-sum/'
    },
    'add-two-numbers': {
      id: 2,
      title: 'Add Two Numbers',
      titleSlug: 'add-two-numbers',
      difficulty: 'Medium',
      language: 'Java',
      solutionPath: 'leetcode-solutions/Medium/0002-add-two-numbers/solution.java',
      url: 'https://leetcode.com/problems/add-two-numbers/'
    }
  };

  const initialReadme = buildRootReadme(registry);
  assert.match(initialReadme, /# Code_Raginii — LeetCode Solutions/);
  assert.match(initialReadme, /Total Unique Problems\*\*: \*\*2\*\*/);
  assert.match(initialReadme, /Easy: 1 \| 🟡 Medium: 1 \| 🔴 Hard: 0/);
  assert.match(initialReadme, /\| 1 \| \[Two Sum\]\(https:\/\/leetcode\.com\/problems\/two-sum\/\) \| `Easy` \| `Python3` \|/);
  assert.match(initialReadme, /\| 2 \| \[Add Two Numbers\]\(https:\/\/leetcode\.com\/problems\/add-two-numbers\/\) \| `Medium` \| `Java` \|/);

  // Update existing problem 'two-sum' with C++ solution (e.g. user re-solved in C++)
  registry['two-sum'] = {
    id: 1,
    title: 'Two Sum',
    titleSlug: 'two-sum',
    difficulty: 'Easy',
    language: 'C++',
    solutionPath: 'leetcode-solutions/Easy/0001-two-sum/solution.cpp',
    url: 'https://leetcode.com/problems/two-sum/'
  };

  const updatedReadme = buildRootReadme(registry);
  // Must still have exactly 2 unique problems
  assert.match(updatedReadme, /Total Unique Problems\*\*: \*\*2\*\*/);
  // Table must contain updated C++ entry
  assert.match(updatedReadme, /\| 1 \| \[Two Sum\].*\| `Easy` \| `C\+\+` \|/);
  // Count of '| 1 |' in table must be exactly 1 (no duplicate rows!)
  const matches = updatedReadme.match(/\| 1 \|/g);
  assert.equal(matches.length, 1, 'Problem 1 must appear only once in the table');
});

test('Build Problem Bundle - Packages solution file and problem documentation correctly', () => {
  const problem = {
    id: 1,
    title: 'Two Sum',
    difficulty: 'Easy',
    language: 'python3',
    code: 'def twoSum(): pass'
  };

  const bundle = buildProblemSyncBundle(problem);
  assert.equal(bundle.dirPath, 'leetcode-solutions/Easy/0001-two-sum');
  assert.equal(bundle.solutionFileName, 'solution.py');
  assert.equal(bundle.files.length, 2);
  assert.equal(bundle.files[0].path, 'leetcode-solutions/Easy/0001-two-sum/solution.py');
  assert.equal(bundle.files[1].path, 'leetcode-solutions/Easy/0001-two-sum/README.md');
});
