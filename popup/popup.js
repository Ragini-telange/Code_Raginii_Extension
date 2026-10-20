/**
 * Code_Raginii - Simple & Reliable Popup Controller
 * Manages GitHub authentication, repository selection, auto-sync setting,
 * and latest synchronization status display.
 */

document.addEventListener('DOMContentLoaded', async () => {
  // DOM Elements - Header
  const headerStatusPill = document.getElementById('header-status-pill');
  const headerStatusLabel = document.getElementById('header-status-label');
  const toastBanner = document.getElementById('toast-banner');
  const toastText = document.getElementById('toast-text');

  // DOM Elements - Auth Section
  const authDisconnectedView = document.getElementById('auth-disconnected-view');
  const authConnectedView = document.getElementById('auth-connected-view');
  const inputPat = document.getElementById('input-pat');
  const btnTogglePat = document.getElementById('btn-toggle-pat');
  const btnConnectGithub = document.getElementById('btn-connect-github');
  const btnConnectText = document.getElementById('btn-connect-text');
  const connectSpinner = document.getElementById('connect-spinner');

  const userAvatar = document.getElementById('user-avatar');
  const userDisplayName = document.getElementById('user-display-name');
  const userHandle = document.getElementById('user-handle');
  const currentRepoName = document.getElementById('current-repo-name');
  const currentBranchName = document.getElementById('current-branch-name');
  const btnDisconnect = document.getElementById('btn-disconnect');
  const btnToggleChangeRepo = document.getElementById('btn-toggle-change-repo');
  const changeRepoPanel = document.getElementById('change-repo-panel');
  const selectRepo = document.getElementById('select-repo');
  const inputCustomRepo = document.getElementById('input-custom-repo');
  const btnSaveRepo = document.getElementById('btn-save-repo');
  const btnCreateRepoPrompt = document.getElementById('btn-create-repo-prompt');

  // DOM Elements - Auto-Sync & Result
  const settingAutoSync = document.getElementById('setting-auto-sync');
  const syncCountBadge = document.getElementById('sync-count-badge');
  const resultStatusDot = document.getElementById('result-status-dot');
  const resultStatusMessage = document.getElementById('result-status-message');
  const resultTime = document.getElementById('result-time');
  const resultActions = document.getElementById('result-actions');
  const resultCommitLink = document.getElementById('result-commit-link');

  // DOM Elements - Settings
  const btnToggleSettings = document.getElementById('btn-toggle-settings');
  const settingsPanel = document.getElementById('settings-panel');
  const settingsArrow = document.getElementById('settings-arrow');
  const settingTargetBranch = document.getElementById('setting-target-branch');
  const settingPreventDuplicates = document.getElementById('setting-prevent-duplicates');
  const btnTestConnection = document.getElementById('btn-test-connection');
  const btnSaveSettings = document.getElementById('btn-save-settings');

  let toastTimer = null;

  // =========================================================================
  // Toast Helper
  // =========================================================================
  function showToast(message, type = 'info', duration = 4000) {
    if (toastTimer) clearTimeout(toastTimer);
    toastText.textContent = message;
    toastBanner.className = 'toast-banner';
    if (type === 'success') toastBanner.classList.add('success');
    if (type === 'error') toastBanner.classList.add('error');
    toastBanner.classList.remove('hidden');

    toastTimer = setTimeout(() => {
      toastBanner.classList.add('hidden');
    }, duration);
  }

  // =========================================================================
  // Render Application State
  // =========================================================================
  function renderState(data) {
    if (!data) return;

    const { auth, syncStatus, settings, totalUniqueProblems } = data;

    // 1. Connection Header & Auth View
    if (auth && auth.connected) {
      headerStatusPill.className = 'connection-pill connected';
      headerStatusLabel.textContent = 'Connected';

      authDisconnectedView.classList.add('hidden');
      authConnectedView.classList.remove('hidden');

      userDisplayName.textContent = auth.name || auth.username || 'GitHub User';
      userHandle.textContent = `@${auth.username || 'user'}`;
      if (auth.avatarUrl) {
        userAvatar.src = auth.avatarUrl;
        userAvatar.style.display = 'block';
      } else {
        userAvatar.style.display = 'none';
      }

      currentRepoName.textContent = auth.repo || 'Code_Raginii_Extension';
      currentBranchName.textContent = auth.branch || 'main';
    } else {
      headerStatusPill.className = 'connection-pill';
      headerStatusLabel.textContent = 'Disconnected';

      authConnectedView.classList.add('hidden');
      authDisconnectedView.classList.remove('hidden');
    }

    // 2. Auto-Sync Setting
    if (settings) {
      settingAutoSync.checked = settings.autoSync !== false;
      if (settingTargetBranch) settingTargetBranch.value = settings.targetBranch || 'main';
      if (settingPreventDuplicates) settingPreventDuplicates.checked = settings.preventDuplicates !== false;
    }

    // 3. Unique Solved Count
    const count = totalUniqueProblems || 0;
    syncCountBadge.textContent = `${count} solved`;

    // 4. Latest Synchronization Result
    if (syncStatus) {
      resultStatusDot.className = 'result-dot';
      if (syncStatus.state === 'success') {
        resultStatusDot.classList.add('success');
      } else if (syncStatus.state === 'error') {
        resultStatusDot.classList.add('error');
      } else if (syncStatus.state === 'syncing') {
        resultStatusDot.classList.add('syncing');
      }

      resultStatusMessage.textContent = syncStatus.latestMessage || 'Waiting for an accepted submission';

      if (syncStatus.lastSyncedAt) {
        const timeAgo = formatTimeAgo(new Date(syncStatus.lastSyncedAt));
        resultTime.textContent = `Last sync: ${timeAgo}`;
        resultTime.classList.remove('hidden');
      } else {
        resultTime.classList.add('hidden');
      }

      if (syncStatus.latestProblem?.commitUrl) {
        resultCommitLink.href = syncStatus.latestProblem.commitUrl;
        resultActions.classList.remove('hidden');
      } else {
        resultActions.classList.add('hidden');
      }
    }
  }

  function formatTimeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  }

  // =========================================================================
  // Load State from Background Service Worker
  // =========================================================================
  async function loadExtensionStatus() {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_STATUS' });
      if (response && response.success) {
        renderState(response.data);
      }
    } catch (err) {
      console.error('[Code_Raginii] Failed to get status:', err);
    }
  }

  // Initial load
  await loadExtensionStatus();

  // =========================================================================
  // Authentication Actions
  // =========================================================================
  if (btnTogglePat) {
    btnTogglePat.addEventListener('click', () => {
      inputPat.type = inputPat.type === 'password' ? 'text' : 'password';
    });
  }

  if (btnConnectGithub) {
    btnConnectGithub.addEventListener('click', async () => {
      const token = inputPat.value.trim();
      if (!token) {
        showToast('Please enter your GitHub Personal Access Token.', 'error');
        return;
      }

      btnConnectGithub.disabled = true;
      btnConnectText.textContent = 'Connecting...';
      connectSpinner.classList.remove('hidden');

      try {
        const res = await chrome.runtime.sendMessage({
          type: 'GITHUB_VALIDATE_TOKEN',
          payload: { token }
        });

        if (res && res.success) {
          showToast(`Connected as @${res.user.login}!`, 'success');
          inputPat.value = '';
          await loadExtensionStatus();
        } else {
          showToast(res?.error || 'Authentication failed. Please verify your token.', 'error');
        }
      } catch (err) {
        showToast(`Connection error: ${err.message}`, 'error');
      } finally {
        btnConnectGithub.disabled = false;
        btnConnectText.textContent = 'Connect GitHub';
        connectSpinner.classList.add('hidden');
      }
    });
  }

  if (btnDisconnect) {
    btnDisconnect.addEventListener('click', async () => {
      const confirmed = confirm('Disconnect your GitHub account? Auto-sync will be paused.');
      if (!confirmed) return;

      try {
        const res = await chrome.runtime.sendMessage({ type: 'GITHUB_DISCONNECT' });
        if (res && res.success) {
          showToast('Disconnected from GitHub.', 'info');
          await loadExtensionStatus();
        }
      } catch (err) {
        showToast(`Disconnect failed: ${err.message}`, 'error');
      }
    });
  }

  // =========================================================================
  // Repository Selection Actions
  // =========================================================================
  if (btnToggleChangeRepo) {
    btnToggleChangeRepo.addEventListener('click', async () => {
      const isHidden = changeRepoPanel.classList.contains('hidden');
      if (isHidden) {
        changeRepoPanel.classList.remove('hidden');
        btnToggleChangeRepo.textContent = 'Close';

        // Fetch user repositories
        try {
          selectRepo.innerHTML = '<option value="">Loading repositories...</option>';
          const res = await chrome.runtime.sendMessage({ type: 'GITHUB_GET_REPOS' });
          if (res && res.success && res.repos.length > 0) {
            selectRepo.innerHTML = '<option value="">-- Choose an existing repository --</option>';
            res.repos.forEach((r) => {
              const opt = document.createElement('option');
              opt.value = r.name;
              opt.textContent = `${r.name} ${r.private ? '🔒' : ''}`;
              selectRepo.appendChild(opt);
            });
          } else {
            selectRepo.innerHTML = '<option value="">No repositories found</option>';
          }
        } catch (e) {
          selectRepo.innerHTML = '<option value="">Failed to load repositories</option>';
        }
      } else {
        changeRepoPanel.classList.add('hidden');
        btnToggleChangeRepo.textContent = 'Change Repository';
      }
    });
  }

  if (selectRepo) {
    selectRepo.addEventListener('change', () => {
      if (selectRepo.value) {
        inputCustomRepo.value = selectRepo.value;
      }
    });
  }

  if (btnSaveRepo) {
    btnSaveRepo.addEventListener('click', async () => {
      const repoName = inputCustomRepo.value.trim() || selectRepo.value.trim();
      if (!repoName) {
        showToast('Please select or type a repository name.', 'error');
        return;
      }

      try {
        const res = await chrome.runtime.sendMessage({
          type: 'GITHUB_SELECT_REPO',
          payload: { repoName }
        });

        if (res && res.success) {
          showToast(`Selected repository: ${res.repo.name}`, 'success');
          changeRepoPanel.classList.add('hidden');
          btnToggleChangeRepo.textContent = 'Change Repository';
          await loadExtensionStatus();
        } else if (res && res.notFound) {
          const create = confirm(`Repository '${repoName}' does not exist on your GitHub. Create it now?`);
          if (create) {
            await createRepo(repoName);
          }
        } else {
          showToast(res?.error || 'Failed to select repository.', 'error');
        }
      } catch (err) {
        showToast(`Error: ${err.message}`, 'error');
      }
    });
  }

  async function createRepo(name) {
    try {
      const res = await chrome.runtime.sendMessage({
        type: 'GITHUB_CREATE_REPO',
        payload: { repoName: name, isPrivate: false }
      });
      if (res && res.success) {
        showToast(`Created & selected repository: ${res.repo.name}!`, 'success');
        changeRepoPanel.classList.add('hidden');
        btnToggleChangeRepo.textContent = 'Change Repository';
        await loadExtensionStatus();
      } else {
        showToast(res?.error || 'Failed to create repository.', 'error');
      }
    } catch (e) {
      showToast(`Creation error: ${e.message}`, 'error');
    }
  }

  if (btnCreateRepoPrompt) {
    btnCreateRepoPrompt.addEventListener('click', async () => {
      const name = inputCustomRepo.value.trim() || 'Code_Raginii_Extension';
      await createRepo(name);
    });
  }

  // =========================================================================
  // Auto-Sync Toggle
  // =========================================================================
  if (settingAutoSync) {
    settingAutoSync.addEventListener('change', async () => {
      const isEnabled = settingAutoSync.checked;
      try {
        await chrome.runtime.sendMessage({
          type: 'UPDATE_SETTINGS',
          payload: { autoSync: isEnabled }
        });
        showToast(isEnabled ? 'Auto-sync enabled' : 'Auto-sync disabled', 'info');
      } catch (e) {
        showToast('Failed to update auto-sync setting.', 'error');
      }
    });
  }

  // =========================================================================
  // Settings Section
  // =========================================================================
  if (btnToggleSettings) {
    btnToggleSettings.addEventListener('click', () => {
      const isHidden = settingsPanel.classList.contains('hidden');
      if (isHidden) {
        settingsPanel.classList.remove('hidden');
        settingsArrow.classList.add('open');
      } else {
        settingsPanel.classList.add('hidden');
        settingsArrow.classList.remove('open');
      }
    });
  }

  if (btnSaveSettings) {
    btnSaveSettings.addEventListener('click', async () => {
      const branch = settingTargetBranch.value.trim() || 'main';
      const preventDuplicates = settingPreventDuplicates.checked;

      try {
        await chrome.runtime.sendMessage({
          type: 'UPDATE_SETTINGS',
          payload: {
            targetBranch: branch,
            preventDuplicates: preventDuplicates
          }
        });
        showToast('Settings saved successfully!', 'success');
        await loadExtensionStatus();
      } catch (e) {
        showToast('Failed to save settings.', 'error');
      }
    });
  }

  if (btnTestConnection) {
    btnTestConnection.addEventListener('click', async () => {
      btnTestConnection.disabled = true;
      btnTestConnection.textContent = 'Testing...';
      try {
        const res = await chrome.runtime.sendMessage({ type: 'GITHUB_TEST_SYNC' });
        if (res && res.success) {
          showToast('Write permission verified! Test file committed.', 'success');
          await loadExtensionStatus();
        } else {
          showToast(res?.error || 'Write test failed.', 'error');
        }
      } catch (e) {
        showToast(`Test error: ${e.message}`, 'error');
      } finally {
        btnTestConnection.disabled = false;
        btnTestConnection.textContent = 'Test Write Permission';
      }
    });
  }
});
