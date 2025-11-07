(function (global) {
  function resolveElement(ref) {
    if (!ref) return null;
    if (typeof ref === 'string') {
      return document.getElementById(ref) || document.querySelector(ref);
    }
    if (ref instanceof Element) return ref;
    return null;
  }

  function createBridge(options = {}) {
    const analyzeButton = resolveElement(options.analyzeButton || options.analyzeButtonId);
    const creditsEl = resolveElement(options.creditsElement || options.creditsElementId);
    const noCreditsEl = resolveElement(options.noCreditsElement || options.noCreditsElementId);
    const userInfoBar = resolveElement(options.userInfoBar || options.userInfoBarId);
    const logoutButton = resolveElement(options.logoutButton || options.logoutButtonId);
    const creditLoaderId = options.creditLoaderId || 'uiCreditLoader';
    const creditLoaderClass = options.creditLoaderClass || 'credit-loader';
    const creditTimeout = options.creditTimeout || 8000;
    const parentFrameId = options.parentFrameId || 'wfFrame';
    const userFields = Object.assign({
      name: null,
      email: null,
      plan: null,
    }, options.userFields);

    let creditLoaderTimer = null;
    let authWaitPromise = null;
    let isSpending = false;
    let lastCreditsValue = null;
    const defaultSpendResult = Object.freeze({ ok: true, amount: 0, reason: null, message: null });
    let lastSpendResult = Object.assign({}, defaultSpendResult);
    const originalButtonText = new WeakMap();

    function sleep(ms) {
      return new Promise((resolve) => setTimeout(resolve, ms));
    }

    async function waitForAuthMethod(method, timeout = 2500) {
      const start = Date.now();
      if (authWaitPromise) {
        try {
          const cached = await authWaitPromise;
          if (cached && typeof cached[method] === 'function') {
            return cached;
          }
        } catch (_err) {
          authWaitPromise = null;
        }
      }
      const runner = (async () => {
        while (Date.now() - start < timeout) {
          try {
            const parentDoc = global.parent?.document;
            if (!parentDoc) break;
            const frame = parentDoc.getElementById(parentFrameId);
            const auth = frame?.contentWindow?.Auth;
            if (auth && typeof auth[method] === 'function') {
              return auth;
            }
          } catch (_err) {
            /* ignore */
          }
          await sleep(120);
        }
        return null;
      })();
      authWaitPromise = runner.catch(() => null);
      try {
        return await runner;
      } finally {
        authWaitPromise = null;
      }
    }

    function redirectToLogin() {
      try {
        if (global.parent && global.parent !== global) {
          global.parent.postMessage({ type: 'wftools-open-login' }, '*');
        }
      } catch (_err) {
        /* ignore */
      }
    }

    function insertBeforeLogout(node) {
      if (!userInfoBar) return;
      const logout = logoutButton || document.getElementById('uiLogoutBtn');
      if (logout && logout.parentElement === userInfoBar) {
        userInfoBar.insertBefore(node, logout);
      } else {
        userInfoBar.appendChild(node);
      }
    }

    function showCreditLoader(message) {
      if (!userInfoBar) return;
      clearTimeout(creditLoaderTimer);
      let loader = document.getElementById(creditLoaderId);
      if (!loader) {
        loader = document.createElement('span');
        loader.id = creditLoaderId;
        loader.className = creditLoaderClass;
        insertBeforeLogout(loader);
      }
      loader.textContent = message;
    }

    function hideCreditLoader(delay = 0) {
      clearTimeout(creditLoaderTimer);
      const remove = () => {
        const node = document.getElementById(creditLoaderId);
        if (node && node.parentElement) {
          node.parentElement.removeChild(node);
        }
      };
      if (delay > 0) {
        creditLoaderTimer = setTimeout(remove, delay);
      } else {
        remove();
      }
    }

    function setButtonLoading(message, button = analyzeButton) {
      if (!button) return;
      if (!originalButtonText.has(button)) {
        originalButtonText.set(button, button.textContent || '');
      }
      if (typeof message === 'string') {
        button.textContent = message;
      }
      button.disabled = true;
      button.classList.add('is-loading');
    }

    function restoreButton(button = analyzeButton) {
      if (!button) return;
      const original = originalButtonText.get(button);
      if (original !== undefined) {
        button.textContent = original;
      }
      button.disabled = false;
      button.classList.remove('is-loading');
    }

    function applyCreditsState(rawCredits) {
      lastCreditsValue = rawCredits;
      const unlimited = rawCredits === '∞' || rawCredits === 'unlimited';
      const num = Number(rawCredits);
      const isNum = Number.isFinite(num);
      if (creditsEl) {
        if (unlimited) {
          creditsEl.textContent = '∞';
          creditsEl.dataset.unlimited = 'true';
          delete creditsEl.dataset.rawCredits;
        } else if (isNum) {
          const safeVal = Math.max(0, Math.floor(num));
          creditsEl.textContent = safeVal.toLocaleString('es-CO');
          creditsEl.dataset.rawCredits = String(safeVal);
          delete creditsEl.dataset.unlimited;
        } else {
          creditsEl.textContent = '—';
          delete creditsEl.dataset.rawCredits;
          delete creditsEl.dataset.unlimited;
        }
      }
      const shouldDisable = unlimited ? false : !isNum || num <= 0;
      if (noCreditsEl) {
        noCreditsEl.style.display = shouldDisable ? 'inline' : 'none';
      }
      if (analyzeButton && !isSpending) {
        analyzeButton.disabled = shouldDisable;
      }
    }

    function reflectLocalSpend(amount) {
      if (!creditsEl) return;
      if (creditsEl.dataset.unlimited === 'true') return;
      const current = Number(creditsEl.dataset.rawCredits);
      if (!Number.isFinite(current)) return;
      const next = Math.max(0, current - amount);
      applyCreditsState(next);
    }

    function rememberSpendResult(result) {
      const normalized = Object.assign({}, defaultSpendResult, result || {});
      lastSpendResult = normalized;
      return normalized;
    }

    function requestUserInfo() {
      try {
        global.parent?.postMessage({ type: 'wftools-request-user-info' }, '*');
      } catch (_err) {
        /* noop */
      }
    }

    function makeRequestId(prefix) {
      return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    }

    async function tryDirectSpend(amount) {
      try {
        const auth = (await waitForAuthMethod('spendCredits')) || (await waitForAuthMethod('spendCredit'));
        if (!auth) return null;
        let ok = false;
        let detail = null;
        if (typeof auth.spendCredits === 'function') {
          ok = await auth.spendCredits(amount);
          if (typeof auth.getLastSpendResult === 'function') {
            detail = auth.getLastSpendResult();
          }
        } else if (typeof auth.spendCredit === 'function') {
          ok = true;
          for (let i = 0; i < amount; i += 1) {
            const stepOk = await auth.spendCredit();
            if (!stepOk) {
              ok = false;
              break;
            }
          }
          if (typeof auth.getLastSpendResult === 'function') {
            detail = auth.getLastSpendResult();
          }
          if (ok && detail) {
            detail = Object.assign({}, detail, { amount });
          }
        }
        const result = rememberSpendResult(
          detail || {
            ok,
            amount: ok ? amount : 0,
            reason: ok ? null : 'unknown',
          },
        );
        if (!result.ok && result.reason === 'session-expired') {
          redirectToLogin();
        }
        if (result.ok) {
          requestUserInfo();
        }
        return result.ok;
      } catch (err) {
        console.error('Error al consumir créditos directamente:', err);
        rememberSpendResult({ ok: false, reason: 'unexpected', message: err?.message || null });
        return false;
      }
    }

    function requestCreditsViaBridge(amount) {
      return new Promise((resolve) => {
        if (!global.parent || global.parent === global) {
          rememberSpendResult({ ok: true, amount, reason: null });
          resolve(true);
          return;
        }
        const requestId = makeRequestId('spend');
        const handler = (event) => {
          if (!event.data || typeof event.data !== 'object') return;
          if (event.data.type !== 'wftools-spend-credits-result') return;
          if (event.data.requestId !== requestId) return;
          global.removeEventListener('message', handler);
          clearTimeout(timer);
          const ok = event.data.ok === true;
          const reason = event.data.reason || null;
          const message = event.data.message || null;
          const consumed = Number.isFinite(Number(event.data.amount)) ? Number(event.data.amount) : 0;
          const unlimited = ok && reason === 'unlimited';
          const finalAmount = unlimited ? 0 : (ok ? consumed || amount : 0);
          const result = rememberSpendResult({ ok, reason, message, amount: finalAmount });
          if (!result.ok && result.reason === 'session-expired') {
            redirectToLogin();
          }
          resolve(ok);
        };
        global.addEventListener('message', handler);
        const timer = setTimeout(() => {
          global.removeEventListener('message', handler);
          rememberSpendResult({ ok: false, reason: 'timeout', message: 'No se recibió respuesta del verificador de créditos.' });
          resolve(false);
        }, creditTimeout);
        try {
          global.parent.postMessage({ type: 'wftools-spend-credits', amount, requestId }, '*');
        } catch (err) {
          clearTimeout(timer);
          global.removeEventListener('message', handler);
          console.error('No se pudo solicitar consumo de créditos:', err);
          rememberSpendResult({ ok: false, reason: 'bridge-error', message: err?.message || null });
          resolve(false);
        }
      }).then((ok) => {
        if (ok) {
          requestUserInfo();
        }
        return ok;
      });
    }

    async function spendCredits(n) {
      const amount = Number.parseInt(n, 10);
      if (!Number.isFinite(amount) || amount <= 0) {
        rememberSpendResult({ ok: true, amount: 0, reason: null });
        return true;
      }
      const direct = await tryDirectSpend(amount);
      if (direct === true) return true;
      if (direct === false) return false;
      return requestCreditsViaBridge(amount);
    }

    async function waitForParentElement(id, timeout = 2500) {
      const start = Date.now();
      while (Date.now() - start < timeout) {
        try {
          const parentDoc = global.parent?.document;
          if (!parentDoc) break;
          const frame = parentDoc.getElementById(parentFrameId);
          const frameDoc = frame?.contentWindow?.document;
          if (!frameDoc) break;
          const el = frameDoc.getElementById(id);
          if (el) return el;
        } catch (_err) {
          /* ignore */
        }
        await sleep(120);
      }
      return null;
    }

    async function tryDirectLogout() {
      try {
        const logoutEl = await waitForParentElement('logoutBtn');
        if (logoutEl && typeof logoutEl.click === 'function') {
          logoutEl.click();
          return true;
        }
        return null;
      } catch (err) {
        console.error('Error al cerrar sesión directamente:', err);
        return false;
      }
    }

    function requestLogoutViaBridge() {
      return new Promise((resolve) => {
        if (!global.parent || global.parent === global) {
          resolve(true);
          return;
        }
        const requestId = makeRequestId('logout');
        const handler = (event) => {
          if (!event.data || typeof event.data !== 'object') return;
          if (event.data.type !== 'wftools-logout-result') return;
          if (event.data.requestId !== requestId) return;
          global.removeEventListener('message', handler);
          clearTimeout(timer);
          resolve(event.data.ok === true);
        };
        global.addEventListener('message', handler);
        const timer = setTimeout(() => {
          global.removeEventListener('message', handler);
          resolve(false);
        }, creditTimeout);
        try {
          global.parent.postMessage({ type: 'wftools-request-logout', requestId }, '*');
        } catch (err) {
          clearTimeout(timer);
          global.removeEventListener('message', handler);
          console.error('No se pudo solicitar el cierre de sesión:', err);
          resolve(false);
        }
      });
    }

    function setSpending(flag) {
      isSpending = !!flag;
      if (!isSpending && lastCreditsValue !== null) {
        applyCreditsState(lastCreditsValue);
      }
    }

    function updateUserFields(payload) {
      if (!payload) return;
      if (userFields.name) {
        const el = resolveElement(userFields.name);
        if (el) el.textContent = payload.name || '—';
      }
      if (userFields.email) {
        const el = resolveElement(userFields.email);
        if (el) el.textContent = payload.email || '—';
      }
      if (userFields.plan) {
        const el = resolveElement(userFields.plan);
        if (el) el.textContent = payload.plan || '—';
      }
    }

    function clearUserFields() {
      ['name', 'email', 'plan'].forEach((key) => {
        const ref = userFields[key];
        if (!ref) return;
        const el = resolveElement(ref);
        if (el) el.textContent = '—';
      });
      if (creditsEl) {
        creditsEl.textContent = '—';
        delete creditsEl.dataset.rawCredits;
        delete creditsEl.dataset.unlimited;
      }
      if (noCreditsEl) noCreditsEl.style.display = 'none';
    }

    function handleMessage(event) {
      if (!event || !event.data || typeof event.data !== 'object') return false;
      const type = event.data.type;
      if (type === 'wftools-user-info') {
        updateUserFields(event.data);
        applyCreditsState(event.data.credits);
        hideCreditLoader();
        if (typeof options.onUserInfo === 'function') {
          options.onUserInfo(event.data);
        }
        return true;
      }
      if (type === 'wftools-logout') {
        clearUserFields();
        hideCreditLoader();
        setSpending(false);
        restoreButton();
        if (typeof options.onLogout === 'function') {
          options.onLogout(event.data);
        }
        redirectToLogin();
        return true;
      }
      return false;
    }

    return {
      analyzeButton,
      showCreditLoader,
      hideCreditLoader,
      setButtonLoading,
      restoreButton,
      applyCreditsState,
      reflectLocalSpend,
      spendCredits,
      requestUserInfo,
      handleMessage,
      redirectToLogin,
      requestLogoutViaBridge,
      tryDirectLogout,
      setSpending,
      isSpending: () => isSpending,
      getLastSpendResult: () => Object.assign({}, lastSpendResult),
    };
  }

  global.FrameCreditBridge = Object.freeze({ create: createBridge });
})(window);
