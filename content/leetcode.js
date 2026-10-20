/**
 * Code_Raginii - Content Script for LeetCode
 * Injected on https://leetcode.com/problems/* to observe submissions,
 * extract accepted code, and coordinate automatic synchronization to GitHub.
 */

(function () {
  'use strict';

  console.log('[Code_Raginii] Content script active on:', window.location.pathname);

  let lastProcessedSubmissionId = null;
  let isSyncing = false;
  let toastTimeout = null;

  // =========================================================================
  // 1. Inject Main-World Script for Monaco & Network Interception
  // =========================================================================
  function injectMainWorldScript() {
    try {
      const script = document.createElement('script');
      script.src = chrome.runtime.getURL('content/main-world.js');
      script.onload = function () {
        this.remove();
      };
      (document.head || document.documentElement).appendChild(script);
      console.log('[Code_Raginii] Injected main-world interceptor.');
    } catch (e) {
      console.warn('[Code_Raginii] Failed to inject main-world script:', e);
    }
  }

  injectMainWorldScript();

  // =========================================================================
  // 2. Problem Metadata Extraction from DOM
  // =========================================================================
  function getProblemSlug() {
    const match = window.location.pathname.match(/\/problems\/([^\/]+)/);
    return match ? match[1] : '';
  }

  function extractProblemMetadata() {
    const slug = getProblemSlug();
    let title = slug
      .split('-')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
    let id = null;

    // Try finding title element on page
    const titleSelectors = [
      '[data-cy="question-title"]',
      'div.text-title-large',
      'div[class*="text-title-large"]',
      'a[href*="/problems/"]'
    ];

    for (const sel of titleSelectors) {
      const el = document.querySelector(sel);
      if (el && el.textContent.trim()) {
        const text = el.textContent.trim();
        const numMatch = text.match(/^(\d+)\.\s*(.+)$/);
        if (numMatch) {
          id = parseInt(numMatch[1], 10);
          title = numMatch[2].trim();
        } else {
          title = text;
        }
        break;
      }
    }

    // Check document title fallback (e.g. "1. Two Sum - LeetCode")
    if (!id && document.title) {
      const docMatch = document.title.match(/^(\d+)\.\s*(.+?)(?:\s*-\s*LeetCode)?$/);
      if (docMatch) {
        id = parseInt(docMatch[1], 10);
        title = docMatch[2].trim();
      }
    }

    // Difficulty extraction
    let difficulty = 'Medium';
    const diffSelectors = [
      'div[class*="text-difficulty-"]',
      'div[class*="text-olive"]',
      'div[class*="text-yellow"]',
      'div[class*="text-pink"]',
      'span[class*="difficulty"]'
    ];

    for (const sel of diffSelectors) {
      const el = document.querySelector(sel);
      if (el) {
        const txt = el.textContent.trim();
        if (txt.match(/^(Easy|Medium|Hard)$/i)) {
          difficulty = txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase();
          break;
        }
      }
    }

    // Language extraction from dropdown or editor button
    let language = 'python3';
    const langBtn = document.querySelector('button[id*="headlessui-listbox-button"], button[class*="rounded"]');
    if (langBtn && langBtn.textContent) {
      const langText = langBtn.textContent.trim().toLowerCase();
      if (langText.includes('python')) language = 'python3';
      else if (langText.includes('c++') || langText.includes('cpp')) language = 'cpp';
      else if (langText.includes('java') && !langText.includes('script')) language = 'java';
      else if (langText.includes('typescript')) language = 'typescript';
      else if (langText.includes('javascript')) language = 'javascript';
      else if (langText.includes('go')) language = 'golang';
      else if (langText.includes('rust')) language = 'rust';
      else if (langText.includes('c#')) language = 'csharp';
      else if (langText.includes('sql')) language = 'sql';
      else if (langText === 'c') language = 'c';
    }

    return {
      id,
      title,
      titleSlug: slug,
      difficulty,
      language,
      url: window.location.href
    };
  }

  /**
   * Fallback code extraction directly from Monaco DOM if needed
   */
  function extractCodeFromDOM() {
    const viewLines = document.querySelector('.monaco-editor .view-lines');
    if (viewLines) {
      const lines = Array.from(viewLines.querySelectorAll('.view-line')).map((line) => line.textContent);
      if (lines.length > 0) {
        return lines.join('\n');
      }
    }
    return null;
  }

  // =========================================================================
  // 3. Floating In-Page Toast Widget
  // =========================================================================
  function getOrCreateToast() {
    let toast = document.getElementById('code-raginii-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'code-raginii-toast';
      toast.className = 'hidden';
      toast.innerHTML = `
        <div class="code-raginii-toast-header">
          <div class="code-raginii-toast-brand">
            <img src="${chrome.runtime.getURL('icons/icon32.png')}" alt="Logo" class="code-raginii-toast-logo">
            <span class="code-raginii-toast-title">Code_Raginii</span>
          </div>
          <button class="code-raginii-toast-close" id="code-raginii-toast-close">&times;</button>
        </div>
        <div class="code-raginii-toast-body">
          <div class="code-raginii-status-row">
            <span class="code-raginii-pulse-dot" id="code-raginii-dot"></span>
            <span class="code-raginii-toast-msg" id="code-raginii-msg">Solution Accepted! Syncing...</span>
          </div>
          <div class="code-raginii-toast-meta" id="code-raginii-meta">
            <span class="code-raginii-badge" id="code-raginii-diff">Easy</span>
            <span id="code-raginii-perf">LeetCode &rarr; GitHub</span>
          </div>
        </div>
        <div class="code-raginii-toast-footer" id="code-raginii-footer">
          <a href="#" target="_blank" class="code-raginii-btn hidden" id="code-raginii-commit-btn">View Commit &rarr;</a>
        </div>
      `;
      document.body.appendChild(toast);

      const closeBtn = document.getElementById('code-raginii-toast-close');
      if (closeBtn) {
        closeBtn.addEventListener('click', () => {
          toast.classList.add('hidden');
        });
      }
    }
    return toast;
  }

  function showToastNotification(options = {}) {
    const toast = getOrCreateToast();
    const dot = document.getElementById('code-raginii-dot');
    const msg = document.getElementById('code-raginii-msg');
    const diff = document.getElementById('code-raginii-diff');
    const perf = document.getElementById('code-raginii-perf');
    const commitBtn = document.getElementById('code-raginii-commit-btn');

    if (options.message && msg) msg.textContent = options.message;
    if (options.difficulty && diff) {
      diff.textContent = options.difficulty;
    }
    if (options.perf && perf) {
      perf.textContent = options.perf;
    }

    if (dot) {
      dot.className = 'code-raginii-pulse-dot';
      if (options.status === 'success') dot.classList.add('success');
      else if (options.status === 'error') dot.classList.add('error');
    }

    if (commitBtn) {
      if (options.commitUrl) {
        commitBtn.href = options.commitUrl;
        commitBtn.classList.remove('hidden');
      } else {
        commitBtn.classList.add('hidden');
      }
    }

    toast.classList.remove('hidden');

    if (toastTimeout) clearTimeout(toastTimeout);
    if (!options.persist) {
      toastTimeout = setTimeout(() => {
        toast.classList.add('hidden');
      }, options.duration || 6500);
    }
  }

  // =========================================================================
  // 4. Ingestion Handler
  // =========================================================================
  async function handleAcceptedSubmission(submissionData) {
    if (isSyncing) return;

    const submissionId = submissionData.submissionId || Date.now();
    if (lastProcessedSubmissionId === submissionId) {
      console.log('[Code_Raginii] Duplicate submission event ignored:', submissionId);
      return;
    }
    lastProcessedSubmissionId = submissionId;
    isSyncing = true;

    const meta = extractProblemMetadata();
    const code = submissionData.code || extractCodeFromDOM();

    if (!code) {
      console.warn('[Code_Raginii] Could not extract solution code.');
      isSyncing = false;
      return;
    }

    const problemPayload = {
      id: submissionData.questionId || meta.id,
      title: meta.title,
      titleSlug: meta.titleSlug,
      difficulty: meta.difficulty,
      language: submissionData.language || meta.language,
      code: code,
      runtime: submissionData.runtime || null,
      runtimePercentile: submissionData.runtimePercentile || null,
      memory: submissionData.memory || null,
      memoryPercentile: submissionData.memoryPercentile || null,
      url: meta.url,
      submissionId: submissionId
    };

    console.log('[Code_Raginii] Submitting accepted solution for:', problemPayload.title);

    showToastNotification({
      status: 'pending',
      message: `Accepted! Syncing ${meta.title} to GitHub...`,
      difficulty: meta.difficulty,
      perf: `${submissionData.runtime || 'Accepted'} | GitHub`,
      persist: true
    });

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'LEETCODE_SUBMISSION_ACCEPTED',
        payload: { problem: problemPayload }
      });

      if (response && response.success) {
        if (response.duplicate) {
          console.log(`[Code_Raginii] Duplicate solution detected for ${meta.title}. Skipped re-upload.`);
          showToastNotification({
            status: 'info',
            message: `"${meta.title}" is already up to date on GitHub!`,
            difficulty: meta.difficulty,
            commitUrl: response.commitUrl,
            duration: 6000
          });
        } else {
          const shortSha = response.commitSha ? response.commitSha.slice(0, 7) : 'done';
          console.log(`[Code_Raginii] Solution synced! Commit: ${shortSha}`);

          showToastNotification({
            status: 'success',
            message: `Uploaded to GitHub (${shortSha})!`,
            difficulty: meta.difficulty,
            perf: submissionData.runtime ? `Runtime: ${submissionData.runtime}` : 'Accepted',
            commitUrl: response.commitUrl,
            duration: 7000
          });
        }
      } else if (response && response.autoSyncDisabled) {
        showToastNotification({
          status: 'info',
          message: `${meta.title} accepted! (Auto-sync is disabled in settings)`,
          difficulty: meta.difficulty,
          duration: 5000
        });
      } else {
        const errorMsg = response?.error || 'Sync failed.';
        showToastNotification({
          status: 'error',
          message: `Sync failed: ${errorMsg}`,
          difficulty: meta.difficulty,
          duration: 6000
        });
      }
    } catch (err) {
      console.error('[Code_Raginii] Content script sync error:', err);
      showToastNotification({
        status: 'error',
        message: `Sync error: ${err.message}`,
        duration: 5000
      });
    } finally {
      isSyncing = false;
    }
  }

  // =========================================================================
  // 5. Event Listeners
  // =========================================================================
  window.addEventListener('CODE_RAGINII_SUBMISSION_EVENT', (event) => {
    const detail = event.detail;
    if (detail && detail.statusDisplay === 'Accepted') {
      console.log('[Code_Raginii] Accepted event received from network interceptor:', detail);
      handleAcceptedSubmission(detail);
    }
  });

  // DOM MutationObserver fallback for visual result panel
  let observerDebounce = null;
  const domObserver = new MutationObserver((mutations) => {
    if (isSyncing) return;

    for (const mutation of mutations) {
      if (mutation.addedNodes.length > 0) {
        if (observerDebounce) clearTimeout(observerDebounce);
        observerDebounce = setTimeout(() => {
          const resultElements = document.querySelectorAll(
            '[data-e2e-locator="submission-result"], div[class*="text-green"], span[class*="text-green"]'
          );

          for (const el of resultElements) {
            const text = el.textContent.trim();
            if (text.includes('Accepted') && !text.includes('Accepted Solutions')) {
              console.log('[Code_Raginii] Detected Accepted state in DOM.');
              handleAcceptedSubmission({
                statusDisplay: 'Accepted',
                source: 'DOM_OBSERVER'
              });
              break;
            }
          }
        }, 800);
      }
    }
  });

  domObserver.observe(document.body, {
    childList: true,
    subtree: true
  });
})();
