/**
 * RAG_LeetSync - Popup Interface Controller (Phase 2)
 * Handles tab navigation, GitHub authentication, repository management,
 * test sync commits, settings persistence, and diagnostics.
 */

document.addEventListener('DOMContentLoaded', async () => {
  // DOM Elements - Navigation & Header
  const navTabs = document.querySelectorAll('.nav-tab');
  const tabPanes = document.querySelectorAll('.tab-pane');
  const systemStatusText = document.getElementById('system-status-text');
  const systemStatusDot = document.getElementById('system-status-dot');
  const navAuthIndicator = document.getElementById('nav-auth-indicator');
  const headerStatusDot = document.getElementById('header-status-dot');

  // DOM Elements - Toast Banner
  const toastBanner = document.getElementById('toast-banner');
  const toastMessage = document.getElementById('toast-message');
  const toastIcon = document.getElementById('toast-icon');
  const toastClose = document.getElementById('toast-close');

  // DOM Elements - Dashboard
  const githubAuthStatus = document.getElementById('github-auth-status');
  const authCallout = document.getElementById('auth-callout');
  const btnGotoAuth = document.getElementById('btn-goto-auth');
  const repoConnectedView = document.getElementById('repo-connected-view');
  const dashUserAvatar = document.getElementById('dash-user-avatar');
  const dashUserName = document.getElementById('dash-user-name');
  const dashUserHandle = document.getElementById('dash-user-handle');
  const targetRepoName = document.getElementById('target-repo-name');
  const targetBranchName = document.getElementById('target-branch-name');
  const statSyncedCount = document.getElementById('stat-synced-count');
  const statAutosyncState = document.getElementById('stat-autosync-state');
  const statRepoState = document.getElementById('stat-repo-state');
  const btnTestSync = document.getElementById('btn-test-sync');
  const btnViewRepo = document.getElementById('btn-view-repo');

  // DOM Elements - Diagnostics
  const btnPingWorker = document.getElementById('btn-ping-worker');
  const btnCheckTab = document.getElementById('btn-check-tab');
  const btnClearConsole = document.getElementById('btn-clear-console');
  const consoleOutput = document.getElementById('console-output');

  // DOM Elements - GitHub Auth Tab
  const githubProfileCard = document.getElementById('github-profile-card');
  const authUserAvatar = document.getElementById('auth-user-avatar');
  const authUserFullname = document.getElementById('auth-user-fullname');
  const authUserLogin = document.getElementById('auth-user-login');
  const authScopeBadge = document.getElementById('auth-scope-badge');
  const authReposCount = document.getElementById('auth-repos-count');
  const btnDisconnectGithub = document.getElementById('btn-disconnect-github');

  const inputGithubToken = document.getElementById('input-github-token');
  const btnToggleTokenVis = document.getElementById('btn-toggle-token-vis');
  const btnSaveToken = document.getElementById('btn-save-token');
  const btnSaveTokenText = document.getElementById('btn-save-token-text');
  const tokenSpinner = document.getElementById('token-spinner');
  const tokenStatusHint = document.getElementById('token-status-hint');

  const selectUserRepo = document.getElementById('select-user-repo');
  const btnRefreshRepos = document.getElementById('btn-refresh-repos');
  const inputCustomRepo = document.getElementById('input-custom-repo');
  const inputTargetBranch = document.getElementById('input-target-branch');
  const btnSaveRepo = document.getElementById('btn-save-repo');
  const btnSaveRepoText = document.getElementById('btn-save-repo-text');
  const repoSpinner = document.getElementById('repo-spinner');
  const btnCreateRepo = document.getElementById('btn-create-repo');

  // DOM Elements - Settings Tab
  const settingAutoSync = document.getElementById('setting-auto-sync');
  const settingRagMetadata = document.getElementById('setting-rag-metadata');
  const settingDirPattern = document.getElementById('setting-dir-pattern');
  const settingCommitPattern = document.getElementById('setting-commit-pattern');
  const btnSaveSettings = document.getElementById('btn-save-settings');

  let toastTimeout = null;

  // =========================================================================
  // Utilities
  // =========================================================================
  function logConsole(text) {
    if (consoleOutput) {
      const timestamp = new Date().toLocaleTimeString();
      consoleOutput.textContent = `[${timestamp}] ${text}\n` + consoleOutput.textContent;
    }
  }

  function showToast(message, type = 'info', duration = 3800) {
    if (!toastBanner) return;
    if (toastTimeout) clearTimeout(toastTimeout);

    toastMessage.textContent = message;
    toastBanner.className = 'toast-banner';

    if (type === 'success') {
      toastBanner.classList.add('toast-success');
      toastIcon.textContent = '✓';
    } else if (type === 'error') {
      toastBanner.classList.add('toast-error');
      toastIcon.textContent = '⚠️';
    } else {
      toastIcon.textContent = 'ℹ️';
    }

    toastBanner.classList.remove('hidden');

    toastTimeout = setTimeout(() => {
      toastBanner.classList.add('hidden');
    }, duration);
  }

  if (toastClose) {
    toastClose.addEventListener('click', () => {
      if (toastBanner) toastBanner.classList.add('hidden');
    });
  }

  // =========================================================================
  // 1. Tab Navigation
  // =========================================================================
  function switchTab(tabId) {
    navTabs.forEach((tab) => {
      const isActive = tab.getAttribute('data-tab') === tabId;
      tab.classList.toggle('active', isActive);
      tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });

    tabPanes.forEach((pane) => {
      const isTarget = pane.id === tabId;
      pane.classList.toggle('active', isTarget);
      pane.classList.toggle('hidden', !isTarget);
    });
  }

  navTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const tabId = tab.getAttribute('data-tab');
      switchTab(tabId);
    });
  });

  if (btnGotoAuth) {
    btnGotoAuth.addEventListener('click', () => {
      switchTab('tab-github');
    });
  }

  // =========================================================================
  // 2. Token Visibility Toggle
  // =========================================================================
  if (btnToggleTokenVis && inputGithubToken) {
    btnToggleTokenVis.addEventListener('click', () => {
      const isPassword = inputGithubToken.type === 'password';
      inputGithubToken.type = isPassword ? 'text' : 'password';
      btnToggleTokenVis.innerHTML = isPassword
        ? `<svg class="eye-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`
        : `<svg class="eye-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
    });
  }

  // =========================================================================
  // 3. Load State from Extension Storage
  // =========================================================================
  async function loadState() {
    try {
      if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) {
        logConsole('Running outside extension runtime (Mock mode).');
        return;
      }

      const response = await chrome.runtime.sendMessage({ type: 'GET_STATUS' });
      if (!response || !response.success || !response.data) {
        logConsole('Unable to retrieve runtime status.');
        return;
      }

      const { auth, syncStatus, settings } = response.data;

      // Update Sync Stats
      if (statSyncedCount) statSyncedCount.textContent = syncStatus?.totalSynced ?? 0;
      if (statAutosyncState) statAutosyncState.textContent = settings?.autoSync ? 'ON' : 'OFF';

      // Update Settings Tab inputs
      if (settings) {
        if (settingAutoSync) settingAutoSync.checked = Boolean(settings.autoSync);
        if (settingRagMetadata) settingRagMetadata.checked = Boolean(settings.ragMetadataEnabled);
        if (settingDirPattern) settingDirPattern.value = settings.directoryPattern || 'problems/{difficulty}/{titleSlug}';
        if (settingCommitPattern) settingCommitPattern.value = settings.commitMessagePattern || 'Solved {title} [{difficulty}] - RAG_LeetSync';
      }

      // Handle Authentication State
      const isConnected = Boolean(auth && auth.connected && auth.username);
      updateAuthUI(isConnected, auth);

      if (isConnected) {
        logConsole(`Connected to GitHub: @${auth.username} (${auth.owner || auth.username}/${auth.repo || 'rag_leetsync'})`);
        fetchUserReposList();
      } else {
        logConsole('Extension ready. GitHub not connected.');
      }
    } catch (err) {
      console.error('State load error:', err);
      logConsole(`State initialization error: ${err.message}`);
    }
  }

  function updateAuthUI(isConnected, auth = {}) {
    // Header & Navigation Indicators
    if (systemStatusText) systemStatusText.textContent = isConnected ? 'Connected' : 'Ready';
    if (navAuthIndicator) {
      navAuthIndicator.classList.toggle('connected', isConnected);
    }

    if (isConnected) {
      // Dashboard Pill & Views
      if (githubAuthStatus) {
        githubAuthStatus.textContent = 'Connected';
        githubAuthStatus.className = 'status-pill status-pill-connected';
      }
      if (authCallout) authCallout.classList.add('hidden');
      if (repoConnectedView) repoConnectedView.classList.remove('hidden');

      if (dashUserAvatar) dashUserAvatar.src = auth.avatarUrl || '../icons/icon32.png';
      if (dashUserName) dashUserName.textContent = auth.name || auth.username;
      if (dashUserHandle) dashUserHandle.textContent = `@${auth.username}`;

      const repoOwner = auth.owner || auth.username;
      const repoName = auth.repo || 'rag_leetsync';
      const branch = auth.branch || 'main';

      if (targetRepoName) targetRepoName.textContent = `${repoOwner}/${repoName}`;
      if (targetBranchName) targetBranchName.textContent = branch;
      if (statRepoState) statRepoState.textContent = repoName;

      // Update view repo button
      if (btnViewRepo) {
        btnViewRepo.href = `https://github.com/${repoOwner}/${repoName}`;
        btnViewRepo.style.pointerEvents = 'auto';
        btnViewRepo.style.opacity = '1';
      }

      // GitHub Tab Profile Card
      if (githubProfileCard) githubProfileCard.classList.remove('hidden');
      if (authUserAvatar) authUserAvatar.src = auth.avatarUrl || '../icons/icon32.png';
      if (authUserFullname) authUserFullname.textContent = auth.name || auth.username;
      if (authUserLogin) authUserLogin.textContent = `@${auth.username}`;

      if (authScopeBadge) {
        const scopes = auth.scopes || [];
        authScopeBadge.textContent = scopes.includes('repo') ? 'repo scope ✓' : (scopes.length ? scopes.join(', ') : 'repo access');
      }

      if (inputCustomRepo) inputCustomRepo.value = repoName;
      if (inputTargetBranch) inputTargetBranch.value = branch;

      // Token input placeholder
      if (inputGithubToken) {
        inputGithubToken.value = '';
        inputGithubToken.placeholder = auth.maskedToken || '••••••••••••••••';
      }
      if (tokenStatusHint) {
        tokenStatusHint.textContent = `Active token configured (${auth.maskedToken || 'stored'}).`;
        tokenStatusHint.style.color = '#10b981';
      }
      if (btnSaveTokenText) btnSaveTokenText.textContent = 'Update GitHub Token';
    } else {
      // Disconnected State
      if (githubAuthStatus) {
        githubAuthStatus.textContent = 'Not Connected';
        githubAuthStatus.className = 'status-pill status-pill-pending';
      }
      if (authCallout) authCallout.classList.remove('hidden');
      if (repoConnectedView) repoConnectedView.classList.add('hidden');
      if (githubProfileCard) githubProfileCard.classList.add('hidden');

      if (targetRepoName) targetRepoName.textContent = 'rag_leetsync';
      if (targetBranchName) targetBranchName.textContent = 'main';
      if (statRepoState) statRepoState.textContent = 'Setup';

      if (btnViewRepo) {
        btnViewRepo.href = '#';
        btnViewRepo.style.pointerEvents = 'none';
        btnViewRepo.style.opacity = '0.5';
      }

      if (inputGithubToken) {
        inputGithubToken.value = '';
        inputGithubToken.placeholder = 'ghp_xxxxxxxxxxxxxxxxxxxx';
      }
      if (tokenStatusHint) {
        tokenStatusHint.textContent = 'Never shared or transmitted to external servers.';
        tokenStatusHint.style.color = '';
      }
      if (btnSaveTokenText) btnSaveTokenText.textContent = 'Verify & Connect GitHub';
    }
  }

  // =========================================================================
  // 4. GitHub Token Verification & Connection
  // =========================================================================
  if (btnSaveToken && inputGithubToken) {
    btnSaveToken.addEventListener('click', async () => {
      const token = inputGithubToken.value.trim();
      if (!token) {
        showToast('Please enter your GitHub Personal Access Token.', 'error');
        inputGithubToken.focus();
        return;
      }

      // UI Loading state
      btnSaveToken.disabled = true;
      if (tokenSpinner) tokenSpinner.classList.remove('hidden');
      if (btnSaveTokenText) btnSaveTokenText.textContent = 'Verifying credentials...';
      logConsole('Connecting to GitHub API with token...');

      try {
        const response = await chrome.runtime.sendMessage({
          type: 'GITHUB_VALIDATE_TOKEN',
          payload: { token }
        });

        if (response && response.success) {
          showToast(`Successfully connected to GitHub as @${response.user.login}!`, 'success');
          logConsole(`Token validated for @${response.user.login}. Scopes: [${response.scopes.join(', ')}]`);
          await loadState();
        } else {
          const errMsg = response?.error || 'Failed to authenticate token with GitHub.';
          showToast(errMsg, 'error');
          logConsole(`GitHub auth error: ${errMsg}`);
        }
      } catch (err) {
        showToast(`Connection error: ${err.message}`, 'error');
        logConsole(`Network or runtime error: ${err.message}`);
      } finally {
        btnSaveToken.disabled = false;
        if (tokenSpinner) tokenSpinner.classList.add('hidden');
        if (btnSaveTokenText) btnSaveTokenText.textContent = 'Verify & Connect GitHub';
      }
    });
  }

  // =========================================================================
  // 5. Fetch & Populate User Repositories
  // =========================================================================
  async function fetchUserReposList() {
    if (!selectUserRepo) return;

    try {
      selectUserRepo.innerHTML = '<option value="">Loading repositories from GitHub...</option>';
      const response = await chrome.runtime.sendMessage({ type: 'GITHUB_GET_REPOS' });

      if (response && response.success && Array.isArray(response.repos)) {
        const repos = response.repos;
        if (authReposCount) authReposCount.textContent = `${repos.length} repos`;

        selectUserRepo.innerHTML = '<option value="">-- Choose an existing repository --</option>';

        // Check if rag_leetsync already exists
        let foundLeetSyncRepo = false;

        repos.forEach((repo) => {
          const opt = document.createElement('option');
          opt.value = repo.fullName;
          opt.textContent = `${repo.fullName} ${repo.private ? '🔒' : ''}`;
          opt.dataset.defaultBranch = repo.defaultBranch;
          if (repo.name.toLowerCase() === 'rag_leetsync') {
            foundLeetSyncRepo = true;
          }
          selectUserRepo.appendChild(opt);
        });

        if (foundLeetSyncRepo) {
          logConsole('Found existing "rag_leetsync" repository.');
        } else {
          logConsole('Loaded user repositories list.');
        }
      } else {
        selectUserRepo.innerHTML = '<option value="">Unable to load repositories</option>';
      }
    } catch (err) {
      console.error('Error fetching repos:', err);
      selectUserRepo.innerHTML = '<option value="">Error loading repositories</option>';
    }
  }

  if (btnRefreshRepos) {
    btnRefreshRepos.addEventListener('click', async () => {
      btnRefreshRepos.disabled = true;
      logConsole('Refreshing repository list from GitHub...');
      await fetchUserReposList();
      btnRefreshRepos.disabled = false;
      showToast('Repository list refreshed.', 'info');
    });
  }

  if (selectUserRepo) {
    selectUserRepo.addEventListener('change', () => {
      const selected = selectUserRepo.value;
      if (selected) {
        const parts = selected.split('/');
        const repoName = parts[1] || selected;
        if (inputCustomRepo) inputCustomRepo.value = repoName;

        const selectedOpt = selectUserRepo.options[selectUserRepo.selectedIndex];
        if (selectedOpt && selectedOpt.dataset.defaultBranch && inputTargetBranch) {
          inputTargetBranch.value = selectedOpt.dataset.defaultBranch;
        }
      }
    });
  }

  // =========================================================================
  // 6. Set / Save Target Repository
  // =========================================================================
  if (btnSaveRepo) {
    btnSaveRepo.addEventListener('click', async () => {
      const repoName = inputCustomRepo ? inputCustomRepo.value.trim() : '';
      const branch = inputTargetBranch ? inputTargetBranch.value.trim() : 'main';

      if (!repoName) {
        showToast('Please specify a repository name.', 'error');
        return;
      }

      btnSaveRepo.disabled = true;
      if (repoSpinner) repoSpinner.classList.remove('hidden');
      if (btnSaveRepoText) btnSaveRepoText.textContent = 'Verifying...';

      try {
        const response = await chrome.runtime.sendMessage({
          type: 'GITHUB_SELECT_REPO',
          payload: { repoName, branch }
        });

        if (response && response.success) {
          showToast(`Repository set: ${response.repo.fullName} (${response.repo.branch})`, 'success');
          logConsole(`Repository configured: ${response.repo.fullName} [${response.repo.branch}]`);
          await loadState();
        } else if (response && response.notFound) {
          showToast(`Repository '${repoName}' does not exist on GitHub yet. Click "Create New Repo" below to initialize it!`, 'error', 5000);
          logConsole(`Repository '${repoName}' not found.`);
        } else {
          const errMsg = response?.error || 'Failed to configure repository.';
          showToast(errMsg, 'error');
          logConsole(`Repo selection error: ${errMsg}`);
        }
      } catch (err) {
        showToast(`Error: ${err.message}`, 'error');
      } finally {
        btnSaveRepo.disabled = false;
        if (repoSpinner) repoSpinner.classList.add('hidden');
        if (btnSaveRepoText) btnSaveRepoText.textContent = 'Set Repository';
      }
    });
  }

  // =========================================================================
  // 7. Create New Repository on GitHub
  // =========================================================================
  if (btnCreateRepo) {
    btnCreateRepo.addEventListener('click', async () => {
      const repoName = inputCustomRepo ? inputCustomRepo.value.trim() || 'rag_leetsync' : 'rag_leetsync';
      const confirmed = confirm(`Create new GitHub repository "${repoName}" for your LeetCode solutions?`);
      if (!confirmed) return;

      btnCreateRepo.disabled = true;
      logConsole(`Creating GitHub repository "${repoName}"...`);

      try {
        const response = await chrome.runtime.sendMessage({
          type: 'GITHUB_CREATE_REPO',
          payload: { repoName, isPrivate: false }
        });

        if (response && response.success) {
          showToast(`Repository "${response.repo.fullName}" created successfully!`, 'success');
          logConsole(`Created remote repository: ${response.repo.fullName}`);
          await loadState();
        } else {
          const errMsg = response?.error || 'Failed to create repository on GitHub.';
          showToast(errMsg, 'error');
          logConsole(`Repo creation error: ${errMsg}`);
        }
      } catch (err) {
        showToast(`Creation error: ${err.message}`, 'error');
      } finally {
        btnCreateRepo.disabled = false;
      }
    });
  }

  // =========================================================================
  // 8. Test GitHub Commit Action
  // =========================================================================
  if (btnTestSync) {
    btnTestSync.addEventListener('click', async () => {
      btnTestSync.disabled = true;
      logConsole('Executing test commit via GitHub Contents API...');
      showToast('Pushing integration verification commit to GitHub...', 'info');

      try {
        const response = await chrome.runtime.sendMessage({ type: 'GITHUB_TEST_SYNC' });

        if (response && response.success) {
          const sha = response.commitSha ? response.commitSha.slice(0, 7) : 'verified';
          showToast(`Test commit created successfully (${sha})!`, 'success');
          logConsole(`Live commit verified! SHA: ${sha}. File: RAG_SYNC_TEST.md`);
          await loadState();
        } else {
          const errMsg = response?.error || 'Failed to push test commit to GitHub.';
          showToast(errMsg, 'error');
          logConsole(`Test commit error: ${errMsg}`);
        }
      } catch (err) {
        showToast(`Sync error: ${err.message}`, 'error');
        logConsole(`Test sync failed: ${err.message}`);
      } finally {
        btnTestSync.disabled = false;
      }
    });
  }

  // =========================================================================
  // 9. Disconnect GitHub
  // =========================================================================
  if (btnDisconnectGithub) {
    btnDisconnectGithub.addEventListener('click', async () => {
      const confirmed = confirm('Are you sure you want to disconnect your GitHub account and clear your stored token?');
      if (!confirmed) return;

      try {
        await chrome.runtime.sendMessage({ type: 'GITHUB_DISCONNECT' });
        showToast('GitHub account disconnected.', 'info');
        logConsole('Account disconnected and credentials removed.');
        await loadState();
      } catch (err) {
        showToast(`Disconnect error: ${err.message}`, 'error');
      }
    });
  }

  // =========================================================================
  // 10. Save Preferences (Settings Tab)
  // =========================================================================
  if (btnSaveSettings) {
    btnSaveSettings.addEventListener('click', async () => {
      const payload = {
        autoSync: Boolean(settingAutoSync?.checked),
        ragMetadataEnabled: Boolean(settingRagMetadata?.checked),
        directoryPattern: settingDirPattern ? settingDirPattern.value.trim() : 'problems/{difficulty}/{titleSlug}',
        commitMessagePattern: settingCommitPattern ? settingCommitPattern.value.trim() : 'Solved {title} [{difficulty}] - RAG_LeetSync'
      };

      try {
        const response = await chrome.runtime.sendMessage({
          type: 'UPDATE_SETTINGS',
          payload
        });

        if (response && response.success) {
          showToast('Preferences saved successfully!', 'success');
          logConsole('Sync preferences updated.');
          await loadState();
        } else {
          showToast('Failed to save settings.', 'error');
        }
      } catch (err) {
        showToast(`Save error: ${err.message}`, 'error');
      }
    });
  }

  // =========================================================================
  // 11. Diagnostics Actions
  // =========================================================================
  if (btnPingWorker) {
    btnPingWorker.addEventListener('click', async () => {
      logConsole('Pinging background service worker...');
      try {
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
          const response = await chrome.runtime.sendMessage({ type: 'PING' });
          if (response && response.status === 'PONG') {
            const timeStr = response.timestamp.split('T')[1].replace('Z', '');
            logConsole(`PONG from worker v${response.version} at ${timeStr}`);
            if (headerStatusDot) headerStatusDot.style.background = '#10b981';
          } else {
            logConsole('Worker responded with unexpected payload.');
          }
        }
      } catch (err) {
        logConsole(`Worker connection failed: ${err.message}`);
      }
    });
  }

  if (btnCheckTab) {
    btnCheckTab.addEventListener('click', async () => {
      logConsole('Inspecting active browser tab...');
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
        }
      } catch (err) {
        logConsole(`Tab inspection error: ${err.message}`);
      }
    });
  }

  if (btnClearConsole && consoleOutput) {
    btnClearConsole.addEventListener('click', () => {
      consoleOutput.textContent = 'Log cleared.';
    });
  }

  // Initial Load
  await loadState();
});
