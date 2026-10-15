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
  slugify
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
    targetBranch: 'main'
  },
  recentSyncs: []
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
 * Shared synchronization orchestrator for both manual and automated LeetCode ingestion
 */
async function processProblemSync(problem) {
  const { auth, settings, syncStatus, recentSyncs } = await chrome.storage.local.get([
    'auth',
    'settings',
    'syncStatus',
    'recentSyncs'
  ]);

  if (!auth?.token || !auth?.connected) {
    return {
      success: false,
      error: 'GitHub is not authenticated. Please open RAG_LeetSync and configure your Personal Access Token.'
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

  // Execute atomic commit
  const commitResult = await commitMultipleFilesToGitHub(
    auth.token,
    owner,
    repo,
    bundle.files,
    bundle.commitMessage,
    branch
  );

  if (!commitResult.success) {
    console.error('[RAG_LeetSync] Commit execution failed:', commitResult.error);
    return { success: false, error: commitResult.error };
  }

  // Update recent sync history & metrics
  const newRecord = {
    id: problem.id || null,
    title: problem.title,
    difficulty: problem.difficulty || 'Easy',
    language: problem.language || 'python3',
    dirPath: bundle.dirPath,
    commitSha: commitResult.commitSha,
    commitUrl: commitResult.commitUrl,
    syncedAt: new Date().toISOString()
  };

  const updatedRecentSyncs = [newRecord, ...(recentSyncs || [])].slice(0, 30);
  const updatedStatus = {
    ...syncStatus,
    state: 'ready',
    lastSyncedAt: new Date().toISOString(),
    lastError: null,
    totalSynced: (syncStatus?.totalSynced || 0) + 1
  };

  await chrome.storage.local.set({
    recentSyncs: updatedRecentSyncs,
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
