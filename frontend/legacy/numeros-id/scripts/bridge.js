(function(){
      const analyzeBtn = document.getElementById('btnAnalyze');
      const creditsEl = document.getElementById('uiUserCredits');
      const noCreditsEl = document.getElementById('uiNoCredits');
      const userInfoBar = document.getElementById('userInfoBar');
      const resultsBox = document.getElementById('results');
      const rawOut = document.getElementById('rawOut');
      const osintLinks = document.getElementById('osintLinks');
      const CREDIT_TIMEOUT_MS = 8000;
      let creditLoaderTimer = null;
      let spendInFlight = false;
      let authWaitPromise = null;

      function sleep(ms){
        return new Promise((resolve) => setTimeout(resolve, ms));
      }

      async function waitForAuthMethod(method, timeout = 2500){
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
              const parentDoc = window.parent?.document;
              if (!parentDoc) break;
              const wfFrame = parentDoc.getElementById('wfFrame');
              const auth = wfFrame?.contentWindow?.Auth;
              if (auth && typeof auth[method] === 'function') {
                return auth;
              }
            } catch (_err) {}
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

      function redirectToLogin(){
        try {
          if (window.parent && window.parent !== window) {
            window.parent.postMessage({ type: 'wftools-open-login' }, '*');
          }
        } catch (_err) {}
      }

      function insertBeforeLogout(node){
        if (!userInfoBar) return;
        const logoutBtn = document.getElementById('uiLogoutBtn');
        if (logoutBtn && logoutBtn.parentElement === userInfoBar) {
          userInfoBar.insertBefore(node, logoutBtn);
        } else {
          userInfoBar.appendChild(node);
        }
      }

      function showCreditLoader(message){
        if (!userInfoBar) return;
        clearTimeout(creditLoaderTimer);
        let loader = document.getElementById('uiCreditLoader');
        if (!loader) {
          loader = document.createElement('span');
          loader.id = 'uiCreditLoader';
          loader.className = 'credit-loader';
          insertBeforeLogout(loader);
        }
        loader.textContent = message;
      }

      function hideCreditLoader(delay = 0){
        clearTimeout(creditLoaderTimer);
        const remove = () => {
          const node = document.getElementById('uiCreditLoader');
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

      function setAnalyzeBtnLoading(message){
        if (!analyzeBtn) return;
        if (!analyzeBtn.dataset.originalText){
          analyzeBtn.dataset.originalText = analyzeBtn.textContent || '';
        }
        analyzeBtn.textContent = message;
        analyzeBtn.disabled = true;
        analyzeBtn.classList.add('is-loading');
      }

      function restoreAnalyzeBtn(){
        if (!analyzeBtn) return;
        const original = analyzeBtn.dataset.originalText;
        if (original !== undefined){
          analyzeBtn.textContent = original;
        }
        analyzeBtn.disabled = false;
        analyzeBtn.classList.remove('is-loading');
      }

      function setAnalysisLoading(){
        if (resultsBox){
          resultsBox.innerHTML = '<div class="loading-state">Procesando números…</div>';
        }
        if (rawOut) rawOut.textContent = '';
        if (osintLinks) osintLinks.innerHTML = '';
      }

      function applyCreditsState(rawCredits){
        const num = Number(rawCredits);
        const isNum = Number.isFinite(num);
        if (creditsEl){
          if (isNum){
            const safeVal = Math.max(0, Math.floor(num));
            creditsEl.textContent = safeVal.toLocaleString('es-CO');
            creditsEl.dataset.rawCredits = String(safeVal);
          } else {
            creditsEl.textContent = '—';
            delete creditsEl.dataset.rawCredits;
          }
        }
        const shouldDisable = !isNum || num <= 0;
        if (noCreditsEl){
          noCreditsEl.style.display = shouldDisable ? 'inline' : 'none';
        }
        if (analyzeBtn && !spendInFlight){
          analyzeBtn.disabled = shouldDisable;
        }
      }

      function reflectLocalSpend(amount){
        if (!creditsEl) return;
        const current = Number(creditsEl.dataset.rawCredits);
        if (!Number.isFinite(current)) return;
        const next = Math.max(0, current - amount);
        applyCreditsState(next);
      }

      // Solicita información del usuario al cargarse
      try {
        window.parent.postMessage({ type: 'wftools-request-user-info' }, '*');
      } catch(_e) {}

      // Escucha mensajes desde el index unificado
      window.addEventListener('message', function(event){
        if (!event.data || typeof event.data !== 'object') return;
        const type = event.data.type;
        if (type === 'wftools-user-info') {
          // Actualiza los datos del usuario y controla créditos
          const name = event.data.name || '—';
          const email = event.data.email || '—';
          const plan = event.data.plan || '—';
          const creditsVal = event.data.credits;
          const nameEl    = document.getElementById('uiUserName');
          const emailEl   = document.getElementById('uiUserEmail');
          const planEl    = document.getElementById('uiUserPlan');
          if (nameEl) nameEl.textContent = name;
          if (emailEl) emailEl.textContent = email;
          if (planEl) planEl.textContent = plan;
          applyCreditsState(creditsVal);
          hideCreditLoader();
        } else if (type === 'wftools-logout') {
          // Restablece el panel al cerrar sesión
          ['uiUserName','uiUserEmail','uiUserPlan','uiUserCredits'].forEach(function(id){
            const el = document.getElementById(id);
            if (el) el.textContent = '—';
          });
          if (noCreditsEl) noCreditsEl.style.display = 'none';
          if (analyzeBtn) analyzeBtn.disabled = true;
          hideCreditLoader();
          spendInFlight = false;
          restoreAnalyzeBtn();
          redirectToLogin();
        }
      });

      function makeRequestId(prefix){
        return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      }

      async function tryDirectSpend(amount){
        try {
          const auth = await waitForAuthMethod('spendCredit');
          if (!auth) return null;
          for (let i = 0; i < amount; i += 1) {
            const ok = await auth.spendCredit();
            if (!ok) return false;
          }
          try {
            window.parent.postMessage({ type: 'wftools-request-user-info' }, '*');
          } catch (_e) {}
          return true;
        } catch (err) {
          console.error('Error al consumir créditos directamente:', err);
          return false;
        }
      }

      function requestCreditsViaBridge(amount){
        return new Promise((resolve) => {
          if (!window.parent || window.parent === window) {
            resolve(true);
            return;
          }
          const requestId = makeRequestId('spend');
          const handler = (event) => {
            if (!event.data || typeof event.data !== 'object') return;
            if (event.data.type !== 'wftools-spend-credits-result') return;
            if (event.data.requestId !== requestId) return;
            window.removeEventListener('message', handler);
            clearTimeout(timer);
            resolve(event.data.ok === true);
          };
          window.addEventListener('message', handler);
          const timer = setTimeout(() => {
            window.removeEventListener('message', handler);
            resolve(false);
          }, CREDIT_TIMEOUT_MS);
          try {
            window.parent.postMessage({ type: 'wftools-spend-credits', amount, requestId }, '*');
          } catch (err) {
            clearTimeout(timer);
            window.removeEventListener('message', handler);
            console.error('No se pudo solicitar consumo de créditos:', err);
            resolve(false);
          }
        }).then((ok) => {
          if (ok) {
            try {
              window.parent.postMessage({ type: 'wftools-request-user-info' }, '*');
            } catch (_e) {}
          }
          return ok;
        });
      }

      // Función para consumir créditos usando el frame de WF-TOOLS
      async function spendCredits(n) {
        const amount = Number.parseInt(n, 10);
        if (!Number.isFinite(amount) || amount <= 0) return true;
        const direct = await tryDirectSpend(amount);
        if (direct === true) return true;
        if (direct === false) return false;
        return requestCreditsViaBridge(amount);
      }

      // Reemplaza el handler del botón Analizar para descontar 1 crédito antes del análisis
      if (analyzeBtn) {
        analyzeBtn.addEventListener('click', async function(e){
          if (e) {
            e.preventDefault();
            e.stopImmediatePropagation();
          }
          if (spendInFlight) {
            return;
          }
          spendInFlight = true;
          setAnalyzeBtnLoading('Descontando crédito…');
          showCreditLoader('Descontando 1 crédito…');
          const ok = await spendCredits(1);
          if (!ok) {
            alert('No tienes créditos suficientes para esta consulta.');
            hideCreditLoader(400);
            restoreAnalyzeBtn();
            spendInFlight = false;
            return;
          }
          reflectLocalSpend(1);
          setAnalysisLoading();
          showCreditLoader('Crédito descontado, analizando…');
          try {
            const raw=(document.querySelector('#numbers').value||'').split(/\n+/).map(s=>s.trim()).filter(Boolean);
            const numbers=dedupe(raw);
            const country=document.querySelector('#country').value || 'CO';
            const rows=analyzeOffline(numbers, country);
            window.__rows=rows;
            renderResults(rows);
            buildOSINTLinks(rows.map(r=>r.e164||r.input));
          } finally {
            restoreAnalyzeBtn();
            spendInFlight = false;
            hideCreditLoader(800);
          }
        }, true);
      }

      // Maneja el botón de cierre de sesión (en la barra de usuario)
      const uiLogoutBtn = document.getElementById('uiLogoutBtn');

      async function waitForParentElement(id, timeout = 2500){
        const start = Date.now();
        while (Date.now() - start < timeout) {
          try {
            const parentDoc = window.parent?.document;
            if (!parentDoc) break;
            const wfFrame = parentDoc.getElementById('wfFrame');
            const frameDoc = wfFrame?.contentWindow?.document;
            if (!frameDoc) break;
            const el = frameDoc.getElementById(id);
            if (el) return el;
          } catch (_err) {}
          await sleep(120);
        }
        return null;
      }

      async function tryDirectLogout(){
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

      function requestLogoutViaBridge(){
        return new Promise((resolve) => {
          if (!window.parent || window.parent === window) {
            resolve(true);
            return;
          }
          const requestId = makeRequestId('logout');
          const handler = (event) => {
            if (!event.data || typeof event.data !== 'object') return;
            if (event.data.type !== 'wftools-logout-result') return;
            if (event.data.requestId !== requestId) return;
            window.removeEventListener('message', handler);
            clearTimeout(timer);
            resolve(event.data.ok === true);
          };
          window.addEventListener('message', handler);
          const timer = setTimeout(() => {
            window.removeEventListener('message', handler);
            resolve(false);
          }, CREDIT_TIMEOUT_MS);
          try {
            window.parent.postMessage({ type: 'wftools-request-logout', requestId }, '*');
          } catch (err) {
            clearTimeout(timer);
            window.removeEventListener('message', handler);
            console.error('No se pudo solicitar el cierre de sesión:', err);
            resolve(false);
          }
        });
      }

      if (uiLogoutBtn) {
        uiLogoutBtn.addEventListener('click', async function() {
          const viaBridge = await requestLogoutViaBridge();
          if (viaBridge) {
            redirectToLogin();
            return;
          }
          const direct = await tryDirectLogout();
          if (direct) {
            redirectToLogin();
            return;
          }
          alert('No se pudo cerrar la sesión automáticamente. Intenta salir desde WF-TOOLS.');
        });
      }
    })();
