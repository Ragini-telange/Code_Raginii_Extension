/**
 * Code_Raginii - Content Script for LeetCode
 * Runs on https://leetcode.com/problems/* to observe submissions,
 * extract accepted code, and coordinate automatic synchronization to GitHub.
 */

(function () {
  'use strict';

  console.log('[Code_Raginii] Content script loaded on:', window.location.pathname);

  let lastProcessedSubmissionId = null;
  let isSyncing = false;
  let toastTimeout = null;

  // =========================================================================
  // 1. Problem Metadata Extraction from DOM & URL
  // =========================================================================
  function getProblemSlug() {
    const rawPath = decodeURIComponent(window.location.pathname);
    const match = rawPath.match(/\/problems\/([^\/]+)/);
    if (!match) return '';
    return match[1]
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^\w\-]+/g, '');
  }

  function extractProblemMetadata() {
    const slug = getProblemSlug();
    let title = slug
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
    let id = null;

    // Try finding title element on page
    const titleSelectors = [
      '[data-cy="question-title"]',
      'div.text-title-large',
      'div[class*="text-title-large"]',
      'a[href*="/problems/"]',
      'div[class*="title"]'
    ];

    for (const sel of titleSelectors) {
      const el = document.querySelector(sel);
      if (el && el.textContent.trim()) {
        const text = el.textContent.trim();
        const numMatch = text.match(/^(\d+)\.\s*(.+)$/);
        if (numMatch) {
          id = parseInt(numMatch[1], 10);
          title = numMatch[2].trim();
        } else if (!text.includes('LeetCode') && text.length > 2 && text.length < 80) {
          title = text;
        }
        break;
      }
    }

    // Check document title fallback (e.g. "13. Roman to Integer - LeetCode")
    if (!id && document.title) {
      const docMatch = document.title.match(/^(\d+)\.\s*(.+?)(?:\s*-\s*LeetCode)?$/);
      if (docMatch) {
        id = parseInt(docMatch[1], 10);
        title = docMatch[2].trim();
      }
    }

    // Known common problem fallback by slug if id still missing
    if (!id) {
      if (slug === 'roman-to-integer') id = 13;
      else if (slug === 'two-sum') id = 1;
      else if (slug === 'add-two-numbers') id = 2;
      else if (slug === 'longest-substring-without-repeating-characters') id = 3;
      else if (slug === 'median-of-two-sorted-arrays') id = 4;
      else if (slug === 'palindrome-number') id = 9;
      else if (slug === 'longest-common-prefix') id = 14;
      else if (slug === '3sum') id = 15;
      else if (slug === 'valid-parentheses') id = 20;
    }

    // Difficulty extraction
    let difficulty = 'Easy';
    const diffSelectors = [
      'div[class*="text-difficulty-"]',
      'div[class*="text-olive"]',
      'div[class*="text-yellow"]',
      'div[class*="text-pink"]',
      'span[class*="difficulty"]',
      'span[class*="text-olive"]'
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
    let language = 'cpp';
    const langButtons = document.querySelectorAll('button[id*="headlessui-listbox-button"], button[class*="rounded"]');
    for (const btn of langButtons) {
      const langText = (btn.textContent || '').trim().toLowerCase();
      if (langText.includes('c++') || langText === 'cpp') { language = 'cpp'; break; }
      if (langText.includes('python')) { language = 'python3'; break; }
      if (langText.includes('java') && !langText.includes('script')) { language = 'java'; break; }
      if (langText.includes('typescript')) { language = 'typescript'; break; }
      if (langText.includes('javascript')) { language = 'javascript'; break; }
      if (langText.includes('sql')) { language = 'sql'; break; }
      if (langText === 'c') { language = 'c'; break; }
    }

    // Performance metrics from submission result card (if visible)
    let runtime = null;
    let memory = null;
    let runtimePercentile = null;
    let memoryPercentile = null;

    const runtimeEl = document.querySelector('[class*="runtime"], div:has(> [class*="runtime"])');
    const fullBody = document.body ? document.body.innerText : '';
    const rtMatch = fullBody.match(/Runtime\s*([0-9]+\s*ms)(?:\s*Beats\s*([0-9.]+)%)?/i);
    if (rtMatch) {
      runtime = rtMatch[1];
      runtimePercentile = rtMatch[2] || null;
    }

    const memMatch = fullBody.match(/Memory\s*([0-9.]+\s*MB)(?:\s*Beats\s*([0-9.]+)%)?/i);
    if (memMatch) {
      memory = memMatch[1];
      memoryPercentile = memMatch[2] || null;
    }

    return {
      id,
      title,
      titleSlug: slug,
      difficulty,
      language,
      runtime,
      memory,
      runtimePercentile,
      memoryPercentile,
      url: `https://leetcode.com/problems/${slug}/`
    };
  }

  /**
   * Code extraction from Monaco Editor DOM
   */
  function extractCodeFromDOM() {
    // 1. Check if window.__CODE_RAGINII_GET_CODE__ exists (if main world accessible)
    if (typeof window.__CODE_RAGINII_GET_CODE__ === 'function') {
      const c = window.__CODE_RAGINII_GET_CODE__();
      if (c && c.trim()) return c;
    }

    // 2. Extract from Monaco view-lines container
    const viewLines = document.querySelector('.monaco-editor .view-lines');
    if (viewLines) {
      const lineElements = Array.from(viewLines.querySelectorAll('.view-line'));
      if (lineElements.length > 0) {
        return lineElements.map((el) => el.textContent.replace(/\u00A0/g, ' ')).join('\n');
      }
    }

    // 3. Extract from textarea.inputarea
    const textarea = document.querySelector('.monaco-editor textarea');
    if (textarea && textarea.value && textarea.value.trim().length > 10) {
      return textarea.value;
    }

    return null;
  }

  // =========================================================================
  // 2. Floating In-Page Toast Widget
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
    if (options.difficulty && diff) diff.textContent = options.difficulty;
    if (options.perf && perf) perf.textContent = options.perf;

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
  // 3. Ingestion Handler
  // =========================================================================
  async function handleAcceptedSubmission(submissionData = {}) {
    if (isSyncing) return;

    const submissionId = submissionData.submissionId || Date.now();
    if (lastProcessedSubmissionId && lastProcessedSubmissionId === submissionId) {
      console.log('[Code_Raginii] Duplicate submission event ignored:', submissionId);
      return;
    }
    lastProcessedSubmissionId = submissionId;
    isSyncing = true;

    const meta = extractProblemMetadata();
    const code = submissionData.code || extractCodeFromDOM();

    if (!code) {
      console.warn('[Code_Raginii] Could not extract solution code from editor.');
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
      runtime: submissionData.runtime || meta.runtime || null,
      runtimePercentile: submissionData.runtimePercentile || meta.runtimePercentile || null,
      memory: submissionData.memory || meta.memory || null,
      memoryPercentile: submissionData.memoryPercentile || meta.memoryPercentile || null,
      url: meta.url,
      submissionId: submissionId
    };

    console.log('[Code_Raginii] Ingesting accepted solution for:', problemPayload.title);

    showToastNotification({
      status: 'pending',
      message: `Accepted! Syncing ${meta.title} to GitHub...`,
      difficulty: meta.difficulty,
      perf: `${problemPayload.runtime || 'Accepted'} | GitHub`,
      persist: true
    });

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'LEETCODE_SUBMISSION_ACCEPTED',
        payload: { problem: problemPayload }
      });

      if (response && response.success) {
        if (response.duplicate) {
          console.log(`[Code_Raginii] "${meta.title}" is already up to date on GitHub.`);
          showToastNotification({
            status: 'info',
            message: `"${meta.title}" is already up to date on GitHub!`,
            difficulty: meta.difficulty,
            commitUrl: response.commitUrl,
            duration: 6000
          });
        } else {
          const shortSha = response.commitSha ? response.commitSha.slice(0, 7) : 'done';
          console.log(`[Code_Raginii] Synced successfully! Commit: ${shortSha}`);

          showToastNotification({
            status: 'success',
            message: `Uploaded ${meta.title} (${shortSha})!`,
            difficulty: meta.difficulty,
            perf: problemPayload.runtime ? `Runtime: ${problemPayload.runtime}` : 'Accepted',
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
        showToastNotification({
          status: 'error',
          message: `Sync failed: ${response?.error || 'Unknown error'}`,
          difficulty: meta.difficulty,
          duration: 6000
        });
      }
    } catch (err) {
      console.error('[Code_Raginii] Sync error:', err);
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
  // 4. Event Listeners (Network & DOM)
  // =========================================================================
  window.addEventListener('CODE_RAGINII_SUBMISSION_EVENT', (event) => {
    const detail = event.detail;
    if (detail && detail.statusDisplay === 'Accepted') {
      console.log('[Code_Raginii] Accepted event from interceptor:', detail);
      handleAcceptedSubmission(detail);
    }
  });

  // Check on load if an Accepted result is already on screen
  function checkExistingAcceptedInDOM() {
    const bodyText = document.body ? document.body.innerText : '';
    if (bodyText.includes('Accepted') && bodyText.includes('testcases passed')) {
      const meta = extractProblemMetadata();
      const code = extractCodeFromDOM();
      if (code) {
        console.log('[Code_Raginii] Detected existing Accepted submission on page load.');
        handleAcceptedSubmission({
          statusDisplay: 'Accepted',
          source: 'PAGE_LOAD_DOM'
        });
      }
    }
  }

  setTimeout(checkExistingAcceptedInDOM, 1500);

  // MutationObserver for visual "Accepted" changes
  let observerDebounce = null;
  const domObserver = new MutationObserver(() => {
    if (isSyncing) return;
    if (observerDebounce) clearTimeout(observerDebounce);
    observerDebounce = setTimeout(() => {
      const bodyText = document.body ? document.body.innerText : '';
      if (bodyText.includes('Accepted') && bodyText.includes('testcases passed')) {
        handleAcceptedSubmission({
          statusDisplay: 'Accepted',
          source: 'DOM_OBSERVER'
        });
      }
    }, 600);
  });

  domObserver.observe(document.body, { childList: true, subtree: true });

  // Listen for popup manual sync request
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'GET_CURRENT_PROBLEM_DATA') {
      const meta = extractProblemMetadata();
      const code = extractCodeFromDOM();
      sendResponse({
        success: Boolean(code),
        problem: {
          ...meta,
          code
        }
      });
      return true;
    }
  });
})();
