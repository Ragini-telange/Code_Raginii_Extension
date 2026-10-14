/**
 * RAG_LeetSync - Background Service Worker (Manifest V3)
 * Handles extension lifecycle, storage initialization, and message dispatching.
 */

// Initialize default state on extension installation or update
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log(`[RAG_LeetSync] Extension installed/updated. Reason: ${details.reason}`);

  const defaultState = {
    auth: {
      connected: false,
      username: null,
      repo: null,
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
      ragMetadataEnabled: true
    },
    recentSyncs: []
  };

  try {
    const existing = await chrome.storage.local.get(['auth', 'syncStatus', 'settings', 'recentSyncs']);
    const updates = {};

    for (const [key, value] of Object.entries(defaultState)) {
      if (existing[key] === undefined) {
        updates[key] = value;
      }
    }

    if (Object.keys(updates).length > 0) {
      await chrome.storage.local.set(updates);
      console.log('[RAG_LeetSync] Default storage state initialized:', updates);
    }
  } catch (error) {
    console.error('[RAG_LeetSync] Failed to initialize storage:', error);
  }
});

// Listener for runtime messages from popup and future content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'PING') {
    sendResponse({
      status: 'PONG',
      version: chrome.runtime.getManifest().version,
      timestamp: new Date().toISOString()
    });
    return true;
  }

  if (message.type === 'GET_STATUS') {
    chrome.storage.local.get(['auth', 'syncStatus', 'settings'])
      .then((data) => {
        sendResponse({ success: true, data });
      })
      .catch((error) => {
        sendResponse({ success: false, error: error.message });
      });
    return true; // Indicates asynchronous response
  }

  return false;
});
