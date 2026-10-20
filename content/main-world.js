/**
 * Code_Raginii - Main World In-Page Script
 * Runs directly in the LeetCode web page execution context (world: "MAIN")
 * to access window.monaco and intercept submission network requests & responses.
 *
 * NOTE: Strictly intercepts SUBMIT actions only. "Run Code" / "Run" executions
 * and sample test runs are explicitly ignored to avoid unwanted commits.
 */

(function () {
  'use strict';

  if (window.__CODE_RAGINII_MAIN_WORLD_INJECTED__) return;
  window.__CODE_RAGINII_MAIN_WORLD_INJECTED__ = true;

  console.log('[Code_Raginii] Main-world script running in page context.');

  let lastSubmittedPayload = null;
  let isSubmitActionActive = false;
  let submitActionTimestamp = 0;

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
   * Enforces: ONLY real "Submit" Accepted results trigger an event.
   * "Run Code" test runs (interpret_solution) are strictly filtered out.
   */
  function handleSubmissionResponse(data) {
    if (!data) return;

    // 1. MUST have an active Submit action initiated by the user
    if (!isSubmitActionActive) {
      return;
    }

    // 2. Must be within 2 minutes of the Submit action
    if (Date.now() - submitActionTimestamp > 120000) {
      isSubmitActionActive = false;
      return;
    }

    // 3. Reject any "Run Code" test execution payloads (interpret responses)
    if (data.interpret_id || data.interpret_status_code !== undefined || data.run_success !== undefined) {
      console.log('[Code_Raginii] Run Code interpret response detected - ignoring.');
      return;
    }

    // 4. Must be a verified Accepted submission
    const isSuccess = data.state === 'SUCCESS' || data.status_code === 10;
    const isAccepted = data.status_display === 'Accepted';

    if (isSuccess && isAccepted) {
      // Consume the submit action so repeat checks or polls do not re-trigger
      isSubmitActionActive = false;

      const code = getMonacoCode() || lastSubmittedPayload?.typed_code || data.code_output || null;
      console.log('[Code_Raginii] Verified Accepted submission for question:', data.question_id || lastSubmittedPayload?.question_id);

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
    const method = (options.method || 'GET').toUpperCase();

    // 1. Intercept Submit POST request - THIS IS A REAL SUBMIT
    if (url.includes('/submit/') && method === 'POST') {
      isSubmitActionActive = true;
      submitActionTimestamp = Date.now();

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
            console.log('[Code_Raginii] Submit initiated for question:', parsed.question_id, parsed.lang);
          }
        }
      } catch (e) {}
    }

    // 2. Intercept Run Code (interpret_solution / testcode) - EXPLICITLY CANCEL SUBMIT STATE
    if ((url.includes('/interpret_solution/') || url.includes('/testcode/')) && method === 'POST') {
      isSubmitActionActive = false;
      console.log('[Code_Raginii] "Run Code" detected - auto-sync disabled for this test run.');
    }

    const response = await originalFetch.apply(this, args);

    // 3. Intercept check URL: /submissions/detail/<id>/check/
    if (url.includes('/submissions/detail/') && url.includes('/check/')) {
      try {
        const clone = response.clone();
        clone.json().then((data) => {
          handleSubmissionResponse(data);
        }).catch(() => {});
      } catch (err) {}
    }

    // 4. Intercept GraphQL submission details (only if Submit is active)
    if (url.includes('/graphql') && isSubmitActionActive) {
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
    this._crMethod = (method || 'GET').toUpperCase();
    return originalXHROpen.apply(this, [method, url, ...rest]);
  };

  XMLHttpRequest.prototype.send = function (body, ...rest) {
    // Submit request
    if (this._crUrl && this._crUrl.includes('/submit/') && this._crMethod === 'POST') {
      isSubmitActionActive = true;
      submitActionTimestamp = Date.now();

      if (typeof body === 'string') {
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
    }

    // Run Code request - explicitly cancel submit state
    if (this._crUrl && (this._crUrl.includes('/interpret_solution/') || this._crUrl.includes('/testcode/')) && this._crMethod === 'POST') {
      isSubmitActionActive = false;
      console.log('[Code_Raginii] XHR "Run Code" detected - auto-sync disabled.');
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
