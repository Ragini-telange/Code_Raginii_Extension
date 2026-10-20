/**
 * Code_Raginii - Main World In-Page Script
 * Runs directly in the LeetCode web page execution context (world: "MAIN")
 * to access window.monaco and intercept submission network requests & responses.
 */

(function () {
  'use strict';

  if (window.__CODE_RAGINII_MAIN_WORLD_INJECTED__) return;
  window.__CODE_RAGINII_MAIN_WORLD_INJECTED__ = true;

  console.log('[Code_Raginii] Main-world script running in page context.');

  let lastSubmittedPayload = null;

  /**
   * Safely retrieves complete source code from Monaco Editor instance
   */
  function getMonacoCode() {
    try {
      if (window.monaco && window.monaco.editor) {
        const models = window.monaco.editor.getModels();
        if (models && models.length > 0) {
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
      console.warn('[Code_Raginii] Error reading Monaco model:', e);
    }
    return null;
  }

  // Expose global helper for content script or debugging
  window.__CODE_RAGINII_GET_CODE__ = function () {
    return getMonacoCode() || lastSubmittedPayload?.typed_code || null;
  };

  /**
   * Listen for explicit code extraction requests from content script
   */
  window.addEventListener('CODE_RAGINII_REQUEST_CODE', () => {
    const code = window.__CODE_RAGINII_GET_CODE__();
    window.dispatchEvent(
      new CustomEvent('CODE_RAGINII_CODE_RESPONSE', {
        detail: {
          code,
          lang: lastSubmittedPayload?.lang || null,
          questionId: lastSubmittedPayload?.question_id || null
        }
      })
    );
  });

  /**
   * Process submission verification payload (from fetch or XHR)
   */
  function handleSubmissionResponse(data) {
    if (!data) return;

    // Check if this is a submission status response
    const isSuccess = data.state === 'SUCCESS' || data.status_code === 10;
    const isAccepted = data.status_display === 'Accepted' || (data.total_correct && data.total_correct === data.total_testcases);

    if (isSuccess && isAccepted) {
      const code = getMonacoCode() || lastSubmittedPayload?.typed_code || data.code_output || null;
      console.log('[Code_Raginii] Verified Accepted submission payload:', data);

      window.dispatchEvent(
        new CustomEvent('CODE_RAGINII_SUBMISSION_EVENT', {
          detail: {
            type: 'ACCEPTED_SUBMISSION',
            submissionId: data.submission_id || data.submission_id_str,
            questionId: data.question_id || lastSubmittedPayload?.question_id,
            statusDisplay: 'Accepted',
            runtime: data.status_runtime,
            memory: data.status_memory,
            runtimePercentile: data.runtime_percentile ? Number(data.runtime_percentile).toFixed(1) : null,
            memoryPercentile: data.memory_percentile ? Number(data.memory_percentile).toFixed(1) : null,
            language: data.lang || lastSubmittedPayload?.lang,
            code: code
          }
        })
      );
    }
  }

  /**
   * Intercept window.fetch
   */
  const originalFetch = window.fetch;
  window.fetch = async function (...args) {
    const url = typeof args[0] === 'string' ? args[0] : (args[0]?.url || '');
    const options = args[1] || {};

    // 1. Intercept Submit POST request to cache the exact typed_code & language
    if (url.includes('/submit/') && options.method === 'POST') {
      try {
        if (typeof options.body === 'string') {
          const parsed = JSON.parse(options.body);
          if (parsed && parsed.typed_code) {
            lastSubmittedPayload = {
              lang: parsed.lang,
              question_id: parsed.question_id,
              typed_code: parsed.typed_code,
              timestamp: Date.now()
            };
            console.log('[Code_Raginii] Cached submit payload for question:', parsed.question_id, parsed.lang);
          }
        }
      } catch (e) {}
    }

    const response = await originalFetch.apply(this, args);

    // 2. Intercept check URL: /submissions/detail/<id>/check/
    if (url.includes('/submissions/detail/') && url.includes('/check/')) {
      try {
        const clone = response.clone();
        clone.json().then((data) => {
          handleSubmissionResponse(data);
        }).catch(() => {});
      } catch (err) {}
    }

    // 3. Intercept GraphQL submission details
    if (url.includes('/graphql')) {
      try {
        const clone = response.clone();
        clone.json().then((data) => {
          const details = data?.data?.submissionDetails || data?.data?.submissionDetail || data?.data?.submissionStatus;
          if (details && details.statusDisplay === 'Accepted') {
            handleSubmissionResponse({
              state: 'SUCCESS',
              status_display: 'Accepted',
              submission_id: details.id,
              status_runtime: details.runtime,
              status_memory: details.memory,
              runtime_percentile: details.runtimePercentile,
              memory_percentile: details.memoryPercentile,
              lang: details.lang?.name?.toLowerCase() || lastSubmittedPayload?.lang,
              code_output: details.code || null
            });
          }
        }).catch(() => {});
      } catch (err) {}
    }

    return response;
  };

  /**
   * Also hook XMLHttpRequest for legacy submission endpoints
   */
  const originalXHROpen = XMLHttpRequest.prototype.open;
  const originalXHRSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this._crUrl = url;
    this._crMethod = method;
    return originalXHROpen.apply(this, [method, url, ...rest]);
  };

  XMLHttpRequest.prototype.send = function (body, ...rest) {
    if (this._crUrl && this._crUrl.includes('/submit/') && this._crMethod === 'POST' && typeof body === 'string') {
      try {
        const parsed = JSON.parse(body);
        if (parsed && parsed.typed_code) {
          lastSubmittedPayload = {
            lang: parsed.lang,
            question_id: parsed.question_id,
            typed_code: parsed.typed_code,
            timestamp: Date.now()
          };
        }
      } catch (e) {}
    }

    this.addEventListener('load', function () {
      try {
        if (this._crUrl && this._crUrl.includes('/check/')) {
          const data = JSON.parse(this.responseText);
          handleSubmissionResponse(data);
        }
      } catch (e) {}
    });

    return originalXHRSend.apply(this, [body, ...rest]);
  };
})();
