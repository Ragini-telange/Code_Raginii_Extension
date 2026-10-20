/**
 * Code_Raginii - Background Service Worker (Manifest V3)
 * Coordinates GitHub authentication, repository settings, duplicate prevention,
 * and automated solution uploads when LeetCode submissions are Accepted.
 */

import {
  validateGitHubToken,
  fetchUserRepositories,
  verifyRepository,
  createGitHubRepository,
  runTestCommit,
  commitMultipleFilesToGitHub
} from './github-api.js';

import {
  buildProblemSyncBundle,
  buildRootReadme,
  slugify,
  computeCodeHash
} from './rag-templates.js';

// Default initial state
const DEFAULT_STATE = {
  auth: {
    connected: false,
    token: null,
    username: null,
    name: null,
    avatarUrl: null,
    repo: 'Code_Raginii_Extension',
    owner: null,
    branch: 'main',
    scopes: [],
    tokenConfigured: false
  },
  syncStatus: {
    state: 'ready', // 'ready' | 'syncing' | 'success' | 'error'
    lastSyncedAt: null,
    lastError: null,
    latestMessage: 'Waiting for an accepted submission',
    latestProblem: null,
    totalSynced: 0
  },
  settings: {
    autoSync: true,
    directoryPattern: 'leetcode-solutions/{Difficulty}/{id4}{titleSlug}',
    commitMessagePattern: 'Solved {title} [{difficulty}] - Code_Raginii',
    targetBranch: 'main',
    preventDuplicates: true
  },
  syncedRegistry: {} // maps slug -> { id, title, titleSlug, difficulty, language, solutionPath, dirPath, commitSha, codeHash, submissionId, lastSyncedAt }
};

// Initialize default state on extension installation or update
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log(`[Code_Raginii] Extension installed/updated. Reason: ${details.reason}`);

  try {
    const existing = await chrome.storage.local.get(['auth', 'syncStatus', 'settings', 'syncedRegistry']);
    const updates = {};

    for (const [key, value] of Object.entries(DEFAULT_STATE)) {
      if (existing[key] === undefined) {
        updates[key] = value;
      } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        updates[key] = { ...value, ...existing[key] };
      }
    }

    if (updates.auth?.repo === 'rag_leetsync' || existing.auth?.repo === 'rag_leetsync') {
      updates.auth = { ...(updates.auth || existing.auth), repo: 'Code_Raginii_Extension' };
    }

    if (Object.keys(updates).length > 0) {
      await chrome.storage.local.set(updates);
      console.log('[Code_Raginii] Storage initialized:', updates);
    }
  } catch (error) {
    console.error('[Code_Raginii] Failed to initialize storage:', error);
  }
});

// In-flight concurrency lock to prevent duplicate commits for simultaneous events
const activeSyncLocks = new Set();

/**
 * Core synchronization orchestrator: uploads accepted solution and updates repository root README.
 */
