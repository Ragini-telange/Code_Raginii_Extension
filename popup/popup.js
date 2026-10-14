/**
 * RAG_LeetSync - Popup Interface Script (Phase 1)
 * Handles popup state, metrics display, and diagnostic communication.
 */

document.addEventListener('DOMContentLoaded', async () => {
  const consoleOutput = document.getElementById('console-output');
  const btnPingWorker = document.getElementById('btn-ping-worker');
  const btnCheckTab = document.getElementById('btn-check-tab');
  const statSyncedCount = document.getElementById('stat-synced-count');
  const statAutosyncState = document.getElementById('stat-autosync-state');
  const githubAuthStatus = document.getElementById('github-auth-status');
  const systemStatusText = document.getElementById('system-status-text');

  function logConsole(text) {
    if (consoleOutput) {
      const timestamp = new Date().toLocaleTimeString();
      consoleOutput.textContent = `[${timestamp}] ${text}`;
    }
  }

  // 1. Initialize State from chrome.storage
  async function loadState() {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        const data = await chrome.storage.local.get(['auth', 'syncStatus', 'settings']);
        
        if (data.syncStatus && statSyncedCount) {
          statSyncedCount.textContent = data.syncStatus.totalSynced ?? 0;
        }

        if (data.settings && statAutosyncState) {
          statAutosyncState.textContent = data.settings.autoSync ? 'ON' : 'OFF';
        }

        if (data.auth && data.auth.connected && githubAuthStatus) {
          githubAuthStatus.textContent = 'Connected';
          githubAuthStatus.className = 'status-pill status-pill-connected';
        }

        logConsole('Extension storage loaded successfully. Ready.');
      } else {
        logConsole('Loaded in standalone test mode (mock storage).');
      }
    } catch (err) {
      console.error('Storage access error:', err);
      logConsole(`Storage initialization error: ${err.message}`);
    }
  }

  // 2. Diagnostics: Ping Service Worker
  if (btnPingWorker) {
    btnPingWorker.addEventListener('click', async () => {
      logConsole('Pinging background service worker...');
      try {
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
          const response = await chrome.runtime.sendMessage({ type: 'PING' });
          if (response && response.status === 'PONG') {
            logConsole(`PONG from worker! Version: ${response.version} (at ${response.timestamp.split('T')[1].replace('Z','')})`);
            if (systemStatusText) systemStatusText.textContent = 'Online';
          } else {
            logConsole('Worker responded with unexpected payload.');
          }
        } else {
          logConsole('Chrome runtime API not present (non-extension env).');
        }
      } catch (err) {
        logConsole(`Worker connection failed: ${err.message}`);
      }
    });
  }

  // 3. Diagnostics: Check Active LeetCode Tab
  if (btnCheckTab) {
    btnCheckTab.addEventListener('click', async () => {
      logConsole('Checking current active browser tab...');
      try {
        if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.query) {
          const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
          if (activeTab && activeTab.url) {
            const url = new URL(activeTab.url);
            if (url.hostname.includes('leetcode.com')) {
              logConsole(`Active tab is LeetCode: ${url.pathname}`);
            } else {
              logConsole(`Active tab: ${url.hostname} (not LeetCode)`);
            }
          } else {
            logConsole('Unable to determine active tab URL.');
          }
        } else {
          logConsole('chrome.tabs API unavailable.');
        }
      } catch (err) {
        logConsole(`Tab check error: ${err.message}`);
      }
    });
  }

  // Execute initial load
  await loadState();
});
