/**
 * RAG_LeetSync - Main World In-Page Script (Phase 4)
 * Runs directly in the LeetCode web page context to access window.monaco
 * and intercept submission verification network responses.
 */

(function () {
  'use strict';

  if (window.__RAG_LEETSYNC_MAIN_WORLD_INJECTED__) return;
  window.__RAG_LEETSYNC_MAIN_WORLD_INJECTED__ = true;

  console.log('[RAG_LeetSync] Main-world interceptor initialized.');

  /**
   * Safely retrieves source code from Monaco Editor instance
   */
  function getMonacoCode() {
    try {
      if (window.monaco && window.monaco.editor) {
        const models = window.monaco.editor.getModels();
        if (models && models.length > 0) {
          // Find the model with actual code content
          for (const model of models) {
            const val = model.getValue();
            if (val && val.trim().length > 0) {
              return val;
            }
          }
          return models[0].getValue();
        }
      }
    } catch (e) {
      console.warn('[RAG_LeetSync] Error reading Monaco model:', e);
    }
    return null;
  }

  /**
   * Listen for explicit code extraction requests from content script
   */
  window.addEventListener('RAG_LEETSYNC_REQUEST_CODE', () => {
    const code = getMonacoCode();
    window.dispatchEvent(
      new CustomEvent('RAG_LEETSYNC_CODE_RESPONSE', {
        detail: { code }
      })
    );
  });

  /**
   * Intercept window.fetch to detect Accepted submission verification payloads
   */
  const originalFetch = window.fetch;
  window.fetch = async function (...args) {
    const response = await originalFetch.apply(this, args);

    try {
      const url = typeof args[0] === 'string' ? args[0] : (args[0]?.url || '');

      // Check if this is a LeetCode submission status check URL
      // Examples:
      // https://leetcode.com/submissions/detail/<id>/check/
      // https://leetcode.com/problems/<slug>/submit/
      if (url.includes('/submissions/detail/') && url.includes('/check/')) {
        const clone = response.clone();
        clone.json().then((data) => {
          if (data && (data.state === 'SUCCESS' || data.status_code === 10)) {
            const isAccepted = data.status_display === 'Accepted' || data.total_correct === data.total_testcases;
            if (isAccepted) {
              const code = getMonacoCode();
              console.log('[RAG_LeetSync] Intercepted Accepted submission via network check:', data);

              window.dispatchEvent(
                new CustomEvent('RAG_LEETSYNC_SUBMISSION_EVENT', {
                  detail: {
                    type: 'NETWORK_ACCEPTED',
                    submissionId: data.submission_id,
                    questionId: data.question_id,
                    statusDisplay: 'Accepted',
                    runtime: data.status_runtime,
                    memory: data.status_memory,
                    runtimePercentile: data.runtime_percentile ? Number(data.runtime_percentile).toFixed(1) : null,
                    memoryPercentile: data.memory_percentile ? Number(data.memory_percentile).toFixed(1) : null,
                    language: data.lang,
                    code: code || data.code_output || null
                  }
                })
              );
            }
          }
        }).catch(() => {});
      }
    } catch (err) {
      // Ignore interception errors to avoid disturbing page
    }

    return response;
  };

  /**
   * Also hook XMLHttpRequest for legacy/alternative submission channels
   */
  const originalXHROpen = XMLHttpRequest.prototype.open;
  const originalXHRSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this._ragUrl = url;
    return originalXHROpen.apply(this, [method, url, ...rest]);
  };

  XMLHttpRequest.prototype.send = function (...args) {
    this.addEventListener('load', function () {
      try {
        if (this._ragUrl && typeof this._ragUrl === 'string' && this._ragUrl.includes('/check/')) {
          const data = JSON.parse(this.responseText);
          if (data && (data.state === 'SUCCESS' || data.status_display === 'Accepted')) {
            const code = getMonacoCode();
            window.dispatchEvent(
              new CustomEvent('RAG_LEETSYNC_SUBMISSION_EVENT', {
                detail: {
                  type: 'XHR_ACCEPTED',
                  submissionId: data.submission_id,
                  questionId: data.question_id,
                  statusDisplay: 'Accepted',
                  runtime: data.status_runtime,
                  memory: data.status_memory,
                  runtimePercentile: data.runtime_percentile ? Number(data.runtime_percentile).toFixed(1) : null,
                  memoryPercentile: data.memory_percentile ? Number(data.memory_percentile).toFixed(1) : null,
                  language: data.lang,
                  code: code || null
                }
              })
            );
          }
        }
      } catch (e) {}
    });

    return originalXHRSend.apply(this, args);
  };
})();