async function processProblemSync(problem, options = {}) {
  const slug = problem.titleSlug || slugify(problem.title || 'untitled');

  if (activeSyncLocks.has(slug)) {
    console.log(`[Code_Raginii] Concurrency lock: Sync already running for '${slug}'. Duplicate skipped.`);
    return {
      success: true,
      duplicate: true,
      message: 'Sync already in progress for this problem.'
    };
  }
  activeSyncLocks.add(slug);

  try {
    const { auth, settings, syncStatus, syncedRegistry } = await chrome.storage.local.get([
      'auth',
      'settings',
      'syncStatus',
      'syncedRegistry'
    ]);

    if (!auth?.token || !auth?.connected) {
      const errStatus = {
        ...syncStatus,
        state: 'error',
        latestMessage: 'Upload failed — GitHub is not connected',
        lastError: 'GitHub is not authenticated. Please open Code_Raginii and connect your account.'
      };
      await chrome.storage.local.set({ syncStatus: errStatus });
      return {
        success: false,
        error: 'GitHub is not authenticated. Please open Code_Raginii and connect your account.'
      };
    }

    const codeHash = computeCodeHash(problem.code);
    const submissionId = problem.submissionId || null;

  // 1. Duplicate Prevention Check
  const registry = syncedRegistry || {};
  const existingSync = registry[slug];

  if (settings?.preventDuplicates !== false && !options.forceSync && existingSync) {
    const sameSubmission = submissionId && existingSync.submissionId === submissionId;
    const sameCode = existingSync.codeHash === codeHash;

    if (sameSubmission || sameCode) {
      console.log(`[Code_Raginii] Duplicate detected for '${problem.title}'. Skipping re-upload.`);
      const dupStatus = {
        ...syncStatus,
        state: 'ready',
        latestMessage: `Already up to date on GitHub: ${problem.title}`,
        latestProblem: {
          title: problem.title,
          difficulty: problem.difficulty,
          commitSha: existingSync.commitSha
        }
      };
      await chrome.storage.local.set({ syncStatus: dupStatus });

      return {
        success: true,
        duplicate: true,
        message: 'Solution code is already up to date on GitHub. Skipped duplicate upload.',
        commitSha: existingSync.commitSha,
        commitUrl: existingSync.commitUrl,
        dirPath: existingSync.dirPath
      };
    }
  }

  // Update status to syncing
  await chrome.storage.local.set({
    syncStatus: {
      ...syncStatus,
      state: 'syncing',
      latestMessage: `Uploading ${problem.title}...`
    }
  });

  const owner = auth.owner || auth.username;
  const repo = auth.repo || 'Code_Raginii_Extension';
  const branch = auth.branch || 'main';

  const dirPattern = settings?.directoryPattern || 'leetcode-solutions/{Difficulty}/{id4}{titleSlug}';
  const commitMsgPattern = settings?.commitMessagePattern || 'Solved {title} [{difficulty}] - Code_Raginii';

  // Build the solution file + problem README
  const bundle = buildProblemSyncBundle(problem, dirPattern, commitMsgPattern);

  // Update root README representation
  const newRecord = {
    id: problem.id || problem.questionId || null,
    title: problem.title,
    titleSlug: slug,
    difficulty: problem.difficulty || 'Easy',
    language: problem.language || 'python3',
    solutionPath: bundle.solutionFilePath,
    dirPath: bundle.dirPath,
    codeHash: codeHash,
    submissionId: submissionId,
    url: problem.url || `https://leetcode.com/problems/${slug}/`,
    syncedAt: new Date().toISOString()
  };

  const updatedRegistry = {
    ...registry,
    [slug]: newRecord
  };

  // Generate updated root README.md containing the summary table of all unique problems
  const rootReadmeContent = buildRootReadme(updatedRegistry);

  const filesToCommit = [
    ...bundle.files,
    {
      path: 'README.md',
      content: rootReadmeContent,
      description: 'Main repository problem summary table'
    }
  ];

  console.log(`[Code_Raginii] Committing problem "${problem.title}" to ${owner}/${repo} (${bundle.dirPath})`);

  // Execute commit via GitHub API
  const commitResult = await commitMultipleFilesToGitHub(
    auth.token,
    owner,
    repo,
    filesToCommit,
    bundle.commitMessage,
    branch
  );

  if (!commitResult.success) {
    console.error('[Code_Raginii] Commit failed:', commitResult.error);
    const failStatus = {
      ...syncStatus,
      state: 'error',
      latestMessage: `Upload failed — ${commitResult.error}`,
      lastError: commitResult.error
    };
    await chrome.storage.local.set({ syncStatus: failStatus });

    return {
      success: false,
      error: commitResult.error,
      message: 'Upload failed — check your connection and retry.'
    };
  }

  // Update registry and status on success
  const completedRecord = {
    ...newRecord,
    commitSha: commitResult.commitSha,
    commitUrl: commitResult.commitUrl
  };

  updatedRegistry[slug] = completedRecord;

  const uniqueCount = Object.keys(updatedRegistry).length;
  const successStatus = {
    state: 'success',
    lastSyncedAt: new Date().toISOString(),
    lastError: null,
    latestMessage: `Solution uploaded successfully: ${problem.id ? `${problem.id}. ` : ''}${problem.title} (${problem.difficulty || 'Easy'})`,
    latestProblem: completedRecord,
    totalSynced: uniqueCount
  };

  await chrome.storage.local.set({
    syncedRegistry: updatedRegistry,
    syncStatus: successStatus
  });

  // Native notification
  try {
    if (chrome.notifications && chrome.notifications.create) {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: chrome.runtime.getURL('icons/icon128.png'),
        title: 'Code_Raginii',
        message: `Uploaded "${problem.title}" to ${owner}/${repo}`,
        priority: 1
      });
    }
  } catch (e) {}

    return {
      success: true,
      commitSha: commitResult.commitSha,
      commitUrl: commitResult.commitUrl,
      dirPath: bundle.dirPath,
      record: completedRecord
    };
  } finally {
    activeSyncLocks.delete(slug);
  }
}

