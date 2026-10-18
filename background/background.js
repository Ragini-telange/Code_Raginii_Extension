/**
 * RAG_LeetSync - Background Service Worker (Manifest V3)
 * Handles extension lifecycle, storage management, GitHub API interactions,
 * and messaging between popup, background, and content scripts.
 */

import {
  validateGitHubToken,
  fetchUserRepositories,
  verifyRepository,
  createGitHubRepository,
  runTestCommit,
  commitFileToGitHub,
  commitMultipleFilesToGitHub
} from './github-api.js';

import {
  buildProblemSyncBundle,
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
    repo: 'rag_leetsync',
    owner: null,
    branch: 'main',
    scopes: [],
    tokenConfigured: false
  },
  syncStatus: {
    state: 'ready', // 'ready' | 'syncing' | 'error'
    lastSyncedAt: null,
    lastError: null,
    totalSynced: 0
  },
  settings: {
    autoSync: true,
    directoryPattern: 'problems/{difficulty}/{titleSlug}',
    commitMessagePattern: 'Solved {title} [{difficulty}] - RAG_LeetSync',
    ragMetadataEnabled: true,
    targetBranch: 'main',
    preventDuplicates: true
  },
  recentSyncs: [],
  syncedRegistry: {}, // maps slug -> { codeHash, lastSyncedAt, commitSha, language, dirPath }
  syncQueue: []       // offline retry queue: [{ id, problem, enqueuedAt, attempts, lastError }]
};

// Initialize default state on extension installation or update
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log(`[RAG_LeetSync] Extension installed/updated. Reason: ${details.reason}`);

  try {
    const existing = await chrome.storage.local.get(['auth', 'syncStatus', 'settings', 'recentSyncs']);
    const updates = {};

    for (const [key, value] of Object.entries(DEFAULT_STATE)) {
      if (existing[key] === undefined) {
        updates[key] = value;
      } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        // Deep merge top-level object fields to ensure new properties exist
        updates[key] = { ...value, ...existing[key] };
      }
    }

    if (Object.keys(updates).length > 0) {
      await chrome.storage.local.set(updates);
      console.log('[RAG_LeetSync] Storage state verified & initialized:', updates);
    }
  } catch (error) {
    console.error('[RAG_LeetSync] Failed to initialize storage:', error);
  }
});

/**
 * Shared synchronization orchestrator for both manual and automated LeetCode ingestion.
 * Includes duplicate prevention and offline queue resilience.
 */
