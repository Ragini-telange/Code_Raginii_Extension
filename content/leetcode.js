/**
 * Code_Raginii - Content Script for LeetCode
 * Runs on https://leetcode.com/problems/* to observe submissions,
 * extract accepted code, and coordinate automatic synchronization to GitHub.
 *
 * NOTE: Popup notifications are silenced for duplicates and page loads.
 * A simple, minimal notification pill is shown ONLY when a unique submission
 * is successfully committed to GitHub.
 */

(function () {
  'use strict';

  console.log('[Code_Raginii] Content script loaded on:', window.location.pathname);

  let lastProcessedSubmissionId = null;
  let isSyncing = false;
  let toastTimeout = null;

  // Track recent submit button clicks to prevent DOM observer from firing on reloads
  let recentSubmitClicked = false;
  let recentSubmitTimer = null;

  document.addEventListener('click', (e) => {
    const target = e.target;
    if (!target) return;
    const btn = target.closest('button');
    if (btn) {
      const text = (btn.textContent || '').trim().toLowerCase();
      if (text.includes('submit') || btn.getAttribute('data-cy') === 'submit-code-btn') {
        recentSubmitClicked = true;
        if (recentSubmitTimer) clearTimeout(recentSubmitTimer);
        recentSubmitTimer = setTimeout(() => {
          recentSubmitClicked = false;
        }, 30000);
      }
    }
  }, true);

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
   * Code extraction from Monaco Editor DOM or main world helper
   */
  function extractCodeFromDOM() {
    if (typeof window.__CODE_RAGINII_GET_CODE__ === 'function') {
      const c = window.__CODE_RAGINII_GET_CODE__();
      if (c && c.trim()) return c;
    }

    const viewLines = document.querySelector('.monaco-editor .view-lines');
    if (viewLines) {
      const lineElements = Array.from(viewLines.querySelectorAll('.view-line'));
      if (lineElements.length > 0) {
        return lineElements.map((el) => el.textContent.replace(/\u00A0/g, ' ')).join('\n');
      }
    }

    const textarea = document.querySelector('.monaco-editor textarea');
    if (textarea && textarea.value && textarea.value.trim().length > 10) {
      return textarea.value;
    }

    return null;
  }

  // =========================================================================
  // 2. Simple Committed Notification Pill (Only for unique commits)
  // =========================================================================
  function showSimpleCommittedToast(options = {}) {
    let toast = document.getElementById('code-raginii-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'code-raginii-toast';
      toast.className = 'code-raginii-toast-hidden';
      toast.innerHTML = `
        <div class="code-raginii-toast-pill">
          <span class="code-raginii-toast-check">✓</span>
          <span class="code-raginii-toast-text" id="code-raginii-toast-text">Committed to GitHub</span>
          <a href="#" target="_blank" class="code-raginii-toast-link" id="code-raginii-toast-link">View</a>
          <button class="code-raginii-toast-close" id="code-raginii-toast-close" title="Close" aria-label="Close">&times;</button>
        </div>
      `;
      document.body.appendChild(toast);

      const closeBtn = document.getElementById('code-raginii-toast-close');
      if (closeBtn) {
        closeBtn.addEventListener('click', () => {
          toast.classList.add('code-raginii-toast-hidden');
        });
      }
    }

    const textEl = document.getElementById('code-raginii-toast-text');
    const linkEl = document.getElementById('code-raginii-toast-link');

    if (textEl) {
      textEl.textContent = options.title ? `Committed: ${options.title}` : 'Committed to GitHub';
    }

    if (linkEl) {
      if (options.commitUrl) {
        linkEl.href = options.commitUrl;
        linkEl.style.display = 'inline';
      } else {
        linkEl.style.display = 'none';
      }
    }

    toast.classList.remove('code-raginii-toast-hidden');

    if (toastTimeout) clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
      toast.classList.add('code-raginii-toast-hidden');
    }, 3800);
  }

  // =========================================================================
  // 3. Ingestion Handler (Silent on duplicates, only pops on unique commit)
  // =========================================================================
  async function handleAcceptedSubmission(submissionData = {}) {
    if (isSyncing) return;

    const submissionId = submissionData.submissionId || Date.now();
    if (lastProcessedSubmissionId && lastProcessedSubmissionId === submissionId) {
      return;
    }
    lastProcessedSubmissionId = submissionId;
    isSyncing = true;

    const meta = extractProblemMetadata();
    const code = submissionData.code || extractCodeFromDOM();

    if (!code) {
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

    console.log('[Code_Raginii] Checking submission for:', problemPayload.title);

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'LEETCODE_SUBMISSION_ACCEPTED',
        payload: { problem: problemPayload }
      });

      if (response && response.success) {
        if (response.duplicate) {
          // DUPLICATE: Completely silent, no irritating popup!
          console.log(`[Code_Raginii] "${meta.title}" is already up to date on GitHub. Duplicate skipped silently.`);
        } else {
          // UNIQUE NEW SUBMISSION COMMITTED: Show simple, sleek notification
          const shortSha = response.commitSha ? response.commitSha.slice(0, 7) : '';
          console.log(`[Code_Raginii] Synced unique submission! Commit: ${shortSha}`);
          showSimpleCommittedToast({
            title: meta.title,
            commitUrl: response.commitUrl
          });
        }
      } else {
        console.warn('[Code_Raginii] Sync response:', response?.error || 'No commit made');
      }
    } catch (err) {
      console.error('[Code_Raginii] Sync error:', err);
    } finally {
      isSyncing = false;
    }
  }

  // =========================================================================
  // 4. Submission Event Listeners
  // =========================================================================
  // Primary trigger: Network interception from main-world.js on actual submit
  window.addEventListener('CODE_RAGINII_SUBMISSION_EVENT', (event) => {
    const detail = event.detail;
    if (detail && detail.statusDisplay === 'Accepted') {
      console.log('[Code_Raginii] Accepted event from interceptor:', detail);
      handleAcceptedSubmission(detail);
    }
  });

  // Secondary fallback: MutationObserver only when user recently clicked submit
  let observerDebounce = null;
  const domObserver = new MutationObserver(() => {
    if (isSyncing || !recentSubmitClicked) return;
    if (observerDebounce) clearTimeout(observerDebounce);
    observerDebounce = setTimeout(() => {
      const bodyText = document.body ? document.body.innerText : '';
      if (bodyText.includes('Accepted') && bodyText.includes('testcases passed')) {
        recentSubmitClicked = false;
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