// Main message router
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const handler = async () => {
    switch (message.type) {
      case 'PING': {
        return {
          status: 'PONG',
          name: 'Code_Raginii',
          version: chrome.runtime.getManifest().version,
          timestamp: new Date().toISOString()
        };
      }

      case 'GET_STATUS': {
        const data = await chrome.storage.local.get(['auth', 'syncStatus', 'settings', 'syncedRegistry']);
        const safeAuth = data.auth ? { ...data.auth } : { ...DEFAULT_STATE.auth };
        if (safeAuth.token) {
          const t = safeAuth.token;
          safeAuth.maskedToken = t.length > 8 ? `${t.slice(0, 4)}••••••••${t.slice(-4)}` : '••••••••';
          safeAuth.token = undefined;
        }
        return {
          success: true,
          data: {
            auth: safeAuth,
            syncStatus: data.syncStatus || DEFAULT_STATE.syncStatus,
            settings: data.settings || DEFAULT_STATE.settings,
            totalUniqueProblems: Object.keys(data.syncedRegistry || {}).length
          }
        };
      }

      case 'GITHUB_VALIDATE_TOKEN': {
        const { token } = message.payload || {};
        if (!token) {
          return { success: false, error: 'Token is required' };
        }

        const validation = await validateGitHubToken(token);
        if (!validation.valid) {
          return { success: false, error: validation.error, status: validation.status };
        }

        const user = validation.user;
        const currentData = await chrome.storage.local.get(['auth']);
        const existingAuth = currentData.auth || {};

        const updatedAuth = {
          ...existingAuth,
          connected: true,
          token: token.trim(),
          username: user.login,
          name: user.name,
          avatarUrl: user.avatarUrl,
          owner: user.login,
          repo: existingAuth.repo && existingAuth.repo !== 'rag_leetsync' ? existingAuth.repo : 'Code_Raginii_Extension',
          branch: existingAuth.branch || 'main',
          scopes: validation.scopes,
          tokenConfigured: true,
          lastVerifiedAt: new Date().toISOString()
        };

        await chrome.storage.local.set({ auth: updatedAuth });
        console.log(`[Code_Raginii] Authenticated as GitHub user: @${user.login}`);

        return {
          success: true,
          user: {
            ...user,
            maskedToken: `${token.slice(0, 4)}••••••••${token.slice(-4)}`,
            repo: updatedAuth.repo,
            branch: updatedAuth.branch
          },
          scopes: validation.scopes
        };
      }

      case 'GITHUB_GET_REPOS': {
        const { auth } = await chrome.storage.local.get(['auth']);
        if (!auth?.token) {
          return { success: false, error: 'GitHub is not authenticated. Please provide a token first.' };
        }

        return await fetchUserRepositories(auth.token);
      }

      case 'GITHUB_SELECT_REPO': {
        const { repoName, branch } = message.payload || {};
        if (!repoName) {
          return { success: false, error: 'Repository name is required' };
        }

        const { auth } = await chrome.storage.local.get(['auth']);
        if (!auth?.token || !auth?.username) {
          return { success: false, error: 'GitHub is not connected' };
        }

        let owner = auth.username;
        let cleanRepoName = repoName.trim();
        if (cleanRepoName.includes('/')) {
          const parts = cleanRepoName.split('/');
          owner = parts[0].trim();
          cleanRepoName = parts[1].trim();
        }

        const targetBranch = branch ? branch.trim() : (auth.branch || 'main');

        const verification = await verifyRepository(auth.token, owner, cleanRepoName);
        if (!verification.exists) {
          return {
            success: false,
            error: `Repository '${owner}/${cleanRepoName}' not found on GitHub. Would you like to create it?`,
            notFound: true,
            owner,
            repoName: cleanRepoName
          };
        }

        const updatedAuth = {
          ...auth,
          owner,
          repo: cleanRepoName,
          branch: verification.defaultBranch || targetBranch
        };

        await chrome.storage.local.set({ auth: updatedAuth });
        console.log(`[Code_Raginii] Target repository configured: ${owner}/${cleanRepoName} (${updatedAuth.branch})`);

        return {
          success: true,
          repo: {
            owner,
            name: cleanRepoName,
            fullName: `${owner}/${cleanRepoName}`,
            branch: updatedAuth.branch,
            canPush: verification.canPush,
            htmlUrl: verification.htmlUrl
          }
        };
      }

      case 'GITHUB_CREATE_REPO': {
        const { repoName, isPrivate, description } = message.payload || {};
        const { auth } = await chrome.storage.local.get(['auth']);
        if (!auth?.token) {
          return { success: false, error: 'GitHub is not authenticated' };
        }

        const name = repoName ? repoName.trim() : 'Code_Raginii_Extension';
        const result = await createGitHubRepository(
          auth.token,
          name,
          Boolean(isPrivate),
          description || 'Automatically sync accepted LeetCode solutions using Code_Raginii'
        );

        if (!result.success) {
          return { success: false, error: result.error };
        }

        const updatedAuth = {
          ...auth,
          owner: auth.username,
          repo: result.repo.name,
          branch: result.repo.defaultBranch || 'main'
        };

        await chrome.storage.local.set({ auth: updatedAuth });
        console.log(`[Code_Raginii] Created and selected new repository: ${result.repo.fullName}`);

        return {
          success: true,
          repo: result.repo
        };
      }

      case 'GITHUB_TEST_SYNC': {
        const { auth } = await chrome.storage.local.get(['auth']);
        if (!auth?.token || !auth?.connected) {
          return { success: false, error: 'GitHub is not authenticated' };
        }

        const owner = auth.owner || auth.username;
        const repo = auth.repo || 'Code_Raginii_Extension';
        const branch = auth.branch || 'main';

        const result = await runTestCommit(auth.token, owner, repo, branch);
        if (result.success) {
          const { syncStatus } = await chrome.storage.local.get(['syncStatus']);
          await chrome.storage.local.set({
            syncStatus: {
              ...syncStatus,
              lastSyncedAt: new Date().toISOString(),
              latestMessage: 'GitHub connection and write permissions verified!',
              lastError: null
            }
          });
        }
        return result;
      }

      case 'GITHUB_DISCONNECT': {
        const { settings } = await chrome.storage.local.get(['settings']);
        await chrome.storage.local.set({
          auth: { ...DEFAULT_STATE.auth },
          syncStatus: { ...DEFAULT_STATE.syncStatus },
          settings: settings || DEFAULT_STATE.settings
        });

        console.log('[Code_Raginii] GitHub account disconnected.');
        return { success: true };
      }

      case 'LEETCODE_SUBMISSION_ACCEPTED': {
        const problem = message.payload?.problem;
        if (!problem || !problem.title || !problem.code) {
          return { success: false, error: 'Problem data missing.' };
        }

        const { settings } = await chrome.storage.local.get(['settings']);
        if (settings && settings.autoSync === false) {
          console.log('[Code_Raginii] Auto-sync disabled by user preferences.');
          return { success: false, autoSyncDisabled: true };
        }

        return await processProblemSync(problem);
      }

      case 'SYNC_CURRENT_TAB_PROBLEM': {
        try {
          const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
          if (!activeTab || !activeTab.id) {
            return { success: false, error: 'No active tab found. Please make sure LeetCode is open.' };
          }

          if (!activeTab.url || !activeTab.url.includes('leetcode.com/problems/')) {
            return { success: false, error: 'Active tab is not a LeetCode problem. Please switch to your LeetCode problem tab.' };
          }

          let response;
          try {
            response = await chrome.tabs.sendMessage(activeTab.id, { type: 'GET_CURRENT_PROBLEM_DATA' });
          } catch (e) {
            return {
              success: false,
              error: 'Please refresh the LeetCode tab (press F5) so Code_Raginii can connect to it, then click Sync again!'
            };
          }

          if (!response || !response.problem || !response.problem.code) {
            return {
              success: false,
              error: 'Could not extract code from editor. Please reload the problem tab and try again.'
            };
          }

          return await processProblemSync(response.problem, { forceSync: true });
        } catch (err) {
          return { success: false, error: err.message };
        }
      }

      case 'UPDATE_SETTINGS': {
        const newSettings = message.payload || {};
        const { settings } = await chrome.storage.local.get(['settings']);
        const updated = { ...settings, ...newSettings };
        await chrome.storage.local.set({ settings: updated });
        return { success: true, settings: updated };
      }

      default:
        return { success: false, error: `Unknown message type: ${message.type}` };
    }
  };

  handler()
    .then((response) => sendResponse(response))
    .catch((error) => sendResponse({ success: false, error: error.message }));

  return true;
});