async function processProblemSync(problem, options = {}) {
  const { auth, settings, syncStatus, recentSyncs, syncedRegistry, syncQueue } = await chrome.storage.local.get([
    'auth',
    'settings',
    'syncStatus',
    'recentSyncs',
    'syncedRegistry',
    'syncQueue'
  ]);

  if (!auth?.token || !auth?.connected) {
    return {
      success: false,
      error: 'GitHub is not authenticated. Please open RAG_LeetSync and configure your Personal Access Token.'
    };
  }

  const slug = problem.titleSlug || slugify(problem.title || 'untitled');
  const codeHash = computeCodeHash(problem.code);

  // 1. Duplicate Prevention Check
  const registry = syncedRegistry || {};
  const existingSync = registry[slug];

  if (settings?.preventDuplicates !== false && !options.forceSync && existingSync && existingSync.codeHash === codeHash) {
    console.log(`[RAG_LeetSync] Duplicate detected for '${problem.title}'. Code unchanged since commit ${existingSync.commitSha}. Skipping re-upload.`);
    return {
      success: true,
      duplicate: true,
      message: 'Solution code is identical to existing version on GitHub. Skipped re-upload.',
      commitSha: existingSync.commitSha,
      commitUrl: existingSync.commitUrl,
      dirPath: existingSync.dirPath,
      record: existingSync
    };
  }

  const owner = auth.owner || auth.username;
  const repo = auth.repo || 'rag_leetsync';
  const branch = auth.branch || 'main';

  const dirPattern = settings?.directoryPattern || 'problems/{difficulty}/{titleSlug}';
  const commitMsgPattern = settings?.commitMessagePattern || 'Solved {title} [{difficulty}] - RAG_LeetSync';

  // Build the complete 3-part file bundle (solution, README, metadata.json)
  const bundle = buildProblemSyncBundle(problem, dirPattern, commitMsgPattern);

  console.log(`[RAG_LeetSync] Ingesting problem: "${problem.title}" to ${owner}/${repo} (${bundle.dirPath})`);

  // Execute commit via GitHub API
  const commitResult = await commitMultipleFilesToGitHub(
    auth.token,
    owner,
    repo,
    bundle.files,
    bundle.commitMessage,
    branch
  );

  // 2. Resilience & Offline Retry Queue Handling
  if (!commitResult.success) {
    console.warn('[RAG_LeetSync] Commit failed, adding to retry queue:', commitResult.error);
    const queue = syncQueue || [];
    const queueItem = {
      id: `queue_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      problem,
      enqueuedAt: new Date().toISOString(),
      attempts: 1,
      lastError: commitResult.error
    };

    const updatedQueue = [...queue.filter(q => q.problem.title !== problem.title), queueItem].slice(-25);
    await chrome.storage.local.set({ syncQueue: updatedQueue });

    return {
      success: false,
      enqueued: true,
      error: commitResult.error,
      message: 'Network or API error. Queued for automatic retry.'
    };
  }

  // 3. Update Registry, Recent History & Metrics on Success
  const newRecord = {
    id: problem.id || null,
    title: problem.title,
    titleSlug: slug,
    difficulty: problem.difficulty || 'Easy',
    language: problem.language || 'python3',
    dirPath: bundle.dirPath,
    commitSha: commitResult.commitSha,
    commitUrl: commitResult.commitUrl,
    codeHash: codeHash,
    syncedAt: new Date().toISOString()
  };

  const updatedRegistry = {
    ...registry,
    [slug]: {
      ...newRecord,
      lastSyncedAt: new Date().toISOString()
    }
  };

  // Remove from retry queue if it was queued
  const updatedQueue = (syncQueue || []).filter(item => (item.problem.titleSlug || slugify(item.problem.title)) !== slug);

  const updatedRecentSyncs = [newRecord, ...(recentSyncs || []).filter(r => (r.titleSlug || slugify(r.title)) !== slug)].slice(0, 50);
  const updatedStatus = {
    ...syncStatus,
    state: 'ready',
    lastSyncedAt: new Date().toISOString(),
    lastError: null,
    totalSynced: (syncStatus?.totalSynced || 0) + 1
  };

  await chrome.storage.local.set({
    recentSyncs: updatedRecentSyncs,
    syncedRegistry: updatedRegistry,
    syncQueue: updatedQueue,
    syncStatus: updatedStatus
  });

  // Native notification
  try {
    if (chrome.notifications && chrome.notifications.create) {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: chrome.runtime.getURL('icons/icon128.png'),
        title: 'RAG_LeetSync - Solution Ingested',
        message: `Successfully synced "${problem.title}" [${problem.difficulty || 'Easy'}] to ${owner}/${repo}`,
        priority: 1
      });
    }
  } catch (e) {}

  return {
    success: true,
    commitSha: commitResult.commitSha,
    commitUrl: commitResult.commitUrl,
    dirPath: bundle.dirPath,
    filesCount: bundle.files.length,
    record: newRecord
  };
}

/**
 * Drains and retries all pending items in the offline retry queue
 */
async function processSyncQueue() {
  const { syncQueue, auth } = await chrome.storage.local.get(['syncQueue', 'auth']);
  if (!syncQueue || syncQueue.length === 0) {
    return { success: true, processed: 0, remaining: 0, message: 'Retry queue is empty.' };
  }

  if (!auth?.token || !auth?.connected) {
    return { success: false, error: 'GitHub is not authenticated.', remaining: syncQueue.length };
  }

  console.log(`[RAG_LeetSync] Draining sync queue (${syncQueue.length} items)...`);
  const queueToProcess = [...syncQueue];
  const results = [];
  const remainingQueue = [];

  for (const item of queueToProcess) {
    try {
      const res = await processProblemSync(item.problem, { forceSync: true });
      if (res.success) {
        results.push({ id: item.id, title: item.problem.title, status: 'synced', commitSha: res.commitSha });
      } else {
        item.attempts = (item.attempts || 1) + 1;
        item.lastError = res.error;
        remainingQueue.push(item);
        results.push({ id: item.id, title: item.problem.title, status: 'failed', error: res.error });
      }
    } catch (err) {
      item.attempts = (item.attempts || 1) + 1;
      item.lastError = err.message;
      remainingQueue.push(item);
      results.push({ id: item.id, title: item.problem.title, status: 'failed', error: err.message });
    }
  }

  await chrome.storage.local.set({ syncQueue: remainingQueue });

  return {
    success: true,
    processed: results.filter(r => r.status === 'synced').length,
    failed: remainingQueue.length,
    remaining: remainingQueue.length,
    results
  };
}

// Main message router
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const handler = async () => {
    switch (message.type) {
      case 'PING': {
        return {
          status: 'PONG',
          version: chrome.runtime.getManifest().version,
          timestamp: new Date().toISOString()
        };
      }

      case 'GET_STATUS': {
        const data = await chrome.storage.local.get(['auth', 'syncStatus', 'settings', 'recentSyncs']);
        // Mask token when returning to callers for security
        const safeAuth = data.auth ? { ...data.auth } : { ...DEFAULT_STATE.auth };
        if (safeAuth.token) {
          const t = safeAuth.token;
          safeAuth.maskedToken = t.length > 8 ? `${t.slice(0, 4)}••••••••${t.slice(-4)}` : '••••••••';
          safeAuth.token = undefined; // Do not expose raw token in general status calls
        }
        return { success: true, data: { ...data, auth: safeAuth } };
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
          repo: existingAuth.repo || 'rag_leetsync',
          branch: existingAuth.branch || 'main',
          scopes: validation.scopes,
          tokenConfigured: true,
          lastVerifiedAt: new Date().toISOString()
        };

        await chrome.storage.local.set({ auth: updatedAuth });
        console.log(`[RAG_LeetSync] Authenticated as GitHub user: @${user.login}`);

        // Safe user info to return (no raw token)
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

        const result = await fetchUserRepositories(auth.token);
        return result;
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

        // Support owner/repo or just repo
        let owner = auth.username;
        let cleanRepoName = repoName.trim();
        if (cleanRepoName.includes('/')) {
          const parts = cleanRepoName.split('/');
          owner = parts[0].trim();
          cleanRepoName = parts[1].trim();
        }

        const targetBranch = branch ? branch.trim() : (auth.branch || 'main');

        // Verify repository accessibility
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
        console.log(`[RAG_LeetSync] Target repository configured: ${owner}/${cleanRepoName} (${updatedAuth.branch})`);

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

        const name = repoName ? repoName.trim() : 'rag_leetsync';
        const result = await createGitHubRepository(
          auth.token,
          name,
          Boolean(isPrivate),
          description || 'Synced LeetCode solutions with RAG metadata for interview review'
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
        console.log(`[RAG_LeetSync] Created and selected new repository: ${result.repo.fullName}`);

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
        const repo = auth.repo || 'rag_leetsync';
        const branch = auth.branch || 'main';

        const result = await runTestCommit(auth.token, owner, repo, branch);
        if (result.success) {
          // Increment synced count or update status
          const { syncStatus } = await chrome.storage.local.get(['syncStatus']);
          await chrome.storage.local.set({
            syncStatus: {
              ...syncStatus,
              lastSyncedAt: new Date().toISOString(),
              lastError: null
            }
          });
        }
        return result;
      }

      case 'GITHUB_DISCONNECT': {
        const { settings, recentSyncs } = await chrome.storage.local.get(['settings', 'recentSyncs']);
        await chrome.storage.local.set({
          auth: { ...DEFAULT_STATE.auth },
          syncStatus: { ...DEFAULT_STATE.syncStatus },
          settings: settings || DEFAULT_STATE.settings,
          recentSyncs: recentSyncs || []
        });

        console.log('[RAG_LeetSync] GitHub account disconnected and credentials cleared.');
        return { success: true };
      }

      case 'SYNC_PROBLEM': {
        const problem = message.payload?.problem;
        if (!problem || !problem.title || !problem.code) {
          return { success: false, error: 'Problem title and solution code are required.' };
        }
        return await processProblemSync(problem);
      }

      case 'LEETCODE_SUBMISSION_ACCEPTED': {
        const problem = message.payload?.problem;
        if (!problem || !problem.title || !problem.code) {
          return { success: false, error: 'Problem data missing.' };
        }

        const { settings } = await chrome.storage.local.get(['settings']);
        if (settings && settings.autoSync === false) {
          console.log('[RAG_LeetSync] Auto-sync disabled by user preferences.');
          return { success: false, autoSyncDisabled: true };
        }

        return await processProblemSync(problem);
      }

      case 'PREVIEW_PROBLEM_BUNDLE': {
        const problem = message.payload?.problem;
        if (!problem) {
          return { success: false, error: 'Problem data required for preview.' };
        }

        const { settings } = await chrome.storage.local.get(['settings']);
        const dirPattern = settings?.directoryPattern || 'problems/{difficulty}/{titleSlug}';
        const commitMsgPattern = settings?.commitMessagePattern || 'Solved {title} [{difficulty}] - RAG_LeetSync';

        const bundle = buildProblemSyncBundle(problem, dirPattern, commitMsgPattern);
        return { success: true, bundle };
      }

      case 'INSPECT_ACTIVE_LEETCODE_TAB': {
        try {
          const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
          if (!activeTab || !activeTab.url) {
            return { success: false, error: 'No active tab found.' };
          }

          const url = new URL(activeTab.url);
          if (!url.hostname.includes('leetcode.com')) {
            return {
              success: true,
              isLeetCode: false,
              hostname: url.hostname
            };
          }

          // Check if it's a problem page: /problems/{slug}/
          const match = url.pathname.match(/\/problems\/([^\/]+)/);
          if (match && match[1]) {
            const slug = match[1];
            // Format title from slug
            const title = slug
              .split('-')
              .map(word => word.charAt(0).toUpperCase() + word.slice(1))
              .join(' ');

            return {
              success: true,
              isLeetCode: true,
              isProblemPage: true,
              slug,
              title,
              url: activeTab.url,
              tabId: activeTab.id
            };
          }

          return {
            success: true,
            isLeetCode: true,
            isProblemPage: false,
            url: activeTab.url
          };
        } catch (err) {
          return { success: false, error: err.message };
        }
      }

      case 'GET_RECENT_SYNCS': {
        const { recentSyncs } = await chrome.storage.local.get(['recentSyncs']);
        return { success: true, recentSyncs: recentSyncs || [] };
      }

      case 'UPDATE_SETTINGS': {
        const newSettings = message.payload || {};
        const { settings } = await chrome.storage.local.get(['settings']);
        const updated = { ...settings, ...newSettings };
        await chrome.storage.local.set({ settings: updated });
        return { success: true, settings: updated };
      }

      case 'PROCESS_SYNC_QUEUE': {
        const result = await processSyncQueue();
        return result;
      }

      case 'GET_QUEUE_STATUS': {
        const { syncQueue } = await chrome.storage.local.get(['syncQueue']);
        const queue = syncQueue || [];
        return {
          success: true,
          count: queue.length,
          items: queue
        };
      }

      case 'CLEAR_SYNC_QUEUE': {
        await chrome.storage.local.set({ syncQueue: [] });
        return { success: true };
      }

      case 'CLEAR_HISTORY': {
        const { syncStatus } = await chrome.storage.local.get(['syncStatus']);
        await chrome.storage.local.set({
          recentSyncs: [],
          syncedRegistry: {},
          syncStatus: {
            ...(syncStatus || {}),
            totalSynced: 0
          }
        });
        return { success: true };
      }

      case 'EXPORT_HISTORY': {
        const { auth, recentSyncs, syncedRegistry, settings } = await chrome.storage.local.get([
          'auth',
          'recentSyncs',
          'syncedRegistry',
          'settings'
        ]);

        const exportData = {
          version: '1.4.0',
          exportedAt: new Date().toISOString(),
          user: {
            username: auth?.username,
            repository: `${auth?.owner || auth?.username}/${auth?.repo || 'rag_leetsync'}`,
            branch: auth?.branch || 'main'
          },
          settings: settings || {},
          totalSynced: recentSyncs ? recentSyncs.length : 0,
          problems: recentSyncs || [],
          registry: syncedRegistry || {}
        };

        return { success: true, exportData };
      }

      default:
        return { success: false, error: `Unknown message type: ${message.type}` };
    }
  };

  // Execute async handler and respond
  handler()
    .then((response) => sendResponse(response))
    .catch((error) => sendResponse({ success: false, error: error.message }));

  return true; // Keep message channel open for async response
});
