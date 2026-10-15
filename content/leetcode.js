/**
 * RAG_LeetSync - Content Script for LeetCode (Phase 4)
 * Injected on https://leetcode.com/problems/* to observe submissions,
 * extract accepted code, and coordinate automatic synchronization to GitHub.
 */

(function () {
  'use strict';

  console.log('[RAG_LeetSync] LeetCode content script active on:', window.location.pathname);

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
      console.log('[RAG_LeetSync] Injected main-world interceptor.');
    } catch (e) {
      console.warn('[RAG_LeetSync] Failed to inject main-world script:', e);
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

    // If ID still null, check document title (e.g. "1. Two Sum - LeetCode")
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

    // Topic tags extraction
    const tags = [];
    const tagElements = document.querySelectorAll('a[href*="/tag/"]');
    tagElements.forEach((el) => {
      const t = el.textContent.trim();
      if (t && !tags.includes(t)) tags.push(t);
    });

    // Language extraction from dropdown or editor
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
    }

    return {
      id,
      title,
      titleSlug: slug,
      difficulty,
      tags,
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
    let toast = document.getElementById('rag-leetsync-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'rag-leetsync-toast';
      toast.className = 'hidden';
      toast.innerHTML = `
        <div class="rag-toast-header">
          <div class="rag-toast-brand">
            <img src="${chrome.runtime.getURL('icons/icon32.png')}" alt="Logo" class="rag-toast-logo">
            <span class="rag-toast-title">RAG_LeetSync</span>
          </div>
          <button class="rag-toast-close" id="rag-toast-close-btn">&times;</button>
        </div>
        <div class="rag-toast-body">
          <div class="rag-toast-status-row">
            <span class="rag-pulse-dot" id="rag-toast-dot"></span>
            <span class="rag-toast-message" id="rag-toast-msg">Solution Accepted! Syncing...</span>
          </div>
          <div class="rag-toast-meta" id="rag-toast-meta">
            <span class="rag-toast-badge" id="rag-toast-diff">Easy</span>
            <span id="rag-toast-perf">Runtime: -- | Memory: --</span>
          </div>
        </div>
        <div class="rag-toast-footer" id="rag-toast-footer">
          <span class="rag-toast-repo-text" id="rag-toast-repo">Target: rag_leetsync</span>
          <a href="#" target="_blank" class="rag-toast-btn rag-toast-btn-primary hidden" id="rag-toast-commit-btn">View Commit</a>
        </div>
      `;
      document.body.appendChild(toast);

      const closeBtn = document.getElementById('rag-toast-close-btn');
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
    const dot = document.getElementById('rag-toast-dot');
    const msg = document.getElementById('rag-toast-msg');
    const diff = document.getElementById('rag-toast-diff');
    const perf = document.getElementById('rag-toast-perf');
    const commitBtn = document.getElementById('rag-toast-commit-btn');
    const repoText = document.getElementById('rag-toast-repo');

    if (options.message && msg) msg.textContent = options.message;
    if (options.difficulty && diff) {
      diff.textContent = options.difficulty;
    }
    if (options.perf && perf) {
      perf.textContent = options.perf;
    }
    if (options.repo && repoText) {
      repoText.textContent = options.repo;
    }

    if (dot) {
      dot.className = 'rag-pulse-dot';
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
      console.log('[RAG_LeetSync] Duplicate submission event ignored:', submissionId);
      return;
    }
    lastProcessedSubmissionId = submissionId;
    isSyncing = true;

    const meta = extractProblemMetadata();
    const code = submissionData.code || extractCodeFromDOM();

    if (!code) {
      console.warn('[RAG_LeetSync] Could not extract solution code.');
      isSyncing = false;
      return;
    }

    const problemPayload = {
      id: submissionData.questionId || meta.id,
      title: meta.title,
      titleSlug: meta.titleSlug,
      difficulty: meta.difficulty,
      language: submissionData.language || meta.language,
      tags: meta.tags,
      code: code,
      runtime: submissionData.runtime || null,
      runtimePercentile: submissionData.runtimePercentile || null,
      memory: submissionData.memory || null,
      memoryPercentile: submissionData.memoryPercentile || null,
      url: meta.url,
      submissionId: submissionId
    };

    console.log('[RAG_LeetSync] Preparing automated sync for:', problemPayload.title);

    // Show initial in-page notification
    showToastNotification({
      status: 'pending',
      message: `Accepted! Syncing ${meta.title} to GitHub...`,
      difficulty: meta.difficulty,
      perf: `${submissionData.runtime || 'Fast'} | ${submissionData.memory || 'Optimal'}`,
      persist: true
    });

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'LEETCODE_SUBMISSION_ACCEPTED',
        payload: { problem: problemPayload }
      });

      if (response && response.success) {
        const shortSha = response.commitSha ? response.commitSha.slice(0, 7) : 'done';
        console.log(`[RAG_LeetSync] Solution automatically synced! Commit: ${shortSha}`);

        showToastNotification({
          status: 'success',
          message: `Synced ${meta.title} (${shortSha})!`,
          difficulty: meta.difficulty,
          perf: `Beats ${submissionData.runtimePercentile ? `${submissionData.runtimePercentile}%` : 'top'} runtime`,
          commitUrl: response.commitUrl,
          repo: response.dirPath,
          duration: 8000
        });
      } else if (response && response.autoSyncDisabled) {
        showToastNotification({
          status: 'info',
          message: `${meta.title} accepted! (Auto-sync is turned off in settings)`,
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
      console.error('[RAG_LeetSync] Content script sync error:', err);
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
  // 5. Event Listeners (Network & DOM)
  // =========================================================================
  // Network interception event from main-world.js
  window.addEventListener('RAG_LEETSYNC_SUBMISSION_EVENT', (event) => {
    const detail = event.detail;
    if (detail && detail.statusDisplay === 'Accepted') {
      console.log('[RAG_LeetSync] Accepted event received from network interceptor:', detail);
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
          // Look for submission result container containing "Accepted"
          const resultElements = document.querySelectorAll(
            '[data-e2e-locator="submission-result"], div[class*="text-green"], span[class*="text-green"]'
          );

          for (const el of resultElements) {
            const text = el.textContent.trim();
            if (text.includes('Accepted') && !text.includes('Accepted Solutions')) {
              console.log('[RAG_LeetSync] Detected Accepted state in DOM.');
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
