/**
 * RAG_LeetSync - Popup Interface Controller (Phase 3)
 * Handles tab navigation, GitHub authentication, repository management,
 * solution ingestion, RAG templating preview, recent syncs, and diagnostics.
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

  // DOM Elements - Dashboard Tab
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
  const btnDashSyncNow = document.getElementById('btn-dash-sync-now');
  const btnTestSync = document.getElementById('btn-test-sync');
  const btnViewRepo = document.getElementById('btn-view-repo');
  const recentSyncsList = document.getElementById('recent-syncs-list');

  // DOM Elements - Diagnostics
  const btnPingWorker = document.getElementById('btn-ping-worker');
  const btnCheckTab = document.getElementById('btn-check-tab');
  const btnClearConsole = document.getElementById('btn-clear-console');
  const consoleOutput = document.getElementById('console-output');

  // DOM Elements - Phase 3 Solution Sync Tab
  const syncProblemTitle = document.getElementById('sync-problem-title');
  const syncProblemId = document.getElementById('sync-problem-id');
  const syncDifficulty = document.getElementById('sync-difficulty');
  const syncLanguage = document.getElementById('sync-language');
  const syncTags = document.getElementById('sync-tags');
  const syncCode = document.getElementById('sync-code');
  const syncTimeComplexity = document.getElementById('sync-time-complexity');
  const syncSpaceComplexity = document.getElementById('sync-space-complexity');
  const syncNotes = document.getElementById('sync-notes');
  const btnLoadSample = document.getElementById('btn-load-sample');
  const btnDetectTab = document.getElementById('btn-detect-tab');
  const btnPreviewBundle = document.getElementById('btn-preview-bundle');
  const btnSubmitSync = document.getElementById('btn-submit-sync');
  const btnSubmitSyncText = document.getElementById('btn-submit-sync-text');
  const syncSpinner = document.getElementById('sync-spinner');
  const previewDrawer = document.getElementById('preview-drawer');
  const btnClosePreview = document.getElementById('btn-close-preview');
  const previewDirPath = document.getElementById('preview-dir-path');
  const previewReadmeContent = document.getElementById('preview-readme-content');

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
  // Utilities & Logging
  // =========================================================================
  function logConsole(text) {
    if (consoleOutput) {
      const timestamp = new Date().toLocaleTimeString();
      consoleOutput.textContent = `[${timestamp}] ${text}\n` + consoleOutput.textContent;
    }
  }

  function showToast(message, type = 'info', duration = 4000) {
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
    btnGotoAuth.addEventListener('click', () => switchTab('tab-github'));
  }

  if (btnDashSyncNow) {
    btnDashSyncNow.addEventListener('click', () => switchTab('tab-sync'));
  }

  // =========================================================================
  // 2. Load State & Hydration
  // =========================================================================
  async function loadState() {
    try {
      if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) {
        logConsole('Mock environment active.');
        return;
      }

      const response = await chrome.runtime.sendMessage({ type: 'GET_STATUS' });
      if (!response || !response.success || !response.data) {
        logConsole('Unable to retrieve runtime status.');
        return;
      }

      const { auth, syncStatus, settings, recentSyncs } = response.data;

      // Update sync counter and settings
      if (statSyncedCount) statSyncedCount.textContent = syncStatus?.totalSynced ?? 0;
      if (statAutosyncState) statAutosyncState.textContent = settings?.autoSync ? 'ON' : 'OFF';

      if (settings) {
        if (settingAutoSync) settingAutoSync.checked = Boolean(settings.autoSync);
        if (settingRagMetadata) settingRagMetadata.checked = Boolean(settings.ragMetadataEnabled);
        if (settingDirPattern) settingDirPattern.value = settings.directoryPattern || 'problems/{difficulty}/{titleSlug}';
        if (settingCommitPattern) settingCommitPattern.value = settings.commitMessagePattern || 'Solved {title} [{difficulty}] - RAG_LeetSync';
      }

      // Render Recent Ingestions
      renderRecentSyncs(recentSyncs || []);

      // Authentication State
      const isConnected = Boolean(auth && auth.connected && auth.username);
      updateAuthUI(isConnected, auth);

      if (isConnected) {
        logConsole(`Connected to @${auth.username} (${auth.owner || auth.username}/${auth.repo || 'rag_leetsync'})`);
        fetchUserReposList();
      }
    } catch (err) {
      console.error('State load error:', err);
      logConsole(`State error: ${err.message}`);
    }
  }

  function updateAuthUI(isConnected, auth = {}) {
    if (systemStatusText) systemStatusText.textContent = isConnected ? 'Connected' : 'Ready';
    if (navAuthIndicator) navAuthIndicator.classList.toggle('connected', isConnected);

    if (isConnected) {
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

      if (btnViewRepo) {
        btnViewRepo.href = `https://github.com/${repoOwner}/${repoName}`;
        btnViewRepo.style.pointerEvents = 'auto';
        btnViewRepo.style.opacity = '1';
      }

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

  function renderRecentSyncs(syncs = []) {
    if (!recentSyncsList) return;
    if (syncs.length === 0) {
      recentSyncsList.innerHTML = '<div class="empty-syncs-notice">No problems synced yet. Click "Sync Solution" above to ingest your first problem!</div>';
      return;
    }

    recentSyncsList.innerHTML = '';
    syncs.slice(0, 5).forEach((item) => {
      const row = document.createElement('div');
      row.className = 'recent-sync-item';

      const diff = (item.difficulty || 'Easy').toLowerCase();
      const diffClass = diff === 'hard' ? 'diff-hard' : diff === 'medium' ? 'diff-medium' : 'diff-easy';
      const shortSha = item.commitSha ? item.commitSha.slice(0, 7) : 'commit';

      row.innerHTML = `
        <div class="sync-item-left">
          <span class="sync-diff-badge ${diffClass}">${item.difficulty || 'Easy'}</span>
          <span class="sync-item-title" title="${item.title}">${item.id ? `${item.id}. ` : ''}${item.title}</span>
        </div>
        <div class="sync-item-right">
          <span class="sync-lang-tag">${item.language || ''}</span>
          ${item.commitUrl ? `<a href="${item.commitUrl}" target="_blank" class="sync-commit-link" title="Open commit on GitHub">${shortSha}</a>` : `<span class="sync-commit-link">${shortSha}</span>`}
        </div>
      `;
      recentSyncsList.appendChild(row);
    });
  }

  // =========================================================================
  // 3. Phase 3: Solution Ingestion & Manual Sync Flow
  // =========================================================================
  function collectProblemData() {
    return {
      title: syncProblemTitle ? syncProblemTitle.value.trim() : '',
      id: syncProblemId && syncProblemId.value ? parseInt(syncProblemId.value, 10) : null,
      difficulty: syncDifficulty ? syncDifficulty.value : 'Easy',
      language: syncLanguage ? syncLanguage.value : 'python3',
      tags: syncTags ? syncTags.value.trim() : '',
      code: syncCode ? syncCode.value : '',
      timeComplexity: syncTimeComplexity && syncTimeComplexity.value ? syncTimeComplexity.value.trim() : 'O(N)',
      spaceComplexity: syncSpaceComplexity && syncSpaceComplexity.value ? syncSpaceComplexity.value.trim() : 'O(1)',
      notes: syncNotes ? syncNotes.value.trim() : ''
    };
  }

  // Load Sample Code
  if (btnLoadSample) {
    btnLoadSample.addEventListener('click', () => {
      if (syncProblemTitle) syncProblemTitle.value = 'Two Sum';
      if (syncProblemId) syncProblemId.value = '1';
      if (syncDifficulty) syncDifficulty.value = 'Easy';
      if (syncLanguage) syncLanguage.value = 'python3';
      if (syncTags) syncTags.value = 'Array, Hash Table';
      if (syncTimeComplexity) syncTimeComplexity.value = 'O(N)';
      if (syncSpaceComplexity) syncSpaceComplexity.value = 'O(N)';
      if (syncNotes) syncNotes.value = 'Iterate through the array and use a hash map to look up the required complement (target - num) in O(1) time.';

      if (syncCode) {
        syncCode.value = `class Solution:
    def twoSum(self, nums: list[int], target: int) -> list[int]:
        seen = {}
        for i, num in enumerate(nums):
            complement = target - num
            if complement in seen:
                return [seen[complement], i]
            seen[num] = i
        return []`;
      }
      showToast('Loaded sample "Two Sum" solution!', 'info');
      logConsole('Loaded Two Sum sample solution into ingestion form.');
    });
  }

  // Detect from active LeetCode Tab
  if (btnDetectTab) {
    btnDetectTab.addEventListener('click', async () => {
      btnDetectTab.disabled = true;
      logConsole('Inspecting active tab for LeetCode problem...');
      try {
        const response = await chrome.runtime.sendMessage({ type: 'INSPECT_ACTIVE_LEETCODE_TAB' });
        if (response && response.success && response.isLeetCode && response.isProblemPage) {
          if (syncProblemTitle) syncProblemTitle.value = response.title;
          showToast(`Detected problem: ${response.title}`, 'success');
          logConsole(`Auto-detected LeetCode problem: "${response.title}" (${response.slug})`);
        } else if (response && response.isLeetCode) {
          showToast('Active tab is on LeetCode, but not a specific problem page.', 'info');
        } else {
          showToast('Current tab is not a LeetCode problem.', 'info');
        }
      } catch (err) {
        showToast(`Detection error: ${err.message}`, 'error');
      } finally {
        btnDetectTab.disabled = false;
      }
    });
  }

  // Preview RAG Bundle
  if (btnPreviewBundle) {
    btnPreviewBundle.addEventListener('click', async () => {
      const problem = collectProblemData();
      if (!problem.title) {
        showToast('Please provide a problem title to preview.', 'error');
        if (syncProblemTitle) syncProblemTitle.focus();
        return;
      }

      logConsole(`Generating RAG preview for "${problem.title}"...`);
      try {
        const response = await chrome.runtime.sendMessage({
          type: 'PREVIEW_PROBLEM_BUNDLE',
          payload: { problem }
        });

        if (response && response.success && response.bundle) {
          const bundle = response.bundle;
          if (previewDirPath) previewDirPath.textContent = `${bundle.dirPath}/`;
          const readmeFile = bundle.files.find(f => f.path.endsWith('README.md'));
          if (previewReadmeContent) {
            previewReadmeContent.textContent = readmeFile ? readmeFile.content : 'Preview generated.';
          }
          if (previewDrawer) previewDrawer.classList.remove('hidden');
          logConsole(`RAG bundle preview generated for path: ${bundle.dirPath}`);
        }
      } catch (err) {
        showToast(`Preview failed: ${err.message}`, 'error');
      }
    });
  }

  if (btnClosePreview && previewDrawer) {
    btnClosePreview.addEventListener('click', () => {
      previewDrawer.classList.add('hidden');
    });
  }

  // Push Solution to GitHub
  if (btnSubmitSync) {
    btnSubmitSync.addEventListener('click', async () => {
      const problem = collectProblemData();

      if (!problem.title) {
        showToast('Problem title is required.', 'error');
        if (syncProblemTitle) syncProblemTitle.focus();
        return;
      }
      if (!problem.code) {
        showToast('Solution code is required. Paste your solution before syncing.', 'error');
        if (syncCode) syncCode.focus();
        return;
      }

      // UI Loading state
      btnSubmitSync.disabled = true;
      if (syncSpinner) syncSpinner.classList.remove('hidden');
      if (btnSubmitSyncText) btnSubmitSyncText.textContent = 'Syncing to GitHub...';
      logConsole(`Initiating multi-file commit for "${problem.title}"...`);
      showToast(`Pushing "${problem.title}" to GitHub...`, 'info');

      try {
        const response = await chrome.runtime.sendMessage({
          type: 'SYNC_PROBLEM',
          payload: { problem }
        });

        if (response && response.success) {
          const sha = response.commitSha ? response.commitSha.slice(0, 7) : 'done';
          showToast(`"${problem.title}" successfully synced to GitHub (${sha})!`, 'success', 5000);
          logConsole(`Solution committed! SHA: ${sha}. Path: ${response.dirPath}. Commit URL: ${response.commitUrl}`);

          // Reload state and recent list
          await loadState();

          // Switch back to dashboard after brief pause to show updated recent syncs
          setTimeout(() => switchTab('tab-dashboard'), 1500);
        } else {
          const errMsg = response?.error || 'Failed to sync solution to GitHub.';
          showToast(errMsg, 'error', 6000);
          logConsole(`Sync error: ${errMsg}`);
        }
      } catch (err) {
        showToast(`Sync request failed: ${err.message}`, 'error');
        logConsole(`Sync failure: ${err.message}`);
      } finally {
        btnSubmitSync.disabled = false;
        if (syncSpinner) syncSpinner.classList.add('hidden');
        if (btnSubmitSyncText) btnSubmitSyncText.textContent = 'Sync to GitHub';
      }
    });
  }

  // =========================================================================
  // 4. GitHub Auth & Token Flow
  // =========================================================================
  if (btnToggleTokenVis && inputGithubToken) {
    btnToggleTokenVis.addEventListener('click', () => {
      const isPassword = inputGithubToken.type === 'password';
      inputGithubToken.type = isPassword ? 'text' : 'password';
    });
  }

  if (btnSaveToken && inputGithubToken) {
    btnSaveToken.addEventListener('click', async () => {
      const token = inputGithubToken.value.trim();
      if (!token) {
        showToast('Please enter your GitHub Personal Access Token.', 'error');
        inputGithubToken.focus();
        return;
      }

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
          showToast(`Connected to GitHub as @${response.user.login}!`, 'success');
          logConsole(`Token validated for @${response.user.login}.`);
          await loadState();
        } else {
          const errMsg = response?.error || 'Failed to authenticate token with GitHub.';
          showToast(errMsg, 'error');
          logConsole(`GitHub auth error: ${errMsg}`);
        }
      } catch (err) {
        showToast(`Connection error: ${err.message}`, 'error');
      } finally {
        btnSaveToken.disabled = false;
        if (tokenSpinner) tokenSpinner.classList.add('hidden');
        if (btnSaveTokenText) btnSaveTokenText.textContent = 'Verify & Connect GitHub';
      }
    });
  }

  async function fetchUserReposList() {
    if (!selectUserRepo) return;
    try {
      selectUserRepo.innerHTML = '<option value="">Loading repositories from GitHub...</option>';
      const response = await chrome.runtime.sendMessage({ type: 'GITHUB_GET_REPOS' });

      if (response && response.success && Array.isArray(response.repos)) {
        const repos = response.repos;
        if (authReposCount) authReposCount.textContent = `${repos.length} repos`;

        selectUserRepo.innerHTML = '<option value="">-- Choose an existing repository --</option>';
        repos.forEach((repo) => {
          const opt = document.createElement('option');
          opt.value = repo.fullName;
          opt.textContent = `${repo.fullName} ${repo.private ? '🔒' : ''}`;
          opt.dataset.defaultBranch = repo.defaultBranch;
          selectUserRepo.appendChild(opt);
        });
      } else {
        selectUserRepo.innerHTML = '<option value="">Unable to load repositories</option>';
      }
    } catch (err) {
      console.error('Error fetching repos:', err);
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
          await loadState();
        } else if (response && response.notFound) {
          showToast(`Repository '${repoName}' does not exist on GitHub yet. Click "Create New Repo" below to initialize it!`, 'error', 5000);
        } else {
          showToast(response?.error || 'Failed to configure repository.', 'error');
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

  if (btnCreateRepo) {
    btnCreateRepo.addEventListener('click', async () => {
      const repoName = inputCustomRepo ? inputCustomRepo.value.trim() || 'rag_leetsync' : 'rag_leetsync';
      const confirmed = confirm(`Create new GitHub repository "${repoName}" for your LeetCode solutions?`);
      if (!confirmed) return;

      btnCreateRepo.disabled = true;
      try {
        const response = await chrome.runtime.sendMessage({
          type: 'GITHUB_CREATE_REPO',
          payload: { repoName, isPrivate: false }
        });

        if (response && response.success) {
          showToast(`Repository "${response.repo.fullName}" created successfully!`, 'success');
          await loadState();
        } else {
          showToast(response?.error || 'Failed to create repository.', 'error');
        }
      } catch (err) {
        showToast(`Creation error: ${err.message}`, 'error');
      } finally {
        btnCreateRepo.disabled = false;
      }
    });
  }

  if (btnTestSync) {
    btnTestSync.addEventListener('click', async () => {
      btnTestSync.disabled = true;
      showToast('Pushing integration verification commit to GitHub...', 'info');

      try {
        const response = await chrome.runtime.sendMessage({ type: 'GITHUB_TEST_SYNC' });
        if (response && response.success) {
          const sha = response.commitSha ? response.commitSha.slice(0, 7) : 'verified';
          showToast(`Test commit created successfully (${sha})!`, 'success');
          logConsole(`Verified live push! Commit: ${sha}. File: RAG_SYNC_TEST.md`);
          await loadState();
        } else {
          showToast(response?.error || 'Failed to push test commit.', 'error');
        }
      } catch (err) {
        showToast(`Sync error: ${err.message}`, 'error');
      } finally {
        btnTestSync.disabled = false;
      }
    });
  }

  if (btnDisconnectGithub) {
    btnDisconnectGithub.addEventListener('click', async () => {
      const confirmed = confirm('Disconnect your GitHub account and clear stored token?');
      if (!confirmed) return;

      try {
        await chrome.runtime.sendMessage({ type: 'GITHUB_DISCONNECT' });
        showToast('GitHub account disconnected.', 'info');
        await loadState();
      } catch (err) {
        showToast(`Disconnect error: ${err.message}`, 'error');
      }
    });
  }

  // =========================================================================
  // 5. Settings Persistence
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
        const response = await chrome.runtime.sendMessage({ type: 'UPDATE_SETTINGS', payload });
        if (response && response.success) {
          showToast('Preferences saved successfully!', 'success');
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
  // 6. Diagnostics
  // =========================================================================
  if (btnPingWorker) {
    btnPingWorker.addEventListener('click', async () => {
      logConsole('Pinging background worker...');
      try {
        const response = await chrome.runtime.sendMessage({ type: 'PING' });
        if (response && response.status === 'PONG') {
          const time = response.timestamp.split('T')[1].replace('Z', '');
          logConsole(`PONG from worker v${response.version} at ${time}`);
          if (headerStatusDot) headerStatusDot.style.background = '#10b981';
        }
      } catch (err) {
        logConsole(`Worker ping failed: ${err.message}`);
      }
    });
  }

  if (btnCheckTab) {
    btnCheckTab.addEventListener('click', async () => {
      logConsole('Checking current tab...');
      try {
        const response = await chrome.runtime.sendMessage({ type: 'INSPECT_ACTIVE_LEETCODE_TAB' });
        if (response && response.isLeetCode) {
          logConsole(`LeetCode tab detected: ${response.url}`);
        } else {
          logConsole(`Active tab is not LeetCode (${response?.hostname || 'unknown'}).`);
        }
      } catch (err) {
        logConsole(`Tab check error: ${err.message}`);
      }
    });
  }

  if (btnClearConsole && consoleOutput) {
    btnClearConsole.addEventListener('click', () => {
      consoleOutput.textContent = 'Log cleared.';
    });
  }

  // Initial load
  await loadState();
});
